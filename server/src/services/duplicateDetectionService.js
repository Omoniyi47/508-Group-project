import { Student } from '../models/Student.js';
import { Verification, VERIFICATION_STATUSES } from '../models/Verification.js';
import { normalize } from '../utils/stringSimilarity.js';

function fullName(student) {
  return normalize([student.firstName, student.otherNames, student.lastName].filter(Boolean).join(' '));
}

/**
 * A duplicate identity requires an exact full-name and matric-number match.
 * Department and level are deliberately not identifiers: two students can share either
 * one, but a different matric number means they are different people.
 */
export async function findPotentialDuplicates(candidate) {
  const candidateName = fullName(candidate);
  const candidateMatric = normalize(candidate.matricNumber);
  const others = await Student.find(
    { _id: { $ne: candidate._id }, matricNumber: candidate.matricNumber },
    'firstName otherNames lastName matricNumber'
  );

  const matches = [];
  for (const other of others) {
    if (fullName(other) !== candidateName || normalize(other.matricNumber) !== candidateMatric) continue;
    matches.push({ matchedStudentId: other._id, confidenceScore: 1 });
  }
  return matches;
}

export async function flagPotentialDuplicates(candidate) {
  const matches = await findPotentialDuplicates(candidate);
  const created = [];

  for (const match of matches) {
    const existing = await Verification.findOne({
      status: VERIFICATION_STATUSES.PENDING,
      $or: [
        { student: candidate._id, matchedStudent: match.matchedStudentId },
        { student: match.matchedStudentId, matchedStudent: candidate._id },
      ],
    });
    if (existing) continue;

    const verification = await Verification.create({
      student: candidate._id,
      matchedStudent: match.matchedStudentId,
      confidenceScore: match.confidenceScore,
    });
    created.push(verification);
  }

  return created;
}
