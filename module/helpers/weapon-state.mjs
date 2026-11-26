import { sizeCategories, sizeRank } from '../rules/size-v093.mjs';
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
  const qualities = item.system.qualities || [];
  if (qualities.some(q => q.qualityKey === 'dimension_blade') && qualities.some(q => q.qualityKey === 'unbreakable')) {
    return { issue: `${item.name}: Unbreakable impede gastar os LP exigidos por Dimension Blade.` };
  }
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

export function duelistParryBonus093(actor) {
  if (!uses093(actor.system)) return 0;
  const duelist = wieldedWeapons(actor.system, actor.items || []).some(weapon =>
    (weapon.weaponType || 'physical') === 'physical' && weapon.qualities?.some(q => q.qualityKey === 'duelist'));
  return duelist ? actor.system.tier || 1 : 0;
}

const pendingWeaponWear = new WeakMap();

export async function applyDimensionBladeWear093(actor, weaponId) {
  if (!weaponId || !uses093(actor.system)) return;
  const item = actor.items?.find(weapon => weapon.id === weaponId);
  const qualities = item?.system.qualities || [];
  if (!qualities.some(q => q.qualityKey === 'dimension_blade') || qualities.some(q => q.qualityKey === 'unbreakable')) return;

  const wear = (pendingWeaponWear.get(item) || Promise.resolve()).catch(() => {}).then(async () => {
    const max = weaponLifeMax(actor.system.level, item.system, true);
    const before = Number(item.system.weaponLPDamage) || 0;
    const damage = Math.min(max, before + Math.floor(max / 10));
    if (damage > before) await item.update({ 'system.weaponLPDamage': damage });
  });
  pendingWeaponWear.set(item, wear);
  try {
    await wear;
  } catch (error) {
    console.error('DBU | Dimension Blade', error);
    ui.notifications.error(`Não foi possível descontar os LP de ${item.name} por Dimension Blade.`);
  } finally {
    if (pendingWeaponWear.get(item) === wear) pendingWeaponWear.delete(item);
  }
}

export function weaponRollModifiers093(system, item, profile, targetRange = 0) {
  if (!item) return { strike: 0, wound: 0 };
  const tier = system.tier || 1;
  const weapon = item.system;
  const flags = system.equipmentFlags || {};
  const size = ({ small: 1, big: -1 }[weapon.weaponSize] || 0) * tier;
  let strike = size + (flags.weaponStrikePenalty?.[item.id] || 0);
  if (targetRange >= (system.status?.longRangeNumeric ?? 9)) strike += flags.weaponLongRangeStrikeBonus?.[item.id] || 0;
  let wound = -2 * size + (flags.weaponWoundBonus?.[item.id] || 0);
  if (weapon.qualities?.some(q => q.qualityKey === 'giant_weapon')) {
    const rank = sizeRank({ system });
    const wielderSize = rank >= 0 ? rank : sizeCategories.indexOf('medium');
    strike -= Math.max(0, sizeCategories.indexOf('enormous') - wielderSize) * tier;
    wound += 3 * tier;
  }
  if (['slashing', 'magic_orb'].includes(weapon.weaponCategory)
    || (weapon.weaponCategory === 'efficient' && profile === 'Simple')) wound += 2 * tier;
  return { strike, wound };
}
