import { getState, mutate } from '../store.js';
import { closeDrawer, confirmAction, escapeHtml, field, formActions, input, openDrawer, pageHeader, panel, select, statusBadge, toggle, toast } from '../components.js';

function vlanForm(item = null, batch = false) {
  const state = getState();
  const parents = state.interfaces.map((entry) => [entry.name, `${entry.name} · ${entry.role}`]);
  openDrawer({
    title: batch ? '批量新增 VLAN' : item ? `编辑 VLAN ${item.id}` : '新增 VLAN',
    width: batch ? 'wide' : 'normal',
    body: `<form id="vlan-form">
      <div class="form-section"><h3 class="form-section-title">${batch ? 'VLAN 范围' : 'VLAN 属性'}</h3><div class="form-grid ${batch ? 'cols-3' : ''}">
        ${field('父接口', select('parent', parents, item?.parent || 'eth0'))}
        ${batch ? `${field('起始 VLAN', input('start', 120, { type: 'number', min: 1, max: 4094, required: true }))}${field('结束 VLAN', input('end', 126, { type: 'number', min: 1, max: 4094, required: true }))}${field('步进值', input('step', 1, { type: 'number', min: 1, max: 256, required: true }))}` : field('VLAN ID', input('id', item?.id || 120, { type: 'number', min: 1, max: 4094, required: true }))}
        ${field('用途', select('role', [['PPPoE 接入','PPPoE 接入'],['备用接入','备用接入'],['业务隔离','业务隔离']], item?.role || 'PPPoE 接入'))}
      </div></div>
      <div class="config-preview" id="vlan-preview">${batch ? 'eth0.120 → eth0.126' : `${item?.parent || 'eth0'}.${item?.id || 120}`}</div>
      <div class="notice"><span>i</span><div><strong>重复检测</strong><p>保存前会检查父接口与 VLAN ID 组合是否已存在。</p></div></div>
      ${formActions(batch ? '创建 VLAN 范围' : '保存 VLAN')}
    </form>`,
    onMount(root) {
      const form = root.querySelector('#vlan-form');
      const preview = root.querySelector('#vlan-preview');
      const update = () => {
        const data = new FormData(form);
        preview.textContent = batch ? `${data.get('parent')}.${data.get('start')} → ${data.get('parent')}.${data.get('end')}，步进 ${data.get('step')}` : `${data.get('parent')}.${data.get('id')}`;
      };
      form.addEventListener('input', update);
      root.querySelector('[data-action="cancel"]').addEventListener('click', closeDrawer);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const parent = String(data.get('parent'));
        const role = String(data.get('role'));
        const ids = batch ? (() => {
          const result = [];
          const start = Number(data.get('start'));
          const end = Number(data.get('end'));
          const step = Math.max(1, Number(data.get('step')) || 1);
          for (let id = start; id <= end && result.length < 128; id += step) result.push(id);
          return result;
        })() : [Number(data.get('id'))];
        const invalid = ids.some((id) => id < 1 || id > 4094);
        const duplicate = ids.some((id) => getState().vlans.some((entry) => entry.parent === parent && entry.id === id && entry !== item));
        if (invalid || duplicate || ids.length === 0) {
          toast(invalid ? 'VLAN ID 必须在 1 到 4094 之间。' : duplicate ? '检测到重复 VLAN 子接口。' : 'VLAN 范围无效。', 'error');
          return;
        }
        mutate((state) => {
          if (item) {
            const target = state.vlans.find((entry) => entry.parent === item.parent && entry.id === item.id);
            if (target) Object.assign(target, { parent, id: ids[0], ifname: `${parent}.${ids[0]}`, role });
          } else {
            ids.forEach((id) => state.vlans.push({ id, parent, ifname: `${parent}.${id}`, enabled: true, role, sessions: 0, rx: 0, tx: 0 }));
          }
        }, { source: 'vlans' });
        closeDrawer();
        toast(`${ids.length} 个 VLAN 配置已保存。`);
      });
    }
  });
}

export function renderVlans() {
  const state = getState();
  const duplicates = new Set();
  const seen = new Set();
  state.vlans.forEach((item) => { const key = `${item.parent}.${item.id}`; if (seen.has(key)) duplicates.add(key); seen.add(key); });
  const rows = state.vlans.map((item) => {
    const key = `${item.parent}.${item.id}`;
    return `<tr class="${duplicates.has(key) ? 'problem' : ''}" data-vlan-key="${escapeHtml(key)}"><td><input class="checkbox" type="checkbox" data-vlan-select></td><td>${toggle({ checked: item.enabled, label: `切换 ${key}`, action: 'toggle-vlan' })}</td><td><strong>${item.id}</strong></td><td class="mono">${escapeHtml(item.parent)}</td><td class="mono">${escapeHtml(item.ifname)}</td><td>${escapeHtml(item.role)}</td><td>${item.sessions}</td><td>↑ ${item.tx.toFixed(1)}</td><td>↓ ${item.rx.toFixed(1)}</td><td>${duplicates.has(key) ? statusBadge('fault', '重复') : statusBadge(item.enabled ? 'online' : 'disabled')}</td><td><div class="row-actions"><button class="row-action" data-vlan-edit>编辑</button><button class="row-action danger" data-vlan-delete>删除</button></div></td></tr>`;
  }).join('');
  return {
    html: `${pageHeader('VLAN 管理', '批量建立子接口、检测重复组合并维护启用状态。', '<button class="button" data-vlan-action="batch">批量新增 VLAN</button><button class="button primary" data-vlan-action="add">+ 新增 VLAN</button>')}
      <div class="notice ${duplicates.size ? 'danger' : ''}"><span>${duplicates.size ? '!' : '✓'}</span><div><strong>${duplicates.size ? `检测到 ${duplicates.size} 个重复 VLAN` : '未检测到重复 VLAN'}</strong><p>检测范围为当前演示数据中的父接口与 VLAN ID 组合。</p></div></div>
      ${panel('VLAN 列表', `<div class="toolbar"><button class="button compact" data-vlan-action="delete-selected">批量删除</button><span class="toolbar-spacer"></span><span class="muted">共 ${state.vlans.length} 个 VLAN</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>选择</th><th>启用</th><th>VLAN ID</th><th>父接口</th><th>子接口</th><th>用途</th><th>会话数</th><th>TX Mbps</th><th>RX Mbps</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`)}`,
    mount(root) {
      root.querySelector('[data-vlan-action="add"]').addEventListener('click', () => vlanForm());
      root.querySelector('[data-vlan-action="batch"]').addEventListener('click', () => vlanForm(null, true));
      root.querySelectorAll('[data-vlan-key]').forEach((row) => {
        const [parent, idText] = row.dataset.vlanKey.split('.');
        const locate = () => getState().vlans.find((item) => item.parent === parent && item.id === Number(idText));
        row.querySelector('[data-action="toggle-vlan"]').addEventListener('change', (event) => {
          mutate((state) => { const item = state.vlans.find((entry) => entry.parent === parent && entry.id === Number(idText)); if (item) item.enabled = event.target.checked; }, { source: 'vlans' });
          toast(`${row.dataset.vlanKey} 已${event.target.checked ? '启用' : '停用'}。`);
        });
        row.querySelector('[data-vlan-edit]').addEventListener('click', () => vlanForm(locate()));
        row.querySelector('[data-vlan-delete]').addEventListener('click', async () => {
          if (await confirmAction(`确定删除 VLAN ${row.dataset.vlanKey}？关联会话仅在演示数据中保留。`, '删除')) {
            mutate((state) => { state.vlans = state.vlans.filter((entry) => !(entry.parent === parent && entry.id === Number(idText))); }, { source: 'vlans' });
            toast(`VLAN ${row.dataset.vlanKey} 已删除。`);
          }
        });
      });
      root.querySelector('[data-vlan-action="delete-selected"]').addEventListener('click', async () => {
        const keys = [...root.querySelectorAll('[data-vlan-select]:checked')].map((checkbox) => checkbox.closest('[data-vlan-key]').dataset.vlanKey);
        if (!keys.length) return toast('请先选择 VLAN。', 'error');
        if (await confirmAction(`确定删除已选择的 ${keys.length} 个 VLAN？`, '批量删除')) {
          mutate((state) => { state.vlans = state.vlans.filter((entry) => !keys.includes(`${entry.parent}.${entry.id}`)); }, { source: 'vlans' });
          toast(`已删除 ${keys.length} 个 VLAN。`);
        }
      });
    }
  };
}

export function renderLan() {
  const state = getState();
  const settings = state.settings;
  const previewText = () => `config interface 'lan'\n\toption device '${settings.lanIfname}'\n\toption proto 'static'\n\toption ipv4_cidr '${settings.ipv4Cidr}'\n\toption ula_prefix '${settings.ulaPrefix}'\n\toption mtu '${settings.mtu}'`;
  return {
    html: `${pageHeader('LAN 设置', '统一维护 IPv4 CIDR、RFC4193 ULA、DHCP 和 IPv6 RA。', '')}
      <div class="grid cols-2">
        ${panel('LAN 基本配置', `<form class="panel-content pad" id="lan-form"><div class="form-grid">
          ${field('LAN 接口', input('lanIfname', settings.lanIfname, { required: true }))}
          ${field('IPv4 CIDR', input('ipv4Cidr', settings.ipv4Cidr, { required: true }), "统一使用 ipv4_cidr 字段")}
          ${field('ULA IPv6 前缀', input('ulaPrefix', settings.ulaPrefix, { required: true }))}
          ${field('MTU', input('mtu', settings.mtu, { type: 'number', min: 1280, max: 9000 }))}
          ${field('DNS', input('dns', settings.dns), '多个地址用英文逗号分隔')}
        </div><div class="check-grid" style="margin-top:12px">
          <label class="check-line"><input type="checkbox" name="dhcp" ${settings.dhcp ? 'checked' : ''}>启用 DHCPv4</label>
          <label class="check-line"><input type="checkbox" name="ra" ${settings.ra ? 'checked' : ''}>启用 IPv6 RA</label>
          <label class="check-line"><input type="checkbox" name="dhcpv6" ${settings.dhcpv6 ? 'checked' : ''}>启用 DHCPv6</label>
        </div><div class="button-row" style="margin-top:13px"><button class="button primary" type="submit">保存 LAN 配置</button></div></form>`) }
        ${panel('保存前配置预览', `<div class="panel-content pad"><pre class="config-preview" id="lan-preview">${escapeHtml(previewText())}</pre><div class="notice"><span>i</span><div><strong>不会应用真实网络配置</strong><p>保存只更新浏览器 localStorage，并保留正式 LuCI 后端不变。</p></div></div></div>`) }
      </div>`,
    mount(root) {
      const form = root.querySelector('#lan-form');
      const preview = root.querySelector('#lan-preview');
      const updatePreview = () => {
        const data = new FormData(form);
        preview.textContent = `config interface 'lan'\n\toption device '${data.get('lanIfname')}'\n\toption proto 'static'\n\toption ipv4_cidr '${data.get('ipv4Cidr')}'\n\toption ula_prefix '${data.get('ulaPrefix')}'\n\toption mtu '${data.get('mtu')}'`;
      };
      form.addEventListener('input', updatePreview);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const ipv4 = String(data.get('ipv4Cidr'));
        const ula = String(data.get('ulaPrefix'));
        if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(ipv4) || !/^fd[0-9a-f]{2}:/i.test(ula)) {
          toast('IPv4 CIDR 或 RFC4193 ULA 前缀格式无效。', 'error');
          return;
        }
        mutate((current) => Object.assign(current.settings, {
          lanIfname: data.get('lanIfname'), ipv4Cidr: ipv4, ulaPrefix: ula,
          mtu: Number(data.get('mtu')) || 1500, dns: data.get('dns'),
          dhcp: data.get('dhcp') === 'on', ra: data.get('ra') === 'on', dhcpv6: data.get('dhcpv6') === 'on'
        }), { source: 'lan' });
        toast('LAN 配置已保存到本地演示数据。');
      });
    }
  };
}
