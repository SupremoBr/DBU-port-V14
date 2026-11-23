import { getRacialCatalogIndex } from "../../helpers/catalog-index.mjs";
import { Dialog } from "../../helpers/foundry-compat.mjs";
import { minimumUniqueKi093, uniqueAbilityOptions } from "../../rules/unique-abilities-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";

function prepareUniqueSelections(sheet, selection, data) {
  const options = uniqueAbilityOptions(data, selection.restrictions);
  const selectedAdvancements = (selection.advancements || []).map(sel => {
    const option = data.advancements?.find(row => row.id === sel.advancementId);
    return {
      ...sel,
      amount: sel.amount || 1,
      name: option?.name || sel.advancementId,
      legacy: !option || !!option.legacy,
      unavailable: !options.advancements.some(row => row.id === sel.advancementId),
      tpDisplay: option ? sheet._calcAdvancementTP(option, sel) : "?",
      effect: option?.effect || "",
      prerequisites: option?.prerequisites || "",
      maxRanks: data.source && option && !option.legacy ? (option.maxRanks ?? 1) : 5
    };
  });
  const selectedRestrictions = (selection.restrictions || []).map(sel => {
    const option = data.restrictions?.find(row => row.id === sel.restrictionId);
    return {
      ...sel,
      name: option?.name || sel.restrictionId,
      legacy: !option || !!option.legacy,
      tpDisplay: option?.tpCost ?? "?",
      effect: option?.effect || "",
      lockedAdvs: (option?.lockedAdvancements || []).join(", ") || "-"
    };
  });
  return {
    selectedAdvancements, selectedRestrictions,
    availableAdvancements: options.advancements,
    availableRestrictions: options.restrictions,
    canAddAdvancement: options.advancements.some(row => !selectedAdvancements.some(sel => sel.advancementId === row.id)),
    canAddRestriction: options.restrictions.some(row =>
      !selectedRestrictions.some(sel => sel.restrictionId === row.id) && !restrictionConflicts(data, selection, row)),
    hasAdvancements: !!(selectedAdvancements.length || options.advancements.length),
    hasRestrictions: !!(selectedRestrictions.length || options.restrictions.length),
    hasCatalogOptions: !!data.source && [...data.advancements, ...data.restrictions].some(row => !row.legacy)
  };
}

function restrictionConflicts(data, selection, restriction) {
  const locked = restriction.lockedAdvancements || [];
  return (selection.advancements || []).some(({ advancementId }) =>
    data.advancements?.some(option => option.id === advancementId && locked.includes(option.name)));
}

/** Character sheet domain: unique-powers. Methods run with the sheet as this. */
export const uniquePowersMethods = {

  // -------------------------------------------------------
  // Data Prep: Unique Abilities
  // -------------------------------------------------------

  /**
   * Resolve a catalog KP-cost string like "2(T)", "10(T)", "4(bT)" into flat
   * KP at the actor's current tiers. Returns null for non-numeric costs.
   */
  _resolveUAKpCost(kpStr, tier, baseTier) {
    const m = String(kpStr || "").trim().match(/^(\d+)\s*\((bT|T)\)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return m[2].toLowerCase() === "bt" ? n * baseTier : n * tier;
  },

  _prepareUniqueData(context, system) {
    const uniques = system.uniqueAbilities || [];
    const catalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
    const uaTier = system.tier || 1;
    const uaBaseTier = system.baseTier || 1;
    const uaTalents = system.talents || [];
    const ecSelection = system.talentSelections?.energyControlTechniqueId;

    const prepared = uniques.map((ua, index) => {
      const data = catalog[ua.abilityKey] || { name: ua.abilityKey, tpCost: 0, advancements: [], restrictions: [] };

      // Calculate TP cost for this unique
      const tpCost = this._calcUniqueTPCost(ua, data);

      // KP Cost resolved at current tier + Energy Control / Technique Master
      // reduction (−2(T)) for Technical Unique Abilities (talents-catalog).
      const kpResolved = this._resolveUAKpCost(data.kpCost, uaTier, uaBaseTier);
      const chooseType = !!data.source && data.abilityType === "Technical/Magical";
      const uaType = chooseType ? ua.abilityType : data.abilityType;
      const ecApplies = !data.source && /technical/i.test(uaType || "") && uaTalents.includes("energy_control")
        && (uaTalents.includes("technique_master") || String(ecSelection) === `ua:${ua.abilityKey}`);
      let kpEffective = (kpResolved != null && ecApplies)
        ? Math.max(0, kpResolved - 2 * uaTier) : kpResolved;
      // Tiring aura: +1(T) KP per rank on Unique Abilities while in the aura
      if (kpEffective != null) {
        const tAura = this.actor._getActiveAura(system);
        for (const dis of (tAura?.disadvantages || [])) {
          if (dis.name === "Tiring") kpEffective += (dis.ranks || 1) * uaTier;
        }
        // "Ki Point Cost Unique Abilities" buffs (delta; negative = discount),
        // Magical/Technical variants by ability type, and Deep Control's
        // all-maneuver reduction — previously dead aptitudes.
        kpEffective = Math.max(0, kpEffective
          + (system.aptitudes?.kiCostUnique || 0)
          + (uaType === "Magical" || (!data.source && /magical/i.test(uaType)) ? (system.aptitudes?.kiCostUniqueMagical || 0) : 0)
          + (uaType === "Technical" || (!data.source && /technical/i.test(uaType)) ? (system.aptitudes?.kiCostUniqueTechnical || 0) : 0)
          - (system.aptitudes?.allManeuverKiReduction || 0));
      }
      const isSustained = data.source
        ? !!data.isSustained : /pay the (KP|Ki Point) Cost/i.test(data.effect || "");
      if (kpEffective != null && data.source) {
        kpEffective = Math.max(kpEffective, minimumUniqueKi093(kpResolved, uaTier));
      }

      // Shapeshift: interactive effects-config panel (own ability only —
      // the state lives on this actor; gained clones don't get the panel)
      let shapeshift = null;
      if (ua.abilityKey === "shapeshift") {
        shapeshift = this._prepareShapeshiftConfig(system, {
          hasDiploma: (ua.advancements || []).some(a => a.advancementId === "shapeshift_diploma"),
          hasQuickShift: (ua.advancements || []).some(a => a.advancementId === "quick_shift")
        });
      }

      return {
        ...ua,
        uniqueIndex: index,
        data,
        chooseType: chooseType && uses093(system),
        tpCost,
        kpResolved,
        kpEffective,
        kpModified: kpEffective !== kpResolved,
        isSustained,
        shapeshift,
        ...prepareUniqueSelections(this, ua, data)
      };
    });

    // --- One-Sided Fusion: append gained unique abilities from suppressed actor(s) ---
    const fusion = system.fusion || {};
    if (fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession")
        && !this.actor._blockGainedAbilities(system)) {
      const suppIds = fusion.suppressedCharacterIds || [];
      for (const suppId of suppIds) {
        const suppActor = game.actors?.get(suppId);
        if (!suppActor) continue;
        const suppSys = suppActor.system || {};
        const suppUniques = suppSys.uniqueAbilities || [];
        for (const su of suppUniques) {
          const cloned = foundry.utils.deepClone(su);
          const data = catalog[cloned.abilityKey] || { name: cloned.abilityKey, tpCost: 0, advancements: [], restrictions: [] };
          const tpCost = this._calcUniqueTPCost(cloned, data);
          prepared.push({
            ...cloned,
            isGained: true,
            gainedFrom: suppActor.name,
            uniqueIndex: prepared.length,
            data, tpCost, ...prepareUniqueSelections(this, cloned, data)
          });
        }
      }
    }

    // --- Battle Jacket Piloting: append gained unique abilities from jacket ---
    if (system.isPiloting && system._pilotedJacket) {
      const bjUAs = system._pilotedJacket.uniqueAbilities || [];
      for (const su of bjUAs) {
        const cloned = foundry.utils.deepClone(su);
        const data = catalog[cloned.abilityKey] || { name: cloned.abilityKey, tpCost: 0 };
        prepared.push({
          ...cloned,
          data,
          tpCost: this._calcUniqueTPCost(cloned, data),
          ...prepareUniqueSelections(this, cloned, data),
          isGained: true,
          gainedFrom: system._pilotedJacket.name,
          gainedSource: "battleJacket"
        });
      }
    }

    context.characterUniques = prepared;
  },

  /**
   * Build the Shapeshift effects-config panel context (unique-abilities.txt:1786).
   * Effects (1 per Action spent, max 3): bestial exchange / size change /
   * vehicle form (BP 8) / weapon form (3 Qualities, +Might Wound).
   */
  _prepareShapeshiftConfig(system, { hasDiploma, hasQuickShift }) {
    const st = system.transformationMeta?.shapeshiftState || {};
    const effects = st.effects || {};
    // Magical Girl "A Different Me" (trait level 5+): Diploma granted while
    // transformed + a second Bestial Trait allowed on the exchange.
    const mgL5 = (system.transformations || []).some(t =>
      t?.active && t?.catalogKey === "magical_girl" && (t.level || 0) >= 5);
    const diploma = hasDiploma || mgL5;
    const costs = this._shapeshiftCosts(system);
    const chosen = ["bestial", "size", "vehicle", "weapon"].filter(k => effects[k]);
    const actions = hasQuickShift ? 3 : Math.min(3, Math.max(1, st.actions || 1));

    // Body-Category Secondary Racial Traits owned (pre-exchange list when active)
    const ownedIds = system._shapeshiftOriginalTraits || system.racialTraits || [];
    const traitsById = getRacialCatalogIndex(CONFIG.DBU?.racialTraitsCatalog).byId;
    const bodyTraitOptions = ownedIds
      .map(id => traitsById.get(id))
      .filter(t => t && t.traitCategory === "secondary" && t.category === "body")
      .map(t => ({ id: t.id, name: t.name, selected: t.id === st.giveTraitId }));

    const btConfig = system.transformationMeta?.mutationState?.bestialTraitConfig || {};
    const mkBestialList = (chosenId) => (CONFIG.DBU?.bestialTraitsCatalog || []).map(bt => {
      const optEffect = (bt.effects || []).find(e => e.activationType === "option");
      const selected = bt.id === chosenId;
      return {
        id: bt.id, name: bt.name, selected,
        options: (selected && optEffect) ? optEffect.options.map(o => {
          const key = o.name.toLowerCase().replace(/\s+/g, "_");
          return { key, name: o.name, selected: (btConfig[bt.id]?.option) === key };
        }) : null
      };
    });
    const chosenBestial = mkBestialList(st.bestialTraitId || "");
    const chosenBestial2 = mgL5 ? mkBestialList(st.bestialTraitId2 || "") : null;

    const sizeOptions = (this.actor.constructor.SIZE_ORDER || []).map(s => ({
      value: s, label: s.charAt(0).toUpperCase() + s.slice(1),
      selected: s === (st.sizeChoice || "")
    }));
    const foundationOptions = ["Physical", "Energy", "Magic"].map(f => ({
      value: f, selected: f === (st.weaponFoundation || "Physical")
    }));

    return {
      active: !!st.active,
      actions, hasQuickShift, diploma, mgL5,
      ...costs,
      duration: diploma ? "Unlimited (Diploma)" : "5 rounds",
      effects: {
        bestial: !!effects.bestial, size: !!effects.size,
        vehicle: !!effects.vehicle, weapon: !!effects.weapon
      },
      chosenCount: chosen.length,
      maxEffects: actions,
      overLimit: chosen.length > actions,
      bodyTraitOptions,
      bestialList: chosenBestial,
      bestialList2: chosenBestial2,
      sizeOptions,
      foundationOptions,
      weaponQualities: st.weaponQualities || "",
      might: system.status?.might ?? 0
    };
  },

  /** Shapeshift activation/sustain/regain KP costs at the actor's current state. */
  _shapeshiftCosts(system) {
    const tier = system.tier || 1;
    const ua = (system.uniqueAbilities || []).find(u => u.abilityKey === "shapeshift");
    const hasDiploma = (ua?.advancements || []).some(a => a.advancementId === "shapeshift_diploma");
    const mgL5 = (system.transformations || []).some(t =>
      t?.active && t?.catalogKey === "magical_girl" && (t.level || 0) >= 5);
    const costTier = uses093(system) ? system.baseTier || 1 : tier;
    const baseCost = 8 * costTier;
    const discount = (hasDiploma || mgL5) ? 2 * tier : 0;
    const floor = uses093(system) ? minimumUniqueKi093(baseCost, tier) : 0;
    const kpActivate = Math.max(floor, baseCost - discount);
    return { kpActivate, kpSustain: Math.ceil(kpActivate / 2), kpRegain: 6 * costTier };
  },

  /** Shapeshift config field change (actions, trait/size/weapon selections). */
  async _onShapeshiftField(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    let value = event.currentTarget.value;
    if (field === "actions") value = Math.min(3, Math.max(1, Number(value) || 1));
    await this.actor.update({ [`system.transformationMeta.shapeshiftState.${field}`]: value });
  },

  /** Shapeshift effect checkbox — enforce max effects = Actions spent. */
  async _onShapeshiftEffect(event) {
    const el = event.currentTarget;
    const effect = el.dataset.effect;
    if (!effect) return;
    const st = foundry.utils.deepClone(this.actor.system.transformationMeta?.shapeshiftState || {});
    const effects = st.effects || {};
    if (el.checked) {
      const ua = (this.actor.system.uniqueAbilities || []).find(u => u.abilityKey === "shapeshift");
      const quickShift = (ua?.advancements || []).some(a => a.advancementId === "quick_shift");
      const max = quickShift ? 3 : Math.min(3, Math.max(1, st.actions || 1));
      const count = ["bestial", "size", "vehicle", "weapon"].filter(k => effects[k]).length;
      if (count >= max) {
        el.checked = false;
        ui.notifications.warn(`Shapeshift: max ${max} effect(s) for ${max} Action(s) spent.`);
        return;
      }
    }
    effects[effect] = el.checked;
    await this.actor.update({ "system.transformationMeta.shapeshiftState.effects": effects });
  },

  /** Toggle Shapeshift effects on/off, paying/regaining KP per the rules. */
  async _onShapeshiftToggle(event) {
    event.preventDefault();
    const system = this.actor.system;
    const st = foundry.utils.deepClone(system.transformationMeta?.shapeshiftState || {});
    const { kpActivate, kpSustain, kpRegain } = this._shapeshiftCosts(system);
    const ki = system.kiPool?.value ?? 0;
    const updates = {};
    let card;

    const EFFECT_LABELS = {
      bestial: "Bestial Exchange", size: "Size Change",
      vehicle: "Vehicle Form (BP 8)", weapon: "Weapon Form (3 Qualities)"
    };
    const chosen = ["bestial", "size", "vehicle", "weapon"]
      .filter(k => st.effects?.[k]).map(k => EFFECT_LABELS[k]);

    if (!st.active) {
      if (chosen.length === 0) {
        ui.notifications.warn("Shapeshift: select at least one effect before activating.");
        return;
      }
      if (ki < kpActivate) {
        ui.notifications.warn(`Shapeshift: requer ${kpActivate} KP.`);
        return;
      }
      st.active = true;
      updates["system.kiPool.value"] = ki - kpActivate;
      const chips = chosen.map(c => `<span class="dbu-meta-chip">${c}</span>`).join(" ");
      card = `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-random"></i> ${this.actor.name} — Shapeshift</div>
        <div class="dbu-attack-meta">
          <span class="dbu-meta-chip">Cost ${kpActivate} KP</span>
          <span class="dbu-meta-chip">Sustain ${kpSustain} KP/turn</span>
          <span class="dbu-meta-chip">Duration: ${this._shapeshiftDurationLabel(system)}</span>
        </div>
        <div class="dbu-attack-buffs">Effects: ${chips}</div>
      </div>`;
    } else {
      st.active = false;
      const kiMax = system.kiPool?.max ?? Infinity;
      updates["system.kiPool.value"] = Math.min(kiMax, ki + kpRegain);
      card = `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-random"></i> ${this.actor.name} — Shapeshift ended</div>
        <div class="dbu-attack-meta">
          <span class="dbu-meta-chip">Regain ${kpRegain} KP</span>
        </div>
        <div class="dbu-attack-buffs">Effects removed${chosen.length ? `: ${chosen.join(", ")}` : ""}. Spend ${kpRegain} KP to re-apply immediately (re-shift).</div>
      </div>`;
    }

    updates["system.transformationMeta.shapeshiftState"] = st;
    await this.actor.update(updates);
    ChatMessage.create({
      content: card,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
  },

  _shapeshiftDurationLabel(system) {
    const ua = (system.uniqueAbilities || []).find(u => u.abilityKey === "shapeshift");
    const hasDiploma = (ua?.advancements || []).some(a => a.advancementId === "shapeshift_diploma");
    const mgL5 = (system.transformations || []).some(t =>
      t?.active && t?.catalogKey === "magical_girl" && (t.level || 0) >= 5);
    return (hasDiploma || mgL5) ? "Unlimited (Diploma)" : "5 rounds";
  },

  _calcUniqueTPCost(ua, data) {
    if (ua.free) return 0;
    const baseCost = data.tpCost || 0;
    let tp = baseCost;

    for (const sel of (ua.advancements || [])) {
      if (sel.free) continue;
      const advData = (data.advancements || []).find(a => a.id === sel.advancementId);
      if (!advData) continue;
      tp += (advData.tpCost || 0) * (sel.amount || 1);
    }

    for (const sel of (ua.restrictions || [])) {
      const resData = (data.restrictions || []).find(r => r.id === sel.restrictionId);
      if (resData) tp += (resData.tpCost || 0); // negative values
    }

    // Floor: can't go below ceil(baseCost/2)
    return Math.max(Math.ceil(baseCost / 2), tp);
  },

  _calcAdvancementTP(advData, sel) {
    if (sel.free) return "Free";
    return (advData.tpCost || 0) * (sel.amount || 1);
  },

  _calcUniqueTotalTP(system) {
    const uniques = system.uniqueAbilities || [];
    const catalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
    return uniques.reduce((sum, ua) => {
      const data = catalog[ua.abilityKey] || { tpCost: 0, advancements: [], restrictions: [] };
      return sum + this._calcUniqueTPCost(ua, data);
    }, 0);
  },

  // -------------------------------------------------------
  // Data Prep: Manifested Power Bonus Display
  // -------------------------------------------------------

  _prepareManifestedPowerData(context, system) {
    const mpData = system.manifestedPowerBonuses || { entries: [], hasBonuses: false, totals: {} };
    context.manifestedPowerBonuses = mpData;
    context.hasManifestedPowers = mpData.hasBonuses && mpData.entries.length > 0;
    // Collect triggered effects for combat buttons
    context.mpTriggeredEffects = this._decorateTriggeredEffects(
      (mpData.entries || []).flatMap(e =>
        (e.triggered || []).map(t => ({ ...t, sourceName: e.name, catalogKey: e.catalogKey }))
      ),
      system,
      "mp"
    );
    // Collect per-round resource entries
    context.mpPerRoundEffects = (mpData.entries || []).flatMap(e =>
      (e.perRound || []).map(pr => ({ ...pr, sourceName: e.name, catalogKey: e.catalogKey }))
    );
  },

  // -------------------------------------------------------
  // Unique Abilities CRUD
  // -------------------------------------------------------

  async _onAddUnique(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
    const existing = this.actor.system.uniqueAbilities || [];
    const existingKeys = existing.map(u => u.abilityKey);

    const available = Object.entries(catalog)
      .filter(([key, data]) => !data.legacy && !existingKeys.includes(key))
      .map(([key, data]) => ({ key, name: data.name, type: data.abilityType }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!available.length) return;

    const optionsHtml = available.map(a =>
      `<option value="${a.key}">${a.name} (${a.type})</option>`
    ).join("\n");

    const result = await Dialog.prompt({
      title: "Add Unique Ability",
      content: `<form><div class="form-group"><label>Select Ability:</label><select name="abilityKey" style="width:100%;padding:4px;">${optionsHtml}</select></div></form>`,
      callback: (html) => html.find('[name="abilityKey"]').val(),
      rejectClose: false
    });
    if (!result || !Object.hasOwn(catalog, result) || catalog[result].legacy) return;

    const current = this.actor.system.uniqueAbilities || [];
    if (current.some(row => row.abilityKey === result)) return;
    const uniques = foundry.utils.deepClone(current);
    const nextId = uniques.length > 0 ? Math.max(...uniques.map(u => u.id || 0)) + 1 : 1;
    uniques.push({ id: nextId, abilityKey: result, free: false, advancements: [], restrictions: [] });
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onDeleteUnique(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const index = Number(event.currentTarget.dataset.uniqueIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (index >= 0 && index < uniques.length) {
      const uaName = CONFIG.DBU?.uniqueAbilitiesCatalog?.[uniques[index].abilityKey]?.name || uniques[index].abilityKey;
      if (!(await this._confirmDelete("Unique Ability", uaName))) return;
      uniques.splice(index, 1);
      await this.actor.update({ "system.uniqueAbilities": uniques });
    }
  },

  async _onUniqueFreeToggle(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const index = Number(event.currentTarget.dataset.uniqueIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (index >= 0 && index < uniques.length) {
      uniques[index].free = event.currentTarget.checked;
      await this.actor.update({ "system.uniqueAbilities": uniques });
    }
  },

  async _onAddUniqueAdvancement(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const index = Number(event.currentTarget.dataset.uniqueIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (index < 0 || index >= uniques.length) return;
    const catalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
    const data = catalog[uniques[index].abilityKey];
    if (!data) return;
    const available = uniqueAbilityOptions(data, uniques[index].restrictions).advancements;
    const option = available.find(row => !uniques[index].advancements.some(sel => sel.advancementId === row.id));
    if (!option) return;
    uniques[index].advancements.push({ advancementId: option.id, free: false, amount: 1 });
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onRemoveUniqueAdvancement(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const aIdx = Number(event.currentTarget.dataset.advIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (uIdx < 0 || uIdx >= uniques.length) return;
    uniques[uIdx].advancements.splice(aIdx, 1);
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onUniqueAdvSelect(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const aIdx = Number(event.currentTarget.dataset.advIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    const unique = uniques[uIdx];
    const selected = unique?.advancements[aIdx];
    if (!selected) return;
    const data = CONFIG.DBU?.uniqueAbilitiesCatalog?.[unique.abilityKey];
    const option = data && uniqueAbilityOptions(data, unique.restrictions).advancements
      .find(row => row.id === event.currentTarget.value);
    if (!option || unique.advancements.some((row, i) => i !== aIdx && row.advancementId === option.id)) {
      event.currentTarget.value = selected.advancementId;
      return;
    }
    selected.advancementId = option.id;
    selected.amount = Math.min(selected.amount || 1, data.source ? option.maxRanks ?? 1 : 5);
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onUniqueAdvFree(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const aIdx = Number(event.currentTarget.dataset.advIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (uIdx < 0 || uIdx >= uniques.length || aIdx < 0) return;
    uniques[uIdx].advancements[aIdx].free = event.currentTarget.checked;
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onUniqueAdvAmount(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const aIdx = Number(event.currentTarget.dataset.advIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    const unique = uniques[uIdx];
    const selected = unique?.advancements[aIdx];
    if (!selected) return;
    const data = CONFIG.DBU?.uniqueAbilitiesCatalog?.[unique.abilityKey];
    const option = data?.advancements?.find(row => row.id === selected.advancementId);
    if (!option) return;
    const max = data.source && !option.legacy ? option.maxRanks ?? 1 : 5;
    selected.amount = Math.max(1, Math.min(max, Math.trunc(Number(event.currentTarget.value)) || 1));
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onAddUniqueRestriction(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const index = Number(event.currentTarget.dataset.uniqueIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (index < 0 || index >= uniques.length) return;
    const catalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
    const data = catalog[uniques[index].abilityKey];
    if (!data) return;
    const option = uniqueAbilityOptions(data).restrictions.find(row =>
      !uniques[index].restrictions.some(sel => sel.restrictionId === row.id) &&
      !restrictionConflicts(data, uniques[index], row));
    if (!option) return;
    uniques[index].restrictions.push({ restrictionId: option.id });
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onRemoveUniqueRestriction(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const rIdx = Number(event.currentTarget.dataset.resIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    if (uIdx < 0 || uIdx >= uniques.length) return;
    uniques[uIdx].restrictions.splice(rIdx, 1);
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },

  async _onUniqueResSelect(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const uIdx = Number(event.currentTarget.dataset.uniqueIndex);
    const rIdx = Number(event.currentTarget.dataset.resIndex);
    const uniques = foundry.utils.deepClone(this.actor.system.uniqueAbilities || []);
    const unique = uniques[uIdx];
    const selected = unique?.restrictions[rIdx];
    if (!selected) return;
    const data = CONFIG.DBU?.uniqueAbilitiesCatalog?.[unique.abilityKey];
    const option = data && uniqueAbilityOptions(data).restrictions.find(row => row.id === event.currentTarget.value);
    if (!option || unique.restrictions.some((row, i) => i !== rIdx && row.restrictionId === option.id)) {
      event.currentTarget.value = selected.restrictionId;
      return;
    }
    if (restrictionConflicts(data, unique, option)) {
      event.currentTarget.value = selected.restrictionId;
      ui.notifications.warn("Remova os avanços bloqueados antes de escolher essa restrição.");
      return;
    }
    selected.restrictionId = option.id;
    await this.actor.update({ "system.uniqueAbilities": uniques });
  },
};
