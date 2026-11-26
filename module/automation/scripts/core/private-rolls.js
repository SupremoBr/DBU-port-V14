import { listenRequests, sendRequest } from "./authorized-request.js";

const scope = "DBU-MRR-OLD";
const creating = new Map();
const sealedFields = [
  "strikeTotal", "baseWoundTotal", "woundTotal", "strikeNatural", "woundNatural",
  "strikeCritical", "woundCritical", "strikeBotch", "woundBotch", "pinpointInsight", "combination", "targetingAdjustment"
];

function findJournal(userId) {
  return game.journal.find(entry => entry.getFlag(scope, "rollOwner") === userId &&
    entry.ownership[userId] === 3 && entry.ownership.default === 0 &&
    Object.entries(entry.ownership).every(([id, level]) => id === userId || level <= 0 || game.users?.get(id)?.isGM));
}

async function ensureJournal(user) {
  const existing = findJournal(user.id);
  if (existing) return existing;
  if (!creating.has(user.id)) {
    creating.set(user.id, JournalEntry.create({
      name: "DBU · Rolagens pendentes · " + user.name,
      ownership: { default: 0, [user.id]: 3 }, flags: { [scope]: { rollOwner: user.id } }
    }).finally(() => creating.delete(user.id)));
  }
  return creating.get(user.id);
}

export function registerPrivateRolls() {
  listenRequests("roll-journal", (_packet, sender) => {
    if (game.user.isGM) return ensureJournal(sender);
  });
}

export async function privateRollJournal() {
  const existing = findJournal(game.user.id);
  if (existing) return existing;
  if (game.user.isGM || globalThis.JournalEntry?.canUserCreate?.(game.user)) return ensureJournal(game.user);
  await sendRequest("roll-journal", {});
  for (let attempt = 0; attempt < 50; attempt++) {
    const journal = findJournal(game.user.id);
    if (journal) return journal;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("O mestre precisa estar conectado para preparar o diário privado de rolagens.");
}

export async function sealRoll(journal, id, attack, reveal) {
  const publicAttack = { ...attack, messageId: id, sealedRoll: true };
  const results = {};
  for (const field of sealedFields) {
    results[field] = publicAttack[field];
    delete publicAttack[field];
  }
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    _id: id, name: attack.attackName, type: "text",
    text: { content: encodeURIComponent(JSON.stringify({ results, reveal })) }
  }], { keepId: true });
  if (!page || page.id !== id) throw new Error("Falha ao guardar a rolagem privada.");
  publicAttack.rollJournalId = journal.id;
  return publicAttack;
}

export async function createHiddenTrackerCard(data, journal) {
  const reveal = data.flags[scope].attackReveal;
  const id = foundry.utils.randomID();
  await sealRoll(journal, id, { attackName: reveal.attackName || "Defesa" }, reveal);
  const publicReveal = { actorId: reveal.actorId, revealed: false, rollJournalId: journal.id };
  for (const key of ["foundation", "profile", "attackName"]) {
    if (key in reveal) publicReveal[key] = reveal[key];
  }
  try {
    return await ChatMessage.create({ ...data, _id: id, flags: { [scope]: { attackReveal: publicReveal } } }, { keepId: true });
  } catch (error) {
    await journal.pages.get(id)?.delete();
    throw error;
  }
}

export function openRoll(attack, message) {
  const journal = game.journal.get(attack.rollJournalId);
  const page = journal?.pages.get(message.id);
  const content = page?.text?.content?.replace(/<[^>]*>/g, "").trim();
  const secret = content && JSON.parse(decodeURIComponent(content));
  if (!secret || journal.getFlag(scope, "rollOwner") !== (message.author?.id ?? message.user?.id ?? message._source?.author))
    throw new Error("Rolagem privada indisponível para esta carta.");
  if (attack.sealedRoll) {
    Object.assign(attack, secret.results);
    attack.woundTotal = attack.baseWoundTotal + Number(attack.unitedAttackBonus || 0);
    attack.sealedRoll = false;
  }
  return { page, reveal: secret.reveal, results: secret.results };
}

export function finishDefense(attack, outcome, system093) {
  const type = outcome.defenseType;
  const strike = attack.strikeTotal, wound = attack.woundTotal;
  const target = ["powerFlare", "guard", "directHit"].includes(type) ? wound : strike;
  let success = false;
  if (type === "dodge" || type === "parry") success = outcome.total >= strike;
  else if (type === "crossCounter") success = outcome.total > strike;
  else if (type === "powerFlare") success = system093 ? outcome.total > wound : outcome.total >= wound;
  else if (type !== "guard" && type !== "directHit") return outcome;
  if (attack.determined && system093) success = false;
  return { ...outcome, success, target, extra: type === "directHit" ? `Wound ${wound}` : outcome.extra,
    damageDefense: success ? null : ["guard", "directHit"].includes(type) ? type : "none" };
}
