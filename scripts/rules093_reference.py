"""Extract and summarize catalog data from a local rules snapshot."""
import re


def talent_categories(html):
    from bs4 import BeautifulSoup

    page = BeautifulSoup(html, 'html.parser').select_one('.entry-content')
    result = {}
    for group in page.find_all('details', recursive=False):
        category = group.summary.get_text(' ', strip=True).removesuffix(' Talents')
        for paragraph in group.find_all('p'):
            if not paragraph.strong:
                continue
            text = paragraph.get_text(' ', strip=True)
            pre = re.search(r'Prerequisites\s*:\s*(.*?)\s*\(\s*1\s*\)\s*-\s*\[', text, re.I)
            if not pre:
                continue
            name = paragraph.strong.get_text(' ', strip=True).strip(': ')
            if name in result:
                raise ValueError(f'Duplicate talent: {name}')
            result[name] = category
    return result



REVIEWED_SUMMARIES = {
    ('saiyans', 'Born for Battle'):
        'No início das rodadas pares, ganhe 1 stack de Battle Born. Escolha Strike, Dodge ou Wound. '
        'Cada stack concede +1(T) à rolagem escolhida, com limite normal de 2 por tipo.',
    ('saiyans', 'Saiyan Heritage'):
        'Tenha sucesso automático no Steadfast Check de Bruised. Ao ser derrotado, você pode fazer '
        'um Steadfast Check com −2 para entrar em Undying até o fim do seu próximo turno.',
    ('saiyans', 'Warrior’s Pride'):
        'Aplique o bônus racial de Saving Throw também a Cognitive. Em Superior, ignore as '
        'penalidades de Health Threshold, Impaired e Fatigued.',
    ('saiyans', 'Blood of the Warrior'):
        'Wound, Soak e Surgency recebem +1(T) por Health Threshold cruzado. '
        'Uma vez por encontro, dobre Surgency em uma Healing Surge.',
    ('saiyans', 'Powerful Physique'):
        'Aumente Soak em um quarto do Force Modifier, arredondando para cima. '
        'Com 2+ stacks de Power, aumente Force Modifier em +1(T).',
    ('talents', 'Artful Strike'):
        'Aumente em uma categoria os dados extras dos críticos de Strike. '
        'Uma vez por rodada, um natural exatamente 1 abaixo do CT de Strike pode contar como crítico.',
    ('talents', 'Focused Strike'):
        'Strike CT −1. Uma vez por rodada, ao errar um ataque, rerrole Strike contra o mesmo resultado do oponente.',
    ('talents', 'Wild Counter'):
        'Ao evitar um ataque com Parry, você pode usar Basic Attack contra o atacante como manobra OoS.',
}


def compact_rule(note):
    note = re.sub(r'\(see\s*[—–-]\s*[^()]+\)', '', note, flags=re.I)
    for pattern, replacement in (
        (r'\bKi Points\b', 'KP'),
        (r'\bLife Points\b', 'LP'),
        (r'\bCritical Target\b', 'CT'),
        (r'\bOut-of-Sequence Maneuver\b', 'OoS maneuver'),
        (r'\bYou gain access to\b', 'Unlock'),
        (r'\bYou may spend\b', 'Option to spend'),
        (r'\bYou cannot\b', 'Cannot'),
        (r'\bYou are treated as\b', 'Count as'),
        (r'^(?:If|When) ([^()]{4,140}?), ', r'\1 → '),
    ):
        note = re.sub(pattern, replacement, note, flags=re.I)
    note = re.sub(
        r'\b(increase|reduce) ((?:your|their|the) [^.!?]{1,100}?) by '
        r'(\d+(?:\((?:T|bT)\))?)(?=[ .,;)!?]|$)(?!\s*/)',
        lambda match: f"{match[2]} {'+' if match[1].lower() == 'increase' else '−'}{match[3]}",
        note,
        flags=re.I,
    )
    note = note.strip().replace(' .', '.')
    note = note[:1].upper() + note[1:]
    return note


def reference_effects(row):
    if row['effects']:
        return row['effects']
    # Some racial blocks omit the colon after the effect keyword.
    return [
        dict(level=int(level), keyword=keyword, text=text.strip())
        for level, keyword, text in re.findall(
            r'\((\d+)\)\s*-\s*\[([^]]+)\]\s*:?\s*(.*?)(?=\(\d+\)\s*-\s*\[|$)',
            row['text'],
        )
    ]


LEVEL_SUMMARIES = {
    ('shinjin', 'Divine Magic', 1):
        'Libera as Unique Abilities Magical Materialization, Telepathy, Telekinesis e Second Sight.',
    ('shinjin', 'Divine Magic', 2):
        'Na criação, ganhe 1 rank em cada uma: Knowledge (especialidade à escolha), Creature Handling, '
        'Clairvoyance, Perception, Use Magic e Investigation.',
    ('talents', 'Alert', 1): 'Initiative Value +1(bT).',
    ('talents', 'Alert', 2): 'Ignore os efeitos de Surprise Rounds.',
    ('talents', 'Alert', 3): 'Com Initiative Advantage, ganhe +1(T) nas rolagens de Wound.',
    ('talents', 'Alert', 4):
        'Uma vez por encontro, no início da rodada, ganhe 1 Counter Action se tiver Initiative Advantage.',
    ('talents', 'Angry Warrior', 2):
        'Em Raging, ao atacar, reduza o natural de Strike em até L. Cada ponto reduzido concede +1(T) em Wound naquele ataque.',
    ('beast-man', 'Were-Beast', 3):
        'Um Were-Trigger opcional, combinado com o ARC, dá +2 ao Racial Life Modifier. '
        'No efeito 4, escolha Were-Traits com o gatilho presente ou Normal Trait com ele ausente.',
    ('unstable-clone', 'Bio-Berserker', 1):
        'Herde os Body Factors do original. Seus Body Awakenings ficam disponíveis se você atender aos requisitos e ao limite de Awakenings. '
        'O ARC define outras heranças conforme a clonagem.',
    ('og-soldier', 'Mimicry Program', 4):
        'Cyber Copy registra as capacidades do alvo e suas Forms ou Enhancements ativos. '
        'A cópia serve como alvo de Copy Being e preserva o seu próprio equipamento.',
    ('demons', 'Demons of the Makyo Star', 2):
        'Perto da Makyo Star, ganhe o Awakening homônimo como Temporary Awakening de nível 2. '
        'Ele dura até sair do alcance definido pelo ARC.',
    ('dragon-ball-hero', 'Switch to a Hero', 1):
        'Crie um Avatar no seu Power Level com Class Avatar. Ele progride junto com você, tem Transformations próprias '
        'e compartilha LP, KP e Capacity atuais. Veja as raças elegíveis no link.',
    ('android-majin', 'DNA Absorption', 3):
        'O DNA Copy pode ser alvo de Absorption temporária e registra as capacidades e o equipamento do alvo. '
        'Perder um stack da cópia não solta um personagem, e a cópia não pode virar um stack permanente.',
    ('saiyans', 'Saiyan Heritage', 3):
        'Um Called Shot na cauda pode cortá-la com dano Lethal ou com Slashing que cause pelo menos ¼ dos LP máximos, arredondado para cima. '
        'Aceite Tailless ou espere 1d4+1 encontros pela regeneração.',
    ('shadow-dragons', 'Personified Dragon Ball', 1):
        'Ao ficar Defeated, assuma Ball Form no tamanho escolhido na criação. Você pode usar Possess, '
        'mas perde acesso a ataques, Unique Abilities, Power Up, Energy Charge e Transformation.',
    ('talents', 'Roomy Biology', 3):
        'Gaste 1 Action para guardar ou retirar um item ou personagem disposto ou Defeated. '
        'Personagens podem tentar escapar com Might Clash. Combates internos permitem criar um Duplicate Minion.',
}


def level_summary(row, effect):
    key = (row.get('source', 'talents'), row['name'], effect['level'])
    if key in LEVEL_SUMMARIES:
        return LEVEL_SUMMARIES[key]

    return summarize_rule(effect['text'], key)


def summarize_rule(text, key):
    note = compact_rule(text.strip())
    if not note or re.match(r'Please (refer|see)', note, re.I):
        raise ValueError(f'Missing reference summary for {key}')

    # Retain short follow-on sentences, which often hold the payoff or limit.
    # Long entries keep their opening rules and remain linked to the source.
    if len(note) > 350:
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', note)
        kept = []
        for sentence in sentences:
            if len(' '.join([*kept, sentence])) > 350:
                break
            kept.append(sentence)
        note = ' '.join(kept) or note[:345].rsplit(' ', 1)[0].rstrip(' ,;:')
        note += ' …'
    return note



CHOICE_KEYWORD = re.compile(r'^(?:Option|Multi-Option/\d+|Choice(?:, Twinned)?)$')
OPTION_HEADING = re.compile(r'(?:[:.!?–]|^)\s*([^\s\[\].:!?][^\[\].:!?]*?(?:[.!?]+)?)\s*\[([^\]]+)\]\s*:')
DIVINE_DOMAINS = {
    'God of Peace': 'Ao ativar Power, entre em Mindful até o início do próximo turno.',
    'God of Judgment': 'Ao usar a manobra Signature Technique, acrescente 1 Energy Charge ao ataque.',
    'God of Power': 'Ganhe Muscular Warrior e +1(T) em Force Modifier em Form ou Enhancement.',
    'God of Survival': '+2 em Steadfast e metade do Insight Modifier em Surgency, arredondando para cima.',
    'God of Wisdom': '+1(bT) em Combat Rolls e Initiative se Scholarship ou Personality tiver o maior valor de atributo.',
    'God of War': 'Ganhe Weapon Specialist e adicione Weapon Assisted sem custo de TP ao criar Signature Techniques.',
    'God of Magic': 'Unique Abilities mágicas custam 3 TP e 2(T) KP a menos.',
    'God of Many': 'Ganhe Master of Minions. Seus Minions recebem +1(T) em Combat Rolls enquanto você estiver em Spectator.',
    'God of Time': 'Libera Time Freeze com Straining e Difficult. Ganhe +2(T) em Wound durante Frozen Turns.',
    'God of an Element': 'Escolha um Profile Elemental como seu Favored Element.',
}

# Cross-trait Choice effects follow an existing Option on another card.
CHOICE_SOURCES = {
    'Combat Blueprint': ('r093_bio_android_artificial_warrior', 4, 'Artificial Warrior'),
    'Arcosian Genes [Any – you decide]': ('r093_bio_android_artificial_warrior', 4, 'Artificial Warrior'),
    'Eye of the Dragon': ('r093_earthlings_quick_to_master', 3, 'Quick to Master'),
    'Draconic Physique': ('r093_shadow_dragons_personified_dragon_ball', 6, 'Personified Dragon Ball'),
}


def continued_choices(html, rows):
    """Recover effects whose numbered heading follows a separate list in the same trait."""
    from bs4 import BeautifulSoup

    headings = {f"{row['name']} ({row['category']})".casefold(): row['name'] for row in rows}
    result = {}
    if not headings:
        return result
    page = BeautifulSoup(html, 'html.parser').select_one('.entry-content')
    for paragraph in page.find_all('p'):
        if not paragraph.strong:
            continue
        name = headings.get(paragraph.strong.get_text(' ', strip=True).casefold())
        if not name:
            continue
        for sibling in paragraph.next_siblings:
            if not getattr(sibling, 'name', None) or sibling.name == 'ul':
                continue
            if sibling.name != 'p':
                break
            match = re.fullmatch(
                r'\(\s*(\d+)\s*\)\s*-\s*\[\s*(Option|Multi-Option/\d+|Choice(?:, Twinned)?)\s*\]?\s*:\s*(.*)',
                sibling.get_text(' ', strip=True),
            )
            if not match:
                break
            options = sibling.find_next_sibling()
            if not options or options.name != 'ul':
                raise ValueError(f'Missing continuation list for {name} level {match[1]}')
            result.setdefault(name, []).append(dict(
                level=int(match[1]), keyword=match[2], text=f"{match[3]} {options.get_text(' ', strip=True)}",
            ))
    return result


def racial_choice(row, current, previous_options):
    keyword = current['keyword']
    if not CHOICE_KEYWORD.fullmatch(keyword):
        return {}
    matches = list(OPTION_HEADING.finditer(current['text']))
    if len(matches) < 2:
        raise ValueError(f"Missing options for {row['name']} level {current['level']}")
    options = []
    for index, match in enumerate(matches):
        name, kind = (part.strip() for part in match.groups())
        end = matches[index + 1].start() + 1 if index + 1 < len(matches) else len(current['text'])
        text = current['text'][match.end():end].strip()
        summary = DIVINE_DOMAINS.get(name) if row['name'] == 'Divine Magic' else None
        if (row['name'], current['level'], name) == ('Artificial Warrior', 5, 'Pursuit of Perfection'):
            summary = ('Defina um Perfection Target com o ARC. Enquanto mantiver a Absorption desse alvo, '
                       'ganhe Perfection como Temporary Awakening Lv.1, inclusive após o encontro.')
        option = dict(name=name, keyword=kind, summary=summary or summarize_rule(text, (row['name'], current['level'], name)))
        if re.search(r'select a Profile with [‘\']Elemental', text) and 'Favored Element' in text:
            option['selectElement'] = True
        if row['name'] == 'Heart of Evil' and (race := re.search(r'\((Saiyan|Namekian|Shinjin)\)$', name)):
            option['requiredRace'] = race[1].lower()
        options.append(option)
    if keyword.startswith('Choice'):
        trait_id, level, source = CHOICE_SOURCES.get(row['name'], ('', previous_options[-1] if previous_options else None, row['name']))
        if level is None:
            raise ValueError(f"Missing source selection for {row['name']}")
        summary = f'Efeito definido pela escolha no Lv.{level} de {source}.'
        if 'Twinned' in keyword:
            summary += ' Disponível se este for um traço primário.'
        return dict(activationType='choice', options=options, choiceSource=dict(traitId=trait_id, level=level), summary=summary)
    if keyword.startswith('Multi-Option'):
        count = int(keyword.split('/')[-1])
        return dict(activationType='multi-option', options=options, optionCount=count,
                    summary=f'Escolha {count} opções.')
    summary = 'Na criação, escolha um domínio.' if row['name'] == 'Divine Magic' else 'Escolha uma opção.'
    return dict(activationType='option', options=options, summary=summary)


TRANSFORMATION_ADDENDA = {
    'absorption': 'Cada Absorption dá +1 nos três maiores atributos do alvo. Limite de duas stacks temporárias. '
                  'Fusões contam como uma stack, com AMB multiplicado pelo número de integrantes. Fora do combate, a stack é permanente e conta no limite.',
    'vocation-gain': 'Cada stack tem seu próprio AMB. Warrior +1 FO/TE/MA, Mage ou Priest +1 IN/MA, '
                     'Martial Artist +1 AG/FO, Thief +1 AG/IN, Ranger +2 AG, Dancer +2 PE, Gadabout +1 em um atributo escolhido e um sorteado.',
    'big-gete-star-integration': 'O Big Gete Star compartilha seus LP e defesas. Seu terreno é Metallic e você pode tratar '
                                'qualquer quadrado dele como alcance corpo a corpo. Ataques ao astro acertam automaticamente, mas Defense reduz o dano final.',
    'overtaken': 'Se uma Fusion que você possui se desfizer, escolha um integrante. Ele recebe Overtaken Lv.2 como Temporary Awakening '
                 'e você o controla enquanto for o Possessing Character.',
    'mortal-mentality': 'Efeitos de Healthy ou acima de Bruised passam a valer abaixo de Injured. Efeitos acima de Injured ou Critical '
                        'passam a valer abaixo de Bruised. Contagens de limiares acima passam a contar os limiares abaixo.',
    'cybernetic-reconfiguration': 'Ao equipar Cosmic Suit, escolha dois traços de Cybernetic Enhancement. Eles permanecem disponíveis '
                                   'enquanto você possuir este Awakening.',
    'dark-factor': 'Só um personagem no cenário pode ter Dark Factor. Ao morrer com ele, seu Origin fica ligado ao Awakening. '
                   'Um novo portador precisa vencer um Might Clash sem Forms ou Enhancements para evitar ser controlado pelo Origin.',
    'glass-dragon': 'Ao entrar na forma, crie um Refractive Dragon com metade de seus LP máximos. Só Called Shots direcionados a ele '
                    'causam dano por ataque. Ele desaparece ao cair a 0 LP, ao sair da forma ou ao fim do encontro.',
    'metamorphosis': 'Configure cada estágio com um tamanho de Small a Large, Evolution Traits em quantidade igual a S, '
                     'e escolhas próprias de Tail Attack e Survivor.',
    'grudge-amplifier': 'Ghost Warriors são Special Minions criados a partir do registro de um personagem na hora da morte. '
                        'Seu Power Level acompanha o seu, ajustando os Character Perks.',
    'hyper-mega-form': 'Você pode combinar Supports mortos, absorvidos, possuídos, mesclados ou fundidos. A combinação encerra '
                       'o vínculo anterior aplicável. Supports destruídos, selados ou fora do campo ficam indisponíveis.',
    'empowered-form': 'Em uma linha com múltiplos estágios, retire Scaling e acrescente +2(T) em AG/FO/TE/MA. '
                      'No estágio original 1, Stress +4. No 2, Stress +2 e Tier 5+. No 3, Stress +1 e Tier 6+.',
    'supreme-form': 'Supreme Form pode ficar acima de um Evolved Stage com Pinnacle, ignorando o limite de Stacking Evolved Stages.',
}

SUPER_SAIYAN_SUMMARIES = {
    ('S-Cells', 1): 'Com 4+ stacks de Battle Born, aumente em uma categoria os Extra Dice de Tier dos Combat Rolls e ganhe +1(T) Damage Reduction.',
    ('S-Cells', 2): 'Com 6+ stacks de Battle Born, use Power Up como Instant Maneuver, uma vez por rodada.',
    ('S-Cells', 3): 'Ao ganhar a transformação, escolha um dos efeitos abaixo.',
    ('Golden Power', 1): 'Ganhe +1(T) no Dice Score de Duel Clashes.',
    ('Golden Power', 2): 'Uma vez por rodada, ao ser atingido abaixo de Bruised, reduza a Damage Category do ataque em um nível para o seu cálculo de dano.',
    ('Golden Power', 3): 'Ao se transformar, entre em Raging até o fim do turno.',
    ('Golden Power', 4): 'Ao se transformar, use uma Ki Surge, uma vez por encontro.',
    ('This is a Super Saiyan', 1): 'Troque Draining e Power High por Natural (Lv.1) e Heartbeat (Lv.1).',
    ('This is a Super Saiyan', 2): 'Libera o Evolved Stage Full Power de Super Saiyan 1.',
    ('This is a Super Saiyan', 3): 'Superior conta como Raging para o aspecto Raging.',
    ('This is a Super Saiyan', 4): 'Quando Golden Power Lv.3 ativar, você pode entrar em Superior em vez de Raging. Superior dura até o início do próximo turno.',
}


def transformation_reference(row, group, effect):
    key = (row['page'], group['name'], effect['level'])
    summary = SUPER_SAIYAN_SUMMARIES.get(key[1:]) if row['page'] == 'super-saiyan' and row['name'] == 'Super Saiyan 1' else None
    if effect['keyword'] == 'Addendum' and effect['text'].startswith('Please refer'):
        summary = TRANSFORMATION_ADDENDA[row['page']]
    reference = {'summary': summary or summarize_rule(effect['text'], key)}
    if re.search(r'\b(?:Option|Choice)\b', effect['keyword']):
        option_list, = group['extraLists']
        headings = list(OPTION_HEADING.finditer(option_list))
        if len(headings) < 2:
            raise ValueError(f'Missing transformation options for {key}')
        ends = [*(m.start() + 1 for m in headings[1:]), len(option_list)]
        options = []
        for match, end in zip(headings, ends, strict=True):
            name, keyword = (part.strip() for part in match.groups())
            text = option_list[match.end():end].strip()
            if row['page'] == 'cultivation-of-the-self' and name == 'Built Different' and text.startswith('Please refer'):
                text = ('Fora de Forms e Enhancements, Inherent Power tem Degree mínimo 1. Escolha o Degree no início do combate. '
                        'Power Up e Transformation podem subir o Degree. Combat Recovery, Holding Back e início do turno podem baixá-lo. '
                        'Se mudar o Degree numa transformação, faça um Stress Test.')
            options.append(dict(name=name, keyword=keyword, summary=summarize_rule(text, (*key, name))))
        reference['referenceOptions'] = options
    return reference


def mechanic_summary(row):
    """Describe up to two effects as reference notes, excluding flavor prose."""
    reviewed = REVIEWED_SUMMARIES.get((row.get('source', 'talents'), row['name']))
    if reviewed:
        return reviewed
    effects = reference_effects(row)

    notes = []
    for effect in effects:
        note = effect['text'].strip()
        if not note or re.match(r'Please (refer|see)', note, re.I):
            continue
        first_sentence = re.split(r'(?<=[.!?])\s+(?=[A-Z])', note, maxsplit=1)[0]
        note = compact_rule(first_sentence)
        if len(note) > 230:
            note = note[:225].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
        if effect['keyword'] != 'Passive':
            note = f"[{effect['keyword']}] {note}"
        notes.append(note)
        if len(notes) == 2:
            break

    if not notes:
        raise ValueError(f"No effects to summarize for {row['name']}")
    return '\n'.join(notes)
