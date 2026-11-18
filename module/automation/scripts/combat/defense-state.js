// DBU Automation — estado persistido das defesas
export function dbuGetDefenseStates(defender) {
  return (
    defender.getFlag(
      "world",
      "dbuDefenseStates"
    )
    || {}
  );
}

export function dbuGetDefenseState(
  defender,
  messageId
) {
  return (
    dbuGetDefenseStates(defender)[messageId]
    || null
  );
}

export async function dbuSetDefenseState(
  defender,
  messageId,
  state
) {
  const states = foundry.utils.deepClone(
    dbuGetDefenseStates(defender)
  );

  states[messageId] = state;

  await defender.setFlag(
    "world",
    "dbuDefenseStates",
    states
  );
}

export async function dbuClearDefensePending(
  defender,
  messageId
) {
  await dbuSetDefenseState(
    defender,
    messageId,
    {
      resolved: false,
      pending: false
    }
  );
}

// ============================================================
// UNITED ATTACK v6.6 — ATAQUE NORMAL
// ============================================================

