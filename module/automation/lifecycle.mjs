import { SYSTEM_ID, activeLegacyModules } from './package.mjs';
import { migrateLegacyAutomation } from './migration.mjs';

export const ENABLED_SETTING = 'integratedAutomation';

async function loadAutomation() {
  const { prepareAutomationBootstrap } = await import('./scripts/bootstrap.js');
  prepareAutomationBootstrap();
  const runtime = await import('./scripts/main.js');
  runtime.prepareAutomationRuntime();
  return runtime;
}

/** Gate loading before any embedded hooks or global API are installed. */
export function createAutomationLifecycle({ getGame = () => globalThis.game, load = loadAutomation, migrate = migrateLegacyAutomation, getAPI = () => globalThis.DBUAutomation } = {}) {
  const status = { mode: 'pending', ready: false, legacyModules: [] };
  let preparation, startup;
  function prepare() {
    if (preparation) return preparation;
    const game = getGame();
    if (game.system?.id !== SYSTEM_ID) { status.mode = 'inactive'; return preparation = Promise.resolve(null); }
    if (!game.settings.settings.has(`${SYSTEM_ID}.${ENABLED_SETTING}`)) game.settings.register(SYSTEM_ID, ENABLED_SETTING, {
      name: 'DBU Automation integrada',
      hint: 'Ativa HUD, painéis e automações incluídos no sistema. Desative as versões externas de DBU Automation para usar esta integração.',
      scope: 'world', config: true, type: Boolean, default: true, requiresReload: true
    });
    if (!game.settings.get(SYSTEM_ID, ENABLED_SETTING)) { status.mode = 'disabled'; return preparation = Promise.resolve(null); }
    status.legacyModules = activeLegacyModules(game);
    if (status.legacyModules.length) { status.mode = 'external-module'; return preparation = Promise.resolve(null); }
    status.mode = 'integrated';
    preparation = Promise.resolve().then(load).catch(error => { status.error = error; throw error; });
    return preparation;
  }
  function ready() {
    if (startup) return startup;
    startup = (async () => {
      const runtime = await prepare();
      if (!runtime) return status;
      const game = getGame();
      status.migration = await migrate(game);
      await runtime.boot();
      if (!getAPI()?.coreReady) throw new Error(getAPI()?.lastError || 'DBU Automation: inicialização incompleta.');
      game.dbu ??= {};
      game.dbu.automation = getAPI();
      // Late imports may finish after the initial scene controls were built.
      if (game.user?.isGM && globalThis.canvas?.ready) await globalThis.ui?.controls?.initialize?.({});
      status.ready = true;
      return status;
    })().catch(error => { status.error = error; status.ready = false; throw error; });
    return startup;
  }
  return { prepare, ready, status };
}
