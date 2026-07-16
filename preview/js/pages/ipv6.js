import { getState, mutate } from '../store.js';
import { escapeHtml, formatInteger, formatSpeed, pageHeader, panel, statCard, statusBadge, toggle, toast } from '../components.js';

const pageMeta = {
  'ipv6/overview': ['IPv6 总览','集中查看 WAN 地址、PD、LAN 前缀、路由、DNS 和连接流量。'],
  'ipv6/prefixes': ['前缀管理','维护 WAN PD、LAN ULA、全局前缀的生命周期和冲突告警。'],
  'ipv6/lines': ['IPv6 线路','逐线路查看地址、PD、有效期、默认路由与健康状态。'],
  'ipv6/lan': ['LAN IPv6','管理 RA、DHCPv6、ULA 和全局前缀下发。'],
  'ipv6/policies': ['IPv6 策略','按源前缀、目标与服务分配 IPv6 出口线路。'],
  'ipv6/firewall': ['IPv6 防火墙','维护入站、出站与转发链的 IPv6 访问控制。']
};

function overview() {
  const state = getState();
  const enabled = state.wanLines.filter((line) => line.enabled && line.ipv6Enabled);
  const online = enabled.filter((line) => line.status === 'online');
  const pd = online.filter((line) => line.pd !== '--');
  const rows = enabled.slice(0, 12).map((line) => `<tr data-ipv6-line="${line.id}"><td class="mono">${line.id}</td><td>${toggle({ checked: line.ipv6Enabled, label: `切换 ${line.id} IPv6`, action: 'ipv6-toggle' })}</td><td class="mono">${escapeHtml(line.ipv6)}</td><td class="mono">${escapeHtml(line.pd)}</td><td>${line.pd === '--' ? '--' : '/56'}</td><td>${line.pd === '--' ? '--' : '23h 48m'}</td><td>${line.pd === '--' ? '--' : '11h 48m'}</td><td>${line.issue === 'IPv6-PD 获取失败' ? statusBadge('warning', 'PD 失败') : statusBadge(line.status === 'online' ? 'online' : line.status)}</td></tr>`).join('');
  return `<div class="stats-grid">
    ${statCard({ label: 'IPv6 在线线路', value: online.length, detail: `${enabled.length} 条已启用`, tone: 'purple', icon: 'v6' })}
    ${statCard({ label: '有效 IPv6-PD', value: pd.length, detail: `${enabled.filter((line) => line.requestPd).length} 条请求 PD`, tone: 'green', icon: 'PD' })}
    ${statCard({ label: 'IPv6 连接数', value: formatInteger(5821), detail: '占全部连接 45%', tone: 'blue', icon: 'C' })}
    ${statCard({ label: 'IPv6 总流量', value: formatSpeed(168.4), detail: '下行模拟速率', tone: 'cyan', icon: '↓' })}
    ${statCard({ label: '前缀告警', value: enabled.filter((line) => line.issue === 'IPv6-PD 获取失败').length, detail: '无前缀冲突', tone: 'orange', icon: '!' })}
  </div>
  <div class="grid cols-2">
    ${panel('LAN IPv6', `<div class="panel-content pad"><div class="resource-row"><span>LAN ULA</span><span></span><strong>${escapeHtml(state.settings.ulaPrefix)}</strong></div><div class="resource-row"><span>全局前缀</span><span></span><strong>${escapeHtml(pd[0]?.pd || '--')}</strong></div><div class="resource-row"><span>RA 状态</span><span></span><strong>${state.settings.ra ? '已启用' : '已关闭'}</strong></div><div class="resource-row"><span>DHCPv6 状态</span><span></span><strong>${state.settings.dhcpv6 ? '已启用' : '已关闭'}</strong></div><div class="resource-row"><span>IPv6 DNS</span><span></span><strong>fd12:3456:789a::1</strong></div></div>`) }
    ${panel('IPv6 路由', `<div class="panel-content pad"><div class="resource-row"><span>默认路由</span><span></span><strong>核心出口池</strong></div><div class="resource-row"><span>ECMP 成员</span><span></span><strong>8 条</strong></div><div class="resource-row"><span>策略路由表</span><span></span><strong>24 个</strong></div><div class="resource-row"><span>源进源出</span><span></span><strong>已启用</strong></div><div class="resource-row"><span>路由健康</span><span></span><strong style="color:#0e9b6b">正常</strong></div></div>`) }
  </div>
  <div style="margin-top:12px">${panel('WAN IPv6 与前缀', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>WAN ID</th><th>IPv6</th><th>地址</th><th>IPv6-PD</th><th>PD 长度</th><th>有效期</th><th>首选期</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></div>`)}</div>`;
}

function subPage(route) {
  const state = getState();
  const [title] = pageMeta[route];
  if (route === 'ipv6/lines' || route === 'ipv6/prefixes') return overview();
  const features = route === 'ipv6/lan'
    ? [['RA 服务','已启用','周期 30 秒'],['DHCPv6','已启用','有状态分配'],['ULA 前缀',state.settings.ulaPrefix,'RFC4193'],['全局前缀','2 个有效','自动选择']]
    : route === 'ipv6/policies'
      ? [['默认出口','核心出口池','源地址哈希'],['策略数量','6 条','全部生效'],['源进源出','已启用','24 个路由表'],['前缀选择','自动','优先有效期']]
      : [['入站规则','12 条','默认拒绝'],['出站规则','8 条','默认放行'],['转发规则','16 条','服务器隔离'],['命中统计','1.2M','最近 24 小时']];
  return `<div class="grid cols-4">${features.map(([name,value,detail],index) => `<article class="feature-card"><span>${index+1}</span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(value)} · ${escapeHtml(detail)}</p><button class="button compact" data-ipv6-save>配置</button></article>`).join('')}</div>
    <div style="margin-top:12px">${panel(`${title}配置`, `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>启用</th><th>名称</th><th>源前缀</th><th>目标前缀</th><th>接口/线路池</th><th>动作</th><th>命中</th><th>操作</th></tr></thead><tbody>${Array.from({length:8},(_,index) => `<tr><td>${toggle({ checked:index!==6,label:`切换 IPv6 规则 ${index+1}`,action:'ipv6-rule' })}</td><td>${escapeHtml(`${title}规则 ${index+1}`)}</td><td class="mono">fd12:3456:789a:${10+index}::/64</td><td class="mono">${index%2?'任意':'2001:db8::/32'}</td><td>${index%2?'核心出口池':'lan-servers'}</td><td>${index===6?'拒绝':'放行'}</td><td>${(index+1)*12847}</td><td><button class="row-action" data-ipv6-save>编辑</button></td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}

export function renderIpv6(route) {
  const [title, description] = pageMeta[route];
  return {
    html: `${pageHeader(title, description, '<button class="button" data-ipv6-refresh>刷新状态</button><button class="button primary" data-ipv6-save>保存 IPv6 配置</button>')}${route === 'ipv6/overview' ? overview() : subPage(route)}`,
    mount(root) {
      root.querySelectorAll('[data-ipv6-line]').forEach((row) => row.querySelector('[data-action="ipv6-toggle"]').addEventListener('change', (event) => {
        mutate((state) => { const line = state.wanLines.find((item) => item.id === row.dataset.ipv6Line); if (line) line.ipv6Enabled = event.target.checked; }, { source: 'ipv6' });
        toast(`${row.dataset.ipv6Line} IPv6 已${event.target.checked ? '启用' : '关闭'}。`);
      }));
      root.querySelectorAll('[data-ipv6-save],[data-ipv6-refresh],[data-action="ipv6-rule"]').forEach((element) => element.addEventListener(element.matches('input') ? 'change' : 'click', () => toast(element.hasAttribute('data-ipv6-refresh') ? 'IPv6 状态已刷新。' : 'IPv6 配置已保存。', element.hasAttribute('data-ipv6-refresh') ? 'info' : 'success')));
    }
  };
}
