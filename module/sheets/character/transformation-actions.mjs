import { limitedMartialPower } from "../../rules/path-to-power-v093.mjs";
import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: transformation-actions. Methods run with the sheet as this. */
export const transformationActionsMethods = {

  // -------------------------------------------------------
  // Token Album Handlers
  // -------------------------------------------------------

  async _onAddAlbumEntry(event) {
    event.preventDefault();
    const raw = this.actor.system.tokenAlbum;
    const album = Array.isArray(raw) ? foundry.utils.deepClone(raw) : [];
    album.push({ name: "", image: "" });
    await this.actor.update({ "system.tokenAlbum": album });
  },

  async _onBrowseAlbumImage(event) {
    event.preventDefault();
    const idx = Number(event.currentTarget.dataset.albumIndex);
    const album = foundry.utils.deepClone(this.actor.system.tokenAlbum || []);
    if (idx >= album.length) return;
    const fp = new FilePicker({
      type: "image",
      current: album[idx].image || "",
      callback: async (path) => {
        album[idx].image = path;
        await this.actor.update({ "system.tokenAlbum": album });
      }
    });
    fp.browse();
  },

  async _onAlbumNameChange(event) {
    const idx = Number(event.currentTarget.dataset.albumIndex);
    const album = foundry.utils.deepClone(this.actor.system.tokenAlbum || []);
    if (idx >= album.length) return;
    album[idx].name = event.currentTarget.value;
    await this.actor.update({ "system.tokenAlbum": album });
  },

  async _onRemoveAlbumEntry(event) {
    event.preventDefault();
    const idx = Number(event.currentTarget.dataset.albumIndex);
    const album = foundry.utils.deepClone(this.actor.system.tokenAlbum || []);
    if (idx >= album.length) return;
    // If removing the active image, restore original first
    const activeImage = this.actor.getFlag("DBU-MRR-OLD", "activeAlbumImage");
    if (activeImage && album[idx].image === activeImage) {
      await this._restoreOriginalToken();
    }
    album.splice(idx, 1);
    await this.actor.update({ "system.tokenAlbum": album });
  },

  async _onActivateAlbumToken(event) {
    event.preventDefault();
    const idx = Number(event.currentTarget.dataset.albumIndex);
    const album = this.actor.system.tokenAlbum || [];
    if (idx >= album.length || !album[idx].image) {
      ui.notifications.warn("Assign an image first.");
      return;
    }

    const targetImage = album[idx].image;
    const currentImage = this.actor.prototypeToken?.texture?.src || "";

    // Cache original if first time
    const cachedOriginal = this.actor.getFlag("DBU-MRR-OLD", "originalTokenImage");
    if (!cachedOriginal) {
      await this.actor.setFlag("DBU-MRR-OLD", "originalTokenImage", currentImage);
    }

    // Mark as active
    await this.actor.setFlag("DBU-MRR-OLD", "activeAlbumImage", targetImage);

    // Update prototype token
    if (currentImage !== targetImage) {
      await this.actor.update({ "prototypeToken.texture.src": targetImage });
    }

    // Update all active tokens on scene with morph animation
    const activeTokens = this.actor.getActiveTokens();
    for (const token of activeTokens) {
      if (token.document.texture.src !== targetImage) {
        await token.document.update({ "texture.src": targetImage });
      }
    }
  },

  async _onRestoreOriginalToken(event) {
    if (event) event.preventDefault();
    await this._restoreOriginalToken();
  },

  /** Pay LP Cost for a graded transformation (Kaioken family). */
  async _onPayKaiokenLp(event) {
    event.preventDefault();
    const catalogKey = event.currentTarget.dataset.catalogKey;
    const graded = (this.actor.system.aspectEffects?.gradedTransformations || [])
      .find(g => g.catalogKey === catalogKey);
    if (!graded) return;

    const currentLp = this.actor.system.lifePoints?.value ?? 0;
    const cost = graded.lpCostNum;
    const newLp = currentLp - cost;

    await this.actor.update({ "system.lifePoints.value": newLp });

    const penaltyNote = graded.crimsonPenalty
      ? ` <span style="color:#ff9800">(includes +${graded.crimsonPenalty} Crimson Acclimation)</span>` : '';

    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-heart-broken" style="color:#e91e63"></i> ${graded.name} Grade ${graded.grade} — LP Cost</b><br>` +
      `Paid <b>${cost}</b> LP (${graded.lpCostFormula})${penaltyNote}<br>` +
      `LP: ${currentLp} → <b>${newLp}</b>` +
      (newLp <= 0 ? `<br><span style="color:#ff1744;font-weight:bold">⚠ LP at or below 0!</span>` : '') +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: flavor
    });
  },

  async _restoreOriginalToken() {
    const cachedOriginal = this.actor.getFlag("DBU-MRR-OLD", "originalTokenImage");
    if (!cachedOriginal) return;

    const currentImage = this.actor.prototypeToken?.texture?.src || "";
    if (currentImage !== cachedOriginal) {
      await this.actor.update({ "prototypeToken.texture.src": cachedOriginal });
      for (const token of this.actor.getActiveTokens()) {
        if (token.document.texture.src !== cachedOriginal) {
          await token.document.update({ "texture.src": cachedOriginal });
        }
      }
    }
    await this.actor.unsetFlag("DBU-MRR-OLD", "originalTokenImage");
    await this.actor.unsetFlag("DBU-MRR-OLD", "activeAlbumImage");
  },

  // -------------------------------------------------------
  // Transformation Rules Handlers (Combat Tab)
  // -------------------------------------------------------

  /** Compute the stress bonus for this character (pre-computed by actor.mjs). */
  _getStressBonus() {
    return this.actor.system.aptitudes?.stressBonus || 0;
  },

  /** Roll a Stress Test: 1d10+1 + Stress Bonus + equipment dice bonus (Resolute Belief). */
  async _onTfStressTest(event) {
    event.preventDefault();
    const system = this.actor.system;
    const stressBonus = this._getStressBonus();
    const combinedST = system.transformationRules?.combinedStressTest || 0;
    const equipDiceBonus = Number(system.equipmentFlags?.stressTestDiceBonus) || 0;

    const totalBonus = stressBonus + equipDiceBonus;
    const roll = new Roll("1d10 + 1 + @bonus", { bonus: totalBonus });
    await roll.evaluate();

    const success = combinedST > 0 ? roll.total >= combinedST : true;
    const equipNote = equipDiceBonus ? ` + ${equipDiceBonus} Equipment` : "";
    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-dice-d20"></i> Stress Test</b><br>` +
      `Roll: <b>${roll.total}</b> (1d10+1 + ${stressBonus} Stress Bonus${equipNote})` +
      (combinedST > 0 ? `<br>Required: <b>${combinedST}</b>` : '') +
      `<br><span style="color:${success ? '#4caf50' : '#e94560'};font-weight:bold">` +
      `${success ? '&#10003; Success!' : '&#10007; Failed — Stress Exhaustion!'}</span>` +
      `</div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor
    });
  },

  /** Roll Turbulent Power stress test (start of turn). */
  async _onTfTurbulentRoll(event) {
    event.preventDefault();
    const system = this.actor.system;
    const stressBonus = this._getStressBonus();
    const combinedST = system.transformationRules?.combinedStressTest || 0;
    const equipDiceBonus = Number(system.equipmentFlags?.stressTestDiceBonus) || 0;

    const totalBonus = stressBonus + equipDiceBonus;
    const roll = new Roll("1d10 + 1 + @bonus", { bonus: totalBonus });
    await roll.evaluate();

    const success = combinedST > 0 ? roll.total >= combinedST : true;
    const equipNote = equipDiceBonus ? ` + ${equipDiceBonus} Equipment` : "";
    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-exclamation-triangle"></i> Turbulent Power — Start of Turn</b><br>` +
      `Roll: <b>${roll.total}</b> (1d10+1 + ${stressBonus} Stress Bonus${equipNote})` +
      (combinedST > 0 ? `<br>Required: <b>${combinedST}</b>` : '') +
      `<br><span style="color:${success ? '#4caf50' : '#e94560'};font-weight:bold">` +
      `${success ? '&#10003; Remain in Transformation!' : '&#10007; Failed — Stress Exhaustion until end of next turn!'}</span>` +
      `</div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor
    });
  },

  /** Use Surging Strength (1/Round, 3/Encounter). */
  async _onTfSurgingStrength(event) {
    event.preventDefault();
    const meta = this.actor.system.transformationMeta || {};
    const aspectEffects = this.actor.system.aspectEffects || {};

    const heartbeat = aspectEffects.heartbeatActive || false;
    const longTransformation = aspectEffects.longTransformationActive || false;
    const roundLimit = heartbeat ? 3 : 1;

    if (longTransformation) {
      ui.notifications.warn("Surging Strength is blocked while Long Transformation is active.");
      return;
    }

    if ((meta.surgingStrengthRound || 0) >= roundLimit) {
      ui.notifications.warn(`Surging Strength already used this round (${roundLimit}/Round).`);
      return;
    }
    if (!heartbeat && (meta.surgingStrengthEncounter || 0) >= 3) {
      ui.notifications.warn("Surging Strength limit reached (3/Encounter).");
      return;
    }

    const newRound = (meta.surgingStrengthRound || 0) + 1;
    const newEnc = (meta.surgingStrengthEncounter || 0) + 1;

    await this.actor.update({
      "system.transformationMeta.surgingStrengthRound": newRound,
      "system.transformationMeta.surgingStrengthEncounter": newEnc
    });

    const stressBonus = this._getStressBonus();
    const combinedST = this.actor.system.transformationRules?.combinedStressTest || 0;
    const threshold = combinedST > 0 ? combinedST - 4 : 0;
    const eligible = threshold <= 0 || stressBonus >= threshold;

    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-forward"></i> Surging Strength</b> [${heartbeat ? newEnc + ' Enc' : newEnc + '/3 Enc'}, ${newRound}/${roundLimit} Rnd]` +
      (heartbeat ? ` <span style="color:#e91e63"><i class="fas fa-heartbeat"></i> Heartbeat</span>` : '') + `<br>` +
      `Stress Bonus: <b>${stressBonus}</b>` +
      (combinedST > 0 ? ` | Threshold: <b>${threshold}</b> (ST ${combinedST} - 4)` : '') +
      `<br><span style="color:${eligible ? '#4caf50' : '#e94560'};font-weight:bold">` +
      `${eligible ? '&#10003; Eligible — Transform as OoS Maneuver!' : '&#10007; Not eligible (Stress Bonus too low)'}</span>` +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: flavor
    });
  },

  /** Trigger Burst Limit (1/Encounter, any EP). */
  async _onTfBurstLimit(event) {
    event.preventDefault();
    const system = this.actor.system;
    const meta = system.transformationMeta || {};

    // Check Burst Through Your Limit: allows second burst if NLoP + first EP entry
    const nlopActiveEnc = meta.nlopActiveEncounter || [];
    const burstThroughAvailable = meta.burstLimitUsed && nlopActiveEnc.some(name =>
      (system.transformations || []).some(t => t.name === name &&
        ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType)
      )
    );

    if (meta.burstLimitUsed && !burstThroughAvailable) {
      ui.notifications.warn("Burst Limit already used this encounter.");
      return;
    }

    // Find active EPs
    const transformations = system.transformations || [];
    const activeEPs = transformations.filter(t => t.active &&
      ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType)
    );

    if (activeEPs.length === 0) {
      // Allow triggering even without active EP if entering one via Transformation Maneuver
      // But show dialog with all EPs
      const allEPs = transformations.filter(t =>
        ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType)
      );
      if (allEPs.length === 0) {
        ui.notifications.warn("No Enhancement Powers available.");
        return;
      }
    }

    // Collect all EPs (active or not) since you trigger it on entering
    const allEPs = transformations.filter(t =>
      ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType) && t.name
    );
    if (allEPs.length === 0) {
      ui.notifications.warn("No Enhancement Powers available.");
      return;
    }

    let selectedEP = allEPs[0];
    if (allEPs.length > 1) {
      const options = allEPs.map((ep, i) => `<option value="${i}">${ep.name}${ep.active ? ' (Active)' : ''}</option>`).join("");
      const result = await Dialog.wait({
        title: "Burst Limit",
        content: `<p>Select Enhancement Power for Burst Limit:</p><select id="ep-select" style="width:100%;margin-bottom:8px">${options}</select>`,
        buttons: {
          ok: { label: "Trigger", icon: '<i class="fas fa-fire"></i>', callback: (html) => parseInt(html.find("#ep-select").val()) },
          cancel: { label: "Cancel", callback: () => null }
        }
      });
      if (result === null) return;
      selectedEP = allEPs[result];
    }

    // Check for Burst Recovery (Transcendent EP or Special EP)
    const aspects = selectedEP.aspects || [];
    const catalogEntry = selectedEP.catalogKey ? (CONFIG.DBU?.transformationsCatalog?.[selectedEP.catalogKey]) : null;
    const resolvedAspects = aspects.length > 0 ? aspects : (catalogEntry?.aspects || []);
    const isTranscendent = resolvedAspects.some(a => a.toLowerCase().includes("transcendent"));
    const isSpecial = resolvedAspects.some(a => a.toLowerCase().includes("special"));
    const qualifiesForBurstRecovery = (isTranscendent || isSpecial) && !limitedMartialPower(system);

    let recoveryMsg = "";
    const updates = {
      "system.transformationMeta.burstLimitUsed": true,
      "system.transformationMeta.burstLimitSource": selectedEP.name
    };

    if (qualifiesForBurstRecovery) {
      const maxKP = system.kiPool.max;
      const currentLP = system.lifePoints?.value ?? 0;
      const injuredVal = system.thresholds?.injured?.value ?? Math.floor((system.lifePoints?.max || 100) * 0.5);
      const belowInjured = currentLP <= injuredVal;

      let kpRestore;
      if (belowInjured) {
        kpRestore = maxKP;
        recoveryMsg = `<br><b>Burst Recovery:</b> Below Injured Threshold — KP set to MAX (<b>${maxKP}</b>)`;
      } else {
        kpRestore = Math.floor(maxKP / 2);
        recoveryMsg = `<br><b>Burst Recovery:</b> Regain <b>${kpRestore}</b> KP (1/2 Max)`;
      }

      // Ki Multiplier active → halve Burst Recovery
      if (system.transformationRules?.kiMultiplierActive) {
        kpRestore = Math.floor(kpRestore / 2);
        recoveryMsg += ` [Halved by Ki Multiplier]`;
      }

      const currentKP = system.kiPool?.value ?? 0;
      updates["system.kiPool.value"] = Math.min(maxKP, currentKP + kpRestore);
    }

    await this.actor.update(updates);

    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-fire"></i> ${burstThroughAvailable ? 'Burst Through Your Limit!' : 'Burst Limit Triggered!'}</b><br>` +
      `Enhancement Power: <b>${selectedEP.name}</b>` +
      (qualifiesForBurstRecovery ? ` (${isSpecial ? 'Special' : 'Transcendent'})` : '') +
      recoveryMsg +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: flavor
    });
  },

  /** Legend Realized: Roll 2d10(T) + PL, restore LP+KP (1/Transformation/Encounter). */
  async _onTfLegendRealized(event) {
    event.preventDefault();
    const system = this.actor.system;
    const meta = system.transformationMeta || {};
    const tier = system.tier || 1;
    const baseTier = system.baseTier || 1;

    const transformations = system.transformations || [];
    const activeAFLFs = transformations.filter(t => t.active &&
      (t.transformationType === "form_alternate" || t.transformationType === "form_legendary")
    );
    // Full Suppression does not benefit from Legend Realized (Weakest State Level 3)
    const lrEligible = activeAFLFs.filter(t => t.catalogKey !== "full_suppression");
    const used = meta.legendRealizedUsed || [];
    const eligible = lrEligible.filter(t => !used.includes(t.name));

    if (eligible.length === 0) {
      const hasBlockedOnly = activeAFLFs.length > 0 && lrEligible.length === 0;
      if (hasBlockedOnly) {
        ui.notifications.warn("Full Suppression does not benefit from Legend Realized (Weakest State).");
      } else {
        ui.notifications.warn("Legend Realized already used for all eligible AF/LF transformations this encounter.");
      }
      return;
    }

    let selectedTrans = eligible[0];
    if (eligible.length > 1) {
      const options = eligible.map((t, i) => `<option value="${i}">${t.name}</option>`).join("");
      const result = await Dialog.wait({
        title: "Legend Realized",
        content: `<p>Select Transformation for Legend Realized:</p><select id="lr-select" style="width:100%;margin-bottom:8px">${options}</select>`,
        buttons: {
          ok: { label: "Roll", icon: '<i class="fas fa-star"></i>', callback: (html) => parseInt(html.find("#lr-select").val()) },
          cancel: { label: "Cancel", callback: () => null }
        }
      });
      if (result === null) return;
      selectedTrans = eligible[result];
    }

    // Roll 2d10(T) + Power Level
    const pl = system.level || 1;
    const roll = new Roll(`${2 * tier}d10 + ${pl}`);
    await roll.evaluate();

    const extra = await this._applyLegendRealizedBonuses(selectedTrans, tier, baseTier, roll.total);
    const effectiveRollTotal = roll.total + extra.rollBonus;
    const lpRestored = (effectiveRollTotal + extra.lpBonus) * (extra.lpMultiplier || 1);
    const kpRestored = (effectiveRollTotal + extra.kpBonus) * (extra.kpMultiplier || 1);
    const bonusLines = [...extra.bonusLines];

    // Metamorphosis line: Transforming Physique Level 5 → +Sd6(bT) LP
    // Additional Legend Realized bonuses are applied in _applyLegendRealizedBonuses().

    const maxLP = system.lifePoints?.max || 100;
    const maxKP = system.kiPool?.max || 100;
    const newLP = Math.min(maxLP, (system.lifePoints?.value || 0) + lpRestored);
    const uncappedKP = (system.kiPool?.value || 0) + kpRestored;
    const newKP = extra.allowOverMaxKP ? uncappedKP : Math.min(maxKP, uncappedKP);

    const newUsed = [...used, selectedTrans.name];

    await this.actor.update({
      "system.lifePoints.value": newLP,
      "system.kiPool.value": newKP,
      "system.transformationMeta.legendRealizedUsed": newUsed
    });

    const bonusHtml = bonusLines.length > 0 ? "<br>" + bonusLines.join("<br>") : "";
    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-star"></i> Legend Realized!</b> (${selectedTrans.name})<br>` +
      `Roll: ${2 * tier}d10 + ${pl} PL = <b>${roll.total}</b>` +
      (extra.rollBonus ? ` <span style="color:#4caf50">+ ${extra.rollBonus} bonus</span>` : "") +
      `<br>` +
      `Restored <b>${lpRestored}</b> LP and <b>${kpRestored}</b> KP` +
      bonusHtml +
      `</div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor
    });
  },

  /** New Level of Power: Mark first-time entry for a transformation. */
  async _onTfNewLevelOfPower(event) {
    event.preventDefault();
    const system = this.actor.system;
    const meta = system.transformationMeta || {};

    const transformations = system.transformations || [];
    const usedEver = meta.newLevelOfPowerUsed || [];
    const blockedNlopCatalogKeys = new Set(["full_suppression", "limited_suppression", "partial_suppression", "true_form"]);
    const eligible = transformations.filter(t =>
      t.name &&
      !usedEver.includes(t.name) &&
      !blockedNlopCatalogKeys.has(t.catalogKey)
    );

    if (eligible.length === 0) {
      ui.notifications.warn("No eligible transformations remain for New Level of Power.");
      return;
    }

    let selectedTrans = eligible[0];
    if (eligible.length > 1) {
      const options = eligible.map((t, i) => `<option value="${i}">${t.name} (${t.transformationType || '?'})</option>`).join("");
      const result = await Dialog.wait({
        title: "New Level of Power",
        content: `<p>Select the Transformation you are entering for the <b>first time ever</b>:</p>` +
          `<select id="nlop-select" style="width:100%;margin-bottom:8px">${options}</select>`,
        buttons: {
          ok: { label: "Mark", icon: '<i class="fas fa-level-up-alt"></i>', callback: (html) => parseInt(html.find("#nlop-select").val()) },
          cancel: { label: "Cancel", callback: () => null }
        }
      });
      if (result === null) return;
      selectedTrans = eligible[result];
    }

    const newUsedEver = [...usedEver, selectedTrans.name];
    const nlopActiveEnc = [...(meta.nlopActiveEncounter || []), selectedTrans.name];
    const baseTier = system.baseTier || 1;

    await this.actor.update({
      "system.transformationMeta.newLevelOfPowerUsed": newUsedEver,
      "system.transformationMeta.nlopActiveEncounter": nlopActiveEnc
    });

    const flavor = `<div style="font-size:0.9rem">` +
      `<b><i class="fas fa-level-up-alt"></i> New Level of Power!</b> (${selectedTrans.name})<br>` +
      `First-time entry — for the remainder of this encounter:<br>` +
      `&bull; <b>+1 Tier of Power</b><br>` +
      `&bull; <b>+${baseTier} Stress Bonus</b> (+1(bT))<br>` +
      `&bull; +1 base Tier for Power Advantage<br>` +
      `&bull; No Stress Test required to enter this Transformation` +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: flavor
    });
  },
};
