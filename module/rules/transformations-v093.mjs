import { CATALOGS_093 } from './catalogs-v093.mjs';
export function legendRealizedKey093(transformation) {
  if (!['form_alternate','form_legendary'].includes(transformation?.transformationType)) return null;
  return transformation.transformationType + ':' + String(transformation.tierRequirement).trim();
}
export function legendRealizedAvailable093(actor, trans) {
  if (!trans?.active || !actor.system.transformationMeta?.enteredViaManeuver093?.includes(trans.id)) return false;
  const key = legendRealizedKey093(trans);
  return !!key && !(actor.system.rules093State?.legendRealizedGroups || []).includes(key);
}
export async function applyLegendRealized093(actor, trans, { RollClass = globalThis.Roll } = {}) {
  if (!legendRealizedAvailable093(actor, trans)) return false;
  const roll = await new RollClass(`${2 * (actor.system.tier || 1)}d10+${actor.system.level || 1}`).evaluate();
  const nlop = actor.system.transformationMeta?.nlopActiveEncounter?.includes(trans.name);
  const recovery = roll.total * (nlop ? 2 : 1);
  const names = [...(actor.system.transformationMeta?.legendRealizedUsed || []), trans.name];
  const groups = [...(actor.system.rules093State?.legendRealizedGroups || []), legendRealizedKey093(trans)];
  await actor.update({ 'system.lifePoints.value': Math.min(actor.system.lifePoints.max, actor.system.lifePoints.value + recovery), 'system.kiPool.value': Math.min(actor.system.kiPool.max, actor.system.kiPool.value + recovery), 'system.rules093State.legendRealizedGroups': groups, 'system.transformationMeta.legendRealizedUsed': [...new Set(names)] });
  await roll.toMessage?.({ speaker: globalThis.ChatMessage?.getSpeaker({ actor }), flavor: 'Legend Realized — DBU 0.9.3' });
  return true;
}
export async function newLevelOfPower093(actor, trans) {
  const meta = actor.system.transformationMeta || {};
  if (!trans?.active || trans.temporaryAwakening || actor.system.rules093State?.temporaryAwakenings?.includes(trans.id)) return { ok: false, reason: 'Exige transformação ativa permanente.' };
  if (meta.newLevelOfPowerUsed?.includes(trans.name)) return { ok: false, reason: 'New Level of Power já usado para essa transformação na campanha.' };
  if ((meta.nlopActiveEncounter || []).some(name => actor.system.transformations?.some(t => t.active && t.name === name))) return { ok: false, reason: 'Somente um New Level of Power pode beneficiar o personagem de cada vez.' };
  const update = { 'system.transformationMeta.newLevelOfPowerUsed': [...(meta.newLevelOfPowerUsed || []), trans.name], 'system.transformationMeta.nlopActiveEncounter': [trans.name] };
  if (trans.transformationType === 'manifested_power') {
    update['system.lifePoints.value'] = Math.min(actor.system.lifePoints.max, actor.system.lifePoints.value + Math.floor(actor.system.lifePoints.max / 2));
    update['system.kiPool.value'] = Math.min(actor.system.kiPool.max, actor.system.kiPool.value + Math.floor(actor.system.kiPool.max / 2));
  }
  if (trans.transformationType?.startsWith('enhancement')) update['system.rules093State.burstLimitExtraUsed'] = false;
  await actor.update(update);
  return { ok: true };
}
export function requiresTransformationReview093(trans) {
  const entry = CATALOGS_093.transformations[trans?.catalogKey];
  if (!entry) return false;
  if (!/^\d+$/.test(entry.stressFormula) && !(Number(trans.stressTest) > 0)) return true;
  return Object.values(trans.attrBonuses || {}).some(v => !/^(?:[-–—]|\+?\d+(?:\((?:T|bT)\))?|)$/.test(String(v).trim()));
}
