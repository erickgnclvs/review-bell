// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

const { getState: getStateMock, saveSettings: saveSettingsMock, listAccessibleRepos: listReposMock } = vi.hoisted(() => {
  document.body.innerHTML = `
    <input id="token" type="password">
    <button id="load-repos">Load repositories</button>
    <section id="repo-section" hidden>
      <input id="search" type="search">
      <ul id="repo-list"></ul>
    </section>
    <button id="save">Save settings</button>
    <p id="status"></p>
  `;

  globalThis.chrome = {};

  const getState = vi.fn().mockResolvedValue({ token: '', repos: [] });
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const listAccessibleRepos = vi.fn();
  return { getState, saveSettings, listAccessibleRepos };
});

vi.mock('../src/storage.js', () => ({ getState: getStateMock, saveSettings: saveSettingsMock }));
vi.mock('../src/github.js', () => ({ listAccessibleRepos: listReposMock }));

await import('../src/options.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('options — load repos', () => {
  it('shows an error when no token is entered before clicking Load', async () => {
    document.querySelector('#token').value = '';
    document.querySelector('#load-repos').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('#status').textContent).toBe('Enter a GitHub token first.');
  });

  it('shows error message when the API call fails', async () => {
    listReposMock.mockRejectedValue(new Error('Bad credentials'));
    document.querySelector('#token').value = 'bad-token';
    document.querySelector('#load-repos').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('#status').textContent).toContain('Bad credentials');
  });

  it('reveals the repo section on successful load', async () => {
    listReposMock.mockResolvedValue([{ full_name: 'owner/repo' }]);
    document.querySelector('#token').value = 'valid-token';
    document.querySelector('#load-repos').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('#repo-section').hidden).toBe(false);
    expect(document.querySelector('#repo-list').children).toHaveLength(1);
  });
});

describe('options — save', () => {
  it('calls saveSettings with the current token and selected repos', async () => {
    listReposMock.mockResolvedValue([{ full_name: 'owner/repo' }]);
    document.querySelector('#token').value = 'my-token';
    document.querySelector('#load-repos').click();
    await new Promise((r) => setTimeout(r, 0));

    document.querySelector('#repo-list input[type="checkbox"]').click();
    document.querySelector('#save').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(saveSettingsMock).toHaveBeenCalledWith({ token: 'my-token', repos: ['owner/repo'] });
  });
});
