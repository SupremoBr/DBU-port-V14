# Módulos da ficha de personagem

A classe pública continua em `../character-sheet.mjs`, com 663 linhas (antes desta refatoração: 17.613). Ela mantém opções, envio do formulário, preparação geral, metadados de downtime e as chamadas ao ciclo de vida do Foundry. O código foi redistribuído; a quantidade total de regras não foi reduzida.

## Responsabilidades

| Módulo | Métodos | Responsabilidade |
| --- | ---: | --- |
| [transformation-state.mjs](transformation-state.mjs) | 27 | Estado, normalização, ativação e recursos persistentes de transformações. |
| [progression-skills.mjs](progression-skills.mjs) | 7 | Progressão de personagem, perícias e rolagens de perícia. |
| [techniques.mjs](techniques.mjs) | 19 | Preparação, custos e edição de técnicas. |
| [combat-math.mjs](combat-math.mjs) | 17 | Fórmulas, dados, CTs, estados e referências de ataque. |
| [auras.mjs](auras.mjs) | 19 | Preparação, custos, ativação e edição de auras. |
| [traits-talents.mjs](traits-talents.mjs) | 40 | Raças, traços, talentos, minions e bônus raciais. |
| [transformation-data.mjs](transformation-data.mjs) | 15 | Preparação dos dados e personalização de transformações. |
| [unique-powers.mjs](unique-powers.mjs) | 23 | Habilidades únicas, Shapeshift e avanços/restrições. |
| [bases.mjs](bases.mjs) | 8 | Construção, qualidades e reparo de bases. |
| [fusion.mjs](fusion.mjs) | 21 | Fusão, absorção, possessão e unificação. |
| [combat-data.mjs](combat-data.mjs) | 6 | Preparação dos dados visuais, recursos e condições de combate. |
| [combat-resources.mjs](combat-resources.mjs) | 26 | Uso de recursos, efeitos, automações e manobras divinas. |
| [downtime.mjs](downtime.mjs) | 13 | Atividades, períodos, ganhos e reversão de downtime. |
| [equipment.mjs](equipment.mjs) | 28 | Itens, armaduras, armas, camadas, qualidades e reparos. |
| [battle-jacket.mjs](battle-jacket.mjs) | 8 | Preparação e controles de Battle Jacket na ficha. |
| [transformation-actions.mjs](transformation-actions.mjs) | 15 | Stress Tests, token/álbum e ações de transformação. |
| [transformation-catalog.mjs](transformation-catalog.mjs) | 4 | Seleção de transformações e diálogo de traços. |
| [combat-rounds.mjs](combat-rounds.mjs) | 10 | Mudanças de rodada/encontro e controles de recursos. |
| [combat-triggers.mjs](combat-triggers.mjs) | 38 | Gatilhos raciais, talentos, formas e poderes. |
| [combat-damage.mjs](combat-damage.mjs) | 9 | Aplicação de dano/cura, guarda e condições. |
| [combat-tracker.mjs](combat-tracker.mjs) | 29 | Ações do tracker, ataques, defesa, manobras e duelos. |
| [listeners.mjs](listeners.mjs) | 1 | Registro dos 246 eventos da interface; chamado após super.activateListeners. |

`../character-data.mjs` continua reunindo as quatro funções de preparação visual extraídas na versão anterior.

## Composição e compatibilidade

Os módulos exportam objetos com métodos. `install-methods.mjs` verifica colisões antes de instalar os métodos no protótipo da ficha. Eles continuam recebendo a instância como `this`, com os nomes, assinaturas, comportamento assíncrono e descritores originais (não enumeráveis, configuráveis e graváveis). Subclasses podem continuar sobrescrevendo os métodos. Não são usados bind permanente ou estado de personagem compartilhado.

As chamadas a `super` ficam na classe principal. O módulo de listeners é chamado depois do ciclo de vida da classe base. Downtime usa uma factory que recebe a própria classe, preservando a referência lexical às tabelas estáticas sem criar dependência circular.

Os imports dinâmicos das manobras Terrify, Feint e Dirty Trick foram corrigidos para `../../helpers/duel.mjs`, pois os arquivos mudaram de diretório. Os outros métodos mantêm seus corpos originais. Os imports ES modules são nativos: não há compilação, bundler ou nova dependência de runtime.

## Testes

Na raiz do sistema: `node --test tests/*.test.mjs`. São 25 testes no total. Os novos testes verificam os 385 métodos, descritores/herança, assinaturas e fontes dos corpos, tabelas estáticas, 246 eventos e seus receptores, permissão de edição, envio de formulário, chamadas entre módulos/subclasses, imports dinâmicos e colisões de instalação. As 64 comparações anteriores de dados visuais também continuam passando.

A referência é o commit `56b984a`, antes desta separação. `tests/fixtures/character-methods-baseline.json` registra os métodos e a sequência de eventos originais. `relocatedHash` registra exclusivamente a alteração necessária do caminho dos três imports dinâmicos. O wrapper de listeners é validado separadamente, inclusive a chamada a super. Ao mudar uma regra ou comportamento futuramente, revise apenas as referências afetadas e acrescente testes de comportamento; não regenere toda a referência para ocultar regressões.

As verificações de JSON, sintaxe, imports locais, catálogos e templates passaram. Os testes usam um stub do ciclo de vida do Foundry e não substituem abrir e operar a ficha no aplicativo real. A compatibilidade verificada permanece em v13, com v14 permitida para teste. Esta versão reorganiza o código, sem migrar regras para DBU 0.9.3.

## Manutenção

Acrescente o método ao objeto do módulo responsável; ele será instalado na composição existente. Para uma nova área, crie o módulo e registre-o na lista de `installCharacterMethods` da classe principal. Não sobrescreva métodos já presentes em outro módulo ou no ciclo de vida. Preserve licença e créditos originais.
