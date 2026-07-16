import { getState } from '../store.js';
import { escapeHtml, formatInteger, formatSpeed, pageHeader, panel, progressBar, statCard, statusBadge, toast } from '../components.js';

const pageMeta = {
  'monitoring/traffic': ['实时流量','聚合展示总上行/下行、线路分布与实时吞吐。','吞吐 Mbps'],
  'monitoring/wans': ['WAN 监控','比较各 WAN 的速率、连接数、延迟和丢包。','WAN 吞吐 Mbps'],
  'monitoring/servers': ['服务器流量','按服务器查看上行、下行、连接与业务负载。','服务器吞吐 Mbps'],
  'monitoring/connections': ['连接监控','监控活动连接数与新建连接速率。','连接数'],
  'monitoring/quality': ['线路质量','跟踪延迟、抖动、丢包和健康检查状态。','延迟 ms'],
  'monitoring/history': ['历史统计','按时间范围查看流量、连接与系统资源趋势。','历史流量 Mbps']
};

function drawChart(canvas, variant = 0) {
  if (!canvas) return;
  const box=canvas.getBoundingClientRect(); const ratio=window.devicePixelRatio||1;
  canvas.width=Math.max(400,box.width*ratio);canvas.height=Math.max(160,box.height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const width=box.width,height=box.height,pad={l:38,r:12,t:12,b:22};
  ctx.strokeStyle='#e5eaf0';ctx.fillStyle='#8996a6';ctx.font='9px Segoe UI';ctx.lineWidth=1;
  for(let i=0;i<=4;i+=1){const y=pad.t+(height-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.fillText(String((4-i)*100),7,y+3);}
  const colors=['#1677ff','#0e9b6b','#7655d6'];
  for(let series=0;series<3;series+=1){ctx.beginPath();for(let i=0;i<48;i+=1){const wave=Math.sin((i+series*7)/5)*(35+variant*3)+Math.cos((i+series*3)/3)*18;const value=80+series*70+wave+((i*17+variant*19)%55);const x=pad.l+(width-pad.l-pad.r)*i/47;const y=height-pad.b-(value/400)*(height-pad.t-pad.b);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.strokeStyle=colors[series];ctx.lineWidth=series===0?2:1.5;ctx.stroke();}
}

function chartPanel(id,title,subtitle='最近 30 分钟'){
  return panel(title,`<div class="chart-wrap"><canvas class="chart-canvas" id="${id}"></canvas></div>`,{subtitle,tools:'<div class="chart-legend"><span><i></i>下行</span><span><i class="green"></i>上行</span><span><i class="purple"></i>连接/延迟</span></div>'});
}

function realtimeRows(route){
  const state=getState();
  if(route==='monitoring/servers')return state.servers.map((server)=>`<tr><td>${statusBadge(server.online?'online':'disabled')}</td><td><strong>${escapeHtml(server.name)}</strong></td><td>↑ ${formatSpeed(server.upload)}</td><td>↓ ${formatSpeed(server.download)}</td><td>${formatInteger(server.connections)}</td><td>${server.cpu}%</td><td>${server.disk}%</td></tr>`).join('');
  return state.wanLines.slice(0,14).map((line)=>`<tr><td>${statusBadge(line.status)}</td><td class="mono">${line.id}</td><td>${escapeHtml(line.name)}</td><td>↑ ${formatSpeed(line.upload)}</td><td>↓ ${formatSpeed(line.download)}</td><td>${formatInteger(line.connections)}</td><td class="${line.latency>100?'warning-text':''}">${line.latency||'--'} ms</td><td class="${line.loss>2?'danger-text':''}">${line.loss}%</td></tr>`).join('');
}

export function renderMonitoring(route){
  const state=getState();const[title,description,unit]=pageMeta[route];
  const serverMode=route==='monitoring/servers';
  const tableHeaders=serverMode?'<th>状态</th><th>服务器</th><th>上行</th><th>下行</th><th>连接数</th><th>CPU</th><th>磁盘</th>':'<th>状态</th><th>WAN ID</th><th>线路名称</th><th>上行</th><th>下行</th><th>连接数</th><th>延迟</th><th>丢包</th>';
  return{
    html:`${pageHeader(title,description,'<button class="button" data-monitor-pause>暂停刷新</button><button class="button primary" data-monitor-refresh>立即采样</button>')}
      <div class="stats-grid">
        ${statCard({label:'总上行',value:formatSpeed(state.system.upload),detail:'当前模拟速率',tone:'orange',icon:'↑'})}
        ${statCard({label:'总下行',value:formatSpeed(state.system.download),detail:'当前模拟速率',tone:'green',icon:'↓'})}
        ${statCard({label:'活动连接',value:formatInteger(state.system.conntrack),detail:'conntrack 20%',tone:'blue',icon:'C'})}
        ${statCard({label:'新建连接',value:'12.4k/min',detail:'峰值 18.2k/min',tone:'purple',icon:'N'})}
        ${statCard({label:'平均延迟',value:'38 ms',detail:'8 条采样线路',tone:'cyan',icon:'ms'})}
        ${statCard({label:'平均丢包',value:'0.7%',detail:'2 条异常线路',tone:'orange',icon:'%'})}
      </div>
      <div class="grid cols-2">${chartPanel('monitor-primary',`${title}主趋势`,unit)}${chartPanel('monitor-secondary','连接与系统资源','CPU / 内存 / 连接')}</div>
      <div style="margin-top:12px">${panel(serverMode?'服务器实时指标':'WAN 实时指标',`<div class="data-table-wrap" style="max-height:510px"><table class="data-table"><thead><tr>${tableHeaders}</tr></thead><tbody>${realtimeRows(route)}</tbody></table></div>`)}</div>`,
    mount(root){drawChart(root.querySelector('#monitor-primary'),Object.keys(pageMeta).indexOf(route));drawChart(root.querySelector('#monitor-secondary'),4);root.querySelector('[data-monitor-refresh]').addEventListener('click',()=>{drawChart(root.querySelector('#monitor-primary'),Date.now()%7);toast('监控采样已刷新。','info');});root.querySelector('[data-monitor-pause]').addEventListener('click',(event)=>{event.currentTarget.textContent=event.currentTarget.textContent.includes('暂停')?'继续刷新':'暂停刷新';toast('自动刷新状态已切换。','info');});}
  };
}
