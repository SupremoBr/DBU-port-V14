const aliases = {
  'max ki points': 'max ki pool',
  'max ki points ±1/4': 'max ki pool ±1/4',
  'impulsive save': 'impulsive saves',
  'cognitive save': 'cognitive saves',
  'corporeal save': 'corporeal saves',
  'morale save': 'morale saves',
  'strike (all)': 'strike',
  'wound (all)': 'wound',
};

export function buffEffectKey(effect) {
  const key = String(effect ?? '').trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLowerCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
}

export function buffAmount(buff, tier, baseTier) {
  return (Number(buff.flat) || 0) + (Number(buff.bT) || 0) * baseTier + (Number(buff.T) || 0) * tier;
}

// These legacy rows lack a defined consumer. Keep saved values for manual use.
const manualEffects = new Set([
  'threshold breaker',
  "i'm being bludgeoned",
  'power burst s. stacks',
  'hype maneuver',
  'analysis maneuver (investigation)',
  'analysis maneuver (intuition)',
]);

export function manualBuffEffect(effect) {
  return manualEffects.has(buffEffectKey(effect));
}

export function shiftAttackDamageCategory(category, stages) {
  const categories = ['Standard', 'Direct', 'Lethal'];
  const steps = Math.trunc(Number(stages) || 0);
  const index = categories.indexOf(category);
  if (index < 0 || !steps) return category;
  return categories[Math.max(0, Math.min(categories.length - 1, index + steps))];
}

export function attackKiWithBuffs(cost, minimum, aptitudes = {}) {
  const adjusted = cost + (aptitudes.kiCostAttacks || 0) - (aptitudes.allManeuverKiReduction || 0);
  const afterFloor = Math.max(minimum, adjusted);
  return Math.floor(Math.max(0, afterFloor + (aptitudes.kiCostAttacksNoCap || 0)));
}

export function signatureBuffDice(system, rollType) {
  const signature = system.dicePools?.signature;
  const specific = rollType === 'strike' ? signature?.diceStrike : signature?.diceWound;
  return ['d4', 'd6', 'd8', 'd10'].map(die => {
    const count = (signature?.diceAll?.[die] || 0) + (specific?.[die] || 0);
    return count > 0 ? `+${count}${die}` : '';
  }).join('');
}

export function greaterDiceCategoryBonus(system, rollType) {
  const category = system.dicePools?.greaterCatBonus;
  const superior = system.combatStates?.superior ? system.aptitudes?.superiorDiceSize || 0 : 0;
  return (category?.global || 0) + (category?.[rollType] || 0) + superior;
}


// The integrated charge preview and native roll use the same die selection.
export function energyChargeDie(aptitudes = {}, { signature = false, maximumCharge = false } = {}) {
  const chain = ['d4', 'd6', 'd8', 'd10', 'd12'];
  let index = (signature ? 2 : 1) + (aptitudes.energyChargeDiceCategory || 0);
  if (signature) {
    index += (aptitudes.signatureEnergyChargeDiceCategory || 0) + Number(maximumCharge);
  }
  return chain[Math.max(0, Math.min(chain.length - 1, Math.trunc(index)))];
}
