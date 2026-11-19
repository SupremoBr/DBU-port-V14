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
OPTION_HEADING = re.compile(r'(?:[:.!?–]|^)\s*([^\[\].:!?]+?)\s*\[([^\]]+)\]\s*:')
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
