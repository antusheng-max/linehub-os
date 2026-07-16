import { getState, mutate } from '../store.js';
import { escapeHtml, field, input, maskAccount, pageHeader, toast } from '../components.js';
import { renderInterfaceSelector, selectedInterfaces } from '../interface-selector.js';
import { renderWanFields, renderWanTypeChooser, wanTypeLabel } from '../wan-config.js';

function steps(active) {
  return `<ol class="first-run-steps">${['确认管理接口', '选择 LAN 接口', '新增 WAN', '预览与应用'].map((label, index) => `<li class="${index + 1 === active ? 'active' : index + 1 < active ? 'done' : ''}"><i>${index + 1 < active ? '✓' : index + 1}</i><span>${label}</span></li>`).join('')}</ol>`;
}

function shell(step, content) {
  return `<div class="first-run-page">${pageHeader('LineHub OS 首次配置', '仅完成管理接入、LAN 和 WAN；高级功能将在首次配置完成后显示。')} ${steps(step)}<section class="first-run-card">${content}</section><footer class="first-run-safety"><span>只读模拟环境</span>不会执行真实网络命令；配置仅保存在当前浏览器。</footer></div>`;
}

function nextStep(step, changes = () => {}) {
  mutate((state) => { changes(state); state.onboarding.quickStep = step; }, { source: 'first-run' });
}

function managementStep(state) {
  const port = state.physicalPorts.find((item) => item.name === state.onboarding.managementPort);
  return {
    html: shell(1, `<span class="step-kicker">STEP 1 / 4</span><h2>检测到当前管理接口</h2><div class="detected-interface"><span class="link-symbol">↔</span><div><strong class="mono">${escapeHtml(port.name)}</strong><p>已连接 · ${escapeHtml(port.speed)} · 当前管理连接</p></div><b>临时保护</b></div><p class="step-explanation">首次安装允许从任意已插线网口进入 Web。完成 LAN 配置前，该接口不会被直接改作 WAN。</p><div class="form-actions"><button class="button primary" type="button" data-next>确认并继续</button></div>`),
    mount(root) { root.querySelector('[data-next]').addEventListener('click', () => nextStep(2)); }
  };
}

function lanStep(state) {
  const selected = state.onboarding.lan.members;
  return {
    html: shell(2, `<span class="step-kicker">STEP 2 / 4</span><h2>选择 LAN 成员接口</h2><p class="step-explanation">当前管理接口已高亮。可选择多个网口加入 br-lan，未插线接口也可以预先配置。</p><form id="first-lan-form">${renderInterfaceSelector({ state, context: 'lan', name: 'members', selected, multiple: true })}<div class="selected-interface-list" data-selected-list>${selectedInterfaces(state, selected)}</div><div class="form-grid compact-first-form">${field('LAN 名称', input('bridgeName', state.onboarding.lan.bridge))}${field('IPv4 地址', input('ipv4Cidr', state.onboarding.lan.ipv4Cidr))}</div><div class="form-actions"><button class="button" type="button" data-back>上一步</button><button class="button primary" type="submit">继续新增 WAN</button></div></form>`),
    mount(root) {
      const form = root.querySelector('#first-lan-form');
      const refresh = () => { const names = [...form.querySelectorAll('input[name="members"]:checked')].map((node) => node.value); root.querySelector('[data-selected-list]').innerHTML = selectedInterfaces(getState(), names) || '<span class="selection-empty">至少选择一个 LAN 接口</span>'; };
      form.querySelectorAll('input[name="members"]').forEach((node) => node.addEventListener('change', refresh));
      root.querySelector('[data-back]').addEventListener('click', () => nextStep(1));
      form.addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(form); const members = data.getAll('members'); if (!members.length) { toast('至少选择一个 LAN 接口。', 'error'); return; } nextStep(3, (draft) => { draft.onboarding.lan.members = members; draft.onboarding.lan.bridge = data.get('bridgeName'); draft.onboarding.lan.ipv4Cidr = data.get('ipv4Cidr'); }); });
    }
  };
}

function wanStep(state) {
  const config = state.onboarding.wanConfigs.primary || {};
  const selectedType = config.type || '';
  return {
    html: shell(3, `<span class="step-kicker">STEP 3 / 4</span><h2>新增 WAN</h2><p class="step-explanation">管理口与已选 LAN 口自动排除。先选择接口和连接方式，再填写对应参数。</p><form id="first-wan-form"><div class="first-wan-columns"><section><h3>物理接口</h3>${renderInterfaceSelector({ state, context: 'wan', name: 'interface', selected: state.onboarding.activeWanPort, showAll: true })}<h3>连接方式</h3>${renderWanTypeChooser(selectedType)}</section><section class="dynamic-fields" data-first-wan-fields><h3>连接参数</h3>${renderWanFields(selectedType)}</section></div><div class="form-actions"><button class="button" type="button" data-back>上一步</button><button class="button primary" type="submit" ${selectedType ? '' : 'disabled'}>查看配置预览</button></div></form>`),
    mount(root) {
      const form = root.querySelector('#first-wan-form');
      root.querySelector('[data-back]').addEventListener('click', () => nextStep(2));
      form.querySelectorAll('input[name="connectionType"]').forEach((radio) => radio.addEventListener('change', () => { form.querySelectorAll('.wan-type-option').forEach((item) => item.classList.toggle('selected', item.contains(radio))); root.querySelector('[data-first-wan-fields]').innerHTML = `<h3>连接参数</h3>${renderWanFields(radio.value)}`; form.querySelector('button[type="submit"]').disabled = false; }));
      form.addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(form); const interfaceName = String(data.get('interface') || ''); const type = String(data.get('connectionType') || ''); if (!interfaceName || !type) { toast('请选择 WAN 接口和连接方式。', 'error'); return; } nextStep(4, (draft) => { draft.onboarding.activeWanPort = interfaceName; draft.onboarding.selectedWanPorts = [interfaceName]; draft.onboarding.wanConfigs.primary = { type, name: String(data.get('lineName') || `${wanTypeLabel(type)} 线路`), username: String(data.get('username') || ''), secretConfigured: Boolean(data.get('password')), ipv4: data.get('ipv4') === 'on' || type === 'static', ipv6: data.get('ipv6') === 'on', vlanId: Number(data.get('vlanId')) || null }; }); });
    }
  };
}

function applyConfiguration(root) {
  const button = root.querySelector('[data-apply]');
  const countdown = root.querySelector('[data-countdown]');
  let remaining = 60;
  button.disabled = true;
  countdown.hidden = false;
  countdown.innerHTML = `<strong>${remaining}s</strong><span>等待管理连接确认；超时将自动回滚</span><button class="button compact primary" type="button" data-confirm>确认连接正常</button><button class="button compact" type="button" data-fail>模拟连接失败</button>`;
  const timer = window.setInterval(() => { remaining -= 1; const value = countdown.querySelector('strong'); if (value) value.textContent = `${remaining}s`; if (remaining <= 0) { window.clearInterval(timer); toast('确认超时，已模拟自动回滚。', 'error'); button.disabled = false; countdown.hidden = true; } }, 1000);
  countdown.querySelector('[data-fail]').addEventListener('click', () => { window.clearInterval(timer); toast('连接检查失败，已模拟自动回滚。', 'error'); button.disabled = false; countdown.hidden = true; });
  countdown.querySelector('[data-confirm]').addEventListener('click', () => {
    window.clearInterval(timer);
    mutate((state) => {
      const { lan, activeWanPort, wanConfigs } = state.onboarding;
      state.lanBridges = [{ id: 'lan-main', name: lan.bridge, members: lan.members, ipv4Cidr: lan.ipv4Cidr, ulaPrefix: lan.ulaPrefix, dhcp: lan.dhcp, poolStart: lan.poolStart, poolEnd: lan.poolEnd, ra: lan.ra, dhcpv6: lan.dhcpv6, mtu: lan.mtu }];
      state.physicalPorts.forEach((port) => { port.management = false; if (lan.members.includes(port.name)) port.role = 'lan'; else if (port.name === activeWanPort) port.role = wanConfigs.primary.type === 'vlan' ? 'vlan-parent' : 'wan'; else if (port.role === 'temporary-management') port.role = 'unassigned'; });
      const config = wanConfigs.primary;
      state.wanConnections = [{ id: 'wan-01', name: config.name, interface: activeWanPort, type: config.type, status: 'online', ipv4: config.ipv4, ipv6: config.ipv6, rx: 0, tx: 0, weight: 1, pool: '核心出口池', username: config.username, secretConfigured: config.secretConfigured, vlanId: config.vlanId }];
      state.systemStatus = 'configured';
      state.onboarding.apply = { status: 'confirmed', deadline: null, outcome: 'success', logs: ['配置校验通过', '管理连接确认成功', '模拟配置已保存'] };
    }, { source: 'first-run-complete' });
    window.location.hash = '#/network/lan';
    toast('首次配置已完成，进入正常管理控制台。');
  });
}

function previewStep(state) {
  const lan = state.onboarding.lan;
  const wan = state.onboarding.wanConfigs.primary;
  return {
    html: shell(4, `<span class="step-kicker">STEP 4 / 4</span><h2>配置预览与应用</h2><div class="configuration-summary"><div><span>当前管理接口</span><strong class="mono">${escapeHtml(state.onboarding.managementPort)}</strong></div><div><span>LAN 桥 / 成员</span><strong>${escapeHtml(`${lan.bridge} · ${lan.members.join(', ')}`)}</strong></div><div><span>LAN 地址</span><strong class="mono">${escapeHtml(lan.ipv4Cidr)}</strong></div><div><span>WAN 接口</span><strong class="mono">${escapeHtml(state.onboarding.activeWanPort)}</strong></div><div><span>连接方式</span><strong>${escapeHtml(wanTypeLabel(wan.type))}</strong></div><div><span>线路名称</span><strong>${escapeHtml(wan.name)}</strong></div>${wan.username ? `<div><span>拨号账号</span><strong>${escapeHtml(maskAccount(wan.username))}</strong></div>` : ''}<div><span>密码</span><strong>${wan.secretConfigured ? '已配置（已脱敏）' : '不需要'}</strong></div></div><div class="validation-pass"><span>✓</span><div><strong>配置校验通过</strong><p>LAN 至少包含一个接口；管理口未被直接改作 WAN；密码未保存明文。</p></div></div><div class="apply-countdown" data-countdown hidden></div><div class="form-actions"><button class="button" type="button" data-back>返回修改</button><button class="button primary" type="button" data-apply>模拟应用配置</button></div>`),
    mount(root) { root.querySelector('[data-back]').addEventListener('click', () => nextStep(3)); root.querySelector('[data-apply]').addEventListener('click', () => applyConfiguration(root)); }
  };
}

export function renderFirstRun() {
  const state = getState();
  const step = Math.min(4, Math.max(1, state.onboarding.quickStep || 1));
  if (step === 2) return lanStep(state);
  if (step === 3) return wanStep(state);
  if (step === 4) return previewStep(state);
  return managementStep(state);
}
