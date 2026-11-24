import { racialEffectEnabled093 } from './runtime-v093.mjs';

const thresholds = [['bruised', 2], ['injured', 4], ['critical', 10]];

export function healthThresholdChanges093(system, nextLP, damage, eventId) {
  const active = thresholds.filter(([key]) => !system._minionThresholdsNA || key === 'injured');
  const crossed = active.filter(([key]) => {
    const limit = system.thresholds[key].value;
    return system.lifePoints.value > limit && nextLP <= limit;
  });
  const lowest = crossed.at(-1)?.[0];
  const massive = crossed.length > 1;
  const defeated = damage === 'attack' && nextLP <= 0 && massive;
  const changes = {};
  for (const [key] of active) {
    const threshold = system.thresholds[key];
    if (nextLP > threshold.value && (threshold.checked || threshold.steadfast)) {
      changes[key] = { checked: false, steadfast: '' };
      continue;
    }
    if (!crossed.some(([crossedKey]) => crossedKey === key)) continue;
    const saved = key === 'bruised' && racialEffectEnabled093(system, 'Saiyan Heritage');
    const review = (!damage && massive) || nextLP <= 0;
    const automatic = defeated || (!review && massive && key !== lowest);
    const kind = review ? 'review' : massive ? 'massive' : 'pending';
    changes[key] = { checked: saved, steadfast: saved ? '' : automatic ? 'automatic' : `${kind}:${eventId}` };
  }
  return changes;
}

export function pendingSteadfast093(threshold) {
  return !!threshold?.steadfast?.includes(':');
}
