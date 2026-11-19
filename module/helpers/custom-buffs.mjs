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

// Conditional modifiers run after max LP is finalized. These destinations
// can change at that point without changing the resource used by the trigger.
const conditionalAptitudes = new Map([
  ['Strike', ['strikeBuffTotal']],
  ['Dodge', ['dodgeBuffTotal']],
  ['Wound', ['woundBuffTotal']],
  ['Combat Rolls', ['strikeBuffTotal', 'dodgeBuffTotal', 'woundBuffTotal']],
  ['Strike (Physical)', ['strikePhysical']],
  ['Strike (Energy)', ['strikeEnergy']],
  ['Strike (Magic)', ['strikeMagic']],
  ['Wound (Physical)', ['woundPhysical']],
  ['Wound (Energy)', ['woundEnergy']],
  ['Wound (Magic)', ['woundMagic']],
  ['Strike CT (All)', ['strikeCTBonus']],
  ['Wound CT (All)', ['woundCTBonus']],
  ['Dodge CT', ['dodgeCTBonus']],
  ['Strike CT (Physical)', ['strikeCTPhysical']],
  ['Strike CT (Energy)', ['strikeCTEnergy']],
  ['Strike CT (Magic)', ['strikeCTMagic']],
  ['Wound CT (Physical)', ['woundCTPhysical']],
  ['Wound CT (Energy)', ['woundCTEnergy']],
  ['Wound CT (Magic)', ['woundCTMagic']],
  ['Defense Value', ['defenseValue']],
  ['Haste', ['haste']],
  ['Awareness', ['awareness']],
  ['Initiative', ['initiative']],
  ['Stress Bonus', ['stressBonus']],
  ['Might for Clashes', ['mightForClashes']],
  ['Attacking Damage Category', ['attackingDamageCategory']],
  ['Ki Point Cost Attacks', ['kiCostAttacks']],
  ['Ki Point Cost Attacks (no cap)', ['kiCostAttacksNoCap']],
].map(([effect, fields]) => [buffEffectKey(effect), fields]));
const conditionalStatus = new Map([
  ['soak', 'soak'], ['damage reduction', 'damageReduction'], ['might', 'might'],
]);
const conditionalSaves = new Map([
  ['all saves', ['impulsive', 'corporeal', 'cognitive', 'morale']],
  ...['impulsive', 'corporeal', 'cognitive', 'morale'].map(save => [`${save} saves`, [save]]),
]);

export const catalogBuffFlag = 'catalogBuffs';
export const catalogBuffSystem = 'DBU-MRR-OLD';
export const catalogBuffGroups = Object.freeze({ traits: 'racialTraits', talents: 'talents' });
export const buffTriggers = Object.freeze({
  always: 'Sempre',
  lpBelow: 'LP abaixo de (%)',
  raging: 'Em Raging',
  superior: 'Em Superior',
  surging: 'Em Surging',
  mindful: 'Em Mindful',
  undying: 'Em Undying',
  fatigued: 'Com Fatigued',
  slowed: 'Com Slowed',
  impaired: 'Com Impaired',
});

export function linkedCatalogBuffs(actor, system = actor.system) {
  const out = [];
  const saved = actor.getFlag?.(catalogBuffSystem, catalogBuffFlag);
  for (const [group, list] of Object.entries(catalogBuffGroups)) {
    for (const id of new Set(system[list] || [])) {
      if (Array.isArray(saved?.[group]?.[id])) out.push(...saved[group][id]);
    }
  }
  return out;
}

export function conditionalBuff(buff) {
  return !!buff.trigger && buff.trigger !== 'always';
}

export function supportsBuffTrigger(effect) {
  const key = buffEffectKey(effect);
  return conditionalAptitudes.has(key) || conditionalStatus.has(key) || conditionalSaves.has(key);
}

export function customBuffState(buff, system) {
  if (!buff.active) return 'disabled';
  if (manualBuffEffect(buff.effect)) return 'manual';
  if (!buffEffectKey(buff.effect)) return 'missing';
  if (!conditionalBuff(buff)) return 'active';
  if (!supportsBuffTrigger(buff.effect) || !Object.hasOwn(buffTriggers, buff.trigger)) return 'unsupported';
  if (buff.trigger === 'lpBelow') {
    const { value, max } = system.lifePoints || {};
    const limit = Number(buff.triggerPercent ?? 50);
    return Number.isFinite(value) && max > 0 && limit >= 0 && limit <= 100 && value * 100 < max * limit
      ? 'active' : 'waiting';
  }
  return (system.combatStates?.[buff.trigger] || system.conditions?.some(c => c.id === buff.trigger && c.active))
    ? 'active' : 'waiting';
}

export const buffStateLabels = Object.freeze({
  active: 'Ativo', waiting: 'Aguardando condição', disabled: 'Desativado',
  manual: 'Aplicação manual', unsupported: 'Efeito incompatível com condição', missing: 'Escolha um efeito',
});

export function applyConditionalCustomBuffs(system, buffs) {
  const statusDeltas = {};
  const aptDeltas = {};
  for (const buff of buffs) {
    if (!conditionalBuff(buff) || customBuffState(buff, system) !== 'active') continue;
    const key = buffEffectKey(buff.effect);
    const amount = buffAmount(buff, system.tier || 1, system.baseTier || 1);
    for (const field of conditionalAptitudes.get(key) || []) {
      aptDeltas[field] = (aptDeltas[field] || 0) + amount;
    }
    const field = conditionalStatus.get(key);
    if (field) statusDeltas[field] = (statusDeltas[field] || 0) + amount;
    for (const save of conditionalSaves.get(key) || []) {
      if (system.savingThrows?.[save]) system.savingThrows[save].bonus += amount;
    }
  }
  for (const [field, amount] of Object.entries(aptDeltas)) {
    const total = (system.aptitudes[field] || 0) + amount;
    system.aptitudes[field] = field === 'defenseValue' ? Math.max(0, total) : total;
  }
  for (const [field, amount] of Object.entries(statusDeltas)) {
    if (field === 'soak' && system.status.rawSoak != null) {
      const minimum = system.tier || 1;
      const before = Math.max(minimum, system.status.rawSoak);
      system.status.rawSoak += amount;
      const after = Math.max(minimum, system.status.rawSoak);
      system.status.soak = Math.max(0, system.status.soak + after - before);
    } else {
      system.status[field] = Math.max(0, (system.status[field] || 0) + amount);
    }
  }
}
