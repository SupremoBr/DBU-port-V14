import { SUPER_PROFILES_093, superProfileKiUnits093 } from "./super-profiles-v093.mjs";
import { limitedMartialPower, martialEnergyCharges, martialLevel } from './path-to-power-v093.mjs';
import { techniquePointCost, techniqueBaseKiUnits } from './v093.mjs';
import { PROFILES_093, validFoundation } from './profiles-v093.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';

export function modifierPointCost(definition, ranks = 1) {
  if (!definition) return null;
  const count = Math.trunc(Number(ranks));
  if (count < 1 || count > definition.maxRanks) return null;
  return Array.isArray(definition.tpPerRank)
    ? definition.tpPerRank.slice(0, count).reduce((a, b) => a + b, 0)
    : definition.tpPerRank * count;
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
  technique = martialTechnique(technique, system);
  const issues = [];
  if (technique.isLimitBreak) issues.push('Limit Break legado exige revisão; não equivale automaticamente a Dramatic Finisher.');
  const dramatic = /dramatic[ _-]*finisher/i.test(String(technique.type ?? technique.techType));
  if (dramatic && !technique.superProfile) issues.push('Dramatic Finisher exige um Super Profile.');
  if (technique.superProfile) {
    const profile = SUPER_PROFILES_093[technique.superProfile];
    if (superProfileKiUnits093(technique) === null) issues.push('Super Profile ou configuração inválida.');
    if (!dramatic && !technique.superProfileGranted) issues.push('Super Profile exige Dramatic Finisher ou um efeito que o conceda.');
    if (profile?.requiresProfile && technique.profile !== profile.requiresProfile) issues.push('Super Profile exige '+profile.requiresProfile+'.');
  }
  if (limitedMartialPower(system)) {
    const cap = martialTechniqueTPCap(technique, system);
    if (techniquePointCost(technique) > cap) issues.push(`Path to Power: esta técnica pode gastar até ${cap} TP.`);
  }
  if (!validFoundation(technique.profile, technique.foundation)) issues.push('Perfil incompatível ou removido: ' + technique.profile);
  for (const [field, definitions] of [['advantages', CATALOGS_093.advantages], ['disadvantages', CATALOGS_093.disadvantages]]) {
    for (const row of technique[field] || []) {
      const cost = modifierPointCost(definitions[row.name], row.ranks ?? 1);
      if (cost === null) issues.push('Revisar ' + field + ': ' + row.name);
      else if (cost !== Number(row.tpCost)) issues.push('Custo TP desatualizado: ' + row.name);
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
  const discount = Math.max(0, Number(usageDiscount) || 0) + (profile.signatureKiDiscount || 0);
  const surcharge = Math.max(0, Number(usageSurcharge) || 0);
  return { ...validation, profileBaseKP, tpFull, kpCost, creationKP, kpReduction: efficiency + discount, kpIncrease: inefficiency + surcharge, finalKP: Math.max(profileBaseKP / 2, creationKP - discount) + surcharge };
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
