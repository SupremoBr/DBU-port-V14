import { CATALOGS_093 } from './catalogs-v093.mjs';
import { RACES_093, validateRacialAttributes } from './races-v093.mjs';
import { validateTransformationStack, awakeningLimits, uses093 } from './v093.mjs';
import { validateTechnique093, modifierPointCost } from './techniques-v093.mjs';

export const SYSTEM_ID = 'DBU-MRR-OLD';
export const MIGRATION_KEY = 'rules093Migration';
const copy = value => structuredClone(value);
const identity = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const issue = (area, name, reason, previous) => ({ area, name: String(name), reason, ...(previous === undefined ? {} : { previous: copy(previous) }) });
const traitIndex = new Map(Object.values(CATALOGS_093.racialTraits).flat().map(t => [t.id, t]));
const talentIndex = new Map(CATALOGS_093.talents.map(t => [t.id, t]));

export function convertTechnique093(input) {
  const technique = copy(input);
  for (const [field, definitions] of [['advantages', CATALOGS_093.advantages], ['disadvantages', CATALOGS_093.disadvantages]]) {
    technique[field] = (technique[field] || []).map(row => {
      const cost = modifierPointCost(definitions[row.name], row.ranks ?? 1);
      return cost === null ? row : { ...row, tpCost: cost };
    });
  }
  return { technique, issues: validateTechnique093(technique).issues.map(reason => issue('technique', technique.name || input.profile, reason, input)) };
}
export function convertTransformation093(input) {
  const mapped = CATALOGS_093.migrationMaps.transformations[input.catalogKey];
  const entry = CATALOGS_093.transformations[mapped || input.catalogKey];
  if (!entry) return { transformation: { ...copy(input), active: false, catalogKey: null, attrBonuses: {}, aspects: [], structuredTraits: [] }, issues: [issue('transformation', input.name || input.catalogKey, 'Sem equivalência exata: transformação desativada; valores anteriores no backup.', input)] };
  const type = entry.category === 'enhancement_power' ? (entry.transcended ? 'enhancement_transcendent' : 'enhancement_standard') : entry.category;
  const transformation = { ...copy(input), catalogKey: entry.id, name: entry.name, transformationType: type, awakeningType: entry.awakeningType, transcended: entry.transcended, tierRequirement: entry.tierRequirement, stressTest: entry.stressTest, attrBonuses: copy(entry.attrBonuses), aspects: [], structuredTraits: copy(entry.traitGroups), isLegendary: entry.category === 'form_legendary', mastered: false, active: entry.category === 'manifested_power' || (!!input.active && !entry.requiresReview) };
  const issues = [issue('transformation', entry.name, 'AMB e categoria atualizados. Traços, aspectos e maestria devem ser resolvidos pela fonte oficial.', input)];
  if (entry.requiresReview) {
    transformation.active = false;
    issues.push(issue('transformation', entry.name, 'AMB ou Stress depende de tabela/escolha; preencher antes de ativar.', input));
  }
  return { transformation, issues };
}
export function convertActor093(source) {
  const system = copy(source.system || {});
  if (uses093(system)) return null;
  const issues = [];
  const race = RACES_093[system.race];
  if (!race) issues.push(issue('race', system.race, 'Escolher uma raça base atual. Undead é fator racial na 0.9.3.', system.race));
  else if (!validateRacialAttributes(system.race, system.attributes).ok) issues.push(issue('race', race.name, 'Revisar distribuição dos atributos raciais conforme a nova tabela.', system.attributes));
  if (race && !race.attributes.choices.length) {
    for (const key of ['ag','fo','te','sc','in','ma','pe']) {
      system.attributes ??= {}; system.attributes[key] ??= {};
      system.attributes[key].racial = race.attributes.fixed[key] || 0;
    }
  }
  if (system.subrace || system.subspecies) issues.push(issue('race', system.subrace || system.subspecies, 'Revisar fatores raciais: opções antigas não são aplicadas automaticamente.', { subrace: system.subrace, subspecies: system.subspecies }));
  system.subrace = ''; system.subspecies = '';
  if (system.race === 'nekoMajin') issues.push(issue('race', 'Skill Ranks', 'Neko Majin passa de 4 para 3 Skill Ranks raciais. Revise a distribuição sem apagar ranks automaticamente.'));
  const oldOptions = system.racialOptionSelections || {};
  system.racialOptionSelections = {};
  system.racialTraits = (system.racialTraits || []).flatMap(id => {
    const candidates = CATALOGS_093.migrationMaps.racialTraits[id] || (traitIndex.has(id) ? [id] : []);
    if (candidates.length !== 1) { issues.push(issue('racialTrait', id, 'Traço removido ou com múltiplas equivalências; seleção anterior arquivada.', { id, options: oldOptions[id] })); return []; }
    const next = candidates[0], trait = traitIndex.get(next);
    if (trait.automation === 'legacy-reviewed') system.racialOptionSelections[next] = copy(oldOptions[id] || {});
    // The Heritage option explicitly moved from effect 1 to effect 5.
    if (trait.name === 'Saiyan Heritage' && ['Tailed','Tailless'].includes(oldOptions[id]?.['1'])) system.racialOptionSelections[next] = { '5': oldOptions[id]['1'] };
    if (trait.automation !== 'legacy-reviewed') issues.push(issue('racialTrait', trait.name, 'Efeitos alterados: consultar a fonte e aplicar os efeitos manuais.', { id, options: oldOptions[id] }));
    return [next];
  });
  system.talents = (system.talents || []).flatMap(id => {
    const next = CATALOGS_093.migrationMaps.talents[id] || (talentIndex.has(id) ? id : null);
    if (!next) { issues.push(issue('talent', id, 'Talento removido: escolher substituto com o mestre.', id)); return []; }
    if (talentIndex.get(next).automation === 'manual') issues.push(issue('talent', talentIndex.get(next).name, 'Requisitos/efeitos atuais exigem revisão; automação antiga desativada.', id));
    return [next];
  });
  system.signatureTechniques = (system.signatureTechniques || []).map(t => { const result = convertTechnique093(t); issues.push(...result.issues); return result.technique; });
  system.transformations = (system.transformations || []).map(t => { const result = convertTransformation093(t); issues.push(...result.issues); return result.transformation; });
  if (!validateTransformationStack(system.transformations).ok) {
    for (const t of system.transformations) if (t.transformationType !== 'manifested_power') t.active = false;
    issues.push(issue('transformations', 'Combinação ativa', 'Limite de uma Form + um Enhancement: selecionar novamente as formas ativas.'));
  }
  const limits = awakeningLimits(system.baseTier || 1);
  for (const [kind, limit] of Object.entries(limits)) {
    const owned = system.transformations.filter(t => t.transformationType === 'manifested_power' && String(t.awakeningType).toLowerCase() === kind);
    if (owned.length > limit) issues.push(issue('awakenings', kind, `Quantidade ${owned.length} excede o limite ${limit}; revisar escolhas.`));
  }
  // Never let former trait caches or options activate removed 0.9.2 effects.
  system.talentSelections = {}; system.transformationOptionSelections = {};
  system.transformationMeta = { ...(system.transformationMeta || {}), nlopActiveEncounter: [], enteredFormKeys: [] };
  system.rulesVersion = '0.9.3';
  return { system, issues };
}
export function convertItem093(source) {
  let system, issues = [], name = source.name;
  if (source.type === 'technique') {
    const result = convertTechnique093({ ...source.system, name: source.name, type: source.system?.techType });
    system = result.technique; delete system.name; delete system.type; issues = result.issues;
  } else if (source.type === 'transformation') {
    const result = convertTransformation093({ ...source.system, name: source.name });
    system = result.transformation; delete system.name; issues = result.issues;
  } else if (['talent','racialTrait'].includes(source.type)) {
    const entries = source.type === 'talent' ? [...talentIndex.values()] : [...traitIndex.values()];
    const expectedName = source.type === 'racialTrait' && source.system?.race === 'saiyan' && source.name === 'Battle Born' ? 'Born for Battle' : source.name;
    const matches = entries.filter(t => identity(t.name) === identity(expectedName) && (source.type !== 'racialTrait' || t.race === source.system?.race));
    if (matches.length !== 1) return { system: { ...copy(source.system), effects: [] }, issues: [issue(source.type, source.name, 'Conteúdo antigo arquivado no backup; escolher entrada atual.')] };
    name = matches[0].name;
    system = { ...copy(source.system), effects: copy(matches[0].effects), description: `<p>Referência 0.9.3: <a href="${matches[0].source}" target="_blank" rel="noopener noreferrer">fonte oficial</a>.</p>` };
    if (matches[0].automation !== 'legacy-reviewed') issues.push(issue(source.type, source.name, 'Aplicar os efeitos atuais manualmente pela fonte oficial.'));
  } else return null;
  if (issues.length && typeof system.description === 'string') system.description = '<p><strong>Revisão 0.9.3 necessária.</strong> Este conteúdo possui escolhas ou efeitos manuais. Consulte as regras atuais e o backup anterior.</p>' + system.description;
  return { system, issues, name };
}

function primaryGM(game) { return game.users?.activeGM?.id === game.user?.id || (!game.users?.activeGM && game.users?.find(u => u.active && u.isGM)?.id === game.user?.id); }
export function collectMigrationActors(game) {
  const actors = [...game.actors];
  const seen = new Set(actors.map(a => a.uuid));
  for (const scene of game.scenes) for (const token of scene.tokens) {
    if (!token.actorLink && token.actor && !seen.has(token.actor.uuid)) { actors.push(token.actor); seen.add(token.actor.uuid); }
  }
  return actors;
}
/** Called once by the primary GM, before the integrated automation's ready work. */
export async function migrateWorld093(game, { Journal = globalThis.JournalEntry } = {}) {
  if (!game.user?.isGM || !primaryGM(game)) return { skipped: 'primary-gm' };
  let state = game.settings.get(SYSTEM_ID, MIGRATION_KEY) || {};
  if (state.complete) return state;
  let backup;
  if (state.backupId) {
    backup = game.journal.get(state.backupId);
    if (!backup?.getFlag(SYSTEM_ID, 'rules093Backup')) throw new Error('Backup 0.9.3 ausente. Migração interrompida para preservar dados.');
  } else {
    const documents = Object.fromEntries(['actors','items','scenes','combats'].map(key => [key, [...(game[key] || [])].map(d => d.toObject(true))]));
    const snapshot = { format: 1, from: '0.9.2', to: '0.9.3', created: new Date().toISOString(), world: game.world?.id, systemVersion: game.system?.version, documents };
    backup = await Journal.create({ name: 'DBU — Backup anterior à migração 0.9.3', ownership: { default: 0 }, flags: { [SYSTEM_ID]: { rules093Backup: snapshot } }, pages: [{ name: 'Como baixar', type: 'text', text: { content: '<p>Backup completo de Actors, Items, Scenes (incluindo tokens e atores sintéticos) e Combats. No console: <code>game.dbu.exportRulesBackup()</code>. Guarde o JSON fora do Foundry antes de editar o mundo convertido.</p>' } }] });
    if (!backup?.id) throw new Error('Não foi possível criar o backup; nenhum dado foi convertido.');
    state = { backupId: backup.id, complete: false, converted: [], reports: [] };
    await game.settings.set(SYSTEM_ID, MIGRATION_KEY, state);
  }
  const converted = new Set(state.converted || []);
  const migrateDocument = async (doc, plan) => {
    if (!plan || converted.has(doc.uuid)) return;
    const flags = copy(doc.toObject(true).flags || {});
    flags[SYSTEM_ID] = { ...(flags[SYSTEM_ID] || {}), rules093Review: { backupId: backup.id, issues: plan.issues } };
    await doc.update({ system: plan.system, flags, ...(plan.name ? { name: plan.name } : {}) }, { diff: false, recursive: false });
    converted.add(doc.uuid);
    state = { ...state, converted: [...converted], reports: [...(state.reports || []), { uuid: doc.uuid, issues: plan.issues.length }] };
    await game.settings.set(SYSTEM_ID, MIGRATION_KEY, state);
  };
  for (const actor of collectMigrationActors(game)) {
    if (actor.type === 'character') await migrateDocument(actor, convertActor093(actor.toObject(true)));
    for (const item of actor.items || []) await migrateDocument(item, convertItem093(item.toObject(true)));
  }
  for (const item of game.items || []) await migrateDocument(item, convertItem093(item.toObject(true)));
  state = { ...state, complete: true };
  await game.settings.set(SYSTEM_ID, MIGRATION_KEY, state);
  return state;
}
export function exportRulesBackup(game) {
  if (!game.user?.isGM) throw new Error('Somente o mestre pode exportar o backup.');
  const state = game.settings.get(SYSTEM_ID, MIGRATION_KEY);
  const snapshot = game.journal.get(state?.backupId)?.getFlag(SYSTEM_ID, 'rules093Backup');
  if (!snapshot) throw new Error('Backup não encontrado.');
  const exported = copy(snapshot);
  exported.importedAfterMigration = collectMigrationActors(game).map(actor => actor.getFlag(SYSTEM_ID, 'rules093ImportedOriginal')).filter(Boolean).map(copy);
  globalThis.saveDataToFile(JSON.stringify(exported, null, 2), 'application/json', `${game.world?.id || 'dbu'}-before-093.json`);
  return exported;
}

/** Other clients wait for the GM's persisted completion before automation boots. */
export function waitForRules093(game, hooks = globalThis.Hooks) {
  const current = game.settings.get(SYSTEM_ID, MIGRATION_KEY);
  if (current?.complete) return Promise.resolve(current);
  return new Promise(resolve => {
    const hook = hooks.on('updateSetting', setting => {
      if (setting.key !== `${SYSTEM_ID}.${MIGRATION_KEY}`) return;
      const state = game.settings.get(SYSTEM_ID, MIGRATION_KEY);
      if (!state?.complete) return;
      hooks.off('updateSetting', hook);
      resolve(state);
    });
    // Completion may arrive between the initial read and hook registration.
    const state = game.settings.get(SYSTEM_ID, MIGRATION_KEY);
    if (state?.complete) { hooks.off('updateSetting', hook); resolve(state); }
  });
}
