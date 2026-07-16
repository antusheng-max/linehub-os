# LineHub OS 开发状态

## 当前分支

`feature/stage1-clean`

## 当前已经完成

- LineHub OS 项目骨架
- 现代 LuCI 阶段1结构
- POSIX Shell/AWK 正式 UCI 校验器
- fixtures 和单元测试
- 本地 preview 管理界面
- LAN/WAN 接口选择逻辑
- DHCP、静态 IP、PPPoE 设计
- 单线多拨设计
- VLAN 拨号与 VLAN 多拨设计
- 虚拟 IPv4 和 ULA IPv6 双栈汇聚设计
- IPv4 线路池和 IPv6 线路池设计
- NPTv6、NAT66 和原生 IPv6 模式预览

## 当前尚未完成

- 单线多拨账号行和密码输入逻辑仍需从预览原型完善为生产实现
- VLAN 多账号拨号仍需从预览原型完善为生产实现
- preview 与真实 LuCI 尚未完全同步
- ucode 尚未在 OpenWrt 环境验证
- NAT44、NPTv6、NAT66 真实后端尚未实现
- 策略路由和回程一致性尚未实现
- OpenWrt SDK 编译尚未进行
- ISO 或磁盘镜像尚未制作

## 下次开发优先级

1. 完成单线多拨独立账号行的生产实现
2. 完成一个 VLAN 多个 PPPoE 账号的生产实现
3. 完成多个 VLAN 分别多账号拨号的生产实现
4. 完善账号密码安全处理
5. 确认 preview 操作流程
6. 再迁移到真实 LuCI 和 rpcd 后端

## 本地预览

启动方式：

```text
preview/start-preview.cmd
```

预览地址：<http://127.0.0.1:4173>

预览使用虚构演示数据，不应录入、导出或提交真实运营商账号和密码。
