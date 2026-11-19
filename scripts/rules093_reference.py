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

