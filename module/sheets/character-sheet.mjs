import { bindRuleSharing } from "../helpers/rule-share.mjs";
import { captureSheetEdits, omitUnchangedFields, rebaseSheetRows } from "./sheet-edits.mjs";
import { martialAttributeWarnings, martialProgressionRows, progressionRowIsEarned, usesPathToPower } from "../rules/path-to-power-v093.mjs";
import { buffAmount, buffEffectKey, buffStateLabels, buffTriggers, conditionalBuff, customBuffState, manualBuffEffect, supportsBuffTrigger } from "../helpers/custom-buffs.mjs";
import { uses093 } from "../rules/v093.mjs";
import { initialProgressionWarnings093 } from "../rules/progression-v093.mjs";
import { RACES_093 } from "../rules/races-v093.mjs";
import { ActorSheet, Dialog } from "../helpers/foundry-compat.mjs";
import { installCharacterMethods } from "./character/install-methods.mjs";
import { transformationStateMethods } from "./character/transformation-state.mjs";
import { progressionSkillsMethods } from "./character/progression-skills.mjs";
import { techniquesMethods } from "./character/techniques.mjs";
import { combatMathMethods } from "./character/combat-math.mjs";
import { aurasMethods } from "./character/auras.mjs";
import { collapsedRacialTraits, traitsTalentsMethods } from "./character/traits-talents.mjs";
import { transformationDataMethods } from "./character/transformation-data.mjs";
import { uniquePowersMethods } from "./character/unique-powers.mjs";
import { basesMethods } from "./character/bases.mjs";
import { fusionMethods } from "./character/fusion.mjs";
import { combatDataMethods } from "./character/combat-data.mjs";
import { combatResourcesMethods } from "./character/combat-resources.mjs";
import { createDowntimeMethods } from "./character/downtime.mjs";
import { equipmentMethods } from "./character/equipment.mjs";
import { battleJacketMethods } from "./character/battle-jacket.mjs";
import { transformationActionsMethods } from "./character/transformation-actions.mjs";
import { transformationCatalogMethods } from "./character/transformation-catalog.mjs";
import { combatRoundsMethods } from "./character/combat-rounds.mjs";
import { combatTriggersMethods } from "./character/combat-triggers.mjs";
import { combatDamageMethods } from "./character/combat-damage.mjs";
import { combatTrackerMethods } from "./character/combat-tracker.mjs";
import { listenersMethods } from "./character/listeners.mjs";

/** Foundry lifecycle and composition of the character sheet domain methods. */
export class DBUCharacterSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      scrollY: [...new Set([...(options.scrollY ?? []), ".sheet-body"])],
      classes: ["dbu-old", "sheet", "actor", "character"],
      template: "systems/DBU-MRR-OLD/templates/actor/character-sheet.hbs",
      width: 1100,
      height: 800,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "main",
          group: "primary"
        }
      ]
    });
  }

  // -------------------------------------------------------
  // Form Submission — merge form data with existing actor data
  // -------------------------------------------------------

  /** @override */
  async _updateObject(event, formData) {
    omitUnchangedFields(this, formData);
    // Generic array merge: form data only contains visible fields per row.
    // Hidden fields (id, convertible, etc.) must be preserved from existing data.
    const arrayFieldsToMerge = [
      { key: "progressionRows", fallbackKey: "progressionRows" },
      { key: "customBuffs", fallbackKey: null },
      { key: "attackRefs", fallbackKey: null },
      { key: "transformations", fallbackKey: null }
    ];

    for (const { key, fallbackKey } of arrayFieldsToMerge) {
      const prefix = `system.${key}.`;
      let formRows = {};
      const keysToRemove = [];

      // Collect array sub-keys from flat formData
      for (const fk of Object.keys(formData)) {
        if (!fk.startsWith(prefix)) continue;
        const rest = fk.slice(prefix.length);
        const dotIdx = rest.indexOf(".");
        if (dotIdx > -1) {
          const rowIdx = rest.slice(0, dotIdx);
          const field = rest.slice(dotIdx + 1);
          if (!formRows[rowIdx]) formRows[rowIdx] = {};
          formRows[rowIdx][field] = formData[fk];
        }
        keysToRemove.push(fk);
      }

      if (Object.keys(formRows).length === 0) continue;

      // Remove flat keys
      for (const fk of keysToRemove) delete formData[fk];

      // Get existing stored data (with fallback for progression rows from CONFIG)
      const stored = this.actor.system[key] || [];
      const fallback = fallbackKey ? (CONFIG.DBU?.[fallbackKey] || []) : [];
      const baseRows = stored.length > 0 ? stored : fallback;
      const existing = key === "progressionRows" ? martialProgressionRows(this.actor.system, baseRows) : baseRows;

      formRows = rebaseSheetRows(this._renderedArrays?.[key], stored, formRows);
      if (!formRows) {
        ui.notifications.warn("Esta linha mudou em outra operação. Confira a ficha antes de salvar.");
        throw new Error("Conflito de edição na ficha.");
      }

      // Merge form data onto existing rows
      const submittedIndices = Object.keys(formRows).map(Number);
      const formIndices = existing.length > 0
        ? [...new Set([...existing.keys(), ...submittedIndices])].sort((a, b) => a - b)
        : submittedIndices.sort((a, b) => a - b);
      let mergedRows = formIndices.map(idx => {
        const base = foundry.utils.deepClone(existing[idx] || { id: idx });
        const overlay = formRows[String(idx)];
        return { ...base, ...overlay };
      });
      if (key === "transformations") {
        mergedRows = this._normalizeTransformationRows(mergedRows);
      }
      formData[`system.${key}`] = mergedRows;
    }

    // Sync progression talent selections with system.talents array
    // Progression stores talent NAMES, but system.talents stores talent IDs
    if (formData["system.progressionRows"]) {
      const talentCatalog = CONFIG.DBU?.talentsCatalog || [];
      const nameToId = (name) => {
        const t = talentCatalog.find(c => c.name === name);
        return t ? t.id : null;
      };

      const progRows = formData["system.progressionRows"];
      const oldProgRows = this.actor.system.progressionRows || [];
      if (uses093(this.actor.system)) {
        const martial = usesPathToPower(this.actor.system);
        const warnings = rows => [
          ...initialProgressionWarnings093(martial ? rows.filter(row => progressionRowIsEarned(this.actor.system, row)) : rows, martial),
          ...martialAttributeWarnings(this.actor.system, rows)
        ];
        const previousWarnings = new Set(warnings(oldProgRows));
        const newWarnings = warnings(progRows).filter(warning => !previousWarnings.has(warning));
        if (newWarnings.length) {
          ui.notifications.warn(newWarnings.join(" "));
          return this.render(false);
        }
      }
      const progTalentIds = progRows.map(r => nameToId(r.talent)).filter(Boolean);

      // Determine which IDs came from old progression rows (to identify manual adds)
      const existingTalents = this.actor.system.talents || [];
      const oldProgTalentIds = new Set(
        oldProgRows.map(r => nameToId(r.talent)).filter(Boolean)
      );

      // Talents not from progression (manually added) are preserved
      const manualTalents = existingTalents.filter(t => !oldProgTalentIds.has(t));
      // Combine: manual + new progression talents (unique)
      const combined = [...new Set([...manualTalents, ...progTalentIds])];
      formData["system.talents"] = combined;
    }

    // Ensure integer racial attribute fields don't fail validation with empty strings
    for (const key of ["ag", "fo", "te", "sc", "in", "ma", "pe"]) {
      const field = `system.attributes.${key}.racial`;
      if (field in formData) {
        const v = formData[field];
        if (v === "" || v === null || v === undefined) {
          formData[field] = 0;
        } else {
          formData[field] = Math.round(Number(v)) || 0;
        }
      }
    }

    // Resolve duplicate-name inputs (header + main tab both have lifePoints.value / kiPool.value).
    // FormDataExtended returns an array when two inputs share the same name.
    // Pick the value that differs from the current actor value (= the one the user just edited).
    const resourceFields = [
      { field: "system.lifePoints.value", current: this.actor.system.lifePoints?.value ?? 0, max: this.actor.system.lifePoints?.max ?? Infinity },
      { field: "system.kiPool.value", current: this.actor.system.kiPool?.value ?? 0, max: this.actor.system.kiPool?.max ?? Infinity }
    ];
    for (const { field, current, max } of resourceFields) {
      if (!(field in formData)) continue;
      let v = formData[field];
      // Resolve array from duplicate name inputs: pick the changed value
      if (Array.isArray(v)) {
        const nums = v.map(x => Math.round(Number(x)) || 0);
        const changed = nums.find(n => n !== current);
        v = changed !== undefined ? changed : nums[0];
      }
      if (v === "" || v === null || v === undefined) {
        formData[field] = 0;
      } else {
        formData[field] = Math.clamp(Math.round(Number(v)) || 0, 0, max);
      }
    }

    // NOTE: Absorption threshold auto-eject is handled in _applyDamage (L11474+),
    // which correctly detects LP-based threshold crossings at the moment damage is applied.
    // The `checked` field now means "saved against penalty", not "threshold crossed".

    // --- Possession: damage sharing with Host ---
    const fusion = this.actor.system.fusion || {};
    if (fusion.isFusion && fusion.type === "one-sided-possession" && fusion.hostCurrentLP != null) {
      const lpField = "system.lifePoints.value";
      if (lpField in formData) {
        const oldLP = this.actor.system.lifePoints?.value ?? 0;
        const newLP = Number(formData[lpField]) || 0;
        if (newLP < oldLP) {
          const damageTaken = oldLP - newLP;
          const hostLP = fusion.hostCurrentLP ?? 0;
          const newHostLP = Math.max(0, hostLP - damageTaken);
          formData["system.fusion.hostCurrentLP"] = newHostLP;
          const hostId = (fusion.suppressedCharacterIds || [])[0];
          const hostActor = game.actors?.get(hostId);
          const hostName = hostActor?.name || "Host";
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div style="border-left:3px solid #9b59b6; padding:4px 8px;">
              <b>Possession — Damage Shared</b><br>
              ${this.actor.name} took <b>${damageTaken}</b> damage. ${hostName}'s body also takes <b>${damageTaken}</b> damage.<br>
              ${hostName}'s LP: ${hostLP} → <b>${newHostLP}</b>
              ${newHostLP <= 0 ? `<br><em style="color:#e74c3c;">⚠ ${hostName}'s body has reached 0 LP!</em>` : ""}
            </div>`
          });
          // If host reaches 0 LP: prompt dialog
          if (newHostLP <= 0) {
            setTimeout(() => {
              new Dialog({
                title: "Host Body Defeated",
                content: `<p><b>${hostName}</b>'s body has reached 0 LP while possessed by <b>${this.actor.name}</b>.</p>
                  <p>Choose what happens:</p>`,
                buttons: {
                  defeated: {
                    icon: '<i class="fas fa-skull"></i>',
                    label: "Be Defeated",
                    callback: async () => {
                      await this.actor.update({ "system.lifePoints.value": 0 });
                      ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                        content: `<b>${this.actor.name}</b> is defeated along with the host body.`
                      });
                    }
                  },
                  endPossession: {
                    icon: '<i class="fas fa-sign-out-alt"></i>',
                    label: "End Possession",
                    callback: async () => {
                      const suppIds = this.actor.system.fusion?.suppressedCharacterIds || [];
                      if (suppIds.length > 0) {
                        await this._onEjectSuppressed({ preventDefault: () => {}, actorId: suppIds[0] });
                      }
                    }
                  }
                },
                default: "endPossession"
              }).render(true);
            }, 200);
          }
        }
      }
    }

    return super._updateObject(event, formData);
  }

  // -------------------------------------------------------
  // Data Preparation
  // -------------------------------------------------------

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);

    // Convenience references
    const system = this.actor.system;
    // Normalize transformation rows in-memory for display only (no actor.update in getData)
    if (Array.isArray(system.transformations) && system.transformations.some(t => !(Number.isInteger(Number(t?.id)) && Number(t?.id) > 0))) {
      system._normalizedTransformations = this._normalizeTransformationRows(system.transformations);
    }
    context.system = system;
    context.flags = this.actor.flags;
    context.editable = this.isEditable;

    // Compute buffTotal for display — buffTotal is a transient display field, safe to set on live data
    // since TypeDataModel strips unknown fields on save and prepareDerivedData recomputes each cycle
    const _tier = system.tier || 1;
    const _baseTier = system.baseTier || 1;
    const buffOptions = CONFIG.DBU?.customBuffOptions || [];
    const knownBuffs = new Set(buffOptions.map(buffEffectKey));
    context.buffTriggers = buffTriggers;
    context.automaticBuffOptions = buffOptions.filter(effect => !manualBuffEffect(effect));
    context.conditionalBuffOptions = context.automaticBuffOptions.filter(supportsBuffTrigger);
    for (const buff of (system.customBuffs || [])) {
      buff.buffTotal = buffAmount(buff, _tier, _baseTier);
      const state = customBuffState(buff, system);
      buff.buffState = buffStateLabels[state];
      buff.hasBuffTrigger = conditionalBuff(buff);
      buff.showTriggerPercent = buff.trigger === "lpBelow";
      buff.buffWarning = "";
      if (buff.active && buff.effect) {
        if (manualBuffEffect(buff.effect)) buff.buffWarning = "Aplicação manual";
        else if (!knownBuffs.has(buffEffectKey(buff.effect))) buff.buffWarning = "Efeito fora da lista de sugestões";
      }
    }

    // System config (for drop-down options, labels, etc.)
    context.config = CONFIG.DBU ?? {};

    // Categorize owned items by type
    this._prepareItems(context);

    // Resource bar percentages for the header
    const lpMax = system.lifePoints?.max || 1;
    const kiMax = system.kiPool?.max || 1;
    context.lpPercent = Math.min(100, Math.round(((system.lifePoints?.value || 0) / lpMax) * 100));
    context.kiPercent = Math.min(100, Math.round(((system.kiPool?.value || 0) / kiMax) * 100));
    const dkpMax = system.divineKiPoints?.max || 1;
    context.dkpPercent = Math.min(100, Math.round(((system.divineKiPoints?.value || 0) / dkpMax) * 100));

    // Prepare attributes array for tab-main.hbs
    const attrLabels = CONFIG.DBU?.attributes ?? {};
    context.attributes = Object.entries(system.attributes ?? {}).map(([key, attr]) => ({
      key,
      name: attrLabels[key] || key.toUpperCase(),
      racial: attr.racial ?? 0,
      progression: attr.progression ?? 0,
      score: attr.score ?? 0,
      modifier: attr.modifier ?? 0,
      totalScore: attr.totalScore ?? (attr.score ?? 0)
    }));

    // Prepare skills array for tab-skills.hbs — full breakdown via _calcSkillBreakdown
    const skillsData = CONFIG.DBU?.skillsData ?? [];
    context.skills = skillsData.map((def) => {
      const bd = this._calcSkillBreakdown(def.id);
      const bonus = bd.total;
      const extra = bd.gs + bd.equip + bd.traits + bd.buffs + (Number(this.actor.system.aptitudes?.knowledgeSkillBonus) || 0);
      return {
        key: def.id,
        name: def.name || def.id,
        abbr: bd.attrKey.toUpperCase(),
        defaultAbbr: (def.attribute || "ag").toUpperCase(),
        attributeChoices: Object.entries(attrLabels)
          .filter(([key]) => key !== (def.attribute || "ag"))
          .map(([key, label]) => ({ key, label, selected: key === bd.attrKey })),
        rank: bd.rankNum,
        attrHalf: bd.attr,
        ranksBonus: bd.ranks,
        extra,
        extraStr: extra >= 0 ? `+${extra}` : `${extra}`,
        misc: bd.misc,
        bonus,
        bonusStr: bonus >= 0 ? `+${bonus}` : `${bonus}`,
        breakdownTitle: bd.parts.map(p => `${p.label}: ${p.value >= 0 ? "+" : ""}${p.value}`).join("  |  ")
      };
    });
    // Encompassing Skills (Craft/Knowledge): per-specialty rows (skills.txt:52-56)
    const ENCOMPASSING = {
      crafting: ["Basic Item", "Apparel", "Weapons", "Vehicles"],
      science: ["Science", "Profession", "History"]
    };
    const hasGeniusDesigner = (system._martialTalents ?? system.talents ?? []).includes("genius_designer");
    for (const s of context.skills) {
      if (!(s.key in ENCOMPASSING)) continue;
      s.isEncompassing = true;
      s.suggestedSpecialties = ENCOMPASSING[s.key];
      s.specialties = (system.skillSpecialties?.[s.key] || []).map((row, idx) => {
        const bd = this._calcSkillBreakdown(s.key, row.name);
        return {
          index: idx,
          name: row.name,
          rank: Number(row.rank) || 0,
          misc: bd.misc,
          bonus: bd.total,
          bonusStr: bd.total >= 0 ? `+${bd.total}` : `${bd.total}`,
          geniusApplied: bd.geniusApplied,
          breakdownTitle: bd.parts.map(p => `${p.label}: ${p.value >= 0 ? "+" : ""}${p.value}`).join("  |  ")
        };
      });
      if (s.key === "crafting" && hasGeniusDesigner) {
        s.showGeniusSelect = true;
        s.geniusChoice = system.talentSelections?.geniusDesignerSpecialty || "";
      }
    }

    // Expose for testability
    system._skillBonuses = Object.fromEntries(context.skills.map(s => [s.key, s.bonus]));

    // Subspecies options based on selected race
    context.subspeciesOptions = this._getSubspeciesOptions(system);
    context.subraceOptions = this._getSubraceOptions(system);

    // Select options for dropdowns
    context.raceOptions = {
      saiyan: "Saiyan", earthling: "Earthling", namekian: "Namekian",
      android: "Android", bioAndroid: "Bio-Android", majin: "Majin",
      arcosian: "Arcosian", shinjin: "Shinjin", cerealian: "Cerealian",
      neoTuffle: "Neo-Tuffle", nekoMajin: "Neko-Majin", shadowDragon: "Shadow Dragon",
      undead: "Undead",
      customSpecies: "Custom Species"
    };
    if (uses093(system)) context.raceOptions = Object.fromEntries(Object.entries(RACES_093).map(([id, race]) => [id, race.name]));
    context.rules093 = uses093(system);
    if (context.rules093 && system.combatStates?.surging) {
      const focus = system.combatStates.surgingFocus;
      context.surgingTargets = (globalThis.canvas?.tokens?.placeables || []).filter(t => t.visible && t.actor && t.actor.uuid !== this.actor.uuid)
        .map(t => ({ id: t.document.uuid, name: t.name, selected: t.document.uuid === focus }));
      if (focus && !context.surgingTargets.some(t => t.selected)) context.surgingTargets.push({id:focus, name:"Focus fora da cena", selected:true});
    }
    context.rules093Issues = this.actor.getFlag("DBU-MRR-OLD", "rules093Review")?.issues || [];
    context.sizeOptions = {
      nano: "Nano", tiny: "Tiny", small: "Small", medium: "Medium",
      large: "Large", enormous: "Enormous", gigantic: "Gigantic", colossal: "Colossal"
    };
    // The size select must edit the STORED value, not the derived one —
    // automations (Growth, King's Stature, BJ piloting) overwrite the derived
    // currentSize, and binding the select to it would persist the automated
    // size on any form submit (stuck-size ratchet).
    context.sourceCurrentSize = this.actor._source.system.status?.currentSize || "medium";

    context.dmgCategoryOptions = {
      standard: "Standard", direct: "Direct", lethal: "Lethal"
    };
    context.defenseOptions = {
      none: "None", directHit: "Direct Hit", guard: "Guard"
    };

    // ---- Traits tab data ----
    context.raceLabel = context.raceOptions[system.race] || system.race;
    context.subspeciesLabel = this._getSubspeciesLabel(system) || "—";
    context.subraceLabel = context.subraceOptions.find(option => option.selected)?.label || "—";
    const collapsedTraits = collapsedRacialTraits(this.actor);
    context.characterTraits = this._getCharacterTraits(system).map(trait => ({
      ...trait, collapsed: collapsedTraits.has(trait.id)
    }));
    context.isCustomSpecies = system.race === "customSpecies";

    // ---- Talents tab data ----
    context.talentCategories = Object.keys(CONFIG.DBU?.talentCategories ?? {});
    context.selectedTalentCategory = this._talentCategoryFilter ?? "";
    const allCharTalents = this._getCharacterTalents(system);
    const filtered = context.selectedTalentCategory
      ? allCharTalents.filter(t => t.category === context.selectedTalentCategory)
      : allCharTalents;
    context.characterTalents = filtered;
    context.visibleTalentCount = filtered.length;
    context.totalTalentCount = allCharTalents.length;
    context.talentGroups = this._groupTalentsByCategory(filtered);

    // ---- Bio tab data ----
    // Z-Soul Alignment scale (z-soul.txt): Pure Good (2), Good (1), Neutral (0), Evil (-1), Pure Evil (-2)
    context.alignmentOptions = {
      pure_good: "Pure Good (+2)",
      good: "Good (+1)",
      neutral: "Neutral (0)",
      evil: "Evil (-1)",
      pure_evil: "Pure Evil (-2)"
    };

    // ---- Adversary tab dropdown options ----
    context.adversaryCategoryOptions = {
      villain: "Villain", superior: "Superior", standard: "Standard", mook: "Mook"
    };
    if (context.rules093) {
      context.adversaryCategoryOptions = { standard: "Standard", elite: "Elite", villain: "Villain" };
      if (system.adversary?.category === "superior") context.adversaryCategoryOptions.superior = "Elite (Superior salvo)";
      if (system.adversary?.category === "mook") context.adversaryCategoryOptions.mook = "Mook (legado)";
    }
    context.adversaryDifficultyOptions = {
      easy: "Easy", medium: "Medium", hard: "Hard", super: "Super"
    };
    context.minionDangerOptions = {
      "very-easy": "Very Easy", easy: "Easy", medium: "Medium", hard: "Hard", "very-hard": "Very Hard"
    };

    // Bio tab no longer uses rich text editor (plain textareas match maqueta)

    // ---- Progression tab data ----
    try { this._prepareProgressionData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareProgressionData failed:", err); }

    // ---- Techniques tab data ----
    try { this._prepareTechniquesData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareTechniquesData failed:", err); }

    // ---- Auras tab data ----
    try { this._prepareAurasData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareAurasData failed:", err); }

    // ---- Player Minion panel data (Main tab) ----
    try { this._preparePlayerMinionData(context, system); }
    catch (err) { console.error("DBU-OLD | _preparePlayerMinionData failed:", err); }

    // ---- Transformations tab data ----
    try { this._prepareTransformationsData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareTransformationsData failed:", err); }

    // ---- Unique Abilities tab data ----
    try { this._prepareUniqueData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareUniqueData failed:", err); }

    // ---- Bases (Bio tab) ----
    try { this._prepareBasesData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareBasesData failed:", err); }

    // ---- Equipment tab data ----
    // equipmentItems already prepared by _prepareItems -> context.equipment

    // ---- Attack Ref tab data ----
    try { this._prepareAttackRefData(context, system); }
    catch (err) { console.error("DBU-OLD | _prepareAttackRefData failed:", err); }

    // ---- Active Effects panel (Main tab) ----
    try {
      this._prepareActiveEffects(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareActiveEffects failed:", err);
    }

    // ---- Combat Rolls summary (Main tab) ----
    try {
      this._prepareCombatRollsData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareCombatRollsData failed:", err);
    }

    // ---- Combat State Summary (Main tab) ----
    try {
      const cs = system.combatStates || {};
      const t = system.tier || 1;
      context.combatStateSummary = [];
      if (cs.raging && uses093(system)) context.combatStateSummary.push({ state: "Raging", effect: `+${(cs.ragingLevel || 1) * t} Wound · Botch 1–${1 + (cs.ragingLevel || 1)}` });
      else if (cs.raging) {
        const rageDice = this._ragingWoundDice(system, t).replace(/^\+/, "") || `${t}d4`;
        const rageCat = system.aptitudes?.ragingExtraDiceCatBonus || 0;
        context.combatStateSummary.push({ state: "Raging", effect: `+${rageDice} Wound${rageCat ? ` (Aspect LV${rageCat})` : ""}, \u2212${t} Defense` });
      }
      if (cs.surging) context.combatStateSummary.push({ state: "Surging", effect: uses093(system) ? "Energy Charge em ataques ao Focus" : `+1d4\u00d7${t} Strike & Wound (vs target)` });
      if (cs.mindful) context.combatStateSummary.push({ state: "Mindful", effect: `−${cs.mindfulLevel || 1} Crit Target, −${(cs.mindfulLevel || 1)*t} Wound` });
      if (cs.superior) context.combatStateSummary.push({ state: "Superior", effect: `Greater Dice, +${2 * t} Dmg Received` });
      if (cs.undying) context.combatStateSummary.push({ state: "Undying", effect: `\u2212${t} All Combat Rolls` });
      context.hasCombatStateEffects = context.combatStateSummary.length > 0;
    } catch (err) {
      console.error("DBU-OLD | Combat state summary failed:", err);
      context.combatStateSummary = [];
      context.hasCombatStateEffects = false;
    }

    // ---- Active Conditions summary (Main tab) ----
    try {
      const combatConds = this._getCombatConditions(system);
      context.activeConditions = combatConds.filter(c => c.active).map(c => ({
        name: c.name,
        severity: c.stacks > 1 ? "stacked" : "active"
      }));
    } catch (err) {
      console.error("DBU-OLD | Active conditions summary failed:", err);
      context.activeConditions = [];
    }

    // ---- Combat tab data ----
    try {
      this._prepareCombatData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareCombatData failed:", err);
    }

    // Condition options for Attack Ref lookup (needs combatConditions from _prepareCombatData)
    context.conditionOptions = (context.combatConditions || []).map(c => c.name).sort();

    // ---- Racial Bonus display data ----
    try {
      this._prepareRacialBonusData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareRacialBonusData failed:", err);
    }

    // ---- Manifested Power Bonus display data ----
    try {
      this._prepareManifestedPowerData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareManifestedPowerData failed:", err);
    }

    // ---- Talent Bonus display data ----
    try {
      this._prepareTalentBonusData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareTalentBonusData failed:", err);
    }

    // ---- Enhancement Power Bonus display data ----
    try {
      this._prepareEnhancementPowerData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareEnhancementPowerData failed:", err);
    }

    // ---- Alternate Form Bonus display data ----
    try {
      this._prepareAlternateFormData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareAlternateFormData failed:", err);
    }

    // ---- Legendary Form Bonus display data ----
    try {
      this._prepareLegendaryFormData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareLegendaryFormData failed:", err);
    }

    // ---- Fusion tab data ----
    try {
      this._prepareFusionData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareFusionData failed:", err);
    }

    // ---- Adversary tab data ----
    try {
      this._prepareAdversaryData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareAdversaryData failed:", err);
      context.adversaryTraits = [];
      context.adversaryWeaknesses = [];
      context.minionTraitsData = [];
    }

    // ---- Downtime tab data ----
    try {
      this._prepareDowntimeData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareDowntimeData failed:", err);
    }

    // ---- Transformation Customization tab data ----
    try {
      this._prepareTfCustomizationData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareTfCustomizationData failed:", err);
    }

    // ---- Battle Jacket tab data ----
    try {
      this._prepareBattleJacketTabData(context, system);
    } catch (err) {
      console.error("DBU-OLD | _prepareBattleJacketTabData failed:", err);
    }

    // ---- Combat sub-tab state ----
    // racial/mp/ep/af/lf moved to the Traits/Transformations tabs — coerce
    // stale stored values to "talents".
    const _tbTab = system.combatTabState?.traitsBonusesTab;
    context.combatTabsState = {
      traitsBonusesTab: ["talents", "resources"].includes(_tbTab) ? _tbTab : "talents"
    };

    // ---- Tab badge counts ----
    context.tbTabBadges = {
      racial: (context.hasRacialBonuses || context.hasEarthlingBonuses || context.hasMajinBonuses
        || context.hasBioAndroidBonuses || context.hasAndroidBonuses || context.hasArcosianBonuses
        || context.hasCerealianBonuses || context.hasNamekianBonuses || context.hasNekoMajinBonuses
        || context.hasNeoTuffleBonuses || context.hasShadowDragonBonuses || context.hasShinjinBonuses
        || context.hasUndeadBonuses) ? 1 : 0,
      talents: context.talentBonuses?.entries?.length || 0,
      mp: context.manifestedPowerBonuses?.entries?.length || 0,
      ep: context.enhancementPowerBonuses?.entries?.length || 0,
      af: context.alternateFormBonuses?.entries?.length || 0,
      lf: (context.legendaryFormBonuses?.entries?.length || 0)
        + (context.legendaryTraitsCombat?.entries?.length || 0),
      resources: (context.combatResourceGroups || [])
        .reduce((sum, g) => sum + (g.resources?.length || 0), 0)
    };

    return context;
  }

  // Shared downtime activity metadata
  static DT_COSTS = {
    basicTraining: 1, techniqueTraining: 1, reinforcingForm: 2,
    unlockingForm: 2, transformationTraining: 2, heartbeatTraining: 1,
    resting: 1, studying: 1, baseBuilding: 2
  };
  static DT_NAMES = {
    basicTraining: "Basic Training", techniqueTraining: "Technique Training",
    reinforcingForm: "Reinforcing Form", unlockingForm: "Unlocking Form",
    transformationTraining: "Transformation Training", heartbeatTraining: "Heartbeat Training",
    resting: "Resting", studying: "Studying", baseBuilding: "Base Building"
  };
  static DT_LIMITS = {
    basicTraining: 4, techniqueTraining: 4, transformationTraining: 2,
    heartbeatTraining: 1, resting: 4, studying: 4, baseBuilding: 4
  };

  /** @override Keep the Foundry lifecycle call on the actual sheet class. */
  activateListeners(html) {
    super.activateListeners(html);
    bindRuleSharing(html[0], this.actor);
    captureSheetEdits(this, html, ["progressionRows", "customBuffs", "attackRefs", "transformations"]);
    return listenersMethods.activateListeners.call(this, html);
  }
}

installCharacterMethods(DBUCharacterSheet, [
  { name: 'transformation-state', methods: transformationStateMethods },
  { name: 'progression-skills', methods: progressionSkillsMethods },
  { name: 'techniques', methods: techniquesMethods },
  { name: 'combat-math', methods: combatMathMethods },
  { name: 'auras', methods: aurasMethods },
  { name: 'traits-talents', methods: traitsTalentsMethods },
  { name: 'transformation-data', methods: transformationDataMethods },
  { name: 'unique-powers', methods: uniquePowersMethods },
  { name: 'bases', methods: basesMethods },
  { name: 'fusion', methods: fusionMethods },
  { name: 'combat-data', methods: combatDataMethods },
  { name: 'combat-resources', methods: combatResourcesMethods },
  { name: 'downtime', methods: createDowntimeMethods(DBUCharacterSheet) },
  { name: 'equipment', methods: equipmentMethods },
  { name: 'battle-jacket', methods: battleJacketMethods },
  { name: 'transformation-actions', methods: transformationActionsMethods },
  { name: 'transformation-catalog', methods: transformationCatalogMethods },
  { name: 'combat-rounds', methods: combatRoundsMethods },
  { name: 'combat-triggers', methods: combatTriggersMethods },
  { name: 'combat-damage', methods: combatDamageMethods },
  { name: 'combat-tracker', methods: combatTrackerMethods },
]);
