import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: combat-resources. Methods run with the sheet as this. */
export const combatResourcesMethods = {

  _decorateTriggeredEffects(effects, system, prefix) {
    const usage = system.combatTabState?.resourceUsage || {};
    const roundUsage = usage.round || {};
    const encounterUsage = usage.encounter || {};
    return effects.map(effect => {
      const trackingId = `${prefix}:${effect.id}`;
      const usageKey = /encounter/i.test(String(effect.usageLimit || "")) ? "encounter" : "round";
      const usedCount = (usageKey === "encounter" ? encounterUsage : roundUsage)[trackingId] || 0;
      const maxUses = effect.maxUses || 0;
      return {
        ...effect,
        trackingId,
        usedCount,
        isMaxed: maxUses > 0 && usedCount >= maxUses
      };
    });
  },

  _resolveTrackedEffectResource(effectId, system) {
    const [prefix, rawId] = String(effectId).split(":");
    if (!prefix || !rawId) return null;

    const maps = {
      tb: {
        sourceType: "talent",
        entries: system.talentBonuses?.entries || []
      },
      mp: {
        sourceType: "transformation",
        entries: system.manifestedPowerBonuses?.entries || []
      },
      ep: {
        sourceType: "transformation",
        entries: system.enhancementPowerBonuses?.entries || []
      },
      af: {
        sourceType: "transformation",
        entries: system.alternateFormBonuses?.entries || []
      },
      lf: {
        sourceType: "transformation",
        entries: system.legendaryFormBonuses?.entries || []
      },
      lt: {
        sourceType: "racial",
        entries: system.legendaryTraitBonuses?.entries || []
      }
    };

    const group = maps[prefix];
    if (!group) return null;

    for (const entry of group.entries) {
      const trigger = (entry.triggered || []).find(t => t.id === rawId);
      if (!trigger) continue;
      return {
        id: effectId,
        sourceName: entry.name || entry.sourceName || trigger.name,
        sourceType: group.sourceType,
        level: trigger.level || 0,
        activationType: "triggered",
        usageLimit: trigger.usageLimit || "round",
        maxUses: trigger.maxUses || 0,
        keyword: trigger.name || "Triggered",
        text: trigger.description || "",
        isTrackable: true
      };
    }

    return null;
  },

  // -------------------------------------------------------
  // Counter Buttons
  // -------------------------------------------------------

  // -------------------------------------------------------
  // Custom Buff CRUD
  // -------------------------------------------------------

  async _onAddCustomBuff(event) {
    event.preventDefault();
    const buffs = foundry.utils.deepClone(this.actor.system.customBuffs || []);
    const nextId = buffs.length > 0 ? Math.max(...buffs.map(b => b.id || 0)) + 1 : 1;
    buffs.push({ id: nextId, name: "", active: true, effect: "", flat: 0, bT: 0, T: 0 });
    await this.actor.update({ "system.customBuffs": buffs });
  },

  async _onDeleteCustomBuff(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const buffs = foundry.utils.deepClone(this.actor.system.customBuffs || []);
    buffs.splice(index, 1);
    await this.actor.update({ "system.customBuffs": buffs });
  },

  // -------------------------------------------------------
  // Combat Reset Actions (Main Tab)
  // -------------------------------------------------------

  async _onNewRound(event) {
    event.preventDefault();
    const updates = {
      "system.tracking.energyCharges": 0,
      "system.tracking.diminishingDefense": 0,
      "system.tracking.diminishingOffense": 0,
      // Reset Experienced Fighter for new round
      "system.experiencedFighter.mode": "none",
      "system.experiencedFighter.usedThisRound": false,
      // Reset round-scoped transformation tracking
      "system.transformationMeta.surgingStrengthRound": 0
    };

    // Explicitly delete round-scoped keys (Foundry deep merge workaround)
    const ru = this.actor.system.combatTabState?.resourceUsage?.round || {};
    for (const key of Object.keys(ru)) {
      updates[`system.combatTabState.resourceUsage.round.-=${key}`] = null;
    }
    const ue = this.actor.system.effectTracking?.usedEffects?.round || {};
    for (const key of Object.keys(ue)) {
      updates[`system.effectTracking.usedEffects.round.-=${key}`] = null;
    }

    await this.actor.update(updates);
  },

  async _onNewEncounter(event) {
    event.preventDefault();
    const updates = {
      "system.tracking.energyCharges": 0,
      "system.tracking.powerStacks": 0,
      "system.tracking.diminishingDefense": 0,
      "system.tracking.diminishingOffense": 0,
      "system.status.capacitySpent": 0,
      "system.status.superStacks": 0,
      "system.combatStates.raging": false,
      "system.combatStates.surging": false,
      "system.combatStates.mindful": false,
      "system.combatStates.superior": false,
      "system.combatStates.undying": false,
      "system.thresholds.bruised.checked": false,
      "system.thresholds.injured.checked": false,
      "system.thresholds.critical.checked": false,
      "system.battleBorn.strike": 0,
      "system.battleBorn.dodge": 0,
      "system.battleBorn.wound": 0,
      "system.battleBorn.undying": false,
      // Reset Experienced Fighter
      "system.experiencedFighter.mode": "none",
      "system.experiencedFighter.usedThisRound": false,
      // Reset transformation encounter tracking
      "system.transformationMeta.burstLimitUsed": false,
      "system.transformationMeta.burstLimitSource": "",
      "system.transformationMeta.legendRealizedUsed": [],
      "system.transformationMeta.nlopActiveEncounter": [],
      "system.transformationMeta.persistentCombatStates": {},
      "system.transformationMeta.specialResources": {},
      "system.transformationMeta.surgingStrengthEncounter": 0,
      "system.transformationMeta.surgingStrengthRound": 0,
      // Reset One-Sided Fusion encounter tracking
      "system.fusion.encounterThresholdsCrossed": 0,
      // Reset Hidden weapon quality usage (per-encounter flag)
      "system.equipmentFlags.hiddenUsedThisEncounter": false,
      // Reset combat tab round tracker and damage log
      "system.combatTabState.currentRound": 0,
      "system.combatTabState.rounds": [],
      "system.combatTabState.damageLog": []
    };

    // Reset Possession host LP tracking if in possession mode
    const fusion = this.actor.system.fusion || {};
    if (fusion.isFusion && fusion.type === "one-sided-possession") {
      const hostId = (fusion.suppressedCharacterIds || [])[0];
      const hostActor = hostId ? game.actors?.get(hostId) : null;
      if (hostActor) {
        updates["system.fusion.hostCurrentLP"] = hostActor.system.lifePoints?.value ?? hostActor.system.lifePoints?.max ?? 0;
      }
    }

    // Explicitly delete all resourceUsage and usedEffects keys
    const ru = this.actor.system.combatTabState?.resourceUsage || {};
    for (const key of Object.keys(ru.round || {})) {
      updates[`system.combatTabState.resourceUsage.round.-=${key}`] = null;
    }
    for (const key of Object.keys(ru.encounter || {})) {
      updates[`system.combatTabState.resourceUsage.encounter.-=${key}`] = null;
    }
    const ue = this.actor.system.effectTracking?.usedEffects || {};
    for (const key of Object.keys(ue.round || {})) {
      updates[`system.effectTracking.usedEffects.round.-=${key}`] = null;
    }
    for (const key of Object.keys(ue.encounter || {})) {
      updates[`system.effectTracking.usedEffects.encounter.-=${key}`] = null;
    }

    await this.actor.update(updates);
  },

  // -------------------------------------------------------
  // Effect Panel Interactions (Main Tab)
  // -------------------------------------------------------

  _onToggleEffectGroup(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const group = header.closest(".effect-group");
    if (group) group.classList.toggle("collapsed");
  },

  async _onPassiveToggle(event) {
    const effectId = event.currentTarget.dataset.effectId;
    const et = foundry.utils.deepClone(this.actor.system.effectTracking || {});
    if (!et.enabledPassives) et.enabledPassives = {};
    et.enabledPassives[effectId] = event.currentTarget.checked;
    await this.actor.update({ "system.effectTracking": et });
  },

  async _onUsagePipClick(event) {
    event.preventDefault();
    const pip = event.currentTarget;
    const tracker = pip.closest(".usage-tracker");
    if (!tracker) return;
    const effectId = tracker.dataset.effectId;
    const limit = tracker.dataset.limit || "round";
    const maxUses = Number(tracker.dataset.max) || 1;

    const et = foundry.utils.deepClone(this.actor.system.effectTracking || {});
    if (!et.usedEffects) et.usedEffects = { round: {}, encounter: {} };
    const usedKey = limit === "round" ? "round" : "encounter";
    const currentUsed = et.usedEffects[usedKey][effectId] || 0;

    if (pip.classList.contains("available")) {
      // Use one
      et.usedEffects[usedKey][effectId] = Math.min(maxUses, currentUsed + 1);
    } else {
      // Undo one
      et.usedEffects[usedKey][effectId] = Math.max(0, currentUsed - 1);
      if (et.usedEffects[usedKey][effectId] === 0) delete et.usedEffects[usedKey][effectId];
    }
    await this.actor.update({ "system.effectTracking": et });
  },

  /** Cruelty Stacks (Cruel Intentions, Arcosian): ±1, clamped 0–max (3, or 6 with Super Evolution). */
  async _onCrueltyChange(delta, event) {
    event.preventDefault();
    const max = this.actor.constructor.getCrueltyMax(this.actor.system);
    const current = this.actor.system.tracking?.crueltyStacks || 0;
    const next = Math.max(0, Math.min(max, current + delta));
    if (next === current) return;
    await this.actor.update({ "system.tracking.crueltyStacks": next });
  },

  /**
   * Surge Maneuver [1/Encounter] (actions-combat.txt:403): use a Healing Surge
   * (roll system.status.healingSurge → regain LP) or a Power Surge (+powerSurgeKi
   * KP and regain 1/4 max Capacity). Extra surges granted by other effects are
   * allowed after a confirm.
   */
  async _onUseSurge(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.surgeType;
    const system = this.actor.system;
    const usageKey = "surge:maneuver";
    const used = system.combatTabState?.resourceUsage?.encounter?.[usageKey] || 0;
    if (used > 0) {
      const ok = await Dialog.confirm({
        title: "Surge Maneuver",
        content: `<p>The Surge Maneuver has already been used this Encounter (1/Encounter). Use another Surge anyway (granted by a different effect, e.g. Namekian Biology, talents…)?</p>`
      });
      if (!ok) return;
    }
    const updates = { [`system.combatTabState.resourceUsage.encounter.${usageKey}`]: used + 1 };
    let card;

    if (type === "healing") {
      const formula = system.status.healingSurge || `${2 * (system.tier || 1)}d10`;
      const roll = new Roll(formula);
      await roll.evaluate();
      const lpMax = system.lifePoints.max;
      const lpBefore = system.lifePoints.value ?? lpMax;
      const healed = Math.max(0, roll.total);
      const lpAfter = Math.min(lpMax, lpBefore + healed);
      updates["system.lifePoints.value"] = lpAfter;
      card = `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-heart"></i> ${this.actor.name} — Healing Surge</div>
        <div class="dbu-attack-meta">
          <span class="dbu-meta-chip">Surge Maneuver${used > 0 ? " (extra)" : " 1/Enc"}</span>
          <span class="dbu-meta-chip">Instant</span>
        </div>
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Life</span>
          <span class="dbu-roll-formula">${formula}</span>
          <span class="dbu-roll-total">+${roll.total}</span>
        </div>
        <div class="dbu-attack-buffs">LP ${lpBefore} → <b>${lpAfter}</b> / ${lpMax}</div>
      </div>`;
      if (game.dice3d) game.dice3d.showForRoll(roll, game.user, true);
    } else {
      const kpGain = system.status.powerSurgeKi || Math.floor(system.kiPool.max / 4);
      const capGain = system.status.powerSurgeCapacity || Math.floor(system.capacity.max / 4);
      const kpBefore = system.kiPool.value ?? system.kiPool.max;
      const kpAfter = Math.min(system.kiPool.max, kpBefore + kpGain);
      const capSpentBefore = system.status.capacitySpent || 0;
      const capSpentAfter = Math.max(0, capSpentBefore - capGain);
      updates["system.kiPool.value"] = kpAfter;
      updates["system.status.capacitySpent"] = capSpentAfter;
      card = `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-bolt"></i> ${this.actor.name} — Power Surge</div>
        <div class="dbu-attack-meta">
          <span class="dbu-meta-chip">Surge Maneuver${used > 0 ? " (extra)" : " 1/Enc"}</span>
          <span class="dbu-meta-chip">Instant</span>
        </div>
        <div class="dbu-attack-buffs">KP ${kpBefore} → <b>${kpAfter}</b> / ${system.kiPool.max} · Capacity regained <b>${capSpentBefore - capSpentAfter}</b> (spent ${capSpentBefore} → ${capSpentAfter})</div>
      </div>`;
    }

    await this.actor.update(updates);
    ChatMessage.create({ content: card, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  },

  // -------------------------------------------------------
  // Combat Tab Listeners
  // -------------------------------------------------------

  async _onUseResource(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const limit = event.currentTarget.dataset.limit || "round";
    await this._trackCombatUsage(effectId, limit);
  },

  /**
   * Handle switching sub-tabs in the Traits & Bonuses panel on Combat tab.
   */
  async _onTbTabSwitch(event) {
    event.preventDefault();
    const newTab = event.currentTarget.dataset.tab;
    if (!newTab) return;

    const current = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    current.traitsBonusesTab = newTab;
    await this.actor.update({ "system.combatTabState": current });
  },

  /**
   * Unified action handler for Available Resources.
   * Routes to the correct trigger handler based on actionType,
   * or falls back to simple track + chat.
   */
  async _onUnifiedAction(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const actionType = btn.dataset.actionType || "chat";
    const triggerId = btn.dataset.triggerId || "";
    const stanceId = btn.dataset.stance || "";

    try {
      switch (actionType) {
        case "talent-stance":
          return await this._executeUnifiedStance(stanceId);
        case "talent-trigger":
          return await this._executeUnifiedTrigger("tb", triggerId, "fas fa-gem");
        case "mp-trigger":
          return await this._executeUnifiedTrigger("mp", triggerId, "fas fa-star-of-life");
        case "rt-trigger":
          return await this._executeUnifiedTrigger("rt", triggerId, "fas fa-dna");
        case "lt-trigger":
          return await this._executeUnifiedTrigger("lt", triggerId, "fas fa-crown");
        case "ep-trigger": {
          const synth = { preventDefault() {}, currentTarget: { dataset: { triggerId } } };
          return await this._onEnhancementPowerTrigger(synth);
        }
        case "af-trigger": {
          const synth = { preventDefault() {}, currentTarget: { dataset: { triggerId } } };
          return await this._onAlternateFormTrigger(synth);
        }
        case "lf-trigger": {
          const synth = { preventDefault() {}, currentTarget: { dataset: { triggerId } } };
          return await this._onLegendaryFormTrigger(synth);
        }
        default: {
          // Simple track + post chat from resource data
          const effectId = btn.dataset.effectId;
          const limit = btn.dataset.limit || "round";
          const maxUses = Number(btn.dataset.maxUses || 0);
          const item = btn.closest(".combat-resource-item");
          const name = item?.querySelector(".resource-name")?.textContent
            || btn.dataset.sourceName || "Resource";
          if (effectId) {
            const tracked = await this._trackCombatUsage(effectId, limit, maxUses, name);
            if (!tracked) return;
          }
          const text = item?.querySelector(".resource-text")?.innerHTML || "";
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div style="font-size:0.9rem"><b>${name}</b><br>${text}</div>`
          });
        }
      }
    } catch (err) {
      // Dialog.wait() throws when closed via X or Escape — treat as silent cancel
      if (err?.message?.includes("closed without a choice")) return;
      console.error("DBU-OLD | _onUnifiedAction failed:", err);
      ui.notifications.error("Action failed. Check console for details.");
    }
  },

  /**
   * Execute a talent stance shift directly (for unified action).
   */
  async _executeUnifiedStance(stanceId) {
    const system = this.actor.system;
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

    let result;
    try {
      result = await Dialog.wait({
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
    } catch (e) {
      return; // Dialog closed via X or Escape — cancel silently
    }

    if (!result) return;

    const tempMods = foundry.utils.deepClone(system.combatTabState?.talentTempMods || {});
    if (result.amount === 0 || !result.direction) {
      delete tempMods[stanceId];
    } else {
      tempMods[stanceId] = { direction: result.direction, amount: result.amount };
    }
    await this.actor.update({ "system.combatTabState.talentTempMods": tempMods });

    if (result.amount > 0 && result.direction) {
      const dirLabel = result.direction.replace(/_/g, " ").replace(/to/g, "→");
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.85rem"><b><i class="fas fa-exchange-alt"></i> ${title}</b><br>Shift: ${dirLabel} (${result.amount})</div>`
      });
    }
  },

  /**
   * Execute a simple trigger (track + chat) for unified action.
   * Works for TB, MP, RT, LT triggers.
   */
  async _executeUnifiedTrigger(prefix, triggerId, iconClass) {
    if (!triggerId) return;

    // Find trigger data from the appropriate bonus object
    let triggerData = null;
    const system = this.actor.system;

    if (prefix === "tb") {
      for (const entry of (system.talentBonuses?.entries || [])) {
        const found = (entry.triggered || []).find(t => t.id === triggerId);
        if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `tb:${found.id}` }; break; }
      }
      // Special: Patient Fighter
      if (triggerId === "patient_fighter_transfer") {
        const synth = { preventDefault() {}, currentTarget: { dataset: { triggerId } } };
        return this._onTalentTrigger(synth);
      }
    } else if (prefix === "mp") {
      for (const entry of (system.manifestedPowerBonuses?.entries || [])) {
        const found = (entry.triggered || []).find(t => t.id === triggerId);
        if (found) { triggerData = { ...found, sourceName: entry.name, trackingId: `mp:${found.id}` }; break; }
      }
    } else if (prefix === "rt") {
      const raceBonusKeys = [
        "racialBonuses", "earthlingBonuses", "majinBonuses", "bioAndroidBonuses",
        "androidBonuses", "arcosianBonuses", "cerealianBonuses", "namekianBonuses",
        "nekoMajinBonuses", "neoTuffleBonuses", "shadowDragonBonuses", "shinjinBonuses",
        "undeadBonuses"
      ];
      for (const key of raceBonusKeys) {
        const bonuses = system[key];
        if (!bonuses?.triggered) continue;
        const found = bonuses.triggered.find(t => t.id === triggerId);
        if (found) { triggerData = { ...found, trackingId: `rt:${found.id}` }; break; }
      }
    } else if (prefix === "lt") {
      for (const entry of (system.legendaryTraitBonuses?.entries || [])) {
        const found = (entry.triggered || []).find(t => t.id === triggerId);
        if (found) { triggerData = { ...found, sourceName: entry.sourceName || entry.name, trackingId: `lt:${found.id}` }; break; }
      }
    }

    if (!triggerData) {
      console.warn(`DBU-OLD | Unified trigger not found: ${prefix}:${triggerId}`);
      return;
    }

    return this._runTriggerAutomationAndChat(triggerData, iconClass);
  },

  /**
   * Shared trigger finisher: tracks the limited use, runs the automation
   * descriptor (if the trigger has one), and posts the chat card with an
   * "applied" summary. Cancelling any automation dialog undoes the tracked use.
   */
  async _runTriggerAutomationAndChat(triggerData, iconClass = "fas fa-gem") {
    if (triggerData.usageLimit || triggerData.maxUses) {
      const tracked = await this._trackCombatUsage(triggerData.trackingId, triggerData.usageLimit, triggerData.maxUses || 0, triggerData.name);
      if (!tracked) return;
    }

    let summaryLines = [];
    if (triggerData.automation) {
      const applied = await this._applyTriggerAutomation(triggerData);
      if (applied === null) {
        if (triggerData.usageLimit || triggerData.maxUses) {
          await this._undoCombatUsage(triggerData.trackingId, triggerData.usageLimit || "round");
        }
        // Signal _onRtActivableUse that this click was cancelled — no fallback log row
        this._usageJustUndone = true;
        return;
      }
      summaryLines = applied.lines;
    }

    const summaryHtml = summaryLines.length
      ? `<div class="dbu-auto-applied">${summaryLines.map(l => `<div>${l}</div>`).join("")}</div>`
      : "";
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="${iconClass}"></i> ${triggerData.name}</b>${triggerData.sourceName ? ` <small>(${triggerData.sourceName})</small>` : ""}<br>${triggerData.description}${summaryHtml}</div>`
    });
  },

  /**
   * Generic activable-effect executor. Reads the trigger's `automation`
   * descriptor and applies real changes: KP costs, resource gains, temporary
   * stat buffs (via combatTabState.activeTempEffects → derived buffs), and
   * combat-state switches. Everything applied is recorded on the trigger's
   * "use" row in the Round Tracker log (autoApplied) so deleting/undoing the
   * row reverses it.
   *
   * Descriptor shape (all fields optional):
   *   requires: ["raging"]                          — combatStates gates (confirm if missing)
   *   choose: [{ label, buffs?, gain?, state? }]    — player picks one branch
   *   cost: { kp: N }                               — fixed KP cost
   *   spendPrompt: { max: N, label }                — prompt KP amount; exposed as `spent`
   *   gain: { kp, lp, energyCharges, per: "thresholdsBelow" }
   *   buffs: [{ stat, amount | amountFrom: "spent", duration: "round"|"encounter"|"nextAttack" }]
   *   state: { key: "raging"|"mindful"|..., note }
   *
   * Returns { lines } for the chat summary, or null if cancelled/blocked.
   */
  async _applyTriggerAutomation(triggerData) {
    const auto = triggerData.automation;
    if (!auto) return { lines: [] };
    const system = this.actor.system;
    const lines = [];
    const statLabels = {
      strike: "Strike", dodge: "Dodge", wound: "Wound",
      combatRolls: "Combat Rolls", soak: "Soak", defense: "Defense"
    };
    const durLabels = { round: "this round", encounter: "this encounter", nextAttack: "next attack" };

    // 1. Required combat states — warn and let the player decide
    for (const st of (auto.requires || [])) {
      if (!system.combatStates?.[st]) {
        const ok = await Dialog.confirm({
          title: triggerData.name,
          content: `<p>The <b>${st}</b> state is not active. Apply the effect anyway?</p>`,
          defaultYes: false
        });
        if (!ok) return null;
      }
    }

    // 2. Choice branch
    let spec = auto;
    if (Array.isArray(auto.choose) && auto.choose.length) {
      const buttons = {};
      auto.choose.forEach((opt, i) => {
        buttons[`opt${i}`] = { label: opt.label, callback: () => i };
      });
      let idx;
      try {
        idx = await Dialog.wait({ title: triggerData.name, content: `<p>${triggerData.description}</p>`, buttons });
      } catch (e) { return null; }
      if (idx === undefined || idx === null) return null;
      spec = { ...auto, ...auto.choose[idx], choose: null };
    }

    // 3. KP spend prompt / fixed cost
    let spent = 0;
    const kpCur = system.kiPool?.value ?? 0;
    if (spec.spendPrompt) {
      const maxSpend = Math.min(spec.spendPrompt.max, kpCur);
      if (maxSpend <= 0) { ui.notifications.warn("Not enough Ki Points."); return null; }
      const raw = await Dialog.prompt({
        title: triggerData.name,
        content: `<form><div class="form-group"><label>${spec.spendPrompt.label || "KP to spend"} (max ${maxSpend})</label><input type="number" name="amt" min="0" max="${maxSpend}" value="${maxSpend}" /></div></form>`,
        callback: html => Number(html.find("[name='amt']").val()) || 0,
        rejectClose: false
      });
      if (raw === null || raw === undefined) return null;
      spent = Math.max(0, Math.min(maxSpend, Number(raw) || 0));
      if (spent <= 0) return null;
    }
    const kpCost = (spec.cost?.kp || 0) + spent;
    if (kpCost > kpCur) { ui.notifications.warn("Not enough Ki Points."); return null; }

    // 4. Compute resource deltas
    const applied = { kp: 0, lp: 0, energyCharges: 0, capacity: 0, buffIds: [], stateKey: null };
    const updates = {};
    const mult = spec.gain?.per === "thresholdsBelow" ? (system.thresholds?.crossedCount ?? 0) : 1;
    const gainKp = (spec.gain?.kp || 0) * (spec.gain?.kp ? mult : 1);
    const gainLp = (spec.gain?.lp || 0) * (spec.gain?.lp ? mult : 1);
    const gainEc = spec.gain?.energyCharges || 0;
    if (spec.gain?.per === "thresholdsBelow" && mult === 0 && (spec.gain.kp || spec.gain.lp)) {
      ui.notifications.warn("No Health Thresholds crossed — nothing to gain.");
      return null;
    }

    if (kpCost > 0 || gainKp > 0) {
      const kpMax = system.kiPool?.max ?? 0;
      const newKp = Math.max(0, Math.min(kpMax, kpCur - kpCost + gainKp));
      applied.kp = newKp - kpCur;
      updates["system.kiPool.value"] = newKp;
      if (kpCost > 0) {
        applied.capacity = kpCost;
        updates["system.status.capacitySpent"] = (system.status?.capacitySpent ?? 0) + kpCost;
        lines.push(`&minus;${kpCost} KP`);
      }
      if (gainKp > 0) lines.push(`+${gainKp} KP`);
    }
    if (gainLp > 0) {
      const lpCur = system.lifePoints?.value ?? 0;
      const lpMax = system.lifePoints?.max ?? 0;
      const newLp = Math.min(lpMax, lpCur + gainLp);
      applied.lp = newLp - lpCur;
      updates["system.lifePoints.value"] = newLp;
      lines.push(`+${applied.lp} LP`);
    }
    if (gainEc > 0) {
      applied.energyCharges = gainEc;
      updates["system.tracking.energyCharges"] = (system.tracking?.energyCharges ?? 0) + gainEc;
      lines.push(`+${gainEc} Energy Charge${gainEc > 1 ? "s" : ""}`);
    }

    // 5. Temp buffs + log-row linkage (single combatTabState clone)
    const cts = foundry.utils.deepClone(system.combatTabState || {});
    if (!Array.isArray(cts.activeTempEffects)) cts.activeTempEffects = [];
    for (const b of (spec.buffs || [])) {
      const amount = b.amountFrom === "spent" ? Math.floor(spent * (b.ratio || 1)) : (b.amount || 0);
      if (!amount) continue;
      const id = foundry.utils.randomID(8);
      applied.buffIds.push(id);
      cts.activeTempEffects.push({
        id, stat: b.stat, amount,
        duration: b.duration || "round",
        source: triggerData.name
      });
      lines.push(`${amount > 0 ? "+" : ""}${amount} ${statLabels[b.stat] || b.stat} (${durLabels[b.duration || "round"] || b.duration})`);
    }

    // 6. Combat state switch
    if (spec.state?.key) {
      applied.stateKey = spec.state.key;
      updates[`system.combatStates.${spec.state.key}`] = true;
      lines.push(`${spec.state.key.charAt(0).toUpperCase() + spec.state.key.slice(1)} state ON${spec.state.note ? ` — ${spec.state.note}` : ""}`);
    }

    // 7. Record on the tracker log: attach to the "use" row the tracking just
    //    created, or append one for unlimited triggers (log stays authoritative)
    if (!Array.isArray(cts.rounds) || cts.rounds.length === 0) {
      cts.rounds = [{ roundNumber: 1, actions: [] }];
      cts.currentRound = 1;
    }
    const lastRound = cts.rounds[cts.rounds.length - 1];
    if (!Array.isArray(lastRound.actions)) lastRound.actions = [];
    let logRow = null;
    for (let i = lastRound.actions.length - 1; i >= 0; i--) {
      const a = lastRound.actions[i];
      if (a.type === "use" && a.effectId === triggerData.trackingId) { logRow = a; break; }
    }
    if (!logRow) {
      logRow = {
        type: "use", source: "", kiCost: 0, kiWager: 0,
        description: triggerData.name, effectId: triggerData.trackingId || "",
        limit: "", useCount: 0, maxUses: 0
      };
      lastRound.actions.push(logRow);
      this._usageJustLogged = true;
    }
    logRow.autoApplied = applied;
    updates["system.combatTabState"] = cts;

    await this.actor.update(updates);
    return { lines };
  },

  /**
   * Reverse an autoApplied record from a deleted/undone "use" log row.
   * Mutates `updates` with the resource reversals and strips the linked temp
   * effects from `cts.activeTempEffects` (cts is the clone being saved).
   */
  _reverseAutoApplied(applied, cts, updates) {
    if (!applied) return;
    if (applied.kp) {
      const cur = updates["system.kiPool.value"] ?? this.actor.system.kiPool?.value ?? 0;
      const max = this.actor.system.kiPool?.max ?? 0;
      updates["system.kiPool.value"] = Math.max(0, Math.min(max, cur - applied.kp));
    }
    if (applied.capacity) {
      const cur = updates["system.status.capacitySpent"] ?? this.actor.system.status?.capacitySpent ?? 0;
      updates["system.status.capacitySpent"] = Math.max(0, cur - applied.capacity);
    }
    if (applied.lp) {
      const cur = updates["system.lifePoints.value"] ?? this.actor.system.lifePoints?.value ?? 0;
      const max = this.actor.system.lifePoints?.max ?? 0;
      updates["system.lifePoints.value"] = Math.max(0, Math.min(max, cur - applied.lp));
    }
    if (applied.energyCharges) {
      const cur = updates["system.tracking.energyCharges"] ?? this.actor.system.tracking?.energyCharges ?? 0;
      updates["system.tracking.energyCharges"] = Math.max(0, cur - applied.energyCharges);
    }
    if (applied.buffIds?.length && Array.isArray(cts.activeTempEffects)) {
      const ids = new Set(applied.buffIds);
      cts.activeTempEffects = cts.activeTempEffects.filter(fx => !ids.has(fx.id));
    }
    if (applied.stateKey) {
      updates[`system.combatStates.${applied.stateKey}`] = false;
    }
  },

  async _onUndoResource(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const limit = event.currentTarget.dataset.limit || "round";
    // Shared undo path: decrements both stores AND removes the matching
    // "use" entry from the Round Tracker log.
    await this._undoCombatUsage(effectId, limit);
  },

  async _onAddResourceUse(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const limit = event.currentTarget.dataset.limit || "round";
    const label = event.currentTarget.dataset.effectName || "";
    await this._trackCombatUsage(effectId, limit, 0, label);
  },

  async _trackCombatUsage(effectId, limit = "round", maxUses = 0, label = "") {
    // Limits arrive as "encounter" (catalog format) or "1/Encounter", "x/Encounter" (hand-written entries)
    const key = /encounter/i.test(String(limit || "")) ? "encounter" : "round";
    const currentCount = this.actor.system.combatTabState?.resourceUsage?.[key]?.[effectId] || 0;
    if (maxUses > 0 && currentCount >= maxUses) {
      ui.notifications.warn("That effect has already reached its usage limit.");
      this._usageRejected = true;
      return false;
    }

    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.resourceUsage) cts.resourceUsage = { round: {}, encounter: {} };
    cts.resourceUsage[key][effectId] = (cts.resourceUsage[key][effectId] || 0) + 1;

    const et = foundry.utils.deepClone(this.actor.system.effectTracking || {});
    if (!et.usedEffects) et.usedEffects = { round: {}, encounter: {} };
    et.usedEffects[key][effectId] = (et.usedEffects[key][effectId] || 0) + 1;

    // The Round Tracker is the combat log: every limited use appends a
    // read-only "use" entry to the current round (created if none exists).
    if (!Array.isArray(cts.rounds) || cts.rounds.length === 0) {
      cts.rounds = [{ roundNumber: 1, actions: [] }];
      cts.currentRound = 1;
    }
    const logRound = cts.rounds[cts.rounds.length - 1];
    if (!Array.isArray(logRound.actions)) logRound.actions = [];
    logRound.actions.push({
      type: "use",
      source: "",
      kiCost: 0,
      kiWager: 0,
      description: label || this._prettifyEffectLabel(effectId),
      effectId,
      limit: key,
      useCount: cts.resourceUsage[key][effectId],
      maxUses: maxUses || 0
    });
    this._usageJustLogged = true;

    await this.actor.update({ "system.combatTabState": cts, "system.effectTracking": et });
    return true;
  },

  /**
   * Fallback readable label for a tracking id (e.g. "tf:auto_ki_guard" → "Ki Guard").
   */
  _prettifyEffectLabel(effectId) {
    const raw = String(effectId || "").split(":").pop().replace(/^auto_/, "");
    return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim() || "Ability";
  },

  // -------------------------------------------------------
  // God Ki / God Maneuvers
  // -------------------------------------------------------

  async _onAddGodManeuver(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.godManeuvers || {};
    const current = this.actor.system.godManeuvers || [];
    const available = Object.values(catalog).filter(m => !current.includes(m.id));

    if (!available.length) {
      ui.notifications.warn("All God Maneuvers have already been added.");
      return;
    }

    const options = available.map(m =>
      `<option value="${m.id}">${m.name} — ${m.frequency} (${m.dkpCost} DKP)</option>`
    ).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select God Maneuver</label>
          <select name="maneuver">${options}</select>
        </div>
      </form>`;

    new Dialog({
      title: "Add God Maneuver",
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Add",
          callback: async (html) => {
            const id = html.find("[name=maneuver]").val();
            if (!id) return;
            const updated = [...current, id];
            await this.actor.update({ "system.godManeuvers": updated });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "add"
    }).render(true);
  },

  async _onRemoveGodManeuver(event) {
    event.preventDefault();
    const current = this.actor.system.godManeuvers || [];
    if (!current.length) {
      ui.notifications.warn("No God Maneuvers to remove.");
      return;
    }

    const catalog = CONFIG.DBU?.godManeuvers || {};
    const options = current.map(id => {
      const m = catalog[id];
      return `<option value="${id}">${m?.name || id}</option>`;
    }).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select God Maneuver to Remove</label>
          <select name="maneuver">${options}</select>
        </div>
      </form>`;

    new Dialog({
      title: "Remove God Maneuver",
      content,
      buttons: {
        remove: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Remove",
          callback: async (html) => {
            const id = html.find("[name=maneuver]").val();
            if (!id) return;
            const updated = current.filter(m => m !== id);
            await this.actor.update({ "system.godManeuvers": updated });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "remove"
    }).render(true);
  },

  async _onGodStrikeProfile(event) {
    event.preventDefault();
    const val = event.currentTarget.value;
    await this.actor.update({ "system.godStrikeProfile": val });
  },
};
