import { Session } from '../models/Session.js';
import { Level } from '../models/Level.js';

// OAU's first session and latest announced admissions session, checked 2026-09-24:
// https://fss.oauife.edu.ng/about-the-department/
// https://oauife.edu.ng/oau-2026-post-utme-screening-exercise-new-date-announced/
// This is a continuous year-label catalogue, not a verified historical calendar.
export const FIRST_OAU_SESSION_YEAR = 1962;
export const LAST_OAU_SESSION_YEAR = 2026;

export async function seedStudentReferenceData() {
  let sessionsCreated = 0;
  let levelsCreated = 0;
  for (let year = FIRST_OAU_SESSION_YEAR; year <= LAST_OAU_SESSION_YEAR; year += 1) {
    const now = new Date();
    const result = await Session.updateOne(
      { name: `${year}/${year + 1}` },
      { $setOnInsert: {
        // Calendar-year bounds satisfy required dates without claiming verified
        // teaching dates. Administrators can replace these from official calendars.
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year + 1, 11, 31)),
        datesAreEstimated: true,
        isCurrent: false,
        createdAt: now,
        updatedAt: now,
      } },
      { upsert: true, timestamps: false }
    );
    sessionsCreated += result.upsertedCount;
  }
  for (let order = 1; order <= 6; order += 1) {
    const now = new Date();
    const result = await Level.updateOne(
      { name: String(order * 100) },
      { $setOnInsert: { order, createdAt: now, updatedAt: now } },
      { upsert: true, timestamps: false }
    );
    levelsCreated += result.upsertedCount;
  }
  return { sessionsCreated, levelsCreated };
}
