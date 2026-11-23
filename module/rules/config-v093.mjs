import { CATALOGS_093 } from './catalogs-v093.mjs';
import { RACES_093 } from './races-v093.mjs';
import { PROFILES_093, PROFILE_SUMMARIES_093 } from './profiles-v093.mjs';
import { uniqueAbilityCatalog093 } from './unique-abilities-v093.mjs';

export function installRules093(config) {
  config.rulesVersion = '0.9.3';
  config.racialTraitsCatalog = CATALOGS_093.racialTraits;
  config.talentsCatalog = CATALOGS_093.talents;
  config.talentCategories = {};
  for (const { category, id } of config.talentsCatalog) {
    (config.talentCategories[category] ??= []).push(id);
  }
  config.transformationsCatalog = CATALOGS_093.transformations;
  config.uniqueAbilitiesCatalog = uniqueAbilityCatalog093(config.uniqueAbilitiesCatalog);
  config.techniqueAdvantagesData = CATALOGS_093.advantages;
  config.techniqueDisadvantagesData = CATALOGS_093.disadvantages;
  config.profileData = Object.fromEntries(Object.entries(PROFILES_093).map(([name, p]) => [name, { ...p, effect: PROFILE_SUMMARIES_093[name] + ' Efeitos no alvo e no ambiente: resolução manual pela fonte.' }]));
  config.profileKpCosts = Object.fromEntries(Object.entries(PROFILES_093).map(([name, p]) => [name, p.kpCost]));
  config.techniqueFoundations = Object.fromEntries(['Physical', 'Energy', 'Magic'].map(f => [f, Object.keys(PROFILES_093).filter(name => PROFILES_093[name].foundations.includes(f))]));
  config.racesWithFixedAttributes = Object.keys(RACES_093).filter(r => !RACES_093[r].attributes.choices.length);
  config.racialAttributeBonuses = Object.fromEntries(Object.entries(RACES_093).map(([id, r]) => [id, r.attributes.fixed]));
  config.racialSkillRanks = Object.fromEntries(Object.entries(RACES_093).map(([id, r]) => [id, r.skills]));
  config.racialSubraces = { ...CATALOGS_093.subraceOptions };
  config.racialFactors = {};
  config.transformationTypes = config.transformationTypes.map(t => t.id === 'manifested_power' ? { ...t, name: 'Awakening' } : t);
  config.transformationCategories = config.transformationCategories.map(t => t.id === 'manifested_power' ? { ...t, name: 'Awakenings' } : t);
}
