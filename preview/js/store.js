import { createMockState, createOnboardingState, STORE_VERSION } from './mock-data.js';
import { createDualStackData } from './dual-stack-data.js';

const STORAGE_KEY = 'linehub-preview-state-v9';
let state = loadState();

function removeLegacyState() {
  Object.keys(window.localStorage).forEach((key) => {
    if (/^linehub-preview-state-v[1-6]$/.test(key)) window.localStorage.removeItem(key);
  });
}

function scrubSecrets(key, value) {
  if (/password|passwd|secret/i.test(key) && key !== 'secretConfigured') {
    return undefined;
  }
  return value;
}

function normalizePppoeSessions(sessions = []) {
  return sessions.map((session, index) => ({
    id: session.id || `pppoe-migrated-${index + 1}`,
    wanId: session.wanId || `wan-migrated-${index + 1}`,
    parentInterface: session.parentInterface || session.parent || '',
    vlanId: session.vlanId == null ? null : Number(session.vlanId),
    username: session.username || '',
    macMode: session.macMode || 'interface',
    mac: session.mac || '',
    ipv4: session.ipv4 !== false,
    ipv6: session.ipv6 !== false,
    requestPd: session.ipv6 !== false && session.requestPd !== false,
    weight: Number(session.weight) || 1,
    poolId: session.poolId || 'pool-core',
    enabled: session.enabled !== false,
    profileId: session.profileId || 'legacy',
    secretConfigured: Boolean(session.secretConfigured),
    status: session.status || 'configured'
  }));
}

function migrateState(previous) {
  const withDualStack = previous.version === 7 ? { ...previous, ...createDualStackData() } : previous;
  return {
    ...withDualStack,
    version: STORE_VERSION,
    pppoeSessions: normalizePppoeSessions(withDualStack.pppoeSessions)
  };
}

function loadState() {
  removeLegacyState();
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && stored.version === STORE_VERSION && Array.isArray(stored.physicalPorts) && Array.isArray(stored.wanConnections) && stored.dualStackGateway) {
      return stored;
    }
    const previous = JSON.parse(window.localStorage.getItem('linehub-preview-state-v8') || 'null')
      || JSON.parse(window.localStorage.getItem('linehub-preview-state-v7') || 'null');
    if (previous && [7, 8].includes(previous.version) && Array.isArray(previous.physicalPorts)) {
      const migrated = migrateState(previous);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated, scrubSecrets));
      return migrated;
    }
  } catch (_error) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  const initial = createMockState();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial, scrubSecrets));
  return initial;
}

function persist() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state, scrubSecrets));
}

export function getState() {
  return state;
}

export function mutate(mutator, detail = {}) {
  mutator(state);
  persist();
  window.dispatchEvent(new CustomEvent('linehub:state-change', { detail }));
}

export function resetDemoState() {
  Object.keys(window.localStorage).forEach((key) => {
    if (key.startsWith('linehub-preview-')) window.localStorage.removeItem(key);
  });
  state = createMockState();
  persist();
  window.dispatchEvent(new CustomEvent('linehub:state-change', { detail: { reset: true } }));
}

export function restoreFirstRun() {
  state = createMockState();
  state.systemStatus = 'unconfigured';
  state.onboarding = createOnboardingState();
  persist();
  window.dispatchEvent(new CustomEvent('linehub:state-change', { detail: { source: 'first-run', reset: true } }));
}

export function subscribe(listener) {
  window.addEventListener('linehub:state-change', listener);
  return () => window.removeEventListener('linehub:state-change', listener);
}

export function exportConfiguration() {
  return JSON.stringify(state, scrubSecrets, 2);
}
