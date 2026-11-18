// ============================================================
// DBU — VISUAL ENERGY CHARGE v1.0
// Requer Sequencer
// Chamado pelo DBU - Energy Charge v1.2
// ============================================================
//
// Opcional em Bio > Notes:
//
// CHARGE_ASSET: assets/Auras/aura-classica.webm
// CHARGE_COLOR: #FFD54A
// CHARGE_SCALE: 2.5
// CHARGE_OPACITY: 0.75
//
// Também aceita por estágio:
// CHARGE_ASSET_1: ...
// CHARGE_ASSET_2: ...
// CHARGE_ASSET_3: ...
// CHARGE_ASSET_4: ...
// CHARGE_ASSET_MAX: ...
//
// CHARGE_COLOR_1: #...
// CHARGE_COLOR_2: #...
// CHARGE_COLOR_3: #...
// CHARGE_COLOR_4: #...
// CHARGE_COLOR_MAX: #...
//
// CHARGE_SCALE_1: 2.2
// ...
//
// Se nenhuma configuração existir, usa:
// assets/Auras/aura-classica.webm
// ============================================================

export async function visualEnergyCharge(context = {}) {

  const VERSION = "1.0";
  const DEFAULT_ASSET = "assets/Auras/aura-classica.webm";
  const DEFAULT_COLOR = "#FFD54A";
  const EFFECT_PREFIX = "DBU Energy Charge Visual";

  const ctx = context ?? {};

  const actorDoc =
    ctx.actor
    ?? (typeof actor !== "undefined" ? actor : null)
    ?? canvas.tokens.controlled[0]?.actor
    ?? null;

  const tokenDoc =
    ctx.token
    ?? ctx.attackerToken
    ?? (typeof token !== "undefined" ? token : null)
    ?? canvas.tokens.controlled[0]
    ?? null;

  if (!actorDoc || !tokenDoc) {
    return ui.notifications.warn("Visual Energy Charge: selecione um token.");
  }

  if (!globalThis.Sequencer?.EffectManager || !globalThis.Sequence) {
    return ui.notifications.error("Visual Energy Charge: Sequencer não está disponível.");
  }

  function notesText() {
    let raw = String(actorDoc.system?.notes ?? "");
    try {
      if (/<[a-z][\s\S]*>/i.test(raw)) {
        const el = document.createElement("div");
        el.innerHTML = raw;
        raw = el.innerText || el.textContent || raw;
      }
    } catch {}
    return raw;
  }

  function note(tag) {
    const wanted = String(tag || "").trim().toUpperCase();
    for (const line of notesText().split(/\r?\n/)) {
      const m = line.match(/^\s*([^:]+?)\s*:\s*(.*?)\s*$/);
      if (!m) continue;
      if (String(m[1]).trim().toUpperCase() !== wanted) continue;
      return String(m[2] || "").trim();
    }
    return "";
  }

  function numberNote(stage, baseTag, fallback) {
    const a = Number(note(`${baseTag}_${stage}`));
    if (Number.isFinite(a) && a > 0) return a;
    const b = Number(note(baseTag));
    if (Number.isFinite(b) && b > 0) return b;
    return fallback;
  }

  function stageFromTotal(total) {
    total = Math.max(0, Number(total) || 0);
    if (total >= 5) return "MAX";
    if (total >= 4) return "4";
    if (total >= 3) return "3";
    if (total >= 2) return "2";
    return "1";
  }

  const totalCharges = Math.max(
    0,
    Number(ctx.totalCharges ?? ctx.state?.visualTotalCharges ?? ctx.state?.gatheredCharges ?? 1) || 0
  );

  const stage = String(ctx.stage || stageFromTotal(totalCharges)).toUpperCase();
  const mode = String(ctx.mode || "update").toLowerCase();
  const effectName = `${EFFECT_PREFIX} | ${actorDoc.id}`;

  async function endVisual() {
    try {
      await Sequencer.EffectManager.endEffects({
        name: effectName,
        object: tokenDoc
      });
    } catch (error) {
      console.warn("DBU Visual Energy Charge | endEffects", error);
    }
  }

  if (mode === "off") {
    await endVisual();
    return;
  }

  await endVisual();

  const asset =
    note(`CHARGE_ASSET_${stage}`)
    || note("CHARGE_ASSET")
    || DEFAULT_ASSET;

  const color =
    note(`CHARGE_COLOR_${stage}`)
    || note("CHARGE_COLOR")
    || DEFAULT_COLOR;

  const baseScale = numberNote(stage, "CHARGE_SCALE", 2.5);
  const baseOpacity = Math.min(1, numberNote(stage, "CHARGE_OPACITY", 0.72));

  const stageConfig = {
    "1": [
      { scale: 0.88, opacity: 0.68 }
    ],
    "2": [
      { scale: 0.96, opacity: 0.76 },
      { scale: 0.78, opacity: 0.30 }
    ],
    "3": [
      { scale: 1.06, opacity: 0.82 },
      { scale: 0.86, opacity: 0.38 }
    ],
    "4": [
      { scale: 1.16, opacity: 0.88 },
      { scale: 0.92, opacity: 0.46 },
      { scale: 1.30, opacity: 0.20 }
    ],
    "MAX": [
      { scale: 1.28, opacity: 0.94 },
      { scale: 1.00, opacity: 0.56 },
      { scale: 1.46, opacity: 0.28 }
    ]
  };

  const layers = stageConfig[stage] || stageConfig["1"];
  const sequence = new Sequence();

  for (const layer of layers) {
    let effect = sequence
      .effect()
        .file(asset)
        .attachTo(tokenDoc)
        .scaleToObject(baseScale * layer.scale)
        .opacity(Math.min(1, baseOpacity * layer.opacity / 0.72))
        .persist()
        .name(effectName)
        .belowTokens(true);

    if (color && !/^none$/i.test(color)) {
      effect = effect.tint(color);
    }
  }

  try {
    await sequence.play();
  } catch (error) {
    console.error("DBU Visual Energy Charge | play", error);
    ui.notifications.error("Erro reproduzindo o visual do Energy Charge.");
    return;
  }

  console.log(`DBU Visual Energy Charge v${VERSION}`, {
    actor: actorDoc.name,
    stage,
    totalCharges,
    asset,
    color,
    scale: baseScale
  });
}
