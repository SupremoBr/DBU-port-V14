import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';
import { registerConfig } from '../module/helpers/config.mjs';
import { installRules093 } from '../module/rules/config-v093.mjs';
import { roundPools093, convertStandardToCounter093 } from '../module/rules/actions-v093.mjs';
import { techniqueKiCost093 } from '../module/rules/techniques-v093.mjs';
import { applyRacial093, applyRacialAttribute093, applyCatalogPassives093 } from '../module/rules/runtime-v093.mjs';
import { applyLegendRealized093, newLevelOfPower093 } from '../module/rules/transformations-v093.mjs';

function applyUpdate(object, updates) {
  for (const [path,value] of Object.entries(updates)) {
    const parts=path.split('.'); let into=object;
    while(parts.length>1) { const key=parts.shift(); into[key] ??= {}; into=into[key]; }
    into[parts[0]]=structuredClone(value);
  }
}
class ActorStub { constructor(system) { this.system=system; this.uuid='Actor.a'; this.items=[]; } async update(updates) { applyUpdate(this,updates); } }
class SheetStub { constructor(actor) { this.actor=actor; this.isEditable=true; } activateListeners() {} }
globalThis.Actor=ActorStub; globalThis.ActorSheet=SheetStub;
globalThis.Dialog={ wait:async () => 'strike', confirm:async () => true };
globalThis.foundry={ utils:{deepClone:structuredClone} };
globalThis.CONFIG={DBU:{}}; registerConfig(); installRules093(CONFIG.DBU);
globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
globalThis.game={user:{isGM:true},combat:null,actors:new Map()};
const { DBUActor }=await import('../module/documents/actor.mjs');
const { DBUCharacterSheet }=await import('../module/sheets/character-sheet.mjs');
const { installRulesSheet093, transformationCanActivate093 }=await import('../module/rules/sheet-v093.mjs');
const { validateActionUse, standardActionBudget }=await import('../module/automation/scripts/action-economy.js');
const { dbuRecordDefend }=await import('../module/automation/scripts/core/round-tracker.js');
installRulesSheet093(DBUCharacterSheet);
function activeCombat(actor) {
  const combatant={actor}; game.combat={id:'combat',round:1,turn:0,started:true,combatant,combatants:[combatant]};
}
const technique=(extra={})=>({foundation:'Energy',profile:'Beam',advantages:[],disadvantages:[],...extra});

test('actual signature creation uses the full Profile floor and separate half-Profile usage floor',()=>{
  const tech=technique({advantages:[{name:'Efficiency',ranks:2,tpCost:15}],freeTP:20});
  const initial=techniqueKiCost093(tech);
  assert.equal(initial.tpFull,23); assert.equal(initial.creationKP,8); assert.equal(initial.finalKP,8);
  assert.equal(techniqueKiCost093(tech,{usageDiscount:8}).finalKP,4);
  assert.equal(techniqueKiCost093(tech,{usageDiscount:8,usageSurcharge:2}).finalKP,6);
  assert.equal(techniqueKiCost093(technique({profile:'Sphere'})).finalKP,null);
  assert.equal(techniqueKiCost093(technique({profile:'Blitz',foundation:'Physical'})).finalKP,4);
});
test('native and embedded actions share one budget, enforce turn and allow explicit rule-granted bonuses',async()=>{
  const actor=new ActorStub({rulesVersion:'0.9.3',combatTabState:{rounds:[{roundNumber:1,actions:[{type:'attack'},{type:'movement'}]}]}});
  activeCombat(actor);
  assert.equal(standardActionBudget(actor).remaining,1);
  assert.equal((await convertStandardToCounter093(actor)).ok,true);
  assert.equal(roundPools093(actor).counter.remaining,2);
  assert.equal(validateActionUse(actor,{notify:false}).ok,false);
  assert.equal(validateActionUse(actor,{notify:false,limitBonus:1}).ok,true);
  assert.equal(validateActionUse(actor,{notify:false,effectiveType:'counter',isAttackTarget:true}).ok,true);
  game.combat.combatant={actor:{uuid:'other'}};
  assert.equal(validateActionUse(actor,{notify:false,limitBonus:1}).ok,false);
  assert.equal(validateActionUse(actor,{notify:false,limitBonus:1,timingOverride:true}).ok,true);
});
test('a defense recorded by the embedded module consumes one Counter Action, represented only once',async()=>{
  const actor=new ActorStub({rulesVersion:'0.9.3',tier:1,combatTabState:{rounds:[{roundNumber:1,actions:[]}]}});
  activeCombat(actor);
  await dbuRecordDefend(actor,'parry');
  assert.equal(roundPools093(actor).counter.spent,1);
  assert.equal(roundPools093(actor).counter.remaining,0);
  assert.equal(validateActionUse(actor,{notify:false,effectiveType:'counter',isAttackTarget:true}).ok,false);
  await convertStandardToCounter093(actor);
  assert.equal(validateActionUse(actor,{notify:false,effectiveType:'counter',isAttackTarget:true}).ok,true);
});
test('actual actor saving throw calculation grants Yardrat two racial saves',()=>{
  const actor=new DBUActor({rulesVersion:'0.9.3',race:'yardrat',attributes:{ag:{score:4},te:{score:3},in:{score:5},pe:{score:2}},combatStates:{},aptitudes:{}});
  actor._getSelfBenefitAura=()=>null; actor._getActiveAura=()=>null; actor._getBuffTotal=()=>0;
  actor._calculateSavingThrows(actor.system,2);
  assert.equal(actor.system.savingThrows.impulsive.bonus,6);
  assert.equal(actor.system.savingThrows.cognitive.bonus,7);
  assert.equal(actor.system.savingThrows.corporeal.bonus,3);
  assert.equal(actor.system.savingThrows.impulsive.proficient,true);
  assert.equal(actor.system.savingThrows.cognitive.proficient,true);
});
test('new Saiyan passives replace the old wager bonus and use actual Force Modifier',()=>{
  const traits=CATALOGS_093.racialTraits.saiyan;
  const id=name=>traits.find(t=>t.name===name).id;
  const sys={rulesVersion:'0.9.3',race:'saiyan',racialTraits:['Born for Battle','Blood of the Warrior','Powerful Physique','Warrior’s Pride','Saiyan Heritage'].map(id),racialOptionSelections:{[id('Saiyan Heritage')]:{'5':'Tailless'}},attributes:{fo:{score:8,modifier:2,totalScore:10}},aptitudes:{},status:{soak:0,healingSurge:'2d10+8',powerSurgeKi:20},battleBorn:{strike:1,dodge:0,wound:1},thresholds:{crossedCount:2},tracking:{powerStacks:2},savingThrows:{cognitive:{bonus:3}},transformations:[{active:true,transformationType:'enhancement_standard'}]};
  applyRacialAttribute093(sys,2); assert.equal(sys.attributes.fo.totalScore,12);
  applyRacial093(sys,2,1);
  assert.equal(sys.battleBorn.woundBonus,8); // 2 Born + 4 Blood + 2 Tailless.
  assert.equal(sys.status.soak,9); // 3 Physique + 4 Blood + 2 Tailless.
  assert.equal(sys.status.powerSurgeKi,24);
  assert.equal(sys.savingThrows.cognitive.bonus,5);
  assert.equal(sys.aptitudes.bloodOfWarriorKiWagerThreshold,undefined);
});
test('compiled current passive honors the same toggle key used by the talent card',()=>{
  const talent=CATALOGS_093.talents.find(t=>t.name==='Focused Strike');
  assert.equal(talent.effects[0].mechanic.target,'strikeCTBonus');
  const sys={rulesVersion:'0.9.3',talents:[talent.id],aptitudes:{},status:{}};
  applyCatalogPassives093(sys,2,1); assert.equal(sys.aptitudes.strikeCTBonus,1);
  sys.aptitudes={}; sys.effectTracking={enabledPassives:{[`talent_${talent.id}_1`]:false}};
  applyCatalogPassives093(sys,2,1); assert.equal(sys.aptitudes.strikeCTBonus,undefined);
});
test('actual sheet delegates current KP and preserves permanent Awakening and slot constraints',()=>{
  const actor=new ActorStub({rulesVersion:'0.9.3',baseTier:1});
  const sheet=new DBUCharacterSheet(actor);
  assert.equal(sheet._calcTechKP(technique()).finalKP,10);
  assert.equal(transformationCanActivate093(actor,[{active:true,transformationType:'form_alternate'},{active:true,transformationType:'enhancement_transcendent'}]).ok,false);
  assert.equal(transformationCanActivate093(actor,Array.from({length:3},()=>({active:true,transformationType:'manifested_power',awakeningType:'Lesser'}))).ok,false);
  assert.equal(sheet._calcCombatCTs(actor.system,{profile:'Cutting'}).woundCT,5);
});
test('Legend Realized groups by Form type and Tier and doubles only for the current NLoP form',async()=>{
  const trans={id:1,name:'Form A',active:true,transformationType:'form_alternate',tierRequirement:'2+'};
  const actor=new ActorStub({rulesVersion:'0.9.3',tier:2,level:5,transformations:[trans],lifePoints:{max:100,value:1},kiPool:{max:100,value:1},transformationMeta:{enteredViaManeuver093:[1],nlopActiveEncounter:['Form A']}});
  const RollClass=class{async evaluate(){this.total=20;return this;}};
  assert.equal(await applyLegendRealized093(actor,trans,{RollClass}),true);
  assert.equal(actor.system.lifePoints.value,41);
  assert.equal(await applyLegendRealized093(actor,{...trans,id:2,name:'Form B'},{RollClass}),false);
  assert.equal(await applyLegendRealized093(actor,trans,{RollClass}),false);
});
test('New Level of Power rejects temporary Awakenings and multiple simultaneous benefits',async()=>{
  const a={id:1,name:'Awakening',active:true,transformationType:'manifested_power'};
  const actor=new ActorStub({transformations:[a],lifePoints:{max:101,value:1},kiPool:{max:51,value:1}});
  assert.equal((await newLevelOfPower093(actor,{...a,temporaryAwakening:true})).ok,false);
  assert.equal((await newLevelOfPower093(actor,a)).ok,true);
  assert.equal(actor.system.lifePoints.value,51);
  assert.equal(actor.system.kiPool.value,26);
  assert.equal((await newLevelOfPower093(actor,{...a,id:2,name:'Other'})).ok,false);
});

test('current Crushing and Cutting formulas preserve Force and use the reviewed Strike rules',()=>{
  const actor=new ActorStub({rulesVersion:'0.9.3',tier:1,baseTier:1,aptitudes:{haste:8,awareness:6},attributes:{fo:{totalScore:10},ma:{totalScore:8}},tracking:{},dicePools:{}});
  actor._getSelfBenefitAura=()=>null;
  const sheet=new DBUCharacterSheet(actor);
  const crushing=sheet._calcTechStrike({foundation:'Physical',profile:'Crushing'},actor.system,1).formula;
  const cutting=sheet._calcTechStrike({foundation:'Energy',profile:'Cutting'},actor.system,1).formula;
  assert.match(crushing,/\+10$/); assert.match(cutting,/\+14$/);
  assert.match(sheet._calcTechWound({foundation:'Physical',profile:'Crushing'},actor.system,1).formula,/\+10$/);
  assert.match(sheet._calcTechWound({foundation:'Energy',profile:'Beam'},actor.system,1).formula,/1d8/);
});

test('actual native roll applies Clearing natural minimum and records the executed action once',async()=>{
  const messages=[];
  globalThis.ChatMessage={getSpeaker:()=>({}),create:async data=>{messages.push(data);return data;}};
  globalThis.Roll=class {
    constructor(formula){this.formula=formula;this.total=12;this.dice=[{results:[{result:2}]}];}
    async evaluate(){return this;} toJSON(){return {formula:this.formula,total:this.total};}
  };
  const actor=new ActorStub({rulesVersion:'0.9.3',tier:1,baseTier:1,kiPool:{value:30},status:{maxCapacity:20},combatTabState:{rounds:[{roundNumber:1,actions:[{type:'attack',source:'ref_0'}]}]}});
  actor._getActiveAura=()=>null; activeCombat(actor);
  const sheet=new DBUCharacterSheet(actor);
  sheet._trackerSourceGroups=[{sources:[{key:'ref_0',name:'Clearing',profile:'Clearing',foundation:'Energy',damageCat:'Standard',strikeFormula:'1d10+10',woundFormula:'1d10+10',strikeCT:10,woundCT:10}]}];
  const event={preventDefault(){},currentTarget:{dataset:{round:'1',actionIndex:'0'}}};
  await sheet._onRollTrackerAttack(event);
  assert.equal(messages.length,1);
  assert.equal(messages[0].flags['DBU-MRR-OLD'].attackReveal.strikeTotal,15);
  assert.equal(actor.system.combatTabState.rounds[0].actions[0].rules093Executed,true);
  await sheet._onRollTrackerAttack(event);
  assert.equal(messages.length,1);
});

test('current defense costs use base Tier, free Flare/Counter, and Guard Down after discounts',async()=>{
  const { defendKiCost093 }=await import('../module/rules/defenses-v093.mjs');
  const system={rulesVersion:'0.9.3',tier:4,baseTier:2,aptitudes:{}};
  assert.equal(defendKiCost093(system,'powerFlare'),0);
  assert.equal(defendKiCost093(system,'crossCounter'),0);
  assert.equal(defendKiCost093(system,'guard',2),20);
  assert.equal(defendKiCost093({...system,baseTier:1,aptitudes:{guardKPReduction:2},conditions:[{id:'guardDown',active:true}]},'guard',1),10);
  const actor=new ActorStub(system),sheet=new DBUCharacterSheet(actor);
  system.damageCalc={incomingEC:2};
  assert.equal(sheet._calcGuardKiCost(system),20);
});

test('Warrior Pride Superior ignores penalties while preserving threshold count and raw conditions',()=>{
  const pride=CATALOGS_093.racialTraits.saiyan.find(t=>t.name==='Warrior’s Pride');
  const system={rulesVersion:'0.9.3',race:'saiyan',racialTraits:[pride.id],combatStates:{superior:true},lifePoints:{max:100,value:5},thresholds:{bruised:{},injured:{},critical:{}},status:{},conditions:[{id:'fatigued',active:true,stacks:2},{id:'impaired',active:true,stacks:1}]};
  const actor=new DBUActor(system);
  actor._calculateThresholds(system,2,1);
  assert.equal(system.thresholds.crossedCount,3);
  assert.equal(system.thresholds.penalties,0);
  assert.equal(actor._getConditionStacks(system,'fatigued'),0);
  assert.equal(system.conditions[0].stacks,2);
  system.combatStates.superior=false;
  actor._calculateThresholds(system,2,1);
  assert.equal(system.thresholds.penalties,3);
  assert.equal(actor._getConditionStacks(system,'fatigued'),2);
});

test('Dramatic Finisher includes the additional Super Profile cost and validates its configuration',async()=>{
  const { superProfileKiUnits093, SUPER_PROFILES_093 }=await import('../module/rules/super-profiles-v093.mjs');
  assert.equal(Object.keys(SUPER_PROFILES_093).length,12);
  const base=technique({type:'dramatic_finisher',superProfile:'Super Beam'});
  assert.equal(techniqueKiCost093(base).profileBaseKP,10); // Beam 8 + Super Beam 2.
  assert.equal(techniqueKiCost093(base).kpCost,13); // 12 TP -> 3(T).
  assert.equal(techniqueKiCost093(technique({type:'dramatic_finisher'})).ok,false);
  assert.equal(techniqueKiCost093({...base,profile:'Blast'}).ok,false);
  assert.equal(superProfileKiUnits093({superProfile:'Giga Flare',superProfileActions:2}),4);
  assert.equal(superProfileKiUnits093({superProfile:'Multi-Profile',profile:'Beam',secondaryProfile:'Blitz'}),1);
  assert.equal(superProfileKiUnits093({superProfile:'Multi-Profile',profile:'Beam',secondaryProfile:'Beam'}),null);
});

test('custom buffs accept saved aliases and combine active signed values using base and current Tier', () => {
  const system = {
    baseTier: 2,
    tier: 3,
    customBuffs: [
      { effect: '  strike   (ALL) ', active: true, flat: '5', bT: -2, T: 1 },
      { effect: 'Strike', active: false, flat: 100 },
      { effect: '', active: true, flat: 100 },
    ],
    _derivedBuffs: [{ effect: 'Strike', active: true, flat: 3 }],
  };
  const actor = new DBUActor(system);
  assert.equal(actor._getBuffTotal(system, 'Strike'), 7);
  assert.equal(actor._getBuffTotal(system, ''), 0);
});

test('Signature-only custom buffs reach Strike and Wound formulas and their Critical Targets', () => {
  const system = {
    rulesVersion: '0.9.3', baseTier: 2, tier: 2,
    combatStates: { superior: true },
    aptitudes: { superiorDiceSize: 1, attackingDamageCategory: 1, strikeCTBonus: -1 },
    dicePools: {
      signature: {
        strikeBonus: 5, woundBonus: 7, ctStrike: 2, ctWound: 1,
        topAll: 1, topWound: 1,
        diceAll: { d6: 1 }, diceWound: { d6: 2 },
      },
    },
  };
  const actor = new ActorStub(system);
  actor._getActiveAura = () => null;
  actor._getSelfBenefitAura = () => null;
  const sheet = new DBUCharacterSheet(actor);
  const tech = technique({ foundation: 'Physical', profile: 'Simple' });
  const strike = sheet._calcTechStrike(tech, system, 2).formula;
  const wound = sheet._calcTechWound(tech, system, 2);
  assert.equal(strike, '1d10+1d4+1d4+1d8+5+1d6');
  assert.equal(wound.formula, '1d10+1d4+1d4+1d4+1d8+7+3d6');
  assert.equal(wound.damageCat, 'Direct');
  assert.equal(sheet._calcTechCT(tech, system).strikeCT, 9);
  assert.equal(sheet._calcTechCT(tech, system).woundCT, 9);
  assert.equal(sheet._calcTechCT({ ...tech, profile: 'Cutting' }, system).woundCT, 5);
  assert.equal(sheet._calcCombatCTs(system).woundCT, 10);
});

test('attack Ki regular discounts respect the floor and no-cap discounts apply after it', async () => {
  const { attackKiWithBuffs, energyChargeDie, manualBuffEffect } = await import('../module/helpers/custom-buffs.mjs');
  assert.equal(attackKiWithBuffs(8, 4, { kiCostAttacks: -7 }), 4);
  assert.equal(attackKiWithBuffs(8, 4, { kiCostAttacks: -7, kiCostAttacksNoCap: -2 }), 2);
  assert.equal(attackKiWithBuffs(8, 4, { kiCostAttacksNoCap: -99 }), 0);
  assert.equal(energyChargeDie({ energyChargeDiceCategory: 1 }), 'd8');
  assert.equal(energyChargeDie({ energyChargeDiceCategory: 1, signatureEnergyChargeDiceCategory: 1 }, { signature: true }), 'd12');
  assert.equal(manualBuffEffect(' I’m being Bludgeoned '), true);
});

test('basic attacks use charged dice and damage category buffs, and the technique tab includes earned bonus TP', () => {
  const system = {
    rulesVersion: '0.9.3', level: 5, tier: 1, baseTier: 1,
    aptitudes: { energyChargeDiceCategory: 1, attackingDamageCategory: -1 },
    customBuffs: [{ effect: 'TP per Skill Improvement', active: true, flat: 3 }],
    attackRefs: [{ name: 'Beam test', profile: 'Beam', foundation: 'Energy', energyCharges: 1 }],
    progressionRows: [
      { level: 3, perkType: 'skill_improvement', tp: 2 },
      { level: 7, perkType: 'skill_improvement', tp: 2 },
    ],
  };
  const actor = new DBUActor(system);
  actor._getSelfBenefitAura = () => null;
  const sheet = new DBUCharacterSheet(actor);
  const context = {};
  sheet._prepareAttackRefData(context, system);
  sheet._prepareTechniquesData(context, system);
  assert.match(context.attackRefs[0].woundFormula, /\+2d8\b/);
  assert.equal(context.attackRefs[0].damageCat, 'Standard');
  assert.equal(context.tpTotal, 30);
});

test('owned linked buffs stack and a 50% LP trigger switches off on healing to the threshold', async () => {
  const { applyConditionalCustomBuffs, customBuffState, linkedCatalogBuffs } = await import('../module/helpers/custom-buffs.mjs');
  const conditional = { active: true, effect: 'Strike (All)', flat: 2, T: 1, trigger: 'lpBelow', triggerPercent: 50 };
  const system = {
    racialTraits: ['trait-a'], talents: ['talent-a', 'talent-a'],
    tier: 2, baseTier: 1, lifePoints: { value: 49, max: 100 },
    aptitudes: { strikeBuffTotal: 10 },
    customBuffs: [{ active: true, effect: 'Strike', flat: 1 }],
  };
  const actor = new DBUActor(system);
  const always = { active: true, effect: 'Strike', flat: 3 };
  const inactive = { ...conditional, active: false };
  actor.getFlag = () => ({
    traits: { 'trait-a': [always, inactive], 'removed-trait': [always] },
    talents: { 'talent-a': [conditional], 'removed-talent': [always] },
  });
  const linked = linkedCatalogBuffs(actor);
  assert.equal(linked.length, 3);
  assert.equal(actor._getBuffTotal(system, 'Strike'), 4); // Early calculation excludes triggers.
  applyConditionalCustomBuffs(system, linked);
  assert.equal(system.aptitudes.strikeBuffTotal, 14);
  assert.equal(customBuffState(conditional, system), 'active');

  // A new preparation cycle starts from rebuilt attributes.
  system.lifePoints.value = 50;
  system.aptitudes.strikeBuffTotal = 10;
  applyConditionalCustomBuffs(system, linked);
  assert.equal(system.aptitudes.strikeBuffTotal, 10);
  assert.equal(customBuffState(conditional, system), 'waiting');
  assert.equal(customBuffState(inactive, system), 'disabled');
  assert.equal(customBuffState({ ...conditional, effect: 'Max Life Points' }, system), 'unsupported');
  assert.equal(customBuffState({ ...conditional, trigger: 'raging' }, { combatStates: { raging: true } }), 'active');
});
