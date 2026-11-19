/** Racial creation facts from each current official race page. */
const race = (name, slug, life, saves, skills, fixed, choices = [], extra = {}) => ({
  name, source: `https://dbu-rpg.com/${slug}/`, life, saves, skills,
  attributes: { fixed, choices }, ...extra
});
const choice = (amount, attributes, count = 1) => ({ amount, attributes, count });
const ALL = ['ag', 'fo', 'te', 'sc', 'in', 'ma', 'pe'];
export const RACES_093 = Object.freeze({
  android: race('Android', 'androids', 4, ['cognitive'], 3, { fo: 2, te: 2, in: 1 }),
  angel: race('Angel', 'angels', 4, ['impulsive'], 6, { in: 2, ag: 2, te: 1 }, [], { canBeMinion: false }),
  arcosian: race('Arcosian', 'arcosians', 5, ['corporeal'], 2, { te: 2, ag: 2, fo: 1 }),
  bioAndroid: race('Bio-Android', 'bio-android', 3, ['corporeal'], 3, {}, [choice(2, ALL, 2), choice(1, ALL)], { forbiddenAttributePairs: [['fo', 'ma']] }),
  cerealian: race('Cerealian', 'cerealians', 3, ['impulsive'], 3, { in: 2, ag: 2 }, [choice(1, ['fo', 'ma'])]),
  demon: race('Demon', 'demons', 4, ['cognitive'], 3, { in: 2, pe: 1 }, [choice(2, ['fo', 'ma'])]),
  earthling: race('Earthling', 'earthlings', 4, ['morale'], 4, { in: 2 }, [choice(2, ['ag', 'te']), choice(1, ['sc', 'pe'])]),
  glassTribe: race('Glass Tribe', 'glass-tribe', 2, ['corporeal'], 4, { in: 2, te: 2 }, [choice(1, ['fo', 'ma'])]),
  heran: race('Heran', 'herans', 2, ['corporeal'], 3, { te: 2, in: 1 }, [choice(2, ['fo', 'ma'])]),
  konatsian: race('Konatsian', 'konatsians', 3, ['morale'], 3, { in: 2, pe: 2, ag: 1 }),
  majin: race('Majin', 'majins', 3, ['morale'], 2, { pe: 2, te: 1 }, [choice(2, ['fo', 'ma'])]),
  namekian: race('Namekian', 'namekians', 5, ['corporeal'], 3, { te: 2, in: 2 }, [choice(1, ['fo', 'ma'])]),
  nekoMajin: race('Neko Majin', 'neko-majins', 4, ['cognitive', 'morale'], 3, { pe: 2 }, [choice(2, ['fo', 'ma']), choice(1, ['te', 'in'])]),
  neoTuffle: race('Neo-Tuffle', 'neo-tuffles', 4, ['cognitive'], 3, { te: 2, in: 2 }, [choice(1, ['sc', 'pe'])]),
  saiyan: race('Saiyan', 'saiyans', 3, ['corporeal'], 2, { fo: 2, te: 2, ag: 1 }),
  shadowDragon: race('Shadow Dragon', 'shadow-dragons', 7, ['morale'], 2, { te: 2, pe: 1 }, [choice(2, ['fo', 'ma'])]),
  shinjin: race('Shinjin', 'shinjin', 4, ['cognitive'], 2, { in: 2 }, [choice(2, ['fo', 'ma']), choice(1, ALL)]),
  yardrat: race('Yardrat', 'yardrats', 1, ['cognitive', 'impulsive'], 3, { in: 2, ag: 2 }, [choice(1, ['sc', 'pe'])]),
  customSpecies: race('Custom Species', 'custom-species', 3, [], 2, {}, [choice(2, ALL, 2), choice(1, ALL)], { chooseSave: true })
});

/** Check allocations, do not guess choices when converting an old character. */
export function validateRacialAttributes(raceId, attributes) {
  const definition = RACES_093[raceId];
  if (!definition) return { ok: false, reason: 'unknown-race' };
  const actual = Object.fromEntries(ALL.map(key => [key, Number(attributes?.[key]?.racial ?? attributes?.[key] ?? 0)]));
  for (const [key, amount] of Object.entries(definition.attributes.fixed)) {
    if (actual[key] !== amount) return { ok: false, reason: 'fixed-attributes' };
  }
  const used = new Set(Object.keys(definition.attributes.fixed));
  const slots = definition.attributes.choices.flatMap(c => Array.from({ length: c.count }, () => c));
  function assign(index) {
    if (index === slots.length) return ALL.every(key => used.has(key) || actual[key] === 0);
    const slot = slots[index];
    for (const key of slot.attributes) {
      if (used.has(key) || actual[key] !== slot.amount) continue;
      used.add(key);
      if (assign(index + 1)) return true;
      used.delete(key);
    }
    return false;
  }
  if (!assign(0)) return { ok: false, reason: 'attribute-choices' };
  for (const pair of definition.forbiddenAttributePairs || []) {
    if (pair.every(key => actual[key] > 0)) return { ok: false, reason: 'forbidden-pair' };
  }
  return { ok: true };
}
