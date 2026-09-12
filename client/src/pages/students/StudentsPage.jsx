import { useEffect, useState } from 'react';
import { loadDropdownOptions } from '../../api/dropdownOptions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { studentApi } from '../../api/studentApi';
import { departmentApi } from '../../api/departmentApi';
import { sessionApi } from '../../api/sessionApi';
import { levelApi } from '../../api/levelApi';
import { studentSchema } from '../../validators/studentValidators';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Spinner } from '../../components/common/Spinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CourseCurriculumPreview } from '../../components/common/CourseCurriculumPreview';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'suspended', label: 'Suspended' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

function StudentFormModal({ open, onClose, editingStudent, lookups, canPickDepartment, defaultDepartmentId, onSaved }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(studentSchema) });

  useEffect(() => {
    if (!open) return;
    if (editingStudent) {
      reset({
        matricNumber: editingStudent.matricNumber,
        regNumber: editingStudent.regNumber || '',
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        otherNames: editingStudent.otherNames || '',
        gender: editingStudent.gender || '',
        dateOfBirth: editingStudent.dateOfBirth ? editingStudent.dateOfBirth.slice(0, 10) : '',
        department: editingStudent.department?._id || '',
        entrySession: editingStudent.entrySession?._id || '',
        currentLevel: editingStudent.currentLevel?._id || '',
        graduationSession: editingStudent.graduationSession?._id || '',
        status: editingStudent.status,
        contactEmail: editingStudent.contactEmail || '',
        contactPhone: editingStudent.contactPhone || '',
      });
    } else {
      reset({
        matricNumber: '',
        regNumber: '',
        firstName: '',
        lastName: '',
        otherNames: '',
        gender: '',
        dateOfBirth: '',
        department: defaultDepartmentId || '',
        entrySession: '',
        currentLevel: '',
        graduationSession: '',
        status: 'active',
        contactEmail: '',
        contactPhone: '',
      });
    }
  }, [open, editingStudent, reset, defaultDepartmentId]);

  const selectedDepartment = watch('department');
  const selectedLevel = watch('currentLevel');
  const selectedDepartmentRecord = lookups.departmentRecords.find((department) => String(department._id) === String(selectedDepartment));

  const onSubmit = async (values) => {
    const payload = { ...values };
    for (const key of ['regNumber', 'otherNames', 'gender', 'dateOfBirth', 'department', 'graduationSession', 'contactEmail', 'contactPhone']) {
      if (payload[key] === '') payload[key] = null;
    }

    try {
      if (editingStudent) {
        await studentApi.update(editingStudent._id, payload);
        toast.success('Student updated');
      } else {
        const res = await studentApi.create(payload);
        if (res.data.meta?.duplicatesFlagged > 0) {
          toast.warning('Student created, but flagged for duplicate review');
        } else {
          toast.success('Student created');
        }
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editingStudent ? 'Edit Student' : 'New Student'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Matric number" required error={errors.matricNumber?.message} {...register('matricNumber')} />
        <Input label="Registration number (optional)" error={errors.regNumber?.message} {...register('regNumber')} />
        <Input label="First name" required error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
        <Input label="Other names" error={errors.otherNames?.message} {...register('otherNames')} />
        <Select label="Gender" options={GENDER_OPTIONS} error={errors.gender?.message} {...register('gender')} />
        <Input label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
        {canPickDepartment ? (
          <Select
            label="Department"
            options={lookups.departments}
            error={errors.department?.message}
            {...register('department')}
          />
        ) : (
          <>
            <input type="hidden" {...register('department')} />
            <Input label="Department (assigned to your account)" value={selectedDepartmentRecord?.name || 'Assigned department'} readOnly disabled />
          </>
        )}
        <Input label="Faculty" value={selectedDepartmentRecord?.faculty?.name || 'Linked automatically from department'} readOnly disabled />
        <Select label="Entry session" required options={lookups.sessions} error={errors.entrySession?.message} {...register('entrySession')} />
        <Select label="Current level" required options={lookups.levels} error={errors.currentLevel?.message} {...register('currentLevel')} />
        <Select label="Graduation session" options={lookups.sessions} error={errors.graduationSession?.message} {...register('graduationSession')} />
        <Select label="Status" options={STATUS_OPTIONS} error={errors.status?.message} {...register('status')} />
        <Input label="Contact email" type="email" error={errors.contactEmail?.message} {...register('contactEmail')} />
        <Input label="Contact phone" error={errors.contactPhone?.message} {...register('contactPhone')} />
        <CourseCurriculumPreview departmentId={selectedDepartment} levelId={selectedLevel} />
      </form>
    </Modal>
  );
}

export default function StudentsPage() {
  const { hasRole, user } = useAuth();
  const canManage = hasRole(ROLES.ADMIN, ROLES.RESULT_OFFICER);
  const canPickDepartment = hasRole(ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER);
  const canDelete = hasRole(ROLES.ADMIN);

  const [students, setStudents] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [lookups, setLookups] = useState({ departments: [], departmentRecords: [], sessions: [], levels: [] });

  const [filters, setFilters] = useState({ matric: '', name: '', department: '', entryYear: '', graduationYear: '', status: '' });
  const debouncedFilters = useDebouncedValue(filters, 350);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    Promise.all([loadDropdownOptions(departmentApi), loadDropdownOptions(sessionApi), loadDropdownOptions(levelApi)]).then(
      ([deptRes, sessionRes, levelRes]) => {
        setLookups({
          departments: deptRes.data.data.map((d) => ({ value: d._id, label: `${d.name}${d.faculty?.name ? ` — ${d.faculty.name}` : ''}` })),
          departmentRecords: deptRes.data.data,
          sessions: sessionRes.data.data.map((s) => ({ value: s._id, label: s.name })),
          levels: levelRes.data.data.map((l) => ({ value: l._id, label: l.name })),
        });
      }
    );
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit: 10 };
      if (debouncedFilters.matric) params.matric = debouncedFilters.matric;
      if (debouncedFilters.name) params.name = debouncedFilters.name;
      if (debouncedFilters.department) params.department = debouncedFilters.department;
      if (debouncedFilters.entryYear) params.entryYear = debouncedFilters.entryYear;
      if (debouncedFilters.graduationYear) params.graduationYear = debouncedFilters.graduationYear;
      if (debouncedFilters.status) params.status = debouncedFilters.status;

      const res = await studentApi.list(params);
      setStudents(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedFilters]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await studentApi.remove(deletingStudent._id);
      toast.success('Student deleted');
      setDeletingStudent(null);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete student');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Students"
        description="Search and manage student records."
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditingStudent(null);
                setFormOpen(true);
              }}
            >
              + New Student
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate/15 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Matric number" value={filters.matric} onChange={(e) => updateFilter('matric', e.target.value)} aria-label="Search by matric number" />
        <Input placeholder="Full name" value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} aria-label="Search by name" />
        {canPickDepartment && (
          <Select
            placeholder="All departments"
            options={lookups.departments}
            value={filters.department}
            onChange={(e) => updateFilter('department', e.target.value)}
            aria-label="Filter by department"
          />
        )}
        <Input placeholder="Entry year (e.g. 2020)" value={filters.entryYear} onChange={(e) => updateFilter('entryYear', e.target.value)} aria-label="Filter by entry year" />
        <Input placeholder="Graduation year" value={filters.graduationYear} onChange={(e) => updateFilter('graduationYear', e.target.value)} aria-label="Filter by graduation year" />
        <Select
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          aria-label="Filter by status"
        />
      </div>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState title="No students found" description="Try adjusting your search filters." />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'faculty', label: 'Faculty', render: (row) => row.department?.faculty?.name || 'Faculty not assigned' },
                { key: 'matricNumber', label: 'Matric No.' },
                { key: 'fullName', label: 'Name', render: (row) => `${row.firstName} ${row.lastName}` },
                { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
                { key: 'currentLevel', label: 'Level', render: (row) => row.currentLevel?.name || '—' },
                { key: 'entrySession', label: 'Entry Session', render: (row) => row.entrySession?.name || '—' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <span className="rounded-full bg-slate/10 px-2 py-0.5 text-xs font-medium capitalize text-navy">{row.status}</span>
                  ),
                },
              ]}
              rows={students}
              actions={(row) => (
                <div className="flex justify-end gap-2">
                  <Link to={`/transcripts/${row._id}`} className="text-sm font-medium text-indigo hover:underline">
                    Transcript
                  </Link>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingStudent(row);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeletingStudent(row)}>
                      Delete
                    </Button>
                  )}
                </div>
              )}
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingStudent={editingStudent}
        lookups={lookups}
        canPickDepartment={canPickDepartment}
        defaultDepartmentId={user?.department?._id || user?.department || ''}
        onSaved={() => {
          setFormOpen(false);
          loadStudents();
        }}
      />

      <ConfirmDialog
        open={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Delete Student"
        message={deletingStudent ? `Are you sure you want to delete ${deletingStudent.firstName} ${deletingStudent.lastName}? This cannot be undone.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
