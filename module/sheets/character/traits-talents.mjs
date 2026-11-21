import { prepareCharacterTraits, prepareCharacterTalents } from "../character-data.mjs";
import { getCatalogById, getRacialCatalogIndex } from "../../helpers/catalog-index.mjs";
import { Dialog } from "../../helpers/foundry-compat.mjs";
import { ELEMENTAL_PROFILES_093 } from "../../rules/profiles-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";
import { openRacialFactorSelector } from "./racial-factors.mjs";

/** Character sheet domain: traits-talents. Methods run with the sheet as this. */
export const traitsTalentsMethods = {

  /**
   * Player Minion panel (Main tab): enrich the selected standard Minion
   * Trait ids with catalog data for display.
   */
  _preparePlayerMinionData(context, system) {
    const m = system.minion || {};
    const catalog = CONFIG.DBU?.minionTraitsCatalog || [];
    // Master side: maximum Minions from Minion Talents (minions.txt Limited
    // Control + talent L3s). Base 1 in combat; Master of Minions / Minion
    // Coordinator / Minion Mark each +2; Minion Army → 10 in combat, no
    // outside limit. Outside of combat: combat max + base ToP.
    const talents = system.talents || [];
    const plusCount = ["master_of_minions", "minion_coordinator", "minion_mark"]
      .filter(t => talents.includes(t)).length;
    const hasArmy = talents.includes("minion_army");
    const combatMax = hasArmy ? 10 : 1 + 2 * plusCount;
    context.playerMinion = {
      master: {
        hasMinionTalents: plusCount > 0 || hasArmy,
        combatMax,
        outsideMax: hasArmy ? "Unlimited" : combatMax + (system.baseTier || 1),
        army: hasArmy
      },
      traitRows: (m.traits || []).map((id, idx) => {
        const data = getCatalogById(catalog).get(id) || { name: id, description: "", effects: [] };
        return {
          idx, id,
          name: data.name,
          description: data.description || "",
          effects: data.effects || [],
          hasOptions: !!data.hasOptions,
          options: data.options || [],
          option: m.traitOptions?.[id] || "",
          isMinionClass: id === "mt_minion_class015",
          commanderZ: system._minionZ ?? 0
        };
      })
    };
  },

  // -------------------------------------------------------
  // Racial Requirement Helpers (OSF Gained Transformations)
  // -------------------------------------------------------

  /**
   * Check if a race ID meets a catalog racialRequirement string.
   * @param {string} raceId - system.race value (e.g. "saiyan", "bioAndroid")
   * @param {string} requirement - catalog racialRequirement (e.g. "Saiyan", "Any (except Bio-Android)")
   * @returns {boolean}
   */
  _meetsRacialRequirement(raceId, requirement) {
    if (!requirement) return true;
    const req = requirement.trim();
    if (req === "Any" || req === "Any Race") return true;

    // "Any (except X)" pattern
    const exceptMatch = req.match(/^Any\s*\(except\s+(.+)\)$/i);
    if (exceptMatch) {
      const excluded = exceptMatch[1].trim();
      return !this._raceMatchesLabel(raceId, excluded);
    }

    // Direct race match
    return this._raceMatchesLabel(raceId, req);
  },

  /**
   * Check if a camelCase race ID matches a display-name label.
   * Handles inconsistencies like "Bio-Androids" vs "Bio-Android" vs "bioAndroid".
   */
  _raceMatchesLabel(raceId, label) {
    const raceMap = {
      saiyan: "saiyan", earthling: "earthling", namekian: "namekian",
      android: "android", bioAndroid: "bio-android", majin: "majin",
      arcosian: "arcosian", shinjin: "shinjin", cerealian: "cerealian",
      neoTuffle: "neo-tuffle", nekoMajin: "neko majin",
      shadowDragon: "shadow dragon", undead: "undead"
    };
    const normalized = (raceMap[raceId] || raceId).toLowerCase();
    const target = label.toLowerCase().replace(/s$/, ""); // strip trailing 's' ("Bio-Androids" → "Bio-Android")
    return normalized === target || normalized === target.replace(/-/g, " ");
  },

  // -------------------------------------------------------
  // Existing Helpers
  // -------------------------------------------------------

  _getSubspeciesLabel(system) {
    const race = system.race || "saiyan";
    const factors = CONFIG.DBU?.racialFactors?.[race] || [];
    const match = factors.find(f => f.id === system.subspecies);
    return match?.name || "";
  },

  // -------------------------------------------------------
  // Data Prep: Racial Bonus Display
  // -------------------------------------------------------

  _prepareRacialBonusData(context, system) {
    const race = system.race || "";
    context.isSaiyan = (race === "saiyan");
    context.isEarthling = (race === "earthling");
    context.isMajin = (race === "majin");
    context.isBioAndroid = (race === "bioAndroid");
    context.isAndroid = (race === "android");
    context.isArcosian = (race === "arcosian");
    context.isCerealian = (race === "cerealian");
    context.isNamekian = (race === "namekian");
    context.isNekoMajin = (race === "nekoMajin");
    context.isNeoTuffle = (race === "neoTuffle");
    context.isShadowDragon = (race === "shadowDragon");
    context.isShinjin = (race === "shinjin");
    context.isUndead = (race === "undead");

    // ---- Saiyan: Battle Born ----
    if (context.isSaiyan) {
      const bb = system.battleBorn || { strike: 0, dodge: 0, wound: 0, undying: false, cap: 2, total: 0, maxTotal: 6 };
      const cap = bb.cap || (bb.undying ? 3 : 2);

      const makePips = (count, max) => {
        const pips = [];
        for (let i = 0; i < max; i++) pips.push({ filled: i < count });
        return pips;
      };

      context.bbStrikePips = makePips(bb.strike, cap);
      context.bbDodgePips = makePips(bb.dodge, cap);
      context.bbWoundPips = makePips(bb.wound, bb.woundCap || cap);
      context.racialBonuses = system.racialBonuses || { has: {} };
      context.hasRacialBonuses = Object.values(context.racialBonuses.has || {}).some(v => v);
      context.battleBornTraitId = "908d85ede236e3ce";
    }

    // ---- Earthling: Resolve, Experienced Fighter, Three-Eyes, Part Beast ----
    if (context.isEarthling) {
      const eb = system.earthlingBonuses || { has: {} };
      context.earthlingBonuses = eb;
      context.hasEarthlingBonuses = Object.values(eb.has || {}).some(v => v);

      // Experienced Fighter state
      const ef = system.experiencedFighter || { mode: "none", usedThisRound: false };
      context.efMode = ef.mode;
      context.efUsedThisRound = ef.usedThisRound;
      context.efCanActivate = eb.has?.experiencedFighter && !ef.usedThisRound;
    }

    // ---- Majin: Bouncy, Assimilation, Bouncy Physique, Super Regen, Mass-Shift, Transfig, Roomy ----
    if (context.isMajin) {
      const mb = system.majinBonuses || { has: {} };
      context.majinBonuses = mb;
      context.hasMajinBonuses = Object.values(mb.has || {}).some(v => v);
    }

    // ---- Bio-Android: Power Core, Red Eye, Namekian Cells, Genetic Efficiency, Genetic Mod ----
    if (context.isBioAndroid) {
      const ba = system.bioAndroidBonuses || { has: {} };
      context.bioAndroidBonuses = ba;
      context.hasBioAndroidBonuses = Object.values(ba.has || {}).some(v => v);
    }

    // ---- Android: Damage Inhibitor, Lock On, Energy Core ----
    if (context.isAndroid) {
      const ab = system.androidBonuses || { has: {} };
      context.androidBonuses = ab;
      context.hasAndroidBonuses = Object.values(ab.has || {}).some(v => v);
    }

    // ---- Arcosian: Survivor, Keratinous Plating ----
    if (context.isArcosian) {
      const arc = system.arcosianBonuses || { has: {} };
      context.arcosianBonuses = arc;
      context.hasArcosianBonuses = Object.values(arc.has || {}).some(v => v);
    }
    // Cruelty Stacks tracker (Cruel Intentions racial trait — works even if
    // the race string differs, e.g. fusions). Max 3, or 6 with Super Evolution.
    if ((system.racialTraits || []).includes("db303ead803660ff")) {
      const cMax = this.actor.constructor.getCrueltyMax(system);
      const cStacks = Math.min(cMax, system.tracking?.crueltyStacks || 0);
      context.crueltyTracker = {
        value: cStacks, max: cMax,
        superEvolution: cMax > 3,
        pips: Array.from({ length: cMax }, (_, i) => ({ filled: i < cStacks })),
        woundBonus: cStacks * (system.tier || 1)
      };
    }

    // ---- Cerealian: Evolved Right Eye, Pinpoint Combat, Scarlet Spotter ----
    if (context.isCerealian) {
      const cer = system.cerealianBonuses || { has: {} };
      context.cerealianBonuses = cer;
      context.hasCerealianBonuses = Object.values(cer.has || {}).some(v => v);
    }

    // ---- Namekian: Biology, Intelligent Fighter, Resilience, Refined Combat, Spirit of Namek ----
    if (context.isNamekian) {
      const nam = system.namekianBonuses || { has: {} };
      context.namekianBonuses = nam;
      context.hasNamekianBonuses = Object.values(nam.has || {}).some(v => v);
    }

    // ---- Neko Majin: Feline Build ----
    if (context.isNekoMajin) {
      const nk = system.nekoMajinBonuses || { has: {} };
      context.nekoMajinBonuses = nk;
      context.hasNekoMajinBonuses = Object.values(nk.has || {}).some(v => v);
    }

    // ---- Neo-Tuffle: Energy of Revenge, Manufactured Physique, Hate Empowerment, Power Hungry ----
    if (context.isNeoTuffle) {
      const nt = system.neoTuffleBonuses || { has: {} };
      context.neoTuffleBonuses = nt;
      context.hasNeoTuffleBonuses = Object.values(nt.has || {}).some(v => v);
    }

    // ---- Shadow Dragon: Wrath, Supernatural Powers ----
    if (context.isShadowDragon) {
      const sd = system.shadowDragonBonuses || { has: {} };
      context.shadowDragonBonuses = sd;
      context.hasShadowDragonBonuses = Object.values(sd.has || {}).some(v => v);
    }

    // ---- Shinjin: Cosmic Efficiency, Arcane Affinity, Light/Dark Magic ----
    if (context.isShinjin) {
      const sh = system.shinjinBonuses || { has: {} };
      context.shinjinBonuses = sh;
      context.hasShinjinBonuses = Object.values(sh.has || {}).some(v => v);
    }

    // ---- Undead: Undead Survival ----
    if (context.isUndead) {
      const ud = system.undeadBonuses || { has: {} };
      context.undeadBonuses = ud;
      context.hasUndeadBonuses = Object.values(ud.has || {}).some(v => v);
    }

    // ---- Collect racial trait triggered effects for combat tab ----
    const raceBonusMap = {
      racialBonuses: "Saiyan",
      earthlingBonuses: "Earthling",
      majinBonuses: "Majin",
      bioAndroidBonuses: "Bio-Android",
      androidBonuses: "Android",
      arcosianBonuses: "Arcosian",
      cerealianBonuses: "Cerealian",
      namekianBonuses: "Namekian",
      nekoMajinBonuses: "Neko Majin",
      neoTuffleBonuses: "Neo-Tuffle",
      shadowDragonBonuses: "Shadow Dragon",
      shinjinBonuses: "Shinjin",
      undeadBonuses: "Undead"
    };
    const allRacialTriggered = [];
    for (const [key, raceName] of Object.entries(raceBonusMap)) {
      const bonuses = system[key];
      if (bonuses?.triggered) {
        for (const t of bonuses.triggered) {
          allRacialTriggered.push({ ...t, sourceName: raceName });
        }
      }
    }
    context.rtTriggeredEffects = this._decorateTriggeredEffects(allRacialTriggered, system, "rt");
  },

  // -------------------------------------------------------
  // Data Prep: Talent Bonus Display
  // -------------------------------------------------------

  _prepareTalentBonusData(context, system) {
    const tbData = system.talentBonuses || { entries: [], hasBonuses: false, totals: {} };
    context.talentBonuses = tbData;
    context.hasTalentBonuses = tbData.hasBonuses && tbData.entries.length > 0;
    context.talentTriggeredEffects = this._decorateTriggeredEffects(
      (tbData.entries || []).flatMap(e =>
        (e.triggered || []).map(t => ({ ...t, sourceName: e.name, catalogKey: e.catalogKey }))
      ),
      system,
      "tb"
    );
    context.talentPerRoundEffects = (tbData.entries || []).flatMap(e =>
      (e.perRound || []).map(pr => ({ ...pr, sourceName: e.name, catalogKey: e.catalogKey }))
    );
    const talentIds = new Set(system.talents || []);
    context.talentStanceButtons = [
      {
        id: "combat_expertise",
        name: "Combat Expertise Shift",
        visible: talentIds.has("combat_expertise")
      },
      {
        id: "balanced_defender",
        name: "Balanced Defender Shift",
        visible: talentIds.has("balanced_defender")
      }
    ].filter(btn => btn.visible);
  },

  // -------------------------------------------------------
  // Battle Born Stack Handlers
  // -------------------------------------------------------

  async _onBBIncrement(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.bbType;
    if (!type) return;
    const bb = foundry.utils.deepClone(this.actor.system.battleBorn || {});
    const cap = type === "wound" ? (bb.woundCap ?? bb.cap ?? 2) : (bb.cap ?? (bb.undying ? 3 : 2));
    const current = bb[type] ?? 0;
    if (current >= cap) return;
    bb[type] = current + 1;
    await this.actor.update({ "system.battleBorn": bb });
  },

  async _onBBDecrement(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.bbType;
    if (!type) return;
    const bb = foundry.utils.deepClone(this.actor.system.battleBorn || {});
    const current = bb[type] ?? 0;
    if (current <= 0) return;
    bb[type] = current - 1;
    await this.actor.update({ "system.battleBorn": bb });
  },

  /**
   * Grant a Battle Born stack via dialog (asks user where to allocate).
   * Only fires if the character is a Saiyan with the Battle Born trait and has room.
   * @param {string} source - Description of why the stack is being granted (e.g. "Even Round 2")
   */
  async _battleBornGrantStack(source) {
    const system = this.actor.system;
    if (system.race !== "saiyan") return;
    const traitIds = system.racialTraits || [];
    if (!traitIds.includes("908d85ede236e3ce")) return; // Battle Born trait ID

    const bb = system.battleBorn || { strike: 0, dodge: 0, wound: 0, undying: false };
    const cap = bb.cap ?? (bb.undying ? 3 : 2);
    const woundCap = bb.woundCap ?? cap;

    // Check if there's room on any roll
    const canStrike = (bb.strike ?? 0) < cap;
    const canDodge = (bb.dodge ?? 0) < cap;
    const canWound = (bb.wound ?? 0) < woundCap;
    if (!canStrike && !canDodge && !canWound) {
      ui.notifications.warn("Battle Born: All combat rolls are at max stacks!");
      await this._applyBattleBornOverflowSideEffects(source);
      return "maxed";
    }

    // Build dialog buttons
    const buttons = {};
    if (canStrike) buttons.strike = { label: `Strike (${bb.strike ?? 0}/${cap})`, callback: () => "strike" };
    if (canDodge) buttons.dodge = { label: `Dodge (${bb.dodge ?? 0}/${cap})`, callback: () => "dodge" };
    if (canWound) buttons.wound = { label: `Wound (${bb.wound ?? 0}/${woundCap})`, callback: () => "wound" };

    const choice = await Dialog.wait({
      title: "Battle Born — Allocate Stack",
      content: `<p><strong>${source}:</strong> Gain 1 stack of Battle Born. Where do you want to allocate it?</p>`,
      buttons,
      close: () => null
    });

    if (!choice) return "cancelled";
    const updated = foundry.utils.deepClone(system.battleBorn || {});
    updated[choice] = (updated[choice] ?? 0) + 1;
    await this.actor.update({ "system.battleBorn": updated });
    await this._applyBattleBornGainSideEffects(source);
    ui.notifications.info(`Battle Born: +1 stack to ${choice.charAt(0).toUpperCase() + choice.slice(1)} (${source})`);
    return "granted";
  },

  // -------------------------------------------------------
  // Experienced Fighter Handler (Earthling)
  // -------------------------------------------------------

  async _onExperiencedFighterActivate(event) {
    event.preventDefault();
    const mode = event.currentTarget.dataset.efMode;
    if (!mode || mode === "none") return;

    const system = this.actor.system;
    const ef = system.experiencedFighter || {};

    // Prevent double activation in same round
    if (ef.usedThisRound) {
      ui.notifications.warn("Experienced Fighter: Already used this round!");
      return;
    }

    // Check Ki cost: 4(bT)
    const baseTier = system.baseTier || Math.ceil((system.tier || 1) / 2);
    const kiCost = 4 * baseTier;
    const currentKi = system.kiPool?.value ?? 0;
    if (currentKi < kiCost) {
      ui.notifications.warn(`Experienced Fighter: Not enough Ki! Need ${kiCost}, have ${currentKi}.`);
      return;
    }

    // Deduct Ki and activate mode
    await this.actor.update({
      "system.experiencedFighter.mode": mode,
      "system.experiencedFighter.usedThisRound": true,
      "system.kiPool.value": currentKi - kiCost
    });

    const labels = { strike: "Exploitation Strike", dodge: "Instinct-Driven Dodge", wound: "Punishing Blow" };
    ui.notifications.info(`Experienced Fighter: ${labels[mode]} activated! (−${kiCost} Ki)`);
  },

  async _onExperiencedFighterDeactivate(event) {
    event.preventDefault();
    // Allow deactivating but keep usedThisRound true (Ki already spent, can't reuse)
    await this.actor.update({
      "system.experiencedFighter.mode": "none"
    });
  },

  // -------------------------------------------------------
  // Data Prep: Adversary
  // -------------------------------------------------------

  _prepareAdversaryData(context, system) {
    const adv = system.adversary || {};
    if (!adv.enabled) {
      context.adversaryTraits = [];
      context.adversaryWeaknesses = [];
      context.minionTraitsData = [];
      context.adversaryLPBonus = 0;
      context.adversaryKPBonus = 0;
      return;
    }

    // LP/KP bonus display values
    const pl = system.level || 1;
    switch (adv.category) {
      case "villain":  context.adversaryLPBonus = 4 * pl; context.adversaryKPBonus = 4 * pl; break;
      case "superior": context.adversaryLPBonus = 2 * pl; context.adversaryKPBonus = 2 * pl; break;
      case "mook":     context.adversaryLPBonus = "\u00f74"; context.adversaryKPBonus = "\u00f72"; break;
      default:         context.adversaryLPBonus = 0; context.adversaryKPBonus = 0; break;
    }

    // Villainous Traits
    const vtCatalog = CONFIG.DBU?.villainousTraitsCatalog || [];
    const vtSelectedIds = adv.villainousTraits || [];
    const vtOptions = adv.villainousOptionSelections || {};
    context.adversaryTraits = [];
    for (const id of vtSelectedIds) {
      const traitData = getCatalogById(vtCatalog).get(id);
      if (!traitData) continue;
      const trait = foundry.utils.deepClone(traitData);
      const traitSelections = vtOptions[id] || {};
      for (const effect of (trait.effects || [])) {
        if (effect.options && (effect.activationType === "option" || effect.activationType === "choice")) {
          const selected = traitSelections[effect.level];
          for (const opt of effect.options) opt.selected = (opt.name === selected);
          if (!effect.options.some(o => o.selected) && effect.options.length > 0) effect.options[0].selected = true;
        }
      }
      context.adversaryTraits.push(trait);
    }

    // Weaknesses
    const wkCatalog = CONFIG.DBU?.weaknessesCatalog || [];
    const wkSelectedIds = adv.weaknesses || [];
    context.adversaryWeaknesses = [];
    for (const id of wkSelectedIds) {
      const wkData = getCatalogById(wkCatalog).get(id);
      if (!wkData) continue;
      context.adversaryWeaknesses.push(foundry.utils.deepClone(wkData));
    }

    // Minion Traits
    const mtCatalog = CONFIG.DBU?.minionTraitsCatalog || [];
    const mtSelectedIds = adv.minion?.minionTraits || [];
    context.minionTraitsData = [];
    for (const id of mtSelectedIds) {
      const mtData = mtCatalog.find(m => m.id === id);
      if (!mtData) continue;
      context.minionTraitsData.push(foundry.utils.deepClone(mtData));
    }
  },

  _getCharacterTraits(system) {
    return prepareCharacterTraits(system);
  },

  _getCharacterTalents(system) {
    return prepareCharacterTalents(system);
  },

  _groupTalentsByCategory(talents) {
    const groups = {};
    for (const talent of talents) {
      const cat = talent.category || "Miscellaneous";
      if (!groups[cat]) groups[cat] = { category: cat, talents: [] };
      groups[cat].talents.push(talent);
    }
    return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category));
  },

  _getSubspeciesOptions(system) {
    const race = system.race || "saiyan";
    const factors = CONFIG.DBU?.racialFactors?.[race] || [];
    return factors.map(f => ({ value: f.id, label: f.name, selected: f.id === system.subspecies }));
  },

  _getSubraceOptions(system) {
    const race = system.race || "saiyan";
    const subraces = CONFIG.DBU?.racialSubraces?.[race] || [];
    return subraces.map(sr => ({ value: sr.id, label: sr.name, selected: sr.id === system.subrace }));
  },

  // -------------------------------------------------------
  // Racial Trait CRUD
  // -------------------------------------------------------

  _onToggleTrait(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const card = btn.closest(".trait-card");
    if (!card) return;
    const effectsList = card.querySelector(".trait-effects-list");
    const description = card.querySelector(".trait-description");
    const icon = btn.querySelector("i");
    if (!effectsList) return;
    const isCollapsed = effectsList.style.display === "none";
    effectsList.style.display = isCollapsed ? "" : "none";
    if (description) description.style.display = isCollapsed ? "" : "none";
    if (icon) icon.className = isCollapsed ? "fas fa-chevron-down" : "fas fa-chevron-right";
  },

  async _onAddTrait(event) {
    event.preventDefault();
    const race = this.actor.system.race || "saiyan";
    const catalog = CONFIG.DBU?.racialTraitsCatalog || {};
    if (uses093(this.actor.system) && event.currentTarget?.dataset?.racialFactors !== undefined) {
      return openRacialFactorSelector(this.actor, catalog);
    }
    const selectedIds = this.actor.system.racialTraits || [];

    const allTraits = [];
    for (const [traitRace, traits] of Object.entries(catalog)) {
      for (const trait of traits) {
        allTraits.push({ ...trait, race: traitRace, isSelected: selectedIds.includes(trait.id) });
      }
    }
    allTraits.sort((a, b) => {
      if (a.race === race && b.race !== race) return -1;
      if (b.race === race && a.race !== race) return 1;
      return a.name.localeCompare(b.name);
    });

    // Collect unique races for filter (use display names from sheet raceOptions)
    const raceDisplayNames = {
      saiyan: "Saiyan", earthling: "Earthling", namekian: "Namekian",
      android: "Android", bioAndroid: "Bio-Android", majin: "Majin",
      arcosian: "Arcosian", shinjin: "Shinjin", cerealian: "Cerealian",
      neoTuffle: "Neo-Tuffle", nekoMajin: "Neko-Majin", shadowDragon: "Shadow Dragon",
      undead: "Undead", customSpecies: "Custom Species"
    };
    const races = [...new Set(allTraits.map(t => t.race))].sort();
    const raceOptions = races.map(r => `<option value="${r}" ${r === race ? "selected" : ""}>${raceDisplayNames[r] || r}</option>`).join("");

    const buildList = (filterRace, hideSelected) => {
      return allTraits.filter(t => {
        if (filterRace && t.race !== filterRace) return false;
        if (hideSelected && t.isSelected) return false;
        return true;
      }).map(t => {
        const badge = t.traitCategory || "secondary";
        const selClass = t.isSelected ? "trait-selector-selected" : "";
        return `<div class="trait-selector-item ${selClass}" data-trait-id="${t.id}">
          <span class="trait-selector-name">${t.name}</span>
          <span class="trait-category-badge ${badge}">${badge}</span>
          <span class="trait-selector-race">${raceDisplayNames[t.race] || t.race}</span>
          ${t.isSelected ? '<span class="trait-selector-check"><i class="fas fa-check"></i></span>' : ""}
        </div>`;
      }).join("");
    };

    const content = `<div class="trait-selector-modal">
      <div class="trait-selector-filters">
        <div class="filter-group"><label>Filter by Race:</label><select class="trait-race-filter"><option value="">All Races</option>${raceOptions}</select></div>
        <div class="filter-group"><label class="filter-toggle"><input type="checkbox" class="trait-hide-selected" /> Hide selected</label></div>
      </div>
      <div class="trait-selector-list">${buildList(race, false)}</div>
    </div>`;

    const dlg = new Dialog({
      title: "Add Racial Trait",
      content,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find(".trait-selector-list");
        const raceFilter = html.find(".trait-race-filter");
        const hideCheck = html.find(".trait-hide-selected");

        const refresh = () => {
          const r = raceFilter.val();
          const h = hideCheck.is(":checked");
          listEl.html(buildList(r, h));
        };

        raceFilter.on("change", refresh);
        hideCheck.on("change", refresh);

        html.on("click", ".trait-selector-item:not(.trait-selector-selected)", async (ev) => {
          const traitId = ev.currentTarget.dataset.traitId;
          if (!traitId) return;
          // Read from _source: derived racialTraits may be filtered/swapped
          // (Shapeshift exchange, OSF possession) — persisting it would lose traits.
          const traits = foundry.utils.deepClone(this.actor._source.system.racialTraits || []);
          traits.push(traitId);
          await this.actor.update({ "system.racialTraits": traits });
          // Mark as selected in allTraits for refresh
          const t = allTraits.find(x => x.id === traitId);
          if (t) t.isSelected = true;
          refresh();
        });
      }
    }, { width: 500, height: 500, classes: ["dbu-old", "trait-selector-dialog"] });
    dlg.render(true);
  },

  /** Uniform delete confirmation for character-sheet records. */
  async _confirmDelete(kind, name) {
    return Dialog.confirm({
      title: `Delete ${kind}`,
      content: `<p>Delete <b>${Handlebars.escapeExpression(name || kind)}</b>? This cannot be undone.</p>`
    });
  },

  async _onDeleteTrait(event) {
    event.preventDefault();
    const traitId = event.currentTarget.dataset.traitId;
    if (!traitId) return;
    // Read from _source: derived racialTraits may be filtered/swapped
    // (Shapeshift exchange, OSF possession) — persisting it would lose traits.
    const traits = foundry.utils.deepClone(this.actor._source.system.racialTraits || []);
    const index = traits.indexOf(traitId);
    if (index > -1) {
      const traitsById = getRacialCatalogIndex(CONFIG.DBU?.racialTraitsCatalog).byId;
      const traitName = traitsById.get(traitId)?.name || "Racial Trait";
      if (!(await this._confirmDelete("Racial Trait", traitName))) return;
      traits.splice(index, 1);
      const options = foundry.utils.deepClone(this.actor.system.racialOptionSelections || {});
      delete options[traitId];
      await this.actor.update({ "system.racialTraits": traits, "system.racialOptionSelections": options });
    }
  },

  async _onTraitOptionSelect(event) {
    const { dataset: { traitId, effectLevel, elementalProfile }, value } = event.currentTarget;
    if (!traitId || !effectLevel) return;
    const system = this.actor.system;
    const trait = getRacialCatalogIndex(CONFIG.DBU?.racialTraitsCatalog).byId.get(traitId);
    if (trait?.rulesVersion === "0.9.3") {
      const effect = trait.effects.find(entry => String(entry.level) === effectLevel);
      if (!this.isEditable || !system.racialTraits?.includes(traitId) || effect?.activationType !== "option") return;
      const path = `system.racialOptionSelections.${traitId}`;
      const saved = system.racialOptionSelections?.[traitId];
      const options = effect.options.filter(opt => !opt.requiredRace || opt.requiredRace === system.race);
      if (elementalProfile) {
        if (options.some(opt => opt.selectElement && opt.name === saved?.[effectLevel]) && ELEMENTAL_PROFILES_093.includes(value)) {
          await this.actor.update({ [`${path}.elementalProfiles.${effectLevel}`]: value });
        }
        return;
      }
      if (!options.some(opt => opt.name === value)) return;
      const update = { [`${path}.${effectLevel}`]: value };
      if (value !== saved?.[effectLevel] && saved?.elementalProfiles?.[effectLevel]) {
        update[`${path}.elementalProfiles.-=${effectLevel}`] = null;
      }
      await this.actor.update(update);
      return;
    }
    const options = foundry.utils.deepClone(this.actor.system.racialOptionSelections || {});
    if (!options[traitId]) options[traitId] = {};
    options[traitId][effectLevel] = value;
    await this.actor.update({ "system.racialOptionSelections": options });
  },

  /** Part Beast (Earthling Beastman): toggle one of the two permanent Bestial Traits. */
  async _onPartBeastBestialCheck(event) {
    const el = event.currentTarget;
    const id = el.dataset.name;
    if (!id) return;
    const chosen = foundry.utils.deepClone(this.actor.system.transformationMeta?.mutationState?.partBeastBestialTraits || []);
    if (el.checked) {
      if (chosen.length >= 2) { el.checked = false; return; }
      if (!chosen.includes(id)) chosen.push(id);
    } else {
      const i = chosen.indexOf(id);
      if (i >= 0) chosen.splice(i, 1);
    }
    await this.actor.update({ "system.transformationMeta.mutationState.partBeastBestialTraits": chosen });
  },

  /** Divergent Evolution (Traits tab): choose the granted Meta Trait. */
  async _onDivergentMetaSelect(event) {
    const val = event.currentTarget.value;
    // Clear stale per-trait config when switching (ObjectField merge would keep it)
    await this.actor.update({
      "system.transformationMeta.metaTraitState.divergent.trait": val,
      "system.transformationMeta.metaTraitState.divergent.config.-=option": null,
      "system.transformationMeta.metaTraitState.divergent.config.-=bestialTrait": null
    });
  },

  /** Divergent Evolution (Traits tab): option / bestial trait for the chosen Meta Trait. */
  async _onDivergentMetaConfig(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    await this.actor.update({
      [`system.transformationMeta.metaTraitState.divergent.config.${field}`]: event.currentTarget.value
    });
  },

  /** Part Beast: option for a chosen Bestial Trait (shared bestialTraitConfig). */
  async _onPartBeastBestialOption(event) {
    const el = event.currentTarget;
    const traitId = el.dataset.traitId;
    if (!traitId) return;
    const cfg = foundry.utils.deepClone(this.actor.system.transformationMeta?.mutationState?.bestialTraitConfig || {});
    cfg[traitId] = { ...(cfg[traitId] || {}), option: el.value };
    await this.actor.update({ "system.transformationMeta.mutationState.bestialTraitConfig": cfg });
  },

  async _onTraitOptionCheckbox(event) {
    const { traitId, effectLevel, optionName, maxOptions } = event.currentTarget.dataset;
    if (!traitId || !effectLevel || !optionName) return;
    const system = this.actor.system;
    const trait = getRacialCatalogIndex(CONFIG.DBU?.racialTraitsCatalog).byId.get(traitId);
    if (trait?.rulesVersion === "0.9.3") {
      const effect = trait.effects.find(entry => String(entry.level) === effectLevel);
      if (!this.isEditable || !system.racialTraits?.includes(traitId) || effect?.activationType !== "multi-option") return;
      const allowed = effect.options.filter(opt => !opt.requiredRace || opt.requiredRace === system.race).map(opt => opt.name);
      if (!allowed.includes(optionName)) return;
      const saved = system.racialOptionSelections?.[traitId]?.[effectLevel];
      const current = (Array.isArray(saved) ? saved : [saved]).filter(name => allowed.includes(name));
      const next = event.currentTarget.checked ? [...new Set([...current, optionName])] : current.filter(name => name !== optionName);
      if (next.length > effect.optionCount) {
        event.currentTarget.checked = current.includes(optionName);
        return;
      }
      await this.actor.update({ [`system.racialOptionSelections.${traitId}.${effectLevel}`]: next });
      return;
    }
    const options = foundry.utils.deepClone(this.actor.system.racialOptionSelections || {});
    if (!options[traitId]) options[traitId] = {};
    let current = options[traitId][effectLevel];
    if (!Array.isArray(current)) current = current ? [current] : [];
    const max = maxOptions ? Number(maxOptions) : Infinity;
    if (event.currentTarget.checked) {
      if (current.length < max && !current.includes(optionName)) current.push(optionName);
      else if (current.length >= max) { event.currentTarget.checked = false; return; }
    } else {
      current = current.filter(n => n !== optionName);
    }
    options[traitId][effectLevel] = current;
    await this.actor.update({ "system.racialOptionSelections": options });
  },

  // -------------------------------------------------------
  // Adversary: Villainous Trait CRUD
  // -------------------------------------------------------

  async _onAddVillainousTrait(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.villainousTraitsCatalog || [];
    const selectedIds = this.actor.system.adversary?.villainousTraits || [];

    const allTraits = catalog.map(t => ({
      ...t,
      isSelected: selectedIds.includes(t.id)
    }));

    const buildList = (hideSelected) => {
      return allTraits.filter(t => {
        if (hideSelected && t.isSelected) return false;
        return true;
      }).map(t => {
        const badge = t.category || "offensive";
        const selClass = t.isSelected ? "trait-selector-selected" : "";
        return `<div class="trait-selector-item ${selClass}" data-trait-id="${t.id}">
          <span class="trait-selector-name">${t.name}</span>
          <span class="trait-category-badge ${badge}">${badge}</span>
          ${t.isSelected ? '<span class="trait-selector-check"><i class="fas fa-check"></i></span>' : ""}
        </div>`;
      }).join("");
    };

    const content = `<div class="trait-selector-modal">
      <div class="trait-selector-filters">
        <div class="filter-group"><label class="filter-toggle"><input type="checkbox" class="trait-hide-selected" /> Hide selected</label></div>
      </div>
      <div class="trait-selector-list">${buildList(false)}</div>
    </div>`;

    const dlg = new Dialog({
      title: "Add Villainous Trait",
      content,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find(".trait-selector-list");
        const hideCheck = html.find(".trait-hide-selected");
        const refresh = () => listEl.html(buildList(hideCheck.is(":checked")));
        hideCheck.on("change", refresh);
        html.on("click", ".trait-selector-item:not(.trait-selector-selected)", async (ev) => {
          const traitId = ev.currentTarget.dataset.traitId;
          if (!traitId) return;
          const traits = foundry.utils.deepClone(this.actor.system.adversary?.villainousTraits || []);
          traits.push(traitId);
          await this.actor.update({ "system.adversary.villainousTraits": traits });
          const t = allTraits.find(x => x.id === traitId);
          if (t) t.isSelected = true;
          refresh();
        });
      }
    }, { width: 500, height: 500, classes: ["dbu-old", "trait-selector-dialog"] });
    dlg.render(true);
  },

  async _onDeleteVillainousTrait(event) {
    event.preventDefault();
    const traitId = event.currentTarget.dataset.traitId;
    if (!traitId) return;
    const traits = foundry.utils.deepClone(this.actor.system.adversary?.villainousTraits || []);
    const index = traits.indexOf(traitId);
    if (index > -1) {
      traits.splice(index, 1);
      const options = foundry.utils.deepClone(this.actor.system.adversary?.villainousOptionSelections || {});
      delete options[traitId];
      await this.actor.update({
        "system.adversary.villainousTraits": traits,
        "system.adversary.villainousOptionSelections": options
      });
    }
  },

  // -------------------------------------------------------
  // Adversary: Weakness CRUD
  // -------------------------------------------------------

  async _onAddWeakness(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.weaknessesCatalog || [];
    const selectedIds = this.actor.system.adversary?.weaknesses || [];

    const allWeaknesses = catalog.map(w => ({
      ...w,
      isSelected: selectedIds.includes(w.id)
    }));

    const buildList = (hideSelected) => {
      return allWeaknesses.filter(w => {
        if (hideSelected && w.isSelected) return false;
        return true;
      }).map(w => {
        const selClass = w.isSelected ? "trait-selector-selected" : "";
        return `<div class="trait-selector-item ${selClass}" data-trait-id="${w.id}">
          <span class="trait-selector-name">${w.name}</span>
          <span class="trait-category-badge weakness">weakness</span>
          ${w.isSelected ? '<span class="trait-selector-check"><i class="fas fa-check"></i></span>' : ""}
        </div>`;
      }).join("");
    };

    const content = `<div class="trait-selector-modal">
      <div class="trait-selector-filters">
        <div class="filter-group"><label class="filter-toggle"><input type="checkbox" class="trait-hide-selected" /> Hide selected</label></div>
      </div>
      <div class="trait-selector-list">${buildList(false)}</div>
    </div>`;

    const dlg = new Dialog({
      title: "Add Weakness",
      content,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find(".trait-selector-list");
        const hideCheck = html.find(".trait-hide-selected");
        const refresh = () => listEl.html(buildList(hideCheck.is(":checked")));
        hideCheck.on("change", refresh);
        html.on("click", ".trait-selector-item:not(.trait-selector-selected)", async (ev) => {
          const wkId = ev.currentTarget.dataset.traitId;
          if (!wkId) return;
          const weaknesses = foundry.utils.deepClone(this.actor.system.adversary?.weaknesses || []);
          weaknesses.push(wkId);
          await this.actor.update({ "system.adversary.weaknesses": weaknesses });
          const w = allWeaknesses.find(x => x.id === wkId);
          if (w) w.isSelected = true;
          refresh();
        });
      }
    }, { width: 500, height: 400, classes: ["dbu-old", "trait-selector-dialog"] });
    dlg.render(true);
  },

  async _onDeleteWeakness(event) {
    event.preventDefault();
    const traitId = event.currentTarget.dataset.traitId;
    if (!traitId) return;
    const weaknesses = foundry.utils.deepClone(this.actor.system.adversary?.weaknesses || []);
    const index = weaknesses.indexOf(traitId);
    if (index > -1) {
      weaknesses.splice(index, 1);
      const options = foundry.utils.deepClone(this.actor.system.adversary?.weaknessOptionSelections || {});
      delete options[traitId];
      await this.actor.update({
        "system.adversary.weaknesses": weaknesses,
        "system.adversary.weaknessOptionSelections": options
      });
    }
  },

  // -------------------------------------------------------
  // Adversary: Minion Trait CRUD
  // -------------------------------------------------------

  async _onAddMinionTrait(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.minionTraitsCatalog || [];
    const selectedIds = this.actor.system.adversary?.minion?.minionTraits || [];

    const allTraits = catalog.map(t => ({
      ...t,
      isSelected: selectedIds.includes(t.id)
    }));

    const buildList = () => {
      return allTraits.map(t => {
        const selClass = t.isSelected ? "trait-selector-selected" : "";
        return `<div class="trait-selector-item ${selClass}" data-trait-id="${t.id}">
          <span class="trait-selector-name">${t.name}</span>
          <span class="trait-category-badge minion">minion</span>
          ${t.isSelected ? '<span class="trait-selector-check"><i class="fas fa-check"></i></span>' : ""}
        </div>`;
      }).join("");
    };

    const content = `<div class="trait-selector-modal">
      <div class="trait-selector-list">${buildList()}</div>
    </div>`;

    const dlg = new Dialog({
      title: "Add Minion Trait",
      content,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find(".trait-selector-list");
        html.on("click", ".trait-selector-item:not(.trait-selector-selected)", async (ev) => {
          const traitId = ev.currentTarget.dataset.traitId;
          if (!traitId) return;
          const traits = foundry.utils.deepClone(this.actor.system.adversary?.minion?.minionTraits || []);
          traits.push(traitId);
          await this.actor.update({ "system.adversary.minion.minionTraits": traits });
          const t = allTraits.find(x => x.id === traitId);
          if (t) t.isSelected = true;
          listEl.html(buildList());
        });
      }
    }, { width: 500, height: 300, classes: ["dbu-old", "trait-selector-dialog"] });
    dlg.render(true);
  },

  // -------------------------------------------------------
  // Player Minion Trait CRUD (Main tab panel)
  // -------------------------------------------------------

  async _onAddPlayerMinionTrait(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.minionTraitsCatalog || [];
    const selected = this.actor.system.minion?.traits || [];
    const rows = catalog.map(t => {
      const count = selected.filter(id => id === t.id).length;
      const taken = count > 0 && !t.stackable;
      const dangerNote = (t.dangerousOnly ? ' <span class="trait-category-badge minion">Dangerous — not encouraged for players</span>' : "")
        + (t.commanderOnly ? ' <span class="trait-category-badge">Granted by the Master\'s Commander MP</span>' : "");
      const countBadge = count > 0 && t.stackable ? ` <span class="trait-category-badge">×${count}</span>` : "";
      return `<div class="talent-selector-item ${taken ? "talent-selector-selected" : ""}" data-trait-id="${t.id}">
        <span class="talent-selector-name">${t.name}${dangerNote}${countBadge}</span>
        <div class="talent-selector-prereq">${t.description || ""}</div>
        ${taken ? '<span class="talent-selector-check"><i class="fas fa-check"></i></span>' : ""}
      </div>`;
    }).join("");
    const dlg = new Dialog({
      title: "Add Minion Trait",
      content: `<div class="talent-selector-modal"><div class="talent-selector-list">${rows}</div></div>`,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        html.on("click", ".talent-selector-item:not(.talent-selector-selected)", async (ev) => {
          const traitId = ev.currentTarget.dataset.traitId;
          if (!traitId) return;
          const traits = foundry.utils.deepClone(this.actor.system.minion?.traits || []);
          traits.push(traitId);
          await this.actor.update({ "system.minion.traits": traits });
          dlg.close();
        });
      }
    }, { width: 520, height: 500, classes: ["dbu-old", "talent-selector-dialog"] });
    dlg.render(true);
  },

  /**
   * Create a Duplicate Minion (minions.txt:38 / Multi-Form Technique): clone
   * this actor — the clone carries Attributes, Talents, Racial Traits, STs,
   * Auras, UAs and Transformations with their Option selections, and if the
   * Master is transformed the copy is created transformed — then flag it as
   * an enabled Duplicate Minion so the Minion Rules automation applies.
   * Snapshot only: it does NOT sync with later changes to the Master.
   */
  async _onCreateDuplicateMinion(event) {
    event.preventDefault();
    if (!game.user.can("ACTOR_CREATE")) {
      ui.notifications.warn("You don't have permission to create Actors — ask your GM to press this button (or to grant Actor creation).");
      return;
    }
    const src = this.actor.toObject();
    // Numbered name (Mass Multi-Form allows up to 3 Duplicates)
    const base = `${this.actor.name} (Duplicate`;
    const count = game.actors.filter(a => a.name.startsWith(base)).length;
    src.name = count > 0 ? `${base} ${count + 1})` : `${base})`;
    if (src.prototypeToken) src.prototypeToken.name = src.name;
    const sys = src.system;
    // Duplicate + Minion Rules flags (Minion Traits blocked by isDuplicate)
    sys.minion = { enabled: true, isDuplicate: true, isMinionRace: false, masterName: this.actor.name, traits: [], traitOptions: {} };
    // The rule copies the CHARACTER, not their current combat round — clear
    // transient combat state ({} lets the schema refill its defaults).
    sys.customBuffs = [];
    sys.conditions = (sys.conditions || []).map(c => ({ ...c, active: false, stacks: 0, roundApplied: null }));
    sys.combatStates = {};
    sys.tracking = {};
    sys.combatTabState = {};
    sys.effectTracking = { enabledPassives: sys.effectTracking?.enabledPassives ?? {}, usedEffects: { round: {}, encounter: {} } };
    // Links are NOT copied: Battle Jacket (bidirectional ids) and fusion state
    sys.pilotedJacketId = "";
    sys.fusion = {};
    const dup = await Actor.create(src);
    if (!dup) return;
    // Fill current LP/KP to the minion-rule maxima (LP÷5 — or ÷2 for Minion
    // Races — and KP÷2 are derived on the new actor's prepared data).
    await dup.update({
      "system.lifePoints.value": dup.system.lifePoints?.max ?? 0,
      "system.kiPool.value": dup.system.kiPool?.max ?? 0
    });
    ui.notifications.info(`Duplicate Minion "${dup.name}" created. Remember the manual bits: Master's ToP −1 while it exists (Multi-Form), defeat on a failed Steadfast Check, and it cannot target its Master as an Ally.`);
    dup.sheet.render(true);
  },

  async _onDeletePlayerMinionTrait(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const traits = foundry.utils.deepClone(this.actor.system.minion?.traits || []);
    if (index >= 0 && index < traits.length) {
      traits.splice(index, 1);
      await this.actor.update({ "system.minion.traits": traits });
    }
  },

  async _onDeleteMinionTrait(event) {
    event.preventDefault();
    const traitId = event.currentTarget.dataset.traitId;
    if (!traitId) return;
    const traits = foundry.utils.deepClone(this.actor.system.adversary?.minion?.minionTraits || []);
    const index = traits.indexOf(traitId);
    if (index > -1) {
      traits.splice(index, 1);
      await this.actor.update({ "system.adversary.minion.minionTraits": traits });
    }
  },

  _onToggleTraitCard(event) {
    event.preventDefault();
    const card = event.currentTarget.closest(".trait-card");
    if (card) card.classList.toggle("collapsed");
  },

  // -------------------------------------------------------
  // Talent CRUD
  // -------------------------------------------------------

  async _onAddTalent(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.talentsCatalog || [];
    const selectedIds = foundry.utils.deepClone(this.actor.system.talents || []);

    // Build enriched list with selection state
    const allTalents = catalog.map(t => ({
      ...t,
      isSelected: selectedIds.includes(t.id)
    }));
    allTalents.sort((a, b) => {
      const catCmp = (a.category || "").localeCompare(b.category || "");
      return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
    });

    // Collect unique categories
    const categories = [...new Set(allTalents.map(t => t.category).filter(Boolean))].sort();
    const catOptions = categories.map(c => `<option value="${c}">${c}</option>`).join("");

    const buildList = (catFilter, searchText, hideSelected) => {
      const filtered = allTalents.filter(t => {
        if (catFilter && t.category !== catFilter) return false;
        if (hideSelected && t.isSelected) return false;
        if (searchText) {
          const s = searchText.toLowerCase();
          if (!t.name.toLowerCase().includes(s) && !(t.description || "").toLowerCase().includes(s)) return false;
        }
        return true;
      });

      // Group by category
      const groups = {};
      for (const t of filtered) {
        const cat = t.category || "Miscellaneous";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(t);
      }

      let html = "";
      for (const [cat, talents] of Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))) {
        html += `<div class="talent-selector-group-header">${cat} (${talents.length})</div>`;
        for (const t of talents) {
          const selClass = t.isSelected ? "talent-selector-selected" : "";
          const prereq = t.prerequisites ? `<span class="talent-selector-prereq">Prereq: ${t.prerequisites}</span>` : "";
          html += `<div class="talent-selector-item ${selClass}" data-talent-id="${t.id}">
            <span class="talent-selector-name">${t.name}</span>
            <span class="talent-category-badge">${t.category}</span>
            ${prereq}
            ${t.isSelected ? '<span class="talent-selector-check"><i class="fas fa-check"></i></span>' : ""}
          </div>`;
        }
      }
      return html || '<div class="empty-message">No talents match filters.</div>';
    };

    const content = `<div class="talent-selector-modal">
      <div class="talent-selector-filters">
        <div class="filter-group"><label>Category:</label><select class="talent-cat-filter"><option value="">All Categories</option>${catOptions}</select></div>
        <div class="filter-group"><label>Search:</label><input type="text" class="talent-search" placeholder="Search talents..." /></div>
        <div class="filter-group"><label class="filter-toggle"><input type="checkbox" class="talent-hide-selected" /> Hide selected</label></div>
      </div>
      <div class="talent-selector-list">${buildList("", "", false)}</div>
    </div>`;

    const dlg = new Dialog({
      title: "Add Talent",
      content,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find(".talent-selector-list");
        const catFilter = html.find(".talent-cat-filter");
        const searchInput = html.find(".talent-search");
        const hideCheck = html.find(".talent-hide-selected");

        const refresh = () => {
          listEl.html(buildList(catFilter.val(), searchInput.val(), hideCheck.is(":checked")));
        };

        catFilter.on("change", refresh);
        searchInput.on("input", refresh);
        hideCheck.on("change", refresh);

        html.on("click", ".talent-selector-item:not(.talent-selector-selected)", async (ev) => {
          const talentId = ev.currentTarget.dataset.talentId;
          if (!talentId) return;
          const talents = foundry.utils.deepClone(this.actor.system.talents || []);
          talents.push(talentId);
          await this.actor.update({ "system.talents": talents });
          const t = allTalents.find(x => x.id === talentId);
          if (t) t.isSelected = true;
          refresh();
        });
      }
    }, { width: 550, height: 550, classes: ["dbu-old", "talent-selector-dialog"] });
    dlg.render(true);
  },

  async _onDeleteTalent(event) {
    event.preventDefault();
    const talentId = event.currentTarget.dataset.talentId;
    if (!talentId) return;
    const talents = foundry.utils.deepClone(this.actor.system.talents || []);
    const index = talents.indexOf(talentId);
    if (index > -1) {
      const talentName = (CONFIG.DBU?.talentsCatalog || []).find(t => t.id === talentId)?.name || talentId;
      if (!(await this._confirmDelete("Talent", talentName))) return;
      talents.splice(index, 1);
      await this.actor.update({ "system.talents": talents });
    }
  },

  _onTalentCategoryFilter(event) {
    this._talentCategoryFilter = event.currentTarget.value;
    this.render(false);
  },
};
