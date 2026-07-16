import { getState, mutate } from '../store.js';
import { closeDrawer, escapeHtml, field, formActions, formatSpeed, input, openDrawer, pageHeader, panel, progressBar, select, statusBadge, toast } from '../components.js';

function editPool(pool) {
  openDrawer({
    title: `编辑 ${pool.name}`,
    body: `<form id="pool-form"><div class="form-grid">
      ${field('线路池名称', input('name', pool.name, { required: true }))}
      ${field('算法', select('algorithm', [['加权轮询','加权轮询'],['源地址哈希','源地址哈希'],['最低延迟','最低延迟'],['主备模式','主备模式']], pool.algorithm))}
      ${field('故障策略', select('failover', [['自动摘除','自动摘除'],['最低延迟','最低延迟'],['容量不足告警','容量不足告警'],['手动切换','手动切换']], pool.failover))}
      ${field('最小在线成员', input('minimum', 2, { type: 'number', min: 1, max: 24 }))}
    </div><div class="notice"><span>i</span><div><strong>池成员</strong><p>当前 ${pool.members} 个成员，${pool.online} 个在线；成员调整可在线路列表中批量完成。</p></div></div>${formActions()}</form>`,
    onMount(root) {
      root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      root.querySelector('#pool-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        mutate((state) => { const target = state.pools.find((item) => item.id === pool.id); if (target) Object.assign(target, { name: data.get('name'), algorithm: data.get('algorithm'), failover: data.get('failover') }); }, { source: 'pools' });
        closeDrawer(); toast(`${pool.name} 配置已保存。`);
      });
    }
  });
}

function poolPage() {
  const state = getState();
  const rows = state.pools.map((pool) => `<tr data-pool-id="${escapeHtml(pool.id)}"><td><strong>${escapeHtml(pool.name)}</strong></td><td>${pool.members}</td><td>${pool.online}</td><td>${pool.ipv4}</td><td>${pool.ipv6}</td><td>${pool.weight}</td><td>${formatSpeed(pool.speed)}</td><td>${escapeHtml(pool.algorithm)}</td><td>${pool.failover === '容量不足告警' ? statusBadge('warning', pool.failover) : escapeHtml(pool.failover)}</td><td><button class="row-action" data-pool-edit>编辑</button></td></tr>`).join('');
  return `${pageHeader('线路池', '将多条 WAN 组织为可监控、可故障切换的出口资源池。', '<button class="button primary" data-pool-add>+ 新建线路池</button>')}
    <div class="grid cols-3">${state.pools.map((pool,index) => `<article class="feature-card"><span>P${index + 1}</span><h3>${escapeHtml(pool.name)}</h3><p>${pool.online} / ${pool.members} 在线 · ${formatSpeed(pool.speed)} · 总权重 ${pool.weight}</p><div style="margin-top:10px">${progressBar(pool.online / pool.members * 100, pool.online / pool.members < .6 ? 'orange' : 'green')}</div></article>`).join('')}</div>
    <div style="margin-top:12px">${panel('线路池列表', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>池名称</th><th>成员线路</th><th>在线成员</th><th>IPv4 成员</th><th>IPv6 成员</th><th>总权重</th><th>当前总速率</th><th>算法</th><th>故障策略</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`)}</div>`;
}

function healthPage() {
  const state = getState();
  const lines = state.wanLines.slice(0, 12);
  return `${pageHeader('健康检查', '配置 ICMP、TCP 与 DNS 多目标探测及失败/恢复阈值。', '<button class="button primary" data-health-add>+ 新建检查器</button>')}
    <div class="stats-grid">
      ${[['健康目标',18,'green'],['异常目标',4,'orange'],['检查间隔','5s','blue'],['平均延迟','39ms','purple']].map(([label,value,tone],index) => `<article class="stat-card ${tone}"><span class="stat-icon">${['✓','!','T','ms'][index]}</span><div><span>${label}</span><strong>${value}</strong><small>多目标实时探测</small></div></article>`).join('')}
    </div>
    <div class="grid main-side">
      ${panel('检查历史曲线', '<div class="chart-wrap"><canvas id="health-chart" class="chart-canvas"></canvas></div>', { subtitle: '最近 60 分钟模拟延迟' })}
      ${panel('检查参数', '<div class="panel-content pad"><div class="resource-row"><span>检查类型</span><span></span><strong>ICMP + TCP + DNS</strong></div><div class="resource-row"><span>检查间隔</span><span></span><strong>5 秒</strong></div><div class="resource-row"><span>超时</span><span></span><strong>2 秒</strong></div><div class="resource-row"><span>失败阈值</span><span></span><strong>3 次</strong></div><div class="resource-row"><span>恢复阈值</span><span></span><strong>2 次</strong></div></div>')}
    </div>
    <div style="margin-top:12px">${panel('线路探测状态', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>WAN ID</th><th>检查器</th><th>目标</th><th>延迟</th><th>丢包</th><th>状态</th></tr></thead><tbody>${lines.map((line) => `<tr><td class="mono">${line.id}</td><td>${escapeHtml(line.healthcheck)}</td><td class="mono">1.1.1.1 / 223.5.5.5</td><td>${line.latency || '--'} ms</td><td>${line.loss}%</td><td>${statusBadge(line.issue ? 'warning' : line.status === 'online' ? 'healthy' : 'disabled')}</td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}

function drawHealth(root) {
  const canvas = root.querySelector('#health-chart');
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = box.width * ratio; canvas.height = box.height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio,ratio);
  ctx.strokeStyle = '#e4e9ef';
  for (let y = 20; y < box.height; y += 35) { ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(box.width - 10,y); ctx.stroke(); }
  const values = [22,18,24,31,28,34,46,39,42,38,71,58,49,36,33,29,25,31,27,24,22,19,26,23,20,18,21,24,28,25];
  ctx.beginPath(); values.forEach((value,index) => { const x = 30 + (box.width - 45) * index/(values.length-1); const y = box.height - 18 - value; if (index) ctx.lineTo(x,y); else ctx.moveTo(x,y); }); ctx.strokeStyle='#1677ff'; ctx.lineWidth=2; ctx.stroke();
}

export function renderPools(route) {
  const isHealth = route === 'aggregation/health';
  return {
    html: isHealth ? healthPage() : poolPage(),
    mount(root) {
      if (isHealth) {
        drawHealth(root);
        root.querySelector('[data-health-add]')?.addEventListener('click', () => toast('检查器模板已创建。'));
        return;
      }
      root.querySelectorAll('[data-pool-id]').forEach((row) => row.querySelector('[data-pool-edit]').addEventListener('click', () => editPool(getState().pools.find((pool) => pool.id === row.dataset.poolId))));
      root.querySelector('[data-pool-add]')?.addEventListener('click', () => toast('已创建一个本地演示线路池。'));
    }
  };
}
