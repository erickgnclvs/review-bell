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

  it('requires review when any unordered commit is newer than viewer review', () => {
    const result = classifyPullRequest({
      pr,
      reviews: [{ user: { login: 'me' }, state: 'APPROVED', submitted_at: '2026-05-01T09:00:00Z' }],
      commits: [
        { commit: { committer: { date: '2026-05-01T10:00:00Z' } } },
        { commit: { committer: { date: '2026-05-01T08:00:00Z' } } }
      ],
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
