import { martialEnergyCharges } from "./path-to-power-v093.mjs";
import { PROFILES_093 } from "./profiles-v093.mjs";
export function stateLevel(system, key) {
  if (!system?.combatStates?.[key]) return 0;
  return system.rulesVersion === '0.9.3' ? Math.min(3, Math.max(1, Number(system.combatStates[key + 'Level']) || 1)) : 1;
}
export function ragingBotch(system) {
  return 1 + (system.rulesVersion === '0.9.3' ? stateLevel(system, 'raging') : 0);
}

export function surgingTargetsAllowed093(system, targetKeys, area) {
  if (system.rulesVersion !== "0.9.3" || !system.combatStates?.surging) return true;
  const focus = system.combatStates.surgingFocus;
  return !!focus && targetKeys.includes(focus) && (area || targetKeys.every(key => key === focus));
}

export function surgingCharge093(system, source) {
  if (system.rulesVersion !== "0.9.3" || !system.combatStates?.surging) return 0;
  const profile = PROFILES_093[source.profile];
  const cap = martialEnergyCharges(system, (profile?.chargeLimit || 7) + (profile?.freeChargesOutsideLimit || 0));
  return Number(source.energyCharges || 0) < cap ? 1 : 0;
}
