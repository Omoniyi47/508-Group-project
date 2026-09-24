import { readFile } from 'node:fs/promises';

// Parsed from six OAU master-marks-sheet OCR exports (1991/92 Rain and
// 2005/2006 Rain, B.Sc. Computer Engineering / Computer Science-Mathematics /
// Computer Science-Economics, Faculty of Technology, Department of Computer
// Science and Engineering). Course-level scores exist only for 2005/2006;
// 1991/92 rows carry semester summary totals and repeat/outstanding course
// lists only, because no per-course scores were captured in that source.
//
// No source row includes a student name — only a matric/reg number. Every
// record below is keyed by matric number with a derived, non-authoritative
// entryYear (from the matric/reg-number convention) and level (from the
// printed Part). Where OCR left a digit uncertain (a literal "?" in the
// source), that uncertainty is preserved in matricNumber/entryYear rather
// than guessed.
export async function readOauHistoricalResults() {
  return JSON.parse(await readFile(new URL('./data/oauHistoricalResultsFlat.json', import.meta.url), 'utf8'));
}

export async function readOauHistoricalResultsBySession() {
  return JSON.parse(await readFile(new URL('./data/oauHistoricalResultsBySession.json', import.meta.url), 'utf8'));
}
