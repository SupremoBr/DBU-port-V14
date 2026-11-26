import { applyDimensionBladeWear093, duelistParryBonus093 } from "../../helpers/weapon-state.mjs";
import { energyChargeDie } from "../../helpers/custom-buffs.mjs";
import { getAreaSpec } from "../../automation/scripts/area-attack.js";
import { surgingCharge093, surgingTargetsAllowed093, ragingBotch } from "../../rules/states-v093.mjs";
import { createHiddenTrackerCard, privateRollJournal } from "../../automation/scripts/core/private-rolls.js";
import { defendKiCost093 } from "../../rules/defenses-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";
import { pinpointInsight093, PROFILES_093, profileRoll093, rollLinked093, validFoundation } from "../../rules/profiles-v093.mjs";
import { tokenForActor } from "../../automation/scripts/core/token-identity.js";
import { initiateDuel, initiateClash } from "../../helpers/duel.mjs";

/** Character sheet domain: combat-tracker. Methods run with the sheet as this. */
export const combatTrackerMethods = {

  async _onTrackerAddAction(event) {
    event.preventDefault();
    const defaultType = event.currentTarget?.dataset?.defaultType || "standard";
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.rounds) cts.rounds = [{ roundNumber: 1, actions: [] }];
    if (cts.rounds.length === 0) cts.rounds.push({ roundNumber: 1, actions: [] });
    const lastRound = cts.rounds[cts.rounds.length - 1];
    lastRound.actions.push({ type: defaultType, source: "", kiCost: 0, dkpCost: 0, kiWager: 0, description: "" });
    await this.actor.update({ "system.combatTabState": cts });
  },

  /** Toggle Charging Assault on a tracker attack action (Impaling Horns wound bonus). */
  async _onTrackerChargingToggle(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex].charging = el.checked;
    await this.actor.update({ "system.combatTabState": cts });
  },

  async _onTrackerNextRound(event) {
    event.preventDefault();
    return this._onCombatNewRound(event);
  },

  async _onTrackerReset(event) {
    event.preventDefault();
    return this._onCombatNewEncounter(event);
  },

  async _onDeleteTrackerAction(event) {
    event.preventDefault();
    const actionIndex = Number(event.currentTarget.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.rounds?.length) return;
    const lastRound = cts.rounds[cts.rounds.length - 1];
    if (actionIndex >= 0 && actionIndex < lastRound.actions.length) {
      const deleted = lastRound.actions.splice(actionIndex, 1)[0];
      const updates = { "system.combatTabState": cts };
      // Deleting a "use" log entry refunds the usage counters (log is authoritative)
      if (deleted.type === "use" && deleted.effectId) {
        const uKey = deleted.limit === "encounter" ? "encounter" : "round";
        if (cts.resourceUsage?.[uKey]?.[deleted.effectId]) {
          cts.resourceUsage[uKey][deleted.effectId] = Math.max(0, cts.resourceUsage[uKey][deleted.effectId] - 1);
        }
        const etDel = foundry.utils.deepClone(this.actor.system.effectTracking || {});
        if (etDel.usedEffects?.[uKey]?.[deleted.effectId]) {
          etDel.usedEffects[uKey][deleted.effectId] = Math.max(0, etDel.usedEffects[uKey][deleted.effectId] - 1);
          updates["system.effectTracking"] = etDel;
        }
      }
      // Reverse any automation the deleted row applied (buffs, KP/LP, states)
      if (deleted.type === "use" && deleted.autoApplied) {
        this._reverseAutoApplied(deleted.autoApplied, cts, updates);
      }
      // Refund KP / DKP / capacity that the deleted action consumed
      const refundKi  = deleted.kiCost  || 0;
      const refundDkp = deleted.dkpCost || 0;
      if (refundKi > 0) {
        const cur = this.actor.system.kiPool?.value ?? 0;
        const max = this.actor.system.kiPool?.max ?? 0;
        updates["system.kiPool.value"] = Math.min(max, cur + refundKi);
      }
      if (refundDkp > 0) {
        const cur = this.actor.system.divineKiPoints?.value ?? 0;
        const max = this.actor.system.divineKiPoints?.max ?? 0;
        updates["system.divineKiPoints.value"] = Math.min(max, cur + refundDkp);
      }
      if (refundKi > 0 || refundDkp > 0) {
        const capRefund = refundKi + Math.ceil(refundDkp / 2);
        const curCap = this.actor.system.status?.capacitySpent ?? 0;
        updates["system.status.capacitySpent"] = Math.max(0, curCap - capRefund);
      }
      // Recalculate power stacks if a power-up was deleted
      if (deleted.type === "power-up") {
        const currentRound = cts.currentRound || cts.rounds.length;
        let activePowerUps = 0;
        for (const r of cts.rounds) {
          if (r.roundNumber >= currentRound - 1) {
            for (const a of (r.actions || [])) {
              if (a.type === "power-up") activePowerUps++;
            }
          }
        }
        updates["system.tracking.powerStacks"] = activePowerUps;
      }
      await this.actor.update(updates);
    }
  },

  async _onTrackerActionChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.rounds?.length) return;
    const round = cts.rounds.find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    const action = round.actions[actionIndex];
    const wasTypeChange = el.classList.contains("action-type");

    // Capture previous values to compute delta when KI/DKP changes (so we can
    // auto-deduct from pools and adjust capacitySpent accordingly).
    const prevKi  = action.kiCost  || 0;
    const prevDkp = action.dkpCost || 0;

    if (wasTypeChange) {
      action.type = el.value;
      // Clear source data when switching away from "attack" type
      if (el.value !== "attack") {
        action.source = "";
      }
    }
    else if (el.classList.contains("action-ki")) action.kiCost = Number(el.value) || 0;
    else if (el.classList.contains("action-dkp")) action.dkpCost = Number(el.value) || 0;
    else if (el.classList.contains("action-desc")) action.description = el.value;
    const updates = { "system.combatTabState": cts };

    // Auto-deduct KP / DKP from pools and update capacitySpent.
    // Full Capacity Rate for KP, half (rounded up) for DKP per god-ki.txt:22.
    const deltaKi  = (action.kiCost  || 0) - prevKi;
    const deltaDkp = (action.dkpCost || 0) - prevDkp;
    if (deltaKi !== 0) {
      const curKi = this.actor.system.kiPool?.value ?? 0;
      updates["system.kiPool.value"] = Math.max(0, curKi - deltaKi);
    }
    if (deltaDkp !== 0) {
      const curDkp = this.actor.system.divineKiPoints?.value ?? 0;
      updates["system.divineKiPoints.value"] = Math.max(0, curDkp - deltaDkp);
    }
    if (deltaKi !== 0 || deltaDkp !== 0) {
      const capDelta = deltaKi + (deltaDkp > 0 ? Math.ceil(deltaDkp / 2) : -Math.ceil(-deltaDkp / 2));
      const curCap = this.actor.system.status?.capacitySpent ?? 0;
      updates["system.status.capacitySpent"] = Math.max(0, curCap + capDelta);
    }
    // Recalculate power stacks when action type changes
    if (wasTypeChange) {
      const currentRound = cts.currentRound || cts.rounds.length;
      let activePowerUps = 0;
      for (const r of cts.rounds) {
        if (r.roundNumber >= currentRound - 1) {
          for (const a of (r.actions || [])) {
            if (a.type === "power-up") activePowerUps++;
          }
        }
      }
      updates["system.tracking.powerStacks"] = activePowerUps;
    }
    await this.actor.update(updates);
  },

  /**
   * Handle clicking an activable in the Round Tracker sidebar.
   * Consumes the resource (reuses unified-action logic) AND adds an action entry to the active round.
   */
  async _onRtActivableUse(event) {
    event.preventDefault();
    const button = event.currentTarget;
    if (button.disabled) return;

    // 1. Consume the resource by reusing the unified-action flow.
    //    The button already carries the same dataset attrs _onUnifiedAction expects
    //    (data-action-type, data-trigger-id, data-stance, data-effect-id, data-limit, data-max-uses).
    //    Limited-use effects log themselves into the Round Tracker via _trackCombatUsage.
    this._usageJustLogged = false;
    this._usageJustUndone = false;
    this._usageRejected = false;
    await this._onUnifiedAction({
      preventDefault: () => {},
      currentTarget: button
    });

    // 2. Fallback log entry for UNLIMITED effects so the tracker stays a complete
    //    combat log. Skipped when the use was already logged (or logged-then-undone
    //    because the dialog was cancelled), and when the use was rejected for
    //    hitting its usage limit. Stance shifts post their own chat card.
    if (this._usageJustLogged || this._usageJustUndone || this._usageRejected) return;
    if ((button.dataset.actionType || "") === "talent-stance") return;
    const sourceName = button.dataset.sourceName || "Ability";
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!Array.isArray(cts.rounds) || cts.rounds.length === 0) {
      cts.rounds = [{ roundNumber: 1, actions: [] }];
      cts.currentRound = 1;
    }
    const lastRound = cts.rounds[cts.rounds.length - 1];
    if (!Array.isArray(lastRound.actions)) lastRound.actions = [];
    lastRound.actions.push({
      type: "use",
      source: "",
      kiCost: 0,
      kiWager: 0,
      description: sourceName,
      effectId: "",
      limit: "",
      useCount: 0,
      maxUses: 0
    });
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Populate tracker attack-source dropdowns with optgroups from stored data.
   */
  _populateTrackerSources(html) {
    const groups = this._trackerSourceGroups || [];
    html.find(".action-source").each((i, el) => {
      const currentSource = el.dataset.currentSource || "";
      // Build optgroup HTML
      let optionsHTML = '<option value="">-- Select --</option>';
      for (const g of groups) {
        optionsHTML += `<optgroup label="${g.label}">`;
        for (const s of g.sources) {
          const sel = s.key === currentSource ? " selected" : "";
          const kiLabel = s.kiCost > 0 ? ` (${s.kiCost} KP)` : "";
          optionsHTML += `<option value="${s.key}" data-ki="${s.kiCost}" data-name="${s.name}"${sel}>${s.name}${kiLabel}</option>`;
        }
        optionsHTML += "</optgroup>";
      }
      el.innerHTML = optionsHTML;
    });
  },

  /**
   * Handle tracker attack-source selection: auto-fill Ki cost and description.
   */
  async _onTrackerSourceChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.rounds?.length) return;
    const round = cts.rounds.find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    const action = round.actions[actionIndex];
    const sourceKey = el.value;
    action.source = sourceKey;
    // Auto-fill from selected option data attributes
    const option = el.selectedOptions?.[0];
    if (option && sourceKey) {
      action.kiCost = Number(option.dataset.ki) || 0;
      action.description = option.dataset.name || "";
    } else {
      action.kiCost = 0;
      action.description = "";
    }
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Handle ki wager change on the tracker attack panel.
   */
  async _onTrackerWagerChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex].kiWager = Math.max(0, Number(el.value) || 0);
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Roll an attack from the tracker — evaluates Strike + Wound rolls and posts
   * ONE ChatMessage with the attack info visible but the roll values and buffs
   * HIDDEN. A "Reveal" button (owner/GM only) swaps in the revealed content,
   * auto-deducts Ki (cost + wager), and whispers the remaining KP to the GM
   * and the actor's owner. Reveal logic lives in dbu-old.mjs (renderChatMessage).
   */
  async _onRollTrackerAttack(event, { prepareOnly = false, focusCharge = 0 } = {}) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const action = round?.actions?.[actionIndex];
    if (!action || action.type !== "attack" || !action.source) {
      ui.notifications.warn("Select an attack source first.");
      return;
    }
    const groups = this._trackerSourceGroups || [];
    let sd = null;
    for (const g of groups) {
      const s = g.sources.find(x => x.key === action.source);
      if (s) { sd = s; break; }
    }
    if (!sd) {
      ui.notifications.error("Attack source not found.");
      return;
    }

    if (uses093(this.actor.system) && sd.weaponIssue) return ui.notifications.warn(sd.weaponIssue);
    if (uses093(this.actor.system) && String(action.source).startsWith("ref_")) {
      if (!validFoundation(sd.profile, sd.foundation)) return ui.notifications.warn("Selecione um Profile compatível com a Foundation.");
    }

    // Broken weapon guard (weapons.txt "Damaging Weapons"): a Weapon at 0 LP
    // cannot be used for any Attacking Maneuvers. Matches the attack ref's
    // free-text "Weapon Equipped" against owned weapon items by name.
    if (!uses093(this.actor.system) && String(action.source).startsWith("ref_")) {
      const refIdx = Number(String(action.source).slice(4));
      const refWeapon = String(this.actor.system.attackRefs?.[refIdx]?.weaponEquipped || "").trim().toLowerCase();
      if (refWeapon && refWeapon !== "unarmed") {
        const wItem = this.actor.items.find(i =>
          i.type === "equipment" && i.system.equipmentType === "weapon" &&
          i.name.trim().toLowerCase() === refWeapon);
        if (wItem && !(wItem.system.qualities || []).some(q => q.qualityKey === "unbreakable")
            && (this._calcWeaponLPMax(wItem) - (wItem.system.weaponLPDamage || 0)) <= 0) {
          ui.notifications.warn(`${wItem.name} is BROKEN (0 LP) — it cannot be used for Attacking Maneuvers. Repair it first.`);
          return;
        }
      }
    }
    // Harsh Focus (auras.txt:584): cannot use the Signature Technique Maneuver
    // while using an Aura with this Disadvantage.
    if (String(action.source).startsWith("tech_")) {
      const hfAura = this.actor._getActiveAura(this.actor.system);
      if (hfAura && (hfAura.disadvantages || []).some(d => d.name === "Harsh Focus")) {
        ui.notifications.warn(`${hfAura.name || "Your Aura"} has Harsh Focus — you cannot use the Signature Technique Maneuver while in this Aura.`);
        return;
      }
    }
    // Shield Aura type (auras.txt:94): "You cannot use any Attacking Maneuvers
    // while this Aura is active" — unless it has the Offensive Shield Advantage.
    {
      const shAura = this.actor._getActiveAura(this.actor.system);
      if (shAura?.type === "Shield"
          && !(shAura.advantages || []).some(a => a.name === "Offensive Shield")) {
        ui.notifications.warn(`${shAura.name || "Your Shield Aura"} is active — you cannot use Attacking Maneuvers while in a Shield Aura (add Offensive Shield to allow it).`);
        return;
      }
    }
    // Player Minion: "Minions cannot use Ultimate Signature Techniques" (minions.txt)
    if (String(action.source).startsWith("tech_") && this.actor.system.minion?.enabled) {
      const mTechId = Number(String(action.source).slice(5));
      const mTech = (this.actor.system.signatureTechniques || []).find(t => t.id === mTechId);
      if (mTech && /ultimate/i.test(mTech.type || "")) {
        ui.notifications.warn(`${mTech.name || "This technique"} is an Ultimate Signature Technique — Minions cannot use Ultimates.`);
        return;
      }
    }
    if (!prepareOnly && uses093(this.actor.system) && this.actor.system.combatStates?.surging) {
      const targets = Array.from(game.user.targets || []);
      if (!surgingTargetsAllowed093(this.actor.system, targets.map(t => t.document?.uuid), getAreaSpec(sd, this.actor, targets).isAoE)) {
        return ui.notifications.warn("Surging exige o Focus como alvo.");
      }
      focusCharge = surgingCharge093(this.actor.system, sd);
    }
    const profile = uses093(this.actor.system) && PROFILES_093[sd.profile];
    if (!prepareOnly && (profile?.additionalStrikeChecks || profile?.ignoreDRFraction || profile?.ignoreSoakAttribute || ["bludgeoning", "piercing"].includes(sd.weaponCategory))) {
      const attackerToken = globalThis.canvas?.ready && tokenForActor(this.actor);
      if (attackerToken) {
        const { attack } = await import("../../automation/scripts/attack.js");
        return attack({ attackerToken, trackerAttack: { roundNum, actionIndex, source: action.source, kiWager: action.kiWager, charging: action.charging }, sourceKey: action.source });
      }
    }
    const journal = prepareOnly ? null : await privateRollJournal();
    const wager = Math.max(0, Number(action.kiWager) || 0);

    // --- Diminishing Offense (attacking.txt:33-34): each Attacking Maneuver
    // after the 3rd this Combat Round suffers -1(bT) Strike per attack beyond
    // the 3rd. Counter auto-increments here and resets on Next Round. ---
    const attackNum = (Number(cts.roundAttackCount) || 0) + 1;
    const dimBaseTier = this.actor.system.baseTier || 1;
    const dimOffensePen = Math.max(0, attackNum - 3) * dimBaseTier;
    await this.actor.update({
      "system.combatTabState.roundAttackCount": attackNum,
      "system.tracking.diminishingOffense": Math.max(0, attackNum - 3)
    });

    // Compose Strike + Wound formulas. Wager adds flat to wound (already baked
    // into prep formula if set in attack-ref, but for tracker wager we add now).
    const calledStrikeModifier = -(Number(action.calledStrikePenalty) || 0);
    const strikeFormulaBase = (sd.strikeFormula || "1d10")
      + (calledStrikeModifier > 0 ? `+${calledStrikeModifier}` : calledStrikeModifier < 0 ? String(calledStrikeModifier) : "");
    const strikeFormulaRaw = dimOffensePen > 0
      ? `${strikeFormulaBase}-${dimOffensePen}`
      : strikeFormulaBase;
    const woundFormulaBase = sd.woundFormula || "1d10";
    // Impaling Horns (bestial trait): +2(T) Wound on Physical attacks with Charging Assault
    const chargingBonus = action.charging
      ? (Number(this.actor.system._bestialChargingWoundBonus) || 0) : 0;
    let woundFormula = wager > 0
      ? `${woundFormulaBase}${woundFormulaBase.includes("+") ? "+" : "+"}${wager}`
      : woundFormulaBase;
    if (focusCharge) {
      const signature = String(action.source).startsWith("tech_");
      const technique = this.actor.system.signatureTechniques?.find(t => "tech_"+t.id === action.source);
      const die = energyChargeDie(this.actor.system.aptitudes, { signature, maximumCharge: technique?.advantages?.some(a => a.name === "Maximum Charge") });
      const tier = this.actor.system.tier || 1;
      woundFormula += "+" + tier + die + (sd.profile === "Mega Flare" ? "+" + tier : "");
    }
    if (action.calledWoundBonus) woundFormula += "+" + Number(action.calledWoundBonus);
    if (chargingBonus > 0) woundFormula = `${woundFormula}+${chargingBonus}`;

    // Execute rolls. Twin-Linked (signature.txt:382): roll the chosen Combat
    // Roll twice, keep the highest Dice Score. Dead-Link (signature.txt:875):
    // keep the lowest.
    const strikeLinkMode = sd.twinLinked === "strike" ? "high" : sd.deadLinked === "strike" ? "low" : "";
    const woundLinkMode = sd.twinLinked === "wound" ? "high" : sd.deadLinked === "wound" ? "low" : "";
    const strikeLinked = await rollLinked093(strikeFormulaRaw, strikeLinkMode);
    const combinationPending = prepareOnly && uses093(this.actor.system) && sd.profile === "Combination";
    const woundLinked = combinationPending ? {} : await rollLinked093(woundFormula, woundLinkMode);
    const strikeRoll = strikeLinked.roll;
    const woundRoll = woundLinked.roll;

    // Consume "next attack" temp effects — their bonuses were already baked
    // into the prepared Strike/Wound formulas used above.
    const fxAll = this.actor.system.combatTabState?.activeTempEffects || [];
    if (fxAll.some(fx => fx.duration === "nextAttack")) {
      await this.actor.update({
        "system.combatTabState.activeTempEffects": fxAll.filter(fx => fx.duration !== "nextAttack")
      });
    }

    let buffLines = (sd.activeBuffs || []).map(b => {
      const name = typeof b === "string" ? b : b.name;
      const tip = typeof b === "string" ? "" : (b.tooltip || "");
      return `<span class="dbu-attack-buff"${tip ? ` title="${tip.replace(/"/g, "&quot;")}"` : ""}>${name}</span>`;
    }).join("");
    if (chargingBonus > 0) {
      buffLines += `<span class="dbu-attack-buff" title="Impaling Horns: Charging Assault wound bonus">Impaling Horns +${chargingBonus} Wound</span>`;
    }
    if (strikeLinked.discarded) {
      buffLines += `<span class="dbu-attack-buff" title="${strikeLinkMode === "high" ? "Twin-Linked" : "Dead-Link"} (Strike): rolled twice, kept ${strikeRoll.total} over ${strikeLinked.discarded.total}">${strikeLinkMode === "high" ? "Twin-Linked" : "Dead-Link"} Strike: ${strikeRoll.total} vs ${strikeLinked.discarded.total}</span>`;
    }
    if (woundLinked.discarded) {
      buffLines += `<span class="dbu-attack-buff" title="${woundLinkMode === "high" ? "Twin-Linked" : "Dead-Link"} (Wound): rolled twice, kept ${woundRoll.total} over ${woundLinked.discarded.total}">${woundLinkMode === "high" ? "Twin-Linked" : "Dead-Link"} Wound: ${woundRoll.total} vs ${woundLinked.discarded.total}</span>`;
    }
    const buffsHtml = buffLines
      ? `<div class="dbu-attack-buffs"><strong>Active when rolled:</strong> ${buffLines}</div>`
      : "";

    const strikeNat = strikeRoll.dice[0]?.results?.[0]?.result ?? "?";
    const woundNat = woundRoll?.dice[0]?.results?.[0]?.result ?? "?";
    const strikeCT = sd.strikeCT || 10;
    const woundCT = sd.woundCT || 10;
    const sysTier = this.actor.system.tier || 1;
    const sysBaseTier = this.actor.system.baseTier || 1;

    // Critical Result (Nat >= CT): +Extra Dice, 1d6 scaled by tier (core-rules.txt:107).
    // Botch (Nat 1): -2(bT) to the Dice Score (core-rules.txt:109).
    const critFormula = this._critExtraFormula(sysTier);
    const botchPenalty = 2 * sysBaseTier;

    const profileRoll = uses093(this.actor.system) && strikeNat !== "?" ? profileRoll093(sd.profile, { strikeNatural: strikeNat, faces: strikeRoll.dice[0]?.faces || 10, targetingBonus: sd.targetingBonus || 0, strikeBotchThreshold: ragingBotch(this.actor.system), strikeCT, damageCat: sd.damageCat }) : null;
    const strikeCrit = profileRoll ? profileRoll.critical : strikeNat !== "?" && strikeNat >= strikeCT;
    const strikeBotch = profileRoll ? profileRoll.botch : strikeNat === 1;
    if (profileRoll) sd = { ...sd, damageCat: profileRoll.damageCat };
    const woundCrit = woundNat !== "?" && woundNat >= woundCT;
    const woundBotch = woundNat === 1;

    let strikeCritRoll = null, woundCritRoll = null;
    if (strikeCrit) { strikeCritRoll = new Roll(critFormula); await strikeCritRoll.evaluate(); }
    if (woundCrit) { woundCritRoll = new Roll(critFormula); await woundCritRoll.evaluate(); }

    const pinpointBonus = profile?.doubleInsightOnStrikeCrit && strikeCrit ? pinpointInsight093(this.actor.system, false) : 0;
    const strikeTotal = strikeRoll.total + (profileRoll?.strikeAdjustment || 0) + pinpointBonus
      + (strikeCritRoll?.total || 0) - (strikeBotch ? botchPenalty : 0);
    const woundTotal = (woundRoll?.total || 0)
      + (woundCritRoll?.total || 0) - (woundBotch ? botchPenalty : 0);

    const critTag = (critRoll) =>
      `<span class="dbu-crit">CRIT! +${critFormula}: ${critRoll.total}</span>`;
    const botchTag = () =>
      `<span class="dbu-botch">BOTCH -${botchPenalty}</span>`;
    const strikeTag = strikeCritRoll ? ` ${critTag(strikeCritRoll)}` : (strikeBotch ? ` ${botchTag()}` : "");
    const woundTag = woundCritRoll ? ` ${critTag(woundCritRoll)}` : (woundBotch ? ` ${botchTag()}` : "");

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const kiCost = (sd.kiCost || 0) + (action.dbuCalledShot ? 2 * sysTier : 0);

    // ---- HIDDEN content: EVERYTHING except the attack name is masked —
    // profile/foundation, damage category, EC, cost, wager, buffs, CTs
    // (CTs leak talent/state info) and roll values all wait for the reveal.
    // The attack number IS public — it drives Diminishing Offense tracking. ----
    const attackNumBadge = `<span class="dbu-action-count" title="Attacking Maneuvers this round — Diminishing Offense from the 4th onward">ATK ${attackNum}</span>`;
    const hiddenHtml = `<div class="dbu-attack-roll dbu-attack-unrevealed" data-actor-id="${this.actor.id}">
      <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${sd.name}</span>${attackNumBadge}</h3>
      <div class="dbu-card-body">
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Strike</span>
          <span class="dbu-hidden-val"><i class="fas fa-eye-slash"></i>&nbsp;???</span>
        </div>
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Wound</span>
          <span class="dbu-hidden-val"><i class="fas fa-eye-slash"></i>&nbsp;???</span>
        </div>
        <div class="dbu-attack-actions">
          <button type="button" class="dbu-reveal-btn" data-dbu-reveal data-actor-id="${this.actor.id}">
            <i class="fas fa-eye"></i> REVEAL
          </button>
        </div>
      </div>
    </div>`;

    // ---- REVEALED content: full details + ONE combined pay button ----
    const totalPay = kiCost + wager;
    const payParts = [];
    if (kiCost > 0) payParts.push(`Ki Cost (${kiCost} KP)`);
    if (wager > 0) payParts.push(`Ki Wager (${wager} KP)`);
    const payBtnHtml = totalPay > 0
      ? `<div class="dbu-attack-actions">
          <button type="button" class="dbu-pay-btn" data-dbu-pay="combined"
                  data-actor-id="${this.actor.id}" data-amount="${totalPay}">
            <i class="fas fa-fire"></i> Pay ${payParts.join(" + ")}
          </button>
        </div>`
      : "";
    const dimOffenseLine = dimOffensePen > 0
      ? `<div class="dbu-penalty-line"><i class="fas fa-angle-double-down"></i> Diminishing Offense −${dimOffensePen} Strike <span class="dbu-penalty-why">attack #${attackNum} this round</span></div>`
      : "";
    const metaChips = [
      uses093(this.actor.system) && sd.profile === "Pinpoint"
        ? `Pinpoint · ignora ${pinpointInsight093(this.actor.system, strikeCrit)} Soak` : "",
      uses093(this.actor.system) && !prepareOnly && sd.profile === "Combination"
        ? "Combination · após acertar, cada Strike extra superior ao Dodge ou Parry soma +2(T) ao Wound" : "",
      uses093(this.actor.system) && !prepareOnly && sd.profile === "Concentrated"
        ? "Concentrated · ignore metade do DR ao aplicar o dano" : "",
      `${sd.foundation || ""}${sd.profile ? " / " + sd.profile : ""}`.trim(),
      sd.damageCat || "",
      sd.energyCharges ? `EC ${sd.energyCharges}` : "",
      `Cost ${kiCost} KP`,
      wager > 0 ? `Wager ${wager} KP` : ""
    ].filter(Boolean).map(c => `<span class="dbu-meta-chip">${c}</span>`).join("");
    const revealedHtml = `<div class="dbu-attack-roll" data-actor-id="${this.actor.id}">
      <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${sd.name}</span>${attackNumBadge}</h3>
      <div class="dbu-card-body">
        <div class="dbu-attack-meta">${metaChips}</div>
        ${buffsHtml}
        ${dimOffenseLine}
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Strike</span>
          <span class="dbu-roll-main">
            <code class="dbu-roll-formula">${strikeFormulaRaw}</code>
            <span class="dbu-roll-sub">Nat ${profileRoll?.natural ?? strikeNat}${sd.targetingBonus ? ` · Targeting System +${profileRoll?.targetingAdjustment ?? sd.targetingBonus} natural` : ""} · CT ${strikeCT}+</span>${strikeTag}
          </span>
          <span class="dbu-roll-total">${strikeTotal}</span>
        </div>
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Wound</span>
          <span class="dbu-roll-main">
            <code class="dbu-roll-formula">${woundFormula}</code>
            <span class="dbu-roll-sub">Nat ${woundNat} · CT ${woundCT}+${wager > 0 ? ` · Wager +${wager}` : ""}</span>${woundTag}
          </span>
          <span class="dbu-roll-total">${woundTotal}</span>
        </div>
        ${payBtnHtml}
      </div>
    </div>`;

    const messageData = {
      speaker,
      content: hiddenHtml,
      flags: {
        "DBU-MRR-OLD": {
          attackReveal: {
            revealed: false,
            actorId: this.actor.id,
            kiCost,
            wager,
            revealedHtml,
            // Data for the United Attack Maneuver (allies joining this attack)
            foundation: sd.foundation || "",
            profile: sd.profile || "",
            attackName: sd.name || "",
            weaponId: sd.weaponId,
            strikeTotal,
            woundTotal,
            strikeRollData: strikeRoll.toJSON(),
            woundRollData: woundRoll?.toJSON() ?? null,
            ...(combinationPending ? { combination: { strikeFormula: strikeFormulaRaw, strikeLinkMode: strikeLinkMode === "low" ? "low" : "", woundFormula, woundLinkMode } } : {}),
            strikeCritRollData: strikeCritRoll ? strikeCritRoll.toJSON() : null,
            woundCritRollData: woundCritRoll ? woundCritRoll.toJSON() : null
          }
        }
      }
    };
    if (prepareOnly) return messageData;
    await createHiddenTrackerCard(messageData, journal);
    await applyDimensionBladeWear093(this.actor, sd.weaponId);
  },

  /** Store the chosen transformation index on the tracker "transform" action. */
  async _onTrackerTransformChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex].transformIndex = el.value === "" ? null : Number(el.value);
    const trans = (this.actor.system.transformations || [])[Number(el.value)];
    round.actions[actionIndex].description = trans ? `Transform: ${trans.name}` : "";
    await this.actor.update({ "system.combatTabState": cts });
  },

  /** Store the Transform panel checkboxes (Same Line / skip Stress Test). */
  async _onTrackerTransformCheckbox(event) {
    const el = event.currentTarget;
    const field = el.dataset.field;
    if (!["transformSameLine", "transformSkipTest", "transformReplace"].includes(field)) return;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex][field] = el.checked;
    await this.actor.update({ "system.combatTabState": cts });
  },

  /** Activate a transformation with full entry machinery (snapshot + syncs + entry effects).
   *  `deactivateIndices` lets a Step-by-Step replacement leave the previous form(s)
   *  in the same update so their bonuses never coexist with the new form's. */
  async _activateTransformationAtIndex(transIndex, deactivateIndices = []) {
    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (!trans[transIndex] || trans[transIndex].active) return;
    const snapshots = foundry.utils.deepClone(this.actor.system.transformationMeta?.entrySnapshots || {});
    for (const di of deactivateIndices) {
      if (di === transIndex || !trans[di]?.active) continue;
      trans[di].active = false;
      delete snapshots[String(trans[di].id ?? di)];
    }
    trans[transIndex].active = true;
    const transId = String(trans[transIndex].id ?? transIndex);
    const entrySnapshot = this._buildTransformationEntrySnapshot(transIndex, trans);
    snapshots[transId] = entrySnapshot;
    await this.actor.update({
      "system.transformations": trans,
      "system.transformationMeta.entrySnapshots": snapshots
    });
    await this._syncPersistentTransformationCombatStates(trans);
    await this._syncPersistentTransformationResources(trans);
    await this._syncPersistentTransformationFlags(trans);
    await this._applyTransformationEntryEffects(trans[transIndex], entrySnapshot);
  },

  /**
   * Compute the Transformation Maneuver's projected Combined Stress Test and
   * modifiers for an inactive transformation. Mirrors the actor's
   * combinedStressTest logic (Prelude −5, Crimson +2) and adds Step-by-Step
   * (Alternate Form → another Form) reduction. Returns null if the form is
   * missing or already active.
   */
  _computeTransformManeuver(chosenIndex, action = {}) {
    const system = this.actor.system;
    const all = system.transformations || [];
    const chosen = all[chosenIndex];
    if (!chosen || chosen.active) return null;

    // Effective ST after Prelude (transformation-aspects.txt:77): −5 when the
    // form has the Prelude aspect and it's currently active.
    const effST = (t) => {
      let st = Number(t.stressTest) || 0;
      const prelude = (t.aspects || []).some(a => String(a).trim() === "Prelude") && t.preludeActive;
      if (prelude) st = Math.max(0, st - 5);
      return st;
    };

    // Step-by-Step (transformation-rules.txt:118): while in an Alternate Form,
    // transforming into another Alternate/Legendary Form reduces the new form's
    // ST by the current Alternate Form's Tier of Power Requirement (+1 if the
    // new form is of the SAME Transformation Line).
    let stepByStep = null;
    const activeAltForm = all.find(t => t.active && t.transformationType === "form_alternate");
    const newIsForm = ["form_alternate", "form_legendary"].includes(chosen.transformationType);
    if (activeAltForm && newIsForm) {
      const topReq = parseInt(String(activeAltForm.tierRequirement || "").match(/(\d+)/)?.[1] || "0");
      const sameLine = !!action.transformSameLine;
      const reduction = topReq + (sameLine ? 1 : 0);
      if (reduction > 0) stepByStep = { formName: activeAltForm.name || "Alternate Form", reduction, sameLine };
    }

    let newST = effST(chosen);
    if (stepByStep) newST = Math.max(0, newST - stepByStep.reduction);

    // Step-by-Step replacement (default) vs conjunction: when entering an
    // Alternate/Legendary Form while another one is active, the normal flow is
    // to LEAVE the previous form (its ST does not combine and its bonuses end
    // on success). Unchecking "Replace" keeps both (transformation-rules.txt:40).
    const FORM_TYPES = ["form_alternate", "form_legendary"];
    const newIsFormType = FORM_TYPES.includes(chosen.transformationType);
    const replaceMode = newIsFormType && action.transformReplace !== false;
    const replacedIndices = replaceMode
      ? all.map((t, i) => (t.active && FORM_TYPES.includes(t.transformationType)) ? i : -1).filter(i => i >= 0)
      : [];
    const replacedNames = replacedIndices.map(i => all[i].name || "Form");

    // Combined ST = highest + 1/2 of each other (remaining active forms + the new form)
    const sts = all.filter((t, i) => t.active && !replacedIndices.includes(i)).map(effST);
    sts.push(newST);
    sts.sort((x, y) => y - x);
    let required = (sts[0] || 0) + sts.slice(1).reduce((acc, s) => acc + Math.floor(s / 2), 0);

    // Crimson Acclimation: +2 Combined Stress Test
    const crimson = !!system.aspectEffects?.crimsonAcclimationActive;
    if (crimson) required += 2;

    // New Level of Power (transformation-rules.txt:62): re-entering a form you
    // already entered this encounter needs no Stress Test — but ONLY on a solo
    // entry (no other active forms remaining). Marked manually via the panel checkbox.
    const soloEntry = all.filter((t, i) => t.active && !replacedIndices.includes(i)).length === 0;
    const willSkipTest = !!action.transformSkipTest && soloEntry;

    return {
      required,
      stepByStep,
      crimson,
      willSkipTest,
      soloRequested: !!action.transformSkipTest,
      replaceMode,
      replaceable: newIsFormType && all.some(t => t.active && FORM_TYPES.includes(t.transformationType)),
      replacedIndices,
      replacedNames,
      ignoredPenalty: system.thresholds?.stressPenalty || 0
    };
  },

  /**
   * Transformation Maneuver (actions-combat.txt): roll the Stress Test for a
   * selected transformation IGNORING Health Threshold Penalties; on success,
   * enter it (entry effects like Legend Realized / Burst Limit fire via the
   * normal activation machinery). New Level of Power can skip the test on a
   * solo re-entry. Combined ST includes Prelude / Crimson / Step-by-Step.
   */
  async _onRollTrackerTransform(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const action = round?.actions?.[actionIndex];
    const idx = Number(action?.transformIndex);
    const trans = (this.actor.system.transformations || [])[idx];
    if (!trans || trans.active) {
      ui.notifications.warn("Select an inactive transformation first.");
      return;
    }
    const system = this.actor.system;
    const calc = this._computeTransformManeuver(idx, action || {});
    if (!calc) return;
    const required = calc.required;

    // Chips describing the Combined Stress Test breakdown.
    const modChips = [];
    if (calc.stepByStep) modChips.push(`<span class="dbu-meta-chip">Step-by-Step −${calc.stepByStep.reduction} (${calc.stepByStep.formName}${calc.stepByStep.sameLine ? ", same line" : ""})</span>`);
    if (calc.crimson) modChips.push(`<span class="dbu-meta-chip">Crimson +2</span>`);
    if (calc.replaceMode && calc.replacedNames.length) modChips.push(`<span class="dbu-meta-chip">Leaves ${calc.replacedNames.join(", ")}</span>`);

    // New Level of Power skip: solo re-entry needs no Stress Test.
    if (calc.willSkipTest) {
      await this._activateTransformationAtIndex(idx, calc.replacedIndices);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll dbu-defend-card" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-bolt"></i> Transformation — ${trans.name}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-attack-meta"><span class="dbu-meta-chip">New Level of Power</span></div>
            <div class="dbu-defend-guide"><b>TRANSFORMED!</b> ${this.actor.name} re-enters <b>${trans.name}</b> — already entered this encounter, so no Stress Test was required. Entry effects applied.</div>
          </div>
        </div>`
      });
      return;
    }
    if (calc.soloRequested && !calc.willSkipTest) {
      ui.notifications.info("Entering in conjunction with another active form — a Stress Test is still required (New Level of Power skip ignored).");
    }

    // "ignoring any Health Threshold Penalties" — add back the stress penalty
    // that _calculateCombatStats subtracted from the Stress Bonus.
    const ignoredPen = calc.ignoredPenalty;
    const stressBonus = this._getStressBonus() + ignoredPen;
    const equipDiceBonus = Number(system.equipmentFlags?.stressTestDiceBonus) || 0;
    // The 1d10 for a Stress Test cannot Botch or Crit (transformation-rules.txt:41);
    // the roll is a plain 1d10 + 1 + Stress Bonus with no crit/botch handling.
    const roll = new Roll(`1d10 + 1 + ${stressBonus + equipDiceBonus}`);
    await roll.evaluate();
    const success = roll.total >= required;

    if (success) await this._activateTransformationAtIndex(idx, calc.replacedIndices);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<div class="dbu-attack-roll ${success ? "dbu-defend-card" : ""}" data-actor-id="${this.actor.id}">
        <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-bolt"></i> Transformation — ${trans.name}</span></h3>
        <div class="dbu-card-body">
          <div class="dbu-attack-meta">
            <span class="dbu-meta-chip">ST Required ${required}</span>
            <span class="dbu-meta-chip">Stress Bonus ${stressBonus}${ignoredPen ? ` (thresh. pen. +${ignoredPen} ignored)` : ""}</span>
            ${equipDiceBonus ? `<span class="dbu-meta-chip">Equip +${equipDiceBonus}</span>` : ""}
            ${modChips.join("")}
          </div>
          <div class="dbu-roll-row">
            <span class="dbu-roll-label">Stress</span>
            <span class="dbu-roll-main"><code class="dbu-roll-formula">1d10+1+${stressBonus + equipDiceBonus}</code><span class="dbu-roll-sub">vs ${required}</span></span>
            <span class="dbu-roll-total">${roll.total}</span>
          </div>
          <div class="dbu-defend-guide">${success
            ? `<b>TRANSFORMED!</b> ${this.actor.name} enters <b>${trans.name}</b> — entry effects applied.`
            : `<b>FAILED.</b> ${this.actor.name} does not transform and suffers <b>Stress Exhaustion</b> until the end of their next turn.`}</div>
        </div>
      </div>`
    });
  },

  /** Store the chosen Grapple option on the tracker action. */
  async _onTrackerGrappleOptionChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex].grappleOption = el.value;
    round.actions[actionIndex].description = el.value ? `Grapple: ${el.value}` : "";
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Grapple Maneuver (actions-combat.txt:216-243) — interactive clash card.
   * The opponent responds from the chat (Strike/Dodge, or Might for Pulled In).
   */
  async _onUseTrackerGrapple(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const option = round?.actions?.[actionIndex]?.grappleOption;
    if (!option) {
      ui.notifications.warn("Select a Grapple option first.");
      return;
    }
    const tier = this.actor.system.tier || 1;
    const strikeF = this._trackerDefend?.strikeFormula || "1d10";
    const strikeCT = this._calcCombatCTs(this.actor.system).strikeCT;
    const might = this.actor.system.status?.mightForClashes ?? this.actor.system.status?.might ?? 0;
    const defs = {
      init: { label: "Grapple Check", formula: strikeF, ct: strikeCT, responderKind: "strike-or-dodge",
        note: "[1/Round] Win: Grapple established (both Guard Down). Lose: provoke the Exploit Maneuver." },
      tail: { label: "Grapple — Tail Restraint", formula: `${strikeF}-${2 * tier}`, ct: strikeCT, responderKind: "strike-or-dodge",
        note: `−${2 * tier} penalty to grab the tail — win: target cannot use Tail Attack in this Grapple.` },
      escape: { label: "Escape Grapple", formula: strikeF, ct: strikeCT, responderKind: "strike-or-dodge",
        note: "Grapple Check at the start of your turn — win to escape the Grapple." },
      pulledIn: { label: "Pulled In", formula: `1d10+${might}`, ct: 10, responderKind: "might",
        note: "Instant Maneuver (Grappler): Might Clash — win to pull the Grappled adjacent." },
      launch: { label: "Launch", formula: strikeF, ct: strikeCT, responderKind: "strike-or-dodge",
        note: "[1/Round] Grapple Check — win: end Grapple, move target up to your Might. Lose: they escape." }
    };
    const d = defs[option];
    if (!d) return;
    await initiateClash(this.actor, { type: "grapple", option, ...d });
  },

  /**
   * Thrust Maneuver (actions-combat.txt:328-333) — interactive clash card;
   * on win the initiator picks Push Back or Knock Prone in the chat.
   */
  async _onUseTrackerThrust(event) {
    event.preventDefault();
    const strikeF = this._trackerDefend?.strikeFormula || "1d10";
    const strikeCT = this._calcCombatCTs(this.actor.system).strikeCT;
    await initiateClash(this.actor, {
      type: "thrust", option: "thrust",
      label: "Thrust", formula: strikeF, ct: strikeCT, responderKind: "strike-or-dodge",
      note: "[1/Round] Melee Clash (Strike vs Strike/Dodge). Win: choose Push Back (½ Might, double Collision, −1(bT) their Acrobatics) or Knock Prone (Might Clash)."
    });
  },

  /**
   * Terrify Maneuver (actions-combat.txt) — Skill Clash card
   * (Intimidation vs Intuition/Intimidation). Win: Shaken; already Shaken → Prone.
   */
  async _onUseTrackerTerrify(event) {
    event.preventDefault();
    const { computeSkillBonus } = await import("../../helpers/duel.mjs");
    const bonus = computeSkillBonus(this.actor, "intimidation");
    await initiateClash(this.actor, {
      type: "terrify", option: "terrify",
      label: "Terrify", formula: `1d10+${bonus}`, ct: 10,
      responderKind: "skill", responderSkills: ["empathy", "intimidation"],
      note: "[1/Round] Target within 4 Squares. Skill Clash (Intimidation vs Intuition/Intimidation). Win: Shaken until end of your next turn — if already Shaken, knocked Prone."
    });
  },

  /**
   * Feint Maneuver (actions-combat.txt) — Instant, 2(T) KP, in response to
   * declaring a Basic Attack (no AoE). Skill Clash (Bluff vs Intuition/Perception).
   */
  async _onUseTrackerFeint(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const action = round?.actions?.[actionIndex];
    const initAttackCost = Math.max(0, Number(action?.feintAttackCost) || 0);
    const tier = this.actor.system.tier || 1;
    const feintCost = 2 * tier;
    // Pay the Feint's 2(T) KP now (whisper remaining to GM + owners)
    const ki = this.actor.system.kiPool?.value ?? 0;
    await this.actor.update({ "system.kiPool.value": Math.max(0, ki - feintCost) });
    const whisperIds = game.users
      .filter(u => u.isGM || this.actor.testUserPermission(u, "OWNER"))
      .map(u => u.id);
    ChatMessage.create({
      content: `<div class="dbu-ki-deduct"><i class="fas fa-theater-masks"></i> <b>${this.actor.name}</b>: Feint -${feintCost} KP. Remaining KP: <b>${Math.max(0, ki - feintCost)}</b></div>`,
      whisper: whisperIds,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
    const { computeSkillBonus } = await import("../../helpers/duel.mjs");
    const bonus = computeSkillBonus(this.actor, "bluff");
    await initiateClash(this.actor, {
      type: "feint", option: "feint",
      label: "Feint", formula: `1d10+${bonus}`, ct: 10,
      responderKind: "skill", responderSkills: ["empathy", "perception"],
      extra: { initAttackCost },
      note: `[1/Round · Instant · ${feintCost} KP] In response to declaring a Basic Attack (no AoE). Skill Clash (Bluff vs Intuition/Perception).`
    });
  },

  /**
   * Dirty Trick Maneuver (special-maneuvers) — Clash (Bluff vs Intuition).
   * Win: choose Pocket Sand (Blinded) / Made ya look! (Guard Down) /
   * It's Such a Tragedy! (Compelled, 1/Encounter, crit/botch rider).
   */
  async _onUseTrackerDirtyTrick(event) {
    event.preventDefault();
    const { computeSkillBonus } = await import("../../helpers/duel.mjs");
    const bonus = computeSkillBonus(this.actor, "bluff");
    await initiateClash(this.actor, {
      type: "dirtyTrick", option: "dirtyTrick",
      label: "Dirty Trick", formula: `1d10+${bonus}`, ct: 10,
      responderKind: "skill", responderSkills: ["empathy"],
      note: "[1/Round] Target within a Sphere AoE (centered on you). Clash (Bluff vs Intuition)."
    });
  },

  /** Store the chosen Duel mode (power / clash) on the tracker action. */
  async _onTrackerDuelModeChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex].duelMode = el.value;
    round.actions[actionIndex].description = el.value ? `Duel: ${el.value === "power" ? "Power Duel" : "Duel Clash"}` : "";
    await this.actor.update({ "system.combatTabState": cts });
  },

  /** Store the chosen Initiating Attack for a Duel Clash. */
  async _onTrackerDuelSourceChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    const action = round.actions[actionIndex];
    action.duelSource = el.value;
    // Bookkeep the Initiating Attack's KP cost on the tracker row (rules:
    // "by spending the Ki Points to make an Attacking Maneuver")
    let sd = null;
    for (const g of (this._trackerSourceGroups || [])) {
      const s = g.sources.find(x => x.key === el.value);
      if (s) { sd = s; break; }
    }
    action.kiCost = sd?.kiCost || 0;
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Initiate a Duel Maneuver (actions-combat.txt:507-533). Posts the
   * interactive duel card to chat; the flow continues there (accept/escape,
   * secret wagers, dual reveal, resolution). Spends a Counter Action.
   */
  async _onInitiateDuel(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const action = round?.actions?.[actionIndex];
    const mode = action?.duelMode;
    if (!mode) {
      ui.notifications.warn("Select a Duel mode first.");
      return;
    }
    let opts = { mode: "power" };
    if (mode === "clash") {
      let sd = null;
      for (const g of (this._trackerSourceGroups || [])) {
        const s = g.sources.find(x => x.key === action.duelSource);
        if (s) { sd = s; break; }
      }
      if (!sd) {
        ui.notifications.warn("Select the Initiating Attack for the Duel Clash.");
        return;
      }
      opts = {
        mode: "clash",
        sourceName: sd.name,
        foundation: sd.foundation || "",
        ec: sd.energyCharges || 0,
        ps: sd.powerShot || 0,
        woundFormula: sd.woundFormula || "1d10",
        damageCat: sd.damageCat || "Standard"
      };
    }
    // Counter Action tracking (same pool as Defend; no Diminishing Defense)
    const counterNum = (Number(cts.roundCounterCount) || 0) + 1;
    await this.actor.update({ "system.combatTabState.roundCounterCount": counterNum });
    await initiateDuel(this.actor, opts);
  },

  /** Store the chosen Defend Maneuver option on the tracker action. */
  async _onTrackerDefendOptionChange(event) {
    const el = event.currentTarget;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    const action = round.actions[actionIndex];
    action.defendOption = el.value;
    const opt = (this._defendCatalog || []).find(d => d.key === el.value);
    action.kiCost = opt ? opt.costT * (this.actor.system.tier || 1) : 0;
    action.description = opt ? `Defend: ${opt.name}` : "";
    await this.actor.update({ "system.combatTabState": cts });
  },

  /** Store Defend/Feint panel numeric inputs. */
  async _onTrackerDefendInput(event) {
    const el = event.currentTarget;
    const field = el.dataset.field;
    if (!["defendPenalty", "defendWager", "defendEC", "feintAttackCost"].includes(field)) return;
    const roundNum = Number(el.dataset.round);
    const actionIndex = Number(el.dataset.actionIndex);
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    if (!round?.actions?.[actionIndex]) return;
    round.actions[actionIndex][field] = Math.max(0, Number(el.value) || 0);
    await this.actor.update({ "system.combatTabState": cts });
  },

  /**
   * Use a Defend Maneuver from the tracker (actions-combat.txt:485-506).
   * - Parry / Power Flare: hidden roll -> Reveal (same machinery as attacks),
   *   with the option's modifiers baked into the formula.
   * - Guard / Direct Hit / Cross Counter: immediate chat card with a Pay button
   *   (when it costs KP) and guidance to run the incoming Wound through the
   *   Damage Tracker. Guard/Direct Hit pre-configure the Damage Tracker's
   *   Defense select; Guard paid here is NOT re-charged by Apply Damage.
   * Spends a Counter Action (badge) but does NOT touch Diminishing Defense.
   */
  async _onRollTrackerDefend(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const roundNum = Number(btn.dataset.round);
    const actionIndex = Number(btn.dataset.actionIndex);
    const cts = this.actor.system.combatTabState || {};
    const round = (cts.rounds || []).find(r => r.roundNumber === roundNum);
    const action = round?.actions?.[actionIndex];
    const opt = (this._defendCatalog || []).find(d => d.key === action?.defendOption);
    if (!opt) {
      ui.notifications.warn("Select a Defend option first.");
      return;
    }
    const tier = this.actor.system.tier || 1;
    const baseTier = this.actor.system.baseTier || 1;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    // Counter Action tracking (NOT Diminishing Defense — Defend is exempt).
    const counterNum = (Number(cts.roundCounterCount) || 0) + 1;
    const ctrBadge = `<span class="dbu-action-count" title="Counter Actions used this round — Defend does not trigger Diminishing Defense">CTR ${counterNum}</span>`;
    const updates = { "system.combatTabState.roundCounterCount": counterNum };

    // ---- Roll-based options: Parry (Strike roll) / Power Flare (Wound roll) ----
    if (opt.rollBased) {
      const journal = await privateRollJournal();
      const isParry = opt.key === "parry";
      const cts2 = this._calcCombatCTs(this.actor.system);
      const rollCT = isParry ? cts2.strikeCT : cts2.woundCT;
      const penalty = isParry ? Math.max(0, Number(action.defendPenalty) || 0) * (uses093(this.actor.system) ? baseTier : tier) : 0;
      const wager = !isParry
        ? Math.max(0, Math.min(Number(action.defendWager) || 0, this._trackerDefend?.maxFlareWager || 0))
        : 0;
      const base = isParry ? (this._trackerDefend?.strikeFormula || "1d10") : (this._trackerDefend?.woundFormula || "1d10");
      let formula = base;
      if (penalty > 0) formula += `-${penalty}`;
      if (wager > 0) formula += `+${wager}`;
      // Robotic Limb, Fierce Counter and Duelist contribute to Parry only.
      const parryBonus = isParry
        ? (Number(this.actor.system._cyberParryStrike) || 0) + (Number(this.actor.system.aptitudes?.fierceCounterStrike) || 0) + duelistParryBonus093(this.actor)
        : 0;
      if (parryBonus > 0) formula += `+${parryBonus}`;
      const kiCost = uses093(this.actor.system) ? defendKiCost093(this.actor.system, opt.key, action.defendEC) : opt.costT * tier;
      const totalPay = kiCost + wager;

      const roll = new Roll(formula);
      await roll.evaluate();
      const nat = roll.dice[0]?.results?.[0]?.result ?? "?";
      const isCrit = nat !== "?" && nat >= rollCT;
      const isBotch = nat <= (isParry ? ragingBotch(this.actor.system) : 1);
      let critRoll = null;
      if (isCrit) { critRoll = new Roll(this._critExtraFormula(tier)); await critRoll.evaluate(); }
      const botchPenalty = 2 * baseTier;
      const total = roll.total + (critRoll?.total || 0) - (isBotch ? botchPenalty : 0);
      const tag = critRoll
        ? ` <span class="dbu-crit">CRIT! +${critRoll.formula}: ${critRoll.total}</span>`
        : (isBotch ? ` <span class="dbu-botch">BOTCH -${botchPenalty}</span>` : "");

      const metaChips = [
        "Defend Maneuver",
        isParry && penalty > 0 ? `−${penalty} (EC/PS ×1(T))` : "",
        !isParry && wager > 0 ? `Wager ${wager} KP` : "",
        `Cost ${kiCost} KP`
      ].filter(Boolean).map(c => `<span class="dbu-meta-chip">${c}</span>`).join("");
      const payParts = [];
      if (kiCost > 0) payParts.push(`Ki Cost (${kiCost} KP)`);
      if (wager > 0) payParts.push(`Ki Wager (${wager} KP)`);
      const payBtnHtml = totalPay > 0
        ? `<div class="dbu-attack-actions">
            <button type="button" class="dbu-pay-btn" data-dbu-pay="defend"
                    data-actor-id="${this.actor.id}" data-amount="${totalPay}">
              <i class="fas fa-fire"></i> Pay ${payParts.join(" + ")}
            </button>
          </div>`
        : "";

      const hiddenHtml = `<div class="dbu-attack-roll dbu-attack-unrevealed dbu-defend-card" data-actor-id="${this.actor.id}">
        <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${opt.name}</span>${ctrBadge}</h3>
        <div class="dbu-card-body">
          <div class="dbu-roll-row">
            <span class="dbu-roll-label">${opt.name}</span>
            <span class="dbu-hidden-val"><i class="fas fa-eye-slash"></i>&nbsp;???</span>
          </div>
          <div class="dbu-attack-actions">
            <button type="button" class="dbu-reveal-btn" data-dbu-reveal data-actor-id="${this.actor.id}">
              <i class="fas fa-eye"></i> REVEAL
            </button>
          </div>
        </div>
      </div>`;
      const revealedHtml = `<div class="dbu-attack-roll dbu-defend-card" data-actor-id="${this.actor.id}">
        <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${opt.name}</span>${ctrBadge}</h3>
        <div class="dbu-card-body">
          <div class="dbu-attack-meta">${metaChips}</div>
          <div class="dbu-roll-row">
            <span class="dbu-roll-label">${opt.name}</span>
            <span class="dbu-roll-main">
              <code class="dbu-roll-formula">${formula}</code>
              <span class="dbu-roll-sub">Nat ${nat} · CT ${rollCT}+</span>${tag}
            </span>
            <span class="dbu-roll-total">${total}</span>
          </div>
          ${payBtnHtml}
        </div>
      </div>`;

      await this.actor.update(updates);
      await createHiddenTrackerCard({
        speaker,
        content: hiddenHtml,
        flags: {
          "DBU-MRR-OLD": {
            attackReveal: {
              revealed: false,
              actorId: this.actor.id,
              kiCost,
              wager,
              revealedHtml,
              strikeRollData: roll.toJSON(),
              woundRollData: null,
              strikeCritRollData: critRoll ? critRoll.toJSON() : null,
              woundCritRollData: null
            }
          }
        }
      }, journal);
      return;
    }

    // ---- Non-roll options: Guard / Direct Hit / Cross Counter ----
    let kiCost = uses093(this.actor.system) ? defendKiCost093(this.actor.system, opt.key, action.defendEC) : opt.costT * tier;
    if (opt.key === "guard") {
      const ec = Math.min(Math.max(0, Number(action.defendEC) || 0), 4);
      if (!uses093(this.actor.system)) {
        kiCost = (8 + ec) * tier;
        if (this.actor._isConditionActive?.(this.actor.system, "guardDown")) kiCost = Math.ceil(kiCost * 1.5);
      }
      // Pre-configure the Damage Tracker; Apply Damage will NOT charge again.
      updates["system.damageCalc.defense"] = "guard";
      updates["system.damageCalc.incomingEC"] = Math.min(Math.max(0, Number(action.defendEC) || 0), 4);
      updates["system.damageCalc.guardPaidViaCard"] = true;
    } else if (opt.key === "directHit") {
      updates["system.damageCalc.defense"] = "directHit";
    }
    const payBtnHtml = kiCost > 0
      ? `<div class="dbu-attack-actions">
          <button type="button" class="dbu-pay-btn" data-dbu-pay="defend"
                  data-actor-id="${this.actor.id}" data-amount="${kiCost}">
            <i class="fas fa-fire"></i> Pay ${opt.name} (${kiCost} KP)
          </button>
        </div>`
      : "";
    const setupNote = (opt.key === "guard" || opt.key === "directHit")
      ? `Damage Tracker Defense pre-set to <b>${opt.name}</b>. `
      : "";
    await this.actor.update(updates);
    await ChatMessage.create({
      speaker,
      content: `<div class="dbu-attack-roll dbu-defend-card" data-actor-id="${this.actor.id}">
        <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${opt.name}</span>${ctrBadge}</h3>
        <div class="dbu-card-body">
          <div class="dbu-attack-meta">
            <span class="dbu-meta-chip">Defend Maneuver</span>
            ${kiCost > 0 ? `<span class="dbu-meta-chip dbu-chip-hot">${kiCost} KP</span>` : `<span class="dbu-meta-chip">0 KP</span>`}
          </div>
          <div class="dbu-defend-desc">${opt.desc}</div>
          ${payBtnHtml}
          <div class="dbu-defend-guide"><i class="fas fa-arrow-right"></i> ${setupNote}Enter the attacker's Wound Roll in the <b>Damage Tracker</b> and press <b>Apply Damage</b>.</div>
        </div>
      </div>`
    });
  },

  /**
   * Roll Dodge from the tracker — public animated roll with CRIT (dodgeCT:
   * Instinctual Evasion, Mindful, buffs, bestial Return to Heritage) and
   * BOTCH handling, matching core-rules.txt:103-109.
   *
   * Diminishing Defense (attacking.txt:35-49): each dodge after the first this
   * round suffers a stacking DV penalty of ceil(bT/2) per prior incoming attack
   * (bT 1-2: -1, 3-4: -2, 5-6: -3, 7: -4). Counter resets on Next Round.
   */
  async _onRollTrackerDodge(event) {
    event.preventDefault();
    const td = this._trackerDodge || { formula: "1d10", ct: 10 };
    const sysTier = this.actor.system.tier || 1;
    const sysBaseTier = this.actor.system.baseTier || 1;

    const cts = this.actor.system.combatTabState || {};
    const dodgeNum = (Number(cts.roundDodgeCount) || 0) + 1;
    const perStack = Math.ceil(sysBaseTier / 2);
    const dimDefensePen = (dodgeNum - 1) * perStack;
    await this.actor.update({
      "system.combatTabState.roundDodgeCount": dodgeNum,
      "system.tracking.diminishingDefense": dodgeNum - 1
    });

    const formula = dimDefensePen > 0 ? `${td.formula}-${dimDefensePen}` : td.formula;
    const roll = new Roll(formula);
    await roll.evaluate();
    const rawNat = roll.dice[0]?.results?.[0]?.result ?? "?";
    // Alternate Sight (bestial trait): +1 Natural Result on Dodge Rolls
    // (raises the effective die face: affects total AND crit check; a raw 1 still botches)
    const natBonus = Number(this.actor.system._bestialDodgeNaturalBonus) || 0;
    const nat = rawNat === "?" ? "?" : Math.min(10, rawNat + natBonus);
    const isCrit = nat !== "?" && nat >= td.ct;
    const isBotch = rawNat <= ragingBotch(this.actor.system);
    let critRoll = null;
    if (isCrit) { critRoll = new Roll(this._critExtraFormula(sysTier)); await critRoll.evaluate(); }
    const botchPenalty = 2 * sysBaseTier;
    const natGain = (nat !== "?" && rawNat !== "?") ? (nat - rawNat) : 0;
    const total = roll.total + natGain + (critRoll?.total || 0) - (isBotch ? botchPenalty : 0);
    const tag = critRoll
      ? ` <span class="dbu-crit">CRIT! +${critRoll.formula}: ${critRoll.total}</span>`
      : (isBotch ? ` <span class="dbu-botch">BOTCH -${botchPenalty}</span>` : "");
    const dodgeNumBadge = `<span class="dbu-action-count" title="Dodges this round — Diminishing Defense from the 2nd onward">DGE ${dodgeNum}</span>`;
    const dimLine = dimDefensePen > 0
      ? `<div class="dbu-penalty-line"><i class="fas fa-angle-double-down"></i> Diminishing Defense −${dimDefensePen} DV <span class="dbu-penalty-why">${dodgeNum - 1} prior attack${dodgeNum - 1 !== 1 ? "s" : ""} × ${perStack}</span></div>`
      : "";
    const flavor = `<div class="dbu-attack-roll dbu-dodge-card" data-actor-id="${this.actor.id}">
      <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — Dodge</span>${dodgeNumBadge}</h3>
      <div class="dbu-card-body">
        ${dimLine}
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Dodge</span>
          <span class="dbu-roll-main">
            <code class="dbu-roll-formula">${formula}</code>
            <span class="dbu-roll-sub">Nat ${natGain > 0 ? `${rawNat}→${nat} (Alt. Sight)` : nat} · CT ${td.ct}+</span>${tag}
          </span>
          <span class="dbu-roll-total">${total}</span>
        </div>
      </div>
    </div>`;
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor });
    if (critRoll && game.dice3d) {
      try { game.dice3d.showForRoll(critRoll, game.user, true); } catch (e) { /* best-effort */ }
    }
  },
};
