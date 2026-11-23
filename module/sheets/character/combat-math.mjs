import { martialDie, martialEnergyCharges } from "../../rules/path-to-power-v093.mjs";
import { energyChargeDie, greaterDiceCategoryBonus, shiftAttackDamageCategory } from "../../helpers/custom-buffs.mjs";
import { PROFILES_093 } from "../../rules/profiles-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";
import { attackPowerShot093, attackReferenceKiCost093, grantedAdvantageRanks093 } from "../../rules/techniques-v093.mjs";


/** Character sheet domain: combat-math. Methods run with the sheet as this. */
export const combatMathMethods = {

  _getConditionStacks(system, id) {
    const c = (system.conditions || []).find(c => c.id === id);
    return (c && c.active) ? (c.stacks || 1) : 0;
  },

  /**
   * Dice Category chain (core-rules.txt:99):
   * 1d4, 1d6, 1d8, 1d10, 1d10+1d4, 1d10+1d6, 1d10+1d8, 2d10, 2d10+1d4, ...
   * Returns the roll formula for a 0-based index into that chain.
   */
  _diceCategoryFormula(idx) {
    const base = ["1d4", "1d6", "1d8"];
    if (idx < 3) return base[Math.max(0, idx)];
    const k = idx - 3;
    const n10 = 1 + Math.floor(k / 4);
    const rem = k % 4;
    const extra = rem === 0 ? "" : `+1d${[0, 4, 6, 8][rem]}`;
    return `${n10}d10${extra}`;
  },

  /**
   * Critical Result Extra Dice (core-rules.txt:107): starts at 1d6, Dice
   * Category +1 per Tier of Power after the first. T1=1d6, T2=1d8, T3=1d10,
   * T4=1d10+1d4, ... (1d6 sits at chain index 1, so index = tier).
   * The Mindful Aspect (transformation-aspects.txt:61) bumps this Dice Category
   * by 1 per aspect level while in the Mindful State (criticalExtraDiceCatBonus,
   * already gated to Mindful-State-only in actor.mjs).
   */
  _critExtraFormula(tier) {
    const mindfulBonus = this.actor?.system?.aptitudes?.criticalExtraDiceCatBonus || 0;
    return this._diceCategoryFormula(Math.max(1, Number(tier) || 1) + mindfulBonus);
  },

  /**
   * Multiply every die in a dice expression by tier — applies the (T)
   * multiplier across a Dice Category, including all dice from wrapping
   * (core-rules.txt:100). e.g. ("1d10+1d4", 2) → "2d10+2d4".
   */
  _scaleDiceByTier(diceStr, tier) {
    return String(diceStr).replace(/(\d+)(d\d+)/g, (_, n, d) => `${Number(n) * (tier || 1)}${d}`);
  },

  /**
   * Wound Roll Extra Dice from the Raging Combat State: +1d4(T) (states.txt:23).
   * The Raging Aspect increases the Dice Category of this Extra Dice by 1 per
   * level while in the Raging State (transformation-aspects.txt:82); the
   * "Raging Dice Size" buff adds further category increases. Returns "" when
   * not in the Raging State.
   */
  _ragingWoundDice(system, tier) {
    if (!system.combatStates?.raging) return "";
    const catBonus = (system.aptitudes?.ragingExtraDiceCatBonus || 0)
      + (system.aptitudes?.ragingDiceSize || 0);
    // Base 1d4 sits at chain index 0; the aspect/buff bumps it up the ladder.
    return `+${this._scaleDiceByTier(this._diceCategoryFormula(catBonus), tier)}`;
  },

  /**
   * Surging State Wound Extra Dice: base 1d4(T); the "Surging Dice Size" buff
   * bumps the die category and "Surging Extra Dice" adds flat dice on top —
   * both aptitudes were previously computed but never consumed.
   */
  _surgingWoundDice(system, tier) {
    const chain = ["d4", "d6", "d8", "d10", "d12"];
    const cat = Math.max(0, Math.min(system.aptitudes?.surgingDiceSize || 0, chain.length - 1));
    const count = tier + (system.aptitudes?.surgingExtraDice || 0);
    return `${count}${chain[cat]}`;
  },

  /**
   * Unified Critical Targets for combat rolls. Aggregates:
   * - Talents: Focused Strike / Powerful Strike / Instinctual Evasion (-1 each),
   *   Critical Specialist (-1 Strike, Armed Attacks only)
   * - Mindful combat state (transformation aspect): -1 to all combat CTs
   * - CT buffs (actor.mjs aptitudes): strikeCTBonus, woundCTBonus + per-foundation,
   *   dodgeCTBonus, and bestial Return to Heritage (dodge -1)
   * - Rules clamp: CT can never go below 7 (core-rules.txt:105).
   * NOTE: the legacy "Cutting → Wound CT 5" override was removed — the Cutting
   * profile only sets base Damage Category to Lethal and modifies the Strike
   * (attacking.txt:181); it never touches the Critical Target.
   */
  _calcCombatCTs(system, { isWeapon = false, foundation = "", profile = "", isSignature = false } = {}) {
    const talents = system.talents || [];
    const apt = system.aptitudes || {};
    const mindful = system.combatStates?.mindful ? 1 : 0;
    const clamp = (v) => Math.max(7, Math.min(10, v));

    let strikeCT = 10 - mindful - (Number(apt.strikeCTBonus) || 0);
    if (talents.includes("focused_strike")) strikeCT -= 1;
    if (isWeapon) strikeCT -= (talents.includes("critical_specialist") ? 1 : 0) + (apt.armedStrikeCT || 0);
    // Per-foundation Strike CT buffs ("Strike CT (Physical/Energy/Magic)") —
    // previously computed but never applied (the wound mirror below was).
    const perFoundationStrike = {
      Physical: apt.strikeCTPhysical, Energy: apt.strikeCTEnergy, Magic: apt.strikeCTMagic
    }[foundation];
    strikeCT -= Number(perFoundationStrike) || 0;

    let woundCT = 10 - mindful - (Number(apt.woundCTBonus) || 0);
    if (talents.includes("powerful_strike")) woundCT -= 1;

    // Archetype Focus L1: −1 CT on Strike & Wound with the chosen Foundation
    if (foundation && talents.includes("archetype_focus")
        && system.talentSelections?.archetypeFocusFoundation === foundation) {
      strikeCT -= 1;
      woundCT -= 1;
    }
    const perFoundation = {
      Physical: apt.woundCTPhysical, Energy: apt.woundCTEnergy, Magic: apt.woundCTMagic
    }[foundation];
    woundCT -= Number(perFoundation) || 0;

    let dodgeCT = 10 - mindful - (Number(apt.dodgeCTBonus) || 0)
      - (Number(system._bestialDodgeCritReduction) || 0);
    if (talents.includes("instinctual_evasion")) dodgeCT -= 1;

    if (isSignature) {
      strikeCT -= system.dicePools?.signature?.ctStrike || 0;
      woundCT -= system.dicePools?.signature?.ctWound || 0;
    }
    strikeCT = clamp(strikeCT);
    woundCT = uses093(system) && profile === "Cutting" ? 5 : clamp(woundCT);
    dodgeCT = clamp(dodgeCT);

    return { strikeCT, woundCT, dodgeCT };
  },

  // -------------------------------------------------------
  // Data Prep: Attack Reference
  // -------------------------------------------------------

  _prepareAttackRefData(context, system) {
    const config = CONFIG.DBU ?? {};
    const profileData = config.profileData || {};
    const tier = system.tier || 1;
    const baseTier = system.baseTier || 1;
    const maxCap = system.status?.maxCapacity || 0;
    const defaultWager = Math.floor(maxCap / 2);

    // Dice pool category bonuses
    const dp = system.dicePools || {};
    const topCat = dp.topCatBonus || {};
    // topApplyCount: Phase 2 — "apply additional times" effects
    const grApply = dp.greaterApplyCount || {};

    const getTopDice = (rollType) => {
      const catBonus = (topCat.global || 0) + (topCat[rollType] || 0);
      return this._applyTopCount(system, rollType, this._resolveExtraDice(tier, 0, catBonus));
    };

    // --- Combat State Modifiers ---
    const combatStates = system.combatStates || {};
    const isImpediment = (system.conditions || []).some(c => c.id === "impediment" && c.active);

    const getGreaterDice = (rollType) => {
      if (isImpediment) return "";
      const hasGreater = combatStates.superior || (grApply.global || 0) > 0 || (grApply[rollType] || 0) > 0;
      if (!hasGreater) return "";
      const catBonus = greaterDiceCategoryBonus(system, rollType);
      return this._resolveExtraDice(tier, 1, catBonus);
    };

    const strikeTopDice = getTopDice("strike");
    const strikeGreaterDice = getGreaterDice("strike");
    const woundTopDice = getTopDice("wound");
    const woundGreaterDice = getGreaterDice("wound");
    const dodgeTopDice = getTopDice("dodge");
    const dodgeGreaterDice = getGreaterDice("dodge");
    let stateStrikeMod = 0;   // flat bonus to strike
    let stateWoundMod = 0;    // flat bonus to wound
    let stateAllMod = 0;      // flat bonus to ALL combat rolls
    let stateStrikeExtra = ""; // dice expressions for strike
    let stateWoundExtra = "";  // dice expressions for wound

    // Raging: +1d4(T) Wound Rolls, Dice Category bumped by the Raging Aspect.
    stateWoundExtra += this._ragingWoundDice(system, tier);
    // Surging: +1d4(T) Strike & Wound Rolls (vs targeted opponent) — die
    // category/count adjustable via the Surging buffs (_surgingWoundDice)
    if (combatStates.surging) {
      const surgingDice = this._surgingWoundDice(system, tier);
      stateStrikeExtra += `+${surgingDice}`;
      stateWoundExtra += `+${surgingDice}`;
    }
    // Mindful: -1(T) Wound Rolls
    if (combatStates.mindful) stateWoundMod -= tier;
    // Undying: -1(T) all Combat Rolls
    if (combatStates.undying) stateAllMod -= tier;
    // Combat Critical Target — unified (talents, Mindful, CT buffs)
    context.combatCT = `${this._calcCombatCTs(system).strikeCT}+`;

    // Build foundation→profiles map for template selects
    const foundationProfiles = { Physical: [], Energy: [], Magic: [] };
    for (const [name, data] of Object.entries(profileData)) {
      for (const f of (data.foundations || [])) {
        if (foundationProfiles[f]) foundationProfiles[f].push(name);
      }
    }
    context.foundationProfilesJSON = JSON.stringify(foundationProfiles);

    // Helper to get attr mod
    const getAttr = (key) => {
      const a = system.attributes?.[key];
      return a?.totalScore ?? a?.score ?? 0;
    };

    const ag = getAttr("ag");
    const fo = getAttr("fo");
    const ma = getAttr("ma");
    const inAttr = getAttr("in");

    // Check conditions
    const isCondActive = (id) => {
      const c = (system.conditions || []).find(c => c.id === id);
      return c?.active ?? false;
    };
    const condStacks = (id) => {
      const c = (system.conditions || []).find(c => c.id === id);
      return c?.stacks ?? 0;
    };
    const isProne = isCondActive("prone");
    const isShaken = isCondActive("shaken");
    const guardDown = isCondActive("guardDown");
    const eqPenalty = system.equipment?.combatPenalty || 0;

    // Active aura bonuses (Sparking Combat Rolls flow via strike/dodge/wound
    // derived-buff totals now)
    const activeAura = this.actor._getSelfBenefitAura(system);
    let auraWoundBonus = 0;
    if (activeAura) {
      for (const adv of (activeAura.advantages || [])) {
        if (adv.name === "Powerful Aura") {
          const powerStacks = system.tracking?.powerStacks || 0;
          auraWoundBonus += ((adv.ranks || 1) + powerStacks) * tier;
        }
      }
    }

    // Weapon lookup for Attack Refs: "Weapon Equipped" stores the weapon item's
    // name; resolving it here lets Size, Weapon Penalty and quality bonuses flow
    // into the Strike/Wound formulas (weapons.txt).
    const weaponItemsByName = new Map();
    for (const it of this.actor.items) {
      if (it.type === "equipment" && it.system.equipmentType === "weapon")
        weaponItemsByName.set(it.name.trim().toLowerCase(), it);
    }
    context.weaponOptions = [...weaponItemsByName.values()].map(it => it.name).sort((a, b) => a.localeCompare(b));
    const hasWeaponSpecialist = (system.talents || []).includes("weapon_specialist") || system.aptitudes?.ignoreWeaponPenalty;
    const eqFlags = system.equipmentFlags || {};

    // Prepare each attack ref card with calculated formulas
    const refs = system.attackRefs || [];
    context.attackRefs = refs.map((ref, idx) => {
      const profile = profileData[ref.profile] || {};
      const charges = martialEnergyCharges(system, (ref.energyCharges || 0) + (uses093(system) ? ((PROFILES_093[ref.profile]?.freeCharges || 0) + (PROFILES_093[ref.profile]?.freeChargesOutsideLimit || 0)) : 0));
      const wager = ref.kiWager || 0;
      const revised = uses093(system);
      const ps = revised ? attackPowerShot093(ref) : ref.powerShot || 0;
      const targetRange = ref.targetRange || 0;

      // --- WEAPON (Armed Attack) ---
      const wKey = String(ref.weaponEquipped || "").trim().toLowerCase();
      const wItem = (wKey && wKey !== "unarmed") ? weaponItemsByName.get(wKey) : null;
      let weaponStrikeMod = 0, weaponWoundMod = 0, weaponDamageCatBonus = 0;
      const weaponNotes = [];
      if (wItem) {
        // Weapon Penalty (weapons.txt): -2(T) Strike, removed by Weapon Specialist
        if (!hasWeaponSpecialist) {
          weaponStrikeMod -= 2 * tier;
          weaponNotes.push(`Weapon Penalty −${2 * tier} Strike (no Weapon Specialist)`);
        }
        // Weapon Size
        const wSize = wItem.system.weaponSize || "standard";
        if (wSize === "small") {
          weaponStrikeMod += tier; weaponWoundMod -= 2 * tier;
          weaponNotes.push(`Small: +${tier} Strike, −${2 * tier} Wound`);
        } else if (wSize === "big") {
          weaponStrikeMod -= tier; weaponWoundMod += 2 * tier;
          weaponNotes.push(`Big: −${tier} Strike, +${2 * tier} Wound`);
        }
        // Quality effects (equipmentFlags maps are only populated while the
        // weapon is Equipped in the Equipment tab)
        if (wItem.system.worn) {
          const qWound = (eqFlags.weaponWoundBonus || {})[wItem.id] || 0;
          const qStrike = (eqFlags.weaponStrikePenalty || {})[wItem.id] || 0;
          if (qWound) { weaponWoundMod += qWound; weaponNotes.push(`Qualities: +${qWound} Wound`); }
          if (qStrike) { weaponStrikeMod += qStrike; weaponNotes.push(`Qualities: ${qStrike} Strike`); }
          weaponDamageCatBonus = (eqFlags.weaponDamageCatBonus || {})[wItem.id] || 0;
          if ((eqFlags.weaponLongRangeStrikeBonus || {})[wItem.id] && targetRange >= 9) {
            weaponStrikeMod += (eqFlags.weaponLongRangeStrikeBonus || {})[wItem.id];
            weaponNotes.push(`Long Range Weapon: +${(eqFlags.weaponLongRangeStrikeBonus || {})[wItem.id]} Strike`);
          }
        } else {
          weaponNotes.push("Not Equipped in the Equipment tab — quality effects inactive");
        }
        // Broken weapon (0 LP) cannot attack — the tracker roll enforces the block
        const wMax = this._calcWeaponLPMax(wItem);
        const wUnbreakable = (wItem.system.qualities || []).some(q => q.qualityKey === "unbreakable");
        if (!wUnbreakable && wMax - (wItem.system.weaponLPDamage || 0) <= 0) {
          weaponNotes.push("BROKEN (0 LP) — cannot be used until repaired");
        }
      } else if (wKey && wKey !== "unarmed") {
        weaponNotes.push(`No weapon named "${ref.weaponEquipped}" in the Equipment tab`);
      }

      // --- STRIKE ---
      let haste = system.aptitudes?.haste ?? 0;
      let awareness = system.aptitudes?.awareness ?? 0;
      if (isProne) haste = Math.floor(haste / 2);
      // Cutting: "1/2 (rounded up) of your Haste and 3/4 of your Awareness" (attacking.txt)
      if (ref.profile === "Cutting" && !uses093(system)) {
        haste = Math.ceil(haste / 2);
        awareness = Math.floor(awareness * 3 / 4);
      }
      if (uses093(system) && ref.profile === "Crushing") haste = Math.floor(haste / 2);
      const strikePenShaken = isShaken ? 2 * tier : 0;
      // Long Range threshold: 9 + sizes-above-Large + "Long Range Distance"
      // buff (status.longRangeNumeric — the hardcoded 9 ignored both).
      // Poor Eyesight L2 (custom species flaw): −1(T) Combat Rolls vs Long
      // Range targets (longRangeCombatRollPenalty was written but never read).
      const lrThreshold = system.status?.longRangeNumeric || 9;
      const isAtLongRange = targetRange >= lrThreshold;
      const lrEyesightPen = isAtLongRange ? (system.aptitudes?.longRangeCombatRollPenalty || 0) : 0;
      const strikePenLR = (isAtLongRange ? 2 * baseTier : 0) + lrEyesightPen;
      // Diminishing Offense is NOT baked into the prep formula — it's applied
      // dynamically at roll time from the auto attack counter (see
      // _onRollTrackerAttack), so the same formula stays valid all round.
      // Super Stack Strike penalty: -1(T) per stack (attributes.txt)
      const ssPenStrike = system.aptitudes?.superStackStrikePenalty ?? 0;
      // Unified strike buff total (talents, states, maneuvers, custom buffs)
      const strikeBuffTotal = system.aptitudes?.strikeBuffTotal ?? 0;
      const foundationStrikeBuff = Number({
        Physical: system.aptitudes?.strikePhysical,
        Energy: system.aptitudes?.strikeEnergy,
        Magic: system.aptitudes?.strikeMagic
      }[ref.foundation]) || 0;
      // Unarmed Physical Attack: Physical foundation with no weapon selected —
      // Rapid Fist (+1(T) Strike) / Iron Fist (+2(T) Wound) and "Unarmed
      // Strike/Wound" custom buffs (aptitudes.unarmedStrike/unarmedWound).
      const isUnarmed = ref.foundation === "Physical" && !wItem;
      const unarmedStrikeBuff = (isUnarmed ? (system.aptitudes?.unarmedStrike || 0) : 0)
        + (!wItem ? (system.aptitudes?.unarmedAttackStrike || 0) : 0);
      let unarmedWoundBuff = isUnarmed ? (system.aptitudes?.unarmedWound || 0) : 0;
      // "Armed Strike/Wound" custom buffs — apply when a weapon IS selected
      // (mirror of the unarmed pair; aptitudes were written but never read).
      const armedStrikeBuff = wItem ? (system.aptitudes?.armedStrike || 0) : 0;
      const armedWoundBuff = wItem ? (system.aptitudes?.armedWound || 0) : 0;

      // Close Range Shot / Far Shot: range-gated Wound on Unarmed Energy/Magic
      // attacks (gate on the ref's Target Range vs melee reach).
      const isUnarmedEM = (ref.foundation === "Energy" || ref.foundation === "Magic") && !wItem;
      if (isUnarmedEM) {
        const reachM = String(system.status?.meleeReach || "1").match(/^1\+(\d+)/);
        const meleeReachNum = 1 + (reachM ? Number(reachM[1]) : 0);
        const refTalents = system.talents || [];
        if (refTalents.includes("close_range_shot") && targetRange <= meleeReachNum) {
          unarmedWoundBuff += 2 * tier;
        }
        if (refTalents.includes("far_shot") && targetRange > meleeReachNum) {
          unarmedWoundBuff += (targetRange >= 8 ? 3 : 1) * tier;
        }
      }
      const strikeMod = haste + awareness - strikePenShaken - strikePenLR - eqPenalty - ssPenStrike + strikeBuffTotal + stateAllMod + foundationStrikeBuff + weaponStrikeMod + unarmedStrikeBuff + armedStrikeBuff;
      const grantedAccurate = revised ? grantedAdvantageRanks093(ref, "Accurate") * tier : 0;
      const grantedLongShot = revised && targetRange >= 9 ? grantedAdvantageRanks093(ref, "Long Shot") * tier : 0;
      const strikeFormula = this._buildFormula(strikeTopDice, strikeGreaterDice, strikeMod + grantedAccurate + grantedLongShot, stateStrikeExtra + this._extraDicePool(system, "strike"));

      // --- WOUND ---
      const isMagic = ref.foundation === "Magic";
      let damageAttr = isMagic ? ma : fo;
      // Crushing: "Reduce the bonus to your Wound Roll from your Force by 1/2" (attacking.txt)
      if (ref.profile === "Crushing" && !uses093(system)) damageAttr = Math.floor(damageAttr / 2);
      const isPowered = ref.profile === "Powered";
      const extraDmgAttr = isPowered ? damageAttr : 0;
      const woundPSBonus = ps * 2 * tier;
      // Unified wound buff total (talents, states, maneuvers, custom buffs)
      const woundBuffTotal = system.aptitudes?.woundBuffTotal ?? 0;
      const foundationWoundBuff = Number({
        Physical: system.aptitudes?.woundPhysical,
        Energy: system.aptitudes?.woundEnergy,
        Magic: system.aptitudes?.woundMagic
      }[ref.foundation]) || 0;
      const woundMod = damageAttr + extraDmgAttr + wager + woundPSBonus + auraWoundBonus + stateWoundMod + stateAllMod + woundBuffTotal + foundationWoundBuff + weaponWoundMod + unarmedWoundBuff + armedWoundBuff - lrEyesightPen;
      // Attack Refs are Basic Attacking Maneuvers (not Signature Techniques),
      // so per attacking.txt:31 each Energy Charge adds 1d6(T) to the Wound Roll
      // (Sig Techs use d8 — handled separately in _calcTechWound).
      const chargesStr = (charges > 0 ? `+${charges * tier}${energyChargeDie(system.aptitudes)}` : "") + (uses093(system) && ref.profile === "Mega Flare" && charges > 0 ? `+${charges * tier}` : "");
      // Super Stack Extra Dice: "+1d4(T), increasing dice category per stack after first" (attributes.txt)
      const ssWoundDice = system.aptitudes?.superStackWoundDice || "";
      const ssWoundExtra = (ssWoundDice && (ref.foundation === "Physical" || ref.foundation === "Energy"))
        ? `+${ssWoundDice}` : "";
      // Synthetic Muscle (cybernetic trait): +1d4(T) Wound on Physical/Energy attacks
      const cyberSynthExtra = (system._cyberSynthWoundDice && (ref.foundation === "Physical" || ref.foundation === "Energy"))
        ? `+${this._scaleDiceByTier("1d4", tier)}` : "";
      const woundFormula = this._buildFormula(woundTopDice, woundGreaterDice, woundMod + grantedLongShot, chargesStr + ssWoundExtra + stateWoundExtra + cyberSynthExtra + this._extraDicePool(system, "wound"));
      let damageCat = profile.damageCat || "Standard";
      // Mega Flare: 7+ charges → upgrade damage category
      if (ref.profile === "Mega Flare" && charges >= 7) {
        if (damageCat === "Standard") damageCat = "Direct";
        else if (damageCat === "Direct") damageCat = "Lethal";
      }
      damageCat = shiftAttackDamageCategory(damageCat,
        weaponDamageCatBonus + (system.aptitudes?.attackingDamageCategory || 0));

      // --- DODGE ---
      // Rule: "Add your Defense Value to all Dodge Rolls" (attributes.txt)
      // DV already includes size, aura, equipment, raging, guard down, prone.
      const dv = system.aptitudes?.defenseValue ?? 0;
      // Diminishing Defense is applied dynamically at roll time from the auto
      // dodge counter (see _onRollTrackerDodge) — not baked into the formula.
      // Super Stack Dodge penalty: -1(T) per stack (attributes.txt)
      const ssPenDodge = system.aptitudes?.superStackDodgePenalty ?? 0;
      // Unified dodge buff total (talents, states, maneuvers, custom buffs)
      const dodgeBuffTotal = system.aptitudes?.dodgeBuffTotal ?? 0;
      const dodgeMod = dv - ssPenDodge + dodgeBuffTotal + stateAllMod;
      const dodgeFormula = this._buildFormula(dodgeTopDice, dodgeGreaterDice, dodgeMod, this._extraDicePool(system, "dodge"));

      // --- DUEL CLASH ---
      const bestAttr = Math.max(fo, ma);
      const clashCharges = charges * 2 * tier;
      const clashPS = ps * tier;
      const clashMod = bestAttr + clashCharges + clashPS + stateAllMod;
      const clashFormula = this._buildFormula(strikeTopDice, strikeGreaterDice, clashMod);

      // Available profiles for this foundation
      const availableProfiles = foundationProfiles[ref.foundation] || Object.keys(profileData);
      const { strikeCT, woundCT } = this._calcCombatCTs(system, {
        isWeapon: !!wKey && wKey !== "unarmed", foundation: ref.foundation, profile: ref.profile
      });

      return {
        ...ref,
        _idx: idx,
        attackName: ref.name || "Attack Reference",
        extraProfile: ref.extraProfile || "",
        profileEffect: profile.effect || "—",
        profileRange: profile.range || "—",
        profileKP: revised ? `${attackReferenceKiCost093(ref, system, this.actor._getActiveAura?.(system))} KP`
          : profile.kpCost != null ? `${profile.kpCost}(T)` : "—",
        damageCat,
        damageCatClass: `dmg-cat-${damageCat.toLowerCase()}`,
        strikeFormula, strikeCT, strikeMod: strikeMod + grantedAccurate + grantedLongShot, haste, awareness,
        woundFormula, woundCT, woundMod: woundMod + grantedLongShot, damageAttr,
        dodgeFormula, dodgeMod,
        clashFormula, clashMod,
        strikeTopDice,
        strikeGreaterDice,
        woundTopDice,
        woundGreaterDice,
        dodgeTopDice,
        dodgeGreaterDice,
        strikeTopDiceDisplay: strikeTopDice || "--",
        strikeGreaterDiceDisplay: strikeGreaterDice || "--",
        woundTopDiceDisplay: woundTopDice || "--",
        woundGreaterDiceDisplay: woundGreaterDice || "--",
        dodgeTopDiceDisplay: dodgeTopDice || "--",
        dodgeGreaterDiceDisplay: dodgeGreaterDice || "--",
        totalEnergyCharges: charges,
        maxWager: defaultWager,
        weaponEquippedLabel: ref.weaponEquipped || "Unarmed",
        weaponNotes,
        weaponStrikeMod,
        weaponWoundMod,
        weaponMatched: !!wItem,
        offHandLabel: ref.offHand || "Unarmed",
        defense: system.defense ?? 0,
        soak: system.soak ?? 0,
        availableProfiles
      };
    });

    // Profile options lists
    context.allProfiles = Object.keys(profileData).sort();
  },

  /**
   * Resolve a dice pool string given tier and category bonus steps.
   * @param {number} tier - Current Tier of Power (1-7)
   * @param {number} baseStep - Base step in the progression (0=none for ToP, 1=1d4 for Greater)
   * @param {number} catBonus - Additional category steps from effects
   * @returns {string} Dice expression like "1d8" or "1d10+1d4" or "" for none
   */
  _resolveExtraDice(tier, baseStep, catBonus = 0) {
    const DICE_CAT = ["", "1d4", "1d6", "1d8", "1d10", "1d10+1d4", "1d10+1d6", "1d10+1d8", "2d10", "2d10+1d4", "2d10+1d6", "2d10+1d8", "3d10", "3d10+1d4", "3d10+1d6"];
    const idx = Math.max(0, Math.min(DICE_CAT.length - 1, (tier - 1) + baseStep + catBonus));
    return DICE_CAT[idx];
  },

  /**
   * "Extra dN (Combat Rolls/Strike/Dodge/Wound)" custom buffs — flat dice
   * appended to a roll formula (the pools were computed in actor prep but
   * never consumed). Returns e.g. "+2d6+1d10" or "".
   */
  _extraDicePool(system, rollType) {
    const ed = system.dicePools?.extraDice || {};
    const martial = martialDie(system);
    let out = martial ? `+1d${martial}` : "";
    for (const die of ["d4", "d6", "d8", "d10"]) {
      const n = (ed.combatRolls?.[die] || 0) + (ed[rollType]?.[die] || 0);
      if (n > 0) out += `+${n}${die}`;
    }
    return out;
  },

  /**
   * "ToP Extra Dice (All/Strike/Dodge/Wound)" custom buffs — apply the ToP
   * Extra Dice pool additional times (topApplyCount was written but never
   * consumed; global already includes the base 1).
   */
  _applyTopCount(system, rollType, topDice, signatureBonus = 0) {
    const ta = system.dicePools?.topApplyCount || {};
    const applies = Math.max(0, Math.trunc((ta.global ?? 1) + (ta[rollType] || 0) + signatureBonus));
    return topDice && applies > 0 ? Array(applies).fill(topDice).join("+") : "";
  },

  _buildFormula(topDice, greaterDice, mod, extra = "") {
    let f = "1d10";
    if (topDice) f += `+${topDice}`;
    if (greaterDice) f += `+${greaterDice}`;
    if (mod > 0) f += `+${mod}`;
    else if (mod < 0) f += `${mod}`;
    if (extra) f += extra;
    return f;
  },

  // -------------------------------------------------------
  // Data Prep: Combat Rolls Summary (Main Tab)
  // -------------------------------------------------------

  _prepareCombatRollsData(context, system) {
    const haste = system.aptitudes?.haste ?? 0;
    const awareness = system.aptitudes?.awareness ?? 0;
    const defenseValue = system.aptitudes?.defenseValue ?? 0;
    const strikeBuffTotal = system.aptitudes?.strikeBuffTotal ?? 0;
    const dodgeBuffTotal = system.aptitudes?.dodgeBuffTotal ?? 0;
    const woundBuffTotal = system.aptitudes?.woundBuffTotal ?? 0;
    const foTotal = system.attributes?.fo?.totalScore ?? 0;
    const maTotal = system.attributes?.ma?.totalScore ?? 0;
    // Unified CTs (talents, Mindful, CT buffs). Per-foundation wound CTs for
    // the wound row; unarmed baseline for strike (Critical Specialist only
    // applies to armed attacks, surfaced per-ref in the tracker/attack refs).
    const baseCTs = this._calcCombatCTs(system);
    const woundCTPhys = this._calcCombatCTs(system, { foundation: "Physical" }).woundCT;
    const woundCTEnergy = this._calcCombatCTs(system, { foundation: "Energy" }).woundCT;
    const woundCTMagic = this._calcCombatCTs(system, { foundation: "Magic" }).woundCT;

    const strikeDerived = haste + awareness;
    const strikeTotal = strikeDerived + strikeBuffTotal;
    const dodgeTotal = defenseValue + dodgeBuffTotal;

    const fmt = (v) => v >= 0 ? `+${v}` : `${v}`;

    context.combatRolls = {
      strike: {
        derivedValue: fmt(strikeDerived),
        additionalMods: fmt(strikeBuffTotal),
        total: fmt(strikeTotal),
        crit: `${baseCTs.strikeCT}+`
      },
      dodge: {
        derivedValue: fmt(defenseValue),
        additionalMods: fmt(dodgeBuffTotal),
        total: fmt(dodgeTotal),
        crit: `${baseCTs.dodgeCT}+`
      },
      strikeForType: `${fmt(strikeTotal)} (${baseCTs.strikeCT}+)`,
      wound: {
        physical: { total: fmt(foTotal + woundBuffTotal), crit: `${woundCTPhys}+` },
        energy:   { total: fmt(foTotal + woundBuffTotal), crit: `${woundCTEnergy}+` },
        magic:    { total: fmt(maTotal + woundBuffTotal), crit: `${woundCTMagic}+` }
      }
    };
  },

  // -------------------------------------------------------
  // Attack Ref CRUD
  // -------------------------------------------------------

  async _onAddAttackRef(event) {
    event.preventDefault();
    const refs = foundry.utils.deepClone(this.actor.system.attackRefs || []);
    const nextId = refs.length > 0 ? Math.max(...refs.map(r => r.id || 0)) + 1 : 1;
    refs.push({
      id: nextId,
      name: "Attack Reference",
      foundation: "Physical",
      profile: "Simple",
      extraProfile: "",
      targetRange: 0,
      inMelee: true,
      energyCharges: 0,
      kiWager: 0,
      powerShot: 0,
      miscStrike: "",
      miscWound: "",
      miscDodge: "",
      miscBonuses: "",
      weaponEquipped: "",
      weaponCheckbox: false,
      offHand: "",
      offHandCheckbox: false,
      description: ""
    });
    await this.actor.update({ "system.attackRefs": refs });
  },

  async _onRemoveAttackRef(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const refs = foundry.utils.deepClone(this.actor.system.attackRefs || []);
    refs.splice(index, 1);
    await this.actor.update({ "system.attackRefs": refs });
  },

  // -------------------------------------------------------
  // Lookup Handlers (Attack Ref Tab)
  // -------------------------------------------------------

  /**
   * Handle advantage/disadvantage lookup selection.
   */
  _onAttackRefLookup(event) {
    const val = event.currentTarget.value;
    const resultDiv = this.element.find("#advdisLookupResult")[0];
    if (!resultDiv) return;

    if (!val) {
      resultDiv.innerHTML = '<div class="ar-lookup-empty">Select an entry to view details</div>';
      return;
    }

    const config = CONFIG.DBU ?? {};
    let data = config.techniqueAdvantagesData?.[val];
    let type = "adv";

    if (!data) {
      data = config.techniqueDisadvantagesData?.[val];
      type = "dis";
    }

    if (!data) {
      resultDiv.innerHTML = '<div class="ar-lookup-empty">Entry not found</div>';
      return;
    }

    const tpDisplay = Array.isArray(data.tpPerRank) ? data.tpPerRank.join("/") : data.tpPerRank;

    resultDiv.innerHTML = `
      <div class="ar-lookup-card">
        <div class="ar-lookup-name">${val}</div>
        <div class="ar-lookup-row">
          <span class="ar-lk-label">Type:</span> 
          <span class="${type === 'adv' ? 'ar-lk-adv' : 'ar-lk-dis'}">${type === 'adv' ? 'Advantage' : 'Disadvantage'}</span>
        </div>
        <div class="ar-lookup-row"><span class="ar-lk-label">TP/Rank:</span> ${tpDisplay}</div>
        <div class="ar-lookup-row"><span class="ar-lk-label">Max Ranks:</span> ${data.maxRanks || 5}</div>
        ${data.requirement ? `<div class="ar-lookup-row"><span class="ar-lk-label">Restriction:</span> ${data.requirement}</div>` : ''}
        ${data.effect ? `<div class="ar-lookup-row"><span class="ar-lk-label">Effect:</span> ${data.effect}</div>` : ''}
      </div>
    `;
  },

  /**
   * Handle state/condition lookup selection.
   */
  _onStateLookup(event) {
    const val = event.currentTarget.value;
    const resultDiv = this.element.find("#stateLookupResult")[0];
    if (!resultDiv) return;

    if (!val) {
      resultDiv.innerHTML = '<div class="ar-lookup-empty">Select a condition to view details</div>';
      return;
    }

    // Default conditions list matching _getCombatConditions logic
    const defaults = this._getCombatConditions(this.actor.system).map(c => ({
      id: c.id, name: c.name, maxStacks: c.maxStacks, effect: c.effect
    }));

    const cond = defaults.find(c => c.name === val);
    if (!cond) {
      resultDiv.innerHTML = '<div class="ar-lookup-empty">Condition not found</div>';
      return;
    }

    // Check if active on this actor
    const stored = (this.actor.system.conditions || []).find(c => c.id === cond.id);
    const isActive = stored?.active ?? false;
    const stacks = stored?.stacks ?? 0;

    resultDiv.innerHTML = `
      <div class="ar-lookup-card">
        <div class="ar-lookup-name">${cond.name} ${isActive ? `<span class="ar-lk-active">ACTIVE ${cond.maxStacks > 1 ? `(${stacks}/${cond.maxStacks})` : ''}</span>` : ''}</div>
        <div class="ar-lookup-row"><span class="ar-lk-label">Max Stacks:</span> ${cond.maxStacks}</div>
        <div class="ar-lookup-row"><span class="ar-lk-label">Effect:</span> ${cond.effect}</div>
      </div>
    `;
  },
};
