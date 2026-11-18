// DBU Automation — Round Tracker / registro de Defend
export function dbuGetCurrentRound(actor, cts) {
  cts.rounds ??= [];

  if (!cts.rounds.length) {
    cts.rounds.push({
      roundNumber: 1,
      actions: []
    });
  }

  const round = cts.rounds[cts.rounds.length - 1];

  round.actions ??= [];
  round.roundNumber ??= cts.rounds.length;
  cts.currentRound = round.roundNumber;

  return round;
}

// ============================================================
// REGISTRAR DEFESA
// ============================================================

export async function dbuRecordDefend(
  actor,
  defenseType,
  {
    penaltyRanks = 0,
    wager = 0,
    incomingEC = 0
  } = {}
) {
  const cts = foundry.utils.deepClone(
    actor.system.combatTabState || {}
  );

  const round = dbuGetCurrentRound(
    actor,
    cts
  );

  const tier = Number(
    actor.system.tier || 1
  );

  const names = {
    parry: "Parry",
    directHit: "Direct Hit",
    powerFlare: "Power Flare",
    crossCounter: "Cross Counter",
    guard: "Guard"
  };

  const baseCosts = {
    parry: 0,
    directHit: 0,
    powerFlare: 2 * tier,
    crossCounter: 2 * tier,
    guard: 8 * tier
  };

  cts.roundCounterCount =
    (Number(cts.roundCounterCount) || 0) + 1;

  round.actions.push({
    type: "defend",
    source: "",
    kiCost: baseCosts[defenseType] || 0,
    dkpCost: 0,
    kiWager: 0,
    description: `Defend: ${names[defenseType] || defenseType}`,
    defendOption: defenseType,
    defendPenalty: Math.max(
      0,
      Number(penaltyRanks) || 0
    ),
    defendWager: Math.max(
      0,
      Number(wager) || 0
    ),
    defendEC: Math.max(
      0,
      Number(incomingEC) || 0
    )
  });

  await actor.update({
    "system.combatTabState": cts
  });

  return cts.roundCounterCount;
}

// ============================================================
// CRITICAL EXTRA
// ============================================================

