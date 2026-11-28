import { Dialog } from "../../../helpers/foundry-compat.mjs";
import { uses093 } from "../../../rules/v093.mjs";

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function calculateMovement(system, { squares, rapid = false, discount = 0 } = {}) {
  const normal = count(system?.status?.normalSpeed ?? system?.speed?.normal);
  const boosted = Math.max(normal, count(system?.status?.boostedSpeed ?? system?.speed?.boosted));
  const tier = Math.max(1, count(system?.tier));
  const distance = Number(squares);
  const valid = Number.isInteger(distance) && distance > 0 && distance <= boosted;
  const currentRules = uses093(system);
  const boostedMovement = distance > normal;
  const speedCost = boostedMovement ? (currentRules ? 3 * tier : 3 * (distance - normal)) : 0;
  const rapidCost = currentRules && rapid ? 2 * tier : 0;
  const cost = valid ? Math.max(0, speedCost + rapidCost - count(discount)) : null;
  return { normal, boosted, distance, valid, boostedMovement, rapidCost, cost };
}

export function openMovementCalculator(actor, title, grappleWarning = "") {
  const { normal, boosted } = calculateMovement(actor.system);
  const read = html => calculateMovement(actor.system, {
    squares: html.find("#dbua-move-squares").val(),
    rapid: html.find("#dbua-move-rapid").prop("checked"),
    discount: html.find("#dbua-move-discount").val()
  });
  return Dialog.wait({
    title,
    content: `<div class="dbua-sheet-content">
      <p>Normal Speed <b>${normal}</b> · Boosted Speed <b>${boosted}</b> quadrados</p>
      <div class="form-group dbua-dialog-field">
        <label for="dbua-move-squares">Distância em quadrados</label>
        <input type="number" id="dbua-move-squares" min="1" max="${boosted}" step="1" value="${normal || (boosted > 0 ? 1 : 0)}">
      </div>
      ${uses093(actor.system) ? `<div class="form-group">
        <label><input type="checkbox" id="dbua-move-rapid"> Rapid Movement (+2(T) Ki)</label>
      </div>` : ""}
      <div class="form-group dbua-dialog-field">
        <label for="dbua-move-discount">Desconto de Ki aplicável</label>
        <input type="number" id="dbua-move-discount" min="0" step="1" value="0">
      </div>
      <p id="dbua-move-cost" role="status"></p>
      ${grappleWarning ? `<p class="notes">${grappleWarning}</p>` : ""}
      <p class="notes">Movimento do token e pagamento de Ki manuais.</p>
    </div>`,
    buttons: {
      record: { label: "Registrar movimento", callback: read },
      close: { label: "Fechar", callback: () => null }
    },
    default: "record",
    close: () => null,
    render: html => {
      const refresh = () => {
        const result = read(html);
        html.find("#dbua-move-cost").text(result.valid
          ? `${result.boostedMovement ? "Boosted Speed" : "Normal Speed"} · ${result.cost} Ki · 1 ação`
          : result.boosted ? `Informe de 1 a ${result.boosted} quadrados.` : "O personagem está sem deslocamento.");
        html.find('button[data-button="record"]').prop("disabled", !result.valid);
      };
      html.find("input").on("input change", refresh);
      refresh();
    }
  }, { width: 430 });
}
