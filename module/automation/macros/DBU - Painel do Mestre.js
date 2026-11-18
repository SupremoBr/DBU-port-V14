if (!game.user?.isGM) {
  return ui.notifications.warn("DBU Automation: o Painel do Mestre é exclusivo do GM.");
}
if (!globalThis.DBUAutomation?.launch) {
  return ui.notifications.error("DBU Automation não está carregado.");
}
await globalThis.DBUAutomation.launch("gmPanel");
