import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentPicker } from './StudentPicker';
import { CoursePicker } from './CoursePicker';
import { Modal } from './Modal';
import { studentApi } from '../../api/studentApi';
import { courseApi } from '../../api/courseApi';

vi.mock('../../api/studentApi', () => ({ studentApi: { list: vi.fn() } }));
vi.mock('../../api/courseApi', () => ({ courseApi: { list: vi.fn() } }));

const student = { _id: 'student-1', firstName: 'John', lastName: 'Smith', matricNumber: 'CSC/001' };
const course = { _id: 'course-1', code: 'CSC101', title: 'Introduction', creditUnit: 3 };
const response = (items) => ({ data: { data: items, meta: { totalPages: 1 } } });

function PickerForm({ Component, onChange = () => {}, ...props }) {
  const [value, setValue] = useState('');
  return <Modal open onClose={() => {}} title="Choose a record">
    <Component {...props} value={value} onChange={(id, item) => { setValue(id); onChange(id, item); }} />
    <button type="button">Outside picker</button>
  </Modal>;
}

beforeEach(() => {
  vi.clearAllMocks();
  studentApi.list.mockResolvedValue(response([student]));
  courseApi.list.mockResolvedValue(response([course]));
});

describe.each([
  { name: 'Student', Component: StudentPicker, api: studentApi, record: student, option: /John Smith/, empty: /No matching students/ },
  { name: 'Course', Component: CoursePicker, api: courseApi, record: course, option: /CSC101 - Introduction/, empty: /No courses match/ },
])('$name dropdown', ({ name, Component, api, record, option, empty }) => {
  it('opens without typing, selects a record, and reopens to change it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickerForm Component={Component} onChange={onChange} />);
    const input = screen.getByLabelText(new RegExp(`^${name}`));
    await user.click(input);
    await user.click(await screen.findByRole('button', { name: option }));
    expect(onChange).toHaveBeenLastCalledWith(record._id, record);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    expect(await screen.findByRole('button', { name: option })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outside picker' }));
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows an empty list message instead of an invisible panel', async () => {
    api.list.mockResolvedValue(response([]));
    const user = userEvent.setup();
    render(<PickerForm Component={Component} />);
    await user.click(screen.getByLabelText(new RegExp(`^${name}`)));
    expect(await screen.findByText(empty)).toBeVisible();
  });

  it('shows loading and request errors, then retries when reopened', async () => {
    let reject;
    api.list.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const user = userEvent.setup();
    render(<PickerForm Component={Component} />);
    const input = screen.getByLabelText(new RegExp(`^${name}`));
    await user.click(input);
    expect(await screen.findByText(new RegExp(`Loading ${name.toLowerCase()}s`))).toBeVisible();
    await act(async () => { reject(new Error('Network unavailable')); });
    expect(await screen.findByText(new RegExp(`Unable to load ${name.toLowerCase()}s`))).toBeVisible();
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    expect(await screen.findByRole('button', { name: option })).toBeVisible();
  });

  it('clears the submitted selection when the user edits its search text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickerForm Component={Component} onChange={onChange} />);
    const input = screen.getByLabelText(new RegExp(`^${name}`));
    await user.click(input);
    await user.click(await screen.findByRole('button', { name: option }));
    await act(async () => { fireEvent.change(input, { target: { value: 'New search' } }); });
    expect(onChange).toHaveBeenLastCalledWith('', null);
    expect(input).toHaveValue('New search');
  });
});

it('searches a single student name as a name, rather than a matric number', async () => {
  const user = userEvent.setup();
  render(<PickerForm Component={StudentPicker} />);
  await user.type(screen.getByLabelText(/^Student/), 'John');
  await waitFor(() => expect(studentApi.list).toHaveBeenLastCalledWith({ name: 'John', limit: 8 }));
});

it('ignores an older student search response after a newer search finishes', async () => {
  let resolveOld;
  studentApi.list.mockImplementation((params) => params.name === 'John'
    ? new Promise((resolve) => { resolveOld = resolve; })
    : Promise.resolve(response([{ ...student, _id: 'student-2', firstName: 'Jane' }])));
  render(<PickerForm Component={StudentPicker} />);
  const input = screen.getByLabelText(/^Student/);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'John' } });
  await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
  fireEvent.change(input, { target: { value: 'Jane' } });
  await waitFor(() => expect(studentApi.list).toHaveBeenLastCalledWith({ name: 'Jane', limit: 8 }));
  await act(async () => { resolveOld(response([student])); });
  await waitFor(() => expect(screen.queryByRole('button', { name: /John Smith/ })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /Jane Smith/ })).toBeVisible();
});

it('explains the required student context before loading programme courses', async () => {
  const user = userEvent.setup();
  render(<PickerForm Component={CoursePicker} requireDepartmentContext />);
  await user.click(screen.getByLabelText(/^Course/));
  expect(screen.getByText(/Select a student first to see/)).toBeVisible();
  expect(courseApi.list).not.toHaveBeenCalled();
});
