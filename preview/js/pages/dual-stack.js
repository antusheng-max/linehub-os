import { getState, mutate } from '../store.js';
import { closeDrawer, escapeHtml, field, formatSpeed, input, openDrawer, pageHeader, panel, select, toast } from '../components.js';
import { WanSelector } from '../interface-selector.js';

const modeLabels = { auto: '自动', nptv6: 'NPTv6', nat66: 'NAT66', native: '原生路由', disabled: '禁用 IPv6 出口' };
const algorithmLabels = {
  'weighted-connections': '加权连接分配',
  'least-connections': '最少连接',
  'lowest-latency': '最低延迟',
  'source-hash': '源地址哈希',
  failover: '主备模式'
};

function badge(status, label = '') {
  const tone = ['online', 'valid', 'active', 'consistent', 'ESTABLISHED'].includes(status) ? 'good' : ['degraded', 'high-latency', 'pd-failed', 'mismatch', 'DEGRADED'].includes(status) ? 'warn' : ['offline', 'unavailable', 'invalid', 'failed', 'WAN_DOWN', 'PREFIX_INVALID'].includes(status) ? 'bad' : 'neutral';
  const text = label || ({ online: '在线', offline: '离线', unavailable: '不可用', degraded: '质量下降', 'high-latency': '高延迟', 'pd-failed': 'PD 失败', valid: '有效', invalid: '失效', active: '运行中', consistent: '回程一致', mismatch: '回程异常', ESTABLISHED: '已建立', DEGRADED: '异常', WAN_DOWN: 'WAN 断线', PREFIX_INVALID: '前缀失效' }[status] || status);
  return `<span class="ds-badge ${tone}"><i></i>${escapeHtml(text)}</span>`;
}

function modeBadge(mode) {
  return `<span class="translation-badge ${escapeHtml(mode)}">${escapeHtml(mode === 'nptv6' ? 'NPTv6' : mode === 'nat66' ? 'NAT66' : mode === 'native' ? '原生路由' : mode === 'disabled' ? '禁用' : mode)}</span>`;
}

function summaryMetric(label, value, detail = '') {
  return `<div class="ds-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</div>`;
}

function internalAddressBar(state) {
  return `<section class="internal-address-bar"><div><span>LAN 内部 IPv4</span><strong class="mono">${escapeHtml(state.dualStackGateway.lanIpv4Cidr)}</strong><small>RFC1918 · 服务器稳定地址</small></div><div><span>LAN 内部 IPv6 ULA</span><strong class="mono">${escapeHtml(state.dualStackGateway.lanUlaPrefix)}</strong><small>RFC4193 · 不直接在公网路由</small></div><div class="address-separation"><b>双栈独立选路</b><span>IPv4 与 IPv6 分别进入各自出口池</span></div></section>`;
}

const technicalLimits = [
  'LAN 内部 IPv6 是稳定的 ULA 地址。',
  '外部互联网看到的是当前所选 WAN 的真实 IPv6。',
  '多个运营商 IPv6 前缀不能自动合成为一个统一公网 IPv6。',
  '单个 TCP 连接不能同时使用多个 WAN 带宽。',
  'NPTv6 需要 WAN 获得可用 IPv6-PD。',
  'NAT66 适用于没有 PD 但拥有单个公网 IPv6 地址的情况。',
  'IPv6 出口切换可能导致现有连接中断。',
  '真正统一的固定公网 IPv6 需要自有前缀 + BGP 或公网中转隧道。'
];

function limitsPanel(compact = false) {
  return `<section class="dual-limit-panel ${compact ? 'compact' : ''}"><header><span>!</span><div><strong>虚拟双栈汇聚的技术边界</strong><p>以下限制始终适用，预览不会伪造统一公网地址或单连接带宽叠加。</p></div></header><ol>${technicalLimits.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></section>`;
}

function openGatewaySettings() {
  const state = getState();
  const gateway = state.dualStackGateway;
  openDrawer({
    title: '内部双栈地址', kicker: 'STABLE LAN ADDRESSING',
    body: `<form id="dual-gateway-form" class="configuration-form">${field('LAN 内部 IPv4 CIDR', input('ipv4', gateway.lanIpv4Cidr, { required: true }))}${field('LAN 内部 ULA IPv6 前缀', input('ula', gateway.lanUlaPrefix, { required: true }))}${field('IPv4 出口池', select('ipv4Pool', state.ipv4Pools.map((pool) => [pool.id, `${pool.name} · ${pool.id}`]), gateway.ipv4PoolId))}${field('IPv6 出口池', select('ipv6Pool', state.ipv6Pools.map((pool) => [pool.id, `${pool.name} · ${pool.id}`]), gateway.ipv6PoolId))}<div class="switch-cluster"><label class="check-line"><input type="checkbox" name="sticky" ${gateway.stickySessions ? 'checked' : ''}>粘性会话</label><label class="check-line"><input type="checkbox" name="returnPath" ${gateway.returnPathConsistency ? 'checked' : ''}>回程一致性</label><label class="check-line"><input type="checkbox" name="failover" ${gateway.failoverEnabled ? 'checked' : ''}>故障切换</label></div><div class="form-actions"><button class="button" type="button" data-action="cancel">取消</button><button class="button primary" type="submit">保存内部网络</button></div></form>`,
    onMount(root) {
      const form = root.querySelector('#dual-gateway-form');
      root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      form.addEventListener('submit', (event) => {
        event.preventDefault(); const data = new FormData(form); const ipv4 = String(data.get('ipv4')); const ula = String(data.get('ula'));
        if (!/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ipv4)) { toast('内部 IPv4 必须使用 RFC1918 私网地址。', 'error'); return; }
        if (!/^fd[0-9a-f]{2}:/i.test(ula)) { toast('内部 IPv6 必须使用 fd00::/8 范围内的 RFC4193 ULA。', 'error'); return; }
        mutate((draft) => { Object.assign(draft.dualStackGateway, { lanIpv4Cidr: ipv4, lanUlaPrefix: ula, ipv4PoolId: data.get('ipv4Pool'), ipv6PoolId: data.get('ipv6Pool'), stickySessions: data.get('sticky') === 'on', returnPathConsistency: data.get('returnPath') === 'on', failoverEnabled: data.get('failover') === 'on' }); }, { source: 'dual-stack-gateway' });
        closeDrawer(); toast('内部双栈地址已保存；服务器不直接依赖运营商前缀。');
      });
    }
  });
}

function overviewPage() {
  const state = getState();
  const v4 = state.ipv4Pools.find((pool) => pool.id === state.dualStackGateway.ipv4PoolId) || state.ipv4Pools[0];
  const v6 = state.ipv6Pools.find((pool) => pool.id === state.dualStackGateway.ipv6PoolId) || state.ipv6Pools[0];
  const v4Online = v4.lines.filter((line) => line.enabled && line.status === 'online');
  const v6Online = v6.lines.filter((line) => line.enabled && ['online', 'high-latency'].includes(line.status));
  const connections4 = v4.lines.reduce((sum, line) => sum + line.connections, 0);
  const connections6 = state.connectionMappings.filter((item) => item.protocol === 'IPv6').length * 128;
  const v4Metrics = `<div class="ds-metric-grid">${summaryMetric('总线路', String(v4.lines.length))}${summaryMetric('在线', String(v4Online.length))}${summaryMetric('NAT44', String(v4.lines.filter((line) => line.inPool).length))}${summaryMetric('当前连接', connections4.toLocaleString('zh-CN'))}${summaryMetric('当前上行', formatSpeed(v4.lines.reduce((sum, line) => sum + line.tx, 0)))}${summaryMetric('当前下行', formatSpeed(v4.lines.reduce((sum, line) => sum + line.rx, 0)))}</div>`;
  const v6Metrics = `<div class="ds-metric-grid ipv6">${summaryMetric('总线路', String(v6.lines.length))}${summaryMetric('在线', String(v6Online.length))}${summaryMetric('获得 IPv6', String(v6.lines.filter((line) => line.address !== '--').length))}${summaryMetric('获得 PD', String(v6.lines.filter((line) => line.pdStatus === 'valid').length))}${summaryMetric('NPTv6', String(v6.lines.filter((line) => line.resolvedMode === 'nptv6').length))}${summaryMetric('NAT66', String(v6.lines.filter((line) => line.resolvedMode === 'nat66').length))}${summaryMetric('原生路由', String(v6.lines.filter((line) => line.resolvedMode === 'native').length))}${summaryMetric('不可用', String(v6.lines.filter((line) => line.resolvedMode === 'disabled').length))}${summaryMetric('当前连接', connections6.toLocaleString('zh-CN'))}${summaryMetric('当前上行 / 下行', `${formatSpeed(13.1)} / ${formatSpeed(61.9)}`)}</div>`;
  const topology = `<div class="dual-stack-topology"><div class="topology-source"><strong>服务器</strong><span>内部 IPv4<br><b>10.10.10.0/24</b></span><span>内部 ULA IPv6<br><b>fd42:4c69:6e65::/48</b></span></div><div class="topology-arrow">→</div><div class="topology-router"><strong>LineHub 双栈识别</strong><span>按协议族独立建立连接标记</span></div><div class="topology-split"><div class="v4"><b>IPv4</b><span>IPv4 出口池</span><span>NAT44</span><span>真实 IPv4 WAN</span></div><div class="v6"><b>IPv6</b><span>IPv6 出口池</span><span>NPTv6 / NAT66 / 原生</span><span>真实 IPv6 WAN</span></div></div></div>`;
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('虚拟双栈汇聚', '服务器始终使用稳定内部双栈地址；LineHub 为每个连接独立选择真实 IPv4 或 IPv6 出口。', '<button class="button primary" type="button" data-edit-gateway>配置内部双栈</button>')}${internalAddressBar(state)}<div class="dual-overview-grid"><section class="dual-protocol-card v4"><header><div><span>IPv4 EGRESS</span><h2>IPv4 真实线路池</h2></div>${badge(v4Online.length ? 'online' : 'offline')}</header>${v4Metrics}<footer>IPv4 流量 → IPv4 出口池 → NAT44 → 真实 WAN</footer></section><section class="dual-protocol-card v6"><header><div><span>IPv6 EGRESS</span><h2>IPv6 真实线路池</h2></div>${badge(v6Online.length ? 'online' : 'offline')}</header>${v6Metrics}<footer>IPv6 流量 → IPv6 出口池 → NPTv6 / NAT66 / 原生路由 → 真实 WAN</footer></section></div>${panel('双栈流量拓扑', topology, { subtitle: '服务器不会直接感知运营商地址或 PD 变化' })}${limitsPanel()}</div>`,
    mount(root) { root.querySelector('[data-edit-gateway]').addEventListener('click', openGatewaySettings); }
  };
}

function v4LineDrawer(line) {
  openDrawer({
    title: `${line.id} · IPv4 出口`, kicker: 'NAT44 EGRESS LINE',
    body: `<div class="drawer-summary-list"><div><span>接口 / 外部 IPv4</span><strong class="mono">${escapeHtml(`${line.interface} / ${line.realIpv4}`)}</strong></div><div><span>NAT 类型</span><strong>NAT44</strong></div><div><span>质量</span><strong>${line.latency || '--'} ms / ${line.loss}% 丢包</strong></div><div><span>连接 / 实时速率</span><strong>${line.connections.toLocaleString('zh-CN')} / ↑ ${formatSpeed(line.tx)}　↓ ${formatSpeed(line.rx)}</strong></div><div><span>健康检查</span><strong>${line.healthCheck.enabled ? `${line.healthCheck.method} · ${line.healthCheck.targets.join(', ')}` : '已关闭'}</strong></div><div><span>线路角色</span><strong>${line.role === 'primary' ? '主线路' : line.role === 'backup' ? '备用线路' : '普通成员'}</strong></div></div><div class="drawer-action-grid"><button class="button" type="button" data-v4-role="primary">设为主线路</button><button class="button" type="button" data-v4-role="backup">设置备用线路</button><button class="button" type="button" data-v4-health>${line.healthCheck.enabled ? '关闭' : '开启'}健康检查</button><button class="button primary" type="button" data-v4-sessions>查看映射会话</button></div>`,
    onMount(root) {
      root.querySelectorAll('[data-v4-role]').forEach((button) => button.addEventListener('click', () => { mutate((state) => { const pool = state.ipv4Pools[0]; if (button.dataset.v4Role === 'primary') pool.lines.forEach((item) => { if (item.role === 'primary') item.role = 'member'; }); const target = pool.lines.find((item) => item.id === line.id); target.role = button.dataset.v4Role; target.inPool = true; }, { source: 'dual-v4-role' }); closeDrawer(); toast('IPv4 线路角色已更新。'); }));
      root.querySelector('[data-v4-health]').addEventListener('click', () => { mutate((state) => { const target = state.ipv4Pools[0].lines.find((item) => item.id === line.id); target.healthCheck.enabled = !target.healthCheck.enabled; }, { source: 'dual-v4-health' }); closeDrawer(); toast('健康检查状态已更新。'); });
      root.querySelector('[data-v4-sessions]').addEventListener('click', () => { closeDrawer(); window.location.hash = '#/dual-stack/sessions'; window.localStorage.setItem('linehub-preview-session-wan-filter', line.id); });
    }
  });
}

function ipv4PoolPage() {
  const state = getState(); const pool = state.ipv4Pools[0];
  const rows = pool.lines.map((line) => `<tr data-v4-line="${escapeHtml(line.id)}"><td><strong class="mono">${escapeHtml(line.id)}</strong><small>${badge(line.enabled ? line.status : 'offline', line.enabled ? '' : '已禁用')}</small></td><td><strong class="mono">${escapeHtml(line.interface)}</strong><small class="mono">${escapeHtml(line.realIpv4)}</small></td><td><span class="translation-badge nat44">NAT44</span></td><td><strong>${line.latency || '--'} ms</strong><small>${line.loss}% 丢包</small></td><td><input class="table-number-input" type="number" min="1" max="100" value="${line.weight}" data-v4-weight aria-label="${line.id} 权重"></td><td>${line.connections.toLocaleString('zh-CN')}</td><td class="line-rate"><span>↑ ${formatSpeed(line.tx)}</span><span>↓ ${formatSpeed(line.rx)}</span></td><td><label class="pool-check"><input type="checkbox" data-v4-pool ${line.inPool ? 'checked' : ''} ${!line.enabled ? 'disabled' : ''}>加入池</label><label class="pool-check"><input type="checkbox" data-v4-enable ${line.enabled ? 'checked' : ''}>启用</label></td><td><button class="row-action" type="button" data-v4-details>设置</button></td></tr>`).join('');
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('IPv4 出口池', '所有 IPv4 连接通过 NAT44 使用真实 IPv4 WAN；IPv4 与 IPv6 权重、状态和选路完全独立。')}${internalAddressBar(state)}<section class="pool-toolbar"><div><span>出口池</span><strong>${escapeHtml(pool.name)}</strong><small class="mono">${escapeHtml(pool.id)}</small></div><label>负载算法${select('v4Algorithm', Object.entries(algorithmLabels).map(([value, label]) => [value, label]), pool.algorithm)}</label><div class="single-connection-note"><b>连接级负载</b><span>负载均衡分配不同连接，不会将单个 TCP 连接同时叠加到多条线路。</span></div></section>${panel('IPv4 真实线路', `<div class="compact-table-wrap"><table class="data-table dual-v4-table"><thead><tr><th>WAN ID / 状态</th><th>接口 / 真实 IPv4</th><th>NAT</th><th>延迟 / 丢包</th><th>权重</th><th>连接</th><th>当前速率</th><th>池 / 启用</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, { subtitle: `${pool.lines.filter((line) => line.inPool).length} 条加入出口池，${pool.lines.filter((line) => line.status === 'online').length} 条在线` })}${limitsPanel(true)}</div>`,
    mount(root) {
      root.querySelector('[name="v4Algorithm"]').addEventListener('change', (event) => mutate((draft) => { draft.ipv4Pools[0].algorithm = event.target.value; }, { source: 'dual-v4-algorithm' }));
      root.querySelectorAll('[data-v4-line]').forEach((row) => {
        const id = row.dataset.v4Line;
        row.querySelector('[data-v4-weight]').addEventListener('change', (event) => mutate((draft) => { draft.ipv4Pools[0].lines.find((line) => line.id === id).weight = Math.max(1, Number(event.target.value) || 1); }, { source: 'dual-v4-weight' }));
        row.querySelector('[data-v4-pool]').addEventListener('change', (event) => mutate((draft) => { draft.ipv4Pools[0].lines.find((line) => line.id === id).inPool = event.target.checked; }, { source: 'dual-v4-pool' }));
        row.querySelector('[data-v4-enable]').addEventListener('change', (event) => mutate((draft) => { const line = draft.ipv4Pools[0].lines.find((item) => item.id === id); line.enabled = event.target.checked; if (!line.enabled) line.inPool = false; }, { source: 'dual-v4-enabled' }));
        row.querySelector('[data-v4-details]').addEventListener('click', () => v4LineDrawer(getState().ipv4Pools[0].lines.find((line) => line.id === id)));
      });
    }
  };
}

function autoMode(line, allowNative = false) {
  if (!line.enabled || line.address === '--') return 'disabled';
  if (allowNative && line.nativeEligible && line.pdStatus === 'valid') return 'native';
  if (line.pdStatus === 'valid' && line.pd !== '--') return 'nptv6';
  if (line.address !== '--' && line.pdStatus === 'none') return 'nat66';
  return 'disabled';
}

function externalSubnetFromPd(pd, subnet = '1') {
  const [prefix, lengthText] = pd.split('/');
  const length = Number(lengthText);
  const hextets = prefix.replace(/::$/, '').split(':');
  if (length === 60) {
    const base = hextets[3] || '0';
    hextets[3] = `${base.slice(0, -1)}${subnet}`;
    return `${hextets.slice(0, 4).join(':')}::/64`;
  }
  return `${hextets.slice(0, 3).join(':')}:${subnet}::/64`;
}

function regenerateNptv6(state, line, newPd = '') {
  if (newPd) { line.pd = newPd; line.pdLength = Number(newPd.split('/')[1]); }
  line.pdStatus = 'valid'; line.status = 'online'; line.enabled = true; line.inPool = true; line.resolvedMode = 'nptv6';
  const delegation = state.prefixDelegations.find((item) => item.wanId === line.id);
  if (delegation) { delegation.prefix = line.pd; delegation.length = line.pdLength; delegation.status = 'valid'; delegation.generation += 1; delegation.preferredLifetime = '23h 59m'; delegation.validLifetime = '7d 00h'; }
  let mapping = state.ipv6Translations.nptv6.find((item) => item.wanId === line.id);
  const suffix = line.id.endsWith('02') ? '2' : '1';
  if (!mapping) { mapping = { id: `npt-${line.id}`, wanId: line.id, internalUlaPrefix: state.dualStackGateway.lanUlaPrefix, internalSubnet: `fd42:4c69:6e65:${suffix}::/64`, mappings: [] }; state.ipv6Translations.nptv6.push(mapping); }
  mapping.externalPd = line.pd; mapping.externalSubnet = externalSubnetFromPd(line.pd, suffix); mapping.status = 'valid'; mapping.regeneratedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  mapping.mappings = [[`fd42:4c69:6e65:${suffix}::10`, mapping.externalSubnet.replace('::/64', '::10')], [`fd42:4c69:6e65:${suffix}::11`, mapping.externalSubnet.replace('::/64', '::11')]];
}

function invalidatePd(state, line) {
  line.pdStatus = 'expired'; line.resolvedMode = 'disabled'; line.inPool = false; line.status = 'pd-failed';
  const delegation = state.prefixDelegations.find((item) => item.wanId === line.id); if (delegation) delegation.status = 'expired';
  const mapping = state.ipv6Translations.nptv6.find((item) => item.wanId === line.id); if (mapping) mapping.status = 'invalid';
  state.connectionMappings.filter((item) => item.wanId === line.id && item.translation === 'NPTv6').forEach((item) => { item.state = 'PREFIX_INVALID'; item.returnStatus = 'prefix-expired'; });
}

function v6LineDrawer(line) {
  const state = getState(); const pd = state.prefixDelegations.find((item) => item.wanId === line.id);
  openDrawer({
    title: `${line.id} · IPv6 出口`, kicker: 'REAL IPV6 EGRESS',
    body: `<div class="drawer-summary-list"><div><span>WAN IPv6</span><strong class="mono">${escapeHtml(line.address)}</strong></div><div><span>IPv6-PD</span><strong class="mono">${escapeHtml(line.pd)}${line.pdLength ? ` · /${line.pdLength}` : ''}</strong></div><div><span>PD 状态 / 代次</span><strong>${escapeHtml(`${pd?.status || line.pdStatus} / ${pd?.generation || 0}`)}</strong></div><div><span>首选 / 总有效期</span><strong>${escapeHtml(`${line.preferredLifetime} / ${line.validLifetime}`)}</strong></div><div><span>默认路由 / DNS</span><strong class="mono">${escapeHtml(`${line.defaultRoute} / ${line.dns}`)}</strong></div><div><span>转换模式</span><strong>${modeBadge(line.resolvedMode)}</strong></div></div><div class="drawer-action-grid"><button class="button danger" type="button" data-v6-down>模拟 WAN 掉线</button><button class="button" type="button" data-pd-invalid ${line.pd === '--' ? 'disabled' : ''}>模拟 PD 失效</button><button class="button primary" type="button" data-new-pd>模拟获得新 PD</button><button class="button" type="button" data-v6-restore>恢复正常</button></div><p class="secret-note">PD 失效后，关联 NPTv6 映射立即标记为不可用；新 PD 只为后续连接重新生成真实公网映射。</p>`,
    onMount(root) {
      root.querySelector('[data-v6-down]').addEventListener('click', () => { mutate((draft) => { const target = draft.ipv6Pools[0].lines.find((item) => item.id === line.id); target.status = 'offline'; target.inPool = false; draft.connectionMappings.filter((item) => item.wanId === line.id && item.protocol === 'IPv6').forEach((item) => { item.state = 'WAN_DOWN'; item.returnStatus = 'wan-down'; }); }, { source: 'dual-v6-down' }); closeDrawer(); toast('已模拟 IPv6 WAN 掉线；新连接将选择其他 IPv6 出口。', 'error'); });
      root.querySelector('[data-pd-invalid]').addEventListener('click', () => { mutate((draft) => invalidatePd(draft, draft.ipv6Pools[0].lines.find((item) => item.id === line.id)), { source: 'dual-pd-invalid' }); closeDrawer(); toast('PD 已失效，NPTv6 映射已停用。', 'error'); });
      root.querySelector('[data-new-pd]').addEventListener('click', () => { mutate((draft) => { const target = draft.ipv6Pools[0].lines.find((item) => item.id === line.id); const seed = String(Date.now()).slice(-4); regenerateNptv6(draft, target, `2408:7${seed}:7000::/56`); }, { source: 'dual-new-pd' }); closeDrawer(); toast('已获得新 /56 PD，并自动重新生成 NPTv6 映射。'); });
      root.querySelector('[data-v6-restore]').addEventListener('click', () => { mutate((draft) => { const target = draft.ipv6Pools[0].lines.find((item) => item.id === line.id); target.status = target.latency > 100 ? 'high-latency' : 'online'; target.enabled = true; if (target.pd !== '--') regenerateNptv6(draft, target); else { target.resolvedMode = target.address === '--' ? 'disabled' : 'nat66'; target.inPool = target.address !== '--'; } draft.connectionMappings.filter((item) => item.wanId === line.id).forEach((item) => { item.state = 'ESTABLISHED'; item.returnStatus = 'consistent'; item.returnWan = item.wanId; }); }, { source: 'dual-v6-restore' }); closeDrawer(); toast('IPv6 线路已恢复。'); });
    }
  });
}

function ipv6PoolPage() {
  const state = getState(); const pool = state.ipv6Pools[0];
  const modeOptions = [['auto', '自动'], ['nptv6', 'NPTv6'], ['nat66', 'NAT66'], ['native', '原生路由'], ['disabled', '禁用 IPv6 出口']];
  const rows = pool.lines.map((line) => `<tr data-v6-line="${escapeHtml(line.id)}"><td><strong class="mono">${escapeHtml(line.id)}</strong><small>${badge(line.enabled ? line.status : 'unavailable', line.enabled ? '' : '已禁用')}</small></td><td><strong class="mono ellipsis">${escapeHtml(line.address)}</strong><small class="mono">${escapeHtml(line.pd)}${line.pdLength ? ` · /${line.pdLength}` : ''}</small></td><td><strong>${escapeHtml(line.preferredLifetime)}</strong><small>${escapeHtml(line.validLifetime)}</small></td><td><strong class="mono">${escapeHtml(line.defaultRoute)}</strong><small class="mono ellipsis">DNS ${escapeHtml(line.dns)}</small></td><td>${select('mode', modeOptions, line.mode)}<small>当前 ${modeBadge(line.resolvedMode)}</small></td><td><strong>${line.latency || '--'} ms</strong><small>${line.loss}% 丢包</small></td><td><input class="table-number-input" type="number" min="1" max="100" value="${line.weight}" data-v6-weight aria-label="${line.id} 权重"></td><td><label class="pool-check"><input type="checkbox" data-v6-pool ${line.inPool ? 'checked' : ''} ${line.resolvedMode === 'disabled' ? 'disabled' : ''}>加入池</label><label class="pool-check"><input type="checkbox" data-v6-enable ${line.enabled ? 'checked' : ''}>启用</label></td><td><button class="row-action" type="button" data-v6-details>状态</button></td></tr>`).join('');
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('IPv6 出口池', '自动模式优先使用可用 PD 建立 NPTv6；只有公网 IPv6 地址而无 PD 时使用 NAT66。')}${internalAddressBar(state)}<section class="auto-mode-logic"><strong>自动模式</strong><span>可用 IPv6-PD <b>→ NPTv6</b></span><span>仅单个公网 IPv6 <b>→ NAT66</b></span><span>允许稳定前缀下发 <b>→ 原生路由</b></span><span>无 IPv6 <b>→ 不加入池</b></span><label><input type="checkbox" data-allow-native ${pool.allowNativeRouting ? 'checked' : ''}>允许稳定前缀原生下发</label></section>${panel('IPv6 真实线路', `<div class="compact-table-wrap"><table class="data-table dual-v6-table"><thead><tr><th>WAN ID / 状态</th><th>IPv6 / PD</th><th>首选 / 总有效期</th><th>路由 / DNS</th><th>转换模式</th><th>延迟 / 丢包</th><th>权重</th><th>池 / 启用</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, { subtitle: `${pool.lines.filter((line) => line.inPool).length} 条加入 IPv6 出口池，NPTv6 ${pool.lines.filter((line) => line.resolvedMode === 'nptv6').length} 条，NAT66 ${pool.lines.filter((line) => line.resolvedMode === 'nat66').length} 条` })}${limitsPanel(true)}</div>`,
    mount(root) {
      root.querySelector('[data-allow-native]').addEventListener('change', (event) => mutate((draft) => { const targetPool = draft.ipv6Pools[0]; targetPool.allowNativeRouting = event.target.checked; targetPool.lines.filter((line) => line.mode === 'auto').forEach((line) => { line.resolvedMode = autoMode(line, targetPool.allowNativeRouting); line.inPool = line.resolvedMode !== 'disabled'; }); }, { source: 'dual-v6-native-policy' }));
      root.querySelectorAll('[data-v6-line]').forEach((row) => {
        const id = row.dataset.v6Line;
        row.querySelector('[name="mode"]').addEventListener('change', (event) => { const requested = event.target.value; const current = getState().ipv6Pools[0].lines.find((line) => line.id === id); if (requested === 'nptv6' && current.pdStatus !== 'valid') { toast('NPTv6 需要该 WAN 获得有效 IPv6-PD。', 'error'); window.dispatchEvent(new CustomEvent('linehub:rerender')); return; } if (requested === 'native' && (!current.nativeEligible || !getState().ipv6Pools[0].allowNativeRouting)) { toast('原生路由仅允许可稳定下发前缀的 WAN，并需先开启原生下发策略。', 'error'); window.dispatchEvent(new CustomEvent('linehub:rerender')); return; } mutate((draft) => { const line = draft.ipv6Pools[0].lines.find((item) => item.id === id); line.mode = requested; line.resolvedMode = requested === 'auto' ? autoMode(line, draft.ipv6Pools[0].allowNativeRouting) : requested; if (line.resolvedMode === 'disabled') line.inPool = false; }, { source: 'dual-v6-mode' }); });
        row.querySelector('[data-v6-weight]').addEventListener('change', (event) => mutate((draft) => { draft.ipv6Pools[0].lines.find((line) => line.id === id).weight = Math.max(1, Number(event.target.value) || 1); }, { source: 'dual-v6-weight' }));
        row.querySelector('[data-v6-pool]').addEventListener('change', (event) => mutate((draft) => { const line = draft.ipv6Pools[0].lines.find((item) => item.id === id); line.inPool = event.target.checked && line.resolvedMode !== 'disabled'; }, { source: 'dual-v6-pool' }));
        row.querySelector('[data-v6-enable]').addEventListener('change', (event) => mutate((draft) => { const line = draft.ipv6Pools[0].lines.find((item) => item.id === id); line.enabled = event.target.checked; line.resolvedMode = line.enabled ? (line.mode === 'auto' ? autoMode(line, draft.ipv6Pools[0].allowNativeRouting) : line.mode) : 'disabled'; if (!line.enabled) line.inPool = false; }, { source: 'dual-v6-enabled' }));
        row.querySelector('[data-v6-details]').addEventListener('click', () => v6LineDrawer(getState().ipv6Pools[0].lines.find((line) => line.id === id)));
      });
    }
  };
}

function mappingPair(from, to) {
  return `<div class="mapping-pair"><code>${escapeHtml(from)}</code><span>↔</span><code>${escapeHtml(to)}</code></div>`;
}

function translationExamples() {
  return `<div class="translation-examples"><article class="translation-example nat44"><header><span>IPv4</span><strong>NAT44</strong></header><div><small>内部 IPv4</small><code>10.10.10.10</code></div><i>→ wan-v4-02 →</i><div><small>外部 IPv4</small><code>100.64.20.18</code></div></article><article class="translation-example nptv6"><header><span>IPv6 + PD</span><strong>NPTv6</strong></header><div><small>内部 ULA</small><code>fd42:4c69:6e65:1::10</code></div><i>↔ wan-v6-01 ↔</i><div><small>转换后公网 IPv6</small><code>2408:1234:1000:1::10</code></div></article><article class="translation-example nat66"><header><span>IPv6 无 PD</span><strong>NAT66</strong></header><div><small>内部 ULA</small><code>fd42:4c69:6e65:1::11</code></div><i>→ wan-v6-03 →</i><div><small>WAN IPv6</small><code>2409:8888:1200::25</code></div></article><article class="translation-example native"><header><span>稳定前缀直下发</span><strong>原生路由</strong></header><div><small>服务器公网 IPv6</small><code>2001:db8:feed:1::10</code></div><i>无地址转换</i><div><small>前提</small><code>用户允许且前缀稳定</code></div></article></div>`;
}

function nptv6Content(state) {
  const mappings = state.ipv6Translations.nptv6;
  const current = mappings[0];
  const lines = state.ipv6Pools[0].lines;
  return `<div class="translation-config-layout"><form id="nptv6-form" class="configuration-form"><div class="form-grid">${field('内部 ULA 前缀', input('internalUlaPrefix', current.internalUlaPrefix, { required: true }))}${field('对应 IPv6 WAN', WanSelector({ lines, name: 'wanId', selected: current.wanId, protocol: 'IPv6', includeUnavailable: true }))}${field('外部 PD', input('externalPd', current.externalPd, { required: true }))}${field('内部子网', input('internalSubnet', current.internalSubnet, { required: true }))}${field('外部子网', input('externalSubnet', current.externalSubnet, { required: true }))}</div><div class="form-actions"><button class="button" type="button" data-validate-npt>仅校验</button><button class="button primary" type="submit">保存 NPTv6 映射</button></div><div data-npt-validation></div></form><div class="mapping-preview"><header><span>地址映射预览</span>${badge(current.status)}</header>${current.mappings.map(([from, to]) => mappingPair(from, to)).join('')}<small>接口标识保持不变，仅替换网络前缀。</small></div></div><div class="compact-table-wrap"><table class="data-table npt-map-table"><thead><tr><th>WAN</th><th>内部子网</th><th>外部子网</th><th>PD</th><th>状态</th><th>最近生成</th><th>操作</th></tr></thead><tbody>${mappings.map((mapping) => `<tr data-npt-id="${escapeHtml(mapping.id)}"><td class="mono">${escapeHtml(mapping.wanId)}</td><td class="mono">${escapeHtml(mapping.internalSubnet)}</td><td class="mono">${escapeHtml(mapping.externalSubnet)}</td><td class="mono">${escapeHtml(mapping.externalPd)}</td><td>${badge(mapping.status)}</td><td>${escapeHtml(mapping.regeneratedAt)}</td><td><button class="row-action" type="button" data-npt-invalid>PD失效</button> <button class="row-action" type="button" data-npt-new>新PD</button></td></tr>`).join('')}</tbody></table></div>`;
}

function validateNptForm(form, state) {
  const data = new FormData(form); const wanId = String(data.get('wanId')); const line = state.ipv6Pools[0].lines.find((item) => item.id === wanId);
  const errors = [];
  if (!line) errors.push('必须选择对应 IPv6 WAN。');
  if (line && data.get('externalPd') !== line.pd) errors.push('外部前缀必须来自对应 WAN 当前获得的 PD。');
  if (line && line.pdStatus !== 'valid') errors.push('该 WAN 的 PD 当前无效，不能建立 NPTv6 映射。');
  if (!String(data.get('internalSubnet')).endsWith('/64') || !String(data.get('externalSubnet')).endsWith('/64')) errors.push('内部与外部子网需使用相同 /64 前缀长度。');
  if (!/^fd[0-9a-f]{2}:/i.test(String(data.get('internalUlaPrefix')))) errors.push('内部前缀必须是 RFC4193 ULA。');
  const conflict = state.ipv6Translations.nptv6.some((mapping) => mapping.wanId !== wanId && mapping.externalSubnet === data.get('externalSubnet'));
  if (conflict) errors.push('外部子网与现有 NPTv6 映射冲突。');
  return { data, line, errors };
}

function translationsPage() {
  const state = getState(); const nat66 = state.ipv6Translations.nat66; const inbound = state.ipv6Translations.inboundMappings;
  const nat66Table = `<div class="compact-table-wrap"><table class="data-table"><thead><tr><th>内部 ULA 范围</th><th>出口 WAN</th><th>WAN IPv6</th><th>模式</th><th>连接</th><th>入站映射</th><th>超时</th><th>状态</th></tr></thead><tbody>${nat66.map((item) => `<tr><td class="mono">${escapeHtml(item.internalRange)}</td><td class="mono">${escapeHtml(item.wanId)}</td><td class="mono">${escapeHtml(item.wanIpv6)}</td><td>${escapeHtml(item.mode === 'masquerade' ? 'Masquerade' : 'SNAT')}</td><td>${item.connections}</td><td>${item.inboundMappings}</td><td>${item.sessionTimeout}s</td><td>${badge(item.status)}</td></tr>`).join('')}</tbody></table></div><div class="nat66-note"><strong>NAT66 适用范围</strong><p>NAT66 主要用于只有单个 WAN IPv6 地址而没有可用 PD 的线路。其入站能力受运营商和防火墙限制。</p></div>`;
  const inboundTable = `<div class="compact-table-wrap"><table class="data-table"><thead><tr><th>方式</th><th>公网 IPv6 / 端口</th><th>映射到内部 ULA</th><th>WAN</th><th>防火墙</th></tr></thead><tbody>${inbound.map((item) => `<tr><td>${modeBadge(item.type.toLowerCase())}</td><td><strong class="mono">${escapeHtml(item.publicAddress)}</strong><small>${escapeHtml(item.publicPort)}</small></td><td><strong class="mono">${escapeHtml(item.internalAddress)}</strong><small>${escapeHtml(item.internalPort)}</small></td><td class="mono">${escapeHtml(item.wanId)}</td><td>${badge('online', `${item.firewall} ${item.publicPort}`)}</td></tr>`).join('')}</tbody></table></div><ul class="inbound-facts"><li>ULA 本身不能直接从公网访问。</li><li>公网访问使用转换后的真实公网 IPv6。</li><li>多 WAN 可以存在多个真实公网 IPv6 入口。</li><li>系统不会把多个运营商地址显示成一个虚假的统一公网 IPv6。</li></ul>`;
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('地址转换', '明确区分 NAT44、NPTv6、NAT66 与原生路由；每个公网地址都属于实际选中的 WAN。')}${internalAddressBar(state)}${translationExamples()}${panel('NPTv6 前缀映射', nptv6Content(state), { subtitle: '需要 WAN 获得有效 IPv6-PD；PD 变化后重新生成外部映射' })}${panel('NAT66', nat66Table, { subtitle: '只有公网 IPv6 地址而无 PD 时使用' })}${panel('公网访问映射', inboundTable, { subtitle: '入站访问仍需对应 WAN 与防火墙共同允许' })}${limitsPanel(true)}</div>`,
    mount(root) {
      const form = root.querySelector('#nptv6-form'); const validation = root.querySelector('[data-npt-validation]');
      const runValidation = () => { const result = validateNptForm(form, getState()); validation.innerHTML = result.errors.length ? `<div class="inline-validation bad"><strong>校验失败</strong><span>${result.errors.map(escapeHtml).join('；')}</span></div>` : '<div class="inline-validation good"><strong>校验通过</strong><span>PD来源、前缀长度和冲突检查均通过。</span></div>'; return result; };
      root.querySelector('[data-validate-npt]').addEventListener('click', runValidation);
      form.addEventListener('submit', (event) => { event.preventDefault(); const { data, errors } = runValidation(); if (errors.length) return; mutate((draft) => { const target = draft.ipv6Translations.nptv6.find((item) => item.wanId === data.get('wanId')) || draft.ipv6Translations.nptv6[0]; Object.assign(target, { wanId: data.get('wanId'), internalUlaPrefix: data.get('internalUlaPrefix'), externalPd: data.get('externalPd'), internalSubnet: data.get('internalSubnet'), externalSubnet: data.get('externalSubnet'), status: 'valid', regeneratedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }); }, { source: 'dual-npt-config' }); toast('NPTv6 映射配置已保存。'); });
      root.querySelectorAll('[data-npt-id]').forEach((row) => { const id = row.dataset.nptId; row.querySelector('[data-npt-invalid]').addEventListener('click', () => { mutate((draft) => { const mapping = draft.ipv6Translations.nptv6.find((item) => item.id === id); const line = draft.ipv6Pools[0].lines.find((item) => item.id === mapping.wanId); invalidatePd(draft, line); }, { source: 'dual-npt-invalid' }); toast('PD已失效，映射标记为不可用。', 'error'); }); row.querySelector('[data-npt-new]').addEventListener('click', () => { mutate((draft) => { const mapping = draft.ipv6Translations.nptv6.find((item) => item.id === id); const line = draft.ipv6Pools[0].lines.find((item) => item.id === mapping.wanId); regenerateNptv6(draft, line, `2408:8${String(Date.now()).slice(-4)}:8000::/56`); }, { source: 'dual-npt-new-pd' }); toast('新PD已获得，NPTv6映射已重新生成。'); }); });
    }
  };
}

function serverPolicyLabel(value, protocol) {
  const labels = protocol === 'v4' ? { auto: '自动负载', fixed: '固定出口', failover: '主备', disabled: '禁用' } : { auto: '自动', 'nptv6-first': 'NPTv6优先', 'nat66-first': 'NAT66优先', fixed: '固定WAN', native: '原生路由', disabled: '禁用' };
  return labels[value] || value;
}

function openServerBinding(binding) {
  const state = getState(); const v4Lines = state.ipv4Pools[0].lines; const v6Lines = state.ipv6Pools[0].lines;
  openDrawer({
    title: `${binding.name} · 双栈绑定`, kicker: 'SERVER EGRESS BINDING', width: 'wide',
    body: `<form id="server-binding-form" class="configuration-form"><div class="binding-address-pair"><div><span>稳定内部 IPv4</span><strong class="mono">${escapeHtml(binding.internalIpv4)}</strong></div><div><span>稳定内部 ULA IPv6</span><strong class="mono">${escapeHtml(binding.internalIpv6)}</strong></div></div><div class="form-grid">${field('IPv4 出口池', select('ipv4PoolId', state.ipv4Pools.map((pool) => [pool.id, pool.name]), binding.ipv4PoolId))}${field('IPv6 出口池', select('ipv6PoolId', state.ipv6Pools.map((pool) => [pool.id, pool.name]), binding.ipv6PoolId))}${field('IPv4 模式', select('ipv4Policy', [['auto', '自动负载'], ['fixed', '固定出口'], ['failover', '主备'], ['disabled', '禁用']], binding.ipv4Policy))}${field('IPv6 模式', select('ipv6Policy', [['auto', '自动'], ['nptv6-first', 'NPTv6优先'], ['nat66-first', 'NAT66优先'], ['fixed', '固定WAN'], ['native', '原生路由'], ['disabled', '禁用']], binding.ipv6Policy))}${field('固定 / 当前 IPv4 WAN', WanSelector({ lines: v4Lines, name: 'currentV4Wan', selected: binding.currentV4Wan, protocol: 'IPv4', includeUnavailable: true }))}${field('固定 / 当前 IPv6 WAN', WanSelector({ lines: v6Lines, name: 'currentV6Wan', selected: binding.currentV6Wan, protocol: 'IPv6', includeUnavailable: true }))}</div><div class="switch-cluster"><label class="check-line"><input type="checkbox" name="returnPath" ${binding.returnPath ? 'checked' : ''}>回程保持</label><label class="check-line"><input type="checkbox" name="sticky" ${binding.stickySessions ? 'checked' : ''}>粘性会话</label><label class="check-line"><input type="checkbox" name="failover" ${binding.failover ? 'checked' : ''}>故障切换</label></div><p class="secret-note">运营商PD或公网地址变化只改变外部映射；服务器内部IPv4与ULA始终保持不变。</p><div class="form-actions"><button class="button" type="button" data-action="cancel">取消</button><button class="button primary" type="submit">保存服务器绑定</button></div></form>`,
    onMount(root) {
      const form = root.querySelector('#server-binding-form'); root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      form.addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(form); mutate((draft) => { const target = draft.serverBindings.find((item) => item.id === binding.id); Object.assign(target, { ipv4PoolId: data.get('ipv4PoolId'), ipv6PoolId: data.get('ipv6PoolId'), ipv4Policy: data.get('ipv4Policy'), ipv6Policy: data.get('ipv6Policy'), currentV4Wan: data.get('currentV4Wan'), currentV6Wan: data.get('currentV6Wan'), returnPath: data.get('returnPath') === 'on', stickySessions: data.get('sticky') === 'on', failover: data.get('failover') === 'on' }); const line = draft.ipv6Pools[0].lines.find((item) => item.id === target.currentV6Wan); target.translationMode = line?.resolvedMode === 'nat66' ? 'NAT66' : line?.resolvedMode === 'native' ? '原生路由' : 'NPTv6'; }, { source: 'dual-server-binding' }); closeDrawer(); toast('服务器双栈出口绑定已保存。'); });
    }
  });
}

function serversPage() {
  const state = getState();
  const rows = state.serverBindings.map((server) => `<tr data-server-binding="${escapeHtml(server.id)}"><td><strong>${escapeHtml(server.name)}</strong><small class="mono">${escapeHtml(server.mac)}</small></td><td><strong class="mono">${escapeHtml(server.internalIpv4)}</strong><small class="mono ellipsis">${escapeHtml(server.internalIpv6)}</small></td><td><strong>${escapeHtml(server.ipv4PoolId)}</strong><small>${escapeHtml(serverPolicyLabel(server.ipv4Policy, 'v4'))}</small></td><td><strong>${escapeHtml(server.ipv6PoolId)}</strong><small>${escapeHtml(serverPolicyLabel(server.ipv6Policy, 'v6'))}</small></td><td><strong class="mono">${escapeHtml(server.currentV4Wan)}</strong><small class="mono">${escapeHtml(server.currentV6Wan)}</small></td><td>${modeBadge(server.translationMode.toLowerCase())}</td><td>${badge(server.online ? 'online' : 'offline')}<small>${server.connections} 连接</small></td><td><span class="consistency-flags"><b class="${server.returnPath ? 'on' : ''}">回程</b><b class="${server.stickySessions ? 'on' : ''}">粘性</b><b class="${server.failover ? 'on' : ''}">切换</b></span></td><td><button class="row-action" type="button" data-edit-binding>编辑</button></td></tr>`).join('');
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('服务器绑定', '为每台服务器分别选择IPv4与IPv6出口策略，内部RFC1918和ULA地址不随WAN变化。')}${internalAddressBar(state)}${panel('固定内部双栈与出口策略', `<div class="compact-table-wrap"><table class="data-table server-binding-table"><thead><tr><th>服务器 / MAC</th><th>内部 IPv4 / ULA</th><th>IPv4池 / 策略</th><th>IPv6池 / 策略</th><th>当前 V4 / V6 WAN</th><th>转换</th><th>状态</th><th>保持策略</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, { subtitle: `${state.serverBindings.length} 台服务器，地址全部来自稳定内部双栈` })}${limitsPanel(true)}</div>`,
    mount(root) { root.querySelectorAll('[data-server-binding]').forEach((row) => row.querySelector('[data-edit-binding]').addEventListener('click', () => openServerBinding(getState().serverBindings.find((item) => item.id === row.dataset.serverBinding)))); }
  };
}

function returnStatusLabel(status) {
  return { consistent: '源进源出正常', mismatch: '回程接口不一致', 'prefix-expired': '外部前缀已失效', 'wan-down': 'WAN 已断线', 'mapping-missing': '映射不存在', 'route-missing': '路由表缺失' }[status] || status;
}

function sessionRows(state, filters = {}) {
  return state.connectionMappings.filter((item) => (!filters.protocol || item.protocol === filters.protocol) && (!filters.translation || item.translation === filters.translation) && (!filters.wan || item.wanId === filters.wan) && (!filters.server || item.serverId === filters.server) && (!filters.status || item.state === filters.status)).map((item) => `<tr data-connection="${escapeHtml(item.id)}"><td><strong>${escapeHtml(item.protocol)}</strong><small class="mono">${escapeHtml(item.internalSource)}:${item.internalPort}</small></td><td><strong class="mono ellipsis">${escapeHtml(item.destination)}</strong><small>${item.destinationPort}</small></td><td class="mono">${escapeHtml(item.wanId)}</td><td><strong class="mono ellipsis">${escapeHtml(item.externalAddress)}</strong><small>${item.externalPort}</small></td><td>${modeBadge(item.translation.toLowerCase())}</td><td>${badge(item.state)}</td><td class="line-rate"><span>↑ ${formatSpeed(item.tx)}</span><span>↓ ${formatSpeed(item.rx)}</span></td><td>${escapeHtml(item.age)}</td><td>${badge(item.returnStatus, returnStatusLabel(item.returnStatus))}<small class="mono">${escapeHtml(item.returnInterface)}</small></td><td><button class="row-action" type="button" data-session-detail>详情</button></td></tr>`).join('');
}

function openSessionDetail(connection) {
  openDrawer({
    title: `${connection.id} · 连接选择结果`, kicker: 'CONNECTION & RETURN PATH',
    body: `<div class="session-path"><div><span>内部源</span><strong class="mono">${escapeHtml(`${connection.internalSource}:${connection.internalPort}`)}</strong></div><i>→ ${escapeHtml(connection.translation)} →</i><div><span>外部源</span><strong class="mono">${escapeHtml(`${connection.externalAddress}:${connection.externalPort}`)}</strong></div><i>→ ${escapeHtml(connection.wanId)} →</i><div><span>目标</span><strong class="mono">${escapeHtml(`${connection.destination}:${connection.destinationPort}`)}</strong></div></div><div class="drawer-summary-list"><div><span>连接标记</span><strong class="mono">${escapeHtml(connection.mark)}</strong></div><div><span>出口 WAN / 路由表</span><strong class="mono">${escapeHtml(`${connection.wanId} / ${connection.routeTable}`)}</strong></div><div><span>反向映射</span><strong class="mono">${escapeHtml(connection.reverseMapping)}</strong></div><div><span>回程 WAN / 接口</span><strong class="mono">${escapeHtml(`${connection.returnWan} / ${connection.returnInterface}`)}</strong></div><div><span>源进源出与回程保持</span><strong>${badge(connection.returnStatus, returnStatusLabel(connection.returnStatus))}</strong></div></div><div class="drawer-action-grid"><button class="button" type="button" data-rebind-route>重新绑定路由</button><button class="button danger" type="button" data-clear-connection>清除连接</button><button class="button" type="button" data-regenerate-map>重新生成NPTv6映射</button><button class="button primary" type="button" data-switch-backup>切换备用线路</button></div>`,
    onMount(root) {
      const repair = (message) => { mutate((state) => { const target = state.connectionMappings.find((item) => item.id === connection.id); target.returnWan = target.wanId; target.returnInterface = target.wanId.replace('wan-v6-01', 'eth4.101').replace('wan-v6-02', 'eth4.103').replace('wan-v6-03', 'eth5.105').replace('wan-v4-01', 'eth4.101').replace('wan-v4-02', 'eth4.103').replace('wan-v4-03', 'eth5.105'); target.returnStatus = 'consistent'; target.state = 'ESTABLISHED'; const binding = state.returnPathBindings.find((item) => item.connectionId === target.id); if (binding) { binding.status = 'consistent'; binding.returnInterface = target.returnInterface; } }, { source: 'dual-return-repair' }); closeDrawer(); toast(message); };
      root.querySelector('[data-rebind-route]').addEventListener('click', () => repair('路由表与回程接口已重新绑定。'));
      root.querySelector('[data-regenerate-map]').addEventListener('click', () => { mutate((state) => { const line = state.ipv6Pools[0].lines.find((item) => item.id === connection.wanId); if (line?.pd !== '--') regenerateNptv6(state, line); }, { source: 'dual-regenerate-map' }); repair('NPTv6 映射已重新生成，回程保持已恢复。'); });
      root.querySelector('[data-switch-backup]').addEventListener('click', () => { mutate((state) => { const target = state.connectionMappings.find((item) => item.id === connection.id); target.state = 'INTERRUPTING'; target.wanId = target.protocol === 'IPv4' ? 'wan-v4-06' : 'wan-v6-02'; target.returnWan = target.wanId; target.returnStatus = 'consistent'; }, { source: 'dual-switch-backup' }); closeDrawer(); toast('新连接将切换到备用线路；原连接可能中断。', 'info'); });
      root.querySelector('[data-clear-connection]').addEventListener('click', () => { mutate((state) => { state.connectionMappings = state.connectionMappings.filter((item) => item.id !== connection.id); state.returnPathBindings = state.returnPathBindings.filter((item) => item.connectionId !== connection.id); }, { source: 'dual-clear-session' }); closeDrawer(); toast('模拟连接已清除。'); });
    }
  });
}

function sessionsPage() {
  const state = getState(); const savedWan = window.localStorage.getItem('linehub-preview-session-wan-filter') || '';
  const filters = `<div class="session-filters"><label>协议${select('protocol', [['', '全部'], ['IPv4', 'IPv4'], ['IPv6', 'IPv6']], '')}</label><label>转换${select('translation', [['', '全部'], ['NAT44', 'NAT44'], ['NPTv6', 'NPTv6'], ['NAT66', 'NAT66']], '')}</label><label>WAN${select('wan', [['', '全部 WAN'], ...state.ipv4Pools[0].lines.map((line) => [line.id, line.id]), ...state.ipv6Pools[0].lines.map((line) => [line.id, line.id])], savedWan)}</label><label>服务器${select('server', [['', '全部服务器'], ...state.serverBindings.map((server) => [server.id, server.name])], '')}</label><label>状态${select('status', [['', '全部状态'], ['ESTABLISHED', '已建立'], ['DEGRADED', '异常'], ['WAN_DOWN', 'WAN断线'], ['PREFIX_INVALID', '前缀失效']], '')}</label></div>`;
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('会话监控', '每个连接记录实际选择的 WAN、转换地址、连接标记和回程接口。', '<button class="button" type="button" data-sim-return>模拟回程异常</button><button class="button primary" type="button" data-restore-return>恢复正常</button>')}${filters}${panel('连接与转换映射', `<div class="compact-table-wrap"><table class="data-table session-table"><thead><tr><th>协议 / 内部源</th><th>目标</th><th>所选 WAN</th><th>外部转换地址</th><th>转换</th><th>状态</th><th>上行 / 下行</th><th>存活</th><th>回程线路</th><th>操作</th></tr></thead><tbody data-session-rows>${sessionRows(state, { wan: savedWan })}</tbody></table></div>`, { subtitle: '负载均衡按连接分配，单个TCP连接只绑定一条WAN' })}${limitsPanel(true)}</div>`,
    mount(root) {
      const render = () => { const filtersNode = root.querySelector('.session-filters'); const values = Object.fromEntries([...filtersNode.querySelectorAll('select')].map((node) => [node.name, node.value])); root.querySelector('[data-session-rows]').innerHTML = sessionRows(getState(), values) || '<tr><td colspan="10"><div class="dynamic-form-placeholder">没有符合筛选条件的连接</div></td></tr>'; root.querySelectorAll('[data-connection]').forEach((row) => row.querySelector('[data-session-detail]').addEventListener('click', () => openSessionDetail(getState().connectionMappings.find((item) => item.id === row.dataset.connection)))); };
      root.querySelectorAll('.session-filters select').forEach((node) => node.addEventListener('change', () => { if (node.name === 'wan') window.localStorage.setItem('linehub-preview-session-wan-filter', node.value); render(); })); render();
      root.querySelector('[data-sim-return]').addEventListener('click', () => { mutate((draft) => { const target = draft.connectionMappings.find((item) => item.returnStatus === 'consistent'); target.returnWan = target.protocol === 'IPv4' ? 'wan-v4-06' : 'wan-v6-03'; target.returnInterface = target.protocol === 'IPv4' ? 'eth6.111' : 'eth5.105'; target.returnStatus = 'mismatch'; target.state = 'DEGRADED'; const binding = draft.returnPathBindings.find((item) => item.connectionId === target.id); if (binding) binding.status = 'mismatch'; }, { source: 'dual-return-anomaly' }); toast('已模拟回程接口不一致。', 'error'); });
      root.querySelector('[data-restore-return]').addEventListener('click', () => { mutate((draft) => { draft.connectionMappings.forEach((item) => { item.returnWan = item.wanId; item.returnStatus = 'consistent'; if (!['WAN_DOWN', 'PREFIX_INVALID'].includes(item.state)) item.state = 'ESTABLISHED'; }); draft.returnPathBindings.forEach((item) => { item.status = 'consistent'; }); }, { source: 'dual-return-restore' }); toast('所有模拟回程绑定已恢复正常。'); });
    }
  };
}

function restoreDualStackHealth(state) {
  state.ipv4Pools[0].lines.forEach((line) => { line.enabled = true; line.inPool = line.id !== 'wan-v4-05'; line.status = line.id === 'wan-v4-04' ? 'degraded' : line.id === 'wan-v4-05' ? 'offline' : 'online'; });
  state.ipv6Pools[0].lines.forEach((line) => { if (line.address === '--') return; line.enabled = true; line.status = line.id === 'wan-v6-06' ? 'high-latency' : line.id === 'wan-v6-04' ? 'pd-failed' : 'online'; line.resolvedMode = autoMode(line); line.inPool = line.resolvedMode !== 'disabled'; if (line.pd !== '--' && line.id !== 'wan-v6-04') regenerateNptv6(state, line); });
  state.connectionMappings.forEach((item) => { item.returnWan = item.wanId; item.returnStatus = 'consistent'; item.state = 'ESTABLISHED'; }); state.returnPathBindings.forEach((item) => { item.status = 'consistent'; });
}

function failoverPage() {
  const state = getState(); const v4 = state.ipv4Pools[0].lines; const v6 = state.ipv6Pools[0].lines; const anomalies = state.connectionMappings.filter((item) => item.returnStatus !== 'consistent');
  const events = state.dualStackEvents.map((event) => `<li class="${escapeHtml(event.severity)}"><time>${escapeHtml(event.time)}</time><span>${escapeHtml(event.message)}</span></li>`).join('');
  const returnRows = anomalies.length ? anomalies.map((item) => `<tr><td class="mono">${escapeHtml(item.id)}</td><td>${escapeHtml(returnStatusLabel(item.returnStatus))}</td><td class="mono">${escapeHtml(item.wanId)}</td><td class="mono">${escapeHtml(item.returnWan)}</td><td><button class="row-action" type="button" data-repair-id="${escapeHtml(item.id)}">修复</button></td></tr>`).join('') : '<tr><td colspan="5"><div class="healthy-empty">✓ 当前没有回程异常</div></td></tr>';
  return {
    html: `<div class="function-page dual-stack-page">${pageHeader('故障切换', 'IPv4和IPv6故障分别处理；服务器内部RFC1918与ULA地址在切换中保持不变。', '<button class="button primary" type="button" data-restore-all>恢复全部模拟状态</button>')}<section class="failover-warning"><span>!</span><div><strong>IPv6出口切换会改变外部公网地址</strong><p>切换IPv6出口后，外部公网IPv6地址会发生变化，使用旧公网地址的现有连接可能中断。</p></div></section><div class="failover-grid"><section class="failover-card v4"><header><span>IPv4 故障流程</span>${badge(v4.some((line) => line.status === 'online') ? 'online' : 'offline')}</header><ol><li>停止向故障WAN分配新连接</li><li>现有连接标记为即将中断</li><li>新连接转移到其他IPv4 WAN</li></ol><div class="failover-actions"><button class="button danger" type="button" data-v4-down>模拟 wan-v4-01 掉线</button><button class="button" type="button" data-v4-backup>切换备用线路</button></div></section><section class="failover-card v6"><header><span>IPv6 故障流程</span>${badge(v6.some((line) => line.inPool) ? 'online' : 'offline')}</header><ol><li>停止使用失效外部前缀</li><li>NPTv6映射标记失效</li><li>新连接切换其他IPv6 WAN</li><li>服务器内部ULA保持不变</li></ol><div class="failover-actions"><button class="button danger" type="button" data-v6-down>模拟 wan-v6-01 掉线</button><button class="button" type="button" data-pd-expire>模拟PD失效</button><button class="button primary" type="button" data-pd-renew>获得新PD</button></div></section></div><div class="failover-lower">${panel('源进源出与回程保持', `<div class="compact-table-wrap"><table class="data-table"><thead><tr><th>连接</th><th>异常</th><th>出口WAN</th><th>回程WAN</th><th>操作</th></tr></thead><tbody>${returnRows}</tbody></table></div>`, { subtitle: `${anomalies.length} 个异常绑定` })}${panel('最近故障事件', `<ol class="dual-event-list">${events}</ol>`, { subtitle: '所有事件均为浏览器内模拟' })}</div>${limitsPanel()}</div>`,
    mount(root) {
      root.querySelector('[data-v4-down]').addEventListener('click', () => { mutate((draft) => { const line = draft.ipv4Pools[0].lines.find((item) => item.id === 'wan-v4-01'); line.status = 'offline'; line.inPool = false; draft.connectionMappings.filter((item) => item.wanId === line.id).forEach((item) => { item.state = 'WAN_DOWN'; item.returnStatus = 'wan-down'; }); draft.dualStackEvents.unshift({ id: `event-${Date.now()}`, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), severity: 'critical', type: 'wan', message: 'wan-v4-01 掉线，新IPv4连接停止分配到该线路' }); }, { source: 'dual-fail-v4' }); toast('wan-v4-01 已模拟掉线。', 'error'); });
      root.querySelector('[data-v4-backup]').addEventListener('click', () => { mutate((draft) => { const backup = draft.ipv4Pools[0].lines.find((item) => item.role === 'backup' && item.status !== 'offline'); backup.role = 'primary'; backup.inPool = true; draft.connectionMappings.filter((item) => item.protocol === 'IPv4' && item.state === 'WAN_DOWN').forEach((item) => { item.wanId = backup.id; item.returnWan = backup.id; item.state = 'INTERRUPTING'; item.returnStatus = 'consistent'; }); }, { source: 'dual-v4-backup' }); toast('新IPv4连接已转移到备用线路；旧连接可能中断。', 'info'); });
      root.querySelector('[data-v6-down]').addEventListener('click', () => { mutate((draft) => { const line = draft.ipv6Pools[0].lines.find((item) => item.id === 'wan-v6-01'); line.status = 'offline'; line.inPool = false; const mapping = draft.ipv6Translations.nptv6.find((item) => item.wanId === line.id); if (mapping) mapping.status = 'invalid'; draft.connectionMappings.filter((item) => item.wanId === line.id).forEach((item) => { item.state = 'WAN_DOWN'; item.returnStatus = 'wan-down'; }); }, { source: 'dual-fail-v6' }); toast('wan-v6-01已掉线，旧公网IPv6连接可能中断。', 'error'); });
      root.querySelector('[data-pd-expire]').addEventListener('click', () => { mutate((draft) => invalidatePd(draft, draft.ipv6Pools[0].lines.find((item) => item.id === 'wan-v6-01')), { source: 'dual-fail-pd' }); toast('wan-v6-01 PD已失效。', 'error'); });
      root.querySelector('[data-pd-renew]').addEventListener('click', () => { mutate((draft) => regenerateNptv6(draft, draft.ipv6Pools[0].lines.find((item) => item.id === 'wan-v6-01'), `2408:9${String(Date.now()).slice(-4)}:9000::/56`), { source: 'dual-renew-pd' }); toast('新PD已获得，NPTv6映射已自动重新生成。'); });
      root.querySelector('[data-restore-all]').addEventListener('click', () => { mutate(restoreDualStackHealth, { source: 'dual-restore-all' }); toast('双栈出口、映射与回程绑定已恢复。'); });
      root.querySelectorAll('[data-repair-id]').forEach((button) => button.addEventListener('click', () => { mutate((draft) => { const target = draft.connectionMappings.find((item) => item.id === button.dataset.repairId); target.returnWan = target.wanId; target.returnStatus = 'consistent'; target.state = 'ESTABLISHED'; }, { source: 'dual-repair-return' }); toast('回程绑定已修复。'); }));
    }
  };
}

export function renderDualStack(route) {
  if (route === 'dual-stack/ipv4-pool') return ipv4PoolPage();
  if (route === 'dual-stack/ipv6-pool') return ipv6PoolPage();
  if (route === 'dual-stack/translations') return translationsPage();
  if (route === 'dual-stack/servers') return serversPage();
  if (route === 'dual-stack/sessions') return sessionsPage();
  if (route === 'dual-stack/failover') return failoverPage();
  return overviewPage();
}
