# Changelog

## [1.0.12-rules093-alpha.11] — Auras na ficha

- As fichas 0.9.3 ocultam o editor de Signature Auras e excluem auras legadas do saldo de TP. As auras salvas foram preservadas.

## [1.0.12-rules093-alpha.10] — progressão inicial

- O Skill Improvement inicial oferece seis ranks e 25 TP. Converter o Character Perk oferece quatro ranks e 15 TP.
- Progressão e Técnicas calculam os TP ganhos pela mesma regra. Gifted Student concede +1/+2 em Skill Checks e mantém +3/+6 TP.
- A ficha valida as novas escolhas de talentos e perícias iniciais. Em Técnicas, uma assinatura elegível de até 20 TP pode ser marcada como gratuita.

## [1.0.12-rules093-alpha.9] — referência de transformações

- Os traços de transformação exibem o resumo de cada nível e as opções descritas pela regra 0.9.3 em uma janela com o tema escuro do sistema.
- Os seletores de opções dos traços têm altura para exibir o texto completo na vertical.

## [1.0.12-rules093-alpha.8] — escolhas dos traços raciais

- Os traços com opções 0.9.3 agora exibem seletores e resumos por opção. As escolhas são gravadas na ficha, com os limites para seleção múltipla e os efeitos que acompanham uma escolha anterior.
- Divine Magic oferece dez domínios no Lv.3. As opções que concedem Favored Element exibem também a seleção do Profile Elemental.

## [1.0.12-rules093-alpha.7] — resumos por nível

- Cada nível dos traços raciais e talentos descreve seu efeito na ficha. Os links para as regras completas e as descrições personalizadas continuam disponíveis.

## [1.0.12-rules093-alpha.6] — buffs por traço e talento

- O lápis de cada traço e talento permite configurar buffs próprios do personagem. A ficha mostra o estado de cada buff.
- Buffs vinculados e avulsos podem ativar abaixo de uma porcentagem de LP, com um estado de combate ou com uma condição selecionada. Efeitos que alteram atributos base ou recursos continuam disponíveis em Sempre.

## [1.0.12-rules093-alpha.5] — Custom Buffs

- Bônus de técnicas passam a afetar fórmulas, dados extras, CT e TP por Skill Improvement. Categoria de dano e dados de Energy Charge chegam às rolagens.
- O modificador de custo de Ki “no cap” passa a ser aplicado após o piso. Resultados continuam limitados a zero ou mais.
- A aba reconhece variações de maiúsculas e espaços, usa uma única lista de sugestões e identifica efeitos antigos cuja aplicação é manual.

## [1.0.12-rules093-alpha.4] — descrições de traços e talentos

- Os cartões mostram resumos e mantêm o link para a regra completa. O botão de lápis permite personalizar a descrição por personagem e restaurar o resumo original.

## [1.0.12-rules093-alpha.3] — categorias de talentos

- Os 275 talentos usam as 33 categorias oficiais nos filtros e grupos da ficha e do seletor.

## [1.0.12-rules093-alpha.2] — legibilidade dos controles

- Texto fixo em branco nos controles de Actions e no painel de fontes/revisão, incluindo botões e seus estados de interação, sem depender do tema do Foundry.

## [1.0.12-rules093-alpha.1] — prévia de regras 0.9.3

- Catálogos atuais de raças/traços, talentos e transformações, com fontes oficiais; tabelas de criação e passivos básicos de Saiyan revistos.
- Pools Standard/Counter integrados à ficha e automação; conversão de Actions, ajustes explícitos de Momentum e custos atuais de Defend.
- Custos TP/KP atuais, Profiles e Super Profiles/Dramatic Finisher, validação de escolhas removidas e correções de Crushing/Cutting/Clearing e charges.
- Limites de Awakenings/stacking, entrada por Transformation Maneuver e regras gerais de NLoP/Legend Realized/Full Awakening.
- Migração pelo GM com backup anterior a qualquer alteração, dados de tokens desvinculados, retomada após falhas e avisos de revisão nas fichas.
- **Prévia com resolução manual de muitos efeitos. Não representa automação integral da edição nem teste funcional no Foundry real.** Veja [RULES-0.9.3.md](RULES-0.9.3.md). Foundry v13 preservado.

## [1.0.11-v14.4] — DBU Automation integrada

- Incluye DBU Automation DEV 1.9.22 en el sistema: HUD, paneles, ataques/defensas, auras, transformaciones, equipos y demás recursos del módulo. Foundry v13 sigue soportado.
- Usa el socket del sistema, configuraciones propias y hooks de chat adaptados a v13. Conserva la API global para macros existentes.
- No carga la copia integrada si DBU Automation/DEV o dbu-auto-start están activos; incluye opción de desactivación y controles contra inicialización duplicada.
- Migración inicial de preferencias y flags anteriores sin sobrescribir datos actuales ni eliminar los originales; evita resucitar flags eliminadas después de la migración.
- Ver README de la integración para límites de validación y uso de un mundo de prueba. No incluye migración de reglas a DBU 0.9.3.


## [1.0.11-v14.3] — ficha modular

- Clase principal reducida de 17.613 a 663 líneas; lógica distribuida en 22 módulos de dominio y eventos.
- Preservados los 385 métodos de prototipo y los 246 registros de eventos, con composición que detecta colisiones antes de instalar métodos.
- Conservadas las llamadas a super, las tablas de downtime y las llamadas entre módulos/subclases; corregidas tres rutas de import dinámico tras mover el tracker.
- 25 pruebas aprobadas, incluida la referencia completa de métodos y las 64 comparaciones previas de datos visuales. Sin cambios de reglas ni migración a DBU 0.9.3.


## [1.0.11-v14.2] — optimización de catálogos

- Índices compartidos por ID para rasgos raciales, talentos y otros catálogos.
- Cálculo de pasivas desactivadas por índice de efectos; Stress preparado desde metadatos o texto legado interpretado una sola vez.
- Preparación de rasgos, talentos, efectos y recursos extraída a character-data.mjs, conservando datos editables separados por personaje.
- Dieciséis pruebas, incluidas 64 comparaciones de datos de ficha con la versión anterior. Sin cambios en las reglas del juego.


## [1.0.11-v14.1] — adaptación de este fork

- Manifest y descarga apuntan a SupremoBr/DBU-port-V14; el ZIP está fijado al tag de esta versión.
- APIs con namespace y alternativas para v12, registro moderno de fichas y hook HTML del chat para v13+.
- Se espera la carga de templates. Se incluyen seis pruebas de compatibilidad.
- v14 permitida para pruebas; versión verificada se mantiene en v13. Créditos y licencia originales preservados.

## [1.0.10] - 2026-08-14

- Mejoras en los catálogos de efectos de maestría (`mastery-effects`),
  transformaciones (`transformations`) y habilidades únicas
  (`unique-abilities`).
- Correcciones y mejoras en el sistema de duelos.
- Mejoras en la automatización de talentos y en la lógica del actor.
- Correcciones en la hoja de personaje y en la pestaña de secuaces.

## [1.0.9] - 2026-08-14

- Nueva pestaña de secuaces (`tab-minion`) en la hoja de personaje.
- Mejoras en el catálogo de rasgos de secuaces (`minion-traits`).
- Correcciones en la lógica del actor y en la hoja de personaje.
- Mejoras en las pestañas de combate y principal.

## [1.0.8] - 2026-08-14

- Mejoras en el catálogo de rasgos de secuaces (`minion-traits`).
- Correcciones en el modelo de datos del personaje, la lógica del actor y la
  hoja de personaje.
- Mejoras en las pestañas de combate, principal y progresión.
- Ajustes de estilos (CSS).

## [1.0.7] - 2026-08-14

- Mejoras en las técnicas de aura maligna (`evil-aura-techniques`).
- Mejoras en la automatización racial de arcosianos y en los talentos.
- Correcciones en el modelo de datos del personaje, la lógica del actor y la
  hoja de personaje.
- Mejoras en las pestañas de combate y talentos, y en los bonos raciales de
  combate.

## [1.0.6] - 2026-08-09

- Nuevos parciales de plantilla: bonos raciales y de transformación en combate,
  y rastreador de crueldad (`cruelty-tracker`).
- Mejoras en la lógica del actor y en la hoja de personaje.
- Mejoras en las pestañas de combate, principal, rasgos y transformaciones.
- Ajustes en la carga de plantillas y en los estilos (CSS).

## [1.0.5] - 2026-08-07

- Mejoras en la automatización de poderes de mejora (`enhancement-powers`).
- Correcciones en la lógica del actor y en la hoja de personaje.
- Mejoras en las pestañas de auras, combate, técnicas y rasgos.
- Ajustes de estilos (CSS).

## [1.0.4] - 2026-08-04

- Nuevos catálogos: rasgos cibernéticos (`cybernetic-traits`), meta-rasgos
  (`meta-traits`) y cualidades base (`base-qualities`), con su automatización.
- Mejoras en la automatización racial: bio-android, arcosianos, formas
  alternas y rasgos bestiales.
- Correcciones y mejoras en el sistema de duelos.
- Mejoras en la hoja de personaje, battle jacket y varias pestañas (bio,
  fusión, skills, técnicas, únicas, combate, equipo, downtime).
- Ajustes de estilos (CSS).

## [1.0.3] - 2026-07-26

- Nuevo sistema de duelos (`module/helpers/duel.mjs`).
- Nuevo catálogo de objetos básicos (`basic-items-catalog`) integrado en la
  pestaña de equipo.
- Mejoras extensas en la hoja de personaje y en la pestaña de combate.
- Mejoras en la automatización de talentos raciales.
- Ajustes de estilos (CSS) y plantillas de combate/equipo.

## [1.0.2] - 2026-05-14

- Compatibilidad con Foundry VTT v13 declarada (`compatibility.verified` y
  `maximum` a `"13"`).
- Migración del bloque `gridDistance`/`gridUnits` al objeto `grid` (formato
  v12+).
- Retirados `primaryTokenAttribute` y `secondaryTokenAttribute` (deprecados
  desde v11). Las barras de token deben configurarse desde el TokenDocument.

> ⚠️ **Aviso**: esta versión solo declara compatibilidad a nivel manifest. El
> código de los sheets sigue usando las clases ApplicationV1 (`ActorSheet`,
> `ItemSheet`), que están deprecadas en v13. Si aparecen errores en consola
> al cargar el sistema en v13, abre una issue con el stack trace.

## [1.0.1] - 2026-05-14

- Renombrado público a **Dragon Universe RPG - Old System** (manteniendo el ID
  interno `DBU-MRR-OLD` por compatibilidad con instalaciones existentes).
- Aclaración de créditos y permisos: automatización realizada con permiso del
  equipo de [dbu-rpg.com](https://dbu-rpg.com/).
- README y descripción actualizados para reflejar la naturaleza fan-made,
  gratuita y no comercial del proyecto.

## [1.0.0] - 2026-05-14

- Primera release pública del sistema para Foundry VTT v12.
- Hojas de personaje y NPC.
- Battle Jacket y módulos.
- Automatización racial completa.
- Compendio inicial de Racial Traits.
- Localización en español.
