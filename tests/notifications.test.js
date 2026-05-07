import { describe, expect, it, vi } from 'vitest';
import { sendReviewNotification } from '../src/notifications.js';

const items = [{ repo: 'owner/repo', number: 1, title: 'Review me' }];

describe('sendReviewNotification', () => {
  it('uses an extension URL for the notification icon', async () => {
    const chromeApi = {
      runtime: { getURL: vi.fn((path) => `chrome-extension://extension-id/${path}`) },
      notifications: { create: vi.fn().mockResolvedValue('notification-id') }
    };

    await sendReviewNotification(chromeApi, items);

    expect(chromeApi.runtime.getURL).toHaveBeenCalledWith('icons/icon-128.png');
    expect(chromeApi.notifications.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ iconUrl: 'chrome-extension://extension-id/icons/icon-128.png' })
    );
  });
});
