import { uniqueSkillPassives093 } from "../../rules/unique-abilities-v093.mjs";
import { stateLevel, ragingBotch } from "../../rules/states-v093.mjs";
import { martialAttributeBudget, martialAttributeWarnings, martialDie, martialLevel, martialProgressionRows, martialResourcePenalty, martialRowLevel, martialSkillSlots, progressionRowIsEarned, usesPathToPower, validMartialAttributes } from "../../rules/path-to-power-v093.mjs";
import { uses093 } from "../../rules/v093.mjs";
import { initialProgressionWarnings093, progression093 } from "../../rules/progression-v093.mjs";

/** Character sheet domain: progression-skills. Methods run with the sheet as this. */
export const progressionSkillsMethods = {

  // -------------------------------------------------------
  // Data Prep: Progression
  // -------------------------------------------------------

  _prepareProgressionData(context, system) {
    const fallbackRows = foundry.utils.deepClone(CONFIG.DBU?.progressionRows || []);
    const rows = martialProgressionRows(system, system.progressionRows?.length ? system.progressionRows : fallbackRows);
    const martial = usesPathToPower(system);
    const level = martialLevel(system);
    if (uses093(system) && !system.minion?.enabled) {
      const die = martialDie(system);
      const penalty = martialResourcePenalty(system);
      context.pathToPowerAvailable = true;
      context.pathToPowerEnabled = martial;
      context.martialLevel = level;
      context.martialLevels = [1, 2, 3, 4, 5].map(value => ({ value, selected: value === level }));
      context.martialDie = die ? `1d${die}` : "—";
      context.martialBaseLife = 60 - penalty;
      context.martialBaseKi = 50 - penalty;
    }
    const tpPerSIBuff = this.actor._getBuffTotal(system, "TP per Skill Improvement");
    const currentRules = uses093(system) && progression093(system, rows, tpPerSIBuff);
    const earnedRows = rows.filter(row => progressionRowIsEarned(system, row));
    if (currentRules) context.initialProgressionWarnings = [
      ...initialProgressionWarnings093(martial ? earnedRows : rows, martial),
      ...martialAttributeWarnings(system, rows)
    ];

    const racialSkillRanks = CONFIG.DBU?.racialSkillRanks || {};
    const availableSkills = CONFIG.DBU?.availableSkills || [];

    // Determine if this race has fixed racial attributes (auto-set, no UI row needed)
    const fixedRaces = CONFIG.DBU?.racesWithFixedAttributes || [];
    const isFixedRace = fixedRaces.includes(system.race || "");
    context.isFixedRace = isFixedRace;
    context.showRacialStatsRow = !isFixedRace;

    // Build talent option groups (sorted by category, then by name within each)
    const allTalents = CONFIG.DBU?.talentsCatalog || [];
    const talentsByCategory = {};
    for (const t of allTalents) {
      const cat = t.category || "Other";
      if (!talentsByCategory[cat]) talentsByCategory[cat] = [];
      talentsByCategory[cat].push(t);
    }
    context.talentOptionGroups = Object.entries(talentsByCategory)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, talents]) => ({
        category: cat,
        talents: talents.sort((a, b) => a.name.localeCompare(b.name)).map(t => ({ name: t.name }))
      }));
    context.availableSkills = availableSkills;

    // Enrich rows with conditional visibility flags + skill slots (matching MVP behavior)
    const enrichedRows = rows.map((row, idx) => {
      const perk = row.perkType || "";
      const showSkills = perk === "skill_improvement" || perk === "starting_stats" || perk === "martial_rank";
      const racialSkillCount = perk === "starting_stats" ? (racialSkillRanks[system.race] || 2) : 0;
      const maxSkillSlots = martial ? martialSkillSlots(row, racialSkillCount)
        : perk === "starting_stats" ? racialSkillCount : currentRules ? currentRules.skillRankSlots[idx] : 4;

      // Build skill slots array (6 columns, some active, some dim)
      const skillSlots = [0, 1, 2, 3, 4, 5].map(i => ({
        active: showSkills && i < maxSkillSlots,
        value: row[`skill${i}`] || "",
        fieldName: `system.progressionRows.${idx}.skill${i}`
      }));

      // Default TP for Skill Improvement rows per character-creation.txt:
      //   - Base 15 TP per Skill Improvement (line 56)
      //   - PL 1 bonus: +10 TP (line 70-71) → L1 SI defaults to 25
      // Stored value remains null until user edits — display falls back to default.
      const isSkillImprovement = perk === "skill_improvement";
      const isPL1SI = isSkillImprovement && (row.level || 0) === 1;
      const defaultTP = isPL1SI ? 25 : 15;
      const displayTP = (isSkillImprovement && (row.tp == null || row.tp === ""))
        ? defaultTP
        : row.tp;

      return {
        ...row,
        formIndex: idx,
        ...(martial ? {
          martialRowLevel: row.level === 1 ? martialRowLevel(row) : 0,
          martialEarned: progressionRowIsEarned(system, row),
          martialBudget: martialAttributeBudget(system, row),
          martialLockedPerk: !row.convertible && row.level === 1 && martialRowLevel(row) > 0,
          martialPerkLabel: perk === "martial_rank" ? "Skill Rank" : CONFIG.DBU?.perkTypes?.find(type => type.id === perk)?.name
        } : row.id < 0 ? { martialHidden: true } : {}),
        tp: currentRules ? currentRules.tpRows[idx].tp : displayTP,
        ...(currentRules ? { storedTP: currentRules.tpRows[idx].savedTP } : {}),
        showAttrs: perk === "attribute_addition" || perk === "starting_stats",
        showTalent: perk === "talent_addition" || perk === "character_perk",
        showTP: perk === "skill_improvement",
        showSkills,
        maxSkillSlots,
        racialSkillCount,
        skillSlots
      };
    });
    context.progressionRows = martial
      ? [...enrichedRows].sort((a, b) => a.level - b.level || a.martialRowLevel - b.martialRowLevel)
      : enrichedRows;

    let totalAttrPoints = 0;
    let totalSkillRanks = 0;
    let totalTP = 0;
    let skillImprovementCount = 0;

    for (const row of earnedRows) {
      if (validMartialAttributes(system, row)) {
        for (const key of ["ag", "fo", "te", "sc", "in", "ma", "pe"]) {
          if (row[key] != null) totalAttrPoints += Number(row[key]) || 0;
        }
      }
      // Skill Improvement defaults per character-creation.txt:
      //   PL 1 SI = 15 + 10 bonus = 25 TP, other SIs = 15 TP each
      if (row.perkType === "skill_improvement") {
        const defaultTP = (row.level || 0) === 1 ? 25 : 15;
        totalTP += (row.tp == null || row.tp === "") ? defaultTP : (Number(row.tp) || 0);
        skillImprovementCount++;
      } else if (row.tp != null) {
        totalTP += Number(row.tp) || 0;
      }
      const skillSlots = martial ? martialSkillSlots(row, racialSkillRanks[system.race] || 2) : 6;
      for (let i = 0; i < skillSlots; i++) {
        const val = row[`skill${i}`];
        if (val && String(val).trim()) totalSkillRanks++;
      }
    }

    // Gifted Student: +3 TP per Skill Improvement (retroactive); +6 if SC 8+.
    // Rapid Learner (Bio-Android Familiar): +3 TP per Skill Improvement.
    const gsTPPerSI = (system.aptitudes?.giftedStudentTPPerSI || 0)
      + (system.aptitudes?.rapidLearnerTPPerSI || 0);
    const giftedStudentTP = gsTPPerSI * skillImprovementCount;

    // Custom buff: +X TP per Skill Improvement (multiplied by SI count)
    const tpPerSIBuffTotal = tpPerSIBuff * skillImprovementCount;

    context.totalAttrPoints = totalAttrPoints;
    context.totalSkillRanks = totalSkillRanks;
    // L1 SI already includes the 25 TP (15 base + 10 PL1 bonus per character-creation.txt:71)
    // Downtime gains: Technique Training / Training Partner / Strenuous grant flat TP
    context.totalTP = currentRules ? currentRules.totalTP : totalTP + giftedStudentTP + tpPerSIBuffTotal + (system.downtime?.gains?.tp || 0);
    // Expose for testability and other consumers
    system.totalTP = context.totalTP;
    system.skillImprovementCount = currentRules ? currentRules.skillImprovementCount : skillImprovementCount;

    // Perk type options for select
    const perkTypes = CONFIG.DBU?.perkTypes || [];
    const perkTypeOptions = {};
    for (const pt of perkTypes) {
      perkTypeOptions[pt.id] = pt.name;
    }
    context.perkTypeOptions = perkTypeOptions;

    // Progression Preview: single summary row (totals across all rows up to current level)
    // Start with racial bonuses: for fixed races use config, for choice races the racial_stats row contributes
    const racialBonuses = CONFIG.DBU?.racialAttributeBonuses?.[system.race] || {};
    const summary = {
      level: system.level || 1,
      talents: [],
      ag: 1 + (isFixedRace ? (racialBonuses.ag ?? 0) : (system.attributes?.ag?.racial ?? 0)),
      fo: 1 + (isFixedRace ? (racialBonuses.fo ?? 0) : (system.attributes?.fo?.racial ?? 0)),
      te: 1 + (isFixedRace ? (racialBonuses.te ?? 0) : (system.attributes?.te?.racial ?? 0)),
      sc: 1 + (isFixedRace ? (racialBonuses.sc ?? 0) : (system.attributes?.sc?.racial ?? 0)),
      in: 1 + (isFixedRace ? (racialBonuses.in ?? 0) : (system.attributes?.in?.racial ?? 0)),
      ma: 1 + (isFixedRace ? (racialBonuses.ma ?? 0) : (system.attributes?.ma?.racial ?? 0)),
      pe: 1 + (isFixedRace ? (racialBonuses.pe ?? 0) : (system.attributes?.pe?.racial ?? 0)),
      tp: 25,
      skills: []
    };
    for (const row of martial ? earnedRows : rows.filter(row => !(row.id < 0))) {
      if (validMartialAttributes(system, row)) {
        for (const key of ["ag", "fo", "te", "sc", "in", "ma", "pe"]) {
          summary[key] += Number(row[key]) || 0;
        }
      }
      summary.tp += Number(row.tp) || 0;
      if (row.talent && String(row.talent).trim()) {
        summary.talents.push(row.talent);
      }
      const skillSlots = martial ? martialSkillSlots(row, racialSkillRanks[system.race] || 2) : 6;
      for (let i = 0; i < skillSlots; i++) {
        const val = row[`skill${i}`];
        if (val && String(val).trim()) summary.skills.push(val);
      }
    }
    // Player Minion Creation budgets (minions.txt "Minion PL"): PL1 grants
    // 1 Character Perk, 2 Attribute Additions, 2 Talent Additions and a Skill
    // Improvement; every PL after grants 1 Character Perk — at PLs that raise
    // the base ToP (5/10/15/…) it is instead a Perk + an Attribute Addition +
    // a Minion Trait. Racial Skill Ranks are halved (rounded up).
    if (system.minion?.enabled) {
      const lvl = system.level || 1;
      const tierFromLevel = (l) => l <= 4 ? 1 : l <= 9 ? 2 : l <= 14 ? 3 : l <= 19 ? 4 : l <= 24 ? 5 : l <= 29 ? 6 : 7;
      const bTUps = tierFromLevel(lvl) - 1;
      context.minionProgression = {
        perks: lvl,
        attrAdditions: 2 + bTUps,
        talentAdditions: 2,
        skillImprovements: 1,
        minionTraitsFromPL: bTUps
      };
    }

    context.progressionPreview = [{
      level: summary.level,
      talents: summary.talents.join(", ") || "-",
      ag: summary.ag,
      fo: summary.fo,
      te: summary.te,
      sc: summary.sc,
      in: summary.in,
      ma: summary.ma,
      pe: summary.pe,
      tp: currentRules ? currentRules.totalTP : summary.tp,
      skillRanks: summary.skills.join(", ") || "-",
      isCurrent: true
    }];
  },

  // -------------------------------------------------------
  // Data Prep: Techniques (TP System)
  // -------------------------------------------------------

  /**
   * Max TP spendable on any one Signature Technique or Aura, by BASE Tier of
   * Power (signature.txt:23-32 / auras.txt:21-29): 25 / 30 / 40 / 50 (ToP 4+).
   */
  _tpLimitByBaseTier(baseTier) {
    const bT = Math.max(1, Number(baseTier) || 1);
    return bT >= 4 ? 50 : [25, 30, 40][bT - 1];
  },

  _tierFromLevel(lvl) {
    if (lvl <= 4) return 1;
    if (lvl <= 9) return 2;
    if (lvl <= 14) return 3;
    if (lvl <= 19) return 4;
    if (lvl <= 24) return 5;
    if (lvl <= 29) return 6;
    return 7;
  },

  // -------------------------------------------------------
  // Skill Roll
  // -------------------------------------------------------

  /**
   * Full Skill Bonus breakdown (skills.txt:22-23 + system bonus sources):
   * Attribute (floor(Score/2)), Ranks (×2), Gifted Student, Equipment,
   * Traits (Alternate Sight / racial Perception / Cloaking System),
   * Buffs (per-skill + attribute-group custom buffs), and the Misc field.
   */
  _calcSkillBreakdown(skillKey, specialty = "") {
    const system = this.actor.system;
    const def = (CONFIG.DBU?.skillsData || []).find(s => s.id === skillKey) || {};
    const attrKey = def.attribute || "ag";
    // Encompassing Skills (skills.txt:52-56): each Specialty tracks its own ranks
    const specRow = specialty
      ? (system.skillSpecialties?.[skillKey] || []).find(s => s.name === specialty)
      : null;
    const rankNum = specialty
      ? (Number(specRow?.rank) || 0)
      : Number(system.skills?.[skillKey]?.rank ?? system.skills?.[skillKey] ?? 0) || 0;
    const attr = Math.floor((system.attributes?.[attrKey]?.score ?? 0) / 2);
    const ranks = rankNum * 2;
    const gs = system.aptitudes?.giftedStudentSkillBonus || 0;
    const equip = Number(system.equipmentFlags?.skillBonuses?.[skillKey]) || 0;
    const unique = uniqueSkillPassives093(this.actor, skillKey);
    const traits = (skillKey === "perception"
      ? (Number(system._bestialPerceptionBonus) || 0) + (Number(system.aptitudes?.perceptionBonus) || 0) : 0)
      + (skillKey === "stealth" ? (Number(system._cyberStealthBonus) || 0) : 0);
    const groupNameMap = {
      ag: "Agility Skills", fo: "Force Skills", sc: "Scholarship Skills",
      in: "Insight Skills", ma: "Magic Skills", pe: "Personality Skills"
    };
    const buffs = this.actor._getBuffTotal(system, def.name || "")
      + this.actor._getBuffTotal(system, groupNameMap[attrKey] || "")
      + (specialty ? this.actor._getBuffTotal(system, `${def.name}: ${specialty}`) : 0);
    const miscKey = specialty ? `${skillKey}:${specialty}` : skillKey;
    const misc = Number(system.skillMisc?.[miscKey]) || 0;
    // Knowledge passive: +1 to ALL Skill Checks per 2 ranks in each Knowledge
    // specialty (skills.txt:153) — computed in actor.mjs.
    const knowledge = Number(system.aptitudes?.knowledgeSkillBonus) || 0;
    // Aura effects: Distracting Aura −1/rank on all skills; Sensory Refinement
    // +1/rank on Insight-attribute skills (both computed in actor.mjs).
    const auraMod = -(Number(system.aptitudes?.auraSkillPenalty) || 0)
      + (attrKey === "in" ? (Number(system.aptitudes?.auraInSkillBonus) || 0) : 0);
    let total = attr + ranks + gs + equip + traits + buffs + misc + knowledge + auraMod + unique.bonus;
    const parts = [
      { label: "Attribute", value: attr },
      { label: "Ranks", value: ranks },
      { label: "Gifted Student", value: gs },
      { label: "Knowledge", value: knowledge },
      { label: "Aura", value: auraMod },
      { label: "Equipment", value: equip },
      { label: "Unique Abilities", value: unique.bonus },
      { label: "Traits", value: traits },
      { label: "Buffs", value: buffs },
      { label: "Misc", value: misc }
    ].filter(p => p.value !== 0 || p.label === "Attribute");
    let geniusApplied = "";
    // Genius Designer L2: use the chosen Craft Specialization's Skill Bonus for
    // any Craft Skill Check (talents-catalog: genius_designer).
    if (skillKey === "crafting" && (system.talents || []).includes("genius_designer")) {
      const chosen = system.talentSelections?.geniusDesignerSpecialty || "";
      if (chosen && chosen !== specialty) {
        const chosenRow = (system.skillSpecialties?.crafting || []).find(s => s.name === chosen);
        if (chosenRow) {
          const chosenRanks = (Number(chosenRow.rank) || 0) * 2;
          const chosenTotal = attr + chosenRanks + gs + equip + traits + buffs + knowledge + auraMod
            + (Number(system.skillMisc?.[`crafting:${chosen}`]) || 0);
          if (chosenTotal > total) {
            total = chosenTotal;
            geniusApplied = chosen;
            parts.push({ label: `Genius Designer (via ${chosen})`, value: chosenRanks - ranks });
          }
        }
      }
    }
    return { attrKey, rankNum, attr, ranks, gs, equip, traits, buffs, misc, total, parts, geniusApplied };
  },

  async _onRollSkill(event) {
    event.preventDefault();
    const skillKey = event.currentTarget.dataset.skill;
    if (!skillKey) return;
    const specialty = event.currentTarget.dataset.specialty || "";

    // Find skill data from context
    const skillDef = (CONFIG.DBU?.skillsData || []).find(s => s.id === skillKey);
    const skillName = (skillDef?.name || skillKey) + (specialty ? `: ${specialty}` : "");
    const bd = this._calcSkillBreakdown(skillKey, specialty);
    if (uses093(this.actor.system) && skillDef?.required093 && bd.rankNum < 1) {
      ui.notifications.warn(`${skillDef.name}: falha automática sem pelo menos 1 rank.`);
      return;
    }
    const attrKey = bd.attrKey;
    const unique = uniqueSkillPassives093(this.actor, skillKey);
    let bonus = bd.total;
    let breakdownParts = bd.parts;
    // Genius Designer L1: +1 Natural Result on all Craft Skill Checks
    const geniusNatBonus = (skillKey === "crafting" && (this.actor.system.talents || []).includes("genius_designer")) ? 1 : 0;

    // --- Absorption OSF: use best skill bonus among suppressed actors ---
    let viaName = "";
    const fusion = this.actor.system.fusion || {};
    if (fusion.isFusion && fusion.type === "one-sided-absorption") {
      const suppIds = fusion.suppressedCharacterIds || [];
      for (const suppId of suppIds) {
        const suppActor = game.actors?.get(suppId);
        if (!suppActor) continue;
        const sRank = suppActor.system.skills?.[skillKey]?.rank ?? suppActor.system.skills?.[skillKey] ?? 0;
        const sAttrData = suppActor.system.attributes?.[attrKey];
        const sAttrScore = sAttrData?.score ?? 0;
        // Suppressed actor's own equipment skill bonuses (Absorption pulls best total)
        const sEquipBonus = Number(suppActor.system.equipmentFlags?.skillBonuses?.[skillKey]) || 0;
        const sBonus = Math.floor(sAttrScore / 2) + (Number(sRank) || 0) * 2 + sEquipBonus + unique.bonus;
        if (sBonus > bonus) {
          bonus = sBonus;
          viaName = suppActor.name;
          breakdownParts = [{ label: `Best of ${suppActor.name}`, value: sBonus }];
        }
      }
    }

    if (unique.check) {
      bonus += unique.check;
      breakdownParts = [...breakdownParts, { label: "Unique Ability Checks", value: unique.check }];
    }

    // Roll Base Die (d10) + bonus
    const roll = new Roll(`1d10 + ${bonus}`);
    await roll.evaluate();

    // Skill Checks apply Criticals/Botches differently (skills.txt:29-32):
    // Botch = flat -2 penalty. Critical = 1d4 Extra Dice, scaled by Tier of
    // Power (table ruling: 1d4(T)). Natural-result bonuses (Genius Designer)
    // raise the effective natural (max 10); a raw 1 still Botches.
    const rawNat = roll.dice[0]?.results?.[0]?.result ?? "?";
    const nat = (rawNat !== "?" && geniusNatBonus) ? Math.min(10, rawNat + geniusNatBonus) : rawNat;
    const sysTier = this.actor.system.tier || 1;
    const mindful = uses093(this.actor.system) ? stateLevel(this.actor.system, "mindful") : 0;
    const criticalTarget = Math.max(7, 10 - mindful - unique.critical);
    const isCrit = nat >= criticalTarget;
    const isBotch = rawNat <= ragingBotch(this.actor.system);
    let critRoll = null;
    if (isCrit) { critRoll = new Roll(this._scaleDiceByTier("1d4", sysTier)); await critRoll.evaluate(); }
    const botchPenalty = 2;
    const finalTotal = roll.total + (critRoll?.total || 0) - (isBotch ? botchPenalty : 0);

    // Chat card mirroring the combat attack card structure/classes exactly
    const partsHtml = breakdownParts
      .map(p => `<span class="dbu-attack-buff">${p.label} ${p.value >= 0 ? "+" : ""}${p.value}</span>`)
      .join("");
    const buffsHtml = partsHtml
      ? `<div class="dbu-attack-buffs"><strong>Skill Bonus:</strong> ${partsHtml}</div>`
      : "";
    const resultTag = critRoll
      ? ` <span class="dbu-crit">CRIT! +${critRoll.formula}: ${critRoll.total}</span>`
      : (isBotch ? ` <span class="dbu-botch">BOTCH -${botchPenalty}</span>` : "");
    const metaChips = [
      `${attrKey.toUpperCase()} Skill`,
      `Rank ${bd.rankNum}`
    ].map(c => `<span class="dbu-meta-chip">${c}</span>`).join("");
    const content = `<div class="dbu-attack-roll" data-actor-id="${this.actor.id}">
      <h3 class="dbu-attack-title"><span class="dbu-card-title-text">${this.actor.name} — ${skillName}${viaName ? ` (via ${viaName})` : ""}</span></h3>
      <div class="dbu-card-body">
        <div class="dbu-attack-meta">${metaChips}</div>
        ${buffsHtml}
        <div class="dbu-roll-row">
          <span class="dbu-roll-label">Check</span>
          <span class="dbu-roll-main">
            <code class="dbu-roll-formula">1d10+${bonus}</code>
            <span class="dbu-roll-sub">Nat ${nat !== rawNat ? `${rawNat}→${nat} (Genius Designer)` : nat}${unique.critical ? ` · CT ${criticalTarget}+` : ""}</span>${resultTag}
          </span>
          <span class="dbu-roll-total">${finalTotal}</span>
        </div>
        <div class="dbu-skill-dcs">Novice 6 · Apprentice 10 · Qualified 14 · Expert 18 · Master 22 · Grandmaster 26</div>
      </div>
    </div>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
    if (game.dice3d) {
      try {
        await game.dice3d.showForRoll(roll, game.user, true);
        if (critRoll) await game.dice3d.showForRoll(critRoll, game.user, true);
      } catch (e) { /* best-effort */ }
    }
  },

  // -------------------------------------------------------
  // Progression CRUD
  // -------------------------------------------------------

  async _onAddProgressionRow(event) {
    event.preventDefault();
    const baseRows = (this.actor.system.progressionRows && this.actor.system.progressionRows.length > 0)
      ? this.actor.system.progressionRows
      : (CONFIG.DBU?.progressionRows || []);
    const rows = foundry.utils.deepClone(martialProgressionRows(this.actor.system, baseRows));
    const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id || 0)) + 1 : 1;
    const lastLevel = rows.length > 0 ? rows[rows.length - 1].level || 1 : 1;
    rows.push({
      id: nextId, level: lastLevel, perkType: "attribute_addition", convertible: false,
      talent: "", ag: null, fo: null, te: null, sc: null, in: null, ma: null, pe: null,
      tp: null,
      skill0: "", skill1: "", skill2: "", skill3: "", skill4: "", skill5: "",
      skills: []
    });
    rows.sort((a, b) => (a.level || 1) - (b.level || 1) || (a.id || 0) - (b.id || 0));
    await this.actor.update({ "system.progressionRows": rows });
  },

  async _onDeleteProgressionRow(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const baseRows = (this.actor.system.progressionRows && this.actor.system.progressionRows.length > 0)
      ? this.actor.system.progressionRows
      : (CONFIG.DBU?.progressionRows || []);
    const rows = foundry.utils.deepClone(martialProgressionRows(this.actor.system, baseRows));
    if (index >= 0 && index < rows.length) {
      if (usesPathToPower(this.actor.system) && rows[index].level === 1 && martialRowLevel(rows[index])) return;
      if (!(await this._confirmDelete("Progression Row", `Level ${rows[index].level ?? "?"} row`))) return;
      rows.splice(index, 1);
      await this.actor.update({ "system.progressionRows": rows });
    }
  },
};
