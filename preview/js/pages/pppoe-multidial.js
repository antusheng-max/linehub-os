import { pageHeader } from '../components.js';
import { getState } from '../store.js';
import { openInterfaceStatus, renderInterfaceStatusBar } from '../interface-selector.js';
import { PppoeSessionEditor } from '../pppoe-editor.js';

function renderEditorPage({ title, description, mode, profileId, initialCount = 6 }) {
  const state = getState();
  return {
    html: `<div class="function-page multidial-function-page">
      ${renderInterfaceStatusBar(state)}
      ${pageHeader(title, description)}
      <section class="multidial-security-note" aria-label="密码安全说明">
        <span>安全</span>
        <p><strong>每个账号都是独立PPPoE会话。</strong> 密码仅保存在当前页面内存中，预览、localStorage、日志和URL均不会保存明文；刷新后必须重新输入。</p>
      </section>
      <div data-pppoe-editor-host></div>
    </div>`,
    mount(root) {
      root.querySelectorAll('[data-view-interfaces]').forEach((button) => button.addEventListener('click', () => openInterfaceStatus(getState())));
      new PppoeSessionEditor(root.querySelector('[data-pppoe-editor-host]'), {
        mode,
        profileId,
        parentInterface: 'eth4',
        initialCount
      });
    }
  };
}

export function renderMultiDialPage() {
  return renderEditorPage({
    title: '单线多拨',
    description: '在同一个物理接口上维护多组独立账号；一行就是一个可校验、可排序、可启停的PPPoE会话。',
    mode: 'single',
    profileId: 'single-multidial',
    initialCount: 6
  });
}

export function renderVlanDialPage() {
  return renderEditorPage({
    title: 'VLAN拨号',
    description: '先输入VLAN，再为该VLAN逐行配置账号和密码；支持一个VLAN建立多个独立PPPoE会话。',
    mode: 'vlan-dial',
    profileId: 'vlan-dial'
  });
}

export function renderVlanMultiDialPage() {
  return renderEditorPage({
    title: 'VLAN单线多拨',
    description: '按范围、手动或文本导入生成VLAN配置块，并在每个VLAN下维护一组或多组独立账号。',
    mode: 'vlan-multidial',
    profileId: 'vlan-multidial'
  });
}
