export const UI_VERSION = 'pppoe-session-editor-v2';
export const DEFAULT_ROUTE = 'network/lan';

export const menuGroups = [
  { id: 'overview', label: '概况', icon: '概', route: 'overview/runtime', children: [['overview/runtime', '运行概况'], ['overview/topology', '网络拓扑'], ['overview/alerts', '告警']] },
  { id: 'network', label: '网络', icon: '网', route: 'network/lan', children: [['network/lan', 'LAN'], ['network/vlans', 'VLAN'], ['network/dhcp', 'DHCP'], ['network/dns', 'DNS'], ['network/interfaces', '接口状态']] },
  { id: 'lines', label: '线路', icon: '线', route: 'lines/wans', children: [['lines/wans', 'WAN线路'], ['lines/add', '新增线路'], ['lines/multidial', '单线多拨'], ['lines/vlan-dial', 'VLAN拨号'], ['lines/vlan-multidial', 'VLAN单线多拨'], ['lines/logs', '拨号日志']] },
  { id: 'multi', label: '多线', icon: '多', route: 'multi/pools', children: [['multi/pools', '线路池'], ['multi/balancing', '负载均衡'], ['multi/failover', '故障切换'], ['multi/health', '健康检查']] },
  { id: 'dual-stack', label: '双栈汇聚', icon: '双', route: 'dual-stack/overview', children: [['dual-stack/overview', '双栈总览'], ['dual-stack/ipv4-pool', 'IPv4 出口池'], ['dual-stack/ipv6-pool', 'IPv6 出口池'], ['dual-stack/translations', '地址转换'], ['dual-stack/servers', '服务器绑定'], ['dual-stack/sessions', '会话监控'], ['dual-stack/failover', '故障切换']] },
  { id: 'ipv6', label: 'IPv6', icon: '6', route: 'ipv6/overview', children: [['ipv6/overview', 'IPv6 总览'], ['ipv6/prefixes', '前缀'], ['ipv6/lan', 'LAN IPv6'], ['ipv6/policies', '策略']] },
  { id: 'servers', label: '服务器', icon: '服', route: 'servers/list', children: [['servers/list', '服务器列表'], ['servers/addresses', '地址分配'], ['servers/egress', '出口策略'], ['servers/monitoring', '监控']] },
  { id: 'security', label: '安全', icon: '安', route: 'security/firewall', children: [['security/firewall', '防火墙'], ['security/nat', 'NAT'], ['security/access', '访问控制'], ['security/mappings', '端口映射']] },
  { id: 'diagnostics', label: '诊断', icon: '诊', route: 'diagnostics/tools', children: [['diagnostics/tools', '诊断工具'], ['diagnostics/interfaces', '接口统计'], ['diagnostics/routes', '路由'], ['diagnostics/logs', '日志']] },
  { id: 'system', label: '系统', icon: '系', route: 'system/basic', children: [['system/basic', '基本设置'], ['system/hardware', '硬件信息'], ['system/backup', '备份恢复'], ['system/update', '软件更新'], ['system/logs', '系统日志']] }
];

const routeAliases = new Map([
  ['ports/physical', 'network/lan'], ['ports/lan', 'network/lan'], ['ports/vlans', 'network/vlans'], ['ports/dhcp', 'network/dhcp'],
  ['wans/list', 'lines/wans'], ['wans/add', 'lines/add'], ['wans/import', 'lines/multidial'], ['wans/logs', 'lines/logs'],
  ['lines/status', 'lines/wans'], ['lines/batch', 'lines/multidial'], ['lines/vlan-pppoe', 'lines/vlan-dial'],
  ['aggregation/pools', 'multi/pools'], ['aggregation/balancing', 'multi/balancing'], ['aggregation/failover', 'multi/failover'], ['aggregation/health', 'multi/health'],
  ['firewall/nat', 'security/nat'], ['firewall/access', 'security/access'], ['firewall/ports', 'security/mappings'],
  ['overview/resources', 'overview/runtime']
]);

const allRoutes = new Set(menuGroups.flatMap((group) => group.children.map(([route]) => route)));
const routeListeners = new Set();
const interfaceVersionKey = 'linehub-preview-interface-version';
const currentRouteKey = 'linehub-preview-current-route';

function rawHashRoute() {
  return window.location.hash.replace(/^#\/?/, '');
}

function normalizeRoute(route) {
  const migrated = routeAliases.get(route) || route;
  return allRoutes.has(migrated) ? migrated : DEFAULT_ROUTE;
}

export function currentRoute() {
  return normalizeRoute(rawHashRoute());
}

export function navigate(route) {
  window.location.hash = `#/${normalizeRoute(route)}`;
}

export function routeMeta(route = currentRoute()) {
  const normalized = normalizeRoute(route);
  for (const group of menuGroups) {
    const child = group.children.find(([childRoute]) => childRoute === normalized);
    if (child) return { groupId: group.id, group: group.label, route: child[0], page: child[1], tabs: group.children };
  }
  return { groupId: 'network', group: '网络', route: DEFAULT_ROUTE, page: 'LAN', tabs: menuGroups.find((group) => group.id === 'network').children };
}

export function startRouter(listener) {
  routeListeners.add(listener);
  const notify = () => {
    const route = currentRoute();
    window.localStorage.setItem(currentRouteKey, route);
    routeListeners.forEach((routeListener) => routeListener(route));
  };
  window.addEventListener('hashchange', notify);

  const savedVersion = window.localStorage.getItem(interfaceVersionKey);
  const explicitRoute = rawHashRoute();
  const requested = explicitRoute || window.localStorage.getItem(currentRouteKey) || '';
  const route = normalizeRoute(requested);
  if (savedVersion !== UI_VERSION) {
    const initialRoute = explicitRoute ? route : DEFAULT_ROUTE;
    window.localStorage.setItem(interfaceVersionKey, UI_VERSION);
    window.localStorage.setItem(currentRouteKey, initialRoute);
    window.history.replaceState(null, '', `#/${initialRoute}`);
  } else if (!rawHashRoute() || requested !== route) {
    window.history.replaceState(null, '', `#/${route}`);
  }
  notify();
  return () => {
    routeListeners.delete(listener);
    window.removeEventListener('hashchange', notify);
  };
}
