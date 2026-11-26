# Changelog

## [1.0.12-rules093-alpha.31] — equipes de combate

- A escolha Sem Time permanece salva no encontro. A disposição do token passa a definir a relação nesse caso.
- HUD, filtros de área e vantagem de iniciativa respeitam as equipes do encontro. O HUD oculta tokens escondidos para jogadores.
- O preenchimento automático é delegado ao GM principal quando há mais de um mestre conectado.

## [1.0.12-rules093-alpha.30] — alvos, modificadores e ficha

- Ataques com seleção manual permitem escolher e confirmar os alvos. Tokens já selecionados aparecem marcados. A inicialização da automação integrada dispensa o aviso informativo do módulo antigo.
- Referências de Ataque exibem os modificadores em uma janela de consulta e destacam o bônus de Targeting System ao resultado natural. Profiles e armas incompatíveis são bloqueados antes da rolagem.
- Técnicas Assinatura reconhecem vantagens concedidas pelo Profile na validação de dependências. Limited Line limita o alcance do molde a 8 ou 4 casas, conforme o rank.
- Novas passivas condicionais usam dados da ficha, incluindo limiares de saúde e Super Stacks. [Inventário de passivas](docs/inventario-passivas-talentos-093.md)
- Cartões de talentos, Active Effects, Custom Buffs, Pressure Check e controles do HUD receberam ajustes de layout e acessibilidade. Na 0.9.3, a verificação de energia para entrar numa transformação usa o Ki atual.

A validação no Foundry com Dice So Nice e Dice Tray segue pendente.

## [1.0.12-rules093-alpha.29] — combate, técnicas e ficha

- Ranks gratuitos ficam fora do TP pago e do limite da técnica. **Free TP** continua como crédito separado. Targeting System ajusta o dado natural de Strike e pode gerar crítico.
- Parry apresenta a rolagem no chat quando as defesas são reveladas. Reflect usa o Wound do ataque original, incluindo Ki Wager e Energy Charges.
- O HUD ganhou Pular turno para o personagem ativo. As ações de Pressure Ataque e Defesa ficam no HUD, enquanto a ficha mantém os stacks e o Pressure após falhar Steadfast.
- Dano que cruza um limiar dispara a janela de Steadfast quando cabe teste. Path to Power ganhou um painel compacto.
- A prévia inclui ajustes em alcance, área, Grapple e dano por diferença de tamanho. Slip Through e Tiny Target seguem manuais.
- A ficha preserva mudanças concorrentes em campos não editados e a migração retoma o progresso a partir do backup existente.

A validação no Foundry com Dice So Nice e Dice Tray segue pendente.

## [1.0.12-rules093-alpha.28] — equipamentos e técnicas assinaturas

- As 64 vantagens e 41 desvantagens mostram efeitos, requisitos e links oficiais. O cálculo usa o TP atual por rank e sinaliza combinações incompatíveis.
- As listas de modificadores ocupam a largura da técnica, com os botões de adicionar acima delas. O seletor legado de Limit Break sai da ficha 0.9.3.
- As Referências de Ataque usam a arma selecionada, principal ou secundária. Weapon Assisted permite escolher a arma da técnica e valida se ela pode ser usada.
- A ficha usa os espaços de qualidade por fabricação e corrige os cálculos revisados de durabilidade e proteção de equipamentos. O reparo de armas continua assistido.
- Links, avisos de migração e backup do GM ficam no fim de Progressão. Steadfast e Reparo seguem o estilo dos botões da ficha.

## [1.0.12-rules093-alpha.27] — limiares de saúde e perícias

- A ficha registra Steadfast pendente ao cruzar um limiar de saúde. Combat permite rolar ou registrar o resultado, e o HUD indica a pendência.
- A cura acima do limiar limpa o resultado anterior. Dano maciço com origem conhecida aplica as falhas automáticas pertinentes. O Stress Test segue assistido.
- Flight e Cooking entram no catálogo e na progressão. Pilot usa Insight e preserva os ranks salvos.

## [1.0.12-rules093-alpha.26] — auditoria dos Demônios e Pressure no HUD

- Demonic Resilience concede +2(T) de redução de dano por sucesso defensivo, até +4(T), com duração até o início do próximo turno.
- O HUD tem botões separados para Pressure Ataque e Pressure Defesa. Ambos usam os limites da ficha.
- Corrigidos a seleção de sub-raça, o cálculo de Soak, a interação com Prone e Broken, o limite de LP de Demonic Resilience e o registro de Steadfast. [Auditoria por efeito](docs/auditoria-demonio-093.md)

## [1.0.12-rules093-alpha.25] — passivas raciais de atributos

- O Actor aplica bônus numéricos de 48 efeitos e opções em 42 traços raciais, incluindo fatores. Os cálculos usam o Tier ou Tier base indicado pela regra.
- As passivas chegam às rolagens, à redução de dano, aos limites de LP e à recuperação por Surges. Blood of the Warrior também atualiza o valor calculado de Surgency.

## [1.0.12-rules093-alpha.24] — HUD, traços no tracker e passivas de armas

- Os botões inferiores do HUD têm textos e ícones maiores e se reorganizam em telas estreitas.
- O HUD mostra Pressure Check, Demonic Power e Demonic Fatigue.
- O tracker exibe a contagem e os resumos dos traços raciais acionáveis selecionados.
- O cálculo de combate aplica oito passivas de talentos de armas, incluindo o bônus de Strike de Dual Wielding Specialist com duas armas equipadas.

## [1.0.12-rules093-alpha.23] — recursos raciais, passivas e TP

- Demonic Pressure acompanha Power e Fatigue na ficha, com Pressure Checks, bônus e limpeza no início do turno. Arcosian usa Overwhelm na 0.9.3.
- A ficha aplica 27 passivas de talentos adicionais. A auditoria lista os recursos e efeitos que ainda exigem resolução manual.
- TP grátis e ranks concedidos reduzem o gasto da técnica. O valor total continua contando para Ki e limite. Uma Unique Ability gratuita continua cobrando os aprimoramentos comprados.

## [1.0.12-rules093-alpha.22] — correção no cadastro de Unique Abilities

- A ficha aceita salvar habilidades únicas sem escolher um tipo. Habilidades de tipo duplo permitem escolher ou limpar Technical ou Magical.

## [1.0.12-rules093-alpha.21] — Unique Abilities 0.9.3

- Catálogo com 66 habilidades, 100 avanços e 16 restrições da 0.9.3. A ficha mostra resumos em português, custos e links oficiais. Os itens Unique Ability podem exibir a mesma referência.
- Entradas e opções antigas sem correspondência permanecem nas fichas como legado. Shapeshift usa Tier base no custo e na recuperação de Ki.

## [1.0.12-rules093-alpha.20] — visuais de ataques e técnicas na ficha

- Attack References e Signature Techniques têm um botão Visuais que edita a mesma configuração do menu Configurar Visuais.
- Sem mídia e Sem macro desativam também os visuais herdados. Os controles de transformação oferecem Sem trocar token e os menus exibem menos notas.

## [1.0.12-rules093-alpha.19] — imagens de token por transformação

- A aba Transformations permite vincular uma imagem do álbum Token Images ou escolher um arquivo para cada transformação. O Configurar Visuais usa a mesma configuração e continua oferecendo os controles de macro e tamanho no grid.

## [1.0.12-rules093-alpha.18] — card de ataque integrado

- Ataques da automação integrada publicam um card principal com os visuais, a rolagem nativa, as defesas e United Attack.
- Após a última defesa, o mesmo card revela Strike e Wound e exibe o botão de pagamento de Ki e Capacity. Cartas anteriores continuam usando seu fluxo original.

## [1.0.12-rules093-alpha.17] — tema da automação integrada

- HUD, painéis, manobras e Configurar Visuais passam a usar as cores, a tipografia e o fundo da ficha nativa.
- As janelas usam campos de alto contraste e foco de teclado visível. O menu de visuais e o HUD reorganizam os controles em telas estreitas.

## [1.0.12-rules093-alpha.16] — opção de sub-raça Saiyan

- O seletor Subrace usa as sub-raças da 0.9.3. Full-Blooded integra a descrição da raça Saiyan, e as variantes de Racial Factors continuam na aba Traits.

## [1.0.12-rules093-alpha.15] — seletor de sub-raças

- Basic Information volta a usar um menu para Subrace. O menu inclui as sub-raças das páginas das raças e mantém Full-Blooded para Saiyan como identificação. Racial Factors são escolhidos na aba Traits.

## [1.0.12-rules093-alpha.14] — Path to Power e sub-raças

- A aba Progression oferece Path to Power por personagem, desativado inicialmente. Os níveis marciais liberam a progressão do PL 1, ajustam LP e Ki e incluem o dado marcial nas rolagens de combate. A partir do PL 2, Martial Remnant mantém o d10 se marcado.
- Até ML 4, aplica os limites de Energy Charges e Signature Techniques, além das restrições de Stress, Ki Multiplier, Burst Recovery e Awakenings. Efeitos de traços que tratam Supers como Ultimates são decididos na mesa.
- Basic Information registra a sub-raça. Na aba Traits, o lápis marca um traço adicional da sub-raça e Racial Factors abre o seletor de substituições. As escolhas continuam manuais.

## [1.0.12-rules093-alpha.13] — prévia de ataque e compêndio racial

- Attack Ref usa o Critical Target do perfil em Strike e Wound. Cutting mostra Wound CT 5+ tanto na fórmula quanto na célula.
- O compêndio racial legado inclui os 177 itens do catálogo 0.9.2 fornecido com o sistema.

## [1.0.12-rules093-alpha.12] — seletor de Racial Factors

- A aba Traits tem um botão Racial Factors, com busca por nome e grupos para os fatores da raça e os fatores gerais compatíveis.
- O seletor mostra pré-requisitos, o limite e o traço a substituir quando a regra indica um nome específico. A adição e a remoção continuam manuais.
- Inclui 26 Factor Traits que estavam ausentes do catálogo, entre eles entradas com substituições indicadas entre colchetes na fonte.

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
