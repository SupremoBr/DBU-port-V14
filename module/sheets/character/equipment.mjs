import { Dialog } from "../../helpers/foundry-compat.mjs";
import { weaponLifeMax } from "../../helpers/weapon-state.mjs";

/** Character sheet domain: equipment. Methods run with the sheet as this. */
export const equipmentMethods = {

  _prepareItems(context) {
    const apparel = [];
    const weapons = [];
    const accessories = [];
    const basicItems = [];
    const worn = [];

    for (const item of this.actor.items) {
      if (item.type !== "equipment") continue;
      const eqType = item.system.equipmentType || "apparel";
      if (eqType === "weapon") weapons.push(item);
      else if (eqType === "accessory") accessories.push(item);
      else if (eqType === "basicItem") basicItems.push(item);
      else apparel.push(item);

      if (item.system.worn) worn.push(item);
    }

    apparel.sort((a, b) => a.name.localeCompare(b.name));
    weapons.sort((a, b) => a.name.localeCompare(b.name));
    accessories.sort((a, b) => a.name.localeCompare(b.name));
    basicItems.sort((a, b) => a.name.localeCompare(b.name));

    // Enrich apparel + weapon items with qualities CRUD data
    if (!this._expandedQualityCards) this._expandedQualityCards = new Set();
    for (const item of [...apparel, ...weapons]) {
      this._enrichItemQualities(item);
    }
    // Expose dynamic Break Value max to apparel cards (used by inventory input).
    for (const item of apparel) {
      item.bvMax = this._calcBreakValueMax(item);
    }

    // Weapon durability (weapons.txt "Damaging Weapons" / "Hardness Value"):
    // LP max = 32 + 8 per Power Level beyond the 1st (+2×PL with Durable),
    // DR 6(bT), Hardness 3 (4 with Super Heavy). Broken at 0 LP.
    const wLevel = this.actor.system.level || 1;
    const wBaseTier = this.actor.system.baseTier || 1;
    for (const item of weapons) {
      const qKeys = (item.system.qualities || []).map(q => q.qualityKey);
      const hasDurable = qKeys.includes("durable");
      item._wUnbreakable = qKeys.includes("unbreakable");
      item._wHasSpecial = (item.system.qualities || []).some(q =>
        CONFIG.DBU?.weaponQualities?.[q.qualityKey]?.isSpecial);
      item._wLpMax = 32 + 8 * (wLevel - 1) + (hasDurable ? 2 * wLevel : 0);
      item._wLpCurrent = item._wUnbreakable
        ? item._wLpMax
        : Math.max(0, item._wLpMax - (item.system.weaponLPDamage || 0));
      item._wBroken = !item._wUnbreakable && item._wLpCurrent <= 0;
      item._wHardness = qKeys.includes("super_heavy") ? 4 : (item.system.weaponHardness ?? 3);
      item._wDR = 6 * wBaseTier;
    }

    // Enrich Basic Items with catalog entry data (catalogName, isTech, isSpecial,
    // craftDC label, catalogDescription, catalogEffects). Unknown key → custom item.
    const basicCatalog = CONFIG.DBU?.basicItemsCatalog || {};
    const dcLabels = CONFIG.DBU?.craftDCLabels || {};
    for (const item of basicItems) {
      const key = item.system.basicItemKey || "";
      const entry = key ? basicCatalog[key] : null;
      item._catalogEntry = entry || null;
      item._isCustomBasic = !entry;
      item._catalogName = entry ? entry.name : "";
      item._isTech = entry ? !!entry.isTech : false;
      item._isSpecial = entry ? !!entry.isSpecial : false;
      item._craftDCLabel = entry ? (dcLabels[entry.craftDC] || entry.craftDC) : "";
      item._catalogDescription = entry ? entry.description : "";
      item._catalogEffects = entry ? entry.effects : "";
    }
    // Catalog options for the dropdown selector (grouped: standard then special).
    const allCatalogEntries = Object.values(basicCatalog);
    context.basicItemCatalogOptions = {
      standard: allCatalogEntries.filter(e => !e.isSpecial).sort((a, b) => a.name.localeCompare(b.name)),
      special: allCatalogEntries.filter(e => e.isSpecial).sort((a, b) => a.name.localeCompare(b.name))
    };

    context.apparelItems = apparel;
    context.weaponItems = weapons;
    context.accessoryItems = accessories;
    context.basicItems = basicItems;
    context.wornApparel = worn;
    context.equipmentItems = [...apparel, ...weapons, ...accessories, ...basicItems];

    // Layer System data preparation
    const system = this.actor.system;
    const slots = system.wornApparelSlots || {};
    const layers = [
      { key: "topLayer", label: "Top Layer" },
      { key: "middleLayer", label: "Middle Layer" },
      { key: "bottomLayer", label: "Bottom Layer" }
    ];
    const accSlots = [
      { key: "accessory1", label: "Accessory 1" },
      { key: "accessory2", label: "Accessory 2" }
    ];
    context.wornLayers = layers.map(l => {
      const itemId = slots[l.key] || "";
      const item = itemId ? this.actor.items.get(itemId) : null;
      return {
        key: l.key, label: l.label, assignedId: itemId, assigned: !!item,
        categoryName: item ? (CONFIG.DBU.apparelCategories?.[item.system.apparelCategory]?.name || "") : "",
        benefit: item ? this._calcApparelBenefitLabel(item) : "",
        bvCurrent: item ? (item.system.breakValueCurrent ?? this._calcBreakValueMax(item)) : "",
        bvMax: item ? this._calcBreakValueMax(item) : "",
        doffStatus: item ? (item.system.doffUsed ? "Used" : "Available") : "",
        gradeLabel: item ? this._getGradeLabel(item) : "",
        qualitiesSummary: item ? (item.system.qualities || []).map(q => CONFIG.DBU.apparelQualities?.[q.qualityKey]?.name || q.qualityKey).join(", ") : "",
        isSelected: system.selectedWornLayer === l.key
      };
    });
    context.accessorySlots = accSlots.map(a => {
      const itemId = slots[a.key] || "";
      const item = itemId ? this.actor.items.get(itemId) : null;
      return {
        key: a.key, label: a.label, assignedId: itemId, assigned: !!item,
        name: item?.name || "", effect: item?.system.description || ""
      };
    });
    context.apparelOptions = apparel.map(i => ({ id: i._id, name: i.name }));
    context.accessoryOptions = accessories.map(i => ({ id: i._id, name: i.name }));
    context.equipment = system.equipment || {};

    // Battle Uniform Detail
    if (system.selectedWornLayer) {
      const detailItemId = slots[system.selectedWornLayer];
      const detailItem = detailItemId ? this.actor.items.get(detailItemId) : null;
      if (detailItem) {
        const config = CONFIG.DBU ?? {};
        const catEffect = config.apparelCategories?.[detailItem.system.apparelCategory] || {};
        const slotsMax = config.craftsmanshipGrades?.[detailItem.system.craftsmanshipGrade || 1]?.qualitySlots || 0;
        const quals = (detailItem.system.qualities || []).map((q, idx) => {
          const qData = config.apparelQualities?.[q.qualityKey] || {};
          return {
            name: qData.name || q.qualityKey,
            notes: q.notes || "",
            effect: qData.effect || "",
            slotsUsed: q.slotsUsed || (Array.isArray(qData.slots) ? qData.slots[0] : qData.slots || 1)
          };
        });
        const slotsUsed = quals.reduce((sum, q) => sum + q.slotsUsed, 0);
        const availQualities = Object.values(config.apparelQualities || {})
          .filter(q => q.categories?.includes(detailItem.system.apparelCategory))
          .filter(q => !(detailItem.system.qualities || []).some(eq => eq.qualityKey === q.id));
        context.battleUniformDetail = {
          itemId: detailItem._id,
          name: detailItem.name,
          categoryName: catEffect.name || "",
          categoryEffect: catEffect.effect || "",
          gradeLabel: this._getGradeLabel(detailItem),
          apparelBonus: this.actor._calcApparelBonus(detailItem),
          bvCurrent: detailItem.system.breakValueCurrent ?? this._calcBreakValueMax(detailItem),
          bvMax: this._calcBreakValueMax(detailItem),
          doffBonus: this._calcDoffBonus(detailItem),
          doffStatus: detailItem.system.doffUsed ? "Used" : "Available",
          slotsUsed, slotsMax,
          qualities: quals,
          canAddQuality: slotsUsed < slotsMax,
          availableQualities: availQualities
        };
      }
    }
  },

  // ---- Equipment Layer Helpers ----

  _calcApparelBenefitLabel(item) {
    const bonus = this.actor._calcApparelBonus(item);
    switch (item.system.apparelCategory) {
      case "armor": return `DR +${bonus}`;
      case "weights": return `-${bonus} Combat`;
      case "combat_clothing": return `+${Math.ceil(bonus / 2)} Defense`;
      case "standard_clothing": return "No penalty";
      default: return "";
    }
  },

  _calcBreakValueMax(item) {
    // apparel.txt:13 — "All pieces of Apparel by default have a Break Value of 3"
    // apparel.txt:82 (Durable quality) — "Increase the maximum Break Value for this piece of Apparel by 3"
    // Craftsmanship Grade affects Craft DC, NOT Break Value.
    const quals = item.system.qualities || [];
    let bv = 3;
    if (quals.some(q => q.qualityKey === "durable")) bv += 3;
    return bv;
  },

  _calcDoffBonus(item) {
    const bonus = this.actor._calcApparelBonus(item);
    return Math.ceil(bonus / 2);
  },

  _getGradeLabel(item) {
    const config = CONFIG.DBU ?? {};
    const gradeData = config.craftsmanshipGrades?.[item.system.craftsmanshipGrade || 1] || {};
    return config.apparelGrades?.[gradeData.apparelGrade || "low"]?.name || "Low";
  },

  // ---- Equipment Item Qualities CRUD Helpers ----

  /**
   * Enrich an apparel/weapon item with `qualitiesEnriched`, `availableStandard`,
   * `availableSpecial`, and `expanded` for use in the equipment cards UI.
   */
  _enrichItemQualities(item) {
    const isApparel = item.system.equipmentType === "apparel";
    const catalog = isApparel
      ? (CONFIG.DBU?.apparelQualities || {})
      : (CONFIG.DBU?.weaponQualities || {});
    const sys = this.actor.system;

    item.qualitiesEnriched = (item.system.qualities || []).map((q, idx) => {
      const cat = catalog[q.qualityKey] || {};
      return {
        ...q,
        itemId: item._id,
        qIdx: idx,
        catalogName: cat.name || q.qualityKey,
        description: cat.description || "",
        isSpecial: !!cat.isSpecial,
        configFields: (cat.config || []).map(cfg => ({
          ...cfg,
          currentValue: q.config?.[cfg.key] ?? "",
          resolvedOptions: this._resolveQualityConfigOptions(cfg, sys)
        }))
      };
    });

    const usedKeys = new Set((item.system.qualities || []).map(q => q.qualityKey));
    const itemCatKey = isApparel ? item.system.apparelCategory : item.system.weaponType;
    const isCompatible = (q) => {
      if (!Array.isArray(q.compatibility)) return false;
      if (q.compatibility.includes("any")) return true;
      return q.compatibility.includes(itemCatKey);
    };
    item.availableStandard = Object.values(catalog)
      .filter(q => !q.isSpecial && isCompatible(q) && !usedKeys.has(q.id));
    item.availableSpecial = Object.values(catalog)
      .filter(q => q.isSpecial && !usedKeys.has(q.id));

    item.expanded = this._expandedQualityCards?.has(item._id) || false;
  },

  /**
   * Resolve the option list for a quality config field based on its type.
   * Supports: choice, text (returns []), skill, weaponCategory, alignment.
   */
  _resolveQualityConfigOptions(cfg, system) {
    if (cfg.type === "choice") return cfg.options || [];
    if (cfg.type === "alignment") {
      return [
        { value: "",     label: "-- Select --" },
        { value: "good", label: "Good/Pure Good" },
        { value: "evil", label: "Evil/Pure Evil" }
      ];
    }
    if (cfg.type === "skill") {
      // Source of truth: CONFIG.DBU.skillsData (legacy IDs: science, use_magic, crafting, etc.)
      const skillsData = CONFIG.DBU?.skillsData || [];
      const opts = [{ value: "", label: "-- Select Skill --" }];
      for (const def of skillsData) {
        if (cfg.attribute && def.attribute !== cfg.attribute) continue;
        opts.push({ value: def.id, label: def.name });
      }
      return opts;
    }
    if (cfg.type === "weaponCategory") {
      const PHYSICAL = ["bludgeoning", "slashing", "piercing", "shield"];
      const ENERGY   = ["pinpoint", "high_power"];
      const MAGIC    = ["magic_staff", "elemental_tool", "magic_orb"];
      let cats;
      if (cfg.subset === "physical") cats = PHYSICAL;
      else if (cfg.subset === "energy") cats = ENERGY;
      else if (cfg.subset === "magic") cats = MAGIC;
      else cats = [...PHYSICAL, ...ENERGY, ...MAGIC];
      const opts = [{ value: "", label: "-- Select Category --" }];
      for (const c of cats) {
        opts.push({ value: c, label: c.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase()) });
      }
      return opts;
    }
    return [];
  },

  // -------------------------------------------------------
  // Equipment Listeners
  // -------------------------------------------------------

  async _onEquipmentWornToggle(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) await item.update({ "system.worn": event.currentTarget.checked });
  },

  async _onEquipmentInlineEdit(event) {
    const el = event.currentTarget;
    const itemId = el.dataset.itemId;
    const field = el.dataset.field;
    if (!itemId || !field) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    let value = el.value;
    if (el.type === "number") value = Number(value) || 0;
    // Handle top-level vs system fields
    if (field === "name") {
      await item.update({ name: value });
    } else {
      await item.update({ [field]: value });
    }
  },

  /** Weapon LP max (weapons.txt): 32 + 8 per Power Level beyond the 1st; Durable adds +2×PL. */
  _calcWeaponLPMax(item) {
    return weaponLifeMax(this.actor.system.level, item.system);
  },

  /** Edit a weapon's current LP (stored as damage taken so max can scale with PL). */
  async _onWeaponLPChange(event) {
    const el = event.currentTarget;
    const item = this.actor.items.get(el.dataset.itemId);
    if (!item) return;
    if ((item.system.qualities || []).some(q => q.qualityKey === "unbreakable")) {
      ui.notifications.warn("Unbreakable: this Weapon's Life Points cannot be reduced.");
      return;
    }
    const max = this._calcWeaponLPMax(item);
    const current = Math.max(0, Math.min(max, Number(el.value) || 0));
    await item.update({ "system.weaponLPDamage": max - current });
    if (current <= 0) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-heart-broken"></i> ${item.name} — BROKEN</b><br>Its Life Points were reduced to 0: it cannot be used for any Attacking Maneuvers until repaired.</div>`
      });
    }
  },

  /** Repairing Weapons (weapons.txt): 1 hour outside combat + Weapon Craft check restores the weapon. */
  async _onWeaponRepair(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    const hasSpecial = (item.system.qualities || []).some(q =>
      CONFIG.DBU?.weaponQualities?.[q.qualityKey]?.isSpecial);
    const dc = hasSpecial ? "Master" : "Qualified";
    const confirmed = await Dialog.confirm({
      title: `Repair ${item.name}`,
      content: `<p>Repairing requires <b>one hour outside of Combat Encounters</b> and a successful <b>${dc} Weapon Craft Skill Check</b>.</p><p>Restore <b>${item.name}</b> to full Life Points?</p>`
    });
    if (!confirmed) return;
    await item.update({ "system.weaponLPDamage": 0 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-size:0.9rem"><b><i class="fas fa-wrench"></i> ${item.name} — Repaired</b><br>Restored to full Life Points (${this._calcWeaponLPMax(item)}) after a successful ${dc} Weapon Craft Skill Check.</div>`
    });
  },

  async _onEquipmentInlineCheck(event) {
    const el = event.currentTarget;
    const itemId = el.dataset.itemId;
    const field = el.dataset.field;
    if (!itemId || !field) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    await item.update({ [field]: el.checked });
  },

  // ---- Equipment Layer Handlers ----

  async _onAssignLayer(event) {
    event.preventDefault();
    const layer = event.currentTarget.dataset.layer;
    const itemId = event.currentTarget.value || "";
    await this.actor.update({ [`system.wornApparelSlots.${layer}`]: itemId });
  },

  async _onToggleDetail(event) {
    event.preventDefault();
    const layer = event.currentTarget.dataset.layer;
    const current = this.actor.system.selectedWornLayer;
    await this.actor.update({ "system.selectedWornLayer": current === layer ? "" : layer });
  },

  async _onAddQuality(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const select = event.currentTarget.closest(".eq-add-quality-row")?.querySelector(".eq-add-quality-select");
    const qualityKey = select?.value;
    if (!qualityKey || !itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const qData = CONFIG.DBU.apparelQualities?.[qualityKey] || {};
    const slotsUsed = Array.isArray(qData.slots) ? qData.slots[0] : (qData.slots || 1);
    const quals = [...(item.system.qualities || []), { qualityKey, notes: "", slotsUsed }];
    await item.update({ "system.qualities": quals });
  },

  async _onRemoveQuality(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const idx = Number(event.currentTarget.dataset.qualityIdx);
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const quals = [...(item.system.qualities || [])];
    quals.splice(idx, 1);
    await item.update({ "system.qualities": quals });
  },

  async _onQualityNotesChange(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const idx = Number(event.currentTarget.dataset.qualityIdx);
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const quals = [...(item.system.qualities || [])];
    if (quals[idx]) quals[idx] = { ...quals[idx], notes: event.currentTarget.value };
    await item.update({ "system.qualities": quals });
  },

  async _onBreakValueChange(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    await item.update({ "system.breakValueCurrent": Number(event.currentTarget.value) });
  },

  // ---- Per-card item quality CRUD handlers ----

  async _onToggleQualityCard(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    if (!itemId) return;
    if (!this._expandedQualityCards) this._expandedQualityCards = new Set();
    if (this._expandedQualityCards.has(itemId)) this._expandedQualityCards.delete(itemId);
    else this._expandedQualityCards.add(itemId);
    this.render(false);
  },

  async _onAddItemQuality(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const itemId = btn.dataset.itemId;
    const isSpecial = btn.dataset.special === "true";
    const selectClass = isSpecial ? ".eq-add-quality-select-special" : ".eq-add-quality-select-standard";
    const row = btn.closest(".eq-add-quality-row");
    const select = row?.querySelector(selectClass);
    const qualityKey = select?.value;
    if (!qualityKey || !itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const isApparel = item.system.equipmentType === "apparel";
    const cat = (isApparel ? CONFIG.DBU.apparelQualities : CONFIG.DBU.weaponQualities)[qualityKey];
    if (!cat) return;
    const newQ = { qualityKey, name: cat.name, notes: "", slotsUsed: 1, ranks: 1, config: {} };
    const quals = [...(item.system.qualities || []), newQ];
    await item.update({ "system.qualities": quals });
  },

  async _onRemoveItemQuality(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const qIdx = Number(event.currentTarget.dataset.qIdx);
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const quals = [...(item.system.qualities || [])];
    quals.splice(qIdx, 1);
    await item.update({ "system.qualities": quals });
  },

  async _onChangeQualityConfig(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const qIdx = Number(event.currentTarget.dataset.qIdx);
    const configKey = event.currentTarget.dataset.configKey;
    const value = event.currentTarget.value;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const quals = foundry.utils.deepClone(item.system.qualities || []);
    if (!quals[qIdx]) return;
    if (!quals[qIdx].config) quals[qIdx].config = {};
    quals[qIdx].config[configKey] = value;
    await item.update({ "system.qualities": quals });
  },

  async _onChangeQualityNotes(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const qIdx = Number(event.currentTarget.dataset.qIdx);
    const value = event.currentTarget.value;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const quals = foundry.utils.deepClone(item.system.qualities || []);
    if (!quals[qIdx]) return;
    quals[qIdx].notes = value;
    await item.update({ "system.qualities": quals });
  },

  // Item CRUD (Equipment)
  // -------------------------------------------------------

  async _onItemCreate(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const type = element.dataset.type || "equipment";
    const eqType = element.dataset.eqType || "apparel";
    const friendly = { apparel: "Apparel", weapon: "Weapon", accessory: "Accessory", basicItem: "Basic Item" }[eqType] || eqType;
    const name = `New ${friendly}`;
    return this.actor.createEmbeddedDocuments("Item", [{ name, type, system: { equipmentType: eqType } }]);
  },

  /**
   * Apply a Basic Items catalog entry to an item — sets the key, renames the item,
   * and copies the catalog's description into system.description so the UI can show it.
   * Triggered by the Basic Item catalog dropdown on each card.
   */
  async _onBasicItemCatalogChange(event) {
    const sel = event.currentTarget;
    const itemId = sel.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const key = sel.value;
    if (!key) {
      await item.update({ "system.basicItemKey": "" });
      return;
    }
    const entry = CONFIG.DBU?.basicItemsCatalog?.[key];
    if (!entry) return;
    await item.update({
      name: entry.name,
      "system.basicItemKey": key,
      "system.description": entry.effects || entry.description || ""
    });
  },

  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) item.sheet.render(true);
  },

  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;
    const confirmed = await Dialog.confirm({
      title: `Delete ${item.name}`,
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
      defaultYes: false
    });
    if (confirmed) return item.delete();
  },
};
