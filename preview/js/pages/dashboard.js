import { getState, mutate } from '../store.js';
import { escapeHtml, formatInteger, formatSpeed, pageHeader, panel, progressBar, statCard, statusBadge, toast } from '../components.js';
import { navigate } from '../router.js';

function counts(state) {
  const enabled = state.wanLines.filter((line) => line.enabled);
  return {
    total: state.wanLines.length,
    online: enabled.filter((line) => line.status === 'online').length,
    dialing: enabled.filter((line) => line.status === 'dialing').length,
    fault: enabled.filter((line) => line.status === 'fault').length,
    disabled: state.wanLines.filter((line) => !line.enabled).length,
    ipv4: enabled.filter((line) => line.status === 'online' && line.ipv4Enabled).length,
    ipv6: enabled.filter((line) => line.status === 'online' && line.ipv6Enabled).length,
    pd: enabled.filter((line) => line.status === 'online' && line.requestPd && line.pd !== '--').length
  };
}

function trafficChart() {
  return `<div class="chart-wrap"><canvas class="chart-canvas" id="traffic-chart" aria-label="最近24小时流量曲线"></canvas></div>`;
}

function drawTrafficChart(canvas) {
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, Math.floor(box.width * ratio));
  canvas.height = Math.max(150, Math.floor(box.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = box.width;
  const height = box.height;
  const pad = { left: 38, right: 12, top: 12, bottom: 23 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const upload = [22,18,15,14,12,18,27,36,48,57,52,46,44,51,63,69,72,65,58,76,82,61,49,38];
  const download = [62,54,49,43,39,56,88,121,168,202,188,174,181,224,268,294,312,286,271,338,361,288,221,167];
  const max = 400;

  context.strokeStyle = '#e5eaf0';
  context.fillStyle = '#8794a5';
  context.font = '9px Segoe UI';
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + chartHeight * (i / 4);
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(`${max - i * 100}`, 7, y + 3);
  }
  ['00:00','04:00','08:00','12:00','16:00','20:00','24:00'].forEach((label, index) => {
    const x = pad.left + chartWidth * (index / 6);
    context.fillText(label, x - 12, height - 5);
  });

  const drawSeries = (values, color, fill) => {
    context.beginPath();
    values.forEach((value, index) => {
      const x = pad.left + chartWidth * (index / (values.length - 1));
      const y = pad.top + chartHeight - (value / max) * chartHeight;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    if (fill) {
      context.lineTo(width - pad.right, pad.top + chartHeight);
      context.lineTo(pad.left, pad.top + chartHeight);
      context.closePath();
      context.fillStyle = fill;
      context.fill();
    }
  };
  drawSeries(download, '#1677ff', 'rgba(22,119,255,.07)');
  drawSeries(upload, '#0e9b6b');
}

function runtimePage() {
  const state = getState();
  const c = counts(state);
  const conntrackRate = Math.round((state.system.conntrack / state.system.conntrackMax) * 100);
  const topLines = state.wanLines.filter((line) => line.status === 'online').sort((a, b) => b.download - a.download).slice(0, 7);
  const alertRows = state.alerts.filter((alert) => !alert.acknowledged).slice(0, 5);
  const actions = `<button class="button primary" type="button" data-dashboard-action="add">+ 新增线路</button>
    <button class="button" type="button" data-dashboard-action="diagnose">运行诊断</button>`;

  return `${pageHeader('运行概况', '系统资源、WAN 线路、连接与告警的实时演示总览。', actions)}
    <div class="stats-grid">
      ${statCard({ label: 'WAN 总数', value: c.total, detail: `${c.online} 在线 · ${c.dialing} 拨号中`, tone: 'blue', icon: 'W' })}
      ${statCard({ label: '在线线路', value: c.online, detail: `${c.fault} 故障 · ${c.disabled} 停用`, tone: 'green', icon: '↗' })}
      ${statCard({ label: 'IPv4 / IPv6 在线', value: `${c.ipv4} / ${c.ipv6}`, detail: `${c.pd} 个有效 IPv6-PD`, tone: 'purple', icon: '46' })}
      ${statCard({ label: '当前总下行', value: formatSpeed(state.system.download), detail: `上行 ${formatSpeed(state.system.upload)}`, tone: 'cyan', icon: '↓' })}
      ${statCard({ label: '活动连接数', value: formatInteger(state.system.conntrack), detail: `conntrack ${conntrackRate}%`, tone: conntrackRate > 70 ? 'orange' : 'blue', icon: 'C' })}
      ${statCard({ label: '未处理告警', value: state.alerts.filter((alert) => !alert.acknowledged).length, detail: `${state.alerts.filter((alert) => alert.severity === 'critical' && !alert.acknowledged).length} 个严重告警`, tone: 'red', icon: '!' })}
    </div>
    <div class="grid main-side">
      <div class="grid">
        ${panel('最近 24 小时流量', trafficChart(), {
          subtitle: '模拟聚合吞吐 · Mbps',
          tools: '<div class="chart-legend"><span><i></i>下行</span><span><i class="green"></i>上行</span></div>'
        })}
        ${panel('WAN 实时速率', `<div class="metric-list">${topLines.map((line) => `<div class="metric-line"><strong>${escapeHtml(line.id)} · ${escapeHtml(line.name)}</strong><span>↑ ${formatSpeed(line.upload)}</span><span>↓ ${formatSpeed(line.download)}</span><span>${line.latency} ms</span></div>`).join('')}</div>`, { subtitle: '按当前下行速率排序' })}
      </div>
      <div class="grid">
        ${panel('系统资源', `<div class="panel-content pad">
          <div class="resource-row"><span>CPU 使用率</span>${progressBar(state.system.cpu)}<strong>${state.system.cpu}%</strong></div>
          <div class="resource-row"><span>内存使用率</span>${progressBar(state.system.memory, 'purple')}<strong>${state.system.memory}%</strong></div>
          <div class="resource-row"><span>磁盘使用率</span>${progressBar(state.system.disk, 'green')}<strong>${state.system.disk}%</strong></div>
          <div class="resource-row"><span>系统温度</span>${progressBar(state.system.temperature, state.system.temperature > 70 ? 'red' : 'orange')}<strong>${state.system.temperature}°C</strong></div>
          <div class="resource-row"><span>Conntrack</span>${progressBar(conntrackRate, conntrackRate > 70 ? 'red' : 'blue')}<strong>${conntrackRate}%</strong></div>
          <div class="resource-row"><span>运行时间</span><span></span><strong>${escapeHtml(state.system.uptime.split(' ')[0])}天</strong></div>
        </div>`) }
        ${panel('快捷操作', `<div class="quick-actions">
          <button class="quick-action" data-dashboard-action="add"><span>+</span><strong>新增线路</strong><small>建立 PPPoE 会话</small></button>
          <button class="quick-action" data-dashboard-action="import"><span>⇩</span><strong>批量导入</strong><small>解析多条线路</small></button>
          <button class="quick-action" data-dashboard-action="redial"><span>↻</span><strong>全部重拨</strong><small>仅修改模拟状态</small></button>
          <button class="quick-action" data-dashboard-action="diagnose"><span>⌁</span><strong>运行诊断</strong><small>打开模拟工具</small></button>
        </div>`) }
        ${panel('最近告警', `<div class="alert-list">${alertRows.map((alert) => `<div class="alert-item">${statusBadge(alert.severity)}<div><strong>${escapeHtml(alert.message)}</strong><p>${escapeHtml(alert.source)}</p></div><span class="alert-time">${escapeHtml(alert.time)}</span></div>`).join('')}</div>`, { tools: '<button class="button link" data-dashboard-action="alerts">查看全部</button>' })}
      </div>
    </div>`;
}

function topologyPage() {
  const state = getState();
  const online = state.wanLines.filter((line) => line.status === 'online').length;
  const nodes = [
    ['IN', '光猫 / 交换机', '4 个上联设备', '外部链路正常'],
    ['NIC', '物理网卡', `${state.interfaces.length} 个接口`, `${state.interfaces.filter((item) => item.link === 'up').length} 个已连接`],
    ['V', 'VLAN', `${state.vlans.length} 个子接口`, `${state.vlans.filter((item) => item.enabled).length} 个已启用`],
    ['P', 'PPPoE 会话', `${state.wanLines.length} 条线路`, `${online} 条在线`],
    ['LB', '线路池', `${state.pools.length} 个池`, `${state.pools.reduce((sum, pool) => sum + pool.online, 0)} 个在线成员`],
    ['LAN', 'LAN 网桥', '2 个业务网段', state.settings.ipv4Cidr],
    ['SRV', '服务器', `${state.servers.length} 台`, `${state.servers.filter((server) => server.online).length} 台在线`]
  ];
  return `${pageHeader('网络拓扑', '从接入设备到服务器的 LineHub 数据平面关系。', '<button class="button" data-dashboard-action="refresh">刷新拓扑</button>')}
    ${panel('逻辑连接视图', `<div class="topology">${nodes.map(([icon, title, detail, status]) => `<article class="topology-node"><span class="node-icon">${icon}</span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span><small>● ${escapeHtml(status)}</small></article>`).join('')}</div>`, { subtitle: '所有节点均为静态模拟数据' })}
    <div class="grid cols-3" style="margin-top:12px">
      ${panel('接入层', '<div class="panel-content pad">6 个物理端口承载 12 个 VLAN，接口与子接口状态独立监控。</div>')}
      ${panel('会话与汇聚', '<div class="panel-content pad">24 个 PPPoE 会话分配至 3 个线路池，支持故障摘除与会话粘性。</div>')}
      ${panel('业务出口', '<div class="panel-content pad">6 台服务器通过策略路由选择 IPv4 与 IPv6 出口，保持源进源出。</div>')}
    </div>`;
}

function alertsPage() {
  const state = getState();
  const rows = state.alerts.map((alert) => `<tr><td>${statusBadge(alert.severity)}</td><td><strong>${escapeHtml(alert.source)}</strong></td><td>${escapeHtml(alert.message)}</td><td>${escapeHtml(alert.time)}</td><td>${alert.acknowledged ? statusBadge('disabled', '已确认') : statusBadge('warning', '待处理')}</td><td><button class="row-action" data-alert-id="${escapeHtml(alert.id)}" ${alert.acknowledged ? 'disabled' : ''}>确认</button></td></tr>`).join('');
  return `${pageHeader('告警中心', '集中查看链路、拨号、IPv6、容量与系统模拟异常。', '<button class="button" data-dashboard-action="ack-all">全部确认</button>')}
    <div class="stats-grid">
      ${statCard({ label: '严重', value: state.alerts.filter((item) => item.severity === 'critical' && !item.acknowledged).length, detail: '需要立即处理', tone: 'red', icon: '!' })}
      ${statCard({ label: '警告', value: state.alerts.filter((item) => item.severity === 'warning' && !item.acknowledged).length, detail: '链路质量或容量', tone: 'orange', icon: '△' })}
      ${statCard({ label: '已确认', value: state.alerts.filter((item) => item.acknowledged).length, detail: '保留历史记录', tone: 'green', icon: '✓' })}
    </div>
    ${panel('活动告警', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>级别</th><th>来源</th><th>告警内容</th><th>发生时间</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`)}`;
}

function resourcesPage() {
  const state = getState();
  const resources = [
    ['CPU', state.system.cpu, '4 核 · 2.40 GHz', 'blue'], ['内存', state.system.memory, '4.6 / 8.0 GB', 'purple'],
    ['系统盘', state.system.disk, '6.7 / 16.0 GB', 'green'], ['温度', state.system.temperature, `${state.system.temperature}°C / 90°C`, 'orange'],
    ['Conntrack', Math.round(state.system.conntrack / state.system.conntrackMax * 100), `${formatInteger(state.system.conntrack)} / ${formatInteger(state.system.conntrackMax)}`, 'cyan'],
    ['日志缓冲区', 31, '2.5 / 8.0 MB', 'green']
  ];
  return `${pageHeader('系统资源', '处理器、内存、存储和内核容量的模拟监控。', '<button class="button" data-dashboard-action="refresh">刷新采样</button>')}
    <div class="grid cols-3">${resources.map(([name, value, detail, tone]) => `<article class="feature-card"><span>${escapeHtml(name.slice(0,2))}</span><h3>${escapeHtml(name)} · ${value}%</h3><p>${escapeHtml(detail)}</p><div style="margin-top:12px">${progressBar(value, tone)}</div></article>`).join('')}</div>
    <div class="grid cols-2" style="margin-top:12px">
      ${panel('系统信息', `<div class="panel-content pad"><div class="resource-row"><span>主机名</span><span></span><strong>${escapeHtml(state.system.hostname)}</strong></div><div class="resource-row"><span>平台</span><span></span><strong>LineHub Edge</strong></div><div class="resource-row"><span>系统</span><span></span><strong>${escapeHtml(state.system.kernel)}</strong></div><div class="resource-row"><span>运行时间</span><span></span><strong>${escapeHtml(state.system.uptime)}</strong></div></div>`)}
      ${panel('容量建议', '<div class="panel-content pad"><div class="notice"><span>i</span><div><strong>系统容量充足</strong><p>当前 CPU、内存和 conntrack 使用率均低于演示告警阈值。</p></div></div><div class="notice warning"><span>!</span><div><strong>灾备出口池容量不足</strong><p>建议增加至少 2 条在线成员，或降低业务出口池故障切换比例。</p></div></div></div>')}
    </div>`;
}

export function renderDashboard(route) {
  const html = route === 'overview/topology' ? topologyPage()
    : route === 'overview/alerts' ? alertsPage()
      : route === 'overview/resources' ? resourcesPage() : runtimePage();
  return {
    html,
    mount(root) {
      drawTrafficChart(root.querySelector('#traffic-chart'));
      root.querySelectorAll('[data-dashboard-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.dashboardAction;
          if (action === 'add') navigate('wans/add');
          else if (action === 'import') navigate('wans/import');
          else if (action === 'diagnose') navigate('diagnostics/tools');
          else if (action === 'alerts') navigate('overview/alerts');
          else if (action === 'redial') {
            mutate((state) => state.wanLines.forEach((line) => { if (line.enabled) line.status = 'dialing'; }), { source: 'dashboard' });
            toast('全部已启用线路进入模拟重拨状态。');
          } else if (action === 'ack-all') {
            mutate((state) => state.alerts.forEach((alert) => { alert.acknowledged = true; }), { source: 'alerts' });
            toast('全部告警已确认。');
          } else toast('模拟数据已刷新。', 'info');
        });
      });
      root.querySelectorAll('[data-alert-id]').forEach((button) => button.addEventListener('click', () => {
        mutate((state) => {
          const alert = state.alerts.find((item) => item.id === button.dataset.alertId);
          if (alert) alert.acknowledged = true;
        }, { source: 'alerts' });
        toast('告警已确认。');
      }));
    }
  };
}
