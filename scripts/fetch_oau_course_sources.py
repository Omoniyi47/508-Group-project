"""Download the six reviewed public OAU sources for catalogue regeneration.

Dependencies: requests, beautifulsoup4, pypdf. Run from the project root, then
run extract_oau_courses.py and review its output before importing changes.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1] / 'tmp/oau-sources'
ROOT.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'accounting': ('https://accounting.oauife.edu.ng/course-content/', None),
    'microbiology': ('https://nams.oauife.edu.ng/department/courses/', None),
    'eee': ('https://eee.oauife.edu.ng/academics.php', None),
    'adult-education': ('https://all.oauife.edu.ng/wp-content/uploads/2024/03/Dept_of_ALL_NEW_HANDBOOK11.pdf', range(17, 23)),
    'economics': ('https://ecn.oauife.edu.ng/wp-content/uploads/2019/10/Department-of-Economics-Handbook.pdf', range(17, 22)),
    'linguistics': ('https://linguistic.oauife.edu.ng/wp-content/uploads/2020/08/CURRICULUM-FOR-LINGUISTICS-AND-YORUBA-WEBSITE.pdf', range(17, 21)),
}

def fetch(item):
    name, (url, pages) = item
    response = requests.get(url, timeout=45)
    response.raise_for_status()
    if pages:
        path = ROOT / f'{name}.pdf'
        path.write_bytes(response.content)
        reader = PdfReader(path)
        for page in pages:
            (ROOT / f'{name}-{page}.txt').write_text(reader.pages[page-1].extract_text(extraction_mode='layout'), encoding='utf-8')
    else:
        soup = BeautifulSoup(response.content, 'html.parser')
        (ROOT / f'{name}.html').write_text(str(soup), encoding='utf-8')
    print(f'Downloaded {name}', flush=True)

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(fetch, SOURCES.items()))
