

/** Character sheet domain: transformation-data. Methods run with the sheet as this. */
export const transformationDataMethods = {

  // -------------------------------------------------------
  // Data Prep: Transformations
  // -------------------------------------------------------

  _prepareTransformationsData(context, system) {
    const transformations = system.transformations || [];
    const config = CONFIG.DBU ?? {};
    const catalog = config.transformationsCatalog || {};

    // Build type name lookup
    const typeMap = {};
    for (const tt of (config.transformationTypes || [])) {
      typeMap[tt.id] = tt.name;
    }

    // Enrich each transformation with catalog data and original index
    const standard = [];
    const legendary = [];
    const active = [];

    transformations.forEach((t, i) => {
      const catEntry = t.catalogKey ? catalog[t.catalogKey] : null;
      const structuredTraits = t.structuredTraits?.length > 0
        ? t.structuredTraits
        : (catEntry?.traitGroups ? JSON.parse(JSON.stringify(catEntry.traitGroups)) : []);
      const effectCount = structuredTraits.reduce((n, g) => n + (g.effects ? g.effects.length : 0), 0);
      // Resolve aspects: prefer stored, fallback to catalog. Mastered rows
      // display the POST-mastery aspect list even while inactive (the
      // actor-side mastery filter only runs for active forms). Metamorphosis
      // rows storing the pre-fix ["Natural","Dedicated"] are stale → catalog.
      const _staleMeta = ["limited_suppression", "partial_suppression", "true_form"].includes(t.catalogKey)
        && Array.isArray(t.aspects) && t.aspects.length === 2
        && t.aspects.includes("Natural") && t.aspects.includes("Dedicated");
      let aspects = (t.aspects && t.aspects.length > 0 && !_staleMeta) ? [...t.aspects] : [...(catEntry?.aspects || [])];
      if (t.mastered && t.catalogKey) {
        const _mCat = (CONFIG.DBU?.masteryEffectsCatalog ?? {})[t.catalogKey];
        if (_mCat?.aspectsToRemove?.length) {
          const _rm = _mCat.aspectsToRemove.map(r => r.toLowerCase());
          aspects = aspects.filter(a => !_rm.some(r => String(a).toLowerCase().includes(r)));
        }
        if (_mCat?.aspectsToAdd?.length) {
          for (const _add of _mCat.aspectsToAdd) {
            if (!aspects.some(a => String(a).toLowerCase().includes(_add.toLowerCase()))) aspects.push(_add);
          }
        }
      }
      const entry = {
        ...t,
        transIndex: i,
        hasCatalog: !!catEntry,
        catEntry,
        effectCount,
        hasStructuredTraits: effectCount > 0,
        typeName: typeMap[t.transformationType] || t.transformationType,
        aspects
      };

      // Add mastery display data
      if (t.mastered && t.catalogKey) {
        const masteryCat = CONFIG.DBU?.masteryEffectsCatalog ?? {};
        const mastery = masteryCat[t.catalogKey];
        if (mastery) {
          entry.masteryData = {
            name: mastery.name,
            attrBonusEntries: Object.entries(mastery.attrBonuses || {}).map(([attr, value]) => ({
              attr: attr.toUpperCase(),
              value
            })),
            aspectsToRemove: mastery.aspectsToRemove || [],
            aspectsToAdd: mastery.aspectsToAdd || [],
            hasAutoEffects: !!(
              Object.keys(mastery.attrBonuses || {}).length ||
              mastery.aspectsToRemove?.length ||
              mastery.aspectsToAdd?.length ||
              mastery.conditionals?.length
            ),
            conditionals: (mastery.conditionals || []).map(c => ({
              ...c,
              active: t.active
            })),
            narrative: mastery.narrative || []
          };
        }
      }

      if (t.isLegendary) legendary.push(entry);
      else standard.push(entry);
      if (t.active) active.push(entry);
    });

    // ---- Gained transformations from suppressed actors (OSF) ----
    const fusion = system.fusion || {};
    const gainedTransFoMaBonuses = []; // track +1(T) FO/MA alternatives
    if (fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession")
        && !this.actor._blockGainedAbilities(system)) {
      const suppIds = fusion.suppressedCharacterIds || [];
      const activeGainedIds = fusion.activeGainedTransformationIds || [];
      const isPossession = fusion.type === "one-sided-possession";
      const dominantRace = isPossession ? (fusion._possessionRace || system.race) : system.race;
      // Collect own transformation keys for dedup
      const ownTransKeys = new Set();
      for (const t of transformations) {
        if (t.catalogKey) ownTransKeys.add(t.catalogKey);
        else if (t.name) ownTransKeys.add(t.name.toLowerCase());
      }
      const gainedTransKeys = new Set(); // dedup across multiple suppressed

      for (const suppId of suppIds) {
        const suppActor = game.actors?.get(suppId);
        if (!suppActor) continue;
        const suppTransformations = suppActor.system?.transformations || [];

        for (const st of suppTransformations) {
          // Dedup key: catalogKey or name
          const dedupKey = st.catalogKey || (st.name || "").toLowerCase();
          if (!dedupKey) continue;

          // Already gained from another suppressed?
          if (gainedTransKeys.has(dedupKey)) continue;

          // Already owned by dominant?
          const alreadyOwned = ownTransKeys.has(dedupKey);

          // Racial eligibility (Possession: always eligible; Absorption: check catalog)
          let raciallyEligible = true;
          if (!isPossession && st.catalogKey) {
            const catEntry = catalog[st.catalogKey];
            if (catEntry) {
              raciallyEligible = this._meetsRacialRequirement(dominantRace, catEntry.racialRequirement);
            }
          }

          if (raciallyEligible && !alreadyOwned) {
            // ELIGIBLE: clone and add as gained
            gainedTransKeys.add(dedupKey);
            const gainedKey = `${suppId}_${st.id}`;
            const isActive = activeGainedIds.includes(gainedKey);
            const catEntry = st.catalogKey ? catalog[st.catalogKey] : null;
            const sTraits = st.structuredTraits?.length > 0
              ? st.structuredTraits
              : (catEntry?.traitGroups ? JSON.parse(JSON.stringify(catEntry.traitGroups)) : []);
            const effectCount = sTraits.reduce((n, g) => n + (g.effects ? g.effects.length : 0), 0);
            let aspects = (st.aspects && st.aspects.length > 0) ? [...st.aspects] : [...(catEntry?.aspects || [])];
            if (st.mastered && st.catalogKey) {
              const _gmCat = (CONFIG.DBU?.masteryEffectsCatalog ?? {})[st.catalogKey];
              if (_gmCat?.aspectsToRemove?.length) {
                const _grm = _gmCat.aspectsToRemove.map(r => r.toLowerCase());
                aspects = aspects.filter(a => !_grm.some(r => String(a).toLowerCase().includes(r)));
              }
              if (_gmCat?.aspectsToAdd?.length) {
                for (const _gadd of _gmCat.aspectsToAdd) {
                  if (!aspects.some(a => String(a).toLowerCase().includes(_gadd.toLowerCase()))) aspects.push(_gadd);
                }
              }
            }

            const gainedEntry = {
              ...foundry.utils.deepClone(st),
              transIndex: -1,
              gainedKey,
              isGained: true,
              gainedFrom: suppActor.name,
              active: isActive,
              hasCatalog: !!catEntry,
              catEntry,
              effectCount,
              hasStructuredTraits: effectCount > 0,
              typeName: typeMap[st.transformationType] || st.transformationType,
              aspects
            };

            // Add mastery display data if mastered
            if (st.mastered && st.catalogKey) {
              const masteryCat = CONFIG.DBU?.masteryEffectsCatalog ?? {};
              const mastery = masteryCat[st.catalogKey];
              if (mastery) {
                gainedEntry.masteryData = {
                  name: mastery.name,
                  attrBonusEntries: Object.entries(mastery.attrBonuses || {}).map(([attr, value]) => ({
                    attr: attr.toUpperCase(), value
                  })),
                  aspectsToRemove: mastery.aspectsToRemove || [],
                  aspectsToAdd: mastery.aspectsToAdd || [],
                  hasAutoEffects: !!(
                    Object.keys(mastery.attrBonuses || {}).length ||
                    mastery.aspectsToRemove?.length ||
                    mastery.aspectsToAdd?.length ||
                    mastery.conditionals?.length
                  ),
                  conditionals: (mastery.conditionals || []).map(c => ({ ...c, active: isActive })),
                  narrative: mastery.narrative || []
                };
              }
            }

            if (st.isLegendary) legendary.push(gainedEntry);
            else standard.push(gainedEntry);
            if (isActive) active.push(gainedEntry);
          } else {
            // NOT ELIGIBLE or ALREADY OWNED: +1(T) FO/MA to first own same-type
            gainedTransKeys.add(dedupKey); // mark as seen for dedup
            gainedTransFoMaBonuses.push({
              fromName: suppActor.name,
              transName: st.name,
              transformationType: st.transformationType
            });
          }
        }
      }
    }

    // Apply +1(T) FO/MA badge indicators to own transformations
    for (const bonus of gainedTransFoMaBonuses) {
      const target = standard.concat(legendary).find(
        t => !t.isGained && t.transformationType === bonus.transformationType
      );
      if (target) {
        if (!target.gainedFoMaBonuses) target.gainedFoMaBonuses = [];
        target.gainedFoMaBonuses.push({ fromName: bonus.fromName, transName: bonus.transName });
      }
    }

    // Unified list: standard first, then legendary
    context.allTransformations = [...standard, ...legendary];
    context.activeTransformations = active;

    // Stress bonus pre-computed by actor.mjs (base + all racial automation + finalizers)
    context.stressBonus = system.aptitudes?.stressBonus || 0;

    // Aspect effects computed by actor.mjs
    context.aspectEffects = system.aspectEffects || {};

    // Transformation rules computed by actor.mjs
    context.transformationRules = system.transformationRules || {};
    context.transformationMeta = system.transformationMeta || {};

    // Mastery effects from actor calculation
    context.masteryEffects = system.masteryEffects || {};

    // Legendary Trait bonuses (permanent, always active)
    context.legendaryTraitBonuses = system.legendaryTraitBonuses || { entries: [], hasBonuses: false, totals: {} };

    // Build legendary trait selection options for forms with multiple choices
    const legendaryTraitOptions = {};
    const ltCatalog = CONFIG.DBU?.transformationsCatalog || {};
    for (const trans of (system.transformations || [])) {
      const catEntry = trans.catalogKey ? ltCatalog[trans.catalogKey] : null;
      if (!catEntry?.legendaryTraitGroup) continue;
      if (Array.isArray(catEntry.legendaryTraitGroup) && catEntry.legendaryTraitGroup.length > 1) {
        legendaryTraitOptions[trans.catalogKey] = {
          name: trans.name,
          options: catEntry.legendaryTraitGroup,
          selected: (system.transformationMeta?.legendaryTraitSelections || {})[trans.catalogKey] || catEntry.legendaryTraitGroup[0]
        };
      }
    }
    context.legendaryTraitOptions = legendaryTraitOptions;

    // Transformation type options
    const transformationTypeOptions = {};
    for (const tt of (config.transformationTypes || [])) {
      transformationTypeOptions[tt.id] = tt.name;
    }
    context.transformationTypeOptions = transformationTypeOptions;

    // Catalog categories for filter
    context.transformationCategories = config.transformationCategories || [];

    // ---- Token Album data ----
    const album = system.tokenAlbum || [];
    const activeAlbumImage = this.actor.getFlag("DBU-MRR-OLD", "activeAlbumImage") || "";
    context.tokenAlbumEntries = album.map((entry, i) => ({
      name: entry.name || "",
      image: entry.image || "",
      isActive: !!(entry.image && entry.image === activeAlbumImage)
    }));
    context.hasActiveAlbumToken = !!activeAlbumImage;
  },

  // -------------------------------------------------------
  // Data Prep: Enhancement Power Bonus Display
  // -------------------------------------------------------

  _prepareEnhancementPowerData(context, system) {
    const epData = system.enhancementPowerBonuses || { entries: [], hasBonuses: false, totals: {} };
    context.enhancementPowerBonuses = epData;
    context.hasEnhancementPowers = epData.hasBonuses && epData.entries.length > 0;
    context.epTriggeredEffects = this._decorateTriggeredEffects(
      (epData.entries || []).flatMap(e =>
        (e.triggered || []).map(t => ({ ...t, sourceName: e.name, catalogKey: e.catalogKey }))
      ),
      system,
      "ep"
    );
    context.epPerRoundEffects = (epData.entries || []).flatMap(e =>
      (e.perRound || []).map(pr => ({ ...pr, sourceName: e.name, catalogKey: e.catalogKey }))
    );

    // Evil Aura panel: shown when transformation is active. Shows EP count and toggle button.
    const evilAuraActive = (system.transformations || []).some(
      t => t.active && t.catalogKey === "evil_aura"
    );
    context.evilAuraActive = evilAuraActive;
    context.evilTechsActive = !!system.transformationMeta?.evilTechsActive;
    context.evilPoints = system.transformationMeta?.evilPoints || 0;
    context.evilAuraTechniqueCost = 2 * (system.baseTier || 1);
  },

  _prepareAlternateFormData(context, system) {
    const afData = system.alternateFormBonuses || { entries: [], hasBonuses: false, totals: {} };
    context.alternateFormBonuses = afData;
    context.hasAlternateForms = afData.hasBonuses && afData.entries.length > 0;
    context.afTriggeredEffects = this._decorateTriggeredEffects(
      (afData.entries || []).flatMap(e =>
        (e.triggered || []).map(t => ({ ...t, sourceName: e.name, catalogKey: e.catalogKey }))
      ),
      system,
      "af"
    );
    context.afPerRoundEffects = (afData.entries || []).flatMap(e =>
      (e.perRound || []).map(pr => ({ ...pr, sourceName: e.name, catalogKey: e.catalogKey }))
    );
  },

  _prepareLegendaryFormData(context, system) {
    const lfData = system.legendaryFormBonuses || { entries: [], hasBonuses: false, totals: {} };
    context.legendaryFormBonuses = lfData;
    context.hasLegendaryForms = lfData.hasBonuses && lfData.entries.length > 0;
    context.lfTriggeredEffects = this._decorateTriggeredEffects(
      (lfData.entries || []).flatMap(e =>
        (e.triggered || []).map(t => ({ ...t, sourceName: e.name, catalogKey: e.catalogKey }))
      ),
      system,
      "lf"
    );
    context.lfPerRoundEffects = (lfData.entries || []).flatMap(e =>
      (e.perRound || []).map(pr => ({ ...pr, sourceName: e.name, catalogKey: e.catalogKey }))
    );
  },

  // -------------------------------------------------------
  // Data Prep: Transformation Customization
  // -------------------------------------------------------

  _prepareTfCustomizationData(context, system) {
    const transformations = system.transformations || [];
    const catalog = CONFIG.DBU?.transformationsCatalog || {};

    // Build enriched transformation list for all sections
    const allTfc = [];
    const enhancements = [];
    const legendaryOptions = [];

    transformations.forEach((t, i) => {
      const catEntry = t.catalogKey ? catalog[t.catalogKey] : null;
      const aspects = (t.aspects && t.aspects.length > 0) ? t.aspects : (catEntry?.aspects || []);
      const bonuses = t.attrBonuses || {};
      const isEnhancement = (t.transformationType || "").startsWith("enhancement");
      const isTranscendent = (catEntry?.aspects || []).some(a =>
        typeof a === "string" && a.toLowerCase().includes("transcendent")
      ) || aspects.some(a => typeof a === "string" && a.toLowerCase().includes("transcendent"));

      const hasPrelude = aspects.some(a => typeof a === "string" && a.trim() === "Prelude");
      const preludeActive = !!t.preludeActive;
      const preludeApplies = hasPrelude && preludeActive;
      // Effective values when Prelude is on: -1 ToP req, -5 ST req
      const effectiveStressTest = preludeApplies
        ? Math.max(0, (t.stressTest || 0) - 5)
        : (t.stressTest || 0);
      const tierRaw = String(t.tierRequirement || "");
      const tierMatch = tierRaw.match(/(\d+)/);
      const effectiveTierRequirement = (preludeApplies && tierMatch)
        ? tierRaw.replace(/(\d+)/, Math.max(0, parseInt(tierMatch[1]) - 1))
        : tierRaw;
      const entry = {
        transIndex: i,
        name: t.name || "(Unnamed)",
        stressTest: t.stressTest || 0,
        tierRequirement: t.tierRequirement || "",
        effectiveStressTest,
        effectiveTierRequirement,
        preludeReducingThis: preludeApplies,
        matchFoMa: t.matchFoMa || false,
        scaleAmb: t.scaleAmb || false,
        powerImprovement: t.powerImprovement || "none",
        isLegendary: t.isLegendary || false,
        isEnhancement,
        isTranscendent,
        mastered: t.mastered || false,
        hasPrelude,
        preludeActive,
        aspects: [...aspects],
        ambAg: bonuses.ag || "",
        ambFo: bonuses.fo || "",
        ambTe: bonuses.te || "",
        ambSc: bonuses.sc || "",
        ambIn: bonuses.in || "",
        ambMa: bonuses.ma || "",
        ambPe: bonuses.pe || ""
      };

      allTfc.push(entry);
      if (isEnhancement) enhancements.push(entry);
      if (t.isLegendary) legendaryOptions.push(entry);
    });

    context.tfcTransformations = allTfc;
    context.tfcEnhancements = enhancements;

    // Limit Shattering data
    const lsData = system.transformationCustomization?.limitShattering || {};
    const lsTransId = lsData.transformationId ?? -1;
    context.tfcLsHasForm = lsTransId >= 0;
    context.tfcLsExceedActive = lsData.exceedActive || false;

    context.tfcLegendaryOptions = legendaryOptions.map(l => ({
      ...l,
      selected: l.transIndex === lsTransId
    }));

    // Exceed traits
    const exceedTraits = [
      { id: "promisedPower", name: "Promised Power" },
      { id: "poweredByFury", name: "Powered by Fury" },
      { id: "clearHeart", name: "Clear Heart" },
      { id: "awokenDivinity", name: "Awoken Divinity" },
      { id: "breakTheLimiter", name: "Break the Limiter" },
      { id: "irreparableBeatdown", name: "Irreparable Beatdown" },
      { id: "godSurpassing", name: "God-Surpassing" },
      { id: "timePowerUnleashed", name: "Time Power Unleashed" },
      { id: "lifeRisking", name: "Life-Risking" },
      { id: "powerOfDemonGod", name: "Power of a Demon God" },
      { id: "enhancedStyle", name: "Enhanced Style" },
      { id: "unnecessaryEvolution", name: "Unnecessary Evolution" },
      { id: "fullyControlledPower", name: "Fully Controlled Power" }
    ];
    const selectedExceed = lsData.exceedTrait || "";
    context.tfcExceedTraits = exceedTraits.map(et => ({
      ...et,
      selected: et.id === selectedExceed
    }));
    context.tfcLsExceedTrait = exceedTraits.find(et => et.id === selectedExceed)?.name || "";

    // Unique Paths data
    const uniquePathEntries = system.transformationCustomization?.uniquePaths || [];
    const uniquePathOptions = [
      { id: "speed", name: "Path of Speed" },
      { id: "might", name: "Path of Might" },
      { id: "wall", name: "Path of the Wall" },
      { id: "heart", name: "Path of the Heart" },
      { id: "mind", name: "Path of the Mind" },
      { id: "control", name: "Path of Control" },
      { id: "unnecessaryEvolution", name: "Unnecessary Evolution" },
      { id: "fullyControlledPower", name: "Fully Controlled Power" },
      { id: "ultimate", name: "Ultimate" },
      { id: "ssjFullPower", name: "Super Saiyan Full Power" },
      { id: "earnedEvolution", name: "Earned Evolution" },
      { id: "trueSsjGod", name: "True Super Saiyan God" },
      { id: "trueUltraInstinct", name: "True Ultra Instinct" }
    ];
    context.tfcUniquePathOptions = uniquePathOptions;

    // Path descriptions
    const pathDescriptions = {
      speed: "AG +1(T). Enhanced Save (Impulsive). Blitz stacks (max 3). Wound/dodge boosts.",
      might: "FO/MA +1(T), Might +1(T). Super Power stacks. Strike boost. Power Flare without Counter.",
      wall: "TE +1(T). Enhanced Save (Corporeal). Steel stacks. Damage reduction, soak boost.",
      heart: "PE +1(T). Enhanced Save (Morale). Heart stacks. Energy Charges, target redirection.",
      mind: "SC +1(T). Enhanced Save (Cognitive). Mind stacks. Energy Charges, target redirection.",
      control: "IN +1(T), FO/MA -1(T). Perfect Ki Control. -1 Stress for Enhancements. Regain Ki on maneuvers.",
      unnecessaryEvolution: "+1 selected AMB. +2 ED on Brutal Assault wounds. Cruelty spending for ED.",
      fullyControlledPower: "+1 selected AMB. Perfect Ki Control. -2(T) Ki cost. Keep Power stacks.",
      ultimate: "+1 selected AMB. Spend Ki for Peak stacks. Use Peak for damage category boost.",
      ssjFullPower: "Synergy with Wrathful. +1 damage category. +3 DR. Double Battle Born on ultimates.",
      earnedEvolution: "+1 selected AMB. Meta Trait. +1 ED/Energy Charge ED. +1/4 wound rolls from defense.",
      trueSsjGod: "+1 selected AMB. Armored aspect. +2 Steadfast. +1(T) DR per Power stack.",
      trueUltraInstinct: "Extra Enhancement Power. Beyond Heat trait in Full Power/Exceed. Lose Draining."
    };

    // Build display rows for unique paths — ensure at least 1 row
    const upRows = uniquePathEntries.length > 0
      ? uniquePathEntries.map(up => ({
          transformationId: up.transformationId ?? -1,
          pathType: up.pathType || "",
          ambAttribute: up.ambAttribute || "",
          pathDescription: pathDescriptions[up.pathType] || ""
        }))
      : [{ transformationId: -1, pathType: "", ambAttribute: "", pathDescription: "" }];

    context.tfcUniquePaths = upRows;

    // Legendary forms available for Unique Paths dropdown
    context.tfcLegendaryForUpDropdown = legendaryOptions;
  },

  // -------------------------------------------------------
  // Transformation Customization Handlers
  // -------------------------------------------------------

  async _onTfcRemoveAspect(event) {
    event.preventDefault();
    const idx = parseInt(event.currentTarget.dataset.transIndex);
    const aspectToRemove = event.currentTarget.dataset.aspect;
    if (isNaN(idx) || !aspectToRemove) return;

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (!trans[idx]) return;

    // If aspects are empty, pull from catalog first
    if (!trans[idx].aspects || trans[idx].aspects.length === 0) {
      const catEntry = trans[idx].catalogKey
        ? (CONFIG.DBU?.transformationsCatalog || {})[trans[idx].catalogKey]
        : null;
      trans[idx].aspects = catEntry?.aspects ? [...catEntry.aspects] : [];
    }

    trans[idx].aspects = trans[idx].aspects.filter(a => a !== aspectToRemove);
    await this.actor.update({ "system.transformations": trans });
  },

  async _onTfcAddAspect(event) {
    event.preventDefault();
    const idx = parseInt(event.currentTarget.dataset.transIndex);
    if (isNaN(idx)) return;

    const input = this.element.find(`.tfc-aspect-input[data-trans-index='${idx}']`);
    const newAspect = input.val()?.trim();
    if (!newAspect) return;

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (!trans[idx]) return;

    // If aspects are empty, pull from catalog first
    if (!trans[idx].aspects || trans[idx].aspects.length === 0) {
      const catEntry = trans[idx].catalogKey
        ? (CONFIG.DBU?.transformationsCatalog || {})[trans[idx].catalogKey]
        : null;
      trans[idx].aspects = catEntry?.aspects ? [...catEntry.aspects] : [];
    }

    trans[idx].aspects.push(newAspect);
    await this.actor.update({ "system.transformations": trans });
  },

  async _onTfcEditAmb(event) {
    const idx = parseInt(event.currentTarget.dataset.transIndex);
    const attr = event.currentTarget.dataset.attr;
    const value = event.currentTarget.value.trim();
    if (isNaN(idx) || !attr) return;

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (!trans[idx]) return;

    if (!trans[idx].attrBonuses) trans[idx].attrBonuses = {};
    trans[idx].attrBonuses[attr] = value;
    await this.actor.update({ "system.transformations": trans });
  },

  async _onTfcSetPowerImprovement(event) {
    const idx = parseInt(event.currentTarget.dataset.transIndex);
    const value = event.currentTarget.value;
    if (isNaN(idx)) return;

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    if (!trans[idx]) return;

    trans[idx].powerImprovement = value;

    // Auto-apply Control effects
    if (value === "control") {
      // Add Strainless if not present
      if (!trans[idx].aspects) trans[idx].aspects = [];
      if (!trans[idx].aspects.includes("Strainless")) {
        trans[idx].aspects.push("Strainless");
      }
      // Reduce stress test by 2
      trans[idx].stressTest = Math.max(0, (trans[idx].stressTest || 0) - 2);
    }

    // Auto-apply Surpass effects
    if (value === "surpass") {
      trans[idx].mastered = true;
    }

    await this.actor.update({ "system.transformations": trans });
  },

  async _onTfcSetLsForm(event) {
    const transId = parseInt(event.currentTarget.value);
    await this.actor.update({
      "system.transformationCustomization.limitShattering.transformationId": transId,
      "system.transformationCustomization.limitShattering.exceedTrait": "",
      "system.transformationCustomization.limitShattering.exceedActive": false
    });
  },

  async _onTfcSetLsExceed(event) {
    await this.actor.update({
      "system.transformationCustomization.limitShattering.exceedTrait": event.currentTarget.value
    });
  },

  async _onTfcToggleExceed(event) {
    await this.actor.update({
      "system.transformationCustomization.limitShattering.exceedActive": event.currentTarget.checked
    });
  },

  async _onTfcSetUpField(event) {
    const upIdx = parseInt(event.currentTarget.dataset.upIndex);
    if (isNaN(upIdx)) return;

    const paths = foundry.utils.deepClone(
      this.actor.system.transformationCustomization?.uniquePaths || []
    );

    // Ensure row exists
    while (paths.length <= upIdx) {
      paths.push({ transformationId: -1, pathType: "", ambAttribute: "" });
    }

    const action = event.currentTarget.dataset.action;
    if (action === "tfc-set-up-form") {
      paths[upIdx].transformationId = parseInt(event.currentTarget.value);
    } else if (action === "tfc-set-up-path") {
      paths[upIdx].pathType = event.currentTarget.value;
    } else if (action === "tfc-set-up-amb") {
      paths[upIdx].ambAttribute = event.currentTarget.value;
    }

    await this.actor.update({
      "system.transformationCustomization.uniquePaths": paths
    });
  },

  async _onTfcAddUp(event) {
    event.preventDefault();
    const paths = foundry.utils.deepClone(
      this.actor.system.transformationCustomization?.uniquePaths || []
    );
    paths.push({ transformationId: -1, pathType: "", ambAttribute: "" });
    await this.actor.update({
      "system.transformationCustomization.uniquePaths": paths
    });
  },

  async _onTfcDeleteUp(event) {
    event.preventDefault();
    const upIdx = parseInt(event.currentTarget.dataset.upIndex);
    if (isNaN(upIdx)) return;

    const paths = foundry.utils.deepClone(
      this.actor.system.transformationCustomization?.uniquePaths || []
    );
    if (upIdx < 0 || upIdx >= paths.length) return;
    paths.splice(upIdx, 1);
    await this.actor.update({
      "system.transformationCustomization.uniquePaths": paths
    });
  },
};
