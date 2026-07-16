import { getState, mutate } from '../store.js';
import { closeDrawer, escapeHtml, formatSpeed, maskAccount, openDrawer, pageHeader, panel, toast } from '../components.js';
import { openInterfaceStatus, renderInterfaceSelector, renderInterfaceStatusBar } from '../interface-selector.js';
import { renderWanFields, renderWanTypeChooser, wanTypeLabel } from '../wan-config.js';
import { renderMultiDialPage, renderVlanDialPage, renderVlanMultiDialPage } from './pppoe-multidial.js';

function typeStatus(value) {
  return value ? '<span class="compact-state up">已连接</span>' : '<span class="compact-state down">关闭</span>';
}

function mountStatusBar(root) {
  root.querySelectorAll('[data-view-interfaces]').forEach((button) => button.addEventListener('click', () => openInterfaceStatus(getState())));
}

function saveWan(form) {
  const data = new FormData(form);
  const interfaceName = String(data.get('interface') || '');
  const type = String(data.get('connectionType') || '');
  if (!interfaceName) { toast('请选择可用的物理接口。', 'error'); return false; }
  if (!type) { toast('请选择连接方式。', 'error'); return false; }
  if (type === 'multidial' || type === 'vlan' || type === 'vlan-multidial') {
    closeDrawer();
    const route = type === 'multidial' ? 'lines/multidial' : type === 'vlan' ? 'lines/vlan-dial' : 'lines/vlan-multidial';
    window.location.hash = `#/${route}`;
    return true;
  }
  const username = String(data.get('username') || '');
  const name = String(data.get('lineName') || `${wanTypeLabel(type)} 线路`);
  const nextId = `wan-${String(getState().wanConnections.length + 1).padStart(2, '0')}`;
  mutate((state) => {
    state.wanConnections.push({
      id: nextId, name, interface: interfaceName, type, status: 'online', ipv4: data.get('ipv4') === 'on' || type === 'static', ipv6: data.get('ipv6') === 'on' || (type === 'static' && Boolean(data.get('ipv6Address'))),
      rx: 0, tx: 0, weight: Number(data.get('weight')) || 1, pool: String(data.get('pool') || '核心出口池'), username, secretConfigured: Boolean(data.get('password')), vlanId: Number(data.get('vlanId')) || null
    });
    const port = state.physicalPorts.find((item) => item.name === interfaceName);
    if (port) {
      port.role = type === 'vlan' ? 'vlan-parent' : 'wan';
      port.wanConfig = { type, wanId: nextId, name, username, secretConfigured: Boolean(data.get('password')), ipv4: data.get('ipv4') === 'on', ipv6: data.get('ipv6') === 'on' };
    }
    if (type === 'pppoe') {
      const poolName = String(data.get('pool') || '核心出口池');
      state.pppoeSessions.push({
        id: `pppoe-${nextId}`, wanId: nextId, parentInterface: interfaceName, vlanId: null, username,
        macMode: 'interface', mac: port?.mac || '', ipv4: data.get('ipv4') === 'on', ipv6: data.get('ipv6') === 'on',
        requestPd: data.get('ipv6') === 'on' && data.get('requestPd') === 'on', weight: Number(data.get('weight')) || 1,
        poolId: state.pools.find((pool) => pool.name === poolName)?.id || 'pool-core', enabled: true,
        profileId: `regular-${nextId}`, secretConfigured: Boolean(data.get('password')), status: 'online'
      });
    }
  }, { source: 'wan-add' });
  closeDrawer();
  toast(`${name} 已保存到本地模拟配置。`);
  return true;
}

function wanFormBody({ showAll = false, selectedType = '', selectedInterface = '' } = {}) {
  const state = getState();
  return `<form id="wan-config-form" class="drawer-wan-form">
    <section class="drawer-step"><span>步骤 1</span><h3>选择物理接口</h3>${renderInterfaceSelector({ state, context: 'wan', name: 'interface', selected: selectedInterface, showAll })}<label class="check-line small"><input type="checkbox" name="showAll" ${showAll ? 'checked' : ''}><span>显示全部接口（不可用接口仍保持禁用）</span></label></section>
    <section class="drawer-step"><span>步骤 2</span><h3>选择连接方式</h3>${renderWanTypeChooser(selectedType)}</section>
    <section class="drawer-step dynamic-fields" data-wan-fields><span>步骤 3</span><h3>填写连接参数</h3>${renderWanFields(selectedType)}</section>
    <div class="form-actions"><button class="button" type="button" data-action="cancel">取消</button><button class="button primary" type="submit" ${selectedType ? '' : 'disabled'}>保存 WAN</button></div>
  </form>`;
}

function openWanDrawer(initial = {}) {
  const mount = (root) => {
    const form = root.querySelector('#wan-config-form');
    form.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
    form.querySelector('input[name="showAll"]').addEventListener('change', (event) => {
      const selectedType = form.querySelector('input[name="connectionType"]:checked')?.value || '';
      const selectedInterface = form.elements.interface.value;
      openWanDrawer({ showAll: event.currentTarget.checked, selectedType, selectedInterface });
    });
    form.querySelectorAll('input[name="connectionType"]').forEach((radio) => radio.addEventListener('change', () => {
      form.querySelectorAll('.wan-type-option').forEach((option) => option.classList.toggle('selected', option.contains(radio)));
      form.querySelector('[data-wan-fields]').innerHTML = `<span>步骤 3</span><h3>填写连接参数</h3>${renderWanFields(radio.value)}`;
      form.querySelector('button[type="submit"]').disabled = false;
    }));
    form.addEventListener('submit', (event) => { event.preventDefault(); saveWan(form); });
  };
  openDrawer({ title: '新增 WAN', kicker: 'INTERFACE → MODE → PARAMETERS', width: 'wide', body: wanFormBody(initial), onMount: mount });
}

function lineDetails(line) {
  const port = getState().physicalPorts.find((item) => item.name === line.interface);
  openDrawer({
    title: `${line.name} · 线路详情`, kicker: 'WAN CONNECTION',
    body: `<div class="drawer-summary-list"><div><span>WAN ID</span><strong class="mono">${escapeHtml(line.id)}</strong></div><div><span>接口 / VLAN</span><strong class="mono">${escapeHtml(`${line.interface}${line.vlanId ? `.${line.vlanId}` : ''}`)}</strong></div><div><span>连接方式</span><strong>${escapeHtml(wanTypeLabel(line.type))}</strong></div><div><span>链路</span><strong>${escapeHtml(port?.link === 'up' ? `${port.speed} 已连接` : '未连接')}</strong></div><div><span>IPv4 / IPv6</span><strong>${line.ipv4 ? '开启' : '关闭'} / ${line.ipv6 ? '开启' : '关闭'}</strong></div><div><span>实时速率</span><strong>↑ ${formatSpeed(line.tx)}　↓ ${formatSpeed(line.rx)}</strong></div>${line.username ? `<div><span>拨号账号</span><strong>${escapeHtml(maskAccount(line.username))}</strong></div>` : ''}<div><span>权重 / 线路池</span><strong>${line.weight} / ${escapeHtml(line.pool)}</strong></div></div><p class="secret-note">密码仅显示“已配置”状态，页面与 localStorage 均不保存明文。</p>`
  });
}

function wanLinesPage() {
  const state = getState();
  const rows = state.wanConnections;
  const table = `<div class="compact-table-wrap"><table class="data-table wan-connection-table"><thead><tr><th>名称</th><th>使用接口</th><th>连接方式</th><th>链路状态</th><th>IPv4</th><th>IPv6</th><th>当前速率</th><th>操作</th></tr></thead><tbody>${rows.map((line) => {
    const port = state.physicalPorts.find((item) => item.name === line.interface);
    return `<tr><td><strong>${escapeHtml(line.name)}</strong><small class="mono">${escapeHtml(line.id)}</small></td><td class="mono">${escapeHtml(`${line.interface}${line.vlanId ? `.${line.vlanId}` : ''}`)}</td><td>${escapeHtml(wanTypeLabel(line.type))}</td><td><span class="compact-state ${port?.link === 'up' ? 'up' : 'down'}">${port?.link === 'up' ? `已连接 ${port.speed}` : '未连接'}</span></td><td>${typeStatus(line.ipv4)}</td><td>${typeStatus(line.ipv6)}</td><td class="line-rate"><span>↑ ${formatSpeed(line.tx)}</span><span>↓ ${formatSpeed(line.rx)}</span></td><td><button class="row-action" type="button" data-line-detail="${escapeHtml(line.id)}">详情</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('WAN 线路', '紧凑查看线路；地址、网关、MAC、PD 等高级信息按需展开。', '<button class="button" type="button" data-batch-dial>批量拨号</button><button class="button primary" type="button" data-add-wan>新增 WAN</button>')}${panel('线路列表', table, { subtitle: `共 ${rows.length} 条线路，无横向滚动` })}</div>`,
    mount(root) {
      mountStatusBar(root);
      root.querySelector('[data-add-wan]').addEventListener('click', () => openWanDrawer());
      root.querySelector('[data-batch-dial]').addEventListener('click', () => { window.location.hash = '#/lines/multidial'; });
      root.querySelectorAll('[data-line-detail]').forEach((button) => button.addEventListener('click', () => lineDetails(getState().wanConnections.find((line) => line.id === button.dataset.lineDetail))));
    }
  };
}

function addLinePage() {
  const state = getState();
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('新增线路', '选择网口、连接方式，再填写该方式所需参数。')}<section class="panel guided-wan-panel"><div class="panel-content">${wanFormBody()}</div></section></div>`,
    mount(root) {
      mountStatusBar(root);
      const form = root.querySelector('#wan-config-form');
      form.querySelector('[data-action="cancel"]').addEventListener('click', () => { window.location.hash = '#/lines/wans'; });
      form.querySelector('input[name="showAll"]').addEventListener('change', () => { window.location.hash = '#/lines/add'; toast('抽屉模式下可切换“显示全部接口”。', 'info'); });
      form.querySelectorAll('input[name="connectionType"]').forEach((radio) => radio.addEventListener('change', () => {
        form.querySelectorAll('.wan-type-option').forEach((option) => option.classList.toggle('selected', option.contains(radio)));
        form.querySelector('[data-wan-fields]').innerHTML = `<span>步骤 3</span><h3>填写连接参数</h3>${renderWanFields(radio.value)}`;
        form.querySelector('button[type="submit"]').disabled = false;
      }));
      form.addEventListener('submit', (event) => { event.preventDefault(); if (saveWan(form)) window.location.hash = '#/lines/wans'; });
    }
  };
}

function logsPage() {
  const logs = getState().logs.filter((log) => log.module === 'pppoe' || log.module === 'healthcheck').slice(0, 12);
  return { html: `<div class="function-page">${pageHeader('拨号日志', '查看模拟拨号、重拨和健康检查事件。')}${panel('最近事件', `<div class="compact-table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>模块</th><th>级别</th><th>消息</th></tr></thead><tbody>${logs.map((log) => `<tr><td class="mono">${escapeHtml(log.time)}</td><td>${escapeHtml(log.module)}</td><td>${escapeHtml(log.level)}</td><td>${escapeHtml(log.message)}</td></tr>`).join('')}</tbody></table></div>`)}</div>` };
}

export function renderLines(route) {
  if (route === 'lines/add') return addLinePage();
  if (route === 'lines/multidial') return renderMultiDialPage();
  if (route === 'lines/vlan-dial') return renderVlanDialPage();
  if (route === 'lines/vlan-multidial') return renderVlanMultiDialPage();
  if (route === 'lines/logs') return logsPage();
  return wanLinesPage();
}
