import { Semester } from '../models/Semester.js';
import { ApiError } from '../utils/ApiError.js';

export async function assertAcademicSemester(id) {
  const semester = await Semester.findById(id);
  if (!semester) throw ApiError.notFound('Semester not found');
  if (!['Harmattan', 'Rain'].includes(semester.name)) {
    throw ApiError.badRequest('Choose Harmattan or Rain for new academic records');
  }
  return semester;
}
