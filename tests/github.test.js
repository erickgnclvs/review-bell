import { afterEach, describe, expect, it, vi } from 'vitest';
import { listOpenPullRequests, listPullRequestReviews } from '../src/github.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function response({ ok = true, status = 200, body = [], link = null }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'link' ? link : null;
      }
    },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body))
  };
}

describe('GitHub API list helpers', () => {
  it('follows Link rel="next" and combines items from multiple pages', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        body: [{ id: 1 }],
        link: '<https://api.github.com/repos/owner/repo/pulls/1/reviews?per_page=100&page=2>; rel="next"'
      })
    ).mockResolvedValueOnce(response({ body: [{ id: 2 }] }));

    await expect(listPullRequestReviews('owner/repo', 1, 'token')).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.github.com/repos/owner/repo/pulls/1/reviews?per_page=100&page=2', expect.any(Object));
  });

  it('adds the repo property to open pull requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ body: [{ number: 1 }] }));

    await expect(listOpenPullRequests('owner/repo', 'token')).resolves.toEqual([{ number: 1, repo: 'owner/repo' }]);
  });

  it('throws status and response message for non-ok responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ ok: false, status: 403, body: 'rate limited' }));

    await expect(listPullRequestReviews('owner/repo', 1, 'token')).rejects.toThrow('GitHub API 403: rate limited');
  });
});
