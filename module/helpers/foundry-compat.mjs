/** Namespaced APIs for modern Foundry, with v12 fallbacks. */
const f = globalThis.foundry;
export const ActorSheet = f?.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet;
export const ItemSheet = f?.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet;
function nativeDialog() {
  return globalThis.foundry?.appv1?.api?.Dialog ?? globalThis.Dialog;
}

function systemDialogOptions(options = {}) {
  return { ...options, classes: [...new Set(["dialog", "dbua-system-dialog", ...(options.classes || [])])] };
}

export class Dialog {
  constructor(data, options) {
    return new (nativeDialog())(data, systemDialogOptions(options));
  }

  static wait(data, options, renderOptions) {
    return nativeDialog().wait(data, systemDialogOptions(options), renderOptions);
  }

  static prompt(config = {}) {
    return nativeDialog().prompt({ ...config, options: systemDialogOptions(config.options) });
  }

  static confirm(config = {}) {
    return nativeDialog().confirm({ ...config, options: systemDialogOptions(config.options) });
  }
}
export const TextEditor = f?.applications?.ux?.TextEditor?.implementation ?? f?.applications?.ux?.TextEditor ?? globalThis.TextEditor;

export function loadSystemTemplates(paths) {
  const api = globalThis.foundry?.applications?.handlebars;
  if (api?.loadTemplates) return api.loadTemplates(paths);
  return globalThis.loadTemplates(paths);
}

/** Register once: modern chat hooks pass an HTMLElement, legacy hooks jQuery. */
export function onRenderChatMessage(callback) {
  const generation = Number(game.release?.generation ?? String(game.version).split('.')[0]);
  return Hooks.on(generation >= 13 ? 'renderChatMessageHTML' : 'renderChatMessage', callback);
}

export function registerSystemSheets(character, jacket, item) {
  const config = globalThis.foundry?.applications?.apps?.DocumentSheetConfig;
  if (config) {
    const docs = globalThis.foundry?.documents;
    const actorClass = docs?.Actor ?? globalThis.Actor;
    const itemClass = docs?.Item ?? globalThis.Item;
    const sheets = globalThis.foundry?.applications?.sheets;
    config.unregisterSheet(actorClass, 'core', sheets?.ActorSheetV2 ?? sheets?.ActorSheet ?? ActorSheet);
    config.unregisterSheet(itemClass, 'core', sheets?.ItemSheetV2 ?? sheets?.ItemSheet ?? ItemSheet);
    config.registerSheet(actorClass, 'DBU-MRR-OLD', character, { types: ['character'], makeDefault: true, label: 'DBU.SheetLabel.Character' });
    config.registerSheet(actorClass, 'DBU-MRR-OLD', jacket, { types: ['battleJacket'], makeDefault: true, label: 'DBU.SheetLabel.BattleJacket' });
    config.registerSheet(itemClass, 'DBU-MRR-OLD', item, { makeDefault: true, label: 'DBU.SheetLabel.Item' });
    return;
  }
  globalThis.Actors.unregisterSheet('core', ActorSheet);
  globalThis.Items.unregisterSheet('core', ItemSheet);
  globalThis.Actors.registerSheet('DBU-MRR-OLD', character, { types: ['character'], makeDefault: true, label: 'DBU.SheetLabel.Character' });
  globalThis.Actors.registerSheet('DBU-MRR-OLD', jacket, { types: ['battleJacket'], makeDefault: true, label: 'DBU.SheetLabel.BattleJacket' });
  globalThis.Items.registerSheet('DBU-MRR-OLD', item, { makeDefault: true, label: 'DBU.SheetLabel.Item' });
}
