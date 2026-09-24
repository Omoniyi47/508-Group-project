import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TranscriptCollectionPage from './TranscriptCollectionPage';
import { transcriptApi } from '../../api/transcriptApi';
import { studentApi } from '../../api/studentApi';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../context/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/studentApi', () => ({ studentApi: { list: vi.fn(), getById: vi.fn() } }));
vi.mock('../../api/transcriptApi', () => ({ transcriptApi: {
  createRequest: vi.fn(), getRequest: vi.fn(), collectRequest: vi.fn(), downloadPdf: vi.fn(), downloadExcel: vi.fn(), verifyRequest: vi.fn(), approveRequest: vi.fn(),
} }));

const student = { _id: 'student-1', firstName: 'Ada', lastName: 'Lovelace', matricNumber: 'CSC/2024/001', department: { name: 'Computer Science' }, entrySession: { name: '2024/2025' }, currentLevel: { name: '200' }, modeOfEntry: 'direct_entry' };
const response = (data) => ({ data: { data } });
const approved = { _id: 'request-1', student, retrievalMethod: 'manual', status: 'approved', createdAt: '2026-01-01', verifiedAt: '2026-01-02', approvedAt: '2026-01-03' };
const renderPage = (url = '/transcript-collection') => render(<MemoryRouter initialEntries={[url]}><TranscriptCollectionPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ hasRole: (...roles) => roles.includes(ROLES.TRANSCRIPT_OFFICER) });
  studentApi.list.mockResolvedValue(response([student]));
  studentApi.getById.mockResolvedValue(response(student));
  transcriptApi.getRequest.mockResolvedValue(response(approved));
});

describe('Guided transcript retrieval', () => {
  it.each(['manual', 'online'])('reviews student details and submits the %s retrieval choice', async (method) => {
    const user = userEvent.setup();
    transcriptApi.createRequest.mockResolvedValue(response({ _id: 'request-1' }));
    transcriptApi.getRequest.mockResolvedValue(response({ ...approved, retrievalMethod: method, status: 'requested', verifiedAt: null, approvedAt: null }));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Continue to retrieval method' })).toBeDisabled();
    await user.click(screen.getByLabelText(/^Student/));
    await user.click(await screen.findByRole('button', { name: /Ada Lovelace/ }));
    expect(screen.getByText('Direct entry')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to retrieval method' }));
    await user.click(screen.getByRole('radio', { name: new RegExp(method === 'manual' ? 'Manual retrieval' : 'Online retrieval') }));
    await user.type(screen.getByLabelText('Purpose (optional)'), 'Postgraduate admission');
    await user.click(screen.getByRole('button', { name: 'Review request' }));
    expect(transcriptApi.createRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Submit transcript request' }));
    await waitFor(() => expect(transcriptApi.createRequest).toHaveBeenCalledWith(student._id, 'Postgraduate admission', method));
    expect(await screen.findByText('Request progress')).toBeInTheDocument();
  });

  it('requires collector details and explicit handover before confirming physical collection', async () => {
    const user = userEvent.setup();
    renderPage('/transcript-collection?request=request-1');
    const confirm = await screen.findByRole('button', { name: 'Confirm collection' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Collector’s full name/), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/Collection receipt/), 'REC-001');
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    transcriptApi.collectRequest.mockResolvedValue(response({}));
    transcriptApi.getRequest.mockResolvedValue(response({ ...approved, status: 'released', releasedAt: '2026-01-04', collectedByName: 'Ada Lovelace', collectionReference: 'REC-001' }));
    await user.click(confirm);
    await waitFor(() => expect(transcriptApi.collectRequest).toHaveBeenCalledWith('request-1', { collectedByName: 'Ada Lovelace', collectionReference: 'REC-001' }));
    expect(await screen.findByText(/Collected by Ada Lovelace/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm collection' })).not.toBeInTheDocument();
  });

  it('shows download failure without claiming release or handover', async () => {
    const user = userEvent.setup();
    transcriptApi.getRequest.mockResolvedValue(response({ ...approved, retrievalMethod: 'online' }));
    transcriptApi.downloadPdf.mockRejectedValue(new Error('Network unavailable'));
    renderPage('/transcript-collection?request=request-1');
    await user.click(await screen.findByRole('button', { name: 'Download official PDF' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(transcriptApi.collectRequest).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm collection' })).not.toBeInTheDocument();
  });

  it('does not offer physical handover to a HOD', async () => {
    useAuth.mockReturnValue({ hasRole: (...roles) => roles.includes(ROLES.HOD) });
    renderPage('/transcript-collection?request=request-1');
    expect(await screen.findByText('Request progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm collection' })).not.toBeInTheDocument();
  });
});
