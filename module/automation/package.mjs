/** Embedded package identity. No synthetic entry in game.modules is needed. */
export const SYSTEM_ID = 'DBU-MRR-OLD';
export const AUTOMATION_VERSION = '1.9.22';
export const LEGACY_MODULE_IDS = Object.freeze(['dbu-automation-dev', 'dbu-automation', 'dbu-auto-start']);
export const LEGACY_FLAG_SCOPES = Object.freeze(['dbu-automation-dev', 'dbu-automation']);
export const AUTOMATION_SOCKET = `system.${SYSTEM_ID}`;
export const MIGRATION_FLAG = 'automationLegacyMigration';

export function activeLegacyModules(game = globalThis.game) {
  return LEGACY_MODULE_IDS.filter(id => game?.modules?.get(id)?.active);
}

export function getAutomationPackage(game = globalThis.game) {
  return game?.system?.id === SYSTEM_ID
    ? { id: SYSTEM_ID, version: game.system.version, active: true, embedded: true }
    : null;
}

function ownPath(object, path) {
  for (const part of String(path).split('.')) {
    if (!object || !Object.hasOwn(object, part)) return { exists: false };
    object = object[part];
  }
  return { exists: true, value: object };
}

/** Read old flags immediately, including on player clients before GM migration. */
export function readAutomationFlag(document, key) {
  if (!document) return undefined;
  const current = document.getFlag?.(SYSTEM_ID, key);
  if (current !== undefined) return current;
  const stored = ownPath(document.flags?.[SYSTEM_ID], key);
  if (stored.exists) return stored.value;
  // A removed system flag must not reappear from the preserved legacy copy.
  if (document.flags?.[SYSTEM_ID]?.[MIGRATION_FLAG] === 1) return undefined;
  for (const scope of LEGACY_FLAG_SCOPES) {
    const legacy = ownPath(document.flags?.[scope], key);
    if (legacy.exists) return legacy.value;
  }
  return undefined;
}

export function chatRenderHook(game = globalThis.game) {
  return Number(game?.release?.generation ?? String(game?.version ?? '13').split('.')[0]) >= 13
    ? 'renderChatMessageHTML' : 'renderChatMessage';
}

/** The original automation handlers expect jQuery even on the modern hook. */
export function onAutomationChatRender(callback) {
  return Hooks.on(chatRenderHook(), (message, html, ...args) => {
    if (globalThis.HTMLElement && html instanceof HTMLElement) html = globalThis.$(html);
    return callback(message, html, ...args);
  });
}
