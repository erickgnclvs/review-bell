# Review Bell

Never miss a GitHub PR review again.

Review Bell is a Chrome extension that reminds you about GitHub pull requests that need your review.

It tracks manually selected repositories, checks open non-draft PRs every 30 minutes, and shows a badge count for PRs you have not reviewed or that received new commits after your latest review.

## Local Setup

1. Run `npm install`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project folder.
6. Open the extension options page and paste a GitHub fine-grained PAT.

## GitHub Token

Use a fine-grained personal access token with access to the repositories you want to track and read access to pull requests.

The token is stored locally in Chrome storage and is only sent to `api.github.com`.

## Publishing

This extension is Manifest V3 and uses minimal permissions: storage, alarms, notifications, and GitHub API host access. Chrome Web Store publication still requires Google review, screenshots, listing text, icons, and a privacy policy URL.
