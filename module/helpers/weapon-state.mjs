import { uses093 } from '../rules/v093.mjs';

export function weaponLifeMax(level, weapon, currentRules = false) {
  const powerLevel = level || 1;
  const durable = weapon.qualities?.find(quality => quality.qualityKey === 'durable' || quality.qualityKey === 'durable_weapon');
  const durableSlots = durable ? (currentRules && Number(durable.slotsUsed) >= 2 ? 2 : 1) : 0;
  const shield = currentRules && weapon.weaponCategory === 'shield'
    ? ({ small: 1, standard: 2, big: 3 }[weapon.weaponSize] ?? 2) : 0;
  return 32 + 8 * (powerLevel - 1) + (durableSlots * 2 + shield) * powerLevel;
}

export function weaponBroken(system, weapon) {
  return !weapon.qualities?.some(quality => quality.qualityKey === 'unbreakable')
    && (weapon.weaponLPDamage || 0) >= weaponLifeMax(system.level, weapon, uses093(system));
}

export function wieldedWeapons(system, items) {
  return Array.from(items)
    .filter(item => item.type === 'equipment' && item.system?.equipmentType === 'weapon' && item.system.worn)
    .map(item => item.system)
    .filter(weapon => !weaponBroken(system, weapon));
}

export function weaponUsesHand(weapon) {
  return !weapon.qualities?.some(quality => quality.qualityKey === 'telekinetic');
}

export function attackWeapon093(actor, attack) {
  const name = String(attack.offHandCheckbox ? attack.offHand : attack.weaponEquipped || '').trim();
  if (!name || name.toLowerCase() === 'unarmed') return {};
  const match = Array.from(actor.items || []).filter(item =>
    item.type === 'equipment' && item.system?.equipmentType === 'weapon'
    && (item.id === name || item.name.trim().toLowerCase() === name.toLowerCase()));
  if (match.length !== 1) return { issue: match.length ? `Há mais de uma arma chamada ${name}. Selecione pelo item.` : `Arma indisponível: ${name}.` };
  const item = match[0];
  if (!item.system.worn) return { issue: `Equipe ${item.name} antes de usar este ataque.` };
  if (weaponBroken(actor.system, item.system)) return { issue: `${item.name} está quebrada.` };
  const type = item.system.weaponType || 'physical';
  if (type.toLowerCase() !== attack.foundation?.toLowerCase()) {
    return { issue: `${item.name} exige a Foundation ${type}.` };
  }
  const category = globalThis.CONFIG?.DBU?.weaponCategories?.[item.system.weaponCategory];
  if (category && category.type !== type.toLowerCase()) {
    return { issue: `A categoria de ${item.name} não é compatível com o tipo ${type}.` };
  }
  if (wieldedWeapons(actor.system, actor.items).filter(weaponUsesHand).length > 2) {
    return { issue: 'Ajuste os equipamentos para empunhar até duas armas.' };
  }
  return { item };
}

export function wieldingStrikePenalty093(actor, system) {
  if ((system.talents || []).includes('weapon_specialist') || system.aptitudes?.ignoreWeaponPenalty) return 0;
  return wieldedWeapons(system, actor.items || []).length ? 2 * (system.tier || 1) : 0;
}

export function weaponRollModifiers093(system, item, profile, targetRange = 0) {
  if (!item) return { strike: 0, wound: 0 };
  const tier = system.tier || 1;
  const weapon = item.system;
  const flags = system.equipmentFlags || {};
  const size = ({ small: 1, big: -1 }[weapon.weaponSize] || 0) * tier;
  let strike = size + (flags.weaponStrikePenalty?.[item.id] || 0);
  if (targetRange >= 9) strike += flags.weaponLongRangeStrikeBonus?.[item.id] || 0;
  let wound = -2 * size + (flags.weaponWoundBonus?.[item.id] || 0);
  if (['slashing', 'magic_orb'].includes(weapon.weaponCategory)
    || (weapon.weaponCategory === 'efficient' && profile === 'Simple')) wound += 2 * tier;
  return { strike, wound };
}
