import { attackWeapon093 } from '../helpers/weapon-state.mjs';
import { SUPER_PROFILES_093, superProfileKiUnits093 } from "./super-profiles-v093.mjs";
import { limitedMartialPower, martialEnergyCharges, martialLevel } from './path-to-power-v093.mjs';
import { isLegacyLimitBreakType, modifierPointCost, techniquePointCap, techniquePointCost, techniqueBaseKiUnits } from './v093.mjs';
import { PROFILES_093, validFoundation } from './profiles-v093.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';
import { talentPassiveBonus093 } from './talent-passives-v093.mjs';
import { attackKiWithBuffs } from '../helpers/custom-buffs.mjs';

export { modifierPointCost };

export function grantedAdvantageRanks093(attack, name) {
  const row = (attack.grantedAdvantages || []).find(advantage => advantage.name === name);
  return row ? Math.max(0, Math.min(CATALOGS_093.advantages[name]?.maxRanks || 0, Math.trunc(Number(row.ranks) || 1))) : 0;
}

export function attackPowerShot093(attack) {
  return Math.max(Number(attack.powerShot) || 0, grantedAdvantageRanks093(attack, 'Power Shot'));
}

export function attackReferenceKiCost093(attack, system, aura, weapon) {
  const tier = system.baseTier || 1;
  const profileCost = (PROFILES_093[attack.profile]?.kpCost || 0) * tier;
  const tiring = (aura?.disadvantages || []).filter(row => row.name === 'Tiring')
    .reduce((total, row) => total + (row.ranks || 1), 0);
  const efficiency = grantedAdvantageRanks093(attack, 'Efficiency');
  const legacyFist = (system.talents || []).includes('supreme_fist') && attack.foundation === 'Physical' && !weapon;
  const weaponDiscount = weapon?.system.weaponCategory === 'efficient' || (attack.foundation === 'Magic' && system._magicStaff093) ? 2 * tier : 0;
  const base = legacyFist ? Math.max(0, profileCost - 2 * tier) : profileCost;
  return attackKiWithBuffs(base - weaponDiscount + (tiring - 4 * efficiency) * tier, profileCost / 2, system.aptitudes);
}
export function martialTechnique(technique, system) {
  return limitedMartialPower(system) ? { ...technique, type: 'Super Signature' } : technique;
}
export function startingTechniqueAvailable093(system) {
  const level = martialLevel(system);
  return level === 0 || level >= 3;
}
export function martialTechniqueTPCap(technique, system, normalCap) {
  if (!limitedMartialPower(system)) return normalCap;
  return technique.startingTechnique && startingTechniqueAvailable093(system) ? 20 : 15;
}
export function validateTechnique093(technique, system) {
  const legacyType = isLegacyLimitBreakType(technique.type ?? technique.techType);
  technique = martialTechnique(technique, system);
  const issues = [];
  if (legacyType && !limitedMartialPower(system)) issues.push('Selecione um tipo de Signature Technique da 0.9.3.');
  const dramatic = /dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType));
  if (dramatic && !technique.superProfile) issues.push('Dramatic Finisher exige um Super Profile.');
  if (technique.superProfile) {
    const profile = SUPER_PROFILES_093[technique.superProfile];
    if (superProfileKiUnits093(technique) === null) issues.push('Super Profile ou configuração inválida.');
    if (!dramatic && !technique.superProfileGranted) issues.push('Super Profile exige Dramatic Finisher ou um efeito que o conceda.');
    if (profile?.requiresProfile && technique.profile !== profile.requiresProfile) issues.push('Super Profile exige '+profile.requiresProfile+'.');
  }
  const cap = martialTechniqueTPCap(technique, system, techniquePointCap(system?.baseTier));
  if (techniquePointCost(technique, { includeFreeTP: false }) > cap) {
    issues.push(`${limitedMartialPower(system) ? "Path to Power: " : ""}esta técnica pode ter até ${cap} TP no total.`);
  }
  if (!validFoundation(technique.profile, technique.foundation)) issues.push('Perfil incompatível ou removido: ' + technique.profile);
  const advantages = new Map((technique.advantages || []).map(row => [row.name, row]));
  const disadvantages = new Map((technique.disadvantages || []).map(row => [row.name, row]));
  const conflicts = [
    [advantages, 'Efficiency', disadvantages, 'Inefficiency'],
    [advantages, 'Accurate', disadvantages, 'Inaccurate'],
    [advantages, 'Power Shot', disadvantages, 'Low Penetration'],
    [advantages, 'Penetration', disadvantages, 'Low Penetration'],
    [advantages, 'Pinpoint Precision', advantages, 'Concentrated Strike'],
    [disadvantages, 'Distant Explosion', disadvantages, 'Self-Explosion'],
    [disadvantages, 'Lead Up', disadvantages, 'Mandatory Charge'],
    [disadvantages, 'Special Set Up', disadvantages, 'Mandatory Charge'],
    [disadvantages, 'Special Set Up', disadvantages, 'Lead Up'],
    [disadvantages, 'Restricted – Transformation', disadvantages, 'Restricted – Untransformed'],
    [advantages, 'Terrain Destruction', disadvantages, 'Small Scale Blast'],
    [advantages, 'Two-Step Strike', disadvantages, 'Concentration']
  ];
  for (const [first, a, second, b] of conflicts) {
    if (first.has(a) && second.has(b)) issues.push(`${a} é incompatível com ${b}.`);
  }
  const dependencies = [
    [advantages, 'Express Ticket', advantages, 'Charging Assault'],
    [advantages, 'High-Speed Dash', advantages, 'Hit and Run'],
    [advantages, 'Rebound', advantages, 'Homing'],
    [advantages, 'Low Stakes Attack', advantages, 'Fake Out'],
    [advantages, 'Hefty Stagger', advantages, 'Staggering Attack'],
    [advantages, 'Personal Bomb', advantages, 'Delayed'],
    [advantages, 'Terrain Slam', advantages, 'Powerbomb'],
    [advantages, 'Powerbomb', disadvantages, 'Grappling'],
    [advantages, 'Transformation Flare', disadvantages, 'Restricted – Untransformed'],
    [disadvantages, 'Required Counter', advantages, 'Counter'],
    [disadvantages, 'Short Delay', advantages, 'Delayed'],
    [disadvantages, 'Recoil', advantages, 'Hit and Run'],
    [disadvantages, 'Restricted – Weapon', advantages, 'Weapon Assisted']
  ];
  for (const [group, name, requiredGroup, required] of dependencies) {
    if (group.has(name) && !requiredGroup.has(required)) issues.push(`${name} exige ${required}.`);
  }
  if (technique.isWeapon && !advantages.has('Weapon Assisted')) issues.push('Técnicas armadas exigem Weapon Assisted.');
  if (disadvantages.has('Low-Power Crush') && technique.profile !== 'Crushing') {
    issues.push('Low-Power Crush exige o perfil Crushing.');
  }
  const chosenRoll = row => String(row?.notes || '').trim().toLowerCase();
  const twin = chosenRoll(advantages.get('Twin-Linked'));
  if (['strike', 'wound'].includes(twin) && twin === chosenRoll(disadvantages.get('Dead-Link'))) {
    issues.push('Twin-Linked e Dead-Link não podem alterar a mesma rolagem.');
  }
  for (const [field, definitions] of [['advantages', CATALOGS_093.advantages], ['disadvantages', CATALOGS_093.disadvantages]]) {
    const seen = new Set();
    for (const row of technique[field] || []) {
      if (row.name && seen.has(row.name)) issues.push('Use uma única linha para os ranks de ' + row.name + '.');
      seen.add(row.name);
      const cost = modifierPointCost(definitions[row.name], row.ranks ?? 1);
      if (cost === null) issues.push('Revisar ' + field + ': ' + row.name);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function startingTechniqueEligible093(technique, system) {
  if (!startingTechniqueAvailable093(system)) return false;
  technique = martialTechnique(technique, system);
  return !/dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType))
    && techniquePointCost(technique, { includeFreeTP: false }) <= 20
    && validateTechnique093({ ...technique, startingTechnique: true }, system).ok;
}
/** Creation reductions stop at the full Profile floor. Usage reductions have a half-Profile floor. */
export function techniqueKiCost093(technique, { usageDiscount = 0, usageSurcharge = 0, system } = {}) {
  technique = martialTechnique(technique, system);
  const validation = validateTechnique093(technique, system);
  if (!validation.ok) return { ...validation, finalKP: null, profileBaseKP: null, kpCost: null, tpFull: techniquePointCost(technique, { includeFreeTP: false }), kpReduction: 0, kpIncrease: 0 };
  const profile = PROFILES_093[technique.profile];
  const profileBaseKP = profile.kpCost + superProfileKiUnits093(technique);
  const tpFull = techniquePointCost(technique, { includeFreeTP: false });
  const kpCost = techniqueBaseKiUnits(technique, profileBaseKP);
  const efficiency = (technique.advantages || []).filter(a => a.name === 'Efficiency').reduce((n, a) => n + 4 * (a.ranks || 1), 0);
  const inefficiency = (technique.disadvantages || []).filter(a => a.name === 'Inefficiency').reduce((n, a) => n + 4 * (a.ranks || 1), 0);
  const creationKP = Math.max(profileBaseKP, kpCost - efficiency + inefficiency);
  const physicalDiscount = technique.foundation === 'Physical' ? talentPassiveBonus093(system, 'physicalSignatureKiDiscount') : 0;
  const discount = Math.max(0, Number(usageDiscount) || 0) + (profile.signatureKiDiscount || 0) + physicalDiscount
    + (technique.foundation === 'Magic' && system?._magicStaff093 ? 2 : 0);
  const surcharge = Math.max(0, Number(usageSurcharge) || 0);
  return { ...validation, profileBaseKP, tpFull, kpCost, creationKP, kpReduction: efficiency + discount, kpIncrease: inefficiency + surcharge, finalKP: Math.max(profileBaseKP / 2, creationKP - discount) + surcharge };
}

export function signatureUseIssue093(actor, technique) {
  const { system } = actor;
  if (technique.isWeapon) {
    const { item, issue } = attackWeapon093(actor, technique);
    if (issue) return issue;
    if (!item) return 'Selecione a arma usada nesta técnica.';
  }
  const climax = (technique.disadvantages || []).find(row => row.name === 'Climax Attack');
  if (climax) {
    const threshold = ['bruised', 'injured', 'critical'][(climax.ranks || 1) - 1];
    if (!system.thresholds?.[threshold]?.crossed) return `Climax Attack exige o limiar ${threshold}.`;
  }
  return '';
}

export function validateTechniqueUsage093(actor, technique, { excludeIndex = -1 } = {}) {
  const source = 'tech_' + technique.id;
  const rounds = actor.system.combatTabState?.rounds || [];
  const current = rounds.at(-1);
  const limited = limitedMartialPower(actor.system);
  if (!limited && /dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType)) && (actor.system.signatureTechniques || []).filter(t => /dramatic[ _-]*finisher/i.test(String(t.type ?? t.techType))).length > 1) return { ok: false, reason: 'Somente um Dramatic Finisher por personagem.' };
  const other = (current?.actions || []).filter((r,i) => i !== excludeIndex && r.source?.startsWith('tech_') && !r.dbuOutsideCombat);
  if (other.length) return { ok: false, reason: 'Signature Technique Maneuver: uma vez por rodada.' };
  if (limited) {
    const used = rounds.some(round => (round.actions || []).some((action, index) =>
      !(round === current && index === excludeIndex) && !action.dbuOutsideCombat && action.source === source
    ));
    return used ? { ok: false, reason: 'Path to Power: esta Signature já foi usada neste encontro.' } : { ok: true };
  }
  const ultimate = /ultimate|dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType));
  if (ultimate) {
    const own = actor.system.signatureTechniques || [];
    const isUltimate = t => /ultimate|dramatic[ _-]*finisher/i.test(String(t.type ?? t.techType));
    const keys = new Set(own.filter(isUltimate).map(t => 'tech_'+t.id));
    const declared = rounds.flatMap(r => (r.actions || []).filter((a,i) => !(r === current && i === excludeIndex) && !a.dbuOutsideCombat && keys.has(a.source)));
    if (declared.some(a => a.source === source)) return { ok: false, reason: 'Esta Ultimate já foi usada neste encontro.' };
    if (declared.length >= 3) return { ok: false, reason: 'Limite de três Ultimates por encontro.' };
  }
  return { ok: true };
}
export function signatureEnergyCharges093(technique, system) {
  technique = martialTechnique(technique, system);
  const profile = PROFILES_093[technique.profile];
  const ultimate = /ultimate|dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType));
  const charges = Math.max(0, Number(technique.baseEnergyCharges) || 0) + Math.max(0, Number(technique.extraEnergyCharges) || 0)
    + (ultimate ? Number(system.thresholds?.crossedCount) || 0 : 0) + (profile?.freeCharges || 0) + (profile?.freeChargesOutsideLimit || 0);
  return martialEnergyCharges(system, charges);
}
export function maximumWager093(actor, technique, kiCost = 0) {
  const system = actor.system, max = Math.max(0, Number(system.status?.maxCapacity ?? system.capacity?.max) || 0);
  const remaining = Math.max(0, max - (Number(system.status?.capacitySpent) || 0) - kiCost);
  const full = technique?.advantages?.some(a => a.name === 'Full Wager') || technique?.profile === 'Elemental (Light)';
  return Math.max(0, Math.min(full ? remaining : Math.floor(max / 2), remaining, (Number(system.kiPool?.value) || 0) - kiCost));
}
