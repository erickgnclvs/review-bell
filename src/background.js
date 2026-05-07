chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('review-bell-check', { periodInMinutes: 30 });
  chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'review-bell-check') return;
  chrome.action.setBadgeText({ text: '' });
});
