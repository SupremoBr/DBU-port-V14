const scopeSelector = "[data-dbu-share-scope]";

export function ruleShareButton(name) {
  if (!name) return "";
  const escaped = foundry.utils.escapeHTML(String(name));
  return `<button type="button" class="dbu-share-rule" data-dbu-share-rule="${escaped}" title="Enviar ao chat" aria-label="Enviar ${escaped} ao chat"><i class="fas fa-comment-alt" aria-hidden="true"></i></button>`;
}

export async function shareRuleToChat(button, actor) {
  const scope = button.closest(scopeSelector);
  if (!scope || button.disabled) return;
  const parts = [...scope.querySelectorAll("[data-dbu-share-text]")]
    .filter(node => node.closest(scopeSelector) === scope)
    .map(node => (node.matches("textarea, input") ? node.value : node.textContent.replace(/\s+/g, " ")).trim())
    .filter(Boolean);
  if (!parts.length) {
    ui.notifications.warn("Esta entrada ainda não tem uma descrição para compartilhar.");
    return;
  }

  const esc = foundry.utils.escapeHTML;
  const href = scope.dataset.dbuShareSource || scope.querySelector("[data-dbu-share-source]")?.getAttribute("href");
  const source = /^https?:\/\//i.test(href || "")
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Regra completa no site</a>` : "";
  button.disabled = true;
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: [],
      blind: false,
      content: `<article class="dbu-rule-chat"><h3 class="dbu-attack-title">${esc(button.dataset.dbuShareRule)}</h3><div class="dbu-rule-chat-text">${parts.map(text => `<p>${esc(text)}</p>`).join("")}${source}</div></article>`
    });
  } catch (error) {
    console.error("DBU | Compartilhar regra", error);
    ui.notifications.error("Não foi possível enviar a descrição ao chat.");
  } finally {
    button.disabled = false;
  }
}

export function bindRuleSharing(root, actor) {
  root?.addEventListener?.("click", event => {
    const button = event.target.closest?.("button[data-dbu-share-rule]");
    if (button) {
      event.preventDefault();
      void shareRuleToChat(button, actor);
    }
  });
}
