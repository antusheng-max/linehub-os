import { exportConfiguration, getState, mutate, resetDemoState, restoreFirstRun } from '../store.js';
import { closeDrawer, confirmAction, escapeHtml, field, formActions, input, openDrawer, pageHeader, panel, select, statusBadge, toggle, toast } from '../components.js';

const pageMeta={
  'system/basic':['基本设置','配置主机名、管理地址、语言和界面偏好。'],
  'system/admins':['管理员','维护本地管理员、角色和登录安全策略。'],
  'system/time':['时间设置','配置时区、NTP 服务器和时间同步状态。'],
  'system/backup':['配置备份','创建不包含明文密码的本地演示配置快照。'],
  'system/restore':['恢复配置','恢复演示配置或重置为初始 24 条线路。'],
  'system/update':['软件更新','查看模拟版本、更新通道和升级检查结果。'],
  'system/services':['服务管理','查看 LineHub 模块、运行状态和模拟重启操作。'],
  'system/logs':['系统日志','查看 20 条系统、拨号、路由与防火墙日志。'],
  'system/power':['重启与关机','执行仅影响界面状态的模拟重启或关机。']
};

function basicPage(route){
  const state=getState();
  if(route==='system/basic'||route==='system/time')return `<div class="grid cols-2">${panel(route==='system/basic'?'设备设置':'时间同步',`<form class="panel-content pad" id="system-form"><div class="form-grid">${route==='system/basic'?`${field('主机名',input('hostname',state.system.hostname))}${field('管理语言',select('language',[['zh-CN','简体中文'],['en-US','English']],'zh-CN'))}${field('管理地址',input('address',state.settings.ipv4Cidr))}${field('界面密度',select('density',[['compact','紧凑'],['comfortable','舒适']],'compact'))}`:`${field('时区',select('timezone',[['Asia/Shanghai','Asia/Shanghai'],['UTC','UTC']],state.settings.timezone))}${field('NTP 服务器',input('ntp',state.settings.ntp))}${field('同步间隔',select('interval',[['3600','1 小时'],['21600','6 小时'],['86400','24 小时']],'21600'))}${field('当前时间',input('current',new Date().toLocaleString('zh-CN'),{type:'text'}))}`}</div><div class="button-row" style="margin-top:13px"><button class="button primary" type="submit">保存设置</button></div></form>`)}${panel('运行信息',`<div class="panel-content pad"><div class="resource-row"><span>设备型号</span><span></span><strong>${escapeHtml(state.system.model)}</strong></div><div class="resource-row"><span>系统版本</span><span></span><strong>${escapeHtml(state.system.kernel)}</strong></div><div class="resource-row"><span>运行时间</span><span></span><strong>${escapeHtml(state.system.uptime)}</strong></div><div class="resource-row"><span>演示数据版本</span><span></span><strong>v${state.version}</strong></div></div>`)}</div>`;
  if(route==='system/admins')return panel('管理员账户',`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>用户名</th><th>角色</th><th>最后登录</th><th>来源</th><th>双因素认证</th><th>状态</th><th>操作</th></tr></thead><tbody><tr><td><strong>admin</strong></td><td>超级管理员</td><td>2026-07-16 11:42</td><td class="mono">192.0.2.100</td><td>${statusBadge('warning','未启用')}</td><td>${statusBadge('online')}</td><td><button class="row-action" data-system-save>编辑</button></td></tr><tr><td><strong>auditor</strong></td><td>只读审计</td><td>2026-07-15 18:20</td><td class="mono">192.0.2.101</td><td>${statusBadge('online','已启用')}</td><td>${statusBadge('online')}</td><td><button class="row-action" data-system-save>编辑</button></td></tr></tbody></table></div>`);
  return '';
}

function maintenancePage(route){
  const state=getState();
  if(route==='system/backup'||route==='system/restore')return `<div class="grid cols-2">${panel('配置快照',`<div class="panel-content pad"><div class="notice"><span>i</span><div><strong>安全快照</strong><p>导出内容不包含任何 PPPoE 明文密码。</p></div></div><div class="button-row"><button class="button primary" data-export-config>生成本地快照</button><button class="button" data-system-save>校验快照</button></div><pre class="config-preview" id="export-preview">等待生成配置快照...</pre></div>`)}${panel('恢复演示数据',`<div class="panel-content pad"><div class="notice warning"><span>!</span><div><strong>仅影响浏览器数据</strong><p>可恢复初始演示数据，或仅重新进入首次配置向导。</p></div></div><div class="button-row"><button class="button danger subtle" data-reset-demo>恢复初始演示数据</button><button class="button" data-restore-first-run>恢复首次配置状态</button></div></div>`)}</div>`;
  if(route==='system/update')return `<div class="grid cols-3"><article class="feature-card"><span>V</span><h3>当前版本</h3><p>LineHub OS Stage 1 Preview</p><button class="button compact" data-system-save>检查更新</button></article><article class="feature-card"><span>C</span><h3>更新通道</h3><p>稳定版 · 自动检查</p><button class="button compact" data-system-save>更改通道</button></article><article class="feature-card"><span>S</span><h3>签名校验</h3><p>软件包签名正常</p><button class="button compact" data-system-save>查看详情</button></article></div>`;
  if(route==='system/services'){
    const services=['linehub-core','linehubd','linehub-firewall','linehub-balance','linehub-diagnostics','rpcd','uhttpd','dnsmasq'];
    return panel('系统服务',`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>服务</th><th>启用</th><th>运行状态</th><th>CPU</th><th>内存</th><th>启动时间</th><th>操作</th></tr></thead><tbody>${services.map((service,index)=>`<tr><td class="mono"><strong>${service}</strong></td><td>${toggle({checked:true,label:`切换 ${service}`,action:'service-toggle'})}</td><td>${statusBadge('online','运行中')}</td><td>${(1.2+index*.7).toFixed(1)}%</td><td>${12+index*4} MB</td><td>${index+2} 天前</td><td><button class="row-action" data-system-save>模拟重启</button></td></tr>`).join('')}</tbody></table></div>`);
  }
  return '';
}

function logsPage(){
  const state=getState();
  return panel('系统日志',`<div class="toolbar"><select class="select"><option>全部级别</option><option>INFO</option><option>WARNING</option><option>ERROR</option></select><select class="select"><option>全部模块</option><option>pppoe</option><option>firewall</option><option>system</option></select><input class="input" placeholder="搜索日志"><button class="button" data-system-save>筛选</button></div><div class="data-table-wrap" style="max-height:650px"><table class="data-table"><thead><tr><th>时间</th><th>级别</th><th>模块</th><th>消息</th></tr></thead><tbody>${state.logs.map((log)=>`<tr><td class="mono">${log.time}</td><td>${statusBadge(log.level==='error'?'fault':log.level)}</td><td>${log.module}</td><td>${escapeHtml(log.message)}</td></tr>`).join('')}</tbody></table></div>`);
}

function powerPage(){
  return `<div class="notice danger"><span>!</span><div><strong>模拟电源操作</strong><p>以下按钮不会重启或关闭 Windows、OpenWrt 或任何真实设备。</p></div></div><div class="grid cols-3"><article class="feature-card"><span>↻</span><h3>重启 LineHub 服务</h3><p>模拟重启核心服务并保留系统状态。</p><button class="button" data-power="services">模拟重启服务</button></article><article class="feature-card"><span>R</span><h3>重启系统</h3><p>显示模拟重启通知，不执行系统命令。</p><button class="button danger subtle" data-power="reboot">模拟重启系统</button></article><article class="feature-card"><span>○</span><h3>关闭系统</h3><p>显示模拟关机通知，不执行系统命令。</p><button class="button danger subtle" data-power="shutdown">模拟关闭系统</button></article></div>`;
}

export function renderSystem(route){
  const[title,description]=pageMeta[route];
  const content=route==='system/logs'?logsPage():route==='system/power'?powerPage():['system/basic','system/time','system/admins'].includes(route)?basicPage(route):maintenancePage(route);
  return{html:`${pageHeader(title,description,route==='system/logs'?'<button class="button" data-system-save>导出日志</button>':'')}${content}`,mount(root){
    root.querySelector('#system-form')?.addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);mutate((state)=>{if(data.has('hostname'))state.system.hostname=data.get('hostname');if(data.has('timezone')){state.settings.timezone=data.get('timezone');state.settings.ntp=data.get('ntp');}},{source:'system'});toast('系统设置已保存。');});
    root.querySelectorAll('[data-system-save],[data-action="service-toggle"]').forEach((element)=>element.addEventListener(element.matches('input')?'change':'click',()=>toast('系统演示配置已保存。')));
    root.querySelector('[data-export-config]')?.addEventListener('click',()=>{root.querySelector('#export-preview').textContent=exportConfiguration().slice(0,5000);toast('安全配置快照已生成。');});
    root.querySelector('[data-reset-demo]')?.addEventListener('click',async()=>{if(await confirmAction('确定恢复初始演示数据？当前本地预览修改将被清除。','恢复')){resetDemoState();toast('已恢复初始演示数据。');}});
    root.querySelector('[data-restore-first-run]')?.addEventListener('click',async()=>{if(await confirmAction('确定重新进入首次配置向导？','进入向导')){restoreFirstRun();toast('已恢复首次配置状态。');}});
    root.querySelectorAll('[data-power]').forEach((button)=>button.addEventListener('click',async()=>{const label=button.dataset.power==='shutdown'?'关机':button.dataset.power==='reboot'?'重启系统':'重启服务';if(await confirmAction(`确认执行“模拟${label}”？不会运行任何真实系统命令。`,'确认模拟'))toast(`模拟${label}流程已完成。`,'info');}));
  }};
}
