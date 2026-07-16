import { getState, mutate } from '../store.js';
import { closeDrawer, confirmAction, escapeHtml, field, formActions, formatInteger, formatSpeed, input, maskAccount, openDrawer, pageHeader, pagination, panel, select, statusBadge, statusLabel, toggle, toast } from '../components.js';

const view = {
  status: 'all', interface: 'all', vlan: 'all', family: 'all', pool: 'all',
  search: '', sort: 'id', direction: 'asc', page: 1, pageSize: 12, selected: new Set()
};

function newWanId(lines) {
  const used = new Set(lines.map((line) => line.id));
  for (let i = 1; i < 1000; i += 1) {
    const id = `wan-${String(i).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
  return `wan-${Date.now()}`;
}

function lineForm(line = null, inline = false) {
  const state = getState();
  const item = line || {
    id: newWanId(state.wanLines), name: '', parent: 'eth0', vlanId: 120,
    username: '', mac: '', ipv4Enabled: true, ipv6Enabled: true, requestPd: true,
    mtu: 1492, mru: 1492, weight: 1, pool: state.pools[0].name, healthcheck: 'TCP + DNS', autoRedial: true
  };
  const parentChoices = state.interfaces.map((entry) => [entry.name, `${entry.name} · ${entry.role}`]);
  const poolChoices = state.pools.map((entry) => [entry.name, entry.name]);
  return `<form id="wan-form" class="wan-form">
    <div class="form-section"><h3 class="form-section-title">线路标识与接入</h3><div class="form-grid ${inline ? 'cols-3' : ''}">
      ${field('WAN ID', input('id', item.id, { required: true }), '必须唯一')}
      ${field('线路名称', input('name', item.name, { required: true, placeholder: '例如：城域商务线路' }))}
      ${field('父接口', select('parent', parentChoices, item.parent))}
      ${field('VLAN ID', input('vlanId', item.vlanId, { type: 'number', min: 1, max: 4094, required: true }))}
      ${field('自定义 MAC', input('mac', item.mac, { placeholder: '留空则自动生成' }))}
      ${field('线路池', select('pool', poolChoices, item.pool))}
    </div></div>
    <div class="form-section"><h3 class="form-section-title">PPPoE 与协议栈</h3><div class="form-grid ${inline ? 'cols-3' : ''}">
      ${field('PPPoE 用户名', input('username', item.username, { required: true }))}
      ${field('PPPoE 密码', input('pppoePassword', '', { type: 'password', placeholder: item.secretConfigured ? '••••••••（已配置）' : '••••••••' }), '密码不会写入 localStorage')}
      ${field('MTU', input('mtu', item.mtu, { type: 'number', min: 1280, max: 1500 }))}
      ${field('MRU', input('mru', item.mru, { type: 'number', min: 1280, max: 1500 }))}
      ${field('权重', input('weight', item.weight, { type: 'number', min: 1, max: 100 }))}
      ${field('健康检查', select('healthcheck', [['TCP + DNS','TCP + DNS'],['多目标 ICMP','多目标 ICMP'],['TCP 端口','TCP 端口'],['DNS 解析','DNS 解析']], item.healthcheck))}
    </div></div>
    <div class="check-grid">
      <label class="check-line"><input type="checkbox" name="ipv4Enabled" ${item.ipv4Enabled ? 'checked' : ''}>启用 IPv4</label>
      <label class="check-line"><input type="checkbox" name="ipv6Enabled" ${item.ipv6Enabled ? 'checked' : ''}>启用 IPv6</label>
      <label class="check-line"><input type="checkbox" name="requestPd" ${item.requestPd ? 'checked' : ''}>请求 IPv6-PD</label>
      <label class="check-line"><input type="checkbox" name="autoRedial" ${item.autoRedial ? 'checked' : ''}>自动重拨</label>
    </div>
    <pre class="config-preview" id="wan-config-preview"></pre>
    ${formActions(line ? '保存线路' : '保存并拨号', inline ? '清空表单' : '取消')}
  </form>`;
}

function formPreview(form) {
  const data = new FormData(form);
  return `config pppoe '${data.get('id') || 'wan-id'}'\n\toption wan_id '${data.get('id') || ''}'\n\toption name '${data.get('name') || ''}'\n\toption ifname '${data.get('parent')}.${data.get('vlanId')}'\n\toption username '${maskAccount(data.get('username'))}'\n\toption password '********'\n\toption ipv4 '${data.get('ipv4Enabled') === 'on' ? '1' : '0'}'\n\toption ipv6 '${data.get('ipv6Enabled') === 'on' ? '1' : '0'}'\n\toption weight '${data.get('weight') || '1'}'`;
}

function saveLineForm(form, existing = null) {
  const data = new FormData(form);
  const id = String(data.get('id')).trim();
  const name = String(data.get('name')).trim();
  const username = String(data.get('username')).trim();
  const parent = String(data.get('parent'));
  const vlanId = Number(data.get('vlanId'));
  const duplicate = getState().wanLines.some((line) => line.id === id && line !== existing);
  if (!id || !name || !username || duplicate || vlanId < 1 || vlanId > 4094) {
    toast(duplicate ? `WAN ID ${id} 已存在。` : '请完整填写必填字段，并使用 1 到 4094 的 VLAN ID。', 'error');
    return false;
  }
  mutate((state) => {
    const generatedMac = `02:4c:48:aa:${String(state.wanLines.length + 1).padStart(2, '0')}:01`;
    const values = {
      id, name, parent, vlanId, vlanIfname: `${parent}.${vlanId}`, username,
      secretConfigured: true, mac: String(data.get('mac')).trim() || generatedMac,
      ipv4Enabled: data.get('ipv4Enabled') === 'on', ipv6Enabled: data.get('ipv6Enabled') === 'on',
      requestPd: data.get('requestPd') === 'on', mtu: Number(data.get('mtu')) || 1492,
      mru: Number(data.get('mru')) || 1492, weight: Math.min(100, Math.max(1, Number(data.get('weight')) || 1)),
      pool: data.get('pool'), healthcheck: data.get('healthcheck'), autoRedial: data.get('autoRedial') === 'on'
    };
    if (existing) Object.assign(state.wanLines.find((line) => line.id === existing.id), values);
    else state.wanLines.push({ ...values, enabled: true, status: 'dialing', issue: '', ipv4: '--', gateway4: '--', ipv6: '--', pd: '--', upload: 0, download: 0, latency: 0, loss: 0, connections: 0, lastDial: '刚刚' });
  }, { source: 'wans' });
  toast(existing ? `${id} 配置已保存。` : `${id} 已加入模拟拨号队列。`);
  return true;
}

function mountLineForm(root, existing = null, inline = false) {
  const form = root.querySelector('#wan-form');
  const preview = root.querySelector('#wan-config-preview');
  const update = () => { preview.textContent = formPreview(form); };
  form.addEventListener('input', update);
  update();
  form.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    if (inline) form.reset(); else closeDrawer();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (saveLineForm(form, existing) && !inline) closeDrawer();
    if (inline) form.querySelector('[name="id"]').value = newWanId(getState().wanLines);
    update();
  });
}

function editLine(line) {
  openDrawer({ title: `编辑 ${line.id}`, width: 'wide', body: lineForm(line), onMount: (root) => mountLineForm(root, line) });
}

function lineDetails(line) {
  const details = [
    ['WAN ID', line.id], ['线路名称', line.name], ['状态', statusLabel(line.status)], ['模拟异常', line.issue || '无'],
    ['物理接口', line.parent], ['VLAN 子接口', line.vlanIfname], ['PPPoE 账户', maskAccount(line.username)], ['自定义 MAC', line.mac],
    ['IPv4 地址', line.ipv4], ['IPv4 网关', line.gateway4], ['IPv6 地址', line.ipv6], ['IPv6-PD', line.pd],
    ['上行速率', formatSpeed(line.upload)], ['下行速率', formatSpeed(line.download)], ['延迟', line.latency ? `${line.latency} ms` : '--'], ['丢包率', `${line.loss}%`],
    ['当前连接数', formatInteger(line.connections)], ['权重', line.weight], ['线路池', line.pool], ['最后拨号', line.lastDial]
  ];
  openDrawer({ title: `${line.id} · 线路详情`, width: 'wide', kicker: 'WAN LINE DETAILS', body: `<div class="notice"><span>i</span><div><strong>安全显示</strong><p>PPPoE 账户已脱敏，页面和本地存储均不包含明文密码。</p></div></div><dl class="form-grid">${details.map(([label, value]) => `<div class="subtle-panel"><dt class="muted">${escapeHtml(label)}</dt><dd style="margin:3px 0 0;font-weight:650">${escapeHtml(value)}</dd></div>`).join('')}</dl>` });
}

function actionCenter(line) {
  const actions = [
    ['edit','编辑线路'], [line.enabled ? 'disable' : 'enable', line.enabled ? '停用线路' : '启用线路'],
    ['connect','连接'], ['disconnect','断开'], ['redial','重新拨号'], ['copy','复制线路'], ['details','查看详情'], ['delete','删除线路']
  ];
  openDrawer({
    title: `${line.id} · 操作`,
    body: `<div class="feature-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${actions.map(([action,label]) => `<button class="feature-card" type="button" data-line-operation="${action}" style="text-align:left;cursor:pointer"><span>${label.slice(0,1)}</span><h3>${label}</h3><p>仅修改当前本地演示状态</p></button>`).join('')}</div>`,
    onMount(root) {
      root.querySelectorAll('[data-line-operation]').forEach((button) => button.addEventListener('click', async () => {
        const action = button.dataset.lineOperation;
        if (action === 'edit') return editLine(line);
        if (action === 'details') return lineDetails(line);
        if (action === 'delete') {
          if (!await confirmAction(`确定删除 ${line.id}？此操作只影响本地演示数据。`, '删除')) return;
          mutate((state) => { state.wanLines = state.wanLines.filter((item) => item.id !== line.id); }, { source: 'wans' });
          closeDrawer();
          toast(`${line.id} 已删除。`);
          return;
        }
        if (action === 'copy') {
          mutate((state) => {
            const id = newWanId(state.wanLines);
            state.wanLines.push({ ...line, id, name: `${line.name} 副本`, status: 'disabled', enabled: false, username: `${id}@isp.example.invalid`, lastDial: '--' });
          }, { source: 'wans' });
          closeDrawer();
          toast(`${line.id} 已复制为新线路。`);
          return;
        }
        mutate((state) => {
          const target = state.wanLines.find((item) => item.id === line.id);
          if (!target) return;
          if (action === 'enable') { target.enabled = true; target.status = 'dialing'; }
          if (action === 'disable') { target.enabled = false; target.status = 'disabled'; }
          if (action === 'connect' || action === 'redial') { target.enabled = true; target.status = 'dialing'; target.issue = ''; }
          if (action === 'disconnect') { target.status = 'disabled'; target.enabled = false; }
        }, { source: 'wans' });
        closeDrawer();
        toast(`${line.id} 已执行“${button.textContent.trim()}”。`);
      }));
    }
  });
}

function filteredLines() {
  const search = view.search.toLowerCase();
  const lines = getState().wanLines.filter((line) => {
    if (view.status !== 'all' && line.status !== view.status) return false;
    if (view.interface !== 'all' && line.parent !== view.interface) return false;
    if (view.vlan !== 'all' && String(line.vlanId) !== view.vlan) return false;
    if (view.pool !== 'all' && line.pool !== view.pool) return false;
    if (view.family === 'ipv4' && !line.ipv4Enabled) return false;
    if (view.family === 'ipv6' && !line.ipv6Enabled) return false;
    if (view.family === 'dual' && !(line.ipv4Enabled && line.ipv6Enabled)) return false;
    return !search || [line.id, line.name, line.parent, line.vlanIfname, line.username, line.mac, line.pool].some((value) => String(value).toLowerCase().includes(search));
  });
  return lines.sort((a, b) => {
    const aValue = a[view.sort];
    const bValue = b[view.sort];
    const result = typeof aValue === 'number' ? aValue - bValue : String(aValue).localeCompare(String(bValue), 'zh-CN');
    return view.direction === 'asc' ? result : -result;
  });
}

function lineRows(lines) {
  return lines.map((line) => `<tr data-wan-id="${escapeHtml(line.id)}" class="${view.selected.has(line.id) ? 'selected' : ''} ${line.issue ? 'problem' : ''}">
    <td class="sticky-1"><input class="checkbox" type="checkbox" data-wan-select aria-label="选择 ${escapeHtml(line.id)}" ${view.selected.has(line.id) ? 'checked' : ''}></td>
    <td class="sticky-2"><div class="row-actions"><span class="status-lamp ${escapeHtml(line.status)}" title="${escapeHtml(statusLabel(line.status))}"></span>${toggle({ checked: line.enabled, label: `启用或停用 ${line.id}`, action: 'enabled' })}</div></td>
    <td class="sticky-3"><strong class="mono">${escapeHtml(line.id)}</strong></td>
    <td><strong class="line-name" title="${escapeHtml(line.name)}">${escapeHtml(line.name)}</strong>${line.issue ? `<span class="line-issue" title="${escapeHtml(line.issue)}">${escapeHtml(line.issue)}</span>` : ''}</td>
    <td class="mono">${escapeHtml(line.parent)}</td><td>${line.vlanId}</td><td class="mono">${escapeHtml(line.vlanIfname)}</td>
    <td class="mono">${escapeHtml(maskAccount(line.username))}</td><td class="mono">${escapeHtml(line.mac)}</td>
    <td>${toggle({ checked: line.ipv4Enabled, label: `切换 ${line.id} IPv4`, action: 'ipv4' })}</td><td class="mono">${escapeHtml(line.ipv4)}</td><td class="mono">${escapeHtml(line.gateway4)}</td><td>${toggle({ checked: line.ipv6Enabled, label: `切换 ${line.id} IPv6`, action: 'ipv6' })}</td><td class="mono">${escapeHtml(line.ipv6)}</td><td class="mono">${escapeHtml(line.pd)}</td>
    <td>↑ ${line.upload.toFixed(1)}</td><td>↓ ${line.download.toFixed(1)}</td><td class="${line.latency > 100 ? 'warning-text' : ''}">${line.latency ? `${line.latency} ms` : '--'}</td>
    <td class="${line.loss > 2 ? 'danger-text' : ''}">${line.loss}%</td><td>${formatInteger(line.connections)}</td>
    <td><div class="weight-stepper"><button type="button" data-weight="-1">−</button><input type="number" value="${line.weight}" min="1" max="100" aria-label="${escapeHtml(line.id)} 权重"><button type="button" data-weight="1">+</button></div></td>
    <td>${escapeHtml(line.pool)}</td><td class="mono">${escapeHtml(line.lastDial)}</td>
    <td><div class="row-actions"><button class="row-action" data-wan-edit>编辑</button><button class="row-action" data-wan-details>详情</button><button class="row-action" data-wan-more>更多</button></div></td>
  </tr>`).join('');
}

function batchDrawer(action) {
  const ids = [...view.selected];
  if (!ids.length) return toast('请先勾选线路。', 'error');
  if (['enable','disable','redial'].includes(action)) {
    mutate((state) => state.wanLines.forEach((line) => {
      if (!ids.includes(line.id)) return;
      if (action === 'enable') { line.enabled = true; line.status = 'dialing'; }
      if (action === 'disable') { line.enabled = false; line.status = 'disabled'; }
      if (action === 'redial' && line.enabled) { line.status = 'dialing'; line.issue = ''; }
    }), { source: 'wans' });
    toast(`已对 ${ids.length} 条线路执行批量操作。`);
    return;
  }
  const isWeight = action === 'weight';
  openDrawer({
    title: isWeight ? '批量修改权重' : '批量加入线路池',
    body: `<form id="batch-wan-form"><div class="notice"><span>i</span><div><strong>已选择 ${ids.length} 条线路</strong><p>${escapeHtml(ids.join('、'))}</p></div></div>${isWeight ? field('统一权重', input('value', 3, { type: 'number', min: 1, max: 100 })) : field('目标线路池', select('value', getState().pools.map((pool) => [pool.name,pool.name]), getState().pools[0].name))}${formActions('应用批量修改')}</form>`,
    onMount(root) {
      root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      root.querySelector('#batch-wan-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('value');
        mutate((state) => state.wanLines.forEach((line) => {
          if (!ids.includes(line.id)) return;
          if (isWeight) line.weight = Math.min(100, Math.max(1, Number(value) || 1)); else line.pool = value;
        }), { source: 'wans' });
        closeDrawer();
        toast(`已更新 ${ids.length} 条线路。`);
      });
    }
  });
}

function listPage() {
  const state = getState();
  const enabled = state.wanLines.filter((line) => line.enabled);
  const allFiltered = filteredLines();
  const pages = Math.max(1, Math.ceil(allFiltered.length / view.pageSize));
  view.page = Math.min(view.page, pages);
  const rows = allFiltered.slice((view.page - 1) * view.pageSize, view.page * view.pageSize);
  const interfaceChoices = [['all','全部接口'], ...state.interfaces.map((item) => [item.name,item.name])];
  const vlanChoices = [['all','全部 VLAN'], ...[...new Set(state.wanLines.map((line) => line.vlanId))].sort((a,b) => a-b).map((id) => [String(id),`VLAN ${id}`])];
  const poolChoices = [['all','全部线路池'], ...state.pools.map((pool) => [pool.name,pool.name])];
  const stats = [
    ['WAN 总数', state.wanLines.length, 'blue'], ['在线', enabled.filter((line) => line.status === 'online').length, 'green'],
    ['拨号中', enabled.filter((line) => line.status === 'dialing').length, 'blue'], ['故障', enabled.filter((line) => line.status === 'fault').length, 'red'],
    ['停用', state.wanLines.filter((line) => !line.enabled).length, 'orange'], ['IPv4 / IPv6', `${enabled.filter((line) => line.ipv4Enabled).length} / ${enabled.filter((line) => line.ipv6Enabled).length}`, 'purple']
  ];
  return `${pageHeader('线路列表', '24 条多状态 WAN 线路的筛选、批量管理和宽表格视图。', '<button class="button" data-nav="wans/import">批量导入</button><button class="button primary" data-add-wan>+ 新增线路</button>')}
    <div class="stats-grid">${stats.map(([label,value,tone], index) => `<article class="stat-card ${tone}"><span class="stat-icon">${['Σ','●','↻','!','∅','46'][index]}</span><div><span>${label}</span><strong>${value}</strong><small>实时演示统计</small></div></article>`).join('')}</div>
    ${panel('WAN 线路', `<div class="toolbar">
      ${select('status', [['all','全部状态'],['online','在线'],['dialing','拨号中'],['fault','故障'],['disabled','停用']], view.status)}
      ${select('interface', interfaceChoices, view.interface)}${select('vlan', vlanChoices, view.vlan)}
      ${select('family', [['all','全部协议栈'],['ipv4','已启用 IPv4'],['ipv6','已启用 IPv6'],['dual','双栈']], view.family)}
      ${select('pool', poolChoices, view.pool)}
      <div class="search-input"><input class="input" name="search" value="${escapeHtml(view.search)}" placeholder="搜索 WAN ID、账户、MAC"></div>
      <button class="button compact" data-filter-reset>重置</button>
    </div>
    <div class="toolbar"><strong>批量操作</strong><button class="button compact" data-batch="enable">启用</button><button class="button compact" data-batch="disable">停用</button><button class="button compact" data-batch="redial">重新拨号</button><button class="button compact" data-batch="weight">修改权重</button><button class="button compact" data-batch="pool">加入线路池</button><span class="toolbar-spacer"></span><span>已选择 ${view.selected.size} 条</span></div>
    <div class="data-table-wrap" style="max-height:605px"><table class="data-table wan-table"><thead><tr>
      <th class="sticky-1"><input class="checkbox" type="checkbox" data-select-all aria-label="选择当前页全部线路"></th><th class="sticky-2">状态 / 启用</th><th class="sticky-3"><button class="sort-button" data-sort="id">WAN ID</button></th>
      <th>线路名称</th><th>物理接口</th><th>VLAN ID</th><th>VLAN 子接口</th><th>PPPoE 账户</th><th>自定义 MAC</th><th>IPv4</th><th>IPv4 地址</th><th>IPv4 网关</th><th>IPv6</th><th>IPv6 地址</th><th>IPv6-PD</th><th><button class="sort-button" data-sort="upload">上行 Mbps</button></th><th><button class="sort-button" data-sort="download">下行 Mbps</button></th><th><button class="sort-button" data-sort="latency">延迟</button></th><th>丢包率</th><th>连接数</th><th><button class="sort-button" data-sort="weight">权重</button></th><th>线路池</th><th>最后拨号</th><th>操作</th>
    </tr></thead><tbody>${lineRows(rows)}</tbody></table></div>${pagination({ page: view.page, pages, total: allFiltered.length })}`)}`;
}

function logsPage() {
  const logs = getState().logs.filter((log) => log.module === 'pppoe' || log.module === 'healthcheck');
  return `${pageHeader('拨号日志', '查看 PPPoE 会话、重拨与健康检查模拟记录。', '<button class="button" data-log-refresh>刷新日志</button>')}
    ${panel('拨号与探测记录', `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>级别</th><th>模块</th><th>线路</th><th>消息</th></tr></thead><tbody>${logs.map((log, index) => `<tr><td class="mono">${escapeHtml(log.time)}</td><td>${statusBadge(log.level === 'error' ? 'fault' : log.level)}</td><td>${escapeHtml(log.module)}</td><td class="mono">wan-${String((index % 24) + 1).padStart(2,'0')}</td><td>${escapeHtml(log.message)}</td></tr>`).join('')}</tbody></table></div>`)}`;
}

function templatesPage() {
  const templates = [
    ['标准 PPPoE 双栈','IPv4 + IPv6-PD','MTU/MRU 1492','TCP + DNS','核心出口池'],
    ['IPv4 业务线路','仅 IPv4','MTU/MRU 1492','多目标 ICMP','业务出口池'],
    ['灾备低权重线路','IPv4 + IPv6','权重 1','TCP 端口','灾备出口池'],
    ['IPv6 优先线路','IPv4 + IPv6-PD','权重 4','DNS 解析','核心出口池']
  ];
  return `${pageHeader('线路模板', '使用预设参数快速建立一致的多线路配置。', '<button class="button primary" data-template-add>+ 新建模板</button>')}
    <div class="feature-grid">${templates.map((item,index) => `<article class="feature-card"><span>T${index + 1}</span><h3>${item[0]}</h3><p>${item.slice(1).join(' · ')}</p><div class="button-row"><button class="button compact" data-template-use>使用模板</button><button class="button compact">编辑</button></div></article>`).join('')}</div>`;
}

export function renderWans(route) {
  if (route === 'wans/add') {
    return { html: `${pageHeader('新增线路', '建立 PPPoE 会话并预览脱敏后的 UCI 配置。', '')}${panel('线路配置', `<div class="panel-content pad">${lineForm(null, true)}</div>`)}`, mount(root) { mountLineForm(root, null, true); } };
  }
  if (route === 'wans/logs') return { html: logsPage(), mount(root) { root.querySelector('[data-log-refresh]')?.addEventListener('click', () => toast('拨号日志已刷新。', 'info')); } };
  if (route === 'wans/templates') return { html: templatesPage(), mount(root) { root.querySelectorAll('[data-template-use],[data-template-add]').forEach((button) => button.addEventListener('click', () => toast('模板已载入新增线路表单。'))); } };
  return {
    html: listPage(),
    mount(root) {
      root.querySelector('[data-add-wan]').addEventListener('click', () => openDrawer({ title: '新增 WAN 线路', width: 'wide', body: lineForm(), onMount: (drawerRoot) => mountLineForm(drawerRoot) }));
      root.querySelector('[data-nav]')?.addEventListener('click', (event) => { window.location.hash = `#/${event.currentTarget.dataset.nav}`; });
      ['status','interface','vlan','family','pool'].forEach((name) => root.querySelector(`[name="${name}"]`).addEventListener('change', (event) => { view[name] = event.target.value; view.page = 1; window.dispatchEvent(new CustomEvent('linehub:rerender')); }));
      root.querySelector('[name="search"]').addEventListener('input', (event) => { view.search = event.target.value; view.page = 1; window.dispatchEvent(new CustomEvent('linehub:rerender')); });
      root.querySelector('[data-filter-reset]').addEventListener('click', () => { Object.assign(view, { status:'all',interface:'all',vlan:'all',family:'all',pool:'all',search:'',page:1 }); window.dispatchEvent(new CustomEvent('linehub:rerender')); });
      root.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { view.direction = view.sort === button.dataset.sort && view.direction === 'asc' ? 'desc' : 'asc'; view.sort = button.dataset.sort; window.dispatchEvent(new CustomEvent('linehub:rerender')); }));
      root.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { view.page = Number(button.dataset.page); window.dispatchEvent(new CustomEvent('linehub:rerender')); }));
      root.querySelector('[data-select-all]').addEventListener('change', (event) => { root.querySelectorAll('[data-wan-id]').forEach((row) => event.target.checked ? view.selected.add(row.dataset.wanId) : view.selected.delete(row.dataset.wanId)); window.dispatchEvent(new CustomEvent('linehub:rerender')); });
      root.querySelectorAll('[data-wan-id]').forEach((row) => {
        const line = () => getState().wanLines.find((item) => item.id === row.dataset.wanId);
        row.querySelector('[data-wan-select]').addEventListener('change', (event) => { event.target.checked ? view.selected.add(row.dataset.wanId) : view.selected.delete(row.dataset.wanId); window.dispatchEvent(new CustomEvent('linehub:rerender')); });
        row.querySelector('[data-wan-edit]').addEventListener('click', () => editLine(line()));
        row.querySelector('[data-wan-details]').addEventListener('click', () => lineDetails(line()));
        row.querySelector('[data-wan-more]').addEventListener('click', () => actionCenter(line()));
        ['enabled', 'ipv4', 'ipv6'].forEach((fieldName) => row.querySelector(`[data-action="${fieldName}"]`).addEventListener('change', (event) => {
          mutate((state) => {
            const target = state.wanLines.find((item) => item.id === row.dataset.wanId);
            if (!target) return;
            if (fieldName === 'enabled') {
              target.enabled = event.target.checked;
              target.status = event.target.checked ? 'dialing' : 'disabled';
            } else target[`${fieldName}Enabled`] = event.target.checked;
          }, { source: 'wans' });
          toast(`${row.dataset.wanId} ${fieldName === 'enabled' ? '线路状态' : fieldName.toUpperCase()}已更新。`);
        }));
        row.querySelectorAll('[data-weight]').forEach((button) => button.addEventListener('click', () => {
          mutate((state) => { const target = state.wanLines.find((item) => item.id === row.dataset.wanId); if (target) target.weight = Math.min(100, Math.max(1, target.weight + Number(button.dataset.weight))); }, { source: 'wans' });
          toast(`${row.dataset.wanId} 权重已更新。`);
        }));
      });
      root.querySelectorAll('[data-batch]').forEach((button) => button.addEventListener('click', () => batchDrawer(button.dataset.batch)));
    }
  };
}
