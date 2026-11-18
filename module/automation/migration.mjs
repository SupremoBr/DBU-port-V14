import { SYSTEM_ID, LEGACY_FLAG_SCOPES, MIGRATION_FLAG } from './package.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key) && !key.startsWith('-=') && !key.includes('.');

/** Only add missing values. Keep originals and current system values intact. */
export function legacyFlagUpdates(flags = {}) {
  if (flags[SYSTEM_ID]?.[MIGRATION_FLAG] === 1) return {};
  if (!LEGACY_FLAG_SCOPES.some(scope => Object.keys(flags[scope] || {}).length)) return {};
  const merged = structuredClone(flags[SYSTEM_ID] || {});
  const updates = {};
  function fill(target, source, prefix) {
    for (const [key, value] of Object.entries(source || {})) {
      if (!safeKey(key) || value === undefined) continue;
      const path = `${prefix}.${key}`;
      if (!Object.hasOwn(target, key)) {
        target[key] = structuredClone(value);
        updates[path] = structuredClone(value);
      } else if (isObject(target[key]) && isObject(value)) fill(target[key], value, path);
    }
  }
  for (const scope of LEGACY_FLAG_SCOPES) fill(merged, flags[scope], `flags.${SYSTEM_ID}`);
  updates[`flags.${SYSTEM_ID}.${MIGRATION_FLAG}`] = 1;
  return updates;
}

/** Adopt first, then delete: legacy snapshots remain a backup, not live state. */
export async function unsetAutomationFlag(document, scope, key) {
  if (scope === SYSTEM_ID) {
    const updates = legacyFlagUpdates(document.flags);
    if (Object.keys(updates).length) await document.update(updates);
  }
  return document.unsetFlag(scope, key);
}

function values(collection) {
  return collection?.contents ?? (collection?.values ? [...collection.values()] : collection ?? []);
}

export function automationDocuments(game) {
  const docs = new Set();
  const add = doc => { if (doc?.update) docs.add(doc); };
  for (const name of ['actors', 'items', 'users', 'scenes', 'combats', 'messages', 'macros']) {
    for (const doc of values(game[name])) {
      add(doc);
      if (name === 'actors') { add(doc.prototypeToken); for (const item of values(doc.items)) add(item); }
      if (name === 'scenes') for (const token of values(doc.tokens)) {
        add(token);
        // Synthetic actors have their own flags in the token's ActorDelta.
        if (!token.actorLink) add(token.actor);
      }
      if (name === 'combats') for (const combatant of values(doc.combatants)) add(combatant);
    }
  }
  return [...docs];
}

function storedValue(storage, key) {
  const entry = storage?.getItem ? storage.getItem(key) : storage?.get?.(key);
  if (entry === null || entry === undefined) return { exists: false };
  const raw = entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry;
  if (typeof raw !== 'string') return { exists: true, value: structuredClone(raw) };
  try { return { exists: true, value: JSON.parse(raw) }; }
  catch { return { exists: true, value: raw }; }
}

export async function migrateAutomationSettings(game) {
  let migrated = 0;
  for (const [fullKey, config] of game.settings.settings) {
    if (!fullKey.startsWith(`${SYSTEM_ID}.`)) continue;
    const scope = config.scope;
    if (scope !== 'client' && scope !== 'world') continue;
    if (scope === 'world' && !game.user?.isGM) continue;
    const storage = game.settings.storage.get(scope);
    if (storedValue(storage, fullKey).exists) continue;
    const key = fullKey.slice(SYSTEM_ID.length + 1);
    for (const legacy of LEGACY_FLAG_SCOPES) {
      const old = storedValue(storage, `${legacy}.${key}`);
      if (!old.exists) continue;
      await game.settings.set(SYSTEM_ID, key, old.value);
      migrated++;
      break;
    }
  }
  return migrated;
}

export async function migrateLegacyAutomation(game = globalThis.game) {
  const settings = await migrateAutomationSettings(game);
  const primary = game.users?.activeGM;
  const canMigrateWorld = game.user?.isGM && (!primary || primary.id === game.user.id);
  let documents = 0;
  if (canMigrateWorld) for (const doc of automationDocuments(game)) {
    const updates = legacyFlagUpdates(doc.flags);
    if (!Object.keys(updates).length) continue;
    await doc.update(updates);
    documents++;
  }
  return { settings, documents };
}
