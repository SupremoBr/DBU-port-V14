import { getRacialCatalogIndex } from '../helpers/catalog-index.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';
import { uses093 } from './v093.mjs';

// Each row names a verified [Passive] level and its numerical contributions.
// Option rows use the saved option name. Twinned effects need a separate choice.
export const RACIAL_PASSIVES_093 = {
  r093_alternate_upbringing_majin_raised: [{ level: 2, bonuses: { surgency: 2 } }],
  r093_alternate_upbringing_namekian_raised: [{ level: 2, scale: 'flat', bonuses: { racialLife: 2 } }],
  r093_cybernetic_enhancement_armor_plating: [
    { level: 1, scale: 'flat', bonuses: { racialLife: 2 } },
    { level: 2, scale: 'bT', bonuses: { dr: 1 } },
  ],
  r093_cybernetic_enhancement_emergency_energy_supplies: [{ level: 1, scale: 'bT', bonuses: { surgency: 3 } }],
  r093_cybernetic_enhancement_life_support: [
    { level: 2, scale: 'flat', bonuses: { racialLife: 4 } },
    { level: 3, bonuses: { soak: 1, surgency: 2 } },
  ],
  r093_cybernetic_enhancement_mental_supercomputer: [{ level: 1, minimumPower: 2, bonuses: { sc: 1, pe: 1 } }],
  r093_cybernetic_enhancement_rocket_sleeves: [{ level: 2, bonuses: { boostedSpeed: 2 } }],
  r093_cybernetic_enhancement_synthetic_muscle: [{ level: 2, bonuses: { dr: 1 } }],
  r093_monster_custom_monstrosity: [{ level: 1, scale: 'flat', bonuses: { racialLife: 2 } }],
  r093_monster_genie: [{ level: 3, scale: 'flat', bonuses: { drHalfInsight: 1 } }],
  r093_monster_mummy: [{ level: 2, scale: 'bT', bonuses: { dr: 2, surgency: 2 } }],
  r093_mutation_brute: [
    { level: 1, scale: 'flat', bonuses: { racialLife: 2 } },
    { level: 2, scale: 'bT', bonuses: { soak: 1 } },
    { level: 3, bonuses: { te: 1 } },
  ],
  r093_mutation_captain: [{ level: 2, bonuses: { pe: 1 } }],
  r093_mutation_psychic: [{ level: 2, bonuses: { in: 1, cognitiveSave: 1 } }],
  r093_mutation_speedster: [{ level: 2, bonuses: { ag: 1 } }],
  r093_mutation_tactician: [{ level: 2, bonuses: { sc: 1 } }],
  r093_mutation_technician: [{ level: 2, bonuses: { fo: 1, ma: 1 } }],
  r093_androids_damage_inhibitor: [{ level: 1, bonuses: { dr: 2 } }],
  r093_bio_android_artificial_warrior: [
    { level: 4, option: 'Genetic Survivor', scale: 'flat', bonuses: { racialLife: 2 } },
    { level: 4, option: 'Genetic Survivor', bonuses: { soak: 1 } },
    { level: 4, option: 'Genetic Aggressor', bonuses: { strike: 1, wound: 1 } },
    { level: 4, option: 'Genetic Agility', bonuses: { dodge: 1, normalSpeed: 1, boostedSpeed: 1 } },
  ],
  r093_bio_android_defensive_design: [{ level: 2, bonuses: { dr: 1 } }],
  r093_bio_focus_genetic_focus_android: [{ level: 3, bonuses: { surgency: 2 } }],
  r093_bio_focus_genetic_focus_majins: [{ level: 4, bonuses: { soak: 1, defense: 1 } }],
  r093_bio_focus_genetic_focus_namekians: [{ level: 1, bonuses: { surgency: 1 } }],
  r093_genetic_splicing_android_cybernetics_cognitive: [{ level: 1, scale: 'bT', bonuses: { dr: 1 } }],
  r093_genetic_splicing_glass_genes_any_you_decide: [{ level: 2, bonuses: { dr: 1 } }],
  r093_genetic_splicing_namekian_genes_any_you_choose: [{ level: 1, bonuses: { surgency: 1 } }],
  r093_genetic_splicing_shadow_dragon_genes_morale: [{ level: 1, scale: 'flat', bonuses: { racialLife: 2 } }],
  r093_megath_colossal_demon: [{ level: 1, scale: 'flat', bonuses: { racialLife: 4 } }],
  r093_herans_brigand_combat: [
    { level: 3, option: 'Riches of Might', scale: 'flat', bonuses: { racialLife: 3 } },
    { level: 3, option: 'Riches of Might', bonuses: { might: 1 } },
  ],
  r093_majins_rubbery_body: [{ level: 2, bonuses: { soak: 1, defense: 1 } }],
  r093_majins_elastic_tentacle: [{ level: 2, bonuses: { strikePhysical: 1 } }],
  r093_assimilating_majin_assimilation: [{ level: 1, bonuses: { corporealSave: 1 } }],
  r093_diluted_majin_traces_of_majin: [{ level: 1, scale: 'flat', bonuses: { racialLife: 4 } }],
  r093_namekians_refined_combat: [{ level: 2, scale: 'flat', bonuses: { surgencyHalfInsight: 1 } }],
  r093_ancient_saiyan_primitive_durability: [{ level: 1, scale: 'flat', bonuses: { racialLife: 2 } }],
  r093_yardrats_spiritual_warrior: [{ level: 1, scale: 'flat', bonuses: { racialLife: 3 } }],
  r093_custom_species_abnormal_anatomy: [{ level: 2, bonuses: { dr: 1 } }],
  r093_custom_species_blazing_speed: [{ level: 1, bonuses: { normalSpeed: 1, boostedSpeed: 1, defense: 2 } }],
  r093_custom_species_death_defier: [{ level: 3, scale: 'flat', bonuses: { racialLife: 1 } }],
  r093_custom_species_seizing_initiative: [{ level: 1, scale: 'flat', bonuses: { initiativeQuarterInsight: 1 } }],
  r093_custom_species_vital_vitality: [{ level: 3, scale: 'bT', bonuses: { surgency: 2 } }],
  r093_custom_species_wise_warriors: [{ level: 1, scale: 'flat', bonuses: { defenseQuarterInsight: 1 } }],
};

const { byId } = getRacialCatalogIndex(CATALOGS_093.racialTraits);

export function racialPassiveBonuses093(system, tier, baseTier) {
  const totals = {};
  if (!uses093(system)) return totals;
  const passives = system.effectTracking?.enabledPassives;
  for (const id of new Set(system.racialTraits || [])) {
    if (!Object.hasOwn(RACIAL_PASSIVES_093, id)) continue;
    const trait = byId.get(id);
    const key = trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const rule of RACIAL_PASSIVES_093[id]) {
      if (passives?.[`racial_${trait.traitCategory}_${key}_${rule.level}`] === false) continue;
      if (rule.option && system.racialOptionSelections?.[id]?.[rule.level] !== rule.option) continue;
      if (rule.minimumPower && (system.tracking?.powerStacks || 0) < rule.minimumPower) continue;
      const multiplier = rule.scale === 'bT' ? baseTier : rule.scale === 'flat' ? 1 : tier;
      for (const [stat, amount] of Object.entries(rule.bonuses)) {
        totals[stat] = (totals[stat] || 0) + amount * multiplier;
      }
    }
  }
  return totals;
}
