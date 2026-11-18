if (!globalThis.DBUAutomation?.launch) return ui.notifications.error("DBU Automation não está carregado.");
await globalThis.DBUAutomation.launch("attack");
