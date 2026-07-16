import { getState, mutate } from '../store.js';
import { escapeHtml, pageHeader, panel, statusBadge, toast } from '../components.js';

const tools = [
  ['ping','Ping','检测目标可达性和往返延迟'],['traceroute','Traceroute','显示模拟路由跳数'],['dns','DNS 查询','解析 A、AAAA 和 CNAME'],
  ['route','路由查询','查找策略表与出口'],['pppoe','PPPoE 状态','查看会话与认证状态'],['ipv6','IPv6 连通性','检查地址、路由和 DNS'],
  ['mtu','MTU 探测','发现无分片报文上限'],['interfaces','接口统计','查看 RX/TX 和错误计数'],['neighbors','ARP / 邻居表','列出 IPv4 ARP 和 IPv6 NDP'],
  ['routes','路由表','显示主表与策略表'],['conntrack','Conntrack 查询','检索活动连接'],['validate','配置校验','运行离线模拟校验'],['logs','日志查看','筛选系统与拨号日志']
];

let activeTool='ping';
let output='LineHub diagnostics ready.\n选择工具并点击“执行模拟诊断”。';

function simulatedOutput(tool,target){
  const now=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  const outputs={
    ping:`PING ${target} (203.0.113.8): 56 data bytes\n64 bytes from 203.0.113.8: seq=0 ttl=55 time=18.4 ms\n64 bytes from 203.0.113.8: seq=1 ttl=55 time=17.9 ms\n64 bytes from 203.0.113.8: seq=2 ttl=55 time=19.2 ms\n\n--- ${target} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss\nround-trip min/avg/max = 17.9/18.5/19.2 ms`,
    traceroute:`traceroute to ${target}, 12 hops max\n 1  192.0.2.1       0.42 ms\n 2  100.64.0.1      3.18 ms\n 3  198.51.100.14   7.62 ms\n 4  203.0.113.8    18.22 ms`,
    dns:`Server: 192.0.2.1\nAddress: 192.0.2.1#53\n\nName: ${target}\nAddress: 203.0.113.8\nName: ${target}\nAddress: 2001:db8::8\nQuery time: 12 ms`,
    route:`policy lookup for ${target}\n  table: linehub_core\n  pool: 核心出口池\n  selected: wan-01\n  gateway: 192.0.2.1\n  metric: 10\n  source symmetry: enabled`,
    pppoe:`PPPoE session summary\n  total: 24\n  online: 15\n  dialing: 3\n  authentication failed: 2\n  disabled: 3\n  session discovery: normal`,
    ipv6:`IPv6 diagnostics for ${target}\n  global address: available\n  default route: via 核心出口池\n  IPv6-PD: 11 valid prefixes\n  DNS AAAA: success\n  ICMPv6: 21.7 ms\n  result: reachable`,
    mtu:`MTU probe via wan-01\n  1500 bytes: fragmentation required\n  1492 bytes: success\n  1480 bytes: success\n  recommended PPPoE MTU/MRU: 1492`,
    interfaces:`Interface counters\neth0  RX 36.2 Mbps  TX 9.1 Mbps   errors 0  drops 0\neth1  RX 53.4 Mbps  TX 17.0 Mbps  errors 1  drops 2\neth2  RX 70.1 Mbps  TX 25.2 Mbps  errors 2  drops 4\neth3  RX 87.8 Mbps  TX 33.0 Mbps  errors 12 drops 27`,
    neighbors:`Address              LLADDR             Device   State\n192.0.2.10           02:53:52:56:01:10 eth5    REACHABLE\n192.0.2.11           02:53:52:56:02:10 eth5    STALE\nfd12:3456:789a::20  02:53:52:56:03:10 br-lan  REACHABLE`,
    routes:`default via 192.0.2.1 dev wan-01 metric 10\n192.0.2.0/24 dev br-lan scope link\n10.20.10.0/24 dev lan-servers scope link\nfd12:3456:789a::/48 dev br-lan metric 1024`,
    conntrack:`tcp ESTABLISHED src=10.20.10.30:42618 dst=203.0.113.8:443 mark=0x101\nudp ASSURED src=10.20.10.31:51722 dst=223.5.5.5:53 mark=0x102\nmatched 2 of 12862 active connections`,
    validate:`LineHub offline configuration validation\n  VLAN range: PASS\n  WAN identifiers: PASS\n  MAC uniqueness: PASS\n  IPv4 CIDR: PASS\n  RFC4193 ULA: PASS\n  reference integrity: PASS\n  password output: REDACTED\nResult: valid (simulated preview only)`,
    logs:`${getState().logs.slice(0,8).map((log)=>`${log.time} ${log.level.toUpperCase()} [${log.module}] ${log.message}`).join('\n')}`
  };
  return `[${now}] linehub-diag --tool ${tool} --target ${target}\n${outputs[tool] || 'No simulated output.'}`;
}

function toolsPage(){
  const history=getState().diagnosticsHistory;
  return `${pageHeader('综合诊断','执行可操作的模拟网络诊断并保留本地历史记录。','<button class="button" data-diag-clear>清空历史</button>')}
    <div class="grid main-side">
      <div class="grid">
        ${panel('诊断工具',`<div class="tool-grid" style="padding:12px">${tools.map(([id,name,description])=>`<button class="tool-card ${activeTool===id?'active':''}" data-tool="${id}"><strong>${name}</strong><span>${description}</span></button>`).join('')}</div>`)}
        ${panel('执行参数',`<form class="inline-form" id="diagnostic-form"><label class="form-field wide"><span>目标地址或关键字</span><input class="input" name="target" value="example.invalid" required></label><label class="form-field"><span>出口线路</span><select class="select" name="wan"><option>自动选择</option><option>wan-01</option><option>wan-02</option></select></label><label class="form-field"><span>超时</span><select class="select"><option>2 秒</option><option>5 秒</option></select></label><button class="button primary" type="submit">执行模拟诊断</button></form><div style="padding:12px"><div class="terminal"><span class="prompt">root@linehub:~#</span> ${escapeHtml(output)}</div></div>`)}
      </div>
      ${panel('诊断历史',history.length?`<div class="alert-list">${history.slice(0,12).map((item)=>`<div class="alert-item">${statusBadge('online','完成')}<div><strong>${escapeHtml(item.tool)} · ${escapeHtml(item.target)}</strong><p>${escapeHtml(item.summary)}</p></div><span class="alert-time">${escapeHtml(item.time)}</span></div>`).join('')}</div>`:'<div class="empty-state"><span>⌁</span><strong>暂无诊断历史</strong><p>执行工具后会保存到浏览器 localStorage。</p></div>')}
    </div>`;
}

function dataPage(route){
  const state=getState();
  if(route==='diagnostics/interfaces')return `${pageHeader('接口统计','查看物理接口模拟计数器、错包和丢包。','<button class="button" data-diag-refresh>刷新计数器</button>')}${panel('接口计数器',`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>接口</th><th>链路</th><th>RX</th><th>TX</th><th>错包</th><th>丢包</th><th>驱动</th><th>MTU</th></tr></thead><tbody>${state.interfaces.map((item)=>`<tr><td class="mono">${item.name}</td><td>${statusBadge(item.link)}</td><td>${item.rx} Mbps</td><td>${item.tx} Mbps</td><td>${item.errors}</td><td>${item.drops}</td><td>${item.driver}</td><td>${item.mtu}</td></tr>`).join('')}</tbody></table></div>`)}`;
  if(route==='diagnostics/routes')return `${pageHeader('路由与邻居','查看模拟 ARP/NDP 邻居、主路由表和策略表。','<button class="button" data-diag-refresh>刷新路由</button>')}<div class="grid cols-2">${panel('路由表','<div class="terminal">default via 192.0.2.1 dev wan-01 metric 10\n10.20.10.0/24 dev lan-servers scope link\n10.20.20.0/24 dev lan-services scope link\nfd12:3456:789a::/48 dev br-lan metric 1024</div>')}${panel('ARP / IPv6 邻居','<div class="terminal">192.0.2.10  02:53:52:56:01:10  REACHABLE\n192.0.2.11  02:53:52:56:02:10  STALE\nfd12:3456:789a::20  02:53:52:56:03:10  REACHABLE</div>')}</div>`;
  return `${pageHeader('日志查看','筛选系统、拨号、健康检查、防火墙和路由模拟日志。','<button class="button" data-diag-refresh>刷新日志</button>')}${panel('系统日志',`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>级别</th><th>模块</th><th>消息</th></tr></thead><tbody>${state.logs.map((log)=>`<tr><td class="mono">${log.time}</td><td>${statusBadge(log.level==='error'?'fault':log.level)}</td><td>${log.module}</td><td>${escapeHtml(log.message)}</td></tr>`).join('')}</tbody></table></div>`)}`;
}

export function renderDiagnostics(route){
  return{html:route==='diagnostics/tools'?toolsPage():dataPage(route),mount(root){
    root.querySelectorAll('[data-tool]').forEach((button)=>button.addEventListener('click',()=>{activeTool=button.dataset.tool;window.dispatchEvent(new CustomEvent('linehub:rerender'));}));
    root.querySelector('#diagnostic-form')?.addEventListener('submit',(event)=>{event.preventDefault();const target=new FormData(event.currentTarget).get('target');output=simulatedOutput(activeTool,target);mutate((state)=>state.diagnosticsHistory.unshift({id:`diag-${Date.now()}`,tool:tools.find(([id])=>id===activeTool)?.[1]||activeTool,target,time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),summary:'模拟执行成功'}),{source:'diagnostics'});toast('模拟诊断已完成。');});
    root.querySelector('[data-diag-clear]')?.addEventListener('click',()=>{mutate((state)=>{state.diagnosticsHistory=[];},{source:'diagnostics'});output='诊断历史已清空。';toast('诊断历史已清空。');});
    root.querySelectorAll('[data-diag-refresh]').forEach((button)=>button.addEventListener('click',()=>toast('诊断数据已刷新。','info')));
  }};
}
