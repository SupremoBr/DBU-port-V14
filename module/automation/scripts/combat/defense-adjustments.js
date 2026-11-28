import { Dialog } from "../../../helpers/foundry-compat.mjs";

const categories = ["standard", "direct", "lethal"];
const rollDefenses = ["dodge", "parry", "powerFlare", "crossCounter"];

function boundedInteger(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : 0;
}

export function defenseAdjustments(value = {}) {
  return {
    bonus: boundedInteger(value?.bonus, -999, 999),
    soak: boundedInteger(value?.soak, 0, 999),
    reduction: boundedInteger(value?.reduction, 0, 999),
    category: categories.includes(value?.category) ? value.category : ""
  };
}

export async function promptDefenseAdjustments({ title, type, category, maxWager }) {
  const numberField = (id, label, min = 0, max = 999) => `
    <div class="form-group dbua-dialog-field">
      <label for="dbu-defense-${id}">${label}</label>
      <input id="dbu-defense-${id}" type="number" step="1" min="${min}" max="${max}" value="0">
    </div>`;
  const original = categories.find(key => key === String(category || "").toLowerCase());
  const originalLabel = original ? original[0].toUpperCase() + original.slice(1) : "";
  return Dialog.wait({
    title,
    content: `<div class="dbua-sheet-content">
      <h3>Modificadores situacionais</h3>
      ${rollDefenses.includes(type) ? numberField("bonus", "Bônus de defesa", -999) : ""}
      ${type === "powerFlare" ? numberField("wager", "Ki Wager", 0, maxWager) : ""}
      ${numberField("soak", "Soak extra")}
      ${numberField("reduction", "Redução de dano extra (DR)")}
      <div class="form-group dbua-dialog-field">
        <label for="dbu-defense-category">Categoria do dano recebido</label>
        <select id="dbu-defense-category">
          <option value="">Do ataque${originalLabel ? ` (${originalLabel})` : ""}</option>
          <option value="standard">Standard</option>
          <option value="direct">Direct</option>
          <option value="lethal">Lethal</option>
        </select>
      </div>
    </div>`,
    buttons: {
      apply: { label: "Confirmar defesa", callback: html => {
        const value = key => html.find(`#dbu-defense-${key}`).val();
        return {
          ...defenseAdjustments({ bonus: value("bonus"), soak: value("soak"), reduction: value("reduction"), category: value("category") }),
          wager: boundedInteger(value("wager"), 0, maxWager ?? 0)
        };
      } },
      cancel: { label: "Cancelar", callback: () => null }
    },
    default: "apply",
    close: () => null
  }, { width: 440 });
}
