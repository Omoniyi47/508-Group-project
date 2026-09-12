import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceCrudPage } from './ResourceCrudPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('academic form dropdowns', () => {
  it('keeps the faculty dropdown selectable when the staff lookup fails', async () => {
    const user = userEvent.setup();
    const response = (data, meta = {}) => ({ data: { data, meta } });
    const api = { list: vi.fn().mockResolvedValue(response([], { totalPages: 1 })), create: vi.fn().mockResolvedValue({}) };
    const faculties = { list: vi.fn().mockResolvedValue(response([{ _id: 'science', name: 'Science' }])) };
    const staff = { list: vi.fn().mockRejectedValue(new Error('Forbidden')) };
    render(<ResourceCrudPage title="Departments" api={api} columns={[]} fields={[
      { name: 'faculty', label: 'Faculty', type: 'select', optionsFrom: { api: faculties } },
      { name: 'hod', label: 'Head of Department', type: 'select', optionsFrom: { api: staff } },
    ]} />);
    await user.click(screen.getByRole('button', { name: '+ New' }));
    const dropdown = screen.getByRole('combobox', { name: 'Faculty' });
    expect(await within(dropdown).findByRole('option', { name: 'Science' })).toBeInTheDocument();
    await user.selectOptions(dropdown, 'science');
    expect(dropdown).toHaveValue('science');
    expect(within(screen.getByRole('combobox', { name: 'Head of Department' })).getByRole('option', { name: 'No options available' })).toBeDisabled();
  });
});
