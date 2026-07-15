chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.warn('[Sidenote] setPanelBehavior failed:', error);
});
