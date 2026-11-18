

/** Character sheet domain: listeners. Methods run with the sheet as this. */
export const listenersMethods = {

  // Event registration; the sheet lifecycle calls super first.
  activateListeners(html) {

    if (!this.isEditable) return;

    // Item CRUD (Equipment)
    html.on("click", ".item-create", this._onItemCreate.bind(this));
    html.on("click", ".item-edit", this._onItemEdit.bind(this));
    html.on("click", ".item-delete", this._onItemDelete.bind(this));
    html.on("change", ".eq-worn-toggle", this._onEquipmentWornToggle.bind(this));
    html.on("change", ".eq-inline-input", this._onEquipmentInlineEdit.bind(this));
    html.on("change", ".eq-weapon-lp", this._onWeaponLPChange.bind(this));
    html.on("click", "[data-action='weapon-repair']", this._onWeaponRepair.bind(this));
    html.on("change", ".eq-inline-check", this._onEquipmentInlineCheck.bind(this));
    html.on("change", ".eq-basic-catalog-select", this._onBasicItemCatalogChange.bind(this));

    // Equipment Layer system
    html.on("change", "[data-action='assign-layer']", this._onAssignLayer.bind(this));
    html.on("click", "[data-action='toggle-detail']", this._onToggleDetail.bind(this));
    html.on("click", "[data-action='add-quality']", this._onAddQuality.bind(this));
    html.on("click", "[data-action='remove-quality']", this._onRemoveQuality.bind(this));
    html.on("change", ".eq-quality-notes", this._onQualityNotesChange.bind(this));
    html.on("change", ".eq-bv-input", this._onBreakValueChange.bind(this));

    // Equipment item card: per-card qualities CRUD
    html.on("click",  "[data-action='toggle-qualities-card']", this._onToggleQualityCard.bind(this));
    html.on("click",  "[data-action='add-item-quality']",      this._onAddItemQuality.bind(this));
    html.on("click",  "[data-action='remove-item-quality']",   this._onRemoveItemQuality.bind(this));
    html.on("change", ".eq-quality-config-input",              this._onChangeQualityConfig.bind(this));
    html.on("change", ".eq-quality-notes-input",               this._onChangeQualityNotes.bind(this));

    // Skill roll button
    html.on("click", "[data-action='roll-skill']", this._onRollSkill.bind(this));
    html.on("change", ".skill-misc-input", async (ev) => {
      const key = ev.currentTarget.dataset.skill;
      if (!key) return;
      const spec = ev.currentTarget.dataset.specialty || "";
      const miscKey = spec ? `${key}:${spec}` : key;
      await this.actor.update({ [`system.skillMisc.${miscKey}`]: Number(ev.currentTarget.value) || 0 });
    });
    // Encompassing Skill specialties (Craft/Knowledge)
    html.on("click", ".skill-spec-add", async (ev) => {
      const key = ev.currentTarget.dataset.skill;
      const specs = foundry.utils.deepClone(this.actor.system.skillSpecialties?.[key] || []);
      specs.push({ name: "", rank: 0 });
      await this.actor.update({ [`system.skillSpecialties.${key}`]: specs });
    });
    html.on("click", ".skill-spec-delete", async (ev) => {
      const key = ev.currentTarget.dataset.skill;
      const idx = Number(ev.currentTarget.dataset.index);
      const specs = foundry.utils.deepClone(this.actor.system.skillSpecialties?.[key] || []);
      specs.splice(idx, 1);
      await this.actor.update({ [`system.skillSpecialties.${key}`]: specs });
    });
    html.on("change", ".skill-spec-name-input, .skill-spec-rank-input", async (ev) => {
      const key = ev.currentTarget.dataset.skill;
      const idx = Number(ev.currentTarget.dataset.index);
      const specs = foundry.utils.deepClone(this.actor.system.skillSpecialties?.[key] || []);
      if (!specs[idx]) return;
      if (ev.currentTarget.classList.contains("skill-spec-name-input")) specs[idx].name = ev.currentTarget.value.trim();
      else specs[idx].rank = Math.max(0, Number(ev.currentTarget.value) || 0);
      await this.actor.update({ [`system.skillSpecialties.${key}`]: specs });
    });
    html.on("change", ".skill-genius-select", async (ev) => {
      await this.actor.update({ "system.talentSelections.geniusDesignerSpecialty": ev.currentTarget.value });
    });
    html.on("change", ".ec-tech-select", async (ev) => {
      const v = ev.currentTarget.value;
      // Numeric ids are Signature Techniques; "ua:<key>" targets a Technical Unique Ability
      const stored = v === "" ? "" : (v.startsWith("ua:") ? v : Number(v));
      await this.actor.update({ "system.talentSelections.energyControlTechniqueId": stored });
    });

    // Custom Buff CRUD
    html.on("click", "[data-action='add-custom-buff']", this._onAddCustomBuff.bind(this));
    html.on("click", "[data-action='delete-custom-buff']", this._onDeleteCustomBuff.bind(this));

    // New Round / New Encounter (main tab)
    html.on("click", "[data-action='new-round']", this._onNewRound.bind(this));
    html.on("click", "[data-action='new-encounter']", this._onNewEncounter.bind(this));

    // Effect Panel interactions (main tab)
    html.on("click", "[data-action='toggle-effect-group']", this._onToggleEffectGroup.bind(this));
    html.on("change", ".passive-toggle", this._onPassiveToggle.bind(this));
    html.on("click", ".usage-pip", this._onUsagePipClick.bind(this));

    // Trait CRUD
    html.on("click", "[data-action='add-trait']", this._onAddTrait.bind(this));
    html.on("click", "[data-action='delete-trait']", this._onDeleteTrait.bind(this));
    html.on("click", "[data-action='toggle-trait']", this._onToggleTrait.bind(this));
    html.on("change", ".option-select", this._onTraitOptionSelect.bind(this));
    html.on("change", ".option-checkbox", this._onTraitOptionCheckbox.bind(this));
    html.on("change", ".pb-bestial-check", this._onPartBeastBestialCheck.bind(this));
    html.on("change", ".pb-bestial-option", this._onPartBeastBestialOption.bind(this));
    html.on("change", ".de-meta-select", this._onDivergentMetaSelect.bind(this));
    html.on("change", ".de-meta-config", this._onDivergentMetaConfig.bind(this));
    html.on("change", ".af-foundation-select", async (ev) => {
      await this.actor.update({ "system.talentSelections.archetypeFocusFoundation": ev.currentTarget.value });
    });
    html.on("click", ".cruelty-increment", this._onCrueltyChange.bind(this, 1));
    html.on("click", ".cruelty-decrement", this._onCrueltyChange.bind(this, -1));
    html.on("click", "[data-action='use-surge']", this._onUseSurge.bind(this));

    // Shapeshift Unique Ability config (Unique tab)
    html.on("change", ".ss-field", this._onShapeshiftField.bind(this));
    html.on("change", ".ss-effect-check", this._onShapeshiftEffect.bind(this));
    html.on("change", ".ss-bestial-option", this._onPartBeastBestialOption.bind(this));
    html.on("click", ".ss-toggle-btn", this._onShapeshiftToggle.bind(this));

    // Unification (Fusion tab)
    html.on("change", ".unify-attr-input", this._onUnifyAttrAlloc.bind(this));
    html.on("click", "[data-action='unify-unlink']", this._onUnifyUnlink.bind(this));
    html.on("click", "[data-action='unify-grant-mp']", this._onUnifyGrantMP.bind(this));

    // Bases (Bio tab)
    html.on("click", "[data-action='add-base']", this._onAddBase.bind(this));
    html.on("click", "[data-action='delete-base']", this._onDeleteBase.bind(this));
    html.on("change", ".base-field", this._onBaseField.bind(this));
    html.on("click", "[data-action='add-base-quality']", this._onBaseAddQuality.bind(this));
    html.on("click", "[data-action='delete-base-quality']", this._onBaseDeleteQuality.bind(this));
    html.on("change", ".base-quality-field", this._onBaseQualityField.bind(this));
    html.on("click", "[data-action='repair-base']", this._onBaseRepair.bind(this));

    // Adversary CRUD
    html.on("click", "[data-action='add-villainous-trait']", this._onAddVillainousTrait.bind(this));
    html.on("click", "[data-action='delete-villainous-trait']", this._onDeleteVillainousTrait.bind(this));
    html.on("click", "[data-action='toggle-villainous-trait']", this._onToggleTraitCard.bind(this));
    html.on("click", "[data-action='add-weakness']", this._onAddWeakness.bind(this));
    html.on("click", "[data-action='delete-weakness']", this._onDeleteWeakness.bind(this));
    html.on("click", "[data-action='toggle-weakness']", this._onToggleTraitCard.bind(this));
    html.on("click", "[data-action='add-minion-trait']", this._onAddMinionTrait.bind(this));
    html.on("click", "[data-action='delete-minion-trait']", this._onDeleteMinionTrait.bind(this));

    // Player Minion (Main tab)
    html.on("click", "[data-action='add-player-minion-trait']", this._onAddPlayerMinionTrait.bind(this));
    html.on("click", "[data-action='create-duplicate-minion']", this._onCreateDuplicateMinion.bind(this));
    html.on("click", "[data-action='delete-player-minion-trait']", this._onDeletePlayerMinionTrait.bind(this));
    html.on("change", ".pm-trait-option", async (event) => {
      const traitId = event.currentTarget.dataset.traitId;
      if (!traitId) return;
      await this.actor.update({ [`system.minion.traitOptions.${traitId}`]: event.currentTarget.value });
    });

    // Battle Born stack controls
    html.on("click", ".bb-increment", this._onBBIncrement.bind(this));
    html.on("click", ".bb-decrement", this._onBBDecrement.bind(this));

    // Experienced Fighter controls
    html.on("click", "[data-action='ef-activate']", this._onExperiencedFighterActivate.bind(this));
    html.on("click", "[data-action='ef-deactivate']", this._onExperiencedFighterDeactivate.bind(this));

    // Talent CRUD
    html.on("click", "[data-action='add-talent']", this._onAddTalent.bind(this));
    html.on("click", "[data-action='delete-talent']", this._onDeleteTalent.bind(this));
    html.on("change", ".talent-category-filter", this._onTalentCategoryFilter.bind(this));

    // Technique CRUD
    html.on("click", "[data-action='add-technique']", this._onAddTechnique.bind(this));
    html.on("click", "[data-action='delete-technique']", this._onDeleteTechnique.bind(this));
    html.on("change", ".tech-input", this._onTechniqueFieldChange.bind(this));
    html.on("click", "[data-action='add-advantage']", this._onAddTechAdvantage.bind(this));
    html.on("click", "[data-action='remove-advantage']", this._onRemoveTechAdvantage.bind(this));
    html.on("change", ".adv-input", this._onTechAdvField.bind(this));
    html.on("click", "[data-action='add-disadvantage']", this._onAddTechDisadvantage.bind(this));
    html.on("click", "[data-action='remove-disadvantage']", this._onRemoveTechDisadvantage.bind(this));
    html.on("change", ".disadv-input", this._onTechDisadvField.bind(this));
    html.on("click", ".style-btn", this._onTechStyleToggle.bind(this));

    // Aura CRUD
    html.on("click", "[data-action='add-aura']", this._onAddAura.bind(this));
    html.on("click", "[data-action='delete-aura']", this._onDeleteAura.bind(this));
    html.on("click", "[data-action='toggle-aura']", this._onToggleAura.bind(this));
    html.on("change", ".aura-input", this._onAuraFieldChange.bind(this));
    html.on("click", "[data-action='add-aura-advantage']", this._onAddAuraAdvantage.bind(this));
    html.on("click", "[data-action='remove-aura-advantage']", this._onRemoveAuraAdvantage.bind(this));
    html.on("change", ".aura-adv-input", this._onAuraAdvField.bind(this));
    html.on("click", "[data-action='add-aura-disadvantage']", this._onAddAuraDisadvantage.bind(this));
    html.on("click", "[data-action='remove-aura-disadvantage']", this._onRemoveAuraDisadvantage.bind(this));
    html.on("change", ".aura-disadv-input", this._onAuraDisadvField.bind(this));

    // Transformation CRUD
    html.on("click", "[data-action='add-transformation']", this._onAddTransformation.bind(this));
    html.on("click", "[data-action='delete-transformation']", this._onDeleteTransformation.bind(this));
    html.on("change", ".tf-input", this._onTransformationFieldChange.bind(this));
    html.on("change", ".tf-check", this._onTransformationCheckChange.bind(this));
    html.on("click", "[data-action='open-transformation-catalog']", this._onOpenTransformationCatalog.bind(this));
    html.on("click", "[data-action='view-transformation-traits']", this._onViewTransformationTraits.bind(this));

    // Kaioken LP Cost
    html.on("click", "[data-action='pay-kaioken-lp']", this._onPayKaiokenLp.bind(this));

    // Token Album
    html.on("click", "[data-action='add-token-album-entry']", this._onAddAlbumEntry.bind(this));
    html.on("click", "[data-action='browse-album-image']", this._onBrowseAlbumImage.bind(this));
    html.on("click", "[data-action='activate-album-token']", this._onActivateAlbumToken.bind(this));
    html.on("click", "[data-action='remove-album-entry']", this._onRemoveAlbumEntry.bind(this));
    html.on("click", "[data-action='restore-original-token']", this._onRestoreOriginalToken.bind(this));
    html.on("change", ".tfi-name-input", this._onAlbumNameChange.bind(this));

    // Legendary Trait selection dropdown
    html.on("change", ".lt-trait-select", this._onLegendaryTraitSelect.bind(this));

    // Keratinous Plating option (Arcosian) — writes BOTH the canonical
    // racialOptionSelections entry (which the automation reads first) and the
    // legacy keratinousPlatingOption field, so the panel and the traits-dialog
    // selection can never diverge.
    html.on("change", ".kp-plating-select", async (event) => {
      const key = event.currentTarget.value;
      const KP_ID = "04608f3cb55d47a1";
      const fullNames = { dense: "Dense Plating", sleek: "Sleek Plating", royal: "Royal Plating", combat: "Combat Plating" };
      const updateData = { "system.keratinousPlatingOption": key };
      if (key === "none") updateData[`system.racialOptionSelections.${KP_ID}.-=4`] = null;
      else updateData[`system.racialOptionSelections.${KP_ID}.4`] = fullNames[key];
      await this.actor.update(updateData);
    });

    // Unique Abilities CRUD
    html.on("click", "[data-action='add-unique']", this._onAddUnique.bind(this));
    html.on("click", "[data-action='delete-unique']", this._onDeleteUnique.bind(this));
    html.on("change", ".unique-free-check", this._onUniqueFreeToggle.bind(this));
    html.on("click", "[data-action='add-unique-advancement']", this._onAddUniqueAdvancement.bind(this));
    html.on("click", "[data-action='remove-unique-advancement']", this._onRemoveUniqueAdvancement.bind(this));
    html.on("change", ".unique-adv-select", this._onUniqueAdvSelect.bind(this));
    html.on("change", ".unique-adv-free", this._onUniqueAdvFree.bind(this));
    html.on("change", ".unique-adv-amount", this._onUniqueAdvAmount.bind(this));
    html.on("click", "[data-action='add-unique-restriction']", this._onAddUniqueRestriction.bind(this));
    html.on("click", "[data-action='remove-unique-restriction']", this._onRemoveUniqueRestriction.bind(this));
    html.on("change", ".unique-res-select", this._onUniqueResSelect.bind(this));

    // Progression CRUD
    html.on("click", "[data-action='add-progression-row']", this._onAddProgressionRow.bind(this));
    html.on("click", "[data-action='delete-progression-row']", this._onDeleteProgressionRow.bind(this));

    // Combat tab
    html.on("click", "[data-action='unified-action']", this._onUnifiedAction.bind(this));
    html.on("click", ".combat-undo-use", this._onUndoResource.bind(this));
    html.on("click", ".combat-add-use", this._onAddResourceUse.bind(this));
    html.on("click", "[data-action='combat-new-round']", this._onCombatNewRound.bind(this));
    html.on("click", "[data-action='combat-new-encounter']", this._onCombatNewEncounter.bind(this));
    html.on("click", "[data-action='evil-aura-points-add']",        this._onEvilAuraPointsAdd.bind(this));
    html.on("click", "[data-action='evil-aura-points-sub']",        this._onEvilAuraPointsSub.bind(this));
    html.on("click", "[data-action='evil-aura-techs-activate']",    this._onEvilAuraTechsActivate.bind(this));
    html.on("click", "[data-action='evil-aura-techs-deactivate']",  this._onEvilAuraTechsDeactivate.bind(this));
    html.on("click", "[data-action='dkp-add']",                     this._onDkpAdd.bind(this));
    html.on("click", "[data-action='dkp-sub']",                     this._onDkpSub.bind(this));
    html.on("click", "[data-action='dkp-refill']",                  this._onDkpRefill.bind(this));
    html.on("click", "[data-action='god-maneuver-use']",            this._onGodManeuverUse.bind(this));
    html.on("click", "[data-action='apply-damage']", this._onApplyDamage.bind(this));
    html.on("click", "[data-action='apply-heal']", this._onApplyHeal.bind(this));
    html.on("change", ".combat-dmg-input", this._onDamageCalcInput.bind(this));
    html.on("change", ".threshold-check", this._onThresholdCheck.bind(this));
    html.on("change", ".condition-toggle", this._onConditionToggle.bind(this));
    html.on("change", ".condition-stack-input", this._onConditionStack.bind(this));
    html.on("click", "[data-action='toggle-ki-wager-ref']", (ev) => {
      ev.currentTarget.closest(".ki-wager-ref").classList.toggle("collapsed");
    });
    html.on("click", "[data-action='toggle-dice-pools']", (ev) => {
      ev.currentTarget.closest(".dice-pools-section").classList.toggle("collapsed");
    });
    html.on("click", "[data-action='tracker-add-action']", this._onTrackerAddAction.bind(this));
    html.on("click", "[data-action='tracker-next-round']", this._onTrackerNextRound.bind(this));
    html.on("click", "[data-action='tracker-reset']", this._onTrackerReset.bind(this));
    html.on("click", "[data-action='delete-tracker-action']", this._onDeleteTrackerAction.bind(this));
    html.on("change", ".action-type, .action-ki, .action-dkp, .action-desc", this._onTrackerActionChange.bind(this));
    html.on("change", ".tap-charging-toggle", this._onTrackerChargingToggle.bind(this));
    html.on("change", ".action-source", this._onTrackerSourceChange.bind(this));
    html.on("change", ".tap-wager-input", this._onTrackerWagerChange.bind(this));
    html.on("click", "[data-action='roll-tracker-attack']", this._onRollTrackerAttack.bind(this));
    html.on("click", "[data-action='roll-tracker-dodge']", this._onRollTrackerDodge.bind(this));
    html.on("change", ".tdp-option-select", this._onTrackerDefendOptionChange.bind(this));
    html.on("change", ".tdp-input", this._onTrackerDefendInput.bind(this));
    html.on("click", "[data-action='roll-tracker-defend']", this._onRollTrackerDefend.bind(this));
    html.on("change", ".tdl-mode-select", this._onTrackerDuelModeChange.bind(this));
    html.on("change", ".tdl-source-select", this._onTrackerDuelSourceChange.bind(this));
    html.on("click", "[data-action='initiate-duel']", this._onInitiateDuel.bind(this));
    html.on("change", ".ttf-source-select", this._onTrackerTransformChange.bind(this));
    html.on("change", ".ttf-checkbox", this._onTrackerTransformCheckbox.bind(this));
    html.on("click", "[data-action='roll-tracker-transform']", this._onRollTrackerTransform.bind(this));
    html.on("change", ".tgp-option-select", this._onTrackerGrappleOptionChange.bind(this));
    html.on("click", "[data-action='use-tracker-grapple']", this._onUseTrackerGrapple.bind(this));
    html.on("click", "[data-action='use-tracker-thrust']", this._onUseTrackerThrust.bind(this));
    html.on("click", "[data-action='use-tracker-terrify']", this._onUseTrackerTerrify.bind(this));
    html.on("click", "[data-action='use-tracker-feint']", this._onUseTrackerFeint.bind(this));
    html.on("click", "[data-action='use-tracker-dirty-trick']", this._onUseTrackerDirtyTrick.bind(this));
    html.on("click", "[data-action='tb-tab-switch']", this._onTbTabSwitch.bind(this));
    html.on("click", "[data-action='rt-activable-use']", this._onRtActivableUse.bind(this));

    // Populate tracker attack-source dropdowns from stored data
    try { this._populateTrackerSources(html); }
    catch (err) { console.error("DBU-OLD | _populateTrackerSources failed:", err); }

    // Combat filter checkboxes
    html.on("change", ".combat-filter", this._onCombatFilter.bind(this));

    // God Ki / God Maneuvers
    html.on("click", "[data-action='add-god-maneuver']", this._onAddGodManeuver.bind(this));
    html.on("click", "[data-action='remove-god-maneuver']", this._onRemoveGodManeuver.bind(this));
    html.on("change", ".god-strike-profile", this._onGodStrikeProfile.bind(this));

    // Clear damage log
    html.on("click", "[data-action='clear-damage-log']", this._onClearDamageLog.bind(this));

    // Transformation Rules buttons (Combat tab)
    html.on("click", "[data-action='tf-stress-test']", this._onTfStressTest.bind(this));
    html.on("click", "[data-action='tf-turbulent-roll']", this._onTfTurbulentRoll.bind(this));
    html.on("click", "[data-action='tf-surging-strength']", this._onTfSurgingStrength.bind(this));
    html.on("click", "[data-action='tf-burst-limit']", this._onTfBurstLimit.bind(this));
    html.on("click", "[data-action='tf-legend-realized']", this._onTfLegendRealized.bind(this));
    html.on("click", "[data-action='tf-new-level-of-power']", this._onTfNewLevelOfPower.bind(this));

    // Legendary Trait triggered buttons (Combat tab)
    html.on("click", "[data-action='lt-trigger']", this._onLegendaryTraitTrigger.bind(this));

    // Manifested Power triggered buttons (Combat tab)
    html.on("click", "[data-action='mp-trigger']", this._onManifestedPowerTrigger.bind(this));

    // Transformation bonus triggered buttons (Combat tab)
    html.on("click", "[data-action='ep-trigger']", this._onEnhancementPowerTrigger.bind(this));
    html.on("click", "[data-action='af-trigger']", this._onAlternateFormTrigger.bind(this));
    html.on("click", "[data-action='lf-trigger']", this._onLegendaryFormTrigger.bind(this));

    // Talent triggered buttons (Combat tab)
    html.on("click", "[data-action='talent-trigger']", this._onTalentTrigger.bind(this));
    html.on("click", "[data-action='talent-stance']", this._onTalentStanceShift.bind(this));

    // Racial Trait triggered buttons (Combat tab)
    html.on("click", "[data-action='rt-trigger']", this._onRacialTraitTrigger.bind(this));

    // Attack Ref CRUD
    html.on("click", "[data-action='add-attack-ref']", this._onAddAttackRef.bind(this));
    html.on("click", "[data-action='remove-attack-ref']", this._onRemoveAttackRef.bind(this));

    // Lookup handlers (Attack Ref tab)
    html.on("change", "#advdisLookupSelect", this._onAttackRefLookup.bind(this));
    html.on("change", "#stateLookupSelect", this._onStateLookup.bind(this));

    // Fusion tab
    html.on("click", "[data-action='add-fused-character']", this._onAddFusedCharacter.bind(this));
    html.on("click", "[data-action='remove-fused-character']", this._onRemoveFusedCharacter.bind(this));
    html.on("click", "[data-action='recalculate-fusion']", this._onRecalculateFusion.bind(this));
    html.on("change", ".fusion-racial-trait-toggle", this._onFusionTraitToggle.bind(this));
    html.on("change", ".fusion-boost-attr-toggle", this._onFusionBoostAttrToggle.bind(this));
    html.on("change", ".fusion-bonus-talent-toggle", this._onFusionBonusTalentToggle.bind(this));
    html.on("change", ".fusion-modifier-check", this._onFusionModifierToggle.bind(this));
    html.on("click", "[data-action='fusion-round-decrement']", this._onFusionRoundDecrement.bind(this));
    html.on("click", "[data-action='fusion-round-reset']", this._onFusionRoundReset.bind(this));
    html.on("change", ".absorption-trait-select", this._onAbsorptionTraitSelect.bind(this));
    html.on("change", ".possession-trait-give", this._onPossessionTraitExchange.bind(this));
    html.on("change", ".possession-trait-take", this._onPossessionTraitExchange.bind(this));
    html.on("change", ".mutation-source-select", this._onMutationSourceSelect.bind(this));
    html.on("click", "[data-action='destroy-absorbed-apparel']", this._onDestroyAbsorbedApparel.bind(this));
    html.on("change", ".fusion-deeply-suppressed", this._onFusionDeeplySuppressed.bind(this));
    html.on("change", ".fusion-struggling-input", this._onFusionStrugglingChange.bind(this));
    html.on("click", "[data-action='eject-suppressed']", this._onEjectSuppressed.bind(this));
    html.on("click", "[data-action='escape-suppressed']", this._onEscapeSuppressed.bind(this));

    // --- Battle Jacket Tab ---
    html.on("click", "[data-action='link-jacket']", this._onLinkJacket.bind(this));
    html.on("click", "[data-action='unlink-jacket']", this._onUnlinkJacket.bind(this));
    html.on("click", "[data-action='enter-jacket']", this._onEnterJacket.bind(this));
    html.on("click", "[data-action='exit-jacket']", this._onExitJacket.bind(this));
    html.on("click", "[data-action='open-jacket-sheet']", this._onOpenJacketSheet.bind(this));
    html.on("change", ".bj-lp-input", this._onBJResourceChange.bind(this));
    html.on("change", ".bj-kp-input", this._onBJResourceChange.bind(this));
    html.on("change", ".bj-weakpoint-toggle", this._onBJWeakPointToggle.bind(this));

    // Downtime tab
    html.on("click", "[data-action='dt-start-period']", this._onDtStartPeriod.bind(this));
    html.on("click", "[data-action='dt-end-period']", this._onDtEndPeriod.bind(this));
    html.on("click", "[data-action='dt-cancel-period']", this._onDtCancelPeriod.bind(this));
    html.on("click", "[data-action='dt-use-activity']", this._onDtUseActivity.bind(this));
    html.on("click", "[data-action='dt-undo-activity']", this._onDtUndoActivity.bind(this));
    html.on("change", "[data-action='dt-toggle-modifier']", this._onDtToggleModifier.bind(this));
    html.on("click", "[data-action='dt-delete-history']", this._onDtDeleteHistory.bind(this));

    // ---- Transformation Customization listeners ----
    html.on("click", "[data-action='tfc-toggle-section']", (ev) => {
      ev.currentTarget.closest(".tfc-section").classList.toggle("collapsed");
    });
    html.on("click", "[data-action='tfc-remove-aspect']", this._onTfcRemoveAspect.bind(this));
    html.on("click", "[data-action='tfc-add-aspect']", this._onTfcAddAspect.bind(this));
    html.on("keydown", ".tfc-aspect-input", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const idx = ev.currentTarget.dataset.transIndex;
        html.find(`[data-action='tfc-add-aspect'][data-trans-index='${idx}']`).trigger("click");
      }
    });
    html.on("change", "[data-action='tfc-edit-amb']", this._onTfcEditAmb.bind(this));
    html.on("change", "[data-action='tfc-set-power-improvement']", this._onTfcSetPowerImprovement.bind(this));
    html.on("change", "[data-action='tfc-set-ls-form']", this._onTfcSetLsForm.bind(this));
    html.on("change", "[data-action='tfc-set-ls-exceed']", this._onTfcSetLsExceed.bind(this));
    html.on("change", "[data-action='tfc-toggle-exceed']", this._onTfcToggleExceed.bind(this));
    html.on("change", "[data-action='tfc-set-up-form']", this._onTfcSetUpField.bind(this));
    html.on("change", "[data-action='tfc-set-up-path']", this._onTfcSetUpField.bind(this));
    html.on("change", "[data-action='tfc-set-up-amb']", this._onTfcSetUpField.bind(this));
    html.on("click", "[data-action='tfc-add-up']", this._onTfcAddUp.bind(this));
    html.on("click", "[data-action='tfc-delete-up']", this._onTfcDeleteUp.bind(this));
  },
};
