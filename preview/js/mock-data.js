import { createDualStackData } from './dual-stack-data.js';

export const STORE_VERSION = 9;

const statusPlan = [
  ['online', ''], ['online', ''], ['dialing', ''], ['fault', 'PPPoE 认证失败'],
  ['online', '高延迟'], ['online', '丢包'], ['disabled', ''], ['online', 'IPv6-PD 获取失败'],
  ['online', ''], ['fault', '接口断开'], ['online', ''], ['dialing', ''],
  ['online', ''], ['online', ''], ['disabled', ''], ['fault', 'PPPoE 认证失败'],
  ['online', '高延迟'], ['online', ''], ['dialing', ''], ['online', '丢包'],
  ['online', ''], ['disabled', ''], ['online', 'IPv6-PD 获取失败'], ['online', '']
];

const lineNames = [
  '城域北区 A', '城域北区 B', '联通商务 01', '电信商务 01', '移动专线 A', '移动专线 B',
  '备用接入 01', '联通商务 02', '电信商务 02', '园区西口', '园区东口', '灾备中心 A',
  '灾备中心 B', '边缘节点 01', '备用接入 02', '联通商务 03', '电信商务 03', '移动专线 C',
  '园区南口', '园区北口', '边缘节点 02', '备用接入 03', '联通商务 04', '电信商务 04'
];

const pools = ['核心出口池', '业务出口池', '灾备出口池'];

function macFor(index) {
  return `02:4c:48:${String(16 + index).padStart(2, '0')}:${String(64 + index).padStart(2, '0')}:${String(96 + index).padStart(2, '0')}`;
}

function createWanLines() {
  return statusPlan.map(([status, issue], index) => {
    const ordinal = index + 1;
    const vlanId = 101 + (index % 12);
    const parent = `eth${index % 6}`;
    const enabled = status !== 'disabled';
    const ipv4Enabled = index % 7 !== 6;
    const ipv6Enabled = index % 3 !== 1;
    const online = status === 'online';
    const pdFailed = issue === 'IPv6-PD 获取失败';
    const highLatency = issue === '高延迟';
    const packetLoss = issue === '丢包';

    return {
      id: `wan-${String(ordinal).padStart(2, '0')}`,
      name: lineNames[index],
      enabled,
      status,
      issue,
      parent,
      vlanId,
      vlanIfname: `${parent}.${vlanId}`,
      username: `linehub${String(ordinal).padStart(2, '0')}@isp.example.invalid`,
      secretConfigured: true,
      mac: macFor(index),
      ipv4Enabled,
      ipv6Enabled,
      requestPd: ipv6Enabled,
      ipv4: online && ipv4Enabled ? `192.0.2.${10 + ordinal}/32` : '--',
      gateway4: online && ipv4Enabled ? `192.0.2.${1 + (index % 3)}` : '--',
      ipv6: online && ipv6Enabled ? `fd12:3456:789a:${(index % 12) + 1}::${ordinal}/64` : '--',
      pd: online && ipv6Enabled && !pdFailed ? `fd30:${(256 + index).toString(16)}:${(512 + index).toString(16)}::/56` : '--',
      upload: online ? 2.4 + (index * 1.37) % 18 : 0,
      download: online ? 12.8 + (index * 4.91) % 96 : 0,
      latency: online ? (highLatency ? 186 : 12 + (index * 7) % 46) : 0,
      loss: online ? (packetLoss ? 8.6 : (index % 9 === 0 ? 0.8 : 0)) : 0,
      connections: online ? 164 + (index * 83) % 1450 : 0,
      weight: 1 + (index % 6),
      pool: pools[index % pools.length],
      mtu: 1492,
      mru: 1492,
      healthcheck: index % 2 ? '多目标 ICMP' : 'TCP + DNS',
      autoRedial: true,
      lastDial: `2026-07-16 ${String(8 + (index % 4)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:24`
    };
  });
}

function createInterfaces() {
  return Array.from({ length: 6 }, (_, index) => ({
    name: `eth${index}`,
    driver: index < 4 ? 'igc' : 'r8169',
    mac: `02:4c:48:00:0${index}:01`,
    link: index === 4 ? 'down' : 'up',
    speed: index < 2 ? '2.5 Gbps' : index === 4 ? '--' : '1 Gbps',
    duplex: index === 4 ? '--' : '全双工',
    mtu: 1500,
    rx: index === 4 ? 0 : 36 + index * 17,
    tx: index === 4 ? 0 : 9 + index * 8,
    errors: index === 3 ? 12 : index,
    drops: index === 3 ? 27 : index * 2,
    role: index < 4 ? 'WAN Trunk' : index === 4 ? '备用 WAN' : 'LAN'
  }));
}

function createVlans() {
  return Array.from({ length: 12 }, (_, index) => ({
    id: 101 + index,
    parent: `eth${index % 6}`,
    ifname: `eth${index % 6}.${101 + index}`,
    enabled: index !== 9,
    role: index < 9 ? 'PPPoE 接入' : index === 9 ? '备用接入' : '业务隔离',
    sessions: index < 6 ? 2 : 1,
    rx: index === 9 ? 0 : 14 + index * 6.3,
    tx: index === 9 ? 0 : 4 + index * 2.1
  }));
}

function createServers() {
  const names = ['计算节点-01', '计算节点-02', '对象存储-01', '媒体服务-01', '备份节点-01', '监控中心'];
  return names.map((name, index) => ({
    id: `server-${index + 1}`,
    name,
    mac: `02:53:52:56:0${index + 1}:10`,
    ipv4: `10.20.${index < 3 ? 10 : 20}.${20 + index}`,
    ula: `fd12:3456:789a:${index < 3 ? 10 : 20}::${20 + index}`,
    online: index !== 4,
    lan: index < 3 ? 'lan-servers' : 'lan-services',
    pool: pools[index % pools.length],
    egress: `wan-${String((index * 3) + 1).padStart(2, '0')}`,
    upload: index === 4 ? 0 : 1.8 + index * 3.2,
    download: index === 4 ? 0 : 7.5 + index * 8.1,
    connections: index === 4 ? 0 : 126 + index * 217,
    cpu: 21 + index * 9,
    disk: 42 + index * 7,
    dmz: index === 3,
    upnp: index === 3,
    maxBandwidth: 500,
    maxConnections: 5000,
    failover: '自动切换'
  }));
}

function createPolicies() {
  const names = ['办公流量优先', '视频服务出口', '对象存储分流', '访客网络限速', 'DNS 小流量优先', 'PCDN 业务抑制', '备份窗口放行', '管理网络保障'];
  return names.map((name, index) => ({
    id: `policy-${index + 1}`,
    priority: index + 1,
    enabled: index !== 5,
    name,
    match: index % 2 ? `10.20.${10 + index}.0/24` : ['HTTP/HTTPS', 'DNS', '对象存储', '管理流量'][index % 4],
    target: pools[index % pools.length],
    uploadLimit: index === 3 ? '80 Mbps' : '不限',
    downloadLimit: index === 3 ? '300 Mbps' : '不限',
    dscp: ['AF31', 'CS1', 'AF21', 'BE'][index % 4],
    hits: 12840 + index * 9321
  }));
}

function createFirewallRules() {
  const actions = ['放行', '放行', '拒绝', 'DNAT', '放行', '限速', '拒绝', '放行', 'DNAT', '放行'];
  return Array.from({ length: 10 }, (_, index) => ({
    id: `rule-${index + 1}`,
    order: index + 1,
    enabled: index !== 6,
    name: ['管理入口', '业务访问', '阻断扫描', 'Web 服务映射', 'DNS 放行', '访客限速', '阻断旧协议', '监控采集', '媒体端口映射', '默认出站'][index],
    protocol: ['TCP', 'TCP/UDP', 'TCP', 'TCP', 'UDP', 'ALL', 'TCP', 'TCP', 'TCP/UDP', 'ALL'][index],
    source: index < 2 ? '10.20.0.0/16' : index === 7 ? '10.30.10.5' : '任意',
    destination: index === 3 || index === 8 ? `192.0.2.${80 + index}` : '任意',
    sourcePort: '任意',
    destinationPort: ['8443', '443', '22-23', '443', '53', '任意', '21', '9100', '30000-30100', '任意'][index],
    inbound: index < 3 ? 'lan-servers' : index === 3 || index === 8 ? 'WAN' : '任意',
    outbound: index === 3 || index === 8 ? 'lan-services' : '任意',
    action: actions[index],
    hits: 1902 + index * 27131
  }));
}

function createLogs() {
  const levels = ['info', 'info', 'warning', 'info', 'error'];
  const modules = ['pppoe', 'healthcheck', 'firewall', 'routing', 'system'];
  const messages = [
    '线路拨号成功并加入线路池', '健康检查目标响应正常', '规则命中率高于基线',
    '策略路由表已刷新', '演示异常：接口链路断开', 'IPv6-PD 租约已更新',
    'conntrack 使用率恢复正常', '线路权重变更已生效', '服务器出口完成故障切换',
    '演示配置快照已生成'
  ];
  return Array.from({ length: 20 }, (_, index) => ({
    id: `log-${index + 1}`,
    time: `2026-07-16 ${String(11 - Math.floor(index / 6)).padStart(2, '0')}:${String(57 - (index * 3) % 58).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}`,
    level: levels[index % levels.length],
    module: modules[index % modules.length],
    message: `${messages[index % messages.length]}${index % 3 === 0 ? `（wan-${String((index % 24) + 1).padStart(2, '0')}）` : ''}`
  }));
}

function createAlerts() {
  return [
    { id: 'alert-1', severity: 'critical', source: 'wan-04', message: 'PPPoE 认证失败', time: '2 分钟前', acknowledged: false },
    { id: 'alert-2', severity: 'warning', source: 'wan-05', message: '往返延迟持续高于 150ms', time: '6 分钟前', acknowledged: false },
    { id: 'alert-3', severity: 'warning', source: 'wan-06', message: '丢包率超过 5%', time: '11 分钟前', acknowledged: false },
    { id: 'alert-4', severity: 'critical', source: 'eth3', message: '接口链路断开', time: '18 分钟前', acknowledged: false },
    { id: 'alert-5', severity: 'warning', source: '灾备出口池', message: '线路池可用容量不足', time: '26 分钟前', acknowledged: false },
    { id: 'alert-6', severity: 'info', source: 'wan-08', message: 'IPv6-PD 获取失败，计划重试', time: '31 分钟前', acknowledged: true }
  ];
}

function createHardwareCards() {
  return [
    {
      id: 'nic-i350', model: 'Intel I350-T4', pci: '0000:03:00.0', driver: 'igb',
      portCount: 4, maxSpeed: '1 Gbps', numa: 0, driverStatus: 'healthy',
      temperature: '46°C', firmware: '1.63, 0x80000f0c'
    },
    {
      id: 'nic-x520', model: 'Intel X520-DA2', pci: '0000:04:00.0', driver: 'ixgbe',
      portCount: 2, maxSpeed: '10 Gbps', numa: 0, driverStatus: 'healthy',
      temperature: '52°C', firmware: '0x800003e5'
    },
    {
      id: 'nic-x710', model: 'Intel X710-DA4', pci: '0000:05:00.0', driver: 'i40e',
      portCount: 4, maxSpeed: '10 Gbps', numa: 1, driverStatus: 'healthy',
      temperature: '49°C', firmware: '9.40 0x8000f1c2'
    }
  ];
}

function createPhysicalPorts() {
  return [
    { id: 'port-i350-1', name: 'eth0', nicId: 'nic-i350', nicName: 'Intel I350-T4', portNumber: 1, mac: '02:4c:48:10:01:01', link: 'up', speed: '1 Gbps', maxSpeed: '1 Gbps', duplex: '全双工', medium: 'RJ45 铜缆', mtu: 1500, rx: 84.6, tx: 21.8, errors: 0, drops: 0, role: 'temporary-management', management: true, driverStatus: 'healthy' },
    { id: 'port-i350-2', name: 'eth1', nicId: 'nic-i350', nicName: 'Intel I350-T4', portNumber: 2, mac: '02:4c:48:10:02:01', link: 'up', speed: '1 Gbps', maxSpeed: '1 Gbps', duplex: '全双工', medium: 'RJ45 铜缆', mtu: 1500, rx: 326.4, tx: 96.2, errors: 0, drops: 1, role: 'lan', management: false, driverStatus: 'healthy', lan: { bridge: 'br-lan', ipv4Cidr: '192.168.100.1/24' } },
    { id: 'port-i350-3', name: 'eth2', nicId: 'nic-i350', nicName: 'Intel I350-T4', portNumber: 3, mac: '02:4c:48:10:03:01', link: 'down', speed: '--', maxSpeed: '1 Gbps', duplex: '--', medium: 'RJ45 铜缆', mtu: 1500, rx: 0, tx: 0, errors: 0, drops: 0, role: 'lan', management: false, driverStatus: 'healthy', lan: { bridge: 'br-lan', ipv4Cidr: '192.168.100.1/24' } },
    { id: 'port-i350-4', name: 'eth3', nicId: 'nic-i350', nicName: 'Intel I350-T4', portNumber: 4, mac: '02:4c:48:10:04:01', link: 'up', speed: '1 Gbps', maxSpeed: '1 Gbps', duplex: '全双工', medium: 'RJ45 铜缆', mtu: 1500, rx: 74.2, tx: 18.6, errors: 0, drops: 0, role: 'unassigned', management: false, driverStatus: 'healthy' },
    { id: 'port-x520-1', name: 'eth4', nicId: 'nic-x520', nicName: 'Intel X520-DA2', portNumber: 1, mac: '02:4c:48:20:01:01', link: 'up', speed: '10 Gbps', maxSpeed: '10 Gbps', duplex: '全双工', medium: 'SFP+ 光纤', mtu: 1500, rx: 6800, tx: 2400, errors: 0, drops: 0, role: 'wan', management: false, driverStatus: 'healthy', wanConfig: { type: 'dhcp', wanId: 'wan-dhcp-01', name: '办公宽带', ipv4: true, ipv6: true }, optical: { present: true, module: 'Intel FTLX8571D3BCV', temperature: '43.2°C', rxPower: '-2.18 dBm', txPower: '-1.44 dBm', compatible: true } },
    { id: 'port-x520-2', name: 'eth5', nicId: 'nic-x520', nicName: 'Intel X520-DA2', portNumber: 2, mac: '02:4c:48:20:02:01', link: 'up', speed: '10 Gbps', maxSpeed: '10 Gbps', duplex: '全双工', medium: 'SFP+ 光纤', mtu: 1500, rx: 1800, tx: 820, errors: 0, drops: 0, role: 'wan', management: false, driverStatus: 'healthy', wanConfig: { type: 'pppoe', wanId: 'wan-pppoe-01', name: '业务专线', username: 'business@example.invalid', secretConfigured: true, ipv4: true, ipv6: true }, optical: { present: true, module: 'Finisar FTLX8574D3BCL', temperature: '39.7°C', rxPower: '-2.72 dBm', txPower: '-1.61 dBm', compatible: true } },
    { id: 'port-x710-1', name: 'eth6', nicId: 'nic-x710', nicName: 'Intel X710-DA4', portNumber: 1, mac: '02:4c:48:30:01:01', link: 'up', speed: '10 Gbps', maxSpeed: '10 Gbps', duplex: '全双工', medium: 'SFP+ DAC', mtu: 1500, rx: 912.8, tx: 341.3, errors: 0, drops: 3, role: 'vlan-parent', management: false, driverStatus: 'healthy', vlanSummary: { vlans: 6, sessions: 6 }, optical: { present: true, module: 'Intel XDACBL3M', temperature: '不支持', rxPower: '不支持', txPower: '不支持', compatible: true } },
    { id: 'port-x710-2', name: 'eth7', nicId: 'nic-x710', nicName: 'Intel X710-DA4', portNumber: 2, mac: '02:4c:48:30:02:01', link: 'down', speed: '--', maxSpeed: '10 Gbps', duplex: '--', medium: 'SFP+ 光纤', mtu: 1500, rx: 0, tx: 0, errors: 0, drops: 0, role: 'unassigned', management: false, driverStatus: 'healthy', optical: { present: false, module: '未插模块', temperature: '--', rxPower: '--', txPower: '--', compatible: true } },
    { id: 'port-x710-3', name: 'eth8', nicId: 'nic-x710', nicName: 'Intel X710-DA4', portNumber: 3, mac: '02:4c:48:30:03:01', link: 'down', speed: '--', maxSpeed: '10 Gbps', duplex: '--', medium: 'SFP+ 光纤', mtu: 1500, rx: 0, tx: 0, errors: 0, drops: 0, role: 'unassigned', management: false, driverStatus: 'healthy', optical: { present: true, module: 'Intel FTLX8571D3BCV', temperature: '41.6°C', rxPower: '-40.00 dBm', txPower: '-1.72 dBm', compatible: true } },
    { id: 'port-x710-4', name: 'eth9', nicId: 'nic-x710', nicName: 'Intel X710-DA4', portNumber: 4, mac: '02:4c:48:30:04:01', link: 'down', speed: '--', maxSpeed: '10 Gbps', duplex: '--', medium: 'SFP+ 光纤', mtu: 1500, rx: 0, tx: 0, errors: 47, drops: 12, role: 'unassigned', management: false, driverStatus: 'fault', optical: { present: true, module: 'Generic SFP-10G-SR', temperature: '58.4°C', rxPower: '-40.00 dBm', txPower: '-2.04 dBm', compatible: false } }
  ];
}

export function createOnboardingState() {
  return {
    quickStep: 1,
    step: 1,
    maxStep: 1,
    hardwareDetected: false,
    portsDiscovered: false,
    managementPort: 'eth0',
    lan: {
      members: ['eth0', 'eth1'], bridge: 'br-lan', ipv4Cidr: '192.168.100.1/24', ulaPrefix: 'fd42:4c69:6e65::/48',
      dhcp: true, poolStart: '192.168.100.100', poolEnd: '192.168.100.250', dns: '192.168.100.1',
      ra: true, dhcpv6: true, mtu: 1500
    },
    selectedWanPorts: [],
    activeWanPort: '',
    wanConfigs: {},
    validation: { valid: false, errors: [], checkedAt: null },
    apply: { status: 'idle', deadline: null, outcome: null, logs: [] }
  };
}

export function createMockState() {
  const physicalCards = createHardwareCards();
  const physicalPorts = createPhysicalPorts();
  const vlans = createVlans();
  const wanConnections = [
    { id: 'wan-dhcp-01', name: '办公宽带', interface: 'eth4', type: 'dhcp', status: 'online', ipv4: true, ipv6: true, rx: 6800, tx: 2400, weight: 4, pool: '核心出口池' },
    { id: 'wan-pppoe-01', name: '业务专线', interface: 'eth5', type: 'pppoe', status: 'online', ipv4: true, ipv6: true, rx: 1800, tx: 820, weight: 3, pool: '业务出口池', username: 'business@example.invalid', secretConfigured: true }
  ];
  const lanBridges = [{ id: 'lan-main', name: 'br-lan', members: ['eth0', 'eth1'], ipv4Cidr: '192.168.100.1/24', ulaPrefix: 'fd42:4c69:6e65::/48', dhcp: true, poolStart: '192.168.100.100', poolEnd: '192.168.100.250', ra: true, dhcpv6: true, mtu: 1500 }];
  const pppoeSessions = [{
    id: 'pppoe-wan-01', wanId: 'wan-pppoe-01', parentInterface: 'eth5', vlanId: null,
    username: 'business@example.invalid', macMode: 'interface', mac: '02:4c:48:00:00:01',
    ipv4: true, ipv6: true, requestPd: true, weight: 3, poolId: 'pool-business', enabled: true,
    profileId: 'single-wan', secretConfigured: true, status: 'online'
  }];
  return {
    version: STORE_VERSION,
    createdAt: new Date().toISOString(),
    systemStatus: 'unconfigured',
    system: {
      hostname: 'linehub-gateway',
      cpu: 37,
      memory: 58,
      disk: 42,
      temperature: 48,
      uptime: '18 天 06:42:19',
      conntrack: 12862,
      conntrackMax: 65536,
      upload: 84.7,
      download: 412.8,
      kernel: 'OpenWrt 24.10 / 6.6.x',
      model: 'LineHub Edge Gateway · Preview'
    },
    wanLines: createWanLines(),
    physicalCards,
    hardwareCards: physicalCards,
    physicalPorts,
    wanConnections,
    lanBridges,
    pppoeSessions,
    interfaces: createInterfaces(),
    vlans,
    pools: [
      { id: 'pool-core', name: '核心出口池', members: 10, online: 7, ipv4: 8, ipv6: 6, weight: 35, speed: 286, algorithm: '加权轮询', failover: '自动摘除' },
      { id: 'pool-business', name: '业务出口池', members: 8, online: 5, ipv4: 7, ipv6: 5, weight: 26, speed: 194, algorithm: '源地址哈希', failover: '最低延迟' },
      { id: 'pool-dr', name: '灾备出口池', members: 6, online: 3, ipv4: 5, ipv6: 3, weight: 17, speed: 102, algorithm: '主备模式', failover: '容量不足告警' }
    ],
    servers: createServers(),
    policies: createPolicies(),
    firewallRules: createFirewallRules(),
    logs: createLogs(),
    alerts: createAlerts(),
    onboarding: createOnboardingState(),
    diagnosticsHistory: [],
    ...createDualStackData(),
    settings: {
      lanIfname: 'br-lan',
      ipv4Cidr: '192.168.100.1/24',
      ulaPrefix: 'fd42:4c69:6e65::/48',
      dhcp: true,
      ra: true,
      dhcpv6: true,
      dns: '192.168.100.1, fd42:4c69:6e65::1',
      mtu: 1500,
      timezone: 'Asia/Shanghai',
      ntp: 'ntp.aliyun.com'
    },
    ui: {
      expandedGroups: ['overview', 'wans']
    }
  };
}
