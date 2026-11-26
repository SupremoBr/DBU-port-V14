import { combinationDefenseScore, combinationWoundBonus, PROFILES_093, profileRoll093, rollLinked093 } from "../../../rules/profiles-v093.mjs";
import { finishDefense } from "../core/private-rolls.js";

async function rollScore(formula, linkMode, extraFormula, setup, interpret) {
  const { roll } = await rollLinked093(formula, linkMode);
  const natural = roll.dice[0]?.results?.[0]?.result;
  const result = interpret(natural, roll.dice[0]?.faces);
  const criticalRoll = result.critical && setup.critFormula ? await new Roll(setup.critFormula).evaluate() : null;
  const extra = extraFormula ? await new Roll(extraFormula).evaluate() : null;
  const total = roll.total + (result.strikeAdjustment || 0) + (criticalRoll?.total || 0)
    + (extra?.total || 0) - (result.botch ? setup.botchPenalty : 0);
  return { ...result, total, roll, criticalRoll, extra };
}

export async function rollCombination(attack, targetsAndDefenses) {
  const setup = attack.combination;
  const targets = {};
  const combinationRollData = [];
  let hit = false;
  for (const { key, outcome, rules093 } of targetsAndDefenses) {
    if (!outcome) continue;
    // Power Flare contests Wound, so it can only be resolved after Wound exists.
    if (outcome.defenseType !== "powerFlare" && !finishDefense(attack, outcome, rules093).damageDefense) continue;
    hit = true;
    const defenseScore = combinationDefenseScore(outcome);
    if (defenseScore === null) continue;
    const totals = [];
    for (let i = 0; i < PROFILES_093.Combination.additionalStrikeChecks + (setup.extraChecks || 0); i++) {
      const strike = await rollScore(setup.strikeFormula, setup.strikeLinkMode, setup.strikeExtra, setup,
        (natural, faces) => profileRoll093("Combination", {
          strikeNatural: natural, faces, strikeCT: attack.strikeCT,
          strikeBotchThreshold: attack.strikeBotchThreshold, targetingBonus: attack.targetingBonus
        }));
      totals.push(strike.total + (setup.strikeFlatAdjustment || 0));
      combinationRollData.push(...[strike.roll, strike.criticalRoll, strike.extra].filter(Boolean).map(roll => roll.toJSON()));
    }
    const bonus = combinationWoundBonus(totals, defenseScore, attack.attackerTier);
    targets[key] = { totals, defenseScore, bonus };
  }
  if (!hit) return { attackData: { combinationMissed: true }, revealData: {} };

  const woundSetup = attack.isReflect
    ? { critFormula: setup.woundCritFormula, botchPenalty: setup.woundBotchPenalty } : setup;
  const wound = await rollScore(setup.woundFormula, setup.woundLinkMode, setup.woundExtra, woundSetup,
    natural => ({ natural, critical: natural >= attack.woundCT,
      botch: attack.woundBotchThreshold > 0 && natural <= attack.woundBotchThreshold }));
  return {
    attackData: {
      combinationTargets: targets, baseWoundTotal: wound.total, woundNatural: wound.natural,
      woundCritical: wound.critical, woundBotch: wound.botch, woundBonusTotal: wound.extra?.total || 0
    },
    revealData: {
      combinationRollData, woundRollData: wound.roll.toJSON(), woundCritRollData: wound.criticalRoll?.toJSON(),
      woundExtraRollData: wound.extra?.toJSON()
    }
  };
}

export function attackForCombinationTarget(attack, key) {
  const bonus = attack.combinationTargets?.[key]?.bonus;
  return bonus ? { ...attack, woundTotal: attack.woundTotal + bonus } : attack;
}
