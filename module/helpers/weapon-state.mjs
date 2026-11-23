export function weaponLifeMax(level, weapon) {
  const powerLevel = level || 1;
  const durable = weapon.qualities?.some(quality => quality.qualityKey === 'durable');
  return 32 + 8 * (powerLevel - 1) + (durable ? 2 * powerLevel : 0);
}

export function wieldedWeapons(system, items) {
  return Array.from(items)
    .filter(item => item.type === 'equipment' && item.system?.equipmentType === 'weapon' && item.system.worn)
    .map(item => item.system)
    .filter(weapon => weapon.qualities?.some(quality => quality.qualityKey === 'unbreakable')
      || (weapon.weaponLPDamage || 0) < weaponLifeMax(system.level, weapon));
}
