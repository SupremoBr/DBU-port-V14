import { uses093 } from './v093.mjs';
import { wieldedWeapons } from '../helpers/weapon-state.mjs';

// Each entry represents one confirmed [Passive] level of the current talent.
export const TALENT_PASSIVES_093 = {
  r093_enhanced_shot: { 1: { woundEnergy: 1 } },
  r093_magic_blaster: { 1: { woundMagic: 1 } },
  r093_enhanced_fist: { 1: { woundPhysical: 1 } },
  r093_iron_fist: { 1: { woundPhysical: 1 } },
  r093_rapid_fist: { 1: { strikePhysical: 1 } },
  r093_namekian_finger: { 1: { woundPhysical: 1 } },
  r093_weapon_arts: { 1: { armedWound: 1 } },
  r093_alert: { 1: { initiativeValue: { amount: 1, scale: 'bT' } } },
  r093_speedblitz: { 1: { initiativeValue: { amount: 1, scale: 'bT' } } },
  r093_mystical_gaze: { 1: { kiCostUnique: -1 } },
  r093_mystic_power: { 1: { kiCostUnique: -1 } },
  r093_sorcering_corsair: { 1: { kiCostUnique: -1 } },
  r093_style_and_greed: { 1: { racialLife: { amount: 2, scale: 'flat' } } },
  r093_aiiieeeeeee: { 2: { racialLife: { amount: 2, scale: 'flat' } } },
  r093_roomy_biology: { 1: { racialLife: { amount: 2, scale: 'flat' } } },
  r093_namekian_progenitor: { 1: { racialLife: { amount: 2, scale: 'flat' } } },
  r093_saiyan_soul: { 1: { racialLife: { amount: 2, scale: 'flat' } } },
  r093_honorbound: { 1: { surgency: 1 } },
  r093_second_wind: { 1: { surgency: 1 } },
  r093_never_surrender: { 1: { surgency: 2 } },
  r093_angelic_technique: { 1: { tpPerSkillImprovement: { amount: 2, scale: 'flat' } } },
  r093_supreme_fist: { 1: { physicalSignatureKiDiscount: { amount: 2, scale: 'flat' } } },
  r093_risky_bet: { 1: { soak: { amount: 1, scale: 'bT', when: 'injured' } } },
  r093_effective_defenses: { 1: { guardKPReduction: 2 } },
  r093_weapon_specialist: { 1: { ignoreWeaponPenalty: { amount: 1, scale: 'flat' } } },
  r093_desperate_transformation: { 1: { stressBonus: { amount: 1, scale: 'flat', when: 'injured' } } },
  r093_forceful_transformation: { 1: { might: { amount: 1, when: 'transformed' } } },
  r093_dual_wielding_specialist: { 1: { strikeBuffTotal: { amount: 1, when: 'dualWield' } } },
  r093_twin_weapon_specialist: { 1: { woundBuffTotal: { amount: 1, when: 'matchingWeapons' } } },
  r093_light_weapons_specialist: { 1: { woundBuffTotal: { amount: 2, when: 'singleSmall' } } },
  r093_heavy_weapons_specialist: { 1: { strikeBuffTotal: { amount: 1, when: 'singleBig' } } },
  r093_iaijutsu_specialist: { 1: { dodgeBuffTotal: { amount: 1, when: 'noWeapon' } } },
  r093_critical_specialist: { 1: { armedStrikeCT: { amount: 1, scale: 'flat' } } },
  r093_variable_fighter: { 1: { unarmedAttackStrike: { amount: 1, when: 'wielding' } } },
  r093_variable_champion: { 1: { armedStrike: { amount: 1, when: 'singleWeapon' } } },
};

function applies(system, when, weapons) {
  if (when === 'injured') return !!system.thresholds?.injured?.crossed;
  if (when === 'transformed') return (system.transformations || []).some(row =>
    row.active && /^(form|enhancement)/.test(row.transformationType || ''));
  if (when === 'noWeapon') return weapons.length === 0;
  if (when === 'wielding') return weapons.length > 0;
  if (when === 'singleWeapon') return weapons.length === 1;
  if (when === 'singleSmall') return weapons.length === 1 && weapons[0].weaponSize === 'small';
  if (when === 'singleBig') return weapons.length === 1 && weapons[0].weaponSize === 'big';
  if (when === 'dualWield') return weapons.length >= 2;
  if (when === 'matchingWeapons') {
    const categories = weapons.map(weapon => weapon.weaponCategory?.trim().toLowerCase()).filter(Boolean);
    return new Set(categories).size < categories.length;
  }
  return true;
}

function talentEffects(system) {
  if (!uses093(system)) return [];
  const disabled = system.effectTracking?.enabledPassives || {};
  return [...new Set(system._martialTalents ?? system.talents ?? [])].flatMap(id =>
    Object.entries(TALENT_PASSIVES_093[id] || {})
      .filter(([level]) => disabled[`talent_${id}_${level}`] !== false)
      .flatMap(([, effect]) => Object.entries(effect)));
}

function value(system, entry, tier, baseTier, weapons = []) {
  if (typeof entry === 'number') return entry * tier;
  if (!applies(system, entry.when, weapons)) return 0;
  return entry.amount * (entry.scale === 'flat' ? 1 : entry.scale === 'bT' ? baseTier : tier);
}

export function talentPassiveBonus093(system, stat, tier = system?.tier || 1, baseTier = system?.baseTier || 1) {
  return talentEffects(system).reduce((sum, [key, entry]) =>
    sum + (key === stat ? value(system, entry, tier, baseTier) : 0), 0);
}

export function applyTalentPassives093(system, tier, baseTier, items = []) {
  const weapons = wieldedWeapons(system, items);
  for (const [stat, entry] of talentEffects(system)) {
    const amount = value(system, entry, tier, baseTier, weapons);
    if (!amount) continue;
    if (stat === 'soak') system.status.soak += amount;
    else if (stat === 'might') {
      system.status.might += amount;
      system.status.mightForClashes += amount;
    } else if (!['racialLife', 'surgency', 'tpPerSkillImprovement', 'physicalSignatureKiDiscount'].includes(stat)) {
      system.aptitudes[stat] = (system.aptitudes[stat] || 0) + amount;
    }
  }
}
