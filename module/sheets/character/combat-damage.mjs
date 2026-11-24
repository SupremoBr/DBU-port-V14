import { uses093 } from "../../rules/v093.mjs";
import { Dialog } from "../../helpers/foundry-compat.mjs";

/** Character sheet domain: combat-damage. Methods run with the sheet as this. */
export const combatDamageMethods = {

  async _onDamageCalcInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    const val = event.currentTarget.type === "checkbox"
      ? event.currentTarget.checked
      : (event.currentTarget.type === "number"
        ? Number(event.currentTarget.value) || 0
        : event.currentTarget.value);
    await this.actor.update({ [`system.damageCalc.${field}`]: val });
  },

  /**
   * Guard option KP cost: 8(T) + 1(T) per Energy Charge on the incoming attack
   * (max +4(T)); Guard Down condition raises the final cost by 1/2 (rounded up).
   * (actions-combat.txt: Defend Maneuver / Guard; damage-conditions.txt: Guard Down)
   */
  _calcGuardKiCost(system) {
    const tier = system.tier || 1;
    const ecSurcharge = Math.min(Math.max(0, Number(system.damageCalc?.incomingEC) || 0), 4);
    let cost = (8 + ecSurcharge) * tier;
    if (this.actor._isConditionActive?.(system, "guardDown")) cost = Math.ceil(cost * 1.5);
    // Effective Defenses: Guard KP cost −2(T) (floor 0)
    cost = Math.max(0, cost - (system.aptitudes?.guardKPReduction || 0));
    return cost;
  },

  /** Deduct the Guard KP cost and whisper the remaining KP to GM + owners. */
  async _payGuardKi(system, updates) {
    const cost = this._calcGuardKiCost(system);
    const kiNow = updates["system.kiPool.value"] ?? (system.kiPool?.value ?? 0);
    const newKi = Math.max(0, kiNow - cost);
    updates["system.kiPool.value"] = newKi;
    const shortBy = cost - kiNow;
    const whisperIds = game.users
      .filter(u => u.isGM || this.actor.testUserPermission(u, "OWNER"))
      .map(u => u.id);
    const note = shortBy > 0
      ? `<b>${this.actor.name}</b>: Guard — insufficient KP, paid ${kiNow}/${cost}. Remaining KP: <b>0</b>`
      : `<b>${this.actor.name}</b>: Guard cost -${cost} KP. Remaining KP: <b>${newKi}</b>`;
    ChatMessage.create({
      content: `<div class="dbu-ki-deduct"><i class="fas fa-shield-alt"></i> ${note}</div>`,
      whisper: whisperIds,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
    if (shortBy > 0) ui.notifications.warn(`${this.actor.name}: insufficient KP for Guard. Paid ${kiNow}/${cost}.`);
    return cost;
  },

  async _onApplyDamage(event) {
    event.preventDefault();
    const system = this.actor.system;
    const dc = system.damageCalc;
    let damage = dc?.healthReduction || 0;
    if (damage <= 0) {
      // Guard is paid even when it reduces the final damage to 0 — the Defend
      // Maneuver's cost is spent on use, not on damage taken. Skip if already
      // paid through the Defend Maneuver chat card.
      if ((dc?.defense || "none") === "guard") {
        const updates = {
          "system.damageCalc.defense": "none",
          "system.damageCalc.incomingEC": 0,
          "system.damageCalc.guardPaidViaCard": false
        };
        if (!dc?.guardPaidViaCard) await this._payGuardKi(system, updates);
        await this.actor.update(updates);
      }
      return;
    }
    const baseTier = system.baseTier || 1;
    const specialResourcesAtStart = foundry.utils.deepClone(system.transformationMeta?.specialResources || {});
    const justiceContext = this._getJusticeChargeContext(system.transformations || []);
    let draconicForceSpent = false;
    let draconicForceReduction = 0;
    let draconicForceSource = "";
    let mightGuardTriggered = false;
    let mightGuardReduction = 0;
    let mightGuardSource = "";
    let smallHitNullified = false;
    let smallHitNullifyAmount = 0;
    let smallHitNullifySource = "";
    let perfectPointsSpent = 0;
    let perfectPointsReduction = 0;
    let sapAbsorbed = 0;
    let sapBefore = specialResourcesAtStart.spectralArmorPoints?.value ?? 0;
    let sapAfter = sapBefore;
    let sapSource = "";
    let sapExitTransformId = null;
    let sapRegenAmount = 0;
    let sapRegenSource = "";
    let divineKiGuardSpent = 0;
    let divineKiGuardReduction = 0;
    let divineKiGuardSource = "";
    let kiGuardSpent = 0;
    let kiGuardReduction = 0;
    let kiGuardRecoveredDKP = 0;
    let kiGuardSource = "";
    let natureKiSpent = 0;
    let natureKiReduction = 0;
    let plateSpent = false;
    let plateReduction = 0;
    let justiceChargeSpent = false;
    let justiceChargeReduction = 0;

    const perfectPointsAtStart = system.tracking?.perfectPoints ?? 0;
    if (perfectPointsAtStart >= 4) {
      const activeTransforms = system.transformations || [];
      let perfectGuardAvailable = false;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        if (effects.some(e => /spend 1 counter action and all of your perfect points \(min\. 4\) to reduce the damage from that attacking maneuver to 0/i.test(String(e?.text || "")))) {
          perfectGuardAvailable = true;
          break;
        }
      }

      const quarterMaxLP = Math.ceil((system.lifePoints?.max ?? 0) / 4);
      if (perfectGuardAvailable && damage > 0 && damage < quarterMaxLP) {
        const canUsePerfectGuard = await this._trackCombatUsage("tf:auto_perfect_guard", "encounter", 1);
        if (canUsePerfectGuard) {
          const usePerfectGuard = await Dialog.wait({
            title: "Perfect Guard",
            content: `<p>Spend all Perfect Points (<b>${perfectPointsAtStart}</b>) to reduce this damage to <b>0</b>?</p>`,
            buttons: {
              yes: { label: "Use Perfect Points", callback: () => true },
              no: { label: "Skip", callback: () => false }
            },
            close: () => false
          });
          if (usePerfectGuard) {
            perfectPointsSpent = perfectPointsAtStart;
            perfectPointsReduction = damage;
            damage = 0;
          } else {
            await this._undoCombatUsage("tf:auto_perfect_guard", "encounter");
          }
        }
      }
    }

    if (!smallHitNullified && damage > 0) {
      const quarterMaxLP = Math.ceil((system.lifePoints?.max ?? 0) / 4);
      if (damage < quarterMaxLP) {
        const activeTransforms = system.transformations || [];
        let nullifyTransform = null;
        for (const trans of activeTransforms) {
          if (!trans?.active) continue;
          const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
          const match = effects.find(e =>
            String(e?.usageLimit || "").toLowerCase() === "encounter" &&
            (e?.maxUses ?? 0) === 1 &&
            /if you are hit by an attacking maneuver that deals damage less than 1\/4 of your maximum life points, reduce the amount of damage you receive to 0/i.test(String(e?.text || ""))
          );
          if (match) {
            nullifyTransform = { trans, effect: match };
            break;
          }
        }

        if (nullifyTransform) {
          const trackingId = `tf:auto_small_hit_nullify:${nullifyTransform.trans.id ?? nullifyTransform.trans.catalogKey ?? "unknown"}`;
          const canUseNullify = await this._trackCombatUsage(trackingId, "encounter", 1, `Burst Limit Guard (${nullifyTransform.trans.name})`);
          if (canUseNullify) {
            const useNullify = await Dialog.wait({
              title: "Burst Limit Guard",
              content: `<p>Use <b>${nullifyTransform.trans.name}</b> to reduce this damage to <b>0</b>?</p>`,
              buttons: {
                yes: { label: "Use Effect", callback: () => true },
                no: { label: "Skip", callback: () => false }
              },
              close: () => false
            });
            if (useNullify) {
              smallHitNullified = true;
              smallHitNullifyAmount = damage;
              smallHitNullifySource = nullifyTransform.trans.name || "Burst Limit Guard";
              damage = 0;
            } else {
              await this._undoCombatUsage(trackingId, "encounter");
            }
          }
        }
      }
    }

    if (damage > 0) {
      const activeTransforms = system.transformations || [];
      let mightGuardTransform = null;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        const match = effects.find(e =>
          String(e?.usageLimit || "").toLowerCase() === "round" &&
          (e?.maxUses ?? 0) === 1 &&
          /if you are hit by an attacking maneuver, reduce the damage you would receive by your might/i.test(String(e?.text || ""))
        );
        if (match) {
          mightGuardTransform = { trans, effect: match };
          break;
        }
      }

      if (mightGuardTransform) {
        const trackingId = `tf:auto_might_guard:${mightGuardTransform.trans.id ?? mightGuardTransform.trans.catalogKey ?? "unknown"}`;
        const canUseMightGuard = await this._trackCombatUsage(trackingId, "round", 1, `Might Guard (${mightGuardTransform.trans.name})`);
        if (canUseMightGuard) {
          const might = system.status?.might ?? 0;
          const useMightGuard = await Dialog.wait({
            title: "Might Guard",
            content: `<p>Use <b>${mightGuardTransform.trans.name}</b> to reduce this damage by your Might (<b>${might}</b>)?</p>`,
            buttons: {
              yes: { label: "Use Effect", callback: () => true },
              no: { label: "Skip", callback: () => false }
            },
            close: () => false
          });
          if (useMightGuard) {
            mightGuardTriggered = true;
            mightGuardReduction = Math.min(damage, might);
            damage = Math.max(0, damage - mightGuardReduction);
            mightGuardSource = mightGuardTransform.trans.name || "Might Guard";
          } else {
            await this._undoCombatUsage(trackingId, "round");
          }
        }
      }
    }

    const currentDKPAtStart = system.divineKiPoints?.value ?? 0;
    if (currentDKPAtStart > 0) {
      const activeTransforms = system.transformations || [];
      let divineKiGuardEffect = null;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        const match = effects.find(e => /if you receive damage from an opponent.?s attacking maneuver, you may spend 4\(bT\) divine ki points to reduce the damage you received by your might/i.test(String(e?.text || "")));
        if (match) {
          divineKiGuardEffect = { trans, effect: match };
          break;
        }
      }

      if (divineKiGuardEffect) {
        const spend = 4 * baseTier;
        if (currentDKPAtStart >= spend) {
          const might = system.status?.might ?? 0;
          const useDivineKiGuard = await Dialog.wait({
            title: "Divine Ki Guard",
            content: `<p>Spend <b>${spend}</b> Divine Ki Points to reduce this damage by your Might (<b>${might}</b>)?</p>`,
            buttons: {
              yes: { label: "Use Divine Ki", callback: () => true },
              no: { label: "Skip", callback: () => false }
            },
            close: () => false
          });
          if (useDivineKiGuard) {
            divineKiGuardSpent = spend;
            divineKiGuardReduction = Math.min(damage, might);
            damage = Math.max(0, damage - divineKiGuardReduction);
            divineKiGuardSource = divineKiGuardEffect.trans?.name || "Divine Ki Guard";
          }
        }
      }
    }

    const startingDraconicForce = specialResourcesAtStart.draconicForce?.value ?? 0;
    if (startingDraconicForce > 0) {
      const activeTransforms = system.transformations || [];
      let draconicGuardTransform = null;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        if (effects.some(e => /spend a stack of draconic force to gain x\(bT\) damage reduction/i.test(String(e?.text || "")))) {
          draconicGuardTransform = trans;
          break;
        }
      }

      if (draconicGuardTransform) {
        const scaling = this._getTransformationScalingLevel(draconicGuardTransform, activeTransforms);
        const x = 2 + scaling;
        const reduction = x * baseTier;
        const useDraconicForce = await Dialog.wait({
          title: "Draconic Force Guard",
          content: `<p>Spend 1 Draconic Force to reduce this damage by <b>${reduction}</b>?</p>`,
          buttons: {
            yes: { label: "Use Draconic Force", callback: () => true },
            no: { label: "Skip", callback: () => false }
          },
          close: () => false
        });
        if (useDraconicForce) {
          draconicForceSpent = true;
          draconicForceReduction = Math.min(damage, reduction);
          damage = Math.max(0, damage - draconicForceReduction);
          draconicForceSource = draconicGuardTransform.name || "Draconic Force";
        }
      }
    }

    const currentKPAtStart = system.kiPool?.value ?? 0;
    if (currentKPAtStart > 0) {
      const activeTransforms = system.transformations || [];
      let kiGuardEffect = null;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        const match = effects.find(e => /spend up to 8\(t\) ki points to reduce any damage you receive by an equal amount/i.test(String(e?.text || "")));
        if (match) {
          kiGuardEffect = { trans, effect: match };
          break;
        }
      }

      if (kiGuardEffect) {
        const tier = system.tier || 1;
        const maxSpend = Math.min(currentKPAtStart, 8 * tier, damage);
        if (maxSpend > 0) {
          const canUseKiGuard = await this._trackCombatUsage("tf:auto_ki_guard", "round", 1);
          if (canUseKiGuard) {
            const spendRaw = await Dialog.prompt({
              title: "Ki Guard",
              content: `<form><div class="form-group"><label>Ki Points to spend (max ${maxSpend})</label><input type="number" name="kpSpend" min="0" max="${maxSpend}" step="1" value="1" /></div></form>`,
              callback: (html) => Number(html.find("[name='kpSpend']").val()) || 0,
              rejectClose: false
            });
            const spend = Math.min(maxSpend, Math.max(0, Number(spendRaw) || 0));
            if (spend > 0) {
              kiGuardSpent = spend;
              kiGuardReduction = Math.min(damage, spend);
              damage = Math.max(0, damage - kiGuardReduction);
              if (damage === 0) {
                const currentDKP = system.divineKiPoints?.value ?? 0;
                const maxDKP = system.divineKiPoints?.max ?? 0;
                kiGuardRecoveredDKP = Math.min(maxDKP - currentDKP, Math.ceil(spend / 2));
              }
              kiGuardSource = kiGuardEffect.trans?.name || "Ki Guard";
            } else {
              await this._undoCombatUsage("tf:auto_ki_guard", "round");
            }
          }
        }
      }
    }

    const startingNatureKi = specialResourcesAtStart.natureKi?.value ?? 0;
    if (startingNatureKi > 0) {
      const activeTransforms = system.transformations || [];
      let natureKiGuardAvailable = false;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        if (effects.some(e => /spend up to 5\(t\) nature ki to increase your soak value by an equal amount/i.test(String(e?.text || "")))) {
          natureKiGuardAvailable = true;
          break;
        }
      }

      if (natureKiGuardAvailable) {
        const canUseNatureKi = await this._trackCombatUsage("tf:auto_nature_ki_guard", "round", 1);
        if (canUseNatureKi) {
          const tier = system.tier || 1;
          const maxSpend = Math.min(startingNatureKi, 5 * tier);
          const spendRaw = await Dialog.prompt({
            title: "Nature Ki Guard",
            content: `<form><div class="form-group"><label>Nature Ki to spend (max ${maxSpend})</label><input type="number" name="nkSpend" min="0" max="${maxSpend}" step="1" value="1" /></div></form>`,
            callback: (html) => Number(html.find("[name='nkSpend']").val()) || 0,
            rejectClose: false
          });
          const spend = Math.min(maxSpend, Math.max(0, Number(spendRaw) || 0));
          if (spend > 0) {
            natureKiSpent = spend;
            natureKiReduction = Math.min(damage, spend);
            damage = Math.max(0, damage - natureKiReduction);
          } else {
            await this._undoCombatUsage("tf:auto_nature_ki_guard", "round");
          }
        }
      }
    }

    const startingPlates = specialResourcesAtStart.plates?.value ?? 0;
    if (startingPlates > 0) {
      const canUsePlate = await this._trackCombatUsage("tf:auto_plate_guard", "round", 1);
      if (canUsePlate) {
        const reduction = 6 * baseTier;
        const usePlate = await Dialog.wait({
          title: "Plate Guard",
          content: `<p>Spend 1 Plate to reduce this damage by <b>${reduction}</b>?</p>`,
          buttons: {
            yes: { label: "Use Plate", callback: () => true },
            no: { label: "Skip", callback: () => false }
          },
          close: () => false
        });
        if (usePlate) {
          plateSpent = true;
          plateReduction = Math.min(damage, reduction);
          damage = Math.max(0, damage - plateReduction);
        } else {
          await this._undoCombatUsage("tf:auto_plate_guard", "round");
        }
      }
    }

    const justiceCharges = justiceContext.active ? (specialResourcesAtStart.justiceCharge?.value ?? 0) : 0;
    if (justiceCharges > 0) {
      const canUseJusticeCharge = await this._trackCombatUsage("tf:auto_justice_charge_guard", "round", 1);
      if (canUseJusticeCharge) {
        const reduction = justiceCharges * baseTier;
        const useJusticeCharge = await Dialog.wait({
          title: "Justice Charge",
          content: `<p>Spend 1 Justice Charge to reduce this damage by <b>${reduction}</b>?</p>`,
          buttons: {
            yes: { label: "Use Charge", callback: () => true },
            no: { label: "Skip", callback: () => false }
          },
          close: () => false
        });
        if (useJusticeCharge) {
          justiceChargeSpent = true;
          justiceChargeReduction = Math.min(damage, reduction);
          damage = Math.max(0, damage - justiceChargeReduction);
        } else {
          const ctsUndo = foundry.utils.deepClone(this.actor.system.combatTabState || {});
          const etUndo = foundry.utils.deepClone(this.actor.system.effectTracking || {});
          if (ctsUndo.resourceUsage?.round?.["tf:auto_justice_charge_guard"]) {
            ctsUndo.resourceUsage.round["tf:auto_justice_charge_guard"] = Math.max(0, ctsUndo.resourceUsage.round["tf:auto_justice_charge_guard"] - 1);
            if (ctsUndo.resourceUsage.round["tf:auto_justice_charge_guard"] === 0) delete ctsUndo.resourceUsage.round["tf:auto_justice_charge_guard"];
          }
          if (etUndo.usedEffects?.round?.["tf:auto_justice_charge_guard"]) {
            etUndo.usedEffects.round["tf:auto_justice_charge_guard"] = Math.max(0, etUndo.usedEffects.round["tf:auto_justice_charge_guard"] - 1);
            if (etUndo.usedEffects.round["tf:auto_justice_charge_guard"] === 0) delete etUndo.usedEffects.round["tf:auto_justice_charge_guard"];
          }
          await this.actor.update({ "system.combatTabState": ctsUndo, "system.effectTracking": etUndo });
        }
      }
    }

    if (sapBefore > 0 && damage > 0) {
      const activeTransforms = system.transformations || [];
      let sapTransform = null;
      for (const trans of activeTransforms) {
        if (!trans?.active) continue;
        const effects = this._getResolvedTransformationEffects(trans, activeTransforms);
        if (effects.some(e => /reduce your sap instead of your life points/i.test(String(e?.text || "")))) {
          sapTransform = trans;
          break;
        }
      }

      if (sapTransform) {
        sapSource = sapTransform.name || "Spectral Armor";
        sapAbsorbed = Math.min(damage, sapBefore);
        sapAfter = Math.max(0, sapBefore - damage);
        damage = Math.max(0, damage - sapBefore);
        if (sapAfter === 0) {
          sapExitTransformId = sapTransform.id ?? null;
        } else {
          const effects = this._getResolvedTransformationEffects(sapTransform, activeTransforms);
          const hasSapRegen = effects.some(e => /each time you are hit by an attacking maneuver and receive damage, regain g\(t\) sap after that attacking maneuver is concluded/i.test(String(e?.text || "")));
          if (hasSapRegen) {
            const growth = this._getTransformationGrowthLevel(sapTransform, activeTransforms);
            sapRegenAmount = growth * (system.tier || 1);
            sapRegenSource = sapTransform.name || "Perfect Armor";
          }
        }
      }
    }

    const currentLP = system.lifePoints?.value ?? 0;
    let newLP = Math.max(0, currentLP - damage);
    let deadOrAliveUsed = false;
    let justiceChargesLostOnDefeat = 0;
    let defeatRecoveryLP = 0;
    let defeatRecoveryKP = 0;

    const justiceChargesRemaining = Math.max(0, justiceCharges - (justiceChargeSpent ? 1 : 0));
    if (newLP <= 0 && justiceChargesRemaining > 0) {
      const useDeadOrAlive = await Dialog.wait({
        title: "Dead or Alive",
        content: `<p>Use all remaining Justice Charges (${justiceChargesRemaining}) to avoid defeat?</p>`,
        buttons: {
          yes: { label: "Use Charges", callback: () => true },
          no: { label: "Stay Defeated", callback: () => false }
        },
        close: () => false
      });
      if (useDeadOrAlive) {
        deadOrAliveUsed = true;
        justiceChargesLostOnDefeat = justiceChargesRemaining;
        defeatRecoveryLP = 5 * baseTier * justiceChargesRemaining;
        defeatRecoveryKP = 5 * baseTier * justiceChargesRemaining;
        const maxLP = system.lifePoints?.max ?? 0;
        newLP = Math.min(maxLP, 1 + defeatRecoveryLP);
      }
    }

    // --- Threshold crossing detection for Break Value ---
    const thresholdValues = [
      { name: "Bruised", value: system.thresholds?.bruised?.value ?? 0 },
      { name: "Injured", value: system.thresholds?.injured?.value ?? 0 },
      { name: "Critical", value: system.thresholds?.critical?.value ?? 0 }
    ];
    let thresholdsCrossed = 0;
    const crossedNames = [];
    for (const t of thresholdValues) {
      if (uses093(system) && system._minionThresholdsNA && t.name !== "Injured") continue;
      if (currentLP > t.value && newLP <= t.value) {
        thresholdsCrossed++;
        crossedNames.push(t.name);
      }
    }

    // Reduce top layer apparel Break Value if thresholds were crossed
    let breakReduction = 0;
    if (thresholdsCrossed > 0) {
      const topLayerId = system.wornApparelSlots?.topLayer;
      if (topLayerId) {
        const topItem = this.actor.items.get(topLayerId);
        if (topItem && (topItem.system.breakValueCurrent ?? 0) > 0) {
          const oldBV = topItem.system.breakValueCurrent;
          const newBV = Math.max(0, oldBV - thresholdsCrossed);
          breakReduction = oldBV - newBV;
          const bvMax = this._calcBreakValueMax(topItem);
          await topItem.update({ "system.breakValueCurrent": newBV });

          const broken = newBV === 0;
          const flavor = `<div style="font-size:0.9rem">` +
            `<b><i class="fas fa-shield-alt"></i> Break Value Reduced!</b><br>` +
            `<b>${topItem.name}</b> — crossed ${crossedNames.join(", ")}<br>` +
            `BV: ${oldBV} → <b>${newBV}</b> / ${bvMax}` +
            (broken ? `<br><span style="color:#e53935;font-weight:bold">BROKEN!</span>` : "") +
            `</div>`;
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: flavor
          });
        }
      }
    }

    // Structured log entry
    const cts = foundry.utils.deepClone(system.combatTabState || {});
    if (!cts.damageLog) cts.damageLog = [];
    const source = dc?.source || "wound";
    const category = dc?.category || "standard";
    cts.damageLog.push({
      round: cts.currentRound || 1,
      type: source === "wound" ? category : source,
      finalDamage: -damage,
      lpBefore: currentLP,
      lpAfter: newLP,
      sapBefore: sapAbsorbed > 0 ? sapBefore : undefined,
      sapAfter: sapAbsorbed > 0 ? sapAfter : undefined,
      steadfastResults: [],
      breakReduction: breakReduction > 0 ? breakReduction : undefined,
      thresholdsCrossed: crossedNames.length > 0 ? crossedNames : undefined
    });

    const updates = {
      "system.lifePoints.value": newLP,
      "system.combatTabState.damageLog": cts.damageLog
    };

    if (perfectPointsSpent > 0) {
      updates["system.tracking.perfectPoints"] = 0;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-circle"></i> Perfect Guard</b><br>Spent <b>${perfectPointsSpent}</b> Perfect Points<br>Reduced damage by <b>${perfectPointsReduction}</b> to <b>0</b></div>`
      });
    }
    if (smallHitNullified) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-shield-alt"></i> ${smallHitNullifySource}</b><br>Reduced damage by <b>${smallHitNullifyAmount}</b> to <b>0</b></div>`
      });
    }
    if (mightGuardTriggered) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-fist-raised"></i> ${mightGuardSource}</b><br>Reduced damage by <b>${mightGuardReduction}</b> through Might.</div>`
      });
    }
    if (sapAbsorbed > 0) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      const sapMax = specialResources.spectralArmorPoints?.max ?? sapBefore;
      const sapFinal = sapRegenAmount > 0 ? Math.min(sapMax, sapAfter + sapRegenAmount) : sapAfter;
      specialResources.spectralArmorPoints = {
        ...(specialResources.spectralArmorPoints || {}),
        value: sapFinal
      };
      updates["system.transformationMeta.specialResources"] = specialResources;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-shield-alt"></i> ${sapSource}</b><br>Absorbed <b>${sapAbsorbed}</b> damage with SAP<br>SAP: <b>${sapBefore}</b> → <b>${sapFinal}</b>${sapRegenAmount > 0 ? `<br>${sapRegenSource}: +<b>${Math.max(0, sapFinal - sapAfter)}</b> SAP` : ""}${sapAfter === 0 ? `<br>Transformation will exit.` : ""}</div>`
      });
    }
    if (draconicForceSpent) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      const currentDraconicForce = specialResources.draconicForce?.value ?? 0;
      if (currentDraconicForce > 0) {
        specialResources.draconicForce = {
          ...(specialResources.draconicForce || {}),
          value: Math.max(0, currentDraconicForce - 1)
        };
        updates["system.transformationMeta.specialResources"] = specialResources;
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-dragon"></i> ${draconicForceSource}</b><br>Spent <b>1</b> Draconic Force<br>Reduced damage by <b>${draconicForceReduction}</b></div>`
      });
    }
    if (kiGuardSpent > 0) {
      const currentKP = updates["system.kiPool.value"] ?? (system.kiPool?.value ?? 0);
      updates["system.kiPool.value"] = Math.max(0, currentKP - kiGuardSpent);
      if (kiGuardRecoveredDKP > 0) {
        const currentDKP = updates["system.divineKiPoints.value"] ?? (system.divineKiPoints?.value ?? 0);
        updates["system.divineKiPoints.value"] = currentDKP + kiGuardRecoveredDKP;
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-bolt"></i> ${kiGuardSource}</b><br>Spent <b>${kiGuardSpent}</b> Ki Points<br>Reduced damage by <b>${kiGuardReduction}</b>${kiGuardRecoveredDKP > 0 ? `<br>Regained <b>${kiGuardRecoveredDKP}</b> Divine Ki Points` : ""}</div>`
      });
    }
    if (natureKiSpent > 0) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      const currentNatureKi = specialResources.natureKi?.value ?? 0;
      if (currentNatureKi > 0) {
        specialResources.natureKi = {
          ...(specialResources.natureKi || {}),
          value: Math.max(0, currentNatureKi - natureKiSpent)
        };
        updates["system.transformationMeta.specialResources"] = specialResources;
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-leaf"></i> Nature Ki Guard</b><br>Spent <b>${natureKiSpent}</b> Nature Ki<br>Reduced damage by <b>${natureKiReduction}</b></div>`
      });
    }
    if (divineKiGuardSpent > 0) {
      const currentDKP = updates["system.divineKiPoints.value"] ?? (system.divineKiPoints?.value ?? 0);
      updates["system.divineKiPoints.value"] = Math.max(0, currentDKP - divineKiGuardSpent);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-sun"></i> ${divineKiGuardSource}</b><br>Spent <b>${divineKiGuardSpent}</b> Divine Ki Points<br>Reduced damage by <b>${divineKiGuardReduction}</b></div>`
      });
    }
    if (plateSpent) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      const currentPlates = specialResources.plates?.value ?? 0;
      if (currentPlates > 0) {
        specialResources.plates = {
          ...(specialResources.plates || {}),
          value: Math.max(0, currentPlates - 1)
        };
        updates["system.transformationMeta.specialResources"] = specialResources;
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-shield-alt"></i> Plates</b><br>Reduced damage by <b>${plateReduction}</b><br>Lost <b>1</b> Plate</div>`
      });
    }
    if (justiceChargeSpent) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      const currentCharges = specialResources.justiceCharge?.value ?? 0;
      if (currentCharges > 0) {
        specialResources.justiceCharge = {
          ...(specialResources.justiceCharge || {}),
          max: Math.max(specialResources.justiceCharge?.max ?? 0, justiceContext.max),
          value: Math.max(0, currentCharges - 1)
        };
        updates["system.transformationMeta.specialResources"] = specialResources;
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-shield-alt"></i> Justice Charge</b><br>Reduced damage by <b>${justiceChargeReduction}</b><br>Lost <b>1</b> Justice Charge</div>`
      });
    }
    if (deadOrAliveUsed) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || this.actor.system.transformationMeta?.specialResources || {});
      specialResources.justiceCharge = {
        ...(specialResources.justiceCharge || {}),
        max: Math.max(specialResources.justiceCharge?.max ?? 0, justiceContext.max),
        value: 0
      };
      updates["system.transformationMeta.specialResources"] = specialResources;
      const currentKP = updates["system.kiPool.value"] ?? (system.kiPool?.value ?? 0);
      const maxKP = system.kiPool?.max ?? 0;
      updates["system.kiPool.value"] = Math.min(maxKP, currentKP + defeatRecoveryKP);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div style="font-size:0.9rem"><b><i class="fas fa-heartbeat"></i> Dead or Alive</b><br>` +
          `Avoided defeat with <b>${justiceChargesLostOnDefeat}</b> Justice Charges` +
          `<br>LP set to <b>${newLP}</b>` +
          `<br>Regained <b>${Math.max(0, newLP - 1)}</b> LP and <b>${defeatRecoveryKP}</b> KP</div>`
      });
    }

    const activeUltraEgo = (system.transformations || []).find(t => t?.active && t.catalogKey === "ultra_ego");
    if (activeUltraEgo) {
      const specialResources = foundry.utils.deepClone(updates["system.transformationMeta.specialResources"] || system.transformationMeta?.specialResources || {});
      const tracked = await this._trackCombatUsage("lf:auto_ultra_ego_ego_on_hit", "round", 2, "Ultra Ego — Ego on Hit");
      if (tracked) {
        const currentEgo = specialResources.ego?.value ?? 0;
        const nextEgo = Math.min(6, currentEgo + 1);
        if (nextEgo > currentEgo) {
          specialResources.ego = {
            value: nextEgo,
            max: 6,
            source: "lf:auto_ultra_ego_ego_on_hit",
            sourceName: activeUltraEgo.name || "Ultra Ego"
          };
        }
      }

      const kpGain = Math.ceil(damage / 2);
      const currentKP = system.kiPool?.value ?? 0;
      const maxKP = system.kiPool?.max ?? 0;
      const newKP = Math.min(maxKP, currentKP + kpGain);
      updates["system.kiPool.value"] = newKP;
      updates["system.transformationMeta.specialResources"] = specialResources;

      const flavor = `<div style="font-size:0.9rem"><b><i class="fas fa-crown"></i> Ultra Ego</b><br>` +
        `Received <b>${damage}</b> damage` +
        (tracked ? `<br>+1 Ego` : `<br>Ego gain already capped this round`) +
        `<br>Regained <b>${newKP - currentKP}</b> KP</div>`;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: flavor
      });
    }

    // --- One-Sided Fusion: damage sharing (Possession) + threshold auto-eject (Absorption) ---
    const fusion = system.fusion || {};
    if (fusion.isFusion && damage > 0) {
      // Possession: share damage with host
      if (fusion.type === "one-sided-possession" && fusion.hostCurrentLP != null) {
        const hostLP = fusion.hostCurrentLP ?? 0;
        const newHostLP = Math.max(0, hostLP - damage);
        updates["system.fusion.hostCurrentLP"] = newHostLP;
        const hostId = (fusion.suppressedCharacterIds || [])[0];
        const hostActor = game.actors?.get(hostId);
        const hostName = hostActor?.name || "Host";
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="border-left:3px solid #9b59b6; padding:4px 8px;">
            <b>Possession — Damage Shared</b><br>
            ${this.actor.name} took <b>${damage}</b> damage. ${hostName}'s body also takes <b>${damage}</b> damage.<br>
            ${hostName}'s LP: ${hostLP} → <b>${newHostLP}</b>
            ${newHostLP <= 0 ? `<br><em style="color:#e74c3c;">⚠ ${hostName}'s body has reached 0 LP!</em>` : ""}
          </div>`
        });
        if (newHostLP <= 0) {
          setTimeout(() => {
            new Dialog({
              title: "Host Body Defeated",
              content: `<p><b>${hostName}</b>'s body has reached 0 LP while possessed by <b>${this.actor.name}</b>.</p><p>Choose what happens:</p>`,
              buttons: {
                defeated: {
                  icon: '<i class="fas fa-skull"></i>', label: "Be Defeated",
                  callback: async () => {
                    await this.actor.update({ "system.lifePoints.value": 0 });
                    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<b>${this.actor.name}</b> is defeated along with the host body.` });
                  }
                },
                endPossession: {
                  icon: '<i class="fas fa-sign-out-alt"></i>', label: "End Possession",
                  callback: async () => {
                    const sIds = this.actor.system.fusion?.suppressedCharacterIds || [];
                    if (sIds.length > 0) await this._onEjectSuppressed({ actorId: sIds[0] });
                  }
                }
              }, default: "endPossession"
            }).render(true);
          }, 200);
        }
      }
      // Absorption: track threshold crossings for auto-eject
      if (fusion.type === "one-sided-absorption" && thresholdsCrossed > 0) {
        updates["system.fusion.encounterThresholdsCrossed"] =
          (fusion.encounterThresholdsCrossed || 0) + thresholdsCrossed;
        // Non-Majin + knocked through 2+ thresholds BY A SINGLE ATTACK = auto-eject (rules line 39)
        const race = system.race || "";
        if (race !== "majin" && thresholdsCrossed >= 2) {
          const suppIds = fusion.suppressedCharacterIds || [];
          if (suppIds.length > 0) {
            const lastAbsorbed = suppIds[suppIds.length - 1];
            const deepIds = fusion.deeplySuppressed || [];
            const wasDeep = deepIds.includes(lastAbsorbed);
            setTimeout(() => {
              this._onEjectSuppressed({ actorId: lastAbsorbed, silent: true, skipSlowed: true });
              const ejectedActor = game.actors?.get(lastAbsorbed);
              const ejectedName = ejectedActor?.name || "Character";
              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: `<div style="border-left:3px solid #e74c3c; padding:4px 8px;">
                  <b>Health Threshold Auto-Eject</b><br>
                  ${this.actor.name} was knocked through ${thresholdsCrossed} health thresholds in a single attack!<br>
                  <b>${ejectedName}</b> (most recently absorbed) is automatically freed.
                  ${wasDeep ? `<br><em>${ejectedName} was Deeply Suppressed — they awaken in a <b>Sleeping</b> state.</em>` : ""}
                </div>`
              });
            }, 100);
          }
        }
      }
    }

    // --- Defend Maneuver (Guard): auto-pay KP cost. Runs AFTER the Ultra Ego
    // block so both effects compose on the same updates["system.kiPool.value"].
    // Skipped when Guard was already paid through the Defend Maneuver card. ---
    if ((dc?.defense || "none") === "guard" && !dc?.guardPaidViaCard) {
      await this._payGuardKi(system, updates);
    }
    // Defense choice + incoming EC are per-attack — reset so the next Apply
    // doesn't silently re-charge Guard or re-apply Direct Hit soak.
    if ((dc?.defense || "none") !== "none") {
      updates["system.damageCalc.defense"] = "none";
      updates["system.damageCalc.incomingEC"] = 0;
      updates["system.damageCalc.guardPaidViaCard"] = false;
    }

    await this.actor.update(updates, { dbuHealthDamage: event.dbuAttackingManeuver ? "attack" : "effect" });

    // --- Damage applied: public chat card + LP remaining whisper (GM/owner) ---
    {
      const defenseLabel = { none: "", directHit: "Direct Hit", guard: "Guard" }[dc?.defense || "none"] || "";
      const catLabel = (dc?.category || "standard");
      const chips = [
        `<span class="dbu-meta-chip">${catLabel}</span>`,
        defenseLabel ? `<span class="dbu-meta-chip">${defenseLabel}</span>` : "",
        `<span class="dbu-meta-chip">Soak+DR −${dc?.totalReduction ?? 0}</span>`
      ].filter(Boolean).join("");
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dbu-round-card dbu-damage-card">
          <div class="dbu-round-num dbu-damage-num"><i class="fas fa-heart-broken"></i> −${damage}</div>
          <div class="dbu-round-info">
            <span class="dbu-round-title">${this.actor.name} takes damage</span>
            <span class="dbu-round-detail">${chips}</span>
          </div>
        </div>`
      });
      const lpWhisperIds = game.users
        .filter(u => u.isGM || this.actor.testUserPermission(u, "OWNER"))
        .map(u => u.id);
      ChatMessage.create({
        content: `<div class="dbu-ki-deduct"><i class="fas fa-heart"></i> <b>${this.actor.name}</b>: LP ${currentLP} → <b>${newLP}</b> / ${system.lifePoints?.max ?? 0}</div>`,
        whisper: lpWhisperIds,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      });
    }

    if (sapExitTransformId) {
      const transformations = foundry.utils.deepClone(this.actor.system.transformations || []);
      const idx = transformations.findIndex(t => t?.id === sapExitTransformId);
      if (idx >= 0 && transformations[idx]?.active) {
        transformations[idx].active = false;
        await this.actor.update({ "system.transformations": transformations });
        await this._syncPersistentTransformationCombatStates(transformations);
        await this._syncPersistentTransformationResources(transformations);
        await this._syncPersistentTransformationFlags(transformations);
      }
    }
    if (divineKiGuardSpent > 0) {
      await this._applyDivineKiSpendSideEffects(divineKiGuardSpent, divineKiGuardSource || "Divine Ki Guard");
    }
  },

  async _onApplyHeal(event) {
    event.preventDefault();
    const dc = this.actor.system.damageCalc;
    const heal = dc?.woundRoll || 0;
    if (heal <= 0) return;
    const currentLP = this.actor.system.lifePoints?.value ?? 0;
    const maxLP = this.actor.system.lifePoints?.max || 0;
    const newLP = Math.min(maxLP, currentLP + heal);

    // Structured log entry
    const cts = foundry.utils.deepClone(this.actor.system.combatTabState || {});
    if (!cts.damageLog) cts.damageLog = [];
    cts.damageLog.push({
      round: cts.currentRound || 1,
      type: "heal",
      finalDamage: heal,
      lpBefore: currentLP,
      lpAfter: newLP,
      steadfastResults: []
    });

    await this.actor.update({
      "system.lifePoints.value": newLP,
      "system.combatTabState": cts
    });
  },

  async _onThresholdCheck(event) {
    const el = event.currentTarget;
    const name = el.name; // e.g. "system.thresholds.bruised.checked"
    await this.actor.update({ [name]: el.checked });
  },

  async _onConditionToggle(event) {
    const conditionId = event.currentTarget.dataset.conditionId;
    const conditions = foundry.utils.deepClone(this.actor.system.conditions || []);
    let cond = conditions.find(c => c.id === conditionId);
    if (cond) {
      cond.active = event.currentTarget.checked;
      if (!cond.active) cond.stacks = 0;
    } else {
      conditions.push({ id: conditionId, active: event.currentTarget.checked, stacks: 0 });
    }
    await this.actor.update({ "system.conditions": conditions });
  },

  /** Activate one or more Combat Conditions on this actor (batched update). */
  async _addSelfConditions(condIds = []) {
    const conditions = foundry.utils.deepClone(this.actor.system.conditions || []);
    for (const id of condIds) {
      const c = conditions.find(x => x.id === id);
      if (c) c.active = true;
      else conditions.push({ id, active: true, stacks: 0 });
    }
    await this.actor.update({ "system.conditions": conditions });
  },

  async _onConditionStack(event) {
    const conditionId = event.currentTarget.dataset.conditionId;
    const conditions = foundry.utils.deepClone(this.actor.system.conditions || []);
    let rawStacks = Number(event.currentTarget.value) || 0;
    // Enforce maxStacks from condition definition
    const condDefs = this._getCombatConditions(this.actor.system);
    const def = condDefs.find(d => d.id === conditionId);
    if (def?.maxStacks) rawStacks = Math.min(rawStacks, def.maxStacks);
    rawStacks = Math.max(0, rawStacks);
    let cond = conditions.find(c => c.id === conditionId);
    if (cond) {
      cond.stacks = rawStacks;
    } else {
      conditions.push({ id: conditionId, active: true, stacks: rawStacks });
    }
    await this.actor.update({ "system.conditions": conditions });
  },
};
