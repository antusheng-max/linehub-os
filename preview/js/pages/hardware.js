import { getState } from '../store.js';
import { escapeHtml, pageHeader, panel } from '../components.js';

function cardSection(state, card) {
  const ports = state.physicalPorts.filter((port) => port.nicId === card.id);
  const details = `<div class="hardware-summary"><div><span>网卡型号</span><strong>${escapeHtml(card.model)}</strong></div><div><span>PCI 地址</span><strong class="mono">${escapeHtml(card.pci)}</strong></div><div><span>驱动 / 固件</span><strong>${escapeHtml(`${card.driver} / ${card.firmware}`)}</strong></div><div><span>NUMA 节点</span><strong>${card.numa}</strong></div><div><span>网口 / 最大速率</span><strong>${card.portCount} / ${escapeHtml(card.maxSpeed)}</strong></div><div><span>温度 / 驱动状态</span><strong>${escapeHtml(`${card.temperature} / ${card.driverStatus === 'healthy' ? '正常' : '异常'}`)}</strong></div></div>`;
  const table = `<div class="compact-table-wrap"><table class="data-table hardware-port-table"><thead><tr><th>接口</th><th>介质</th><th>模块</th><th>温度</th><th>RX / TX 光功率</th><th>兼容性</th></tr></thead><tbody>${ports.map((port) => `<tr><td><strong class="mono">${escapeHtml(port.name)}</strong><small>端口 ${port.portNumber}</small></td><td>${escapeHtml(port.medium)}</td><td>${escapeHtml(port.optical?.module || '不适用')}</td><td>${escapeHtml(port.optical?.temperature || '不支持')}</td><td>${escapeHtml(port.optical ? `${port.optical.rxPower} / ${port.optical.txPower}` : '不适用')}</td><td>${port.optical ? (port.optical.compatible ? '兼容' : '<span class="danger-text">不兼容</span>') : '不适用'}</td></tr>`).join('')}</tbody></table></div>`;
  return panel(card.model, `${details}<details class="hardware-port-details"><summary>查看 ${ports.length} 个物理网口与光模块信息</summary>${table}</details>`, { subtitle: `${card.pci} · ${card.driver} · ${card.portCount} 个端口` });
}

export function renderHardware() {
  const state = getState();
  return { html: `<div class="function-page hardware-page">${pageHeader('硬件信息', '网卡型号、PCI、驱动、固件与光模块信息集中在此，仅用于诊断。')}<div class="hardware-list">${state.physicalCards.map((card) => cardSection(state, card)).join('')}</div></div>` };
}
