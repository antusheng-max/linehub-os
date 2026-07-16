import { getState, mutate } from '../store.js';
import { escapeHtml, field, input, maskAccount, panel, progressBar, select, statusBadge, toast } from '../components.js';
import { navigate } from '../router.js';

const steps = [
  ['硬件检测', '识别 PCI 设备与驱动'],
  ['网卡与网口发现', '区分物理与逻辑层'],
  ['确认临时管理口', '保持当前浏览器连接'],
  ['配置正式 LAN', '建立 LAN 桥与地址'],
  ['选择 WAN 接口', '分配一个或多个上联口'],
  ['配置 WAN', '选择连接方式与会话'],
  ['配置预览', '校验拓扑与引用'],
  ['应用与检查', '60 秒确认或自动回滚']
];

const wanTypes = [
  ['dhcp', 'DHCP 自动获取'], ['static', '静态 IP'], ['pppoe', 'PPPoE 拨号'],
  ['multidial', '单线多拨'], ['vlan', 'VLAN 拨号'], ['vlan-multidial', 'VLAN 单线多拨']
];

function onboarding() {
  return getState().onboarding;
}

function setStep(step) {
  mutate((state) => {
    state.onboarding.step = Math.min(8, Math.max(1, step));
    state.onboarding.maxStep = Math.max(state.onboarding.maxStep || 1, state.onboarding.step);
  }, { source: 'setup' });
}

function setupShell(content) {
  const state = getState();
  const setup = state.onboarding;
  return `<div class="setup-page">
    <header class="setup-header">
      <div class="setup-brand"><span class="brand-mark">LH</span><div><strong>LineHub OS 首次配置</strong><span>检测硬件、接管 LAN，并建立第一个 WAN 连接</span></div></div>
      <div class="setup-header-state"><span class="pulse-dot"></span><div><strong>设备未配置</strong><span>全部操作均为浏览器内模拟</span></div></div>
    </header>
    <div class="setup-layout">
      <aside class="setup-steps" aria-label="首次配置步骤">
        <div class="setup-progress"><span>配置进度</span><strong>${setup.step} / 8</strong>${progressBar(setup.step / 8 * 100)}</div>
        ${steps.map(([title, description], index) => {
          const number = index + 1;
          const stateClass = number === setup.step ? 'active' : number < setup.step || number <= (setup.maxStep || 1) ? 'done' : '';
          return `<button type="button" class="setup-step ${stateClass}" data-setup-step="${number}" ${number > (setup.maxStep || 1) ? 'disabled' : ''}><span>${number < setup.step ? '✓' : number}</span><div><strong>${title}</strong><small>${description}</small></div></button>`;
        }).join('')}
        <div class="setup-safety"><strong>连接安全</strong><p>应用正式 LAN 后提供 60 秒确认窗口；未确认会自动恢复临时管理口。</p></div>
      </aside>
      <main class="setup-main">${content}</main>
    </div>
  </div>`;
}

function setupTitle(step, title, description, badge = '') {
  return `<div class="setup-title"><div><span>STEP ${String(step).padStart(2, '0')}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${badge}</div>`;
}

function setupActions({ back = true, next = true, nextLabel = '下一步', nextDisabled = false, extra = '' } = {}) {
  return `<footer class="setup-actions"><div>${extra}</div><div>${back ? '<button class="button" type="button" data-setup-back>上一步</button>' : ''}${next ? `<button class="button primary" type="button" data-setup-next ${nextDisabled ? 'disabled' : ''}>${escapeHtml(nextLabel)}</button>` : ''}</div></footer>`;
}

function hardwareCard(card) {
  return `<article class="hardware-card ${card.driverStatus}">
    <header><span class="hardware-icon">NIC</span><div><h3>${escapeHtml(card.model)}</h3><p>${escapeHtml(card.pci)}</p></div>${statusBadge(card.driverStatus === 'healthy' ? 'online' : 'warning', card.driverStatus === 'healthy' ? '驱动正常' : '驱动注意')}</header>
    <dl><div><dt>驱动</dt><dd class="mono">${escapeHtml(card.driver)}</dd></div><div><dt>物理端口</dt><dd>${card.portCount} 个</dd></div><div><dt>最大速率</dt><dd>${escapeHtml(card.maxSpeed)}</dd></div><div><dt>NUMA</dt><dd>节点 ${card.numa}</dd></div><div><dt>温度</dt><dd>${escapeHtml(card.temperature)}</dd></div><div><dt>固件</dt><dd class="mono">${escapeHtml(card.firmware)}</dd></div></dl>
  </article>`;
}

function roleLabel(role) {
  return {
    'temporary-management': '临时管理口', lan: 'LAN 成员', wan: 'WAN 接口', unassigned: '未分配'
  }[role] || role;
}

function portCard(port, options = {}) {
  const selectable = options.selectable;
  const selected = options.selected;
  const inputType = options.inputType || 'checkbox';
  const disabled = options.disabled || port.driverStatus === 'fault';
  const linkClass = port.driverStatus === 'fault' ? 'fault' : port.link;
  return `<label class="physical-port ${linkClass} ${selected ? 'selected' : ''} ${port.management ? 'management' : ''} ${disabled ? 'disabled' : ''}" data-port-name="${escapeHtml(port.name)}">
    ${selectable ? `<input type="${inputType}" name="${escapeHtml(options.inputName || 'ports')}" value="${escapeHtml(port.name)}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>` : ''}
    <div class="port-face"><span class="port-led"></span><strong>${port.medium.startsWith('RJ45') ? 'RJ45' : 'SFP+'}</strong><i>${port.portNumber}</i></div>
    <div class="port-main"><div class="port-name"><strong>${escapeHtml(port.name)}</strong>${port.management ? '<span>当前浏览器</span>' : ''}</div><p>${escapeHtml(port.nicName)} · 端口 ${port.portNumber}</p><div class="port-badges">${statusBadge(linkClass, linkClass === 'up' ? '已插线' : linkClass === 'fault' ? '驱动异常' : '未插线')}<span class="port-role ${escapeHtml(port.role)}">${escapeHtml(roleLabel(port.role))}</span></div></div>
    <dl class="port-details"><div><dt>协商 / 最大</dt><dd>${escapeHtml(port.speed)} / ${escapeHtml(port.maxSpeed)}</dd></div><div><dt>MAC</dt><dd class="mono">${escapeHtml(port.mac)}</dd></div><div><dt>双工 / MTU</dt><dd>${escapeHtml(port.duplex)} / ${port.mtu}</dd></div><div><dt>实时速率</dt><dd>↑ ${port.tx.toFixed(1)} · ↓ ${port.rx.toFixed(1)} Mbps</dd></div><div><dt>错误 / 丢包</dt><dd class="${port.errors || port.drops ? 'warning-text' : ''}">${port.errors} / ${port.drops}</dd></div><div><dt>介质</dt><dd>${escapeHtml(port.medium)}</dd></div></dl>
    ${port.optical ? `<div class="optical-data"><span>模块 ${escapeHtml(port.optical.module)}</span><span>温度 ${escapeHtml(port.optical.temperature)}</span><span>RX ${escapeHtml(port.optical.rxPower)}</span><span>TX ${escapeHtml(port.optical.txPower)}</span><span class="${port.optical.compatible ? 'healthy-text' : 'danger-text'}">${port.optical.compatible ? '模块兼容' : '模块不兼容'}</span></div>` : ''}
  </label>`;
}

function hardwareStats() {
  const state = getState();
  const ports = state.physicalPorts;
  const values = [
    ['物理网卡', state.hardwareCards.length, 'NIC'], ['物理网口', ports.length, 'PORT'],
    ['已连接', ports.filter((port) => port.link === 'up').length, 'UP'], ['未连接', ports.filter((port) => port.link === 'down').length, 'DOWN'],
    ['已分配', ports.filter((port) => port.role !== 'unassigned').length, 'USE'], ['未分配', ports.filter((port) => port.role === 'unassigned').length, 'FREE'],
    ['驱动异常', ports.filter((port) => port.driverStatus === 'fault').length, '!'], ['临时管理口', ports.filter((port) => port.management).length, 'MGMT']
  ];
  return `<div class="setup-stats">${values.map(([label, value, icon]) => `<article><span>${icon}</span><div><small>${label}</small><strong>${value}</strong></div></article>`).join('')}</div>`;
}

function stepHardware() {
  const state = getState();
  const detected = state.onboarding.hardwareDetected;
  return setupShell(`${setupTitle(1, '硬件检测', '扫描 PCI 设备、驱动、固件和 NUMA 拓扑，建立物理网卡清单。', statusBadge(detected ? 'online' : 'dialing', detected ? '检测完成' : '等待检测'))}
    ${hardwareStats()}
    <div class="setup-section-heading"><div><h2>检测到的物理网卡</h2><p>物理网卡与其端口会在下一步分别展示。</p></div><button class="button ${detected ? '' : 'primary'}" type="button" data-detect-hardware>${detected ? '重新检测' : '开始硬件检测'}</button></div>
    <div class="hardware-grid">${state.hardwareCards.map(hardwareCard).join('')}</div>
    <div class="setup-console" id="hardware-console"><span>linehub-hwprobe</span>${detected ? '\n[ OK ] 3 PCI network adapters discovered\n[ OK ] 8 physical ports enumerated\n[WARN] enp130s0f1 reports an incompatible optical module\n[ OK ] hardware inventory stored in local preview' : '\n等待执行本地模拟硬件检测...'}</div>
    ${setupActions({ back: false, nextDisabled: !detected })}`);
}

function stepPorts() {
  const state = getState();
  const discovered = state.onboarding.portsDiscovered;
  return setupShell(`${setupTitle(2, '网卡与网口发现', '明确区分物理硬件、VLAN、PPPoE、LAN 桥和线路池，避免把逻辑接口误认为物理网口。', statusBadge(discovered ? 'online' : 'dialing', discovered ? '发现完成' : '等待发现'))}
    <div class="interface-layers"><article><span>1</span><strong>物理网卡</strong><small>PCI 设备</small></article><i>→</i><article><span>2</span><strong>物理网口</strong><small>RJ45 / SFP+</small></article><i>→</i><article><span>3</span><strong>VLAN 接口</strong><small>逻辑子接口</small></article><i>→</i><article><span>4</span><strong>PPPoE 会话</strong><small>逻辑会话</small></article><i>→</i><article><span>5</span><strong>线路池</strong><small>汇聚资源</small></article><i>→</i><article><span>6</span><strong>LAN 桥</strong><small>管理与业务</small></article></div>
    ${hardwareStats()}
    <div class="setup-section-heading"><div><h2>8 个物理网口</h2><p>端口状态、介质和光模块信息均为模拟数据。</p></div><button class="button ${discovered ? '' : 'primary'}" type="button" data-discover-ports>${discovered ? '重新扫描网口' : '发现网口'}</button></div>
    <div class="physical-port-grid">${state.physicalPorts.map((port) => portCard(port)).join('')}</div>
    ${setupActions({ nextDisabled: !discovered })}`);
}

function stepManagement() {
  const state = getState();
  const setup = state.onboarding;
  const candidates = state.physicalPorts.filter((port) => port.link === 'up' && port.driverStatus !== 'fault');
  const current = state.physicalPorts.find((port) => port.name === setup.managementPort);
  return setupShell(`${setupTitle(3, '确认临时管理口', 'LineHub OS 模拟从任意未分配且已插线网口提供首次 Web 访问；当前浏览器连接会被明确标记。', statusBadge('online', '连接安全'))}
    <div class="management-banner"><span class="management-pulse"></span><div><strong>当前浏览器通过 ${escapeHtml(current?.name || '--')} 接入</strong><p>${escapeHtml(current?.nicName || '')} · ${escapeHtml(current?.mac || '')} · ${escapeHtml(current?.speed || '')}</p></div><b>临时管理口</b></div>
    <form id="management-form"><div class="setup-section-heading"><div><h2>选择临时管理口</h2><p>只能选择驱动正常且已插线的物理网口。</p></div></div><div class="physical-port-grid compact">${candidates.map((port) => portCard(port, { selectable: true, inputType: 'radio', inputName: 'managementPort', selected: port.name === setup.managementPort })).join('')}</div>
    <div class="notice warning"><span>!</span><div><strong>不要中断当前管理连接</strong><p>如果后续要把临时管理口分配给 WAN，必须先把另一个已插线端口加入正式 LAN。</p></div></div>
    ${setupActions({ next: false, extra: '', back: true }).replace('</footer>', '<div><button class="button primary" type="submit">确认临时管理口</button></div></footer>')}</form>`);
}

function stepLan() {
  const state = getState();
  const setup = state.onboarding;
  const lan = setup.lan;
  const candidates = state.physicalPorts.filter((port) => port.link === 'up' && port.driverStatus !== 'fault');
  return setupShell(`${setupTitle(4, '配置正式 LAN', '选择至少一个 LAN 成员端口，并配置管理地址、DHCP 和 IPv6 服务。', `<span class="selection-count">已选 ${lan.members.length} 个端口</span>`)}
    <form id="lan-setup-form">
      <div class="setup-section-heading"><div><h2>选择 LAN 成员端口</h2><p>应用后这些端口将加入 LAN 桥；第一个成员成为新的管理接入口。</p></div></div>
      <div class="physical-port-grid compact">${candidates.map((port) => portCard(port, { selectable: true, inputName: 'lanMembers', selected: lan.members.includes(port.name) })).join('')}</div>
      <div class="wizard-form-grid">
        ${field('LAN 桥名称', input('bridge', lan.bridge, { required: true }))}
        ${field('IPv4 CIDR', input('ipv4Cidr', lan.ipv4Cidr, { required: true }), '使用 ipv4_cidr 格式')}
        ${field('ULA IPv6 前缀', input('ulaPrefix', lan.ulaPrefix, { required: true }))}
        ${field('MTU', input('mtu', lan.mtu, { type: 'number', min: 1280, max: 9000 }))}
        ${field('DHCP 地址池起始', input('poolStart', lan.poolStart))}
        ${field('DHCP 地址池结束', input('poolEnd', lan.poolEnd))}
        ${field('DNS', input('dns', lan.dns), '多个地址用逗号分隔')}
      </div>
      <div class="check-grid wizard-checks"><label class="check-line"><input type="checkbox" name="dhcp" ${lan.dhcp ? 'checked' : ''}>启用 DHCPv4</label><label class="check-line"><input type="checkbox" name="ra" ${lan.ra ? 'checked' : ''}>启用 IPv6 RA</label><label class="check-line"><input type="checkbox" name="dhcpv6" ${lan.dhcpv6 ? 'checked' : ''}>启用 DHCPv6</label></div>
      <pre class="config-preview" id="lan-setup-preview"></pre>
      ${setupActions({ next: false }).replace('</footer>', '<div><button class="button primary" type="submit">保存 LAN 并继续</button></div></footer>')}
    </form>`);
}

function stepWanPorts() {
  const state = getState();
  const setup = state.onboarding;
  const lanMembers = new Set(setup.lan.members);
  const candidates = state.physicalPorts.filter((port) => !lanMembers.has(port.name));
  return setupShell(`${setupTitle(5, '选择 WAN 接口', '从未分配物理端口中选择一个或多个上联口；已加入 LAN 的端口不会出现在这里。', `<span class="selection-count">已选 ${setup.selectedWanPorts.length} 个 WAN 口</span>`)}
    <form id="wan-port-form"><div class="physical-port-grid">${candidates.map((port) => portCard(port, { selectable: true, inputName: 'wanPorts', selected: setup.selectedWanPorts.includes(port.name), disabled: port.driverStatus === 'fault' })).join('')}</div>
    ${candidates.some((port) => port.name === setup.managementPort) ? '<div class="notice warning"><span>!</span><div><strong>当前临时管理口仍在候选列表</strong><p>如果选择它作为 WAN，必须先回到上一步选择其他正式 LAN 端口；向导会阻止可能中断管理连接的配置。</p></div></div>' : ''}
    ${setupActions({ next: false }).replace('</footer>', '<div><button class="button primary" type="submit">确认 WAN 接口</button></div></footer>')}</form>`);
}

function defaultWanConfig(portName, type = 'dhcp') {
  return {
    saved: false, type, wanId: `wan-${portName.replaceAll(/[^a-z0-9]/gi, '-')}`, name: `${portName} 上联`, port: portName,
    mac: '', ipv4: true, ipv6: true, requestPd: true, dnsMode: 'automatic', mtu: 1500,
    mru: 1492, healthcheck: 'TCP + DNS', pool: '核心出口池', weight: 1,
    serviceName: '', acName: '', autoRedial: true, dialCount: 3,
    vlanId: 101, vlanProtocol: 'pppoe'
  };
}

function commonWanFields(config, portName) {
  const state = getState();
  return `${field('WAN ID', input('wanId', config.wanId, { required: true }))}${field('线路名称', input('name', config.name, { required: true }))}${field('物理接口', input('port', portName, { required: true }))}${field('线路池', select('pool', state.pools.map((pool) => [pool.name, pool.name]), config.pool))}${field('权重', input('weight', config.weight, { type: 'number', min: 1, max: 100 }))}${field('健康检查', select('healthcheck', [['TCP + DNS', 'TCP + DNS'], ['多目标 ICMP', '多目标 ICMP'], ['TCP 端口', 'TCP 端口'], ['DNS 解析', 'DNS 解析']], config.healthcheck))}`;
}

function protocolChecks(config, options = {}) {
  return `<div class="check-grid wizard-checks"><label class="check-line"><input type="checkbox" name="ipv4" ${config.ipv4 ? 'checked' : ''}>启用 IPv4</label><label class="check-line"><input type="checkbox" name="ipv6" ${config.ipv6 ? 'checked' : ''}>启用 IPv6</label><label class="check-line"><input type="checkbox" name="requestPd" ${config.requestPd ? 'checked' : ''}>请求 IPv6-PD</label>${options.redial ? `<label class="check-line"><input type="checkbox" name="autoRedial" ${config.autoRedial ? 'checked' : ''}>自动重拨</label>` : ''}</div>`;
}

function dhcpFields(config, portName) {
  return `<div class="wizard-form-grid">${commonWanFields(config, portName)}${field('MAC 克隆', input('mac', config.mac, { placeholder: '留空使用接口 MAC' }))}${field('DNS 获取方式', select('dnsMode', [['automatic', '自动获取'], ['manual', '手动指定']], config.dnsMode))}${field('MTU', input('mtu', config.mtu, { type: 'number', min: 1280, max: 9000 }))}</div>${protocolChecks(config)}`;
}

function staticFields(config, portName) {
  return `<div class="wizard-form-grid">${commonWanFields(config, portName)}${field('IPv4 地址 / CIDR', input('ipv4Address', config.ipv4Address || '198.51.100.10/24'))}${field('IPv4 网关', input('ipv4Gateway', config.ipv4Gateway || '198.51.100.1'))}${field('IPv4 DNS', input('ipv4Dns', config.ipv4Dns || '223.5.5.5, 1.1.1.1'))}${field('IPv6 地址 / CIDR', input('ipv6Address', config.ipv6Address || '2001:db8:100::10/64'))}${field('IPv6 网关', input('ipv6Gateway', config.ipv6Gateway || '2001:db8:100::1'))}${field('IPv6 DNS', input('ipv6Dns', config.ipv6Dns || '2606:4700:4700::1111'))}${field('IPv6-PD', input('ipv6Pd', config.ipv6Pd || '2001:db8:200::/56'))}${field('MTU', input('mtu', config.mtu, { type: 'number', min: 1280, max: 9000 }))}</div>${protocolChecks(config)}`;
}

function pppoeFields(config, portName) {
  return `<div class="wizard-form-grid">${commonWanFields(config, portName)}${field('PPPoE 用户名', input('username', config.username || '', { required: true }))}${field('PPPoE 密码', input('password', '', { type: 'password', placeholder: config.secretConfigured ? '••••••••（已配置）' : '••••••••', required: !config.secretConfigured }))}${field('服务名称', input('serviceName', config.serviceName || ''))}${field('AC 名称', input('acName', config.acName || ''))}${field('自定义 MAC', input('mac', config.mac || ''))}${field('MTU', input('mtu', config.mtu || 1492, { type: 'number', min: 1280, max: 1500 }))}${field('MRU', input('mru', config.mru || 1492, { type: 'number', min: 1280, max: 1500 }))}</div>${protocolChecks(config, { redial: true })}`;
}

function multiDialRows(config) {
  const count = Math.min(12, Math.max(2, Number(config.dialCount) || 3));
  return Array.from({ length: count }, (_, index) => {
    const session = config.sessions?.[index] || {};
    return `<tr><td>${index + 1}</td><td class="mono">${escapeHtml(`${config.wanId}-${String(index + 1).padStart(2, '0')}`)}</td><td><input class="input" name="accounts" value="${escapeHtml(session.account || '')}" placeholder="account${index + 1}@example.invalid" required></td><td><input class="input" type="password" name="sessionPasswords" placeholder="••••••••" ${session.secretConfigured ? '' : 'required'}></td><td><input class="input" name="sessionMacs" value="${escapeHtml(session.mac || `02:4c:48:dd:${String(index + 1).padStart(2, '0')}:01`)}"></td><td><input class="input" type="number" name="sessionWeights" min="1" max="100" value="${session.weight || 1}"></td><td><input type="checkbox" name="sessionIpv4" value="${index}" ${session.ipv4 !== false ? 'checked' : ''}></td><td><input type="checkbox" name="sessionIpv6" value="${index}" ${session.ipv6 !== false ? 'checked' : ''}></td><td>${escapeHtml(config.healthcheck)}</td></tr>`;
  }).join('');
}

function multiDialFields(config, portName) {
  return `<div class="wizard-form-grid">${commonWanFields(config, portName)}${field('拨号数量', input('dialCount', config.dialCount || 3, { type: 'number', min: 2, max: 12 }), '同一物理接口创建多个 PPPoE 会话')}${field('MTU', input('mtu', config.mtu || 1492, { type: 'number', min: 1280, max: 1500 }))}${field('MRU', input('mru', config.mru || 1492, { type: 'number', min: 1280, max: 1500 }))}</div><div class="button-row" style="margin:10px 0"><button class="button" type="button" data-refresh-multidial>按拨号数量更新账号行</button><span class="muted">WAN ID 和独立 MAC 自动生成</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>WAN ID</th><th>账号</th><th>密码</th><th>独立 MAC</th><th>权重</th><th>IPv4</th><th>IPv6</th><th>健康检查</th></tr></thead><tbody>${multiDialRows(config)}</tbody></table></div>`;
}

function vlanFields(config, portName) {
  const protocol = config.vlanProtocol || 'pppoe';
  const vlan = Number(config.vlanId) || 101;
  const account = config.username ? maskAccount(config.username) : '等待输入账号';
  return `<div class="dial-path-preview"><span>${escapeHtml(portName)}</span><i>→</i><span data-single-vlan-ifname>${escapeHtml(`${portName}.${vlan}`)}</span><i>→</i><span data-single-vlan-session>${protocol === 'pppoe' ? `PPPoE · ${escapeHtml(account)}` : escapeHtml(protocol.toUpperCase())}</span><i>→</i><strong data-single-vlan-wan-id>${escapeHtml(config.wanId)}</strong></div><div class="wizard-form-grid">${commonWanFields(config, portName)}${field('父接口', input('parent', portName))}${field('VLAN ID', input('vlanId', vlan, { type: 'number', min: 1, max: 4094 }))}${field('VLAN 子接口预览', `<div class="input computed-field mono" data-single-vlan-ifname>${escapeHtml(`${portName}.${vlan}`)}</div>`, '输入 VLAN 后自动生成')}${field('VLAN 连接方式', select('vlanProtocol', [['pppoe', 'PPPoE 拨号（账号 / 密码）'], ['dhcp', 'DHCP'], ['static', '静态 IP']], protocol))}${protocol === 'pppoe' ? `${field('PPPoE 用户名', input('username', config.username || '', { required: true }))}${field('PPPoE 密码', input('password', '', { type: 'password', placeholder: config.secretConfigured ? '••••••••（已配置）' : '••••••••', required: !config.secretConfigured }))}` : ''}${protocol === 'static' ? `${field('IPv4 地址 / CIDR', input('ipv4Address', config.ipv4Address || '198.51.100.20/24'))}${field('IPv4 网关', input('ipv4Gateway', config.ipv4Gateway || '198.51.100.1'))}` : ''}${field('MTU', input('mtu', config.mtu || (protocol === 'pppoe' ? 1492 : 1500), { type: 'number', min: 1280, max: 1500 }))}</div>${protocolChecks(config)}`;
}

function vlanSessionRow(row, index, config, portName) {
  const vlan = Number(row.vlan) || 101;
  const mac = row.mac || `02:4c:48:ef:${String(index + 1).padStart(2, '0')}:01`;
  const wanId = `${config.wanId}-v${vlan}`;
  return `<tr data-vlan-session-row data-secret-configured="${row.secretConfigured ? 'true' : 'false'}" data-existing-account="${escapeHtml(row.account || '')}"><td><input class="input vlan-id-input" type="number" name="vlanIds" min="1" max="4094" value="${vlan}" required></td><td><input class="input" name="vlanAccounts" value="${escapeHtml(row.account || '')}" placeholder="宽带账号" required></td><td><input class="input" type="password" name="vlanPasswords" placeholder="${row.secretConfigured ? '••••••••（已配置）' : '输入拨号密码'}" ${row.secretConfigured ? '' : 'required'}></td><td class="mono" data-vlan-ifname>${escapeHtml(`${portName}.${vlan}`)}</td><td class="mono" data-vlan-wan-id>${escapeHtml(wanId)}</td><td><input class="input" name="vlanMacs" value="${escapeHtml(mac)}" required></td><td><input class="input compact-number" type="number" name="vlanWeights" min="1" max="100" value="${row.weight || 1}"></td><td><input type="checkbox" name="vlanIpv4" ${row.ipv4 !== false ? 'checked' : ''} aria-label="启用 IPv4"></td><td><input type="checkbox" name="vlanIpv6" ${row.ipv6 !== false ? 'checked' : ''} aria-label="启用 IPv6"></td><td><button class="button compact danger-text" type="button" data-remove-vlan-session>删除</button></td></tr>`;
}

function initialVlanSessions(config) {
  const configured = Array.isArray(config.generatedSessions) ? config.generatedSessions.filter((row) => row.account) : [];
  return configured.length ? configured : [{ vlan: 101, account: '', secretConfigured: false, ipv4: true, ipv6: true, weight: 1 }];
}

function collectVlanSessions(form, config, portName) {
  const rows = [...form.querySelectorAll('[data-vlan-session-row]')].map((element, index) => {
    const vlan = Number(element.querySelector('[name="vlanIds"]').value);
    const account = element.querySelector('[name="vlanAccounts"]').value.trim();
    const password = element.querySelector('[name="vlanPasswords"]').value;
    const existingAccount = element.dataset.existingAccount || '';
    const hasStoredSecret = element.dataset.secretConfigured === 'true' && existingAccount === account;
    const id = `${config.wanId}-v${vlan}`;
    const mac = element.querySelector('[name="vlanMacs"]').value.trim();
    const weight = Number(element.querySelector('[name="vlanWeights"]').value);
    const errors = [];
    if (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094) errors.push('VLAN 无效');
    if (!account) errors.push('缺少账号');
    if (!hasStoredSecret && !password) errors.push('缺少密码');
    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) errors.push('MAC 无效');
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) errors.push('权重无效');
    return { vlan, account, secretConfigured: hasStoredSecret || Boolean(password), ifname: `${portName}.${vlan}`, id, mac, weight, ipv4: element.querySelector('[name="vlanIpv4"]').checked, ipv6: element.querySelector('[name="vlanIpv6"]').checked, errors, index };
  });
  const seenVlan = new Map(); const seenMac = new Map(); const seenId = new Map();
  const markDuplicate = (map, value, label, row) => {
    if (map.has(value)) { row.errors.push(label); rows[map.get(value)].errors.push(label); }
    else map.set(value, row.index);
  };
  rows.forEach((row) => {
    markDuplicate(seenVlan, row.vlan, '重复 VLAN', row);
    markDuplicate(seenMac, row.mac.toLowerCase(), '重复 MAC', row);
    markDuplicate(seenId, row.id, '重复 WAN ID', row);
    delete row.index;
  });
  rows.forEach((row) => { row.errors = [...new Set(row.errors)]; });
  return rows;
}

function refreshVlanSessionLabels(form, config, portName) {
  const wanId = form.querySelector('[name="wanId"]')?.value.trim() || config.wanId;
  form.querySelectorAll('[data-vlan-session-row]').forEach((row) => {
    const vlan = Number(row.querySelector('[name="vlanIds"]').value) || 0;
    row.querySelector('[data-vlan-ifname]').textContent = vlan ? `${portName}.${vlan}` : `${portName}.?`;
    row.querySelector('[data-vlan-wan-id]').textContent = vlan ? `${wanId}-v${vlan}` : `${wanId}-v?`;
  });
  const count = form.querySelector('[data-vlan-session-count]');
  if (count) count.textContent = `${form.querySelectorAll('[data-vlan-session-row]').length} 条`;
}

function demoVlanSessions() {
  return [101, 103, 105, 107, 109, 111].map((vlan, index) => ({
    vlan, account: `vlan${vlan}@example.invalid`, secretConfigured: false,
    mac: `02:4c:48:ef:${String(index + 1).padStart(2, '0')}:01`, weight: 1,
    ipv4: true, ipv6: index % 3 !== 0
  }));
}

function vlanMultiPreview(rows) {
  if (!rows.length) return '<div class="empty-state"><span>V</span><strong>等待拨号预览</strong><p>逐条输入 VLAN、PPPoE 账号和密码后检查拨号会话。</p></div>';
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>VLAN</th><th>VLAN 接口</th><th>PPPoE 会话 / WAN ID</th><th>账号</th><th>MAC</th><th>IPv4</th><th>IPv6</th><th>权重</th><th>检查结果</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.errors?.length ? 'invalid-row' : ''}"><td>${escapeHtml(row.vlan)}</td><td class="mono">${escapeHtml(row.ifname)}</td><td class="mono">${escapeHtml(row.id)}</td><td>${row.account ? escapeHtml(maskAccount(row.account)) : '自动生成'}</td><td class="mono">${escapeHtml(row.mac)}</td><td>${row.ipv4 ? '开' : '关'}</td><td>${row.ipv6 ? '开' : '关'}</td><td>${row.weight}</td><td>${row.errors?.length ? escapeHtml(row.errors.join('、')) : statusBadge('online', '通过')}</td></tr>`).join('')}</tbody></table></div>`;
}

function vlanMultiFields(config, portName) {
  const rows = initialVlanSessions(config);
  const previewRows = Array.isArray(config.generatedSessions) ? config.generatedSessions.filter((row) => row.account) : [];
  return `<div class="wizard-form-grid">${commonWanFields(config, portName)}${field('父接口', `<div class="input computed-field mono">${escapeHtml(portName)}</div>`)}${field('拨号模型', '<div class="input computed-field">每条 VLAN 对应一组 PPPoE 账号和密码</div>')}</div><section class="vlan-dial-editor"><header><div><strong>VLAN PPPoE 拨号条目</strong><p>先输入 VLAN，再输入该 VLAN 对应的宽带账号和密码；系统自动生成 VLAN 子接口和 WAN ID。</p></div><span data-vlan-session-count>${rows.length} 条</span></header><div class="data-table-wrap"><table class="data-table vlan-dial-table"><thead><tr><th>VLAN</th><th>PPPoE 账号</th><th>PPPoE 密码</th><th>VLAN 子接口</th><th>WAN ID</th><th>独立 MAC</th><th>权重</th><th>IPv4</th><th>IPv6</th><th>操作</th></tr></thead><tbody data-vlan-session-list>${rows.map((row, index) => vlanSessionRow(row, index, config, portName)).join('')}</tbody></table></div></section><div class="button-row vlan-editor-actions"><button class="button" type="button" data-add-vlan-session>＋ 新增拨号条目</button><button class="button" type="button" data-load-demo-vlans>载入演示 VLAN</button><button class="button primary" type="button" data-preview-vlan>校验并预览拨号</button><span class="muted">演示 VLAN：101、103、105、107、109、111</span></div><div id="vlan-multi-preview">${vlanMultiPreview(previewRows)}</div>`;
}

function wanFields(config, portName) {
  if (config.type === 'static') return staticFields(config, portName);
  if (config.type === 'pppoe') return pppoeFields(config, portName);
  if (config.type === 'multidial') return multiDialFields(config, portName);
  if (config.type === 'vlan') return vlanFields(config, portName);
  if (config.type === 'vlan-multidial') return vlanMultiFields(config, portName);
  return dhcpFields(config, portName);
}

function stepWanConfig() {
  const state = getState();
  const setup = state.onboarding;
  const activePort = setup.activeWanPort || setup.selectedWanPorts[0];
  const config = setup.wanConfigs[activePort] || defaultWanConfig(activePort);
  const savedCount = setup.selectedWanPorts.filter((name) => setup.wanConfigs[name]?.saved).length;
  return setupShell(`${setupTitle(6, '配置 WAN 连接方式', '按物理接口分别选择 DHCP、静态 IP、PPPoE、单线多拨或 VLAN 拨号。', `<span class="selection-count">已完成 ${savedCount} / ${setup.selectedWanPorts.length}</span>`)}
    <div class="wan-port-tabs">${setup.selectedWanPorts.map((name) => `<button type="button" class="${name === activePort ? 'active' : ''}" data-wan-port-tab="${escapeHtml(name)}"><span class="status-lamp ${setup.wanConfigs[name]?.saved ? 'online' : 'dialing'}"></span>${escapeHtml(name)}${setup.wanConfigs[name]?.saved ? '<small>已保存</small>' : '<small>待配置</small>'}</button>`).join('')}</div>
    <form id="wan-setup-form" data-port="${escapeHtml(activePort)}"><div class="connection-type-bar"><label><span>WAN 连接类型</span>${select('type', wanTypes, config.type)}</label><div><strong>${escapeHtml(wanTypes.find(([value]) => value === config.type)?.[1] || '')}</strong><p>接口 ${escapeHtml(activePort)} · 配置仅保存到本地模拟数据</p></div></div>
    ${wanFields(config, activePort)}
    <div class="notice"><span>i</span><div><strong>密码安全</strong><p>PPPoE 密码输入始终使用圆点显示，保存时仅记录“已配置”状态，不写入 localStorage。</p></div></div>
    ${setupActions({ next: false }).replace('</footer>', `<div><button class="button" type="submit">保存 ${escapeHtml(activePort)} 配置</button><button class="button primary" type="button" data-wan-finish ${savedCount === setup.selectedWanPorts.length ? '' : 'disabled'}>进入配置预览</button></div></footer>`)}</form>`);
}

function summarizeSetup() {
  const state = getState();
  const setup = state.onboarding;
  const configs = Object.values(setup.wanConfigs).filter((config) => config.saved);
  const sessions = configs.flatMap((config) => config.generatedSessions || config.sessions || [config]);
  const vlanCount = new Set(sessions.map((session) => session.vlan).filter(Boolean)).size + configs.filter((config) => config.type === 'vlan').length;
  return {
    lanPorts: setup.lan.members.length,
    wanPorts: setup.selectedWanPorts.length,
    unassigned: state.physicalPorts.length - new Set([...setup.lan.members, ...setup.selectedWanPorts]).size,
    dhcp: configs.filter((config) => config.type === 'dhcp' || config.vlanProtocol === 'dhcp').length,
    static: configs.filter((config) => config.type === 'static' || config.vlanProtocol === 'static').length,
    pppoe: configs.filter((config) => ['pppoe', 'multidial', 'vlan', 'vlan-multidial'].includes(config.type)).length,
    vlan: vlanCount,
    sessions: sessions.length,
    ipv4: sessions.filter((session) => session.ipv4 !== false).length,
    ipv6: sessions.filter((session) => session.ipv6 !== false).length
  };
}

function validateSetup() {
  const state = getState();
  const setup = state.onboarding;
  const errors = [];
  if (!setup.lan.members.length) errors.push('至少选择一个正式 LAN 成员端口');
  if (!setup.selectedWanPorts.length) errors.push('至少选择一个 WAN 物理接口');
  if (setup.selectedWanPorts.includes(setup.managementPort) && !setup.lan.members.includes(setup.managementPort)) errors.push('当前临时管理口被选为 WAN，必须先选择新的管理口');
  setup.selectedWanPorts.forEach((name) => { if (!setup.wanConfigs[name]?.saved) errors.push(`${name} 尚未保存 WAN 配置`); });
  const sessions = Object.values(setup.wanConfigs).flatMap((config) => config.generatedSessions || config.sessions || (config.saved ? [config] : []));
  const duplicate = (values) => values.some((value, index) => value && values.indexOf(value) !== index);
  if (duplicate(sessions.map((session) => session.id || session.wanId))) errors.push('检测到重复 WAN ID');
  if (duplicate(sessions.map((session) => session.mac?.toLowerCase()))) errors.push('检测到重复 MAC');
  if (sessions.some((session) => session.errors?.length)) errors.push('VLAN 批量配置中存在错误行');
  if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(setup.lan.ipv4Cidr)) errors.push('LAN IPv4 CIDR 格式无效');
  if (!/^fd[0-9a-f]{2}:/i.test(setup.lan.ulaPrefix)) errors.push('LAN ULA 必须使用 RFC4193 fd00::/8 前缀');
  return errors;
}

function topology(setup) {
  const summary = summarizeSetup();
  const nodes = [
    ['NIC', `${getState().hardwareCards.length} 张物理网卡`], ['PORT', `${getState().physicalPorts.length} 个物理网口`],
    ['VLAN', `${summary.vlan} 个 VLAN`], ['PPP', `${summary.sessions} 个逻辑会话`],
    ['POOL', `${getState().pools.length} 个线路池`], ['LAN', `${setup.lan.bridge} · ${setup.lan.ipv4Cidr}`], ['WEB', '当前管理客户端']
  ];
  return `<div class="setup-topology">${nodes.map(([icon, label], index) => `<article><span>${icon}</span><strong>${escapeHtml(label)}</strong></article>${index < nodes.length - 1 ? '<i>→</i>' : ''}`).join('')}</div>`;
}

function stepPreview() {
  const setup = onboarding();
  const summary = summarizeSetup();
  const errors = setup.validation.errors || [];
  const values = [
    ['LAN 端口', summary.lanPorts], ['WAN 端口', summary.wanPorts], ['未分配端口', summary.unassigned],
    ['DHCP 线路', summary.dhcp], ['静态线路', summary.static], ['PPPoE 配置', summary.pppoe],
    ['VLAN 数量', summary.vlan], ['PPPoE / 逻辑会话', summary.sessions], ['IPv4 启用', summary.ipv4], ['IPv6 启用', summary.ipv6]
  ];
  return setupShell(`${setupTitle(7, '配置预览与校验', '在应用前确认物理端口分配、逻辑拓扑、LAN 地址和 WAN 会话引用。', setup.validation.valid ? statusBadge('online', '校验通过') : statusBadge('warning', '等待校验'))}
    ${topology(setup)}
    <div class="setup-summary-grid">${values.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`).join('')}</div>
    <div class="grid cols-2">
      ${panel('LAN 与管理连接', `<div class="panel-content pad"><div class="resource-row"><span>临时管理口</span><span></span><strong>${escapeHtml(setup.managementPort)}</strong></div><div class="resource-row"><span>正式 LAN 成员</span><span></span><strong>${escapeHtml(setup.lan.members.join(', '))}</strong></div><div class="resource-row"><span>LAN 桥</span><span></span><strong>${escapeHtml(setup.lan.bridge)}</strong></div><div class="resource-row"><span>IPv4 CIDR</span><span></span><strong>${escapeHtml(setup.lan.ipv4Cidr)}</strong></div><div class="resource-row"><span>ULA 前缀</span><span></span><strong>${escapeHtml(setup.lan.ulaPrefix)}</strong></div></div>`)}
      ${panel('配置校验结果', `<div class="panel-content pad">${setup.validation.checkedAt ? errors.length ? `<div class="notice danger"><span>!</span><div><strong>发现 ${errors.length} 个问题</strong><p>${errors.map(escapeHtml).join('；')}</p></div></div>` : '<div class="notice"><span>✓</span><div><strong>配置校验通过</strong><p>端口分配、WAN ID、MAC、VLAN、IPv4 CIDR 和 ULA 引用完整。</p></div></div>' : '<div class="empty-state"><span>✓</span><strong>等待运行配置校验</strong><p>校验只检查浏览器中的模拟配置。</p></div>'}<button class="button primary" type="button" data-run-validation>运行配置校验</button></div>`)}
    </div>
    ${setupActions({ nextLabel: '进入模拟应用', nextDisabled: !setup.validation.valid })}`);
}

function applyLogs(apply) {
  return `<div class="setup-console apply-console"><span>linehub-apply --preview</span>${apply.logs.length ? `\n${apply.logs.map((line) => escapeHtml(line)).join('\n')}` : '\n等待应用最终配置...'}</div>`;
}

function stepApply() {
  const setup = onboarding();
  const apply = setup.apply;
  const remaining = apply.deadline ? Math.max(0, Math.ceil((apply.deadline - Date.now()) / 1000)) : 60;
  let control = '';
  if (apply.status === 'idle' || apply.status === 'rolledback') {
    control = `<div class="apply-choice"><label class="selected"><input type="radio" name="applyOutcome" value="success" checked><span>✓</span><div><strong>模拟连接成功</strong><p>应用后进入 60 秒确认窗口。</p></div></label><label><input type="radio" name="applyOutcome" value="failure"><span>!</span><div><strong>模拟连接失败</strong><p>演示连通性失败和自动回滚。</p></div></label></div><button class="button primary" type="button" data-start-apply>模拟应用配置</button>`;
  } else if (apply.status === 'awaiting-confirmation') {
    control = `<div class="countdown-card"><div class="countdown-ring" style="--remaining:${remaining}"><strong id="setup-countdown">${remaining}</strong><span>秒</span></div><div><h3>新 LAN 已临时生效</h3><p>请确认当前浏览器仍可访问 ${escapeHtml(setup.lan.ipv4Cidr)}。超时未确认将自动恢复 ${escapeHtml(setup.managementPort)} 临时管理口。</p><div class="button-row"><button class="button primary" type="button" data-confirm-apply>确认连接并保存配置</button><button class="button danger subtle" type="button" data-simulate-loss>模拟连接失败</button><button class="button" type="button" data-rollback>立即回滚</button></div></div></div>`;
  } else if (apply.status === 'failed') {
    control = `<div class="notice danger"><span>!</span><div><strong>模拟连通性检查失败</strong><p>无法通过正式 LAN 访问管理页面，系统将在 3 秒内自动回滚。</p></div></div><button class="button" type="button" data-rollback>立即执行回滚</button>`;
  } else if (apply.status === 'confirmed') {
    control = '<div class="notice"><span>✓</span><div><strong>配置已确认并保存</strong><p>LineHub OS 即将进入正常管理控制台。</p></div></div>';
  }
  return setupShell(`${setupTitle(8, '应用与连通性检查', '模拟应用端口角色、LAN 桥和 WAN 会话；通过 60 秒确认窗口保护管理连接。', statusBadge(apply.status === 'awaiting-confirmation' ? 'warning' : apply.status === 'confirmed' ? 'online' : apply.status === 'failed' ? 'fault' : 'dialing', { idle: '等待应用', rolledback: '已回滚', 'awaiting-confirmation': '等待确认', failed: '连接失败', confirmed: '已保存' }[apply.status] || apply.status))}
    ${topology(setup)}
    <div class="apply-workspace"><section><h2>配置应用</h2>${control}</section><section><h2>模拟执行日志</h2>${applyLogs(apply)}</section></div>
    ${apply.status === 'idle' || apply.status === 'rolledback' ? setupActions({ next: false }) : ''}`);
}

function serializeForm(form, existing) {
  const data = new FormData(form);
  const result = { ...existing };
  for (const [key, value] of data.entries()) {
    if (/password/i.test(key)) continue;
    if (['accounts', 'sessionMacs', 'sessionWeights', 'sessionIpv4', 'sessionIpv6', 'vlanIds', 'vlanAccounts', 'vlanMacs', 'vlanWeights', 'vlanIpv4', 'vlanIpv6'].includes(key)) continue;
    result[key] = value;
  }
  ['ipv4', 'ipv6', 'requestPd', 'autoRedial'].forEach((key) => { result[key] = data.get(key) === 'on'; });
  result.weight = Math.min(100, Math.max(1, Number(data.get('weight')) || 1));
  result.mtu = Number(data.get('mtu')) || 1500;
  result.mru = Number(data.get('mru')) || 1492;
  result.secretConfigured = existing.secretConfigured || Boolean(data.get('password'));
  return result;
}

function mountWizard(root) {
  const setup = onboarding();
  let countdownTimer = null;
  let failureTimer = null;
  root.querySelectorAll('[data-setup-step]').forEach((button) => button.addEventListener('click', () => setStep(Number(button.dataset.setupStep))));
  root.querySelector('[data-setup-back]')?.addEventListener('click', () => setStep(setup.step - 1));
  root.querySelector('[data-setup-next]')?.addEventListener('click', () => setStep(setup.step + 1));

  root.querySelector('[data-detect-hardware]')?.addEventListener('click', () => {
    mutate((state) => { state.onboarding.hardwareDetected = true; }, { source: 'setup' });
    toast('检测到 3 张物理网卡和 8 个物理网口。');
  });
  root.querySelector('[data-discover-ports]')?.addEventListener('click', () => {
    mutate((state) => { state.onboarding.portsDiscovered = true; }, { source: 'setup' });
    toast('物理网口、介质和光模块信息发现完成。');
  });

  root.querySelector('#management-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const portName = new FormData(event.currentTarget).get('managementPort');
    if (!portName) return toast('请选择一个已插线的临时管理口。', 'error');
    mutate((state) => {
      state.onboarding.managementPort = portName;
      state.physicalPorts.forEach((port) => { port.management = port.name === portName; port.role = port.name === portName ? 'temporary-management' : port.role === 'temporary-management' ? 'unassigned' : port.role; });
      state.onboarding.step = 4; state.onboarding.maxStep = Math.max(state.onboarding.maxStep, 4);
    }, { source: 'setup' });
    toast(`${portName} 已确认为临时管理口。`);
  });

  const lanForm = root.querySelector('#lan-setup-form');
  if (lanForm) {
    const preview = lanForm.querySelector('#lan-setup-preview');
    const updatePreview = () => {
      const data = new FormData(lanForm);
      preview.textContent = `bridge ${data.get('bridge')}\n  members: ${data.getAll('lanMembers').join(', ') || '(未选择)'}\n  ipv4_cidr: ${data.get('ipv4Cidr')}\n  ula_prefix: ${data.get('ulaPrefix')}\n  dhcp: ${data.get('dhcp') === 'on' ? 'enabled' : 'disabled'}\n  ra/dhcpv6: ${data.get('ra') === 'on' ? 'on' : 'off'} / ${data.get('dhcpv6') === 'on' ? 'on' : 'off'}`;
    };
    lanForm.addEventListener('input', updatePreview); updatePreview();
    lanForm.addEventListener('submit', (event) => {
      event.preventDefault(); const data = new FormData(lanForm); const members = data.getAll('lanMembers');
      if (!members.length) return toast('至少选择一个正式 LAN 成员端口。', 'error');
      const ipv4Cidr = String(data.get('ipv4Cidr')); const ula = String(data.get('ulaPrefix'));
      if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(ipv4Cidr) || !/^fd[0-9a-f]{2}:/i.test(ula)) return toast('IPv4 CIDR 或 RFC4193 ULA 前缀格式无效。', 'error');
      mutate((state) => {
        Object.assign(state.onboarding.lan, { members, bridge: data.get('bridge'), ipv4Cidr, ulaPrefix: ula, mtu: Number(data.get('mtu')) || 1500, poolStart: data.get('poolStart'), poolEnd: data.get('poolEnd'), dns: data.get('dns'), dhcp: data.get('dhcp') === 'on', ra: data.get('ra') === 'on', dhcpv6: data.get('dhcpv6') === 'on' });
        state.onboarding.step = 5; state.onboarding.maxStep = Math.max(state.onboarding.maxStep, 5);
      }, { source: 'setup' });
      toast('正式 LAN 配置已保存。');
    });
  }

  root.querySelector('#wan-port-form')?.addEventListener('submit', (event) => {
    event.preventDefault(); const selected = new FormData(event.currentTarget).getAll('wanPorts');
    if (!selected.length) return toast('至少选择一个 WAN 物理接口。', 'error');
    if (selected.includes(setup.managementPort) && !setup.lan.members.includes(setup.managementPort)) return toast('当前临时管理口不能直接改为 WAN，请先回到上一步选择新的正式 LAN 管理口。', 'error');
    mutate((state) => {
      state.onboarding.selectedWanPorts = selected;
      selected.forEach((name) => { state.onboarding.wanConfigs[name] ||= defaultWanConfig(name); });
      Object.keys(state.onboarding.wanConfigs).forEach((name) => { if (!selected.includes(name)) delete state.onboarding.wanConfigs[name]; });
      state.onboarding.activeWanPort = selected[0]; state.onboarding.step = 6; state.onboarding.maxStep = Math.max(state.onboarding.maxStep, 6);
    }, { source: 'setup' });
    toast(`已选择 ${selected.length} 个 WAN 接口。`);
  });

  root.querySelectorAll('[data-wan-port-tab]').forEach((button) => button.addEventListener('click', () => mutate((state) => { state.onboarding.activeWanPort = button.dataset.wanPortTab; }, { source: 'setup' })));
  const wanForm = root.querySelector('#wan-setup-form');
  if (wanForm) {
    const portName = wanForm.dataset.port;
    wanForm.querySelector('[name="type"]').addEventListener('change', (event) => mutate((state) => {
      const current = state.onboarding.wanConfigs[portName] || defaultWanConfig(portName);
      state.onboarding.wanConfigs[portName] = { ...current, type: event.target.value, saved: false };
    }, { source: 'setup' }));
    wanForm.querySelector('[name="vlanProtocol"]')?.addEventListener('change', (event) => mutate((state) => { state.onboarding.wanConfigs[portName].vlanProtocol = event.target.value; state.onboarding.wanConfigs[portName].saved = false; }, { source: 'setup' }));
    wanForm.querySelector('[data-refresh-multidial]')?.addEventListener('click', () => {
      const count = Math.min(12, Math.max(2, Number(wanForm.querySelector('[name="dialCount"]').value) || 3));
      mutate((state) => { state.onboarding.wanConfigs[portName].dialCount = count; state.onboarding.wanConfigs[portName].saved = false; }, { source: 'setup' });
    });
    const vlanSessionList = wanForm.querySelector('[data-vlan-session-list]');
    const appendVlanSession = (row = {}) => {
      const current = getState().onboarding.wanConfigs[portName];
      const index = vlanSessionList.children.length;
      const usedMacs = new Set([...vlanSessionList.querySelectorAll('[name="vlanMacs"]')].map((input) => input.value.toLowerCase()));
      let suffix = 1;
      while (usedMacs.has(`02:4c:48:ef:${String(suffix).padStart(2, '0')}:01`)) suffix += 1;
      vlanSessionList.insertAdjacentHTML('beforeend', vlanSessionRow({ vlan: 101, ipv4: true, ipv6: true, weight: 1, mac: `02:4c:48:ef:${String(suffix).padStart(2, '0')}:01`, ...row }, index, current, portName));
      refreshVlanSessionLabels(wanForm, current, portName);
    };
    wanForm.querySelector('[data-add-vlan-session]')?.addEventListener('click', () => appendVlanSession({ vlan: Math.min(4094, 101 + vlanSessionList.children.length * 2) }));
    wanForm.querySelector('[data-load-demo-vlans]')?.addEventListener('click', () => {
      const current = getState().onboarding.wanConfigs[portName];
      vlanSessionList.innerHTML = demoVlanSessions().map((row, index) => vlanSessionRow(row, index, current, portName)).join('');
      refreshVlanSessionLabels(wanForm, current, portName);
      toast('已载入 6 个演示 VLAN，请为每条记录输入拨号密码。', 'info');
    });
    vlanSessionList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-vlan-session]');
      if (!button) return;
      if (vlanSessionList.children.length === 1) return toast('至少保留一条 VLAN 拨号记录。', 'error');
      button.closest('[data-vlan-session-row]').remove();
      refreshVlanSessionLabels(wanForm, getState().onboarding.wanConfigs[portName], portName);
    });
    wanForm.addEventListener('input', (event) => {
      if (vlanSessionList && ['vlanIds', 'wanId'].includes(event.target.name)) refreshVlanSessionLabels(wanForm, getState().onboarding.wanConfigs[portName], portName);
      if (event.target.name === 'vlanId' || event.target.name === 'username' || event.target.name === 'wanId') {
        const vlan = Number(wanForm.querySelector('[name="vlanId"]')?.value) || 0;
        const account = wanForm.querySelector('[name="username"]')?.value.trim();
        wanForm.querySelectorAll('[data-single-vlan-ifname]').forEach((node) => { node.textContent = vlan ? `${portName}.${vlan}` : `${portName}.?`; });
        const session = wanForm.querySelector('[data-single-vlan-session]');
        if (session) session.textContent = account ? `PPPoE · ${maskAccount(account)}` : 'PPPoE · 等待输入账号';
        const wanId = wanForm.querySelector('[data-single-vlan-wan-id]');
        if (wanId) wanId.textContent = wanForm.querySelector('[name="wanId"]')?.value.trim() || '等待输入 WAN ID';
      }
    });
    wanForm.querySelector('[data-preview-vlan]')?.addEventListener('click', () => {
      const current = getState().onboarding.wanConfigs[portName];
      const draft = serializeForm(wanForm, current);
      const rows = collectVlanSessions(wanForm, draft, portName);
      wanForm.querySelector('#vlan-multi-preview').innerHTML = vlanMultiPreview(rows);
      const invalid = rows.filter((row) => row.errors.length).length;
      toast(invalid ? `拨号预览发现 ${invalid} 条错误记录。` : `${rows.length} 条 VLAN PPPoE 拨号记录校验通过。`, invalid ? 'error' : 'success');
    });
    wanForm.addEventListener('submit', (event) => {
      event.preventDefault(); const current = getState().onboarding.wanConfigs[portName]; const data = new FormData(wanForm); const draft = serializeForm(wanForm, current);
      if (draft.type === 'multidial') {
        const accounts = data.getAll('accounts'); const macs = data.getAll('sessionMacs'); const weights = data.getAll('sessionWeights');
        draft.sessions = accounts.map((account, index) => ({ id: `${draft.wanId}-${String(index + 1).padStart(2, '0')}`, account, secretConfigured: true, mac: macs[index], weight: Number(weights[index]) || 1, ipv4: data.getAll('sessionIpv4').includes(String(index)), ipv6: data.getAll('sessionIpv6').includes(String(index)), errors: [] }));
        if (new Set(macs.map((mac) => mac.toLowerCase())).size !== macs.length) return toast('单线多拨存在重复 MAC。', 'error');
      }
      if (draft.type === 'vlan') { draft.vlanId = Number(data.get('vlanId')); draft.vlanIfname = `${portName}.${draft.vlanId}`; }
      if (draft.type === 'vlan-multidial') {
        draft.generatedSessions = collectVlanSessions(wanForm, draft, portName);
        if (!draft.generatedSessions.length) return toast('至少添加一条 VLAN PPPoE 拨号记录。', 'error');
        if (draft.generatedSessions.some((row) => row.errors?.length)) return toast('VLAN 单线多拨预览存在错误行，请修正后保存。', 'error');
      }
      draft.saved = true;
      mutate((state) => { state.onboarding.wanConfigs[portName] = draft; }, { source: 'setup' });
      toast(`${portName} WAN 配置已保存，密码明文已丢弃。`);
    });
    root.querySelector('[data-wan-finish]')?.addEventListener('click', () => setStep(7));
  }

  root.querySelector('[data-run-validation]')?.addEventListener('click', () => {
    const errors = validateSetup();
    mutate((state) => { state.onboarding.validation = { valid: errors.length === 0, errors, checkedAt: new Date().toISOString() }; }, { source: 'setup' });
    toast(errors.length ? `配置校验发现 ${errors.length} 个问题。` : '配置校验通过。', errors.length ? 'error' : 'success');
  });

  root.querySelector('[data-start-apply]')?.addEventListener('click', () => {
    const outcome = root.querySelector('[name="applyOutcome"]:checked')?.value || 'success';
    const now = Date.now();
    mutate((state) => {
      state.onboarding.apply = outcome === 'success'
        ? { status: 'awaiting-confirmation', deadline: now + 60000, outcome, logs: ['[ OK ] configuration validation passed', '[ OK ] temporary LAN bridge created', '[ OK ] physical port roles staged', '[ OK ] WAN logical interfaces created', '[ OK ] connectivity probe succeeded', '[WAIT] confirmation required within 60 seconds'] }
        : { status: 'failed', deadline: null, outcome, logs: ['[ OK ] configuration validation passed', '[ OK ] temporary LAN bridge created', '[FAIL] management connectivity probe timed out', '[WAIT] automatic rollback scheduled'] };
    }, { source: 'setup' });
    toast(outcome === 'success' ? '模拟配置已临时应用，请在 60 秒内确认。' : '模拟连接失败，即将自动回滚。', outcome === 'success' ? 'info' : 'error');
  });

  const rollback = (reason = 'manual') => mutate((state) => {
    state.onboarding.apply = { status: 'rolledback', deadline: null, outcome: reason, logs: [...state.onboarding.apply.logs, '[ROLLBACK] restored temporary management port', '[ OK ] browser access recovered'] };
  }, { source: 'setup' });
  root.querySelector('[data-rollback]')?.addEventListener('click', () => { rollback('manual'); toast('已恢复临时管理口和应用前配置。', 'info'); });
  root.querySelector('[data-simulate-loss]')?.addEventListener('click', () => mutate((state) => { state.onboarding.apply.status = 'failed'; state.onboarding.apply.deadline = null; state.onboarding.apply.logs.push('[FAIL] management client heartbeat lost', '[WAIT] automatic rollback scheduled'); }, { source: 'setup' }));
  root.querySelector('[data-confirm-apply]')?.addEventListener('click', () => {
    mutate((state) => {
      const setupState = state.onboarding;
      state.systemStatus = 'configured';
      setupState.apply.status = 'confirmed'; setupState.apply.deadline = null; setupState.apply.logs.push('[CONFIRMED] management connection acknowledged', '[SAVED] configuration persisted');
      const newManagement = setupState.lan.members[0];
      state.physicalPorts.forEach((port) => {
        port.management = port.name === newManagement;
        port.role = setupState.lan.members.includes(port.name) ? 'lan' : setupState.selectedWanPorts.includes(port.name) ? 'wan' : 'unassigned';
      });
      Object.assign(state.settings, setupState.lan);
    }, { source: 'setup-complete' });
    navigate('overview/runtime');
    toast('首次配置已确认，正在进入管理控制台。');
  });

  if (setup.apply.status === 'awaiting-confirmation' && setup.apply.deadline) {
    countdownTimer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((getState().onboarding.apply.deadline - Date.now()) / 1000));
      const node = document.querySelector('#setup-countdown'); if (node) node.textContent = String(remaining);
      if (remaining <= 0) { window.clearInterval(countdownTimer); rollback('timeout'); toast('60 秒内未确认，已自动回滚。', 'error'); }
    }, 250);
  }
  if (setup.apply.status === 'failed') failureTimer = window.setTimeout(() => { rollback('connectivity-failure'); toast('连通性检查失败，已自动回滚。', 'error'); }, 3000);
  return () => { if (countdownTimer) window.clearInterval(countdownTimer); if (failureTimer) window.clearTimeout(failureTimer); };
}

export function renderSetup() {
  const step = onboarding().step;
  const html = step === 1 ? stepHardware() : step === 2 ? stepPorts() : step === 3 ? stepManagement()
    : step === 4 ? stepLan() : step === 5 ? stepWanPorts() : step === 6 ? stepWanConfig()
      : step === 7 ? stepPreview() : stepApply();
  return { html, mount: mountWizard };
}
