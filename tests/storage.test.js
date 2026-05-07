import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from '../src/storage.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveSettings', () => {
  it('clears cached check state when settings are saved', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { set } } });

    await saveSettings({ token: 'token', repos: ['owner/repo'] });

    expect(set).toHaveBeenCalledWith({
      token: 'token',
      repos: ['owner/repo'],
      attentionItems: [],
      notifiedKeys: [],
      lastCheckedAt: null,
      lastError: null
    });
  });
});
