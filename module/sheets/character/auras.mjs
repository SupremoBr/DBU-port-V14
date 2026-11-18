

/** Character sheet domain: auras. Methods run with the sheet as this. */
export const aurasMethods = {

  // -------------------------------------------------------
  // Data Prep: Auras (TP System)
  // -------------------------------------------------------

  _prepareAurasData(context, system) {
    const auras = system.signatureAuras || [];
    const config = CONFIG.DBU ?? {};
    const tier = system.tier || 1;
    const tpLimit = this._tpLimitByBaseTier(system.baseTier);
    const advData = config.auraAdvantagesData || {};
    const disadvData = config.auraDisadvantagesData || {};

    const preparedAuras = auras.map(a => {
      const tpCost = this._calcAuraTPCost(a);
      // KP scales with the aura's FULL TP — Free TP reduces what the player
      // PAYS, not the aura's power (same model as _calcTechKP's tpFull)
      const tpFull = this._calcAuraTPCost({ ...a, freeTP: 0 });
      const calculatedKP = this._calcAuraKPCharge(a, tpFull);
      const efficiency = this._calcAuraEfficiency(a, tier);

      const auraTypeData = config.auraTypes?.[a.type] || { kpCost: 6, effect: "" };
      const baseKP = auraTypeData.kpCost;
      const minKP = Math.ceil(baseKP / 2);
      const finalKP = Math.max(minKP, calculatedKP - efficiency);
      const maintenanceKP = Math.ceil(finalKP / 2);

      // KP reduction from disadvantages (display purposes)
      let kpReduction = 0;
      for (const dis of (a.disadvantages || [])) {
        const tc = dis.tpCost || 0;
        if (tc < 0) kpReduction += Math.abs(tc);
      }

      // Dynamic Ki from all adv/disadv
      let dynamicKi = 0;
      for (const adv of (a.advantages || [])) dynamicKi += (adv.dynamicTP || 0);
      for (const dis of (a.disadvantages || [])) dynamicKi += (dis.dynamicTP || 0);

      // Enriched advantages with requirement field
      const enrichedAdvantages = (a.advantages || []).map(adv => ({
        ...adv,
        requirement: advData[adv.name]?.requirement || ""
      }));

      // Enriched disadvantages with requirement field
      const enrichedDisadvantages = (a.disadvantages || []).map(dis => ({
        ...dis,
        requirement: disadvData[dis.name]?.requirement || ""
      }));

      return {
        ...a,
        tpCost,
        tpMax: tpLimit,
        tpOverLimit: tpCost > tpLimit,
        calculatedKP,
        baseKP,
        efficiency,
        finalKP,
        maintenanceKP,
        kpReduction,
        dynamicKi,
        auraTypeEffect: auraTypeData.effect || "",
        advantages: enrichedAdvantages,
        disadvantages: enrichedDisadvantages
      };
    });
    context.signatureAuras = preparedAuras;

    // --- One-Sided Fusion: append gained auras from suppressed actor(s) ---
    const fusion = system.fusion || {};
    const activeGainedAuraId = fusion.activeGainedAuraId || "";
    if (fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession")
        && !this.actor._blockGainedAbilities(system)) {
      const suppIds = fusion.suppressedCharacterIds || [];
      for (const suppId of suppIds) {
        const suppActor = game.actors?.get(suppId);
        if (!suppActor) continue;
        const suppSys = suppActor.system || {};
        const suppAuras = suppSys.signatureAuras || [];
        for (const sa of suppAuras) {
          const cloned = foundry.utils.deepClone(sa);
          const tpCost = this._calcAuraTPCost(cloned);
          const tpFull = this._calcAuraTPCost({ ...cloned, freeTP: 0 });
          const calculatedKP = this._calcAuraKPCharge(cloned, tpFull);
          const efficiency = this._calcAuraEfficiency(cloned, tier);
          const auraTypeData = config.auraTypes?.[cloned.type] || { kpCost: 6, effect: "" };
          const baseKP = auraTypeData.kpCost;
          const minKP = Math.ceil(baseKP / 2);
          const finalKP = Math.max(minKP, calculatedKP - efficiency);
          const maintenanceKP = Math.ceil(finalKP / 2);
          let kpReduction = 0;
          for (const dis of (cloned.disadvantages || [])) {
            const tc = dis.tpCost || 0;
            if (tc < 0) kpReduction += Math.abs(tc);
          }
          let dynamicKi = 0;
          for (const adv of (cloned.advantages || [])) dynamicKi += (adv.dynamicTP || 0);
          for (const dis of (cloned.disadvantages || [])) dynamicKi += (dis.dynamicTP || 0);
          const enrichedAdvantages = (cloned.advantages || []).map(adv => ({
            ...adv, requirement: advData[adv.name]?.requirement || ""
          }));
          const enrichedDisadvantages = (cloned.disadvantages || []).map(dis => ({
            ...dis, requirement: disadvData[dis.name]?.requirement || ""
          }));
          // Gained aura active state is tracked via fusion.activeGainedAuraId
          const gainedAuraKey = `${suppId}_${cloned.id}`;
          preparedAuras.push({
            ...cloned,
            active: activeGainedAuraId === gainedAuraKey,
            isGained: true,
            gainedFrom: suppActor.name,
            gainedAuraKey,
            tpMax: tpLimit,
            tpCost, calculatedKP, baseKP, efficiency, finalKP, maintenanceKP,
            kpReduction, dynamicKi,
            auraTypeEffect: auraTypeData.effect || "",
            advantages: enrichedAdvantages,
            disadvantages: enrichedDisadvantages
          });
        }
      }
    }

    // --- Battle Jacket Piloting: append gained auras from jacket ---
    if (system.isPiloting && system._pilotedJacket) {
      const bjAuras = system._pilotedJacket.signatureAuras || [];
      for (const sa of bjAuras) {
        const cloned = foundry.utils.deepClone(sa);
        preparedAuras.push({
          ...cloned,
          isGained: true,
          gainedFrom: system._pilotedJacket.name,
          gainedSource: "battleJacket"
        });
      }
    }

    // Identified active aura for header display
    context.activeAura = preparedAuras.find(a => a.active) || null;
    context.activeAuraEffects = this._getActiveAuraEffects(context.activeAura);

    // Aura type options
    const auraTypeOptions = {};
    for (const [key, data] of Object.entries(config.auraTypes || {})) {
      auraTypeOptions[key] = key;
    }
    context.auraTypeOptions = auraTypeOptions;

    // Aura advantage/disadvantage names
    context.auraAdvantageOptions = Object.keys(advData).sort();
    context.auraDisadvantageOptions = Object.keys(disadvData).sort();

    // Lookup options for Attack Ref tab
    context.techAdvantageOptions = Object.keys(config.techniqueAdvantagesData || {}).sort();
    context.techDisadvantageOptions = Object.keys(config.techniqueDisadvantagesData || {}).sort();
  },

  _getActiveAuraEffects(activeAura) {
    if (!activeAura) return [];
    const effects = [];

    for (const adv of (activeAura.advantages || [])) {
      const rankLabel = (adv.ranks && adv.ranks > 1) ? ` (x${adv.ranks})` : "";
      const noteLabel = adv.notes ? `: ${adv.notes}` : "";
      effects.push({ type: "advantage", name: `${adv.name}${rankLabel}${noteLabel}` });
    }

    for (const dis of (activeAura.disadvantages || [])) {
      const rankLabel = (dis.ranks && dis.ranks > 1) ? ` (x${dis.ranks})` : "";
      const noteLabel = dis.notes ? `: ${dis.notes}` : "";
      effects.push({ type: "disadvantage", name: `${dis.name}${rankLabel}${noteLabel}` });
    }

    return effects;
  },

  _calcAuraKPCharge(aura, tpCost) {
    const config = CONFIG.DBU ?? {};
    const auraTypeData = config.auraTypes?.[aura.type] || { kpCost: 6 };
    const baseKP = auraTypeData.kpCost;
    const tpModifier = Math.ceil(tpCost / 5);
    return baseKP + tpModifier;
  },

  _calcAuraEfficiency(aura, tier) {
    let efficiency = 0;
    for (const adv of (aura.advantages || [])) {
      if (adv.name === "Efficiency") efficiency += (adv.ranks || 1) * 4;
    }
    for (const dis of (aura.disadvantages || [])) {
      if (dis.name === "Inefficiency") efficiency -= (dis.ranks || 1) * 4;
    }
    return efficiency;
  },

  _calcAuraTPCost(aura) {
    let total = 15; // Base TP for auras
    for (const adv of (aura.advantages || [])) total += (adv.tpCost || 0);
    for (const disadv of (aura.disadvantages || [])) total += (disadv.tpCost || 0);
    total -= (aura.freeTP || 0);
    return Math.max(10, total); // Minimum 10 TP
  },

  _calcAurasTotalTP(system) {
    const auras = system.signatureAuras || [];
    return auras.reduce((sum, a) => sum + this._calcAuraTPCost(a), 0);
  },

  // -------------------------------------------------------
  // Aura CRUD
  // -------------------------------------------------------

  async _onAddAura(event) {
    event.preventDefault();
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const nextId = auras.length > 0 ? Math.max(...auras.map(a => a.id || 0)) + 1 : 1;
    auras.push({
      id: nextId, name: "New Aura", type: "Sparking", active: false,
      description: "", tpMax: 10, freeTP: 0, advantages: [], disadvantages: []
    });
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onDeleteAura(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const auraId = Number(event.currentTarget.dataset.auraId);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const idx = auras.findIndex(a => a.id === auraId);
    if (idx > -1) {
      if (!(await this._confirmDelete("Aura", auras[idx].name))) return;
      auras.splice(idx, 1);
      await this.actor.update({ "system.signatureAuras": auras });
    }
  },

  async _onToggleAura(event) {
    event.preventDefault();
    const gainedAuraKey = event.currentTarget.dataset.gainedAuraKey || "";

    // --- Gained aura toggle (One-Sided Fusion) ---
    if (gainedAuraKey) {
      const fusion = this.actor.system.fusion || {};
      const wasActive = fusion.activeGainedAuraId === gainedAuraKey;
      const updateData = {};
      // If activating a gained aura, deactivate any own active aura
      if (!wasActive) {
        // Entry gates apply to gained auras too — resolve the suppressed
        // actor's aura row ("suppActorId_auraId" key format).
        const sepIdx = gainedAuraKey.indexOf("_");
        if (sepIdx > -1) {
          const suppActor = game.actors?.get(gainedAuraKey.substring(0, sepIdx));
          const gAura = (suppActor?.system?.signatureAuras || [])
            .find(x => x.id === Number(gainedAuraKey.substring(sepIdx + 1)));
          if (gAura && this._auraEntryBlocked(gAura)) return;
        }
        const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
        let ownChanged = false;
        for (const a of auras) {
          if (a.active) { a.active = false; ownChanged = true; }
        }
        if (ownChanged) updateData["system.signatureAuras"] = auras;
      }
      updateData["system.fusion.activeGainedAuraId"] = wasActive ? "" : gainedAuraKey;
      await this.actor.update(updateData);
      return;
    }

    // --- Own aura toggle ---
    const auraId = Number(event.currentTarget.dataset.auraId);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura) return;
    const newState = !aura.active;
    if (newState && this._auraEntryBlocked(aura)) return;
    // Deactivate all other auras (only one can be active at a time)
    if (newState) {
      for (const a of auras) { if (a.id !== auraId) a.active = false; }
    }
    aura.active = newState;
    const updateData = { "system.signatureAuras": auras };
    // If activating an own aura, clear any active gained aura
    if (newState && this.actor.system.fusion?.activeGainedAuraId) {
      updateData["system.fusion.activeGainedAuraId"] = "";
    }
    await this.actor.update(updateData);
    // Burnout (auras.txt:518): leaving the aura inflicts Fatigued until the
    // end of your next turn — post the reminder card.
    if (!newState && (aura.disadvantages || []).some(d => d.name === "Burnout")) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-attack-roll" data-actor-id="${this.actor.id}">
          <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${aura.name || "Aura"}</span></h3>
          <div class="dbu-card-body">
            <div class="dbu-defend-guide"><b>Burnout:</b> on leaving this Aura you gain the <b>Fatigued</b> Combat Condition until the end of your next turn.</div>
          </div>
        </div>`
      });
    }
  },

  /**
   * Shared aura entry gates — Base Aura (blocked in a Core Transformation),
   * Restricted Aura (must be in the Transformation named in its notes) and
   * Climactic (must be below the rank-gated Health Threshold). Used by both
   * own and OSF-gained aura activation. Returns true (after warning) when
   * entry must be blocked.
   */
  _auraEntryBlocked(aura) {
    const sys = this.actor.system;
    // Base Aura (auras.txt:507): cannot be used while in a Core Transformation
    if ((aura.disadvantages || []).some(d => d.name === "Base Aura")) {
      const FORM_TYPES = ["form_alternate", "form_legendary"];
      const inCore = [...(sys.transformations || []), ...(sys._gainedActiveTransformations || [])]
        .some(t => t?.active && FORM_TYPES.includes(t.transformationType));
      if (inCore) {
        ui.notifications.warn(`${aura.name || "Aura"} has Base Aura — it cannot be used while you are in a Core Transformation.`);
        return true;
      }
    }
    // Restricted Aura (auras.txt:647): only within the selected Transformation
    // or Line (row notes). Empty notes = not yet configured — never block.
    const restricted = (aura.disadvantages || []).find(d => d.name === "Restricted Aura");
    const wanted = String(restricted?.notes || "").trim().toLowerCase();
    if (restricted && wanted) {
      const activeTrans = [...(sys.transformations || []), ...(sys._gainedActiveTransformations || [])]
        .filter(t => t?.active);
      const match = activeTrans.some(t => {
        const n = String(t.name || "").trim().toLowerCase();
        return n && (n.includes(wanted) || wanted.includes(n));
      });
      if (!match) {
        ui.notifications.warn(`${aura.name || "Aura"} has Restricted Aura — it can only be used within "${restricted.notes}". Activate that Transformation first (or fix the disadvantage's notes so it matches the Transformation's name).`);
        return true;
      }
    }
    // Climactic (auras.txt): only enter below the Bruised (R1), Injured (R2)
    // or Critical (R3) Health Threshold.
    const climactic = (aura.disadvantages || []).find(d => d.name === "Climactic");
    if (climactic) {
      const r = climactic.ranks || 1;
      const hs = sys.status?.healthStatus || "healthy";
      const gate = r >= 3 ? ["critical"] : r === 2 ? ["injured", "critical"]
        : ["bruised", "injured", "critical"];
      if (!gate.includes(hs)) {
        const thName = r >= 3 ? "Critical" : r === 2 ? "Injured" : "Bruised";
        ui.notifications.warn(`${aura.name || "Aura"} has Climactic (${r}) — you can only enter it while below the ${thName} Health Threshold.`);
        return true;
      }
    }
    return false;
  },

  async _onAuraFieldChange(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const auraId = Number(el.dataset.auraId);
    const field = el.dataset.field;
    if (isNaN(auraId) || !field) return;
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura) return;
    if (el.type === "number") aura[field] = Number(el.value) || 0;
    else aura[field] = el.value;
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onAddAuraAdvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const auraId = Number(event.currentTarget.dataset.auraId);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura) return;
    if (!aura.advantages) aura.advantages = [];
    aura.advantages.push({ name: "", ranks: 1, notes: "", tpCost: 0, dynamicTP: 0 });
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onRemoveAuraAdvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const auraId = Number(event.currentTarget.dataset.auraId);
    const advIndex = Number(event.currentTarget.dataset.advIndex);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura?.advantages) return;
    aura.advantages.splice(advIndex, 1);
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onAuraAdvField(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const auraId = Number(el.dataset.auraId);
    const advIndex = Number(el.dataset.advIndex);
    const field = el.dataset.field;
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura?.advantages?.[advIndex]) return;
    if (field === "name") {
      aura.advantages[advIndex].name = el.value;
      aura.advantages[advIndex].ranks = 1;
      aura.advantages[advIndex].tpCost = this._lookupAuraAdvTP(el.value, 1);
    } else if (field === "ranks") {
      const advName = aura.advantages[advIndex].name;
      const maxR = CONFIG.DBU?.auraAdvantagesData?.[advName]?.maxRanks || 99;
      let r = Number(el.value) || 1;
      if (r > maxR) { ui.notifications.warn(`${advName} allows at most ${maxR} rank(s).`); r = maxR; }
      aura.advantages[advIndex].ranks = r;
      aura.advantages[advIndex].tpCost = this._lookupAuraAdvTP(advName, r);
    } else if (field === "dynamicTP") {
      aura.advantages[advIndex].dynamicTP = Number(el.value) || 0;
    } else {
      aura.advantages[advIndex][field] = el.value;
    }
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onAddAuraDisadvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const auraId = Number(event.currentTarget.dataset.auraId);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura) return;
    if (!aura.disadvantages) aura.disadvantages = [];
    aura.disadvantages.push({ name: "", ranks: 1, notes: "", tpCost: 0, dynamicTP: 0 });
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onRemoveAuraDisadvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const auraId = Number(event.currentTarget.dataset.auraId);
    const disadvIndex = Number(event.currentTarget.dataset.disadvIndex);
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura?.disadvantages) return;
    aura.disadvantages.splice(disadvIndex, 1);
    await this.actor.update({ "system.signatureAuras": auras });
  },

  async _onAuraDisadvField(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const auraId = Number(el.dataset.auraId);
    const disadvIndex = Number(el.dataset.disadvIndex);
    const field = el.dataset.field;
    const auras = foundry.utils.deepClone(this.actor.system.signatureAuras || []);
    const aura = auras.find(a => a.id === auraId);
    if (!aura?.disadvantages?.[disadvIndex]) return;
    if (field === "name") {
      aura.disadvantages[disadvIndex].name = el.value;
      aura.disadvantages[disadvIndex].ranks = 1;
      aura.disadvantages[disadvIndex].tpCost = this._lookupAuraDisadvTP(el.value, 1);
    } else if (field === "ranks") {
      const disName = aura.disadvantages[disadvIndex].name;
      const maxR = CONFIG.DBU?.auraDisadvantagesData?.[disName]?.maxRanks || 99;
      let r = Number(el.value) || 1;
      if (r > maxR) { ui.notifications.warn(`${disName} allows at most ${maxR} rank(s).`); r = maxR; }
      aura.disadvantages[disadvIndex].ranks = r;
      aura.disadvantages[disadvIndex].tpCost = this._lookupAuraDisadvTP(disName, r);
    } else if (field === "dynamicTP") {
      aura.disadvantages[disadvIndex].dynamicTP = Number(el.value) || 0;
    } else {
      aura.disadvantages[disadvIndex][field] = el.value;
    }
    await this.actor.update({ "system.signatureAuras": auras });
  },

  _lookupAuraAdvTP(name, ranks) {
    const data = CONFIG.DBU?.auraAdvantagesData?.[name];
    if (!data) return 0;
    const perRank = Array.isArray(data.tpPerRank) ? data.tpPerRank : [data.tpPerRank || 0];
    let total = 0;
    for (let i = 0; i < ranks; i++) total += perRank[Math.min(i, perRank.length - 1)] || 0;
    return total;
  },

  _lookupAuraDisadvTP(name, ranks) {
    const data = CONFIG.DBU?.auraDisadvantagesData?.[name];
    if (!data) return 0;
    const perRank = Array.isArray(data.tpPerRank) ? data.tpPerRank : [data.tpPerRank || 0];
    let total = 0;
    for (let i = 0; i < ranks; i++) total += perRank[Math.min(i, perRank.length - 1)] || 0;
    return total;
  },
};
