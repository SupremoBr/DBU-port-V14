import { spendNarrativeStamina093 } from "../../../rules/adversaries-v093.mjs";

// DBU Automation — recursos Ki/Capacity
export function dbuGetCapacity(actor) {
  const max = Number(
    actor.system.status?.maxCapacity || 0
  );

  const spent = Number(
    actor.system.status?.capacitySpent || 0
  );

  return {
    max,
    spent,
    left: Math.max(0, max - spent)
  };
}

// ============================================================
// VALIDAR KI + CAPACITY ANTES DE UMA AÇÃO
// ============================================================

export function dbuCheckAffordability(
  actor,
  amount,
  label = "Ação",
  notify = true
) {
  amount = Math.max(0, Number(amount) || 0);

  const currentKi = Math.max(0, Number(
    actor?.system?.kiPool?.value || 0
  ));

  const capacity = dbuGetCapacity(actor);
  const stamina = spendNarrativeStamina093(actor, amount, "staminaForKi").amount;
  const kiCost = amount - stamina;

  if (amount <= 0) {
    return {
      ok: true,
      amount: 0,
      ki: currentKi,
      ...capacity
    };
  }

  if (currentKi < kiCost) {
    if (notify) {
      ui.notifications.warn(
        `${actor.name}: Ki insuficiente para ${label}. ` +
        `Disponível ${currentKi}, necessário ${kiCost} KP.`
      );
    }

    return {
      ok: false,
      reason: "ki",
      amount,
      ki: currentKi,
      ...capacity
    };
  }

  if (
    capacity.max > 0
    && capacity.left < kiCost
  ) {
    if (notify) {
      ui.notifications.warn(
        `${actor.name}: Capacity insuficiente para ${label}. ` +
        `Restante ${capacity.left}, necessário ${kiCost}.`
      );
    }

    return {
      ok: false,
      reason: "capacity",
      amount,
      ki: currentKi,
      ...capacity
    };
  }

  return {
    ok: true,
    amount,
    ki: currentKi,
    ...capacity
  };
}

// ============================================================
// PAGAR KI + CAPACITY
// ============================================================

export async function dbuPayKiAndCapacity(
  actor,
  amount,
  label = "Ação"
) {
  amount = Math.max(
    0,
    Number(amount) || 0
  );

  if (!amount) {
    return {
      ok: true,
      amount: 0,
      capacityLeft: dbuGetCapacity(actor).left
    };
  }

  const check = dbuCheckAffordability(actor, amount, label);
  if (!check.ok) return check;
  const stamina = spendNarrativeStamina093(actor, amount, "staminaForKi");
  const currentKi = check.ki;
  const kiCost = amount - stamina.amount;
  const capacity = dbuGetCapacity(actor);

  await actor.update({
    "system.kiPool.value": currentKi - kiCost,
    "system.status.capacitySpent": capacity.spent + kiCost,
    ...stamina.update
  });

  const after = dbuGetCapacity(actor);

  console.log(
    "DBU | Pagamento Ki + Capacity",
    {
      actor: actor.name,
      label,
      amount,
      kiBefore: currentKi,
      kiAfter: currentKi - kiCost,
      capacityBefore: capacity.spent,
      capacityAfter: after.spent,
      capacityMax: after.max
    }
  );

  return {
    ok: true,
    amount,
    ki: currentKi - kiCost,
    staminaSpent: stamina.amount,
    capacitySpent: after.spent,
    capacityLeft: after.left
  };
}

// ============================================================
// ROUND TRACKER
// ============================================================

