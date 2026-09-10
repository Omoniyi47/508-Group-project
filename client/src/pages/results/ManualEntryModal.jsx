import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { resultApi } from '../../api/resultApi';
import { systemSettingApi } from '../../api/systemSettingApi';
import { manualResultSchema } from '../../validators/resultValidators';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { StudentPicker } from '../../components/common/StudentPicker';
import { CoursePicker } from '../../components/common/CoursePicker';

export function ManualEntryModal({ open, onClose, lookups, onSaved }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(manualResultSchema) });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [specialElectiveRequiredUnits, setSpecialElectiveRequiredUnits] = useState(12);
  const [safeguards, setSafeguards] = useState(null);
  const [isCheckingSafeguards, setIsCheckingSafeguards] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const selectedSemester = watch('semester');
  const selectedLevel = watch('level');
  const selectedCourse = watch('course');
  const selectedSession = watch('session');

  useEffect(() => {
    if (open) {
      setSelectedStudent(null);
      setSavedCount(0);
      reset({ student: '', course: '', session: '', semester: '', level: '', score: '' });
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    systemSettingApi
      .get()
      .then((res) => setSpecialElectiveRequiredUnits(res.data.data.specialElectiveRequiredUnits ?? 12))
      .catch(() => setSpecialElectiveRequiredUnits(12));
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedStudent?._id || !selectedSession || !selectedSemester || !selectedLevel) {
      setSafeguards(null);
      return undefined;
    }
    setIsCheckingSafeguards(true);
    resultApi
      .entrySafeguards({ student: selectedStudent._id, session: selectedSession, semester: selectedSemester, level: selectedLevel, course: selectedCourse || undefined })
      .then((res) => {
        if (!cancelled) setSafeguards(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setSafeguards(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSafeguards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudent, selectedSession, selectedSemester, selectedLevel, selectedCourse]);

  const saveResult = async (values, { submitAfter, addNext = false }) => {
    try {
      const res = await resultApi.create(values);
      if (submitAfter) {
        await resultApi.submit(res.data.data._id);
        toast.success('Result saved and submitted for approval');
      } else if (!addNext) {
        toast.success('Result saved as draft');
      }
      if (addNext) {
        setSavedCount((count) => count + 1);
        // Keep the student and session selected, but reopen every mapped part
        // of the programme for the next course rather than locking staff to
        // the previous course's level or semester.
        reset({
          student: values.student,
          course: '',
          session: values.session,
          semester: '',
          level: '',
          score: '',
        });
        toast.success('Result saved. Select the next mapped course for this student.');
        onSaved({ keepOpen: true });
      } else {
        onSaved();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save this result');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Result Entry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" disabled={!!safeguards?.duplicateAttempt} isLoading={isSubmitting} onClick={handleSubmit((v) => saveResult(v, { submitAfter: false, addNext: true }))}>
            Save &amp; add next
          </Button>
          <Button variant="secondary" disabled={!!safeguards?.duplicateAttempt} isLoading={isSubmitting} onClick={handleSubmit((v) => saveResult(v, { submitAfter: false }))}>
            Save as draft
          </Button>
          <Button disabled={!!safeguards?.duplicateAttempt} isLoading={isSubmitting} onClick={handleSubmit((v) => saveResult(v, { submitAfter: true }))}>
            Save &amp; submit
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4">
        <Controller
          name="student"
          control={control}
          render={({ field }) => (
            <StudentPicker
              value={field.value}
              onChange={(id, student) => {
                field.onChange(id);
                setSelectedStudent(student);
                setValue('course', '');
                setValue('level', '');
                setValue('semester', '');
              }}
              error={errors.student?.message}
            />
          )}
        />
        {selectedStudent && (
          <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-2 text-sm text-navy">
            <p className="font-medium">{selectedStudent.department?.name} curriculum is ready to pick from.</p>
            <p className="mt-0.5 text-xs text-slate">
              All active core, required, project, practicum, and elective courses mapped to this programme are available across every level and semester. Selecting a course automatically fills its correct level and semester. Special electives require {specialElectiveRequiredUnits} approved credit units before transcript completion.
            </p>
            {savedCount > 0 && <p className="mt-1 text-xs font-semibold text-teal">{savedCount} result{savedCount === 1 ? '' : 's'} saved in this multi-course entry session.</p>}
          </div>
        )}
        <Controller
          name="course"
          control={control}
          render={({ field }) => (
            <CoursePicker
              value={field.value}
              onChange={(id, course) => {
                field.onChange(id);
                if (course?.semester?._id) setValue('semester', course.semester._id);
                if (course?.level?._id) setValue('level', course.level._id);
              }}
              departmentId={selectedStudent?.department?._id}
              levelId={selectedLevel}
              semesterId={selectedSemester}
              requireDepartmentContext
              error={errors.course?.message}
            />
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Session" required options={lookups.sessions} error={errors.session?.message} {...register('session')} />
          <Select label="Semester" required options={lookups.semesters} error={errors.semester?.message} {...register('semester')} />
          <Select label="Level" required options={lookups.levels} error={errors.level?.message} {...register('level')} />
        </div>
        {(isCheckingSafeguards || safeguards) && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${safeguards?.duplicateAttempt ? 'border-danger/30 bg-danger/5 text-danger' : 'border-slate/15 bg-off-white text-navy'}`} aria-live="polite">
            <p className="font-medium">Result-entry safeguards {isCheckingSafeguards ? 'are checking...' : ''}</p>
            {safeguards && (
              <ul className="mt-1 list-inside list-disc text-xs text-slate">
                <li>{safeguards.enteredCourseCount} of {safeguards.mappedCourseCount} mapped course results entered for this semester.</li>
                <li>{safeguards.missingCoreCourses.length} core course{safeguards.missingCoreCourses.length === 1 ? '' : 's'} still missing{ safeguards.incompleteSemester ? `: ${safeguards.missingCoreCourses.slice(0, 3).map((course) => course.code).join(', ')}${safeguards.missingCoreCourses.length > 3 ? '...' : ''}` : '.'}</li>
                {safeguards.duplicateAttempt && <li className="font-semibold text-danger">Duplicate blocked: this course already has a {safeguards.duplicateAttempt.status} result for the selected session and semester.</li>}
              </ul>
            )}
          </div>
        )}
        <Input label="Score (0-100)" type="number" required error={errors.score?.message} {...register('score')} />
      </form>
    </Modal>
  );
}
