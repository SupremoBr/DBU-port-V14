import { martialEnergyCharges } from "../../rules/path-to-power-v093.mjs";
import { attackKiWithBuffs, greaterDiceCategoryBonus, customBuffState, linkedCatalogBuffs } from "../../helpers/custom-buffs.mjs";
import { attackPowerShot093, attackReferenceKiCost093, signatureEnergyCharges093 } from "../../rules/techniques-v093.mjs";
import { PROFILES_093 } from "../../rules/profiles-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";
import { prepareCombatResources, prepareActiveEffects } from "../character-data.mjs";

function linkChoice(list, name) {
  const notes = String((list || []).find(row => row.name === name)?.notes || "").trim().toLowerCase();
  return notes.startsWith("s") ? "strike" : notes.startsWith("w") ? "wound" : "";
}

/** Character sheet domain: combat-data. Methods run with the sheet as this. */
export const combatDataMethods = {

  // -------------------------------------------------------
  // Data Prep: Active Effects Panel (Main Tab)
  // -------------------------------------------------------

  _prepareActiveEffects(context, system) {
    return prepareActiveEffects(context, system);
  },

  // -------------------------------------------------------
  // Data Prep: Combat
  // -------------------------------------------------------

  _prepareCombatData(context, system) {
    // Combat resources from traits, talents, unique (passive + catalog-based)
    const rawResources = this._getCombatResources(system);

    // === Unified Action: merge bonus panel triggered effects into resource list ===
    // Keep passive resources from all sources + unique ability trackable resources.
    // Trackable resources for racial/talent/transformation are replaced by bonus panel triggers
    // which have correct trigger IDs and computed descriptions.
    const baseResources = rawResources.filter(r => {
      if (!r.isTrackable) return true;
      if (r.sourceType === "unique") return true;
      return false;
    });

    const bonusTriggers = [];

    // Racial trait triggered effects (from racial automation bonus objects)
    const raceBonusMap = {
      racialBonuses: "Saiyan", earthlingBonuses: "Earthling", majinBonuses: "Majin",
      bioAndroidBonuses: "Bio-Android", androidBonuses: "Android", arcosianBonuses: "Arcosian",
      cerealianBonuses: "Cerealian", namekianBonuses: "Namekian", nekoMajinBonuses: "Neko Majin",
      neoTuffleBonuses: "Neo-Tuffle", shadowDragonBonuses: "Shadow Dragon",
      shinjinBonuses: "Shinjin", undeadBonuses: "Undead"
    };
    for (const [key, raceName] of Object.entries(raceBonusMap)) {
      const bonuses = system[key];
      if (!bonuses?.triggered) continue;
      for (const t of bonuses.triggered) {
        bonusTriggers.push({
          id: `rt:${t.id}`, sourceName: t.name, sourceLabel: raceName,
          sourceType: "racial", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "rt-trigger", triggerId: t.id
        });
      }
    }

    // Talent triggered effects
    for (const entry of (system.talentBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `tb:${t.id}`, sourceName: t.name, sourceLabel: entry.name,
          sourceType: "talent", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || "round", maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "talent-trigger", triggerId: t.id
        });
      }
    }

    // Talent stances (Combat Expertise, Balanced Defender)
    const talentIds = new Set(system.talents || []);
    if (talentIds.has("combat_expertise")) {
      bonusTriggers.push({
        id: "stance:combat_expertise", sourceName: "Combat Expertise Shift",
        sourceLabel: "Combat Expertise", sourceType: "talent", level: 0,
        activationType: "triggered", usageLimit: null, maxUses: 0,
        keyword: "Stance", text: "Redistribute points between Defense Value and Awareness.",
        isTrackable: false, actionType: "talent-stance", triggerId: null, stanceId: "combat_expertise"
      });
    }
    if (talentIds.has("balanced_defender")) {
      bonusTriggers.push({
        id: "stance:balanced_defender", sourceName: "Balanced Defender Shift",
        sourceLabel: "Balanced Defender", sourceType: "talent", level: 0,
        activationType: "triggered", usageLimit: null, maxUses: 0,
        keyword: "Stance", text: "Redistribute points between Defense Value and Soak.",
        isTrackable: false, actionType: "talent-stance", triggerId: null, stanceId: "balanced_defender"
      });
    }

    // Manifested Power triggered effects
    for (const entry of (system.manifestedPowerBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `mp:${t.id}`, sourceName: t.name, sourceLabel: entry.name,
          sourceType: "transformation", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "mp-trigger", triggerId: t.id
        });
      }
    }

    // Enhancement Power triggered effects
    for (const entry of (system.enhancementPowerBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `ep:${t.id}`, sourceName: t.name, sourceLabel: entry.name,
          sourceType: "transformation", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "ep-trigger", triggerId: t.id
        });
      }
    }

    // Alternate Form triggered effects
    for (const entry of (system.alternateFormBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `af:${t.id}`, sourceName: t.name, sourceLabel: entry.name,
          sourceType: "transformation", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "af-trigger", triggerId: t.id
        });
      }
    }

    // Legendary Form triggered effects
    for (const entry of (system.legendaryFormBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `lf:${t.id}`, sourceName: t.name, sourceLabel: entry.name,
          sourceType: "transformation", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "lf-trigger", triggerId: t.id
        });
      }
    }

    // Legendary Trait triggered effects
    for (const entry of (system.legendaryTraitBonuses?.entries || [])) {
      for (const t of (entry.triggered || [])) {
        bonusTriggers.push({
          id: `lt:${t.id}`, sourceName: t.name, sourceLabel: entry.sourceName || entry.name,
          sourceType: "racial", level: 0, activationType: "triggered",
          usageLimit: t.usageLimit || null, maxUses: t.maxUses || 0,
          keyword: t.usageLimit || "Triggered", text: t.description || "",
          isTrackable: true, actionType: "lt-trigger", triggerId: t.id
        });
      }
    }

    // Merge base resources + bonus panel triggers
    const allResources = [...baseResources, ...bonusTriggers];

    // Enrich resources with usage pips
    const cts = system.combatTabState || {};
    const usage = cts.resourceUsage || {};
    const roundUsage = usage.round || {};
    const encounterUsage = usage.encounter || {};

    const _buildUsageLabel = (r, hasCap) => {
      const u = r.usageLimit;
      if (!u) return "";
      const s = String(u).trim();
      const lower = s.toLowerCase();
      if (lower === "round") return hasCap ? `${r.maxUses}/R` : "Round";
      if (lower === "encounter") return hasCap ? `${r.maxUses}/E` : "Enc";
      if (lower === "turn") return hasCap ? `${r.maxUses}/T` : "Turn";
      if (lower === "burst limit") return "BL";
      if (lower === "unlimited") return "∞";
      // Already-formatted strings like "1/Round", "1/Encounter"
      return s.replace(/\s*\/\s*Round\b/i, "/R")
              .replace(/\s*\/\s*Encounter\b/i, "/E")
              .replace(/\s*\/\s*Turn\b/i, "/T");
    };
    context.combatResources = allResources.map(r => {
      const usedKey = (r.usageLimit === "round") ? "round" : "encounter";
      const usedCount = r.isTrackable ? ((usedKey === "round" ? roundUsage : encounterUsage)[r.id] || 0) : 0;
      const hasCap = r.maxUses > 0;
      const isMaxed = hasCap && usedCount >= r.maxUses;
      const pips = [];
      if (hasCap) {
        for (let i = 0; i < r.maxUses; i++) {
          pips.push({ available: i >= usedCount, index: i });
        }
      }
      return {
        ...r, usedCount, hasCap, isMaxed, pips,
        usageLabel: _buildUsageLabel(r, hasCap),
        hasAction: !!r.actionType,
        buttonLabel: r.actionType === "talent-stance" ? "Shift" : "Use"
      };
    });

    // Group resources by source type
    const groupOrder = [
      { key: "racial", label: "Racial Traits" },
      { key: "talent", label: "Talents" },
      { key: "unique", label: "Unique Abilities" },
      { key: "transformation", label: "Transformations" },
      { key: "equipment", label: "Equipment" }
    ];
    context.combatResourceGroups = [];
    for (const g of groupOrder) {
      const items = context.combatResources.filter(r => r.sourceType === g.key);
      if (items.length > 0) {
        context.combatResourceGroups.push({ key: g.key, label: g.label, resources: items });
      }
    }

    const specialResources = system.transformationMeta?.specialResources || {};
    context.specialTransformationResources = Object.entries(specialResources).map(([key, data]) => ({
      key,
      label: String(key).replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()),
      value: Number(data?.value || 0),
      max: Number(data?.max || 0),
      sourceName: data?.sourceName || data?.source || ""
    })).filter(r => r.value > 0 || r.max > 0);
    context.hasSpecialTransformationResources = context.specialTransformationResources.length > 0;
    const hasDivineKiAccess = Number(system.divineKiPoints?.max || 0) > 0 || Number(system.divineKiPoints?.value || 0) > 0;
    const quickCombatResources = [
      ...(hasDivineKiAccess ? [{
        key: "divineKi",
        label: "Divine Ki",
        value: Number(system.divineKiPoints?.value || 0),
        max: Number(system.divineKiPoints?.max || 0)
      }] : []),
      {
        key: "lifeforce",
        label: "Lifeforce",
        value: Number(system.tracking?.lifeforce || 0),
        max: 0
      },
      {
        key: "perfectPoints",
        label: "Perfect Points",
        value: Number(system.tracking?.perfectPoints || 0),
        max: 0
      }
    ].filter(r => r.value > 0 || r.max > 0);
    context.quickCombatResources = quickCombatResources;
    context.hasQuickCombatResources = quickCombatResources.length > 0;
    context.surgeManeuverUsed = (system.combatTabState?.resourceUsage?.encounter?.["surge:maneuver"] || 0) > 0;
    context.universeSeed = {
      universalPower: Number(system.universeSeed?.universalPower || 0),
      integrated: !!system.universeSeed?.integrated
    };
    context.hasUniverseSeed = context.universeSeed.universalPower > 0
      || context.universeSeed.integrated
      || !!specialResources.godSphere;

    // Combat conditions
    context.combatConditions = this._getCombatConditions(system);

    // Combat tab state (round tracker)
    const rounds = cts.rounds || [];
    const currentRound = cts.currentRound || (rounds.length > 0 ? rounds.length : 0);
    context.combatRound = currentRound;

    // Prepare rounds for display
    context.combatRounds = rounds.map((r, i) => ({
      ...r,
      isActive: i === rounds.length - 1,
      kiTotal: (r.actions || []).reduce((sum, a) => sum + (a.kiCost || 0), 0),
      dkpTotal: (r.actions || []).reduce((sum, a) => sum + (a.dkpCost || 0), 0)
    }));

    // --- Tracker Attack Sources (for "attack" action type) ---
    const trackerTier = uses093(system) ? (system.baseTier || 1) : (system.tier || 1);
    const trackerSourceGroups = [];
    const configDBU = CONFIG.DBU ?? {};

    // Build list of "active" descriptors for the player to see what applies.
    // Each entry is { name, tooltip } so the template can render a hover-detail.
    const activeBuffs = [];
    const tierForTip = system.tier || 1;
    const baseTierForTip = system.baseTier || tierForTip;
    const peScore = system.attributes?.pe?.score ?? 0;
    const scScore = system.attributes?.sc?.score ?? 0;
        for (const cb of [...(system.customBuffs || []), ...linkedCatalogBuffs(this.actor, system)]) {
      if (customBuffState(cb, system) !== "active") continue;
      const parts = [];
      if (cb.flat) parts.push(`${cb.flat >= 0 ? "+" : ""}${cb.flat}`);
      if (cb.bT) parts.push(`${cb.bT >= 0 ? "+" : ""}${cb.bT}(bT=${cb.bT * baseTierForTip})`);
      if (cb.T) parts.push(`${cb.T >= 0 ? "+" : ""}${cb.T}(T=${cb.T * tierForTip})`);
      const detail = parts.length ? parts.join(" ") + ` → ${cb.effect}` : cb.effect;
      activeBuffs.push({ name: cb.name || cb.effect, tooltip: detail });
    }
    for (const t of (system.transformations || [])) {
      if (!t.active) continue;
      const bonuses = Object.entries(t.attrBonuses || {})
        .filter(([, v]) => v && v !== "–" && v !== "-")
        .map(([k, v]) => `${k.toUpperCase()} ${v}`).join(", ");
      activeBuffs.push({ name: `Trans: ${t.name}`, tooltip: bonuses ? `AMB: ${bonuses}` : "Transformation active" });
    }
    if (system.combatStates?.raging)
      activeBuffs.push({ name: "Raging", tooltip: "+1(T) Strike & Wound, -1(T) Dodge & DV" });
    if (system.combatStates?.superior)
      activeBuffs.push({ name: "Superior", tooltip: "Apply Greater Dice an additional time" });
    if (system.combatStates?.mindful)
      activeBuffs.push({ name: "Mindful", tooltip: "Saving Throw CT reduced by 1" });
    if (system.combatStates?.evasiveStance)
      activeBuffs.push({ name: "Evasive Stance", tooltip: `+${tierForTip} Dodge (1×T)` });
    if (system.combatStates?.drunk)
      activeBuffs.push({ name: "Drunk", tooltip: `-${tierForTip} all Combat Rolls` });
    if (system.combatStates?.hypeActive) {
      const hypeVal = Math.floor(peScore / 2);
      const hypeTip = hypeVal > 0
        ? `+${hypeVal} Strike/Dodge/Wound (½ PE=${peScore})`
        : `½ Personality Score (PE=${peScore}) — no bonus while PE<2`;
      activeBuffs.push({ name: "Hype", tooltip: hypeTip });
    }
    if (system.combatStates?.analysisActive) {
      const aVal = Math.floor(scScore / 2);
      const aTip = aVal > 0
        ? `+${aVal} Strike/Dodge/Wound (½ SC=${scScore})`
        : `½ Scholarship Score (SC=${scScore}) — no bonus while SC<2`;
      activeBuffs.push({ name: "Analysis", tooltip: aTip });
    }
    if ((system.tracking?.powerStacks ?? 0) > 0)
      activeBuffs.push({ name: `Power x${system.tracking.powerStacks}`, tooltip: "Per-stack effects from active transformations" });
    if ((system.tracking?.energyCharges ?? 0) > 0)
      activeBuffs.push({ name: `Energy Charges x${system.tracking.energyCharges}`, tooltip: `+${system.tracking.energyCharges}d8(T) Wound on charged attack` });

    // Attack Refs — include strikeFormula/woundFormula/kiCost from prepared attackRefs
    const arSources = [];
    const prepRefs = context.attackRefs || [];
    for (let i = 0; i < (system.attackRefs || []).length; i++) {
      const ref = system.attackRefs[i];
      if (!ref.name) continue;
      const profile = (configDBU.profileData || {})[ref.profile] || {};
      let kiCost = (profile.kpCost || 0) * trackerTier;
      // Supreme Fist L1: −2(T) KP on Unarmed Physical Attacks (floor 0)
      const refUnarmedPhys = ref.foundation === "Physical"
        && (!ref.weaponEquipped || String(ref.weaponEquipped).toLowerCase() === "unarmed");
      if (refUnarmedPhys && (system.talents || []).includes("supreme_fist")) {
        kiCost = Math.max(0, kiCost - 2 * trackerTier);
      }
      // Tiring aura: +1(T) KP per rank on Attacking Maneuvers while in the aura
      {
        const tAura = this.actor._getActiveAura(system);
        for (const dis of (tAura?.disadvantages || [])) {
          if (dis.name === "Tiring") kiCost += (dis.ranks || 1) * trackerTier;
        }
      }
      // "Ki Point Cost Attacks" buffs (delta; negative = discount) and Deep
      // Control's all-maneuver reduction — previously dead aptitudes.
      kiCost = uses093(system) ? attackReferenceKiCost093(ref, system, this.actor._getActiveAura(system))
        : attackKiWithBuffs(kiCost, 0, system.aptitudes);
      const prep = prepRefs[i] || {};
      const isArmed = !!ref.weaponEquipped && String(ref.weaponEquipped).toLowerCase() !== "unarmed";
      const refCTs = prep.woundCT != null ? prep : this._calcCombatCTs(system, {
        isWeapon: isArmed, foundation: ref.foundation || "", profile: ref.profile || ""
      });
      arSources.push({
        key: `ref_${i}`,
        name: ref.name,
        kiCost,
        strikeFormula: prep.strikeFormula || "",
        woundFormula: prep.woundFormula || "",
        strikeCT: refCTs.strikeCT,
        woundCT: refCTs.woundCT,
        damageCat: prep.damageCat || "Standard",
        foundation: ref.foundation || "",
        profile: ref.profile || "",
        energyCharges: martialEnergyCharges(system, (ref.energyCharges || 0) + (uses093(system) ? ((PROFILES_093[ref.profile]?.freeCharges || 0) + (PROFILES_093[ref.profile]?.freeChargesOutsideLimit || 0)) : 0)),
        powerShot: uses093(system) ? attackPowerShot093(ref) : ref.powerShot || 0,
        advantages: uses093(system) ? (ref.grantedAdvantages || []) : [],
        twinLinked: uses093(system) ? linkChoice(ref.grantedAdvantages, "Twin-Linked") : undefined,
        defaultWager: prep.maxWager || 0,
        activeBuffs
      });
    }
    if (arSources.length) trackerSourceGroups.push({ label: "Attack Refs", sources: arSources });
    // Signature Techniques
    const stSources = [];
    const prepTechs = context.signatureTechniques || [];
    for (const tech of prepTechs) {
      if (!tech.name) continue;
      // Twin-Linked / Dead-Link: the chosen roll (Strike/Wound, stored in the
      // advancement's notes) is rolled twice keeping the highest/lowest.
      const twinLinked = linkChoice(tech.advantages, "Twin-Linked");
      const deadLinked = linkChoice(tech.disadvantages, "Dead-Link");
      stSources.push({
        key: `tech_${tech.id}`,
        name: tech.name,
        // finalKP×tier plus the "Ki Point Cost Attacks" buff deltas and Deep
        // Control's all-maneuver reduction (previously dead aptitudes)
        kiCost: attackKiWithBuffs((tech.finalKP || 0) * trackerTier,
          uses093(system) ? (tech.profileBaseKP || 0) * trackerTier / 2 : 0, system.aptitudes),
        strikeFormula: tech.strikeFormula || "",
        woundFormula: tech.woundFormula || "",
        strikeCT: tech.strikeCT || 10,
        woundCT: tech.woundCT || 10,
        damageCat: tech.damageCat || "Standard",
        foundation: tech.foundation || "",
        profile: tech.profile || "",
        energyCharges: uses093(system) ? signatureEnergyCharges093(tech, system) : (tech.baseEnergyCharges || 0) + (tech.extraEnergyCharges || 0),
        powerShot: (tech.advantages || []).find(a => a.name === "Power Shot")?.ranks || 0,
        advantages: tech.advantages || [],
        defaultWager: 0,
        twinLinked,
        deadLinked,
        activeBuffs
      });
    }
    if (stSources.length) trackerSourceGroups.push({ label: "Sig. Techniques", sources: stSources });
    // Unique Abilities
    const uaSources = [];
    for (const ua of (context.characterUniques || [])) {
      const name = ua.data?.name || ua.abilityKey;
      uaSources.push({ key: `unique_${ua.abilityKey}`, name, kiCost: 0, activeBuffs });
    }
    if (uaSources.length) trackerSourceGroups.push({ label: "Unique Abilities", sources: uaSources });
    // Store for listener access
    this._trackerSourceGroups = trackerSourceGroups;
    // Duel panel needs the attack sources rendered in the template directly
    context.duelSourceGroups = [
      ...(arSources.length ? [{ label: "Attack Refs", sources: arSources }] : []),
      ...(stSources.length ? [{ label: "Sig. Techniques", sources: stSources }] : [])
    ];

    // Dodge quick-roll data for the tracker "Roll Dodge" button. The dodge
    // formula is ref-independent (DV + buffs + tier dice), so reuse the first
    // prepared attack ref; fall back to a bare 1d10+DV when no refs exist.
    const dodgePrep = prepRefs[0] || {};
    const dvFallback = (system.aptitudes?.defenseValue ?? 0) + (system.aptitudes?.dodgeBuffTotal ?? 0);
    this._trackerDodge = {
      formula: dodgePrep.dodgeFormula || `1d10${dvFallback >= 0 ? "+" : ""}${dvFallback}`,
      ct: this._calcCombatCTs(system).dodgeCT
    };
    context.trackerDodge = this._trackerDodge;

    // --- Defend Maneuver options (actions-combat.txt:485-506). Counter Action;
    // does NOT trigger Diminishing Defense (attacking.txt / Defend rule). ---
    const defendCatalog = [
      { key: "parry", name: "Parry", costT: 0, rollBased: true,
        desc: "Use your Strike Roll instead of Dodge for the Clash. −1(T) Dice Score per Energy Charge or Power Shot rank on the incoming attack." },
      { key: "directHit", name: "Direct Hit", costT: 0, rollBased: false,
        desc: "Forgo Dodge. +1/2 your Soak vs this attack. Attacker is Shaken if they deal 0 damage with a Sig Tech or a 5(T)+ wager attack." },
      { key: "powerFlare", name: "Power Flare", costT: 2, rollBased: true,
        desc: "Clash your Wound Roll vs the attacker's Wound Roll. Win: no damage. Lose: take their Wound. Wager up to 1/5 Max Capacity." },
      { key: "crossCounter", name: "Cross Counter", costT: 2, rollBased: false,
        desc: "Attacker rolls vs your HALVED Defense Value. After the Clash resolves, make a Basic Attack as an Out-of-Sequence Maneuver." },
      { key: "guard", name: "Guard", costT: 8, rollBased: false,
        desc: "Forgo Dodge. Incoming Wound Roll halved and Damage Category −1. +1(T) KP per Energy Charge on the attack (max +4(T))." }
    ];
    context.defendOptions = defendCatalog.map(d => ({ ...d, costLabel: d.costT ? `${d.costT}(T) KP` : "0 KP" }));
    this._defendCatalog = defendCatalog;
    this._trackerDefend = {
      strikeFormula: dodgePrep.strikeFormula || "1d10",
      woundFormula: dodgePrep.woundFormula || "1d10",
      maxFlareWager: Math.floor((system.status?.maxCapacity || 0) / 5)
    };

    // Enrich each tracker action with _attackData when type=attack and source is set
    const findSource = (key) => {
      for (const g of trackerSourceGroups) {
        const s = g.sources.find(x => x.key === key);
        if (s) return s;
      }
      return null;
    };
    for (const round of context.combatRounds) {
      round.actions = (round.actions || []).map(a => {
        if (a.type === "attack" && a.source) {
          const sd = findSource(a.source);
          if (sd) a._attackData = sd;
        }
        if (a.type === "transform") {
          // Transformation Maneuver: pick an inactive form you meet the ToP
          // requirement for; stress test ignores Health Threshold Penalties.
          const allTrans = system.transformations || [];
          const options = allTrans
            .map((t, idx) => ({ t, idx }))
            .filter(({ t }) => {
              if (t.active) return false;
              // Metamorphosis stages are usable below their S+1 requirement
              // (Weakest State L2 applies penalties instead of blocking entry).
              if (["full_suppression", "limited_suppression", "partial_suppression", "true_form"].includes(t.catalogKey)) return true;
              const req = parseInt(String(t.tierRequirement || "").match(/(\d+)/)?.[1] || "0");
              return req <= (system.tier || 1);
            })
            .map(({ t, idx }) => ({
              index: idx,
              name: t.name || `Transformation ${idx + 1}`,
              stressTest: Number(t.stressTest) || 0,
              selected: Number(a.transformIndex) === idx
            }));
          const chosen = options.find(o => o.selected) || null;
          const calc = chosen ? this._computeTransformManeuver(chosen.index, a) : null;
          a._transformData = {
            options,
            chosen,
            projectedST: calc?.required ?? 0,
            ignoredPenalty: calc?.ignoredPenalty ?? (system.thresholds?.stressPenalty || 0),
            stepByStep: calc?.stepByStep || null,
            crimson: calc?.crimson || false,
            willSkipTest: calc?.willSkipTest || false,
            replaceable: calc?.replaceable || false,
            replaceMode: calc?.replaceMode || false,
            replacedNames: calc?.replacedNames || []
          };
        }
        if (a.type === "defend" && a.defendOption) {
          const opt = defendCatalog.find(d => d.key === a.defendOption);
          if (opt) {
            const dTier = system.tier || 1;
            let dKiCost = opt.costT * dTier;
            if (opt.key === "guard") {
              const ec = Math.min(Math.max(0, Number(a.defendEC) || 0), 4);
              dKiCost = (8 + ec) * dTier;
              if (this.actor._isConditionActive?.(system, "guardDown")) dKiCost = Math.ceil(dKiCost * 1.5);
            }
            if (opt.key === "powerFlare") {
              dKiCost += Math.max(0, Math.min(Number(a.defendWager) || 0, this._trackerDefend.maxFlareWager));
            }
            a._defendData = {
              ...opt,
              isParry: opt.key === "parry",
              isPowerFlare: opt.key === "powerFlare",
              isGuard: opt.key === "guard",
              penaltyTotal: opt.key === "parry" ? Math.max(0, Number(a.defendPenalty) || 0) * dTier : 0,
              maxFlareWager: this._trackerDefend.maxFlareWager,
              kiCost: dKiCost
            };
          }
        }
        return a;
      });
    }

    // Power-Up count — only active power-ups (last 2 rounds, per DBU rules)
    let powerUpCount = 0;
    for (const r of rounds) {
      if (r.roundNumber >= currentRound - 1) {
        for (const a of (r.actions || [])) {
          if (a.type === "power-up") powerUpCount++;
        }
      }
    }
    context.combatPowerUpCount = powerUpCount;

    // Ki Wager limits reference (calculated from Max Capacity)
    const maxCap = system.status.maxCapacity || 0;
    context.kiWagerLimits = {
      default: Math.floor(maxCap / 2),
      duel: Math.floor(maxCap / 2),
      throw: Math.ceil(maxCap / 4),
      elementalEarth: Math.floor(maxCap / 4),
      deflectPS: Math.floor(maxCap / 5),
      unitedDuel: Math.floor(maxCap / 10)
    };

    // DOT damage calculation
    const dotStacks = cts.dotStacks || 0;
    context.combatDotDamage = dotStacks * (system.tier || 1);

    // Top layer Break Value status for combat display
    const topLayerId = system.wornApparelSlots?.topLayer;
    if (topLayerId) {
      const topItem = this.actor.items.get(topLayerId);
      if (topItem) {
        context.topLayerBV = {
          name: topItem.name,
          current: topItem.system.breakValueCurrent ?? 0,
          max: this._calcBreakValueMax(topItem),
          broken: (topItem.system.breakValueCurrent ?? 0) === 0
        };
      }
    }
    context.hasTopLayer = !!context.topLayerBV;

    // Damage log (structured events)
    const rawLog = cts.damageLog || [];
    context.combatDamageLog = rawLog.map(entry => {
      // Support both old string format and new structured format
      if (typeof entry === "string") {
        return { text: entry, isLegacy: true };
      }
      // Structured entry: { round, type, finalDamage, lpBefore, lpAfter, steadfastResults, breakReduction, thresholdsCrossed }
      const typeLabels = { standard: "STD", direct: "DIR", lethal: "LTH", dot: "DOT", lpReduction: "LP-", heal: "HEAL", wound: "STD" };
      return {
        ...entry,
        typeLabel: typeLabels[entry.type] || entry.type,
        isHeal: entry.type === "heal",
        absDamage: Math.abs(entry.finalDamage || 0),
        hasBreak: !!entry.breakReduction,
        breakReduction: entry.breakReduction || 0,
        steadfastBadges: (entry.steadfastResults || []).map(sr => ({
          passed: sr.passed,
          cls: sr.passed ? "passed" : "failed",
          icon: sr.passed ? "check" : "times",
          initial: (sr.threshold || "?").charAt(0).toUpperCase(),
          rollText: sr.autoFail ? "auto" : String(sr.roll)
        }))
      };
    });
    context.combatDamageLog.reverse(); // newest first

    // Resource usage counts
    context.combatRoundUses = Object.values(roundUsage).reduce((a, b) => a + b, 0);
    context.combatEncounterUses = Object.values(encounterUsage).reduce((a, b) => a + b, 0);

    // Build used resources list with pips
    const usedMap = {};
    const enrichedResources = context.combatResources;
    for (const [effectId, count] of Object.entries(roundUsage)) {
      if (count > 0) {
        const res = enrichedResources.find(r => r.id === effectId) || this._resolveTrackedEffectResource(effectId, system);
        if (!res) continue;
        const pips = [];
        if (res.maxUses > 0) {
          for (let i = 0; i < res.maxUses; i++) pips.push({ available: i >= count, index: i });
        }
        usedMap[effectId] = {
          id: effectId, sourceName: res.sourceName, level: res.level,
          usageLimit: "round", usedCount: count, maxUses: res.maxUses,
          hasCap: res.maxUses > 0, isMaxed: res.maxUses > 0 && count >= res.maxUses, pips
        };
      }
    }
    for (const [effectId, count] of Object.entries(encounterUsage)) {
      if (count > 0 && !usedMap[effectId]) {
        const res = enrichedResources.find(r => r.id === effectId) || this._resolveTrackedEffectResource(effectId, system);
        if (!res) continue;
        const pips = [];
        if (res.maxUses > 0) {
          for (let i = 0; i < res.maxUses; i++) pips.push({ available: i >= count, index: i });
        }
        usedMap[effectId] = {
          id: effectId, sourceName: res.sourceName, level: res.level,
          usageLimit: "encounter", usedCount: count, maxUses: res.maxUses,
          hasCap: res.maxUses > 0, isMaxed: res.maxUses > 0 && count >= res.maxUses, pips
        };
      }
    }
    context.combatUsedResources = Object.values(usedMap);

    // --- Transformation Rules panel data ---
    const tfMeta = system.transformationMeta || {};
    const tfRulesData = system.transformationRules || {};
    const allTransformations = [...(system.transformations || []), ...(system._gainedActiveTransformations || [])];

    const activeTransAll = allTransformations.filter(t => t.active);
    const activeEPs = activeTransAll.filter(t =>
      ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType)
    );
    const activeAFLFs = activeTransAll.filter(t =>
      t.transformationType === "form_alternate" || t.transformationType === "form_legendary"
    );
    // Full Suppression does not benefit from Legend Realized (Weakest State Level 3)
    const lrEligibleAFLFs = activeAFLFs.filter(t => t.catalogKey !== "full_suppression");

    const legendRealizedUsed = tfMeta.legendRealizedUsed || [];
    const legendRealizedEligible = lrEligibleAFLFs.filter(t => !legendRealizedUsed.includes(t.name));
    const nlopUsedEver = tfMeta.newLevelOfPowerUsed || [];
    const blockedNlopCatalogKeys = new Set(["full_suppression", "limited_suppression", "partial_suppression", "true_form"]);
    const nlopEligible = allTransformations.filter(t =>
      t.name &&
      !nlopUsedEver.includes(t.name) &&
      !blockedNlopCatalogKeys.has(t.catalogKey)
    );

    context.tfRules = {
      hasTransformations: allTransformations.length > 0,
      hasActiveTransformations: activeTransAll.length > 0,
      combinedStressTest: tfRulesData.combinedStressTest || 0,
      kiMultiplierActive: tfRulesData.kiMultiplierActive || false,
      turbulentPowerActive: tfRulesData.turbulentPowerActive || false,
      stepByStepReduction: tfRulesData.stepByStepReduction || 0,
      baseCapacityRestore: tfRulesData.baseCapacityRestore || 0,
      // Surging Strength
      surgingStrengthRound: tfMeta.surgingStrengthRound || 0,
      surgingStrengthEncounter: tfMeta.surgingStrengthEncounter || 0,
      heartbeatActive: system.aspectEffects?.heartbeatActive || false,
      surgingRoundLimit: (system.aspectEffects?.heartbeatActive) ? 3 : 1,
      surgingEncounterLimit: (system.aspectEffects?.heartbeatActive) ? "∞" : "3",
      surgingDisabled: (system.aspectEffects?.heartbeatActive)
        ? (tfMeta.surgingStrengthRound || 0) >= 3
        : ((tfMeta.surgingStrengthRound || 0) >= 1 || (tfMeta.surgingStrengthEncounter || 0) >= 3),
      gradedTransformations: system.aspectEffects?.gradedTransformations || [],
      noLpRegen: system.aspectEffects?.noLpRegen || false,
      crimsonAcclimationActive: system.aspectEffects?.crimsonAcclimationActive || false,
      // Burst Limit + Burst Through Your Limit
      hasActiveEPs: activeEPs.length > 0,
      burstLimitUsed: tfMeta.burstLimitUsed || false,
      burstLimitSource: tfMeta.burstLimitSource || "",
      // Burst Through: available if NLoP active for an EP this encounter
      burstThroughAvailable: (tfMeta.burstLimitUsed || false) &&
        (tfMeta.nlopActiveEncounter || []).some(name =>
          allTransformations.some(t => t.name === name &&
            ["enhancement_standard", "enhancement_special", "enhancement_transcendent"].includes(t.transformationType)
          )
        ),
      // Legend Realized (excludes Full Suppression — Weakest State Level 3)
      hasActiveAFLF: lrEligibleAFLFs.length > 0,
      legendRealizedCount: legendRealizedUsed.length,
      legendRealizedMax: lrEligibleAFLFs.length,
      legendRealizedAllUsed: legendRealizedEligible.length === 0 && lrEligibleAFLFs.length > 0,
      // New Level of Power
      nlopCount: nlopUsedEver.length,
      nlopHasEligible: nlopEligible.length > 0,
      nlopActiveEncounter: tfMeta.nlopActiveEncounter || [],
      nlopTierBoost: system.nlopTierBoost || 0
    };

    // --- Legendary Traits combat data ---
    const ltBonuses = system.legendaryTraitBonuses || { entries: [], hasBonuses: false };
    context.legendaryTraitsCombat = {
      hasBonuses: ltBonuses.hasBonuses,
      entries: ltBonuses.entries,
      totals: ltBonuses.totals || {},
      // Collect all triggered effects for buttons
      triggeredEffects: this._decorateTriggeredEffects(
        (ltBonuses.entries || []).flatMap(e =>
          (e.triggered || []).map(t => ({ ...t, sourceName: e.sourceName, catalogKey: e.catalogKey }))
        ),
        system,
        "lt"
      )
    };

    // God Maneuvers
    if (system.godKi?.active) {
      const godManeuversCatalog = CONFIG.DBU?.godManeuvers || {};
      const selectedIds = system.godManeuvers || [];
      context.godManeuverEntries = selectedIds
        .map(id => godManeuversCatalog[id])
        .filter(Boolean);
      context.godStrikeProfile = system.godStrikeProfile || "";
      const profileDataMap = CONFIG.DBU?.profileData || {};
      const profileOptions = {};
      for (const [key, data] of Object.entries(profileDataMap)) {
        profileOptions[key] = data.name || key;
      }
      context.profileOptions = profileOptions;
      context.godHasDivineAura = selectedIds.includes("divine_aura");
      context.godHasFinisher = selectedIds.includes("god_finisher");
    } else {
      context.godManeuverEntries = [];
      context.godHasDivineAura = false;
      context.godHasFinisher = false;
    }

    // Initiative Advantage (from active combat)
    const activeCombat = game.combat;
    let initiativeAdvantage = false;
    let doubleInitiativeAdvantage = false;
    let lowestInitiative = false;
    let currentInitiative = null;

    if (activeCombat) {
      const combatant = activeCombat.combatants.find(c => c.actorId === this.actor.id);
      if (combatant) {
        initiativeAdvantage = combatant.getFlag("DBU-MRR-OLD", "initiativeAdvantage") ?? false;
        doubleInitiativeAdvantage = combatant.getFlag("DBU-MRR-OLD", "doubleInitiativeAdvantage") ?? false;
        lowestInitiative = combatant.getFlag("DBU-MRR-OLD", "lowestInitiative") ?? false;
        currentInitiative = combatant.initiative;
      }
    }

    context.initiativeAdvantage = initiativeAdvantage;
    context.doubleInitiativeAdvantage = doubleInitiativeAdvantage;
    context.lowestInitiative = lowestInitiative;
    context.currentInitiative = currentInitiative;
    context.inCombat = !!activeCombat && currentInitiative !== null;

    // ---- Extra Dice Pools for Combat Tab ----
    const tier = system.tier || 1;
    const dp = system.dicePools || {};
    const topCat = dp.topCatBonus || {};
    const grApply = dp.greaterApplyCount || {};
    const combatStates = system.combatStates || {};

    const resolveTop = (rollType) => {
      const catBonus = (topCat.global || 0) + (topCat[rollType] || 0);
      return this._applyTopCount(system, rollType, this._resolveExtraDice(tier, 0, catBonus));
    };
    const isImpediment = (system.conditions || []).some(c => c.id === "impediment" && c.active);
    const resolveGreater = (rollType) => {
      if (isImpediment) return "";
      const hasGreater = combatStates.superior || (grApply.global || 0) > 0 || (grApply[rollType] || 0) > 0;
      if (!hasGreater) return "";
      const catBonus = greaterDiceCategoryBonus(system, rollType);
      return this._resolveExtraDice(tier, 1, catBonus);
    };

    context.dicePoolsSummary = {
      strike: { top: resolveTop("strike") || "--", greater: resolveGreater("strike") || "--" },
      wound:  { top: resolveTop("wound") || "--",  greater: resolveGreater("wound") || "--" },
      dodge:  { top: resolveTop("dodge") || "--",  greater: resolveGreater("dodge") || "--" }
    };
    context.dicePools = system.dicePools || {};
  },

  _getCombatResources(system) {
    return prepareCombatResources(system);
  },

  /** Default combat conditions with current state from system data. */
  _getCombatConditions(system) {
    const defaults = [
      { id: "blinded", name: "Blinded", maxStacks: 1, effect: "No Sight. Illuminating Aura cannot reduce or remove this." },
      { id: "broken", name: "Broken", maxStacks: 3, effect: "Soak \u22122(T)/stack. If Soak=0, +2(T) damage received/stack." },
      { id: "compelled", name: "Compelled", maxStacks: 1, effect: "Must target assigned character. Ki Wager 6(bT) min. 2 Actions/turn attacking target. Combat Rolls become Urgent. Fail = lose 6(bT) LP." },
      { id: "fatigued", name: "Fatigued", maxStacks: 2, effect: "Halve Max Capacity per stack." },
      { id: "guardDown", name: "Guard Down", maxStacks: 1, effect: "Defense Value & Defend Strike \u22122(T). Guard KP cost +50%." },
      { id: "impediment", name: "Impediment", maxStacks: 1, effect: "Reduce Dice Score of Combat Rolls by Greater Dice (roll separately, subtract). Cancels with Greater Dice." },
      { id: "oblivious", name: "Oblivious", maxStacks: 1, effect: "Assign to character. Can\u2019t target them (except AoE). Soak \u22122(T), Dodge \u22121(T), Strike \u22123(T) vs them. Lose if hit or targeted 2+ times/round." },
      { id: "pinned", name: "Pinned", maxStacks: 1, effect: "Actions reduced to 1/round. No Attacking Maneuvers or Movement. 1 Action: Might Clash to escape." },
      { id: "poisoned", name: "Poisoned", maxStacks: 1, effect: "Lose 1/10 Max LP at end of turn. Double Health Threshold Penalties." },
      { id: "prone", name: "Prone", maxStacks: 1, effect: "Speed, Defense, Haste halved. Damage Category +1 step. 1 Action to stand." },
      { id: "shaken", name: "Shaken", maxStacks: 1, effect: "Can\u2019t move toward source. Strike Rolls \u22122(T)." },
      { id: "sleeping", name: "Sleeping", maxStacks: 1, effect: "Can\u2019t use Maneuvers. Auto-hit by attacks. Lose condition if hit. Karma Point to defend normally." },
      { id: "slowed", name: "Slowed", maxStacks: 3, effect: "\u22121 Action/round and Speed \u22121/3 per stack. 3 stacks: turn skipped, no Maneuvers." },
      { id: "stressExhaustion", name: "Stress Exhaustion", maxStacks: 1, effect: "Leave all Transformations. KP halved if in Core Trans. Can\u2019t transform." },
      { id: "suffocating", name: "Suffocating", maxStacks: 1, effect: "Lose 1/5 Max LP at end of each turn." }
    ];

    const conditions = system.conditions || [];

    return defaults.map(def => {
      const stored = conditions.find(c => c.id === def.id);
      return {
        ...def,
        active: stored?.active ?? false,
        stacks: stored?.stacks ?? 0
      };
    });
  },

  _onCombatFilter(event) {
    // Client-side filter - toggle visibility of resource items by type
    const filterType = event.currentTarget.dataset.filter;
    const checked = event.currentTarget.checked;
    const container = event.currentTarget.closest(".combat-panel-resources, .combat-panel, .tb-tab-content, .rt-activables");
    if (!container) return;
    // Target both resource items and RT activable items
    const items = container.querySelectorAll(`.combat-resource-item.type-${filterType}, .rt-activable.type-${filterType}`);
    for (const item of items) {
      item.style.display = checked ? "" : "none";
    }
  },

  async _onClearDamageLog(event) {
    event.preventDefault();
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    cts.damageLog = [];
    await this.actor.update({ "system.combatTabState": cts });
  },
};
