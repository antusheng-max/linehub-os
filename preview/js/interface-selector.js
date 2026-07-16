import { escapeHtml, formatSpeed, openDrawer } from './components.js';

const roleLabels = {
  'temporary-management': '临时管理口',
  lan: 'LAN',
  wan: 'WAN',
  'vlan-parent': 'VLAN 父接口',
  unassigned: '未分配'
};

function roleLabel(port) {
  return port.driverStatus === 'fault' ? '故障' : (roleLabels[port.role] || '未分配');
}

function linkLabel(port) {
  if (port.driverStatus === 'fault') return '故障';
  return port.link === 'up' ? '已连接' : '未连接';
}

function locationLabel(state, port) {
  const index = Math.max(0, state.physicalCards.findIndex((card) => card.id === port.nicId));
  return `网卡${index + 1}-端口${port.portNumber}`;
}

function availability(port, context, showAll) {
  if (port.driverStatus === 'fault') return { visible: showAll || context === 'lan', disabled: true, reason: '驱动异常' };
  if (context === 'lan') {
    if (port.role === 'wan') return { visible: true, disabled: true, reason: '独占 WAN' };
    return { visible: true, disabled: false, reason: port.link === 'down' ? '可选，当前未连接' : '' };
  }
  if (context === 'wan') {
    if (port.management || port.role === 'temporary-management') return { visible: showAll, disabled: true, reason: '请先迁移管理口' };
    if (port.role === 'lan') return { visible: showAll, disabled: true, reason: '已加入 LAN' };
    if (port.role === 'wan') return { visible: showAll, disabled: true, reason: '已有 WAN 使用' };
    if (!showAll && (port.link !== 'up' || port.role !== 'unassigned')) return { visible: false, disabled: false, reason: '' };
    return { visible: true, disabled: false, reason: port.link === 'down' ? '未连接' : '' };
  }
  if (context === 'vlan' || context === 'vlan-multidial') {
    const allowed = port.role === 'unassigned' || port.role === 'vlan-parent' || port.role === 'wan';
    return { visible: allowed || showAll, disabled: !allowed, reason: allowed ? '' : '当前角色不允许承载 VLAN' };
  }
  if (context === 'multidial') {
    const blocked = port.management || port.role === 'temporary-management' || port.role === 'lan';
    return { visible: !blocked || showAll, disabled: blocked, reason: blocked ? '管理口或 LAN 不可用于拨号' : '' };
  }
  return { visible: true, disabled: false, reason: '' };
}

function optionText(state, port) {
  const speed = port.link === 'up' ? port.speed : port.maxSpeed;
  const management = port.management ? ' · 当前管理连接' : '';
  return `${port.name} · ${linkLabel(port)} · ${speed} · ${roleLabel(port)}${management} · ${locationLabel(state, port)}`;
}

export function InterfaceSelector({ state, context, name = 'interface', selected = '', multiple = false, showAll = false, id = '' }) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : [selected].filter(Boolean));
  const candidates = state.physicalPorts
    .map((port) => ({ port, rule: availability(port, context, showAll) }))
    .filter(({ rule }) => rule.visible);

  if (multiple) {
    return `<div class="interface-selector multi" ${id ? `id="${escapeHtml(id)}"` : ''} data-interface-context="${escapeHtml(context)}">
      ${candidates.map(({ port, rule }) => `<label class="interface-option ${port.management ? 'management' : ''} ${rule.disabled ? 'disabled' : ''}">
        <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(port.name)}" ${selectedSet.has(port.name) ? 'checked' : ''} ${rule.disabled ? 'disabled' : ''}>
        <span class="interface-option-main"><strong class="mono">${escapeHtml(port.name)}</strong><small>${escapeHtml(locationLabel(state, port))}</small></span>
        <span class="interface-option-state ${port.link}">${escapeHtml(linkLabel(port))}</span>
        <span>${escapeHtml(port.link === 'up' ? port.speed : port.maxSpeed)}</span>
        <span>${escapeHtml(roleLabel(port))}</span>
        ${port.management ? '<b>当前管理连接</b>' : ''}${rule.reason ? `<em>${escapeHtml(rule.reason)}</em>` : ''}
      </label>`).join('')}
    </div>`;
  }

  return `<div class="interface-selector single" ${id ? `id="${escapeHtml(id)}"` : ''} data-interface-context="${escapeHtml(context)}">
    <select class="select interface-select" name="${escapeHtml(name)}">
      <option value="">请选择物理接口</option>
      ${candidates.map(({ port, rule }) => `<option value="${escapeHtml(port.name)}" ${selectedSet.has(port.name) ? 'selected' : ''} ${rule.disabled ? 'disabled' : ''}>${escapeHtml(optionText(state, port))}${rule.reason ? ` · ${escapeHtml(rule.reason)}` : ''}</option>`).join('')}
    </select>
  </div>`;
}

export const renderInterfaceSelector = InterfaceSelector;

export function WanSelector({ lines, name = 'wanId', selected = '', protocol = 'IPv6', includeUnavailable = false }) {
  const candidates = lines.filter((line) => includeUnavailable || (line.enabled && line.status !== 'offline' && line.status !== 'unavailable'));
  return `<select class="select wan-selector" name="${escapeHtml(name)}"><option value="">请选择 ${escapeHtml(protocol)} WAN</option>${candidates.map((line) => {
    const address = protocol === 'IPv4' ? line.realIpv4 : line.address;
    const mode = protocol === 'IPv6' ? ` · ${escapeHtml(line.resolvedMode?.toUpperCase() || '禁用')}` : '';
    return `<option value="${escapeHtml(line.id)}" ${line.id === selected ? 'selected' : ''}>${escapeHtml(line.id)} · ${escapeHtml(line.interface)} · ${escapeHtml(address || '--')} · ${escapeHtml(line.status)}${mode}</option>`;
  }).join('')}</select>`;
}

export function selectedInterfaces(state, names) {
  return names.map((name) => state.physicalPorts.find((port) => port.name === name)).filter(Boolean).map((port) => `<div class="selected-interface"><span class="mono">${escapeHtml(port.name)}</span><strong>${escapeHtml(port.link === 'up' ? port.speed : port.maxSpeed)}</strong><small>${port.management ? '当前管理连接' : linkLabel(port)}</small><button type="button" data-remove-interface="${escapeHtml(port.name)}">移除</button></div>`).join('');
}

export function interfaceCounts(state) {
  const ports = state.physicalPorts;
  return {
    total: ports.length,
    connected: ports.filter((port) => port.link === 'up').length,
    lan: ports.filter((port) => port.role === 'lan').length,
    wan: ports.filter((port) => port.role === 'wan').length,
    vlan: ports.filter((port) => port.role === 'vlan-parent').length,
    unassigned: ports.filter((port) => port.role === 'unassigned').length,
    fault: ports.filter((port) => port.driverStatus === 'fault').length
  };
}

export function renderInterfaceStatusBar(state) {
  const count = interfaceCounts(state);
  return `<section class="interface-status-bar"><strong>接口状态：${count.total} 个网口</strong><span>已连接 <b>${count.connected}</b></span><span>LAN <b>${count.lan}</b></span><span>WAN <b>${count.wan}</b></span><span>VLAN 父接口 <b>${count.vlan}</b></span><span>未分配 <b>${count.unassigned}</b></span><span class="danger-text">故障 <b>${count.fault}</b></span><button class="button compact" type="button" data-view-interfaces>查看接口</button></section>`;
}

export function interfaceTable(state) {
  return `<div class="compact-table-wrap"><table class="data-table interface-table"><thead><tr><th>接口</th><th>状态</th><th>当前 / 最大速率</th><th>角色</th><th>使用者</th><th>操作</th></tr></thead><tbody>${state.physicalPorts.map((port) => `<tr><td><strong class="mono">${escapeHtml(port.name)}</strong><small>${escapeHtml(locationLabel(state, port))}</small></td><td><span class="compact-state ${port.driverStatus === 'fault' ? 'fault' : port.link}">${escapeHtml(linkLabel(port))}</span></td><td>${escapeHtml(`${port.speed} / ${port.maxSpeed}`)}</td><td>${escapeHtml(roleLabel(port))}</td><td>${escapeHtml(port.management ? '当前管理连接' : port.role === 'lan' ? 'br-lan' : port.role === 'wan' ? (port.wanConfig?.name || 'WAN 线路') : port.role === 'vlan-parent' ? `${port.vlanSummary?.vlans || 0} 个 VLAN` : '--')}</td><td><button class="row-action" type="button" data-interface-detail="${escapeHtml(port.name)}">详情</button></td></tr>`).join('')}</tbody></table></div>`;
}

export function openInterfaceStatus(state) {
  openDrawer({
    title: '接口状态',
    kicker: 'PHYSICAL INTERFACES',
    width: 'wide',
    body: `<p class="drawer-intro">日常配置仅显示接口、链路、速率和角色；硬件型号与驱动信息请前往“系统 → 硬件信息”。</p>${interfaceTable(state)}`,
    onMount(root) {
      root.querySelectorAll('[data-interface-detail]').forEach((button) => button.addEventListener('click', () => {
        const port = state.physicalPorts.find((item) => item.name === button.dataset.interfaceDetail);
        if (!port) return;
        const rate = `↑ ${formatSpeed(port.tx)} / ↓ ${formatSpeed(port.rx)}`;
        button.closest('tr').classList.toggle('selected-row');
        button.textContent = `${port.mtu} MTU · ${rate}`;
      }));
    }
  });
}
