import { applyCatalogDescriptions, editCatalogDescription } from './catalog-descriptions.mjs';
import { SUPER_PROFILES_093 } from "./super-profiles-v093.mjs";
import { defendKiCost093 } from "./defenses-v093.mjs";
import { applyLegendRealized093, newLevelOfPower093, requiresTransformationReview093 } from "./transformations-v093.mjs";
import { Dialog } from '../helpers/foundry-compat.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';
import { RACES_093 } from './races-v093.mjs';
import { uses093, awakeningLimits, validateTransformationStack, fullAwakeningRecovery, stackedStressRequirement } from './v093.mjs';
import { roundPools093, convertStandardToCounter093, isOwnTurn093, inCombat093, rowActionType093, rowCost093 } from './actions-v093.mjs';
import { validateTechnique093, validateTechniqueUsage093, maximumWager093 } from './techniques-v093.mjs';
import { racialEffectEnabled093 } from './runtime-v093.mjs';
import { adjustRacialResource093, racialEncounterReset093, racialResourceView093, racialTurnReset093, rollPressure093, useMakyanPower093 } from './racial-resources-v093.mjs';
import { editAttackGrant093 } from './attack-grants-v093.mjs';
const installed = new WeakSet();
const warn = message => { ui.notifications.warn(message); return false; };
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function transformationCanActivate093(actor, rows) {
  if (rows.some(t => t.active && requiresTransformationReview093(t))) return { ok: false, reason: 'AMB variável: preencha os valores da tabela oficial antes de ativar.' };
  const stacking = validateTransformationStack(rows);
  if (!stacking.ok) return { ok: false, reason: '0.9.3: limite de uma Form e um Enhancement. Enhancement Transcendente ocupa a vaga de Form.' };
  const limits = awakeningLimits(actor.system.baseTier || 1);
  for (const [kind, maximum] of Object.entries(limits)) {
    if (rows.filter(t => t.active && t.transformationType === 'manifested_power' && String(t.awakeningType).toLowerCase() === kind).length > maximum) return { ok: false, reason: `0.9.3: limite ${maximum} de Awakenings ${kind}.` };
  }
  return { ok: true };
}
export async function fullAwakening093(actor, transformationIndex) {
  const rows = structuredClone(actor.system.transformations || []);
  const row = rows[transformationIndex], entry = CATALOGS_093.transformations[row?.catalogKey];
  if (!row || String(row.awakeningType).toLowerCase() !== 'super' || !entry?.traitGroups.some(g => g.kind === 'grandAwakening')) return warn('Selecione uma Super Awakening com Grand Awakening.');
  if (actor.system.rules093State?.fullAwakeningUsed) return warn('Full Awakening já usada neste encontro.');
  if (inCombat093(actor) && (!isOwnTurn093(actor) || roundPools093(actor).standard.remaining < 1)) return warn('Full Awakening exige seu turno e uma Standard Action.');
  // The Grand Trigger is a prerequisite selected by the player/GM, never guessed.
  const confirmed = await Dialog.confirm({ title: 'Full Awakening', content: `<p>O Grand Trigger de <b>${escape(row.name)}</b> foi satisfeito? O uso consome 1 Standard Action e recupera ¼ dos máximos de LP e Ki.</p>` });
  if (!confirmed) return false;
  const recovery = fullAwakeningRecovery(actor.system.lifePoints.max, actor.system.kiPool.max);
  const cts = structuredClone(actor.system.combatTabState || {});
  cts.rounds ??= [{ roundNumber: 1, actions: [] }]; if (!cts.rounds.length) cts.rounds.push({ roundNumber: 1, actions: [] });
  cts.rounds.at(-1).actions.push({ type: 'standard', actionCost: 1, description: 'Full Awakening: ' + row.name, dbuOutsideCombat: !inCombat093(actor) });
  await actor.update({ 'system.rules093State.fullAwakeningUsed': true, 'system.combatTabState': cts, 'system.lifePoints.value': Math.min(actor.system.lifePoints.max, actor.system.lifePoints.value + recovery.life), 'system.kiPool.value': Math.min(actor.system.kiPool.max, actor.system.kiPool.value + recovery.ki) });
  ui.notifications.info('Full Awakening: recuperação aplicada. Resolva o efeito Grand Awakening na fonte oficial.');
  return true;
}

export function installRulesSheet093(Sheet) {
  if (installed.has(Sheet)) return;
  installed.add(Sheet);
  const wrap = (name, fn) => {
    const original = Sheet.prototype[name];
    if (typeof original !== 'function') throw new Error('Método de ficha ausente: ' + name);
    Object.defineProperty(Sheet.prototype, name, { configurable: true, writable: true, value: function(...args) {
      return uses093(this.actor.system) ? fn.call(this, original.bind(this), ...args) : original.apply(this, args);
    } });
  };
  wrap('_getCharacterTraits', function(original, system) {
    return applyCatalogDescriptions(this.actor, 'traits', original(system));
  });
  wrap('_getCharacterTalents', function(original, system) {
    return applyCatalogDescriptions(this.actor, 'talents', original(system));
  });
  wrap('activateListeners', function(original, html) {
    original(html); if (!this.isEditable) return;
    html.on('click', '[data-rules093-attack-grant]', async event => {
      const { rules093AttackGrant, grantName } = event.currentTarget.dataset;
      await editAttackGrant093(this.actor, Number(rules093AttackGrant), grantName);
    });
    html.on('click', '[data-rules093-resource]', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (button.dataset.rules093Resource === 'turn') {
          if (inCombat093(this.actor)) return;
          const { system } = this.actor;
          const changes = { ...racialTurnReset093(system, 'start'), ...racialTurnReset093(system, 'end') };
          if (Object.keys(changes).length) await this.actor.update(changes);
        } else if (button.dataset.rules093Resource === 'makyanPower') {
          if (!(await useMakyanPower093(this.actor))) warn('Power Up Makyan indisponível nesta rodada ou encontro.');
        } else {
          await adjustRacialResource093(this.actor, button.dataset.rules093Resource, Number(button.dataset.delta));
        }
      } finally { button.disabled = false; }
    });
    html.on('click', '[data-rules093-pressure]', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const { system } = this.actor;
        const view = racialResourceView093(this.actor);
        const choices = [
          [racialEffectEnabled093(system, 'Denizen of the Demon Realm'), 'denizen', '+1 se você impôs uma condição a um oponente'],
          [view.canUseCreativity, 'creative', 'Demonic Creativity · 2d10, use o maior'],
          [racialEffectEnabled093(system, 'Demons of the Makyo Star', 4), 'makyan', 'Makyan · −2 no teste, +1 Power se passar']
        ].filter(([available]) => available);
        const options = choices.length ? await Dialog.wait({
          title: 'Pressure Check',
          content: choices.map(([, name, label]) => `<div><label><input type="checkbox" name="${name}"> ${label}</label></div>`).join(''),
          default: 'roll',
          buttons: {
            roll: { label: 'Rolar', callback: root => Object.fromEntries(choices.map(([, name]) =>
              [name, !!root.find(`[name="${name}"]`).prop('checked')])) },
            cancel: { label: 'Cancelar' }
          }
        }) : {};
        if (!options) return;
        const result = await rollPressure093(this.actor, button.dataset.rules093Pressure, options);
        if (!result) warn('Pressure Check indisponível neste turno ou rodada.');
      } finally { button.disabled = false; }
    });
    html.on('change', '[data-dbu-unique-type]', async event => {
      const { value, dataset } = event.currentTarget;
      const rows = structuredClone(this.actor.system.uniqueAbilities || []);
      const row = rows[Number(dataset.dbuUniqueType)];
      const data = CONFIG.DBU?.uniqueAbilitiesCatalog?.[row?.abilityKey];
      if (data?.abilityType !== 'Technical/Magical' || data.legacy) return;
      if (!['', 'Technical', 'Magical'].includes(value)) return;
      row.abilityType = value;
      await this.actor.update({ 'system.uniqueAbilities': rows });
    });
    html.on('click', '[data-dbu-edit-attack-visual]', async event => {
      event.preventDefault();
      await game.dbu?.automation?.editAttackVisual?.(this.actor, event.currentTarget.dataset.dbuEditAttackVisual);
    });
    html.on('click', '[data-dbu-edit-transformation-token]', async event => {
      event.preventDefault();
      const index = Number(event.currentTarget.dataset.dbuEditTransformationToken);
      await game.dbu?.automation?.editTransformationToken?.(this.actor, index);
    });
    html.on('click', '[data-dbu-edit-description]', async event => {
      event.preventDefault();
      const { dbuEditDescription, entryId } = event.currentTarget.dataset;
      await editCatalogDescription(this, dbuEditDescription, entryId);
    });
    html.on('click', '[data-rules093-convert]', async event => { event.preventDefault(); const result = await convertStandardToCounter093(this.actor); if (!result.ok) warn(result.reason); });
    html.on('click', '[data-rules093-backup]', event => { event.preventDefault(); game.dbu.exportRulesBackup(); });
    html.on('click', '[data-rules093-source]', event => {
      event.preventDefault();
      const selected = [ ...Object.values(CATALOGS_093.racialTraits).flat().filter(t => this.actor.system.racialTraits?.includes(t.id)), ...CATALOGS_093.talents.filter(t => this.actor.system.talents?.includes(t.id)), ...(this.actor.system.transformations || []).map(t => CATALOGS_093.transformations[t.catalogKey]).filter(Boolean) ];
      const content = selected.map(t => `<p><a href="${t.source}" target="_blank" rel="noopener noreferrer">${escape(t.name)}</a> — ${t.automation === 'legacy-reviewed' ? 'Efeitos preservados' : t.automation === 'attributes-only' ? 'AMB aplicados; traços e aspectos manuais' : 'Revisar efeitos manuais'}</p>`).join('');
      new Dialog({ title: 'DBU 0.9.3 — fontes das escolhas', content: content || '<p>Nenhuma escolha registrada.</p>', buttons: { close: { label: 'Fechar' } } }).render(true);
    });
    html.on('click', '[data-rules093-born-max]', async event => {
      event.preventDefault();
      if (this.actor.system.rules093State?.bornMaxUsed) return warn('Born for Battle 3 já foi usado neste encontro.');
      await this.actor.update({ 'system.rules093State.bornMaxUsed': true, 'system.rules093State.bornLimitOverride': true, 'system.battleBorn.strike': Math.max(3, this.actor.system.battleBorn?.strike || 0), 'system.battleBorn.dodge': Math.max(3, this.actor.system.battleBorn?.dodge || 0), 'system.battleBorn.wound': Math.max(3, this.actor.system.battleBorn?.wound || 0) });
    });
    html.on('click', '[data-rules093-adjust]', async event => {
      event.preventDefault();
      const cts = structuredClone(this.actor.system.combatTabState || {});
      cts.rounds ??= []; if (!cts.rounds.length) cts.rounds.push({ roundNumber: 1, actions: [] });
      const round = cts.rounds.at(-1), state = round.rules093 || {};
      const result = await Dialog.wait({ title: 'Actions — efeitos adicionais', content: `<p>Informe os bônus concedidos pelas regras da ficha para esta rodada.</p><label>Standard extras <input id="sa" type="number" min="0" value="${Number(state.standardBonus) || 0}"></label><label>Counter extras <input id="ca" type="number" min="0" max="5" value="${Number(state.counterBonus) || 0}"></label><label><input id="bm" type="checkbox" ${state.bonusMomentum ? 'checked' : ''}>Bonus Momentum nesta rodada</label><label><input id="rm" type="checkbox" ${state.reducedMomentumNext ? 'checked' : ''}>Reduced Momentum na próxima rodada</label>`, buttons: { apply: { label: 'Aplicar', callback: html => ({ standardBonus: Math.max(0,Number(html.find('#sa').val()) || 0), counterBonus: Math.min(5,Math.max(0,Number(html.find('#ca').val()) || 0)), bonusMomentum: !!html.find('#bm').prop('checked'), reducedMomentumNext: !!html.find('#rm').prop('checked') }) }, cancel: { label: 'Cancelar', callback: () => null } } });
      if (!result) return;
      round.rules093 = { ...state, ...result };
      await this.actor.update({ 'system.combatTabState': cts });
    });
    html.on('click', '[data-rules093-full-awakening]', async event => {
      event.preventDefault();
      const candidates = (this.actor.system.transformations || []).map((t,index) => ({ t,index })).filter(({t}) => t.awakeningType === 'Super');
      if (!candidates.length) return warn('Adicione sua Super Awakening primeiro.');
      await fullAwakening093(this.actor, candidates[0].index);
    });
  });
  wrap('getData', async function(original, ...args) {
    const context = await original(...args);
    context.racialResources093 = racialResourceView093(this.actor);
    context.canEditAttackVisual = context.editable && !!game.dbu?.automation?.editAttackVisual;
    context.canEditTransformationToken = context.editable && !!game.dbu?.automation?.editTransformationToken;
    context.rules093Pools = roundPools093(this.actor);
    context.rules093Race = RACES_093[this.actor.system.race];
    const stats = context.rules093Race?.attributes;
    context.rules093RaceAttributes = stats ? Object.entries(stats.fixed).map(([key,n]) => key.toUpperCase()+' +'+n).concat(stats.choices.map(c => c.count+' × +'+c.amount+' ('+c.attributes.map(k => k.toUpperCase()).join('/')+')')).join('; ') : 'Escolher raça base atual.';
    context.canExportRulesBackup = !!game.user.isGM;
    context.rules093Born = (this.actor.system.racialTraits || []).includes(CATALOGS_093.racialTraits.saiyan.find(t => t.name === 'Born for Battle').id);
    return context;
  });
  wrap('_prepareTechniquesData', function(original, ...args) {
    original(...args);
    args[0].superProfileOptions093 = Object.keys(SUPER_PROFILES_093);
    args[0].techniqueTypeOptions = { signature: 'Super', super: 'Super', ultimate: 'Ultimate', dramatic_finisher: 'Dramatic Finisher' };
  });
  wrap('_prepareCombatData', function(original, context, system) {
    original(context, system);
    const desc = { parry: 'Strike físico em vez de Dodge; penalidade de 1(bT) por EC/Power Shot do ataque.', directHit: 'Soak +½. Se sofrer 0 dano contra 2+ EC ou Wager ≥¼ Max Capacity do atacante, ele recebe Shaken.', powerFlare: 'Wound contra Wound: apenas um resultado maior que o do atacante evita o dano. Base KP 0; Ki Wager normal.', crossCounter: 'Defense Value pela metade; depois do Clash, faça um Basic Attack OoS contra o atacante.', guard: 'Wound recebido pela metade, Damage Category −1; custo (8 + até 4 EC)(bT).' };
    this._defendCatalog = (this._defendCatalog || []).map(d => ({ ...d, costT: ['powerFlare','crossCounter'].includes(d.key) ? 0 : d.costT, desc: desc[d.key] || d.desc }));
    context.defendOptions = this._defendCatalog.map(d => ({ ...d, costLabel: d.key === 'guard' ? '8(bT) + EC' : '0 KP' }));
    this._trackerDefend.maxFlareWager = maximumWager093(this.actor, null, 0);
  });
  wrap('_calcGuardKiCost', function(original, system) { return defendKiCost093(system, 'guard', system.damageCalc?.incomingEC); });
  wrap('_onTrackerAddAction', async function(original, event) {
    const type = event.currentTarget?.dataset?.defaultType || 'standard';
    const pool = roundPools093(this.actor)[type === 'defend' || type === 'counter' ? 'counter' : 'standard'];
    if (!['instant','out-of-sequence'].includes(type) && pool.remaining < 1) return warn('Sem Actions disponíveis. Remova uma ação planejada, aplique o bônus permitido pela regra ou converta Standard → Counter.');
    return original(event);
  });
  for (const name of ['_onRollTrackerAttack','_onRollTrackerTransform','_onUseTrackerGrapple','_onUseTrackerThrust','_onUseTrackerTerrify','_onUseTrackerFeint','_onUseTrackerDirtyTrick','_onInitiateDuel','_onRollTrackerDefend']) {
    wrap(name, async function(original, event, ...args) {
      const index = Number(event.currentTarget?.dataset?.actionIndex);
      const rounds = this.actor.system.combatTabState?.rounds || [];
      const round = rounds.find(r => r.roundNumber === Number(event.currentTarget?.dataset?.round));
      const row = round?.actions?.[index];
      if (!row) return original(event, ...args);
      if (round !== rounds.at(-1)) return warn('0.9.3: Actions de rodadas anteriores expiraram.');
      if (row.source?.startsWith('tech_')) {
        const tech = this.actor.system.signatureTechniques?.find(t => 'tech_'+t.id === row.source);
        if (tech) {
          if (this.actor.system.minion?.enabled && /ultimate|dramatic[ _-]*finisher/i.test(tech.type || '')) return warn('Minions não podem usar Ultimates ou Dramatic Finishers.');
          const result = validateTechnique093(tech, this.actor.system); if (!result.ok) return warn(result.issues.join('; '));
          if (inCombat093(this.actor)) { const usage = validateTechniqueUsage093(this.actor, tech, { excludeIndex: index }); if (!usage.ok) return warn(usage.reason); }
        }
      }
      if (name === '_onRollTrackerAttack') {
        const technique = this.actor.system.signatureTechniques?.find(t => 'tech_'+t.id === row.source);
        if ((Number(row.kiWager) || 0) > maximumWager093(this.actor, technique || (this._trackerSourceGroups || []).flatMap(g => g.sources).find(s => s.key === row.source), Number(row.kiCost) || 0)) return warn('Ki Wager acima do limite atual de Capacity/Ki. Full Wager usa a Capacity restante.');
        if (row.rules093Executed) return warn('Esta ação já foi executada. Use um novo registro para outra manobra.');
      }
      const type = rowActionType093(row);
      if (inCombat093(this.actor) && type === 'standard' && !isOwnTurn093(this.actor)) return warn('Standard Maneuvers exigem seu turno.');
      const pools = roundPools093(this.actor, { excludeIndex: index });
      if (pools[type === 'counter' ? 'counter' : 'standard'].remaining < rowCost093(row)) return warn('Actions insuficientes para essa manobra.');
      const attacksBefore = this.actor.system.combatTabState?.roundAttackCount || 0;
      const result = await original(event, ...args);
      if (name === '_onRollTrackerAttack' && (this.actor.system.combatTabState?.roundAttackCount || 0) > attacksBefore) {
        const cts = structuredClone(this.actor.system.combatTabState || {});
        cts.rounds.at(-1).actions[index].rules093Executed = true;
        await this.actor.update({ 'system.combatTabState': cts });
      }
      return result;
    });
  }
  wrap('_addTransformationFromCatalog', async function(original, key) {
    const entry = CATALOGS_093.transformations[key];
    if (!entry) return;
    const proposed = [...(this.actor.system.transformations || []), { ...entry, transformationType: entry.category, active: entry.category === 'manifested_power' && !entry.requiresReview }];
    const validation = transformationCanActivate093(this.actor, proposed);
    if (!validation.ok) return warn(validation.reason);
    await original(key);
    const rows = structuredClone(this.actor.system.transformations || []);
    const row = rows.at(-1);
    Object.assign(row, { awakeningType: entry.awakeningType, transcended: entry.transcended, transformationType: entry.category === 'enhancement_power' ? (entry.transcended ? 'enhancement_transcendent' : 'enhancement_standard') : entry.category, active: entry.category === 'manifested_power' && !entry.requiresReview, gradeOrStacks: entry.maxStacks ? `1/${entry.maxStacks}` : '' });
    await this.actor.update({ 'system.transformations': rows });
  });
  wrap('_onViewTransformationTraits', function(original, event) {
    event.preventDefault();
    const trans = this.actor.system.transformations?.[Number(event.currentTarget.dataset.transIndex)];
    const entry = CATALOGS_093.transformations[trans?.catalogKey];
    if (!entry) return original(event);
    const groups = entry.traitGroups.map(group => `
      <section class="tf-trait-group-detail">
        <h3 class="tf-trait-group-header">${escape(group.name)}</h3>
        ${group.effects.map(effect => `
          <div class="tf-trait-effect-row">
            <div class="tf-reference-label">
              <strong>Lv.${escape(effect.level)}</strong>
              <span class="tf-trait-keyword-badge ${escape(effect.activationType)}">[${escape(effect.keyword)}]</span>
            </div>
            <div class="tf-trait-effect-text">${escape(effect.summary)}</div>
            ${effect.referenceOptions?.length ? `
              <dl class="tf-reference-options">
                ${effect.referenceOptions.map(option => `
                  <dt>${escape(option.name)} <span>[${escape(option.keyword)}]</span></dt>
                  <dd>${escape(option.summary)}</dd>
                `).join('')}
              </dl>` : ''}
          </div>`).join('')}
      </section>`).join('');
    const content = `
      <div class="tf-traits-detail">
        <div class="tf-detail-header-info">
          <a href="${escape(entry.source)}" target="_blank" rel="noopener noreferrer">Regra completa no site</a>
        </div>
        <div class="tf-detail-aspects"><strong>Aspectos manuais</strong> ${escape(entry.referenceAspects.join(', ') || 'Nenhum listado')}</div>
        <div class="tf-detail-prereqs"><strong>Pré-requisitos</strong> ${escape(entry.prerequisites || 'Nenhum listado')}</div>
        ${groups}
      </div>`;
    new Dialog({
      title: entry.name+' — 0.9.3', content, buttons: { close: { label: 'Fechar' } }
    }, { width: 650, classes: ['dbu-old', 'tf-traits-window', 'dbu-transformation-reference'] }).render(true);
  });
  wrap('_onTransformationCheckChange', async function(original, event) {
    const index = Number(event.currentTarget?.dataset?.transIndex), field = event.currentTarget?.dataset?.field;
    const rows = structuredClone(this.actor.system.transformations || []);
    if (rows[index] && field === 'active') {
      if (rows[index].transformationType === 'manifested_power' && !event.currentTarget.checked) return warn('Awakenings são permanentes e ficam ativas enquanto possuídas.');
      rows[index].active = event.currentTarget.checked;
      const validation = transformationCanActivate093(this.actor, rows);
      if (!validation.ok) return warn(validation.reason);
      // A current Form cannot enter through the legacy conjunction dialog.
      await this.actor.update({ 'system.transformations': rows, 'system.transformationMeta.enteredViaManeuver093': (this.actor.system.transformationMeta?.enteredViaManeuver093 || []).filter(id => id !== rows[index].id) });
      return;
    }
    return original(event);
  });
  wrap('_activateTransformationAtIndex', async function(original, index, deactivate = []) {
    const rows = structuredClone(this.actor.system.transformations || []);
    for (const i of deactivate) if (rows[i]) rows[i].active = false;
    if (!rows[index]) return;
    rows[index].active = true;
    const validation = transformationCanActivate093(this.actor, rows);
    if (!validation.ok) return warn(validation.reason);
    const entered = [...new Set([...(this.actor.system.transformationMeta?.enteredViaManeuver093 || []), rows[index].id])];
    await this.actor.update({ 'system.transformations': rows, 'system.transformationMeta.enteredViaManeuver093': entered });
    return true;
  });
  wrap('_computeTransformManeuver', function(original, index, action = {}) {
    const result = original(index, action);
    const selected = this.actor.system.transformations?.[index];
    if (result && selected) {
      const active = (this.actor.system.transformations || []).filter((t,i) => t.active && i !== index && t.transformationType !== 'manifested_power');
      result.required = stackedStressRequirement([selected.stressTest, ...active.filter(t => !result.replacedIndices?.includes(this.actor.system.transformations.indexOf(t))).map(t => t.stressTest)]);
    }
    return result;
  });
  wrap('_battleBornGrantStack', async function(original, source) {
    const trait = (CATALOGS_093.racialTraits[this.actor.system.race] || []).find(t => t.name === 'Born for Battle');
    if (!trait || !this.actor.system.racialTraits?.includes(trait.id)) return;
    const bb = this.actor.system.battleBorn || {}, cap = this.actor.system.rules093State?.bornLimitOverride ? 3 : 2;
    const options = Object.fromEntries(['strike','dodge','wound'].filter(k => (bb[k] || 0) < cap).map(k => [k, { label: k, callback: () => k }]));
    if (!Object.keys(options).length) return 'maxed';
    const selected = await Dialog.wait({ title: 'Born for Battle — '+source, content: '<p>Escolha onde aplicar o stack (+1(T)).</p>', buttons: options });
    if (!options[selected]) return;
    await this.actor.update({ ['system.battleBorn.'+selected]: (bb[selected] || 0) + 1 });
    return selected;
  });
  wrap('_onTfNewLevelOfPower', async function(original, event) {
    event.preventDefault();
    const eligible = (this.actor.system.transformations || []).filter(t => t.active && !this.actor.system.transformationMeta?.newLevelOfPowerUsed?.includes(t.name));
    if (!eligible.length) return warn('Nenhuma transformação ativa elegível.');
    const selected = await Dialog.wait({ title: 'New Level of Power', content: '<p>Primeiro acesso a esta transformação durante o encontro: escolha a transformação.</p>', buttons: Object.fromEntries(eligible.map((t,i) => ['t'+i, { label: t.name, callback: () => i }])) });
    if (!Number.isInteger(selected) || !eligible[selected]) return;
    const result = await newLevelOfPower093(this.actor, eligible[selected]);
    if (!result.ok) warn(result.reason);
  });
  wrap('_onTfLegendRealized', async function(original, event) {
    event.preventDefault();
    const eligible = (this.actor.system.transformations || []).filter(t => t.active && ['form_alternate','form_legendary'].includes(t.transformationType));
    if (!eligible.length) return warn('Nenhuma Form ativa.');
    const selected = await Dialog.wait({ title: 'Legend Realized', content: '<p>Uma vez por tipo de Form e requisito de Tier no encontro.</p>', buttons: Object.fromEntries(eligible.map((t,i) => ['t'+i, { label: t.name, callback: () => i }])) });
    if (!Number.isInteger(selected) || !eligible[selected]) return;
    if (!(await applyLegendRealized093(this.actor, eligible[selected]))) warn('Benefício indisponível: exige entrada por Transformation Maneuver e grupo ainda não usado.');
  });
  wrap('_onTfBurstLimit', async function(original, event) {
    const meta = this.actor.system.transformationMeta || {};
    const extra = meta.burstLimitUsed && (meta.nlopActiveEncounter || []).some(name => this.actor.system.transformations?.some(t => t.active && t.name === name && t.transformationType?.startsWith('enhancement')));
    if (extra && this.actor.system.rules093State?.burstLimitExtraUsed) return warn('O Burst Limit adicional do New Level of Power já foi usado.');
    await original(event);
    if (extra && this.actor.system.transformationMeta?.burstLimitUsed) await this.actor.update({ 'system.rules093State.burstLimitExtraUsed': true });
  });
  wrap('_onCombatNewRound', async function(original, event) {
    const previous = this.actor.system.combatTabState?.rounds?.at(-1)?.rules093;
    await original(event);
    if (previous?.reducedMomentumNext) {
      const cts = structuredClone(this.actor.system.combatTabState || {});
      cts.rounds.at(-1).rules093 = { reducedMomentum: true };
      await this.actor.update({ 'system.combatTabState': cts });
    }
  });
  wrap('_onCombatNewEncounter', async function(original, event) {
    await original(event);
    await this.actor.update({ 'system.rules093State': {}, 'system.transformationMeta.enteredViaManeuver093': [], ...racialEncounterReset093(this.actor.system) });
  });
}
