

/** Character sheet domain: battle-jacket. Methods run with the sheet as this. */
export const battleJacketMethods = {

  // -------------------------------------------------------
  // Data Prep: Battle Jacket Tab
  // -------------------------------------------------------

  _prepareBattleJacketTabData(context, system) {
    const pilotedId = system.pilotedJacketId || "";
    const isPiloting = system.isPiloting || false;

    context.bjLinked = !!pilotedId;
    context.bjPiloting = isPiloting;
    context.bjJacket = null;
    context.bjAvailableJackets = [];

    if (!pilotedId) {
      context.bjAvailableJackets = game.actors
        .filter(a => a.type === "battleJacket" && !a.system.pilotId)
        .map(a => ({ id: a.id, name: a.name }));
    }

    if (pilotedId) {
      const bjActor = game.actors?.get(pilotedId);
      if (!bjActor || bjActor.type !== "battleJacket") {
        // Stale link: jacket was deleted or is no longer valid
        context.bjLinked = false;
        context.bjStaleLink = true;
        context.bjAvailableJackets = game.actors
          .filter(a => a.type === "battleJacket" && !a.system.pilotId)
          .map(a => ({ id: a.id, name: a.name }));
      } else {
        const bjSys = bjActor.system;
        const catalog = CONFIG.DBU?.jacketModulesCatalog || {};

        context.bjJacket = {
          id: bjActor.id,
          name: bjActor.name,
          img: bjActor.img,
          grade: bjSys.jacketGrade,
          frame: bjSys.jacketFrame,
          engine: bjSys.jacketEngine,
          jacketLevel: bjSys.jacketLevel,
          jacketTier: bjSys.jacketTier,
          sizeCategory: bjSys.effectiveSizeCategory || bjSys.sizeCategory,
          lp: bjSys.lp,
          kp: bjSys.kp,
          awareness: bjSys.awareness,
          haste: bjSys.haste,
          soak: bjSys.soak,
          defenseValue: bjSys.defenseValue,
          damageReduction: bjSys.damageReduction,
          normalSpeed: bjSys.normalSpeed,
          boostedSpeed: bjSys.boostedSpeed,
          might: bjSys.might,
          healthThresholds: bjSys.healthThresholds,
          weakPoints: bjSys.weakPoints,
          uniqueFrameModule: catalog[bjSys.frameUniqueModule] || null,
          uniqueEngineModule: catalog[bjSys.engineUniqueModule] || null,
          installedModules: (bjSys.installedModules || []).map(id => catalog[id] || { name: id }),
          signatureTechniques: bjSys.signatureTechniques || [],
          signatureAuras: bjSys.signatureAuras || [],
          uniqueAbilities: bjSys.uniqueAbilities || [],
          lpPercent: bjSys.lp.max > 0 ? Math.clamp(bjSys.lp.value / bjSys.lp.max * 100, 0, 100) : 0,
          kpPercent: bjSys.kp.max > 0 ? Math.clamp(bjSys.kp.value / bjSys.kp.max * 100, 0, 100) : 0
        };
      }
    }

    // Fix I3: Resolve unique ability display names from catalog
    if (context.bjJacket?.uniqueAbilities) {
      const uaCatalog = CONFIG.DBU?.uniqueAbilitiesCatalog || {};
      context.bjJacket.uniqueAbilities = context.bjJacket.uniqueAbilities.map(ua => {
        const catEntry = uaCatalog[ua.abilityKey];
        return { ...ua, resolvedName: catEntry?.name || ua.abilityKey };
      });
    }

    context.bjPenalty = system._bjPenalty || 0;
    context.bjPenaltyRemoved = system._bjPenaltyApplied === false && isPiloting;
  },

  // ============================================================
  // Battle Jacket Tab Handlers
  // ============================================================

  async _onLinkJacket(event) {
    event.preventDefault();
    const select = this.element.find(".bj-jacket-select");
    const jacketId = select.val();
    if (!jacketId) return;
    const bjActor = game.actors.get(jacketId);
    if (!bjActor) return;
    await this.actor.update({ "system.pilotedJacketId": jacketId });
    await bjActor.update({ "system.pilotId": this.actor.id });
  },

  async _onUnlinkJacket(event) {
    event.preventDefault();
    const jacketId = this.actor.system.pilotedJacketId;
    if (jacketId) {
      const bjActor = game.actors.get(jacketId);
      if (bjActor) await bjActor.update({ "system.pilotId": "" });
    }
    await this.actor.update({ "system.pilotedJacketId": "", "system.isPiloting": false });
  },

  async _onEnterJacket(event) {
    event.preventDefault();
    await this.actor.update({ "system.isPiloting": true });
  },

  async _onExitJacket(event) {
    event.preventDefault();
    await this.actor.update({ "system.isPiloting": false });
  },

  _onOpenJacketSheet(event) {
    event.preventDefault();
    const jacketId = this.actor.system.pilotedJacketId;
    if (jacketId) {
      const bjActor = game.actors.get(jacketId);
      if (bjActor) bjActor.sheet.render(true);
    }
  },

  async _onBJResourceChange(event) {
    const input = event.currentTarget;
    const jacketId = input.dataset.jacketId;
    const bjActor = game.actors.get(jacketId);
    if (!bjActor) return;
    const isLP = input.classList.contains("bj-lp-input");
    const field = isLP ? "system.lp.value" : "system.kp.value";
    await bjActor.update({ [field]: Number(input.value) || 0 });
  },

  async _onBJWeakPointToggle(event) {
    const jacketId = event.currentTarget.dataset.jacketId;
    const field = event.currentTarget.dataset.field;
    const checked = event.currentTarget.checked;
    const bjActor = game.actors.get(jacketId);
    if (!bjActor) return;
    await bjActor.update({ [`system.weakPoints.${field}`]: checked });
  },
};
