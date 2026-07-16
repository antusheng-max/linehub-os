export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function maskAccount(account) {
  const [local = '', realm = ''] = String(account || '').split('@');
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}••••${realm ? `@${realm}` : ''}`;
}

export function formatSpeed(value) {
  const numeric = Number(value) || 0;
  return numeric >= 1000 ? `${(numeric / 1000).toFixed(2)} Gbps` : `${numeric.toFixed(1)} Mbps`;
}

export function formatInteger(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

export function statusLabel(status) {
  return {
    online: '在线', dialing: '拨号中', fault: '故障', disabled: '停用',
    up: '已连接', down: '未连接', healthy: '健康', warning: '注意', critical: '严重'
  }[status] || status || '未知';
}

export function statusBadge(status, label = statusLabel(status)) {
  return `<span class="status-badge ${escapeHtml(status)}"><i></i>${escapeHtml(label)}</span>`;
}

export function toggle({ checked, label, action, disabled = false }) {
  return `<label class="toggle" title="${escapeHtml(label)}">
    <input type="checkbox" aria-label="${escapeHtml(label)}" data-action="${escapeHtml(action)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    <span></span>
  </label>`;
}

export function statCard({ label, value, detail = '', tone = 'blue', icon = '•' }) {
  return `<article class="stat-card ${escapeHtml(tone)}">
    <span class="stat-icon" aria-hidden="true">${escapeHtml(icon)}</span>
    <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>
  </article>`;
}

export function pageHeader(title, description, actions = '') {
  return `<div class="page-header">
    <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
    <div class="page-actions">${actions}</div>
  </div>`;
}

export function panel(title, content, options = {}) {
  const subtitle = options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : '';
  const tools = options.tools || '';
  const className = options.className || '';
  return `<section class="panel ${escapeHtml(className)}">
    <header class="panel-header"><div><h2>${escapeHtml(title)}</h2>${subtitle}</div><div class="panel-tools">${tools}</div></header>
    <div class="panel-content">${content}</div>
  </section>`;
}

export function progressBar(value, tone = 'blue') {
  const safe = Math.min(100, Math.max(0, Number(value) || 0));
  return `<div class="progress ${escapeHtml(tone)}"><span style="width:${safe}%"></span></div>`;
}

export function pagination({ page, pages, total }) {
  return `<div class="pagination">
    <span>共 ${formatInteger(total)} 条</span>
    <button class="button compact" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
    <strong>${page} / ${Math.max(1, pages)}</strong>
    <button class="button compact" type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
  </div>`;
}

export function toast(message, type = 'success') {
  const stack = document.querySelector('#toast-stack');
  if (!stack) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '×' : 'i'}</span><div><strong>${type === 'success' ? '操作成功' : type === 'error' ? '操作失败' : '提示'}</strong><p>${escapeHtml(message)}</p></div>`;
  stack.append(item);
  window.setTimeout(() => item.classList.add('show'), 20);
  window.setTimeout(() => {
    item.classList.remove('show');
    window.setTimeout(() => item.remove(), 180);
  }, 2600);
}

export function openDrawer({ title, body, kicker = 'LINEHUB CONFIGURATION', width = 'normal', onMount }) {
  const drawer = document.querySelector('#drawer');
  const backdrop = document.querySelector('#drawer-backdrop');
  drawer.className = `drawer ${width === 'wide' ? 'wide' : ''}`;
  document.querySelector('#drawer-title').textContent = title;
  document.querySelector('#drawer-kicker').textContent = kicker;
  document.querySelector('#drawer-body').innerHTML = body;
  backdrop.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  if (onMount) onMount(document.querySelector('#drawer-body'));
}

export function closeDrawer() {
  document.querySelector('#drawer')?.setAttribute('aria-hidden', 'true');
  document.querySelector('#drawer-backdrop').hidden = true;
  document.body.classList.remove('drawer-open');
  const body = document.querySelector('#drawer-body');
  if (body) body.replaceChildren();
}

export function confirmAction(message, confirmLabel = '确认') {
  const dialog = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-message').textContent = message;
  document.querySelector('#confirm-submit').textContent = confirmLabel;
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

export function field(label, control, hint = '') {
  return `<label class="form-field"><span>${escapeHtml(label)}</span>${control}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</label>`;
}

export function input(name, value = '', options = {}) {
  const type = options.type || 'text';
  return `<input class="input" type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''} ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${escapeHtml(options.min)}"` : ''} ${options.max !== undefined ? `max="${escapeHtml(options.max)}"` : ''}>`;
}

export function select(name, choices, selected) {
  return `<select class="select" name="${escapeHtml(name)}">${choices.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`;
}

export function formActions(primary = '保存配置', secondary = '取消') {
  return `<div class="form-actions"><button class="button" type="button" data-action="cancel">${escapeHtml(secondary)}</button><button class="button primary" type="submit">${escapeHtml(primary)}</button></div>`;
}

export function emptyState(title, description) {
  return `<div class="empty-state"><span>◇</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
}
