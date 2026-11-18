# Otimizações — 1.0.11-v14.2

## Mudanças

- `module/helpers/catalog-index.mjs`: índices compartilhados por ID, relação entre IDs de efeitos e traços, e bônus de Stress por traço. Mantém a primeira ocorrência de IDs duplicados, como fazia `Array.find`.
- As buscas de traços raciais, talentos, traços de vilão, fraquezas e traços de minions passaram a usar índices nos caminhos alterados da ficha. Listas específicas dos diálogos continuam locais porque possuem seleção, ordenação e filtros mutáveis.
- A preparação de passivos desativados consulta os efeitos explicitamente desativados pelo personagem, sem reconstruir os IDs de todos os efeitos a cada cálculo.
- Stress aceita `automation: { stressBonus: 1 }` em efeitos explicitamente passivos. Para catálogos antigos/customizados sem esse metadado, a busca das duas frases legadas ocorre uma única vez ao construir o índice. O catálogo oficial recebido não contém efeitos explicitamente passivos que correspondam à busca anterior; os testes preservam seu resultado. Não foram criados bônus novos, nem mudadas as automações específicas das raças.
- A preparação visual de traços, talentos, efeitos e recursos foi extraída da ficha para `module/sheets/character-data.mjs`. A ficha mantém seus métodos públicos e delega a eles. Isso reduz o tamanho da classe e permite testar a preparação sem abrir o Foundry.

## Atualização dos dados

Os índices são mantidos em `WeakMap`, com a identidade de cada catálogo como chave. Substituir o objeto/array do catálogo cria um índice novo automaticamente; objetos antigos podem ser coletados pelo runtime.

Após editar um catálogo **no mesmo objeto**, execute:

```js
game.dbu.invalidateCatalogIndex(CONFIG.DBU.racialTraitsCatalog);
// Ou invalide todos os índices:
game.dbu.invalidateCatalogIndex();
```

Os índices são somente para leitura pelos consumidores. Não guardam seleções ou valores derivados do personagem. Os dados editáveis da ficha continuam sendo clonados antes de marcar opções, evitando vazamento de estado entre fichas.

## Escopo da preparação das abas

A ficha ainda prepara todas as abas: os templates contêm seus formulários e alguns resumos dependem de dados de outras abas. Omitir abas ocultas sem mudar o ciclo de renderização pode deixar campos, badges e resumos incompletos. Esta versão reduz o trabalho repetido por meio dos índices compartilhados; não altera a navegação, não omite campos de formulário e não introduz cache de estado de personagem. O restante da classe não foi dividido indiscriminadamente.

## Validação

```bash
node --test tests/*.test.mjs
node scripts/benchmark-catalogs.mjs
```

São 16 testes, incluindo verificações da compatibilidade Foundry e dez testes de índices/preparação. A fixture `tests/fixtures/view-data-baseline.json` registra assinaturas dos resultados completos dos quatro métodos anteriores, obtidos do commit `200377d`. São 64 cenários: dados vazios, cada um dos 14 grupos raciais com todos os talentos e todos os grupos juntos. Também foram comparados os objetos completos durante a implementação, sem divergências.

Os testes cobrem IDs duplicados/ausentes, entradas opcionais nulas, invalidação, efeitos com IDs em colisão, desativação estritamente por `false`, seleção duplicada, fallback de Stress e independência dos clones editáveis. Não há testes de desempenho com limites de tempo instáveis.

No microbenchmark local em Node 24, as medianas foram **173,68 ms antes** e **5,34 ms depois** para 2.000 execuções por amostra, em cinco amostras. O cenário usa 24 IDs raciais, 30 efeitos desativados e índices já construídos. Mede somente as buscas de Stress e passivos desativados, com resultados equivalentes. **Não mede o tempo de abertura da ficha, renderização, rede ou desempenho do Foundry.**

Passaram também as verificações locais de sintaxe/imports, catálogos, JSON e templates. O teste funcional no aplicativo Foundry permanece pendente. Não há migração de dados persistidos nem atualização das regras para DBU 0.9.3 nesta versão.
