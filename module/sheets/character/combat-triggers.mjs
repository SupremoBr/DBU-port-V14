import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: combat-triggers. Methods run with the sheet as this. */
export const combatTriggersMethods = {

  /**
   * Handle clicking a Legendary Trait triggered effect button in Combat tab.
   */
  async _onLegendaryTraitTrigger(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const triggerId = btn.dataset.triggerId;

    // Find the triggered effect data
    const ltBonuses = this.actor.system.legendaryTraitBonuses || {};
    let triggerData = null;
    for (const entry of (ltBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.sourceName, trackingId: `lt:${found.id}` }; break; }
    }
    if (!triggerData) return;

    return this._runTriggerAutomationAndChat(triggerData, "fas fa-crown");
  },

  /**
   * Handle clicking a Manifested Power triggered effect button in Combat tab.
   */
  async _onManifestedPowerTrigger(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const triggerId = btn.dataset.triggerId;

    // Find the triggered effect data
    const mpBonuses = this.actor.system.manifestedPowerBonuses || {};
    let triggerData = null;
    for (const entry of (mpBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `mp:${found.id}` }; break; }
    }
    if (!triggerData) return;

    return this._runTriggerAutomationAndChat(triggerData, "fas fa-star-of-life");
  },

  /**
   * Handle clicking a Racial Trait triggered effect button in Combat tab.
   */
  async _onRacialTraitTrigger(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const triggerId = btn.dataset.triggerId;

    // Search all race bonus objects for the triggered entry
    const system = this.actor.system;
    const raceBonusKeys = [
      "racialBonuses", "earthlingBonuses", "majinBonuses", "bioAndroidBonuses",
      "androidBonuses", "arcosianBonuses", "cerealianBonuses", "namekianBonuses",
      "nekoMajinBonuses", "neoTuffleBonuses", "shadowDragonBonuses", "shinjinBonuses",
      "undeadBonuses"
    ];
    let triggerData = null;
    for (const key of raceBonusKeys) {
      const bonuses = system[key];
      if (!bonuses?.triggered) continue;
      const found = bonuses.triggered.find(t => t.id === triggerId);
      if (found) {
        triggerData = { ...found, trackingId: `rt:${found.id}` };
        break;
      }
    }
    if (!triggerData) return;

    return this._runTriggerAutomationAndChat(triggerData, "fas fa-dna");
  },

  _applyJusticeChargeTriggerResource(specialResources, triggerData) {
    const desc = String(triggerData?.description || "");
    const sourceKey = String(triggerData?.trackingId || "");
    const justiceContext = this._getJusticeChargeContext();
    const max = Math.max(justiceContext.max || 3, specialResources.justiceCharge?.max ?? 0, 3);
    let changed = false;

    if (/gain 3 justice charges/i.test(desc)) {
      specialResources.justiceCharge = {
        value: Math.min(max, 3),
        max,
        source: sourceKey,
        sourceName: triggerData.sourceName || "Justice Charge"
      };
      changed = true;
    } else if (/gain a stack of justice charge/i.test(desc)) {
      const current = specialResources.justiceCharge?.value ?? 0;
      const next = Math.min(max, current + 1);
      if (next > current) {
        specialResources.justiceCharge = {
          value: next,
          max,
          source: sourceKey,
          sourceName: triggerData.sourceName || "Justice Charge"
        };
        changed = true;
      }
    }

    return changed;
  },

  async _undoCombatUsage(trackingId, usageLimit) {
    if (!trackingId || !usageLimit) return;
    const key = /encounter/i.test(String(usageLimit || "")) ? "encounter" : "round";
    const ctsUndo = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const etUndo = foundry.utils.deepClone(this.actor.system.effectTracking || {});
    // Keep 0 instead of deleting: removed keys are silently ignored by
    // Foundry's merge-based update, leaving stale counts in the DB.
    if (ctsUndo.resourceUsage?.[key]?.[trackingId]) {
      ctsUndo.resourceUsage[key][trackingId] = Math.max(0, ctsUndo.resourceUsage[key][trackingId] - 1);
    }
    if (etUndo.usedEffects?.[key]?.[trackingId]) {
      etUndo.usedEffects[key][trackingId] = Math.max(0, etUndo.usedEffects[key][trackingId] - 1);
    }
    // Remove the most recent matching "use" entry from the Round Tracker log
    let removedRow = null;
    if (Array.isArray(ctsUndo.rounds)) {
      outer: for (let r = ctsUndo.rounds.length - 1; r >= 0; r--) {
        const acts = ctsUndo.rounds[r].actions || [];
        for (let a = acts.length - 1; a >= 0; a--) {
          if (acts[a].type === "use" && acts[a].effectId === trackingId && acts[a].limit === key) {
            removedRow = acts.splice(a, 1)[0];
            break outer;
          }
        }
      }
    }
    this._usageJustUndone = true;
    const undoUpdates = { "system.combatTabState": ctsUndo, "system.effectTracking": etUndo };
    if (removedRow?.autoApplied) this._reverseAutoApplied(removedRow.autoApplied, ctsUndo, undoUpdates);
    await this.actor.update(undoUpdates);
  },

  async _handleJusticeChargeKiConversion(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/gain a stack of justice charge for every 4\(bT\) ki points spent/i.test(desc)) return false;

    const justiceContext = this._getJusticeChargeContext();
    if (!justiceContext.active) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const maxSpend = justiceContext.max >= 5 ? 20 * baseTier : 12 * baseTier;
    const kpCurrent = this.actor.system.kiPool?.value ?? 0;
    const spendCap = Math.min(maxSpend, kpCurrent);
    if (spendCap < 4 * baseTier) {
      ui.notifications?.warn("Not enough Ki Points to gain a Justice Charge.");
      return "blocked";
    }

    const content = `
      <form>
        <div class="form-group">
          <label>Ki Points to spend (max ${spendCap})</label>
          <input type="number" name="kpSpend" min="0" max="${spendCap}" step="${4 * baseTier}" value="${4 * baseTier}" />
          <p class="notes">Gain 1 Justice Charge per ${4 * baseTier} KP spent. This does not reduce Capacity.</p>
        </div>
      </form>`;

    const kpSpendRaw = await Dialog.prompt({
      title: triggerData.name || "Justice Charge",
      content,
      callback: (html) => Number(html.find("[name='kpSpend']").val()) || 0,
      rejectClose: false
    });

    let kpSpend = Math.min(spendCap, Math.max(0, Number(kpSpendRaw) || 0));
    kpSpend -= kpSpend % (4 * baseTier);
    if (kpSpend <= 0) return "cancelled";

    const chargesGained = Math.floor(kpSpend / (4 * baseTier));
    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const max = Math.max(justiceContext.max || 3, specialResources.justiceCharge?.max ?? 0, 3);
    const current = specialResources.justiceCharge?.value ?? 0;
    const next = Math.min(max, current + chargesGained);
    const actualChargesGained = Math.max(0, next - current);
    if (actualChargesGained <= 0) {
      ui.notifications?.info("Justice Charge is already at its maximum.");
      return "cancelled";
    }

    const currentKP = this.actor.system.kiPool?.value ?? 0;
    specialResources.justiceCharge = {
      value: next,
      max,
      source: String(triggerData?.trackingId || ""),
      sourceName: triggerData.sourceName || "Justice Charge"
    };

    await this.actor.update({
      "system.kiPool.value": Math.max(0, currentKP - kpSpend),
      "system.transformationMeta.specialResources": specialResources
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-bolt"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${kpSpend}</b> KP and gained <b>${actualChargesGained}</b> Justice Charge${actualChargesGained === 1 ? "" : "s"}.</div>`
    });

    return true;
  },

  _getGodOfMartialArtsSuperiorCost() {
    const activeTransform = (this.actor.system.transformations || []).find(t => t?.active && t.catalogKey === "god_of_martial_arts");
    if (!activeTransform) return 4;
    const effects = this._getResolvedTransformationEffects(activeTransform, this.actor.system.transformations || []);
    const hasExceedDiscount = effects.some(e => /halve the advantage point cost of the 6th effect of wizened warrior/i.test(String(e?.text || "")));
    return hasExceedDiscount ? 2 : 4;
  },

  async _handleAdvantagePointSuperiorTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/spend 4 advantage points to enter the superior state until the end of your next turn/i.test(desc)) return false;

    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const current = specialResources.advantagePoints?.value ?? 0;
    const requiredHeld = 12;
    const cost = this._getGodOfMartialArtsSuperiorCost();
    if (current < requiredHeld) {
      ui.notifications?.warn("You need 12 Advantage Points to use this trigger.");
      return "blocked";
    }
    if (current < cost) {
      ui.notifications?.warn("Not enough Advantage Points to pay this trigger's cost.");
      return "blocked";
    }

    if (triggerData?.dryRun) return true;

    specialResources.advantagePoints = {
      ...(specialResources.advantagePoints || {}),
      max: Math.max(specialResources.advantagePoints?.max ?? 0, 12),
      value: Math.max(0, current - cost),
      sourceName: triggerData.sourceName || "Advantage Points"
    };

    await this.actor.update({
      "system.transformationMeta.specialResources": specialResources,
      "system.combatStates.superior": true
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-crown"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${cost}</b> Advantage Point${cost === 1 ? "" : "s"} and entered the <b>Superior</b> State until the end of your next turn.</div>`
    });

    return true;
  },

  async _handleAdvantagePointSignatureTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/spend any number of advantage points to either: increase the wound roll/i.test(desc)) return false;

    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const current = specialResources.advantagePoints?.value ?? 0;
    if (current <= 0) {
      ui.notifications?.warn("You have no Advantage Points to spend.");
      return "blocked";
    }

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const content = `
      <form>
        <div class="form-group">
          <label>Advantage Points to spend (max ${current})</label>
          <input type="number" name="apSpend" min="0" max="${current}" step="1" value="1" />
        </div>
        <div class="form-group">
          <label>Effect</label>
          <select name="mode">
            <option value="wound">Increase Wound Roll</option>
            <option value="charge">Apply Energy Charges</option>
          </select>
        </div>
      </form>`;

    const result = await Dialog.prompt({
      title: triggerData.name || "Advantage Points",
      content,
      callback: (html) => ({
        spend: Number(html.find("[name='apSpend']").val()) || 0,
        mode: String(html.find("[name='mode']").val() || "wound")
      }),
      rejectClose: false
    });

    const spend = Math.min(current, Math.max(0, Number(result?.spend) || 0));
    if (spend <= 0) return "cancelled";

    specialResources.advantagePoints = {
      ...(specialResources.advantagePoints || {}),
      max: Math.max(specialResources.advantagePoints?.max ?? 0, 12),
      value: current - spend,
      sourceName: triggerData.sourceName || "Advantage Points"
    };

    await this.actor.update({ "system.transformationMeta.specialResources": specialResources });

    const mode = result?.mode === "charge" ? "charge" : "wound";
    const effectText = mode === "charge"
      ? `Apply <b>${Math.floor(spend / 4)}</b> Energy Charge${Math.floor(spend / 4) === 1 ? "" : "s"} to the Signature Technique`
      : `Increase the Wound Roll by <b>${spend * baseTier}</b>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-crown"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Advantage Point${spend === 1 ? "" : "s"}<br>${effectText}</div>`
    });

    return true;
  },

  async _handleDivineKiConversionTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/convert up to 10\(bT\) ki points into divine ki points/i.test(desc)) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const maxConvert = 10 * baseTier;
    const currentKP = this.actor.system.kiPool?.value ?? 0;
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
    const spendCap = Math.min(maxConvert, currentKP, Math.max(0, maxDKP - currentDKP));
    if (spendCap <= 0) {
      ui.notifications?.warn("No Ki Points can be converted into Divine Ki Points right now.");
      return "blocked";
    }

    const kpSpendRaw = await Dialog.prompt({
      title: triggerData.name || "Divine Ki Conversion",
      content: `<form><div class="form-group"><label>Ki Points to convert (max ${spendCap})</label><input type="number" name="kpSpend" min="0" max="${spendCap}" step="1" value="1" /></div></form>`,
      callback: (html) => Number(html.find("[name='kpSpend']").val()) || 0,
      rejectClose: false
    });

    const kpSpend = Math.min(spendCap, Math.max(0, Number(kpSpendRaw) || 0));
    if (kpSpend <= 0) return "cancelled";

    await this.actor.update({
      "system.kiPool.value": Math.max(0, currentKP - kpSpend),
      "system.divineKiPoints.value": Math.min(maxDKP, currentDKP + kpSpend)
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Converted <b>${kpSpend}</b> KP into <b>${kpSpend}</b> Divine Ki Points.</div>`
    });

    return true;
  },

  _hasDivineKiSpendKiRefund() {
    const activeTransform = (this.actor.system.transformations || []).find(t => t?.active && t.catalogKey === "godly_powers");
    if (!activeTransform) return false;
    const effects = this._getResolvedTransformationEffects(activeTransform, this.actor.system.transformations || []);
    return effects.some(e => /if you spend any amount of divine ki points, regain ki points equal to 1\/2/i.test(String(e?.text || "")));
  },

  async _applyDivineKiSpendSideEffects(spent, label = "Divine Ki") {
    if (!(spent > 0) || !this._hasDivineKiSpendKiRefund()) return 0;
    const kpGain = Math.ceil(spent / 2);
    const currentKP = this.actor.system.kiPool?.value ?? 0;
    const maxKP = this.actor.system.kiPool?.max ?? 0;
    const nextKP = Math.min(maxKP, currentKP + kpGain);
    if (nextKP <= currentKP) return 0;
    await this.actor.update({ "system.kiPool.value": nextKP });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> Divine Style</b><br>Spent <b>${spent}</b> Divine Ki Points through <b>${label}</b><br>Regained <b>${nextKP - currentKP}</b> KP.</div>`
    });
    return nextKP - currentKP;
  },

  async _handleDivineKiRollBoostTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/spend up to 4\(bT\) divine ki points to increase one of your strike or dodge rolls/i.test(desc)) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const maxSpend = 4 * baseTier;
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const spendCap = Math.min(maxSpend, currentDKP);
    if (spendCap <= 0) {
      ui.notifications?.warn("You do not have enough Divine Ki Points.");
      return "blocked";
    }

    const result = await Dialog.prompt({
      title: triggerData.name || "Divine Ki Roll Boost",
      content: `
        <form>
          <div class="form-group">
            <label>Divine Ki Points to spend (max ${spendCap})</label>
            <input type="number" name="dkpSpend" min="0" max="${spendCap}" step="1" value="1" />
          </div>
          <div class="form-group">
            <label>Roll to boost</label>
            <select name="rollType">
              <option value="Strike">Strike</option>
              <option value="Dodge">Dodge</option>
            </select>
          </div>
        </form>`,
      callback: (html) => ({
        spend: Number(html.find("[name='dkpSpend']").val()) || 0,
        rollType: String(html.find("[name='rollType']").val() || "Strike")
      }),
      rejectClose: false
    });

    const spend = Math.min(spendCap, Math.max(0, Number(result?.spend) || 0));
    if (spend <= 0) return "cancelled";

    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, currentDKP - spend) });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Ki Roll Boost");

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points to increase a <b>${result?.rollType === "Dodge" ? "Dodge" : "Strike"}</b> Roll by <b>${spend}</b>.</div>`
    });

    return true;
  },

  async _handleDivineKiOOSTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/spend 4\(bT\) divine ki points to use any maneuver with an action cost of 1 action as an out-of-sequence maneuver/i.test(desc)) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = 4 * baseTier;
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    if (currentDKP < spend) {
      ui.notifications?.warn("Not enough Divine Ki Points to use this trigger.");
      return "blocked";
    }

    const maneuver = await Dialog.prompt({
      title: triggerData.name || "Divine Energy",
      content: `<form><div class="form-group"><label>Maneuver used OoS</label><input type="text" name="maneuver" value="" /></div></form>`,
      callback: (html) => String(html.find("[name='maneuver']").val() || "").trim(),
      rejectClose: false
    });
    if (!maneuver) return "cancelled";

    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, currentDKP - spend) });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Energy");

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points to use <b>${foundry.utils.escapeHTML(maneuver)}</b> as an Out-of-Sequence Maneuver.</div>`
    });

    return true;
  },

  async _applyDivineKiRecoveryTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const btMatch = desc.match(/regain\s+(\d+)\(bT\)\s+divine ki points/i);
    if (!btMatch) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const gain = Number(btMatch[1]) * baseTier;
    if (!(gain > 0)) return false;

    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
    const nextDKP = Math.min(maxDKP, currentDKP + gain);
    const actualGain = nextDKP - currentDKP;
    if (actualGain <= 0) return true;

    await this.actor.update({ "system.divineKiPoints.value": nextDKP });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Regained <b>${actualGain}</b> Divine Ki Points.</div>`
    });
    return true;
  },

  async _handleDivineKiStateTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/spend\s+(\d+)\(bT\)\s+divine ki points to enter the\s+(superior|surging)\s+state/i);
    if (!match) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = Number(match[1]) * baseTier;
    const stateKey = String(match[2] || "").toLowerCase() === "surging" ? "surging" : "superior";
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    if (currentDKP < spend) {
      ui.notifications?.warn("Not enough Divine Ki Points to use this trigger.");
      return "blocked";
    }

    await this.actor.update({
      "system.divineKiPoints.value": Math.max(0, currentDKP - spend),
      [`system.combatStates.${stateKey}`]: true
    });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Ki State");

    const stateLabel = stateKey === "surging" ? "Surging" : "Superior";
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points and entered the <b>${stateLabel}</b> State.</div>`
    });
    return true;
  },

  async _handleDivineKiManeuverTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (/use any maneuver with an action cost of 1 action as an out-of-sequence maneuver/i.test(desc)) return false;

    const match = desc.match(/spend\s+(\d+)\(bT\)\s+divine ki points to use the\s+(.+?)\s+maneuver(?:\s+or\s+(.+?)\s+maneuver)?\s+as an\s+(instant|out-of-sequence)\s+maneuver/i);
    if (!match) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = Number(match[1]) * baseTier;
    const optionA = String(match[2] || "").trim();
    const optionB = String(match[3] || "").trim();
    const timing = String(match[4] || "").toLowerCase() === "instant" ? "Instant" : "Out-of-Sequence";
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    if (currentDKP < spend) {
      ui.notifications?.warn("Not enough Divine Ki Points to use this trigger.");
      return "blocked";
    }

    let maneuver = optionA;
    if (optionB) {
      const chosen = await Dialog.prompt({
        title: triggerData.name || "Divine Ki Maneuver",
        content: `<form><div class="form-group"><label>Maneuver</label><select name="maneuver"><option value="${foundry.utils.escapeHTML(optionA)}">${foundry.utils.escapeHTML(optionA)}</option><option value="${foundry.utils.escapeHTML(optionB)}">${foundry.utils.escapeHTML(optionB)}</option></select></div></form>`,
        callback: (html) => String(html.find("[name='maneuver']").val() || optionA),
        rejectClose: false
      });
      if (!chosen) return "cancelled";
      maneuver = chosen;
    }

    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, currentDKP - spend) });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Ki Maneuver");

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points to use <b>${foundry.utils.escapeHTML(maneuver)}</b> as an <b>${timing}</b> Maneuver.</div>`
    });
    return true;
  },

  async _handleDivineKiHealingSurgeTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/spend\s+(\d+)\(bT\)\s+divine ki points to use a healing surge as an instant maneuver/i);
    if (!match) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = Number(match[1]) * baseTier;
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    if (currentDKP < spend) {
      ui.notifications?.warn("Not enough Divine Ki Points to use Healing Surge.");
      return "blocked";
    }

    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, currentDKP - spend) });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Healing Surge");

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points to use <b>Healing Surge</b> as an <b>Instant</b> Maneuver.</div>`
    });
    return true;
  },

  async _handlePerfectPointManeuverTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/spend\s+(\d+)\s+perfect points to use the\s+(.+?)\s+maneuver(?:\s+or\s+(.+?)\s+maneuver)?\s+as an instant maneuver/i);
    if (!match) return false;

    const spend = Number(match[1]) || 0;
    const currentPP = this.actor.system.tracking?.perfectPoints ?? 0;
    if (currentPP < spend) {
      ui.notifications?.warn("Not enough Perfect Points to use this trigger.");
      return "blocked";
    }

    const optionA = String(match[2] || "").trim();
    const optionB = String(match[3] || "").trim();
    let maneuver = optionA;
    if (optionB) {
      const chosen = await Dialog.prompt({
        title: triggerData.name || "Perfect Points",
        content: `<form><div class="form-group"><label>Maneuver</label><select name="maneuver"><option value="${foundry.utils.escapeHTML(optionA)}">${foundry.utils.escapeHTML(optionA)}</option><option value="${foundry.utils.escapeHTML(optionB)}">${foundry.utils.escapeHTML(optionB)}</option></select></div></form>`,
        callback: (html) => String(html.find("[name='maneuver']").val() || optionA),
        rejectClose: false
      });
      if (!chosen) return "cancelled";
      maneuver = chosen;
    }

    await this.actor.update({ "system.tracking.perfectPoints": Math.max(0, currentPP - spend) });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-circle"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Perfect Points to use <b>${foundry.utils.escapeHTML(maneuver)}</b> as an <b>Instant</b> Maneuver.</div>`
    });
    return true;
  },

  async _handleKiSurgingTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/spend\s+(\d+)\(bT\)\s+ki points? to enter the surging state until the end of your next turn/i);
    if (!match) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = Number(match[1]) * baseTier;
    const currentKP = this.actor.system.kiPool?.value ?? 0;
    if (currentKP < spend) {
      ui.notifications?.warn("Not enough Ki Points to enter the Surging State.");
      return "blocked";
    }

    await this.actor.update({
      "system.kiPool.value": Math.max(0, currentKP - spend),
      "system.combatStates.surging": true
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-bolt"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Ki Points and entered the <b>Surging</b> State until the end of your next turn.</div>`
    });
    return true;
  },

  async _handleLifeforceGainTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/gain\s+1\s+lifeforce/i);
    if (!match) return false;

    const current = this.actor.system.tracking?.lifeforce ?? 0;
    await this.actor.update({ "system.tracking.lifeforce": current + 1 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-heart"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Gained <b>1</b> Lifeforce.</div>`
    });
    return true;
  },

  async _handleLifeforceSpendTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const current = this.actor.system.tracking?.lifeforce ?? 0;
    if (current <= 0) return false;

    if (/spend any amount of lifeforce up to 1\/2 \(rounded up\) of z/i.test(desc)) {
      const maxSpend = current;
      const result = await Dialog.prompt({
        title: triggerData.name || "Lifeforce",
        content: `<form><div class="form-group"><label>Lifeforce to spend (max ${maxSpend})</label><input type="number" name="lfSpend" min="0" max="${maxSpend}" step="1" value="1" /></div></form>`,
        callback: (html) => Number(html.find("[name='lfSpend']").val()) || 0,
        rejectClose: false
      });
      const spend = Math.min(maxSpend, Math.max(0, Number(result) || 0));
      if (spend <= 0) return "cancelled";

      const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
      const currentCharges = this.actor.system.tracking?.energyCharges ?? 0;
      await this.actor.update({
        "system.tracking.lifeforce": current - spend,
        "system.tracking.energyCharges": currentCharges + spend
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-heart"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Lifeforce<br>Signature Technique: <b>-${spend * baseTier}</b> KP cost and <b>+${spend}</b> Energy Charge${spend === 1 ? "" : "s"}.</div>`
      });
      return true;
    }

    if (/spend 1 or 2 lifeforce to enter the superior state/i.test(desc) || /spend 2 or 3 lifeforce to enter the surging state/i.test(desc)) {
      const options = [];
      if (current >= 1) options.push({ value: "power", label: "1 Lifeforce -> +1 Power" });
      if (current >= 1) options.push({ value: "superior1", label: "1 Lifeforce -> Superior until end of turn" });
      if (current >= 2) options.push({ value: "superior2", label: "2 Lifeforce -> Superior until end of next turn" });
      if (current >= 2) options.push({ value: "surging2", label: "2 Lifeforce -> Surging until end of next turn" });
      if (current >= 3) options.push({ value: "surging3", label: "3 Lifeforce -> Surging until end of next turn (ignore 2nd effect)" });
      if (options.length === 0) return "blocked";

      const chosen = await Dialog.prompt({
        title: triggerData.name || "Lifeforce",
        content: `<form><div class="form-group"><label>Effect</label><select name="effect">${options.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></div></form>`,
        callback: (html) => String(html.find("[name='effect']").val() || ""),
        rejectClose: false
      });
      if (!chosen) return "cancelled";

      const updates = {};
      let spend = 0;
      let msg = "";
      if (chosen === "power") {
        spend = 1;
        const currentPower = this.actor.system.tracking?.powerStacks ?? 0;
        updates["system.tracking.powerStacks"] = currentPower + 1;
        msg = "Gained <b>1</b> stack of Power from this Power Up.";
      } else if (chosen === "superior1") {
        spend = 1;
        updates["system.combatStates.superior"] = true;
        msg = "Entered the <b>Superior</b> State until the end of your turn.";
      } else if (chosen === "superior2") {
        spend = 2;
        updates["system.combatStates.superior"] = true;
        msg = "Entered the <b>Superior</b> State until the end of your next turn.";
      } else if (chosen === "surging2") {
        spend = 2;
        updates["system.combatStates.surging"] = true;
        msg = "Entered the <b>Surging</b> State until the end of your next turn.";
      } else if (chosen === "surging3") {
        spend = 3;
        updates["system.combatStates.surging"] = true;
        msg = "Entered the <b>Surging</b> State until the end of your next turn and ignores its 2nd effect.";
      }

      if (!(spend > 0) || current < spend) return "blocked";
      updates["system.tracking.lifeforce"] = current - spend;
      await this.actor.update(updates);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-heart"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Lifeforce<br>${msg}</div>`
      });
      return true;
    }

    return false;
  },

  _getBattleBornTotal() {
    const bb = this.actor.system.battleBorn || {};
    return (bb.strike ?? 0) + (bb.dodge ?? 0) + (bb.wound ?? 0);
  },

  async _applyBattleBornGainSideEffects(source = "Battle Born") {
    const transformations = this.actor.system.transformations || [];
    const active = transformations.filter(t => t?.active);
    if (active.length === 0) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    let lpGain = 0;
    let dkpGain = 0;

    for (const trans of active) {
      const effects = this._getResolvedTransformationEffects(trans, transformations);
      for (const effect of effects) {
        const text = String(effect?.text || "");
        let match = text.match(/(?:if|upon)\s+gaining\s+(?:a stack|\w+\s+stack\(s\))\s+of\s+battle born.*?regain\s+(\d+)\(bT\)\s+life points?\s+and\s+(\d+)\(bT\)\s+divine ki points?/i);
        if (match) {
          lpGain += Number(match[1]) * baseTier;
          dkpGain += Number(match[2]) * baseTier;
          continue;
        }
        match = text.match(/(?:if|upon)\s+gaining\s+(?:a stack|\w+\s+stack\(s\))\s+of\s+battle born.*?regain\s+(\d+)\(bT\)\s+divine ki points?/i);
        if (match) {
          dkpGain += Number(match[1]) * baseTier;
        }
      }
    }

    if (!(lpGain > 0 || dkpGain > 0)) return false;

    const updates = {};
    const currentLP = this.actor.system.health?.value ?? 0;
    const maxLP = this.actor.system.health?.max ?? 0;
    const nextLP = Math.min(maxLP, currentLP + lpGain);
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
    const nextDKP = Math.min(maxDKP, currentDKP + dkpGain);
    if (nextLP > currentLP) updates["system.health.value"] = nextLP;
    if (nextDKP > currentDKP) updates["system.divineKiPoints.value"] = nextDKP;
    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> Battle Born</b><br>${foundry.utils.escapeHTML(source)}<br>${nextLP > currentLP ? `Regained <b>${nextLP - currentLP}</b> LP` : ""}${nextLP > currentLP && nextDKP > currentDKP ? "<br>" : ""}${nextDKP > currentDKP ? `Regained <b>${nextDKP - currentDKP}</b> Divine Ki Points` : ""}</div>`
    });
    return true;
  },

  async _applyBattleBornOverflowSideEffects(source = "Battle Born") {
    const transformations = this.actor.system.transformations || [];
    const active = transformations.filter(t => t?.active);
    if (active.length === 0) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    let dkpGain = 0;
    for (const trans of active) {
      const effects = this._getResolvedTransformationEffects(trans, transformations);
      for (const effect of effects) {
        const text = String(effect?.text || "");
        const match = text.match(/if you would gain a stack of battle born.*?maximum number of battle born stacks.*?regain\s+(\d+)\(bT\)\s+divine ki points?/i);
        if (match) dkpGain += Number(match[1]) * baseTier;
      }
    }
    if (!(dkpGain > 0)) return false;

    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
    const nextDKP = Math.min(maxDKP, currentDKP + dkpGain);
    if (nextDKP <= currentDKP) return true;
    await this.actor.update({ "system.divineKiPoints.value": nextDKP });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> Battle Born Overflow</b><br>${foundry.utils.escapeHTML(source)}<br>Regained <b>${nextDKP - currentDKP}</b> Divine Ki Points.</div>`
    });
    return true;
  },

  async _spendBattleBornStacks(amount, title = "Battle Born") {
    const bb = foundry.utils.deepClone(this.actor.system.battleBorn || { strike: 0, dodge: 0, wound: 0, undying: false });
    const total = (bb.strike ?? 0) + (bb.dodge ?? 0) + (bb.wound ?? 0);
    if (total < amount) return false;

    let remaining = amount;
    const order = ["wound", "strike", "dodge"];
    for (const key of order) {
      const available = bb[key] ?? 0;
      if (available <= 0) continue;
      const spend = Math.min(available, remaining);
      bb[key] = available - spend;
      remaining -= spend;
      if (remaining <= 0) break;
    }
    if (remaining > 0) return false;

    await this.actor.update({ "system.battleBorn": bb });
    ui.notifications.info(`${title}: spent ${amount} Battle Born.`);
    return true;
  },

  async _handleBattleBornGainTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/gain a stack of battle born/i.test(desc)) return false;
    const result = await this._battleBornGrantStack(triggerData.name || triggerData.sourceName || "Battle Born");
    if (result === "cancelled") return "cancelled";
    return !!result;
  },

  async _handleBattleBornSpendTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const total = this._getBattleBornTotal();
    if (total <= 0) return false;

    if (/spend 1 battle born to regain 12\(bT\) divine ki points/i.test(desc)) {
      const spent = await this._spendBattleBornStacks(1, triggerData.name || "Battle Born");
      if (!spent) return "blocked";
      const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
      const gain = 12 * baseTier;
      const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
      const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
      await this.actor.update({ "system.divineKiPoints.value": Math.min(maxDKP, currentDKP + gain) });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>1</b> Battle Born and regained <b>${Math.min(gain, maxDKP - currentDKP)}</b> Divine Ki Points.</div>`
      });
      return true;
    }

    if (/spend a stack of battle born to increase the damage category of that attacking maneuver by 1 category/i.test(desc)) {
      const spent = await this._spendBattleBornStacks(1, triggerData.name || "Battle Born");
      if (!spent) return "blocked";
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>1</b> Battle Born to increase the Damage Category by <b>1</b>.</div>`
      });
      return true;
    }

    if (/spend a stack of battle born to apply your greater dice to the wound roll/i.test(desc)) {
      const spent = await this._spendBattleBornStacks(1, triggerData.name || "Battle Born");
      if (!spent) return "blocked";
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>1</b> Battle Born to apply <b>Greater Dice</b> to the Wound Roll.</div>`
      });
      return true;
    }

    if (/spend any number of battle born stacks.*gain an energy charge for each stack of battle born spent/i.test(desc)) {
      const spendRaw = await Dialog.prompt({
        title: triggerData.name || "Battle Born",
        content: `<form><div class="form-group"><label>Battle Born to spend (max ${total})</label><input type="number" name="bbSpend" min="0" max="${total}" step="1" value="1" /></div></form>`,
        callback: (html) => Number(html.find("[name='bbSpend']").val()) || 0,
        rejectClose: false
      });
      const spend = Math.min(total, Math.max(0, Number(spendRaw) || 0));
      if (spend <= 0) return "cancelled";
      const spent = await this._spendBattleBornStacks(spend, triggerData.name || "Battle Born");
      if (!spent) return "blocked";
      const currentCharges = this.actor.system.tracking?.energyCharges ?? 0;
      await this.actor.update({ "system.tracking.energyCharges": currentCharges + spend });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-fire"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Battle Born and gained <b>${spend}</b> Energy Charge${spend === 1 ? "" : "s"}.</div>`
      });
      return true;
    }

    return false;
  },

  async _handlePowerGainTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const gainTwo = /gain 2 stacks of power until the end of your next turn/i.test(desc);
    const gainOne = /gain a stack of power until the end of your next turn/i.test(desc) || /gain a stack of power until the end of your turn/i.test(desc);
    if (!gainTwo && !gainOne) return false;

    const currentPower = this.actor.system.tracking?.powerStacks ?? 0;
    const amount = gainTwo ? 2 : 1;
    await this.actor.update({ "system.tracking.powerStacks": currentPower + amount });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-bolt"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Gained <b>${amount}</b> stack${amount === 1 ? "" : "s"} of Power.</div>`
    });
    return true;
  },

  async _handleDivineKiPowerLevelRecoveryTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    if (!/divine ki points equal to twice your power level/i.test(desc)) return false;

    const gain = 2 * (this.actor.system.level || 1);
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
    const actualGain = Math.max(0, Math.min(maxDKP, currentDKP + gain) - currentDKP);
    await this.actor.update({ "system.divineKiPoints.value": Math.min(maxDKP, currentDKP + gain) });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Regained <b>${actualGain}</b> Divine Ki Points.</div>`
    });
    return true;
  },

  async _handleDivineKiEnergyChargeTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    let match = desc.match(/spend\s+(\d+)\(bT\)\s+divine ki points to gain an additional energy charge/i);
    if (match) {
      const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
      const spend = Number(match[1]) * baseTier;
      const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
      if (currentDKP < spend) {
        ui.notifications?.warn("Not enough Divine Ki Points to gain an additional Energy Charge.");
        return "blocked";
      }
      const currentCharges = this.actor.system.tracking?.energyCharges ?? 0;
      await this.actor.update({
        "system.divineKiPoints.value": Math.max(0, currentDKP - spend),
        "system.tracking.energyCharges": currentCharges + 1
      });
      await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Ki Energy Charge");
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points and gained <b>1</b> additional Energy Charge.</div>`
      });
      return true;
    }

    match = desc.match(/for every\s+(\d+)\(bT\)\s+divine ki points spent,\s*gain a stack of power/i);
    if (!match) return false;

    const step = Number(match[1]);
    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    const maxSpend = currentDKP;
    if (maxSpend <= 0) {
      ui.notifications?.warn("Not enough Divine Ki Points to gain Power.");
      return "blocked";
    }
    const spendRaw = await Dialog.prompt({
      title: triggerData.name || "Divine Ki Power",
      content: `<form><div class="form-group"><label>Divine Ki Points to spend (multiples of ${step * baseTier})</label><input type="number" name="dkpSpend" min="0" max="${maxSpend}" step="${step * baseTier}" value="${step * baseTier}" /></div></form>`,
      callback: (html) => Number(html.find("[name='dkpSpend']").val()) || 0,
      rejectClose: false
    });
    const spend = Math.min(maxSpend, Math.max(0, Number(spendRaw) || 0));
    const normalizedSpend = Math.floor(spend / (step * baseTier)) * step * baseTier;
    if (normalizedSpend <= 0) return "cancelled";

    const powerGain = Math.floor(normalizedSpend / (step * baseTier));
    const currentPower = this.actor.system.tracking?.powerStacks ?? 0;
    await this.actor.update({
      "system.divineKiPoints.value": Math.max(0, currentDKP - normalizedSpend),
      "system.tracking.powerStacks": currentPower + powerGain
    });
    await this._applyDivineKiSpendSideEffects(normalizedSpend, triggerData.name || "Divine Ki Power");
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${normalizedSpend}</b> Divine Ki Points and gained <b>${powerGain}</b> stack${powerGain === 1 ? "" : "s"} of Power.</div>`
    });
    return true;
  },

  async _handleDivineKiDamageCategoryTrigger(triggerData) {
    const desc = String(triggerData?.description || "");
    const match = desc.match(/spend\s+(\d+)\(bT\)\s+divine ki points to increase the damage category(?: of that attacking maneuver)? by 1 category/i);
    if (!match) return false;

    const baseTier = this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2);
    const spend = Number(match[1]) * baseTier;
    const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
    if (currentDKP < spend) {
      ui.notifications?.warn("Not enough Divine Ki Points to increase the Damage Category.");
      return "blocked";
    }

    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, currentDKP - spend) });
    await this._applyDivineKiSpendSideEffects(spend, triggerData.name || "Divine Ki Damage Category");
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>Spent <b>${spend}</b> Divine Ki Points to increase the Damage Category by <b>1</b>.</div>`
    });
    return true;
  },

  async _onEnhancementPowerTrigger(event) {
    event.preventDefault();
    const triggerId = event.currentTarget.dataset.triggerId;
    const epBonuses = this.actor.system.enhancementPowerBonuses || {};
    let triggerData = null;
    for (const entry of (epBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `ep:${found.id}` }; break; }
    }
    if (!triggerData) return;

    if (triggerData.usageLimit || triggerData.maxUses) {
      const tracked = await this._trackCombatUsage(triggerData.trackingId, triggerData.usageLimit, triggerData.maxUses || 0, triggerData.name);
      if (!tracked) return;
    }

    const handledJusticeConversion = await this._handleJusticeChargeKiConversion(triggerData);
    if (handledJusticeConversion === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledJusticeConversion) return;
    const handledLifeforceGain = await this._handleLifeforceGainTrigger(triggerData);
    if (handledLifeforceGain) return;
    const handledLifeforceSpend = await this._handleLifeforceSpendTrigger(triggerData);
    if (handledLifeforceSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledLifeforceSpend) return;
    const handledBattleBornGain = await this._handleBattleBornGainTrigger(triggerData);
    if (handledBattleBornGain) return;
    const handledBattleBornSpend = await this._handleBattleBornSpendTrigger(triggerData);
    if (handledBattleBornSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledBattleBornSpend) return;
    const handledKiSurging = await this._handleKiSurgingTrigger(triggerData);
    if (handledKiSurging === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledKiSurging) return;
    const handledPerfectPointManeuver = await this._handlePerfectPointManeuverTrigger(triggerData);
    if (handledPerfectPointManeuver === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledPerfectPointManeuver) return;

    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const resourceChanged = this._applyJusticeChargeTriggerResource(specialResources, triggerData);
    if (resourceChanged) {
      await this.actor.update({ "system.transformationMeta.specialResources": specialResources });
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-bolt"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>${triggerData.description}</div>`
    });
  },

  async _onAlternateFormTrigger(event) {
    event.preventDefault();
    const triggerId = event.currentTarget.dataset.triggerId;
    const afBonuses = this.actor.system.alternateFormBonuses || {};
    let triggerData = null;
    for (const entry of (afBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `af:${found.id}` }; break; }
    }
    if (!triggerData) return;

    if (triggerData.usageLimit || triggerData.maxUses) {
      const tracked = await this._trackCombatUsage(triggerData.trackingId, triggerData.usageLimit, triggerData.maxUses || 0, triggerData.name);
      if (!tracked) return;
    }

    const handledLifeforceGain = await this._handleLifeforceGainTrigger(triggerData);
    if (handledLifeforceGain) return;
    const handledLifeforceSpend = await this._handleLifeforceSpendTrigger(triggerData);
    if (handledLifeforceSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledLifeforceSpend) return;
    const handledPowerGain = await this._handlePowerGainTrigger(triggerData);
    if (handledPowerGain) return;
    const handledBattleBornGain = await this._handleBattleBornGainTrigger(triggerData);
    if (handledBattleBornGain === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledBattleBornGain) return;
    const handledBattleBornSpend = await this._handleBattleBornSpendTrigger(triggerData);
    if (handledBattleBornSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledBattleBornSpend) return;
    const handledPerfectPointManeuver = await this._handlePerfectPointManeuverTrigger(triggerData);
    if (handledPerfectPointManeuver === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledPerfectPointManeuver) return;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-exchange-alt"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>${triggerData.description}</div>`
    });
  },

  async _onLegendaryFormTrigger(event) {
    event.preventDefault();
    const triggerId = event.currentTarget.dataset.triggerId;
    const lfBonuses = this.actor.system.legendaryFormBonuses || {};
    let triggerData = null;
    for (const entry of (lfBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `lf:${found.id}` }; break; }
    }
    if (!triggerData) return;

    const handledAdvantageSuperiorPrecheck = await this._handleAdvantagePointSuperiorTrigger({ ...triggerData, dryRun: true });
    if (handledAdvantageSuperiorPrecheck === "blocked") return;

    if (triggerData.usageLimit || triggerData.maxUses) {
      const tracked = await this._trackCombatUsage(triggerData.trackingId, triggerData.usageLimit, triggerData.maxUses || 0, triggerData.name);
      if (!tracked) return;
    }

    const handledLifeforceGain = await this._handleLifeforceGainTrigger(triggerData);
    if (handledLifeforceGain) return;
    const handledLifeforceSpend = await this._handleLifeforceSpendTrigger(triggerData);
    if (handledLifeforceSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledLifeforceSpend) return;
    const handledPowerGain = await this._handlePowerGainTrigger(triggerData);
    if (handledPowerGain) return;
    const handledBattleBornGain = await this._handleBattleBornGainTrigger(triggerData);
    if (handledBattleBornGain === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledBattleBornGain) return;
    const handledBattleBornSpend = await this._handleBattleBornSpendTrigger(triggerData);
    if (handledBattleBornSpend === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledBattleBornSpend) return;
    const handledAdvantageSuperior = await this._handleAdvantagePointSuperiorTrigger(triggerData);
    if (handledAdvantageSuperior) return;
    const handledAdvantageSignature = await this._handleAdvantagePointSignatureTrigger(triggerData);
    if (handledAdvantageSignature === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledAdvantageSignature) return;
    const handledDivineKiConversion = await this._handleDivineKiConversionTrigger(triggerData);
    if (handledDivineKiConversion === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiConversion) return;
    const handledDivineKiRollBoost = await this._handleDivineKiRollBoostTrigger(triggerData);
    if (handledDivineKiRollBoost === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiRollBoost) return;
    const handledDivineKiOOS = await this._handleDivineKiOOSTrigger(triggerData);
    if (handledDivineKiOOS === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiOOS) return;
    const handledDivineKiHealingSurge = await this._handleDivineKiHealingSurgeTrigger(triggerData);
    if (handledDivineKiHealingSurge === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiHealingSurge) return;
    const handledDivineKiState = await this._handleDivineKiStateTrigger(triggerData);
    if (handledDivineKiState === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiState) return;
    const handledDivineKiManeuver = await this._handleDivineKiManeuverTrigger(triggerData);
    if (handledDivineKiManeuver === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiManeuver) return;
    const handledDivineKiPowerLevelRecovery = await this._handleDivineKiPowerLevelRecoveryTrigger(triggerData);
    if (handledDivineKiPowerLevelRecovery) return;
    const handledDivineKiEnergyCharge = await this._handleDivineKiEnergyChargeTrigger(triggerData);
    if (handledDivineKiEnergyCharge === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledDivineKiEnergyCharge) return;
    const handledDivineKiDamageCategory = await this._handleDivineKiDamageCategoryTrigger(triggerData);
    if (handledDivineKiDamageCategory) return;
    const handledKiSurging = await this._handleKiSurgingTrigger(triggerData);
    if (handledKiSurging === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledKiSurging) return;
    const handledPerfectPointManeuver = await this._handlePerfectPointManeuverTrigger(triggerData);
    if (handledPerfectPointManeuver === "cancelled") {
      await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit);
      return;
    }
    if (handledPerfectPointManeuver) return;
    const handledDivineKiRecovery = await this._applyDivineKiRecoveryTrigger(triggerData);
    if (handledDivineKiRecovery) return;

    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    let resourceChanged = false;
    const desc = String(triggerData.description || "");
    const sourceKey = String(triggerData.trackingId || "");
    if (/gain a stack of ego/i.test(desc)) {
      const current = specialResources.ego?.value ?? 0;
      const max = 6;
      const next = Math.min(max, current + 1);
      if (next > current) {
        specialResources.ego = {
          value: next,
          max,
          source: sourceKey,
          sourceName: triggerData.sourceName || "Ultra Ego"
        };
        resourceChanged = true;
      }
    }
    if (this._applyJusticeChargeTriggerResource(specialResources, triggerData)) {
      resourceChanged = true;
    }
    if (/gain 2 advantage points/i.test(desc)) {
      const current = specialResources.advantagePoints?.value ?? 0;
      const max = Math.max(specialResources.advantagePoints?.max ?? 0, 12);
      const next = Math.min(max, current + 2);
      if (next > current) {
        specialResources.advantagePoints = {
          value: next,
          max,
          source: sourceKey,
          sourceName: triggerData.sourceName || "Advantage Points"
        };
        resourceChanged = true;
      }
    } else if (/gain an advantage point/i.test(desc)) {
      const current = specialResources.advantagePoints?.value ?? 0;
      const max = Math.max(specialResources.advantagePoints?.max ?? 0, 12);
      const next = Math.min(max, current + 1);
      if (next > current) {
        specialResources.advantagePoints = {
          value: next,
          max,
          source: sourceKey,
          sourceName: triggerData.sourceName || "Advantage Points"
        };
        resourceChanged = true;
      }
    }
    if (resourceChanged) {
      await this.actor.update({ "system.transformationMeta.specialResources": specialResources });
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-crown"></i> ${triggerData.name}</b> <small>(${triggerData.sourceName})</small><br>${triggerData.description}</div>`
    });
  },

  /**
   * Handle clicking a Talent triggered effect button in Combat tab.
   */
  async _onTalentTrigger(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const triggerId = btn.dataset.triggerId;

    // Special handling for Patient Fighter initiative transfer
    if (triggerId === "patient_fighter_transfer") {
      return this._onPatientFighterTransfer(event);
    }

    const tbBonuses = this.actor.system.talentBonuses || {};
    let triggerData = null;
    for (const entry of (tbBonuses.entries || [])) {
      const found = (entry.triggered || []).find(t => t.id === triggerId);
      if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `tb:${found.id}` }; break; }
    }
    if (!triggerData) return;

    return this._runTriggerAutomationAndChat(triggerData, "fas fa-gem");
  },

  /**
   * Handle Patient Fighter initiative transfer.
   * Opens dialog to select ally, transfers initiative from self to ally.
   */
  async _onPatientFighterTransfer(event) {
    const combat = game.combat;
    if (!combat) {
      ui.notifications.warn("No active combat encounter.");
      return;
    }
    const myCombatant = combat.combatants.find(c => c.actorId === this.actor.id);
    if (!myCombatant || myCombatant.initiative === null) {
      ui.notifications.warn("You must have rolled initiative first.");
      return;
    }

    const tier = this.actor.system.tier ?? 1;
    const transferAmount = tier;

    // Find allies (same disposition)
    const myDisp = myCombatant.token?.disposition ?? 1;
    const allies = combat.combatants.filter(c =>
      c.id !== myCombatant.id &&
      (c.token?.disposition ?? 1) === myDisp &&
      c.initiative !== null
    );

    if (allies.length === 0) {
      ui.notifications.warn("No allies with rolled initiative found.");
      return;
    }

    // Build dialog options
    const options = allies.map(a => `<option value="${a.id}">${a.name} (Init: ${a.initiative})</option>`).join("");
    const content = `
      <form>
        <div class="form-group">
          <label>Transfer ${transferAmount} Initiative to:</label>
          <select name="allyId">${options}</select>
        </div>
        <p style="color:#aaa;font-size:0.85em;">Your Initiative will decrease by ${transferAmount}.</p>
      </form>`;

    const result = await Dialog.wait({
      title: "Patient Fighter — Transfer Initiative",
      content,
      buttons: {
        transfer: { icon: '<i class="fas fa-exchange-alt"></i>', label: "Transfer", callback: (html) => html.find("[name=allyId]").val() },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => null }
      },
      default: "transfer",
      close: () => null
    }, { classes: ["dbu-old", "dialog"] });

    if (!result) return;

    const allyCombatant = combat.combatants.get(result);
    if (!allyCombatant) return;

    // Update initiatives
    await myCombatant.update({ initiative: myCombatant.initiative - transferAmount });
    await allyCombatant.update({ initiative: allyCombatant.initiative + transferAmount });

    // Post chat message
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>Patient Fighter</b> — Transferred ${transferAmount} Initiative to <b>${allyCombatant.name}</b>.`
    });
  },

  /**
   * Handle clicking a Talent stance shift button (Combat Expertise / Balanced Defender).
   */
  async _onTalentStanceShift(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const stanceId = btn.dataset.stance;
    const system = this.actor.system;
    const tier = system.tier ?? 1;
    const baseTier = system.baseTier || 1;
    const maxShift = 2 * baseTier;

    let title, dirOptions;
    if (stanceId === "combat_expertise") {
      title = "Combat Expertise — Shift Stance";
      dirOptions = `<option value="def_to_aw">Defense → Awareness</option>
        <option value="aw_to_def">Awareness → Defense</option>`;
    } else if (stanceId === "balanced_defender") {
      title = "Balanced Defender — Shift Defense";
      dirOptions = `<option value="def_to_soak">Defense → Soak</option>
        <option value="soak_to_def">Soak → Defense</option>`;
    } else return;

    const content = `<form>
      <div class="form-group"><label>Direction</label>
        <select name="direction">${dirOptions}</select></div>
      <div class="form-group"><label>Amount (0–${maxShift})</label>
        <input type="number" name="amount" value="0" min="0" max="${maxShift}" /></div>
    </form>`;

    const result = await Dialog.wait({
      title,
      content,
      buttons: {
        apply: { icon: '<i class="fas fa-check"></i>', label: "Apply", callback: html => {
          const direction = html.find("[name=direction]").val();
          const amount = Math.max(0, Math.min(maxShift, parseInt(html.find("[name=amount]").val()) || 0));
          return { direction, amount };
        }},
        reset: { icon: '<i class="fas fa-undo"></i>', label: "Reset", callback: () => ({ direction: null, amount: 0 }) }
      },
      default: "apply"
    });

    if (!result) return;

    const tempMods = foundry.utils.deepClone(system.combatTabState?.talentTempMods || {});
    if (result.amount === 0 || !result.direction) {
      delete tempMods[stanceId];
    } else {
      tempMods[stanceId] = { direction: result.direction, amount: result.amount };
    }
    await this.actor.update({ "system.combatTabState.talentTempMods": tempMods });

    // Post chat message
    if (result.amount > 0 && result.direction) {
      const dirLabel = result.direction.replace(/_/g, " ").replace(/to/g, "→");
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.85rem"><b><i class="fas fa-exchange-alt"></i> ${title}</b><br>Shift: ${dirLabel} (${result.amount})</div>`
      });
    }
  },
};
