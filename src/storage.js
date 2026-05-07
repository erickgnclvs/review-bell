const DEFAULT_STATE = {
  token: '',
  repos: [],
  attentionItems: [],
  notifiedKeys: [],
  lastCheckedAt: null,
  lastError: null
};

export async function getState() {
  const stored = await chrome.storage.local.get(null);
  return { ...DEFAULT_STATE, ...stored };
}

export async function saveSettings({ token, repos }) {
  await chrome.storage.local.set({
    token,
    repos,
    attentionItems: [],
    notifiedKeys: [],
    lastCheckedAt: null,
    lastError: null
  });
}

export async function saveCheckResult({ attentionItems, notifiedKeys, lastError }) {
  await chrome.storage.local.set({
    attentionItems,
    notifiedKeys,
    lastCheckedAt: new Date().toISOString(),
    lastError
  });
}
