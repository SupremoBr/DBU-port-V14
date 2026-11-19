import { RACES_093 } from './races-v093.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';
import { uses093 } from './v093.mjs';

const racialById = new Map(Object.values(CATALOGS_093.racialTraits).flat().map(t => [t.id, t]));
const talentById = new Map(CATALOGS_093.talents.map(t => [t.id, t]));

export function racialSaves093(system) {
  const race = system.fusion?._possessionRace || system.race;
  return race === 'customSpecies' ? [system.customSpeciesSave || 'corporeal'] : (RACES_093[race]?.saves || []);
}
export function racialLife093(system, race = system.race) { return RACES_093[race]?.life ?? 3; }
/** Only verified current passives belong here. Other changed traits remain manual. */
export function applyRacial093(system, tier, baseTier) {
  if (!uses093(system)) return;
  const traits = CATALOGS_093.racialTraits[system.race] || [];
  const has = (name, level = 1) => racialEffectEnabled093(system, name, level);
  const bb = system.battleBorn || {};
  const born = has('Born for Battle');
  const cap = system.rules093State?.bornLimitOverride ? 3 : 2;
  bb.cap = cap; bb.woundCap = cap; bb.maxTotal = cap * 3;
  bb.strike = system.rules093State?.bornLimitOverride ? Math.max(0, Number(bb.strike) || 0) : Math.min(cap, Math.max(0, Number(bb.strike) || 0));
  bb.dodge = system.rules093State?.bornLimitOverride ? Math.max(0, Number(bb.dodge) || 0) : Math.min(cap, Math.max(0, Number(bb.dodge) || 0));
  bb.wound = system.rules093State?.bornLimitOverride ? Math.max(0, Number(bb.wound) || 0) : Math.min(cap, Math.max(0, Number(bb.wound) || 0));
  bb.total = bb.strike + bb.dodge + bb.wound;
  bb.strikeBonus = born ? bb.strike * tier : 0;
  bb.dodgeBonus = born ? bb.dodge * tier : 0;
  bb.woundBonus = born ? bb.wound * tier : 0;
  system.battleBorn = bb;
  if (system.race !== 'saiyan') return;
  if (has('Saiyan Heritage', 5)) {
    const trait = traits.find(t => t.name === 'Saiyan Heritage');
    const option = system.racialOptionSelections?.[trait.id]?.['5'];
    if (option === 'Tailed') system.aptitudes.stressBonus = (system.aptitudes.stressBonus || 0) + (baseTier >= 5 ? 2 : 1);
    if (option === 'Tailless' && system.transformations?.some(t => t.active && t.transformationType !== 'manifested_power')) {
      bb.woundBonus += tier; system.status.soak += tier;
    }
  }
  // Saving-throw base calculation also includes custom racial-save modifiers.
  if (has('Warrior’s Pride')) system.savingThrows.cognitive.bonus += system._racialSaveBonus093 ?? tier;
  const bloodBonus = has('Blood of the Warrior') ? (system.thresholds?.crossedCount || 0) * tier : 0;
  bb.woundBonus += bloodBonus;
  system.status.soak += bloodBonus;
  system.aptitudes.surgencyBonus093 = bloodBonus;
  if (bloodBonus) {
    system.status.healingSurge += '+' + bloodBonus;
    system.status.powerSurgeKi += bloodBonus;
  }
  if (has('Powerful Physique')) {
    const force = system.attributes.fo;
    const bonus = Math.ceil((force.totalScore ?? force.score ?? 0) / 4);
    system.status.soak += bonus;
    system.aptitudes.powerfulPhysiqueSoakBonus093 = bonus;
  }
}

export function applyCatalogPassives093(system, tier, baseTier) {
  if (!uses093(system)) return;
  const selected = [
    ...(system.racialTraits || []).map(id => racialById.get(id)),
    ...(system.talents || []).map(id => talentById.get(id))
  ];
  for (const entry of selected.filter(t => t && t.automation !== "legacy-reviewed")) for (const effect of entry.effects) {
    const rule = effect.mechanic;
    const traitKey = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const toggle = entry.race ? `racial_${entry.traitCategory}_${traitKey}_${effect.level}` : `talent_${entry.id}_${effect.level}`;
    if (!rule || system.effectTracking?.enabledPassives?.[toggle] === false) continue;
    const amount = rule.amount * (rule.scale === 'T' ? tier : rule.scale === 'bT' ? baseTier : 1);
    if (['soak','might'].includes(rule.target)) system.status[rule.target] = (system.status[rule.target] || 0) + amount;
    else if (rule.target === 'allSaves') for (const save of Object.values(system.savingThrows || {})) save.bonus += amount;
    else system.aptitudes[rule.target] = (system.aptitudes[rule.target] || 0) + amount;
  }
}

export function applyRacialAttribute093(system, tier) {
  if (!uses093(system) || system.race !== 'saiyan' || (system.tracking?.powerStacks || 0) < 2) return;
  const trait = CATALOGS_093.racialTraits.saiyan.find(t => t.name === 'Powerful Physique');
  if (!racialEffectEnabled093(system, 'Powerful Physique', 2)) return;
  const force = system.attributes.fo;
  force.modifier += tier; force.totalScore = force.score + force.modifier;
}

export function racialEffectEnabled093(system, name, level = 1) {
  const trait = (CATALOGS_093.racialTraits[system.race] || []).find(t => t.name === name);
  if (!trait || !system.racialTraits?.includes(trait.id)) return false;
  const key = trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return system.effectTracking?.enabledPassives?.[`racial_${trait.traitCategory}_${key}_${level}`] !== false;
}
export function ignoresSaiyanPenalties093(system) {
  return uses093(system) && !!system.combatStates?.superior && racialEffectEnabled093(system, 'Warrior’s Pride', 2);
}
