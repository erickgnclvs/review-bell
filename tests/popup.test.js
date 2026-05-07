// @vitest-environment jsdom

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { formatTime } from '../src/popup.js';

// popup.js has module-level DOM queries and calls render() on import.
// We set up the DOM and chrome mock via vi.hoisted so they exist before the module loads.

const { getState: getStateMock } = vi.hoisted(() => {
  document.body.innerHTML = `
    <header>
      <button id="settings"></button>
    </header>
    <p id="summary">Loading…</p>
    <ul id="prs"></ul>
    <footer>
      <button id="refresh">Check now</button>
      <span id="last-checked"></span>
    </footer>
  `;

  globalThis.chrome = {
    runtime: { openOptionsPage: vi.fn(), sendMessage: vi.fn() }
  };

  const getState = vi.fn().mockResolvedValue({
    token: '',
    repos: [],
    attentionItems: [],
    notifiedKeys: [],
    lastCheckedAt: null,
    lastError: null
  });
  return { getState };
});

vi.mock('../src/storage.js', () => ({ getState: getStateMock }));

describe('formatTime', () => {
  it('returns "just now" for timestamps under a minute ago', () => {
    expect(formatTime(new Date(Date.now() - 20_000).toISOString())).toBe('just now');
  });

  it('returns minutes ago for timestamps under an hour', () => {
    expect(formatTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('returns a time string for timestamps over an hour ago', () => {
    const result = formatTime(new Date(Date.now() - 120 * 60_000).toISOString());
    expect(result).toMatch(/^\d{1,2}:\d{2}/);
  });
});

describe('render — unconfigured state', () => {
  it('shows "No repositories configured." in summary', async () => {
    // render() was called on import; give it a tick to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('#summary').textContent).toBe('No repositories configured.');
  });

  it('shows "Configure" as the button label', async () => {
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('#refresh').textContent).toBe('Configure');
  });
});
