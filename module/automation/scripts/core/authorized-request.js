// The document operation supplies the originating user ID on both V13 and V14.
const scope = "DBU-MRR-OLD";
export async function sendRequest(channel, packet, recipient) {
  const users = Array.from(game.users);
  const target = recipient || users.filter(user => user.active && user.isGM).sort((a,b) => a.id.localeCompare(b.id))[0]?.id;
  if (!target) throw new Error("É necessário um mestre conectado.");
  const message = await ChatMessage.create({
    content: "DBU · solicitação de combate", whisper: [target],
    flags: { [scope]: { combatRequest: { channel, packet, target } } }
  });
  // A player receiving a GM request cannot delete the GM's document.
  if (target !== game.user.id && !game.users.get(target)?.isGM) {
    setTimeout(() => game.messages.get(message.id)?.delete().catch(console.warn), 65000);
  }
  return message;
}

export function listenRequests(channel, handler) {
  return Hooks.on("createChatMessage", async (message, options, senderId) => {
    const request = message.getFlag?.(scope, "combatRequest");
    if (request?.channel !== channel || request.target !== game.user.id) return;
    const sender = game.users.get(senderId);
    if (!sender || !request.packet || !message.whisper?.includes(game.user.id)) return;
    try {
      await handler(request.packet, sender);
    } finally {
      if (game.user.isGM || message.isOwner) await message.delete();
    }
  });
}
