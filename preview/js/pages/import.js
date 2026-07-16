import { getState, mutate } from '../store.js';
import { escapeHtml, maskAccount, pageHeader, panel, statusBadge, toast } from '../components.js';

const sampleText = [
  'batch01@example.invalid,••••••••,eth0,201,02:4c:48:bb:01:01,2,1,1',
  'batch02@example.invalid,••••••••,eth1,202,02:4c:48:bb:02:01,3,1,0',
  'batch03@example.invalid,••••••••,eth2,203,02:4c:48:bb:03:01,1,1,1',
  'batch04@example.invalid,••••••••,eth3,204,02:4c:48:bb:04:01,4,1,1',
  'batch05@example.invalid,••••••••,eth4,205,02:4c:48:bb:05:01,2,1,0',
  'batch06@example.invalid,••••••••,eth5,206,02:4c:48:bb:06:01,1,1,1'
].join('\n');

let mode = 'text';
let parsedRows = [];

function nextWanId(existing, offset) {
  let value = existing.length + offset + 1;
  while (existing.some((line) => line.id === `wan-${String(value).padStart(2, '0')}`)) value += 1;
  return `wan-${String(value).padStart(2, '0')}`;
}

function generatedMac(index) {
  return `02:4c:48:cc:${String(index + 1).padStart(2, '0')}:01`;
}

function parseLines(text) {
  const existing = getState().wanLines;
  const seenAccounts = new Set();
  const seenIds = new Set(existing.map((line) => line.id));
  const seenMacs = new Set(existing.map((line) => line.mac.toLowerCase()));
  const seenIfnames = new Set(existing.map((line) => line.vlanIfname));
  return text.split(/\r?\n/).filter((line) => line.trim()).map((source, index) => {
    const fields = source.split(',').map((part) => part.trim());
    const [account, _password, parent, vlanText, macText, weightText, ipv4Text, ipv6Text] = fields;
    const id = nextWanId(existing, index);
    const vlanId = Number(vlanText);
    const mac = macText || generatedMac(index);
    const vlanIfname = `${parent || 'eth0'}.${vlanId}`;
    const errors = [];
    if (fields.length !== 8) errors.push('字段数量应为 8');
    if (!account) errors.push('缺少账户');
    if (seenAccounts.has(String(account).toLowerCase()) || existing.some((line) => line.username.toLowerCase() === String(account).toLowerCase())) errors.push('重复账户');
    if (seenIds.has(id)) errors.push('重复 WAN ID');
    if (!/^eth[0-9]+$/.test(parent || '')) errors.push('接口无效');
    if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) errors.push('VLAN 范围无效');
    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) errors.push('MAC 无效');
    if (seenMacs.has(mac.toLowerCase())) errors.push('重复 MAC');
    if (seenIfnames.has(vlanIfname)) errors.push('重复 VLAN 子接口');
    const weight = Number(weightText);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) errors.push('权重无效');
    if (!['0','1'].includes(ipv4Text) || !['0','1'].includes(ipv6Text)) errors.push('协议开关无效');
    seenAccounts.add(String(account).toLowerCase());
    seenIds.add(id);
    seenMacs.add(mac.toLowerCase());
    seenIfnames.add(vlanIfname);
    return { line: index + 1, id, account, parent, vlanId, vlanIfname, mac, weight, ipv4: ipv4Text === '1', ipv6: ipv6Text === '1', secretConfigured: Boolean(_password), errors };
  });
}

function editableRows() {
  return Array.from({ length: 8 }, (_, index) => `<tr><td>${index + 1}</td><td><input class="input" data-grid="account" placeholder="account@example.invalid"></td><td><input class="input" type="password" data-grid="password" placeholder="••••••••"></td><td><select class="select" data-grid="parent">${['eth0','eth1','eth2','eth3','eth4','eth5'].map((value) => `<option>${value}</option>`).join('')}</select></td><td><input class="input" data-grid="vlan" value="${220 + index}" type="number"></td><td><input class="input" data-grid="mac" value="${generatedMac(index)}"></td><td><input class="input" data-grid="weight" value="1" type="number"></td><td><select class="select" data-grid="ipv4"><option value="1">开</option><option value="0">关</option></select></td><td><select class="select" data-grid="ipv6"><option value="1">开</option><option value="0">关</option></select></td></tr>`).join('');
}

function previewTable() {
  if (!parsedRows.length) return '<div class="empty-state"><span>⇩</span><strong>等待解析</strong><p>输入文本或完成表格编辑后，点击“解析预览”。</p></div>';
  return `<div class="validation-summary"><strong>可导入 ${parsedRows.filter((row) => !row.errors.length).length} 条</strong><span class="errors">错误 ${parsedRows.filter((row) => row.errors.length).length} 条</span><span>账户和密码不会以明文出现在预览或本地存储中</span></div>
    <div class="data-table-wrap" style="max-height:420px"><table class="data-table"><thead><tr><th>行</th><th>WAN ID</th><th>账户（脱敏）</th><th>接口</th><th>VLAN</th><th>MAC</th><th>权重</th><th>IPv4</th><th>IPv6</th><th>校验</th></tr></thead><tbody>${parsedRows.map((row) => `<tr class="${row.errors.length ? 'invalid-row' : ''}"><td>${row.line}</td><td class="mono">${escapeHtml(row.id)}</td><td class="mono">${escapeHtml(maskAccount(row.account))}</td><td>${escapeHtml(row.parent)}</td><td>${escapeHtml(row.vlanId)}</td><td class="mono">${escapeHtml(row.mac)}</td><td>${escapeHtml(row.weight)}</td><td>${row.ipv4 ? '开' : '关'}</td><td>${row.ipv6 ? '开' : '关'}</td><td>${row.errors.length ? escapeHtml(row.errors.join('、')) : statusBadge('online', '通过')}</td></tr>`).join('')}</tbody></table></div>`;
}

function pageHtml() {
  return `${pageHeader('批量导入', '支持文本粘贴或表格逐行编辑，解析时执行重复与格式检测。', '<button class="button" data-import-action="clear">清空</button><button class="button primary" data-import-action="commit">一键导入</button>')}
    <div class="notice"><span>i</span><div><strong>导入格式</strong><p>账户,密码,接口,VLAN,MAC,权重,IPv4开关,IPv6开关。密码仅用于模拟“已配置”状态，不会保存或回显。</p></div></div>
    ${panel('导入工作区', `<div class="tabs"><button class="tab ${mode === 'text' ? 'active' : ''}" data-import-mode="text">文本粘贴</button><button class="tab ${mode === 'grid' ? 'active' : ''}" data-import-mode="grid">表格逐行编辑</button></div>
      <div class="import-layout"><div class="import-input">${mode === 'text' ? `<textarea class="textarea" id="import-text" spellcheck="false">${escapeHtml(sampleText)}</textarea>` : `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>账户</th><th>密码</th><th>接口</th><th>VLAN</th><th>MAC</th><th>权重</th><th>IPv4</th><th>IPv6</th></tr></thead><tbody id="import-grid">${editableRows()}</tbody></table></div>`}<div class="button-row" style="margin-top:10px"><button class="button primary" data-import-action="parse">解析预览</button><button class="button" data-import-action="generate-id">自动生成 WAN ID</button><button class="button" data-import-action="generate-mac">自动生成 MAC</button></div></div><div class="import-preview" id="import-preview">${previewTable()}</div></div>`)}`;
}

function gridText(root) {
  return [...root.querySelectorAll('#import-grid tr')].map((row) => {
    const value = (key) => row.querySelector(`[data-grid="${key}"]`).value;
    return [value('account'), value('password'), value('parent'), value('vlan'), value('mac'), value('weight'), value('ipv4'), value('ipv6')].join(',');
  }).filter((line) => line.split(',')[0]).join('\n');
}

export function renderImport() {
  return {
    html: pageHtml(),
    mount(root) {
      root.querySelectorAll('[data-import-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.importMode; parsedRows = []; window.dispatchEvent(new CustomEvent('linehub:rerender')); }));
      root.querySelector('[data-import-action="parse"]').addEventListener('click', () => {
        const text = mode === 'text' ? root.querySelector('#import-text').value : gridText(root);
        parsedRows = parseLines(text);
        root.querySelector('#import-preview').innerHTML = previewTable();
        toast(`解析完成：${parsedRows.length} 行，${parsedRows.filter((row) => row.errors.length).length} 行需要修正。`, parsedRows.some((row) => row.errors.length) ? 'info' : 'success');
      });
      root.querySelector('[data-import-action="commit"]').addEventListener('click', () => {
        const valid = parsedRows.filter((row) => !row.errors.length);
        if (!valid.length) return toast('没有可导入的有效线路，请先解析并修正错误。', 'error');
        mutate((state) => valid.forEach((row) => state.wanLines.push({
          id: row.id, name: `批量线路 ${row.line}`, enabled: true, status: 'dialing', issue: '', parent: row.parent,
          vlanId: row.vlanId, vlanIfname: row.vlanIfname, username: row.account, secretConfigured: true, mac: row.mac,
          ipv4Enabled: row.ipv4, ipv6Enabled: row.ipv6, requestPd: row.ipv6, ipv4: '--', gateway4: '--', ipv6: '--', pd: '--',
          upload: 0, download: 0, latency: 0, loss: 0, connections: 0, weight: row.weight,
          pool: state.pools[0].name, mtu: 1492, mru: 1492, healthcheck: 'TCP + DNS', autoRedial: true, lastDial: '刚刚'
        })), { source: 'import' });
        const count = valid.length;
        parsedRows = [];
        toast(`成功导入 ${count} 条线路，明文密码已丢弃。`);
      });
      root.querySelector('[data-import-action="clear"]').addEventListener('click', () => { parsedRows = []; if (mode === 'text') root.querySelector('#import-text').value = ''; else root.querySelectorAll('#import-grid input').forEach((input) => { if (input.dataset.grid === 'account' || input.dataset.grid === 'password') input.value = ''; }); root.querySelector('#import-preview').innerHTML = previewTable(); });
      root.querySelector('[data-import-action="generate-id"]').addEventListener('click', () => toast('WAN ID 会在解析时按现有线路自动生成。', 'info'));
      root.querySelector('[data-import-action="generate-mac"]').addEventListener('click', () => {
        if (mode === 'grid') root.querySelectorAll('[data-grid="mac"]').forEach((input, index) => { input.value = generatedMac(index + 20); });
        toast('已生成本地管理 MAC。');
      });
    }
  };
}
