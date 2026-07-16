# 里程碑

## M0：规划与骨架（当前）

- 完成职责边界、UCI v1 数据模型、包布局、测试策略和安全约束。
- 不构建固件，不连接运营商网络，不应用网络规则。

## M1：离线配置域

- 实现 `linehub-core` 的 UCI schema 校验、引用完整性和脱敏序列化。
- 为 VLAN/PPPoE/池/策略建立 fixture 驱动单元测试。

## M2：受控控制面

- 实现 `linehubd` ubus 状态模型、UCI 事务协调和回滚路径。
- 实现 LuCI 配置页与最小 rpcd ACL。

## M3：数据面集成实验

- 在隔离的 OpenWrt 测试环境验证 nftables connmark、IPv4/IPv6 策略路由和 netifd/pppd 生命周期。
- 验证单 VLAN 多拨、多 VLAN 多拨、线路失效和恢复。严禁在开发主机执行。

## M4：诊断与发布准备

- 增加状态快照、隐私审计、升级/降级测试、性能基线和运维文档。
