import { stateLevel } from "../../rules/states-v093.mjs";
import { attackWeapon093, weaponRollModifiers093, wieldingStrikePenalty093 } from '../../helpers/weapon-state.mjs';
import { limitedMartialPower } from "../../rules/path-to-power-v093.mjs";
import { energyChargeDie, greaterDiceCategoryBonus, shiftAttackDamageCategory, signatureBuffDice } from "../../helpers/custom-buffs.mjs";
import { modifierProfileIssue093, techniqueKiCost093, signatureEnergyCharges093, martialTechnique, martialTechniqueTPCap, startingTechniqueAvailable093, startingTechniqueEligible093 } from "../../rules/techniques-v093.mjs";
import { isLegacyLimitBreakType, uses093, techniqueCapUsage093, techniquePointCost, paidAdvantageTP093, signatureModifierTP093 } from "../../rules/v093.mjs";
import { progression093 } from "../../rules/progression-v093.mjs";

/** Character sheet domain: techniques. Methods run with the sheet as this. */
export const techniquesMethods = {

  _prepareTechniquesData(context, system) {
    const techniques = system.signatureTechniques || [];
    const config = CONFIG.DBU ?? {};
    const tier = system.tier || 1;
    const tpLimit = this._tpLimitByBaseTier(system.baseTier);
    const foundations = config.techniqueFoundations || {};
    const profileDataMap = config.profileData || {};
    const profileKpCosts = config.profileKpCosts || {};
    const advData = config.techniqueAdvantagesData || {};
    const disadvData = config.techniqueDisadvantagesData || {};
    const currentRules = uses093(system);
    const startingTechnique = currentRules && techniques.find(tech => tech.startingTechnique);
    if (currentRules) {
      context.startingTechniqueAvailable = startingTechniqueAvailable093(system);
      context.limitedMartialPower = limitedMartialPower(system);
    }

    // Helper: get attribute modifier
    const getAttrMod = (key) => system.attributes?.[key]?.modifier ?? 0;

    const enrichModifier = (row, group, definitions, profile) => {
      const { requirement = "", effect, source } = definitions[row.name] || {};
      const tpCost = currentRules ? signatureModifierTP093(row, group) : row.tpCost;
      const paidTP = currentRules && group === 'Advantages' ? paidAdvantageTP093(row, profile) : tpCost;
      return { ...row, tpCost, paidTP, requirement, effect, source };
    };
    const enrichAdvantages = technique => (technique.advantages || []).map(row => enrichModifier(row, 'Advantages', advData, technique.profile));
    const enrichDisadvantages = rows => (rows || []).map(row => enrichModifier(row, 'Disadvantages', disadvData));

    const optionsFor = (t, rows, definitions) => rows.map(row => ({ ...row, options: Object.keys(definitions).filter(name =>
        name === row.name || ((!currentRules || !modifierProfileIssue093(martialTechnique(t, system), name)) &&
          !rows.some(other => other !== row && other.name === name))).sort() }));

    // Calculate enriched data for each technique
    const preparedTechniques = techniques.map(t => {
      const isFreeStarter = t === startingTechnique && startingTechniqueEligible093(t, system);
      const techniqueCap = martialTechniqueTPCap(t, system, tpLimit);
      const tpCost = isFreeStarter ? 0 : this._calcTechTPCost(t);

      // Magical Flavor: the ST is treated as the chosen Energy Profile for
      // effects/formulas while remaining a Magic ST (uses MA, Magic buffs).
      const mfProfile = this._techMagicalFlavor(t);
      const tCalc = mfProfile ? { ...t, profile: mfProfile } : t;

      // Profile data
      const profileInfo = profileDataMap[tCalc.profile] || null;

      // KP model (Free TP excluded, Efficiency/Inefficiency, profile-KP floor)
      const { profileBaseKP, tpFull, kpCost, kpReduction, finalKP, issues } = this._calcTechKP(t);

      // Dynamic Ki: sum of all dynamicTP values
      let dynamicKi = 0;
      for (const adv of (t.advantages || [])) dynamicKi += (adv.dynamicTP || 0);
      for (const dis of (t.disadvantages || [])) dynamicKi += (dis.dynamicTP || 0);

      // Available profiles for selected foundation
      const availableProfiles = foundations[t.foundation] || Object.keys(profileDataMap);

      const enrichedAdvantages = enrichAdvantages(t);
      const enrichedDisadvantages = enrichDisadvantages(t.disadvantages);

      // Strike formula
      const strikeInfo = this._calcTechStrike(tCalc, system, tier);
      // Wound formula
      const woundInfo = this._calcTechWound(tCalc, system, tier);
      // CT info
      const ctInfo = this._calcTechCT(tCalc, system);

      return {
        ...t,
        tpCost,
        tpMax: techniqueCap,
        tpCapUsage: currentRules ? techniqueCapUsage093(t) : tpCost,
        targetingBonus: currentRules && t.isWeapon ? system.equipmentFlags?.weaponTargetingSystem?.[attackWeapon093(this.actor, t).item?.id] || 0 : 0,
        tpOverLimit: (currentRules ? techniqueCapUsage093(t) : tpCost) > techniqueCap,
        tpDiscounted: currentRules && tpFull !== tpCost,
        ...(currentRules && t.startingTechnique ? { startingTechniqueNeedsReview: !isFreeStarter } : {}),
        tpFull,
        weaponOptionRows: currentRules && t.isWeapon ? Array.from(this.actor.items || [])
          .filter(item => item.type === 'equipment' && item.system.equipmentType === 'weapon'
            && (item.system.weaponType || 'physical').toLowerCase() === t.foundation?.toLowerCase())
          .map(item => ({ id: item.id, name: item.name, selected: [item.id, item.name].includes(t.weaponEquipped) })) : [],
        legacyLimitBreakType: currentRules && isLegacyLimitBreakType(t.type ?? t.techType),
        modifierIssues: issues,
        mfProfile,
        kpCost,
        kpReduction,
        dynamicKi,
        finalKP,
        maintenanceKP: Math.ceil(finalKP / 2),
        profileBaseKP,
        profileInfo,
        availableProfiles,
        advantages: optionsFor(t, enrichedAdvantages, advData),
        disadvantages: optionsFor(t, enrichedDisadvantages, disadvData),
        strikeFormula: strikeInfo.formula,
        strikeCT: ctInfo.strikeCT,
        woundFormula: woundInfo.formula,
        woundCT: ctInfo.woundCT,
        dodgeCT: ctInfo.dodgeCT,
        damageCat: woundInfo.damageCat,
        ctNotes: ctInfo.notes
      };
    });
    context.signatureTechniques = preparedTechniques;

    // TP Summary (shared pool) — base 25 + accumulated progression TP + Gifted Student
    const progRows = system.progressionRows || CONFIG.DBU?.progressionRows || [];
    const currentLevel = system.level || 1;
    let tpFromProgression = 0;
    let siCount = 0;
    for (const row of progRows) {
      if ((row.level || 0) <= currentLevel) {
        if (row.tp != null) tpFromProgression += Number(row.tp) || 0;
        if (row.perkType === "skill_improvement") siCount++;
      }
    }
    // TP per Skill Improvement: Gifted Student (+3/+6) and Rapid Learner (+3) —
    // both derived live from CURRENT rows, so retyping a row away from Skill
    // Improvement automatically drops its TP (no stale awards).
    const gsTPBonus = ((system.aptitudes?.giftedStudentTPPerSI || 0)
      + (system.aptitudes?.rapidLearnerTPPerSI || 0)) * siCount;
    const tpPerSIBuff = this.actor._getBuffTotal?.(system, "TP per Skill Improvement") || 0;
    const tpTotal = currentRules
      ? progression093(system, progRows.length ? progRows : (config.progressionRows || []), tpPerSIBuff).totalTP
      : 25 + tpFromProgression + gsTPBonus + tpPerSIBuff * siCount + (system.downtime?.gains?.tp || 0);
    const tpSpentSignatures = preparedTechniques.reduce((sum, t) => sum + t.tpCost, 0);
    const tpSpentAuras = currentRules ? 0 : this._calcAurasTotalTP(system);
    const tpSpentUnique = this._calcUniqueTotalTP(system);

    context.tpTotal = tpTotal;
    context.tpSpentSignatures = tpSpentSignatures;
    context.tpSpentAuras = tpSpentAuras;
    context.tpSpentUnique = tpSpentUnique;
    context.tpRemaining = tpTotal - tpSpentSignatures - tpSpentAuras - tpSpentUnique;

    // --- One-Sided Fusion: append gained techniques from suppressed actor(s) ---
    const fusion = system.fusion || {};
    if (fusion.isFusion && (fusion.type === "one-sided-absorption" || fusion.type === "one-sided-possession")
        && !this.actor._blockGainedAbilities(system)) {
      const suppIds = fusion.suppressedCharacterIds || [];
      for (const suppId of suppIds) {
        const suppActor = game.actors?.get(suppId);
        if (!suppActor) continue;
        const suppSys = suppActor.system || {};
        const suppTechs = suppSys.signatureTechniques || [];
        for (const st of suppTechs) {
          const cloned = foundry.utils.deepClone(st);
          const tpCost = this._calcTechTPCost(cloned);
          const profileInfo = profileDataMap[cloned.profile] || null;
          const { profileBaseKP, kpCost, kpReduction, finalKP } = this._calcTechKP(cloned);
          let dynamicKi = 0;
          for (const adv of (cloned.advantages || [])) dynamicKi += (adv.dynamicTP || 0);
          for (const dis of (cloned.disadvantages || [])) dynamicKi += (dis.dynamicTP || 0);
          const availableProfiles = foundations[cloned.foundation] || Object.keys(profileDataMap);
          const enrichedAdvantages = enrichAdvantages(cloned);
          const enrichedDisadvantages = enrichDisadvantages(cloned.disadvantages);
          const strikeInfo = this._calcTechStrike(cloned, system, tier);
          const woundInfo = this._calcTechWound(cloned, system, tier);
          const ctInfo = this._calcTechCT(cloned, system);
          preparedTechniques.push({
            ...cloned,
            isGained: true,
            gainedFrom: suppActor.name,
            tpMax: tpLimit, tpCapUsage: currentRules ? techniqueCapUsage093(cloned) : tpCost,
            tpCost, kpCost, kpReduction, dynamicKi, finalKP,
            maintenanceKP: Math.ceil(finalKP / 2),
            profileBaseKP, profileInfo, availableProfiles,
            advantages: optionsFor(cloned, enrichedAdvantages, advData),
            disadvantages: optionsFor(cloned, enrichedDisadvantages, disadvData),
            strikeFormula: strikeInfo.formula, strikeCT: ctInfo.strikeCT,
            woundFormula: woundInfo.formula, woundCT: ctInfo.woundCT,
            dodgeCT: ctInfo.dodgeCT, damageCat: woundInfo.damageCat,
            ctNotes: ctInfo.notes
          });
        }
      }
    }

    // --- Battle Jacket Piloting: append gained techniques from jacket ---
    if (system.isPiloting && system._pilotedJacket) {
      const bjTechs = system._pilotedJacket.signatureTechniques || [];
      for (const st of bjTechs) {
        const cloned = foundry.utils.deepClone(st);
        preparedTechniques.push({
          ...cloned,
          isGained: true,
          gainedFrom: system._pilotedJacket.name,
          gainedSource: "battleJacket"
        });
      }
    }

    // --- Evil Aura: append gained techniques when transformation active + evilTechsActive ---
    const evilAuraActive = (system.transformations || []).some(
      t => t.active && t.catalogKey === "evil_aura"
    );
    const evilTechsToggled = !!system.transformationMeta?.evilTechsActive;
    if (evilAuraActive && evilTechsToggled) {
      const evilCatalog = CONFIG.DBU?.evilAuraTechniques || [];
      for (const st of evilCatalog) {
        const cloned = foundry.utils.deepClone(st);
        const tpCost = this._calcTechTPCost(cloned);
        const profileInfo = profileDataMap[cloned.profile] || null;
        const { profileBaseKP, kpCost, kpReduction, finalKP: baseFinalKP } = this._calcTechKP(cloned);
        let dynamicKi = 0;
        for (const adv of (cloned.advantages || [])) dynamicKi += (adv.dynamicTP || 0);
        for (const dis of (cloned.disadvantages || [])) dynamicKi += (dis.dynamicTP || 0);
        // Rule: "Reduce their Ki Point Cost by 1/2."
        const finalKP = Math.ceil(baseFinalKP / 2);
        const availableProfiles = foundations[cloned.foundation] || Object.keys(profileDataMap);
        const enrichedAdvantages = enrichAdvantages(cloned);
        const enrichedDisadvantages = enrichDisadvantages(cloned.disadvantages);
        const strikeInfo = this._calcTechStrike(cloned, system, tier);
        const woundInfo  = this._calcTechWound(cloned, system, tier);
        const ctInfo     = this._calcTechCT(cloned, system);
        preparedTechniques.push({
          ...cloned,
          isGained: true,
          gainedFrom: "Evil Aura",
          gainedSource: "evil_aura",
          tpMax: tpLimit, tpCapUsage: currentRules ? techniqueCapUsage093(cloned) : tpCost,
          tpCost, kpCost, kpReduction, dynamicKi, finalKP,
          maintenanceKP: Math.ceil(finalKP / 2),
          profileBaseKP, profileInfo, availableProfiles,
          advantages: optionsFor(cloned, enrichedAdvantages, advData),
          disadvantages: optionsFor(cloned, enrichedDisadvantages, disadvData),
          strikeFormula: strikeInfo.formula, strikeCT: ctInfo.strikeCT,
          woundFormula: woundInfo.formula, woundCT: ctInfo.woundCT,
          dodgeCT: ctInfo.dodgeCT, damageCat: woundInfo.damageCat,
          ctNotes: ctInfo.notes
        });
      }
    }

    // Options for technique dropdowns
    context.techniqueTypeOptions = {
      signature: "Signature", super: "Super", ultimate: "Ultimate"
    };
    context.foundationOptions = {
      Physical: "Physical", Energy: "Energy", Magic: "Magic"
    };

    // Profile options (all, for fallback): sorted profile names
    context.profileOptions = Object.keys(profileDataMap).sort();

    // Advantage/disadvantage names
    context.advantageOptions = Object.keys(advData).sort();
    context.disadvantageOptions = Object.keys(disadvData).sort();
    // Energy profiles for the Magical Flavor selector
    context.energyProfileOptions = foundations["Energy"] || [];

    // Energy Control talent: selector for the reduced technique — the rules
    // allow choosing a Signature Technique OR a Technical Unique Ability.
    const ecTalents = system.talents || [];
    if (ecTalents.includes("energy_control")) {
      context.showEnergyControl = true;
      context.energyControlAll = ecTalents.includes("technique_master");
      context.energyControlChoice = String(system.talentSelections?.energyControlTechniqueId ?? "");
      const uaCatalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
      const technicalUAs = (system.uniqueAbilities || [])
        .filter(ua => /technical/i.test(uaCatalog[ua.abilityKey]?.abilityType || ""))
        .map(ua => ({ id: `ua:${ua.abilityKey}`, name: `${uaCatalog[ua.abilityKey]?.name || ua.abilityKey} (UA)` }));
      context.energyControlOptions = [
        ...techniques.filter(t => t.name).map(t => ({ id: String(t.id), name: t.name })),
        ...technicalUAs
      ];
    }
  },

  /**
   * Magical Flavor (signature.txt:529-539): a Spell-Profile ST that selects an
   * Energy Profile gains that Profile's effects, is treated as that Profile,
   * and uses its KP Cost. Returns the chosen profile name or "".
   */
  _techMagicalFlavor(tech) {
    if ((tech.profile || "") !== "Spell") return "";
    const mf = (tech.advantages || []).find(a => a.name === "Magical Flavor");
    const choice = String(mf?.notes || "").trim();
    if (!choice) return "";
    const energyProfiles = (CONFIG.DBU?.techniqueFoundations || {})["Energy"] || [];
    return energyProfiles.includes(choice) ? choice : "";
  },

  /**
   * Signature Technique KP Cost (signature.txt:18-20, 162, 930):
   * profile base + ceil(fullTP/5), −4(T)/Efficiency rank, +4(T)/Inefficiency
   * rank, floored at the Profile's listed KP Cost (the Minimum Ki Cost).
   * Free TP never lowers the KP Cost — it only reduces the TP the player pays.
   * Magical Flavor swaps in the chosen Energy Profile's KP cost/minimum.
   */
  _calcTechKP(tech) {
    if (uses093(this.actor.system)) {
      const weapon = tech.isWeapon ? attackWeapon093(this.actor, tech).item : null;
      return techniqueKiCost093(tech, { system: this.actor.system,
        usageDiscount: weapon?.system.weaponCategory === "efficient" ? 2 : 0 });
    }
    const profileKpCosts = CONFIG.DBU?.profileKpCosts || {};
    const mfProfile = this._techMagicalFlavor(tech);
    const profileBaseKP = profileKpCosts[mfProfile || tech.profile] || 0;
    const tpFull = this._calcTechTPCost({ ...tech, freeTP: 0 });
    const kpCost = profileBaseKP + Math.ceil(tpFull / 5);
    let kpReduction = 0;
    for (const adv of (tech.advantages || [])) {
      if (adv.name === "Efficiency") kpReduction += 4 * (adv.ranks || 1);
    }
    let kpIncrease = 0;
    for (const dis of (tech.disadvantages || [])) {
      if (dis.name === "Inefficiency") kpIncrease += 4 * (dis.ranks || 1);
    }
    // Energy Control talent: −2(T) KP for the SELECTED technique; Technique
    // Master L2 extends that reduction to ALL Signature Techniques.
    const talents = this.actor.system.talents || [];
    let talentKpReduction = 0;
    if (talents.includes("energy_control")) {
      const chosen = this.actor.system.talentSelections?.energyControlTechniqueId;
      if (talents.includes("technique_master")
          || (chosen != null && chosen !== "" && String(chosen) === String(tech.id))) {
        talentKpReduction = 2;
      }
    }
    // Supreme Fist L1: −2(T) KP on Unarmed Physical Attacks.
    // NOTE: _calcTechKP works in (T)-units (paid KP = finalKP × tier at roll
    // time), so the reduction is a FLAT 2 here — adding 2×tier would double-scale.
    if (talents.includes("supreme_fist") && tech.foundation === "Physical" && !tech.isWeapon) {
      talentKpReduction += 2;
    }
    let finalKP = Math.max(profileBaseKP, kpCost + kpIncrease - kpReduction - talentKpReduction);
    // Tiring aura disadvantage (auras.txt): +1(T) KP per rank on all Attacking
    // Maneuvers used while in the aura — applies even with Infusion. A usage
    // surcharge external to the technique's own cost, so it lands AFTER the
    // profile-KP floor (a floored ST still pays it). Flat = (T)-units here.
    const tiringAura = this.actor._getActiveAura(this.actor.system);
    let tiringIncrease = 0;
    if (tiringAura) {
      for (const dis of (tiringAura.disadvantages || [])) {
        if (dis.name === "Tiring") tiringIncrease += (dis.ranks || 1);
      }
    }
    finalKP += tiringIncrease;
    return { profileBaseKP, tpFull, kpCost, kpReduction: kpReduction + talentKpReduction, kpIncrease: kpIncrease + tiringIncrease, finalKP };
  },

  _calcTechTPCost(tech) {
    if (uses093(this.actor.system)) return techniquePointCost(martialTechnique(tech, this.actor.system));
    // Base: 8 TP for all Signature Techniques
    let total = 8;
    // Sum advantages TP (positive)
    for (const adv of (tech.advantages || [])) total += (adv.tpCost || 0);
    // Sum disadvantages TP (negative - reduces cost)
    for (const disadv of (tech.disadvantages || [])) total += (disadv.tpCost || 0);
    // Subtract free TP
    total -= (tech.freeTP || 0);
    // "The overall TP Cost of a Signature Technique cannot be less than 8."
    total = Math.max(8, total);
    // Ultimate Signature Techniques: +6 TP "added to the total AFTER completing
    // the calculations" (signature.txt:16/39) — i.e. after the 8-TP floor.
    // Type strings vary by data era ("ultimate" from the dropdown, "Ultimate
    // Signature" from config.techniqueTypes) — normalize with a regex.
    // OLD BUG: compared `=== "ultimate"` (never matched "Ultimate Signature") and added +4.
    if (/ultimate/i.test(tech.type || "")) total += 6;
    return total;
  },

  _calcTechStrike(tech, system, tier) {
    let haste = system.aptitudes?.haste ?? 0;
    let awareness = system.aptitudes?.awareness ?? 0;

    // Cutting: "1/2 (rounded up) of your Haste and 3/4 of your Awareness" to Strike Roll (attacking.txt)
    if (tech.profile === "Cutting" && !uses093(system)) {
      haste = Math.ceil(haste / 2);
      awareness = Math.floor(awareness * 3 / 4);
    }

    if (uses093(system) && tech.profile === "Crushing") haste = Math.floor(haste / 2);

    // Accurate bonus
    let accurateBonus = 0;
    for (const adv of (tech.advantages || [])) {
      if (adv.name === "Accurate") accurateBonus += (adv.ranks || 1) * tier;
    }
    // Inaccurate penalty
    let inaccuratePenalty = 0;
    for (const dis of (tech.disadvantages || [])) {
      if (dis.name === "Inaccurate") inaccuratePenalty += (dis.ranks || 1) * tier;
    }

    // Super Stack Strike penalty
    const ssPenStrike = system.aptitudes?.superStackStrikePenalty ?? 0;
    // Unified strike buff total (talents, states, maneuvers, custom buffs)
    const strikeBuffTotal = system.aptitudes?.strikeBuffTotal ?? 0;
    // Per-foundation strike bonuses ("Strike (Physical/Energy/Magic)" buffs)
    const foundationStrikeBuff = Number({
      Physical: system.aptitudes?.strikePhysical,
      Energy: system.aptitudes?.strikeEnergy,
      Magic: system.aptitudes?.strikeMagic
    }[tech.foundation]) || 0;
    // Unarmed Physical Attack (Physical ST without the Weapon flag):
    // Rapid Fist +1(T) Strike and "Unarmed Strike" custom buffs.
    const unarmedStrikeBuff = ((tech.foundation === "Physical" && !tech.isWeapon)
      ? (system.aptitudes?.unarmedStrike || 0) : 0) + (!tech.isWeapon ? (system.aptitudes?.unarmedAttackStrike || 0) : 0);
    // "Armed Strike" custom buff — weapon-based STs (mirror of unarmed)
    const armedStrikeBuff = tech.isWeapon ? (system.aptitudes?.armedStrike || 0) : 0;
    let totalMod = haste + awareness + accurateBonus - inaccuratePenalty - ssPenStrike + strikeBuffTotal + foundationStrikeBuff + unarmedStrikeBuff + armedStrikeBuff;
    const baseTier = system.baseTier || 1;

    // Sparking Combat Roll bonus now flows through strikeBuffTotal (derived buff)
    // Shaken condition: -2(T)
    const shakenStacks = this._getConditionStacks(system, "shaken");
    if (shakenStacks > 0) {
      totalMod -= 2 * tier;
    }
    // Diminishing Offense: -bT per stack
    const dimOff = system.tracking?.diminishingOffense || 0;
    if (dimOff > 0) {
      totalMod -= dimOff * baseTier;
    }
    // Equipment combat penalty
    const eqPenalty = system.equipment?.combatPenalty || 0;
    if (eqPenalty > 0) {
      totalMod -= eqPenalty;
    }

    const combatStates = system.combatStates || {};
    const isImpediment = (system.conditions || []).some(c => c.id === "impediment" && c.active);
    const dp = system.dicePools || {};
    const topCat = dp.topCatBonus || {};
    const grApply = dp.greaterApplyCount || {};
    const topCatBonus = (topCat.global || 0) + (topCat.strike || 0);
    const sig = dp.signature;
    const topDice = this._applyTopCount(system, "strike", this._resolveExtraDice(tier, 0, topCatBonus),
      (sig?.topAll || 0) + (sig?.topStrike || 0));
    const hasGreater = !isImpediment && (combatStates.superior || (grApply.global || 0) > 0 || (grApply.strike || 0) > 0);
    const grCatBonus = greaterDiceCategoryBonus(system, "strike");
    const greaterDice = hasGreater ? this._resolveExtraDice(tier, 1, grCatBonus) : "";
    if (uses093(system) && (tech.advantages || []).some(row => row.name === "Last Legs")) {
      totalMod += (system.thresholds?.penalties || 0) + (system.thresholds?.crossedCount || 0) * tier;
    }
    if (uses093(system)) {
      const weapon = tech.isWeapon ? attackWeapon093(this.actor, tech).item : null;
      totalMod += weaponRollModifiers093(system, weapon, tech.profile).strike - wieldingStrikePenalty093(this.actor, system);
    }
    totalMod += sig?.strikeBonus || 0;
    const formula = this._buildFormula(topDice, greaterDice, totalMod, this._extraDicePool(system, "strike") + signatureBuffDice(system, "strike"));

    return { formula };
  },

  _calcTechWound(tech, system, tier) {
    const config = CONFIG.DBU ?? {};
    const getAttrTotal = (key) => system.attributes?.[key]?.totalScore ?? 0;
    const profileInfo = config.profileData?.[tech.profile] || {};

    const weapon = uses093(system) && tech.isWeapon ? attackWeapon093(this.actor, tech).item : null;
    const highTech = weapon?.system.qualities?.some(quality => quality.qualityKey === "high_tech");
    let damageAttr = getAttrTotal(highTech ? "sc" : tech.foundation === "Magic" ? "ma" : "fo");
    // Crushing: "Reduce the bonus to your Wound Roll from your Force by 1/2" (attacking.txt)
    if (tech.profile === "Crushing" && !uses093(system)) damageAttr = Math.floor(damageAttr / 2);
    if (uses093(system) && (tech.disadvantages || []).some(row => row.name === "Low-Power Crush")) {
      damageAttr = Math.floor(damageAttr / 2);
    }
    // Powered: double damage attribute
    let extraDamageAttr = tech.profile === "Powered" ? damageAttr : 0;

    // Power Shot bonus
    let powerShotBonus = 0;
    for (const adv of (tech.advantages || [])) {
      if (adv.name === "Power Shot") powerShotBonus += (adv.ranks || 1) * 2 * tier;
    }
    // Low Penetration penalty
    let lowPenPenalty = 0;
    for (const dis of (tech.disadvantages || [])) {
      if (dis.name === "Low Penetration") lowPenPenalty += (dis.ranks || 1) * tier;
    }

    const charges = uses093(system) ? signatureEnergyCharges093(tech, system) : (tech.baseEnergyCharges || 0) + (tech.extraEnergyCharges || 0);
    // Unified wound buff total (talents, states, maneuvers, custom buffs)
    const woundBuffTotal = system.aptitudes?.woundBuffTotal ?? 0;
    // Per-foundation wound bonuses — buffs "Wound (Physical/Energy/Magic)" plus
    // talent automation (Magic Blaster/Warrior variants write into these).
    const foundationWoundBuff = Number({
      Physical: system.aptitudes?.woundPhysical,
      Energy: system.aptitudes?.woundEnergy,
      Magic: system.aptitudes?.woundMagic
    }[tech.foundation]) || 0;
    // Unarmed Physical Attack (Physical ST without the Weapon flag):
    // Iron Fist +2(T) Wound and "Unarmed Wound" custom buffs.
    const unarmedWoundBuff = (tech.foundation === "Physical" && !tech.isWeapon)
      ? (system.aptitudes?.unarmedWound || 0) : 0;
    // "Armed Wound" custom buff — weapon-based STs (mirror of unarmed)
    const armedWoundBuff = tech.isWeapon ? (system.aptitudes?.armedWound || 0) : 0;
    // All-Out Start: +1(bT) Wound on Signature Techniques while NOT Holding Back
    const allOutSigWound = (system.tracking?.holdingBackStacks || 0) === 0
      ? (system.aptitudes?.allOutStartSigWound || 0) : 0;
    let totalMod = damageAttr + extraDamageAttr + powerShotBonus - lowPenPenalty + woundBuffTotal + foundationWoundBuff + unarmedWoundBuff + armedWoundBuff + allOutSigWound;

    if (uses093(system) && (tech.advantages || []).some(row => row.name === "Last Legs")) {
      totalMod += (system.thresholds?.penalties || 0) + (system.thresholds?.crossedCount || 0) * tier;
    }

    totalMod += weaponRollModifiers093(system, weapon, tech.profile).wound;

    // Aura wound bonus (Powerful Aura advantage)
    const activeAura = this.actor._getSelfBenefitAura(system);
    if (activeAura) {
      for (const adv of (activeAura.advantages || [])) {
        if (adv.name === "Powerful Aura") {
          const powerStacks = system.tracking?.powerStacks || 0;
          totalMod += ((adv.ranks || 1) + powerStacks) * tier;
        }
      }
    }

    const combatStates = system.combatStates || {};
    const isImpediment = (system.conditions || []).some(c => c.id === "impediment" && c.active);
    const dp = system.dicePools || {};
    const topCat = dp.topCatBonus || {};
    const grApply = dp.greaterApplyCount || {};
    const topCatBonus = (topCat.global || 0) + (topCat.wound || 0);
    const sig = dp.signature;
    const topDice = this._applyTopCount(system, "wound", this._resolveExtraDice(tier, 0, topCatBonus),
      (sig?.topAll || 0) + (sig?.topWound || 0));
    const hasGreater = !isImpediment && (combatStates.superior || (grApply.global || 0) > 0 || (grApply.wound || 0) > 0);
    const grCatBonus = greaterDiceCategoryBonus(system, "wound");
    const greaterDice = hasGreater ? this._resolveExtraDice(tier, 1, grCatBonus) : "";
    // Sig Techs use d8 for energy charges: "1d8(T) if that Attacking Maneuver is a
    // Signature Technique" (attacking.txt). Maximum Charge (signature.txt:765,
    // Ultimate only): charge Extra Dice go up one Dice Category (d8 → d10).
    const hasMaxCharge = (tech.advantages || []).some(a => a.name === "Maximum Charge");
    // Charge die chain with the "Energy Charge Dice Category" and "Signature
    // Energy Charge Dice Category" buffs (previously dead aptitudes)
    const chargeDie = energyChargeDie(system.aptitudes, { signature: true, maximumCharge: hasMaxCharge });
    let chargesExtra = charges > 0 ? `+${charges * tier}${chargeDie}` : "";
    if (tech.profile === "Mega Flare" && charges > 0) chargesExtra += `+${charges * tier}`;
    // Super Stack wound extra dice (Physical/Energy foundations only)
    const ssWoundDice = (tech.foundation === "Physical" || tech.foundation === "Energy")
      ? (system.aptitudes?.superStackWoundDice || "") : "";
    const ssExtra = ssWoundDice ? `+${ssWoundDice}` : "";
    // Combat State Wound Extra Dice — Signature Techniques are Attacking
    // Maneuvers, so the Raging (+1d4(T), Aspect-bumped) and Surging (+1d4(T))
    // states apply to their Wound Rolls just like Basic Attacks.
    const ragingExtra = this._ragingWoundDice(system, tier);
    if (uses093(system)) totalMod -= stateLevel(system, "mindful") * tier;
    const surgingExtra = combatStates.surging && !uses093(system) ? `+${this._surgingWoundDice(system, tier)}` : "";
    // Synthetic Muscle (cybernetic trait): +1d4(T) Wound on Physical/Energy attacks
    const synthExtra = (system._cyberSynthWoundDice && (tech.foundation === "Physical" || tech.foundation === "Energy"))
      ? `+${this._scaleDiceByTier("1d4", tier)}` : "";
    totalMod += sig?.woundBonus || 0;
    const formula = this._buildFormula(topDice, greaterDice, totalMod, chargesExtra + ssExtra + ragingExtra + surgingExtra + synthExtra + this._extraDicePool(system, "wound") + signatureBuffDice(system, "wound"));

    let damageCat = profileInfo.damageCat || "Standard";
    if (tech.profile === "Mega Flare" && charges >= 7) damageCat = "Direct";

    const weaponCategoryBonus = system.equipmentFlags?.weaponDamageCatBonus?.[weapon?.id] || 0;
    return { formula, damageCat: shiftAttackDamageCategory(damageCat,
      (system.aptitudes?.attackingDamageCategory || 0) + weaponCategoryBonus) };
  },

  _calcTechCT(tech, system) {
    const { strikeCT, woundCT, dodgeCT } = this._calcCombatCTs(system, {
      isWeapon: !!tech.isWeapon,
      foundation: tech.foundation || "",
      profile: tech.profile || "",
      isSignature: true
    });
    const notes = [];
    const talents = system.talents || [];

    if (talents.includes("precision_kata")) notes.push("Precision Kata: Strike CT -1 (Focused only)");
    if (talents.includes("brutal_kata")) notes.push("Brutal Kata: Wound CT -1 (Focused only)");
    if (talents.includes("critical_specialist") && !tech.isWeapon) {
      notes.push("Critical Specialist: Strike CT -1 (Armed Attacks only)");
    }
    if (talents.includes("artful_strike")) notes.push("Artful Strike: 1 below CT = Critical (Strike, 1/Rnd)");
    // Note: "1 below CT = Critical (Wound)" is handled by Aggressive/Defensive Style triggered effects

    return { strikeCT, woundCT, dodgeCT, notes };
  },

  // -------------------------------------------------------
  // Technique CRUD
  // -------------------------------------------------------

  async _onAddTechnique(event) {
    event.preventDefault();
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const nextId = techs.length > 0 ? Math.max(...techs.map(t => t.id || 0)) + 1 : 1;
    techs.push({
      id: nextId, name: "New Technique", type: "signature",
      foundation: "Physical", profile: "Simple", description: "",
      tpMax: 10, freeTP: 0, baseEnergyCharges: 0, extraEnergyCharges: 0,
      isLimitBreak: false, isWeapon: false,
      advantages: [], disadvantages: []
    });
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onDeleteTechnique(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const techId = Number(event.currentTarget.dataset.techniqueId);
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const idx = techs.findIndex(t => t.id === techId);
    if (idx > -1) {
      if (!(await this._confirmDelete("Signature Technique", techs[idx].name))) return;
      techs.splice(idx, 1);
      await this.actor.update({ "system.signatureTechniques": techs });
    }
  },

  async _onTechniqueFieldChange(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const techId = Number(el.dataset.techId);
    const field = el.dataset.field;
    if (isNaN(techId) || !field) return;
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    if (uses093(this.actor.system) && field === "startingTechnique" && el.checked) {
      if (!startingTechniqueAvailable093(this.actor.system)) {
        el.checked = false;
        ui.notifications.warn("A técnica inicial é liberada no Martial Level 3.");
        return;
      }
      if (!startingTechniqueEligible093(tech, this.actor.system)) {
        el.checked = false;
        ui.notifications.warn("A técnica inicial deve ser válida, custar até 20 TP e não pode ser Dramatic Finisher.");
        return;
      }
      for (const entry of techs) entry.startingTechnique = entry === tech;
    }
    if (el.type === "checkbox") tech[field] = el.checked;
    else if (el.type === "number") tech[field] = Number(el.value) || 0;
    else tech[field] = el.value;
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onTechStyleToggle(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const btn = event.currentTarget;
    const card = btn.closest(".signature-technique-card");
    if (!card) return;
    const techId = Number(card.dataset.techniqueId);
    const isWeapon = btn.dataset.style === "weapon";
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    tech.isWeapon = isWeapon;
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onAddTechAdvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const techId = Number(event.currentTarget.dataset.techniqueId);
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    if (!tech.advantages) tech.advantages = [];
    tech.advantages.push({ name: "", ranks: 1, notes: "", tpCost: 0, dynamicTP: 0 });
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onRemoveTechAdvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const techId = Number(event.currentTarget.dataset.techniqueId);
    const advIndex = Number(event.currentTarget.dataset.advIndex);
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech || !tech.advantages) return;
    tech.advantages.splice(advIndex, 1);
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onTechAdvField(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const techId = Number(el.dataset.techId);
    const advIndex = Number(el.dataset.advIndex);
    const field = el.dataset.field;
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech?.advantages?.[advIndex]) return;
    const advantage = tech.advantages[advIndex];
    if (field === "name") {
      if (uses093(this.actor.system) && el.value && tech.advantages.some((row, index) => index !== advIndex && row.name === el.value)) {
        el.value = advantage.name;
        ui.notifications.warn("Ajuste os ranks na linha existente desta vantagem.");
        return;
      }
      tech.advantages[advIndex].name = el.value;
      advantage.freeRanks = 0;
      advantage.grantSource = "";
      // Keep ranks, but clamp them to the new advantage's maxRanks
      const maxR = CONFIG.DBU?.techniqueAdvantagesData?.[el.value]?.maxRanks || 99;
      tech.advantages[advIndex].ranks = Math.min(tech.advantages[advIndex].ranks || 1, maxR);
      tech.advantages[advIndex].tpCost = this._lookupAdvTP(el.value, tech.advantages[advIndex].ranks);
    } else if (field === "ranks") {
      const advName = tech.advantages[advIndex].name;
      const maxR = CONFIG.DBU?.techniqueAdvantagesData?.[advName]?.maxRanks || 99;
      let r = Math.max(1, Math.trunc(Number(el.value)) || 1);
      if (r > maxR) { ui.notifications.warn(`${advName} allows at most ${maxR} rank(s).`); r = maxR; }
      tech.advantages[advIndex].ranks = r;
      tech.advantages[advIndex].tpCost = this._lookupAdvTP(advName, r);
      advantage.freeRanks = Math.min(r, advantage.freeRanks || 0);
    } else if (field === "freeRanks") {
      advantage.freeRanks = Math.max(0, Math.min(advantage.ranks || 1, Math.trunc(Number(el.value)) || 0));
    } else if (field === "dynamicTP") {
      tech.advantages[advIndex].dynamicTP = Number(el.value) || 0;
    } else {
      tech.advantages[advIndex][field] = el.value;
    }
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onAddTechDisadvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const techId = Number(event.currentTarget.dataset.techniqueId);
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    if (!tech.disadvantages) tech.disadvantages = [];
    tech.disadvantages.push({ name: "", ranks: 1, notes: "", tpCost: 0, dynamicTP: 0 });
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onRemoveTechDisadvantage(event) {
    event.preventDefault();
    if (event.currentTarget.closest('.gained-ability')) return;
    const techId = Number(event.currentTarget.dataset.techniqueId);
    const disadvIndex = Number(event.currentTarget.dataset.disadvIndex);
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech || !tech.disadvantages) return;
    tech.disadvantages.splice(disadvIndex, 1);
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  async _onTechDisadvField(event) {
    if (event.currentTarget.closest('.gained-ability')) return;
    const el = event.currentTarget;
    const techId = Number(el.dataset.techId);
    const disadvIndex = Number(el.dataset.disadvIndex);
    const field = el.dataset.field;
    const techs = foundry.utils.deepClone(this.actor.system.signatureTechniques || []);
    const tech = techs.find(t => t.id === techId);
    if (!tech?.disadvantages?.[disadvIndex]) return;
    if (field === "name") {
      if (uses093(this.actor.system) && el.value && tech.disadvantages.some((row, index) => index !== disadvIndex && row.name === el.value)) {
        el.value = tech.disadvantages[disadvIndex].name;
        ui.notifications.warn("Ajuste os ranks na linha existente desta desvantagem.");
        return;
      }
      tech.disadvantages[disadvIndex].name = el.value;
      const maxR = CONFIG.DBU?.techniqueDisadvantagesData?.[el.value]?.maxRanks || 99;
      tech.disadvantages[disadvIndex].ranks = Math.min(tech.disadvantages[disadvIndex].ranks || 1, maxR);
      tech.disadvantages[disadvIndex].tpCost = this._lookupDisadvTP(el.value, tech.disadvantages[disadvIndex].ranks);
    } else if (field === "ranks") {
      const disName = tech.disadvantages[disadvIndex].name;
      const maxR = CONFIG.DBU?.techniqueDisadvantagesData?.[disName]?.maxRanks || 99;
      let r = Math.max(1, Math.trunc(Number(el.value)) || 1);
      if (r > maxR) { ui.notifications.warn(`${disName} allows at most ${maxR} rank(s).`); r = maxR; }
      tech.disadvantages[disadvIndex].ranks = r;
      tech.disadvantages[disadvIndex].tpCost = this._lookupDisadvTP(disName, r);
    } else if (field === "dynamicTP") {
      tech.disadvantages[disadvIndex].dynamicTP = Number(el.value) || 0;
    } else {
      tech.disadvantages[disadvIndex][field] = el.value;
    }
    await this.actor.update({ "system.signatureTechniques": techs });
  },

  /** Look up total TP for an advantage at given rank count. */
  _lookupAdvTP(name, ranks) {
    const data = CONFIG.DBU?.techniqueAdvantagesData?.[name];
    if (!data) return 0;
    const perRank = Array.isArray(data.tpPerRank) ? data.tpPerRank : [data.tpPerRank || 0];
    let total = 0;
    for (let i = 0; i < ranks; i++) total += perRank[Math.min(i, perRank.length - 1)] || 0;
    return total;
  },

  /** Look up total TP for a disadvantage at given rank count. */
  _lookupDisadvTP(name, ranks) {
    const data = CONFIG.DBU?.techniqueDisadvantagesData?.[name];
    if (!data) return 0;
    const perRank = Array.isArray(data.tpPerRank) ? data.tpPerRank : [data.tpPerRank || 0];
    let total = 0;
    for (let i = 0; i < ranks; i++) total += perRank[Math.min(i, perRank.length - 1)] || 0;
    return total;
  },
};
