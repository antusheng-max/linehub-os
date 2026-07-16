import { getState, mutate } from '../store.js';
import { closeDrawer, confirmAction, escapeHtml, field, formActions, formatInteger, input, openDrawer, pageHeader, panel, select, statusBadge, toggle, toast } from '../components.js';

const pageMeta = {
  'firewall/nat': ['NAT 规则','维护源/目标转换、接口绑定、动作和命中统计。'],
  'firewall/ports': ['端口映射','将 WAN 端口映射到 LAN 服务器并记录命中。'],
  'firewall/dmz': ['DMZ','为指定服务器配置受控的全端口映射。'],
  'firewall/upnp': ['UPnP','管理客户端授权、动态映射和过期时间。'],
  'firewall/access': ['访问控制','按地址、端口、接口和时间段允许或拒绝访问。'],
  'firewall/ipv6': ['IPv6 防火墙','管理 IPv6 入站、转发和出站策略。'],
  'firewall/conntrack': ['连接跟踪','查询 conntrack 会话、协议状态和 NAT 映射。']
};

let search = '';
let sort = 'order';
let direction = 'asc';

function editRule(rule = null) {
  const item = rule || { name:'',protocol:'TCP',source:'任意',destination:'任意',sourcePort:'任意',destinationPort:'443',inbound:'任意',outbound:'任意',action:'放行',enabled:true };
  openDrawer({
    title: rule ? `编辑规则 ${rule.name}` : '新增防火墙规则',
    width: 'wide',
    body: `<form id="firewall-form"><div class="form-grid">
      ${field('规则名称',input('name',item.name,{required:true}))}${field('协议',select('protocol',[['TCP','TCP'],['UDP','UDP'],['TCP/UDP','TCP/UDP'],['ICMP','ICMP'],['ALL','ALL']],item.protocol))}
      ${field('源地址',input('source',item.source))}${field('目标地址',input('destination',item.destination))}
      ${field('源端口',input('sourcePort',item.sourcePort))}${field('目标端口',input('destinationPort',item.destinationPort))}
      ${field('入接口',select('inbound',[['任意','任意'],['WAN','WAN'],['lan-servers','lan-servers'],['lan-services','lan-services']],item.inbound))}
      ${field('出接口',select('outbound',[['任意','任意'],['WAN','WAN'],['lan-servers','lan-servers'],['lan-services','lan-services']],item.outbound))}
      ${field('动作',select('action',[['放行','放行'],['拒绝','拒绝'],['DNAT','DNAT'],['SNAT','SNAT'],['限速','限速']],item.action))}
    </div><div class="check-grid" style="margin-top:12px"><label class="check-line"><input type="checkbox" name="enabled" ${item.enabled?'checked':''}>启用规则</label><label class="check-line"><input type="checkbox" name="log">记录命中日志</label></div>${formActions()}</form>`,
    onMount(root) {
      root.querySelector('[data-action="cancel"]').addEventListener('click',closeDrawer);
      root.querySelector('#firewall-form').addEventListener('submit',(event)=>{
        event.preventDefault(); const data=new FormData(event.currentTarget);
        if (!String(data.get('name')).trim()) return toast('规则名称不能为空。','error');
        mutate((state)=>{
          const values={name:data.get('name'),protocol:data.get('protocol'),source:data.get('source'),destination:data.get('destination'),sourcePort:data.get('sourcePort'),destinationPort:data.get('destinationPort'),inbound:data.get('inbound'),outbound:data.get('outbound'),action:data.get('action'),enabled:data.get('enabled')==='on'};
          if(rule) Object.assign(state.firewallRules.find((entry)=>entry.id===rule.id),values);
          else state.firewallRules.push({id:`rule-${Date.now()}`,order:state.firewallRules.length+1,hits:0,...values});
        },{source:'firewall'}); closeDrawer(); toast('防火墙规则已保存。');
      });
    }
  });
}

function rulesTable() {
  const state=getState();
  const rows=state.firewallRules.filter((rule)=>!search||[rule.name,rule.source,rule.destination,rule.action].some((value)=>String(value).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>{
    const result=typeof a[sort]==='number'?a[sort]-b[sort]:String(a[sort]).localeCompare(String(b[sort]),'zh-CN'); return direction==='asc'?result:-result;
  });
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>排序</th><th>启用</th><th><button class="sort-button" data-firewall-sort="protocol">协议</button></th><th>规则名称</th><th>源地址</th><th>目标地址</th><th>源端口</th><th>目标端口</th><th>入接口</th><th>出接口</th><th>动作</th><th><button class="sort-button" data-firewall-sort="hits">命中计数</button></th><th>操作</th></tr></thead><tbody>${rows.map((rule)=>`<tr data-rule-id="${rule.id}"><td><div class="row-actions"><button class="row-action" data-rule-move="-1">↑</button><button class="row-action" data-rule-move="1">↓</button></div></td><td>${toggle({checked:rule.enabled,label:`切换 ${rule.name}`,action:'rule-toggle'})}</td><td>${escapeHtml(rule.protocol)}</td><td><strong>${escapeHtml(rule.name)}</strong></td><td class="mono">${escapeHtml(rule.source)}</td><td class="mono">${escapeHtml(rule.destination)}</td><td>${escapeHtml(rule.sourcePort)}</td><td>${escapeHtml(rule.destinationPort)}</td><td>${escapeHtml(rule.inbound)}</td><td>${escapeHtml(rule.outbound)}</td><td>${statusBadge(rule.action==='拒绝'?'fault':rule.action==='限速'?'warning':'online',rule.action)}</td><td>${formatInteger(rule.hits)}</td><td><div class="row-actions"><button class="row-action" data-rule-edit>编辑</button><button class="row-action" data-rule-copy>复制</button><button class="row-action danger" data-rule-delete>删除</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function conntrackPage() {
  const state=getState();
  return `<div class="stats-grid">${[['当前连接',formatInteger(state.system.conntrack),'blue'],['容量',formatInteger(state.system.conntrackMax),'purple'],['TCP established','8,421','green'],['NAT 会话','6,842','cyan']].map(([label,value,tone],index)=>`<article class="stat-card ${tone}"><span class="stat-icon">${['C','Σ','T','N'][index]}</span><div><span>${label}</span><strong>${value}</strong><small>模拟 conntrack 采样</small></div></article>`).join('')}</div>
    ${panel('连接跟踪查询', `<div class="toolbar"><input class="input" placeholder="源/目标地址、端口或协议"><button class="button primary" data-conntrack-query>查询</button><button class="button" data-conntrack-clear>清除筛选</button></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>协议</th><th>状态</th><th>源地址</th><th>源端口</th><th>目标地址</th><th>目标端口</th><th>NAT 出口</th><th>剩余时间</th></tr></thead><tbody>${Array.from({length:12},(_,index)=>`<tr><td>${index%3?'TCP':'UDP'}</td><td>${statusBadge('online',index%3?'ESTABLISHED':'ASSURED')}</td><td class="mono">10.20.10.${30+index}</td><td>${32000+index*137}</td><td class="mono">203.0.113.${80+index}</td><td>${index%3?443:53}</td><td class="mono">wan-${String(index+1).padStart(2,'0')}</td><td>${120-index*4}s</td></tr>`).join('')}</tbody></table></div>`)}`;
}

export function renderFirewall(route){
  const [title,description]=pageMeta[route];
  const conntrack=route==='firewall/conntrack';
  const extra=route==='firewall/dmz'?'<div class="notice warning"><span>!</span><div><strong>DMZ 风险提示</strong><p>DMZ 会扩大服务器暴露面；此预览不会创建真实映射。</p></div></div>':'';
  return {
    html:`${pageHeader(title,description,conntrack?'': '<button class="button primary" data-rule-add>+ 新增规则</button>')}${conntrack?conntrackPage():`${extra}${panel(title,`<div class="toolbar"><div class="search-input"><input class="input" value="${escapeHtml(search)}" data-firewall-search placeholder="搜索规则、地址或动作"></div><span class="toolbar-spacer"></span><span>共 ${getState().firewallRules.length} 条规则</span></div>${rulesTable()}`)}`}`,
    mount(root){
      if(conntrack){root.querySelectorAll('[data-conntrack-query],[data-conntrack-clear]').forEach((button)=>button.addEventListener('click',()=>toast('连接跟踪查询已完成。','info')));return;}
      root.querySelector('[data-rule-add]').addEventListener('click',()=>editRule());
      root.querySelector('[data-firewall-search]').addEventListener('input',(event)=>{search=event.target.value;window.dispatchEvent(new CustomEvent('linehub:rerender'));});
      root.querySelectorAll('[data-firewall-sort]').forEach((button)=>button.addEventListener('click',()=>{direction=sort===button.dataset.firewallSort&&direction==='asc'?'desc':'asc';sort=button.dataset.firewallSort;window.dispatchEvent(new CustomEvent('linehub:rerender'));}));
      root.querySelectorAll('[data-rule-id]').forEach((row)=>{
        const find=()=>getState().firewallRules.find((rule)=>rule.id===row.dataset.ruleId);
        row.querySelector('[data-action="rule-toggle"]').addEventListener('change',(event)=>{mutate((state)=>{const rule=state.firewallRules.find((item)=>item.id===row.dataset.ruleId);if(rule)rule.enabled=event.target.checked;},{source:'firewall'});toast('规则状态已更新。');});
        row.querySelector('[data-rule-edit]').addEventListener('click',()=>editRule(find()));
        row.querySelector('[data-rule-copy]').addEventListener('click',()=>{mutate((state)=>{const source=state.firewallRules.find((item)=>item.id===row.dataset.ruleId);state.firewallRules.push({...source,id:`rule-${Date.now()}`,name:`${source.name} 副本`,order:state.firewallRules.length+1,hits:0});},{source:'firewall'});toast('规则已复制。');});
        row.querySelector('[data-rule-delete]').addEventListener('click',async()=>{const rule=find();if(await confirmAction(`确定删除规则“${rule.name}”？`,'删除')){mutate((state)=>{state.firewallRules=state.firewallRules.filter((item)=>item.id!==row.dataset.ruleId);state.firewallRules.forEach((item,index)=>{item.order=index+1;});},{source:'firewall'});toast('规则已删除。');}});
        row.querySelectorAll('[data-rule-move]').forEach((button)=>button.addEventListener('click',()=>{mutate((state)=>{const index=state.firewallRules.findIndex((item)=>item.id===row.dataset.ruleId);const target=Math.min(state.firewallRules.length-1,Math.max(0,index+Number(button.dataset.ruleMove)));if(index===target)return;const[item]=state.firewallRules.splice(index,1);state.firewallRules.splice(target,0,item);state.firewallRules.forEach((entry,position)=>{entry.order=position+1;});},{source:'firewall'});toast('规则顺序已调整。');}));
      });
    }
  };
}
