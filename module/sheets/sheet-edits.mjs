const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function captureSheetEdits(sheet, html, keys) {
  sheet._renderedArrays = Object.fromEntries(keys.map(key =>
    [key, foundry.utils.deepClone(sheet.actor.system[key] || [])]));
  const FormData = globalThis.foundry?.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
  const root = html?.[0] ?? html;
  const form = root?.matches?.("form") ? root : root?.querySelector?.("form");
  sheet._renderedFields = form && FormData ? new FormData(form).object : null;
}

export function omitUnchangedFields(sheet, submitted) {
  const baseline = sheet._renderedFields;
  if (!baseline) return;
  for (const [key, value] of Object.entries(submitted)) {
    if (!Object.hasOwn(baseline, key)) continue;
    if (same(baseline[key], value)) delete submitted[key];
    else if (["system.lifePoints.value", "system.kiPool.value"].includes(key) &&
        Array.isArray(value) && Array.isArray(baseline[key])) {
      submitted[key] = value.find((part, index) => !same(part, baseline[key][index]));
    }
  }
}

// A concurrent insertion or sort can change an input's index while it is open.
export function rebaseSheetRows(rendered, stored, formRows) {
  if (!rendered || same(rendered, stored)) return formRows;
  const rebased = {};
  for (const [index, edits] of Object.entries(formRows)) {
    const previous = rendered[index];
    if (previous?.id == null) return null;
    const currentIndex = stored.findIndex(row => row.id === previous.id);
    if (currentIndex < 0 || stored.filter(row => row.id === previous.id).length !== 1 ||
        rendered.filter(row => row.id === previous.id).length !== 1) return null;
    if (Object.keys(edits).some(key => !same(previous[key], stored[currentIndex][key]) &&
        !same(edits[key], stored[currentIndex][key]))) return null;
    rebased[currentIndex] = edits;
  }
  return rebased;
}
