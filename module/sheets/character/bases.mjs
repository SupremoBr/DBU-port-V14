

/** Character sheet domain: bases. Methods run with the sheet as this. */
export const basesMethods = {

  // =============================================================
  // Bases (Bio tab) — bases.txt
  // =============================================================

  _prepareBasesData(context, system) {
    const bT = system.baseTier || 1;
    const sizes = CONFIG.DBU?.baseSizes || {};
    const hardTable = CONFIG.DBU?.baseHardness || {};
    const catalog = CONFIG.DBU?.baseQualitiesCatalog || {};

    context.baseSizeOptions = Object.entries(sizes).map(([k, v]) => ({
      value: k, label: `${v.label} — ${v.squares}, DR ${v.dr}(bT), +${v.lp}(bT) LP, ${v.devCost} Dev`
    }));
    context.baseHardnessOptions = Object.entries(hardTable).map(([k, v]) => ({
      value: Number(k), label: `${k} — DR ${v.dr}(bT)${v.metal ? ", Metal" : ""}, ${v.devCost} Dev`
    }));
    context.baseQualityOptions = Object.entries(catalog)
      .map(([k, v]) => ({ value: k, label: v.special ? `★ ${v.name} (Special)` : v.name }));

    context.characterBases = (system.bases || []).map((b, index) => {
      const sz = sizes[b.size] || sizes.minor;
      const hd = hardTable[b.hardness] || hardTable[1];
      // Base Health: 40(bT) + Base Size LP (bases.txt:19 + Size table)
      const lpMax = (40 + (sz?.lp || 0)) * bT;
      const lpCurrent = Math.max(0, lpMax - (b.damage || 0));
      const destroyed = lpCurrent <= 0;

      const qualities = (b.qualities || []).map((q, qIndex) => {
        const qd = catalog[q.qualityKey] || null;
        const cost = qd?.special ? 0 : (qd?.variable ? (q.devSpent || 0) : (parseInt(qd?.devCost) || 0));
        return {
          ...q, qIndex, data: qd, cost,
          costDisplay: qd?.special ? "★" : (qd?.variable ? `${q.devSpent || 0} (${qd.devCost})` : String(qd?.devCost ?? ""))
        };
      });
      const qualitySpent = qualities.reduce((s, q) => s + q.cost, 0);
      const devSpent = (sz?.devCost || 0) + (hd?.devCost || 0) + qualitySpent;
      const hasQuality = (key) => qualities.some(q => q.qualityKey === key);

      // New-Entrance threshold: below 3/4 Max LP (1/2 with Reinforced Entrance)
      const entranceFrac = hasQuality("reinforced_entrance") ? 0.5 : 0.75;

      return {
        ...b, baseIndex: index,
        sizeLabel: sz?.label || b.size, squares: sz?.squares || "",
        drFormula: `${(sz?.dr || 0) + (hd?.dr || 0)}(bT)`,
        drResolved: ((sz?.dr || 0) + (hd?.dr || 0)) * bT,
        metal: !!hd?.metal,
        lpMax, lpCurrent, destroyed,
        lpPct: lpMax > 0 ? Math.round(lpCurrent / lpMax * 100) : 0,
        devSpent, devRemaining: (b.devPointsTotal || 0) - devSpent,
        devOver: devSpent > (b.devPointsTotal || 0),
        structural: hasQuality("structural_reinforcement"),
        entranceLP: Math.ceil(lpMax * entranceFrac),
        limitedDestructionLP: Math.floor(lpMax / 10),
        qualities
      };
    });
  },

  async _onAddBase(event) {
    event.preventDefault();
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    const nextId = bases.length > 0 ? Math.max(...bases.map(b => b.id || 0)) + 1 : 1;
    bases.push({ id: nextId, name: "New Base", category: "constructed", devPointsTotal: 8, size: "minor", hardness: 1, damage: 0, qualities: [], notes: "" });
    await this.actor.update({ "system.bases": bases });
  },

  async _onDeleteBase(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.baseIndex);
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    if (!(index >= 0 && index < bases.length)) return;
    if (!(await this._confirmDelete("Base", bases[index].name))) return;
    bases.splice(index, 1);
    await this.actor.update({ "system.bases": bases });
  },

  async _onBaseField(event) {
    const el = event.currentTarget;
    const index = Number(el.dataset.baseIndex);
    const field = el.dataset.field;
    if (!field || !(index >= 0)) return;
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    if (!bases[index]) return;
    let value = el.value;
    if (["devPointsTotal", "hardness", "damage"].includes(field)) value = Math.max(0, Number(value) || 0);
    if (field === "hardness") value = Math.min(4, Math.max(1, value));
    bases[index][field] = value;
    await this.actor.update({ "system.bases": bases });
  },

  async _onBaseAddQuality(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.baseIndex);
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    if (!bases[index]) return;
    const qs = bases[index].qualities || [];
    const nextId = qs.length > 0 ? Math.max(...qs.map(q => q.id || 0)) + 1 : 1;
    qs.push({ id: nextId, qualityKey: "", devSpent: 0, notes: "" });
    bases[index].qualities = qs;
    await this.actor.update({ "system.bases": bases });
  },

  async _onBaseDeleteQuality(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.baseIndex);
    const qIndex = Number(event.currentTarget.dataset.qIndex);
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    if (!bases[index]?.qualities?.[qIndex]) return;
    bases[index].qualities.splice(qIndex, 1);
    await this.actor.update({ "system.bases": bases });
  },

  async _onBaseQualityField(event) {
    const el = event.currentTarget;
    const index = Number(el.dataset.baseIndex);
    const qIndex = Number(el.dataset.qIndex);
    const field = el.dataset.field;
    if (!field) return;
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    const row = bases[index]?.qualities?.[qIndex];
    if (!row) return;
    let value = el.value;
    if (field === "devSpent") value = Math.max(0, Number(value) || 0);
    row[field] = value;
    await this.actor.update({ "system.bases": bases });
  },

  /** Repair the Base (a week of work outside Combat fully repairs it). */
  async _onBaseRepair(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.baseIndex);
    const bases = foundry.utils.deepClone(this.actor.system.bases || []);
    if (!bases[index]) return;
    if (!(bases[index].damage > 0)) return;
    bases[index].damage = 0;
    await this.actor.update({ "system.bases": bases });
    ChatMessage.create({
      content: `<div class="dbu-attack-roll">
        <div class="dbu-attack-title"><i class="fas fa-tools"></i> ${this.actor.name} — Base Repaired</div>
        <div class="dbu-attack-buffs"><b>${Handlebars.escapeExpression(bases[index].name)}</b> fully repaired (a week of work outside Combat).</div>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
  },
};
