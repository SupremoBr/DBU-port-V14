import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';
import { registerConfig } from '../module/helpers/config.mjs';
import { installRules093 } from '../module/rules/config-v093.mjs';
import { roundPools093, convertStandardToCounter093 } from '../module/rules/actions-v093.mjs';
import { awakeningAMB, martialDie } from '../module/rules/path-to-power-v093.mjs';
import { signatureEnergyCharges093, validateTechnique093, validateTechniqueUsage093, techniqueKiCost093 } from '../module/rules/techniques-v093.mjs';
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
class SheetStub {
  constructor(actor) { this.actor=actor; this.isEditable=true; }
  activateListeners() {}
  async _updateObject(event, formData) { return this.actor.update(formData); }
}
class DialogStub {
  static lastRendered;
  static async wait() { return 'strike'; }
  static async confirm() { return true; }
  constructor(data, options) { this.data=data; this.options=options; }
  render() { DialogStub.lastRendered=this; }
}
globalThis.Actor=ActorStub; globalThis.ActorSheet=SheetStub;
globalThis.Dialog=DialogStub;
globalThis.foundry={ utils:{deepClone:structuredClone} };
globalThis.CONFIG={DBU:{}}; registerConfig(); installRules093(CONFIG.DBU);
globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
globalThis.game={user:{isGM:true},combat:null,actors:new Map()};
const { applyCatalogDescriptions }=await import('../module/rules/catalog-descriptions.mjs');
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

test('the racial factor picker shows race and general options and adds the selected trait manually', async () => {
  const original = globalThis.Handlebars;
  globalThis.Handlebars = { escapeExpression: value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;') };
  try {
    const actor = new ActorStub({ rulesVersion: '0.9.3', race: 'majin', racialTraits: ['existing-trait'] });
    const sheet = new DBUCharacterSheet(actor);
    await sheet._onAddTrait({ preventDefault() {}, currentTarget: { dataset: { racialFactors: '' } } });
    const { data } = DialogStub.lastRendered;
    assert.match(data.title, /Racial Factors — Majin/);
    assert.match(data.content, /Fatores da sua raça.*Assimilation.*Fatores gerais.*Armor Plating/s);
    assert.match(data.content, /Traces of Majin.*Troca Majin Regeneration/s);
    assert.doesNotMatch(data.content, /Mutant Core|Uncanny Monster/);
    const handlers = {};
    let search = '', listing = '';
    data.render({
      find(selector) {
        return selector === '.dbu-factor-search'
          ? { val: () => search, on: (event, callback) => handlers[event] = callback }
          : { html: value => listing = value };
      },
      on(event, selector, callback) { handlers[event] = callback; },
    });
    search = 'diluted';
    handlers.input();
    assert.match(listing, /Traces of Majin/);
    assert.doesNotMatch(listing, /Assimilation/);
    const selected = { currentTarget: { dataset: { traitId: 'r093_diluted_majin_traces_of_majin' } } };
    await handlers.click(selected);
    await handlers.click(selected);
    assert.deepEqual(actor.system.racialTraits, ['existing-trait', 'r093_diluted_majin_traces_of_majin']);
    assert.match(listing, /Na ficha/);
  } finally {
    globalThis.Handlebars = original;
  }
});

test('transformation details show current summaries and named options for previously saved forms', () => {
  const entry = Object.values(CATALOGS_093.transformations).find(form => form.name === 'Super Saiyan 1');
  const actor = new ActorStub({
    rulesVersion: '0.9.3',
    transformations: [{ catalogKey: entry.id, structuredTraits: [{ name: 'Legacy placeholder', effects: [] }] }],
  });
  new DBUCharacterSheet(actor)._onViewTransformationTraits({ preventDefault() {}, currentTarget: { dataset: { transIndex: '0' } } });
  const { data, options } = DialogStub.lastRendered;
  assert.ok(options.classes.includes('tf-traits-window'));
  assert.match(data.title, /Super Saiyan 1/);
  assert.match(data.content, /S-Cells.*Lv\.1.*4\+ stacks de Battle Born.*Lv\.2.*Power Up/s);
  assert.match(data.content, /Super Surger.*Super Speed.*Super Sturdy.*Super Specialist/s);
  assert.match(data.content, /Golden Power.*Duel Clashes.*Ki Surge/s);
  assert.match(data.content, /Regra completa no site/);
  assert.doesNotMatch(data.content, /Referência 0\.9\.3|Legacy placeholder/);
});

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

test('Attack Ref uses per-profile Wound CT in the preview', () => {
  const system = {
    rulesVersion: '0.9.3', level: 1, tier: 1, baseTier: 1,
    attackRefs: [{ foundation: 'Energy', profile: 'Cutting' }, { foundation: 'Energy', profile: 'Beam' }],
  };
  const sheet = new DBUCharacterSheet(new DBUActor(system));
  sheet.actor._getSelfBenefitAura = () => null;
  const context = {};
  sheet._prepareAttackRefData(context, system);
  assert.deepEqual(context.attackRefs.map(attack => [attack.strikeCT, attack.woundCT]), [[10, 5], [10, 10]]);
});

test('Dual Wielding Specialist adds current Tier to sheet, Basic Attack and Signature Strike with two usable equipped weapons', () => {
  const system = {
    rulesVersion: '0.9.3', level: 1, tier: 1, baseTier: 1,
    talents: ['r093_weapon_specialist', 'r093_dual_wielding_specialist'],
    aptitudes: { haste: Math.floor(3 / 2), awareness: 3 },
    attackRefs: [{ name: 'Simple', foundation: 'Physical', profile: 'Simple' }],
  };
  const actor = new DBUActor(system);
  actor._getSelfBenefitAura = () => null;
  const weapon = (name, worn) => ({ name, type: 'equipment', system: { equipmentType: 'weapon', weaponSize: 'standard', worn } });
  actor.items = [weapon('Sword', true), weapon('Spear', false)];
  const sheet = new DBUCharacterSheet(actor);
  const verifyStrike = expected => {
    system.aptitudes.strikeBuffTotal = 0;
    applyCatalogPassives093(system, system.tier, system.baseTier, actor.items);
    const context = {};
    sheet._prepareCombatRollsData(context, system);
    sheet._prepareAttackRefData(context, system);
    assert.equal(context.combatRolls.strike.total, `+${expected}`);
    assert.equal(context.attackRefs[0].strikeMod, expected);
    assert.ok(context.attackRefs[0].strikeFormula.endsWith(`+${expected}`));
    assert.ok(sheet._calcTechStrike(technique(), system, system.tier).formula.endsWith(`+${expected}`));
  };
  verifyStrike(4);
  actor.items[1].system.worn = true;
  verifyStrike(5);
  system.tier = 2;
  verifyStrike(6);
  actor.items[1].system.weaponLPDamage = 32;
  verifyStrike(4);
  system.talents = ['r093_weapon_specialist'];
  actor.items[1].system.weaponLPDamage = 0;
  verifyStrike(4);
});

test('Weapon talent passives respect size, count, Weapon Category and armed attack context', () => {
  const system = {
    rulesVersion: '0.9.3', level: 1, tier: 2, baseTier: 1,
    talents: ['r093_twin_weapon_specialist', 'r093_light_weapons_specialist', 'r093_heavy_weapons_specialist',
      'r093_iaijutsu_specialist', 'r093_critical_specialist', 'r093_variable_fighter', 'r093_variable_champion'],
    attackRefs: [{ foundation: 'Energy', profile: 'Beam' }, { foundation: 'Physical', profile: 'Simple', weaponEquipped: 'Sword' }],
  };
  const weapon = (name, weaponSize, weaponCategory) => ({ name, type: 'equipment',
    system: { equipmentType: 'weapon', worn: true, weaponSize, weaponCategory } });
  const sword = weapon('Sword', 'small', 'Sword');
  const dagger = weapon('Dagger', 'small', 'Sword');
  const bow = weapon('Bow', 'big', 'Bow');
  const actor = new DBUActor(system);
  actor._getSelfBenefitAura = () => null;
  const sheet = new DBUCharacterSheet(actor);
  const bonuses = items => {
    actor.items = items;
    system.aptitudes = {};
    applyCatalogPassives093(system, 2, 1, items);
    const apt = system.aptitudes;
    return [apt.strikeBuffTotal || 0, apt.woundBuffTotal || 0, apt.dodgeBuffTotal || 0,
      apt.unarmedAttackStrike || 0, apt.armedStrike || 0];
  };
  assert.deepEqual(bonuses([]), [0, 0, 2, 0, 0]);
  assert.deepEqual(bonuses([bow]), [2, 0, 0, 2, 2]);
  assert.deepEqual(bonuses([sword, dagger]), [0, 2, 0, 2, 0]);
  assert.deepEqual(bonuses([sword, bow]), [0, 0, 0, 2, 0]);
  assert.deepEqual(bonuses([sword]), [0, 4, 0, 2, 2]);
  const context = {};
  sheet._prepareAttackRefData(context, system);
  assert.deepEqual(context.attackRefs.map(attack => attack.strikeCT), [10, 9]);
  assert.equal(context.attackRefs[0].strikeMod, 2);
  assert.match(sheet._calcTechStrike(technique(), system, 2).formula, /\+2$/);
  assert.equal(sheet._calcCombatCTs(system, { isWeapon: true }).strikeCT, 9);
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
  sheet._calcAurasTotalTP = () => 8;
  const context = {};
  sheet._prepareAttackRefData(context, system);
  sheet._prepareTechniquesData(context, system);
  assert.match(context.attackRefs[0].woundFormula, /\+2d8\b/);
  assert.equal(context.attackRefs[0].damageCat, 'Standard');
  assert.equal(context.tpTotal, 5);
  assert.equal(context.tpSpentAuras, 0);
  assert.equal(context.tpRemaining, 5);
});

test('PL1 awards six slots and 25 TP once and both tabs count earned TP identically', () => {
  const rows = structuredClone(CONFIG.DBU.progressionRows);
  const converted = rows.find(row => row.level === 1 && row.convertible);
  converted.perkType = 'skill_improvement';
  converted.tp = 25; // An old form could save this default on the converted row.
  const system = { rulesVersion: '0.9.3', level: 1, progressionRows: rows };
  const sheet = new DBUCharacterSheet(new ActorStub(system));
  sheet.actor._getBuffTotal = () => 0;
  sheet._calcAurasTotalTP = () => 0;
  sheet._calcUniqueTotalTP = () => 0;
  for (const [level, total] of [[1, 40], [5, 55], [10, 70]]) {
    system.level = level;
    const context = {};
    sheet._prepareProgressionData(context, system);
    sheet._prepareTechniquesData(context, system);
    const improvements = context.progressionRows.filter(row => row.perkType === 'skill_improvement');
    assert.deepEqual(improvements.slice(0, 2).map(row => [row.maxSkillSlots, row.tp]), [[4, 15], [6, 25]]);
    assert.equal(context.totalTP, total);
    assert.equal(context.tpTotal, total);
    assert.equal(context.progressionPreview[0].tp, total);
    assert.equal(converted.tp, 25);
  }
});

test('the starting technique exempts one eligible technique without changing its Ki cost', async () => {
  const system = { rulesVersion: '0.9.3', level: 1, signatureTechniques: [
    technique({ id: 1, type: 'signature', startingTechnique: true }),
    technique({ id: 2, type: 'signature' }),
    technique({ id: 3, type: 'dramatic_finisher' }),
  ] };
  const sheet = new DBUCharacterSheet(new ActorStub(system));
  sheet.actor._getSelfBenefitAura = () => null;
  sheet._calcAurasTotalTP = () => 0;
  sheet._calcUniqueTotalTP = () => 0;
  const context = {};
  sheet._prepareTechniquesData(context, system);
  assert.equal(context.signatureTechniques[0].tpCost, 0);
  assert.equal(context.signatureTechniques[0].finalKP, context.signatureTechniques[1].finalKP);
  const checkbox = id => ({ currentTarget: { closest: () => null, dataset: { techId: String(id), field: 'startingTechnique' }, type: 'checkbox', checked: true } });
  const blocked = checkbox(3);
  await sheet._onTechniqueFieldChange(blocked);
  assert.equal(blocked.currentTarget.checked, false);
  await sheet._onTechniqueFieldChange(checkbox(2));
  assert.deepEqual(system.signatureTechniques.map(entry => Boolean(entry.startingTechnique)), [false, true, false]);
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

test('Path to Power unlocks the initial progression in order and keeps martial rows when disabled', async () => {
  const rows = structuredClone(CONFIG.DBU.progressionRows);
  rows.push({ id: -5, level: 1, perkType: 'attribute_addition', ag: 1 });
  for (const id of [6, 7, 8, 9, 10]) rows.find(row => row.id === id).ag = id === 9 ? 1 : 2;
  Object.assign(rows.find(row => row.id === 11), { skill0: 'Athletics', skill4: 'Perception', tp: 25 });
  const system = { rulesVersion: '0.9.3', level: 1, progressionRows: rows };
  const sheet = new DBUCharacterSheet(new ActorStub(system));
  sheet.actor._getBuffTotal = () => 0;
  sheet._calcUniqueTotalTP = () => 0;
  const ordinary = {};
  sheet._prepareProgressionData(ordinary, system);
  assert.equal(ordinary.pathToPowerAvailable, true);
  assert.equal(ordinary.totalTP, 25);
  system.pathToPower = { enabled: true, martialLevel: 1 };
  for (const [ml, points, die, lp, kp] of [[1, 6, 0, 40, 30], [2, 7, 4, 45, 35], [3, 9, 6, 50, 40], [4, 10, 8, 55, 45], [5, 10, 10, 60, 50]]) {
    system.pathToPower.martialLevel = ml;
    const context = {};
    sheet._prepareProgressionData(context, system);
    sheet._prepareTechniquesData(context, system);
    const earned = context.progressionRows.filter(row => row.martialEarned && row.level === 1);
    assert.equal(earned.filter(row => row.perkType === 'talent_addition').length, ml >= 4 ? 4 : ml >= 2 ? 3 : 2);
    assert.equal(earned.filter(row => row.convertible).length, ml >= 5 ? 1 : 0);
    assert.equal(earned.filter(row => row.perkType === 'martial_rank').length, ml >= 4 ? 2 : ml >= 2 ? 1 : 0);
    assert.equal(context.totalAttrPoints, points);
    assert.equal(context.totalSkillRanks, 1);
    assert.equal(earned.find(row => row.id === 11).maxSkillSlots, 4);
    assert.equal(context.totalTP, 15);
    assert.equal(context.tpTotal, 15);
    assert.equal(context.startingTechniqueAvailable, ml >= 3);
    assert.deepEqual([martialDie(system), context.martialBaseLife, context.martialBaseKi], [die, lp, kp]);
  }
  const context = {};
  sheet._prepareProgressionData(context, system);
  const martialRank = context.progressionRows.find(row => row.id === -2);
  await sheet._updateObject(null, { [martialRank.skillSlots[0].fieldName]: 'Perception' });
  assert.equal(system.progressionRows.find(row => row.id === -2).skill0, 'Perception');
  await sheet._updateObject(null, { 'system.pathToPower.enabled': false, 'system.progressionRows.6.ag': 2 });
  const disabled = {};
  sheet._prepareProgressionData(disabled, system);
  assert.equal(disabled.totalTP, 25);
  assert.equal(disabled.progressionRows.find(row => row.id === -2).martialHidden, true);
  assert.equal(system.progressionRows.find(row => row.id === -2).skill0, 'Perception');
  system.pathToPower.enabled = true;
  system.level = 2;
  assert.equal(martialDie(system), 0);
  system.pathToPower.remnant = true;
  assert.equal(martialDie(system), 10);
});

test('martial combat formulas and resources include the die and only the allowed charges', () => {
  const system = {
    rulesVersion: '0.9.3', level: 1, tier: 1, baseTier: 1, race: 'earthling',
    pathToPower: { enabled: true, martialLevel: 3 }, attributes: { te: { score: 2 } },
    lifePoints: {}, kiPool: {}, capacity: {}, status: {}, godKi: {}, divineKiPoints: {}, aptitudes: {},
    attackRefs: [{ name: 'Beam', foundation: 'Energy', profile: 'Beam', energyCharges: 5 }],
  };
  const actor = new DBUActor(system);
  actor._getBuffTotal = () => 0;
  actor._getActiveAura = () => null;
  actor._getSelfBenefitAura = () => null;
  actor._calculateResources(system, 1, 1, 1);
  assert.equal(system.lifePoints.max, 50 + 4 + 4);
  assert.equal(system.kiPool.max, 40);
  const sheet = new DBUCharacterSheet(actor);
  const context = {};
  sheet._prepareAttackRefData(context, system);
  const ref = context.attackRefs[0];
  for (const formula of [ref.strikeFormula, ref.woundFormula, ref.dodgeFormula]) assert.match(formula, /\+1d6\b/);
  assert.doesNotMatch(ref.woundFormula, /\+5d\d+/);
  const awakening = { transformationType: 'manifested_power' };
  assert.deepEqual([awakeningAMB(system, awakening, 2), awakeningAMB(system, awakening, 0)], [1, 0]);
  assert.equal(awakeningAMB(system, { transformationType: 'form_alternate' }, 2), 2);
});

test('limited martial techniques use Super costs and once-per-encounter usage', () => {
  const system = { rulesVersion: '0.9.3', level: 1, pathToPower: { enabled: true, martialLevel: 3 },
    thresholds: { crossedCount: 2 }, combatTabState: { rounds: [{ actions: [{ source: 'tech_1' }] }, { actions: [] }] } };
  const plain = technique({ id: 1, type: 'signature', extraEnergyCharges: 6 });
  const ultimate = { ...plain, type: 'ultimate' };
  assert.equal(techniqueKiCost093(ultimate, { system }).tpFull, techniqueKiCost093(plain).tpFull);
  assert.equal(signatureEnergyCharges093(ultimate, system), 3);
  assert.equal(validateTechniqueUsage093({ system }, ultimate).ok, false);
  assert.equal(validateTechniqueUsage093({ system }, { ...plain, id: 2 }).ok, true);
  const expensive = { ...plain, advantages: [{ name: 'Widespread Assault', ranks: 1, tpCost: 8 }] };
  assert.equal(validateTechnique093(expensive, system).ok, false);
  assert.equal(validateTechnique093({ ...expensive, startingTechnique: true }, system).ok, true);
  system.pathToPower.martialLevel = 2;
  assert.equal(validateTechnique093({ ...expensive, startingTechnique: true }, system).ok, false);
  system.pathToPower.martialLevel = 5;
  assert.equal(signatureEnergyCharges093(ultimate, system), 9);
});

test('the subrace selector lists real choices for the chosen race and leaves factors in Traits', () => {
  const options = (race, subrace = '') => {
    const system = { rulesVersion: '0.9.3', race, subrace };
    return new DBUCharacterSheet(new ActorStub(system))._getSubraceOptions(system);
  };
  assert.deepEqual(options('saiyan'), []);
  for (const saved of ['fullBlooded', 'Full-Blooded', 'Full-Blooded Saiyan']) {
    assert.deepEqual(options('saiyan', saved), []);
  }
  assert.deepEqual(options('namekian', 'dragonClan'), [
    { value: 'warriorClan', label: 'Warrior Clan', selected: false },
    { value: 'dragonClan', label: 'Dragon Clan', selected: true },
  ]);
  assert.deepEqual(options('neoTuffle').map(option => option.value), ['hatredEmbodiment', 'parasite']);
  assert.deepEqual(options('yardrat').map(option => option.value), ['tallYardrat', 'bulbousYardrat']);
  assert.deepEqual(options('glassTribe').map(option => option.value), ['glassUser', 'glassWarrior']);
  assert.deepEqual(options('demon').map(option => option.value), ['demonPerson', 'makyan', 'phantom']);
  assert.deepEqual(options('android'), []);
  assert.deepEqual(options('saiyan', 'ancient-saiyan'), options('saiyan'));
  assert.deepEqual(options('earthling', 'Saiyan Ancestry'), []);
  assert.ok(options('namekian', 'Dragon Clan').find(option => option.value === 'dragonClan').selected);
  assert.deepEqual(options('saiyan', 'Saiyan da Terra').find(option => option.selected),
    { value: 'Saiyan da Terra', label: 'Saiyan da Terra', selected: true });

  const trait = CATALOGS_093.racialTraits.saiyan.find(t => t.factor?.id === 'ancient-saiyan');
  assert.ok(trait);
  assert.equal(trait.subrace, '');
  const additional = CATALOGS_093.racialTraits.saiyan.find(t => t.traitCategory === 'secondary');
  const actor = new ActorStub({ subrace: 'Saiyan da Terra', subraceTraits: [additional.id, trait.id],
    racialTraits: [additional.id, trait.id] });
  const [subrace, factor] = applyCatalogDescriptions(actor, 'traits', [additional, trait]);
  assert.equal(subrace.isSubraceTrait, true);
  assert.equal(subrace.traitCategory, 'secondary');
  assert.equal(factor.isSubraceTrait, undefined);
  assert.deepEqual(actor.system.racialTraits, [additional.id, trait.id]);
});

test('an automated attack publishes one card with the native roll and the defense controls', async () => {
  const { attack } = await import('../module/automation/scripts/attack.js');
  const saved = { game, ChatMessage, Roll, Dialog, document: globalThis.document, randomID: foundry.utils.randomID };
  const messages = [];
  const actor = new ActorStub({
    rulesVersion: '0.9.3', tier: 1, baseTier: 1, kiPool: { value: 30 },
    status: { maxCapacity: 20 }, combatTabState: { rounds: [{ roundNumber: 1, actions: [] }] }
  });
  Object.assign(actor, { id: 'attacker', name: 'Atacante', getFlag: () => undefined, _getActiveAura: () => null });
  actor.sheet = new DBUCharacterSheet(actor);
  actor.sheet.getData = async () => ({});
  actor.sheet._trackerSourceGroups = [{ label: 'Attack Refs', sources: [
    { key: 'ref_0', name: 'Beam', foundation: 'Energy', profile: 'Beam', damageCat: 'Standard',
      strikeFormula: '1d10+10', woundFormula: '1d10+10', strikeCT: 10, woundCT: 10, kiCost: 2 }
  ] }];
  const defender = { id: 'defender', name: 'Defensor', system: {} };
  const scene = { id: 'scene' };
  const attackerToken = { id: 'attacker-token', actor, document: { parent: scene, actorLink: true } };
  const target = { id: 'defender-token', actor: defender, document: { parent: scene, actorLink: true } };
  try {
    let visuals = 0;
    actor.getFlag = (scope, key) => scope === 'DBU-MRR-OLD' && key === 'visualConfig'
      ? { attacks: { ref_0: { visualMode: 'custom', visualMacro: 'Visual Beam' } } } : undefined;
    globalThis.game = { combat: null, user: { isGM: true, targets: new Set() }, actors: new Map(),
      macros: { getName: () => ({ execute: async data => {
        assert.equal(messages[0]?.data._id, data.attackData.originalAttackMessageId);
        visuals++;
      } }) } };
    foundry.utils.randomID = () => 'UniqueAttackCard';
    globalThis.Dialog = { wait: async () => ({ index: 0, wager: 0, strikeBotch: 1, woundBotch: 1 }) };
    globalThis.ChatMessage = { getSpeaker: () => ({ actor: actor.id }), create: async (data, options) => {
      messages.push({ data, options });
      return { id: data._id };
    } };
    globalThis.Roll = class {
      constructor(formula) { this.formula = formula; this.total = 12; this.dice = [{ results: [{ result: 2 }] }]; }
      async evaluate() { return this; }
      toJSON() { return { formula: this.formula }; }
      static fromData(data) { return new this(data.formula); }
    };
    globalThis.document = { createElement: () => ({
      innerHTML: '', querySelector: () => null, querySelectorAll: () => []
    }) };

    const result = await attack({ attackerToken, targets: [target], __dbuaActionValidated: true });
    assert.equal(messages.length, 1);
    assert.equal(visuals, 1);
    const [{ data, options }] = messages;
    assert.deepEqual(options, { keepId: true });
    assert.equal(data._id, result.originalAttackMessageId);
    assert.equal(data._id, result.messageId);
    assert.equal(data.flags.world.dbuUnifiedAttackCard, true);
    assert.equal(data.flags['DBU-MRR-OLD'].attackReveal.revealed, false);
    assert.match(data.flags['DBU-MRR-OLD'].attackReveal.revealedHtml, /data-dbu-pay="combined"/);
    assert.match(data.content, /data-dbu-secret-attack-results/);
    assert.match(data.content, /data-target-row/);
    assert.doesNotMatch(data.content, /data-dbu-pay="combined"/);
    assert.equal(actor.system.combatTabState.rounds[0].actions.length, 1);
  } finally {
    const { randomID, ...globals } = saved;
    Object.assign(globalThis, globals);
    foundry.utils.randomID = randomID;
  }
});

test('the combined card reveals and attaches one native payment after the last defense', async () => {
  const { initializeRevealCore } = await import('../module/automation/scripts/combat/reveal-core.js');
  const saved = { game, document: globalThis.document, Hooks: globalThis.Hooks, DBU_BOOTSTRAP: globalThis.DBU_BOOTSTRAP };
  const targets = [{ id: 'first', name: 'Primeiro' }, { id: 'last', name: 'Último' }];
  const gm = { id: 'gm', isGM: true, active: true };
  const card = {
    id: 'unified', content: 'secret-results defense-controls',
    flags: {
      'DBU-MRR-OLD': { attackReveal: { revealed: false, revealedHtml: 'native-payment' } },
      world: { dbuUnifiedAttackCard: true, dbuCombatRevealed: false, dbuDefenseStates: {},
        dbuAttackData: { originalAttackMessageId: 'unified', attackerId: 'attacker',
          strikeTotal: 14, woundTotal: 12, targetActorIds: targets.map(target => target.id) } }
    },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) { applyUpdate(this, changes); }
  };
  const payment = { closest: () => null };
  let placements = 0;
  try {
    globalThis.Hooks = { on: () => 1 };
    globalThis.DBU_BOOTSTRAP = {};
    globalThis.game = { user: gm, users: Object.assign([gm], { get: () => gm }),
      socket: { on() {} }, messages: new Map([[card.id, card]]), actors: new Map(targets.map(t => [t.id, t])) };
    globalThis.document = { addEventListener() {}, createElement: () => ({
      innerHTML: '',
      querySelector(selector) {
        if (selector === '[data-dbu-pay]' && this.innerHTML === 'native-payment') return payment;
        if (selector !== '[data-dbu-secret-attack-results]' || !this.innerHTML.includes('secret-results')) return null;
        const wrapper = this;
        return {
          set innerHTML(value) { wrapper.innerHTML = wrapper.innerHTML.replace('secret-results', value); },
          append(node) { assert.equal(node, payment); wrapper.innerHTML += ' native-payment'; placements++; }
        };
      }
    }) };
    const reveal = initializeRevealCore({ DBU_SYSTEM_ID: 'DBU-MRR-OLD', dbuEsc: String, dbuSetDefenseState: async () => {} });
    await reveal.dbuUpdateTargetStatus(card, targets[0], 'defended', 'Dodge');
    assert.equal(card.flags.world.dbuCombatRevealed, false);
    assert.equal(placements, 0);
    await reveal.dbuUpdateTargetStatus(card, targets[1], 'defended', 'Dodge');
    assert.equal(card.flags.world.dbuCombatRevealed, true);
    assert.equal(card.flags['DBU-MRR-OLD'].attackReveal.revealed, true);
    assert.match(card.content, /defense-controls/);
    assert.match(card.content, /data-dbu-wound-total>12/);
    assert.equal(placements, 1);
  } finally {
    Object.assign(globalThis, saved);
  }
});
