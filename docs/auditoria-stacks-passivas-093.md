# Auditoria de recursos raciais e passivas DBU 0.9.3

Auditoria iniciada na alpha.23 e ampliada na alpha.24. Esta auditoria compara os traços, as fichas e o runtime com as fontes arquivadas no ambiente e as páginas oficiais. [Regras centrais](https://dbu-rpg.com/core-rules/) · [Índice de fontes](rules093-sources.json)

## Como as automações se conectam

O Actor recalcula atributos, condições e passivas a partir dos dados da ficha. Attack References e Signature Techniques usam esses atributos nas fórmulas que alimentam as rolagens. A automação integrada consulta as fontes preparadas pela ficha. O HUD encaminha ações para os mesmos manipuladores e lê os recursos diretamente do Actor. O documento de combate atualiza os recursos quando o turno muda, e o tracker organiza manobras e recursos com os dados preparados pela ficha.

Na alpha.24, **Pressure Check** e os contadores de **Demonic Power** e **Demonic Fatigue** aparecem abaixo das barras vitais do HUD. O mesmo diálogo da ficha valida os gatilhos e grava o resultado no Actor. Os botões inferiores usam a paleta da ficha, com rótulos maiores e duas fileiras em telas estreitas.

Em **Combat → tracker → Activables**, o contador soma uma vez cada traço selecionado da raça atual com gatilho ou limite de combate, incluindo opções escolhidas e traços da sub-raça aplicável. Abra o contador para consultar os efeitos. Fatores raciais ligados à própria raça podem entrar na contagem. Fatores gerais, efeitos exclusivamente passivos e traços de outra raça ficam fora.

## Recursos raciais

| Raça | Regra conferida | Resultado |
| --- | --- | --- |
| Demônio | Demonic Pressure, Power e Fatigue | Pressure Check e aplicação dos resultados na ficha, limites por rodada, bônus e limpeza no início do próprio turno. Escolha o botão que corresponde à manobra já resolvida. |
| Arcosian | Overwhelm (até 4, +1(T) Wound por stack, perda no fim do turno) e Comfort de uma Evolution Trait | Overwhelm tem contador e efeitos 0.9.3. Registre o ganho após acertar ou conforme o traço que o concede. Comfort e gatilhos das Evolution Traits continuam manuais. O contador Cruelty antigo fica isolado. |
| Saiyan | Battle Born (+1(T) por alocação, limite normal 2 em cada rolagem), gatilhos de round par e de limiar | Contador e bônus já conectados. No início das rodadas pares a ficha oferece a escolha de alocação. Casos de Saiyan Heritage e aliados requerem decisão do jogador ou ARC. |
| Cerealian | Critical Eye (até 3, ganho em crítico e gasto para Wound ou Called Shot) | Catálogo atual. Falta um contador integrado com a resolução de críticos, os alvos atingidos e os gastos. |
| Heran | Greed em função de Power, com gasto defensivo e perda de Power no começo do turno | O contador geral de Power existe. O ganho pareado, a expiração própria e o gasto de Greed continuam manuais. |
| Konatsian | Tension (até 5), com benefícios e gatilhos escalonados | Referência na ficha. Os ganhos, gastos e efeitos de limiar específicos continuam manuais. |
| Neo-Tuffle | Revenge Points (até 4), com gasto por ataque | O campo legado existe. O ganho, o gasto e os limites atuais continuam manuais. |
| Shadow Dragon | Negative Energy, Dragon Slime (até 3) e Absorption | O campo legado de energia existe. Troca de LP por energia, Draining/Clash por alvo e efeitos de Dragon Slime permanecem manuais. |
| Namekian | Studied indica personagens escolhidos; as regras vigentes substituíram a antiga contagem por oponente | O campo legado de stacks permanece nos dados. Marque Studied por personagem na mesa para bônus e ações dependentes do alvo. |
| Yardrat | Spirit Control de criação e efeitos sobre os stacks gerais de Power | O sistema tem stacks gerais de Power. A concessão e as exceções de Spirit Control continuam manuais. |
| Custom Species | Tactic Points, Mass e recursos dependentes de traços | Os traços aparecem na ficha. Falta ligar os recursos atuais à seleção de traços, turnos e manobras. |

Demais raças do catálogo foram conferidas quanto a recursos raciais próprios nas páginas de criação. Stacks gerais de condições ou adquiridos por talentos, fatores e formas podem se aplicar a várias raças. [Raças](https://dbu-rpg.com/racial-rules/) · [Demons](https://dbu-rpg.com/demons/) · [Arcosians](https://dbu-rpg.com/arcosians/) · [Saiyans](https://dbu-rpg.com/saiyans/)

### Demônio na mesa

- Após resolver o ataque no próprio turno, use **Pressure Check · Após atacar**. Em **Demonic Resilience**, use **Ao ser alvo** ou **Após falhar Steadfast** conforme o gatilho. A ficha aplica stacks e redução de dano quando cabível. Se o teste substituir um Steadfast, registre o resultado no limiar correspondente.
- A escolha de gastar Power para usar uma manobra ou acrescentar Condition permanece com a mesa. Diminua o contador após resolver a escolha. A aprovação do ARC também decide a proximidade do Makyo Star e as mudanças de Awakenings.
- As opções do teste respeitam os limites registrados. Informe a condição causada por **Denizen of the Demon Realm** ao rolar, pois a origem da condição ainda não está registrada de forma uniforme. Use o botão Makyan após usar Power Up para controlar a concessão opcional.
- Em combate registrado no Foundry, o avanço do turno e o fim do encontro controlam a limpeza automática. Em uma sessão manual, use **Novo turno** na ficha e o controle de novo encontro no rastreador.

## Passivas de talentos

A revisão percorreu o catálogo compartilhado de 275 talentos, incluindo a categoria Racial, com 342 efeitos classificados como passivos. A alpha.23 acrescentou 27 efeitos e a alpha.24 acrescentou outros oito. O catálogo registra também efeitos vinculados à automação anterior. As descrições abreviadas abaixo identificam cada nível ainda manual. [Talentos oficiais](https://dbu-rpg.com/talents/)

### Efeitos novos na ficha

| Talento | Nível | Efeito |
| --- | ---: | --- |
| Effective Defenses | 1 | The Ki Point Cost for the Guard option of the Defend Maneuver −2(T). |
| Risky Bet | 1 | While you are below the Injured Health Threshold, your Soak Value +1(bT). |
| Enhanced Shot | 1 | The Wound Rolls for your Energy Attacks +1(T). |
| Alert | 1 | Initiative Value +1(bT). |
| Speedblitz | 1 | Your Initiative Value +1(bT). |
| Magic Blaster | 1 | The Wound Rolls of your Magic Attacks +1(T). |
| Enhanced Fist | 1 | The Wound Rolls for your Physical Attacks +1(T). |
| Iron Fist | 1 | The Wound Rolls of your Physical Attacks +1(T). |
| Rapid Fist | 1 | The Strike Roll of your Physical Attacks +1(T). |
| Supreme Fist | 1 | The Ki Point Cost of your Physical Signature Techniques −2(T). |
| Honorbound | 1 | Your Surgency +1(T). |
| Angelic Technique | 1 | The amount of Technique Points you gain from Skill Improvements +2. This effect applies retroactively. |
| Mystical Gaze | 1 | The Ki Point Cost of your Unique Abilities −1(T). |
| Mystic Power | 1 | The Ki Point Cost of your Unique Abilities −1(T). |
| Sorcering Corsair | 1 | The Ki Point Cost of your Unique Abilities −1(T). |
| Style and Greed | 1 | Your Racial Life Modifier +2. |
| Weapon Arts | 1 | The Wound Rolls of your Armed Attacks +1(T). |
| AIIIEEEEEEE | 2 | Your Racial Life Modifier +2. |
| Roomy Biology | 1 | Your Racial Life Modifier +2. |
| Namekian Progenitor | 1 | Your Racial Life Modifier +2. |
| Namekian Finger | 1 | The Wound Rolls of your Physical Attacks +1(T). |
| Saiyan Soul | 1 | Your Racial Life Modifier +2. |
| Second Wind | 1 | Your Surgency +1(T). |
| Never Surrender | 1 | Your Surgency +2(T). |
| Desperate Transformation | 1 | While below the Injured Health Threshold, your Stress Bonus +1. |
| Forceful Transformation | 1 | While in an Enhancement or Form, your Might +1(T). |
| Weapon Specialist | 1 | Ignore the Weapon Penalty. |

### Passivas de armas na alpha.24

| Talento | Nível | Efeito |
| --- | ---: | --- |
| Light Weapons Specialist | 1 | While you are only wielding a single Weapon of the Small Size, your Wound Rolls +2(T). |
| Heavy Weapons Specialist | 1 | While you are only wielding a single Weapon of the Big Size, your Strike Rolls +1(T). |
| Iaijutsu Specialist | 1 | While you are not wielding any Weapon, your Dodge Rolls +1(T). |
| Dual Wielding Specialist | 1 | While you are wielding 2+ Weapons, your Strike Rolls +1(T). |
| Twin Weapon Specialist | 1 | While you are wielding 2+ Weapons of the same Weapon Category, your Wound Rolls +1(T). |
| Critical Specialist | 1 | Decrease the CT of your Strike Rolls when making an Armed Attack by 1. |
| Variable Fighter | 1 | While you are wielding a Weapon, the Strike Rolls of your Unarmed Attacks +1(T). |
| Variable Champion | 1 | While you are only wielding 1 Weapon, the Strike Rolls of your Armed Attacks +1(T). |

O estado **Equipped** na aba Equipment indica quais armas o personagem empunha. Armas quebradas saem da contagem. O campo de arma no ataque identifica se aquela rolagem é armada. **Dual Wielding Specialist** exige **Weapon Specialist** e concede **+1(T)** em Strike enquanto o personagem empunha duas ou mais armas. Com Agility e Insight modificados em 3, some Haste (agilidade dividida por dois, arredondada para baixo) e Awareness (Insight). O modificador inicial é **+4** e chega a **+5** no Tier 1 com duas armas utilizáveis equipadas. O dado base, os dados de Tier e os demais modificadores do ataque entram na rolagem. **Dueling Specialist** ainda depende de identificar a arma usada quando o ataque é armado. [Talentos oficiais](https://dbu-rpg.com/talents/) · [Regras centrais](https://dbu-rpg.com/core-rules/)

### Efeitos ainda manuais

| Talento | Nível | Efeito | Motivo |
| --- | ---: | --- | --- |
| Artful Strike | 1 | The Dice Category of your Critical Result Extra Dice +1 Category for your Strike Rolls. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Masterful Strike | 1 | Roll your Base Die twice for any Strike Roll and use the highest result. | Depende de manobra, gatilho ou decisão na resolução. |
| Balanced Warrior | 1 | While your Force and Magic Scores are equal to one another, increase the Attribute Modifiers for each Attribute by the Attribute Score of… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced Warrior | 2 | The Ki Point Cost of all Attacking Maneuvers −1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced Defender | 1 | While your Agility and Tenacity Scores are equal to one another, your Defense Value and Soak Value +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced Mind | 1 | While your Personality and Scholarship Scores are equal to each other, your Attribute Modifiers (SC/PE) +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced Mind | 2 | While your Personality and Scholarship Scores are equal to each other and higher than the Attribute Score of your other Attributes, your Combat… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced in Yin and Yang | 1 | While your Force and Magic Attribute Scores are equal to one another, but at least 4 lower than your Insight Attribute Score, your… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Balanced in Yin and Yang | 2 | The Ki Point Cost of all Attacking Maneuvers −1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Jack of All Styles | 1 | Treat your Attribute Scores (AG/FO/TE/MA) as if they were 2(bT) higher for the Attribute Score Requirements of all Unique Abilities. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Lord of Balance | 1 | You are benefiting from the first effects of Balanced Warrior and Balanced Defender → your Combat Rolls +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Buddy Collector | 1 | You may have 2 Buddies active at the same time. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Buddy to Buddies | 1 | While you have an active Buddy, your Morale Saves and Soak Value +1(bT). | Depende de outro personagem ou da situação de um alvo. |
| Buddy System | 1 | While you have an active Buddy, the Dice Score of your Steadfast Checks +1. | Depende de outro personagem ou da situação de um alvo. |
| Combat Tactician | 1 | Your Combat Rolls +1(T) against any Opponent(s) that are suffering from a Combat Condition. | Depende de outro personagem ou da situação de um alvo. |
| Perfected Tactics | 1 | Your Wound Rolls +1(T) against any Opponent(s) that are suffering from a Combat Condition. | Depende de outro personagem ou da situação de um alvo. |
| Beat-down Tactics | 1 | Your Might Clashes against an Opponent with a Combat Condition +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Fierce Counter | 1 | Your Strike Roll when using the Parry effect of the Defend Maneuver +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Perfect Counter | 1 | The 1/Round Keyword on the first effect of Wild Counter becomes 3/Round. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Jolt Counter | 1 | Your Wound Roll when using the Cross Counter option of the Defend Maneuver +2(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Full Counter | 1 | Your Damage Reduction when using the Cross Counter option of the Defend Maneuver +2(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Exploit Expert | 1 | Your Wound Rolls for Attacking Maneuvers made through the Exploit Maneuver +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Bruising Wound | 1 | The Dice Category of your Critical Result Extra Dice +1 Category for your Wound Rolls. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Critical Wound | 1 | Roll your Base Die twice for any Wound Roll and use the highest result. | Depende de manobra, gatilho ou decisão na resolução. |
| Cunning Dodge | 1 | The Dice Category of your Critical Result Extra Dice +1 Category for your Dodge Rolls. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Masterful Dodge | 1 | Roll your Base Die twice for any Dodge Roll and use the highest result. | Depende de manobra, gatilho ou decisão na resolução. |
| Free Flowing Stance | 2 | While you are in the Free Flowing Stance: | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Agile Warrior | 2 | You do not gain Diminishing Defense stack(s) from the first Attacking Maneuver made with you as a target each Combat Round. Do not… | Depende de outro personagem ou da situação de um alvo. |
| Effective Defenses | 2 | Your Soak Value +2(T) (before any calculations) for the duration of an Attacking Maneuver that targets you if you use the Defend Maneuver… | Depende de manobra, gatilho ou decisão na resolução. |
| Resilience | 2 | Increase the amount of LP regained through a Healing Surge by 1d10(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tough Warrior | 1 | Halve any Collision Damage you would suffer. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Superior Durability | 2 | Halve the amount of LP you would lose from the effects of a Combat Condition, Environmental Qualities, or Damage Over Time. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Enhanced Shot | 2 | The Strike Roll of Energy Attacks made against adjacent Opponents +1(T). | Depende de posição, alcance ou cenário na resolução. |
| Enhanced Shot | 3 | The Wound Rolls for your Energy Attacks against Opponents who are outside of your Melee Range +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Point Blank Shot | 1 | The Wound Rolls of Energy Attacks made against adjacent Opponents +1(T). | Depende de posição, alcance ou cenário na resolução. |
| Artillery Shot | 1 | The Strike Roll of Energy Attacks made against Opponents outside of your Melee Range +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Brawler | 1 | Gain an additional Action each Combat Round while Pinned. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Wrestler | 1 | Treat your Size Category as if it was 1 larger for the effects of Gigantic Grip. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Judo Training | 1 | Your Grapple Checks when already in a Grapple +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Heel | 1 | The Wound Roll of your Attacking Maneuvers made against Opponents in a Grapple +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Human Shield | 1 | Your Soak Value +1(T) while you are in a Grapple. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Personal Space | 1 | The Dice Score of your Grapple Checks +1(T) if they are initiated by another Character or while you are in a Grapple as… | Depende de manobra, gatilho ou decisão na resolução. |
| Improved Initiative | 1 | Rolling Initiative → roll your Base Die twice. You may choose which result becomes the Natural Result. | Exige uma escolha registrada ou contextual da mesa. |
| Improved Initiative | 2 | Your Initiative Value is higher than that of all Opponents → you have ‘Initiative Advantage’. While you possess Initiative Advantage, your Combat Rolls… | Depende de manobra, gatilho ou decisão na resolução. |
| Alert | 2 | Ignore os efeitos de Surprise Rounds. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Alert | 3 | Com Initiative Advantage, ganhe +1(T) nas rolagens de Wound. | Depende de manobra, gatilho ou decisão na resolução. |
| Attentive Warrior | 1 | While you have Initiative Advantage, the Dice Score of your Clashes initiated by an Opponent that uses your Saving Throws +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Attentive Warrior | 2 | While you have Initiative Advantage, your Strike Rolls +1(T). | Depende de manobra, gatilho ou decisão na resolução. |
| Speedblitz | 2 | While you have Initiative Advantage, your Speeds and Wound Rolls +1(T). | Depende de manobra, gatilho ou decisão na resolução. |
| Lightning Initiative | 1 | While you have Initiative Advantage, your Dodge Rolls +1(T). | Depende de manobra, gatilho ou decisão na resolução. |
| Lightning Initiative | 2 | Your use of the Movement Maneuver does not trigger the Exploit Maneuver from Opponents with a lower Initiative Value than you. | Depende de manobra, gatilho ou decisão na resolução. |
| Insightful Warrior | 1 | While your Force and Magic Attribute Scores are at least 4 lower than your Insight Attribute Score and you are not benefiting from… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Combat Wisdom | 1 | While benefiting from the effect of Insightful Warrior, your Insight Modifier +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tai Chi Expert | 1 | The second effect of Tai Chi Practitioner loses its 1/Round Keyword. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tai Chi Master | 1 | The second effect of Tai Chi Expert loses its 1/Round Keyword. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tai Chi Master | 2 | The first effect of Tai Chi Practitioner regains an equal amount of LP to the amount of KP regained. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Magic Caster | 1 | The Strike Rolls of your Magic Attacks that are not using an ‘Elemental’ Profile +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Elementalist | 1 | Select a Profile with ‘Elemental’ in the name. That Profile becomes a Favored Element. | Exige uma escolha registrada ou contextual da mesa. |
| Magic Master | 1 | Reduce the TP Cost of all Magical Unique Abilities by your number of Use Magic Skill Ranks. This effect applies retroactively. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Magic Warrior | 1 | Unlock all Energy Profiles. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Magic Warrior | 2 | You may use your Magic Modifier as the Damage Attribute for all Physical and Energy Attacks. | Depende de manobra, gatilho ou decisão na resolução. |
| Calm Mind | 1 | The L listed on any Mindful Talent refers to your current Level of your use of the Mindful State. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Combat Zen | 1 | While in the Mindful State, reduce the Ki Point Cost of all Attacking Maneuvers by L(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Zen Counter | 1 | While in the Mindful State, the Natural Result of your Strike Rolls when using the Parry effect of the Defend Maneuver +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tranquil Warrior | 1 | While in the Mindful State, increase your Surgency by L(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Master of Minions | 1 | Your maximum number of Minions +2. | Depende de outro personagem ou da situação de um alvo. |
| Master of Minions | 2 | Increase the Wound Rolls of your Minions by 1/4 (rounded up) of your Personality or Scholarship Modifier (whichever is higher). | Depende de outro personagem ou da situação de um alvo. |
| Minion Coordinator | 1 | Increase the amount of Life and KP regained through the Recovery Period rule for Minions by 1d8(T). | Depende de outro personagem ou da situação de um alvo. |
| Minion Coordinator | 3 | Your maximum number of Minions +2. | Depende de outro personagem ou da situação de um alvo. |
| Minion Mark | 2 | Minions (except Special Minions) without any Counter Actions can use the Defense Wall option of the Intervene Maneuver if you are targeted by… | Depende de outro personagem ou da situação de um alvo. |
| Minion Mark | 3 | Your maximum number of Minions +2. | Depende de outro personagem ou da situação de um alvo. |
| Sacrificial Minion | 1 | One of your Attacking Maneuvers includes one of your Minions in the list of targets → the Strike and Wound Rolls for that… | Depende de outro personagem ou da situação de um alvo. |
| Minion Army | 1 | There is no limit to the number of Minions you may possess, but only up to 10 of your Minions may be in… | Depende de outro personagem ou da situação de um alvo. |
| Minion Supporter | 1 | You target a Minion with the effects of the Spectator State → apply your Tier of Power Extra Dice as Extra Dice to… | Depende de outro personagem ou da situação de um alvo. |
| Fleet of Foot | 1 | The bonus to your Defense Value from Footwork’s second effect +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| High Speed Ace | 1 | Your Defense Value and Speed +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| High Speed Ace | 2 | During this Combat Round, if you have moved a total number of Squares that matches or exceeds your Normal Speed through your own… | Depende de posição, alcance ou cenário na resolução. |
| Multi-Type Specialist | 1 | Your Surgency +1(bT) for every Talent you possess that is listed as a potential prerequisite for Multi-Type Attacker. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Multi-Type Gambit | 1 | You have triggered the effect of Multi-Type Attacker twice during this turn → the Dice Category of your Energy Charges +1 Category. | Depende de manobra, gatilho ou decisão na resolução. |
| Android Fusion | 1 | Unlock the Unify Maneuver. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Android Fusion | 2 | Your Racial Life Modifier +1 for each stack of the Unified Awakening you possess. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Android Fusion | 3 | Using the Unify Maneuver → you may target up to 2 Androids that are up to 8 Squares away from you if they… | Depende de posição, alcance ou cenário na resolução. |
| Honorbound | 2 | While Defeated, the first Desperate Effect you use has its Karma Point Cost reduced by 1 (this can reduce it to 0). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| 3D Scan Mode | 1 | Your Clairvoyance Skill Checks +2. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| 3D Scan Mode | 2 | Cannot suffer from the Long Range Penalty. | Depende de posição, alcance ou cenário na resolução. |
| 3D Scan Mode | 3 | Gain an Integrated Scouter of the Grandmaster Craft DC. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| 3D Scan Mode | 4 | The Strike Rolls of your Signature Techniques +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Metallic Movement | 1 | While occupying a Square with the Metallic Environmental Quality or while adjacent to a Feature with the Metallic Feature Quality, your Defense Value… | Depende de posição, alcance ou cenário na resolução. |
| Metallic Movement | 2 | You may move through Features with the Metallic Feature Quality as if they were not present. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Angelic Guidance | 1 | While you are adjacent to an Ally, increase that Ally’s Dodge Rolls by 1(T). | Depende de posição, alcance ou cenário na resolução. |
| Watchful Gaze | 1 | All Squares within a Sphere AoE (centered on you) are within your ‘Guidance Range’. | Depende de posição, alcance ou cenário na resolução. |
| Watchful Gaze | 2 | For the effects of Angelic Guidance, rather than adjacent, that Ally can be on any Square within your Guidance Range. | Depende de posição, alcance ou cenário na resolução. |
| Attendant’s Focus | 1 | Increase the Magnitude of your Guidance Range to Huge. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Attendant’s Focus | 2 | All Allies within your Guidance Range have their Surgency increased by 2(T). | Depende de posição, alcance ou cenário na resolução. |
| Attendant’s Focus | 3 | For any effects or Maneuvers that would target an Ally, your Melee Range is considered to be your Guidance Range. | Depende de outro personagem ou da situação de um alvo. |
| Reserved Tail | 2 | While you have 1+ stack of Reserved Force, the Ki Point Cost of your Attacking Maneuvers −1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Reserved Tail | 3 | For every stack of Reserved Force you possess, your Soak Value and Surgency +1(T) (max. 2(T)). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Genetic Catalogue | 1 | Upon gaining this Talent, and if you gain any Factor Traits for the Genetic Splicing Factor afterwards, with the help of your ARC,… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Dedicated Spotter | 1 | While in the Spectator State, the Strike Rolls of your Allies +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Honorable Demon | 1 | You have not inflicted a Combat Condition on an Opponent during this Combat Encounter → your Combat Rolls and Soak Value +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Versatile Demon | 1 | Upon gaining this Talent, select and gain access to an additional option for the 3rd effect of Denizen of the Demon Realm. | Exige uma escolha registrada ou contextual da mesa. |
| Way of the Champion | 1 | The Wound Rolls and Soak Value of your Allies +1(T) while you are in the Spectator State. | Depende de outro personagem ou da situação de um alvo. |
| Zooming Third Eye | 1 | Your Perception Skill Bonus +2. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Zooming Third Eye | 2 | Cannot suffer from the Long Range Penalty. | Depende de posição, alcance ou cenário na resolução. |
| Zooming Third Eye | 3 | The Strike Rolls of your Signature Techniques +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Autonomous Glass Soldiers | 2 | Glass Knights count as Glass Soldiers for your effects (except the 5th effect of Warriors of Glass). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Autonomous Glass Soldiers | 3 | Glass Knights have their Combat Rolls increased by 1(T) while occupying a square with the Glass Environmental Quality. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Copy in the Mirror | 2 | Your Glass Copies are treated as Glass Knights for all of your effects. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Glass Decorations | 1 | The Strike and Wound Rolls of your Attacking Maneuvers of the Glass Profile +1(T) if they target an Opponent adjacent to a Feature… | Depende de posição, alcance ou cenário na resolução. |
| Marauding Captain | 1 | For Cutthroat Teamwork, ignore the ‘(that is not a Minion)’ parts of that Trait’s effects. | Depende de outro personagem ou da situação de um alvo. |
| Marauding Captain | 2 | All of your Minions have their Soak Value increased by 1(T). | Depende de outro personagem ou da situação de um alvo. |
| Party Tactics | 1 | The Combat Rolls of all Allies within a Minor Sphere AoE (centered on you) +1(T). | Depende de posição, alcance ou cenário na resolução. |
| Goop Throw | 1 | Your Goop can use the Grapple Maneuver. | Depende de manobra, gatilho ou decisão na resolução. |
| Goop Throw | 2 | The Magnitude for the 5th effect of From Goop +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Battle Goo | 1 | Your maximum number of Minions +2. | Depende de outro personagem ou da situação de um alvo. |
| Battle Goo | 2 | The LP of your Goops +2 for each Power Level reached (after all other calculations). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Battle Goo | 3 | Your Goops gain access to (and can use) the Basic Attack Maneuver and Intervene Maneuver, but if a Goop uses the Intervene Maneuver,… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Detached Limbs | 1 | Your Goop’s Soak Value +1(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| AIIIEEEEEEE | 1 | Your Skill Bonus for the Bluff Skill +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Roomy Biology | 2 | Cannot lose the second Clash for the Possess Maneuver if it is initiated by another Character. | Depende de manobra, gatilho ou decisão na resolução. |
| Roomy Biology | 3 | Gaste 1 Action para guardar ou retirar um item ou personagem disposto ou Defeated. Personagens podem tentar escapar com Might Clash. Combates internos… | Depende de outro personagem ou da situação de um alvo. |
| Telepathic Teamwork | 1 | You are in the Melee Range of a Character you are telepathically communicating with → increase both of your Wound Rolls by 1(T).… | Depende de posição, alcance ou cenário na resolução. |
| Namekian Finger | 2 | Your Grapple Checks +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Namekian Finger | 3 | Increase the number of Squares your Melee Range is increased through the 4th effect of Namekian Biology to 5 Squares. | Depende de posição, alcance ou cenário na resolução. |
| Feline Rally | 1 | The Surgency of all your Allies +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Will of Nine Lives | 1 | While you have an Integrated Majin-Dama, the Dice Score of your Steadfast Checks +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Cat Burglar | 1 | The Skill Bonus of your Thievery +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Cat Burglar | 2 | Your Majin-Dama cannot be stolen unless you are Defeated. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tuffle Fusion | 1 | Select either the Corporeal Save or the Impulsive Save. Apply your Racial Saving Throw Bonus to your selected Save in addition to the… | Exige uma escolha registrada ou contextual da mesa. |
| Mutualism | 1 | While you are a Possessing Character of a Character that is not being controlled by you, you are in ‘Symbiosis’ and the Character… | Depende de outro personagem ou da situação de um alvo. |
| Mutualism | 2 | While in Symbiosis, your Host Ally has their Combat Rolls and Surgency increased by 1(T). | Depende de outro personagem ou da situação de um alvo. |
| Mutualism | 3 | While in Symbiosis, the 9th effect of Overtaken loses the [Automatic/Start of Turn] Keyword and gains the [Triggered/Start of Turn] Keyword. | Depende de manobra, gatilho ou decisão na resolução. |
| Tuffle Parasite | 1 | Your maximum number of Minions +2. | Depende de outro personagem ou da situação de um alvo. |
| Scholar’s Intellect | 1 | The Dice Score of any Skill Clash made against your Inferior +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Saiyan Tail Resistance | 2 | Ignore the 4th effect of Saiyan Heritage. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Saiyan Tail Resistance | 3 | Your effect for the Option effect of Saiyan Heritage becomes Tailless → lose this Talent and gain another Talent that you meet the… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tail Proficiency | 2 | While in the Oozaru Transformation, your Strike Rolls +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Tail Proficiency | 4 | Your effect for the Option effect of Saiyan Heritage becomes Tailless → lose this Talent and gain another Talent that you meet the… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Kindhearted Saiyan | 1 | All Allies within your Melee Range have their Soak Value increased by 1(T). | Depende de posição, alcance ou cenário na resolução. |
| Primal Rage | 1 | While in the Raging State, your Tier of Power Extra Dice +1 Dice Category. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Saiyan Soul | 2 | While you have your maximum number of Battle Born stacks, your Wound Rolls +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Dedicated Watcher | 1 | For the 1st effect of the Spectator State, you may target an additional Ally. | Depende de outro personagem ou da situação de um alvo. |
| Spiritual Leadership | 1 | You may apply the 4th effect of Power of the Weak if you give KP to a Minion through the Empower Maneuver. | Depende de outro personagem ou da situação de um alvo. |
| Spiritual Leadership | 2 | While you are Bonded to one of your Minions, they do not skip their Act Phase. | Depende de outro personagem ou da situação de um alvo. |
| Spiritual Leadership | 3 | All of your Minions have their Maximum LP increased by 2 for each Power Level reached (after all calculations). | Depende de outro personagem ou da situação de um alvo. |
| Twinned Spirits | 1 | You are always Bonded to your Partner, but Cannot become Bonded with any other Character. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Twinned Spirits | 2 | Your Partner has their Combat Rolls increased by 1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Yaki Swarm | 2 | Yaki can become Bonded through the 4th effect of Power of the Weak despite being Minions. | Depende de outro personagem ou da situação de um alvo. |
| Yaki Swarm | 3 | While a Yaki is a Bonded Ally, they have their Combat Rolls increased by 1(T). | Depende de outro personagem ou da situação de um alvo. |
| Yaki Master | 1 | While you are not Bonded, all of your Yaki are considered Bonded for the 3rd effect of Yaki Swarm. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Angry Warrior | 1 | The L listed on any Raging Talent refers to your current Level of your use of the Raging State. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Burning Fury | 1 | Halve the penalties from your Botch Results while in the Raging State. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Furious Berserker | 1 | While you are in the Raging State, increase your Damage Reduction by 1/2 (rounded up) of L(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Apoplectic Beast | 1 | While in the 2nd or higher Levels of the Raging State, you ignore the rules of Reduced Momentum. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Tremendous Warrior | 1 | Your Strike Rolls against an Opponent with a smaller Size Category than you +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Size Matters | 1 | Your Size Category is Enormous or larger → your Damage Reduction +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Miniature Warrior | 1 | Your Wound Rolls against an Opponent with a larger Size Category than you +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Size Doesn’t Matter | 1 | Your Size Category is Tiny or smaller → your Damage Reduction +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Size Doesn’t Matter | 2 | Your Size Category is Small or smaller → and you would receive Damage from an Absolute Attack that missed you, reduce that Damage… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| All Sizes Fit Me | 1 | While your Size Category is not your base Size Category, your Surgency +2(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Practiced | 1 | Your Natural Result on a Skill Check is below 4 → increase it to a 4. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Practiced | 2 | Gain a Skill Rank in 2 different Skills of your choice. | Exige uma escolha registrada ou contextual da mesa. |
| Dynamic Hype | 1 | Upon gaining this Talent, select 2 additional effects through the Option effect of Show Stopping Performance. You can only use and benefit from… | Exige uma escolha registrada ou contextual da mesa. |
| Flexible Planning | 1 | Upon gaining this Talent, select 2 additional effects through the Option effect of Analytic Fighter. You can only use and benefit from one… | Exige uma escolha registrada ou contextual da mesa. |
| Silent Footsteps | 2 | Making a Concealment Skill Check → you may use your Stealth Skill Bonus instead. If you do, your Dice Score −2. | Depende de manobra, gatilho ou decisão na resolução. |
| Stealth Strike | 1 | Your Strike Rolls against your Oblivious Characters +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Assassinate | 1 | Your Wound Rolls against your Oblivious Characters +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Master Assassin | 1 | Your Wound Rolls against your Oblivious Characters +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Master Assassin | 2 | You may use the 1/Round effect of Stealth Strike an additional time each Combat Round. | Depende de manobra, gatilho ou decisão na resolução. |
| Acrobat Star | 1 | You may use the Flip Maneuver as an Instant Maneuver. | Depende de manobra, gatilho ou decisão na resolução. |
| Acrobat Star | 2 | For the effects of the Flip Maneuver, treat yourself as if you have +1 Skill Ranks in Acrobatics. This can allow you to… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Expert Pilot | 1 | For the effects of this Talent, the 5th Skill Rank in Piloting is treated as 2 Skill Ranks. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Expert Pilot | 2 | Increase all of your Dodge Rolls made with a Vehicle by 1(T) for every 2 Skill Ranks of Piloting gained. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Expert Pilot | 3 | Ignore the Battle Jacket Penalty. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Yoink | 1 | Using the Snatch Maneuver → you can also take Weapons possessed by another Character that they have not currently equipped. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Enhanced Search | 1 | Making a Clairvoyance or Perception Skill Check/Clash → you may use the higher Skill Bonus between the two Skills. | Depende de manobra, gatilho ou decisão na resolução. |
| Enhanced Search | 3 | Your Perception Skill Checks are unaffected by the Light Level. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Enhanced Search | 4 | You may ignore the effects of the Blinded Combat Condition and the Obscured Environmental Quality. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Terrifying Speed | 1 | The Dice Score of your Intimidation Checks +2 if you have used the Movement Maneuver during this Combat Round. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Last Ditch Effort | 1 | The Natural Result of your Bluff Skill Checks +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Team Survivalist | 1 | You do not trigger the Exploit Maneuver when you use the Brace Maneuver. | Depende de manobra, gatilho ou decisão na resolução. |
| Team Survivalist | 2 | Your Allies are unaffected by the effects of any Battle Weather created by you. | Depende de outro personagem ou da situação de um alvo. |
| Feint Master | 1 | The Strike and Wound Rolls of Attacking Maneuvers made through the effects of the Feint Maneuver +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Feint Master | 2 | You can Ki Wager up to 1/2 of your Maximum Capacity on Attacking Maneuvers made through the effects of the Feint Maneuver. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Frequent Flyer | 2 | Double the bonus to your Defense Value from using the Soar Maneuver. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Instant Craft | 1 | Your Ingenuity +1(bT) for the sake of any Items with the Device Detail that you craft. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Archetype Focus | 1 | Upon gaining this Talent, select a Foundation. This Foundation becomes your ‘Focused Foundation’. the Wound Roll of all Attacking Maneuvers made of your… | Exige uma escolha registrada ou contextual da mesa. |
| Archetype Defense | 1 | The Strike Rolls of your Focused Foundation +1(T). | Exige uma escolha registrada ou contextual da mesa. |
| Archetype Defense | 2 | Your Focused Foundation is not Physical → you may use it instead of Physical for calculating your Strike Roll for the Parry option… | Exige uma escolha registrada ou contextual da mesa. |
| Archetype Defense | 3 | Your Focused Foundation is Physical → you may use it instead of Energy/Magic for calculating your Wound Roll for the Power Flare option… | Exige uma escolha registrada ou contextual da mesa. |
| Precision Kata | 1 | The CT −1 for your Strike Rolls for an Attacking Maneuver of your Focused Foundation. | Exige uma escolha registrada ou contextual da mesa. |
| Brutal Kata | 1 | The CT −1 for your Wound Rolls for an Attacking Maneuver of your Focused Foundation. | Exige uma escolha registrada ou contextual da mesa. |
| Profile Focus | 1 | Upon gaining this Talent, select a Profile from your Focused Foundation. the Ki Point Cost for Attacking Maneuvers of the selected Profile −1(T). | Exige uma escolha registrada ou contextual da mesa. |
| Muscular Warrior | 1 | Gain 1 Super Stack. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Muscular Warrior | 2 | While you are not suffering from any Health Threshold Penalties, your Muscle Penalty −1(bT). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Hefty Muscle | 1 | The Wound Rolls of your Physical and Energy Attacks +1(T). Double this bonus if you possess 3 Super Stacks. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Herculean Power | 1 | You would use a Signature Technique → apply the bonus from the first effect of Hefty Muscle twice to that Attacking Maneuver. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Herculean Power | 2 | All of your Ultimate Signature Techniques are Absolute Attacks. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Steel Muscle | 1 | Your Soak Value +1(T). Double this bonus if you possess 3 Super Stacks. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Steel Muscle | 2 | While you possess 2+ Super Stacks, your Damage Reduction +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Adamantine Muscle | 1 | Double the increase to your Soak Value from your Super Stacks while you are below the Injured Health Threshold. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Compact Muscle | 1 | While you only possess 1 Super Stack, your Defense Value +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Compact Muscle | 2 | While you only possess 1 Super Stack, the Dice Score of your Steadfast Checks +1. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Flexible Muscle | 1 | While you only possess 1 Super Stack, your Strike Rolls +1(T). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Second Wind | 2 | You may use the Surge Maneuver an additional time per Combat Encounter. | Depende de manobra, gatilho ou decisão na resolução. |
| Lion’s Heart | 1 | You may use the Surge Maneuver an additional time per Combat Encounter. | Depende de manobra, gatilho ou decisão na resolução. |
| Taunt | 1 | Gain 1(bT) Damage Reduction against all Attacking Maneuvers made by Characters with the Compelled Combat Condition. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Flexible Flanker | 1 | An Ally is on a Square adjacent to an Opponent → increase all of your Strike and Wound Rolls made against that Opponent… | Depende de posição, alcance ou cenário na resolução. |
| Supporting Defender | 1 | You are on a Square adjacent to an Opponent → increase all of your Allies’ Dodge Rolls, or Strike Rolls when using the… | Depende de posição, alcance ou cenário na resolução. |
| Power Gifter | 1 | Through the Full Empowerment effect of the Empower Maneuver, you reduce your Capacity by 1/2 of your Max Capacity instead of reducing it… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Teamwork | 1 | Double the maximum amount you can Ki Wager when using the United Attack Maneuver. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Synchronized Combatants | 1 | Choose a Character. If that Character has also chosen you through this effect, that Character is your Partner. | Exige uma escolha registrada ou contextual da mesa. |
| Synchronized Combatants | 2 | While you are on an adjacent Square to your Partner, and your Partner is your Ally, your Combat Rolls +1(T). | Depende de posição, alcance ou cenário na resolução. |
| Superior Synchronization | 1 | Reduce the Performance Skill Check for the Metamoran Fusion Dance to the Expert DC, if the Character you are attempting to fuse with… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Chosen Rival | 1 | Choose a Character (except a Minion). If that Character has also chosen you through this effect, that Character is your Rival. | Exige uma escolha registrada ou contextual da mesa. |
| Chosen Rival | 2 | Your Rival is an Opponent → your Wound Rolls +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Chosen Rival | 3 | Your Rival is an Ally → your Soak Value +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Chosen Rival | 4 | While your Rival is your only non-Defeated Ally in a Combat Encounter, your Combat Rolls +1(T). | Depende de outro personagem ou da situação de um alvo. |
| Eternal Rival | 1 | While your Rival is in a Combat Encounter, your Stress Bonus +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Eternal Rival | 2 | Double the bonus from the 4th effect of Chosen Rival. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Bag of Tricks | 1 | The Ki Point Cost of all Unique Abilities −1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Bag of Tricks | 2 | If you make a Clash against an Opponent through the effects of a Unique Ability (this does not apply to Clashes for any… | Depende de outro personagem ou da situação de um alvo. |
| Technique Master | 1 | You can use the Signature Technique Maneuver an additional time per Combat Round, but Cannot use the same Signature Technique more than once… | Depende de manobra, gatilho ou decisão na resolução. |
| Technique Master | 2 | The first effect of Energy Control loses its [1/Round] Keyword. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Favored Technique | 1 | You gain this Talent → select one of your Signature Techniques. This becomes your Favored Technique. When you use your Favored Technique through… | Exige uma escolha registrada ou contextual da mesa. |
| Favored Technique | 2 | You gain this Talent → select an Advantage with a Technique Point Cost of 10 or less. Apply that Advantage to your Favored… | Exige uma escolha registrada ou contextual da mesa. |
| Powerful Technique | 1 | The Wound Rolls of your Favored Technique +1(T) for each Health Threshold you are below. | Exige uma escolha registrada ou contextual da mesa. |
| Powerful Technique | 2 | Your Favored Technique is an Ultimate Signature → your Wound Roll for that Attacking Maneuver +1(T). | Exige uma escolha registrada ou contextual da mesa. |
| Powerful Technique | 3 | Your Favored Technique gains an Advantage depending on if they are a Super or Ultimate Signature (if your Favored Technique already possesses that… | Exige uma escolha registrada ou contextual da mesa. |
| Unique Technique | 1 | Upon gaining this Talent, select a Profile of the same Foundation as your Favored Technique. This becomes known as your ‘Unique Profile’. | Exige uma escolha registrada ou contextual da mesa. |
| Terrifying Technique | 1 | The Wound Rolls of your Signature Techniques against Characters with the Shaken Combat Condition +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Quick Learner | 2 | You can only possess 1 Copied Technique at any one time, if you attempt to gain an additional Copied Technique beyond the maximum… | Exige uma escolha registrada ou contextual da mesa. |
| Quick Learner | 3 | A Signature Technique is a Copied Technique → your Wound Rolls −2(T) when using that Signature Technique. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Perfect Mimicry | 1 | Ignore the 3rd effect of Quick Learner. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Copy Index | 1 | You can possess 2 Copied Techniques at any one time. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Advanced Learner | 1 | The Technique Point Cost of any Copied Technique that would be gained at the end of a Combat Encounter −3. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Technique Armory | 1 | The initial Technique Point Cost of Signature Techniques −4. This effect applies retroactively, meaning you regain 4 Technique Points for each Signature Technique… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Vigor | 1 | For each Health Threshold you are below, your Soak Value +1(bT). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Vigor | 2 | While you are below the Injured Health Threshold, your Strike and Dodge Rolls +1(bT). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| High Risk Battler | 1 | For each Health Threshold you are below, your Wound Rolls +1(bT). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Battle at the Edge | 1 | While you are below the Critical Health Threshold, your Combat Rolls and Soak Value +1(bT). | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Diehard | 1 | Your Maximum LP +2 for each of your Power Levels. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Diehard | 2 | The Dice Score of your Steadfast Checks +1. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Fortitude | 1 | Your Maximum LP +2 for each of your Power Levels. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Steadfast Warrior | 1 | Your Maximum LP +2 for each of your Power Levels. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Steadfast Warrior | 2 | Rolling a Steadfast Check → roll your Base Die twice and take the highest result. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Undying Determination | 3 | You trigger the second effect of Undying Determination → at the end of your next turn, your LP are reduced to their lowest… | Depende de manobra, gatilho ou decisão na resolução. |
| Steady Momentum | 1 | Your Wound Rolls and Soak Value +1(bT) while your LP are below the Bruised Health Threshold and you are not suffering from any… | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Bursting Transformation | 1 | While in a Form and/or Enhancement while wearing no pieces of Apparel, your Dodge Rolls and Soak Value +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Under Pressure | 1 | Do not reduce your Stress Bonus from any Health Threshold Penalties. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Specialized Transformation | 1 | You gain this Talent → select one Transformation or Transformation Line to be your ‘Specialized Transformation’. | Exige uma escolha registrada ou contextual da mesa. |
| Specialized Transformation | 2 | Making a Stress Test to enter your Specialized Transformation → or while in your Specialized Transformation, roll twice and take the highest result. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Inspiring Transformation | 1 | While you are in a Form, adjacent Allies have their Wound Rolls increased by 1(T). | Depende de posição, alcance ou cenário na resolução. |
| Overwhelming Transformation | 1 | While you are in a Form, adjacent Opponents have their Soak Value reduced by 1(T). | Depende de posição, alcance ou cenário na resolução. |
| Powerful Heartbeat | 1 | While in a Form with higher Stages (including Evolved Stages), you may treat those Stages as if they have +1 level of the… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Powerful Heartbeat | 2 | Treat your Stress Bonus as if it was 1 higher for calculating if you can use the effects of the Heartbeat Aspect. | Depende de manobra, gatilho ou decisão na resolução. |
| Relax to Recover | 1 | While in your Normal State, your Surgency +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Self Control | 1 | While in a Transformation that has lost the Rampaging Aspect due to Mastery or an Acclimated effect, your Soak Value and Wound Rolls… | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Weapon Specialist | 2 | Your Dice Score for a Clash made through the Disarm Maneuver +1(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Category Specialist | 1 | Select a Weapon Category. That Weapon Category becomes known as your Preferred Category. | Exige uma escolha registrada ou contextual da mesa. |
| Category Specialist | 2 | Your Strike Rolls with your Preferred Category +1(T). | Exige uma escolha registrada ou contextual da mesa. |
| Variety Specialist | 1 | All of your Weapons gain 1 additional Quality Slot. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Weapon Master | 1 | The Dice Category of your Energy Charges +1 Category for your Armed Attacks. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Concentrated Energy | 2 | Your Wound Rolls +1(bT) for every 2 stacks of Concentrated Ki you possess. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Concentrated Energy | 4 | Lose all stacks of Concentrated Ki after concluding the Attacking Maneuver declared by the Energy Charge Maneuver, or if you use either the… | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| Experienced Drunk | 1 | While in the Drunk State, the Dice Category of your Extra Dice gained from scoring a Critical Result +1 Category. Double this bonus… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Ferocious Fighter | 1 | While in the Feral State, the Dice Category of your Extra Dice gained from scoring a Critical Result +1 Category. Double this bonus… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Furious Flex | 1 | You are not wearing any pieces of Apparel and at least 1 of your pieces of Apparel have been destroyed this Combat Encounter… | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Lucky | 2 | You are not a Minion → you may also re-roll any d10 rolled by an Ally through the 1st effect of Lucky. | Depende de outro personagem ou da situação de um alvo. |
| Naturist | 1 | While you are not wearing any pieces of Apparel, your Defense Value and Soak Value +1(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Naturist | 2 | Cannot willingly equip any piece of Apparel during a Combat Encounter. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Au Naturel | 1 | Double the benefits from the first effect of Naturist. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Au Naturel | 2 | While you are not wearing any pieces of Apparel, your Wound Rolls +1(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Superhuman Physique | 1 | While you are not wearing any piece of Apparel, your Stress Bonus +1 and your Damage Reduction by 2(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| God-like Physique | 1 | Your Maximum LP +2 for each Power Level reached. | O estado ou a interação exigida precisa de um fluxo de regras específico. |
| God-like Physique | 2 | While you are not wearing any piece of Apparel, your Combat Rolls +1(bT). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Willpower | 1 | Choose a Saving Throw, the Dice Score for any Clashes involving that Saving Throw +1(T). | Exige uma escolha registrada ou contextual da mesa. |
| Willpower | 2 | Roll your Base Die twice for any Saving Throw and use the highest result. | Depende de manobra, gatilho ou decisão na resolução. |
| Arrogance | 1 | The Dice Category of your Greater Dice +1 Category. | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
| Arrogance | 2 | While in the Superior State, the Wound Rolls of your Signature Techniques +1(T). | O efeito ainda carece de um ponto de aplicação verificado na ficha ou na rolagem. |
