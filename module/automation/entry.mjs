import { createAutomationLifecycle } from './lifecycle.mjs';

const lifecycle = createAutomationLifecycle();
let reported = false;
function report(error) {
  if (reported) return;
  reported = true;
  console.error('DBU Automation integrada | Falha na inicialização', error);
  globalThis.ui?.notifications?.error(`DBU Automation: ${error.message}`, { permanent: true });
}
Hooks.once('init', () => { Promise.resolve().then(() => lifecycle.prepare()).catch(report); });
Hooks.once('ready', async () => {
  try {
    const status = await lifecycle.ready();
    if (status.mode === 'external-module' && game.user?.isGM) {
      console.info(`DBU Automation: usando o módulo externo (${status.legacyModules.join(', ')}). Para usar a automação incluída no sistema, desative esse módulo e recarregue o mundo.`);
    }
  } catch (error) { report(error); }
});
