import { describe, expect, it } from 'vitest';
import { Session } from '../src/models/Session.js';
import { Level } from '../src/models/Level.js';
import { Semester } from '../src/models/Semester.js';
import { seedStudentReferenceData } from '../src/seed/studentReferenceData.js';

describe('OAU student dropdown reference data', () => {
  it('populates the full session range and undergraduate levels with persistent IDs', async () => {
    expect(await seedStudentReferenceData()).toEqual({ sessionsCreated: 65, levelsCreated: 6, semestersCreated: 3 });
    const sessions = await Session.find().sort({ name: 1 });
    expect(sessions).toHaveLength(65);
    expect(sessions[0].name).toBe('1962/1963');
    expect(sessions.at(-1).name).toBe('2026/2027');
    expect(sessions.every((session) => session._id && session.datesAreEstimated && !session.isCurrent && session.endDate > session.startDate)).toBe(true);
    expect((await Level.find().sort({ order: 1 })).map((level) => level.name)).toEqual(['100', '200', '300', '400', '500', '600']);
    expect((await Semester.find().sort({ order: 1 })).map((semester) => semester.name)).toEqual(['Harmattan', 'Rain', 'Long Vacation']);
  });

  it('can be repeated without changing administrator records, current session, or IDs', async () => {
    const existing = await Session.create({ name: '2025/2026', startDate: '2025-10-11', endDate: '2026-08-31', isCurrent: true });
    const level = await Level.create({ name: '100', order: 1 });
    expect(await seedStudentReferenceData()).toEqual({ sessionsCreated: 64, levelsCreated: 5, semestersCreated: 3 });
    expect(await seedStudentReferenceData()).toEqual({ sessionsCreated: 0, levelsCreated: 0, semestersCreated: 0 });
    expect((await Session.findById(existing._id)).toObject()).toEqual(existing.toObject());
    expect((await Level.findById(level._id)).toObject()).toEqual(level.toObject());
  });
});
