if (globalThis.DBUAutomation?.diagnostic) return globalThis.DBUAutomation.diagnostic();
if (globalThis.DBUAutomation?.status) return globalThis.DBUAutomation.status();
return ui.notifications.error("DBU Automation não está carregado. Verifique Manage Modules.");
