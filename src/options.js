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
