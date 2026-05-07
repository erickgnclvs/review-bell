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
