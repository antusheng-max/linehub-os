const ipv4Lines = [
  ['wan-v4-01', 'eth4.101', '100.64.10.18', 'online', 12, 0.0, 5, 1328, 186, 42, true, true, 'primary'],
  ['wan-v4-02', 'eth4.103', '100.64.20.18', 'online', 18, 0.1, 4, 948, 142, 37, true, true, 'member'],
  ['wan-v4-03', 'eth5.105', '203.0.113.34', 'online', 26, 0.0, 3, 624, 96, 28, true, true, 'member'],
  ['wan-v4-04', 'eth5.107', '198.51.100.72', 'degraded', 86, 1.8, 2, 207, 31, 12, true, true, 'backup'],
  ['wan-v4-05', 'eth6.109', '100.64.50.26', 'offline', 0, 100, 1, 0, 0, 0, false, true, 'member'],
  ['wan-v4-06', 'eth6.111', '192.0.2.86', 'online', 34, 0.3, 2, 351, 62, 19, true, true, 'backup']
].map(([id, interfaceName, realIpv4, status, latency, loss, weight, connections, rx, tx, inPool, enabled, role]) => ({
  id, interface: interfaceName, realIpv4, natType: 'NAT44', status, latency, loss, weight, connections, rx, tx, inPool, enabled, role,
  healthCheck: { enabled: true, method: 'ICMP + TCP', targets: ['223.5.5.5', '1.1.1.1'], interval: 5, failures: status === 'offline' ? 4 : 0 }
}));

const ipv6Lines = [
  { id: 'wan-v6-01', interface: 'eth4.101', address: '2408:1234:1000::18/128', pd: '2408:1234:1000::/56', pdLength: 56, preferredLifetime: '23h 41m', validLifetime: '6d 23h', defaultRoute: 'fe80::1', dns: '240c::6666', mode: 'auto', resolvedMode: 'nptv6', status: 'online', latency: 14, loss: 0, weight: 5, inPool: true, enabled: true, pdStatus: 'valid' },
  { id: 'wan-v6-02', interface: 'eth4.103', address: '2408:2345:2000::21/128', pd: '2408:2345:2000:10::/60', pdLength: 60, preferredLifetime: '11h 58m', validLifetime: '3d 23h', defaultRoute: 'fe80::1', dns: '2400:3200::1', mode: 'auto', resolvedMode: 'nptv6', status: 'online', latency: 21, loss: 0.1, weight: 4, inPool: true, enabled: true, pdStatus: 'valid', nativeEligible: true },
  { id: 'wan-v6-03', interface: 'eth5.105', address: '2409:8888:1200::25/128', pd: '--', pdLength: null, preferredLifetime: '7h 32m', validLifetime: '1d 07h', defaultRoute: 'fe80::a', dns: '240e:4c:4008::1', mode: 'auto', resolvedMode: 'nat66', status: 'online', latency: 29, loss: 0.2, weight: 3, inPool: true, enabled: true, pdStatus: 'none' },
  { id: 'wan-v6-04', interface: 'eth5.107', address: '240e:5678:3000::41/128', pd: '--', pdLength: null, preferredLifetime: '5h 08m', validLifetime: '18h 20m', defaultRoute: 'fe80::1', dns: '240e:1f:1::1', mode: 'auto', resolvedMode: 'disabled', status: 'pd-failed', latency: 42, loss: 0.8, weight: 2, inPool: false, enabled: true, pdStatus: 'failed' },
  { id: 'wan-v6-05', interface: 'eth6.109', address: '--', pd: '--', pdLength: null, preferredLifetime: '--', validLifetime: '--', defaultRoute: '--', dns: '--', mode: 'disabled', resolvedMode: 'disabled', status: 'unavailable', latency: 0, loss: 100, weight: 1, inPool: false, enabled: false, pdStatus: 'none' },
  { id: 'wan-v6-06', interface: 'eth6.111', address: '2408:9876:6000::18/128', pd: '2408:9876:6000:80::/56', pdLength: 56, preferredLifetime: '21h 12m', validLifetime: '5d 18h', defaultRoute: 'fe80::2', dns: '240c::6644', mode: 'auto', resolvedMode: 'nptv6', status: 'high-latency', latency: 168, loss: 0.6, weight: 2, inPool: true, enabled: true, pdStatus: 'valid' }
];

const serverNames = ['Web-01', 'API-01', 'Storage-01', 'Media-01', 'Backup-01', 'Monitor-01'];
const serverBindings = serverNames.map((name, index) => ({
  id: `binding-${index + 1}`,
  name,
  mac: `02:53:52:10:10:${String(index + 10).padStart(2, '0')}`,
  internalIpv4: `10.10.10.${10 + index}`,
  internalIpv6: `fd42:4c69:6e65:1::${10 + index}`,
  ipv4PoolId: index === 4 ? 'pool-v4-backup' : 'pool-v4-default',
  ipv6PoolId: 'pool-v6-default',
  ipv4Policy: index === 2 ? 'fixed' : index === 4 ? 'failover' : 'auto',
  ipv6Policy: index === 3 ? 'nat66-first' : index === 5 ? 'fixed' : 'nptv6-first',
  currentV4Wan: index === 4 ? 'wan-v4-06' : `wan-v4-0${(index % 3) + 1}`,
  currentV6Wan: index === 3 ? 'wan-v6-03' : index === 5 ? 'wan-v6-02' : 'wan-v6-01',
  translationMode: index === 3 ? 'NAT66' : 'NPTv6',
  online: index !== 4,
  connections: index === 4 ? 0 : 183 + index * 127,
  returnPath: true,
  stickySessions: true,
  failover: true
}));

const connectionMappings = [
  { id: 'conn-001', protocol: 'IPv4', internalSource: '10.10.10.10', internalPort: 42561, destination: '93.184.216.34', destinationPort: 443, wanId: 'wan-v4-02', externalAddress: '100.64.20.18', externalPort: 53002, translation: 'NAT44', state: 'ESTABLISHED', tx: 18.4, rx: 96.2, age: '00:18:42', returnWan: 'wan-v4-02', serverId: 'binding-1', mark: '0x4012', routeTable: 'lh-v4-02', reverseMapping: '100.64.20.18:53002 → 10.10.10.10:42561', returnInterface: 'eth4.103', returnStatus: 'consistent' },
  { id: 'conn-002', protocol: 'IPv6', internalSource: 'fd42:4c69:6e65:1::10', internalPort: 443, destination: '2606:4700:4700::1111', destinationPort: 443, wanId: 'wan-v6-01', externalAddress: '2408:1234:1000:1::10', externalPort: 443, translation: 'NPTv6', state: 'ESTABLISHED', tx: 9.8, rx: 44.6, age: '00:12:09', returnWan: 'wan-v6-01', serverId: 'binding-1', mark: '0x6011', routeTable: 'lh-v6-01', reverseMapping: '2408:1234:1000:1::10 ↔ fd42:4c69:6e65:1::10', returnInterface: 'eth4.101', returnStatus: 'consistent' },
  { id: 'conn-003', protocol: 'IPv6', internalSource: 'fd42:4c69:6e65:1::11', internalPort: 53218, destination: '2001:4860:4860::8888', destinationPort: 53, wanId: 'wan-v6-03', externalAddress: '2409:8888:1200::25', externalPort: 58143, translation: 'NAT66', state: 'ESTABLISHED', tx: 1.2, rx: 4.7, age: '00:03:16', returnWan: 'wan-v6-03', serverId: 'binding-2', mark: '0x6031', routeTable: 'lh-v6-03', reverseMapping: '2409:8888:1200::25:58143 → fd42:4c69:6e65:1::11:53218', returnInterface: 'eth5.105', returnStatus: 'consistent' },
  { id: 'conn-004', protocol: 'IPv4', internalSource: '10.10.10.12', internalPort: 38204, destination: '203.0.113.190', destinationPort: 22, wanId: 'wan-v4-03', externalAddress: '203.0.113.34', externalPort: 49118, translation: 'NAT44', state: 'ESTABLISHED', tx: 4.1, rx: 8.9, age: '01:07:22', returnWan: 'wan-v4-03', serverId: 'binding-3', mark: '0x4033', routeTable: 'lh-v4-03', reverseMapping: '203.0.113.34:49118 → 10.10.10.12:38204', returnInterface: 'eth5.105', returnStatus: 'consistent' },
  { id: 'conn-005', protocol: 'IPv6', internalSource: 'fd42:4c69:6e65:1::13', internalPort: 443, destination: '2404:6800:4008::200e', destinationPort: 443, wanId: 'wan-v6-06', externalAddress: '2408:9876:6000:81::13', externalPort: 443, translation: 'NPTv6', state: 'DEGRADED', tx: 3.3, rx: 12.8, age: '00:41:08', returnWan: 'wan-v6-02', serverId: 'binding-4', mark: '0x6062', routeTable: 'lh-v6-06', reverseMapping: '映射存在，回程WAN不一致', returnInterface: 'eth4.103', returnStatus: 'mismatch' },
  { id: 'conn-006', protocol: 'IPv4', internalSource: '10.10.10.15', internalPort: 60120, destination: '1.1.1.1', destinationPort: 53, wanId: 'wan-v4-01', externalAddress: '100.64.10.18', externalPort: 60120, translation: 'NAT44', state: 'ESTABLISHED', tx: 0.4, rx: 1.1, age: '00:00:28', returnWan: 'wan-v4-01', serverId: 'binding-6', mark: '0x4011', routeTable: 'lh-v4-01', reverseMapping: '100.64.10.18:60120 → 10.10.10.15:60120', returnInterface: 'eth4.101', returnStatus: 'consistent' },
  { id: 'conn-007', protocol: 'IPv6', internalSource: 'fd42:4c69:6e65:1::14', internalPort: 8443, destination: '2606:4700::6810:85e5', destinationPort: 443, wanId: 'wan-v6-02', externalAddress: '2408:2345:2000:12::14', externalPort: 8443, translation: 'NPTv6', state: 'DEGRADED', tx: 0, rx: 0, age: '00:00:04', returnWan: 'wan-v6-02', serverId: 'binding-5', mark: '0x6024', routeTable: 'lh-v6-02', reverseMapping: '未找到反向映射', returnInterface: 'eth4.103', returnStatus: 'mapping-missing' },
  { id: 'conn-008', protocol: 'IPv4', internalSource: '10.10.10.13', internalPort: 41227, destination: '198.51.100.200', destinationPort: 443, wanId: 'wan-v4-04', externalAddress: '198.51.100.72', externalPort: 51218, translation: 'NAT44', state: 'DEGRADED', tx: 0.2, rx: 0.6, age: '00:02:17', returnWan: 'wan-v4-04', serverId: 'binding-4', mark: '0x4041', routeTable: '--', reverseMapping: '198.51.100.72:51218 → 10.10.10.13:41227', returnInterface: 'eth5.107', returnStatus: 'route-missing' }
];

export function createDualStackData() {
  return {
    dualStackGateway: {
      lanIpv4Cidr: '10.10.10.0/24',
      lanUlaPrefix: 'fd42:4c69:6e65::/48',
      ipv4PoolId: 'pool-v4-default',
      ipv6PoolId: 'pool-v6-default',
      ipv6Mode: 'auto',
      stickySessions: true,
      returnPathConsistency: true,
      failoverEnabled: true
    },
    ipv4Pools: [
      { id: 'pool-v4-default', name: 'IPv4 默认出口池', algorithm: 'weighted-connections', enabled: true, lines: structuredClone(ipv4Lines) },
      { id: 'pool-v4-backup', name: 'IPv4 备用出口池', algorithm: 'failover', enabled: true, lines: structuredClone(ipv4Lines.filter((line) => line.role === 'backup')) }
    ],
    ipv6Pools: [
      { id: 'pool-v6-default', name: 'IPv6 默认出口池', algorithm: 'lowest-latency', enabled: true, allowNativeRouting: false, lines: structuredClone(ipv6Lines) }
    ],
    ipv6Translations: {
      nptv6: [
        { id: 'npt-wan-v6-01', wanId: 'wan-v6-01', internalUlaPrefix: 'fd42:4c69:6e65::/48', externalPd: '2408:1234:1000::/56', internalSubnet: 'fd42:4c69:6e65:1::/64', externalSubnet: '2408:1234:1000:1::/64', status: 'valid', regeneratedAt: '2026-07-16 11:42:08', mappings: [['fd42:4c69:6e65:1::10', '2408:1234:1000:1::10'], ['fd42:4c69:6e65:1::11', '2408:1234:1000:1::11']] },
        { id: 'npt-wan-v6-02', wanId: 'wan-v6-02', internalUlaPrefix: 'fd42:4c69:6e65::/48', externalPd: '2408:2345:2000:10::/60', internalSubnet: 'fd42:4c69:6e65:2::/64', externalSubnet: '2408:2345:2000:12::/64', status: 'valid', regeneratedAt: '2026-07-16 11:39:31', mappings: [['fd42:4c69:6e65:2::12', '2408:2345:2000:12::12']] }
      ],
      nat66: [
        { id: 'nat66-wan-v6-03', internalRange: 'fd42:4c69:6e65::/48', wanId: 'wan-v6-03', wanIpv6: '2409:8888:1200::25', mode: 'masquerade', connections: 386, inboundMappings: 2, sessionTimeout: 300, status: 'active' }
      ],
      nativeRoutes: [],
      inboundMappings: [
        { id: 'inbound-npt-01', type: 'NPTv6', publicAddress: '2408:1234:1000:1::10', publicPort: 'TCP 443', internalAddress: 'fd42:4c69:6e65:1::10', internalPort: 'TCP 443', wanId: 'wan-v6-01', firewall: '允许' },
        { id: 'inbound-nat-01', type: 'NAT66', publicAddress: '2409:8888:1200::25', publicPort: 'TCP 443', internalAddress: 'fd42:4c69:6e65:1::10', internalPort: 'TCP 443', wanId: 'wan-v6-03', firewall: '允许' }
      ]
    },
    serverBindings: structuredClone(serverBindings),
    connectionMappings: structuredClone(connectionMappings),
    prefixDelegations: ipv6Lines.map((line) => ({ wanId: line.id, prefix: line.pd, length: line.pdLength, preferredLifetime: line.preferredLifetime, validLifetime: line.validLifetime, status: line.pdStatus, generation: line.pdStatus === 'valid' ? 1 : 0 })),
    returnPathBindings: connectionMappings.map((connection) => ({ connectionId: connection.id, mark: connection.mark, wanId: connection.wanId, routeTable: connection.routeTable, externalSource: connection.externalAddress, reverseMapping: connection.reverseMapping, returnInterface: connection.returnInterface, status: connection.returnStatus })),
    dualStackEvents: [
      { id: 'event-1', time: '11:52:14', severity: 'warning', type: 'return-path', message: 'conn-005 回程接口与出口 WAN 不一致' },
      { id: 'event-2', time: '11:46:02', severity: 'info', type: 'pd', message: 'wan-v6-01 /56 PD 续租成功' },
      { id: 'event-3', time: '11:31:47', severity: 'critical', type: 'wan', message: 'wan-v4-05 健康检查失败，停止分配新连接' }
    ]
  };
}
