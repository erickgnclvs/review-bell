# Review Bell Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a publishable Manifest V3 Chrome extension that reminds the user about open, non-draft GitHub PRs in selected repositories that they have not reviewed, or that have new commits after their latest review.

**Architecture:** Use a local-only Chrome extension with a background service worker polling GitHub every 30 minutes. Keep GitHub API and review classification logic isolated from Chrome APIs so the core behavior can be tested with Vitest. Store PAT, tracked repos, cached PRs, and notification state in `chrome.storage.local`.

**Tech Stack:** Manifest V3, vanilla HTML/CSS/JavaScript ES modules, Chrome extension APIs, GitHub REST API, Node.js test runner with Vitest.

---

## File Structure

- `package.json`: npm scripts for tests, lint-free validation, and packaging.
- `.gitignore`: ignore `node_modules`, build artifacts, zip packages, and local temp files.
- `README.md`: setup, local loading, PAT permissions, and publishing notes.
- `PRIVACY.md`: plain-language privacy policy for Chrome Web Store listing.
- `manifest.json`: MV3 manifest with minimal permissions and GitHub API host permission.
- `src/github.js`: GitHub REST API client functions.
- `src/reviewRules.js`: pure functions for deciding whether a PR needs review and notification keys.
- `src/storage.js`: wrapper around `chrome.storage.local` with default settings.
- `src/background.js`: alarm setup, periodic polling, badge updates, notifications.
- `src/options.html`, `src/options.css`, `src/options.js`: settings UI for PAT and manual `owner/repo` entries.
- `src/popup.html`, `src/popup.css`, `src/popup.js`: popup UI showing current count and PR links.
- `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`: generated or hand-created extension icons.
- `tests/reviewRules.test.js`: unit tests for review classification and notification key behavior.
- `scripts/package-extension.mjs`: creates a Chrome Web Store zip excluding dev files.

## GitHub Data Model

Tracked repo input is stored as strings like `owner/repo`.

Each attention item stored in cache should use this shape:

```js
{
  id: "owner/repo#123",
  repo: "owner/repo",
  number: 123,
  title: "Add checkout flow",
  url: "https://github.com/owner/repo/pull/123",
  author: "octocat",
  headSha: "abc123",
  reason: "new" // "new" or "updated_after_review"
}
```

Review classification rules:

- Ignore draft PRs.
- Ignore closed or merged PRs because the `/pulls?state=open` endpoint only returns open PRs.
- Count a PR as needing review when the authenticated GitHub username has no submitted review on the PR.
- Count a PR as needing review when the authenticated GitHub username has reviewed it, but the latest PR commit timestamp is newer than the latest submitted review timestamp.
- Treat review states `APPROVED`, `CHANGES_REQUESTED`, and `COMMENTED` as reviewed.
- Notify when a newly computed attention key was not present in the last notified key set.
- Use attention key `${repo}#${number}@${headSha}:${reason}` so new commits after a review notify again.

## GitHub API Calls

- `GET https://api.github.com/user`: determine authenticated login.
- `GET https://api.github.com/repos/{owner}/{repo}/pulls?state=open&per_page=100`: fetch open PRs.
- `GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/reviews?per_page=100`: fetch reviews.
- `GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/commits?per_page=100`: fetch commits and derive latest commit timestamp from the last item.

Fine-grained PAT permissions for private repos should be documented as repository access for selected repos plus pull request read access. Public repos can use a public-repo capable token.

---

### Task 1: Initialize Project Metadata

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `README.md`
- Create: `PRIVACY.md`

- [ ] **Step 1: Initialize git if needed**

Run:

```bash
rtk git status --short
```

Expected if repo is not initialized:

```text
fatal: not a git repository (or any of the parent directories): .git
```

If that happens, run:

```bash
rtk git init
rtk git remote add origin https://github.com/erickgnclvs/review-bell.git
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
dist/
*.zip
.DS_Store
.superpowers/
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "review-bell",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "package": "node scripts/package-extension.mjs"
  },
  "devDependencies": {
    "vitest": "latest",
    "archiver": "latest"
  }
}
```

- [ ] **Step 4: Create `README.md`**

```markdown
# Review Bell

Review Bell is a Chrome extension that reminds you about GitHub pull requests that need your review.

It tracks manually selected repositories, checks open non-draft PRs every 30 minutes, and shows a badge count for PRs you have not reviewed or that received new commits after your latest review.

## Local Setup

1. Run `npm install`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project folder.
6. Open the extension options page and paste a GitHub fine-grained PAT.

## GitHub Token

Use a fine-grained personal access token with access to the repositories you want to track and read access to pull requests.

The token is stored locally in Chrome storage and is only sent to `api.github.com`.

## Publishing

This extension is Manifest V3 and uses minimal permissions: storage, alarms, notifications, and GitHub API host access. Chrome Web Store publication still requires Google review, screenshots, listing text, icons, and a privacy policy URL.
```

- [ ] **Step 5: Create `PRIVACY.md`**

```markdown
# Privacy Policy

Review Bell stores your GitHub personal access token and tracked repository list locally in Chrome storage.

The extension sends the token only to GitHub's API at `https://api.github.com` to fetch your username, pull requests, pull request reviews, and pull request commits for repositories you configured.

Review Bell does not collect, sell, transmit, or share your data with any service other than GitHub. Review Bell does not use analytics or remote code.

To remove stored data, open the extension options page and clear your token and repositories, or remove the extension from Chrome.
```

- [ ] **Step 6: Install dependencies and verify tests command starts**

Run:

```bash
rtk npm install
rtk npm test
```

Expected test result before tests exist:

```text
No test files found
```

- [ ] **Step 7: Commit**

```bash
rtk git add .gitignore package.json package-lock.json README.md PRIVACY.md
rtk git commit -m "chore: initialize extension project"
```

---

### Task 2: Add Manifest and Static Shells

**Files:**
- Create: `manifest.json`
- Create: `src/options.html`
- Create: `src/options.css`
- Create: `src/options.js`
- Create: `src/popup.html`
- Create: `src/popup.css`
- Create: `src/popup.js`
- Create: `src/background.js`

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Review Bell",
  "version": "0.1.0",
  "description": "Reminds you about GitHub pull requests that need your review.",
  "permissions": ["storage", "alarms", "notifications"],
  "host_permissions": ["https://api.github.com/*"],
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "options_page": "src/options.html",
  "action": {
    "default_title": "Review Bell",
    "default_popup": "src/popup.html"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create minimal `src/background.js`**

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('review-bell-check', { periodInMinutes: 30 });
  chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'review-bell-check') return;
  chrome.action.setBadgeText({ text: '' });
});
```

- [ ] **Step 3: Create static options page files**

`src/options.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review Bell Options</title>
    <link rel="stylesheet" href="options.css">
  </head>
  <body>
    <main>
      <h1>Review Bell</h1>
      <label>
        GitHub token
        <input id="token" type="password" autocomplete="off" placeholder="github_pat_...">
      </label>
      <label>
        Add repository
        <input id="repo" type="text" placeholder="owner/repo">
      </label>
      <button id="addRepo" type="button">Add repo</button>
      <ul id="repos"></ul>
      <button id="save" type="button">Save</button>
      <p id="status" role="status"></p>
    </main>
    <script type="module" src="options.js"></script>
  </body>
</html>
```

`src/options.css`:

```css
body {
  color: #111827;
  font-family: system-ui, sans-serif;
  margin: 0;
}

main {
  max-width: 720px;
  padding: 24px;
}

label {
  display: block;
  font-weight: 600;
  margin: 16px 0 8px;
}

input {
  box-sizing: border-box;
  display: block;
  font: inherit;
  margin-top: 6px;
  padding: 8px;
  width: 100%;
}

button {
  font: inherit;
  margin: 8px 8px 8px 0;
  padding: 8px 12px;
}
```

`src/options.js`:

```js
document.querySelector('#status').textContent = 'Options UI loading...';
```

- [ ] **Step 4: Create static popup page files**

`src/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review Bell</title>
    <link rel="stylesheet" href="popup.css">
  </head>
  <body>
    <main>
      <h1>Review Bell</h1>
      <p id="summary">Loading...</p>
      <ul id="prs"></ul>
      <button id="refresh" type="button">Check now</button>
    </main>
    <script type="module" src="popup.js"></script>
  </body>
</html>
```

`src/popup.css`:

```css
body {
  color: #111827;
  font-family: system-ui, sans-serif;
  margin: 0;
  min-width: 340px;
}

main {
  padding: 16px;
}

a {
  color: #2563eb;
}

button {
  font: inherit;
  padding: 8px 12px;
}
```

`src/popup.js`:

```js
document.querySelector('#summary').textContent = 'No cached PRs yet.';
```

- [ ] **Step 5: Verify Chrome can load extension shell**

Run:

```bash
rtk npm test
```

Expected:

```text
No test files found
```

Manual check: load unpacked extension in Chrome and verify options and popup open without console errors.

- [ ] **Step 6: Commit**

```bash
rtk git add manifest.json src
rtk git commit -m "feat: add extension shell"
```

---

### Task 3: Implement Review Classification with Tests

**Files:**
- Create: `src/reviewRules.js`
- Create: `tests/reviewRules.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest';
import { classifyPullRequest, notificationKey } from '../src/reviewRules.js';

const pr = {
  repo: 'owner/repo',
  number: 1,
  title: 'Test PR',
  html_url: 'https://github.com/owner/repo/pull/1',
  draft: false,
  user: { login: 'author' },
  head: { sha: 'head-1' }
};

describe('classifyPullRequest', () => {
  it('ignores draft PRs', () => {
    const result = classifyPullRequest({
      pr: { ...pr, draft: true },
      reviews: [],
      commits: [],
      viewerLogin: 'me'
    });

    expect(result).toBeNull();
  });

  it('requires review when viewer has not reviewed', () => {
    const result = classifyPullRequest({
      pr,
      reviews: [{ user: { login: 'someone-else' }, state: 'APPROVED', submitted_at: '2026-05-01T10:00:00Z' }],
      commits: [{ commit: { committer: { date: '2026-05-01T09:00:00Z' } } }],
      viewerLogin: 'me'
    });

    expect(result.reason).toBe('new');
    expect(result.id).toBe('owner/repo#1');
  });

  it('does not require review when viewer reviewed after latest commit', () => {
    const result = classifyPullRequest({
      pr,
      reviews: [{ user: { login: 'me' }, state: 'COMMENTED', submitted_at: '2026-05-01T10:00:00Z' }],
      commits: [{ commit: { committer: { date: '2026-05-01T09:00:00Z' } } }],
      viewerLogin: 'me'
    });

    expect(result).toBeNull();
  });

  it('requires review when latest commit is newer than viewer review', () => {
    const result = classifyPullRequest({
      pr,
      reviews: [{ user: { login: 'me' }, state: 'APPROVED', submitted_at: '2026-05-01T09:00:00Z' }],
      commits: [{ commit: { committer: { date: '2026-05-01T10:00:00Z' } } }],
      viewerLogin: 'me'
    });

    expect(result.reason).toBe('updated_after_review');
  });
});

describe('notificationKey', () => {
  it('includes repo, PR number, head SHA, and reason', () => {
    expect(notificationKey({ repo: 'owner/repo', number: 1, headSha: 'abc', reason: 'new' })).toBe('owner/repo#1@abc:new');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk npm test
```

Expected: fail because `src/reviewRules.js` does not exist.

- [ ] **Step 3: Implement `src/reviewRules.js`**

```js
const REVIEWED_STATES = new Set(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']);

export function classifyPullRequest({ pr, reviews, commits, viewerLogin }) {
  if (pr.draft) return null;

  const ownReviews = reviews
    .filter((review) => review.user?.login === viewerLogin)
    .filter((review) => REVIEWED_STATES.has(review.state))
    .filter((review) => review.submitted_at)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  const latestOwnReview = ownReviews[0];
  const latestCommitDate = getLatestCommitDate(commits);

  if (!latestOwnReview) {
    return toAttentionItem(pr, 'new');
  }

  if (latestCommitDate && new Date(latestCommitDate) > new Date(latestOwnReview.submitted_at)) {
    return toAttentionItem(pr, 'updated_after_review');
  }

  return null;
}

export function notificationKey(item) {
  return `${item.repo}#${item.number}@${item.headSha}:${item.reason}`;
}

function toAttentionItem(pr, reason) {
  return {
    id: `${pr.repo}#${pr.number}`,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? 'unknown',
    headSha: pr.head?.sha ?? '',
    reason
  };
}

function getLatestCommitDate(commits) {
  const latestCommit = commits.at(-1);
  return latestCommit?.commit?.committer?.date ?? latestCommit?.commit?.author?.date ?? null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
rtk npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/reviewRules.js tests/reviewRules.test.js
rtk git commit -m "test: add PR review classification rules"
```

---

### Task 4: Implement GitHub API Client

**Files:**
- Create: `src/github.js`

- [ ] **Step 1: Create `src/github.js`**

```js
export async function getViewerLogin(token) {
  const user = await githubFetch('/user', token);
  return user.login;
}

export async function listOpenPullRequests(repo, token) {
  const pulls = await githubFetch(`/repos/${repo}/pulls?state=open&per_page=100`, token);
  return pulls.map((pull) => ({ ...pull, repo }));
}

export async function listPullRequestReviews(repo, number, token) {
  return githubFetch(`/repos/${repo}/pulls/${number}/reviews?per_page=100`, token);
}

export async function listPullRequestCommits(repo, number, token) {
  return githubFetch(`/repos/${repo}/pulls/${number}/commits?per_page=100`, token);
}

async function githubFetch(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API ${response.status}: ${message}`);
  }

  return response.json();
}
```

- [ ] **Step 2: Run tests**

Run:

```bash
rtk npm test
```

Expected: existing tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add src/github.js
rtk git commit -m "feat: add GitHub API client"
```

---

### Task 5: Implement Chrome Storage Wrapper

**Files:**
- Create: `src/storage.js`

- [ ] **Step 1: Create `src/storage.js`**

```js
const DEFAULT_STATE = {
  token: '',
  repos: [],
  attentionItems: [],
  notifiedKeys: [],
  lastCheckedAt: null,
  lastError: null
};

export async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return { ...DEFAULT_STATE, ...stored };
}

export async function saveSettings({ token, repos }) {
  await chrome.storage.local.set({ token, repos });
}

export async function saveCheckResult({ attentionItems, notifiedKeys, lastError }) {
  await chrome.storage.local.set({
    attentionItems,
    notifiedKeys,
    lastCheckedAt: new Date().toISOString(),
    lastError
  });
}
```

- [ ] **Step 2: Run tests**

Run:

```bash
rtk npm test
```

Expected: existing tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add src/storage.js
rtk git commit -m "feat: add extension storage helpers"
```

---

### Task 6: Implement Background Polling and Notifications

**Files:**
- Modify: `src/background.js`

- [ ] **Step 1: Replace `src/background.js`**

```js
import { getViewerLogin, listOpenPullRequests, listPullRequestCommits, listPullRequestReviews } from './github.js';
import { classifyPullRequest, notificationKey } from './reviewRules.js';
import { getState, saveCheckResult } from './storage.js';

const ALARM_NAME = 'review-bell-check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
  chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
  checkNow();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
  checkNow();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkNow();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CHECK_NOW') return false;
  checkNow().then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

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
```

- [ ] **Step 2: Run tests**

Run:

```bash
rtk npm test
```

Expected: existing tests pass.

- [ ] **Step 3: Manual background verification**

Load the unpacked extension in Chrome, save settings after Task 7, click refresh in popup after Task 8, then inspect `chrome://extensions` service worker console for errors.

- [ ] **Step 4: Commit**

```bash
rtk git add src/background.js
rtk git commit -m "feat: check GitHub PRs in background"
```

---

### Task 7: Implement Options UI

**Files:**
- Modify: `src/options.js`
- Modify: `src/options.css`

- [ ] **Step 1: Replace `src/options.js`**

```js
import { getState, saveSettings } from './storage.js';

const tokenInput = document.querySelector('#token');
const repoInput = document.querySelector('#repo');
const addRepoButton = document.querySelector('#addRepo');
const saveButton = document.querySelector('#save');
const repoList = document.querySelector('#repos');
const status = document.querySelector('#status');

let repos = [];

init();

addRepoButton.addEventListener('click', () => {
  const repo = normalizeRepo(repoInput.value);
  if (!repo) {
    status.textContent = 'Use owner/repo format.';
    return;
  }
  if (!repos.includes(repo)) repos.push(repo);
  repoInput.value = '';
  renderRepos();
});

saveButton.addEventListener('click', async () => {
  await saveSettings({ token: tokenInput.value.trim(), repos });
  status.textContent = 'Saved.';
});

async function init() {
  const state = await getState();
  tokenInput.value = state.token;
  repos = state.repos;
  renderRepos();
  status.textContent = '';
}

function renderRepos() {
  repoList.replaceChildren(...repos.map((repo) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const remove = document.createElement('button');
    label.textContent = repo;
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      repos = repos.filter((candidate) => candidate !== repo);
      renderRepos();
    });
    item.append(label, remove);
    return item;
  }));
}

function normalizeRepo(value) {
  const repo = value.trim();
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ? repo : '';
}
```

- [ ] **Step 2: Extend `src/options.css`**

```css
li {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  max-width: 420px;
  padding: 6px 0;
}

#status {
  color: #047857;
  min-height: 1.5em;
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
rtk npm test
```

Expected: existing tests pass.

- [ ] **Step 4: Manual options verification**

Load extension, open options, add `owner/repo`, save, close and reopen options, and verify token and repo persist.

- [ ] **Step 5: Commit**

```bash
rtk git add src/options.js src/options.css
rtk git commit -m "feat: add extension options"
```

---

### Task 8: Implement Popup UI

**Files:**
- Modify: `src/popup.js`
- Modify: `src/popup.css`

- [ ] **Step 1: Replace `src/popup.js`**

```js
import { getState } from './storage.js';

const summary = document.querySelector('#summary');
const list = document.querySelector('#prs');
const refresh = document.querySelector('#refresh');

refresh.addEventListener('click', async () => {
  summary.textContent = 'Checking GitHub...';
  const response = await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
  if (!response?.ok) summary.textContent = response?.error || 'Check failed.';
  await render();
});

render();

async function render() {
  const state = await getState();
  const items = state.attentionItems;

  if (state.lastError) {
    summary.textContent = `Last check failed: ${state.lastError}`;
  } else if (items.length === 0) {
    summary.textContent = 'No PRs need review.';
  } else {
    summary.textContent = `${items.length} PR${items.length === 1 ? '' : 's'} need review.`;
  }

  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    const meta = document.createElement('span');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${item.repo}#${item.number}: ${item.title}`;
    meta.textContent = item.reason === 'updated_after_review' ? 'Updated after your review' : 'Not reviewed yet';
    li.append(link, meta);
    return li;
  }));
}
```

- [ ] **Step 2: Extend `src/popup.css`**

```css
ul {
  list-style: none;
  margin: 12px 0;
  padding: 0;
}

li {
  border-top: 1px solid #e5e7eb;
  display: grid;
  gap: 4px;
  padding: 10px 0;
}

span {
  color: #6b7280;
  font-size: 12px;
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
rtk npm test
```

Expected: existing tests pass.

- [ ] **Step 4: Manual popup verification**

Open popup, click Check now, and verify summary changes. With a valid token/repo, verify PR links open in GitHub.

- [ ] **Step 5: Commit**

```bash
rtk git add src/popup.js src/popup.css
rtk git commit -m "feat: show PR reminders in popup"
```

---

### Task 9: Add Icons and Packaging

**Files:**
- Create: `icons/icon-16.png`
- Create: `icons/icon-32.png`
- Create: `icons/icon-48.png`
- Create: `icons/icon-128.png`
- Create: `scripts/package-extension.mjs`

- [ ] **Step 1: Add PNG icons**

Create simple bell icons in the required sizes. Keep them local PNG files; do not load remote assets.

- [ ] **Step 2: Create `scripts/package-extension.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const outputDir = path.resolve('dist');
const outputPath = path.join(outputDir, 'review-bell.zip');

fs.mkdirSync(outputDir, { recursive: true });

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

for (const entry of ['manifest.json', 'src', 'icons', 'README.md', 'PRIVACY.md']) {
  const stats = fs.statSync(entry);
  if (stats.isDirectory()) archive.directory(entry, entry);
  else archive.file(entry, { name: entry });
}

await archive.finalize();

output.on('close', () => {
  console.log(`Created ${outputPath}`);
});
```

- [ ] **Step 3: Package extension**

Run:

```bash
rtk npm run package
```

Expected:

```text
Created /Users/erickgoncalves/Development/review-bell/dist/review-bell.zip
```

- [ ] **Step 4: Commit**

```bash
rtk git add icons scripts/package-extension.mjs package.json package-lock.json
rtk git commit -m "chore: add extension packaging"
```

---

### Task 10: Final Verification

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Run automated tests**

Run:

```bash
rtk npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run package build**

Run:

```bash
rtk npm run package
```

Expected: `dist/review-bell.zip` exists.

- [ ] **Step 3: Manual extension verification**

In Chrome:

1. Load unpacked extension from `/Users/erickgoncalves/Development/review-bell`.
2. Open options.
3. Save a valid GitHub PAT and a repo as `owner/repo`.
4. Open popup and click Check now.
5. Confirm badge count matches popup count.
6. Confirm popup lists open non-draft PRs with either Not reviewed yet or Updated after your review.
7. Confirm links open the correct GitHub PRs.
8. Confirm no service worker errors in `chrome://extensions`.

- [ ] **Step 4: Verify publishability basics**

Check:

- `manifest.json` is MV3.
- No remote JavaScript or CSS is referenced.
- Permissions are limited to `storage`, `alarms`, `notifications`, and `https://api.github.com/*`.
- `README.md` explains token usage.
- `PRIVACY.md` explains local storage and GitHub API usage.
- PNG icons exist for 16, 32, 48, and 128 sizes.

- [ ] **Step 5: Commit final fixes if any**

```bash
rtk git status --short
rtk git add .
rtk git commit -m "chore: verify extension release"
```

Only make this commit if verification required file changes.

---

## Self-Review

- Spec coverage: The plan covers manual repo selection, fine-grained PAT auth, 30-minute background checks, badge counts, desktop notifications for new unreviewed PRs and PRs updated after review, local-only storage, Chrome Web Store publishability basics, README, privacy text, icons, and packaging.
- Placeholder scan: No `TBD`, `TODO`, or undefined implementation steps remain. The icon task intentionally requires asset creation because binary PNG content cannot be represented usefully in markdown; the required files and sizes are explicit.
- Type consistency: `attentionItems`, `notifiedKeys`, `classifyPullRequest`, `notificationKey`, `getState`, and `saveCheckResult` names are consistent across tasks.
