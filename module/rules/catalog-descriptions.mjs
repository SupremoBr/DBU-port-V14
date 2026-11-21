import { Dialog } from '../helpers/foundry-compat.mjs';
import { buffStateLabels, catalogBuffFlag, catalogBuffGroups, catalogBuffSystem as SYSTEM, customBuffState } from '../helpers/custom-buffs.mjs';
import { createCatalogBuffEditor } from '../sheets/character/catalog-buff-editor.mjs';

const FLAG = 'catalogDescriptions';

export function applyCatalogDescriptions(actor, group, entries) {
  const descriptions = actor.getFlag?.(SYSTEM, FLAG)?.[group];
  const buffs = actor.getFlag?.(SYSTEM, catalogBuffFlag)?.[group];
  return entries.map(entry => {
    const override = descriptions?.[entry.id];
    const customDescription = typeof override === 'string';
    const rows = buffs?.[entry.id];
    const isSubraceTrait = group === 'traits' && !entry.factor
      && (Boolean(entry.subrace) || actor.system?.subraceTraits?.includes(entry.id));
    const linkedBuffs = Array.isArray(rows) ? rows.map(buff => ({
      effect: buff.effect,
      state: buffStateLabels[customBuffState(buff, actor.system || {})],
    })) : [];
    return {
      ...entry,
      ...(isSubraceTrait ? { isSubraceTrait: true } : {}),
      ...(customDescription ? { description: override, customDescription: true } : {}),
      linkedBuffs,
    };
  });
}

export async function editCatalogDescription(sheet, group, id) {
  const { actor } = sheet;
  const ownsEntry = () => sheet.isEditable && actor.system[catalogBuffGroups[group]]?.includes(id);
  if (!Object.hasOwn(catalogBuffGroups, group) || !/^[a-z0-9_-]+$/i.test(id || '') || !ownsEntry()) return;

  const entries = group === 'traits'
    ? sheet._getCharacterTraits(actor.system)
    : sheet._getCharacterTalents(actor.system);
  const entry = entries.find(candidate => candidate.id === id);
  if (!entry) return;

  const escape = foundry.utils.escapeHTML;
  const savedBuffs = actor.getFlag?.(SYSTEM, catalogBuffFlag)?.[group]?.[id];
  const buffEditor = createCatalogBuffEditor(actor, Array.isArray(savedBuffs) ? savedBuffs : [], escape);
  const canMarkSubrace = group === 'traits' && !entry.factor && !entry.subrace
    && Boolean(actor.system.subrace) && actor.system.subrace !== 'none';
  const buttons = {
    save: { label: 'Salvar', callback: html => ({
      description: html.find('textarea').val().trim(),
      buffs: buffEditor.read(html),
      subraceTrait: canMarkSubrace && !!html.find('#dbu-subrace-trait').prop('checked'),
    }) },
    cancel: { label: 'Cancelar', callback: () => null },
  };
  if (entry.customDescription) {
    buttons.restore = { label: 'Restaurar resumo do catálogo', callback: () => ({ restore: true }) };
  }

  const result = await Dialog.wait({
    title: 'Editar descrição e buffs',
    content: `<div class="dbu-catalog-description-editor">
      <label for="dbu-description-${id}"><strong>${escape(entry.name)}</strong></label>
      <p>Esta descrição fica salva neste personagem.</p>
      <textarea id="dbu-description-${id}" rows="8">${escape(entry.description || '')}</textarea>
      ${canMarkSubrace ? `<label><input type="checkbox" id="dbu-subrace-trait" ${entry.isSubraceTrait ? 'checked' : ''}> Traço adicional da sub-raça</label>` : ''}
      ${buffEditor.content}
    </div>`,
    buttons,
    render: html => buffEditor.bind(html),
    default: 'save',
    close: () => null,
  }, { width: 680 });

  if (!result || !ownsEntry()) return;
  const path = `flags.${SYSTEM}.${FLAG}.${group}`;
  const changes = result.restore
    ? { [`${path}.-=${id}`]: null }
    : { [`${path}.${id}`]: result.description };
  if (!result.restore && (result.buffs.length || Array.isArray(savedBuffs))) {
    changes[`flags.${SYSTEM}.${catalogBuffFlag}.${group}.${id}`] = result.buffs;
  }
  if (!result.restore && !entry.customDescription && result.description === (entry.description || '').trim()) {
    delete changes[`${path}.${id}`];
  }
  if (!result.restore && canMarkSubrace && typeof result.subraceTrait === 'boolean') {
    const traits = new Set(actor.system.subraceTraits || []);
    if (result.subraceTrait) traits.add(id);
    else traits.delete(id);
    changes['system.subraceTraits'] = [...traits];
  }
  if (Object.keys(changes).length) await actor.update(changes);
}
