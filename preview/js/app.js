import { getState, resetDemoState, restoreFirstRun, subscribe } from './store.js';
import { closeDrawer, confirmAction, escapeHtml, openDrawer, toast } from './components.js';
import { currentRoute, DEFAULT_ROUTE, menuGroups, navigate, routeMeta, startRouter, UI_VERSION } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderNetwork } from './pages/network.js';
import { renderLines } from './pages/lines.js';
import { renderFirstRun } from './pages/first-run.js';
import { renderHardware } from './pages/hardware.js';
import { renderDualStack } from './pages/dual-stack.js';
import { renderPools } from './pages/pools.js';
import { renderBalancing } from './pages/balancing.js';
import { renderIpv6 } from './pages/ipv6.js';
import { renderServers } from './pages/servers.js';
import { renderFirewall } from './pages/firewall.js';
import { renderDiagnostics } from './pages/diagnostics.js';
import { renderSystem } from './pages/system.js';

const pageView = document.querySelector('#page-view');
const sidebarNav = document.querySelector('#sidebar-nav');
const breadcrumb = document.querySelector('#breadcrumb');
const adminButton = document.querySelector('#admin-button');
const adminMenu = document.querySelector('#admin-menu');
const mobileBackdrop = document.querySelector('#mobile-backdrop');
let activeMountCleanup = null;

function routeRenderer(route) {
  if (route.startsWith('overview/')) return renderDashboard(route);
  if (route.startsWith('network/')) return renderNetwork(route);
  if (route.startsWith('lines/')) return renderLines(route);
  if (route.startsWith('dual-stack/')) return renderDualStack(route);
  if (route === 'system/hardware') return renderHardware();
  if (route === 'multi/pools' || route === 'multi/health') return renderPools(route.replace('multi/', 'aggregation/'));
  if (route.startsWith('multi/')) return renderBalancing(route.replace('multi/', 'aggregation/'));
  if (route.startsWith('ipv6/')) return renderIpv6(route);
  if (route.startsWith('servers/')) return renderServers(route);
  if (route.startsWith('security/')) {
    const mapped = { 'security/firewall': 'firewall/ipv6', 'security/nat': 'firewall/nat', 'security/access': 'firewall/access', 'security/mappings': 'firewall/ports' }[route];
    return renderFirewall(mapped);
  }
  if (route.startsWith('diagnostics/')) return renderDiagnostics(route);
  if (route.startsWith('system/')) return renderSystem(route);
  return renderNetwork(DEFAULT_ROUTE);
}

function renderSidebar(route) {
  const firstRun = getState().systemStatus === 'unconfigured';
  if (firstRun) {
    sidebarNav.innerHTML = '<span class="nav-primary active first-run-nav"><span class="nav-icon">启</span><span class="nav-label">首次配置</span></span>';
  } else {
    const meta = routeMeta(route);
    sidebarNav.innerHTML = menuGroups.map((group) => `<a class="nav-primary ${group.id === meta.groupId ? 'active' : ''}" href="#/${group.route}" data-route="${group.route}" title="${escapeHtml(group.label)}"><span class="nav-icon" aria-hidden="true">${escapeHtml(group.icon)}</span><span class="nav-label">${escapeHtml(group.label)}</span></a>`).join('');
    sidebarNav.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', closeMobileNav));
  }
  document.querySelector('.sidebar-footer strong').textContent = firstRun ? '首次配置模式' : '本地演示模式';
  document.querySelector('.sidebar-footer div > span').textContent = firstRun ? '管理接口 · LAN · WAN · 应用' : '模拟配置 · 无真实网络操作';
}

function pageTabs(meta) {
  return `<nav class="page-tabs" aria-label="${escapeHtml(meta.group)}页面">${meta.tabs.map(([route, label]) => `<a href="#/${route}" class="${route === meta.route ? 'active' : ''}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

function renderTopbar() {
  const state = getState();
  document.querySelector('#top-cpu').textContent = `${state.system.cpu}%`;
  document.querySelector('#top-memory').textContent = `${state.system.memory}%`;
  document.querySelector('#cpu-meter').style.width = `${state.system.cpu}%`;
  document.querySelector('#memory-meter').style.width = `${state.system.memory}%`;
  document.querySelector('#top-up').textContent = `${state.system.upload.toFixed(1)}M`;
  document.querySelector('#top-down').textContent = `${state.system.download.toFixed(1)}M`;
  document.querySelector('#alarm-count').textContent = String(state.alerts.filter((alert) => !alert.acknowledged).length);
}

function renderRoute(route = currentRoute()) {
  const firstRun = getState().systemStatus === 'unconfigured';
  if (typeof activeMountCleanup === 'function') activeMountCleanup();
  if (firstRun) {
    breadcrumb.textContent = '首次配置 / 管理接入与网络配置';
    document.title = '首次配置 · LineHub OS';
    const view = renderFirstRun();
    pageView.innerHTML = view.html;
    activeMountCleanup = view.mount?.(pageView) || null;
  } else {
    const meta = routeMeta(route);
    breadcrumb.textContent = `${meta.group} / ${meta.page}`;
    document.title = `${meta.page} · LineHub OS`;
    const view = routeRenderer(meta.route);
    pageView.innerHTML = `${pageTabs(meta)}${view.html}`;
    activeMountCleanup = view.mount?.(pageView) || null;
  }
  renderTopbar();
}

function closeMobileNav() {
  document.body.classList.remove('mobile-nav-open');
  mobileBackdrop.hidden = true;
}

function updateClock() {
  document.querySelector('#current-time').textContent = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(new Date()).replaceAll('/', '-');
}

async function restoreDemo() {
  if (!await confirmAction('确定清除旧预览状态并载入新版功能优先演示数据？', '恢复')) return;
  resetDemoState();
  window.localStorage.setItem('linehub-preview-interface-version', UI_VERSION);
  navigate(DEFAULT_ROUTE);
  toast('已载入新版演示数据，并进入首次配置向导。');
}

document.querySelector('#sidebar-collapse').addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed');
  window.localStorage.setItem('linehub-preview-sidebar-collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
});
if (window.localStorage.getItem('linehub-preview-sidebar-collapsed') === '1') document.body.classList.add('sidebar-collapsed');

document.querySelector('#mobile-menu').addEventListener('click', () => { document.body.classList.add('mobile-nav-open'); mobileBackdrop.hidden = false; });
mobileBackdrop.addEventListener('click', closeMobileNav);
document.querySelector('#drawer-close').addEventListener('click', closeDrawer);
document.querySelector('#drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer(); });

document.querySelector('#reset-demo-button').addEventListener('click', restoreDemo);
adminButton.addEventListener('click', () => { const open = adminMenu.hidden; adminMenu.hidden = !open; adminButton.setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', (event) => {
  if (!adminButton.contains(event.target) && !adminMenu.contains(event.target)) { adminMenu.hidden = true; adminButton.setAttribute('aria-expanded', 'false'); }
});
adminMenu.querySelectorAll('[data-admin-action]').forEach((button) => button.addEventListener('click', async () => {
  adminMenu.hidden = true;
  if (button.dataset.adminAction === 'first-run') {
    if (await confirmAction('确定恢复首次配置状态？当前本地模拟修改将被清除。', '恢复')) {
      restoreFirstRun(); window.localStorage.setItem('linehub-preview-interface-version', UI_VERSION); navigate(DEFAULT_ROUTE); toast('已恢复首次配置状态。');
    }
  } else if (button.dataset.adminAction === 'profile') navigate('system/basic');
  else openDrawer({ title: '关于 LineHub OS', kicker: 'LOCAL PREVIEW', body: '<div class="notice"><span>i</span><div><strong>LineHub OS Function-first Preview</strong><p>网络配置从功能入口开始，统一接口选择器负责筛选物理接口；所有操作仅保存在浏览器本地。</p></div></div>' });
}));

document.querySelector('#alarm-button').addEventListener('click', () => navigate('overview/alerts'));
window.addEventListener('linehub:rerender', () => renderRoute(currentRoute()));
subscribe(() => { renderRoute(currentRoute()); renderSidebar(currentRoute()); });
startRouter((route) => { closeDrawer(); renderSidebar(route); renderRoute(route); pageView.focus({ preventScroll: true }); });

updateClock();
window.setInterval(updateClock, 1000);
