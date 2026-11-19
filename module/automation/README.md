# DBU Automation integrada

Integração do módulo **DBU Automation DEV 1.9.22**, fornecido pelo usuário a partir de [SupremoBr/dbu-automation-releases](https://github.com/SupremoBr/dbu-automation-releases). O Foundry v13 continua suportado. A compatibilidade declarada do sistema permanece 12–14, com `verified: 13`; esta integração não transforma isso em validação funcional da v14.

## Usar

1. Atualize o sistema pelo manifesto de SupremoBr/DBU-port-V14 e recarregue o mundo.
2. Para usar a versão incluída no sistema, desative `dbu-automation-dev`, `dbu-automation` e `dbu-auto-start`, se presentes, e recarregue. O sistema não desativa módulos automaticamente. Enquanto qualquer um estiver ativo, a cópia integrada não carrega nem instala hooks ou API, evitando duas instâncias da automação.
3. A opção **DBU Automation integrada**, nas configurações do sistema, controla a integração e requer recarregar o mundo. O padrão é ativada.
4. O botão **DBU HUD** é fornecido pela automação; o GM recebe os controles e painéis correspondentes. Macros existentes que usam `globalThis.DBUAutomation.launch(...)` continuam usando a mesma API. A mesma API fica disponível em `game.dbu.automation` quando a integração está pronta.

Não é preciso instalar o módulo externo para usar a integração. Os scripts, estilos, idioma e macros de referência estão neste diretório. O comando `DBUAutomation.migrateLauncherMacros()` continua disponível para criar/atualizar os atalhos, mas não é executado automaticamente, preservando macros personalizadas do mundo.

## Recursos incorporados

HUD e preferências por cliente; painel de combate; painel do mestre; ataques e defesas; pagamentos de Ki/Capacity; duelos e ataques unidos; Intervene/Reflect; áreas de ataque; ações e manobras; equipes por encontro; auras; transformações e restauração de imagens de tokens; recuperação; configuração de visuais e roteamento de Battle Born para o proprietário.

O código incorpora os recursos do módulo fornecido. A integração não significa que todos os fluxos tenham sido testados no aplicativo Foundry real. Sequencer continua opcional para os recursos visuais que o usam; não foi empacotado nem instalado. Arquivos de animação configurados pelo usuário continuam sendo necessários para esses efeitos.

## Adaptações ao sistema

- `entry.mjs` e `lifecycle.mjs`: seleção entre integração e módulo externo, carregamento uma vez, registro das configurações durante preparação, migração antes do boot e espera explícita de conclusão. O ready do Foundry não precisa aguardar o carregamento para que a inicialização continue corretamente.
- `package.mjs`: usa o namespace real `DBU-MRR-OLD`, o canal `system.DBU-MRR-OLD` e metadados do sistema. Não cria entrada fictícia em `game.modules`. O manifesto do sistema habilita sockets.
- As preferências do HUD e os favoritos passam a ser registrados imediatamente quando o runtime é preparado; não ficam aguardando um evento init que já aconteceu.
- Os manipuladores de chat selecionam `renderChatMessageHTML` em v13+ e recebem a conversão para jQuery esperada pelo código original. O hook legado continua sendo usado em v12. IDs de hooks são preservados para limpeza pelo runtime.
- Os controles do GM podem ser reconstruídos se o carregamento terminar depois da criação inicial dos controles de cena.
- Código e regras do módulo continuam separados em `scripts/`; os cálculos e a ficha nativos do sistema não foram substituídos. A bridge original do módulo continua encarregada da integração com as ações nativas.

## Dados existentes

Antes do boot, o GM principal copia flags dos namespaces antigos `dbu-automation-dev` e `dbu-automation` para o sistema, incluindo preferências visuais, snapshots de tokens, protótipos, atores sintéticos de tokens não vinculados e combatentes. A migração usa apenas documentos já carregados e não altera atributos, Ki, LP ou escolhas de regras dos personagens.

Os valores antigos são preservados e apenas campos ausentes são preenchidos; dados atuais do sistema têm prioridade. Configurações antigas DEV têm prioridade sobre a versão estável quando ambos existem. Preferências de cliente são importadas em cada cliente; jogadores não fazem a migração de configurações de mundo. A leitura legada também funciona no cliente antes da migração pelo GM.

A flag `automationLegacyMigration: 1` registra a adoção do namespace. Depois disso, flags apagadas pelo sistema não são restauradas acidentalmente das cópias antigas. A operação de remoção também adota as flags antes de removê-las, cobrindo clientes que ajam antes da migração pelo GM. A migração pode ser repetida sem duplicar dados ou ressuscitar estados encerrados.

Esta é uma importação inicial, não sincronização bidirecional contínua com o módulo externo. As cópias antigas não acompanham alterações posteriores da integração. Evite alternar entre as duas implementações durante um combate. Use um mundo de teste para conferir visuais e snapshots existentes antes de atualizar um mundo em uso.

## Origem e atualização

`upstream.json` registra versão, URL, autoria e hashes SHA-256 do ZIP e dos arquivos recebidos. `UPSTREAM-README.txt` preserva a documentação do módulo como referência histórica; as instruções deste README descrevem a instalação integrada. O nome e os créditos do sistema original foram preservados, e DBU Automation foi acrescentado aos autores do manifesto.

A cópia é fixada na versão 1.9.22; atualizações futuras do repositório do módulo não são baixadas durante o jogo. Precisam ser incorporadas e testadas em uma nova versão do sistema. A versão original do módulo usava regras 0.9.2. Este fork aplica ajustes locais para a prévia 0.9.3: custos e orçamento de Actions/Defend, Profiles, validação de técnicas e regras gerais de transformação. O boot aguarda a migração do mundo. Os hashes em upstream.json identificam os arquivos recebidos antes dessas adaptações. Consulte [o escopo e os efeitos ainda manuais](../../RULES-0.9.3.md).

## Validação

Na raiz do sistema: `node --test tests/*.test.mjs`.

Os testes cobrem conflito com as três versões externas, opt-out, ordem de preparação/migração/boot, execução única, falhas de inicialização, manifesto/arquivos, sockets de sistema, chat v13, preservação de dados e valores false/null, configurações de cliente/mundo, tokens sintéticos, exclusão de flags sem ressurreição, atualização tardia dos controles do GM e pagamento único de Ki/Capacity. Um teste importa o grafo real do módulo e inicia todos os seus componentes em um stub de Foundry v13, sem Sequencer.

Pendente no Foundry real: abrir HUD/painéis como GM e jogador; ataque/defesa/reveal e cobrança de recursos; duelo/ataque unido; Intervene/Reflect; troca de rodada; manutenção de aura/transformação; ativação e restauração de tokens vinculados/não vinculados; preferências visuais antigas e novas; equipes/recuperação; e funcionamento com o módulo externo desativado e ativado separadamente.
