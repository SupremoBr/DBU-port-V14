/** Current Defend costs are independent of temporary Tier increases. */
export function defendKiCost093(system, option, incomingCharges = 0) {
  if (option !== 'guard') return 0;
  const tier = Math.max(1, Number(system.baseTier) || 1);
  const extra = Math.min(4, Math.max(0, Number(incomingCharges) || 0));
  let cost = (8 + extra) * tier;
  cost = Math.max(0, cost - (Number(system.aptitudes?.guardKPReduction) || 0));
  if (system.conditions?.some(c => c.id === 'guardDown' && c.active)) cost = Math.floor(cost * 1.5);
  return cost;
}
