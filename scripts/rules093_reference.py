"""Read the official talent category labels from a local HTML snapshot."""
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


def mechanic_summary(row):
    """Describe up to two effects as reference notes, excluding flavor prose."""
    reviewed = REVIEWED_SUMMARIES.get((row.get('source', 'talents'), row['name']))
    if reviewed:
        return reviewed
    effects = row['effects']
    if not effects:
        # A few racial blocks omit the delimiter after the effect keyword.
        effects = [
            dict(keyword=keyword, text=text)
            for keyword, text in re.findall(
                r'\(\d+\)\s*-\s*\[([^]]+)\]\s*:?\s*(.*?)(?=\(\d+\)\s*-\s*\[|$)',
                row['text'],
            )
        ]

    notes = []
    for effect in effects:
        note = effect['text'].strip()
        if not note or re.match(r'Please (refer|see)', note, re.I):
            continue
        note = re.sub(r'\(see\s*[—–-]\s*[^()]+\)', '', note, flags=re.I)
        # Keep only the first sentence of each selected effect. The official
        # entry is linked for exceptions, options and additional effects.
        note = re.split(r'(?<=[.!?])\s+(?=[A-Z])', note, maxsplit=1)[0]
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
