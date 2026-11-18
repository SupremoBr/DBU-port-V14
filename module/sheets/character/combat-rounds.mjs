import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: combat-rounds. Methods run with the sheet as this. */
export const combatRoundsMethods = {

  async _onCombatNewRound(event) {
    event.preventDefault();
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    // Advance round in tracker
    if (!cts.rounds) cts.rounds = [];
    cts.rounds.push({ roundNumber: cts.rounds.length + 1, actions: [] });
    cts.currentRound = cts.rounds.length;
    // Recalculate active power stacks (power-ups last 2 rounds)
    let activePowerUps = 0;
    for (const r of cts.rounds) {
      if (r.roundNumber >= cts.currentRound - 1) {
        for (const a of (r.actions || [])) {
          if (a.type === "power-up") activePowerUps++;
        }
      }
    }

    // Capture pre-reset counters for the round-change chat summary
    const prevAttackCount = Number(this.actor.system.combatTabState?.roundAttackCount) || 0;
    const prevDodgeCount = Number(this.actor.system.combatTabState?.roundDodgeCount) || 0;

    const updates = {
      "system.combatTabState.rounds": cts.rounds,
      "system.combatTabState.currentRound": cts.currentRound,
      "system.combatTabState.roundAttackCount": 0,
      "system.combatTabState.roundDodgeCount": 0,
      "system.combatTabState.roundCounterCount": 0,
      "system.tracking.powerStacks": activePowerUps,
      "system.tracking.energyCharges": 0,
      "system.tracking.diminishingDefense": 0,
      "system.tracking.diminishingOffense": 0,
      // Cruelty Stacks are lost at the end of your turns (Cruel Intentions)
      "system.tracking.crueltyStacks": 0,
      // Reset Experienced Fighter for new round
      "system.experiencedFighter.mode": "none",
      "system.experiencedFighter.usedThisRound": false,
      // Reset round-scoped transformation tracking
      "system.transformationMeta.surgingStrengthRound": 0,
      // Evil Aura: techniques access ends at end of turn (≈ next round in this engine)
      "system.transformationMeta.evilTechsActive": false,
      // Reset Capacity to Max Capacity at start of each round (core-rules.txt:140)
      "system.status.capacitySpent": 0,
      // Expire round-scoped temp effects from activable automation ("encounter" ones persist)
      "system.combatTabState.activeTempEffects":
        (this.actor.system.combatTabState?.activeTempEffects || []).filter(fx => fx.duration === "encounter")
    };

    // Explicitly delete round-scoped resourceUsage keys (Foundry deep merge workaround)
    const ru = this.actor.system.combatTabState?.resourceUsage?.round || {};
    for (const key of Object.keys(ru)) {
      updates[`system.combatTabState.resourceUsage.round.-=${key}`] = null;
    }

    // Explicitly delete round-scoped effectTracking keys
    const ue = this.actor.system.effectTracking?.usedEffects?.round || {};
    for (const key of Object.keys(ue)) {
      updates[`system.effectTracking.usedEffects.round.-=${key}`] = null;
    }

    await this.actor.update(updates);

    // Transformation / manifested per-round resource generation
    const allPerRoundSources = [
      ...(this.actor.system.manifestedPowerBonuses?.entries || []),
      ...(this.actor.system.enhancementPowerBonuses?.entries || []),
      ...(this.actor.system.alternateFormBonuses?.entries || []),
      ...(this.actor.system.legendaryFormBonuses?.entries || [])
    ];
    const perRoundUpdates = {};
    const prMessages = [];
    for (const entry of allPerRoundSources) {
      for (const pr of (entry.perRound || [])) {
        if (pr.type === "kp") {
          const currentKP = this.actor.system.kiPool?.value ?? 0;
          const maxKP = this.actor.system.kiPool?.max ?? 0;
          const baseKP = perRoundUpdates["system.kiPool.value"] ?? currentKP;
          const newKP = Math.min(maxKP, baseKP + pr.amount);
          if (newKP > baseKP) {
            perRoundUpdates["system.kiPool.value"] = newKP;
            prMessages.push(`${entry.name}: +${newKP - baseKP} KP (${pr.label})`);
          }
        } else if (pr.type === "lp") {
          const currentLP = this.actor.system.lifePoints?.value ?? 0;
          const maxLP = this.actor.system.lifePoints?.max ?? 0;
          const baseLP = perRoundUpdates["system.lifePoints.value"] ?? currentLP;
          const newLP = Math.min(maxLP, baseLP + pr.amount);
          if (newLP > baseLP) {
            perRoundUpdates["system.lifePoints.value"] = newLP;
            prMessages.push(`${entry.name}: +${newLP - baseLP} LP (${pr.label})`);
          }
        } else if (pr.type === "pp") {
          const currentPP = this.actor.system.tracking?.perfectPoints ?? 0;
          const basePP = perRoundUpdates["system.tracking.perfectPoints"] ?? currentPP;
          perRoundUpdates["system.tracking.perfectPoints"] = basePP + pr.amount;
          prMessages.push(`${entry.name}: +${pr.amount} Perfect Points`);
        } else if (pr.type === "dkp") {
          const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
          const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
          const baseDKP = perRoundUpdates["system.divineKiPoints.value"] ?? currentDKP;
          const newDKP = Math.min(maxDKP, baseDKP + pr.amount);
          if (newDKP > baseDKP) {
            perRoundUpdates["system.divineKiPoints.value"] = newDKP;
            prMessages.push(`${entry.name}: +${newDKP - baseDKP} DKP (${pr.label})`);
          }
        }
      }
    }
    const specialResources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const activeTransforms = this.actor.system.transformations || [];
    const instinctSource = activeTransforms.find(t => t?.active && ["ultra_instinct_sign", "ultra_instinct_complete"].includes(t.catalogKey));
    if (instinctSource) {
      const currentInstinct = specialResources.instinct?.value ?? 0;
      const newInstinct = Math.min(3, currentInstinct + 1);
      if (newInstinct > currentInstinct) {
        specialResources.instinct = {
          value: newInstinct,
          max: 3,
          source: instinctSource.catalogKey,
          sourceName: instinctSource.name || "Ultra Instinct"
        };
        prMessages.push(`${instinctSource.name}: +${newInstinct - currentInstinct} Instinct`);
      }
    }
    const acclimationSource = activeTransforms.find(t => t?.active && t.catalogKey === "super_saiyan_god");
    if (acclimationSource) {
      const currentAcclimation = specialResources.acclimation?.value ?? 0;
      const newAcclimation = Math.min(4, currentAcclimation + 1);
      if (newAcclimation > currentAcclimation) {
        specialResources.acclimation = {
          value: newAcclimation,
          max: 4,
          source: acclimationSource.catalogKey,
          sourceName: acclimationSource.name || "Super Saiyan God"
        };
        prMessages.push(`${acclimationSource.name}: +${newAcclimation - currentAcclimation} Acclimation`);
      }
    }
    const justiceContext = this._getJusticeChargeContext(activeTransforms);
    const justiceSource = justiceContext.transforms[0] || null;
    const currentJustice = specialResources.justiceCharge?.value ?? 0;
    if (justiceSource && currentJustice > 0) {
      const gain = 2 * (this.actor.system.baseTier || Math.ceil((this.actor.system.tier || 1) / 2)) * currentJustice;
      const currentKP = this.actor.system.kiPool?.value ?? 0;
      const maxKP = this.actor.system.kiPool?.max ?? 0;
      const baseKP = perRoundUpdates["system.kiPool.value"] ?? currentKP;
      const newKP = Math.min(maxKP, baseKP + gain);
      if (newKP > baseKP) {
        perRoundUpdates["system.kiPool.value"] = newKP;
        prMessages.push(`${justiceSource.name}: +${newKP - baseKP} KP (Justice Charge)`);
      }
    }

    if (Object.keys(perRoundUpdates).length > 0 || Object.keys(specialResources).length > 0) {
      const combinedUpdates = { ...perRoundUpdates };
      if (Object.keys(specialResources).length > 0) {
        combinedUpdates["system.transformationMeta.specialResources"] = specialResources;
      }
      await this.actor.update(combinedUpdates);
    }
    if (prMessages.length > 0) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.85rem"><b><i class="fas fa-sync-alt"></i> Per-Round Resources (Round ${cts.currentRound})</b><br>${prMessages.join("<br>")}</div>`
      });
    }

    // Talent per-round resource generation
    const tbBonuses = this.actor.system.talentBonuses || {};
    const talentPerRoundUpdates = {};
    const tbMessages = [];
    for (const entry of (tbBonuses.entries || [])) {
      for (const pr of (entry.perRound || [])) {
        if (pr.type === "kp") {
          const currentKP = this.actor.system.kiPool?.value ?? 0;
          const maxKP = this.actor.system.kiPool?.max ?? 0;
          const newKP = Math.min(maxKP, currentKP + (talentPerRoundUpdates["system.kiPool.value"] != null ? 0 : pr.amount));
          const baseKP = talentPerRoundUpdates["system.kiPool.value"] ?? currentKP;
          const updKP = Math.min(maxKP, baseKP + pr.amount);
          if (updKP > baseKP) {
            talentPerRoundUpdates["system.kiPool.value"] = updKP;
            tbMessages.push(`${entry.name}: +${updKP - baseKP} KP (${pr.label})`);
          }
        } else if (pr.type === "lp") {
          const currentLP = this.actor.system.lifePoints?.value ?? 0;
          const maxLP = this.actor.system.lifePoints?.max ?? 0;
          const baseLP = talentPerRoundUpdates["system.lifePoints.value"] ?? currentLP;
          const updLP = Math.min(maxLP, baseLP + pr.amount);
          if (updLP > baseLP) {
            talentPerRoundUpdates["system.lifePoints.value"] = updLP;
            tbMessages.push(`${entry.name}: +${updLP - baseLP} LP (${pr.label})`);
          }
        } else if (pr.type === "patience") {
          // Reserved Combatant: only if Holding Back (1+ Holding Back stacks)
          const holdingBack = (this.actor.system.tracking?.holdingBackStacks || 0) > 0;
          if (holdingBack) {
            const currentPatience = this.actor.system.tracking?.patienceStacks ?? 0;
            talentPerRoundUpdates["system.tracking.patienceStacks"] = currentPatience + pr.amount;
            tbMessages.push(`${entry.name}: +${pr.amount} Patience stack (${pr.label})`);
          }
        }
      }
    }
    // Reset talent stance shifts for new round
    talentPerRoundUpdates["system.combatTabState.talentTempMods"] = {};
    if (Object.keys(talentPerRoundUpdates).length > 0) {
      await this.actor.update(talentPerRoundUpdates);
      if (tbMessages.length > 0) {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="font-size:0.85rem"><b><i class="fas fa-gem"></i> Talent Per-Round (Round ${cts.currentRound})</b><br>${tbMessages.join("<br>")}</div>`
        });
      }
    }

    // --- Aspect per-round notifications ---
    const aspectEffects = this.actor.system.aspectEffects || {};

    // Power High (transformation-aspects.txt:167): roll 1d10 at start of turn.
    // ≤5 → must use Direct Hit vs the next attack OR gain Slowed; then LV −1.
    if (aspectEffects.powerHighLevel > 0) {
      const roll = new Roll("1d10");
      await roll.evaluate();
      const triggered = roll.total <= 5;
      if (triggered) await this._addSelfConditions(["slowed"]);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll ${triggered ? "dbu-draining-card" : ""}" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-exclamation-triangle"></i> Power High LV${aspectEffects.powerHighLevel}</span><span class="dbu-action-count">R${cts.currentRound}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-roll-row">
              <span class="dbu-roll-label">Check</span>
              <span class="dbu-roll-main"><code class="dbu-roll-formula">1d10</code><span class="dbu-roll-sub">≤5 triggers</span></span>
              <span class="dbu-roll-total">${roll.total}</span>
            </div>
            <div class="dbu-defend-guide">${triggered
              ? `<b>TRIGGERED (${roll.total}≤5).</b> <b>Slowed</b> applied until your next turn — OR instead use the <b>Direct Hit</b> option of the Defend Maneuver against the next attack (then remove Slowed). After resolving, reduce Power High by <b>1</b> until you leave this Transformation.`
              : `Safe (${roll.total} > 5). No effect this turn.`}</div>
          </div>
        </div>`
      });
    }

    // Rampaging (transformation-aspects.txt:172): roll 1d10 at start of turn.
    // ≤5 → Compelled vs nearest Opponent (LV1) / Character (LV2) + Guard Down,
    // Stress Tests become Urgent, until the start of your next turn.
    if (aspectEffects.rampagingLevel > 0) {
      const targetText = aspectEffects.rampagingLevel >= 2
        ? "nearest <b>Character</b> (ally or enemy)"
        : "nearest <b>Opponent</b>";
      const roll = new Roll("1d10");
      await roll.evaluate();
      const triggered = roll.total <= 5;
      if (triggered) await this._addSelfConditions(["compelled", "guardDown"]);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll ${triggered ? "dbu-duel-card" : ""}" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-skull-crossbones"></i> Rampaging LV${aspectEffects.rampagingLevel}</span><span class="dbu-action-count">R${cts.currentRound}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-roll-row">
              <span class="dbu-roll-label">Check</span>
              <span class="dbu-roll-main"><code class="dbu-roll-formula">1d10</code><span class="dbu-roll-sub">≤5 triggers</span></span>
              <span class="dbu-roll-total">${roll.total}</span>
            </div>
            <div class="dbu-defend-guide">${triggered
              ? `<b>TRIGGERED (${roll.total}≤5).</b> <b>Compelled</b> (assign to the ${targetText}) + <b>Guard Down</b> applied until the start of your next turn. You cannot Voluntarily Revert and your Stress Tests become <b>Urgent</b> while Compelled this way.`
              : `Controlled (${roll.total} > 5). No effect this turn.`}</div>
          </div>
        </div>`
      });
    }

    // Nanomachine Repair (cybernetic trait): regain 2(bT) LP +1(bT) per Health
    // Threshold below, at the start of each Combat Round (works even Defeated).
    if (this.actor.system._cyberNanomachineActive) {
      const nmBaseTier = this.actor.system.baseTier || 1;
      const nmThresholds = this.actor.system.thresholds?.crossedCount || 0;
      const nmHeal = (2 + nmThresholds) * nmBaseTier;
      const lpCur = this.actor.system.lifePoints?.value ?? 0;
      const lpMax = this.actor.system.lifePoints?.max ?? 0;
      const lpNew = Math.min(lpMax, lpCur + nmHeal);
      if (lpNew !== lpCur) await this.actor.update({ "system.lifePoints.value": lpNew });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-heartbeat"></i> Nanomachine Repair</span><span class="dbu-action-count">R${cts.currentRound}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-defend-guide">Regained <b>+${lpNew - lpCur} LP</b> (2(bT)${nmThresholds ? ` +${nmThresholds}(bT) thresholds below` : ""}). LP ${lpCur} → <b>${lpNew}</b>.</div>
          </div>
        </div>`
      });
    }

    // Temporary: countdown and forced deactivation
    const countdowns = foundry.utils.deepClone(this.actor.system.transformationMeta?.temporaryCountdowns || {});
    let countdownChanged = false;
    let forcedDeactivation = false;
    for (const [transId, remaining] of Object.entries(countdowns)) {
      const newRemaining = remaining - 1;
      const matchingTrans = activeTransforms.find(t => String(t.id) === transId && t.active);
      if (!matchingTrans) {
        delete countdowns[transId];
        countdownChanged = true;
        continue;
      }
      if (newRemaining <= 0) {
        // Force deactivation — check Exhausting aspect
        // "You still suffer Stress Exhaustion if this Transformation has the Exhausting Aspect." (transformation-aspects.txt:179)
        const hasExhausting = (matchingTrans.aspects || []).some(a => /^Exhausting\b/i.test(a.trim()));
        if (hasExhausting) {
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div style="font-size:0.85rem; border-left:3px solid #e74c3c; padding-left:8px;">
              <b><i class="fas fa-tired"></i> Exhausting — ${matchingTrans.name || "Transformation"}</b><br>
              You suffer <b>Stress Exhaustion</b> and <b>Impediment</b> Combat Conditions until the end of your next turn (Temporary expiration does not exempt Exhausting).
            </div>`
          });
        }
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="font-size:0.85rem; border-left:3px solid #e74c3c; padding-left:8px;">
            <b><i class="fas fa-hourglass-end"></i> Temporary EXPIRED — ${matchingTrans.name || "Transformation"}</b><br>
            This transformation has ended.${hasExhausting ? "" : " You do <b>not</b> suffer Stress Exhaustion."} You cannot re-enter this transformation until the end of your next turn.
          </div>`
        });
        // Deactivate the transformation
        const transArr = foundry.utils.deepClone(activeTransforms);
        const idx = transArr.findIndex(t => String(t.id) === transId);
        if (idx >= 0) {
          transArr[idx].active = false;
          await this.actor.update({ "system.transformations": transArr });
          forcedDeactivation = true;
        }
        delete countdowns[transId];
        countdownChanged = true;
      } else {
        countdowns[transId] = newRemaining;
        countdownChanged = true;
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="font-size:0.85rem; border-left:3px solid #f39c12; padding-left:8px;">
            <b><i class="fas fa-hourglass-half"></i> Temporary — ${matchingTrans.name || "Transformation"} (Round ${cts.currentRound})</b><br>
            <b>${newRemaining} round${newRemaining !== 1 ? "s" : ""}</b> remaining before forced deactivation.
          </div>`
        });
      }
    }
    if (countdownChanged) {
      await this.actor.update({ "system.transformationMeta.temporaryCountdowns": countdowns });
    }

    // --- Round-change summary: Diminishing stacks cleared ---
    // (attacking.txt:34/38 — both Diminishing Offense and Defense reset each round)
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dbu-round-card">
        <div class="dbu-round-num"><i class="fas fa-sync-alt"></i> R${cts.currentRound}</div>
        <div class="dbu-round-info">
          <span class="dbu-round-title">${this.actor.name} — New Round</span>
          <span class="dbu-round-detail">Diminishing cleared · was ${prevAttackCount} atk / ${prevDodgeCount} dge</span>
        </div>
      </div>`
    });

    // --- Draining Aspect: KP upkeep at start of turn — posted as a PAY BUTTON
    // (like attack costs) instead of auto-deducting, so the player confirms it.
    // "Reduce your Ki Points by 3(T) for each level. Use highest Tier Requirement." (transformation-aspects.txt:128)
    const drainingKi = this.actor.system.aspectEffects?.drainingKiPerTurn || 0;
    if (drainingKi > 0) {
      const drLevel = this.actor.system.aspectEffects?.drainingLevel || 0;
      const drTier = this.actor.system.aspectEffects?.drainingTier || 0;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll dbu-draining-card" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text"><i class="fas fa-fire-alt"></i> Draining Upkeep</span><span class="dbu-action-count">R${cts.currentRound}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-attack-meta">
              <span class="dbu-meta-chip">${drLevel} level${drLevel !== 1 ? "s" : ""} × 3(T${drTier})</span>
              <span class="dbu-meta-chip dbu-chip-hot">${drainingKi} KP upkeep</span>
            </div>
            <div class="dbu-attack-actions">
              <button type="button" class="dbu-pay-btn" data-dbu-pay="draining"
                      data-actor-id="${this.actor.id}" data-amount="${drainingKi}">
                <i class="fas fa-fire-alt"></i> Pay Draining (${drainingKi} KP)
              </button>
            </div>
          </div>
        </div>`
      });
    }

    // --- Turbulent Power: auto Stress Test at the start of the turn when in
    // transformations without effective Strainless/Natural (actor.mjs computes
    // turbulentPowerActive honoring the Strainless mixing rule). ---
    const tfRules = this.actor.system.transformationRules || {};
    if (tfRules.turbulentPowerActive && (tfRules.combinedStressTest || 0) > 0) {
      await this._onTfTurbulentRoll(event);
    }

    // Battle Born: grant a stack on even-numbered rounds (Saiyan with Battle Born trait)
    const newRound = cts.currentRound;
    if (newRound % 2 === 0) {
      await this._battleBornGrantStack("Even Round " + newRound);
    }
  },

  // ============== Evil Aura Controls ==============
  async _onEvilAuraPointsAdd(event) {
    event.preventDefault();
    const cur = this.actor.system.transformationMeta?.evilPoints || 0;
    await this.actor.update({ "system.transformationMeta.evilPoints": cur + 1 });
  },
  async _onEvilAuraPointsSub(event) {
    event.preventDefault();
    const cur = this.actor.system.transformationMeta?.evilPoints || 0;
    await this.actor.update({ "system.transformationMeta.evilPoints": Math.max(0, cur - 1) });
  },
  async _onEvilAuraTechsActivate(event) {
    event.preventDefault();
    const cur = this.actor.system.transformationMeta?.evilPoints || 0;
    const cost = 2 * (this.actor.system.baseTier || 1);
    if (cur < cost) {
      ui.notifications.warn(`Need ${cost} Evil Points to activate Evil Techniques (have ${cur}).`);
      return;
    }
    await this.actor.update({
      "system.transformationMeta.evilPoints": cur - cost,
      "system.transformationMeta.evilTechsActive": true
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<strong>${this.actor.name}</strong> activates Evil Techniques (-${cost} EP). Gains access to Baked Sphere, Bloody Sauce, Gigantic Ki Blast, Marbling Drop, Peeler Storm until end of turn (KP cost halved).`
    });
  },
  async _onEvilAuraTechsDeactivate(event) {
    event.preventDefault();
    await this.actor.update({ "system.transformationMeta.evilTechsActive": false });
  },

  // ============== God Ki / DKP Controls ==============
  async _onDkpAdd(event) {
    event.preventDefault();
    const cur = this.actor.system.divineKiPoints?.value || 0;
    const max = this.actor.system.divineKiPoints?.max || 0;
    await this.actor.update({ "system.divineKiPoints.value": Math.min(max, cur + 1) });
  },
  async _onDkpSub(event) {
    event.preventDefault();
    const cur = this.actor.system.divineKiPoints?.value || 0;
    await this.actor.update({ "system.divineKiPoints.value": Math.max(0, cur - 1) });
  },
  async _onDkpRefill(event) {
    event.preventDefault();
    const max = this.actor.system.divineKiPoints?.max || 0;
    await this.actor.update({ "system.divineKiPoints.value": max });
  },

  /**
   * Generic God Maneuver "Use" handler.
   * Reads dkpCost from the maneuver card, presents a Dialog allowing the player
   * to confirm or override the cost (variable-cost maneuvers like Divine Attack,
   * Divine Pulse, God Strike, God Finisher, Divine Aura have variable costs),
   * spends DKP, and posts a chat card.
   */
  async _onGodManeuverUse(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const maneuverId = btn.dataset.maneuverId;
    const dkpCostStr = btn.dataset.dkpCost || "0";
    const baseTier = this.actor.system.baseTier || 1;
    const tier = this.actor.system.tier || 1;
    const currentDKP = this.actor.system.divineKiPoints?.value || 0;

    // Lookup name + description from CONFIG.DBU.godManeuvers
    const catalog = CONFIG.DBU?.godManeuvers || {};
    const def = catalog[maneuverId] || { name: maneuverId, effect: "" };

    // Try to parse cost: numbers in (T) and (bT) form, or "Profile KP" / "Aura KP" / "Technique KP" / "Variable" / "Varies" → ask user
    const parseCost = (s) => {
      if (!s) return null;
      const str = String(s).trim();
      // "5(T)" or "5(bT)"
      let m = str.match(/^(\d+)\(T\)$/i);     if (m) return Number(m[1]) * tier;
      m = str.match(/^(\d+)\(bT\)$/i);        if (m) return Number(m[1]) * baseTier;
      // "1(bT)/Action" — for Divine Pulse: each level of Long Transformation
      m = str.match(/^(\d+)\(bT\)\/Action$/i);if (m) return null;  // ask user
      m = str.match(/^\d+$/);                 if (m) return Number(str);
      // Variable / Profile KP / Aura KP / Technique KP / 1/4 Profile KP → ask
      return null;
    };

    let cost = parseCost(dkpCostStr);
    let promptValue = cost ?? 1;
    let userOverrode = false;

    // Always show dialog so player can override (rules say cost varies for many)
    const result = await Dialog.prompt({
      title: `Use ${def.name}`,
      content: `
        <form>
          <div class="form-group" style="display:flex;flex-direction:column;gap:0.4em">
            <div><b>Cost:</b> ${dkpCostStr} ${cost != null ? `→ <b>${cost}</b> DKP (auto-calculated)` : "<i>variable</i>"}</div>
            <div><b>Available:</b> ${currentDKP} DKP</div>
            <label>DKP to spend</label>
            <input type="number" name="dkpSpend" min="0" max="${currentDKP}" step="1" value="${promptValue}" />
            <small style="color:#aaa">${(def.effect || "").substring(0, 200)}${(def.effect || "").length > 200 ? "…" : ""}</small>
          </div>
        </form>`,
      callback: (html) => Number(html.find("[name='dkpSpend']").val()) || 0,
      rejectClose: false
    });

    const spend = Math.max(0, Number(result) || 0);
    if (spend === 0) return;
    if (spend > currentDKP) {
      ui.notifications.warn(`Not enough Divine Ki Points (need ${spend}, have ${currentDKP}).`);
      return;
    }

    // Per god-ki.txt:22 the Capacity Rate halving for DKP is tracked via the
    // round tracker's dedicated DKP field (see _onTrackerAddAction). The Use
    // button only deducts from the DKP pool; the tracker logs the cost.
    await this.actor.update({ "system.divineKiPoints.value": currentDKP - spend });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${def.name}</b><br>Spent <b>${spend}</b> Divine Ki Points.<br><small>${def.effect || ""}</small></div>`
    });
  },

  async _onCombatNewEncounter(event) {
    event.preventDefault();

    // Foundry deep-merges ObjectFields, so we must explicitly delete
    // every existing key inside resourceUsage and usedEffects.
    const updates = {
      "system.combatTabState.rounds": [],
      "system.combatTabState.currentRound": 0,
      "system.combatTabState.damageLog": [],
      "system.combatTabState.roundAttackCount": 0,
      "system.combatTabState.roundDodgeCount": 0,
      "system.combatTabState.roundCounterCount": 0,
      "system.tracking.energyCharges": 0,
      "system.tracking.powerStacks": 0,
      "system.tracking.diminishingDefense": 0,
      "system.tracking.diminishingOffense": 0,
      "system.status.capacitySpent": 0,
      "system.status.superStacks": 0,
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
      "system.transformationMeta.entrySnapshots": {},
      // DKP refill at Combat Encounter start per god-ki.txt:20:
      // "starts each Combat Encounter with their maximum amount of DKP"
      "system.divineKiPoints.value": this.actor.system.divineKiPoints?.max ?? 0,
      // Snapshot DKP at encounter start (post-refill) for Weakening aspect threshold
      // "below 1/4 of the amount of Divine Ki Points you started the Combat Encounter with"
      "system.transformationMeta.encounterStartDKP": this.actor.system.divineKiPoints?.max ?? null,
      "system.transformationMeta.surgingStrengthEncounter": 0,
      "system.transformationMeta.surgingStrengthRound": 0,
      // Reset talent stance shifts
      "system.combatTabState.talentTempMods": {},
      "system.tracking.patienceStacks": 0,
      "system.tracking.crueltyStacks": 0,
      // Reset One-Sided Fusion encounter tracking
      "system.fusion.encounterThresholdsCrossed": 0,
      // Reset Hidden weapon quality usage (per-encounter flag)
      "system.equipmentFlags.hiddenUsedThisEncounter": false,
      // Reset Evil Aura state at encounter start
      "system.transformationMeta.evilTechsActive": false,
      "system.transformationMeta.evilPoints": 0,
      // Clear all temp effects from activable automation
      "system.combatTabState.activeTempEffects": []
    };

    // Strenuous downtime penalty: consume one of the N affected encounters
    const strenuousDT = this.actor.system.downtime?.strenuous || {};
    if ((strenuousDT.encountersLeft || 0) > 0) {
      const left = strenuousDT.encountersLeft - 1;
      updates["system.downtime.strenuous.encountersLeft"] = left;
      if (left <= 0) updates["system.downtime.strenuous.fraction"] = 0;
    }

    // Reset Possession host LP tracking if in possession mode
    const fusion = this.actor.system.fusion || {};
    if (fusion.isFusion && fusion.type === "one-sided-possession") {
      const hostId = (fusion.suppressedCharacterIds || [])[0];
      const hostActor = hostId ? game.actors?.get(hostId) : null;
      if (hostActor) {
        updates["system.fusion.hostCurrentLP"] = hostActor.system.lifePoints?.value ?? hostActor.system.lifePoints?.max ?? 0;
      }
    }

    // Delete all resourceUsage keys (round + encounter)
    const ru = this.actor.system.combatTabState?.resourceUsage || {};
    for (const key of Object.keys(ru.round || {})) {
      updates[`system.combatTabState.resourceUsage.round.-=${key}`] = null;
    }
    for (const key of Object.keys(ru.encounter || {})) {
      updates[`system.combatTabState.resourceUsage.encounter.-=${key}`] = null;
    }

    // Delete all effectTracking usedEffects keys (round + encounter)
    const ue = this.actor.system.effectTracking?.usedEffects || {};
    for (const key of Object.keys(ue.round || {})) {
      updates[`system.effectTracking.usedEffects.round.-=${key}`] = null;
    }
    for (const key of Object.keys(ue.encounter || {})) {
      updates[`system.effectTracking.usedEffects.encounter.-=${key}`] = null;
    }

    await this.actor.update(updates);
  },
};
