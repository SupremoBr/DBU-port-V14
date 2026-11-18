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

  if (amount <= 0) {
    return {
      ok: true,
      amount: 0,
      ki: currentKi,
      ...capacity
    };
  }

  if (currentKi < amount) {
    if (notify) {
      ui.notifications.warn(
        `${actor.name}: Ki insuficiente para ${label}. ` +
        `Disponível ${currentKi}, necessário ${amount} KP.`
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
    && capacity.left < amount
  ) {
    if (notify) {
      ui.notifications.warn(
        `${actor.name}: Capacity insuficiente para ${label}. ` +
        `Restante ${capacity.left}, necessário ${amount}.`
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

  const currentKi = Number(
    actor.system.kiPool?.value || 0
  );

  const capacity = dbuGetCapacity(actor);

  if (currentKi < amount) {
    ui.notifications.warn(
      `${actor.name}: Ki insuficiente. Necessário ${amount} KP.`
    );

    return {
      ok: false,
      reason: "ki"
    };
  }

  if (
    capacity.max > 0 &&
    capacity.left < amount
  ) {
    ui.notifications.warn(
      `${actor.name}: Capacity insuficiente. ` +
      `Restante ${capacity.left}, necessário ${amount}.`
    );

    return {
      ok: false,
      reason: "capacity"
    };
  }

  await actor.update({
    "system.kiPool.value":
      currentKi - amount,

    "system.status.capacitySpent":
      capacity.spent + amount
  });

  const after = dbuGetCapacity(actor);

  console.log(
    "DBU | Pagamento Ki + Capacity",
    {
      actor: actor.name,
      label,
      amount,
      kiBefore: currentKi,
      kiAfter: currentKi - amount,
      capacityBefore: capacity.spent,
      capacityAfter: after.spent,
      capacityMax: after.max
    }
  );

  return {
    ok: true,
    amount,
    ki: currentKi - amount,
    capacitySpent: after.spent,
    capacityLeft: after.left
  };
}

// ============================================================
// ROUND TRACKER
// ============================================================

