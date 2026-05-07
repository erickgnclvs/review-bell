import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must set globalThis.chrome before background.js is imported (it runs top-level chrome calls)
const chromeMock = vi.hoisted(() => {
  const mock = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
      getURL: vi.fn((p) => `chrome-extension://id/${p}`)
    },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    action: {
      setBadgeBackgroundColor: vi.fn(),
      setBadgeText: vi.fn().mockResolvedValue(undefined)
    },
    notifications: { create: vi.fn().mockResolvedValue(undefined) }
  };
  globalThis.chrome = mock;
  return mock;
});

vi.mock('../src/github.js', () => ({
  getViewerLogin: vi.fn(),
  listOpenPullRequests: vi.fn(),
  listPullRequestReviews: vi.fn(),
  listPullRequestCommits: vi.fn()
}));

vi.mock('../src/storage.js', () => ({
  getState: vi.fn(),
  saveCheckResult: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/notifications.js', () => ({
  sendReviewNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/reviewRules.js', () => ({
  classifyPullRequest: vi.fn().mockReturnValue(null),
  notificationKey: vi.fn((item) => `${item.repo}#${item.number}`)
}));

import { getViewerLogin, listOpenPullRequests, listPullRequestReviews, listPullRequestCommits } from '../src/github.js';
import { getState, saveCheckResult } from '../src/storage.js';
import { checkNow } from '../src/background.js';

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.action.setBadgeText.mockResolvedValue(undefined);
  saveCheckResult.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkNow', () => {
  it('clears the badge and saves empty result when not configured', async () => {
    getState.mockResolvedValue({ token: '', repos: [], attentionItems: [], notifiedKeys: [] });

    await checkNow();

    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(saveCheckResult).toHaveBeenCalledWith(
      expect.objectContaining({ attentionItems: [], lastError: null })
    );
  });

  it('skips the API call when repos list is empty', async () => {
    getState.mockResolvedValue({ token: 'tok', repos: [], attentionItems: [], notifiedKeys: [] });

    await checkNow();

    expect(getViewerLogin).not.toHaveBeenCalled();
  });

  it('records failing repos in lastError while saving successful results', async () => {
    getState.mockResolvedValue({
      token: 'tok',
      repos: ['owner/good', 'owner/bad'],
      attentionItems: [],
      notifiedKeys: []
    });
    getViewerLogin.mockResolvedValue('me');
    listOpenPullRequests
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('not found'));

    await checkNow();

    expect(saveCheckResult).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: 'Failed to check: owner/bad' })
    );
  });

  it('sets lastError to null when all repos succeed', async () => {
    getState.mockResolvedValue({
      token: 'tok',
      repos: ['owner/repo'],
      attentionItems: [],
      notifiedKeys: []
    });
    getViewerLogin.mockResolvedValue('me');
    listOpenPullRequests.mockResolvedValue([]);

    await checkNow();

    expect(saveCheckResult).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: null })
    );
  });

  it('updates badge to match the number of attention items', async () => {
    const { classifyPullRequest } = await import('../src/reviewRules.js');
    getState.mockResolvedValue({
      token: 'tok',
      repos: ['owner/repo'],
      attentionItems: [],
      notifiedKeys: []
    });
    getViewerLogin.mockResolvedValue('me');
    listOpenPullRequests.mockResolvedValue([{ number: 1, draft: false }]);
    listPullRequestReviews.mockResolvedValue([]);
    listPullRequestCommits.mockResolvedValue([]);
    classifyPullRequest.mockReturnValue({ repo: 'owner/repo', number: 1, reason: 'new' });

    await checkNow();

    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: '1' });
  });
});
