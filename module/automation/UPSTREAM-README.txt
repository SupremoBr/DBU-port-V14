DBU AUTOMATION v1.8.12 — DEV / DBU 0.9.2

ALTERAÇÕES v1.8.12 DEV
-----------------------
- Combat Panel: cache das mensagens de ataque e uma única leitura por Actor para Defense/Intervene/Reflect.
- Combat Panel: refreshes de Chat/Combat agora são debounced, evitando múltiplas renderizações em rajada.
- Standard Actions: timers de troca de turno processam somente o Actor que saiu e o Actor que entrou no turno.
- Standard Actions: sincronização de Power Buff na troca de turno deixou de percorrer todos os Actors do mundo.
- Combat Teams: preenchimento automático A/B usa updateEmbeddedDocuments em lote, preservando Times manuais.
- Attack Core: captura a mensagem nativa pelo hook createChatMessage com timeout/fallback único, removendo polling de até 20 scans.
- Nenhuma regra de DBU foi alterada; esta versão continua exclusiva para DBU 0.9.2.

DBU AUTOMATION v1.8.11 — TESTE / DBU 0.9.2

ALTERAÇÕES v1.8.11 TEST
-----------------------
- Times automáticos ao entrar no Encounter:
  - Actor com OWNER de jogador -> Time A.
  - Actor sem OWNER de jogador -> Time B.
  - Times já definidos manualmente pelo GM não são sobrescritos.
- Painel do Mestre continua permitindo mudar cada combatente para Time A/B/C/D.
- HUD de aliados durante Encounter agora usa diretamente os Combatants do mesmo Time.
  - Pode mostrar tanto PCs quanto NPCs aliados.
  - Combatants de outro Time não aparecem como aliados.
  - Tokens ocultos continuam ocultos para jogadores.
- Card do Combat Recovery agora informa nominalmente quem está elegível para usar Exploit em até 8 Squares.
- Mantém sistema de Times, Battle Born, Exploit/Reflect e correções anteriores da v1.8.9.

DBU AUTOMATION v1.8.9 — TESTE / DBU 0.9.2

ALTERAÇÕES v1.8.9 TEST
- Novo sistema de Times por Encounter no Painel do Mestre.
- O Time fica salvo no Combatant, não permanentemente no Actor.
- Time A/B/C/D: mesmo Time = aliado; Times diferentes = inimigos.
- Automático usa a Disposition como fallback enquanto algum combatente estiver sem Time.
- Combat Recovery/Exploit usa Times para detectar oponentes.
- Intervene usa Times para detectar aliados.
- HUD de aliados respeita os Times durante o Encounter.
- Battle Born: mensagens nativas criadas sem o player OWNER são encaminhadas ao dono do Actor.
- Mantém correções da v1.8.8 para HUD, Exploit e Reflect.

DBU AUTOMATION v1.8.8 — TESTE / DBU 0.9.2

ALTERAÇÕES v1.8.8 TEST
----------------------
- HUD recolhida: corrige o COUNTER que caía para uma segunda linha.
- STANDARD, INSTANT e COUNTER permanecem juntos na mesma linha no modo compacto.
- Para preservar espaço no modo recolhido, são exibidos no máximo os 2 primeiros favoritos; ao expandir a HUD, todos os favoritos configurados voltam a aparecer.
- Mantém o hotfix v1.8.7 de Exploit: Basic Attack Out-of-Sequence com atacante/alvo travados e resolução mais segura de Attack References.
- Mantém o hotfix v1.8.7 de Reflect: oportunidade contextual após Parry/Deflect, acesso pela HUD e custo via helper existente.

HISTÓRICO v1.8.7 TEST
----------------------
- Exploit: reforço da chamada do Attack Core para Basic Attack Out-of-Sequence.
- Reflect: integração da pendência contextual com a janela COUNTER, sem transformar Reflect em Counter Action.

HISTÓRICO v1.8.4 TEST
----------------------
ALTERAÇÕES v1.8.4 TEST
----------------------
- Economia de Standard/Counter Actions agora é permissiva: o módulo registra e avisa, mas não bloqueia usos extras concedidos por Traits, Characteristics, Transformations ou outros efeitos.
- Surge não possui cálculo/contador paralelo no DBU Automation: HUD e Painel chamam o mesmo _onUseSurge nativo da ficha DBU 0.9.2. O próprio sistema continua permitindo usos extras quando outro recurso os concede.
- Surge e Combat Recovery continuam restritos a Encounter ativo.
- COUNTER na HUD é contextual: Defend, Duel, Intervene e Exploit só ficam selecionáveis quando existe uma pendência válida.
- Duel agora só é oferecido contra Signature Technique, ataque com 2+ Energy Charges ou Ki Wager de 10(bT)+.
- Intervene usa o alcance correto de 8 Squares e só surge quando o personagem realmente é elegível.
- Combat Recovery cria Exploit para cada oponente detectado em até 8 Squares. O oponente pode escolher Basic Attack ou Ignorar; o ataque usa o Attack Core existente como Out-of-Sequence.
- Se o Basic Attack do Exploit atingir quem usou Combat Recovery, os LP recuperados pelo Combat Recovery naquele Round são perdidos automaticamente.
- O Terrain Shield avalia apenas o Damage do ataque/collision; a perda posterior de LP do Combat Recovery não desgasta/destrói a Feature.
- INSTANT na HUD reutiliza Surge, Terrain Lift e Transformation/Revert existentes. Called Shot, No Effort, Triggered e Blockade ficam preparados sem criar automações duplicadas nesta etapa.
- Revert continua dentro da automação de Transformation; Energy Cancel continua dentro da automação de Energy Charge; United Attack continua no Attack Core.

HISTÓRICO v1.8.2
ALTERAÇÕES v1.8.2
- Combat Recovery agora exige Encounter ativo.
- Surge agora exige Encounter ativo.
- Throw mostra explicitamente a Feature carregada pelo Terrain Lift e melhora suporte a Synthetic Actor/token.
- HUD ganhou botões INSTANT e COUNTER como categorias preparadas, sem novas automações vinculadas nesta versão.
- Pendências contextuais continuam separadas do menu Counter.

==================================================


NOVIDADES / CORREÇÕES DA v1.8.1
--------------------------------
- HOTFIX: corrigidos dois erros de sintaxe do patch 1.8.1 que impediam o
  `scripts/main.js` de carregar (action-economy.js e energy-charge.js).
- Recovery 0.9.2: ao confirmar End Encounter no Combat Tracker, os personagens
  de jogadores que participaram do encontro recebem automaticamente Instant
  Recovery: +1/10 do Maximum Life Points e +1/10 do Ki Point Pool, sem recuperar
  Capacity e sem ultrapassar os máximos.
- Painel do Mestre ganhou o botão Prolonged Recovery. Fora de Combat, o GM pode
  escolher os personagens e quantas horas passaram; cada hora recupera mais
  1/10 do Maximum Life Points e +1/10 do Ki Point Pool.
- Instant Recovery registra o Combat ID no Actor para impedir recuperação
  duplicada do mesmo encontro caso mais de um fluxo de encerramento seja acionado.
- Consolidação da camada Standard da v1.8.0 com correções de economia de
  Actions, Combat Recovery, Pinned, Grapple, permissões cross-owner, Pendências,
  Terrain Lift e Energy Charge.
- Combat Recovery usa mecanicamente o efeito nativo `Defense Value`, aceita o
  número real de Actions disponíveis (mínimo 2) e não possui teto artificial de
  3 Actions quando algum efeito aumentar a economia de Actions.
- Validação central de Actions para Standard Maneuvers e restrições de Pinned,
  inclusive quando a ação é chamada por outros pontos de entrada do módulo.
- Registry de Maneuvers preparado para resolver o tipo efetivo dinamicamente
  (Standard / Instant / Counter / Out-of-Sequence), sem abrir ainda os novos menus.
- Grapple reforçado com estado persistente, referências de Scene/Token/Actor,
  escape no início do turno, Conditions por origem e base reutilizável para
  movimento durante Grapple.
- Atualizações em Actors de outros jogadores usam confirmação do GM para reduzir
  risco de transferências parciais e erros de ownership.
- Exploit pendente da camada Standard é integrado à infraestrutura comum de
  Pendências, ainda sem resolução automática do Counter.
- Terrain Lift valida alvo/Feature e distância real de Melee Range; Telekinesis
  continua sendo tratada como exceção 0.9.2 quando aplicável.
- Energy Charge só oferece tipos Instant/OoS quando o Actor realmente possui um
  efeito 0.9.2 que permita a exceção.
- Miracle Empowerment permanece uma opção geral do Empower conforme a regra
  0.9.2, mediante Fatigued.
- NOVO: fora de um Encounter ativo do Foundry, limites [X/Round] e [X/Encounter]
  não bloqueiam as Maneuvers. A economia de Actions por Round também não bloqueia
  usos fora do combate. Custos de Ki/Capacity, requisitos, alcance e Conditions
  continuam valendo normalmente. Usos feitos fora de combate são marcados para
  não contaminar os contadores do próximo Encounter.
- Surge fora de Encounter não consome o uso 1/Encounter; Terrain Lift e United
  Attack também não deixam bloqueios residuais de Round quando usados fora de
  Combat.

NOVIDADES DA v1.8.0
-------------------
- A HUD foi reorganizada para crescer por TIPO DE MANEUVER em vez de criar um
  botão fixo para cada ação. Nesta primeira etapa somente STANDARD está ativo;
  o registro central já aceita Instant, Counter e Out-of-Sequence nas próximas
  versões sem redesenhar a HUD.
- Barra de FAVORITOS individual por jogador (até 5). Padrão: Ataque e
  Transformação. No menu STANDARD, a estrela adiciona/remove atalhos.
- Menu STANDARD inclui todas as Standard Maneuvers básicas do DBU 0.9.2.
- Automações novas: Power Up, Combat Recovery, Empower, Grapple, Launch, Pin,
  Thrust e Throw da Feature carregada por Terrain Lift.
- Power Up controla 2 usos/Round, stacks, renovação, +1/4 Max Capacity por
  stack e +1(T) Combat Rolls por stack. Cada stack criada pelo módulo expira no
  fim do próximo turno do personagem; aumentos nativos de máximo são respeitados.
  A arquitetura aceita modificadores de Traits/Talents em provedores futuros.
- Combat Recovery escolhe Actions e rola a pool correta de 1d10(bT) por Action
  (ex.: 2 Actions em bT 2 = 4d10) para LP/Ki, aplica a penalidade de Defense e
  registra quais oponentes em até 8 Squares estão elegíveis ao Exploit. Condition
  Recovery fica assistido até a camada de Checks/Counter.
- Empower transfere Ki para outro personagem, considera Might/Melee Range e
  Capacity, filtra Allies pela disposição do token e inclui Miracle Empowerment:
  +1 Dice Category de ToP Extra Dice até o fim do próximo turno e Fatigued quando
  aplicável. Atualizações em ficha de outro jogador são mediadas pelo GM.
- Grapple usa o Clash nativo DBU e mantém estado persistente Grappler/Grappled;
  Guard Down é aplicado com preservação de origem. Launch e Pin aparecem apenas
  para o Grappler; após vencer Launch surge a continuação para lançar/manter o
  Grapple, e Pinned libera a ação contextual de Might Clash para escapar do Pin.
  Escape do Grapple/Pulled In/End Grapple ficam para a futura camada Instant.
- Throw reconhece automaticamente a Feature do Terrain Lift: Simple Profile,
  penalidade de Strike, limite de Ki Wager de 1/4 do Ki atual e Collision Damage
  pela Hardness. Ao lançar, a Feature deixa de fornecer Terrain Shield; a regra de
  queda adjacente/continuação após erro é anunciada, com posicionamento manual.
- Movement, Command e Toss já aparecem no menu com a regra/declaração no chat;
  suas integrações mais invasivas (movimento, Minions e inventário) ficam
  preparadas para atualizações próprias.


NOVIDADES DA v1.7.4

- Surge Maneuver agora pode ser acionado pela HUD e pelo Painel de Combate.
  O módulo prioriza a automação nativa da ficha DBU e oferece Healing Surge
  ou Ki/Power Surge.
- Terrain Lift / Levantar Terreno foi adicionado à HUD e ao Painel de Combate
  seguindo a regra 0.9.2: Instant, 0 KP e 1/Round.
- Terrain Lift faz um Force Ability Check (1d10 + Force Score). O Target Number
  começa em TN 6 para Hardness 1 e aumenta em +4 para cada Hardness acima de 1.
- A manobra só pode ser usada no Standard Environment e não funciona com
  Hardness abaixo de 1. Telekinesis permite usar Magic no lugar de Force.
- Se o teste passar, a Feature fica carregada. Chão levantado vira uma Feature
  de 1 Square; o mesmo botão passa a servir para Colocar Terreno.
- Shielding do Terrain Lift é automático: ao ser atingido, reduz o Dice Score do
  Wound em 5 x Hardness. Se ainda houver Damage, a Feature é destruída; se o
  Damage chegar a 0, a redução do Shield diminui pelo Hardness da Feature.

NOVIDADES DA v1.7.3
-------------------
- Manifested Powers não aparecem mais como Transformation na HUD.
- O filtro agora usa o tipo nativo `manifested_power`, com proteções adicionais
  para catalogKey/nome, em vez de depender apenas do texto exibido.
- O mesmo filtro foi reforçado no gerenciador de Transformations para manter
  HUD e diálogo consistentes.

BASE
----
A v1.7.3 foi construída sobre a v1.7.1, preservando o posicionamento individual
da HUD e a leitura de aliados. Esta revisão adiciona tamanho e transparência por
jogador e simplifica os aliados para uma apresentação limpa, sem painel em caixa.

NOVIDADES DA v1.7.3
-------------------
- Tamanho do bloco de LP/HP, Ki e Capacity ajustável de 50% a 150%.
- Visibilidade/transparência do bloco de recursos ajustável de 25% a 100%.
- Tamanho e transparência dos aliados possuem controles independentes.
- Aliados agora aparecem somente com foto circular, nome e barra de LP.
- Removidos cabeçalho, fundo, borda e caixas individuais do painel de aliados.
- O valor exato de LP continua disponível ao passar o mouse sobre o aliado.
- Arraste continua funcionando mesmo quando o bloco está redimensionado.

HISTÓRICO DA v1.7.1
-------------------
- O bloco de LP/HP, Ki e Capacity passou a ter posição individual por jogador.
- Pode escolher canto + distância horizontal/vertical nas Preferências do HUD.
- Também é possível arrastar o bloco pela alça; a posição é salva no cliente.
- Foi adicionado o HP dos aliados presentes na cena.
- O conjunto de aliados pode ser reposicionado/arrastado e ocultado por jogador.
- Alterações de LP dos aliados atualizam automaticamente.

NOVIDADES PRINCIPAIS
--------------------
1) HUD DE COMBATE DBU
- Interface fixa e personalizada para o Actor controlado pelo jogador.
- Bloco de status no alto à esquerda, inspirado em HUDs de jogos de luta de
  Dragon Ball: portrait angular, nome, Tier/Base Tier e Round/turno.
- LP, Ki e Capacity em três barras grandes, coloridas e numeradas; recursos em
  25% ou menos recebem alerta vermelho pulsante.
- Barra de favoritos pessoais (até 5) + menu STANDARD; Ataque e Transformação
  são os favoritos iniciais e podem ser trocados por cada jogador.
- Bandeja horizontal de Attack References e Signature Techniques; clicar em uma
  delas abre o diálogo de ataque já com aquela fonte selecionada.
- Estado atual de Transformation, Signature Aura e Energy Charge.
- Contadores de alvos e pendências, abertura da ficha e do Painel de Combate.
- Pode ser recolhido, fechado ou aberto pelo lançador DBU HUD próximo à hotbar.
- Também aparece no Token HUD e possui macro launcher "DBU - HUD de Combate".
- Preferências individuais: ativar/desativar, abrir ao selecionar token e ocultar
  a hotbar padrão somente enquanto o HUD estiver aberto.
- Nenhuma dependência do Argon e nenhuma alteração nos arquivos do sistema DBU.

2) CATEGORIA DE DANO AJUSTÁVEL NO ATAQUE
- O diálogo de Ataque mostra a categoria original da técnica.
- Antes de anunciar, o jogador pode escolher Standard, Direct ou Lethal quando
  uma habilidade, recurso ou efeito permitir a mudança.
- Ao trocar a técnica selecionada, o campo volta automaticamente para a categoria
  original da nova técnica, evitando reaproveitar um ajuste por engano.
- Quando houver alteração, os cards registram claramente "Original → Escolhida"
  como ajuste manual.
- A categoria escolhida é usada pelo cálculo de dano e pelas integrações de
  defesa, Intervene, Reflect e Duel; não é necessário automatizar cada exceção.

3) PAINEL EXCLUSIVO DO MESTRE
- Acesso pelo novo grupo DBU na barra de ferramentas esquerda do Foundry.
- Visão ao vivo dos combatentes: LP, Ki, Capacity, turno, Transformation,
  Signature Aura, Energy Charge, condições e pendências.
- Lista dos ataques do encontro com progresso das defesas e indicação de travas.
- Ações rápidas para localizar token, abrir ficha e abrir Painel de Combate.
- Manutenção protegida por confirmação:
  * limpar travas interrompidas;
  * remover estados ligados a cards apagados;
  * limpar os temporários de apenas um Actor;
  * encerrar os temporários de todos os participantes do encontro.
- A limpeza nunca reembolsa Ki/Capacity e nunca apaga o registro persistente
  newLevelOfPowerUsed.
- Ao apagar/encerrar o Combat Encounter, o GM primário executa a limpeza dos
  estados temporários daquele encontro.
- O painel não grava histórico, snapshots ou cópias das ações dos jogadores.

4) GRUPO DBU NA BARRA ESQUERDA
- Visível somente ao GM.
- Atalhos para Painel do Mestre, Painel de Combate, Diagnóstico e Configurador
  Visual.
- Compatível com a estrutura de Scene Controls do Foundry v12 e v13.
- Atalho alternativo:

  globalThis.DBUAutomation.gmPanel();

5) SCOUTER UI GLOBAL
- Novo styles/dbu-automation-dev.css.
- Aparência inspirada diretamente na ficha/cards do DBU: fundo navy, ciano,
  Orbitron, chips, barras, cabeçalhos e variantes de cor.
- Não modifica nenhum arquivo de systems/DBU-MRR-OLD.
- Ataque, defesa, Energy Charge, Aura, Transformation, Intervene/Deflect,
  Duel e janelas do módulo usam a mesma linguagem visual.

6) PAINEL DE COMBATE 2.0
- Portrait, Tier, Round/turno, LP, Ki e Capacity em barras estilo Scouter.
- Transformation, Signature Aura, Energy Charge, Targets, ATK/DGE/CTR.
- Seção PENDÊNCIAS sincronizada com o chat:
  * Defesa pendente
  * Intervene disponível
  * Reflect disponível
- Defender pelo Painel NÃO remove a defesa pelo card. Os dois caminhos chamam
  a mesma função dbuResolveDefense do core.
- Escolher pelo painel atualiza o card; escolher pelo card atualiza o painel.
- Painéis abertos atualizam com ChatMessage, Actor e Combat.
- Token HUD continua com atalho do dragão.

7) CARTA DE ATAQUE — PROGRESSO DE DEFESAS
- Cada alvo ainda possui os botões de defesa no chat.
- Antes da escolha aparece "Aguardando defesa".
- Depois aparece "<Defesa> selecionado — resultado oculto".
- O topo mostra N/Total defesas registradas.
- Strike/Wound e resultados numéricos continuam escondidos até todos escolherem.

8) AREA ATTACK — DBU 0.9.2: TIPO + MAGNITUDE
- Todo ataque mostra a caixa "Tem Área de Ataque?".
- O módulo tenta preencher automaticamente quando reconhece a AoE, mas o jogador
  pode marcar/desmarcar e corrigir manualmente.
- Tipos: Sphere, Cone e Line.
- Magnitudes: Minor, Standard, Large, Huge, Destructive e Cataclysmic.
- Minor é permitido apenas para Sphere.
- Perfis base reconhecidos:
  * Sweeping -> Minor Sphere, centrada no usuário, aliados excluídos.
  * Blast -> Standard Cone, iniciando na Square do usuário.
  * Explosion -> Standard Sphere, centrada em uma Target Square escolhida.
  * Soaring -> Standard Line, iniciando na Square do usuário.
- Vantagens que a técnica já traz na ficha podem ajustar a sugestão automática
  (ex.: Ki Extension, Terrain Destruction, All Consuming). Efeitos temporários ou
  raros podem ser informados manualmente pelo jogador.
- O antigo campo livre "Tamanho / alcance em casas" foi removido.
- O template usa a geometria dos diagramas 0.9.2:
  * Sphere: Minor raio 1; Standard 3; Large 4; Huge 5; Destructive 6 Squares.
  * Cone: Standard alcance 3; Large 4; Huge 5; Destructive 6 Squares.
  * Line: alcança a borda do Battlefield; largura Standard 1, Large 3, Huge 5,
    Destructive 7 Squares.
  * Cataclysmic: todo o Battlefield / todos os outros Characters.
- Tokens 2x2, 3x3 etc. contam como atingidos se ao menos uma Square ocupada estiver
  dentro da AoE.
- É possível usar Targets atuais em vez do template quando necessário.
- A antiga janela separada de Area Attack foi removida: a configuração fica
  integrada ao diálogo de Ataque, evitando a mistura visual com o Dialog padrão
  do Foundry.

9) CONFIGURADOR VISUAL — REAÇÕES DE COMBATE
Nova categoria:
- Defense Wall
- Deflect
- Distant Deflect
- Reflect
- Duel Clash

O jogador OWNER escolhe um Macro visual por ação. O módulo envia fases para o
mesmo macro, permitindo Sequencer persistente e limpeza adequada.

Fases possíveis incluem:
- start
- impact
- success
- fail
- launch
- accept
- reveal
- resolve
- win
- lose
- tie
- escape-success
- escape-fail

10) DUEL CLASH — CICLO VISUAL
- O macro visual configurado em Duel Clash recebe eventos de iniciação,
  aceitação, reveal e resolução.
- Quando os dois lados + supporters terminaram os 3 Clashes, o módulo calcula a
  mesma leitura de vitória do Duel nativo e envia resolve + win/lose ou tie.
- Isso permite criar um macro Sequencer com dois beams, ponto de colisão e
  finalização sem embutir assets específicos no módulo.
- O Duel mecânico continua sendo o helper nativo do DBU.

11) INTERVENE / REFLECT NO PAINEL
- Se o Actor do jogador for um interventor elegível, a pendência aparece no
  Painel 2.0.
- Reflect aparece após oportunidade válida de Parry/Deflect.
- Os cards do chat continuam funcionando normalmente.

MANTIDO DA v1.5.3
------------------
- Ki + Capacity validados antes de ataques.
- Resultado do atacante e dos defensores oculto até todos escolherem.
- Defense Wall / Deflect / Distant Deflect.
- Reflect após Parry ou Deflect bem-sucedido quando elegível.
- United Attack / United Duel / Duel Clash.
- Energy Charge + visual por estágio 1/2/3/4/MAX (MAX visual = 5+ EC; máximo
  mecânico normal continua 7 EC).
- Signature Aura mecânica + manutenção.
- Transformation usa o comportamento nativo da ficha, tamanho real no grid e
  visual configurável.
- New Level of Power persistente por Transformation na campanha, separado da
  reentrada no Combat Encounter para Stress Test.
- Configurador Visual de Ataques, Defesas, Transformations, Signature Aura e
  Energy Charge.

INSTALAÇÃO
----------
1. Feche o mundo.
2. Apague/substitua a pasta antiga:
   FoundryVTT/Data/modules/dbu-automation-dev/
3. Extraia a pasta dbu-automation-dev deste ZIP em Data/modules/.
4. Ative DBU Automation.
5. Deixe dbu-auto-start DESATIVADO.
6. Abra o mundo e dê F5 no GM e em todos os jogadores.

MACROS
------
Os launchers antigos continuam válidos. Para recriar/atualizar como GM:

await globalThis.DBUAutomation.migrateLauncherMacros({ overwrite: true });

DIAGNÓSTICO
-----------
globalThis.DBUAutomation.diagnostic();

TESTE RECOMENDADO
-----------------
1. Como jogador, selecione seu token e clique em DBU HUD próximo à hotbar.
2. Confira LP, Ki, Capacity, Tier, estado e ataques exibidos no HUD.
3. Clique em dois Attack Refs/Signature Techniques diferentes e confira se o
   diálogo abre com o ataque clicado já selecionado.
4. Teste recolher/expandir, limpar alvos, abrir ficha e abrir Pendências.
5. Na engrenagem, teste abertura automática e ocultação da hotbar padrão.
6. Como GM, abra o grupo DBU na barra esquerda e clique em Painel do Mestre.
7. Inicie um combate e confira LP, Ki, Capacity, efeitos e turno dos participantes.
8. Um ataque normal com 2 alvos:
   - trocar a categoria de dano antes de anunciar e conferir o ajuste nos cards;
   - um se defende pelo card;
   - outro se defende pelo Painel.
   - confira sincronização e Reveal conjunto.
9. Blast / Explosion / Sweeping / Soaring com template.
10. Intervene e Reflect aparecendo como pendência no Painel e no contador do HUD.
11. No Painel do Mestre, testar Limpar travas e Limpar órfãos.
12. Em um combate de teste, apagar o combate e conferir a limpeza dos temporários.
13. Repetir Energy Charge, Aura e Transformation para confirmar que as mecânicas
   da v1.6.1 permaneceram iguais.

============================================================
NOVO NA v1.7.1
============================================================
- HUD de Combate DBU próprio, sem dependência do Argon.
- Status do personagem separado dos comandos: portrait e barras grandes de LP,
  Ki e Capacity no alto à esquerda; ataques e ações na parte inferior.
- Abertura pelo lançador próximo à hotbar, pelo Token HUD, pelo macro launcher ou
  por globalThis.DBUAutomation.hud().
- Recursos, Tier, turno, estados, alvos e pendências atualizados por Hooks.
- Atalhos para as automações já existentes.
- Attack References e Signature Techniques clicáveis com pré-seleção no ataque.
- Preferências client-side para ativação, abertura automática e hotbar padrão.

============================================================
NOVO NA v1.6.3
============================================================
- Seletor de categoria de dano no diálogo de Ataque: Standard, Direct ou Lethal.
- Preenchimento automático pela técnica e redefinição ao trocar o ataque.
- Ajuste manual registrado nos cards e aplicado ao cálculo/resolução do dano.

============================================================
NOVO NA v1.6.2
============================================================
- Painel do Mestre 1.0, exclusivo para game.user.isGM.
- Grupo DBU na barra de ferramentas esquerda (Foundry v12/v13).
- Abertura por globalThis.DBUAutomation.gmPanel().
- Visão consolidada dos combatentes, recursos, efeitos e pendências.
- Visualização de ataques do Combat Encounter e travas interrompidas.
- Limpeza seletiva de runtime locks e estados órfãos.
- Limpeza manual por Actor ou por encontro, sempre com confirmação.
- Limpeza automática ao apagar/encerrar o Combat Encounter, executada somente
  pelo GM primário ativo.
- Nenhum histórico ou snapshot de ação é armazenado.
- Macro launcher "DBU - Painel do Mestre" incluído.

============================================================
NOVO NA v1.6.1
============================================================
- Fonte de regras para estas correções: snapshot .ZIM DBU 0.9.2 enviado pelo mestre.
- Area Attack agora é configurado dentro do próprio diálogo de Ataque:
  * checkbox "Tem Área de Ataque?";
  * Tipo: Sphere / Cone / Line;
  * Magnitude: Minor / Standard / Large / Huge / Destructive / Cataclysmic;
  * detecção automática continua sendo apenas sugestão e pode ser ajustada manualmente;
  * remove o antigo campo livre "tamanho/alcance em casas";
  * geometria dos templates segue os diagramas 0.9.2;
  * o diálogo ganhou classe visual explícita para evitar mistura com o tema padrão do Foundry.
- Transformations (0.9.2):
  * Ki Multiplier continua usando os máximos calculados nativamente pelo sistema;
  * na primeira entrada em Alternate Form / Legendary Form no Combat Encounter, pode recuperar Ki igual à base Max Capacity;
  * checkbox permite desativar/forçar essa recuperação quando necessário;
  * Surging Strength continua sendo uma exceção: não deve aplicar Ki Multiplier.
- Legend Realized (0.9.2):
  * Alternate/Legendary Form, 1 vez por Transformation por Combat Encounter;
  * 2d10(T) + Power Level; restaura o total em LP e Ki;
  * checkbox "Aplicar Legend Realized nesta entrada";
  * checkbox editável "já utilizado neste Combat Encounter" para correção manual;
  * usa os bônus preparados pela própria ficha através de _applyLegendRealizedBonuses quando disponíveis.
- New Level of Power permanece separado:
  * newLevelOfPowerUsed = registro persistente/primeira vez ever;
  * nlopActiveEncounter = benefício temporário do encounter;
  * o DBU Automation não ativa NLoP automaticamente nesta versão.


DBU Automation v1.8.8 TEST — hotfix Counter/Reflect
- Exploit: reforça token/alvo travado e resolução de Attack References para Basic Attack OOS.
- Reflect: passa a aparecer também na janela COUNTER quando houver pendência contextual, mas continua Out-of-Sequence.
- Reflect: resolvedor direto pelo HUD/Counter adicionado.
- Reflect: falhas do helper de Ki/Capacity agora mostram erro em vez de abortar silenciosamente.


============================================================
DBU Automation v1.8.11 TEST — Refatoração estrutural
============================================================
- initializer.js convertido em orquestrador dos subsistemas.
- Duel Clash movido para scripts/combat/duel-core.js.
- Defense/Damage movidos para scripts/combat/defense-core.js.
- United Attack/United Duel movidos para scripts/combat/united-attack-core.js.
- Reveal/sincronização GM movidos para scripts/combat/reveal-core.js.
- Ki/Capacity movidos para scripts/core/resources.js.
- Round Tracker movido para scripts/core/round-tracker.js.
- Estado persistido de defesa movido para scripts/combat/defense-state.js.
- Integração com controles nativos DBU 0.9.2 movida para scripts/bridge/native-dbu.js.
- Hook de novo Round movido para scripts/core/round-hooks.js.
- API global globalThis.DBU mantida compatível com a versão anterior.
- Corrigida referência MODULE_ID no caminho Combat Recovery/Exploit do dano.
- Sem adoção de regras DBU 0.9.3.
