import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './UsersPage';
import { userApi } from '../../api/userApi';
import { facultyApi } from '../../api/facultyApi';
import { departmentApi } from '../../api/departmentApi';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../../api/userApi', () => ({ userApi: { list: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/facultyApi', () => ({ facultyApi: { list: vi.fn() } }));
vi.mock('../../api/departmentApi', () => ({ departmentApi: { list: vi.fn() } }));

const response = (data, meta = {}) => ({ data: { data, meta } });

const science = { _id: 'fac-science', name: 'Science' };
const csc = { _id: 'dept-csc', name: 'Computer Science', faculty: science };
const mth = { _id: 'dept-mth', name: 'Mathematics', faculty: science };

const hodUser = {
  _id: 'user-1',
  name: 'Ada Existing',
  email: 'ada@test.edu',
  role: 'hod',
  department: csc,
  isActive: true,
};

describe('UsersPage edit form department dropdown', () => {
  it('preselects the existing department when editing a department-scoped user for the first time', async () => {
    userApi.list.mockResolvedValue(response([hodUser], { page: 1, totalPages: 1, total: 1 }));
    facultyApi.list.mockResolvedValue(response([science]));
    departmentApi.list.mockResolvedValue(response([csc, mth]));

    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const departmentSelect = await screen.findByRole('combobox', { name: /Department/ });
    expect(departmentSelect).toHaveValue(csc._id);
  });
});
