import { CATALOGS_093 } from './catalogs-v093.mjs';

const subraceTraits = {
  r093_demons_denizen_of_the_demon_realm: 'demonPerson',
  r093_demons_demons_of_the_makyo_star: 'makyan',
  r093_demons_fallen_idol: 'phantom',
  r093_glass_tribe_glass_mastery: 'glassUser',
  r093_glass_tribe_glass_shards: 'glassWarrior',
  r093_namekians_refined_combat: 'warriorClan',
  r093_namekians_spirit_of_namek: 'dragonClan',
  r093_neo_tuffles_hate_empowerment: 'hatredEmbodiment',
  r093_neo_tuffles_parasitic_biology: 'parasite',
  r093_yardrats_spiritual_warrior: 'tallYardrat',
  r093_yardrats_spiritual_pacifist: 'bulbousYardrat'
};

export function matchesRacialSubrace093(system, race, id, allowLegacySelection = false) {
  const required = subraceTraits[id];
  if (!required) return true;
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const subrace = normalize(system.subrace);
  const selectedSubrace = (CATALOGS_093.subraceOptions[race] || []).find(option =>
    normalize(option.id) === subrace || normalize(option.name) === subrace);
  if (selectedSubrace) return required === selectedSubrace.id;
  if (system.subraceTraits?.length) return system.subraceTraits.includes(id);
  if (!allowLegacySelection || (subrace && subrace !== 'none')) return false;
  // Older sheets can have the trait but no subrace. Only infer an unambiguous choice.
  const traits = (CATALOGS_093.racialTraits[race] || []).filter(trait =>
    subraceTraits[trait.id] && system.racialTraits?.includes(trait.id));
  return traits.length === 1 && traits[0].id === id;
}

function combatEffect(effect) {
  const keyword = effect.keyword || '';
  return !/Downtime|Adventuring|Character Creation/i.test(keyword)
    && (['triggered', 'limited'].includes(effect.activationType)
      || /\bTriggered\b|\b\d+\s*\/\s*(Round|Turn|Encounter)\b/i.test(keyword));
}

export function racialTrackerTraits093(system, preparedTraits) {
  const race = system.fusion?._possessionRace || system.race;
  const selected = new Set(system.racialTraits || []);
  const listed = new Set();
  const result = [];
  for (const trait of preparedTraits || []) {
    if (trait.race !== race || !selected.has(trait.id) || listed.has(trait.id) || trait.isSelectable === false) continue;
    if (!matchesRacialSubrace093(system, race, trait.id)) continue;
    const effects = (trait.effects || []).flatMap(effect => [
      effect,
      ...(effect.options || []).filter(option => option.selected).map(option => ({ ...option, level: effect.level }))
    ]).filter(combatEffect);
    if (!effects.length) continue;
    listed.add(trait.id);
    result.push({ name: trait.name, source: trait.source, effects });
  }
  return result;
}
