import { getCatalogById, getRacialCatalogIndex } from "../helpers/catalog-index.mjs";
import { ELEMENTAL_PROFILES_093 } from "../rules/profiles-v093.mjs";

// View data only: keep clones for editable selections; never cache actor state.

export function prepareCharacterTraits(system) {
  const selectedIds = system.racialTraits || [];
  const catalog = CONFIG.DBU?.racialTraitsCatalog || {};
  const optionSelections = system.racialOptionSelections || {};
  const results = [];

  const traitsById = getRacialCatalogIndex(catalog).byId;

  for (const id of selectedIds) {
    const traitData = traitsById.get(id);
    if (!traitData) continue;
    const trait = foundry.utils.deepClone(traitData);
    const traitSelections = optionSelections[id] || {};
    for (const effect of (trait.effects || [])) {
      if (trait.rulesVersion === "0.9.3" && effect.options?.length) {
        const { choiceSource } = effect;
        const sourceId = choiceSource?.traitId || id;
        const sourceLevel = choiceSource?.level ?? effect.level;
        const saved = selectedIds.includes(sourceId) ? optionSelections[sourceId]?.[sourceLevel] : undefined;
        const chosen = Array.isArray(saved) ? saved : [saved];
        effect.options = effect.options.filter(opt => !opt.requiredRace || opt.requiredRace === system.race);
        for (const opt of effect.options) {
          opt.selected = chosen.includes(opt.name);
          if (opt.selected && opt.selectElement) {
            const profile = traitSelections.elementalProfiles?.[effect.level];
            opt.elementalProfiles = ELEMENTAL_PROFILES_093.map(name => ({ name, selected: name === profile }));
            opt.hasSelectedProfile = ELEMENTAL_PROFILES_093.includes(profile);
          }
        }
        const count = effect.options.filter(opt => opt.selected).length;
        effect.hasSelection = count > 0;
        if (effect.activationType === "multi-option") {
          effect.selectedCount = count;
          for (const opt of effect.options) opt.disabled = !opt.selected && count >= effect.optionCount;
        }
        continue;
      }
      if (effect.options && (effect.activationType === "option" || effect.activationType === "choice")) {
        const selected = traitSelections[effect.level];
        for (const opt of effect.options) opt.selected = (opt.name === selected);
        if (!effect.options.some(o => o.selected) && effect.options.length > 0) effect.options[0].selected = true;
      } else if (effect.options && effect.activationType === "multi-option") {
        const selected = traitSelections[effect.level] || [];
        const selectedArr = Array.isArray(selected) ? selected : [selected];
        const max = effect.optionCount || Infinity;
        for (const opt of effect.options) {
          opt.selected = selectedArr.includes(opt.name);
        }
        const selCount = effect.options.filter(o => o.selected).length;
        effect.selectedCount = selCount;
        // Disable unchecked options when at max
        if (selCount >= max) {
          for (const opt of effect.options) { if (!opt.selected) opt.disabled = true; }
        }
      }
    }
    // Divergent Evolution (Arcosian): Meta Trait selector on the trait card
    // (also selectable from any Metamorphosis stage's traits dialog).
    if (trait.id === "b252198d4bafa7c6") {
      const mtCatalog = CONFIG.DBU?.metaTraitsCatalog || [];
      const dv = system.transformationMeta?.metaTraitState?.divergent || {};
      trait.isDivergentEvolution = true;
      trait.divergentOptions = mtCatalog.map(mt => ({
        id: mt.id, name: mt.name, selected: dv.trait === mt.id
      }));
      const chosenDef = mtCatalog.find(t => t.id === dv.trait);
      trait.divergentChosen = chosenDef ? {
        name: chosenDef.name,
        effects: (chosenDef.effects || []).map(e => `[${e.keyword}] ${e.text}`),
        options: chosenDef.options
          ? chosenDef.options.map(o => ({ key: o.key, name: o.name, selected: dv.config?.option === o.key }))
          : null,
        bestialChoice: chosenDef.bestialChoice
          ? chosenDef.bestialChoice.map(b => ({
              key: b,
              name: (CONFIG.DBU?.bestialTraitsCatalog || []).find(x => x.id === b)?.name || b,
              selected: dv.config?.bestialTrait === b
            }))
          : null
      } : null;
    }
    // Part Beast (Earthling Beastman): selector for its two permanent Bestial Traits
    if (trait.id === "979b43c2cb80c474") {
      const mutState = system.transformationMeta?.mutationState || {};
      const chosen = (mutState.partBeastBestialTraits || []).slice(0, 2);
      const btConfig = mutState.bestialTraitConfig || {};
      trait.isPartBeast = true;
      trait.partBeastCount = chosen.length;
      trait.partBeastBestial = (CONFIG.DBU?.bestialTraitsCatalog || []).map(bt => {
        const optEffect = (bt.effects || []).find(e => e.activationType === "option");
        const checked = chosen.includes(bt.id);
        return {
          id: bt.id, name: bt.name, checked,
          disabled: !checked && chosen.length >= 2,
          options: (checked && optEffect) ? optEffect.options.map(o => {
            const key = o.name.toLowerCase().replace(/\s+/g, "_");
            return { key, name: o.name, selected: (btConfig[bt.id]?.option) === key };
          }) : null
        };
      });
    }
    results.push(trait);
  }
  return results;
}

export function prepareCharacterTalents(system) {
  const selectedIds = system._martialTalents ?? system.talents ?? [];
  const catalog = CONFIG.DBU?.talentsCatalog || [];
  const results = [];
  for (const id of selectedIds) {
    const talentData = getCatalogById(catalog).get(id);
    if (!talentData) continue;
    const talent = foundry.utils.deepClone(talentData);
    // Archetype Focus: Foundation selector on the card (−1 CT Strike/Wound
    // with the chosen Foundation, consumed by _calcCombatCTs)
    if (talent.id === "archetype_focus") {
      const chosen = system.talentSelections?.archetypeFocusFoundation || "";
      talent.isArchetypeFocus = true;
      talent.archetypeFoundationOptions = ["Physical", "Energy", "Magic"].map(f => ({
        value: f, selected: f === chosen
      }));
    }
    results.push(talent);
  }
  return results;
}

export function prepareCombatResources(system) {
  const resources = [];
  const catalog = CONFIG.DBU ?? {};

  // 1. Racial traits
  const traitIds = system.racialTraits || [];
  const traitCatalog = catalog.racialTraitsCatalog || {};
  const traitsById = getRacialCatalogIndex(traitCatalog).byId;
  for (const id of traitIds) {
    const trait = traitsById.get(id);
    if (!trait) continue;
    const traitKey = trait.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    for (const eff of (trait.effects || [])) {
      if (["option", "multi-option", "choice"].includes(eff.activationType)) continue;
      const isTrackable = ["limited", "triggered"].includes(eff.activationType);
      resources.push({
        id: `racial_${trait.traitCategory}_${traitKey}_${eff.level}`,
        sourceName: trait.name,
        sourceType: "racial",
        level: eff.level || 0,
        activationType: eff.activationType || "passive",
        usageLimit: eff.usageLimit || (isTrackable ? "round" : null),
        maxUses: eff.maxUses || (eff.activationType === "limited" ? 1 : 0),
        keyword: eff.keyword || eff.activationType || "",
        text: eff.text || "",
        ...(eff.summary ? { summary: eff.summary } : {}),
        isTrackable
      });
    }
  }

  // 2. Talents
  const talentIds = system._martialTalents ?? system.talents ?? [];
  const talentCatalog = catalog.talentsCatalog || [];
  for (const id of talentIds) {
    const talent = getCatalogById(talentCatalog).get(id);
    if (!talent) continue;
    // Catalog id (not name-derived) — must match the effect-panel/automation
    // `talent_${id}_${level}` format (Lion's Heart apostrophe divergence).
    for (const eff of (talent.effects || [])) {
      if (["option", "multi-option", "choice"].includes(eff.activationType)) continue;
      const isTrackable = ["limited", "triggered"].includes(eff.activationType);
      resources.push({
        id: `talent_${id}_${eff.level || 0}`,
        sourceName: talent.name,
        sourceType: "talent",
        level: eff.level || 0,
        activationType: eff.activationType || "passive",
        usageLimit: eff.usageLimit || (isTrackable ? "round" : null),
        maxUses: eff.maxUses || (eff.activationType === "limited" ? 1 : 0),
        keyword: eff.keyword || eff.activationType || "",
        text: eff.text || "",
        ...(eff.summary ? { summary: eff.summary } : {}),
        isTrackable
      });
    }
  }

  // 3. Unique abilities (own + gained from suppressed actors in OSF)
  const uniqueCatalog = catalog.uniqueAbilitiesCatalog || {};
  const allUAs = [...(system.uniqueAbilities || [])];
  const fusion = system.fusion || {};
  if (fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession")) {
    for (const suppId of (fusion.suppressedCharacterIds || [])) {
      const suppActor = game.actors?.get(suppId);
      if (suppActor) {
        for (const ua of (suppActor.system?.uniqueAbilities || [])) allUAs.push(ua);
      }
    }
  }
  for (const ua of allUAs) {
    const data = uniqueCatalog[ua.abilityKey];
    if (!data) continue;
    const abilityKey = data.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    // Build combined effect text including selected advancements
    let effectText = data.effect || "";
    for (const adv of (ua.advancements || [])) {
      const advData = (data.advancements || []).find(a => a.id === adv.advancementId);
      if (advData) {
        effectText += `<br><br><strong>[${advData.name}]:</strong> ${advData.effect}`;
      }
    }

    // Base effect
    resources.push({
      id: `unique_${abilityKey}`,
      sourceName: data.name,
      sourceType: "unique",
      level: 1,
      activationType: "triggered",
      usageLimit: "round",
      maxUses: 1,
      keyword: `${data.maneuverType || "Standard"}, 1/Round`,
      text: effectText,
      isTrackable: true,
      actionType: "chat"
    });

    // Passive bonus
    if (data.passiveBonus) {
      resources.push({
        id: `unique_${abilityKey}_passive`,
        sourceName: `${data.name} (Passive)`,
        sourceType: "unique",
        level: 1,
        activationType: "passive",
        usageLimit: null,
        maxUses: 0,
        keyword: "Passive",
        text: data.passiveBonus,
        isTrackable: false
      });
    }
  }

  // 4. Transformation trait effects as combat resources (own + gained active)
  const transOptionSels = system.transformationOptionSelections || {};
  const allTransForResources = [...(system.transformations || []), ...(system._gainedActiveTransformations || [])];
  for (const [tIdx, trans] of allTransForResources.entries()) {
    if (!trans.active) continue;
    const tSelections = transOptionSels[tIdx] || {};

    const pushEffect = (eff, groupName, groupLevel) => {
      const isTrackable = ["limited", "triggered"].includes(eff.activationType);
      resources.push({
        id: `trans_${trans.id}_${groupLevel || 0}_${eff.keyword || ""}`,
        sourceName: trans.name || "Transformation",
        sourceType: "transformation",
        level: groupLevel || eff.level || 0,
        activationType: eff.activationType || "passive",
        keyword: eff.keyword || "Passive",
        text: eff.text || "",
        usageLimit: eff.usageLimit || null,
        maxUses: eff.maxUses || null,
        isTrackable
      });
    };

    for (const group of (trans.structuredTraits || [])) {
      for (const effect of (group.effects || [])) {
        if (effect.activationType === "option" && effect.options?.length > 0) {
          // Include the SELECTED option's sub-effects
          const effectKey = `${group.name || "trait"}_${effect.level || 0}`;
          const selectedName = tSelections[effectKey] || effect.options[0]?.name;
          const selectedOpt = effect.options.find(o => o.name === selectedName);
          if (selectedOpt) pushEffect(selectedOpt, group.name, group.level);
        } else if (effect.activationType === "multi-option" && effect.options?.length > 0) {
          // Include ALL selected multi-option sub-effects
          const effectKey = `${group.name || "trait"}_${effect.level || 0}`;
          const selectedArr = Array.isArray(tSelections[effectKey]) ? tSelections[effectKey] : [];
          for (const optName of selectedArr) {
            const opt = effect.options.find(o => o.name === optName);
            if (opt) pushEffect(opt, group.name, group.level);
          }
        } else if (effect.activationType === "choice" && effect.options?.length > 0) {
          // Include the matching choice sub-effect
          const parentKey = effect.parentOptionKey || "";
          const parentSelected = tSelections[parentKey] || "";
          const matchingOpt = effect.options.find(o => o.name === parentSelected);
          if (matchingOpt) pushEffect(matchingOpt, group.name, group.level);
        } else if (!["option", "multi-option", "choice"].includes(effect.activationType)) {
          pushEffect(effect, group.name, group.level);
        }
      }
    }
  }

  // 5. Equipment combat penalty as passive resource
  const eqPenalty = system.equipment?.combatPenalty || 0;
  if (eqPenalty > 0) {
    resources.push({
      id: "eq_combat_penalty",
      sourceName: "Equipment",
      sourceType: "equipment",
      level: 0,
      activationType: "passive",
      keyword: "Passive",
      text: `Combat Roll Penalty: -${eqPenalty}`,
      usageLimit: null,
      maxUses: null,
      isTrackable: false
    });
  }

  // 6. Unique ability restrictions as passive reference items (own + gained)
  for (const ua of allUAs) {
    const data = uniqueCatalog[ua.abilityKey];
    if (!data) continue;
    for (const sel of (ua.restrictions || [])) {
      const resData = (data.restrictions || []).find(r => r.id === sel.restrictionId);
      if (!resData) continue;
      resources.push({
        id: `unique_${ua.abilityKey}_res_${sel.restrictionId}`,
        sourceName: data.name || ua.abilityKey,
        sourceType: "unique",
        level: 0,
        activationType: "passive",
        keyword: "Restriction",
        text: resData.effect || resData.name || "",
        usageLimit: null,
        maxUses: null,
        isTrackable: false
      });
    }
  }

  return resources;
}

export function prepareActiveEffects(context, system) {
  const catalog = CONFIG.DBU ?? {};
  const et = system.effectTracking || {};
  const enabledPassives = et.enabledPassives || {};
  const usedRound = et.usedEffects?.round || {};
  const usedEncounter = et.usedEffects?.encounter || {};
  const combatStates = system.combatStates || {};

  const groups = {
    racial: { label: "Racial Traits", source: "racial", effects: [] },
    villainous: { label: "Villainous Traits", source: "villainous", effects: [] },
    weaknesses: { label: "Weaknesses", source: "weaknesses", effects: [] },
    talents: { label: "Talents", source: "talents", effects: [] },
    transformations: { label: "Transformations", source: "transformations", effects: [] }
  };

  // 1. Racial traits
  const traitIds = system.racialTraits || [];
  const traitCatalog = catalog.racialTraitsCatalog || {};
  const traitsById = getRacialCatalogIndex(traitCatalog).byId;
  for (const id of traitIds) {
    const trait = traitsById.get(id);
    if (!trait) continue;
    const traitKey = trait.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    for (const eff of (trait.effects || [])) {
      // For "option"/"multi-option"/"choice" effects, resolve the chosen option and display it
      if (["option", "multi-option", "choice"].includes(eff.activationType)) {
        const optSel = system.racialOptionSelections || {};
        const traitSel = optSel[id] || {};
        const chosenName = traitSel?.[String(eff.level)] ?? traitSel?.[eff.level] ?? "";
        if (!chosenName) continue; // no option selected yet, skip
        const chosenOpt = (eff.options || []).find(o => o.name === chosenName);
        if (!chosenOpt) continue;
        const optEffectId = `racial_${trait.traitCategory}_${traitKey}_${eff.level}`;
        const optType = chosenOpt.activationType || "passive";
        const optMaxUses = chosenOpt.maxUses || (optType === "limited" ? 1 : 0);
        const optUsageLimit = chosenOpt.usageLimit || null;
        const optUsedKey = optUsageLimit === "round" ? "round" : "encounter";
        const optUsedCount = (optUsedKey === "round" ? usedRound : usedEncounter)[optEffectId] || 0;
        const optPips = [];
        if (optMaxUses > 0) {
          for (let i = 0; i < optMaxUses; i++) {
            optPips.push({ available: i >= optUsedCount, index: i });
          }
        }
        const optKeyword = chosenOpt.keyword || optType.charAt(0).toUpperCase() + optType.slice(1);
        let optTriggered = false;
        if (optType === "triggered") {
          if (optKeyword.includes("Raging")) optTriggered = !!combatStates.raging;
          else if (optKeyword.includes("Surging")) optTriggered = !!combatStates.surging;
          else if (optKeyword.includes("Mindful")) optTriggered = !!combatStates.mindful;
          else if (optKeyword.includes("Superior")) optTriggered = !!combatStates.superior;
          else if (optKeyword.includes("Undying")) optTriggered = !!combatStates.undying;
          else if (optKeyword.includes("Start of")) optTriggered = true;
          else if (optKeyword.includes("Power")) optTriggered = true;
        }
        groups.racial.effects.push({
          id: optEffectId,
          name: `${trait.name} (${chosenName})`,
          level: eff.level || 0,
          type: optType,
          keyword: optKeyword,
          text: chosenOpt.text || chosenOpt.summary || "",
          maxUses: optMaxUses,
          usageLimit: optUsageLimit,
          usedCount: optUsedCount,
          pips: optPips,
          isEnabled: enabledPassives[optEffectId] !== false,
          isTriggered: optTriggered,
          truncatedKeyword: (optKeyword || "Passive").substring(0, 12)
        });
        continue;
      }
      const effectId = `racial_${trait.traitCategory}_${traitKey}_${eff.level}`;
      const effectType = eff.activationType || "passive";
      const maxUses = eff.maxUses || (effectType === "limited" ? 1 : 0);
      const usageLimit = eff.usageLimit || null;
      const usedKey = usageLimit === "round" ? "round" : "encounter";
      const usedCount = (usedKey === "round" ? usedRound : usedEncounter)[effectId] || 0;

      // Build usage pips
      const pips = [];
      if (maxUses > 0) {
        for (let i = 0; i < maxUses; i++) {
          pips.push({ available: i >= usedCount, index: i });
        }
      }

      // Check triggered state
      let isTriggered = false;
      const keyword = eff.keyword || "";
      if (effectType === "triggered") {
        if (keyword.includes("Raging")) isTriggered = !!combatStates.raging;
        else if (keyword.includes("Surging")) isTriggered = !!combatStates.surging;
        else if (keyword.includes("Mindful")) isTriggered = !!combatStates.mindful;
        else if (keyword.includes("Superior")) isTriggered = !!combatStates.superior;
        else if (keyword.includes("Undying")) isTriggered = !!combatStates.undying;
        else if (keyword.includes("Start of")) isTriggered = true;
        else if (keyword.includes("Power")) isTriggered = true;
      }

      groups.racial.effects.push({
        id: effectId,
        name: trait.name,
        level: eff.level || 0,
        type: effectType,
        keyword: keyword,
        text: eff.text || "",
        ...(eff.summary ? { summary: eff.summary } : {}),
        maxUses,
        usageLimit,
        usedCount,
        pips,
        isEnabled: enabledPassives[effectId] !== false,
        isTriggered,
        truncatedKeyword: (keyword || "TRIG").substring(0, 12)
      });
    }
  }

  // 1b. Villainous Traits
  const vtIds = system.adversary?.villainousTraits || [];
  const vtCatalog = catalog.villainousTraitsCatalog || [];
  if (system.adversary?.enabled) {
    for (const id of vtIds) {
      const trait = getCatalogById(vtCatalog).get(id);
      if (!trait) continue;
      const traitKey = trait.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      for (const eff of (trait.effects || [])) {
        if (["option", "multi-option", "choice"].includes(eff.activationType)) continue;
        const effectId = `villainous_${traitKey}_${eff.keyword?.replace(/[^a-z0-9]/gi, "_") || "0"}`;
        const effectType = eff.activationType || "passive";
        const maxUses = eff.maxUses || (effectType === "limited" ? 1 : 0);
        const usageLimit = eff.usageLimit || null;
        const usedKey = usageLimit === "round" ? "round" : "encounter";
        const usedCount = (usedKey === "round" ? usedRound : usedEncounter)[effectId] || 0;

        const pips = [];
        if (maxUses > 0) {
          for (let i = 0; i < maxUses; i++) {
            pips.push({ available: i >= usedCount, index: i });
          }
        }

        let isTriggered = false;
        const keyword = eff.keyword || "";
        if (effectType === "triggered") {
          if (keyword.includes("Raging")) isTriggered = !!combatStates.raging;
          else if (keyword.includes("Surging")) isTriggered = !!combatStates.surging;
          else if (keyword.includes("Start of")) isTriggered = true;
          else if (keyword.includes("Defeated")) isTriggered = true;
          else if (keyword.includes("Threshold")) isTriggered = true;
          else if (keyword.includes("Power")) isTriggered = true;
        }

        groups.villainous.effects.push({
          id: effectId,
          name: trait.name,
          level: 0,
          type: effectType,
          keyword: keyword,
          text: eff.text || "",
          maxUses,
          usageLimit,
          usedCount,
          pips,
          isEnabled: enabledPassives[effectId] !== false,
          isTriggered,
          truncatedKeyword: (keyword || "TRIG").substring(0, 12)
        });
      }
    }

    // 1c. Weaknesses
    const wkIds = system.adversary?.weaknesses || [];
    const wkCatalog = catalog.weaknessesCatalog || [];
    for (const id of wkIds) {
      const weakness = getCatalogById(wkCatalog).get(id);
      if (!weakness) continue;
      const wkKey = weakness.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      for (const eff of (weakness.effects || [])) {
        const effectId = `weakness_${wkKey}_${eff.keyword?.replace(/[^a-z0-9]/gi, "_") || "0"}`;
        const effectType = eff.activationType || "passive";

        groups.weaknesses.effects.push({
          id: effectId,
          name: weakness.name,
          level: 0,
          type: effectType,
          keyword: eff.keyword || "",
          text: eff.text || "",
          maxUses: 0,
          usageLimit: null,
          usedCount: 0,
          pips: [],
          isEnabled: enabledPassives[effectId] !== false,
          isTriggered: effectType === "automatic",
          truncatedKeyword: (eff.keyword || "AUTO").substring(0, 12)
        });
      }
    }
  }

  // 2. Talents
  const talentIds = system._martialTalents ?? system.talents ?? [];
  const talentCatalog = catalog.talentsCatalog || [];
  for (const id of talentIds) {
    const talent = getCatalogById(talentCatalog).get(id);
    if (!talent) continue;
    // Use the CATALOG id — applyTalentBonuses reads `talent_${id}_${level}`;
    // deriving the key from the display name diverged for names with
    // apostrophes (Lion's Heart → "lion_s_heart" vs id "lions_heart").
    for (const eff of (talent.effects || [])) {
      if (["option", "multi-option", "choice"].includes(eff.activationType)) continue;
      const effectId = `talent_${id}_${eff.level || 0}`;
      const effectType = eff.activationType || "passive";
      const maxUses = eff.maxUses || (effectType === "limited" ? 1 : 0);
      const usageLimit = eff.usageLimit || null;
      const usedKey = usageLimit === "round" ? "round" : "encounter";
      const usedCount = (usedKey === "round" ? usedRound : usedEncounter)[effectId] || 0;

      const pips = [];
      if (maxUses > 0) {
        for (let i = 0; i < maxUses; i++) {
          pips.push({ available: i >= usedCount, index: i });
        }
      }

      let isTriggered = false;
      const keyword = eff.keyword || "";
      if (effectType === "triggered") {
        if (keyword.includes("Raging")) isTriggered = !!combatStates.raging;
        else if (keyword.includes("Surging")) isTriggered = !!combatStates.surging;
        else if (keyword.includes("Mindful")) isTriggered = !!combatStates.mindful;
        else if (keyword.includes("Superior")) isTriggered = !!combatStates.superior;
        else if (keyword.includes("Undying")) isTriggered = !!combatStates.undying;
        else if (keyword.includes("Start of")) isTriggered = true;
        else if (keyword.includes("Power")) isTriggered = true;
      }

      groups.talents.effects.push({
        id: effectId,
        name: talent.name,
        level: eff.level || 0,
        type: effectType,
        keyword: keyword,
        text: eff.text || "",
        ...(eff.summary ? { summary: eff.summary } : {}),
        maxUses,
        usageLimit,
        usedCount,
        pips,
        isEnabled: enabledPassives[effectId] !== false,
        isTriggered,
        truncatedKeyword: (keyword || "TRIG").substring(0, 12)
      });
    }
  }

  // Build context — all effect groups shown in Main tab AND Combat tab
  context.effectGroups = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.effects.length > 0) {
      context.effectGroups.push({
        key,
        label: group.label,
        count: group.effects.length,
        effects: group.effects
      });
    }
  }
  context.hasActiveEffects = context.effectGroups.length > 0;

  // Talent effects also available separately for the Combat tab's Talents sub-tab
  const tg = groups.talents;
  context.talentEffectGroup = tg.effects.length > 0
    ? { key: "talents", label: tg.label, count: tg.effects.length, effects: tg.effects }
    : null;
}
