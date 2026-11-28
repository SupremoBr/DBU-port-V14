# Dragon Universe RPG (DBU-MRR-OLD)

**Prévia 0.9.3 — `1.0.12-rules093-alpha.53`.** Atualiza a base de regras e converte personagens com backup. Vários efeitos continuam manuais. Leia [escopo, migração e limites](RULES-0.9.3.md) antes de atualizar o mundo. Foundry v13 continua suportado; teste no aplicativo real ainda pendente.

Automatización para [Foundry VTT](https://foundryvtt.com/) de la versión clásica
del juego de rol **Dragon Universe**, creado por el equipo de
[dbu-rpg.com](https://dbu-rpg.com/).

Esta implementación se realiza **con permiso expreso de los autores del juego**.
El proyecto es completamente **gratuito, sin ánimo de lucro, hecho por fans
para fans**. Sigue las reglas oficiales del sistema clásico (d10, Tiers of
Power, Ki y transformaciones) y no distribuye textos, ilustraciones ni
contenido escaneado de los manuales — para eso, visita
[dbu-rpg.com](https://dbu-rpg.com/) y apoya a los creadores.

## Adaptación de compatibilidad v14

Este fork conserva la autoría original MRR / ArdillaTactica. Versión local `1.0.12-rules093-alpha.53`, con ajustes de API y chat para probar en Foundry v14. `verified` permanece en v13: falta validación funcional en v14. Consulte [COMPATIBILITY-V14.md](COMPATIBILITY-V14.md).

## Instalación

En Foundry VTT → **Game Systems → Install System → Manifest URL**, pega:

```
https://raw.githubusercontent.com/SupremoBr/DBU-port-V14/main/system.json
```

## Características

- Hojas de personaje y NPC adaptadas a Dragon Universe (d10, Tiers of Power).
- Sistema de Ki, Life Points, transformaciones y auras.
- Automatización racial: Saiyan, Namekian, Majin, Android, Bio-Android,
  Arcosian, Cerealian, Earthling, Neko-Majin, Neo-Tuffle, Shadow Dragon,
  Shinjin, Custom Species y rasgos legendarios/mutación/bestiales.
- Battle Jacket y módulos.
- Equipamiento con qualities y armas.
- Compendio integrado de Racial Traits.
- Localización: español.
- Compatible con Foundry VTT v12.

## Requisitos

- Foundry VTT v12 (verified).
- Las reglas oficiales del juego: consíguelas en https://dbu-rpg.com/.

## Créditos

- **Sistema y reglas**: equipo de [dbu-rpg.com](https://dbu-rpg.com/).
- **Automatización para Foundry VTT**: MRR / ArdillaTactica.
- Implementación realizada **con permiso de los autores**.

## Estado y soporte

Este es el sistema "Old" (clásico) de Dragon Universe mantenido por
MRR/ArdillaTactica. Los reportes de bugs y sugerencias sobre la
automatización en Foundry van por
[GitHub Issues](https://github.com/ArdillaTactica/dbu-mrr-old/issues). Las
dudas de reglas del juego se consultan con los autores en
[dbu-rpg.com](https://dbu-rpg.com/).

## Licencia

El **código de automatización** se publica bajo licencia MIT (ver `LICENSE`).
Las **reglas del juego** pertenecen a sus autores
([dbu-rpg.com](https://dbu-rpg.com/)) y se reproducen aquí únicamente como
mecánicas implementadas en código, con su permiso, y sin redistribuir texto ni
arte de los manuales.

## Desenvolvimento

Execute `node --test tests/*.test.mjs`. As otimizações de catálogos e a preparação da ficha estão descritas em [OPTIMIZATIONS.md](OPTIMIZATIONS.md). A versão das regras permanece a da base recebida; não inclui a migração para DBU 0.9.3.

A ficha de personagem está organizada por área em [module/sheets/character/](module/sheets/character/README.md). A classe principal mantém o ciclo de vida do Foundry.

## DBU Automation integrada

Inclui DBU Automation DEV 1.9.22, mantendo suporte ao Foundry v13. Para usar a integração, desative o módulo externo DBU Automation/DEV e dbu-auto-start e recarregue o mundo. Consulte [instalação, dados existentes e validação](module/automation/README.md).
