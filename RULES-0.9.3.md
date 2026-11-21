# Prévia das regras 0.9.3

Esta versão implementa a base da atualização solicitada a partir das páginas atuais de [DBU](https://dbu-rpg.com/), consultadas em 18/11/2026. **É uma prévia, com efeitos que ainda exigem resolução manual, e não uma implementação integralmente automatizada da edição.** Foundry v13 continua no intervalo de compatibilidade; falta validar os fluxos no aplicativo licenciado.

A autoria do sistema original, MRR / ArdillaTactica, e a autoria de DBU Automation foram preservadas. Os índices novos distribuem nomes, parâmetros mecânicos, resumos próprios e links; o texto completo continua no site oficial. [URLs e hashes das fontes](docs/rules093-sources.json) permitem identificar o material consultado. O changelog arquivado do site não foi usado como confirmação de todas as regras atuais.

## O que foi alterado

| Área | Implementação atual |
| --- | --- |
| Raças | 19 opções de criação, incluindo Angel, Demon, Glass Tribe, Heran, Konatsian e Yardrat; tabelas de atributos, Life Modifier, saves e Skill Ranks atuais. Neko Majin e Yardrat recebem os dois saves raciais. Escolhas de atributos e ranks anteriores exigem revisão quando a tabela mudou. Undead fica como fator, com escolha da raça base pelo mestre. |
| Traços raciais | 285 entradas de referência, incluindo fatores/subraças. A migração usa equivalências exatas e a renomeação explícita Battle Born → Born for Battle. Saiyan tem passivos revistos: Heritage 5, Tailless, Warrior’s Pride, Blood of the Warrior e Powerful Physique; o controle Born for Battle 3 mantém o limite excepcional até o fim do encontro. |
| Talentos | 275 entradas atuais. Treze talentos preservam efeitos idênticos do catálogo anterior; cláusulas passivas simples reconhecidas têm parâmetros estruturados. Efeitos modificados recebem IDs novos para não disparar os manipuladores antigos por nome. O restante é manual, com fonte na ficha. |
| Transformações | Índice de 464 entradas, incluindo estágios e variantes, com AMB, requisitos e Stress. Awakenings permanentes são diferenciadas em Lesser/Greater/Super, com limites por bT. Há uma vaga de Form e uma de Enhancement; Transcendent usa a vaga de Form. Valores variáveis exigem preenchimento e revisão. |
| Ações | Pools de 3 Standard + 1 Counter por rodada, conversão Standard → Counter e teto de 6 Counter. Ficha e automação integrada usam o mesmo registro de defesa. Há ajustes explícitos de bônus de Actions, Bonus Momentum e Reduced Momentum da próxima rodada. Standard exige o turno do ator num combate ativo. |
| Defend | Power Flare e Cross Counter: custo base de KP 0. Guard: 8(bT), mais até 4(bT) por charges; Guard Down aplicado depois dos descontos. Parry usa penalidade por EC/Power Shot em bT. Power Flare exige superar Wound, não empatar. |
| Técnicas | TP mínimo 8; Simple começa em 4 antes do mínimo; Ultimate/Dramatic Finisher acrescenta 4 depois do mínimo. Free TP não reduz KP. Custos/requisitos de 64 vantagens e 41 desvantagens, 26 Profiles e 12 Super Profiles. Super Profile soma seu custo ao Profile normal; Multi-Profile e Giga Flare têm configuração própria. Perfis removidos não viram ataques gratuitos. |
| Rolagens | Crushing reduz Haste em Strike, preservando Force em Wound. Cutting tem Wound CT 5, Botch em Strike sem crítico e aumento de categoria no crítico. Clearing tem Natural mínimo 5. Powered/Beam e Ultimates recebem as charges correspondentes. Pisos de KP de criação e de uso são separados; custos não sobem com Breakthrough. |
| Regras gerais de transformação | Ki Multiplier exige entrada por Transformation Maneuver. Legend Realized agrupa por tipo de Form/requisito de Tier; New Level of Power limita benefícios simultâneos e distingue recuperação de Awakening, dobro de Legend Realized e Burst Limit adicional. Full Awakening tem controle de uso e recuperação, com Grand Trigger resolvido pelo jogador/mestre. |

As tabelas já corretas da implementação anterior, como o limite de 25/30/40/50 TP por bT e a base do Stress Test, foram mantidas. Não são apresentadas como mudanças de regra.

## O que continua manual

- A maioria dos efeitos raciais/talentos, os traços e aspectos específicos das transformações, maestrias, pré-requisitos narrativos e escolhas dependentes de outros personagens. Os links das escolhas e o painel de revisão estão na ficha.
- Aplicação de condições, alterações de cenário, colisões, ignorar Soak/DR e outros efeitos sobre o alvo decorrentes de Profiles. Os resumos de cada Profile indicam seus parâmetros; uma rolagem não significa que esses efeitos foram aplicados automaticamente.
- Efeitos dos Super Profiles e seus custos adicionais de Actions, exceções de Capacity, ataques encadeados e pré-requisitos condicionais. O cálculo de KP foi integrado; esses efeitos ainda não têm automação completa. Um Dramatic Finisher precisa ser concedido pelo ARC e não é uma conversão automática de Limit Break.
- Gatilhos e timing de Instant/Out-of-Sequence, exceções que concedem manobras extras e confirmação de ser alvo de ataque no tracker manual. Os helpers de timing não substituem a resolução do mestre.
- Battle Jackets, Unique Abilities, auras, equipamentos, fusões e demais subsistemas herdados não receberam auditoria integral de regras 0.9.3 nesta versão. O compêndio racial contém 177 traços do catálogo legado e permanece identificado como **referência legada 0.9.2**; as escolhas atuais usam os catálogos da ficha.
- A página oficial Enhanced Aura estava indisponível (404). Essa entrada não recebeu regras inventadas. O link antigo damage-conditions também está quebrado; a referência atual é thresholds-conditions.

Use a automação incluída. As versões externas de DBU Automation não receberam estes ajustes e impedem o carregamento da cópia integrada enquanto estiverem ativas.

## Conversão do mundo e backup

A política escolhida pelo usuário foi converter o mundo mantendo os dados anteriores. No primeiro `ready`, o GM principal:

1. Cria um Diário privado chamado **DBU — Backup anterior à migração 0.9.3**, contendo os sources de Actors (com Items e prototypeToken), Items de mundo, Scenes (com tokens/deltas) e Combats.
2. Persiste a referência desse backup antes de alterar personagens ou itens. Se a criação falhar, a conversão é interrompida. Uma retomada reutiliza o backup original e os documentos já concluídos.
3. Converte personagens, itens compatíveis e atores sintéticos de tokens desvinculados nas cenas carregadas. Não altera compêndios nem mundos que não estão abertos. Atores Battle Jacket e documentos NPC sem o modelo de personagem ficam preservados para a revisão dos subsistemas acima.
4. Guarda as escolhas removidas/ambíguas e os valores anteriores no backup e no relatório por documento. Nenhuma equivalência aproximada é escolhida. Formas sem correspondência são desativadas; maestrias e aspectos antigos não são reaplicados com textos novos.
5. Libera a inicialização da automação integrada após o término. Os outros clientes aguardam a conclusão persistida pelo mestre.

A ficha oferece **Baixar backup anterior à 0.9.3** para o GM. O mesmo JSON pode ser exportado com `game.dbu.exportRulesBackup()`. O arquivo é uma cópia de recuperação dos sources, não um instalador de mundo ou um comando automático de restauração. Actors legados importados posteriormente guardam também seu source original na própria flag, incluída na exportação do backup.

LP/Ki atuais são preservados na conversão; os máximos passam a seguir os cálculos aplicáveis. Escolhas de atributos, ranks, talentos removidos e fatores precisam ser revisadas pelo mestre. Alterar o rótulo da edição não equivale a aprovar as escolhas pendentes.

## Desenvolvimento e validação

Não há etapa de build nem dependências npm para executar o sistema. Os arquivos `module/rules/` são carregados pelo esmodule principal. `scripts/build-rules093.py` gera o índice factual a partir dos JSONs intermediários de uma pesquisa local; não busca nem muda regras durante o jogo.

```bash
node --test tests/*.test.mjs
```

Os testes incluem o init real do sistema em stubs de Foundry 13, métodos reais da ficha, cálculo de saves e custos, integração de Counter Actions, rolagens, backup, falhas/retomada da migração e atores sintéticos. Eles não substituem testes no Foundry real. O aplicativo licenciado não está instalado no ambiente cloud; portanto não houve teste visual ou de um mundo real.
