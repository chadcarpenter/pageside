chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.warn('[Page Chat] setPanelBehavior failed:', error);
});
