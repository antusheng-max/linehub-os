import { escapeHtml, field, input, select } from './components.js';

export const WAN_TYPES = [
  ['dhcp', 'DHCP', '自动获取 IPv4 / IPv6'],
  ['static', '静态 IP', '手动配置地址与网关'],
  ['pppoe', 'PPPoE', '使用账号密码拨号'],
  ['multidial', '单线多拨', '同一物理接口建立多会话'],
  ['vlan', 'VLAN 拨号', '在指定 VLAN 上建立一个或多个PPPoE会话'],
  ['vlan-multidial', 'VLAN 单线多拨', '按 VLAN 批量生成会话']
];

export function wanTypeLabel(type) {
  return WAN_TYPES.find(([value]) => value === type)?.[1] || type || '--';
}

export function renderWanTypeChooser(selected = '') {
  return `<div class="wan-type-selector">${WAN_TYPES.map(([value, label, detail]) => `<label class="wan-type-option ${selected === value ? 'selected' : ''}"><input type="radio" name="connectionType" value="${value}" ${selected === value ? 'checked' : ''}><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></span></label>`).join('')}</div>`;
}

function switchField(name, label, checked = true) {
  return `<label class="check-line"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
}

function commonFields(config) {
  return `${field('线路名称', input('lineName', config.name || '新建 WAN', { required: true }))}${field('MTU', input('mtu', config.mtu || 1500, { type: 'number', min: 1280, max: 9000 }))}`;
}

export function renderWanFields(type, config = {}) {
  if (!type) return '<div class="dynamic-form-placeholder">选择连接方式后显示所需字段。</div>';
  if (type === 'dhcp') {
    return `<div class="form-grid">${commonFields(config)}${field('MAC 克隆', input('macClone', config.macClone || '', { placeholder: '留空使用接口 MAC' }))}${field('权重', input('weight', config.weight || 1, { type: 'number', min: 1, max: 100 }))}${field('线路池', select('pool', [['核心出口池', '核心出口池'], ['业务出口池', '业务出口池'], ['灾备出口池', '灾备出口池']], config.pool || '核心出口池'))}</div><div class="switch-cluster">${switchField('ipv4', 'IPv4 DHCP', config.ipv4 !== false)}${switchField('ipv6', 'IPv6 DHCPv6', config.ipv6 !== false)}${switchField('requestPd', '请求 IPv6-PD', config.requestPd !== false)}</div>`;
  }
  if (type === 'static') {
    return `<div class="form-grid">${field('线路名称', input('lineName', config.name || '静态线路', { required: true }))}${field('IPv4 地址 / CIDR', input('ipv4Address', config.ipv4Address || '198.51.100.10/24'))}${field('IPv4 网关', input('ipv4Gateway', config.ipv4Gateway || '198.51.100.1'))}${field('IPv4 DNS', input('ipv4Dns', config.ipv4Dns || '223.5.5.5'))}${field('IPv6 地址 / CIDR', input('ipv6Address', config.ipv6Address || ''))}${field('IPv6 网关', input('ipv6Gateway', config.ipv6Gateway || ''))}${field('IPv6 DNS', input('ipv6Dns', config.ipv6Dns || ''))}${field('MTU', input('mtu', config.mtu || 1500, { type: 'number', min: 1280, max: 9000 }))}</div>`;
  }
  if (type === 'pppoe') {
    return `<div class="form-grid">${field('线路名称', input('lineName', config.name || 'PPPoE 线路', { required: true }))}${field('用户名', input('username', config.username || '', { required: true }))}${field('密码', input('password', '', { type: 'password', placeholder: config.secretConfigured ? '已配置；留空保持不变' : '输入拨号密码', required: !config.secretConfigured }))}${field('MTU', input('mtu', config.mtu || 1492, { type: 'number', min: 1280, max: 1500 }))}${field('MRU', input('mru', config.mru || 1492, { type: 'number', min: 1280, max: 1500 }))}${field('权重', input('weight', config.weight || 1, { type: 'number', min: 1, max: 100 }))}${field('线路池', select('pool', [['核心出口池', '核心出口池'], ['业务出口池', '业务出口池'], ['灾备出口池', '灾备出口池']], config.pool || '核心出口池'))}</div><div class="switch-cluster">${switchField('ipv4', '启用 IPv4', config.ipv4 !== false)}${switchField('ipv6', '启用 IPv6', config.ipv6 !== false)}${switchField('requestPd', '请求 IPv6-PD', config.requestPd !== false)}${switchField('autoRedial', '自动重拨', config.autoRedial !== false)}</div>`;
  }
  if (type === 'vlan') {
    return `<div class="route-handoff"><strong>VLAN拨号</strong><p>进入独立会话编辑器，先输入VLAN，再逐行填写账号和密码。</p><a class="button primary" href="#/lines/vlan-dial">进入VLAN拨号</a></div>`;
  }
  return `<div class="route-handoff"><strong>${escapeHtml(wanTypeLabel(type))}</strong><p>该模式使用独立的会话编辑流程，以便逐行填写账号并检查冲突。</p><a class="button primary" href="#/${type === 'multidial' ? 'lines/multidial' : 'lines/vlan-multidial'}">进入${escapeHtml(wanTypeLabel(type))}</a></div>`;
}
