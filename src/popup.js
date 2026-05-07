import { getState } from './storage.js';

const summary = document.querySelector('#summary');
const list = document.querySelector('#prs');
const refresh = document.querySelector('#refresh');
const lastChecked = document.querySelector('#last-checked');
const settings = document.querySelector('#settings');

settings.addEventListener('click', () => chrome.runtime.openOptionsPage());

refresh.addEventListener('click', async () => {
  const state = await getState();
  if (!state.token || state.repos.length === 0) {
    chrome.runtime.openOptionsPage();
    return;
  }
  refresh.disabled = true;
  summary.textContent = 'Checking GitHub…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
    if (!response?.ok) summary.textContent = response?.error || 'Check failed.';
    await render();
  } finally {
    refresh.disabled = false;
  }
});

render();

async function render() {
  const state = await getState();
  const items = state.attentionItems;
  const configured = state.token && state.repos.length > 0;

  if (!configured) {
    summary.textContent = 'No repositories configured.';
    refresh.textContent = 'Configure';
    list.replaceChildren();
    lastChecked.textContent = '';
    return;
  }

  refresh.textContent = 'Check now';

  if (state.lastError) {
    summary.replaceChildren(
      document.createTextNode(`Last check failed: ${state.lastError} — `),
      Object.assign(document.createElement('a'), {
        href: '#',
        textContent: 'open settings',
        onclick: (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }
      })
    );
  } else if (items.length === 0) {
    summary.textContent = 'No PRs need review.';
  } else {
    summary.textContent = `${items.length} PR${items.length === 1 ? '' : 's'} need review.`;
  }

  lastChecked.textContent = state.lastCheckedAt ? `checked ${formatTime(state.lastCheckedAt)}` : '';

  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');

    const link = document.createElement('a');
    link.className = 'pr-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `#${item.number} ${item.title}`;

    const meta = document.createElement('div');
    meta.className = 'pr-meta';

    const repo = document.createElement('span');
    repo.className = 'pr-repo';
    repo.textContent = item.repo;

    const badge = document.createElement('span');
    badge.className = `pr-badge ${item.reason === 'updated_after_review' ? 'updated' : 'new'}`;
    badge.textContent = item.reason === 'updated_after_review' ? 'updated' : 'new';

    meta.append(repo, badge);
    li.append(link, meta);
    return li;
  }));
}

export function formatTime(iso) {
  const date = new Date(iso);
  const diff = Math.round((Date.now() - date) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
