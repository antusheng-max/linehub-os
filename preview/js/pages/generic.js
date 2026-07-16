import { getState, mutate } from '../store.js';
import { escapeHtml, pageHeader, panel, progressBar, statusBadge, toggle, toast } from '../components.js';

const networkPages = {
  'network/dhcp': ['DHCP 服务','管理 IPv4 地址池、静态租约、租期和网关/DNS 下发。', ['地址池','静态租约','租期设置','冲突检测']],
  'network/dns': ['DNS 设置','配置上游解析、缓存、分流解析和 DNS 安全策略。', ['上游 DNS','本地缓存','域名分流','查询日志']],
  'network/static-routes': ['静态路由','维护 IPv4/IPv6 目标、网关、接口和路由度量。', ['IPv4 路由','IPv6 路由','路由度量','可达性检测']],
  'network/policy-routes': ['策略路由','按源、目标、协议和标记选择独立线路池或路由表。', ['源地址策略','目标地址策略','协议策略','策略命中']]
};

export function renderNetworkGeneric(route) {
  const [title, description, features] = networkPages[route];
  const rows = Array.from({ length: 8 }, (_, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(`${title.replace('设置','').replace('服务','')}规则 ${String(index + 1).padStart(2,'0')}`)}</strong></td><td class="mono">${route === 'network/dhcp' ? `10.20.${index + 10}.0/24` : route === 'network/dns' ? `domain-${index + 1}.example.invalid` : `203.0.113.${index * 16}/28`}</td><td>${escapeHtml(index % 2 ? '业务出口池' : '核心出口池')}</td><td>${statusBadge(index === 6 ? 'warning' : 'online', index === 6 ? '待检查' : '已启用')}</td><td><button class="row-action" data-generic-edit>编辑</button></td></tr>`).join('');
  return {
    html: `${pageHeader(title, description, '<button class="button primary" data-generic-add>+ 新增配置</button>')}
      <div class="feature-grid">${features.map((feature,index) => `<article class="feature-card"><span>${index + 1}</span><h3>${escapeHtml(feature)}</h3><p>模块化演示配置、状态检查与变更通知。</p><button class="button compact" data-generic-edit>管理</button></article>`).join('')}</div>
      <div style="margin-top:12px">${panel(`${title}列表`, `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>名称</th><th>匹配/地址</th><th>目标</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`)}</div>`,
    mount(root) { root.querySelectorAll('[data-generic-add],[data-generic-edit]').forEach((button) => button.addEventListener('click', () => toast(`${title}演示配置已保存。`))); }
  };
}

const trafficPages = {
  'traffic/smart': ['智能流控','总带宽、每线路与每服务器限制的统一策略入口。'],
  'traffic/bandwidth': ['带宽策略','按线路、服务器、IP 设置上下行独立限速与突发带宽。'],
  'traffic/protocol': ['协议分流','按 HTTP、视频、DNS、下载和 PCDN 等协议特征选择出口。'],
  'traffic/ip': ['IP 分流','按源地址、目标网段和地址组分配线路池。'],
  'traffic/port': ['端口分流','按 TCP/UDP 端口范围执行带宽和出口策略。'],
  'traffic/connections': ['连接数控制','限制最大连接数和新建连接速率，保护 conntrack 容量。'],
  'traffic/qos': ['QoS 优先级','通过 DSCP 与业务分类保障小流量、管理和实时业务。']
};

export function renderTraffic(route) {
  const state = getState();
  const [title, description] = trafficPages[route];
  const rows = state.policies.map((policy) => `<tr data-policy-id="${policy.id}"><td><div class="row-actions"><button class="row-action" data-move="-1">↑</button><button class="row-action" data-move="1">↓</button></div></td><td>${policy.priority}</td><td>${toggle({ checked: policy.enabled, label: `切换 ${policy.name}`, action: 'toggle-policy' })}</td><td><strong>${escapeHtml(policy.name)}</strong></td><td>${escapeHtml(policy.match)}</td><td>${escapeHtml(policy.target)}</td><td>${escapeHtml(policy.uploadLimit)}</td><td>${escapeHtml(policy.downloadLimit)}</td><td>${escapeHtml(policy.dscp)}</td><td>${policy.hits.toLocaleString()}</td><td><button class="row-action" data-policy-edit>编辑</button></td></tr>`).join('');
  return {
    html: `${pageHeader(title, description, '<button class="button" data-bandwidth>总带宽设置</button><button class="button primary" data-policy-add>+ 新增策略</button>')}
      <div class="stats-grid">
        ${[['总上行','500 Mbps',58,'blue'],['总下行','2.5 Gbps',67,'green'],['策略命中','84.3%',84,'purple'],['新建连接','12.4k / min',42,'cyan']].map(([label,value,percent,tone]) => `<article class="stat-card ${tone}"><span class="stat-icon">${label.slice(0,1)}</span><div><span>${label}</span><strong>${value}</strong><small>${percent}% 演示容量</small></div></article>`).join('')}
      </div>
      <div class="grid cols-2">
        ${panel('容量使用', `<div class="panel-content pad"><div class="resource-row"><span>上行利用率</span>${progressBar(58)}<strong>58%</strong></div><div class="resource-row"><span>下行利用率</span>${progressBar(67,'green')}<strong>67%</strong></div><div class="resource-row"><span>Conntrack</span>${progressBar(20,'purple')}<strong>20%</strong></div><div class="resource-row"><span>新建连接速率</span>${progressBar(42,'orange')}<strong>42%</strong></div></div>`) }
        ${panel('智能特性', '<div class="panel-content pad"><div class="check-grid"><label class="check-line"><input type="checkbox" checked>小流量优先</label><label class="check-line"><input type="checkbox" checked>大连接识别</label><label class="check-line"><input type="checkbox" checked>突发带宽</label><label class="check-line"><input type="checkbox">PCDN 严格模式</label></div></div>')}
      </div>
      <div style="margin-top:12px">${panel('分流与流控策略', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>排序</th><th>优先级</th><th>启用</th><th>策略名称</th><th>匹配条件</th><th>目标线路池</th><th>上行限制</th><th>下行限制</th><th>DSCP</th><th>命中统计</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, { subtitle: '使用上下按钮模拟拖动调整策略顺序' })}</div>`,
    mount(root) {
      root.querySelectorAll('[data-policy-id]').forEach((row) => {
        row.querySelector('[data-action="toggle-policy"]').addEventListener('change', (event) => {
          mutate((current) => { const target = current.policies.find((item) => item.id === row.dataset.policyId); if (target) target.enabled = event.target.checked; }, { source: 'traffic' });
          toast('策略状态已更新。');
        });
        row.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => {
          mutate((current) => {
            const index = current.policies.findIndex((item) => item.id === row.dataset.policyId);
            const target = Math.min(current.policies.length - 1, Math.max(0, index + Number(button.dataset.move)));
            if (target === index) return;
            const [item] = current.policies.splice(index, 1); current.policies.splice(target, 0, item);
            current.policies.forEach((policy, position) => { policy.priority = position + 1; });
          }, { source: 'traffic' }); toast('策略顺序已调整。');
        }));
        row.querySelector('[data-policy-edit]').addEventListener('click', () => toast('策略编辑结果已保存。'));
      });
      root.querySelectorAll('[data-bandwidth],[data-policy-add]').forEach((button) => button.addEventListener('click', () => toast(`${title}配置已保存。`)));
    }
  };
}
