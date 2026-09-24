// OAU 5-point grading scale. The grade bands below are not a guess: every one
// of the 873 graded rows parsed from the six uploaded OAU master-marks-sheet
// exports (score, letter grade, and grade point all printed on the source
// documents) is consistent with exactly these boundaries -- zero mismatches
// across F/E/D/C/B/A.
//
// The classification bands are the standard published 5-point CGPA
// classification scale (First Class / Second Class Upper / Second Class Lower
// / Third Class / Pass). No classification label appears anywhere in the
// uploaded source files, so unlike the grade bands, these cutoffs are NOT
// verified against your data -- confirm/adjust them from Grading Rules in the
// admin UI if OAU's registrar uses different CGPA cutoffs.
export const OAU_GRADING_RULE = {
  name: 'OAU 5-Point Scale',
  isActive: true,
  gradeBands: [
    { grade: 'F', minScore: 0, maxScore: 39, point: 0 },
    { grade: 'E', minScore: 40, maxScore: 44, point: 1 },
    { grade: 'D', minScore: 45, maxScore: 49, point: 2 },
    { grade: 'C', minScore: 50, maxScore: 59, point: 3 },
    { grade: 'B', minScore: 60, maxScore: 69, point: 4 },
    { grade: 'A', minScore: 70, maxScore: 100, point: 5 },
  ],
  classificationBands: [
    { classification: 'First Class', minCgpa: 4.5, maxCgpa: 5.0 },
    { classification: 'Second Class (Upper Division)', minCgpa: 3.5, maxCgpa: 4.49 },
    { classification: 'Second Class (Lower Division)', minCgpa: 2.4, maxCgpa: 3.49 },
    { classification: 'Third Class', minCgpa: 1.5, maxCgpa: 2.39 },
    { classification: 'Pass', minCgpa: 1.0, maxCgpa: 1.49 },
  ],
};

export async function seedGradingRule() {
  const { GradingRule } = await import('../models/GradingRule.js');
  const existingActive = await GradingRule.findOne({ isActive: true });
  if (existingActive) return { created: false, reason: `"${existingActive.name}" is already active; left untouched` };

  const existingByName = await GradingRule.findOne({ name: OAU_GRADING_RULE.name });
  if (existingByName) {
    existingByName.isActive = true;
    await existingByName.save();
    return { created: false, activated: true, id: existingByName._id };
  }

  const rule = await GradingRule.create(OAU_GRADING_RULE);
  return { created: true, activated: true, id: rule._id };
}
