import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

describe('Select availability states', () => {
  it('keeps an optional empty selection usable and explains how to add records', () => {
    render(<Select label="Head of Department" placeholder="No HOD assigned" emptyMessage="Create a HOD account under Users." />);
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.getByRole('option', { name: 'No HOD assigned' })).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Create a HOD account under Users.');
  });

  it('offers retry after a failed required lookup and accepts loaded choices', async () => {
    const retry = vi.fn();
    const { rerender } = render(<Select label="Semester" required loadError="Unable to load semesters." onRetry={retry} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload Semester' }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<Select label="Semester" required options={[{ value: 'harmattan', label: 'Harmattan' }]} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'harmattan');
    expect(screen.getByRole('combobox')).toHaveValue('harmattan');
  });
});
