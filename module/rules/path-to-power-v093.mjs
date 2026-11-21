import { uses093 } from './v093.mjs';

const minimumMartialLevel = { 1: 5, 2: 1, 3: 1, 4: 2, 5: 4, 6: 1, 7: 1, 8: 1, 9: 2, 10: 3, 11: 1 };
const extraRows = [
  { id: -2, level: 1, perkType: 'martial_rank', martialLevel: 2 },
  { id: -4, level: 1, perkType: 'martial_rank', martialLevel: 4 },
  { id: -5, level: 1, perkType: 'attribute_addition', martialLevel: 4 }
];
const attributes = ['ag', 'fo', 'te', 'sc', 'in', 'ma', 'pe'];

export function usesPathToPower(system) {
  return uses093(system) && system.pathToPower?.enabled && !system.minion?.enabled;
}

export function martialLevel(system) {
  if (!usesPathToPower(system) || Number(system.level || 1) > 1) return 0;
  return Math.min(5, Math.max(1, Math.trunc(Number(system.pathToPower.martialLevel) || 1)));
}

export function martialDie(system) {
  const masterLevel = system._masterMartialLevel || (system._masterMartialRemnant ? 5 : 0);
  const level = system.minion?.enabled ? Math.max(0, masterLevel - 1)
    : martialLevel(system) || (usesPathToPower(system) && system.pathToPower.remnant ? 5 : 0);
  return [0, 0, 4, 6, 8, 10][level];
}

export function martialResourcePenalty(system) {
  const level = martialLevel(system) || system._masterMartialLevel;
  return level ? (5 - level) * 5 : 0;
}

export function limitedMartialPower(system) {
  const level = martialLevel(system);
  return level > 0 && level <= 4;
}

export function martialEnergyCharges(system, charges) {
  return limitedMartialPower(system) ? Math.min(3, charges) : charges;
}

export function awakeningAMB(system, transformation, bonus) {
  return limitedMartialPower(system) && transformation.transformationType === 'manifested_power'
    ? Math.max(0, bonus - 1) : bonus;
}

export function martialRowLevel(row) {
  return extraRows.find(extra => extra.id === row.id)?.martialLevel
    ?? minimumMartialLevel[row.id] ?? 0;
}

export function martialProgressionRows(system, rows) {
  if (!usesPathToPower(system)) return rows;
  return [...rows, ...extraRows.filter(extra => !rows.some(row => row.id === extra.id))];
}

export function progressionRowIsEarned(system, row) {
  if (row.perkType === 'racial_stats' || Number(row.level || 1) > Number(system.level || 1)) return false;
  if (!usesPathToPower(system)) return row.id >= 0 || row.id == null;
  return Number(row.level) !== 1 || martialRowLevel(row) <= (martialLevel(system) || 5);
}

export function martialSkillSlots(row, racialRanks) {
  if (row.perkType === 'starting_stats') return racialRanks;
  if (row.perkType === 'skill_improvement') return 4;
  return row.perkType === 'martial_rank' ? 1 : 0;
}

export function martialAttributeBudget(system, row) {
  if (!usesPathToPower(system) || Number(row.level) !== 1 || row.perkType !== 'attribute_addition') return null;
  return row.id === 9 || row.id === -5 ? 1 : 2;
}

export function validMartialAttributes(system, row) {
  const budget = martialAttributeBudget(system, row);
  if (budget === null) return true;
  const allocated = attributes.map(key => Number(row[key]) || 0);
  return allocated.every(amount => Number.isInteger(amount) && amount >= 0)
    && allocated.reduce((sum, amount) => sum + amount, 0) <= budget;
}

export function martialAttributeWarnings(system, rows) {
  return rows.filter(row => !validMartialAttributes(system, row))
    .map(row => `Distribua até ${martialAttributeBudget(system, row)} ponto(s) na linha de atributos do ML ${martialRowLevel(row) || 1}.`);
}
