import { escapeHtml, openDrawer, closeDrawer, toast } from './components.js';
import { renderInterfaceSelector } from './interface-selector.js';
import { getState, mutate } from './store.js';

let localSequence = 0;

const enabledWords = new Set(['1', 'true', 'yes', 'on', '开', '开启', '启用']);
const disabledWords = new Set(['0', 'false', 'no', 'off', '关', '关闭', '禁用']);

function localId() {
  localSequence += 1;
  return `draft-${Date.now().toString(36)}-${localSequence}`;
}

function pad(value, size = 3) {
  return String(value).padStart(size, '0');
}

export function generatedMac(index, vlanId = null) {
  const group = vlanId == null ? 1 : Number(vlanId) % 256;
  const high = Math.floor(index / 256) % 256;
  const low = index % 256;
  return `02:4c:48:${pad(group.toString(16), 2)}:${pad(high.toString(16), 2)}:${pad(low.toString(16), 2)}`;
}

export function generatedWanId(index, vlanId = null) {
  return vlanId == null ? `wan-${pad(index)}` : `wan-${vlanId}-${pad(index, 2)}`;
}

export function createPppoeSession({ index = 1, vlanId = null, parentInterface = 'eth4', defaults = {}, username = '' } = {}) {
  return {
    localId: localId(),
    id: `session-${vlanId == null ? pad(index) : `${vlanId}-${pad(index, 2)}`}`,
    wanId: generatedWanId(index, vlanId),
    parentInterface,
    vlanId,
    username,
    macMode: 'generated',
    mac: generatedMac(index, vlanId),
    ipv4: defaults.ipv4 !== false,
    ipv6: defaults.ipv6 !== false,
    requestPd: defaults.ipv6 !== false && defaults.requestPd !== false,
    weight: Number(defaults.weight) || 1,
    poolId: defaults.poolId || 'pool-core',
    enabled: defaults.enabled !== false,
    secretConfigured: false,
    status: 'draft'
  };
}

export function clonePppoeSession(session, { wanId, mac } = {}) {
  return {
    ...session,
    localId: localId(),
    id: `session-${localId()}`,
    wanId: wanId || session.wanId,
    mac: mac || session.mac,
    secretConfigured: false,
    status: 'draft'
  };
}

export function movePppoeSession(sessions, index, direction) {
  const target = index + direction;
  if (index < 0 || index >= sessions.length || target < 0 || target >= sessions.length) return false;
  [sessions[index], sessions[target]] = [sessions[target], sessions[index]];
  return true;
}

export function deletePppoeSession(sessions, index) {
  if (index < 0 || index >= sessions.length) return null;
  return sessions.splice(index, 1)[0] || null;
}

function parseBoolean(value, fallback) {
  if (value == null || String(value).trim() === '') return { value: fallback, valid: true };
  const normalized = String(value).trim().toLowerCase();
  if (enabledWords.has(normalized)) return { value: true, valid: true };
  if (disabledWords.has(normalized)) return { value: false, valid: true };
  return { value: fallback, valid: false };
}

function validMac(value) {
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(String(value || ''));
}

function splitImportLine(line) {
  if (line.includes(',')) return line.split(',').map((value) => value.trim());
  return line.trim().split(/\s+/);
}

export function parsePppoeBatch(text, options = {}) {
  const defaults = options.defaults || {};
  const parentInterface = options.parentInterface || 'eth4';
  const vlanMode = Boolean(options.vlanMode);
  const existingUsernames = new Set((options.existingUsernames || []).filter(Boolean));
  const seen = new Set();
  const rows = [];
  const errors = [];
  String(text || '').split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    const fields = splitImportLine(line);
    const messages = [];
    let username = ''; let transientPassword = ''; let sourceInterface = parentInterface; let vlanId = options.fixedVlan ?? null; let mac = ''; let weight = defaults.weight || 1; let ipv4 = defaults.ipv4 !== false; let ipv6 = defaults.ipv6 !== false; let requestPd = defaults.requestPd !== false;
    if (fields.length === 2) [username, transientPassword] = fields;
    else if (fields.length === 3 && vlanMode) [username, transientPassword, vlanId] = fields;
    else if (fields.length === 6) [username, transientPassword, mac, weight, ipv4, ipv6] = fields;
    else if (fields.length === 8) [username, transientPassword, sourceInterface, vlanId, mac, weight, ipv4, ipv6] = fields;
    else if (fields.length === 9) [username, transientPassword, sourceInterface, vlanId, mac, weight, ipv4, ipv6, requestPd] = fields;
    else messages.push(`字段数量 ${fields.length} 不受支持`);
    username = String(username || '').trim(); transientPassword = String(transientPassword || '');
    if (!username) messages.push('账号为空');
    if (!transientPassword) messages.push('密码为空');
    if (username && (seen.has(username) || existingUsernames.has(username))) messages.push('账号重复');
    seen.add(username);
    const numericVlan = vlanId == null || vlanId === '' ? null : Number(vlanId);
    if (vlanMode && (!Number.isInteger(numericVlan) || numericVlan < 1 || numericVlan > 4094)) messages.push('VLAN必须是1到4094的整数');
    if (sourceInterface && sourceInterface !== parentInterface) messages.push(`接口${sourceInterface}与当前父接口${parentInterface}不一致`);
    const numericWeight = Number(weight);
    if (!Number.isInteger(numericWeight) || numericWeight < 1) messages.push('权重必须是正整数');
    const parsedIpv4 = parseBoolean(ipv4, defaults.ipv4 !== false); const parsedIpv6 = parseBoolean(ipv6, defaults.ipv6 !== false); const parsedPd = parseBoolean(requestPd, defaults.requestPd !== false);
    if (!parsedIpv4.valid) messages.push('IPv4开关无效');
    if (!parsedIpv6.valid) messages.push('IPv6开关无效');
    if (!parsedPd.valid) messages.push('PD开关无效');
    if (mac && !validMac(mac)) messages.push('MAC格式无效');
    const session = createPppoeSession({ index: rows.length + 1, vlanId: numericVlan, parentInterface, defaults, username });
    session.mac = mac || generatedMac(rows.length + 1, numericVlan);
    session.macMode = mac ? 'custom' : 'generated';
    session.weight = numericWeight || 1;
    session.ipv4 = parsedIpv4.value;
    session.ipv6 = parsedIpv6.value;
    session.requestPd = parsedIpv6.value && parsedPd.value;
    rows.push({ session, transientPassword, line: lineIndex + 1, messages });
    if (messages.length) errors.push({ line: lineIndex + 1, messages });
  });
  if (!rows.length) errors.push({ line: 0, messages: ['没有可解析的账号行'] });
  return { rows, errors, valid: errors.length === 0 };
}

function passwordValue(passwords, localKey) {
  if (passwords instanceof Map) return passwords.get(localKey) || '';
  return passwords?.[localKey] || '';
}

export function validatePppoeModel({ groups, parentInterface, passwords, pools, existingSessions = [], profileId = '' }) {
  const rowErrors = new Map();
  const generalErrors = [];
  const allRows = groups.flatMap((group) => group.sessions);
  const add = (row, field, message) => {
    const current = rowErrors.get(row.localId) || {};
    current[field] ||= [];
    current[field].push(message);
    rowErrors.set(row.localId, current);
  };
  if (!allRows.length) generalErrors.push('至少需要一条PPPoE账号。');
  const state = getState();
  const port = state.physicalPorts.find((item) => item.name === parentInterface);
  if (!port) generalErrors.push('必须选择物理接口。');
  else if (port.management || port.role === 'temporary-management') generalErrors.push('当前管理接口不能直接改为WAN，请先迁移管理口。');
  else if (port.role === 'lan') generalErrors.push('独占LAN接口不能用于PPPoE多拨。');
  const wanCounts = new Map(); const macCounts = new Map(); const usernameCounts = new Map();
  const otherSessions = existingSessions.filter((session) => session.profileId !== profileId);
  allRows.forEach((row) => {
    if (row.wanId) wanCounts.set(row.wanId, (wanCounts.get(row.wanId) || 0) + 1);
    if (row.mac) macCounts.set(row.mac.toLowerCase(), (macCounts.get(row.mac.toLowerCase()) || 0) + 1);
    if (row.username) usernameCounts.set(row.username, (usernameCounts.get(row.username) || 0) + 1);
  });
  otherSessions.forEach((row) => {
    if (row.wanId) wanCounts.set(row.wanId, (wanCounts.get(row.wanId) || 0) + 1);
    if (row.mac) macCounts.set(row.mac.toLowerCase(), (macCounts.get(row.mac.toLowerCase()) || 0) + 1);
    if (row.username && (row.parentInterface || row.parent) === parentInterface) usernameCounts.set(row.username, (usernameCounts.get(row.username) || 0) + 1);
  });
  const vlanKeys = new Set();
  groups.forEach((group) => {
    if (group.vlanId != null) {
      if (!Number.isInteger(Number(group.vlanId)) || Number(group.vlanId) < 1 || Number(group.vlanId) > 4094) {
        generalErrors.push(`VLAN ${group.vlanId || '(空)'} 必须是1到4094的整数。`);
        group.sessions.forEach((row) => add(row, 'vlanId', '所属VLAN无效'));
      }
      const key = `${parentInterface}.${group.vlanId}`;
      if (vlanKeys.has(key)) {
        generalErrors.push(`VLAN接口 ${key} 重复。`);
        group.sessions.forEach((row) => add(row, 'vlanId', 'VLAN接口重复'));
      }
      vlanKeys.add(key);
    }
    group.sessions.forEach((row) => {
      if (!String(row.username || '').trim()) add(row, 'username', '账号不能为空');
      if (!passwordValue(passwords, row.localId)) add(row, 'password', '密码不能为空，刷新后需要重新输入');
      if (!String(row.wanId || '').trim()) add(row, 'wanId', 'WAN ID不能为空');
      else if ((wanCounts.get(row.wanId) || 0) > 1) add(row, 'wanId', 'WAN ID重复');
      if (!validMac(row.mac)) add(row, 'mac', 'MAC格式无效');
      else if ((macCounts.get(row.mac.toLowerCase()) || 0) > 1) add(row, 'mac', 'MAC重复');
      if (row.username && (usernameCounts.get(row.username) || 0) > 1) add(row, 'username', '账号重复');
      if (!Number.isInteger(Number(row.weight)) || Number(row.weight) < 1) add(row, 'weight', '权重必须是正整数');
      if (!pools.some((pool) => pool.id === row.poolId)) add(row, 'poolId', '线路池不存在');
      if (![true, false].includes(row.ipv4)) add(row, 'ipv4', 'IPv4开关无效');
      if (![true, false].includes(row.ipv6)) add(row, 'ipv6', 'IPv6开关无效');
      if (![true, false].includes(row.requestPd)) add(row, 'requestPd', 'PD开关无效');
      if (!row.ipv6 && row.requestPd) add(row, 'requestPd', '关闭IPv6时不能请求PD');
      if (group.vlanId != null && row.vlanId !== Number(group.vlanId)) add(row, 'vlanId', '会话VLAN与配置块不一致');
    });
  });
  return { valid: rowErrors.size === 0 && generalErrors.length === 0, rowErrors, generalErrors, count: allRows.length };
}

export function createVlanRange({ start, end, step, perVlan, parentInterface, defaults }) {
  const first = Number(start); const last = Number(end); const stride = Number(step); const count = Number(perVlan);
  if (![first, last, stride, count].every(Number.isInteger) || first < 1 || last > 4094 || first > last || stride < 1 || count < 1) return { groups: [], errors: ['VLAN范围、步进和账号数必须是合法正整数。'] };
  const groups = [];
  for (let vlanId = first; vlanId <= last && groups.length < 256; vlanId += stride) {
    const sessions = Array.from({ length: count }, (_, index) => createPppoeSession({ index: index + 1, vlanId, parentInterface, defaults }));
    groups.push({ id: `vlan-${vlanId}-${localId()}`, vlanId, sessions });
  }
  return { groups, errors: [] };
}

export function serializePppoeSessions({ groups, parentInterface, profileId, status = 'configured' }) {
  return groups.flatMap((group) => group.sessions.map((row) => ({
    id: row.id,
    wanId: row.wanId,
    parentInterface,
    vlanId: row.vlanId,
    username: row.username,
    macMode: row.macMode,
    mac: row.mac,
    ipv4: row.ipv4,
    ipv6: row.ipv6,
    requestPd: row.requestPd,
    weight: row.weight,
    poolId: row.poolId,
    enabled: row.enabled,
    profileId,
    secretConfigured: true,
    status
  })));
}

export function buildPppoePreviewModel({ groups, parentInterface, passwords }) {
  const previewGroups = groups.map((group) => ({
    vlanId: group.vlanId,
    interfaceName: group.vlanId == null ? parentInterface : `${parentInterface}.${group.vlanId}`,
    sessions: group.sessions.map((row) => ({
      localId: row.localId,
      id: row.id,
      wanId: row.wanId,
      username: row.username,
      passwordConfigured: Boolean(passwordValue(passwords, row.localId)),
      mac: row.mac,
      ipv4: row.ipv4,
      ipv6: row.ipv6,
      requestPd: row.requestPd,
      weight: row.weight,
      poolId: row.poolId,
      enabled: row.enabled
    }))
  }));
  return { parentInterface, count: previewGroups.flatMap((group) => group.sessions).length, groups: previewGroups };
}

function maskUsername(username) {
  const value = String(username || '');
  if (value.length <= 4) return `${value.slice(0, 1)}***`;
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function normalizedSavedSession(session, index) {
  return {
    ...session,
    localId: localId(),
    id: session.id || `session-${pad(index + 1)}`,
    parentInterface: session.parentInterface || session.parent || 'eth4',
    vlanId: session.vlanId == null ? null : Number(session.vlanId),
    macMode: session.macMode || 'generated',
    mac: session.mac || generatedMac(index + 1, session.vlanId),
    ipv4: session.ipv4 !== false,
    ipv6: session.ipv6 !== false,
    requestPd: session.ipv6 !== false && session.requestPd !== false,
    weight: Number(session.weight) || 1,
    poolId: session.poolId || 'pool-core',
    enabled: session.enabled !== false,
    secretConfigured: Boolean(session.secretConfigured)
  };
}

function fieldError(errors, field) {
  return escapeHtml((errors?.[field] || []).join('；'));
}

function switchControl(row, field, label, disabled = false) {
  return `<label class="row-switch" title="${escapeHtml(label)}"><input type="checkbox" data-field="${field}" ${row[field] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span></span></label><small class="row-field-error" data-error="${field}"></small>`;
}

function rowHtml(row, index, pools, errors = {}) {
  return `<div class="pppoe-row ${Object.keys(errors).length ? 'has-error' : ''}" data-session-id="${escapeHtml(row.localId)}">
    <div class="row-order"><b>${index + 1}</b><span class="drag-order"><button type="button" data-row-action="up" title="上移">↑</button><button type="button" data-row-action="down" title="下移">↓</button></span></div>
    <label><span class="mobile-field-label">WAN ID</span><input class="row-input mono" data-field="wanId" value="${escapeHtml(row.wanId)}"><small class="row-field-error" data-error="wanId">${fieldError(errors, 'wanId')}</small></label>
    <label><span class="mobile-field-label">PPPoE账号</span><input class="row-input" data-field="username" value="${escapeHtml(row.username)}" autocomplete="off"><small class="row-field-error" data-error="username">${fieldError(errors, 'username')}</small></label>
    <label class="password-cell"><span class="mobile-field-label">PPPoE密码</span><span><input class="row-input" type="password" data-password autocomplete="new-password" placeholder="${row.secretConfigured ? '请重新输入' : '输入密码'}"><button type="button" data-toggle-password title="显示或隐藏密码">显示</button></span><small class="row-field-error" data-error="password">${fieldError(errors, 'password')}</small></label>
    <label><span class="mobile-field-label">MAC</span><input class="row-input mono" data-field="mac" value="${escapeHtml(row.mac)}"><small class="row-field-error" data-error="mac">${fieldError(errors, 'mac')}</small></label>
    <div class="switch-cell"><span class="mobile-field-label">IPv4</span>${switchControl(row, 'ipv4', 'IPv4')}</div>
    <div class="switch-cell"><span class="mobile-field-label">IPv6</span>${switchControl(row, 'ipv6', 'IPv6')}</div>
    <div class="switch-cell"><span class="mobile-field-label">IPv6-PD</span>${switchControl(row, 'requestPd', 'IPv6-PD', !row.ipv6)}</div>
    <label><span class="mobile-field-label">权重</span><input class="row-input weight" type="number" min="1" max="100" data-field="weight" value="${row.weight}"><small class="row-field-error" data-error="weight">${fieldError(errors, 'weight')}</small></label>
    <label><span class="mobile-field-label">线路池</span><select class="row-select" data-field="poolId">${pools.map((pool) => `<option value="${escapeHtml(pool.id)}" ${pool.id === row.poolId ? 'selected' : ''}>${escapeHtml(pool.name)}</option>`).join('')}</select><small class="row-field-error" data-error="poolId">${fieldError(errors, 'poolId')}</small></label>
    <div class="switch-cell"><span class="mobile-field-label">启用</span>${switchControl(row, 'enabled', '启用')}</div>
    <div class="row-actions"><button type="button" data-row-action="copy">复制</button><button type="button" data-row-action="delete" class="danger">删除</button></div>
  </div>`;
}

function rowsHeader() {
  return '<div class="pppoe-row-header"><span>序号</span><span>WAN ID</span><span>PPPoE账号</span><span>PPPoE密码</span><span>MAC</span><span>IPv4</span><span>IPv6</span><span>PD</span><span>权重</span><span>线路池</span><span>启用</span><span>操作</span></div>';
}

function commonSettingsHtml(defaults, pools) {
  return `<details class="pppoe-common" open><summary>公共设置 <span>新账号自动继承</span></summary><div class="common-settings-grid"><label><input type="checkbox" data-default="autoWan" ${defaults.autoWan ? 'checked' : ''}>自动生成WAN ID</label><label><input type="checkbox" data-default="autoMac" ${defaults.autoMac ? 'checked' : ''}>自动生成独立MAC</label><label><input type="checkbox" data-default="ipv4" ${defaults.ipv4 ? 'checked' : ''}>默认启用IPv4</label><label><input type="checkbox" data-default="ipv6" ${defaults.ipv6 ? 'checked' : ''}>默认启用IPv6</label><label><input type="checkbox" data-default="requestPd" ${defaults.requestPd ? 'checked' : ''} ${!defaults.ipv6 ? 'disabled' : ''}>默认请求IPv6-PD</label><label>默认权重<input class="input compact" type="number" min="1" max="100" data-default="weight" value="${defaults.weight}"></label><label>默认线路池<select class="select compact" data-default="poolId">${pools.map((pool) => `<option value="${escapeHtml(pool.id)}" ${pool.id === defaults.poolId ? 'selected' : ''}>${escapeHtml(pool.name)}</option>`).join('')}</select></label><label>MTU<input class="input compact" type="number" min="1280" max="1500" data-default="mtu" value="${defaults.mtu}"></label><label>MRU<input class="input compact" type="number" min="1280" max="1500" data-default="mru" value="${defaults.mru}"></label><label><input type="checkbox" data-default="autoRedial" ${defaults.autoRedial ? 'checked' : ''}>自动重拨</label><label><input type="checkbox" data-default="healthCheck" ${defaults.healthCheck ? 'checked' : ''}>健康检查</label></div></details>`;
}

function editorToolbar(label = '新增账号') {
  return `<div class="account-toolbar"><button class="button primary" type="button" data-editor-action="add">＋ ${escapeHtml(label)}</button><button class="button" type="button" data-editor-action="paste">批量粘贴</button><label class="button file-button">导入CSV<input type="file" accept=".csv,text/csv,text/plain" data-editor-import></label><button class="button" type="button" data-editor-action="fill-wan">自动填充WAN ID</button><button class="button" type="button" data-editor-action="fill-mac">自动生成MAC</button><button class="button danger-ghost" type="button" data-editor-action="clear">清空</button></div>`;
}

function previewSession(row, passwordSet) {
  return `<li class="preview-session"><header><strong class="mono">${escapeHtml(row.wanId || '(未填写WAN ID)')}</strong>${row.enabled ? '<span class="compact-state up">启用</span>' : '<span class="compact-state down">禁用</span>'}</header><div><span>PPPoE会话</span><b class="mono">${escapeHtml(row.id || '--')}</b></div><div><span>账号</span><b>${escapeHtml(maskUsername(row.username) || '未填写')}</b></div><div><span>密码</span><b>${passwordSet ? '已输入（隐藏）' : '需重新输入'}</b></div><div><span>MAC</span><b class="mono">${escapeHtml(row.mac || '--')}</b></div><div><span>IPv4 / IPv6 / PD</span><b>${row.ipv4 ? '开' : '关'} / ${row.ipv6 ? '开' : '关'} / ${row.requestPd ? '开' : '关'}</b></div><div><span>权重 / 线路池</span><b>${row.weight} / ${escapeHtml(row.poolId)}</b></div></li>`;
}

function importDrawer({ editor, initialText = '', fixedVlan = null, vlanMode = false }) {
  openDrawer({
    title: vlanMode ? '批量导入VLAN账号' : '批量粘贴PPPoE账号', kicker: 'PARSE → REVIEW → APPLY', width: 'wide',
    body: `<div class="import-format-help"><strong>支持格式</strong><code>账号,密码</code><code>账号 密码</code><code>账号,密码,MAC,权重,IPv4,IPv6</code>${vlanMode ? '<code>账号,密码,VLAN</code>' : ''}<code>账号,密码,接口,VLAN,MAC,权重,IPv4,IPv6</code><code>账号,密码,接口,VLAN,MAC,权重,IPv4,IPv6,PD</code></div><label class="form-field"><span>粘贴内容</span><textarea class="textarea import-secret-text" data-import-text rows="10" spellcheck="false" placeholder="每行一条账号；解析预览永不显示明文密码"></textarea></label><div class="form-actions import-actions"><button class="button" type="button" data-import-parse>解析</button><button class="button" type="button" data-import-replace disabled>替换现有列表</button><button class="button primary" type="button" data-import-append disabled>追加到现有列表</button></div><div data-import-result><div class="dynamic-form-placeholder">粘贴或导入内容后点击“解析”。</div></div>`,
    onMount(root) {
      const textArea = root.querySelector('[data-import-text]'); textArea.value = initialText;
      let parsed = null;
      const parse = () => {
        parsed = parsePppoeBatch(textArea.value, { defaults: editor.defaults, parentInterface: editor.parentInterface, vlanMode, fixedVlan });
        const existing = new Set(editor.allRows().map((row) => row.username).filter(Boolean));
        const appendDuplicates = parsed.rows.filter((item) => existing.has(item.session.username)).map((item) => item.session.username);
        root.querySelector('[data-import-append]').disabled = !parsed.valid || appendDuplicates.length > 0;
        root.querySelector('[data-import-replace]').disabled = !parsed.valid;
        const result = root.querySelector('[data-import-result]');
        const detail = parsed.valid
          ? `密码已接收但不会显示或写入localStorage。${appendDuplicates.length ? ` 追加会与现有账号重复：${appendDuplicates.map(maskUsername).join('、')}；可选择替换。` : ''}`
          : parsed.errors.map((error) => `第${error.line || '-'}行：${error.messages.join('、')}`).join('；');
        result.innerHTML = `<div class="import-summary ${parsed.valid ? 'good' : 'bad'}"><strong>${parsed.valid ? `解析成功：${parsed.rows.length}条` : `发现${parsed.errors.length}个问题`}</strong><span>${escapeHtml(detail)}</span></div><div class="import-preview-list">${parsed.rows.map((item) => `<div class="${item.messages.length ? 'bad' : ''}"><span>第${item.line}行</span><strong>${escapeHtml(maskUsername(item.session.username) || '空账号')}</strong><b>${item.transientPassword ? '密码已提供' : '密码缺失'}</b><code>${item.session.vlanId == null ? '无VLAN' : `VLAN ${item.session.vlanId}`}</code></div>`).join('')}</div>`;
        return parsed;
      };
      root.querySelector('[data-import-parse]').addEventListener('click', parse);
      root.querySelector('[data-import-append]').addEventListener('click', () => { if (parsed?.valid) { editor.applyImport(parsed.rows, 'append'); closeDrawer(); } });
      root.querySelector('[data-import-replace]').addEventListener('click', () => { if (parsed?.valid) { editor.applyImport(parsed.rows, 'replace'); closeDrawer(); } });
      if (initialText) parse();
    }
  });
}

export class PppoeSessionEditor {
  constructor(root, options = {}) {
    this.root = root;
    this.mode = options.mode || 'single';
    this.profileId = options.profileId || this.mode;
    this.parentInterface = options.parentInterface || 'eth4';
    this.defaults = { autoWan: true, autoMac: true, ipv4: true, ipv6: true, requestPd: true, weight: 1, poolId: 'pool-core', mtu: 1492, mru: 1492, autoRedial: true, healthCheck: true, ...(options.defaults || {}) };
    this.passwords = new Map();
    this.previewGenerated = false;
    this.validation = { rowErrors: new Map(), generalErrors: [], valid: false };
    this.pools = getState().pools;
    this.groups = options.groups || this.initialGroups(options.initialCount || 6);
    this.render();
  }

  initialGroups(count) {
    const saved = getState().pppoeSessions.filter((session) => session.profileId === this.profileId).map(normalizedSavedSession);
    if (this.mode === 'single') return [{ id: 'single-group', vlanId: null, sessions: saved.length ? saved : Array.from({ length: count }, (_, index) => createPppoeSession({ index: index + 1, parentInterface: this.parentInterface, defaults: this.defaults, username: `demo-user-${pad(index + 1)}` })) }];
    if (this.mode === 'vlan-dial') return [{ id: 'vlan-101', vlanId: 101, sessions: saved.length ? saved : Array.from({ length: 3 }, (_, index) => createPppoeSession({ index: index + 1, vlanId: 101, parentInterface: this.parentInterface, defaults: this.defaults })) }];
    if (saved.length) {
      const byVlan = new Map(); saved.forEach((session) => { const key = Number(session.vlanId); if (!byVlan.has(key)) byVlan.set(key, []); byVlan.get(key).push(session); });
      return [...byVlan].map(([vlanId, sessions]) => ({ id: `vlan-${vlanId}`, vlanId, sessions }));
    }
    return createVlanRange({ start: 101, end: 111, step: 2, perVlan: 1, parentInterface: this.parentInterface, defaults: this.defaults }).groups;
  }

  allRows() { return this.groups.flatMap((group) => group.sessions); }

  sessionGroup(localKey) { return this.groups.find((group) => group.sessions.some((row) => row.localId === localKey)); }

  render() {
    this.root.innerHTML = this.mode === 'single' ? this.renderSingle() : this.renderVlan();
    this.root.querySelectorAll('[data-session-id]').forEach((rowNode) => { const inputNode = rowNode.querySelector('[data-password]'); inputNode.value = this.passwords.get(rowNode.dataset.sessionId) || ''; });
    this.bind();
    this.applyValidation(false);
    if (this.previewGenerated) this.renderPreview();
  }

  renderSingle() {
    const rows = this.groups[0].sessions;
    return `<div class="pppoe-editor-layout"><section class="pppoe-editor-main"><div class="pppoe-editor-intro"><div><span>使用接口</span>${renderInterfaceSelector({ state: getState(), context: 'multidial', name: 'parentInterface', selected: this.parentInterface, showAll: true })}</div><div><span>连接模式</span><strong>PPPoE 未标记多拨</strong><small>同一物理接口建立${rows.length}个独立PPP会话</small></div><div class="dial-count"><span>拨号数量</span><strong>${rows.length}</strong><small>自动等于账号行数</small></div></div>${commonSettingsHtml(this.defaults, this.pools)}<section class="account-list-section"><header><div><h2>PPPoE账号列表</h2><p>每行是一个独立会话对象；刷新后密码清空并要求重新输入。</p></div><strong>${rows.length} 条会话</strong></header>${editorToolbar()}<div class="pppoe-rows">${rowsHeader()}${rows.map((row, index) => rowHtml(row, index, this.pools, this.validation.rowErrors.get(row.localId))).join('')}</div></section>${this.footerActions()}</section><aside class="pppoe-preview" data-editor-preview>${this.previewPlaceholder()}</aside></div>`;
  }

  renderVlan() {
    const title = this.mode === 'vlan-dial' ? 'VLAN 101 PPPoE账号' : `${this.groups.length}个VLAN配置块`;
    const generation = this.mode === 'vlan-multidial' ? `<section class="vlan-generation"><header><span>步骤2–3</span><strong>生成VLAN配置块</strong></header><div class="vlan-generation-controls"><label>生成方式<select class="select" data-vlan-generation-mode><option value="range">VLAN范围生成</option><option value="manual">手动添加VLAN</option><option value="import">文本批量导入</option></select></label><div data-range-fields><label>起始VLAN<input class="input" type="number" value="101" min="1" max="4094" data-range="start"></label><label>结束VLAN<input class="input" type="number" value="111" min="1" max="4094" data-range="end"></label><label>步进<input class="input" type="number" value="2" min="1" data-range="step"></label><label>每VLAN账号数<input class="input" type="number" value="1" min="1" data-range="count"></label><button class="button primary" type="button" data-editor-action="generate-vlans">生成VLAN</button></div></div></section>` : '';
    return `<div class="pppoe-editor-layout vlan"><section class="pppoe-editor-main"><div class="pppoe-editor-intro"><div><span>步骤1 · 父接口</span>${renderInterfaceSelector({ state: getState(), context: 'vlan-multidial', name: 'parentInterface', selected: this.parentInterface, showAll: true })}</div><div><span>连接方式</span><strong>PPPoE</strong><small>VLAN子接口上的独立拨号会话</small></div><div class="dial-count"><span>总会话</span><strong>${this.allRows().length}</strong><small>${this.groups.length}个VLAN</small></div></div>${commonSettingsHtml(this.defaults, this.pools)}${generation}<section class="vlan-groups-section"><header><div><h2>${title}</h2><p>同一VLAN可配置一个或多个独立PPPoE账号。</p></div>${this.mode === 'vlan-dial' ? '<button class="button" type="button" data-editor-action="import-vlan">批量导入账号</button>' : '<button class="button" type="button" data-editor-action="import-vlan">文本批量导入</button>'}</header><div class="vlan-groups">${this.groups.map((group) => this.vlanGroupHtml(group)).join('')}</div></section>${this.footerActions()}</section><aside class="pppoe-preview" data-editor-preview>${this.previewPlaceholder()}</aside></div>`;
  }

  vlanGroupHtml(group) {
    return `<article class="vlan-account-group" data-vlan-group="${escapeHtml(group.id)}"><header><div><label>VLAN ID<input type="number" min="1" max="4094" value="${escapeHtml(group.vlanId)}" data-vlan-id></label><div><strong class="mono" data-vlan-ifname>${escapeHtml(this.parentInterface)}.${escapeHtml(group.vlanId)}</strong><span>账号数量：${group.sessions.length}</span></div></div><div><button class="button compact primary" type="button" data-group-action="add">＋ 为VLAN ${escapeHtml(group.vlanId)}新增账号</button><button class="button compact" type="button" data-group-action="paste">批量导入账号</button>${this.mode === 'vlan-multidial' ? '<button class="button compact danger-ghost" type="button" data-group-action="delete">删除VLAN</button>' : ''}</div></header><div class="pppoe-rows">${rowsHeader()}${group.sessions.map((row, index) => rowHtml(row, index, this.pools, this.validation.rowErrors.get(row.localId))).join('')}</div></article>`;
  }

  footerActions() {
    return `<div class="editor-save-bar"><div data-general-errors></div><button class="button" type="button" data-editor-action="validate">配置校验</button><button class="button" type="button" data-editor-action="preview">生成预览</button><button class="button" type="button" data-editor-action="save">保存</button><button class="button primary" type="button" data-editor-action="dial">保存并模拟拨号</button></div>`;
  }

  previewPlaceholder() {
    return `<header><div><span>生成预览</span><strong>等待校验</strong></div><b>${this.allRows().length} 条</b></header><div class="preview-placeholder"><span>◎</span><strong>账号行已就绪</strong><p>点击“生成预览”查看完整接口、VLAN、WAN ID、脱敏账号、独立MAC和协议开关。</p></div>`;
  }

  bind() {
    const parentSelect = this.root.querySelector('[name="parentInterface"]');
    parentSelect?.addEventListener('change', () => { this.parentInterface = parentSelect.value; this.groups.forEach((group) => group.sessions.forEach((row) => { row.parentInterface = this.parentInterface; })); this.render(); });
    this.root.querySelectorAll('[data-default]').forEach((node) => node.addEventListener('change', () => { const field = node.dataset.default; this.defaults[field] = node.type === 'checkbox' ? node.checked : node.type === 'number' ? Number(node.value) : node.value; if (field === 'ipv6' && !this.defaults.ipv6) { this.defaults.requestPd = false; } this.render(); }));
    this.root.querySelectorAll('[data-session-id]').forEach((rowNode) => this.bindRow(rowNode));
    this.root.querySelectorAll('[data-editor-action]').forEach((button) => button.addEventListener('click', () => this.editorAction(button.dataset.editorAction, button)));
    this.root.querySelectorAll('[data-editor-import]').forEach((inputNode) => inputNode.addEventListener('change', () => { const file = inputNode.files?.[0]; if (!file) return; const reader = new FileReader(); reader.addEventListener('load', () => importDrawer({ editor: this, initialText: String(reader.result || ''), vlanMode: this.mode !== 'single', fixedVlan: this.mode === 'vlan-dial' ? this.groups[0].vlanId : null })); reader.readAsText(file, 'utf-8'); }));
    this.root.querySelectorAll('[data-vlan-group]').forEach((groupNode) => this.bindVlanGroup(groupNode));
    const generationMode = this.root.querySelector('[data-vlan-generation-mode]');
    generationMode?.addEventListener('change', () => { if (generationMode.value === 'manual') this.addVlanGroup(); else if (generationMode.value === 'import') importDrawer({ editor: this, vlanMode: true }); });
  }

  bindRow(rowNode) {
    const row = this.allRows().find((item) => item.localId === rowNode.dataset.sessionId);
    rowNode.querySelectorAll('[data-field]').forEach((node) => node.addEventListener('input', () => { const field = node.dataset.field; row[field] = node.type === 'checkbox' ? node.checked : node.type === 'number' ? Number(node.value) : node.value; if (field === 'ipv6' && !row.ipv6) row.requestPd = false; if (field === 'ipv6') this.render(); else { this.applyValidation(false); if (this.previewGenerated) this.renderPreview(); } }));
    const passwordInput = rowNode.querySelector('[data-password]');
    passwordInput.addEventListener('input', () => { this.passwords.set(row.localId, passwordInput.value); this.applyValidation(false); if (this.previewGenerated) this.renderPreview(); });
    rowNode.querySelector('[data-toggle-password]').addEventListener('click', (event) => { const showing = passwordInput.type === 'text'; passwordInput.type = showing ? 'password' : 'text'; event.currentTarget.textContent = showing ? '显示' : '隐藏'; });
    rowNode.querySelectorAll('[data-row-action]').forEach((button) => button.addEventListener('click', () => this.rowAction(row.localId, button.dataset.rowAction)));
  }

  bindVlanGroup(groupNode) {
    const group = this.groups.find((item) => item.id === groupNode.dataset.vlanGroup);
    const vlanInput = groupNode.querySelector('[data-vlan-id]');
    vlanInput.addEventListener('input', () => {
      const oldVlan = group.vlanId;
      group.vlanId = Number(vlanInput.value);
      group.sessions.forEach((row, index) => {
        row.vlanId = group.vlanId;
        if (row.id === `session-${oldVlan}-${pad(index + 1, 2)}`) row.id = `session-${group.vlanId}-${pad(index + 1, 2)}`;
        if (this.defaults.autoWan && row.wanId === generatedWanId(index + 1, oldVlan)) row.wanId = generatedWanId(index + 1, group.vlanId);
        if (this.defaults.autoMac && row.mac === generatedMac(index + 1, oldVlan)) row.mac = generatedMac(index + 1, group.vlanId);
        const rowNode = groupNode.querySelector(`[data-session-id="${CSS.escape(row.localId)}"]`);
        if (rowNode) {
          rowNode.querySelector('[data-field="wanId"]').value = row.wanId;
          rowNode.querySelector('[data-field="mac"]').value = row.mac;
        }
      });
      const ifname = groupNode.querySelector('[data-vlan-ifname]');
      if (ifname) ifname.textContent = `${this.parentInterface}.${vlanInput.value}`;
      this.applyValidation(false);
      if (this.previewGenerated) this.renderPreview();
    });
    groupNode.querySelectorAll('[data-group-action]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.groupAction === 'add') this.addRow(group.id); else if (button.dataset.groupAction === 'paste') importDrawer({ editor: this, vlanMode: true, fixedVlan: group.vlanId }); else if (button.dataset.groupAction === 'delete') { this.groups = this.groups.filter((item) => item.id !== group.id); this.render(); } }));
  }

  rowAction(localKey, action) {
    const group = this.sessionGroup(localKey); const index = group.sessions.findIndex((row) => row.localId === localKey); const row = group.sessions[index];
    if (action === 'delete') { deletePppoeSession(group.sessions, index); this.passwords.delete(localKey); }
    else if (action === 'copy') { const copy = clonePppoeSession(row, { wanId: this.nextWanId(group), mac: this.nextMac(group) }); group.sessions.splice(index + 1, 0, copy); }
    else if (action === 'up') movePppoeSession(group.sessions, index, -1);
    else if (action === 'down') movePppoeSession(group.sessions, index, 1);
    this.render();
  }

  nextWanId(group) { return generatedWanId(group.sessions.length + 1, group.vlanId); }
  nextMac(group) { return generatedMac(group.sessions.length + 1, group.vlanId); }

  addRow(groupId = this.groups[0].id) {
    const group = this.groups.find((item) => item.id === groupId); const row = createPppoeSession({ index: group.sessions.length + 1, vlanId: group.vlanId, parentInterface: this.parentInterface, defaults: this.defaults }); group.sessions.push(row); this.render(); const inputNode = this.root.querySelector(`[data-session-id="${CSS.escape(row.localId)}"] [data-field="username"]`); inputNode?.focus(); inputNode?.scrollIntoView({ block: 'nearest' });
  }

  addVlanGroup() {
    const used = new Set(this.groups.map((group) => Number(group.vlanId))); let vlanId = 101; while (used.has(vlanId) && vlanId <= 4094) vlanId += 1; this.groups.push({ id: `vlan-${vlanId}-${localId()}`, vlanId, sessions: [createPppoeSession({ index: 1, vlanId, parentInterface: this.parentInterface, defaults: this.defaults })] }); this.render();
  }

  editorAction(action) {
    if (action === 'add') this.addRow();
    else if (action === 'paste') importDrawer({ editor: this, vlanMode: this.mode !== 'single', fixedVlan: this.mode === 'vlan-dial' ? this.groups[0].vlanId : null });
    else if (action === 'import-vlan') importDrawer({ editor: this, vlanMode: true, fixedVlan: this.mode === 'vlan-dial' ? this.groups[0].vlanId : null });
    else if (action === 'fill-wan') { this.groups.forEach((group) => group.sessions.forEach((row, index) => { row.wanId = generatedWanId(index + 1, group.vlanId); })); this.render(); }
    else if (action === 'fill-mac') { this.groups.forEach((group) => group.sessions.forEach((row, index) => { row.mac = generatedMac(index + 1, group.vlanId); row.macMode = 'generated'; })); this.render(); }
    else if (action === 'clear') { this.groups.forEach((group) => { group.sessions = []; }); this.passwords.clear(); this.render(); }
    else if (action === 'preview') { this.previewGenerated = true; this.applyValidation(false); this.renderPreview(); }
    else if (action === 'validate') { const result = this.applyValidation(true); toast(result.valid ? `配置校验通过：${result.count}条独立PPPoE会话。` : `发现${result.rowErrors.size + result.generalErrors.length}处问题。`, result.valid ? 'success' : 'error'); }
    else if (action === 'save' || action === 'dial') this.save(action === 'dial');
    else if (action === 'generate-vlans') { const values = Object.fromEntries([...this.root.querySelectorAll('[data-range]')].map((node) => [node.dataset.range, Number(node.value)])); const result = createVlanRange({ start: values.start, end: values.end, step: values.step, perVlan: values.count, parentInterface: this.parentInterface, defaults: this.defaults }); if (result.errors.length) toast(result.errors[0], 'error'); else { this.groups = result.groups; this.passwords.clear(); this.render(); toast(`已生成${this.groups.length}个VLAN、${this.allRows().length}条独立会话。`); } }
  }

  applyImport(items, mode) {
    if (this.mode === 'single') {
      const sessions = items.map((item, index) => ({ ...item.session, vlanId: null, parentInterface: this.parentInterface, wanId: generatedWanId((mode === 'append' ? this.allRows().length : 0) + index + 1), mac: item.session.macMode === 'custom' ? item.session.mac : generatedMac((mode === 'append' ? this.allRows().length : 0) + index + 1) }));
      if (mode === 'replace') { this.groups[0].sessions = []; this.passwords.clear(); }
      sessions.forEach((session, index) => { this.groups[0].sessions.push(session); this.passwords.set(session.localId, items[index].transientPassword); });
    } else {
      if (mode === 'replace') { this.groups = []; this.passwords.clear(); }
      items.forEach((item) => {
        const vlanId = Number(item.session.vlanId); let group = this.groups.find((candidate) => Number(candidate.vlanId) === vlanId); if (!group) { group = { id: `vlan-${vlanId}-${localId()}`, vlanId, sessions: [] }; this.groups.push(group); }
        const session = { ...item.session, parentInterface: this.parentInterface, vlanId, wanId: generatedWanId(group.sessions.length + 1, vlanId), mac: item.session.macMode === 'custom' ? item.session.mac : generatedMac(group.sessions.length + 1, vlanId) };
        group.sessions.push(session); this.passwords.set(session.localId, item.transientPassword);
      });
      this.groups.sort((a, b) => a.vlanId - b.vlanId);
    }
    this.render(); toast(`已${mode === 'replace' ? '替换' : '追加'}${items.length}条独立账号行。`);
  }

  applyValidation(scroll) {
    this.validation = validatePppoeModel({ groups: this.groups, parentInterface: this.parentInterface, passwords: this.passwords, pools: this.pools, existingSessions: getState().pppoeSessions, profileId: this.profileId });
    this.root.querySelectorAll('[data-session-id]').forEach((rowNode) => { const errors = this.validation.rowErrors.get(rowNode.dataset.sessionId) || {}; rowNode.classList.toggle('has-error', Object.keys(errors).length > 0); rowNode.querySelectorAll('[data-error]').forEach((node) => { node.textContent = (errors[node.dataset.error] || []).join('；'); }); });
    const general = this.root.querySelector('[data-general-errors]'); if (general) general.innerHTML = this.validation.generalErrors.length ? `<span class="general-error">${escapeHtml(this.validation.generalErrors.join('；'))}</span>` : `<span class="general-ok">${this.validation.count}条独立会话</span>`;
    if (scroll && !this.validation.valid) { const first = this.root.querySelector('.pppoe-row.has-error') || general; first?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return this.validation;
  }

  renderPreview() {
    const target = this.root.querySelector('[data-editor-preview]'); if (!target) return;
    const validation = this.applyValidation(false);
    const preview = buildPppoePreviewModel({ groups: this.groups, parentInterface: this.parentInterface, passwords: this.passwords });
    target.innerHTML = `<header><div><span>生成预览</span><strong class="mono">${escapeHtml(preview.parentInterface)}</strong></div><b>${preview.count}条会话</b></header>${validation.generalErrors.length ? `<div class="preview-errors">${validation.generalErrors.map((message) => `<span>${escapeHtml(message)}</span>`).join('')}</div>` : ''}<div class="preview-tree">${preview.groups.map((group) => `<section><header><strong>${group.vlanId == null ? escapeHtml(group.interfaceName) : `VLAN ${group.vlanId} / ${escapeHtml(group.interfaceName)}`}</strong><span>${group.sessions.length}条</span></header><ul>${group.sessions.map((row) => previewSession(row, row.passwordConfigured).replace('<li class="preview-session">', `<li class="preview-session ${this.validation.rowErrors.has(row.localId) ? 'bad' : ''}">`)).join('')}</ul></section>`).join('')}</div><footer>${validation.valid ? '<span class="preview-valid">✓ 无冲突，可保存</span>' : `<span class="preview-invalid">${validation.rowErrors.size + validation.generalErrors.length}处错误，禁止保存</span>`}</footer>`;
  }

  save(simulateDial) {
    const validation = this.applyValidation(true); if (!validation.valid) { toast('配置存在错误，已定位到第一处问题。', 'error'); return; }
    const saved = serializePppoeSessions({ groups: this.groups, parentInterface: this.parentInterface, profileId: this.profileId, status: simulateDial ? 'dialing' : 'configured' });
    mutate((state) => {
      state.pppoeSessions = [...state.pppoeSessions.filter((session) => session.profileId !== this.profileId), ...saved];
      if (this.mode !== 'single') {
        this.groups.forEach((group) => { const ifname = `${this.parentInterface}.${group.vlanId}`; const existing = state.vlans.find((vlan) => vlan.ifname === ifname); if (existing) existing.sessions = group.sessions.length; else state.vlans.push({ id: Number(group.vlanId), parent: this.parentInterface, ifname, enabled: true, role: 'PPPoE接入', sessions: group.sessions.length, rx: 0, tx: 0 }); });
      }
      const port = state.physicalPorts.find((item) => item.name === this.parentInterface); if (port) { port.role = this.mode === 'single' ? 'wan' : 'vlan-parent'; if (this.mode !== 'single') port.vlanSummary = { vlans: this.groups.length, sessions: saved.length }; }
    }, { source: simulateDial ? 'pppoe-simulate-dial' : 'pppoe-save' });
    toast(`${saved.length}条独立PPPoE会话已${simulateDial ? '保存并开始模拟拨号' : '保存'}；密码未写入localStorage。`);
  }
}
