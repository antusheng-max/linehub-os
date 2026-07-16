import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.window = {
  localStorage: new MemoryStorage(),
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
  setTimeout
};
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

const {
  buildPppoePreviewModel,
  clonePppoeSession,
  createPppoeSession,
  createVlanRange,
  deletePppoeSession,
  generatedMac,
  movePppoeSession,
  parsePppoeBatch,
  serializePppoeSessions,
  validatePppoeModel
} = await import('../js/pppoe-editor.js');
const { getState, mutate } = await import('../js/store.js');

const defaults = { ipv4: true, ipv6: true, requestPd: true, weight: 1, poolId: 'pool-core', enabled: true };
const pools = [{ id: 'pool-core', name: '核心出口池' }];
const cases = [];

function check(name, fn) {
  fn();
  cases.push(name);
}

function passwordsFor(groups, missing = null) {
  const passwords = new Map();
  groups.flatMap((group) => group.sessions).forEach((row) => passwords.set(row.localId, row.localId === missing ? '' : `memory-${row.localId}`));
  return passwords;
}

function validate(groups, passwords = passwordsFor(groups)) {
  return validatePppoeModel({ groups, parentInterface: 'eth4', passwords, pools, existingSessions: [], profileId: 'acceptance' });
}

check('手动创建6条独立账号', () => {
  const sessions = Array.from({ length: 6 }, (_, index) => createPppoeSession({ index: index + 1, parentInterface: 'eth4', defaults, username: `demo-user-${String(index + 1).padStart(3, '0')}` }));
  const groups = [{ id: 'single', vlanId: null, sessions }];
  assert.equal(validate(groups).valid, true);
  assert.equal(new Set(sessions.map((row) => row.localId)).size, 6);
});

check('批量粘贴6条账号密码', () => {
  const input = Array.from({ length: 6 }, (_, index) => index % 2 ? `demo-user-${index + 1} demo-password-${index + 1}` : `demo-user-${index + 1},demo-password-${index + 1}`).join('\n');
  const parsed = parsePppoeBatch(input, { parentInterface: 'eth4', defaults });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.rows.length, 6);
  assert.ok(parsed.rows.every((item) => item.transientPassword.startsWith('demo-password-')));
});

check('一个VLAN配置3个账号', () => {
  const result = createVlanRange({ start: 101, end: 101, step: 1, perVlan: 3, parentInterface: 'eth4', defaults });
  result.groups[0].sessions.forEach((row, index) => { row.username = `v101-user-${index + 1}`; });
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].sessions.length, 3);
  assert.equal(validate(result.groups).valid, true);
});

check('6个VLAN每个1个账号', () => {
  const result = createVlanRange({ start: 101, end: 111, step: 2, perVlan: 1, parentInterface: 'eth4', defaults });
  result.groups.forEach((group) => { group.sessions[0].username = `vlan-${group.vlanId}`; });
  assert.deepEqual(result.groups.map((group) => group.vlanId), [101, 103, 105, 107, 109, 111]);
  assert.equal(validate(result.groups).valid, true);
});

check('6个VLAN每个2个账号', () => {
  const result = createVlanRange({ start: 101, end: 111, step: 2, perVlan: 2, parentInterface: 'eth4', defaults });
  result.groups.forEach((group) => group.sessions.forEach((row, index) => { row.username = `v${group.vlanId}-user-${index + 1}`; }));
  assert.equal(result.groups.flatMap((group) => group.sessions).length, 12);
  assert.equal(validate(result.groups).valid, true);
});

check('新增删除复制移动保持独立对象', () => {
  const first = createPppoeSession({ index: 1, parentInterface: 'eth4', defaults, username: 'first' });
  const second = createPppoeSession({ index: 2, parentInterface: 'eth4', defaults, username: 'second' });
  const sessions = [first, second];
  const copy = clonePppoeSession(first, { wanId: 'wan-003', mac: generatedMac(3) });
  copy.username = 'modified-copy';
  sessions.splice(1, 0, copy);
  assert.notEqual(copy.localId, first.localId);
  assert.equal(copy.secretConfigured, false);
  assert.equal(movePppoeSession(sessions, 1, 1), true);
  assert.equal(sessions[2].localId, copy.localId);
  assert.equal(deletePppoeSession(sessions, 2).localId, copy.localId);
  assert.equal(sessions.length, 2);
});

check('重复账号被拒绝', () => {
  const rows = [1, 2].map((index) => createPppoeSession({ index, parentInterface: 'eth4', defaults, username: 'same-account' }));
  const result = validate([{ id: 'single', vlanId: null, sessions: rows }]);
  assert.equal(result.valid, false);
  assert.ok(rows.every((row) => result.rowErrors.get(row.localId).username.includes('账号重复')));
});

check('重复WAN ID被拒绝', () => {
  const rows = [1, 2].map((index) => createPppoeSession({ index, parentInterface: 'eth4', defaults, username: `user-${index}` }));
  rows[1].wanId = rows[0].wanId;
  const result = validate([{ id: 'single', vlanId: null, sessions: rows }]);
  assert.equal(result.valid, false);
  assert.ok(result.rowErrors.get(rows[0].localId).wanId.includes('WAN ID重复'));
});

check('重复MAC被拒绝', () => {
  const rows = [1, 2].map((index) => createPppoeSession({ index, parentInterface: 'eth4', defaults, username: `mac-user-${index}` }));
  rows[1].mac = rows[0].mac;
  const result = validate([{ id: 'single', vlanId: null, sessions: rows }]);
  assert.equal(result.valid, false);
  assert.ok(result.rowErrors.get(rows[1].localId).mac.includes('MAC重复'));
});

check('空密码被拒绝', () => {
  const row = createPppoeSession({ index: 1, parentInterface: 'eth4', defaults, username: 'password-user' });
  const groups = [{ id: 'single', vlanId: null, sessions: [row] }];
  const result = validate(groups, passwordsFor(groups, row.localId));
  assert.equal(result.valid, false);
  assert.ok(result.rowErrors.get(row.localId).password[0].includes('密码不能为空'));
});

check('非法VLAN被拒绝', () => {
  const row = createPppoeSession({ index: 1, vlanId: 5000, parentInterface: 'eth4', defaults, username: 'bad-vlan-user' });
  const result = validate([{ id: 'vlan-5000', vlanId: 5000, sessions: [row] }]);
  assert.equal(result.valid, false);
  assert.ok(result.generalErrors.some((message) => message.includes('1到4094')));
});

check('序列化结果不包含密码', () => {
  const row = createPppoeSession({ index: 1, parentInterface: 'eth4', defaults, username: 'safe-user' });
  const groups = [{ id: 'single', vlanId: null, sessions: [row] }];
  const saved = serializePppoeSessions({ groups, parentInterface: 'eth4', profileId: 'safe-profile' });
  const json = JSON.stringify(saved);
  assert.equal(Object.hasOwn(saved[0], 'password'), false);
  assert.equal(json.includes('memory-'), false);
  assert.equal(saved[0].secretConfigured, true);
});

check('生成完整预览并模拟保存', () => {
  const result = createVlanRange({ start: 101, end: 103, step: 2, perVlan: 2, parentInterface: 'eth4', defaults });
  result.groups.forEach((group) => group.sessions.forEach((row, index) => { row.username = `preview-${group.vlanId}-${index + 1}`; }));
  const passwords = passwordsFor(result.groups);
  assert.equal(validate(result.groups, passwords).valid, true);
  const preview = buildPppoePreviewModel({ groups: result.groups, parentInterface: 'eth4', passwords });
  assert.equal(preview.count, 4);
  assert.deepEqual(preview.groups.map((group) => group.interfaceName), ['eth4.101', 'eth4.103']);
  assert.ok(preview.groups.flatMap((group) => group.sessions).every((row) => row.passwordConfigured && row.wanId && row.mac && row.poolId));
  const saved = serializePppoeSessions({ groups: result.groups, parentInterface: 'eth4', profileId: 'acceptance-save', status: 'dialing' });
  mutate((state) => { state.pppoeSessions = [...state.pppoeSessions.filter((row) => row.profileId !== 'acceptance-save'), ...saved]; }, { source: 'acceptance-simulate-save' });
  assert.equal(getState().pppoeSessions.filter((row) => row.profileId === 'acceptance-save').length, 4);
  assert.equal(window.localStorage.getItem('linehub-preview-state-v9').includes('memory-'), false);
});

check('localStorage持久化层过滤密码字段', () => {
  mutate((state) => { state.pppoeSessions[0].password = 'plain-secret-probe'; }, { source: 'security-test' });
  const persisted = window.localStorage.getItem('linehub-preview-state-v9');
  assert.equal(persisted.includes('plain-secret-probe'), false);
  assert.equal(persisted.includes('"password"'), false);
});

console.log(`PPPoE editor acceptance: ${cases.length}/${cases.length} PASS`);
cases.forEach((name) => console.log(`  PASS ${name}`));
