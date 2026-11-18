import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: transformation-state. Methods run with the sheet as this. */
export const transformationStateMethods = {

  _normalizeTransformationRows(rows) {
    const list = foundry.utils.deepClone(rows || []);
    let nextId = 1;
    const usedIds = new Set();

    for (const row of list) {
      const numericId = Number(row?.id);
      if (Number.isInteger(numericId) && numericId > 0 && !usedIds.has(numericId)) {
        row.id = numericId;
        usedIds.add(numericId);
        nextId = Math.max(nextId, numericId + 1);
      } else {
        while (usedIds.has(nextId)) nextId++;
        row.id = nextId;
        usedIds.add(nextId);
        nextId++;
      }
    }

    return list;
  },

  // -------------------------------------------------------
  // Transformation CRUD
  // -------------------------------------------------------

  async _onAddTransformation(event) {
    event.preventDefault();
    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    const nextId = trans.length > 0 ? Math.max(...trans.map(t => t.id || 0)) + 1 : 1;
    trans.push({
      id: nextId, catalogKey: null, name: "", active: false,
      gradeOrStacks: "", tierRequirement: "", mastered: false, stressTest: 0,
      transformationType: "form_alternate",
      attrBonuses: { ag: "", fo: "", te: "", sc: "", in: "", ma: "", pe: "" },
      aspects: [], structuredTraits: [], traits: "", isLegendary: false
    });
    await this.actor.update({ "system.transformations": trans });
  },

  async _onDeleteTransformation(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const transIndex = Number(event.currentTarget.dataset.transIndex);
    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (transIndex >= 0 && transIndex < trans.length) {
      if (!(await this._confirmDelete("Transformation", trans[transIndex].name))) return;
      trans.splice(transIndex, 1);
      await this.actor.update({ "system.transformations": trans });
    }
  },

  async _onTransformationFieldChange(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const transIndex = Number(el.dataset.transIndex);
    const field = el.dataset.field;
    if (isNaN(transIndex) || !field) return;
    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (transIndex >= trans.length) return;

    // Handle nested attrBonuses fields (e.g. "attrBonuses.ag")
    if (field.startsWith("attrBonuses.")) {
      const attrKey = field.split(".")[1];
      if (!trans[transIndex].attrBonuses) trans[transIndex].attrBonuses = {};
      trans[transIndex].attrBonuses[attrKey] = el.value;
    } else if (el.type === "number") {
      trans[transIndex][field] = Number(el.value) || 0;
    } else {
      trans[transIndex][field] = el.value;
    }
    await this.actor.update({ "system.transformations": trans });
  },

  async _onTransformationCheckChange(event) {
    const el = event.currentTarget;
    const transIndex = Number(el.dataset.transIndex);
    const field = el.dataset.field;
    if (isNaN(transIndex) || !field) return;

    // Handle gained transformation toggle (OSF)
    const gainedKey = el.dataset.gainedKey;
    if (gainedKey && field === "active") {
      const activeGainedIds = foundry.utils.deepClone(this.actor.system.fusion?.activeGainedTransformationIds || []);
      if (el.checked) {
        if (!activeGainedIds.includes(gainedKey)) activeGainedIds.push(gainedKey);
      } else {
        const idx = activeGainedIds.indexOf(gainedKey);
        if (idx >= 0) activeGainedIds.splice(idx, 1);
      }
      await this.actor.update({ "system.fusion.activeGainedTransformationIds": activeGainedIds });
      return;
    }

    // Non-active fields on gained transformations are read-only
    if (el.closest('.gained-ability')) return;

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (transIndex >= trans.length) return;
    const wasActive = !!trans[transIndex][field];

    // Step-by-Step guard: activating an Alternate/Legendary Form while another
    // one is active normally REPLACES it (leave the old form so its bonuses and
    // Stress contributions end). Offer conjunction (keep both) as the exception.
    let replaceIndices = [];
    if (field === "active" && el.checked && !wasActive) {
      const FORM_TYPES = ["form_alternate", "form_legendary"];
      if (FORM_TYPES.includes(trans[transIndex].transformationType)) {
        const others = trans
          .map((t, i) => (i !== transIndex && t.active && FORM_TYPES.includes(t.transformationType)) ? i : -1)
          .filter(i => i >= 0);
        if (others.length) {
          const names = others.map(i => trans[i].name || "Form").join(", ");
          const choice = await Dialog.wait({
            title: "Change Form",
            content: `<p>You are already in <b>${names}</b>.</p>
              <p><b>Replace</b>: leave that Form (Step-by-Step — its bonuses end).<br>
              <b>Keep both</b>: enter in conjunction (bonuses and Stress Tests combine).</p>`,
            buttons: {
              replace: { icon: '<i class="fas fa-exchange-alt"></i>', label: "Replace", callback: () => "replace" },
              keep: { icon: '<i class="fas fa-layer-group"></i>', label: "Keep both", callback: () => "keep" },
              cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => "cancel" }
            },
            default: "replace",
            close: () => "cancel"
          });
          if (choice === "cancel") { el.checked = false; return; }
          if (choice === "replace") replaceIndices = others;
        }
      }
    }

    trans[transIndex][field] = el.checked;

    const updates = { "system.transformations": trans };
    let entrySnapshot = null;
    if (field === "active") {
      const snapshots = foundry.utils.deepClone(this.actor.system.transformationMeta?.entrySnapshots || {});
      const transId = String(trans[transIndex].id ?? transIndex);
      for (const ri of replaceIndices) {
        trans[ri].active = false;
        delete snapshots[String(trans[ri].id ?? ri)];
      }
      if (el.checked && !wasActive) {
        entrySnapshot = this._buildTransformationEntrySnapshot(transIndex, trans);
        snapshots[transId] = entrySnapshot;
      } else if (!el.checked && wasActive) {
        delete snapshots[transId];
      }
      updates["system.transformationMeta.entrySnapshots"] = snapshots;
    }

    await this.actor.update(updates);
    await this._syncPersistentTransformationCombatStates(trans);
    await this._syncPersistentTransformationResources(trans);
    await this._syncPersistentTransformationFlags(trans);

    if (field === "active" && el.checked && !wasActive) {
      await this._applyTransformationEntryEffects(trans[transIndex], entrySnapshot);

      // --- Power High: popup warning on activation ---
      const activated = trans[transIndex];
      const phMatch = (activated.aspects || []).find(a => /Power\s+High/i.test(a));
      if (phMatch) {
        Dialog.prompt({
          title: "Power High",
          content: `<div style="padding:8px;">
            <h3 style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Power High — ${activated.name || "Transformation"}</h3>
            <p><b>Each turn</b>, roll <b>1d10</b>. If the result is <b>5 or lower</b>:</p>
            <ul>
              <li>You must use <b>Direct Hit</b> on the next attack against you, OR</li>
              <li>Suffer a stack of <b>Slowed</b> until the start of your next turn</li>
            </ul>
            <p>After taking Direct Hit or losing the Slowed stack, the Power High level decreases by 1.</p>
          </div>`,
          callback: () => {}
        });
      }

      // --- Temporary: start countdown ---
      const tmpMatch = (activated.aspects || []).find(a => /Temporary/i.test(a));
      if (tmpMatch) {
        const lvMatch = tmpMatch.match(/\(([^)]+)\)/i);
        const lv = lvMatch ? (parseInt(lvMatch[1]) || 1) : 1;
        const rounds = 6 - Math.min(lv, 5);
        const countdowns = foundry.utils.deepClone(this.actor.system.transformationMeta?.temporaryCountdowns || {});
        const transId = String(activated.id ?? transIndex);
        countdowns[transId] = rounds;
        await this.actor.update({ "system.transformationMeta.temporaryCountdowns": countdowns });
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="font-size:0.85rem; border-left:3px solid #f39c12; padding-left:8px;">
            <b><i class="fas fa-hourglass-half"></i> Temporary — ${activated.name || "Transformation"}</b><br>
            This transformation will expire in <b>${rounds} rounds</b>.
          </div>`
        });
      }
    }

    // --- Exhausting Aspect: apply conditions when leaving transformation ---
    // "Immediately begin suffering from Stress Exhaustion and Impediment until end of next turn.
    //  Exception: if entering a Transformation with a higher Tier of Power Requirement." (transformation-aspects.txt)
    if (field === "active" && !el.checked && wasActive) {
      const deactivated = trans[transIndex];
      const hasExhausting = (deactivated.aspects || []).some(a => /^Exhausting\b/i.test(a.trim()));
      if (hasExhausting) {
        // Check exception: is any OTHER transformation being activated with higher TR?
        const deactivatedTR = parseInt(String(deactivated.tierRequirement || "0").match(/(\d+)/)?.[1] || "0");
        const higherTRActive = trans.some((t, i) => {
          if (i === transIndex || !t.active) return false;
          const tr = parseInt(String(t.tierRequirement || "0").match(/(\d+)/)?.[1] || "0");
          return tr > deactivatedTR;
        });
        if (!higherTRActive) {
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div style="font-size:0.85rem; border-left:3px solid #e74c3c; padding-left:8px;">
              <b><i class="fas fa-tired"></i> Exhausting — ${deactivated.name || "Transformation"}</b><br>
              You suffer <b>Stress Exhaustion</b> and <b>Impediment</b> Combat Conditions until the end of your next turn.
            </div>`
          });
        }
      }
    }
  },

  _buildTransformationEntrySnapshot(transIndex, transformations) {
    const system = this.actor.system;
    const currentLP = system.lifePoints?.value ?? 0;
    const currentKP = system.kiPool?.value ?? 0;
    const currentMaxLP = system.lifePoints?.max ?? 0;
    const currentMaxKP = system.kiPool?.max ?? 0;
    const currentHealthStatus = system.status?.healthStatus || "healthy";
    const thresholdsBelow = system.thresholds?.crossedCount ?? 0;

    return {
      transIndex,
      transId: transformations?.[transIndex]?.id ?? transIndex,
      catalogKey: transformations?.[transIndex]?.catalogKey || "",
      name: transformations?.[transIndex]?.name || "",
      lp: currentLP,
      kp: currentKP,
      maxLP: currentMaxLP,
      maxKP: currentMaxKP,
      healthStatus: currentHealthStatus,
      thresholdsBelow,
      belowBruised: thresholdsBelow >= 1,
      belowInjured: thresholdsBelow >= 2,
      belowCritical: thresholdsBelow >= 3,
      activeTransformationKeysBeforeEntry: (transformations || [])
        .filter((t, idx) => idx !== transIndex && t?.active)
        .map(t => t.catalogKey)
        .filter(Boolean),
      activeTransformationNamesBeforeEntry: (transformations || [])
        .filter((t, idx) => idx !== transIndex && t?.active)
        .map(t => t.name)
        .filter(Boolean),
      timestamp: Date.now()
    };
  },

  _parseTransformationGradeOrStacks(gradeOrStacks) {
    if (!gradeOrStacks) return 1;
    const str = String(gradeOrStacks).trim();
    const slashIdx = str.indexOf("/");
    const num = parseInt(slashIdx >= 0 ? str.substring(0, slashIdx) : str, 10);
    return isNaN(num) || num <= 0 ? 1 : num;
  },

  _getTransformationStageValue(transformation) {
    const key = transformation?.catalogKey || "";
    const stageMap = {
      super_saiyan_1: 1,
      super_saiyan_2: 2,
      super_saiyan_3: 3,
      ascended_super_saiyan: 1,
      future_super_saiyan: 2,
      legendary_super_saiyan_1: 1,
      legendary_super_saiyan_2: 2,
      legendary_super_saiyan_3: 3,
      super_saiyan_god: 4,
      super_saiyan_blue: 5,
      super_saiyan_rose: 5
    };
    return stageMap[key] ?? this._parseTransformationGradeOrStacks(transformation?.gradeOrStacks);
  },

  _findFormTrigger(prefix, catalogKey, predicate) {
    const entriesMap = {
      ep: this.actor.system.enhancementPowerBonuses?.entries || [],
      af: this.actor.system.alternateFormBonuses?.entries || [],
      lf: this.actor.system.legendaryFormBonuses?.entries || []
    };
    const entries = entriesMap[prefix] || [];

    for (const entry of entries) {
      if (entry.catalogKey !== catalogKey) continue;
      for (const trig of (entry.triggered || [])) {
        if (!predicate(trig)) continue;
        return { entry, trigger: trig, trackingId: `${prefix}:${trig.id}` };
      }
    }
    return null;
  },

  _findAnyFormTrigger(catalogKey, predicate, prefixes = ["ep", "af", "lf"]) {
    for (const prefix of prefixes) {
      const match = this._findFormTrigger(prefix, catalogKey, predicate);
      if (match) return { ...match, prefix };
    }
    return null;
  },

  _hasUsedFormTrigger(prefix, catalogKey, predicate) {
    const usage = this.actor.system.combatTabState?.resourceUsage?.encounter || {};
    const match = this._findFormTrigger(prefix, catalogKey, predicate);
    return !!(match && usage[match.trackingId]);
  },

  async _applyTransformationEntryEffects(transformation, entrySnapshot = null) {
    if (!transformation?.active) return;

    const key = transformation.catalogKey || "";
    const updates = {};
    const messages = [];
    const resolvedEffects = this._getResolvedTransformationEffects(transformation);

    const autoLinkedTransforms = [
      { pattern: /enter the power of destruction enhancement power/i, catalogKey: "power_of_destruction", label: "Power of Destruction" },
      { pattern: /enter the autonomous ultra instinct enhancement power/i, catalogKey: "autonomous_ultra_instinct", label: "Autonomous Ultra Instinct" }
    ];
    for (const link of autoLinkedTransforms) {
      const shouldActivate = resolvedEffects.some(eff =>
        eff.activationType === "automatic" && link.pattern.test(String(eff.text || "")));
      if (shouldActivate) {
        const activated = await this._activateTransformationByCatalogKey(link.catalogKey, transformation.name);
        if (activated) {
          messages.push(`<b>${transformation.name}</b>: activated <b>${link.label}</b> automatically`);
        }
      }
    }

    const quarterCapacityTrigger = this._findAnyFormTrigger(key, trig =>
      /regain ki points equal to 1\/4 of your max capacity/i.test(trig.description || ""));
    if (quarterCapacityTrigger) {
      const tracked = await this._trackCombatUsage(
        quarterCapacityTrigger.trackingId,
        quarterCapacityTrigger.trigger.usageLimit,
        quarterCapacityTrigger.trigger.maxUses || 0,
        quarterCapacityTrigger.trigger.name
      );
      if (tracked) {
        const currentKP = this.actor.system.kiPool?.value ?? 0;
        const maxKP = this.actor.system.kiPool?.max ?? 0;
        const kpGain = Math.floor((this.actor.system.capacity?.max ?? 0) / 4);
        updates["system.kiPool.value"] = Math.min(maxKP, currentKP + kpGain);
        messages.push(`<b>${quarterCapacityTrigger.trigger.name}</b>: +${kpGain} KP (1/4 Max Capacity)`);
      }
    }

    const singleBattleBornTrigger = this._findAnyFormTrigger(key, trig =>
      /\bgain a stack of battle born\b/i.test(trig.description || ""));
    if (singleBattleBornTrigger) {
      const tracked = await this._trackCombatUsage(
        singleBattleBornTrigger.trackingId,
        singleBattleBornTrigger.trigger.usageLimit,
        singleBattleBornTrigger.trigger.maxUses || 0,
        singleBattleBornTrigger.trigger.name
      );
      if (tracked) {
        await this._battleBornGrantStack(`${singleBattleBornTrigger.trigger.name} (${transformation.name})`);
        messages.push(`<b>${singleBattleBornTrigger.trigger.name}</b>: +1 Battle Born stack`);
      }
    }

    if (key === "supreme_form") {
      const trigger = this._findFormTrigger("lf", key, trig =>
        /regain life points equal to 1\/2 of your maximum life points prior to entering this transformation/i.test(trig.description || ""));
      if (trigger) {
        const tracked = await this._trackCombatUsage(trigger.trackingId, trigger.trigger.usageLimit, trigger.trigger.maxUses || 0, trigger.trigger.name);
        if (tracked) {
          const maxLPBeforeEntry = entrySnapshot?.maxLP ?? this.actor.system.lifePoints?.max ?? 0;
          const recoveredLP = Math.floor(maxLPBeforeEntry / 2);
          const currentLP = this.actor.system.lifePoints?.value ?? 0;
          const maxLP = this.actor.system.lifePoints?.max ?? 0;
          updates["system.lifePoints.value"] = Math.min(maxLP, currentLP + recoveredLP);
          messages.push(`<b>Supreme Presence</b>: +${recoveredLP} LP`);
        }
      }
    }

    if (key === "power_of_destruction") {
      const trigger = this._findFormTrigger("lf", "destroyer_form", trig =>
        /regain divine ki points equal to triple your power level/i.test(trig.description || ""));
      if (trigger) {
        const tracked = await this._trackCombatUsage(trigger.trackingId, trigger.trigger.usageLimit, trigger.trigger.maxUses || 0, trigger.trigger.name);
        if (tracked) {
          const dkpGain = 3 * (this.actor.system.level || 1);
          const currentDKP = this.actor.system.divineKiPoints?.value ?? 0;
          const maxDKP = this.actor.system.divineKiPoints?.max ?? 0;
          updates["system.divineKiPoints.value"] = Math.min(maxDKP, currentDKP + dkpGain);
          messages.push(`<b>Legendary: Before Creation Comes Destruction</b>: +${dkpGain} DKP`);
        }
      }
    }

    if (key === "superior_super_saiyan") {
      const trigger = this._findFormTrigger("lf", key, trig =>
        /gain a stack of battle born for each health threshold you were below before entering this transformation/i.test(trig.description || ""));
      const stackCount = entrySnapshot?.thresholdsBelow || 0;
      if (trigger && stackCount > 0) {
        const tracked = await this._trackCombatUsage(trigger.trackingId, trigger.trigger.usageLimit, trigger.trigger.maxUses || 0, trigger.trigger.name);
        if (tracked) {
          for (let i = 0; i < stackCount; i++) {
            await this._battleBornGrantStack(`Superior Pain, Superior Power (${transformation.name})`);
          }
          messages.push(`<b>Superior Pain, Superior Power</b>: ${stackCount} Battle Born stack(s) from entry thresholds`);
          if (stackCount >= 2) {
            messages.push("<b>Superior Pain, Superior Power</b>: Enter the Superior State until the end of your next turn");
          }
        }
      }
    }

    const resourceUpdates = await this._applyTransformationResourceEntryEffects(transformation, resolvedEffects, entrySnapshot);
    for (const [path, value] of Object.entries(resourceUpdates.updates || {})) {
      updates[path] = value;
    }
    messages.push(...(resourceUpdates.messages || []));

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }

    if (messages.length > 0) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-exchange-alt"></i> ${transformation.name}</b><br>${messages.join("<br>")}</div>`
      });
    }
  },

  async _applyTransformationResourceEntryEffects(transformation, resolvedEffects, entrySnapshot = null) {
    const resources = foundry.utils.deepClone(this.actor.system.transformationMeta?.specialResources || {});
    const updates = {};
    const messages = [];
    const key = transformation?.catalogKey || "";
    const grade = this._parseTransformationGradeOrStacks(transformation?.gradeOrStacks);
    const stage = this._getTransformationStageValue(transformation);

    const setResource = (resourceKey, value, max = value, label = resourceKey) => {
      resources[resourceKey] = { value, max, source: key, sourceName: transformation?.name || "" };
      messages.push(`<b>${label}</b>: ${value}${max !== value ? ` / ${max}` : ""}`);
    };

    for (const eff of resolvedEffects) {
      const text = String(eff?.text || "");
      const activationType = String(eff?.activationType || "").toLowerCase();
      const isAutomatic = activationType.includes("automatic");
      const isPassive = activationType.includes("passive");
      const isTriggered = activationType.includes("triggered");
      if (!isAutomatic && !isPassive && !isTriggered) continue;

      if (isAutomatic && /gain g stacks of revolving eye/i.test(text)) {
        setResource("revolvingEye", grade, grade, "Revolving Eye");
      } else if (isAutomatic && /gain 4 stacks of draconic force/i.test(text)) {
        const aboveMaxKPBeforeEntry = (entrySnapshot?.kp ?? 0) > (entrySnapshot?.maxKP ?? 0);
        const amount = aboveMaxKPBeforeEntry ? 8 : 4;
        setResource("draconicForce", amount, amount, "Draconic Force");
      } else if (isAutomatic && /gain ssj stacks of golden light/i.test(text)) {
        setResource("goldenLight", stage, stage, "Golden Light");
      } else if (isAutomatic && /gain a stack of darkness \(max\. 3\)/i.test(text)) {
        const tierReqMatch = String(CONFIG.DBU?.transformationsCatalog?.[key]?.tierRequirement || "").match(/(\d+)/);
        const tierReq = tierReqMatch ? Number(tierReqMatch[1]) : (this.actor.system.tier || 1);
        const actorTier = this.actor.system.tier || 1;
        const amount = Math.max(1, 1 + Math.max(0, actorTier - tierReq));
        setResource("darkness", amount, 3, "Darkness");
      } else if (isAutomatic && /gain 1 darkness and set your maximum amount of darkness to 4/i.test(text)) {
        setResource("darkness", 1, 4, "Darkness");
      } else if (isAutomatic && /gain a stack of revolving eye for each talent you possess that has the name/i.test(text)) {
        const talents = this.actor.system.talents || [];
        const talentCatalog = CONFIG.DBU?.talentsCatalog || {};
        let count = 0;
        for (const talentId of talents) {
          const talent = talentCatalog[talentId];
          const name = String(talent?.name || "");
          const prereq = String(talent?.prerequisites || "");
          if (/quick learner/i.test(name) || /quick learner/i.test(prereq)) count += 1;
        }
        if (count > 0) setResource("revolvingEye", count, count, "Revolving Eye");
      } else if (isAutomatic && /gain nature ki equal to 1\/2 of your maximum ki points/i.test(text)) {
        const currentMaxKP = this.actor.system.kiPool?.max ?? 0;
        const baseMaxKP = this.actor.system.transformationRules?.kiMultiplierActive ? Math.floor(currentMaxKP / 2) : currentMaxKP;
        const amount = Math.floor(baseMaxKP / 2);
        setResource("natureKi", amount, amount, "Nature Ki");
      } else if (isAutomatic && /gain an amount of spectral armor points \(sap\) equal to 1\/4 \(rounded up\) of your maximum life points/i.test(text)) {
        const amount = Math.ceil((this.actor.system.lifePoints?.max ?? 0) / 4);
        setResource("spectralArmorPoints", amount, amount, "Spectral Armor Points");
      } else if (isAutomatic && /gain a stack of mask condition for each health threshold you are above/i.test(text)) {
        const thresholdsBelow = entrySnapshot?.thresholdsBelow ?? 0;
        const amount = Math.max(0, 3 - thresholdsBelow);
        setResource("maskCondition", amount, 3, "Mask Condition");
      } else if ((isAutomatic || isPassive) && /for the effects of masked power, you possess a mask condition of 4/i.test(text)) {
        setResource("maskCondition", 4, 4, "Mask Condition");
      } else if (/gain 1 god sphere for every 10 universal power your integrated universe seed possesses/i.test(text)) {
        const universalPower = this.actor.system.universeSeed?.universalPower ?? 0;
        const amount = Math.floor(universalPower / 10);
        if (amount > 0) setResource("godSphere", amount, amount, "God Sphere");
      } else if (isTriggered && /when you enter the monster form transformation, gain 3 plates/i.test(text)) {
        setResource("plates", 3, 3, "Plates");
      } else if (isTriggered && /you begin every combat encounter with 0 stacks of karmic empowerment and z dark ki points/i.test(text)) {
        // Scaling Darkness Lv2: start with Z Dark Ki Points, reset stacks to 0
        const keTrans = (this.actor.system.transformations || []).find(t => t?.active && t.catalogKey === "karmic_empowerment");
        if (keTrans) {
          const keZ = this._parseTransformationGradeOrStacks(keTrans.gradeOrStacks);
          setResource("darkKiPoints", keZ, keZ, "Dark Ki Points");
        }
      }
    }

    if (Object.keys(resources).length > 0) {
      updates["system.transformationMeta.specialResources"] = resources;
    }

    return { updates, messages };
  },

  _collectPersistentTransformationResources(transformations = null) {
    const resources = {};
    const activeTransformations = transformations || this.actor.system.transformations || [];
    const entrySnapshots = this.actor.system.transformationMeta?.entrySnapshots || {};

    for (const trans of activeTransformations) {
      if (!trans?.active) continue;
      const key = trans.catalogKey || "";
      const resolvedEffects = this._getResolvedTransformationEffects(trans, activeTransformations);
      const grade = this._parseTransformationGradeOrStacks(trans?.gradeOrStacks);
      const stage = this._getTransformationStageValue(trans);
      const entrySnapshot = entrySnapshots[String(trans.id ?? "")] || null;

      const setResource = (resourceKey, value, max = value) => {
        resources[resourceKey] = { value, max, source: key, sourceName: trans?.name || "" };
      };

      for (const eff of resolvedEffects) {
        const text = String(eff?.text || "");
        const activationType = String(eff?.activationType || "").toLowerCase();
        const isAutomatic = activationType.includes("automatic");
        const isPassive = activationType.includes("passive");
        const isTriggered = activationType.includes("triggered");
        if (!isAutomatic && !isPassive && !isTriggered) continue;

        if (isAutomatic && /gain g stacks of revolving eye/i.test(text)) {
          setResource("revolvingEye", grade, grade);
        } else if (isAutomatic && /gain 4 stacks of draconic force/i.test(text)) {
          const aboveMaxKPBeforeEntry = (entrySnapshot?.kp ?? 0) > (entrySnapshot?.maxKP ?? 0);
          const amount = aboveMaxKPBeforeEntry ? 8 : 4;
          setResource("draconicForce", amount, amount);
        } else if (isAutomatic && /gain ssj stacks of golden light/i.test(text)) {
          setResource("goldenLight", stage, stage);
        } else if (isAutomatic && /gain a stack of darkness \(max\. 3\)/i.test(text)) {
          const tierReqMatch = String(CONFIG.DBU?.transformationsCatalog?.[key]?.tierRequirement || "").match(/(\d+)/);
          const tierReq = tierReqMatch ? Number(tierReqMatch[1]) : (this.actor.system.tier || 1);
          const actorTier = this.actor.system.tier || 1;
          const amount = Math.max(1, 1 + Math.max(0, actorTier - tierReq));
          setResource("darkness", amount, 3);
        } else if (isAutomatic && /gain 1 darkness and set your maximum amount of darkness to 4/i.test(text)) {
          setResource("darkness", 1, 4);
        } else if (isAutomatic && /gain a stack of revolving eye for each talent you possess that has the name/i.test(text)) {
          const talents = this.actor.system.talents || [];
          const talentCatalog = CONFIG.DBU?.talentsCatalog || {};
          let count = 0;
          for (const talentId of talents) {
            const talent = talentCatalog[talentId];
            const name = String(talent?.name || "");
            const prereq = String(talent?.prerequisites || "");
            if (/quick learner/i.test(name) || /quick learner/i.test(prereq)) count += 1;
          }
          if (count > 0) setResource("revolvingEye", count, count);
        } else if (isAutomatic && /gain nature ki equal to 1\/2 of your maximum ki points/i.test(text)) {
          const currentMaxKP = this.actor.system.kiPool?.max ?? 0;
          const baseMaxKP = this.actor.system.transformationRules?.kiMultiplierActive ? Math.floor(currentMaxKP / 2) : currentMaxKP;
          const amount = Math.floor(baseMaxKP / 2);
          setResource("natureKi", amount, amount);
        } else if (isAutomatic && /gain an amount of spectral armor points \(sap\) equal to 1\/4 \(rounded up\) of your maximum life points/i.test(text)) {
          const amount = Math.ceil((this.actor.system.lifePoints?.max ?? 0) / 4);
          setResource("spectralArmorPoints", amount, amount);
        } else if (isAutomatic && /gain a stack of mask condition for each health threshold you are above/i.test(text)) {
          const thresholdsBelow = entrySnapshot?.thresholdsBelow ?? 0;
          const amount = Math.max(0, 3 - thresholdsBelow);
          setResource("maskCondition", amount, 3);
        } else if ((isAutomatic || isPassive) && /for the effects of masked power, you possess a mask condition of 4/i.test(text)) {
          setResource("maskCondition", 4, 4);
        } else if (/gain 1 god sphere for every 10 universal power your integrated universe seed possesses/i.test(text)) {
          const universalPower = this.actor.system.universeSeed?.universalPower ?? 0;
          const amount = Math.floor(universalPower / 10);
          if (amount > 0) setResource("godSphere", amount, amount);
        } else if (isTriggered && /when you enter the monster form transformation, gain 3 plates/i.test(text)) {
          setResource("plates", 3, 3);
        } else if (isTriggered && /you begin every combat encounter with 0 stacks of karmic empowerment and z dark ki points/i.test(text)) {
          const keZ = this._parseTransformationGradeOrStacks(trans?.gradeOrStacks);
          setResource("darkKiPoints", keZ, keZ);
        }
      }
    }

    const activeKeys = new Set(activeTransformations.filter(t => t?.active).map(t => t.catalogKey));
    const currentResources = this.actor.system.transformationMeta?.specialResources || {};
    if ((activeKeys.has("ultra_instinct_sign") || activeKeys.has("ultra_instinct_complete")) && currentResources.instinct) {
      resources.instinct = foundry.utils.deepClone(currentResources.instinct);
    }
    if (activeKeys.has("ultra_ego") && currentResources.ego) {
      resources.ego = foundry.utils.deepClone(currentResources.ego);
    }
    if (activeKeys.has("super_saiyan_god") && currentResources.acclimation) {
      resources.acclimation = foundry.utils.deepClone(currentResources.acclimation);
    }
    const justiceContext = this._getJusticeChargeContext(activeTransformations);
    if (justiceContext.active && currentResources.justiceCharge) {
      resources.justiceCharge = foundry.utils.deepClone(currentResources.justiceCharge);
      resources.justiceCharge.max = Math.max(resources.justiceCharge.max ?? 0, justiceContext.max);
      resources.justiceCharge.value = Math.min(resources.justiceCharge.value ?? 0, resources.justiceCharge.max);
    }
    if (activeKeys.has("god_of_martial_arts") && currentResources.advantagePoints) {
      resources.advantagePoints = foundry.utils.deepClone(currentResources.advantagePoints);
      resources.advantagePoints.max = Math.max(resources.advantagePoints.max ?? 0, 12);
      resources.advantagePoints.value = Math.min(resources.advantagePoints.value ?? 0, resources.advantagePoints.max);
    }
    if (activeKeys.has("karmic_empowerment") && currentResources.darkKiPoints) {
      resources.darkKiPoints = foundry.utils.deepClone(currentResources.darkKiPoints);
    }

    return resources;
  },

  async _syncPersistentTransformationResources(transformations = null) {
    const resources = this._collectPersistentTransformationResources(transformations);
    await this.actor.update({ "system.transformationMeta.specialResources": resources });
  },

  _collectPersistentTransformationFlags(transformations = null) {
    const flags = { universeSeedIntegrated: false };
    const activeTransformations = transformations || this.actor.system.transformations || [];

    for (const trans of activeTransformations) {
      if (!trans?.active) continue;
      const effects = this._getResolvedTransformationEffects(trans, activeTransformations);
      for (const eff of effects) {
        const text = String(eff?.text || "");
        const activationType = String(eff?.activationType || "").toLowerCase();
        if (!activationType.includes("automatic")) continue;
        if (/universe seed becomes integrated until you leave this transformation/i.test(text)) {
          flags.universeSeedIntegrated = true;
        }
      }
    }

    return flags;
  },

  async _syncPersistentTransformationFlags(transformations = null) {
    const flags = this._collectPersistentTransformationFlags(transformations);
    await this.actor.update({
      "system.universeSeed.integrated": !!flags.universeSeedIntegrated
    });
  },

  async _activateTransformationByCatalogKey(catalogKey, sourceName = "") {
    const transformations = foundry.utils.deepClone(this.actor.system.transformations || []);
    const targetIndex = transformations.findIndex(t => t?.catalogKey === catalogKey);
    if (targetIndex < 0) return false;
    if (transformations[targetIndex]?.active) return false;

    transformations[targetIndex].active = true;
    const snapshots = foundry.utils.deepClone(this.actor.system.transformationMeta?.entrySnapshots || {});
    const targetId = String(transformations[targetIndex].id ?? targetIndex);
    const entrySnapshot = this._buildTransformationEntrySnapshot(targetIndex, transformations);
    snapshots[targetId] = entrySnapshot;

    await this.actor.update({
      "system.transformations": transformations,
      "system.transformationMeta.entrySnapshots": snapshots
    });
    await this._syncPersistentTransformationCombatStates(transformations);
    await this._syncPersistentTransformationResources(transformations);
    await this._syncPersistentTransformationFlags(transformations);
    await this._applyTransformationEntryEffects(transformations[targetIndex], entrySnapshot);

    if (sourceName) {
      ui.notifications.info(`${sourceName}: activated ${transformations[targetIndex].name}.`);
    }

    return true;
  },

  _getTransformationOptions(transformation) {
    const transformations = this.actor.system.transformations || [];
    const index = transformations.indexOf(transformation);
    if (index < 0) return {};
    const selections = this.actor.system.transformationOptionSelections || {};
    return selections[String(index)] || selections[index] || {};
  },

  _getResolvedTransformationEffects(transformation, transformationsOverride = null) {
    const transformations = transformationsOverride || this.actor.system.transformations || [];
    const index = transformations.indexOf(transformation);
    const selections = this.actor.system.transformationOptionSelections || {};
    const options = index >= 0 ? (selections[String(index)] || selections[index] || {}) : {};
    const catalog = CONFIG.DBU?.transformationsCatalog || {};
    const catEntry = transformation?.catalogKey ? catalog[transformation.catalogKey] : null;
    const groups = transformation?.structuredTraits?.length ? transformation.structuredTraits : (catEntry?.traitGroups || []);
    const specialGroups = [catEntry?.masteryTrait, catEntry?.legendaryTrait, catEntry?.exceedTrait, catEntry?.burstLimit].filter(Boolean);
    const resolved = [];

    const visitGroup = (group) => {
      for (const eff of (group?.effects || [])) {
        const effectKey = `${group?.name || transformation?.name || "Transformation"}_${eff.level || 0}`;
        if (eff.activationType === "option" && eff.options?.length > 0) {
          const selected = options[effectKey] || eff.options[0]?.name;
          const opt = eff.options.find(o => o.name === selected);
          if (opt) resolved.push({ ...opt, groupName: group?.name || transformation?.name || "Transformation" });
        } else if (eff.activationType === "multi-option" && eff.options?.length > 0) {
          const selectedArr = Array.isArray(options[effectKey]) ? options[effectKey] : [];
          for (const selected of selectedArr) {
            const opt = eff.options.find(o => o.name === selected);
            if (opt) resolved.push({ ...opt, groupName: group?.name || transformation?.name || "Transformation" });
          }
        } else if (eff.activationType === "choice" && eff.options?.length > 0) {
          const parentSelected = options[eff.parentOptionKey || ""] || "";
          const opt = eff.options.find(o => o.name === parentSelected);
          if (opt) resolved.push({ ...opt, groupName: group?.name || transformation?.name || "Transformation" });
        } else {
          resolved.push({ ...eff, groupName: group?.name || transformation?.name || "Transformation" });
        }
      }
    };

    for (const group of groups) visitGroup(group);
    for (const group of specialGroups) {
      for (const sub of (group.subGroups || [group])) visitGroup(sub);
    }

    return resolved;
  },

  _collectPersistentTransformationCombatStates(transformations = null) {
    const states = { raging: false, surging: false, mindful: false, superior: false, undying: false };
    const statePatterns = {
      raging: /\braging state\b/i,
      surging: /\bsurging state\b/i,
      mindful: /\bmindful state\b/i,
      superior: /\bsuperior state\b/i,
      undying: /\bundying state\b/i
    };

    for (const trans of (transformations || this.actor.system.transformations || [])) {
      if (!trans?.active) continue;
      const effects = this._getResolvedTransformationEffects(trans, transformations);
      for (const eff of effects) {
        const text = String(eff?.text || "");
        if (!/enter/i.test(text) || !/until you leave/i.test(text)) continue;
        for (const [stateKey, pattern] of Object.entries(statePatterns)) {
          if (pattern.test(text)) states[stateKey] = true;
        }
      }
    }

    return states;
  },

  async _syncPersistentTransformationCombatStates(transformations = null) {
    const persistentStates = this._collectPersistentTransformationCombatStates(transformations);
    const previousPersistent = this.actor.system.transformationMeta?.persistentCombatStates || {};
    const updates = { "system.transformationMeta.persistentCombatStates": persistentStates };

    for (const stateKey of Object.keys(persistentStates)) {
      if (persistentStates[stateKey]) {
        updates[`system.combatStates.${stateKey}`] = true;
      } else if (previousPersistent[stateKey]) {
        updates[`system.combatStates.${stateKey}`] = false;
      }
    }

    await this.actor.update(updates);
  },

  _getFirstTransformationOption(transformation) {
    const options = this._getTransformationOptions(transformation);
    for (const key of Object.keys(options)) {
      const value = options[key];
      if (value && typeof value === "string" && value !== "none") return value.toLowerCase();
    }
    return "";
  },

  async _applyLegendRealizedBonuses(selectedTrans, tier, baseTier, baseRecovery) {
    const key = selectedTrans.catalogKey;
    const option = this._getFirstTransformationOption(selectedTrans);
    const usedEncounter = this.actor.system.combatTabState?.resourceUsage?.encounter || {};
    const entrySnapshots = this.actor.system.transformationMeta?.entrySnapshots || {};
    const entrySnapshot = entrySnapshots[String(selectedTrans.id ?? "")] || null;
    const result = {
      rollBonus: 0,
      lpBonus: 0,
      kpBonus: 0,
      lpMultiplier: 1,
      kpMultiplier: 1,
      allowOverMaxKP: false,
      bonusLines: []
    };

    const addLpDiceBonus = async (formula, label) => {
      const bonusRoll = new Roll(formula);
      await bonusRoll.evaluate();
      result.lpBonus += bonusRoll.total;
      result.bonusLines.push(`${label}: <b>+${bonusRoll.total}</b> LP`);
    };

    const metamorphosisStage = {
      limited_suppression: 1,
      partial_suppression: 2,
      true_form: 3
    }[key];

    if (metamorphosisStage) {
      await addLpDiceBonus(`${metamorphosisStage * baseTier}d6`, "Transforming Physique");
      if (key === "limited_suppression") {
        result.bonusLines.push("True Terror: AoE Might Clash vs opponents, Shaken on win");
      }
    }

    if (key === "genetic_power" && (option.includes("stroke") || option.includes("arcosian"))) {
      await addLpDiceBonus(`${baseTier}d10`, "Stroke of Death");
    }

    if (key === "monster_form" && option.includes("shedding")) {
      await addLpDiceBonus(`${tier}d6`, "Shedding Transformation");
    }

    if (key === "super_form") {
      if (option.includes("survival")) {
        const lpHalfBonus = Math.floor(baseRecovery / 2);
        result.lpBonus += lpHalfBonus;
        result.bonusLines.push(`Desire Survival: <b>+${lpHalfBonus}</b> LP`);
      }

      const options = this._getTransformationOptions(selectedTrans);
      const awakeningOption = String(
        options.awakening ??
        options.example_of_awakening ??
        options.Awakening ??
        ""
      ).toLowerCase();

      if (awakeningOption.includes("any")) {
        const rollBonus = 4 * baseTier;
        result.rollBonus += rollBonus;
        result.bonusLines.push(`Any Race: <b>+${rollBonus}</b> to Legend Realized roll`);
      }
    }

    if (["empowered", "z_empowered", "super_empowered"].includes(key) &&
      this._hasUsedFormTrigger("lf", key, trig => /double the amount of life and ki points regained/i.test(trig.description || ""))) {
      result.lpMultiplier *= 2;
      result.kpMultiplier *= 2;
      result.bonusLines.push(`${selectedTrans.name}: <b>x2</b> Legend Realized LP/KP`);

      if (usedEncounter["lt:blaze_up"] && entrySnapshot?.belowInjured) {
        const blazeRoll = new Roll(`${tier}d8`);
        await blazeRoll.evaluate();
        result.lpBonus += blazeRoll.total;
        result.kpBonus += blazeRoll.total;
        result.bonusLines.push(`Blaze Up!: <b>+${blazeRoll.total}</b> LP/KP`);
      }
    }

    const isSuperSaiyanLine = /super_saiyan/i.test(key) || /super saiyan/i.test(selectedTrans.name || "");
    if (isSuperSaiyanLine && usedEncounter["lt:golden_warrior"]) {
      result.lpMultiplier *= 2;
      result.kpMultiplier *= 2;
      result.allowOverMaxKP = true;
      result.bonusLines.push("Super Saiyan Style: <b>x2</b> Legend Realized LP/KP, KP may exceed max");
    }

    if (key === "final_form_rider" && (entrySnapshot?.thresholdsBelow || 0) > 0) {
      const riderBonus = entrySnapshot.thresholdsBelow;
      const riderRoll = new Roll(`${riderBonus * tier}d10`);
      await riderRoll.evaluate();
      result.rollBonus += riderRoll.total;
      result.bonusLines.push(`Final Form Rider: <b>+${riderRoll.total}</b> to Legend Realized roll`);
    }

    return result;
  },

  _getJusticeChargeContext(transformations = null) {
    const activeTransformations = transformations || this.actor.system.transformations || [];
    const justiceTransforms = [];
    let max = 3;

    for (const trans of activeTransformations) {
      if (!trans?.active) continue;
      const effects = this._getResolvedTransformationEffects(trans, activeTransformations);
      let hasJusticeCharge = false;

      for (const eff of effects) {
        const text = String(eff?.text || "");
        if (/justice charge/i.test(text)) {
          hasJusticeCharge = true;
        }
        if (/maximum number of justice charges is increased to 5/i.test(text)) {
          max = Math.max(max, 5);
        }
      }

      if (hasJusticeCharge) {
        justiceTransforms.push(trans);
      }
    }

    return { active: justiceTransforms.length > 0, max, transforms: justiceTransforms };
  },

  _getTransformationScalingLevel(transformation, transformations = null) {
    if (!transformation) return 0;
    const activeTransformations = transformations || this.actor.system.transformations || [];
    const aspects = Array.isArray(transformation.aspects) ? transformation.aspects : [];
    let scaling = 0;

    for (const aspect of aspects) {
      const match = String(aspect || "").match(/Scaling\s*\(LV\s*(\d+)\)/i);
      if (match) scaling += Number(match[1]) || 0;
    }

    const effects = this._getResolvedTransformationEffects(transformation, activeTransformations);
    for (const eff of effects) {
      const text = String(eff?.text || "");
      const addMatch = text.match(/gains?(?: an)? additional\s+(\d+)\s+levels? of the scaling aspect/i);
      if (addMatch) scaling += Number(addMatch[1]) || 0;
      const flatMatch = text.match(/gains the scaling\s*\(LV\s*(\d+)\)/i);
      if (flatMatch && scaling === 0) scaling += Number(flatMatch[1]) || 0;
    }

    return scaling;
  },

  _getTransformationGrowthLevel(transformation, transformations = null) {
    if (!transformation) return 0;
    const activeTransformations = transformations || this.actor.system.transformations || [];
    const aspects = Array.isArray(transformation.aspects) ? transformation.aspects : [];
    let growth = 0;

    for (const aspect of aspects) {
      const match = String(aspect || "").match(/Growth\s*\(LV\s*(\d+|\*)\)/i);
      if (match && match[1] !== "*") growth = Math.max(growth, Number(match[1]) || 0);
    }

    const effects = this._getResolvedTransformationEffects(transformation, activeTransformations);
    for (const eff of effects) {
      const text = String(eff?.text || "");
      const flatMatch = text.match(/gains? the growth\s*\(LV\s*(\d+)\)\s*aspect/i);
      if (flatMatch) growth = Math.max(growth, Number(flatMatch[1]) || 0);
    }

    return growth;
  },
};
