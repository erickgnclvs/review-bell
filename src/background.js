import { getViewerLogin, listOpenPullRequests, listPullRequestCommits, listPullRequestReviews } from './github.js';
import { classifyPullRequest, notificationKey } from './reviewRules.js';
import { getState, saveCheckResult } from './storage.js';

const ALARM_NAME = 'review-bell-check';
let checkPromise = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
  chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
  runCheck().catch((error) => console.error('Review Bell check failed', error));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
  runCheck().catch((error) => console.error('Review Bell check failed', error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runCheck().catch((error) => console.error('Review Bell check failed', error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CHECK_NOW') return false;
  runCheck().then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

function runCheck() {
  if (checkPromise) return checkPromise;

  checkPromise = checkNow().finally(() => {
    checkPromise = null;
  });

  return checkPromise;
}

async function checkNow() {
  const state = await getState();

  if (!state.token || state.repos.length === 0) {
    await updateBadge([]);
    await saveCheckResult({ attentionItems: [], notifiedKeys: state.notifiedKeys, lastError: null });
    return;
  }

  try {
    const viewerLogin = await getViewerLogin(state.token);
    const attentionItems = [];

    for (const repo of state.repos) {
      const pulls = await listOpenPullRequests(repo, state.token);
      for (const pr of pulls) {
        if (pr.draft) continue;
        const [reviews, commits] = await Promise.all([
          listPullRequestReviews(repo, pr.number, state.token),
          listPullRequestCommits(repo, pr.number, state.token)
        ]);
        const item = classifyPullRequest({ pr, reviews, commits, viewerLogin });
        if (item) attentionItems.push(item);
      }
    }

    await updateBadge(attentionItems);

    const currentKeys = attentionItems.map(notificationKey);
    const newKeys = currentKeys.filter((key) => !state.notifiedKeys.includes(key));
    if (newKeys.length > 0) await notify(attentionItems.filter((item) => newKeys.includes(notificationKey(item))));

    await saveCheckResult({ attentionItems, notifiedKeys: currentKeys, lastError: null });
  } catch (error) {
    await saveCheckResult({ attentionItems: state.attentionItems, notifiedKeys: state.notifiedKeys, lastError: error.message });
    throw error;
  }
}

async function updateBadge(items) {
  await chrome.action.setBadgeText({ text: items.length ? String(items.length) : '' });
}

async function notify(newItems) {
  const title = newItems.length === 1 ? '1 PR needs review' : `${newItems.length} PRs need review`;
  const message = newItems.slice(0, 3).map((item) => `${item.repo}#${item.number}: ${item.title}`).join('\n');
  await chrome.notifications.create(`review-bell-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message: message || 'Open Review Bell to see PRs.'
  });
}
