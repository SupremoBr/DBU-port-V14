// Both sheets edit the same world Actor documents in one Foundry operation.
export async function changeJacketPilot(jacket, pilot, { unlink = false } = {}) {
  const updates = [];
  function change(actor, fields) {
    if (!actor?.isOwner || game.actors.get(actor.id) !== actor) {
      throw new Error("É necessário controlar os personagens e Battle Jackets vinculados no mundo.");
    }
    updates.push({ _id: actor.id, ...fields });
  }
  const clearPilot = { "system.pilotedJacketId": "", "system.isPiloting": false };
  if (unlink) {
    if (jacket && (!pilot || jacket.system.pilotId === pilot.id)) change(jacket, { "system.pilotId": "" });
    if (pilot && (!jacket || pilot.system.pilotedJacketId === jacket.id)) change(pilot, clearPilot);
  } else {
    if (jacket?.type !== "battleJacket" || pilot?.type !== "character") return;
    const oldPilot = game.actors.get(jacket.system.pilotId);
    const oldJacket = game.actors.get(pilot.system.pilotedJacketId);
    if (oldPilot && oldPilot !== pilot && oldPilot.system.pilotedJacketId === jacket.id) change(oldPilot, clearPilot);
    if (oldJacket && oldJacket !== jacket && oldJacket.system.pilotId === pilot.id) change(oldJacket, { "system.pilotId": "" });
    change(jacket, { "system.pilotId": pilot.id });
    change(pilot, { "system.pilotedJacketId": jacket.id });
  }
  if (!updates.length) return;
  if (globalThis.foundry?.documents?.modifyBatch) {
    await foundry.documents.modifyBatch([{ action: "update", documentName: "Actor", updates }]);
  } else {
    await CONFIG.Actor.documentClass.updateDocuments(updates);
  }
}
