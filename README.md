# LineHub OS

LineHub OS 是面向 **OpenWrt x86_64** 的多线路软路由项目规划与代码骨架。它以 OpenWrt 的网络底座为基础，为多 VLAN、多 PPPoE、IPv4/IPv6 双栈线路提供专用的 Web 管理、配置编排、流量调度、健康检查与故障恢复能力。

> 当前仓库只包含项目规划和包骨架。不会构建固件，也不会执行 PPPoE、nftables、路由或防火墙配置命令。

## 边界与目标

- **OpenWrt 负责：** Linux 内核和驱动、`netifd`、`pppd`、`odhcp6c`、UCI、ubus、rpcd 与 nftables。
- **LineHub 负责：** Web 管理、批量线路配置、PPPoE 状态、双栈策略路由、流级负载均衡、健康检查与故障恢复。
- 支持多个 VLAN 各自多拨，以及单 VLAN 承载多个 PPPoE 会话。
- 同一个 TCP 或 UDP 连接在存续期间固定使用同一条 WAN；普通多 WAN 按连接分流，**不能**叠加一个 TCP 连接的带宽。
- IPv6 前缀按线路独立管理；多个公网 IPv6 前缀不会被表述或实现为“合并成一个公网前缀”。

## 仓库布局

- `docs/`：需求、架构、网络/安全模型、里程碑和测试策略。
- `packages/`：OpenWrt feed 风格的 LineHub 包骨架。
- `builder/`：将来可复现构建的说明与配置入口；不存放构建产物。
- `scripts/`：本地静态校验脚本，默认不改变系统网络状态。
- `tests/`：纯离线单元、集成设计与虚构 fixtures。

## 快速检查

```sh
./scripts/validate-skeleton.sh
git diff --check
```

详细设计从 [需求](docs/requirements.md) 开始，并参阅 [架构](docs/architecture.md) 和 [网络模型](docs/network-model.md)。

## 非目标（第一阶段）

- 不生成或刷写 OpenWrt 固件。
- 不在开发主机执行真实 PPPoE 拨号、nftables 规则、策略路由或防火墙变更。
- 不承诺跨 WAN 的单连接链路聚合。
