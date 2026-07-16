# 架构设计

## 分层责任

| 层 | 责任 |
| --- | --- |
| OpenWrt 平台 | Linux 内核、驱动、netifd、pppd、odhcp6c、UCI、ubus、rpcd、nftables。 |
| `linehub-core` | 共享 UCI schema、POSIX Shell/AWK 离线配置校验、稳定标识和状态对象定义。 |
| `linehubd` | 订阅 ubus 状态，编排 UCI 事务，生成期望状态并协调故障恢复；不由 Web 层直接运行网络命令。 |
| `linehub-balance` | 流选择、连接标记、每地址族策略路由意图和权重池计算。 |
| `linehub-firewall` | 防火墙区域与 nftables 规则的声明性集成边界，保持连接标记与防泄漏约束。 |
| `linehub-diagnostics` | 只读健康、状态和配置一致性诊断。 |
| `luci-app-linehub` | 现代 LuCI JavaScript 前端、菜单 JSON、最小 rpcd ACL 与 ucode 状态接口；第一版只读模拟状态。 |

## 控制面与数据面

控制面是 LuCI → UCI 事务 → `linehubd` 校验/协调 → OpenWrt 服务与 ubus 状态。数据面由 netifd/pppd 建立链路，nftables 保存连接标记，策略路由依据标记查表。LineHub 的包只描述集成契约；底层网络生命周期仍属于 OpenWrt。

每条 WAN 用稳定 `wan_id` 映射到独立 mark、路由表和健康状态。IPv4 与 IPv6 分别维护可用性，避免“IPv4 已恢复即 IPv6 已恢复”之类的错误推断。

## UCI 模型（v1）

UCI 文件名为 `/etc/config/linehub`：

```uci
config device 'eth0'
	option ifname 'eth0'
	option role 'wan_parent'

config vlan 'wan_vlan_101'
	option device 'eth0'
	option vid '101'
	option ifname 'eth0.101'

config pppoe 'wan_alpha'
	option wan_id 'wan-alpha'
	option vlan 'wan_vlan_101'
	option username 'demo-alpha@example.invalid'
	option password 'example-not-a-secret'
	option macaddr '02:00:00:00:01:01'
	option ipv4 '1'
	option ipv6 '1'
	option weight '2'
	option healthcheck 'internet_icmp'

config lan 'main'
	option ifname 'br-lan'
	option ipv4_cidr '192.0.2.1/24'
	option ula_prefix 'fd42:4c69:6e65::/48'

config pool 'default'
	list member 'wan-alpha'
	option algorithm 'weighted_flow'
	option failover 'priority_then_weight'

config healthcheck 'internet_icmp'
	option type 'icmp'
	option target '198.51.100.10'
	option interval '10'
	option timeout '2'
	option failure_threshold '3'
	option recovery_threshold '2'

config policy 'lan_default'
	option priority '1000'
	option source '192.0.2.0/24'
	option pool 'default'
	option sticky 'conntrack'
```

LAN 固定 IPv4 统一使用 `ipv4_cidr`。`password` 是运行时敏感字段，只为阐明 schema 出现在此虚构示例；生产 UI/API 不读取或返回其明文。

## 阶段 1 实现边界

`luci-app-linehub` 不再使用旧式 Lua controller/template。页面通过 `rpc.declare()` 调用 `linehub.status`，ucode 后端仅返回版本和模拟计数，绝不读取或返回 PPPoE 密码。`linehub-validate` 使用 POSIX Shell 启动 AWK 解析传入的 UCI 文本；它不调用 UCI、ubus、pppd、nftables 或网络命令，因此可在目标设备或离线 fixture 上运行。

本阶段没有真实拨号、负载均衡或状态采集，也不能据此认定软件包已可用于生产软路由。下一阶段将在隔离的 OpenWrt SDK 环境验证软件包编译。
