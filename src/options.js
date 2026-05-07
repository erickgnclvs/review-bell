import { getState, saveSettings } from './storage.js';
import { listAccessibleRepos } from './github.js';

const tokenInput = document.querySelector('#token');
const loadReposButton = document.querySelector('#load-repos');
const repoSection = document.querySelector('#repo-section');
const searchInput = document.querySelector('#search');
const repoList = document.querySelector('#repo-list');
const saveButton = document.querySelector('#save');
const status = document.querySelector('#status');

let allRepos = [];
let selectedRepos = new Set();

init();

async function init() {
  const state = await getState();
  tokenInput.value = state.token;
  selectedRepos = new Set(state.repos);
  status.textContent = '';

  if (state.token) {
    await loadRepos(state.token);
  }
}

loadReposButton.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('Enter a GitHub token first.', 'error');
    return;
  }
  await loadRepos(token);
});

async function loadRepos(token) {
  setStatus('Loading repositories…', 'info');
  loadReposButton.disabled = true;
  try {
    allRepos = await listAccessibleRepos(token);
    repoSection.hidden = false;
    renderRepoList(searchInput.value);
    setStatus('', '');
  } catch (error) {
    setStatus(`Failed to load repositories: ${error.message}`, 'error');
  } finally {
    loadReposButton.disabled = false;
  }
}

searchInput.addEventListener('input', () => {
  renderRepoList(searchInput.value);
});

function renderRepoList(query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? allRepos.filter((r) => r.full_name.toLowerCase().includes(q)) : allRepos;

  repoList.replaceChildren(...filtered.map((repo) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = repo.full_name;
    checkbox.checked = selectedRepos.has(repo.full_name);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedRepos.add(repo.full_name);
      else selectedRepos.delete(repo.full_name);
    });
    label.append(checkbox, ` ${repo.full_name}`);
    li.append(label);
    return li;
  }));
}

saveButton.addEventListener('click', async () => {
  await saveSettings({ token: tokenInput.value.trim(), repos: [...selectedRepos] });
  setStatus('Saved.', 'success');
});

function setStatus(message, type) {
  status.textContent = message;
  status.dataset.type = type;
}
