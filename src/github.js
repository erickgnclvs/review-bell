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
