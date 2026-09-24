"""Extract the visually reviewed, two-page spreads in the supplied CSE handbook.

Usage: python scripts/extract_cse_handbook.py PATH_TO_PDF
Requires PyMuPDF. Programme/semester boundaries below come from the printed
headings, never course-number parity. Outputs preserve source-specific units.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
doc = pymupdf.open(source)
assert len(doc) == 31, 'Unexpected handbook edition; review table boundaries first'
tables = []
for page in range(18, 24):
    for side, x in [('left', 0), ('right', 421)]:
        for table in doc[page - 1].find_tables(clip=pymupdf.Rect(x, 0, x + 421, 595)).tables:
            tables.append(dict(page=page, side=side, rows=table.extract()))
assert len(tables) == 38, 'Table layout changed; review before importing'

PROGRAMMES = ['B.Sc. Computer Engineering', 'B.Sc. Computer Science (Mathematics)', 'B.Sc. Computer Science with Economics']
# Table index: programme index (-1 = shared foundation), level, printed term.
layout = {
    0: (-1,100,'Harmattan'), 2: (-1,100,'Rain'),
    3:(0,200,'Harmattan'),4:(0,200,'Rain'),5:(0,200,'Long Vacation'),
    6:(0,300,'Harmattan'),7:(0,300,'Rain'),8:(0,300,'Long Vacation'),
    9:(0,400,'Harmattan'),10:(0,400,'Rain and Long Vacation'),
    11:(0,500,'Harmattan'),12:(0,500,'Harmattan'),13:(0,500,'Rain'),
    14:(1,200,'Harmattan'),15:(1,200,'Rain'),16:(1,200,'Long Vacation'),
    17:(1,300,'Harmattan'),18:(1,300,'Rain'),19:(1,300,'Rain'),20:(1,300,'Long Vacation'),
    21:(1,400,'Harmattan'),22:(1,400,'Rain and Long Vacation'),
    23:(1,500,'Harmattan'),24:(1,500,'Harmattan'),25:(1,500,'Rain'),
    26:(2,200,'Harmattan'),27:(2,200,'Rain'),28:(2,200,'Long Vacation'),
    29:(2,300,'Harmattan'),30:(2,300,'Harmattan'),31:(2,300,'Rain'),32:(2,300,'Long Vacation'),
    33:(2,400,'Harmattan'),34:(2,400,'Rain and Long Vacation'),
    35:(2,500,'Harmattan'),36:(2,500,'Rain'),37:(2,500,'Rain'),
}
records, review = [], []
clean = lambda value: re.sub(r'\s+', ' ', value or '').strip()
code_pattern = re.compile(r'^([A-Z]{3})\s*(\d{3})(?:[123])?$')

def add(index, rownum, code, title, units, kind='core'):
    programme, level, term = layout[index]
    semester = 'Rain' if term == 'Rain and Long Vacation' else term
    for name in PROGRAMMES if programme == -1 else [PROGRAMMES[programme]]:
        records.append(dict(code=code, title=clean(title), creditUnit=int(units),
            departmentCode='CSENG', facultyCode='TEC', levelName=str(level), semesterName=semester,
            sourceTerm=term, curriculumContext=name, courseType=kind,
            curriculumVersion='CSE-handbook_Updated.pdf (undated historical edition)',
            sourceLocation=f"PDF page {tables[index]['page']}, {tables[index]['side']} table, row {rownum}; {term}",
            isActive=semester in ['Harmattan','Rain']))

for index in layout:
    # One merged code-column on page 18 covers nine individually ruled rows.
    merged_codes = tables[index]['rows'][1][1].splitlines() if index == 4 else []
    for rownum, row in enumerate(tables[index]['rows'], 1):
        if len(row) != 6:
            raise ValueError(f'Unexpected columns at table {index}, row {rownum}')
        _, rawcode, title, prerequisites, ltp, units = row
        if index == 4 and 2 <= rownum <= 10:
            rawcode = merged_codes[rownum-2]
        code = code_pattern.fullmatch(clean(rawcode))
        if code:
            assert clean(units).isdigit(), (index, rownum, units)
            kind = 'industrial_training' if 'Industrial Work' in (title or '') else 'project' if 'Individual Project' in (title or '') else 'core'
            add(index,rownum,f'{code[1]} {code[2]}',title,clean(units),kind)
        elif rawcode and 'Plus ' in (title or ''):
            # A merged elective cell specifies an option group, not a fake course.
            options = list(re.finditer(r'([A-Z]{3})\s*(\d{3})\s+', title))
            unit_values = set(re.findall(r'\d+',units or ''))
            assert len(unit_values) == 1, (index,rownum,units)
            credit = next(iter(unit_values))
            for j, option in enumerate(options):
                option_title = title[option.end():options[j+1].start() if j+1<len(options) else len(title)]
                add(index,rownum,f'{option[1]} {option[2]}',option_title,credit,'restricted_elective')
        elif clean(rawcode) == 'SE':
            review.append(dict(table=index,page=tables[index]['page'],programme=layout[index][0],
                level=layout[index][1],term=layout[index][2],reason='Generic special-elective slot has no course code',units=clean(units)))

keys=[(r['code'],r['curriculumContext'],r['levelName'],r['semesterName']) for r in records]
assert len(keys)==len(set(keys)), 'Duplicate programme placement'
assert len([r for r in records if r['levelName']=='100']) == 42
assert next(r for r in records if r['code']=='CSC 312' and 'Mathematics' in r['curriculumContext'])['creditUnit']==3
assert next(r for r in records if r['code']=='CSC 312' and 'Economics' in r['curriculumContext'])['creditUnit']==2

# Cross-check descriptions without overwriting the more specific programme tables.
# Conflicting units are retained for review and kept out of result-entry selectors.
description_pattern = re.compile(r'\b([A-Z]{3})\s*(\d{3})\s*:\s*([^()]{3,160})\((\d+)\s*UNIT')
descriptions = []
for page in range(23,31):
    for side,x in [('left',0),('right',421)]:
        text = doc[page-1].get_text('text',clip=pymupdf.Rect(x,0,x+421,595),sort=True)
        for match in description_pattern.finditer(text):
            descriptions.append(dict(code=f'{match[1]} {match[2]}',title=clean(match[3]),
                creditUnit=int(match[4]),sourceLocation=f'PDF page {page}, {side}, course description'))
for description in descriptions:
    matches = [r for r in records if r['code']==description['code']]
    if not matches:
        records.append(dict(**description,departmentCode='CSENG',facultyCode='TEC',levelName=None,
            semesterName=None,sourceTerm='Not specified',curriculumContext='Unplaced course descriptions',
            courseType='other',curriculumVersion='CSE-handbook_Updated.pdf (undated historical edition)',
            isActive=False,sourceNotes='Course description has no programme/semester placement in the tables.'))
    for record in matches:
        if record['creditUnit'] != description['creditUnit']:
            record['isActive'] = False
            record['sourceNotes'] = f"Programme table lists {record['creditUnit']} units; {description['sourceLocation']} lists {description['creditUnit']}. Confirm before result entry."
            review.append(dict(code=record['code'],programme=record['curriculumContext'],
                reason=record['sourceNotes'],tableLocation=record['sourceLocation']))

payload=dict(source=dict(fileName=source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    pages=31,sourceDepartment='Computer Science and Engineering',sourceFaculty='Faculty of Technology'),
    programmes=PROGRAMMES,records=records,review=review)
out=ROOT/'server/src/seed/data/cseHandbookCourses.json'
out.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print(json.dumps(dict(placements=len(records),active=sum(r['isActive'] for r in records),
    programmes=dict(Counter(r['curriculumContext'] for r in records)),uncodedSlots=len(review)),indent=2))
