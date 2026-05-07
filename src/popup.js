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
