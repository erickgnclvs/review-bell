export async function listAccessibleRepos(token) {
  return githubFetchAll('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', token);
}

export async function getViewerLogin(token) {
  const user = await githubFetch('/user', token);
  return user.login;
}

export async function listOpenPullRequests(repo, token) {
  const pulls = await githubFetchAll(`/repos/${repo}/pulls?state=open&per_page=100`, token);
  return pulls.map((pull) => ({ ...pull, repo }));
}

export async function listPullRequestReviews(repo, number, token) {
  return githubFetchAll(`/repos/${repo}/pulls/${number}/reviews?per_page=100`, token);
}

export async function listPullRequestCommits(repo, number, token) {
  return githubFetchAll(`/repos/${repo}/pulls/${number}/commits?per_page=100`, token);
}

async function githubFetch(path, token) {
  return githubFetchUrl(`https://api.github.com${path}`, token);
}

async function githubFetchAll(path, token) {
  let url = `https://api.github.com${path}`;
  const items = [];

  while (url) {
    const { body, nextUrl } = await githubFetchUrl(url, token, { includeNextUrl: true });
    items.push(...body);
    url = nextUrl;
  }

  return items;
}

async function githubFetchUrl(url, token, { includeNextUrl = false } = {}) {
  const response = await fetch(url, {
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

  const body = await response.json();
  if (includeNextUrl) {
    return { body, nextUrl: parseNextLink(response.headers.get('link')) };
  }

  return body;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  const nextLink = linkHeader.split(',').find((link) => link.includes('rel="next"'));
  return nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
}
