# Foundry v14: diagnóstico e alterações locais

Esta é uma adaptação local do sistema 1.0.10 de MRR / ArdillaTactica. A licença e os créditos originais foram preservados. Não é uma release dos autores originais.

## O que foi encontrado

| Ponto | Efeito e evidência | Alteração |
| --- | --- | --- |
| `system.json`: `maximum: 13` | O manifesto não permite instalar a versão recebida como um sistema compatível com v14. | Limite ampliado para 14 para permitir testes. `verified` permanece 13. |
| Chat em `dbu-old.mjs` e `module/helpers/duel.mjs` | Usa `renderChatMessage`, com contrato legado jQuery. A API moderna expõe `renderChatMessageHTML`, com HTMLElement. Isso afeta os manipuladores de pagamento, revelação, duelo, ataque unido e clash quando apenas o hook moderno é emitido. | Seleção de um único hook por geração: legado em v12, HTML em v13+. Os manipuladores existentes já convertem HTMLElement para jQuery. |
| Fichas `ActorSheet` e `ItemSheet`, diálogos `Dialog` | Dependem de aliases globais depreciados. Isso não comprova uma quebra em v14: ApplicationV1 ainda consta nas definições v14, e vários aliases têm remoção prevista somente em v15. | Acesso explícito a `foundry.appv1`, com fallback para v12. Sem trocar a base por ApplicationV2, que exigiria migrar eventos, formulário e renderização. |
| `TextEditor.enrichHTML` | Alias global depreciado; precisa respeitar a implementação configurada do editor. | Usa `foundry.applications.ux.TextEditor.implementation`, com alternativas para versões anteriores. |
| `loadTemplates` global | Alias legado e carregamento sem aguardar o resultado no init do sistema. | Usa `foundry.applications.handlebars.loadTemplates`, aguarda a conclusão antes da mensagem de inicialização e mantém fallback v12. |
| Registro de fichas por `Actors`/`Items` globais | Dependência dos aliases e das fichas core legadas. | Usa `DocumentSheetConfig` com as classes de documento e fichas core modernas quando disponível; mantém registro legado em v12. |

Os pontos de depreciação foram modernizados preventivamente; não devem ser descritos como APIs comprovadamente removidas em v14.

## Arquivos alterados

`dbu-old.mjs`, `system.json`, `module/helpers/templates.mjs`, `module/helpers/duel.mjs`, as três fichas em `module/sheets/`, e o novo `module/helpers/foundry-compat.mjs`. As regras e os catálogos do jogo foram preservados.

## Validação e limites

Execute `node --test tests/compat.test.mjs` na raiz do sistema. Seis testes verificam seleção de APIs modernas sem aliases globais, fallback v12, propagação de falhas de templates, escolha única do hook e registro de fichas nas duas APIs. São testes com objetos simulados, não uma execução do Foundry.

Também passaram as verificações de sintaxe, imports locais, importação dos 17 catálogos, compilação dos 25 templates e caminhos das 24 pré-cargas. O ZIP recebido não fornecia uma suíte de testes.

Ainda não há validação funcional no Foundry v14. É preciso abrir um mundo de teste separado, criar personagem e item, salvar campos e arrays na ficha, rolar dados, testar pagamentos e revelação no chat, duelo com dois usuários, Battle Jacket, editor de descrição e compêndio racial. Investigar eventuais erros de console antes de usar um mundo real. Manter backup dos dados.

As fichas continuam em ApplicationV1 e usam jQuery. Não há evidência de que isso sozinho impeça v14; a migração completa para ApplicationV2 permanece uma melhoria futura. Não alteramos `verified` para 14, as URLs de distribuição desta adaptação apontam para SupremoBr/DBU-port-V14. A instalação pode ser feita pelo manifesto deste fork; o download fica fixado ao tag da versão. O ID original foi preservado para compatibilidade: não instale este fork e o upstream simultaneamente na mesma pasta de dados.

## Fontes consultadas

Definições públicas comunitárias `@league-of-foundry-developers/foundry-vtt-types`, branch `main`, versão declarada 14.370.0:

- https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/appv1/sheets/_module.d.mts
- https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/client.d.mts
- https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/hooks.d.mts
- https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/applications/apps/document-sheet-config.d.mts

A consulta direta a https://foundryvtt.com/api/v14/ recebeu bloqueio HTTP 403 do proxy deste ambiente. As definições comunitárias ajudam a conferir contratos, mas não substituem o runtime oficial.
