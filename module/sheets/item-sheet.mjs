import { bindRuleSharing } from "../helpers/rule-share.mjs";
import { ItemSheet, TextEditor } from "../helpers/foundry-compat.mjs";
/**
 * Item sheet for all DBU-OLD item types.
 * Uses a dynamic template based on item type.
 * @extends {ItemSheet}
 */
export class DBUItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dbu-old", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description"
        }
      ]
    });
  }

  /**
   * Use the generic item template for now.
   * Type-specific templates will be added in future sessions.
   * @override
   */
  get template() {
    return "systems/DBU-MRR-OLD/templates/item/item-sheet.hbs";
  }

  // -------------------------------------------------------
  // Data Preparation
  // -------------------------------------------------------

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);

    // Convenience references
    context.system = this.item.system;
    context.flags = this.item.flags;

    // System config (for drop-down options, labels, etc.)
    context.config = CONFIG.DBU ?? {};
    if (this.item.type === "uniqueAbility") {
      const catalog = context.config.uniqueAbilitiesCatalog || {};
      const key = this.item.system.abilityKey;
      context.isUniqueAbility = true;
      context.uniqueAbility = catalog[key];
      context.uniqueAbilityOptions = Object.fromEntries([
        ["unknown", "Sem habilidade vinculada"],
        ...Object.values(catalog)
          .filter(ability => !ability.legacy || ability.id === key)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(ability => [ability.id, ability.name + (ability.legacy ? " (legado)" : "")])
      ]);
      if (key && !Object.hasOwn(context.uniqueAbilityOptions, key)) context.uniqueAbilityOptions[key] = key;
    }

    // Enrich the description field for display
    context.enrichedDescription = await TextEditor.enrichHTML(
      this.item.system.description ?? "",
      { async: true, relativeTo: this.item }
    );

    // If the item is owned by an actor, provide actor context
    if (this.item.actor) {
      context.actor = this.item.actor;
      context.actorSystem = this.item.actor.system;
    }

    return context;
  }

  // -------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    bindRuleSharing(html[0], this.item.actor);

    // Everything below requires owner permission
    if (!this.isEditable) return;

    // Add type-specific listeners here as needed
  }
}
