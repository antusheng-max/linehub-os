import { getState, mutate } from '../store.js';
import { closeDrawer, escapeHtml, field, formActions, formatInteger, formatSpeed, input, openDrawer, pageHeader, panel, select, statusBadge, toggle, toast } from '../components.js';

const pageMeta = {
  'servers/list': ['服务器列表','查看地址、出口、实时流量、业务负载和 DMZ 状态。'],
  'servers/addresses': ['地址分配','维护固定 IPv4、ULA IPv6、MAC 绑定和所属 LAN。'],
  'servers/egress': ['出口策略','为服务器分别指定 IPv4 线路池、IPv6 策略和故障切换方式。'],
  'servers/mappings': ['服务映射','集中管理服务器端口映射、DMZ 和 UPnP 权限。'],
  'servers/monitoring': ['服务器监控','查看每台服务器的模拟流量、连接、CPU 和磁盘状态。']
};

function editServer(server) {
  const state = getState();
  openDrawer({
    title: `编辑 ${server.name}`,
    width: 'wide',
    body: `<form id="server-form"><div class="form-section"><h3 class="form-section-title">地址与出口</h3><div class="form-grid">
      ${field('服务器名称', input('name', server.name, { required: true }))}${field('MAC', input('mac', server.mac, { required: true }))}
      ${field('固定 IPv4', input('ipv4', server.ipv4, { required: true }))}${field('固定 ULA', input('ula', server.ula, { required: true }))}
      ${field('所属 LAN', select('lan', [['lan-servers','lan-servers'],['lan-services','lan-services'],['lan-guest','lan-guest']], server.lan))}
      ${field('IPv4 出口线路池', select('pool', state.pools.map((pool) => [pool.name,pool.name]), server.pool))}
      ${field('IPv6 出口策略', select('ipv6Policy', [['源进源出','源进源出'],['核心出口优先','核心出口优先'],['最低延迟','最低延迟']], '源进源出'))}
      ${field('故障切换策略', select('failover', [['自动切换','自动切换'],['保持会话','保持会话'],['手动切换','手动切换']], server.failover))}
      ${field('最大带宽 Mbps', input('maxBandwidth', server.maxBandwidth, { type:'number', min:1, max:10000 }))}
      ${field('最大连接数', input('maxConnections', server.maxConnections, { type:'number', min:1, max:100000 }))}
    </div></div><div class="check-grid"><label class="check-line"><input type="checkbox" name="dmz" ${server.dmz ? 'checked' : ''}>启用 DMZ</label><label class="check-line"><input type="checkbox" name="upnp" ${server.upnp ? 'checked' : ''}>允许 UPnP</label></div>
    <div class="notice warning"><span>!</span><div><strong>DMZ 风险提示</strong><p>这里只更新模拟配置；生产环境开启 DMZ 前应限制访问来源。</p></div></div>${formActions()}</form>`,
    onMount(root) {
      root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      root.querySelector('#server-form').addEventListener('submit', (event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        mutate((current) => { const target = current.servers.find((item) => item.id === server.id); if (target) Object.assign(target, { name:data.get('name'),mac:data.get('mac'),ipv4:data.get('ipv4'),ula:data.get('ula'),lan:data.get('lan'),pool:data.get('pool'),failover:data.get('failover'),maxBandwidth:Number(data.get('maxBandwidth')),maxConnections:Number(data.get('maxConnections')),dmz:data.get('dmz')==='on',upnp:data.get('upnp')==='on' }); }, { source:'servers' });
        closeDrawer(); toast(`${server.name} 配置已保存。`);
      });
    }
  });
}

function serverTable() {
  const state = getState();
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>状态</th><th>服务器名称</th><th>MAC</th><th>固定 IPv4</th><th>ULA IPv6</th><th>所属 LAN</th><th>默认线路池</th><th>当前出口</th><th>上行</th><th>下行</th><th>连接数</th><th>CPU</th><th>磁盘</th><th>DMZ</th><th>操作</th></tr></thead><tbody>${state.servers.map((server) => `<tr data-server-id="${server.id}"><td>${statusBadge(server.online?'online':'disabled')}</td><td><strong>${escapeHtml(server.name)}</strong></td><td class="mono">${escapeHtml(server.mac)}</td><td class="mono">${escapeHtml(server.ipv4)}</td><td class="mono">${escapeHtml(server.ula)}</td><td>${escapeHtml(server.lan)}</td><td>${escapeHtml(server.pool)}</td><td class="mono">${escapeHtml(server.egress)}</td><td>${formatSpeed(server.upload)}</td><td>${formatSpeed(server.download)}</td><td>${formatInteger(server.connections)}</td><td>${server.cpu}%</td><td>${server.disk}%</td><td>${server.dmz?statusBadge('warning','已开启'):statusBadge('disabled','关闭')}</td><td><button class="row-action" data-server-edit>编辑</button></td></tr>`).join('')}</tbody></table></div>`;
}

function subPage(route) {
  const [title] = pageMeta[route];
  const features = route === 'servers/addresses' ? [['固定 IPv4','6 个绑定'],['ULA IPv6','6 个绑定'],['地址冲突','0'],['离线租约','1']]
    : route === 'servers/egress' ? [['出口策略','6 条'],['自动切换','5 台'],['源进源出','已启用'],['策略异常','0']]
      : route === 'servers/mappings' ? [['端口映射','12 条'],['DMZ','1 台'],['UPnP 授权','1 台'],['暴露告警','0']]
        : [['在线服务器','5 台'],['总连接数','4,821'],['实时下行','238 Mbps'],['负载告警','1']];
  return `<div class="grid cols-4">${features.map(([label,value],index) => `<article class="feature-card"><span>${index+1}</span><h3>${label}</h3><p>${value} · 模拟业务信息</p><button class="button compact" data-server-config>管理</button></article>`).join('')}</div><div style="margin-top:12px">${panel(title, serverTable())}</div>`;
}

export function renderServers(route) {
  const state = getState();
  const [title, description] = pageMeta[route];
  const content = route === 'servers/list'
    ? `<div class="stats-grid">${[['服务器总数',state.servers.length,'blue'],['在线',state.servers.filter((item)=>item.online).length,'green'],['DMZ',state.servers.filter((item)=>item.dmz).length,'orange'],['总连接数',formatInteger(state.servers.reduce((sum,item)=>sum+item.connections,0)),'purple']].map(([label,value,tone],index)=>`<article class="stat-card ${tone}"><span class="stat-icon">${['Σ','●','D','C'][index]}</span><div><span>${label}</span><strong>${value}</strong><small>服务器演示统计</small></div></article>`).join('')}</div>${panel('服务器列表', serverTable())}`
    : subPage(route);
  return {
    html: `${pageHeader(title, description, '<button class="button primary" data-server-add>+ 新增服务器</button>')}${content}`,
    mount(root) {
      root.querySelectorAll('[data-server-id]').forEach((row) => row.querySelector('[data-server-edit]').addEventListener('click', () => editServer(getState().servers.find((server) => server.id === row.dataset.serverId))));
      root.querySelectorAll('[data-server-add],[data-server-config]').forEach((button) => button.addEventListener('click', () => toast('服务器演示配置已保存。')));
    }
  };
}
