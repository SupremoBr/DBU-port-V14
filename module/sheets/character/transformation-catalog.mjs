import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: transformation-catalog. Methods run with the sheet as this. */
export const transformationCatalogMethods = {

  async _onOpenTransformationCatalog(event) {
    event.preventDefault();
    const catalog = CONFIG.DBU?.transformationsCatalog || {};
    const categories = CONFIG.DBU?.transformationCategories || [];
    const catLabels = {};
    for (const c of categories) catLabels[c.id] = c.name;

    // Collect races from catalog
    const races = new Set();
    for (const t of Object.values(catalog)) {
      if (t.racialRequirement && t.racialRequirement !== "Any") races.add(t.racialRequirement);
    }
    const raceOptions = [...races].sort().map(r => `<option value="${r}">${r}</option>`).join("");
    const catOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    const sheet = this;

    const d = new Dialog({
      title: "Transformation Catalog",
      content: `
        <div class="tf-catalog-dialog">
          <div class="tf-catalog-filters">
            <select id="tfCatFilter"><option value="">All Categories</option>${catOptions}</select>
            <select id="tfRaceFilter"><option value="">All Races</option>${raceOptions}</select>
            <input type="text" id="tfCatSearch" placeholder="Search..." />
          </div>
          <div class="tf-catalog-list" id="tfCatalogList"></div>
        </div>`,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const listEl = html.find("#tfCatalogList")[0];
        const catFilter = html.find("#tfCatFilter");
        const raceFilter = html.find("#tfRaceFilter");
        const searchInput = html.find("#tfCatSearch");

        const renderList = () => {
          const catVal = catFilter.val();
          const raceVal = raceFilter.val();
          const searchVal = (searchInput.val() || "").toLowerCase();

          const entries = Object.values(catalog).filter(t => {
            if (catVal && t.category !== catVal) return false;
            if (raceVal && t.racialRequirement !== raceVal) return false;
            if (searchVal && !t.name.toLowerCase().includes(searchVal) && !t.id.includes(searchVal)) return false;
            return true;
          });

          const catOrder = ["manifested_power", "enhancement_power", "form_alternate", "form_legendary"];
          entries.sort((a, b) => {
            const ca = catOrder.indexOf(a.category); const cb = catOrder.indexOf(b.category);
            if (ca !== cb) return ca - cb;
            return a.name.localeCompare(b.name);
          });

          if (entries.length === 0) {
            listEl.innerHTML = '<div class="tf-catalog-empty">No transformations match filters.</div>';
            return;
          }

          const attrKeys = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
          let h = "";
          for (const t of entries) {
            const attrStr = attrKeys.map(k => {
              const v = t.attrBonuses?.[k];
              return v && v !== "–" ? `${k.toUpperCase()}:${v}` : null;
            }).filter(Boolean).join(" ");
            const catLabel = catLabels[t.category] || t.category;

            h += `<div class="tf-catalog-item" data-catalog-key="${t.id}">
              <div class="tf-catalog-item-info">
                <span class="tf-catalog-item-name">${t.name}</span>
                <span class="tf-catalog-badge-cat ${t.category}">${catLabel}</span>
                <div class="tf-catalog-item-meta">
                  <span>Race: ${t.racialRequirement || "Any"}</span>
                  <span>Tier: ${t.tierRequirement || "—"}</span>
                  <span>Stress: ${t.stressTest || 0}</span>
                </div>
                ${attrStr ? `<div class="tf-catalog-item-attrs">${attrStr}</div>` : ""}
              </div>
              <button type="button" class="tf-catalog-item-add" data-catalog-key="${t.id}">Add</button>
            </div>`;
          }
          listEl.innerHTML = h;

          // Bind add buttons
          listEl.querySelectorAll(".tf-catalog-item-add").forEach(btn => {
            btn.addEventListener("click", async (e) => {
              const key = e.currentTarget.dataset.catalogKey;
              await sheet._addTransformationFromCatalog(key);
            });
          });
        };

        catFilter.on("change", renderList);
        raceFilter.on("change", renderList);
        let searchTimer;
        searchInput.on("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 250); });
        renderList();
      }
    }, { width: 700, height: 600, classes: ["dbu-old", "tf-catalog-window"] });
    d.render(true);
  },

  async _addTransformationFromCatalog(catalogKey) {
    const catalog = CONFIG.DBU?.transformationsCatalog || {};
    const entry = catalog[catalogKey];
    if (!entry) return;

    const catMap = {
      manifested_power: "manifested_power",
      enhancement_power: "enhancement_standard",
      form_alternate: "form_alternate",
      form_legendary: "form_legendary"
    };
    const typeId = catMap[entry.category] || "form_alternate";
    const isLegendary = entry.category === "form_legendary";

    // --- Transcendent Aspect Dialog ---
    let aspects = entry.aspects ? [...entry.aspects] : [];
    const hasTranscendent = aspects.some(a => a.toLowerCase() === "transcendent");
    if (hasTranscendent) {
      let keepTranscendent;
      try {
        keepTranscendent = await Dialog.wait({
          title: `${entry.name} — Transcendent Aspect`,
          content: `<p><strong>${entry.name}</strong> has the <em>Transcendent</em> aspect.</p><p>Do you want to keep the Transcendent aspect?</p>`,
          buttons: {
            yes: { icon: '<i class="fas fa-check"></i>', label: "Yes, keep it", callback: () => true },
            no: { icon: '<i class="fas fa-times"></i>', label: "No, remove it", callback: () => false }
          },
          default: "yes"
        });
      } catch (e) {
        return; // Dialog closed via X or Escape — cancel entirely
      }
      if (!keepTranscendent) {
        aspects = aspects.filter(a => a.toLowerCase() !== "transcendent");
      }
    }

    const trans = foundry.utils.deepClone(this.actor.system.transformations || []);
    const nextId = trans.length > 0 ? Math.max(...trans.map(t => t.id || 0)) + 1 : 1;

    trans.push({
      id: nextId,
      catalogKey: catalogKey,
      name: entry.name,
      active: false,
      gradeOrStacks: entry.maxStacks ? `0/${entry.maxStacks}` : "",
      tierRequirement: entry.tierRequirement || "",
      mastered: false,
      stressTest: typeof entry.stressTest === "number" ? entry.stressTest : 0,
      transformationType: typeId,
      attrBonuses: { ...(entry.attrBonuses || {}) },
      aspects,
      structuredTraits: JSON.parse(JSON.stringify(entry.traitGroups || [])),
      traits: "",
      isLegendary
    });

    await this.actor.update({ "system.transformations": trans });
    ui.notifications.info(`Added transformation: ${entry.name}`);
  },

  async _onViewTransformationTraits(event) {
    event.preventDefault();
    const transIndex = Number(event.currentTarget.dataset.transIndex);
    const transformations = this.actor.system.transformations || [];
    const trans = transformations[transIndex];
    if (!trans) return;

    const catalog = CONFIG.DBU?.transformationsCatalog || {};
    const catEntry = trans.catalogKey ? catalog[trans.catalogKey] : null;
    const traitGroups = trans.structuredTraits?.length > 0
      ? trans.structuredTraits
      : (catEntry?.traitGroups || []);

    if (traitGroups.length === 0) {
      ui.notifications.warn("No structured traits available for this transformation.");
      return;
    }

    // Build HTML for trait groups
    let html = '<div class="tf-traits-detail">';

    // Header info from catalog
    if (catEntry) {
      html += '<div class="tf-detail-header-info">';
      if (catEntry.racialRequirement) html += `<span class="tf-detail-meta"><strong>Race:</strong> ${catEntry.racialRequirement}</span>`;
      if (catEntry.tierRequirement) html += `<span class="tf-detail-meta"><strong>Tier:</strong> ${catEntry.tierRequirement}</span>`;
      if (catEntry.stressTest) html += `<span class="tf-detail-meta"><strong>Stress Test:</strong> ${catEntry.stressTest}</span>`;
      if (catEntry.maxStacks) html += `<span class="tf-detail-meta"><strong>Max Stacks:</strong> ${catEntry.maxStacks}</span>`;
      html += '</div>';
      if (catEntry.prerequisites) html += `<div class="tf-detail-prereqs"><strong>Prerequisites:</strong> ${catEntry.prerequisites}</div>`;

      // Aspects
      const aspects = catEntry.aspects || [];
      if (aspects.length > 0) {
        const tfAspects = CONFIG.DBU?.transformationAspects || {};
        html += `<div class="tf-detail-aspects"><strong>Aspects:</strong> <span class="tf-aspects-list">${aspects.map(a => {
          const baseName = a.replace(/\s*\[LV~?\d*\]/i, "").replace(/\s*\([^)]*\)/g, "").trim();
          const tooltip = tfAspects[baseName] || "";
          return `<span class="tf-aspect-tag" title="${tooltip}">${a}</span>`;
        }).join("")}</span></div>`;
      }

      // AMB
      const attrKeys = ["ag", "fo", "te", "sc", "in", "ma", "pe"];
      const attrVals = attrKeys.map(k => { const v = catEntry.attrBonuses?.[k]; return v && v !== "–" ? `${k.toUpperCase()}: ${v}` : null; }).filter(Boolean);
      if (attrVals.length > 0) {
        html += `<div class="tf-detail-attrs"><strong>AMB:</strong> ${attrVals.join(", ")}</div>`;
      }
    }

    // Load saved selections for this transformation
    const allSelections = this.actor.system.transformationOptionSelections || {};
    const transSelections = allSelections[transIndex] || {};
    const actorRef = this.actor;

    // === ARCOSIAN METAMORPHOSIS: Meta Trait selection ===
    const META_STAGE_LIMITS = { full_suppression: 1, limited_suppression: 2, partial_suppression: 3, true_form: 4 };
    if (trans.catalogKey in META_STAGE_LIMITS) {
      const mtCatalog = CONFIG.DBU?.metaTraitsCatalog || [];
      const mtState = this.actor.system.transformationMeta?.metaTraitState || {};
      const stageState = mtState.stages?.[trans.catalogKey] || {};
      const forced = trans.catalogKey === "true_form" ? ["meta_bio_suit", "meta_redirected_energy"] : [];
      const chosenRaw = (Array.isArray(stageState.traits) ? stageState.traits : [])
        .filter(id => mtCatalog.some(t => t.id === id));
      const chosen = [...new Set([...forced, ...chosenRaw])];
      const cfg = stageState.config || {};
      const emperorBonus = this.actor.system.transformationMeta?.mutationState?.emperorExtraMetaTrait ? 1 : 0;
      const mtLimit = META_STAGE_LIMITS[trans.catalogKey] + emperorBonus;
      const btNames = { bestial_movement: "Bestial Movement", bestial_claws: "Claws", bestial_impaling_horns: "Impaling Horns", bestial_treacherous_spikes: "Treacherous Spikes" };

      html += `<div class="mutation-sub-config" data-trait="metatraits">
        <div class="tf-trait-group-header">Meta Traits — ${trans.name || trans.catalogKey} (${chosen.length}/${mtLimit})</div>
        <p class="mutation-bwp-rules"><i>Select ${mtLimit} Meta Traits for this stage (S+1${emperorBonus ? " +1 Emperor" : ""}).${forced.length ? " True Form must include Bio-Suit and Redirected Energy." : ""}</i></p>
        <div class="mut-checkbox-list">
          ${mtCatalog.map(mt => {
            const isForced = forced.includes(mt.id);
            const checked = chosen.includes(mt.id);
            const disabled = isForced || (!checked && chosen.length >= mtLimit);
            const effectLines = (mt.effects || []).map(e => `[${e.keyword}] ${e.text}`).join("&#10;");
            let extra = "";
            if (checked && mt.options) {
              extra = `<div class="bestial-option-row" style="margin-left:24px;margin-bottom:4px;">
                <select class="mut-meta-option" data-trait-id="${mt.id}" data-stage="${trans.catalogKey}">
                  <option value="">-- Choose --</option>
                  ${mt.options.map(o => `<option value="${o.key}" ${cfg[mt.id]?.option === o.key ? "selected" : ""}>${o.name}</option>`).join("")}
                </select>
              </div>`;
            }
            if (checked && mt.bestialChoice) {
              extra = `<div class="bestial-option-row" style="margin-left:24px;margin-bottom:4px;">
                <select class="mut-meta-bestial" data-trait-id="${mt.id}" data-stage="${trans.catalogKey}">
                  <option value="">-- Choose Bestial Trait --</option>
                  ${mt.bestialChoice.map(b => `<option value="${b}" ${cfg[mt.id]?.bestialTrait === b ? "selected" : ""}>${btNames[b] || b}</option>`).join("")}
                </select>
              </div>`;
            }
            return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}" title="${mt.description}&#10;${effectLines}">
              <input type="checkbox" class="mut-meta-trait" data-name="${mt.id}" data-stage="${trans.catalogKey}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span class="option-name">${mt.name}${isForced ? " (required)" : ""}</span>
            </label>${extra}`;
          }).join("")}
        </div>
        ${(this.actor.system.racialTraits || []).includes("b252198d4bafa7c6") ? `
        <div class="tf-trait-group-header" style="margin-top:8px;">Divergent Evolution — Meta Trait</div>
        <p class="mutation-bwp-rules"><i>Standard: permanent. Mutant: applies while in any Legendary Form.</i></p>
        <div class="mut-sub-row">
          <select class="mut-divergent-meta">
            <option value="">-- Choose Meta Trait --</option>
            ${mtCatalog.map(mt => `<option value="${mt.id}" ${mtState.divergent?.trait === mt.id ? "selected" : ""}>${mt.name}</option>`).join("")}
          </select>
          ${mtState.divergent?.trait === "meta_variable_weight_plating" ? `
          <select class="mut-divergent-meta-option">
            <option value="">-- Option --</option>
            <option value="heavy" ${mtState.divergent?.config?.option === "heavy" ? "selected" : ""}>Heavy Plating</option>
            <option value="light" ${mtState.divergent?.config?.option === "light" ? "selected" : ""}>Light Plating</option>
          </select>` : ""}
          ${mtState.divergent?.trait === "meta_bestial_evolution" ? `
          <select class="mut-divergent-meta-bestial">
            <option value="">-- Bestial Trait --</option>
            ${Object.entries(btNames).map(([k, v]) => `<option value="${k}" ${mtState.divergent?.config?.bestialTrait === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>` : ""}
        </div>` : ""}
      </div>`;
    }

    // === DRAGON FORCE: Draconization bestial trait (1, restricted list) ===
    if (trans.catalogKey === "dragon_force") {
      const dfChoices = [
        { id: "bestial_movement", label: "Bestial Movement (Wings)" },
        { id: "bestial_build", label: "Bestial Build (Thick Hide)" },
        { id: "bestial_claws", label: "Claws" },
        { id: "bestial_fangs", label: "Fangs" },
        { id: "bestial_tail", label: "Tail" }
      ];
      const dfState = this.actor.system.transformationMeta?.mutationState?.dragonForceBestialTraits || [];
      const dfChosen = dfState[0] || "";
      html += `<div class="mutation-sub-config" data-trait="dragon_force_bestial">
        <div class="tf-trait-group-header">Draconization — Bestial Trait (select 1)</div>
        <p class="mutation-bwp-rules"><i>Selected upon gaining access. You have access to it while in the Dragon Force Transformation. Movement is fixed to Wings and Build to Thick Hide.</i></p>
        <div class="mut-sub-row">
          <select class="mut-df-bestial">
            <option value="">-- Choose --</option>
            ${dfChoices.map(c => `<option value="${c.id}" ${dfChosen === c.id ? "selected" : ""}>${c.label}</option>`).join("")}
          </select>
        </div>
      </div>`;
    }

    // === MONSTER FORM: Monstrous Ascension Monster Traits (2, +1 mastered) ===
    if (trans.catalogKey === "monster_form") {
      const mfCat = CONFIG.DBU?.transformationsCatalog?.monster_form;
      const mfTraitNames = (mfCat?.traitGroups || [])
        .filter(g => g.name && !["Monstrous Ascension", "Vile Technique", "Beast of Wrath", "Mastery: Controlled Monster"].includes(g.name))
        .map(g => g.name);
      const mutStateMF = this.actor.system.transformationMeta?.mutationState || {};
      const mfChosen = Array.isArray(mutStateMF.monsterFormMonsterTraits) ? mutStateMF.monsterFormMonsterTraits : [];
      const mfLimit = trans.mastered ? 3 : 2;
      const mfBestial = mutStateMF.monsterFormBestialTraits || [];
      const btCatalogMF = CONFIG.DBU?.bestialTraitsCatalog || [];
      const btCfgMF = mutStateMF.bestialTraitConfig || {};
      html += `<div class="mutation-sub-config" data-trait="monster_form_traits">
        <div class="tf-trait-group-header">Monstrous Ascension — Monster Traits (${mfChosen.length}/${mfLimit})</div>
        <p class="mutation-bwp-rules"><i>Choose 2 Monster Traits${trans.mastered ? " (+1 from Mastery, Full Power only)" : ""}. You benefit from them while in Monster Form.</i></p>
        <div class="mut-checkbox-list">
          ${mfTraitNames.map(mt => {
            const checked = mfChosen.includes(mt);
            const disabled = !checked && mfChosen.length >= mfLimit;
            return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
              <input type="checkbox" class="mut-mf-monster" data-name="${mt}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span class="option-name">${mt}</span>
            </label>`;
          }).join("")}
        </div>
        ${mfChosen.includes("Bestial Monster") ? `
        <div class="tf-trait-group-header" style="margin-top:8px;">Bestial Monster — Bestial Trait (select 1)</div>
        <div class="mut-sub-row">
          <select class="mut-mf-bestial">
            <option value="">-- Choose --</option>
            ${btCatalogMF.map(bt => `<option value="${bt.id}" ${mfBestial[0] === bt.id ? "selected" : ""}>${bt.name}</option>`).join("")}
          </select>
          ${(() => {
            const chosenBt = btCatalogMF.find(b => b.id === mfBestial[0]);
            const optEffect = chosenBt?.effects?.find(e => e.activationType === "option");
            if (!optEffect) return "";
            return `<select class="mut-bestial-option" data-trait-id="${chosenBt.id}">
              <option value="">-- Option --</option>
              ${optEffect.options.map(o => {
                const k = o.name.toLowerCase().replace(/\s+/g, "_");
                return `<option value="${k}" ${btCfgMF[chosenBt.id]?.option === k ? "selected" : ""}>${o.name}</option>`;
              }).join("")}
            </select>`;
          })()}
        </div>` : ""}
      </div>`;
    }

    // === CYBERNETIC ENHANCEMENT: Cybernetic Trait selection ===
    if (trans.catalogKey === "cybernetic_enhancement") {
      const cyCatalog = CONFIG.DBU?.cyberneticTraitsCatalog || [];
      const cyState = this.actor.system.transformationMeta?.cyberneticState || {};
      const cyChosen = (Array.isArray(cyState.traits) ? cyState.traits : [])
        .filter(id => cyCatalog.some(t => t.id === id));
      const cyConfig = cyState.config || {};
      const cyStacks = Math.min(3, Math.max(1, parseInt(String(trans.gradeOrStacks ?? "").replace(/[^\d]/g, ""), 10) || 1));
      const cyLimit = 3 + 2 * (cyStacks - 1);
      const attrLabels = { ag: "AG", fo: "FO", te: "TE", sc: "SC", in: "IN", ma: "MA", pe: "PE" };

      html += `<div class="mutation-sub-config" data-trait="cybernetic">
        <div class="tf-trait-group-header">Scientific Upgrade — Cybernetic Traits (${cyChosen.length}/${cyLimit})</div>
        <p class="mutation-bwp-rules"><i>${cyStacks} stack${cyStacks > 1 ? "s" : ""} → select up to ${cyLimit} traits (3 + 2 per extra stack; set stacks in the Grade/Stacks field). Each chosen trait adds +1 AMB to its bracketed Attribute.</i></p>
        <div class="mut-checkbox-list">
          ${cyCatalog.map(ct => {
            const checked = cyChosen.includes(ct.id);
            const disabled = !checked && cyChosen.length >= cyLimit;
            const cfg = cyConfig[ct.id] || {};
            const effectLines = (ct.effects || []).map(e => `[${e.keyword}] ${e.text}`).join("&#10;");
            return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}" title="${ct.description}&#10;${effectLines}">
              <input type="checkbox" class="mut-cyber-trait" data-name="${ct.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span class="option-name">${ct.name} (${ct.attributeChoice ? ct.attributeChoice.map(k => attrLabels[k]).join("/") : attrLabels[ct.attribute]})</span>
            </label>${checked && ct.attributeChoice ? `<div class="bestial-option-row" style="margin-left:24px;margin-bottom:4px;">
              <select class="mut-cyber-attr" data-trait-id="${ct.id}">
                ${ct.attributeChoice.map(k => `<option value="${k}" ${(cfg.attribute || ct.attribute) === k ? "selected" : ""}>${attrLabels[k]} (+1 AMB)</option>`).join("")}
              </select>
            </div>` : ""}`;
          }).join("")}
        </div>
      </div>`;
    }

    // === MUTATION: Born with Power distribution + Mutation Trait selector ===
    if (trans.catalogKey === "mutation") {
      const currentBonuses = trans.attrBonuses || {};
      const bwpAttrs = ["ag","fo","te","sc","in","ma","pe"];
      const bwpLabels = {ag:"Agility",fo:"Force",te:"Tenacity",sc:"Scholarship",in:"Insight",ma:"Magic",pe:"Personality"};

      html += `<div class="mutation-bwp-section">
        <div class="tf-trait-group-header">Born with Power — Distribute 6 Attribute Modifier Bonus Points</div>
        <p class="mutation-bwp-rules"><i>Max 2 per attribute. Force and Magic are linked (changing one changes the other).</i></p>
        <div class="mutation-bwp-grid">`;
      for (const attr of bwpAttrs) {
        const raw = currentBonuses[attr];
        const displayVal = (!raw || raw === "*" || raw === "–" || raw === "-") ? 0 : (parseInt(String(raw).replace("+","")) || 0);
        html += `<div class="mutation-bwp-attr">
          <label>${bwpLabels[attr]}</label>
          <input type="number" class="mutation-bwp-input" data-attr="${attr}" value="${displayVal}" min="0" max="2" />
        </div>`;
      }
      html += `</div><div class="mutation-bwp-total">Points Used: <span class="bwp-total-display">0</span> / 6</div>
      </div>`;

      // Mutation Trait selector
      const mutCatalog = CONFIG.DBU?.transformationsCatalog?.mutation;
      const mutationTraits = mutCatalog?.mutationTraits || [];
      const actorRace = this.actor.system.race || "";
      const actorSubrace = this.actor.system.subrace || "";
      const selectedMutTrait = transSelections.mutationTrait || "";

      const availableTraits = mutationTraits.filter(mt => {
        if (!mt.racialRequirement) return true;
        const req = mt.racialRequirement.toLowerCase();
        if (req.includes(actorRace.toLowerCase())) return true;
        if (actorSubrace && req.includes(actorSubrace.toLowerCase())) return true;
        return false;
      });

      html += `<div class="mutation-trait-selector">
        <div class="tf-trait-group-header">Select Mutation Trait</div>
        <select class="mutation-trait-select" data-trans-index="${transIndex}">
          <option value="">-- Choose Mutation Trait --</option>`;
      for (const mt of availableTraits) {
        const raceTag = mt.racialRequirement ? ` (${mt.racialRequirement})` : "";
        html += `<option value="${mt.id}" ${selectedMutTrait === mt.id ? "selected" : ""}>${mt.name}${raceTag}</option>`;
      }
      html += `</select><div class="mutation-trait-preview">`;

      // Show selected trait effects
      if (selectedMutTrait) {
        const selTrait = mutationTraits.find(t => t.id === selectedMutTrait);
        if (selTrait) {
          html += `<p><strong>${selTrait.name}</strong>: ${selTrait.description}</p>`;
          for (const eff of (selTrait.effects || [])) {
            html += `<div class="tf-trait-effect-row">
              <span class="tf-trait-keyword-badge ${eff.activationType || ""}">${eff.keyword || ""}</span>
              <span class="tf-trait-effect-text">${eff.text || ""}</span>
            </div>`;
          }
        }
      }
      html += `</div>`;

      // === MUTATION TRAIT SUB-SELECTIONS ===
      const mutState = this.actor.system.transformationMeta?.mutationState || {};

      // --- Were-creature ---
      if (selectedMutTrait === "were_creature") {
        const wcOption = mutState.wereCreatureOption || "";
        const wcBestialRaw = Array.isArray(mutState.wereCreatureBestialTraits) ? mutState.wereCreatureBestialTraits : [];
        const btCatalog = CONFIG.DBU?.bestialTraitsCatalog || [];
        const btNameMap = {};
        for (const t of btCatalog) btNameMap[t.name] = t.id;
        const _normBtId = (v) => v?.startsWith("bestial_") ? v : (btNameMap[v] || null);
        const btValidIds = new Set(btCatalog.map(t => t.id));
        const wcBestial = wcBestialRaw.map(_normBtId).filter(id => id && btValidIds.has(id));
        const btConfig = mutState.bestialTraitConfig || {};
        const wcAttrs = Array.isArray(mutState.wereCreatureAttributes) ? mutState.wereCreatureAttributes : [];
        const wcActive = !!mutState.wereCreatureActive;
        const wcAttrOpts = [{k:"ag",l:"Agility"},{k:"fo",l:"Force"},{k:"te",l:"Tenacity"},{k:"ma",l:"Magic"}];
        html += `<div class="mutation-sub-config" data-trait="were_creature">
          <div class="tf-trait-group-header">Were-creature Configuration</div>
          <div class="mut-sub-row">
            <label>Option:</label>
            <select class="mut-wc-option">
              <option value="">-- Choose --</option>
              <option value="free_control" ${wcOption === "free_control" ? "selected" : ""}>Free Control</option>
              <option value="traditional" ${wcOption === "traditional" ? "selected" : ""}>Traditional</option>
            </select>
          </div>
          <div class="mut-sub-row">
            <label>Bestial Traits (select 2):</label>
            <div class="mut-checkbox-list">
              ${btCatalog.map(bt => {
                const checked = wcBestial.includes(bt.id);
                const disabled = !checked && wcBestial.length >= 2;
                const optEffect = bt.effects.find(e => e.activationType === "option");
                const traitCfg = btConfig[bt.id] || {};
                return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
                  <input type="checkbox" class="mut-wc-bestial" data-name="${bt.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
                  <span class="option-name">${bt.name}</span>
                </label>${checked && optEffect ? `<div class="bestial-option-row" style="margin-left:24px;margin-bottom:4px;">
                  <select class="mut-bestial-option" data-trait-id="${bt.id}">
                    <option value="">-- ${optEffect.text.includes("choose") ? "Choose" : "Select"} --</option>
                    ${optEffect.options.map(o => {
                      const optKey = o.name.toLowerCase().replace(/\s+/g, "_");
                      return `<option value="${optKey}" ${traitCfg.option === optKey ? "selected" : ""}>${o.name}</option>`;
                    }).join("")}
                  </select>
                </div>` : ""}`;
              }).join("")}
            </div>
          </div>
          ${wcOption === "traditional" ? `<div class="mut-sub-row">
            <label>Attribute Bonuses (select 2, AG/FO/TE/MA only):</label>
            <div class="mut-checkbox-list">
              ${wcAttrOpts.map(a => {
                const checked = wcAttrs.includes(a.k);
                const disabled = !checked && wcAttrs.length >= 2;
                return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
                  <input type="checkbox" class="mut-wc-attr" data-attr="${a.k}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
                  <span class="option-name">${a.l}</span>
                </label>`;
              }).join("")}
            </div>
          </div>` : ""}
          <div class="mut-sub-row">
            <label class="effect-option-checkbox ${wcActive ? "selected" : ""}">
              <input type="checkbox" class="mut-wc-active" ${wcActive ? "checked" : ""} />
              <span class="option-name">Currently Transformed (Were-creature Active)</span>
            </label>
          </div>
        </div>`;
      }

      // --- Dark Vassal ---
      if (selectedMutTrait === "dark_vassal") {
        const dvBestialRaw = Array.isArray(mutState.darkVassalBestialTraits) ? mutState.darkVassalBestialTraits : [];
        const dvCatalog = CONFIG.DBU?.bestialTraitsCatalog || [];
        const dvNameMap = {};
        for (const t of dvCatalog) dvNameMap[t.name] = t.id;
        const _normDvId = (v) => v?.startsWith("bestial_") ? v : (dvNameMap[v] || null);
        const dvValidIds = new Set(dvCatalog.map(t => t.id));
        const dvBestial = dvBestialRaw.map(_normDvId).filter(id => id && dvValidIds.has(id));
        const dvBtConfig = mutState.bestialTraitConfig || {};
        html += `<div class="mutation-sub-config" data-trait="dark_vassal">
          <div class="tf-trait-group-header">Dark Vassal — Bestial Traits (up to 2)</div>
          <p class="mutation-bwp-rules"><i>Reduce Max LP by x for each Power Level, where x = number of Bestial Traits selected.</i></p>
          <div class="mut-checkbox-list">
            ${dvCatalog.map(bt => {
              const checked = dvBestial.includes(bt.id);
              const disabled = !checked && dvBestial.length >= 2;
              const optEffect = bt.effects.find(e => e.activationType === "option");
              const traitCfg = dvBtConfig[bt.id] || {};
              return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
                <input type="checkbox" class="mut-dv-bestial" data-name="${bt.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
                <span class="option-name">${bt.name}</span>
              </label>${checked && optEffect ? `<div class="bestial-option-row" style="margin-left:24px;margin-bottom:4px;">
                <select class="mut-bestial-option" data-trait-id="${bt.id}">
                  <option value="">-- ${optEffect.text.includes("choose") ? "Choose" : "Select"} --</option>
                  ${optEffect.options.map(o => {
                    const optKey = o.name.toLowerCase().replace(/\s+/g, "_");
                    return `<option value="${optKey}" ${traitCfg.option === optKey ? "selected" : ""}>${o.name}</option>`;
                  }).join("")}
                </select>
              </div>` : ""}`;
            }).join("")}
          </div>
        </div>`;
      }

      // --- Dark Evolution ---
      if (selectedMutTrait === "dark_evolution") {
        const deMonster = Array.isArray(mutState.darkEvolutionMonsterTraits) ? mutState.darkEvolutionMonsterTraits : [];
        const monsterFormCat = CONFIG.DBU?.transformationsCatalog?.monster_form;
        const monsterTraitGroups = monsterFormCat?.traitGroups || [];
        const monsterTraitNames = monsterTraitGroups
          .filter(g => g.name && g.name !== "Monstrous Ascension" && g.name !== "Vile Technique" && g.name !== "Beast of Wrath" && g.name !== "Mastery: Controlled Monster" && g.name !== "Mutating Beast")
          .map(g => g.name);
        const deBestial = mutState.darkEvolutionBestialTraits || [];
        const btCatalogDE = CONFIG.DBU?.bestialTraitsCatalog || [];
        html += `<div class="mutation-sub-config" data-trait="dark_evolution">
          <div class="tf-trait-group-header">Dark Evolution — Monster Traits (select 2, cannot select Mutating Beast)</div>
          <div class="mut-checkbox-list">
            ${monsterTraitNames.map(mt => {
              const checked = deMonster.includes(mt);
              const disabled = !checked && deMonster.length >= 2;
              return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
                <input type="checkbox" class="mut-de-monster" data-name="${mt}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
                <span class="option-name">${mt}</span>
              </label>`;
            }).join("")}
          </div>
          ${deMonster.includes("Bestial Monster") ? `
          <div class="tf-trait-group-header" style="margin-top:8px;">Bestial Monster — Bestial Trait (select 1)</div>
          <div class="mut-sub-row">
            <select class="mut-de-bestial">
              <option value="">-- Choose --</option>
              ${btCatalogDE.map(bt => `<option value="${bt.id}" ${deBestial[0] === bt.id ? "selected" : ""}>${bt.name}</option>`).join("")}
            </select>
            ${(() => {
              const chosenBt = btCatalogDE.find(b => b.id === deBestial[0]);
              const optEffect = chosenBt?.effects?.find(e => e.activationType === "option");
              if (!optEffect) return "";
              const cfgDE = mutState.bestialTraitConfig || {};
              return `<select class="mut-bestial-option" data-trait-id="${chosenBt.id}">
                <option value="">-- Option --</option>
                ${optEffect.options.map(o => {
                  const k = o.name.toLowerCase().replace(/\s+/g, "_");
                  return `<option value="${k}" ${cfgDE[chosenBt.id]?.option === k ? "selected" : ""}>${o.name}</option>`;
                }).join("")}
              </select>`;
            })()}
          </div>` : ""}
        </div>`;
      }

      // --- DNA Absorption ---
      if (selectedMutTrait === "dna_absorption") {
        const dnaStacks = Array.isArray(mutState.dnaStacks) ? mutState.dnaStacks : [];
        const activeIdx = typeof mutState.activeDnaStackIndex === "number" ? mutState.activeDnaStackIndex : -1;
        const attrKeys = ["ag","fo","te","sc","in","ma","pe"];
        const attrLabels = {ag:"AG",fo:"FO",te:"TE",sc:"SC",in:"IN",ma:"MA",pe:"PE"};
        html += `<div class="mutation-sub-config" data-trait="dna_absorption">
          <div class="tf-trait-group-header">DNA Absorption — Stacks (${dnaStacks.length}/3)</div>
          <p class="mutation-bwp-rules"><i>Record absorbed character's attribute scores. Bonus = ceil(score/4), capped at base Tier.</i></p>
          <div class="mut-dna-stacks">
            ${dnaStacks.map((stack, i) => `<div class="mut-dna-stack-row" data-stack-idx="${i}">
              <div class="mut-dna-stack-header">
                <input type="radio" name="mut-dna-active" class="mut-dna-active-radio" value="${i}" ${activeIdx === i ? "checked" : ""} />
                <input type="text" class="mut-dna-name" data-stack-idx="${i}" value="${foundry.utils.escapeHTML(stack.name || "")}" placeholder="Character name" />
                <button type="button" class="mut-dna-remove" data-stack-idx="${i}" title="Remove Stack"><i class="fas fa-trash"></i></button>
              </div>
              <div class="mut-dna-attrs">
                ${attrKeys.map(k => `<div class="mut-dna-attr-cell">
                  <label>${attrLabels[k]}</label>
                  <input type="number" class="mut-dna-attr" data-stack-idx="${i}" data-attr="${k}" value="${stack.attributes?.[k] || 0}" min="0" />
                </div>`).join("")}
              </div>
            </div>`).join("")}
          </div>
          ${dnaStacks.length < 3 ? `<button type="button" class="mut-dna-add"><i class="fas fa-plus"></i> Add DNA Stack</button>` : ""}
          <div class="mut-sub-row" style="margin-top:4px;">
            <label class="effect-option-checkbox">
              <input type="radio" name="mut-dna-active" class="mut-dna-active-radio" value="-1" ${activeIdx < 0 ? "checked" : ""} />
              <span class="option-name">No active stack</span>
            </label>
          </div>
        </div>`;
      }

      // --- OG Soldier ---
      if (selectedMutTrait === "og_soldier") {
        const ogCopies = Array.isArray(mutState.ogSoldierCopies) ? mutState.ogSoldierCopies : [];
        const ogActiveIdx = typeof mutState.ogSoldierActiveCopyIndex === "number" ? mutState.ogSoldierActiveCopyIndex : -1;
        html += `<div class="mutation-sub-config" data-trait="og_soldier">
          <div class="tf-trait-group-header">OG Soldier — Copies (${ogCopies.length}/3)</div>
          <p class="mutation-bwp-rules"><i>Record copied character data via Grab Neck. After 9 total Actions, that copy is lost permanently.</i></p>
          <div class="mut-og-copies">
            ${ogCopies.map((copy, i) => `<div class="mut-og-copy-row" data-copy-idx="${i}">
              <div class="mut-og-copy-header">
                <input type="radio" name="mut-og-active" class="mut-og-active-radio" value="${i}" ${ogActiveIdx === i ? "checked" : ""} />
                <input type="text" class="mut-og-name" data-copy-idx="${i}" value="${foundry.utils.escapeHTML(copy.name || "")}" placeholder="Character name" />
                <label class="mut-og-actions">Actions: <input type="number" class="mut-og-actions-input" data-copy-idx="${i}" value="${copy.actionsSpent || 0}" min="0" max="9" /> / 9</label>
                <button type="button" class="mut-og-remove" data-copy-idx="${i}" title="Remove Copy"><i class="fas fa-trash"></i></button>
              </div>
            </div>`).join("")}
          </div>
          ${ogCopies.length < 3 ? `<button type="button" class="mut-og-add"><i class="fas fa-plus"></i> Add Copy</button>` : ""}
          <div class="mut-sub-row" style="margin-top:4px;">
            <label class="effect-option-checkbox">
              <input type="radio" name="mut-og-active" class="mut-og-active-radio" value="-1" ${ogActiveIdx < 0 ? "checked" : ""} />
              <span class="option-name">No active copy</span>
            </label>
          </div>
        </div>`;
      }

      // --- Biodiversity ---
      if (selectedMutTrait === "biodiversity") {
        const addTraits = mutState.additionalTraitSelections || {};
        const bioVal = foundry.utils.escapeHTML(addTraits.biodiversity || "");
        html += `<div class="mutation-sub-config" data-trait="biodiversity">
          <div class="tf-trait-group-header">Biodiversity — Additional Genetic Splicing Trait</div>
          <div class="mut-sub-row">
            <input type="text" class="mut-bio-trait" value="${bioVal}" placeholder="Enter trait name" />
          </div>
        </div>`;
      }

      // --- Spreading Shadow ---
      if (selectedMutTrait === "spreading_shadow") {
        const addTraits = mutState.additionalTraitSelections || {};
        const ssVal = foundry.utils.escapeHTML(addTraits.spreadingShadow || "");
        html += `<div class="mutation-sub-config" data-trait="spreading_shadow">
          <div class="tf-trait-group-header">Spreading Shadow — Additional Supernatural Powers Option</div>
          <div class="mut-sub-row">
            <input type="text" class="mut-ss-option" value="${ssVal}" placeholder="Enter option name" />
          </div>
        </div>`;
      }

      // --- Custom Mutation ---
      if (selectedMutTrait === "custom_mutation") {
        const addTraits = mutState.additionalTraitSelections || {};
        const cmVal = foundry.utils.escapeHTML(addTraits.customMutation || "");
        const cmFlaw = !!addTraits.customMutationFlaw;
        html += `<div class="mutation-sub-config" data-trait="custom_mutation">
          <div class="tf-trait-group-header">Custom Mutation — Additional Secondary Racial Trait</div>
          <div class="mut-sub-row">
            <input type="text" class="mut-cm-trait" value="${cmVal}" placeholder="Enter trait name" />
          </div>
          <div class="mut-sub-row">
            <label class="effect-option-checkbox ${cmFlaw ? "selected" : ""}">
              <input type="checkbox" class="mut-cm-flaw" ${cmFlaw ? "checked" : ""} />
              <span class="option-name">Gain Flaw Trait</span>
              <span class="option-text">The Flaw Effect from this Secondary Racial Trait applies</span>
            </label>
          </div>
        </div>`;
      }

      // --- Legendary ---
      if (selectedMutTrait === "legendary") {
        html += `<div class="mutation-sub-config" data-trait="legendary">
          <div class="tf-trait-group-header">Legendary — Notes</div>
          <p class="mutation-bwp-rules"><i>Legendary Traits for LSS1 and Legendary Oozaru are selected in those transformations' trait dialogs, not here. Battle Born wound cap is automatically increased by +2.</i></p>
        </div>`;
      }

      html += `</div>`;
    }

    // === PURE RESOLVE: Choose 2 AMBs to increase ===
    if (trans.catalogKey === "pure_resolve") {
      const prSelections = transSelections.pureResolveChosenAttrs || [];
      const prAttrOptions = [
        { key: "ag", label: "Agility" }, { key: "fo", label: "Force" },
        { key: "te", label: "Tenacity" }, { key: "sc", label: "Scholarship" },
        { key: "in", label: "Insight" }, { key: "ma", label: "Magic" },
        { key: "pe", label: "Personality" }
      ];
      html += `<div class="pure-resolve-amb-section">
        <div class="tf-trait-group-header">No Shortcuts — Choose 2 AMBs to Increase</div>
        <p class="mutation-bwp-rules"><i>Select 2 different Attribute Modifier Bonuses to increase by +1. If you select Force or Magic, the other also increases by +1. You cannot select both Force and Magic.</i></p>
        <div style="display:flex;gap:8px;margin:4px 0;">
          <label style="flex:1;">AMB 1:
            <select class="pure-resolve-amb-select" data-trans-index="${transIndex}" data-amb-slot="0" style="width:100%;">
              <option value="">-- Choose --</option>
              ${prAttrOptions.map(a => `<option value="${a.key}" ${prSelections[0] === a.key ? "selected" : ""}>${a.label}</option>`).join("")}
            </select>
          </label>
          <label style="flex:1;">AMB 2:
            <select class="pure-resolve-amb-select" data-trans-index="${transIndex}" data-amb-slot="1" style="width:100%;">
              <option value="">-- Choose --</option>
              ${prAttrOptions.map(a => `<option value="${a.key}" ${prSelections[1] === a.key ? "selected" : ""}>${a.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="pure-resolve-amb-preview" style="font-size:0.85rem;color:#aaa;margin-top:2px;"></div>
      </div>`;
    }

    const renderEffects = (groups, label, cssClass) => {
      if (!groups) return "";
      let h = "";
      if (label) h += `<div class="tf-special-trait-header ${cssClass}">${label}</div>`;
      const groupArr = groups.subGroups || [groups];
      for (const g of groupArr) {
        if (!g.effects || g.effects.length === 0) continue;
        h += '<div class="tf-trait-group-detail">';
        h += `<div class="tf-trait-group-header">${g.name || "Trait"}</div>`;

        // Derive implicit options: many catalog entries encode an Option/Choice
        // effect's candidates as the FOLLOWING sibling rows whose keyword names
        // the choice (e.g. "Turtle Style [Passive]"). Fold those rows into an
        // options array so the picker renders (same UX as explicit options).
        const rawEffects = g.effects;
        const namedKw = (x) => {
          const m = String(x.keyword || "").match(/^(.+?)\s*\[/);
          if (!m) return null;
          const nm = m[1].trim();
          return /^(option|choice|multi-option|triggered|passive|permanent|resource|limited)\b/i.test(nm) ? null : nm;
        };
        const effectsList = [];
        for (let i = 0; i < rawEffects.length; i++) {
          const e = rawEffects[i];
          if ((e.activationType === "option" || e.activationType === "choice") && !(e.options?.length)) {
            const opts = [];
            let j = i + 1;
            while (j < rawEffects.length) {
              const cand = rawEffects[j];
              if (["option", "choice", "multi-option"].includes(cand.activationType)) break;
              const nm = namedKw(cand);
              if (!nm) break;
              opts.push({ name: nm, keyword: cand.keyword, text: cand.text, activationType: cand.activationType });
              j++;
            }
            if (opts.length >= 2) {
              effectsList.push({ ...e, options: opts, derivedOptions: true });
              i = j - 1;
              continue;
            }
          }
          effectsList.push(e);
        }

        let lastOptionKey = "";
        for (const e of effectsList) {
          const effectKey = `${g.name || "trait"}_${e.level || 0}`;

          if (e.activationType === "option" && e.options?.length > 0) {
            // Single option: dropdown
            const selected = transSelections[effectKey] || "";
            lastOptionKey = effectKey;
            h += `<div class="tf-trait-effect-row">
              <span class="tf-trait-keyword-badge option">${e.keyword || "Option"}</span>
              <span class="tf-trait-effect-text">${e.text || ""}</span>
              <div class="tf-option-controls">
                <select class="tf-option-select option-select" data-trans-index="${transIndex}" data-effect-key="${effectKey}">
                  ${e.derivedOptions ? `<option value="" ${selected ? "" : "selected"}>-- Choose --</option>` : ""}
                  ${e.options.map(o => `<option value="${o.name}" ${o.name === selected ? "selected" : ""}>${o.name}</option>`).join("")}
                </select>
                ${e.options.map(o => {
                  const isSelected = o.name === selected || (!selected && !e.derivedOptions && o === e.options[0]);
                  return isSelected ? `<div class="tf-option-detail">
                    <span class="tf-option-keyword">[${o.keyword || o.activationType || ""}]</span>
                    <span class="tf-option-text">${o.text || ""}</span>
                  </div>` : "";
                }).join("")}
                ${(e.derivedOptions && !selected) ? '<div class="tf-option-pending">Choose an option to lock it in.</div>' : ""}
              </div>
            </div>`;

          } else if (e.activationType === "multi-option" && e.options?.length > 0) {
            // Multi-option: checkboxes with limit
            const selectedArr = Array.isArray(transSelections[effectKey]) ? transSelections[effectKey] : [];
            const max = e.optionCount || Infinity;
            const selCount = selectedArr.length;
            h += `<div class="tf-trait-effect-row">
              <span class="tf-trait-keyword-badge multi-option">${e.keyword || "Multi-Option"}</span>
              <span class="tf-trait-effect-text">${e.text || ""}</span>
              <div class="tf-option-controls">
                ${max !== Infinity ? `<div class="option-limit">Choose up to ${max} (${selCount}/${max} selected)</div>` : ""}
                ${e.options.map(o => {
                  const checked = selectedArr.includes(o.name);
                  const disabled = !checked && selCount >= max;
                  return `<label class="effect-option-checkbox ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}">
                    <input type="checkbox" class="tf-option-checkbox option-checkbox" data-trans-index="${transIndex}" data-effect-key="${effectKey}" data-option-name="${o.name}" data-max-options="${max}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
                    <span class="option-name">${o.name}</span>
                    <span class="option-text">${o.text || ""}</span>
                  </label>`;
                }).join("")}
              </div>
            </div>`;

          } else if (e.activationType === "choice" && e.options?.length > 0) {
            // Choice: conditional display based on previous option.
            // Derived choices (options folded from sibling rows) key off the
            // nearest preceding Option effect in the same trait group.
            const parentKey = e.parentOptionKey || (e.derivedOptions ? lastOptionKey : "");
            const parentSelected = transSelections[parentKey] || "";
            const matchingOpt = e.options.find(o => o.name === parentSelected);
            h += `<div class="tf-trait-effect-row">
              <span class="tf-trait-keyword-badge choice">${e.keyword || "Choice"}</span>
              <span class="tf-trait-effect-text">${e.text || ""}</span>
              ${matchingOpt ? `<div class="tf-option-detail choice-detail">
                <span class="option-name">${matchingOpt.name}</span>
                <span class="tf-option-keyword">[${matchingOpt.keyword || ""}]</span>
                <span class="tf-option-text">${matchingOpt.text || ""}</span>
              </div>` : '<div class="tf-option-pending">Select the related option above to see this effect.</div>'}
            </div>`;

          } else {
            // Standard effect (passive/triggered/limited/etc.)
            h += `<div class="tf-trait-effect-row">
              <span class="tf-trait-keyword-badge ${e.activationType || ""}">${e.keyword || e.activationType || ""}</span>
              <span class="tf-trait-effect-text">${e.text || ""}</span>
            </div>`;
          }
        }
        h += '</div>';
      }
      return h;
    };

    // Main trait groups
    for (const g of traitGroups) {
      html += renderEffects(g, null, "");
    }

    // Special traits from catalog
    if (catEntry) {
      if (catEntry.masteryTrait) html += renderEffects(catEntry.masteryTrait, "Mastery Trait", "mastery");
      if (catEntry.legendaryTrait) html += renderEffects(catEntry.legendaryTrait, "Legendary Trait", "legendary");
      if (catEntry.exceedTrait) html += renderEffects(catEntry.exceedTrait, "Exceed Trait", "exceed");
      if (catEntry.burstLimit) html += renderEffects(catEntry.burstLimit, "Burst Limit", "burst");
    }

    html += '</div>';

    const dialog = new Dialog({
      title: `${trans.name} - Traits`,
      content: html,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (dialogHtml) => {
        // === ARCOSIAN META TRAITS: selection handlers ===
        if (["full_suppression", "limited_suppression", "partial_suppression", "true_form"].includes(trans.catalogKey)) {
          const _mtReopen = () => { dialog.close(); this._onViewTransformationTraits(event); };
          const _mtSave = async (mutator) => {
            const state = foundry.utils.deepClone(actorRef.system.transformationMeta?.metaTraitState || {});
            if (!state.stages) state.stages = {};
            if (!state.stages[trans.catalogKey]) state.stages[trans.catalogKey] = { traits: [], config: {} };
            if (!Array.isArray(state.stages[trans.catalogKey].traits)) state.stages[trans.catalogKey].traits = [];
            if (!state.stages[trans.catalogKey].config) state.stages[trans.catalogKey].config = {};
            if (!state.divergent) state.divergent = { trait: "", config: {} };
            mutator(state);
            await actorRef.update({ "system.transformationMeta.metaTraitState": state });
          };
          const stageLimits = { full_suppression: 1, limited_suppression: 2, partial_suppression: 3, true_form: 4 };
          const emperorB = actorRef.system.transformationMeta?.mutationState?.emperorExtraMetaTrait ? 1 : 0;
          const limitNow = stageLimits[trans.catalogKey] + emperorB;
          const forcedNow = trans.catalogKey === "true_form" ? ["meta_bio_suit", "meta_redirected_energy"] : [];

          dialogHtml.on("change", ".mut-meta-trait", async (ev) => {
            const traitId = ev.currentTarget.dataset.name;
            await _mtSave(state => {
              const stage = state.stages[trans.catalogKey];
              // Keep forced traits always present
              for (const f of forcedNow) if (!stage.traits.includes(f)) stage.traits.push(f);
              if (ev.currentTarget.checked) {
                if (stage.traits.length < limitNow && !stage.traits.includes(traitId)) stage.traits.push(traitId);
              } else if (!forcedNow.includes(traitId)) {
                const i = stage.traits.indexOf(traitId);
                if (i >= 0) stage.traits.splice(i, 1);
              }
            });
            _mtReopen();
          });
          dialogHtml.on("change", ".mut-meta-option", async (ev) => {
            const traitId = ev.currentTarget.dataset.traitId;
            await _mtSave(state => {
              const cfg = state.stages[trans.catalogKey].config;
              cfg[traitId] = { ...(cfg[traitId] || {}), option: ev.currentTarget.value };
            });
          });
          dialogHtml.on("change", ".mut-meta-bestial", async (ev) => {
            const traitId = ev.currentTarget.dataset.traitId;
            await _mtSave(state => {
              const cfg = state.stages[trans.catalogKey].config;
              cfg[traitId] = { ...(cfg[traitId] || {}), bestialTrait: ev.currentTarget.value };
            });
          });
          dialogHtml.on("change", ".mut-divergent-meta", async (ev) => {
            await _mtSave(state => { state.divergent.trait = ev.currentTarget.value; });
            _mtReopen();
          });
          dialogHtml.on("change", ".mut-divergent-meta-option", async (ev) => {
            await _mtSave(state => { state.divergent.config = { ...(state.divergent.config || {}), option: ev.currentTarget.value }; });
          });
          dialogHtml.on("change", ".mut-divergent-meta-bestial", async (ev) => {
            await _mtSave(state => { state.divergent.config = { ...(state.divergent.config || {}), bestialTrait: ev.currentTarget.value }; });
          });
        }

        // === DRAGON FORCE: Draconization bestial selection handler ===
        if (trans.catalogKey === "dragon_force") {
          dialogHtml.on("change", ".mut-df-bestial", async (ev) => {
            const id = ev.currentTarget.value;
            const ms = foundry.utils.deepClone(actorRef.system.transformationMeta?.mutationState || {});
            ms.dragonForceBestialTraits = id ? [id] : [];
            // Fixed options per Draconization: Movement→Wings, Build→Thick Hide
            ms.bestialTraitConfig = ms.bestialTraitConfig || {};
            if (id === "bestial_movement") ms.bestialTraitConfig[id] = { ...(ms.bestialTraitConfig[id] || {}), option: "wings" };
            if (id === "bestial_build") ms.bestialTraitConfig[id] = { ...(ms.bestialTraitConfig[id] || {}), option: "thick_hide" };
            await actorRef.update({ "system.transformationMeta.mutationState": ms });
          });
        }

        // === MONSTER FORM: Monster Trait + Bestial Monster handlers ===
        if (trans.catalogKey === "monster_form") {
          const _mfReopen = () => { dialog.close(); this._onViewTransformationTraits(event); };
          const mfLimitNow = trans.mastered ? 3 : 2;
          dialogHtml.on("change", ".mut-mf-monster", async (ev) => {
            const name = ev.currentTarget.dataset.name;
            const ms = foundry.utils.deepClone(actorRef.system.transformationMeta?.mutationState || {});
            let arr = Array.isArray(ms.monsterFormMonsterTraits) ? ms.monsterFormMonsterTraits : [];
            if (ev.currentTarget.checked) {
              if (arr.length >= mfLimitNow) { ev.currentTarget.checked = false; return; }
              if (!arr.includes(name)) arr.push(name);
            } else {
              arr = arr.filter(x => x !== name);
              if (name === "Bestial Monster") ms.monsterFormBestialTraits = [];
            }
            ms.monsterFormMonsterTraits = arr;
            await actorRef.update({ "system.transformationMeta.mutationState": ms });
            _mfReopen();
          });
          dialogHtml.on("change", ".mut-mf-bestial", async (ev) => {
            const id = ev.currentTarget.value;
            const ms = foundry.utils.deepClone(actorRef.system.transformationMeta?.mutationState || {});
            ms.monsterFormBestialTraits = id ? [id] : [];
            await actorRef.update({ "system.transformationMeta.mutationState": ms });
            _mfReopen();
          });
          dialogHtml.on("change", ".mut-bestial-option", async (ev) => {
            const traitId = ev.currentTarget.dataset.traitId;
            const ms = foundry.utils.deepClone(actorRef.system.transformationMeta?.mutationState || {});
            const cfg = { ...(ms.bestialTraitConfig || {}) };
            cfg[traitId] = { ...(cfg[traitId] || {}), option: ev.currentTarget.value };
            ms.bestialTraitConfig = cfg;
            await actorRef.update({ "system.transformationMeta.mutationState": ms });
          });
        }

        // === CYBERNETIC ENHANCEMENT: trait selection handlers ===
        if (trans.catalogKey === "cybernetic_enhancement") {
          const _cyReopen = () => { dialog.close(); this._onViewTransformationTraits(event); };
          const _cySave = async (mutator) => {
            const state = foundry.utils.deepClone(actorRef.system.transformationMeta?.cyberneticState || {});
            if (!Array.isArray(state.traits)) state.traits = [];
            if (!state.config) state.config = {};
            mutator(state);
            await actorRef.update({ "system.transformationMeta.cyberneticState": state });
          };
          const cyLimitNow = 3 + 2 * (Math.min(3, Math.max(1, parseInt(String(trans.gradeOrStacks ?? "").replace(/[^\d]/g, ""), 10) || 1)) - 1);

          dialogHtml.on("change", ".mut-cyber-trait", async (ev) => {
            const traitId = ev.currentTarget.dataset.name;
            await _cySave(state => {
              const arr = state.traits;
              if (ev.currentTarget.checked) {
                if (arr.length < cyLimitNow && !arr.includes(traitId)) arr.push(traitId);
              } else {
                const i = arr.indexOf(traitId);
                if (i >= 0) arr.splice(i, 1);
                // NOTE: orphaned config entries are harmless (only read while chosen);
                // deleting keys from ObjectField clones doesn't persist anyway.
              }
            });
            _cyReopen();
          });

          dialogHtml.on("change", ".mut-cyber-attr", async (ev) => {
            const traitId = ev.currentTarget.dataset.traitId;
            const attr = ev.currentTarget.value;
            await _cySave(state => {
              state.config[traitId] = { ...(state.config[traitId] || {}), attribute: attr };
            });
          });
        }

        // === MUTATION: Born with Power handlers ===
        if (trans.catalogKey === "mutation") {
          const bwpInputs = dialogHtml.find('.mutation-bwp-input');
          const totalDisplay = dialogHtml.find('.bwp-total-display');

          const updateBWPTotal = () => {
            let total = 0;
            bwpInputs.each(function() {
              // FO/MA are linked — only count FO, skip MA to avoid double-counting
              if (this.dataset.attr === 'ma') return;
              total += parseInt(this.value) || 0;
            });
            totalDisplay.text(total);
            totalDisplay.css('color', total > 6 ? '#e53935' : (total === 6 ? '#4caf50' : ''));
          };
          updateBWPTotal();

          bwpInputs.on('change', async (ev) => {
            const attr = ev.currentTarget.dataset.attr;
            let val = Math.max(0, Math.min(2, parseInt(ev.currentTarget.value) || 0));
            ev.currentTarget.value = val;

            // FO/MA linkage
            if (attr === 'fo') {
              dialogHtml.find('[data-attr="ma"]').val(val);
            } else if (attr === 'ma') {
              dialogHtml.find('[data-attr="fo"]').val(val);
            }
            updateBWPTotal();

            // Save distribution to actor
            const newBonuses = {};
            bwpInputs.each(function() {
              const v = parseInt(this.value) || 0;
              newBonuses[this.dataset.attr] = v > 0 ? `+${v}` : "–";
            });
            // Re-read FO/MA linkage to ensure sync
            const foVal = parseInt(dialogHtml.find('[data-attr="fo"]').val()) || 0;
            newBonuses.fo = foVal > 0 ? `+${foVal}` : "–";
            newBonuses.ma = foVal > 0 ? `+${foVal}` : "–";

            const transArr = foundry.utils.deepClone(actorRef.system.transformations || []);
            const tIdx = transArr.findIndex(t => t.id === trans.id);
            if (tIdx >= 0) {
              transArr[tIdx].attrBonuses = newBonuses;
              await actorRef.update({ "system.transformations": transArr });
            }
          });

          // Mutation Trait dropdown
          dialogHtml.on("change", ".mutation-trait-select", async (ev) => {
            const traitId = ev.currentTarget.value;
            const idx = ev.currentTarget.dataset.transIndex;
            const selections = foundry.utils.deepClone(actorRef.system.transformationOptionSelections || {});
            if (!selections[idx]) selections[idx] = {};
            selections[idx].mutationTrait = traitId;
            await actorRef.update({ "system.transformationOptionSelections": selections });
            dialog.close();
            this._onViewTransformationTraits(event);
          });

          // === MUTATION SUB-SELECTION HANDLERS ===
          const _mutSave = async (updater) => {
            const meta = foundry.utils.deepClone(actorRef.system.transformationMeta || {});
            if (!meta.mutationState) meta.mutationState = {};
            updater(meta.mutationState);
            await actorRef.update({ "system.transformationMeta": meta });
          };
          const _mutReopen = () => { dialog.close(); this._onViewTransformationTraits(event); };

          // Were-creature: option dropdown
          dialogHtml.on("change", ".mut-wc-option", async (ev) => {
            await _mutSave(ms => {
              ms.wereCreatureOption = ev.currentTarget.value;
              if (ev.currentTarget.value !== "traditional") ms.wereCreatureAttributes = [];
            });
            _mutReopen();
          });
          // Were-creature: bestial traits (stores catalog IDs, normalizes legacy names)
          dialogHtml.on("change", ".mut-wc-bestial", async (ev) => {
            const traitId = ev.currentTarget.dataset.name;
            await _mutSave(ms => {
              const _catalog = CONFIG.DBU?.bestialTraitsCatalog || [];
              const _nmap = {};
              for (const t of _catalog) _nmap[t.name] = t.id;
              const _validIds = new Set(_catalog.map(t => t.id));
              const _norm = (v) => v?.startsWith("bestial_") ? v : (_nmap[v] || null);
              const arr = (Array.isArray(ms.wereCreatureBestialTraits) ? ms.wereCreatureBestialTraits : []).map(_norm).filter(id => id && _validIds.has(id));
              if (ev.currentTarget.checked) { if (arr.length < 2 && !arr.includes(traitId)) arr.push(traitId); }
              else {
                const i = arr.indexOf(traitId); if (i >= 0) arr.splice(i, 1);
                // Remove option config when unchecking
                if (ms.bestialTraitConfig?.[traitId]) {
                  const cfg = { ...ms.bestialTraitConfig };
                  delete cfg[traitId];
                  ms.bestialTraitConfig = cfg;
                }
              }
              ms.wereCreatureBestialTraits = arr;
            });
            _mutReopen();
          });
          // Were-creature: attribute bonuses
          dialogHtml.on("change", ".mut-wc-attr", async (ev) => {
            const attr = ev.currentTarget.dataset.attr;
            await _mutSave(ms => {
              const arr = Array.isArray(ms.wereCreatureAttributes) ? [...ms.wereCreatureAttributes] : [];
              if (ev.currentTarget.checked) { if (arr.length < 2 && !arr.includes(attr)) arr.push(attr); }
              else { const i = arr.indexOf(attr); if (i >= 0) arr.splice(i, 1); }
              ms.wereCreatureAttributes = arr;
            });
            _mutReopen();
          });
          // Were-creature: active toggle
          dialogHtml.on("change", ".mut-wc-active", async (ev) => {
            await _mutSave(ms => { ms.wereCreatureActive = ev.currentTarget.checked; });
          });

          // Dark Vassal: bestial traits (stores catalog IDs, normalizes legacy names)
          dialogHtml.on("change", ".mut-dv-bestial", async (ev) => {
            const traitId = ev.currentTarget.dataset.name;
            await _mutSave(ms => {
              const _catalog = CONFIG.DBU?.bestialTraitsCatalog || [];
              const _nmap = {};
              for (const t of _catalog) _nmap[t.name] = t.id;
              const _validIds = new Set(_catalog.map(t => t.id));
              const _norm = (v) => v?.startsWith("bestial_") ? v : (_nmap[v] || null);
              const arr = (Array.isArray(ms.darkVassalBestialTraits) ? ms.darkVassalBestialTraits : []).map(_norm).filter(id => id && _validIds.has(id));
              if (ev.currentTarget.checked) { if (arr.length < 2 && !arr.includes(traitId)) arr.push(traitId); }
              else {
                const i = arr.indexOf(traitId); if (i >= 0) arr.splice(i, 1);
                if (ms.bestialTraitConfig?.[traitId]) {
                  const cfg = { ...ms.bestialTraitConfig };
                  delete cfg[traitId];
                  ms.bestialTraitConfig = cfg;
                }
              }
              ms.darkVassalBestialTraits = arr;
            });
            _mutReopen();
          });

          // Bestial trait option selection (shared by Were-creature and Dark Vassal)
          dialogHtml.on("change", ".mut-bestial-option", async (ev) => {
            const traitId = ev.currentTarget.dataset.traitId;
            const optionValue = ev.currentTarget.value;
            await _mutSave(ms => {
              const cfg = { ...(ms.bestialTraitConfig || {}) };
              if (optionValue) {
                cfg[traitId] = { ...(cfg[traitId] || {}), option: optionValue };
              } else if (cfg[traitId]) {
                delete cfg[traitId].option;
              }
              ms.bestialTraitConfig = cfg;
            });
          });

          // Dark Evolution: monster traits
          dialogHtml.on("change", ".mut-de-monster", async (ev) => {
            const name = ev.currentTarget.dataset.name;
            await _mutSave(ms => {
              const arr = Array.isArray(ms.darkEvolutionMonsterTraits) ? [...ms.darkEvolutionMonsterTraits] : [];
              if (ev.currentTarget.checked) { if (arr.length < 2 && !arr.includes(name)) arr.push(name); }
              else {
                const i = arr.indexOf(name); if (i >= 0) arr.splice(i, 1);
                if (name === "Bestial Monster") ms.darkEvolutionBestialTraits = [];
              }
              ms.darkEvolutionMonsterTraits = arr;
            });
            _mutReopen();
          });
          dialogHtml.on("change", ".mut-de-bestial", async (ev) => {
            const id = ev.currentTarget.value;
            await _mutSave(ms => { ms.darkEvolutionBestialTraits = id ? [id] : []; });
            _mutReopen();
          });

          // DNA Absorption: active stack radio
          dialogHtml.on("change", ".mut-dna-active-radio", async (ev) => {
            const idx = parseInt(ev.currentTarget.value);
            await _mutSave(ms => { ms.activeDnaStackIndex = idx; });
          });
          // DNA Absorption: stack name
          dialogHtml.on("change", ".mut-dna-name", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.stackIdx);
            await _mutSave(ms => {
              if (!Array.isArray(ms.dnaStacks)) ms.dnaStacks = [];
              if (ms.dnaStacks[i]) ms.dnaStacks[i].name = ev.currentTarget.value;
            });
          });
          // DNA Absorption: stack attribute
          dialogHtml.on("change", ".mut-dna-attr", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.stackIdx);
            const attr = ev.currentTarget.dataset.attr;
            const val = Math.max(0, parseInt(ev.currentTarget.value) || 0);
            await _mutSave(ms => {
              if (!Array.isArray(ms.dnaStacks)) ms.dnaStacks = [];
              if (ms.dnaStacks[i]) {
                if (!ms.dnaStacks[i].attributes) ms.dnaStacks[i].attributes = {};
                ms.dnaStacks[i].attributes[attr] = val;
              }
            });
          });
          // DNA Absorption: add stack
          dialogHtml.on("click", ".mut-dna-add", async (ev) => {
            await _mutSave(ms => {
              if (!Array.isArray(ms.dnaStacks)) ms.dnaStacks = [];
              if (ms.dnaStacks.length < 3) ms.dnaStacks.push({ name: "", attributes: {ag:0,fo:0,te:0,sc:0,in:0,ma:0,pe:0} });
            });
            _mutReopen();
          });
          // DNA Absorption: remove stack
          dialogHtml.on("click", ".mut-dna-remove", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.stackIdx);
            await _mutSave(ms => {
              if (Array.isArray(ms.dnaStacks)) ms.dnaStacks.splice(i, 1);
              if (typeof ms.activeDnaStackIndex === "number") {
                if (ms.activeDnaStackIndex === i) ms.activeDnaStackIndex = -1;
                else if (ms.activeDnaStackIndex > i) ms.activeDnaStackIndex -= 1;
              }
            });
            _mutReopen();
          });

          // OG Soldier: active copy radio
          dialogHtml.on("change", ".mut-og-active-radio", async (ev) => {
            const idx = parseInt(ev.currentTarget.value);
            await _mutSave(ms => { ms.ogSoldierActiveCopyIndex = idx; });
          });
          // OG Soldier: copy name
          dialogHtml.on("change", ".mut-og-name", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.copyIdx);
            await _mutSave(ms => {
              if (!Array.isArray(ms.ogSoldierCopies)) ms.ogSoldierCopies = [];
              if (ms.ogSoldierCopies[i]) ms.ogSoldierCopies[i].name = ev.currentTarget.value;
            });
          });
          // OG Soldier: actions spent
          dialogHtml.on("change", ".mut-og-actions-input", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.copyIdx);
            const val = Math.max(0, Math.min(9, parseInt(ev.currentTarget.value) || 0));
            ev.currentTarget.value = val;
            await _mutSave(ms => {
              if (!Array.isArray(ms.ogSoldierCopies)) ms.ogSoldierCopies = [];
              if (ms.ogSoldierCopies[i]) ms.ogSoldierCopies[i].actionsSpent = val;
            });
          });
          // OG Soldier: add copy
          dialogHtml.on("click", ".mut-og-add", async (ev) => {
            await _mutSave(ms => {
              if (!Array.isArray(ms.ogSoldierCopies)) ms.ogSoldierCopies = [];
              if (ms.ogSoldierCopies.length < 3) ms.ogSoldierCopies.push({ name: "", actionsSpent: 0 });
            });
            _mutReopen();
          });
          // OG Soldier: remove copy
          dialogHtml.on("click", ".mut-og-remove", async (ev) => {
            const i = parseInt(ev.currentTarget.dataset.copyIdx);
            await _mutSave(ms => {
              if (Array.isArray(ms.ogSoldierCopies)) ms.ogSoldierCopies.splice(i, 1);
              if (typeof ms.ogSoldierActiveCopyIndex === "number") {
                if (ms.ogSoldierActiveCopyIndex === i) ms.ogSoldierActiveCopyIndex = -1;
                else if (ms.ogSoldierActiveCopyIndex > i) ms.ogSoldierActiveCopyIndex -= 1;
              }
            });
            _mutReopen();
          });

          // Biodiversity: trait text input
          dialogHtml.on("change", ".mut-bio-trait", async (ev) => {
            await _mutSave(ms => {
              if (!ms.additionalTraitSelections) ms.additionalTraitSelections = {};
              ms.additionalTraitSelections.biodiversity = ev.currentTarget.value;
            });
          });

          // Spreading Shadow: option text input
          dialogHtml.on("change", ".mut-ss-option", async (ev) => {
            await _mutSave(ms => {
              if (!ms.additionalTraitSelections) ms.additionalTraitSelections = {};
              ms.additionalTraitSelections.spreadingShadow = ev.currentTarget.value;
            });
          });

          // Custom Mutation: trait text input
          dialogHtml.on("change", ".mut-cm-trait", async (ev) => {
            await _mutSave(ms => {
              if (!ms.additionalTraitSelections) ms.additionalTraitSelections = {};
              ms.additionalTraitSelections.customMutation = ev.currentTarget.value;
            });
          });
          // Custom Mutation: flaw checkbox
          dialogHtml.on("change", ".mut-cm-flaw", async (ev) => {
            await _mutSave(ms => {
              if (!ms.additionalTraitSelections) ms.additionalTraitSelections = {};
              ms.additionalTraitSelections.customMutationFlaw = ev.currentTarget.checked;
            });
          });
        }

        // === PURE RESOLVE: AMB choice handlers ===
        if (trans.catalogKey === "pure_resolve") {
          dialogHtml.on("change", ".pure-resolve-amb-select", async (ev) => {
            const slot = parseInt(ev.currentTarget.dataset.ambSlot);
            const val = ev.currentTarget.value;
            const selections = foundry.utils.deepClone(actorRef.system.transformationOptionSelections || {});
            const idx = ev.currentTarget.dataset.transIndex;
            if (!selections[idx]) selections[idx] = {};
            const chosen = Array.isArray(selections[idx].pureResolveChosenAttrs)
              ? [...selections[idx].pureResolveChosenAttrs] : ["", ""];

            // Validate: can't pick both FO and MA
            const otherSlot = slot === 0 ? 1 : 0;
            if ((val === "fo" && chosen[otherSlot] === "ma") || (val === "ma" && chosen[otherSlot] === "fo")) {
              ui.notifications.warn("Pure Resolve: You cannot select both Force and Magic.");
              ev.currentTarget.value = chosen[slot] || "";
              return;
            }
            // Validate: can't pick same attr in both slots
            if (val && val === chosen[otherSlot]) {
              ui.notifications.warn("Pure Resolve: You must select two different attributes.");
              ev.currentTarget.value = chosen[slot] || "";
              return;
            }

            chosen[slot] = val;
            selections[idx].pureResolveChosenAttrs = chosen;
            await actorRef.update({ "system.transformationOptionSelections": selections });
            dialog.close();
            this._onViewTransformationTraits(event);
          });
        }

        // Option select handler
        dialogHtml.on("change", ".tf-option-select", async (ev) => {
          const key = ev.currentTarget.dataset.effectKey;
          const idx = ev.currentTarget.dataset.transIndex;
          const selections = foundry.utils.deepClone(actorRef.system.transformationOptionSelections || {});
          if (!selections[idx]) selections[idx] = {};
          selections[idx][key] = ev.currentTarget.value;
          await actorRef.update({ "system.transformationOptionSelections": selections });
          dialog.close();
          this._onViewTransformationTraits(event);
        });

        // Multi-option checkbox handler
        dialogHtml.on("change", ".tf-option-checkbox", async (ev) => {
          const { transIndex: idx, effectKey: key, optionName, maxOptions } = ev.currentTarget.dataset;
          const selections = foundry.utils.deepClone(actorRef.system.transformationOptionSelections || {});
          if (!selections[idx]) selections[idx] = {};
          let current = selections[idx][key];
          if (!Array.isArray(current)) current = current ? [current] : [];
          const max = maxOptions ? Number(maxOptions) : Infinity;
          if (ev.currentTarget.checked) {
            if (current.length < max && !current.includes(optionName)) current.push(optionName);
            else { ev.currentTarget.checked = false; return; }
          } else {
            current = current.filter(n => n !== optionName);
          }
          selections[idx][key] = current;
          await actorRef.update({ "system.transformationOptionSelections": selections });
          dialog.close();
          this._onViewTransformationTraits(event);
        });
      }
    }, { width: 650, height: 500, classes: ["dbu-old", "tf-traits-window"] });
    dialog.render(true);
  },

  // -------------------------------------------------------
  // Legendary Trait Selection
  // -------------------------------------------------------

  /**
   * Handle changing a Legendary Trait selection dropdown.
   */
  async _onLegendaryTraitSelect(event) {
    const select = event.currentTarget;
    const catalogKey = select.dataset.catalogKey;
    const value = select.value;
    const selections = foundry.utils.deepClone(this.actor.system.transformationMeta?.legendaryTraitSelections || {});
    selections[catalogKey] = value;
    await this.actor.update({ "system.transformationMeta.legendaryTraitSelections": selections });
  },
};
