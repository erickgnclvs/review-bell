export async function sendReviewNotification(chromeApi, newItems) {
  const title = newItems.length === 1 ? '1 PR needs review' : `${newItems.length} PRs need review`;
  const message = newItems.slice(0, 3).map((item) => `${item.repo}#${item.number}: ${item.title}`).join('\n');

  await chromeApi.notifications.create(`review-bell-${Date.now()}`, {
    type: 'basic',
    iconUrl: chromeApi.runtime.getURL('icons/icon-128.png'),
    title,
    message: message || 'Open Review Bell to see PRs.'
  });
}
