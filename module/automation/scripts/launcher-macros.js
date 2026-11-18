const LAUNCHERS = [
  {
    name: "DBU - Ataque",
    img: "icons/skills/melee/strike-sword-steel-yellow.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"attack\");"
  },
  {
    name: "DBU - Energy Charge",
    img: "icons/magic/lightning/bolt-strike-blue.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"energyCharge\");"
  },
  {
    name: "DBU - Signature Aura",
    img: "icons/magic/light/explosion-star-glow-yellow.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"aura\");"
  },
  {
    name: "DBU - Transformação",
    img: "icons/creatures/reptiles/dragon-horned-blue.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"transform\");"
  },
  {
    name: "DBU - Painel de Combate",
    img: "icons/containers/chest/chest-reinforced-steel-brown.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"panel\");"
  },
  {
    name: "DBU - HUD de Combate",
    img: "icons/tools/navigation/compass-brass-blue-red.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"hud\");"
  },
  {
    name: "DBU - Painel do Mestre",
    img: "icons/tools/navigation/map-marked-blue.webp",
    command: "if (!game.user?.isGM) return ui.notifications.warn(\"DBU Automation: o Painel do Mestre é exclusivo do GM.\"); if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"gmPanel\");"
  },
  {
    name: "DBU - Configurar Visuais",
    img: "icons/tools/hand/brush-paint-brown.webp",
    command: "if (!globalThis.DBUAutomation?.launch) return ui.notifications.error(\"DBU Automation não está carregado.\"); await globalThis.DBUAutomation.launch(\"visualConfig\");"
  },
  {
    name: "DBU - Status Automation",
    img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    command: "if (globalThis.DBUAutomation?.diagnostic) return globalThis.DBUAutomation.diagnostic(); if (globalThis.DBUAutomation?.status) return globalThis.DBUAutomation.status(); return ui.notifications.error(\"DBU Automation não está carregado. Verifique Manage Modules.\");"
  }
];

export async function migrateLauncherMacros({ overwrite = true } = {}) {
  if (!game.user?.isGM) {
    ui.notifications.warn("DBU Automation: somente o GM pode criar/atualizar macros globais.");
    return [];
  }

  const results = [];

  for (const spec of LAUNCHERS) {
    const existing = game.macros.getName(spec.name);

    if (existing) {
      if (!overwrite) {
        results.push({ name: spec.name, action: "kept", id: existing.id });
        continue;
      }

      await existing.update({
        type: "script",
        command: spec.command,
        img: spec.img
      });

      results.push({ name: spec.name, action: "updated", id: existing.id });
      continue;
    }

    const created = await Macro.create({
      name: spec.name,
      type: "script",
      command: spec.command,
      img: spec.img,
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      }
    });

    results.push({ name: spec.name, action: "created", id: created?.id });
  }

  ui.notifications.info("DBU Automation: atalhos de macro criados/atualizados.");
  console.log("DBU Automation | Launcher migration", results);
  return results;
}
