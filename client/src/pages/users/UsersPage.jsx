import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { userApi } from '../../api/userApi';
import { departmentApi } from '../../api/departmentApi';
import { facultyApi } from '../../api/facultyApi';
import { userCreateSchema, userUpdateSchema, resetPasswordSchema } from '../../validators/userValidators';
import { ROLES, ROLE_LABELS } from '../../constants/roles';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Checkbox } from '../../components/common/Checkbox';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Spinner } from '../../components/common/Spinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const ROLE_OPTIONS = Object.values(ROLES).map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const DEPARTMENT_SCOPED_ROLES = [ROLES.RESULT_OFFICER, ROLES.HOD];

function UserFormModal({ open, onClose, editingUser, faculties, departments, onSaved }) {
  const schema = editingUser ? userUpdateSchema : userCreateSchema;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const role = watch('role');
  const needsDepartment = DEPARTMENT_SCOPED_ROLES.includes(role);
  const [facultyId, setFacultyId] = useState('');
  const availableDepartments = facultyId ? departments.filter((department) => department.faculty?._id === facultyId) : [];

  const [duplicateWarning, setDuplicateWarning] = useState(null); // { matches, pendingValues }
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDuplicateWarning(null);
    if (editingUser) {
      const assignedDepartment = departments.find((department) => department._id === editingUser.department?._id);
      setFacultyId(assignedDepartment?.faculty?._id || '');
      reset({
        name: editingUser.name,
        role: editingUser.role,
        department: editingUser.department?._id || '',
        isActive: editingUser.isActive,
      });
    } else {
      setFacultyId('');
      reset({ name: '', email: '', password: '', role: '', department: '' });
    }
  }, [open, editingUser, departments, reset]);

  const submitCreate = async (payload) => {
    try {
      await userApi.create(payload);
      toast.success('User created');
      onSaved();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.duplicates) {
        setDuplicateWarning({ matches: err.response.data.duplicates, pendingValues: payload });
      } else {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
    }
  };

  const onSubmit = async (values) => {
    const payload = { ...values, department: needsDepartment ? values.department : null };
    if (editingUser) {
      try {
        await userApi.update(editingUser._id, payload);
        toast.success('User updated');
        onSaved();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
      return;
    }
    await submitCreate(payload);
  };

  const handleConfirmDuplicate = async () => {
    setConfirming(true);
    try {
      await submitCreate({ ...duplicateWarning.pendingValues, confirmDuplicate: true });
    } finally {
      setConfirming(false);
    }
  };

  if (duplicateWarning) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Possible duplicate account"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateWarning(null)}>
              Go back and edit
            </Button>
            <Button variant="danger" isLoading={confirming} onClick={handleConfirmDuplicate}>
              Yes, create anyway
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate">
          The following existing user(s) have a very similar name to <strong>{duplicateWarning.pendingValues.name}</strong>. Confirm this is a
          different person before proceeding.
        </p>
        <ul className="flex flex-col gap-2">
          {duplicateWarning.matches.map((m) => (
            <li key={m.id} className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
              <p className="font-medium text-navy">{m.name}</p>
              <p className="text-slate">
                {m.email} &middot; {ROLE_LABELS[m.role] || m.role} &middot; {m.isActive ? 'Active' : 'Inactive'}
              </p>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingUser ? 'Edit User' : 'New User'}
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Full name" required error={errors.name?.message} {...register('name')} />
        {!editingUser && (
          <>
            <Input label="Email address" type="email" required error={errors.email?.message} {...register('email')} />
            <Input label="Initial password" type="password" required error={errors.password?.message} {...register('password')} />
          </>
        )}
        <Select label="Role" required options={ROLE_OPTIONS} error={errors.role?.message} {...register('role')} />
        {needsDepartment && (
          <>
            <Select
              label="Faculty"
              required
              value={facultyId}
              onChange={(event) => {
                setFacultyId(event.target.value);
                reset({ ...watch(), department: '' });
              }}
              options={faculties.map((faculty) => ({ value: faculty._id, label: faculty.name }))}
              placeholder="Select faculty first..."
            />
            <Select
              label="Department"
              required
              disabled={!facultyId}
              error={errors.department?.message}
              options={availableDepartments.map((department) => ({ value: department._id, label: department.name }))}
              placeholder={facultyId ? 'Select department...' : 'Choose a faculty first...'}
              {...register('department')}
            />
          </>
        )}
        {editingUser && <Checkbox label="Account active" {...register('isActive')} />}
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ open, onClose, user, onDone }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    if (open) reset({ newPassword: '' });
  }, [open, reset]);

  const onSubmit = async (values) => {
    try {
      await userApi.resetPassword(user._id, values.newPassword);
      toast.success(`Password reset for ${user.name}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reset password');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reset password for ${user?.name || ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Reset password
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input label="New password" type="password" required error={errors.newPassword?.message} {...register('newPassword')} />
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [deactivatingUser, setDeactivatingUser] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await userApi.list({ page, limit: 10, search: debouncedSearch || undefined });
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([facultyApi.list({ limit: 50 }), departmentApi.list({ limit: 200 })]).then(([facultyRes, departmentRes]) => {
      setFaculties(facultyRes.data.data);
      setDepartments(departmentRes.data.data);
    });
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const toggleActive = async (user) => {
    try {
      await userApi.update(user._id, { name: user.name, role: user.role, department: user.department?._id, isActive: !user.isActive });
      toast.success(user.isActive ? `${user.name} deactivated` : `${user.name} activated`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update user');
    }
  };

  const confirmDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await toggleActive(deactivatingUser);
      setDeactivatingUser(null);
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage staff accounts and role assignments."
        actions={
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
          >
            + New User
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          aria-label="Search users"
        />
      </div>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role', render: (row) => ROLE_LABELS[row.role] || row.role },
                {
                  key: 'faculty',
                  label: 'Faculty',
                  render: (row) => departments.find((department) => department._id === row.department?._id)?.faculty?.name || '—',
                },
                { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (row) => (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isActive ? 'bg-success text-navy' : 'bg-danger text-white'
                      }`}
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  ),
                },
              ]}
              rows={users}
              actions={(row) => (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingUser(row);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setResettingUser(row)}>
                    Reset password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={row.isActive ? 'text-danger' : 'text-success'}
                    onClick={() => (row.isActive ? setDeactivatingUser(row) : toggleActive(row))}
                  >
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingUser={editingUser}
        faculties={faculties}
        departments={departments}
        onSaved={() => {
          setFormOpen(false);
          loadUsers();
        }}
      />

      <ResetPasswordModal
        open={!!resettingUser}
        onClose={() => setResettingUser(null)}
        user={resettingUser}
        onDone={() => setResettingUser(null)}
      />

      <ConfirmDialog
        open={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={confirmDeactivate}
        isLoading={isDeactivating}
        title="Deactivate user"
        message={deactivatingUser ? `Deactivate ${deactivatingUser.name}? They will immediately lose the ability to sign in. You can reactivate this account at any time.` : ''}
        confirmLabel="Deactivate"
      />
    </div>
  );
}
