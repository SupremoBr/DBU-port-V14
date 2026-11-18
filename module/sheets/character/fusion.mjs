import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: fusion. Methods run with the sheet as this. */
export const fusionMethods = {

  // =============================================================
  // Unification (Unify Maneuver) — special-maneuvers.txt:315
  // =============================================================

  /** Allocate a Secondary's Unify Attribute Points (max 2×their bT, tracked per secondary). */
  async _onUnifyAttrAlloc(event) {
    const el = event.currentTarget;
    const secId = el.dataset.secondaryId;
    const attr = el.dataset.attr;
    if (!secId || !attr) return;
    const snaps = foundry.utils.deepClone(this.actor.system.fusion?.unifySecondaries || {});
    const snap = snaps[secId];
    if (!snap) return;
    const allocMax = 2 * (snap.baseTier || 1);
    const alloc = snap.attrAlloc || {};
    const othersTotal = Object.entries(alloc)
      .reduce((s, [k, v]) => (k === attr ? s : s + (Number(v) || 0)), 0);
    let value = Math.max(0, Number(el.value) || 0);
    if (othersTotal + value > allocMax) {
      value = Math.max(0, allocMax - othersTotal);
      ui.notifications.warn(`Unify: max ${allocMax} Attribute Points from ${snap.name}.`);
    }
    alloc[attr] = value;
    snap.attrAlloc = alloc;
    await this.actor.update({ "system.fusion.unifySecondaries": snaps });
  },

  /** Remove a Secondary Character and all Unify benefits (e.g. Forced Spirit Fission). */
  async _onUnifyUnlink(event) {
    event.preventDefault();
    const secId = event.currentTarget.dataset.secondaryId;
    if (!secId) return;
    const fusion = this.actor.system.fusion || {};
    const snap = (fusion.unifySecondaries || {})[secId];
    const secName = snap?.name || "Secondary Character";
    const ok = await Dialog.confirm({
      title: "Separate Secondary Character",
      content: `<p>Separate <b>${Handlebars.escapeExpression(secName)}</b> (Forced Spirit Fission)? All Unify benefits gained from them (Attribute Points, LP/KP/Capacity, Stress) are removed.</p>`
    });
    if (!ok) return;
    const ids = (fusion.secondaryCharacterIds || []).filter(id => id !== secId);
    await this.actor.update({
      "system.fusion.secondaryCharacterIds": ids,
      [`system.fusion.unifySecondaries.-=${secId}`]: null
    });
    ChatMessage.create({
      content: `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-user-minus"></i> ${this.actor.name} — Separated</div>
        <div class="dbu-attack-buffs"><b>${Handlebars.escapeExpression(secName)}</b> exists again as an individual character. All Unify benefits from them removed.</div>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
  },

  /** Grant/update the racial Manifested Power earned through the Unify Maneuver. */
  async _onUnifyGrantMP(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.mpKey;
    const stacks = Math.max(1, Number(event.currentTarget.dataset.stacks) || 1);
    const entry = (CONFIG.DBU?.transformationsCatalog || {})[key];
    if (!entry) return;
    const maxStacks = entry.maxStacks || 1;
    const newStacks = Math.min(maxStacks, stacks);
    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    const existing = trans.find(t => t.catalogKey === key);
    if (existing) {
      existing.gradeOrStacks = `${newStacks}/${maxStacks}`;
      await this.actor.update({ "system.transformations": trans });
      ui.notifications.info(`${entry.name}: stacks updated to ${newStacks}/${maxStacks}.`);
      return;
    }
    const nextId = trans.length > 0 ? Math.max(...trans.map(t => t.id || 0)) + 1 : 1;
    trans.push({
      id: nextId,
      catalogKey: key,
      name: entry.name,
      active: false,
      gradeOrStacks: `${newStacks}/${maxStacks}`,
      tierRequirement: entry.tierRequirement || "",
      mastered: false,
      stressTest: typeof entry.stressTest === "number" ? entry.stressTest : 0,
      transformationType: entry.category || "manifested_power",
      attrBonuses: { ...(entry.attrBonuses || {}) },
      aspects: [...(entry.aspects || [])],
      structuredTraits: JSON.parse(JSON.stringify(entry.traitGroups || [])),
      traits: "",
      isLegendary: false
    });
    await this.actor.update({ "system.transformations": trans });
    ChatMessage.create({
      content: `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-dna"></i> ${this.actor.name} — ${entry.name}</div>
        <div class="dbu-attack-buffs">Gained the <b>${entry.name}</b> Manifested Power (${newStacks}/${maxStacks} stack${maxStacks > 1 ? "s" : ""}) through the Unify Maneuver.</div>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
  },

  // -------------------------------------------------------
  // Fusion Data Prep
  // -------------------------------------------------------

  _prepareFusionData(context, system) {
    const fusion = system.fusion || {};
    const cfg = CONFIG.DBU || {};

    // Type flags
    context.fusionIsRegular = fusion.isFusion && fusion.type === "regular";
    context.fusionIsOneSided = fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession");
    context.fusionIsFission = fusion.isFusion && fusion.type === "fission";
    context.fusionIsUnification = fusion.isFusion && fusion.type === "unification";
    context.fusionLinkedListHidden = context.fusionIsOneSided || context.fusionIsUnification;
    context.fusionIsTemporary = false;

    // Fusion method options
    const methods = cfg.fusionMethods || {};
    context.fusionMethodOptions = Object.values(methods).map(m => ({
      ...m, selected: fusion.method === m.id
    }));

    // Active method data
    context.fusionMethodData = methods[fusion.method] || null;
    if (context.fusionMethodData) {
      context.fusionIsTemporary = context.fusionMethodData.fusionType === "temporary";
    }
    context.fusionIsMetamorese = fusion.method === "metamorese";

    // Resolve linked actors
    const linkedIds = fusion.type === "fission"
      ? [fusion.originCharacterId, fusion.linkedSplitId].filter(Boolean)
      : (fusion.fusedCharacterIds || []);
    context.fusionLinkedActors = linkedIds.map(id => {
      const actor = game.actors?.get(id);
      if (!actor) return null;
      const s = actor.system || {};
      return {
        id: actor.id,
        name: actor.name,
        img: actor.img || "icons/svg/mystery-man.svg",
        level: s.level || 1,
        race: s.race || "",
        ag: s.attributes?.ag?.totalScore ?? s.attributes?.ag?.score ?? 0,
        fo: s.attributes?.fo?.totalScore ?? s.attributes?.fo?.score ?? 0,
        te: s.attributes?.te?.totalScore ?? s.attributes?.te?.score ?? 0,
        sc: s.attributes?.sc?.totalScore ?? s.attributes?.sc?.score ?? 0,
        in: s.attributes?.in?.totalScore ?? s.attributes?.in?.score ?? 0,
        ma: s.attributes?.ma?.totalScore ?? s.attributes?.ma?.score ?? 0,
        pe: s.attributes?.pe?.totalScore ?? s.attributes?.pe?.score ?? 0
      };
    }).filter(Boolean);

    // Attribute comparison for regular fusion
    if (context.fusionIsRegular && context.fusionLinkedActors.length) {
      const attrKeys = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
      const labels = { ag: "Agility", fo: "Force", te: "Tenacity", sc: "Scholarship", in: "Insight", ma: "Magic", pe: "Personality" };
      context.fusionAttrComparison = attrKeys.map(key => {
        const values = context.fusionLinkedActors.map(a => a[key]);
        const maxVal = Math.max(...values);
        return {
          label: labels[key],
          values: context.fusionLinkedActors.map(a => ({
            score: a[key],
            isHighest: a[key] === maxVal
          })),
          fusionValue: maxVal
        };
      });

      // Derived fusion stats — must match _onRecalculateFusion formula
      const highestPL = Math.max(...context.fusionLinkedActors.map(a => a.level));
      const previewMethod = (CONFIG.DBU?.fusionMethods || {})[fusion.method];
      const previewIsTemp = previewMethod?.fusionType === "temporary";
      const previewPLBonus = previewIsTemp ? 5 : 2;
      context.fusionPowerLevel = Math.min(30, highestPL + previewPLBonus);
      const fusionTier = Math.min(7, this._tierFromLevel(context.fusionPowerLevel));
      context.fusionTier = fusionTier;
      const fusionBT = fusionTier;  // baseTier = tier from PL
      context.fusionLP = "Calculated from PL";
      context.fusionKP = "Calculated from PL";
      context.fusionCapacity = "Calculated from PL";
      context.fusionBonusTP = fusion.hasFusedTechnique ? (10 * fusionBT) : (10 * fusionBT + 20);
    }

    // ---- Unification (Unify Maneuver) context ----
    if (context.fusionIsUnification) {
      const attrKeysU = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
      const secs = this.actor.constructor.getUnificationSecondaries(system);
      context.unifySecondaries = secs.map(sec => {
        const allocMax = 2 * (sec.baseTier || 1);
        const alloc = sec.attrAlloc || {};
        const allocated = attrKeysU.reduce((s, k) => s + (Number(alloc[k]) || 0), 0);
        return {
          ...sec, allocMax, allocated,
          remaining: allocMax - allocated,
          over: allocated > allocMax,
          attrs: attrKeysU.map(k => ({ key: k, label: k.toUpperCase(), value: Number(alloc[k]) || 0 })),
          actorExists: !!game.actors?.get(sec.id)
        };
      });
      context.unifyCount = secs.length;

      // Racial Manifested Power hooks (unification.txt: Racial Differences)
      const catalogT = cfg.transformationsCatalog || {};
      const bTU = system.baseTier || 1;
      const buildHook = (key, stacks, reason) => {
        const entry = catalogT[key];
        if (!entry) return null;
        const reqNum = parseInt(entry.tierRequirement) || 1;
        const owned = (system.transformations || []).find(t => t.catalogKey === key);
        const maxStacks = entry.maxStacks || 1;
        return {
          key, name: entry.name, stacks: Math.min(stacks, maxStacks), maxStacks,
          tierReq: entry.tierRequirement || "1+",
          eligible: bTU >= reqNum,
          ownedStacks: owned ? (owned.gradeOrStacks || "") : null,
          reason
        };
      };
      context.unifyMPHook = null;
      if (secs.length > 0 && system.race === "namekian") {
        context.unifyMPHook = buildHook("super_namekian", secs.length, `${secs.length} Secondary Character(s)`);
      } else if (secs.length > 0 && system.race === "android") {
        context.unifyMPHook = buildHook("super_android", secs.length, `${secs.length} Secondary Character(s)`);
      } else if (system.race === "majin" && fusion.recombinedAfterFission) {
        context.unifyMPHook = buildHook("super_majin", 1, "Recombined after Fission");
      }
      context.unifyIsMajin = system.race === "majin";
      context.unifyIsShadowDragon = system.race === "shadowDragon";
      if (context.unifyIsShadowDragon && secs.length > 0) {
        const sdSecs = secs.filter(s => s.race === "shadowDragon").length;
        if (sdSecs > 0) context.unifyOmegaHook = buildHook("omega", sdSecs, `${sdSecs} Shadow Dragon Secondary Character(s)`);
      }
    }

    // Available racial traits from fused characters
    if (context.fusionIsRegular) {
      const selectedTraitIds = new Set(fusion.selectedRacialTraitIds || []);
      const allTraits = [];
      const traitCatalog = cfg.racialTraitsCatalog || {};
      for (const linkedActor of context.fusionLinkedActors) {
        const actorObj = game.actors?.get(linkedActor.id);
        if (!actorObj) continue;
        const actorTraitIds = actorObj.system?.racialTraits || [];
        for (const traitId of actorTraitIds) {
          // Find this trait in the catalog
          for (const [race, traits] of Object.entries(traitCatalog)) {
            const trait = traits.find(t => t.id === traitId);
            if (trait && !allTraits.find(t => t.id === traitId)) {
              allTraits.push({
                id: trait.id,
                name: trait.name,
                race: race,
                category: trait.traitCategory || "secondary",
                categoryLabel: (trait.traitCategory || "secondary").charAt(0).toUpperCase() + (trait.traitCategory || "secondary").slice(1),
                selected: selectedTraitIds.has(trait.id)
              });
            }
          }
        }
      }
      context.fusionAvailableTraits = allTraits;
      context.fusionSelectedTraitCount = allTraits.filter(t => t.selected).length;
    } else {
      context.fusionAvailableTraits = [];
      context.fusionSelectedTraitCount = 0;
    }

    // +1(bT) Boost Attribute selection (A2: choose 3 attrs for +1(bT) boost)
    if (context.fusionIsRegular) {
      const boostAttrs = new Set(fusion.fusionBoostAttrs || []);
      const attrOpts = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
      const attrLabels2 = { ag: "Agility", fo: "Force", te: "Tenacity", sc: "Scholarship", in: "Insight", ma: "Magic", pe: "Personality" };
      context.fusionBoostAttrOptions = attrOpts.map(k => ({
        key: k, label: attrLabels2[k], selected: boostAttrs.has(k)
      }));
      context.fusionBoostAttrCount = boostAttrs.size;
      // Fusion-derived bonuses for display
      const f = system.fusion || {};
      context.fusionSameRaceBonus = f._sameRaceBonus || 0;
      context.fusionBreakthrough = f._fusionBreakthrough || false;
      context.fusionMissingTraitBonus = f._lastingMissingTraitBonus || 0;
      context.fusionMatchRaceBonus = f._lastingMatchRaceBonus || 0;
      context.fusionPLOverflow = f.plOverflow || 0;
      context.fusionRLM = f._fusionRLM || null;
      context.fusionAllProfSaves = f._fusionProficientSaves || [];

      // +2 Bonus Talents selection (fusion.txt line 19: Character Combination grants +2 talents)
      const bonusTalentIds = new Set(fusion.fusionBonusTalents || []);
      const talentCat = cfg.talentsCatalog || [];
      const existingTalentIds = new Set(system.talents || []);
      context.fusionBonusTalentOptions = talentCat
        .filter(t => !existingTalentIds.has(t.id) || bonusTalentIds.has(t.id))
        .sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name))
        .map(t => ({
          id: t.id,
          name: t.name,
          category: t.category || "Other",
          selected: bonusTalentIds.has(t.id)
        }));
      context.fusionBonusTalentCount = bonusTalentIds.size;
    }

    // Size options
    const sizeOrder = ["tiny", "small", "medium", "large", "huge", "gigantic", "colossal"];
    const sizeLabels = { tiny: "Tiny", small: "Small", medium: "Medium", large: "Large", huge: "Huge", gigantic: "Gigantic", colossal: "Colossal" };
    if (context.fusionIsRegular && context.fusionLinkedActors.length) {
      const sizes = context.fusionLinkedActors.map(a => {
        const actor = game.actors?.get(a.id);
        return actor?.system?.baseSize || actor?.system?.status?.currentSize || "medium";
      });
      const minIdx = Math.min(...sizes.map(s => sizeOrder.indexOf(s)).filter(i => i >= 0));
      const maxIdx = Math.max(...sizes.map(s => sizeOrder.indexOf(s)).filter(i => i >= 0));
      context.fusionSizeOptions = sizeOrder.slice(minIdx, maxIdx + 1).map(s => ({
        value: s, label: sizeLabels[s] || s, selected: fusion.chosenSize === s
      }));
    } else {
      context.fusionSizeOptions = sizeOrder.map(s => ({
        value: s, label: sizeLabels[s] || s, selected: fusion.chosenSize === s
      }));
    }

    // Fusion modifier options
    const modifiers = cfg.fusionModifiers || {};
    const selectedMods = new Set(fusion.modifiers || []);
    const isTemp = context.fusionIsTemporary;
    context.fusionModifierLimit = isTemp ? "Up to 2 for Temporary" : "Up to 1 for Lasting";
    context.fusionModifierOptions = Object.values(modifiers).map(m => ({
      ...m, selected: selectedMods.has(m.id)
    }));
    context.fusionSelectedModifiers = (fusion.modifiers || [])
      .map(id => modifiers[id])
      .filter(Boolean);

    // One-Sided Fusion: suppressed actors with per-attribute bonuses
    if (context.fusionIsOneSided) {
      const suppIds = fusion.suppressedCharacterIds || fusion.fusedCharacterIds || [];
      const deeplySet = new Set(fusion.deeplySuppressed || []);
      const strugglingObj = fusion.strugglingStacks || {};
      const attrKeys = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
      const attrLabels = { ag: "AG", fo: "FO", te: "TE", sc: "SC", in: "IN", ma: "MA", pe: "PE" };
      const isAbsorption = fusion.type === "one-sided-absorption";
      const isPossession = fusion.type === "one-sided-possession";

      // Read applied bonuses from actor.mjs derived data
      const appliedBonuses = fusion._appliedAttrBonuses || {};

      context.fusionSuppressedActors = suppIds.map(id => {
        const actor = game.actors?.get(id);
        if (!actor) return null;
        const s = actor.system || {};
        const stacks = strugglingObj[id] || 0;
        const cogSaveBonus = Math.floor(stacks / 3) * (system.tier || 1);

        // Per-attr scores from this suppressed character
        const perAttr = attrKeys.map(k => {
          const score = s.attributes?.[k]?.totalScore ?? s.attributes?.[k]?.score ?? 0;
          const bonus = Math.ceil(score / 4);
          return { key: k, label: attrLabels[k], score, bonus };
        });

        // Absorption/Possession: list suppressed actor's abilities for reference
        const abilities = {};
        if (isAbsorption || isPossession) {
          abilities.uniqueAbilities = (s.uniqueAbilities || []).map(u => u.name || u.abilityKey || "Unknown");
          abilities.auras = (s.signatureAuras || []).map(a => a.name || "Unknown");
          abilities.techniques = (s.signatureTechniques || []).map(t => t.name || "Unknown");
          abilities.transformations = (s.transformations || []).filter(t => t.name).map(t => t.name);
          // Secondary racial traits for the trait picker
          const traitCatalog3 = cfg.racialTraitsCatalog || {};
          const actorTraitIds = s.racialTraits || [];
          const chosenTraits = fusion.absorptionChosenTraits || {};
          const chosenForThis = chosenTraits[id] || "";
          abilities.secondaryTraits = [];
          for (const tId of actorTraitIds) {
            for (const [race, rTraits] of Object.entries(traitCatalog3)) {
              const trait = rTraits.find(t => t.id === tId);
              if (trait && (trait.traitCategory === "secondary")) {
                abilities.secondaryTraits.push({
                  id: trait.id,
                  name: trait.name,
                  race,
                  selected: chosenForThis === trait.id
                });
                break;
              }
            }
          }
        }

        return {
          id: actor.id,
          name: actor.name,
          img: actor.img || "icons/svg/mystery-man.svg",
          level: s.level || 1,
          race: s.race || "",
          perAttr,
          isDeeply: deeplySet.has(id),
          strugglingStacks: stacks,
          cogSaveBonus,
          abilities
        };
      }).filter(Boolean);

      // Possession-specific context
      if (isPossession && suppIds.length > 0) {
        const hostActor = game.actors?.get(suppIds[0]);
        if (hostActor) {
          context.fusionPossessionHost = {
            name: hostActor.name,
            race: hostActor.system?.race || "",
            size: hostActor.system?.baseSize || hostActor.system?.status?.currentSize || "medium",
            hostLP: fusion._hostCurrentLP ?? fusion.hostCurrentLP ?? hostActor.system?.lifePoints?.value ?? 0,
            hostMaxLP: fusion._hostMaxLP ?? hostActor.system?.lifePoints?.max ?? 0
          };
          // Per-attr breakdown: host score + 1/4 own
          context.fusionPossessionAttr = attrKeys.map(k => {
            const data = appliedBonuses[k];
            // AG/FO/TE/MA: object with hostScore/ownBonus/total/mode
            // SC/IN/PE: plain number (standard +ceil(host/4) bonus)
            if (typeof data === "object" && data !== null) {
              return {
                label: attrLabels[k],
                hostScore: data.hostScore ?? 0,
                ownBonus: data.ownBonus ?? 0,
                total: data.total ?? 0,
                isPossessionFull: true
              };
            }
            const bonus = data || 0;
            return {
              label: attrLabels[k],
              hostScore: "—",
              ownBonus: bonus,
              total: `+${bonus}`,
              isPossessionFull: false
            };
          });

          // Neo-Tuffle Parasite: host trait picker
          const liquidFormId = "0dda96aa0a5a229f";
          const ownTraits = system.racialTraits || [];
          if (ownTraits.includes(liquidFormId) || fusion._possessorOriginalRace === "neoTuffle") {
            const hostRace = hostActor.system?.race || "";
            const hostTraitIds = hostActor.system?.racialTraits || [];
            const traitCatalog2 = cfg.racialTraitsCatalog || {};
            const hostTraitOptions = [];
            for (const hId of hostTraitIds) {
              for (const [race, rTraits] of Object.entries(traitCatalog2)) {
                const trait = rTraits.find(t => t.id === hId);
                if (trait) {
                  hostTraitOptions.push({
                    id: trait.id,
                    name: trait.name,
                    category: (trait.traitCategory || "secondary").charAt(0).toUpperCase() + (trait.traitCategory || "secondary").slice(1),
                    selected: fusion.parasiteHostTraitId === trait.id
                  });
                  break;
                }
              }
            }
            context.fusionParasiteHostTraitOptions = hostTraitOptions;
            context.fusionIsParasitePossession = true;
          }

          // Primary Racial Trait Exchange (rules line 56)
          const traitExchange = fusion.possessionTraitExchange || {};
          const traitCatalogPTE = cfg.racialTraitsCatalog || {};
          // Dominant's primary traits
          const ownTraitIdsPTE = fusion._originalRacialTraits || system.racialTraits || [];
          context.possessionOwnPrimaryTraits = [];
          for (const tId of ownTraitIdsPTE) {
            for (const [race, rTraits] of Object.entries(traitCatalogPTE)) {
              const trait = rTraits.find(t => t.id === tId);
              if (trait && trait.traitCategory === "primary") {
                context.possessionOwnPrimaryTraits.push({
                  id: trait.id, name: trait.name, race,
                  selected: traitExchange.givenTraitId === trait.id
                });
                break;
              }
            }
          }
          // Host's primary traits
          const hostTraitIdsPTE = hostActor.system?.racialTraits || [];
          context.possessionHostPrimaryTraits = [];
          for (const hId of hostTraitIdsPTE) {
            for (const [race, rTraits] of Object.entries(traitCatalogPTE)) {
              const trait = rTraits.find(t => t.id === hId);
              if (trait && trait.traitCategory === "primary") {
                context.possessionHostPrimaryTraits.push({
                  id: trait.id, name: trait.name, race,
                  selected: traitExchange.takenTraitId === trait.id
                });
                break;
              }
            }
          }
        }
      }

      // Absorption limit: depends on Insatiable / Pursuit of Perfection / baseTier
      if (isAbsorption) {
        const limit = this.actor._getAbsorptionLimit(system);
        context.fusionAbsorptionLimit = limit;
        context.fusionAbsorptionOverLimit = suppIds.length >= limit;
        context.fusionAbsorptionLimitSource = this.actor._hasInsatiableActive(system) ? "Insatiable"
          : this.actor._hasPursuitOfPerfection(system) ? "Pursuit of Perfection"
          : null;

        // Shared Mutation MP: list suppressed actors that have Mutation (rules line 38)
        const dominantHasMutation = (system.transformations || []).some(t => t.catalogKey === "mutation");
        if (dominantHasMutation) {
          context.fusionMutationOptions = [];
          for (const suppId of suppIds) {
            const suppActorMut = game.actors?.get(suppId);
            if (!suppActorMut) continue;
            const suppTrans = suppActorMut.system?.transformations || [];
            const suppMutIdx = suppTrans.findIndex(t => t.catalogKey === "mutation");
            if (suppMutIdx < 0) continue;
            const suppOptions = suppActorMut.system?.transformationOptionSelections?.[String(suppMutIdx)] || {};
            const traitName = Object.values(suppOptions).find(v => typeof v === "string" && v !== "") || "Unknown";
            context.fusionMutationOptions.push({
              actorId: suppId,
              actorName: suppActorMut.name,
              traitName,
              selected: fusion.chosenMutationSourceId === suppId
            });
          }
        }

        // Majin Absorbed Apparel display (rules line 37)
        if (system.race === "majin") {
          const apparelData = fusion.absorbedApparel || {};
          if (apparelData.itemId) {
            const apparelItem = this.actor.items.get(apparelData.itemId);
            const sourceActor = game.actors?.get(apparelData.sourceActorId);
            context.fusionAbsorbedApparel = {
              itemName: apparelItem?.name || "Unknown Item",
              sourceName: sourceActor?.name || "Unknown",
              itemId: apparelData.itemId
            };
          }
          context.fusionIsMajinAbsorption = true;
        }
      }
    } else {
      context.fusionSuppressedActors = [];
    }

    // Fission
    if (context.fusionIsFission) {
      const fissionTraits = cfg.fissionTraits || {};
      context.fusionFissionTrait = fissionTraits[fusion.splitType] || null;
      // Origin and linked split actors
      if (fusion.originCharacterId) {
        const origin = game.actors?.get(fusion.originCharacterId);
        if (origin) {
          context.fusionOriginActor = {
            id: origin.id, name: origin.name, img: origin.img,
            level: origin.system?.level || 1, race: origin.system?.race || ""
          };
        }
      }
      if (fusion.linkedSplitId) {
        const split = game.actors?.get(fusion.linkedSplitId);
        if (split) {
          context.fusionLinkedSplit = {
            id: split.id, name: split.name, img: split.img,
            splitType: split.system?.fusion?.splitType || ""
          };
        }
      }
    }
  },

  // -------------------------------------------------------
  // Fusion Handlers
  // -------------------------------------------------------

  async _onAddFusedCharacter(event) {
    event.preventDefault();
    const fusion = this.actor.system.fusion || {};
    const currentIds = fusion.type === "fission"
      ? [fusion.originCharacterId, fusion.linkedSplitId].filter(Boolean)
      : [...(fusion.fusedCharacterIds || []), ...(fusion.suppressedCharacterIds || [])];

    // Build actor options excluding self and already-linked
    const selfId = this.actor.id;
    const options = game.actors
      .filter(a => a.type === "character" && a.id !== selfId && !currentIds.includes(a.id))
      .map(a => `<option value="${a.id}">${a.name} (Lv${a.system?.level || 1} ${a.system?.race || ""})</option>`)
      .join("");

    if (!options) {
      ui.notifications.warn("No available character actors to link.");
      return;
    }

    const content = `<form><div class="form-group"><label>Select Character</label><select name="actorId">${options}</select></div></form>`;

    new Dialog({
      title: "Link Fused Character",
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-link"></i>',
          label: "Link",
          callback: async (html) => {
            const actorId = html.find("[name=actorId]").val();
            if (!actorId) return;

            if (fusion.type === "fission") {
              // For fission: set origin or linked split
              if (!fusion.originCharacterId) {
                await this.actor.update({ "system.fusion.originCharacterId": actorId });
              } else {
                await this.actor.update({ "system.fusion.linkedSplitId": actorId });
              }
            } else if (fusion.type === "unification") {
              // Unify Maneuver: snapshot the Secondary Character at unify time —
              // they stop existing as an individual, the actor may be deleted later.
              const secActor = game.actors?.get(actorId);
              if (!secActor) return;
              const secSys = secActor.system || {};
              if (secSys.race !== this.actor.system.race) {
                const proceed = await Dialog.confirm({
                  title: "Unify Maneuver — Race mismatch",
                  content: `<p><b>${secActor.name}</b> (${secSys.race}) is not a member of your Race (${this.actor.system.race}). The Unify Maneuver normally requires a willing member of your Race (exceptions: Reincarnated Power, ARC ruling). Link anyway?</p>`
                });
                if (!proceed) return;
              }
              const ids = [...(fusion.secondaryCharacterIds || [])];
              if (ids.includes(actorId)) return;
              ids.push(actorId);
              const snaps = foundry.utils.deepClone(fusion.unifySecondaries || {});
              snaps[actorId] = {
                name: secActor.name,
                race: secSys.race || "",
                baseTier: secSys.baseTier || 1,
                attrAlloc: {}
              };
              await this.actor.update({
                "system.fusion.secondaryCharacterIds": ids,
                "system.fusion.unifySecondaries": snaps
              });
              ChatMessage.create({
                content: `<div class="dbu-attack-roll">
                  <div class="dbu-attack-title"><i class="fas fa-user-plus"></i> ${this.actor.name} — Unify Maneuver</div>
                  <div class="dbu-attack-meta">
                    <span class="dbu-meta-chip">Secondary: ${Handlebars.escapeExpression(secActor.name)}</span>
                    <span class="dbu-meta-chip">+${2 * (secSys.baseTier || 1)} Attribute Points (bT ${secSys.baseTier || 1})</span>
                    <span class="dbu-meta-chip">+1 PL of LP/KP/Capacity</span>
                    <span class="dbu-meta-chip">Stress +1</span>
                  </div>
                  <div class="dbu-attack-buffs">${Handlebars.escapeExpression(secActor.name)} stops existing as an individual character. Allocate the Attribute Points in the Fusion tab.</div>
                </div>`,
                speaker: ChatMessage.getSpeaker({ actor: this.actor })
              });
            } else if (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession") {
              // Filter out stale IDs (deleted actors) before checking limits
              const rawIds = fusion.suppressedCharacterIds || fusion.fusedCharacterIds || [];
              const suppIds = rawIds.filter(id => game.actors?.has(id));
              // If stale IDs were pruned, update the stored array
              if (suppIds.length < rawIds.length) {
                await this.actor.update({ "system.fusion.suppressedCharacterIds": suppIds });
              }
              // Absorption limit: depends on Insatiable / Pursuit of Perfection / baseTier
              if (fusion.type === "one-sided-absorption") {
                const limit = this.actor._getAbsorptionLimit(this.actor.system);
                if (suppIds.length >= limit) {
                  let reason = `base Tier ${this.actor.system.baseTier || 1}`;
                  if (this.actor._hasInsatiableActive(this.actor.system)) reason = "Insatiable active";
                  else if (this.actor._hasPursuitOfPerfection(this.actor.system)) reason = "Pursuit of Perfection";
                  ui.notifications.warn(`Absorption limit reached: maximum ${limit} absorbed character(s) (${reason}).`);
                  return;
                }
              }
              // Possession limit: exactly 1 host
              if (fusion.type === "one-sided-possession" && suppIds.length >= 1) {
                ui.notifications.warn("Possession only allows one host character.");
                return;
              }
              suppIds.push(actorId);
              const updateData = { "system.fusion.suppressedCharacterIds": suppIds };
              // For Possession: initialize host LP tracking
              if (fusion.type === "one-sided-possession") {
                const hostActor = game.actors?.get(actorId);
                if (hostActor) {
                  updateData["system.fusion.hostCurrentLP"] = hostActor.system.lifePoints?.value ?? hostActor.system.lifePoints?.max ?? 0;
                }
              }
              await this.actor.update(updateData);
              // Majin Absorbed Apparel (rules line 37): offer to copy top layer
              if (fusion.type === "one-sided-absorption" && this.actor.system.race === "majin") {
                const suppActorApp = game.actors?.get(actorId);
                const suppTopId = suppActorApp?.system?.wornApparelSlots?.topLayer;
                const suppTopItem = suppTopId ? suppActorApp.items.get(suppTopId) : null;
                if (suppTopItem) {
                  const existing = this.actor.system.fusion?.absorbedApparel || {};
                  const hasExisting = !!existing.itemId;
                  const confirmMsg = hasExisting
                    ? `Replace current Absorbed Apparel with <b>${suppTopItem.name}</b> from ${suppActorApp.name}?`
                    : `Gain a copy of <b>${suppTopItem.name}</b> from ${suppActorApp.name} as Absorbed Apparel?`;
                  const accept = await Dialog.wait({
                    title: "Majin Absorbed Apparel",
                    content: `<p>${confirmMsg}</p>`,
                    buttons: {
                      yes: { icon: '<i class="fas fa-check"></i>', label: "Yes", callback: () => true },
                      no: { icon: '<i class="fas fa-times"></i>', label: "No", callback: () => false }
                    },
                    default: "yes",
                    close: () => false
                  });
                  if (accept) {
                    // Destroy existing absorbed apparel if any
                    if (hasExisting && this.actor.items.get(existing.itemId)) {
                      await this.actor.deleteEmbeddedDocuments("Item", [existing.itemId]);
                    }
                    // Count current worn apparel layers
                    const slots = this.actor.system.wornApparelSlots || {};
                    const wornCount = [slots.topLayer, slots.middleLayer, slots.bottomLayer].filter(Boolean).length;
                    // If 3 apparel worn, destroy current top layer to make room
                    if (wornCount >= 3 && slots.topLayer) {
                      const oldTop = this.actor.items.get(slots.topLayer);
                      if (oldTop) await this.actor.deleteEmbeddedDocuments("Item", [slots.topLayer]);
                    }
                    // Clone and create new item
                    const itemData = suppTopItem.toObject();
                    delete itemData._id;
                    const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
                    const newId = created[0]?.id || "";
                    // Equip as top layer and track
                    await this.actor.update({
                      "system.wornApparelSlots.topLayer": newId,
                      "system.fusion.absorbedApparel": { itemId: newId, sourceActorId: actorId }
                    });
                    ui.notifications.info(`Gained Absorbed Apparel: ${suppTopItem.name}`);
                  }
                }
              }
              // Mark the suppressed actor so their saving throws can reference the dominant
              const suppActor = game.actors?.get(actorId);
              if (suppActor) {
                await suppActor.update({
                  "system.fusion.isSuppressed": true,
                  "system.fusion.dominantCharacterId": this.actor.id
                });
              }
            } else {
              // Enforce method character limit
              const methodKey = fusion.method || "";
              const methodConfig = CONFIG.DBU?.fusionMethods?.[methodKey];
              const ids = foundry.utils.deepClone(fusion.fusedCharacterIds || []);
              if (methodConfig?.charLimit) {
                // charLimit = how many characters fuse together; fusion actor is the result, not a component
                if (ids.length >= methodConfig.charLimit) {
                  ui.notifications.warn(`${methodConfig.name} allows a maximum of ${methodConfig.charLimit} fused characters. Limit reached.`);
                  return;
                }
              }
              ids.push(actorId);
              await this.actor.update({ "system.fusion.fusedCharacterIds": ids });
            }
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "add"
    }).render(true);
  },

  async _onRemoveFusedCharacter(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    if (!actorId) return;
    const fusion = this.actor.system.fusion || {};

    if (fusion.type === "fission") {
      const updates = {};
      if (fusion.originCharacterId === actorId) updates["system.fusion.originCharacterId"] = "";
      if (fusion.linkedSplitId === actorId) updates["system.fusion.linkedSplitId"] = "";
      await this.actor.update(updates);
    } else if (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession") {
      const suppIds = (fusion.suppressedCharacterIds || fusion.fusedCharacterIds || []).filter(id => id !== actorId);
      const deepIds = (fusion.deeplySuppressed || []).filter(id => id !== actorId);
      const updateData = {
        "system.fusion.suppressedCharacterIds": suppIds,
        "system.fusion.deeplySuppressed": deepIds
      };
      // Clear struggling stacks for removed actor
      const stacks = foundry.utils.deepClone(fusion.strugglingStacks || {});
      if (stacks[actorId]) { delete stacks[actorId]; updateData["system.fusion.strugglingStacks"] = stacks; }
      // Clear host LP tracking for Possession
      if (fusion.type === "one-sided-possession") updateData["system.fusion.hostCurrentLP"] = null;
      await this.actor.update(updateData);
      // Clear suppression state on the removed actor
      const removedActor = game.actors?.get(actorId);
      if (removedActor) {
        await removedActor.update({ "system.fusion.isSuppressed": false, "system.fusion.dominantCharacterId": "" });
      }
    } else {
      const ids = (fusion.fusedCharacterIds || []).filter(id => id !== actorId);
      await this.actor.update({ "system.fusion.fusedCharacterIds": ids });
    }
  },

  async _onRecalculateFusion(event) {
    event.preventDefault();
    const fusion = this.actor.system.fusion || {};
    const ids = fusion.fusedCharacterIds || [];
    if (!ids.length) {
      ui.notifications.warn("No fused characters linked.");
      return;
    }

    const actors = ids.map(id => game.actors?.get(id)).filter(Boolean);
    if (!actors.length) return;

    const attrKeys = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
    const updates = {};
    const method = (CONFIG.DBU?.fusionMethods || {})[fusion.method];
    const isTemporary = method && method.fusionType === "temporary";

    // Step 4: Highest attributes
    for (const key of attrKeys) {
      const highest = Math.max(...actors.map(a => {
        const attr = a.system?.attributes?.[key];
        return attr?.totalScore ?? ((attr?.racial || 0) + (attr?.progression || 0));
      }));
      // Store as racial (since fusion doesn't have progression from leveling)
      updates[`system.attributes.${key}.racial`] = highest;
      updates[`system.attributes.${key}.progression`] = 0;
    }

    // Step 7: Highest skills
    const fusionSkills = {};
    for (const actor of actors) {
      const skills = actor.system?.skills || {};
      for (const [skillKey, skillData] of Object.entries(skills)) {
        const rank = typeof skillData === "object" ? (skillData.rank || 0) : (Number(skillData) || 0);
        if (!fusionSkills[skillKey] || rank > fusionSkills[skillKey].rank) {
          fusionSkills[skillKey] = { rank };
        }
      }
    }
    updates["system.skills"] = fusionSkills;

    // Step 6: Union of talents, transformations, techniques, auras, unique abilities
    const allTalents = new Set();
    const allTransformations = [];
    const allTechniques = [];
    const allAuras = [];
    const allUnique = [];
    for (const actor of actors) {
      const s = actor.system || {};
      for (const t of (s.talents || [])) allTalents.add(t);
      for (const t of (s.transformations || [])) {
        if (!allTransformations.find(x => x.name === t.name)) allTransformations.push(foundry.utils.deepClone(t));
      }
      for (const t of (s.signatureTechniques || [])) {
        if (!allTechniques.find(x => x.name === t.name)) allTechniques.push(foundry.utils.deepClone(t));
      }
      for (const a of (s.signatureAuras || [])) {
        if (!allAuras.find(x => x.name === a.name)) allAuras.push(foundry.utils.deepClone(a));
      }
      for (const u of (s.uniqueAbilities || [])) {
        if (!allUnique.find(x => x.abilityKey === u.abilityKey)) allUnique.push(foundry.utils.deepClone(u));
      }
    }
    // Include fusion bonus talents (+2 from Character Combination, fusion.txt line 19)
    for (const bt of (fusion.fusionBonusTalents || [])) allTalents.add(bt);
    updates["system.talents"] = [...allTalents];
    updates["system.transformations"] = allTransformations;
    updates["system.signatureTechniques"] = allTechniques;
    updates["system.signatureAuras"] = allAuras;
    updates["system.uniqueAbilities"] = allUnique;

    // Step 2: Races — use the first fused character's race as primary
    const races = [...new Set(actors.map(a => a.system?.race).filter(Boolean))];
    if (races.length) updates["system.race"] = races.join(" / ");

    // Sync selectedRacialTraitIds → system.racialTraits for racial automation
    // Temporary: all traits from fused chars. Lasting: user-selected (max 7).
    const selectedTraitIds = fusion.selectedRacialTraitIds || [];
    if (isTemporary) {
      // Auto-select all racial traits from fused characters
      const allTraitIds = [];
      for (const actor of actors) {
        for (const tId of (actor.system?.racialTraits || [])) {
          if (!allTraitIds.includes(tId)) allTraitIds.push(tId);
        }
      }
      updates["system.racialTraits"] = allTraitIds;
      updates["system.fusion.selectedRacialTraitIds"] = allTraitIds;
    } else {
      updates["system.racialTraits"] = selectedTraitIds;
    }

    // Step 8: Fusion Power Level (fusion.txt:16 — base PL is highest +2)
    const highestPL = Math.max(...actors.map(a => a.system?.level || 1));
    // Temporary fusions gain +3 extra PL (fusion.txt:62 — total +5)
    const plBonus = isTemporary ? 5 : 2;
    const rawPL = highestPL + plBonus;
    const fusionPL = Math.min(30, rawPL);
    // A17: PL overflow beyond 30 → +1 to all Attribute Modifiers per PL above 30
    const plOverflow = Math.max(0, rawPL - 30);
    updates["system.level"] = fusionPL;
    updates["system.fusion.plOverflow"] = plOverflow;

    // Step 9: Bonus TP (fusion.txt:17 = 10(bT); fusion.txt:28 = forgo for +20 flat extra)
    const fusionTier = this._tierFromLevel(fusionPL);
    const fusionBT = fusionTier;
    updates["system.fusion.bonusTP"] = fusion.hasFusedTechnique ? (10 * fusionBT) : (10 * fusionBT + 20);

    // Set round limit from method
    if (isTemporary) {
      updates["system.fusion.roundLimit"] = method.roundLimit;
      updates["system.fusion.maxRoundLimit"] = method.roundLimit;
    }

    // F1/F2: Initialize LP to max and Ki with penalty for low-Ki fused characters
    // Ki: count fused chars below 1/2 Ki for penalty
    let kiPenaltyCount = 0;
    for (const a of actors) {
      const aKi = a.system?.kiPool?.value ?? 0;
      const aKiMax = a.system?.kiPool?.max ?? 1;
      if (aKi < aKiMax / 2) kiPenaltyCount++;
    }

    await this.actor.update(updates);

    // After update, prepareDerivedData has recalculated max LP/KP — now set current to max
    const newLPMax = this.actor.system.lifePoints?.max || 100;
    const newKiMax = this.actor.system.kiPool?.max || 50;
    const kiPenalty = kiPenaltyCount > 0 ? Math.floor(newKiMax / 4) * kiPenaltyCount : 0;
    await this.actor.update({
      "system.lifePoints.value": newLPMax,
      "system.kiPool.value": Math.max(0, newKiMax - kiPenalty)
    });

    ui.notifications.info(`Fusion stats recalculated from ${actors.length} characters. PL: ${fusionPL}${plOverflow > 0 ? ` (+${plOverflow} overflow → attr mods)` : ""}, Tier: ${fusionTier}.`);
  },

  async _onFusionTraitToggle(event) {
    const traitId = event.currentTarget.dataset.traitId;
    const checked = event.currentTarget.checked;
    const current = foundry.utils.deepClone(this.actor.system.fusion?.selectedRacialTraitIds || []);
    if (checked) {
      // Temporary fusions inherit ALL racial traits (no limit). Lasting = max 7.
      const method = (CONFIG.DBU?.fusionMethods || {})[this.actor.system.fusion?.method];
      const isTemp = method?.fusionType === "temporary";
      if (!isTemp && current.length >= 7) {
        ui.notifications.warn("Maximum 7 racial traits allowed for a Lasting Fusion.");
        event.currentTarget.checked = false;
        return;
      }
      if (!current.includes(traitId)) current.push(traitId);
    } else {
      const idx = current.indexOf(traitId);
      if (idx >= 0) current.splice(idx, 1);
    }
    await this.actor.update({ "system.fusion.selectedRacialTraitIds": current });
  },

  async _onFusionBoostAttrToggle(event) {
    const attrKey = event.currentTarget.dataset.attrKey;
    const checked = event.currentTarget.checked;
    const current = foundry.utils.deepClone(this.actor.system.fusion?.fusionBoostAttrs || []);
    if (checked) {
      if (current.length >= 3) {
        ui.notifications.warn("Maximum 3 attributes for +1(bT) boost.");
        event.currentTarget.checked = false;
        return;
      }
      if (!current.includes(attrKey)) current.push(attrKey);
    } else {
      const idx = current.indexOf(attrKey);
      if (idx >= 0) current.splice(idx, 1);
    }
    await this.actor.update({ "system.fusion.fusionBoostAttrs": current });
  },

  async _onFusionBonusTalentToggle(event) {
    const talentId = event.currentTarget.dataset.talentId;
    const checked = event.currentTarget.checked;
    const current = foundry.utils.deepClone(this.actor.system.fusion?.fusionBonusTalents || []);
    if (checked) {
      if (current.length >= 2) {
        ui.notifications.warn("Maximum 2 bonus talents from Character Combination.");
        event.currentTarget.checked = false;
        return;
      }
      if (!current.includes(talentId)) current.push(talentId);
    } else {
      const idx = current.indexOf(talentId);
      if (idx >= 0) current.splice(idx, 1);
    }
    await this.actor.update({ "system.fusion.fusionBonusTalents": current });
  },

  async _onAbsorptionTraitSelect(event) {
    const actorId = event.currentTarget.dataset.actorId;
    const traitId = event.currentTarget.value;
    const current = foundry.utils.deepClone(this.actor.system.fusion?.absorptionChosenTraits || {});
    if (traitId) {
      current[actorId] = traitId;
    } else {
      delete current[actorId];
    }
    await this.actor.update({ "system.fusion.absorptionChosenTraits": current });
  },

  async _onPossessionTraitExchange(event) {
    const el = event.currentTarget;
    const field = el.classList.contains("possession-trait-give") ? "givenTraitId" : "takenTraitId";
    const value = el.value;
    await this.actor.update({ [`system.fusion.possessionTraitExchange.${field}`]: value });
  },

  async _onMutationSourceSelect(event) {
    const value = event.currentTarget.value;
    await this.actor.update({ "system.fusion.chosenMutationSourceId": value });
  },

  async _onDestroyAbsorbedApparel(event) {
    if (event.preventDefault) event.preventDefault();
    const apparel = this.actor.system.fusion?.absorbedApparel || {};
    if (!apparel.itemId) return;
    const slots = this.actor.system.wornApparelSlots || {};
    const updateData = {
      "system.fusion.absorbedApparel": { itemId: "", sourceActorId: "" }
    };
    if (slots.topLayer === apparel.itemId) {
      updateData["system.wornApparelSlots.topLayer"] = "";
    }
    const itemIdToDelete = apparel.itemId;
    await this.actor.update(updateData);
    const item = this.actor.items.get(itemIdToDelete);
    if (item) await this.actor.deleteEmbeddedDocuments("Item", [itemIdToDelete]);
    ui.notifications.info("Absorbed Apparel destroyed.");
  },

  async _onFusionModifierToggle(event) {
    const modId = event.currentTarget.dataset.modifierId;
    const checked = event.currentTarget.checked;
    const fusion = this.actor.system.fusion || {};
    const current = foundry.utils.deepClone(fusion.modifiers || []);
    const method = (CONFIG.DBU?.fusionMethods || {})[fusion.method];
    const isTemp = method?.fusionType === "temporary";
    const limit = isTemp ? 2 : 1;

    if (checked) {
      if (current.length >= limit) {
        ui.notifications.warn(`Maximum ${limit} modifier(s) for ${isTemp ? "Temporary" : "Lasting"} fusion.`);
        event.currentTarget.checked = false;
        return;
      }
      if (!current.includes(modId)) current.push(modId);
    } else {
      const idx = current.indexOf(modId);
      if (idx >= 0) current.splice(idx, 1);
    }
    await this.actor.update({ "system.fusion.modifiers": current });
  },

  async _onFusionRoundDecrement(event) {
    event.preventDefault();
    const current = this.actor.system.fusion?.roundLimit ?? 0;
    await this.actor.update({ "system.fusion.roundLimit": Math.max(0, current - 1) });
  },

  async _onFusionRoundReset(event) {
    event.preventDefault();
    const max = this.actor.system.fusion?.maxRoundLimit ?? 0;
    await this.actor.update({ "system.fusion.roundLimit": max });
  },

  async _onFusionDeeplySuppressed(event) {
    const actorId = event.currentTarget.dataset.actorId;
    const checked = event.currentTarget.checked;
    const current = foundry.utils.deepClone(this.actor.system.fusion?.deeplySuppressed || []);
    if (checked && !current.includes(actorId)) current.push(actorId);
    else if (!checked) {
      const idx = current.indexOf(actorId);
      if (idx >= 0) current.splice(idx, 1);
    }
    await this.actor.update({ "system.fusion.deeplySuppressed": current });
  },

  async _onFusionStrugglingChange(event) {
    const val = Math.max(0, Number(event.currentTarget.value) || 0);
    const actorId = event.currentTarget.dataset.actorId;
    if (!actorId) return;
    const stacks = foundry.utils.deepClone(this.actor.system.fusion?.strugglingStacks || {});
    stacks[actorId] = val;
    await this.actor.update({ "system.fusion.strugglingStacks": stacks });
  },

  /** Suppressed Character wins the Cognitive Clash and escapes.
   *  Rules (one-sided-fusions.txt line 24): freed from the One-Sided Fusion,
   *  Dominant gains 2 stacks of Fatigued until end of their next turn,
   *  escaped character may use any 1-Standard-Action Maneuver as Out-of-Sequence. */
  async _onEscapeSuppressed(event) {
    event.preventDefault();
    const actorId = event.currentTarget?.dataset?.actorId;
    if (!actorId) return;
    const escapedActor = game.actors?.get(actorId);
    const escapedName = escapedActor?.name || "Character";

    // Eject without Slowed (escape, not voluntary ejection)
    await this._onEjectSuppressed({ currentTarget: { dataset: { actorId } }, skipSlowed: true, silent: true, preventDefault() {} });

    // Apply Fatigued 2 stacks to the Dominant (this actor)
    const conditions = foundry.utils.deepClone(this.actor.system.conditions || []);
    const fatIdx = conditions.findIndex(c => c.id === "fatigued");
    if (fatIdx >= 0) { conditions[fatIdx].active = true; conditions[fatIdx].stacks = 2; }
    else { conditions.push({ id: "fatigued", active: true, stacks: 2 }); }
    await this.actor.update({ "system.conditions": conditions });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="border-left:3px solid #9b59b6; padding:4px 8px;">
        <b><i class="fas fa-running"></i> Escape — ${escapedName}</b><br>
        ${escapedName} wins the Cognitive Clash and is freed from ${this.actor.name}'s One-Sided Fusion!<br>
        <em style="color:#e67e22;">⚠ ${this.actor.name} gains <b>Fatigued (2 stacks)</b> until the end of their next turn.</em><br>
        <em style="color:#2ecc71;">${escapedName} may use any 1-Standard-Action Maneuver as an Out-of-Sequence Maneuver.</em>
      </div>`
    });
    ui.notifications.info(`${escapedName} escaped! ${this.actor.name} is Fatigued (2 stacks).`);
  },

  async _onEjectSuppressed(event) {
    if (event.preventDefault) event.preventDefault();
    const actorId = event.currentTarget?.dataset?.actorId || event.actorId;
    if (!actorId) return;
    const fusion = this.actor.system.fusion || {};
    const suppIds = (fusion.suppressedCharacterIds || []).filter(id => id !== actorId);
    const deepIds = (fusion.deeplySuppressed || []).filter(id => id !== actorId);
    // Clear struggling stacks for the ejected actor
    const stacks = foundry.utils.deepClone(fusion.strugglingStacks || {});
    delete stacks[actorId];
    const updateData = {
      "system.fusion.suppressedCharacterIds": suppIds,
      "system.fusion.deeplySuppressed": deepIds,
      "system.fusion.strugglingStacks": stacks
    };
    // Clear gained aura if it belongs to the ejected actor
    const gainedAuraKey = fusion.activeGainedAuraId || "";
    if (gainedAuraKey && gainedAuraKey.startsWith(actorId + "_")) {
      updateData["system.fusion.activeGainedAuraId"] = "";
    }
    // Clear gained transformations from the ejected actor
    const gainedTransIds = (fusion.activeGainedTransformationIds || []).filter(
      key => !key.startsWith(actorId + "_")
    );
    if (gainedTransIds.length !== (fusion.activeGainedTransformationIds || []).length) {
      updateData["system.fusion.activeGainedTransformationIds"] = gainedTransIds;
    }
    // Possession: clear trait exchange and parasite trait on eject
    if (fusion.type === "one-sided-possession") {
      updateData["system.fusion.possessionTraitExchange"] = { givenTraitId: "", takenTraitId: "" };
      updateData["system.fusion.parasiteHostTraitId"] = "";
    }
    // Absorption: clear mutation source if ejected actor was the chosen source
    if (fusion.chosenMutationSourceId === actorId) {
      updateData["system.fusion.chosenMutationSourceId"] = "";
    }
    // Clean orphaned absorptionChosenTraits entry for ejected actor
    const chosenTraitsClean = foundry.utils.deepClone(fusion.absorptionChosenTraits || {});
    if (chosenTraitsClean[actorId]) {
      delete chosenTraitsClean[actorId];
      updateData["system.fusion.absorptionChosenTraits"] = chosenTraitsClean;
    }
    // Majin Absorbed Apparel: destroy if source is ejected (rules line 37)
    const apparel = fusion.absorbedApparel || {};
    if (apparel.itemId && apparel.sourceActorId === actorId) {
      const currentTopLayer = this.actor.system.wornApparelSlots?.topLayer;
      if (currentTopLayer === apparel.itemId) {
        updateData["system.wornApparelSlots.topLayer"] = "";
      }
      const apparelItem = this.actor.items.get(apparel.itemId);
      if (apparelItem) await this.actor.deleteEmbeddedDocuments("Item", [apparel.itemId]);
      updateData["system.fusion.absorbedApparel"] = { itemId: "", sourceActorId: "" };
      // If other absorbed remain, offer replacement from highest tier
      if (suppIds.length > 0 && this.actor.system.race === "majin") {
        const candidates = [];
        for (const sId of suppIds) {
          const sActor = game.actors?.get(sId);
          if (!sActor) continue;
          const sTopId = sActor.system?.wornApparelSlots?.topLayer;
          const sTopItem = sTopId ? sActor.items.get(sTopId) : null;
          if (sTopItem) {
            candidates.push({ actorId: sId, actorName: sActor.name, item: sTopItem, tier: sActor.system?.tier || 1 });
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.tier - a.tier);
          const best = candidates[0];
          let chosen = best;
          const tied = candidates.filter(c => c.tier === best.tier);
          if (tied.length > 1) {
            const buttons = {};
            for (const c of tied) {
              buttons[c.actorId] = { label: `${c.actorName}: ${c.item.name}`, callback: () => c };
            }
            buttons.none = { label: "None", callback: () => null };
            chosen = await Dialog.wait({
              title: "Replacement Absorbed Apparel",
              content: "<p>Choose replacement Absorbed Apparel from remaining absorbed characters:</p>",
              buttons, default: tied[0].actorId, close: () => null
            });
          } else {
            const accept = await Dialog.wait({
              title: "Replacement Absorbed Apparel",
              content: `<p>Gain <b>${best.item.name}</b> from ${best.actorName} as replacement?</p>`,
              buttons: {
                yes: { label: "Yes", callback: () => best },
                no: { label: "No", callback: () => null }
              },
              default: "yes", close: () => null
            });
            chosen = accept;
          }
          if (chosen) {
            const itemData = chosen.item.toObject();
            delete itemData._id;
            const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
            const newId = created[0]?.id || "";
            updateData["system.wornApparelSlots.topLayer"] = newId;
            updateData["system.fusion.absorbedApparel"] = { itemId: newId, sourceActorId: chosen.actorId };
            ui.notifications.info(`Replacement Absorbed Apparel: ${chosen.item.name}`);
          }
        }
      }
    }
    // Possession: write back accumulated LP damage to the actual host actor, then clear tracking
    if (fusion.type === "one-sided-possession" && fusion.hostCurrentLP != null) {
      const hostActor = game.actors?.get(actorId);
      if (hostActor) {
        const hostMax = hostActor.system.lifePoints?.max ?? 0;
        const writtenLP = Math.min(hostMax, Math.max(0, fusion.hostCurrentLP));
        await hostActor.update({ "system.lifePoints.value": writtenLP });
      }
      updateData["system.fusion.hostCurrentLP"] = null;
    }
    // Clear suppression state on the ejected actor; apply conditions
    const ejected = game.actors?.get(actorId);
    const wasDeep = (fusion.deeplySuppressed || []).includes(actorId);
    if (ejected) {
      const ejectedUpdates = { "system.fusion.isSuppressed": false, "system.fusion.dominantCharacterId": "" };
      const conditions = foundry.utils.deepClone(ejected.system.conditions || []);
      // Slowed only for voluntary Ejection Maneuver (rules line 87), NOT threshold auto-eject (rules line 39)
      if (!event.skipSlowed) {
        const slowIdx = conditions.findIndex(c => c.id === "slowed");
        if (slowIdx >= 0) { conditions[slowIdx].active = true; }
        else { conditions.push({ id: "slowed", active: true, stacks: 0 }); }
      }
      // Deeply Suppressed → Sleeping condition on ejection
      if (wasDeep) {
        const sleepIdx = conditions.findIndex(c => c.id === "sleeping");
        if (sleepIdx >= 0) { conditions[sleepIdx].active = true; }
        else { conditions.push({ id: "sleeping", active: true, stacks: 0 }); }
      }
      ejectedUpdates["system.conditions"] = conditions;
      await ejected.update(ejectedUpdates);
    }
    await this.actor.update(updateData);
    const ejectedName = ejected?.name || "Character";
    // ChatMessage unless caller passes silent=true (e.g., auto-eject creates its own message)
    if (!event.silent) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="border-left:3px solid #e74c3c; padding:4px 8px;">
          <b>Ejection — ${ejectedName}</b><br>
          ${ejectedName} has been ejected from ${this.actor.name}'s One-Sided Fusion.<br>
          <em style="color:#e67e22;">⚠ ${ejectedName} gains the <b>Slowed</b> condition until the end of their next turn.</em>
        </div>`
      });
      ui.notifications.info(`${ejectedName} ejected from One-Sided Fusion. They are Slowed.`);
    }
  },
};
