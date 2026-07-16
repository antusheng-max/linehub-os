import { getState, mutate } from '../store.js';
import { escapeHtml, pageHeader, panel, progressBar, statusBadge, toast } from '../components.js';

const algorithms = [
  ['weighted','加权轮询','按线路权重依次分配新连接'], ['source','按源地址哈希','同一源地址保持相同出口'],
  ['pair','按源和目标哈希','源与目标组合决定出口'], ['connections','按连接数','优先分配到连接较少的线路'],
  ['latency','最低延迟','优先选择当前延迟最低线路'], ['failover','主备模式','主线路不可用时切换备用线路']
];

let activeAlgorithm = 'weighted';

function balancingPage() {
  const state = getState();
  const online = state.wanLines.filter((line) => line.status === 'online').slice(0, 8);
  const total = online.reduce((sum, line) => sum + line.connections, 0) || 1;
  return `${pageHeader('负载均衡', '配置连接级分配算法、粘性会话和实际分配比例。', '<button class="button primary" data-balance-save>保存负载策略</button>')}
    <div class="notice"><span>i</span><div><strong>连接级负载均衡说明</strong><p>多线负载均衡分配不同连接，不代表单个 TCP 连接带宽叠加。</p></div></div>
    <div class="grid main-side">
      ${panel('分配算法', `<div class="feature-grid" style="padding:12px;grid-template-columns:repeat(2,minmax(0,1fr))">${algorithms.map(([id,name,description]) => `<button class="feature-card ${activeAlgorithm === id ? 'selected' : ''}" type="button" data-algorithm="${id}" style="text-align:left;cursor:pointer;border-color:${activeAlgorithm === id ? '#80b5ef' : ''};background:${activeAlgorithm === id ? '#f2f8ff' : ''}"><span>${name.slice(0,1)}</span><h3>${name}</h3><p>${description}</p></button>`).join('')}</div>`) }
      ${panel('会话参数', `<div class="panel-content pad"><label class="check-line"><input type="checkbox" checked>启用粘性会话</label><div class="form-grid" style="margin-top:10px"><label class="form-field"><span>会话保持时间</span><input class="input" value="900" type="number"></label><label class="form-field"><span>重平衡阈值</span><input class="input" value="15" type="number"></label><label class="form-field"><span>新连接采样窗口</span><select class="select"><option>60 秒</option><option>300 秒</option></select></label><label class="form-field"><span>不可用线路处理</span><select class="select"><option>立即摘除</option><option>逐步迁移</option></select></label></div></div>`) }
    </div>
    <div class="grid cols-2" style="margin-top:12px">
      ${panel('新连接实际分配占比', `<div class="distribution-list">${online.map((line) => { const share = Math.round(line.connections/total*100); return `<div class="distribution-row"><strong>${escapeHtml(line.id)} · ${escapeHtml(line.name)}</strong>${progressBar(share, line.latency > 100 ? 'orange' : 'blue')}<span>${share}%</span></div>`; }).join('')}</div>`, { subtitle: '最近 5 分钟模拟数据' })}
      ${panel('最近连接分配记录', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>源地址</th><th>目标</th><th>出口</th><th>算法</th></tr></thead><tbody>${online.slice(0,7).map((line,index) => `<tr><td class="mono">11:${String(58-index).padStart(2,'0')}:2${index}</td><td class="mono">10.20.10.${30+index}</td><td class="mono">203.0.113.${80+index}:443</td><td>${statusBadge('online', line.id)}</td><td>${escapeHtml(algorithms.find(([id]) => id === activeAlgorithm)?.[1] || '')}</td></tr>`).join('')}</tbody></table></div>`) }
    </div>`;
}

function sessionPage(route) {
  const names = {
    'aggregation/sessions': ['会话分流','按应用、源地址与连接属性选择线路池。'],
    'aggregation/failover': ['故障切换','定义链路故障、容量下降与恢复时的切换行为。'],
    'aggregation/symmetric': ['源进源出','保持入站连接的响应流量从同一 WAN 返回。']
  }[route];
  const cards = route === 'aggregation/sessions'
    ? [['粘性会话','900 秒','已启用'],['新连接分配','12,480 / min','加权轮询'],['跨池迁移','0','稳定']]
    : route === 'aggregation/failover'
      ? [['故障摘除','3 次失败','自动'],['恢复阈值','2 次成功','自动'],['容量保护','灾备出口池','告警中']]
      : [['连接跟踪标记','已启用','fwmark'],['策略表数量','24','每线路独立'],['不对称连接','0','正常']];
  return `${pageHeader(names[0], names[1], '<button class="button primary" data-generic-save>保存配置</button>')}
    <div class="grid cols-3">${cards.map(([label,value,state],index) => `<article class="feature-card"><span>${index+1}</span><h3>${label}</h3><p>${value} · ${state}</p><button class="button compact" data-generic-save>配置</button></article>`).join('')}</div>
    <div style="margin-top:12px">${panel('策略记录', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>优先级</th><th>规则名称</th><th>匹配条件</th><th>目标线路池</th><th>命中数</th><th>状态</th></tr></thead><tbody>${getState().policies.slice(0,6).map((policy) => `<tr><td>${policy.priority}</td><td>${escapeHtml(policy.name)}</td><td>${escapeHtml(policy.match)}</td><td>${escapeHtml(policy.target)}</td><td>${policy.hits.toLocaleString()}</td><td>${statusBadge(policy.enabled ? 'online' : 'disabled')}</td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}

export function renderBalancing(route) {
  const isMain = route === 'aggregation/balancing';
  return {
    html: isMain ? balancingPage() : sessionPage(route),
    mount(root) {
      root.querySelectorAll('[data-algorithm]').forEach((button) => button.addEventListener('click', () => { activeAlgorithm = button.dataset.algorithm; window.dispatchEvent(new CustomEvent('linehub:rerender')); }));
      root.querySelectorAll('[data-balance-save],[data-generic-save]').forEach((button) => button.addEventListener('click', () => toast('多线汇聚策略已保存。')));
    }
  };
}
