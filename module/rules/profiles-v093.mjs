export const PROFILE_SOURCE = 'https://dbu-rpg.com/foundations-profiles/';
const profile = (foundations, damageCat, kpCost, extra = {}) => ({ foundations, damageCat, kpCost, source: PROFILE_SOURCE, ...extra });
const ALL = ['Physical', 'Energy', 'Magic'];
export const PROFILES_093 = Object.freeze({
  Simple: profile(ALL, 'Standard', 0, { startingTP: 4 }),
  Combination: profile(ALL, 'Standard', 3, { additionalStrikeChecks: 3, woundPerAdditionalHit: 2 }),
  Launching: profile(ALL, 'Standard', 3, { freeAdvantages: ['Knockback'], collisionMultiplier: 2 }),
  'Mega Flare': profile(ALL, 'Standard', 4, { chargeLimit: 10, woundPerCharge: 1, lethalCharges: 7 }),
  Blitz: profile(['Physical'], 'Standard', 4, { freeAdvantages: ['Charging Assault'], signatureKiDiscount: 2 }),
  Crushing: profile(['Physical'], 'Lethal', 6, { hasteMultiplier: 0.5 }),
  Pinpoint: profile(['Physical'], 'Standard', 4, { ignoreSoakAttribute: 'in', doubleInsightOnStrikeCrit: true }),
  Powered: profile(['Physical'], 'Standard', 8, { extraDamageAttribute: 1, freeCharges: 1 }),
  Soaring: profile(['Physical'], 'Direct', 5, { area: { type: 'line', magnitude: 'Standard' } }),
  Sweeping: profile(['Physical'], 'Standard', 4, { area: { type: 'sphere', magnitude: 'Minor', centeredOnSelf: true }, excludeAllies: true, diminishingDefenseMultiplier: 2 }),
  Beam: profile(['Energy'], 'Direct', 8, { freeChargesOutsideLimit: 1 }),
  Blast: profile(['Energy'], 'Direct', 5, { area: { type: 'cone' } }),
  Clearing: profile(['Energy'], 'Standard', 6, { area: { type: 'sphere', remoteOrigin: true }, strikeNaturalMinimum: 5 }),
  Concentrated: profile(['Energy'], 'Lethal', 10, { area: { type: 'line', maxMagnitude: 'Standard' }, ignoreDRFraction: 0.5 }),
  Cutting: profile(['Energy'], 'Direct', 6, { botchUnlessStrikeCrit: true, strikeCritDamageCategoryBonus: 1, woundCT: 5 }),
  Wave: profile(['Energy'], 'Direct', 6, { area: { type: 'line', remoteOrigin: true } }),
  'Elemental (Dark)': profile(['Magic'], 'Standard', 2, { lifeWager: true, lightLevelChange: -1 }),
  'Elemental (Earth)': profile(['Magic'], 'Direct', 4, { weaponCategory: 'Bludgeoning', weaponQualities: ['Staggering'] }),
  'Elemental (Fire)': profile(['Magic'], 'Direct', 8, { thresholdCondition: 'broken', environment: 'aflame' }),
  'Elemental (Ice)': profile(['Magic'], 'Direct', 8, { thresholdCondition: 'slowed', environment: 'frozen' }),
  'Elemental (Light)': profile(['Magic'], 'Standard', 2, { freeAdvantages: ['Full Wager'], lightLevelChange: 1 }),
  'Elemental (Lightning)': profile(['Magic'], 'Direct', 8, { thresholdCondition: 'impediment', environment: 'electrified' }),
  'Elemental (Metal)': profile(['Magic'], 'Lethal', 8),
  'Elemental (Plantlife)': profile(['Magic'], 'Standard', 3, { freeAdvantages: ['Staggering Attack'], createsFeature: { hardness: 1, quality: 'Splintering' } }),
  'Elemental (Poison)': profile(['Magic'], 'Direct', 8, { thresholdCondition: 'poisoned', environment: 'poisoned' }),
  'Elemental (Water)': profile(['Magic'], 'Direct', 8, { thresholdCondition: 'prone', environment: 'bog' }),
  'Elemental (Wind)': profile(['Magic'], 'Direct', 4, { weaponCategory: 'Slashing' })
});

export const ELEMENTAL_PROFILES_093 = Object.freeze(Object.keys(PROFILES_093).filter(name => name.startsWith('Elemental (')).sort());

export function profileAdvantages093(attack, rows = []) {
  const grants = PROFILES_093[attack.profile]?.freeAdvantages || [];
  return [...rows, ...grants.filter(name => !rows.some(row => row.name === name)).map(name => ({ name, ranks: 1, freeRanks: 1 }))];
}

export function profileKiUnits(profileName) { return PROFILES_093[profileName]?.kpCost ?? null; }
export function minimumAttackKiUnits(profileName) {
  const base = profileKiUnits(profileName);
  return base === null ? null : base / 2;
}
export function validFoundation(profileName, foundation) { return !!PROFILES_093[profileName]?.foundations.includes(foundation); }

export function profileRoll093(profileName, { strikeNatural, targetingBonus = 0, faces = 10, strikeCT = 10, strikeBotchThreshold = 1, damageCat = 'Standard' } = {}) {
  const adjusted = Math.min(faces, Number(strikeNatural) + targetingBonus);
  const natural = profileName === 'Clearing' ? Math.min(faces, Math.max(5, adjusted)) : adjusted;
  const critical = natural >= strikeCT;
  const botch = profileName === 'Cutting' ? !critical : strikeBotchThreshold > 0 && natural <= strikeBotchThreshold;
  const categories = ['Standard', 'Direct', 'Lethal'];
  const category = profileName === 'Cutting' && critical ? categories[Math.min(2, Math.max(0, categories.indexOf(damageCat)) + 1)] : damageCat;
  return { natural, targetingAdjustment: adjusted - Number(strikeNatural), strikeAdjustment: natural - Number(strikeNatural), critical, botch, damageCat: category };
}

export async function rollLinked093(formula, mode) {
  const first = await new Roll(formula).evaluate();
  if (!mode) return { roll: first, discarded: null };
  const second = await new Roll(formula).evaluate();
  const keepSecond = (second.total > first.total) === (mode === "high");
  return keepSecond ? { roll: second, discarded: first } : { roll: first, discarded: second };
}

export function combinationDefenseScore(outcome) {
  if (["guard", "directHit", "powerFlare"].includes(outcome?.defenseType)) return 0;
  return ["dodge", "parry"].includes(outcome?.defenseType) && Number.isFinite(outcome.total)
    ? outcome.total : null;
}

export function combinationWoundBonus(totals, defenseScore, tier) {
  if (defenseScore === null) return 0;
  return totals.filter(total => total > defenseScore).length * PROFILES_093.Combination.woundPerAdditionalHit * tier;
}

export function pinpointInsight093(system, strikeCritical) {
  const insight = system.attributes?.in?.totalScore || 0;
  return strikeCritical ? 2 * insight : insight;
}

export const PROFILE_SUMMARIES_093 = Object.freeze({
  Simple: 'TP inicial 4; mínimo final de 8 TP.',
  Combination: 'Após acertar: 3 testes adicionais de Strike; cada sucesso adicional concede +2(T) Wound.',
  Launching: 'Knockback gratuito; colisões resultantes causam dano dobrado.',
  'Mega Flare': 'Até 10 Energy Charges. Cada charge também concede +1(T) Wound; com 7+, Damage Category +1.',
  Blitz: 'Charging Assault gratuito. Se a distância exceder Normal Speed: Wound adicional igual a metade de Agility Modifier. Signature: desconto de 2(T) KP.',
  Crushing: 'Apenas metade de Haste em Strike. Force continua integral em Wound.',
  Pinpoint: 'Ignore Soak igual a Insight Modifier. Um crítico em Strike dobra Insight Modifier durante o ataque.',
  Powered: 'Damage Attribute aplicado mais uma vez; ganha um Energy Charge.',
  Soaring: 'Line AoE de magnitude Standard.',
  Sweeping: 'Sphere AoE Minor centrada no usuário, sem atingir aliados. Ao causar dano: dobre as novas stacks de Diminishing Defense do alvo.',
  Beam: 'Ganha um Energy Charge fora do limite normal.',
  Blast: 'Cone AoE.',
  Clearing: 'Sphere AoE numa origem escolhida fora de Long Range. Natural mínimo de Strike: 5.',
  Concentrated: 'Line AoE de magnitude máxima Standard; ignore metade do Damage Reduction do alvo.',
  Cutting: 'Strike sem crítico sofre Botch. Crítico em Strike eleva Damage Category em 1. Wound CT: 5.',
  Wave: 'Line AoE com origem escolhida.',
  'Elemental (Dark)': 'Ki Wager pode gastar LP, consumindo Capacity normalmente. Dano reduz iluminação em 1 nível.',
  'Elemental (Earth)': 'Aplica Bludgeoning e a qualidade Staggering.',
  'Elemental (Fire)': 'Ao cruzar limiar do alvo: Broken. Área atingida recebe Aflame.',
  'Elemental (Ice)': 'Ao cruzar limiar do alvo: Slowed. Área atingida recebe Frozen.',
  'Elemental (Light)': 'Full Wager gratuito; dano aumenta iluminação em 1 nível.',
  'Elemental (Lightning)': 'Ao cruzar limiar do alvo: Impediment. Área atingida recebe Electrified.',
  'Elemental (Metal)': 'O terreno afetado torna-se Metallic, com Hardness mínima 3. Em área, aplique Dangerous ou Sharp conforme o alvo.',
  'Elemental (Plantlife)': 'Concede Staggering Attack e permite criar Features em Squares desocupados. Produz Features com Hardness 1 e Splintering, conforme a fonte.',
  'Elemental (Poison)': 'Aplica Poisoned conforme os gatilhos da fonte.',
  'Elemental (Water)': 'Ao cruzar limiar do alvo: Prone. Área atingida recebe Bog.',
  'Elemental (Wind)': 'Aplica a categoria de arma Slashing.'
});
