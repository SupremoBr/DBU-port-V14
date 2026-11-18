import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: downtime. Methods run with the sheet as this. */
export function createDowntimeMethods(DBUCharacterSheet) {
  return {

  // -------------------------------------------------------
  // Data Prep: Downtime
  // -------------------------------------------------------

  _prepareDowntimeData(context, system) {
    const dt = system.downtime || {};
    const period = dt.currentPeriod || {};
    const lifetime = dt.lifetimeUses || {};
    const history = dt.history || [];

    context.dtPeriodActive = period.active || false;
    context.dtTotalDT = period.totalDT || 0;
    context.dtSpentDT = period.spentDT || 0;
    context.dtRemainingDT = (period.totalDT || 0) - (period.spentDT || 0);

    const activitiesUsed = period.activitiesUsed || [];
    const modifiersUsed = period.modifiersUsed || [];

    // Has Mentor modifier? Allows using same activity more than once
    const hasMentor = modifiersUsed.includes("mentor");
    // Has Deep Focus? Allows using recreational twice
    const hasDeepFocus = modifiersUsed.includes("deepFocus");

    // Check if a training-type activity was used this period
    const trainingActivitiesUsed = activitiesUsed.filter(a =>
      ["basicTraining", "techniqueTraining", "reinforcingForm", "unlockingForm",
       "transformationTraining", "heartbeatTraining"].includes(a)
    );
    const recreationalActivitiesUsed = activitiesUsed.filter(a =>
      ["resting", "studying", "baseBuilding"].includes(a)
    );

    const hasTrainingActivity = trainingActivitiesUsed.length > 0;
    const hasRecreationalActivity = recreationalActivitiesUsed.length > 0;

    // Activity definitions
    const allActivities = [
      { id: "basicTraining", name: "Basic Training", cost: 1, type: "Training", limit: 4, lifetimeKey: "basicTraining",
        effect: "Gain 2 Attribute Points to spend on any Attribute except SC or PE." },
      { id: "techniqueTraining", name: "Technique Training", cost: 1, type: "Training", limit: 4, lifetimeKey: "techniqueTraining",
        effect: "Gain 15 Technique Points to spend immediately." },
      { id: "reinforcingForm", name: "Reinforcing Form", cost: 2, type: "Training", limit: "N/A", lifetimeKey: null,
        effect: "Gain Mastery over an Alternate/Legendary Form or apply Power Improvement to an Enhancement Power." },
      { id: "unlockingForm", name: "Unlocking Form", cost: 2, type: "Training", limit: "N/A", lifetimeKey: null,
        effect: "Gain access to a Transformation you meet the Prerequisites, Tier, and Racial Requirement of." },
      { id: "transformationTraining", name: "Transformation Training", cost: 2, type: "Training", limit: 2, lifetimeKey: "transformationTraining",
        effect: "Increase your Stress Bonus by 1." },
      { id: "heartbeatTraining", name: "Heartbeat Training", cost: 1, type: "Training", limit: 1, lifetimeKey: "heartbeatTraining",
        effect: "Select a Transformation you possess that lacks Dedicated and Heartbeat Aspects. It gains Heartbeat." },
      { id: "resting", name: "Resting", cost: 1, type: "Recreational", limit: 4, lifetimeKey: "resting",
        effect: "Gain 1 Karma Point, 1 Skill Rank (PE Skill), and +2 Personality Score." },
      { id: "studying", name: "Studying", cost: 1, type: "Recreational", limit: 4, lifetimeKey: "studying",
        effect: "Gain 1 Skill Rank in any 2 Skills and +2 Scholarship Score." },
      { id: "baseBuilding", name: "Base Building", cost: 2, type: "Recreational", limit: 4, lifetimeKey: "baseBuilding",
        effect: "Gain and spend 2 Dev Points. +1 Personality Score, +1 Scholarship Score." }
    ];

    // Build activity display data
    for (const act of allActivities) {
      act.lifetimeUsed = act.lifetimeKey ? (lifetime[act.lifetimeKey] || 0) : 0;
      const usedCount = activitiesUsed.filter(a => a === act.id).length;
      act.usedThisPeriod = usedCount > 0;

      // Determine disabled state
      act.disabled = false;
      act.disabledReason = "";

      // Deep Focus lets ONE Recreational activity be used twice; Mentor lifts the once-per-period cap
      const someRecDoubled = ["resting", "studying", "baseBuilding"].some(id =>
        id !== act.id && activitiesUsed.filter(a => a === id).length >= 2);
      const reuseAllowed = hasMentor
        || (hasDeepFocus && act.type === "Recreational" && usedCount < 2 && !someRecDoubled);

      if (!context.dtPeriodActive) {
        act.disabled = true;
        act.disabledReason = "No active downtime period";
      } else if (context.dtRemainingDT < act.cost) {
        act.disabled = true;
        act.disabledReason = "Not enough DT remaining";
      } else if (act.limit !== "N/A" && act.lifetimeUsed >= act.limit) {
        act.disabled = true;
        act.disabledReason = `Lifetime limit reached (${act.limit})`;
      } else if (act.usedThisPeriod && !reuseAllowed) {
        act.disabled = true;
        act.disabledReason = "Already used this period (each activity once per period)";
      }
    }

    context.dtTrainingActivities = allActivities.filter(a => a.type === "Training");
    context.dtRecreationalActivities = allActivities.filter(a => a.type === "Recreational");

    // Modifier definitions
    const maxModifiers = 2;
    const modifierCount = modifiersUsed.length;

    const allModifiers = [
      { id: "trainingPartner", name: "Training Partner", type: "Training",
        effect: "Choose: +1 AP (not SC/PE) & +1 Score Limit, OR +10 TP & +5 Sig Tech limit, OR +1 Natural Result on a Stress Test." },
      { id: "mentor", name: "Mentor", type: "Training",
        effect: "+1 additional DT this period. May use a Downtime Activity more than once." },
      { id: "strenuous", name: "Strenuous", type: "Training",
        effect: "Grueling: -1/4 Max LP (2 fights), +1 AP, +10 TP. Life Threatening: -1/2 Max LP, +1 AP, +10 TP, +1 DT." },
      { id: "deepFocus", name: "Deep Focus", type: "Recreational",
        effect: "+1 Karma Point. May use a Recreational Activity twice this period." },
      { id: "crafting", name: "Crafting", type: "Recreational",
        effect: "For every Craft Skill Rank, gain 2 Equipment Points to spend immediately." }
    ];

    for (const mod of allModifiers) {
      mod.active = modifiersUsed.includes(mod.id);

      mod.disabled = false;
      if (!context.dtPeriodActive) {
        mod.disabled = true;
      } else if (!mod.active && modifierCount >= maxModifiers) {
        mod.disabled = true;
      } else if (mod.type === "Training" && !hasTrainingActivity && !mod.active) {
        // Training modifiers need a training activity to be used this period
        // But don't disable if already active (allow toggling off)
        mod.disabled = false; // Allow selecting even before activity — ARC may set up modifiers first
      }
    }

    context.dtModifiers = allModifiers;

    // History display
    const displayHistory = history.map((h, i) => ({
      periodNum: history.length - i,
      totalDT: h.totalDT || 0,
      activities: (h.activities || []).map(aId => {
        const found = allActivities.find(a => a.id === aId);
        return found ? found.name : aId;
      }),
      modifiers: (h.modifiers || []).map(mId => {
        const found = allModifiers.find(m => m.id === mId);
        return found ? found.name : mId;
      }),
      notes: h.notes || ""
    }));

    context.dtHistory = displayHistory;
    context.dtHasHistory = displayHistory.length > 0;

    // Lifetime gains summary (what downtime has permanently granted)
    const gains = dt.gains || {};
    const attrLabels = { ag: "AG", fo: "FO", te: "TE", sc: "SC", in: "IN", ma: "MA", pe: "PE" };
    const gainParts = [];
    for (const [k, label] of Object.entries(attrLabels)) {
      const v = gains.attributes?.[k] || 0;
      if (v > 0) gainParts.push(`+${v} ${label}`);
    }
    if (gains.tp > 0) gainParts.push(`+${gains.tp} TP`);
    if (gains.stressBonus > 0) gainParts.push(`+${gains.stressBonus} Stress Bonus`);
    if (gains.devPoints > 0) gainParts.push(`+${gains.devPoints} Dev Points`);
    if (gains.equipmentPoints > 0) gainParts.push(`+${gains.equipmentPoints} Equipment Points`);
    const skillNamesById = {};
    for (const sd of (CONFIG.DBU?.skillsData || [])) skillNamesById[sd.id] = sd.name;
    for (const [sid, n] of Object.entries(gains.skillRanks || {})) {
      if (n > 0) gainParts.push(`+${n} ${skillNamesById[sid] || sid} Rank${n > 1 ? "s" : ""}`);
    }
    context.dtGainsSummary = gainParts;
    context.dtHasGains = gainParts.length > 0;
    context.dtStrenuousActive = (dt.strenuous?.encountersLeft || 0) > 0;
    context.dtStrenuousLabel = dt.strenuous?.fraction === 0.5 ? "-1/2 Max LP" : "-1/4 Max LP";
    context.dtStrenuousLeft = dt.strenuous?.encountersLeft || 0;
  },

  // -------------------------------------------------------
  // Downtime
  // -------------------------------------------------------

  async _onDtStartPeriod(event) {
    event.preventDefault();
    const html = $(event.currentTarget).closest(".downtime-container");
    const amount = parseInt(html.find(".dt-start-amount").val()) || 2;
    await this.actor.update({
      "system.downtime.currentPeriod.active": true,
      "system.downtime.currentPeriod.totalDT": amount,
      "system.downtime.currentPeriod.spentDT": 0,
      "system.downtime.currentPeriod.activitiesUsed": [],
      "system.downtime.currentPeriod.modifiersUsed": [],
      "system.downtime.currentPeriod.notes": ""
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>Downtime Period Started</b> — ${amount} DT available.`
    });
  },

  async _onDtEndPeriod(event) {
    event.preventDefault();
    const dt = this.actor.system.downtime || {};
    const period = dt.currentPeriod || {};
    const history = foundry.utils.deepClone(dt.history || []);

    // Save to history
    history.unshift({
      totalDT: period.totalDT || 0,
      activities: [...(period.activitiesUsed || [])],
      modifiers: [...(period.modifiersUsed || [])],
      notes: period.notes || ""
    });

    const updates = {
      "system.downtime.currentPeriod.active": false,
      "system.downtime.currentPeriod.totalDT": 0,
      "system.downtime.currentPeriod.spentDT": 0,
      "system.downtime.currentPeriod.activitiesUsed": [],
      "system.downtime.currentPeriod.modifiersUsed": [],
      "system.downtime.currentPeriod.notes": "",
      "system.downtime.currentPeriod.appliedRecords": [],
      "system.downtime.history": history
    };

    // Strenuous: LP penalty starts now, for the next 2 combat encounters.
    // Resting this period reduces the penalty by 1/4 (0.25 → none, 0.5 → 0.25).
    const strenuousRec = (period.appliedRecords || []).find(r => r.sourceId === "mod:strenuous");
    let strenuousLine = "";
    if (strenuousRec) {
      let fraction = strenuousRec.strenuous === "lifeThreatening" ? 0.5 : 0.25;
      if ((period.activitiesUsed || []).includes("resting")) fraction -= 0.25;
      if (fraction > 0) {
        updates["system.downtime.strenuous.fraction"] = fraction;
        updates["system.downtime.strenuous.encountersLeft"] = 2;
        strenuousLine = `<br><em>Strenuous: -${fraction === 0.5 ? "1/2" : "1/4"} Max LP for the next 2 Combat Encounters.</em>`;
      } else {
        strenuousLine = "<br><em>Strenuous LP penalty negated by Resting.</em>";
      }
    }

    await this.actor.update(updates);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>Downtime Period Ended</b> — ${period.spentDT || 0}/${period.totalDT || 0} DT spent.${strenuousLine}`
    });
  },

  async _onDtCancelPeriod(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title: "Cancel Downtime Period",
      content: "<p>Cancel the current period? All gains applied this period (scores, TP, skills, karma, transformations…) and lifetime counters will be reverted.</p>",
      defaultYes: false
    });
    if (!confirmed) return;

    // Revert lifetime uses for activities used this period
    const dt = this.actor.system.downtime || {};
    const period = dt.currentPeriod || {};
    const lifetime = foundry.utils.deepClone(dt.lifetimeUses || {});
    const activitiesUsed = period.activitiesUsed || [];

    const activityMap = {
      basicTraining: "basicTraining", techniqueTraining: "techniqueTraining",
      transformationTraining: "transformationTraining", heartbeatTraining: "heartbeatTraining",
      resting: "resting", studying: "studying", baseBuilding: "baseBuilding"
    };
    for (const actId of activitiesUsed) {
      const key = activityMap[actId];
      if (key && lifetime[key] > 0) lifetime[key]--;
    }

    // Reverse EVERY applied record (activities + modifiers) from this period
    const updates = {
      "system.downtime.currentPeriod.active": false,
      "system.downtime.currentPeriod.totalDT": 0,
      "system.downtime.currentPeriod.spentDT": 0,
      "system.downtime.currentPeriod.activitiesUsed": [],
      "system.downtime.currentPeriod.modifiersUsed": [],
      "system.downtime.currentPeriod.notes": "",
      "system.downtime.currentPeriod.appliedRecords": [],
      "system.downtime.lifetimeUses": lifetime
    };
    const records = period.appliedRecords || [];
    let transClone = null;
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i];
      this._dtBuildGainsUpdates(record.gains, -1, updates);
      if (record.trans) {
        if (!transClone) transClone = foundry.utils.deepClone(this.actor.system.transformations || []);
        this._dtReverseTransChanges(record, transClone);
      }
    }
    if (transClone) updates["system.transformations"] = transClone;

    await this.actor.update(updates);
  },

  /** Dialog: allocate N attribute points among a set of attributes. Returns {attrKey: n} or null. */
  async _dtPromptAttributes(title, points, allowed = ["ag", "fo", "te", "in", "ma"]) {
    const labels = { ag: "Agility", fo: "Force", te: "Tenacity", sc: "Scholarship", in: "Insight", ma: "Magic", pe: "Personality" };
    const opts = allowed.map(k => `<option value="${k}">${labels[k]} (${k.toUpperCase()})</option>`).join("");
    const selects = Array.from({ length: points }, (_, i) =>
      `<div class="form-group"><label>Point ${i + 1}</label><select name="attr${i}">${opts}</select></div>`).join("");
    const result = await Dialog.prompt({
      title,
      content: `<form>${selects}<p class="notes">Score Limit still applies (8 + 3 per Tier past the first).</p></form>`,
      callback: html => Array.from({ length: points }, (_, i) => html.find(`[name='attr${i}']`).val()),
      rejectClose: false
    });
    if (!result || result.some(v => !v)) return null;
    const alloc = {};
    for (const k of result) alloc[k] = (alloc[k] || 0) + 1;
    return alloc;
  },

  /** Dialog: pick N distinct-or-not skills. Returns array of skill ids or null. */
  async _dtPromptSkills(title, count, attrFilter = null) {
    const skills = (CONFIG.DBU?.skillsData || []).filter(s => !attrFilter || s.attribute === attrFilter);
    const opts = skills.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    const selects = Array.from({ length: count }, (_, i) =>
      `<div class="form-group"><label>Skill Rank ${i + 1}</label><select name="skill${i}">${opts}</select></div>`).join("");
    const result = await Dialog.prompt({
      title,
      content: `<form>${selects}</form>`,
      callback: html => Array.from({ length: count }, (_, i) => html.find(`[name='skill${i}']`).val()),
      rejectClose: false
    });
    if (!result || result.some(v => !v)) return null;
    return result;
  },

  /** Dialog: pick one option from [value, label] pairs. Returns value or null. */
  async _dtPromptSelect(title, prompt, pairs) {
    const opts = pairs.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    const result = await Dialog.prompt({
      title,
      content: `<form><div class="form-group"><label>${prompt}</label><select name="pick">${opts}</select></div></form>`,
      callback: html => html.find("[name='pick']").val(),
      rejectClose: false
    });
    return result ?? null;
  },

  /** Fold a gains-delta into update entries (sign +1 applies, -1 reverses). */
  _dtBuildGainsUpdates(gains, sign, updates) {
    if (!gains) return;
    const cur = this.actor.system.downtime?.gains || {};
    for (const [k, v] of Object.entries(gains.attributes || {})) {
      if (!v) continue;
      const base = updates[`system.downtime.gains.attributes.${k}`] ?? (cur.attributes?.[k] || 0);
      updates[`system.downtime.gains.attributes.${k}`] = Math.max(0, base + sign * v);
    }
    for (const k of ["tp", "stressBonus", "devPoints", "equipmentPoints"]) {
      if (!gains[k]) continue;
      const base = updates[`system.downtime.gains.${k}`] ?? (cur[k] || 0);
      updates[`system.downtime.gains.${k}`] = Math.max(0, base + sign * gains[k]);
    }
    if (gains.skillRanks && Object.keys(gains.skillRanks).length) {
      const sr = updates["system.downtime.gains.skillRanks"] || foundry.utils.deepClone(cur.skillRanks || {});
      for (const [sid, n] of Object.entries(gains.skillRanks)) {
        sr[sid] = Math.max(0, (sr[sid] || 0) + sign * n);
      }
      updates["system.downtime.gains.skillRanks"] = sr;
    }
    if (gains.karma) {
      const base = updates["system.zsoul.karma"] ?? (this.actor.system.zsoul?.karma || 0);
      updates["system.zsoul.karma"] = Math.max(0, base + sign * gains.karma);
    }
  },

  /** Reverse a record's transformation changes on a working clone. */
  _dtReverseTransChanges(record, transClone) {
    const tr = record.trans;
    if (!tr) return;
    const byId = (id) => transClone.find(t => t.id === id);
    if (tr.masteredId != null) {
      const t = byId(tr.masteredId);
      if (t) t.mastered = false;
    }
    if (tr.piId != null) {
      const t = byId(tr.piId);
      if (t) {
        // Undo Control side-effects if we applied them
        if (t.powerImprovement === "control" && tr.piValue === "control") {
          t.aspects = (t.aspects || []).filter(a => a !== "Strainless" || !tr.piAddedStrainless);
          if (tr.piStressReduced) t.stressTest = (t.stressTest || 0) + 2;
        }
        t.powerImprovement = tr.piPrev || "none";
      }
    }
    if (tr.heartbeatId != null) {
      const t = byId(tr.heartbeatId);
      if (t) t.aspects = (t.aspects || []).filter(a => a !== "Heartbeat");
    }
    if (tr.addedId != null) {
      const idx = transClone.findIndex(t => t.id === tr.addedId);
      if (idx >= 0) transClone.splice(idx, 1);
    }
  },

  async _onDtUseActivity(event) {
    event.preventDefault();
    const actId = event.currentTarget.dataset.activityId;
    if (!actId) return;

    const system = this.actor.system;
    const dt = system.downtime || {};
    const period = dt.currentPeriod || {};
    const activitiesUsed = [...(period.activitiesUsed || [])];
    const modifiersUsed = period.modifiersUsed || [];

    const cost = DBUCharacterSheet.DT_COSTS[actId] || 1;
    const name = DBUCharacterSheet.DT_NAMES[actId] || actId;
    const remaining = (period.totalDT || 0) - (period.spentDT || 0);
    if (!period.active) { ui.notifications.warn("No active downtime period."); return; }
    if (remaining < cost) { ui.notifications.warn("Not enough DT remaining."); return; }

    // Once per period (Mentor lifts it; Deep Focus allows ONE Recreational twice)
    const usedCount = activitiesUsed.filter(a => a === actId).length;
    const isRecreational = ["resting", "studying", "baseBuilding"].includes(actId);
    const someRecDoubled = ["resting", "studying", "baseBuilding"].some(id =>
      id !== actId && activitiesUsed.filter(a => a === id).length >= 2);
    const reuseAllowed = modifiersUsed.includes("mentor")
      || (modifiersUsed.includes("deepFocus") && isRecreational && usedCount < 2 && !someRecDoubled);
    if (usedCount >= 1 && !reuseAllowed) {
      ui.notifications.warn("Each Downtime Activity can only be used once per period.");
      return;
    }
    // Lifetime limit
    const limit = DBUCharacterSheet.DT_LIMITS[actId];
    if (limit && (dt.lifetimeUses?.[actId] || 0) >= limit) {
      ui.notifications.warn(`Lifetime limit reached for ${name} (${limit}).`);
      return;
    }

    // Build the applied record; any cancelled dialog aborts with no changes
    const record = { sourceId: actId, gains: {}, trans: null };
    const lines = [];
    const updates = {};
    const transformations = system.transformations || [];

    switch (actId) {
      case "basicTraining": {
        const alloc = await this._dtPromptAttributes("Basic Training — 2 Attribute Points (not SC/PE)", 2);
        if (!alloc) return;
        record.gains.attributes = alloc;
        lines.push(Object.entries(alloc).map(([k, n]) => `+${n} ${k.toUpperCase()} Score`).join(", "));
        break;
      }
      case "techniqueTraining": {
        record.gains.tp = 15;
        lines.push("+15 Technique Points");
        break;
      }
      case "reinforcingForm": {
        const options = [];
        transformations.forEach((t, i) => {
          const type = t.transformationType || "";
          const isForm = type === "form_alternate" || type === "form_legendary" || t.isLegendary;
          const isEP = type.startsWith("enhancement");
          if (isForm && !t.mastered) options.push([`m:${i}`, `${t.name || "(unnamed)"} — gain Mastery`]);
          if (isEP && (t.powerImprovement || "none") === "none") options.push([`p:${i}`, `${t.name || "(unnamed)"} — Power Improvement`]);
        });
        if (!options.length) {
          ui.notifications.warn("No eligible unmastered Alternate/Legendary Form or Enhancement Power without Power Improvement.");
          return;
        }
        const pick = await this._dtPromptSelect("Reinforcing Form", "Select what to reinforce:", options);
        if (pick === null) return;
        const [kind, idxStr] = pick.split(":");
        const idx = Number(idxStr);
        const transClone = foundry.utils.deepClone(transformations);
        if (kind === "m") {
          transClone[idx].mastered = true;
          record.trans = { masteredId: transClone[idx].id };
          lines.push(`Mastery gained: ${transClone[idx].name || "Form"}`);
        } else {
          const piPick = await this._dtPromptSelect("Power Improvement", `Improvement for ${transClone[idx].name}:`,
            [["control", "Control (Strainless, Stress -2)"], ["surpass", "Surpass (Mastered, Unlimited State Access)"]]);
          if (piPick === null) return;
          const t = transClone[idx];
          record.trans = { piId: t.id, piPrev: t.powerImprovement || "none", piValue: piPick };
          t.powerImprovement = piPick;
          if (piPick === "control") {
            if (!t.aspects) t.aspects = [];
            if (!t.aspects.includes("Strainless")) { t.aspects.push("Strainless"); record.trans.piAddedStrainless = true; }
            if ((t.stressTest || 0) > 0) { t.stressTest = Math.max(0, t.stressTest - 2); record.trans.piStressReduced = true; }
          }
          lines.push(`Power Improvement (${piPick}): ${t.name || "Enhancement"}`);
        }
        updates["system.transformations"] = transClone;
        break;
      }
      case "unlockingForm": {
        const catalog = CONFIG.DBU?.transformationsCatalog || {};
        const tier = system.tier || 1;
        const owned = new Set(transformations.map(t => t.catalogKey).filter(Boolean));
        const options = [];
        for (const [key, entry] of Object.entries(catalog)) {
          if (owned.has(key)) continue;
          const reqTier = parseInt(String(entry.tierRequirement || "1")) || 1;
          // Metamorphosis stages: printed ACCESS requirement is 1+ (the S+1
          // values in tierRequirement are Weakest State's "for all effects").
          const isMetaStage = ["full_suppression", "limited_suppression", "partial_suppression", "true_form"].includes(key);
          if (reqTier > tier && !isMetaStage) continue;
          if (!this._meetsRacialRequirement(system.race, entry.racialRequirement)) continue;
          options.push([key, `${entry.name} (${entry.category || ""}, ToP ${entry.tierRequirement || "1+"})`]);
        }
        if (!options.length) { ui.notifications.warn("No eligible catalog transformations found."); return; }
        options.sort((a, b) => a[1].localeCompare(b[1]));
        const pick = await this._dtPromptSelect("Unlocking Form", "Transformation to unlock (ARC approval — prerequisites not auto-checked):", options);
        if (pick === null) return;
        const entry = catalog[pick];
        const typeMap = {
          manifested_power: "manifested_power", enhancement_power: "enhancement_standard",
          form_alternate: "form_alternate", form_legendary: "form_legendary"
        };
        const transClone = foundry.utils.deepClone(transformations);
        const nextId = transClone.length > 0 ? Math.max(...transClone.map(t => t.id || 0)) + 1 : 1;
        transClone.push({
          id: nextId, catalogKey: entry.id, name: entry.name, active: false,
          gradeOrStacks: "", tierRequirement: entry.tierRequirement || "", mastered: false,
          stressTest: entry.stressTest || 0,
          transformationType: typeMap[entry.category] || "form_alternate",
          attrBonuses: foundry.utils.deepClone(entry.attrBonuses || {}),
          aspects: [...(entry.aspects || [])],
          structuredTraits: [], traits: "", isLegendary: entry.category === "form_legendary"
        });
        record.trans = { addedId: nextId };
        lines.push(`Transformation unlocked: ${entry.name}`);
        updates["system.transformations"] = transClone;
        break;
      }
      case "transformationTraining": {
        record.gains.stressBonus = 1;
        lines.push("+1 Stress Bonus (permanent)");
        break;
      }
      case "heartbeatTraining": {
        const options = [];
        transformations.forEach((t, i) => {
          const aspects = (t.aspects || []).map(a => String(a).toLowerCase());
          const hasBlocked = aspects.some(a => a.startsWith("dedicated") || a.startsWith("heartbeat"));
          if (!hasBlocked) options.push([String(i), t.name || "(unnamed)"]);
        });
        if (!options.length) { ui.notifications.warn("No transformation without Dedicated/Heartbeat found."); return; }
        const pick = await this._dtPromptSelect("Heartbeat Training", "Transformation that gains Heartbeat:", options);
        if (pick === null) return;
        const transClone = foundry.utils.deepClone(transformations);
        const t = transClone[Number(pick)];
        if (!t.aspects) t.aspects = [];
        t.aspects.push("Heartbeat");
        record.trans = { heartbeatId: t.id };
        lines.push(`Heartbeat Aspect gained: ${t.name || "Transformation"}`);
        updates["system.transformations"] = transClone;
        break;
      }
      case "resting": {
        const skills = await this._dtPromptSkills("Resting — 1 Skill Rank (Personality Skill)", 1, "pe");
        if (!skills) return;
        record.gains.karma = 1;
        record.gains.attributes = { pe: 2 };
        record.gains.skillRanks = { [skills[0]]: 1 };
        const sName = (CONFIG.DBU?.skillsData || []).find(s => s.id === skills[0])?.name || skills[0];
        lines.push(`+1 Karma Point, +1 ${sName} Rank, +2 PE Score`);
        break;
      }
      case "studying": {
        const skills = await this._dtPromptSkills("Studying — 2 Skill Ranks (any Skills)", 2);
        if (!skills) return;
        const sr = {};
        for (const sid of skills) sr[sid] = (sr[sid] || 0) + 1;
        record.gains.attributes = { sc: 2 };
        record.gains.skillRanks = sr;
        const names = skills.map(sid => (CONFIG.DBU?.skillsData || []).find(s => s.id === sid)?.name || sid);
        lines.push(`+1 Rank: ${names.join(", ")}; +2 SC Score`);
        break;
      }
      case "baseBuilding": {
        record.gains.devPoints = 2;
        record.gains.attributes = { pe: 1, sc: 1 };
        lines.push("+2 Dev Points (spend immediately), +1 PE Score, +1 SC Score");
        break;
      }
      default:
        return;
    }

    // Apply gains + bookkeeping in a single update
    this._dtBuildGainsUpdates(record.gains, 1, updates);
    record.lines = lines;
    activitiesUsed.push(actId);
    updates["system.downtime.currentPeriod.activitiesUsed"] = activitiesUsed;
    updates["system.downtime.currentPeriod.spentDT"] = (period.spentDT || 0) + cost;
    updates["system.downtime.currentPeriod.appliedRecords"] = [...(period.appliedRecords || []), record];
    if (limit) {
      updates[`system.downtime.lifetimeUses.${actId}`] = (dt.lifetimeUses?.[actId] || 0) + 1;
    }
    await this.actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>Downtime:</b> ${name} (${cost} DT)`
        + `<div class="dbu-auto-applied">${lines.map(l => `<div>${l}</div>`).join("")}</div>`
    });
  },

  async _onDtUndoActivity(event) {
    event.preventDefault();
    const actId = event.currentTarget.dataset.activityId;
    if (!actId) return;

    const dt = this.actor.system.downtime || {};
    const period = dt.currentPeriod || {};
    const activitiesUsed = [...(period.activitiesUsed || [])];
    const records = foundry.utils.deepClone(period.appliedRecords || []);

    const idx = activitiesUsed.lastIndexOf(actId);
    if (idx === -1) return;
    activitiesUsed.splice(idx, 1);

    const cost = DBUCharacterSheet.DT_COSTS[actId] || 1;
    const updates = {
      "system.downtime.currentPeriod.activitiesUsed": activitiesUsed,
      "system.downtime.currentPeriod.spentDT": Math.max(0, (period.spentDT || 0) - cost)
    };

    // Reverse the applied record (latest one for this activity)
    let recIdx = -1;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].sourceId === actId) { recIdx = i; break; }
    }
    if (recIdx >= 0) {
      const record = records.splice(recIdx, 1)[0];
      this._dtBuildGainsUpdates(record.gains, -1, updates);
      if (record.trans) {
        const transClone = foundry.utils.deepClone(this.actor.system.transformations || []);
        this._dtReverseTransChanges(record, transClone);
        updates["system.transformations"] = transClone;
      }
    }
    updates["system.downtime.currentPeriod.appliedRecords"] = records;

    // Decrement lifetime counter
    if (DBUCharacterSheet.DT_LIMITS[actId] && (dt.lifetimeUses?.[actId] || 0) > 0) {
      updates[`system.downtime.lifetimeUses.${actId}`] = dt.lifetimeUses[actId] - 1;
    }

    await this.actor.update(updates);
  },

  async _onDtToggleModifier(event) {
    const modId = event.currentTarget.dataset.modifierId;
    if (!modId) return;

    const system = this.actor.system;
    const dt = system.downtime || {};
    const period = dt.currentPeriod || {};
    const modifiersUsed = [...(period.modifiersUsed || [])];
    const records = foundry.utils.deepClone(period.appliedRecords || []);
    const checked = event.currentTarget.checked;
    const recId = `mod:${modId}`;

    const updates = {};
    const lines = [];

    if (checked) {
      if (modifiersUsed.length >= 2) {
        event.currentTarget.checked = false;
        ui.notifications.warn("Maximum 2 modifiers per downtime period.");
        return;
      }

      const record = { sourceId: recId, gains: {} };

      if (modId === "mentor") {
        record.dtBonus = 1;
        updates["system.downtime.currentPeriod.totalDT"] = (period.totalDT || 0) + 1;
        lines.push("+1 DT this period; activities may repeat");
      } else if (modId === "trainingPartner") {
        const pick = await this._dtPromptSelect("Training Partner", "Choose the shared benefit:", [
          ["ap", "+1 Attribute Point (not SC/PE) & +1 Score Limit until next base Tier"],
          ["tp", "+10 Technique Points & +5 single Sig/Aura TP limit until next base Tier"],
          ["stress", "+1 Natural Result on Stress Tests for a chosen Transformation"]
        ]);
        if (pick === null) { event.currentTarget.checked = false; return; }
        if (pick === "ap") {
          const alloc = await this._dtPromptAttributes("Training Partner — 1 Attribute Point (not SC/PE)", 1);
          if (!alloc) { event.currentTarget.checked = false; return; }
          record.gains.attributes = alloc;
          lines.push(`+1 ${Object.keys(alloc)[0].toUpperCase()} Score; +1 Score Limit until next base Tier (manual)`);
        } else if (pick === "tp") {
          record.gains.tp = 10;
          lines.push("+10 Technique Points; +5 single Sig/Aura TP limit until next base Tier (manual)");
        } else {
          const transOpts = (system.transformations || []).map((t, i) => [String(i), t.name || "(unnamed)"]);
          if (!transOpts.length) { ui.notifications.warn("No transformations to select."); event.currentTarget.checked = false; return; }
          const tPick = await this._dtPromptSelect("Training Partner", "Transformation with +1 Stress Test Natural Result:", transOpts);
          if (tPick === null) { event.currentTarget.checked = false; return; }
          const tName = system.transformations[Number(tPick)]?.name || "Transformation";
          record.note = `+1 Stress Test Natural Result: ${tName}`;
          lines.push(record.note + " (manual, apply on Stress rolls)");
        }
      } else if (modId === "strenuous") {
        const pick = await this._dtPromptSelect("Strenuous", "Extent of the training:", [
          ["grueling", "Grueling: -1/4 Max LP (2 encounters), +1 AP, +10 TP"],
          ["lifeThreatening", "Life Threatening: -1/2 Max LP (2 encounters), +1 AP, +10 TP, +1 DT"]
        ]);
        if (pick === null) { event.currentTarget.checked = false; return; }
        const alloc = await this._dtPromptAttributes("Strenuous — 1 Attribute Point (not SC/PE)", 1);
        if (!alloc) { event.currentTarget.checked = false; return; }
        record.strenuous = pick;
        record.gains.attributes = alloc;
        record.gains.tp = 10;
        lines.push(`+1 ${Object.keys(alloc)[0].toUpperCase()} Score, +10 TP`);
        if (pick === "lifeThreatening") {
          record.dtBonus = 1;
          updates["system.downtime.currentPeriod.totalDT"] = (period.totalDT || 0) + 1;
          lines.push("+1 DT this period");
        }
        lines.push(`LP penalty (${pick === "lifeThreatening" ? "-1/2" : "-1/4"} Max LP, 2 encounters) starts when the period ends`);
      } else if (modId === "deepFocus") {
        record.gains.karma = 1;
        lines.push("+1 Karma Point; one Recreational activity may be used twice");
      } else if (modId === "crafting") {
        const craftRank = system.skills?.crafting?.rank || 0;
        if (craftRank <= 0) { ui.notifications.warn("No Craft Skill Ranks — Crafting grants nothing."); }
        record.gains.equipmentPoints = 2 * craftRank;
        lines.push(`+${2 * craftRank} Equipment Points (2 per Craft Rank, spend immediately)`);
      }

      record.lines = lines;
      this._dtBuildGainsUpdates(record.gains, 1, updates);
      modifiersUsed.push(modId);
      records.push(record);
    } else {
      const idx = modifiersUsed.indexOf(modId);
      if (idx !== -1) modifiersUsed.splice(idx, 1);

      // Reverse this modifier's applied record
      const recIdx = records.findIndex(r => r.sourceId === recId);
      if (recIdx >= 0) {
        const record = records.splice(recIdx, 1)[0];
        this._dtBuildGainsUpdates(record.gains, -1, updates);
        if (record.dtBonus) {
          const newTotal = Math.max(0, (period.totalDT || 0) - record.dtBonus);
          updates["system.downtime.currentPeriod.totalDT"] = newTotal;
          if ((period.spentDT || 0) > newTotal) {
            updates["system.downtime.currentPeriod.spentDT"] = newTotal;
          }
        }
      } else if (modId === "mentor") {
        // Legacy periods without records: keep old mentor revert behavior
        const newTotal = Math.max(0, (period.totalDT || 0) - 1);
        updates["system.downtime.currentPeriod.totalDT"] = newTotal;
        if ((period.spentDT || 0) > newTotal) {
          updates["system.downtime.currentPeriod.spentDT"] = newTotal;
        }
      }
    }

    updates["system.downtime.currentPeriod.modifiersUsed"] = modifiersUsed;
    updates["system.downtime.currentPeriod.appliedRecords"] = records;
    await this.actor.update(updates);

    if (checked && lines.length) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<b>Downtime Modifier:</b> ${modId.charAt(0).toUpperCase() + modId.slice(1)}`
          + `<div class="dbu-auto-applied">${lines.map(l => `<div>${l}</div>`).join("")}</div>`
      });
    }
  },

  async _onDtDeleteHistory(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.historyIndex);
    if (isNaN(index)) return;

    const history = foundry.utils.deepClone(this.actor.system.downtime?.history || []);
    if (index < 0 || index >= history.length) return;
    history.splice(index, 1);
    await this.actor.update({ "system.downtime.history": history });
  },
  };
}
