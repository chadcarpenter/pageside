chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.warn('[Pageside] setPanelBehavior failed:', error);
});
