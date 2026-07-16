import { getState, mutate } from '../store.js';
import { escapeHtml, field, formActions, input, pageHeader, panel, select, toast } from '../components.js';
import { interfaceTable, openInterfaceStatus, renderInterfaceSelector, renderInterfaceStatusBar, selectedInterfaces } from '../interface-selector.js';

function mountStatusBar(root) {
  root.querySelectorAll('[data-view-interfaces]').forEach((button) => button.addEventListener('click', () => openInterfaceStatus(getState())));
}

function lanPage() {
  const state = getState();
  const bridge = state.lanBridges[0];
  const members = bridge?.members || [];
  const form = `<form id="lan-settings-form" class="configuration-form">
    <div class="form-grid cols-3">
      ${field('LAN 名称', input('bridgeName', bridge?.name || 'br-lan', { required: true }))}
      ${field('IPv4 地址', input('ipv4Cidr', bridge?.ipv4Cidr || '192.168.100.1/24', { required: true }))}
      ${field('IPv6 ULA', input('ulaPrefix', bridge?.ulaPrefix || 'fd42:4c69:6e65::/48', { required: true }))}
    </div>
    <section class="form-section"><header><div><h3>成员网口</h3><p>支持多选；独占 WAN 不可直接加入，当前管理连接保持高亮。</p></div><span>加入 ${escapeHtml(bridge?.name || 'br-lan')}</span></header>${renderInterfaceSelector({ state, context: 'lan', name: 'members', selected: members, multiple: true })}<div class="selected-interface-list" data-selected-list>${selectedInterfaces(state, members)}</div></section>
    <div class="form-grid cols-3">
      ${field('DHCP', select('dhcp', [['on', '开启'], ['off', '关闭']], bridge?.dhcp ? 'on' : 'off'))}
      ${field('DHCP 起始地址', input('poolStart', bridge?.poolStart || '192.168.100.100'))}
      ${field('DHCP 结束地址', input('poolEnd', bridge?.poolEnd || '192.168.100.250'))}
      ${field('IPv6 RA', select('ra', [['on', '开启'], ['off', '关闭']], bridge?.ra ? 'on' : 'off'))}
      ${field('DHCPv6', select('dhcpv6', [['on', '开启'], ['off', '关闭']], bridge?.dhcpv6 ? 'on' : 'off'))}
      ${field('MTU', input('mtu', bridge?.mtu || 1500, { type: 'number', min: 1280, max: 9000 }))}
    </div>${formActions('保存并应用', '放弃修改')}
  </form>`;
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('LAN 设置', '选择成员接口并配置 br-lan 地址服务；无需先进入物理网卡页面。')}${panel('LAN 配置', form, { subtitle: '模拟保存仅写入浏览器 localStorage' })}</div>`,
    mount(root) {
      mountStatusBar(root);
      const formNode = root.querySelector('#lan-settings-form');
      const updateSelected = () => {
        const names = [...formNode.querySelectorAll('input[name="members"]:checked')].map((item) => item.value);
        root.querySelector('[data-selected-list]').innerHTML = selectedInterfaces(getState(), names) || '<span class="selection-empty">尚未选择 LAN 成员接口</span>';
        root.querySelectorAll('[data-remove-interface]').forEach((button) => button.addEventListener('click', () => {
          const inputNode = formNode.querySelector(`input[name="members"][value="${CSS.escape(button.dataset.removeInterface)}"]`);
          if (inputNode) inputNode.checked = false;
          updateSelected();
        }));
      };
      formNode.querySelectorAll('input[name="members"]').forEach((inputNode) => inputNode.addEventListener('change', updateSelected));
      updateSelected();
      formNode.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(formNode);
        const selected = data.getAll('members');
        if (!selected.length) { toast('至少选择一个 LAN 成员接口。', 'error'); return; }
        mutate((draft) => {
          const next = {
            id: draft.lanBridges[0]?.id || 'lan-main', name: data.get('bridgeName'), members: selected,
            ipv4Cidr: data.get('ipv4Cidr'), ulaPrefix: data.get('ulaPrefix'), dhcp: data.get('dhcp') === 'on',
            poolStart: data.get('poolStart'), poolEnd: data.get('poolEnd'), ra: data.get('ra') === 'on', dhcpv6: data.get('dhcpv6') === 'on', mtu: Number(data.get('mtu')) || 1500
          };
          draft.lanBridges = [next];
          draft.settings = { ...draft.settings, lanIfname: next.name, ipv4Cidr: next.ipv4Cidr, ulaPrefix: next.ulaPrefix, dhcp: next.dhcp, ra: next.ra, dhcpv6: next.dhcpv6, mtu: next.mtu };
          draft.physicalPorts.forEach((port) => {
            if (port.role === 'lan' && !selected.includes(port.name)) port.role = 'unassigned';
            if (selected.includes(port.name) && !port.management) port.role = 'lan';
          });
        }, { source: 'network-lan' });
        toast('LAN 模拟配置已保存。');
      });
    }
  };
}

function vlanPage() {
  const state = getState();
  const rows = state.vlans.slice(0, 8);
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('VLAN 设置', '选择可承载 VLAN 的物理父接口，再创建逻辑接口。', '<button class="button primary" type="button" data-focus-vlan>创建 VLAN</button>')}<div class="two-column-config"><section class="panel"><header class="panel-header"><div><h2>新增 VLAN</h2><p>已作为 VLAN 父接口的网口可继续复用</p></div></header><div class="panel-content"><form id="vlan-form" class="configuration-form">${field('父接口', renderInterfaceSelector({ state, context: 'vlan', name: 'parent', selected: 'eth6', showAll: true }))}<div class="form-grid">${field('VLAN ID', input('vlanId', 101, { type: 'number', min: 1, max: 4094, required: true }))}${field('用途', select('purpose', [['wan', 'WAN 接入'], ['lan', 'LAN 隔离'], ['trunk', '中继']], 'wan'))}</div>${formActions('创建逻辑接口')}</form></div></section>${panel('现有 VLAN', `<div class="compact-table-wrap"><table class="data-table"><thead><tr><th>接口</th><th>父接口</th><th>用途</th><th>会话</th></tr></thead><tbody>${rows.map((vlan) => `<tr><td class="mono">${escapeHtml(vlan.ifname)}</td><td class="mono">${escapeHtml(vlan.parent)}</td><td>${escapeHtml(vlan.role)}</td><td>${vlan.sessions}</td></tr>`).join('')}</tbody></table></div>`, { subtitle: `共 ${state.vlans.length} 个逻辑 VLAN` })}</div></div>`,
    mount(root) {
      mountStatusBar(root);
      root.querySelector('[data-focus-vlan]').addEventListener('click', () => root.querySelector('#vlan-form select').focus());
      root.querySelector('#vlan-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const parent = String(data.get('parent') || '');
        const id = Number(data.get('vlanId'));
        if (!parent || id < 1 || id > 4094) { toast('请选择父接口并输入 1–4094 的 VLAN ID。', 'error'); return; }
        if (getState().vlans.some((vlan) => vlan.parent === parent && vlan.id === id)) { toast('该 VLAN 子接口已存在。', 'error'); return; }
        mutate((draft) => {
          draft.vlans.push({ id, parent, ifname: `${parent}.${id}`, enabled: true, role: data.get('purpose') === 'wan' ? 'WAN 接入' : data.get('purpose') === 'lan' ? 'LAN 隔离' : '中继', sessions: 0, rx: 0, tx: 0 });
          const port = draft.physicalPorts.find((item) => item.name === parent);
          if (port) { port.role = 'vlan-parent'; port.vlanSummary = { vlans: draft.vlans.filter((vlan) => vlan.parent === parent).length, sessions: draft.pppoeSessions.filter((session) => (session.parentInterface || session.parent) === parent).length }; }
        }, { source: 'network-vlan' });
        toast(`已模拟创建 ${parent}.${id}。`);
      });
    }
  };
}

function dhcpPage() {
  const state = getState();
  const bridge = state.lanBridges[0];
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('DHCP', '管理 LAN 地址池与租约策略。')}${panel('地址池', `<form id="dhcp-form" class="configuration-form"><div class="form-grid cols-3">${field('服务状态', select('enabled', [['on', '开启'], ['off', '关闭']], bridge?.dhcp ? 'on' : 'off'))}${field('起始地址', input('start', bridge?.poolStart || '192.168.100.100'))}${field('结束地址', input('end', bridge?.poolEnd || '192.168.100.250'))}${field('租期', select('lease', [['12h', '12 小时'], ['24h', '24 小时'], ['7d', '7 天']], '12h'))}${field('网关', input('gateway', bridge?.ipv4Cidr?.split('/')[0] || '192.168.100.1'))}${field('DNS', input('dns', state.settings.dns.split(',')[0]))}</div>${formActions('保存 DHCP 设置')}</form>`, { subtitle: bridge?.name || 'br-lan' })}</div>`,
    mount(root) { mountStatusBar(root); root.querySelector('#dhcp-form').addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutate((draft) => { draft.lanBridges[0].dhcp = data.get('enabled') === 'on'; draft.lanBridges[0].poolStart = data.get('start'); draft.lanBridges[0].poolEnd = data.get('end'); }, { source: 'network-dhcp' }); toast('DHCP 模拟设置已保存。'); }); }
  };
}

function dnsPage() {
  const state = getState();
  return {
    html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('DNS', '配置 LAN 客户端使用的本地与上游解析器。')}${panel('DNS 服务', `<form id="dns-form" class="configuration-form"><div class="form-grid">${field('本地 DNS', input('localDns', '192.168.100.1'))}${field('上游 IPv4 DNS', input('upstream4', '223.5.5.5, 119.29.29.29'))}${field('上游 IPv6 DNS', input('upstream6', '2400:3200::1'))}${field('缓存大小', input('cache', 4096, { type: 'number', min: 0, max: 65535 }))}</div>${formActions('保存 DNS 设置')}</form>`)}</div>`,
    mount(root) { mountStatusBar(root); root.querySelector('#dns-form').addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutate((draft) => { draft.settings.dns = `${data.get('upstream4')}, ${data.get('upstream6')}`; }, { source: 'network-dns' }); toast('DNS 模拟设置已保存。'); }); }
  };
}

function interfacesPage() {
  const state = getState();
  return { html: `<div class="function-page">${renderInterfaceStatusBar(state)}${pageHeader('接口状态', '紧凑查看链路、速率与角色；这里不展示大型物理端口卡片。')}${panel('物理接口', interfaceTable(state), { subtitle: '硬件型号、PCI 与驱动信息位于“系统 → 硬件信息”' })}</div>`, mount(root) { mountStatusBar(root); root.querySelectorAll('[data-interface-detail]').forEach((button) => button.addEventListener('click', () => openInterfaceStatus(getState()))); } };
}

export function renderNetwork(route) {
  if (route === 'network/vlans') return vlanPage();
  if (route === 'network/dhcp') return dhcpPage();
  if (route === 'network/dns') return dnsPage();
  if (route === 'network/interfaces') return interfacesPage();
  return lanPage();
}
