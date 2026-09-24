"""Extract course facts from the reviewed OAU source snapshots in tmp/oau-sources.

Requires beautifulsoup4. PDF layout text is generated with pypdf; page numbers
below are PDF page numbers, not the printed page labels. Never infer semesters
or programme placement from the numeric course code.
"""
import json
import re
from collections import Counter
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp/oau-sources'
OUT = ROOT / 'server/src/seed/data'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'accounting': ('Accounting', 'https://accounting.oauife.edu.ng/course-content/', 'Published CCMAS course schedule'),
    'microbiology': ('Microbiology', 'https://nams.oauife.edu.ng/department/courses/', 'Published undergraduate course schedule'),
    'eee': ('Electronic and Electrical Engineering', 'https://eee.oauife.edu.ng/academics.php', 'Published undergraduate course schedule'),
    'adult-education': ('Adult Education and Lifelong Learning', 'https://all.oauife.edu.ng/wp-content/uploads/2024/03/Dept_of_ALL_NEW_HANDBOOK11.pdf', '2021-2026 handbook'),
    'economics': ('Economics', 'https://ecn.oauife.edu.ng/wp-content/uploads/2019/10/Department-of-Economics-Handbook.pdf', 'Official handbook hosted 2019'),
    'linguistics': ('Linguistics and African Languages', 'https://linguistic.oauife.edu.ng/wp-content/uploads/2020/08/CURRICULUM-FOR-LINGUISTICS-AND-YORUBA-WEBSITE.pdf', 'BA Linguistics single honours curriculum hosted 2020'),
}
records, held = [], []
CODE = re.compile(r'^([A-Z]{2,5})\s*(\d{3})\s*:?[ \t]*(.*)$')

def add(key, code, title, units, level, semester, kind, location):
    match = CODE.fullmatch(code.strip())
    if not match or match[3] or not title.strip() or not level or not semester:
        return
    try:
        units = float(units)
    except ValueError:
        held.append({'source': key, 'code': code, 'reason': 'Unclear units', 'location': location})
        return
    if units < 0 or units > 10 or units * 2 != int(units * 2):
        return
    department, url, version = SOURCES[key]
    title = re.sub(r'\s+', ' ', title).strip()
    title = title.replace('\x92', "'").rstrip(' -')
    title = re.sub(r'\s*\(Prerequisite.*', '', title, flags=re.I).strip()
    record = dict(code=f'{match[1]} {match[2]}', title=title, creditUnit=units,
                  departmentName=department, levelName=str(level), semesterName=semester,
                  courseType=kind, curriculumVersion=version,
                  curriculumContext='BA Linguistics (Single Honours)' if key == 'linguistics' else '',
                  sourceUrl=url, sourceLocation=location, sourceRetrievedAt='2026-09-24')
    records.append(record)

for key in ['accounting', 'microbiology', 'eee']:
    soup = BeautifulSoup((CACHE / f'{key}.html').read_text(encoding='utf-8'), 'html.parser')
    for index, table in enumerate(soup.find_all('table')):
        semester = None
        if key == 'accounting':
            heading = table.find_previous('h2').get_text(' ', strip=True)
            match = re.search(r'(\d00) Level: (Harmattan|Rain) Semester', heading)
            if not match:
                continue
            level, semester = match.groups()
        elif key == 'microbiology':
            heading = table.find_previous(['h1', 'h2']).get_text(' ', strip=True)
            level = re.search(r'(\d00) Level', heading)[1]
        else:
            panel = table.find_parent('div', id=re.compile(r'pills-\d00Level'))
            level = re.search(r'(\d00)', panel['id'])[1]
            card = table.find_parent('div', class_='card')
            heading = card.select_one('.card-header').get_text(' ', strip=True)
            semester = next((term for term in ['Harmattan', 'Rain', 'Long Vacation'] if term.lower() in heading.lower()), None)
        for rownum, row in enumerate(table.find_all('tr'), 1):
            cells = [cell.get_text(' ', strip=True) for cell in row.find_all(['td', 'th'])]
            if key == 'microbiology' and len(cells) == 1:
                semester = 'Harmattan' if 'HARMATTAN' in cells[0] else 'Rain' if 'RAIN' in cells[0] else semester
            if len(cells) < 3 or not CODE.fullmatch(cells[0]) or CODE.fullmatch(cells[0])[3]:
                continue
            kind = 'elective' if key == 'accounting' and len(cells) > 3 and cells[3] == 'E' else 'other'
            if key == 'accounting' and len(cells) > 3 and cells[3] == 'C':
                kind = 'core'
            # EEE uses explicit row classes for elective courses.
            if key == 'eee' and 'elective' in ' '.join(row.get('class', [])).lower():
                kind = 'elective'
            add(key, *cells[:3], level, semester, kind, f'Table {index+1}, row {rownum}: {heading}')

ROMAN = {'I': 100, 'II': 200, 'III': 300, 'IV': 400, '1': 100, '2': 200, '3': 300, '4': 400}
for key, pages, prefixes, columns in [
    ('adult-education', range(17, 23), None, 4),
    ('economics', range(17, 22), {'ECN'}, 4),
    ('linguistics', range(17, 21), {'LIN'}, 3),
]:
    level, semester, kind, pending = None, None, 'core', None
    def flush():
        global pending
        if pending:
            if pending['units'] is not None:
                add(key, pending['code'], ' '.join(pending['title']), pending['units'],
                    pending['level'], pending['semester'], pending['kind'], pending['location'])
            else:
                held.append({'source': key, 'code': pending['code'], 'reason': 'No unambiguous units in schedule', 'location': pending['location']})
        pending = None
    for page in pages:
        for line in (CACHE / f'{key}-{page}.txt').read_text(encoding='utf-8').splitlines():
            text = line.strip()
            if key == 'adult-education' and 'SUMMARY OF COURSES' in text:
                flush()
                break
            if text.startswith(('OBAFEMI', 'DEPARTMENT OF')):
                flush()
                continue
            if key == 'linguistics' and 'LINGUISTICS/ENGLISH' in text:
                flush()
                break
            if key == 'economics' and text == 'COURSE CONTENT':
                flush()
                break
            part = re.fullmatch(r'PART\s+(IV|III|II|I|[1-4])', text, re.I)
            if part:
                flush(); level = ROMAN[part[1].upper()]; continue
            compact = re.sub(r'\s+', '', text).upper()
            if compact in ['HARMATTANSEMESTER', 'RAINSEMESTER']:
                flush(); semester = 'Harmattan' if compact.startswith('HARMATTAN') else 'Rain'; kind = 'core'; continue
            if re.match(r'(Restricted Electives?|Compulsory|University Special Electives|Special Electives)', text, re.I):
                flush()
                kind = 'restricted_elective' if text.lower().startswith('restricted') else 'special_elective' if 'special' in text.lower() else 'core'
                continue
            match = CODE.fullmatch(text)
            if match:
                flush()
                if prefixes and match[1] not in prefixes:
                    continue
                tail = match[3]
                numbers = re.search(r'\s+((?:[\d.I-]+\s+){'+str(columns-1)+r'}[\d.]+)\s*$', tail)
                units = numbers[1].split()[-1] if numbers else None
                title = tail[:numbers.start()] if numbers else tail
                # Economics has a separate prerequisite column; keep only title.
                if key == 'economics':
                    title = re.split(r'\s{3,}', title)[0]
                pending = dict(code=f'{match[1]} {match[2]}', title=[title.strip()], units=units,
                               level=level, semester=semester, kind=kind, location=f'PDF page {page}')
            elif pending and text and re.match(r'^[a-zA-Z]', text) and not re.match(r'(Course|Any |And any|TOTAL|Total|One |Two |A total|L\s+T|SUMMARY|Pre-|Requisite)', text, re.I):
                # Wrapped title lines retain the left title column; headings and
                # numerical totals never become part of a course title.
                if line[:1].isspace():
                    numbers = re.search(r'\s+((?:[\d.I-]+\s+){'+str(columns-1)+r'}[\d.]+)\s*$', text)
                    continuation = text[:numbers.start()] if numbers else text
                    if numbers and pending['units'] is None:
                        pending['units'] = numbers[1].split()[-1]
                    part = re.split(r'\s{3,}', continuation)[0]
                    if len(part) > 2:
                        pending['title'].append(part)
            elif text and re.match(r'(TOTAL|Total|Course|Any |And |SUMMARY)', text, re.I):
                flush()
        flush()

# Same placement must have a single definition. Conflicts go to review.
unique = {}
for record in records:
    key = tuple(record[k] for k in ['departmentName','code','levelName','semesterName','curriculumContext','curriculumVersion'])
    if key in unique and (unique[key]['title'],unique[key]['creditUnit']) != (record['title'],record['creditUnit']):
        raise ValueError(f'Conflicting placement: {key}')
    unique[key] = record
records = list(unique.values())
(OUT / 'oauOfficialCourses.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(OUT / 'oauCourseReview.json').write_text(json.dumps(held, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(Counter(r['departmentName'] for r in records)), indent=2))
print('Total', len(records), 'held', len(held))
