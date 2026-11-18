const mod = game.modules.get("dbu-automation-dev");
const api = globalThis.DBUAutomation;
const info = {
  moduleFound: !!mod,
  active: !!mod?.active,
  moduleVersion: mod?.version || mod?.data?.version || null,
  apiExists: !!api,
  bootstrapLoaded: !!api?.bootstrapLoaded,
  mainLoaded: !!api?.mainLoaded,
  coreReady: !!api?.coreReady,
  readyState: api?.readyState || null,
  lastError: api?.lastError || null,
  dbuCore: globalThis.DBU?.version || null,
  system: game.system?.id || null
};
console.log("DBU Automation | diagnóstico manual", info);
if (!mod) ui.notifications.error("DBU Automation não foi encontrado. Confira a pasta Data/modules/dbu-automation-dev/module.json", {permanent:true});
else if (!mod.active) ui.notifications.error("DBU Automation está instalado, mas NÃO está ativo em Manage Modules.", {permanent:true});
else if (!api) ui.notifications.error("DBU Automation está ativo, mas o bootstrap não carregou. Abra F12 > Console e procure erro vermelho DBU Automation.", {permanent:true});
else api.diagnostic?.();
