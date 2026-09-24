import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentsPage from './StudentsPage';
import { studentApi } from '../../api/studentApi';
import { departmentApi } from '../../api/departmentApi';
import { sessionApi } from '../../api/sessionApi';
import { levelApi } from '../../api/levelApi';
import { useAuth } from '../../context/useAuth';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../../context/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/studentApi', () => ({ studentApi: { list: vi.fn(), create: vi.fn() } }));
vi.mock('../../api/departmentApi', () => ({ departmentApi: { list: vi.fn() } }));
vi.mock('../../api/sessionApi', () => ({ sessionApi: { list: vi.fn() } }));
vi.mock('../../api/levelApi', () => ({ levelApi: { list: vi.fn() } }));

const response = (data, meta = {}) => ({ data: { data, meta } });

const science = { _id: 'fac-science', name: 'Science' };
const csc = { _id: 'dept-csc', name: 'Computer Science', faculty: science };
const session2024 = { _id: 'sess-2024', name: '2023/2024' };
const level100 = { _id: 'level-100', name: '100' };

function mockLookups() {
  departmentApi.list.mockResolvedValue(response([csc]));
  sessionApi.list.mockResolvedValue(response([session2024]));
  levelApi.list.mockResolvedValue(response([level100]));
  studentApi.list.mockResolvedValue(response([], { page: 1, totalPages: 1, total: 0 }));
}

describe('StudentsPage create-student dropdowns', () => {
  it('explains missing reference data and reloads selectable sessions and levels without clearing the form', async () => {
    useAuth.mockReturnValue({ hasRole: () => true, user: { _id: 'admin-1', department: null } });
    mockLookups();
    sessionApi.list.mockResolvedValue(response([]));
    levelApi.list.mockResolvedValue(response([]));

    const user = userEvent.setup();
    render(<StudentsPage />);
    await user.click(screen.getByRole('button', { name: '+ New Student' }));
    expect((await screen.findAllByText(/No sessions available. Ask an administrator/))[0]).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Entry session/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^Current level/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(screen.getByLabelText(/^First name/), 'Ada');

    sessionApi.list.mockResolvedValue(response([session2024]));
    levelApi.list.mockResolvedValue(response([level100]));
    await user.click(screen.getByRole('button', { name: 'Reload Entry session' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /^Entry session/ })).toBeEnabled());
    await user.selectOptions(screen.getByRole('combobox', { name: /^Entry session/ }), session2024._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Current level/ }), level100._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Graduation session/ }), session2024._id);
    expect(screen.getByLabelText(/^First name/)).toHaveValue('Ada');
    expect(screen.getByRole('combobox', { name: /^Entry session/ })).toHaveValue(session2024._id);
    expect(screen.getByRole('combobox', { name: /^Current level/ })).toHaveValue(level100._id);
    expect(screen.getByRole('combobox', { name: /^Graduation session/ })).toHaveValue(session2024._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Graduation session/ }), '');
    expect(screen.getByRole('combobox', { name: /^Graduation session/ })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('requires an admin to pick a department before the form can be submitted, instead of relying on a server round-trip', async () => {
    useAuth.mockReturnValue({
      hasRole: () => true, // admin: canManage + canPickDepartment both true
      user: { _id: 'admin-1', department: null },
    });
    mockLookups();

    const user = userEvent.setup();
    render(<StudentsPage />);

    await user.click(await screen.findByRole('button', { name: '+ New Student' }));

    await user.type(screen.getByLabelText(/^Matric number/), 'CSC/2024/001');
    await user.type(screen.getByLabelText(/^First name/), 'Ada');
    await user.type(screen.getByLabelText(/^Last name/), 'Lovelace');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Entry session/ }), session2024._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Current level/ }), level100._id);
    // Deliberately leave Department unselected.

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Department is required')).toBeInTheDocument();
    expect(studentApi.create).not.toHaveBeenCalled();
  });

  it('lets an admin submit once a department is picked', async () => {
    useAuth.mockReturnValue({
      hasRole: () => true,
      user: { _id: 'admin-1', department: null },
    });
    mockLookups();
    studentApi.create.mockResolvedValue({ data: { data: { _id: 'new-1' }, meta: {} } });

    const user = userEvent.setup();
    render(<StudentsPage />);

    await user.click(await screen.findByRole('button', { name: '+ New Student' }));

    await user.type(screen.getByLabelText(/^Matric number/), 'CSC/2024/002');
    await user.type(screen.getByLabelText(/^First name/), 'Grace');
    await user.type(screen.getByLabelText(/^Last name/), 'Hopper');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Department/ }), csc._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Entry session/ }), session2024._id);
    await user.selectOptions(screen.getByRole('combobox', { name: /^Current level/ }), level100._id);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(studentApi.create).toHaveBeenCalledWith(expect.objectContaining({ department: csc._id }));
  });
});
