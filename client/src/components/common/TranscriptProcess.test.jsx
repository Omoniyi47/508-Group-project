import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptProcess } from './TranscriptProcess';
import { transcriptProcessStage } from '../../constants/transcript';

describe('Three-stage transcript process', () => {
  it.each([
    [{ status: 'requested' }, 'received'],
    [{ status: 'verified' }, 'in_progress'],
    [{ status: 'approved' }, 'in_progress'],
    [{ status: 'approved', retrievalMethod: 'manual', generatedAt: '2026-09-24' }, 'generated'],
    [{ status: 'released' }, 'generated'],
    [{ status: 'rejected' }, 'rejected'],
  ])('maps %j to %s without treating approval as document generation', (request, expected) => {
    expect(transcriptProcessStage(request)).toBe(expected);
  });

  it('uses exactly the three requested labels and keeps collection outside the process', () => {
    render(<TranscriptProcess request={{ status: 'approved', generatedAt: '2026-09-24', retrievalMethod: 'manual' }} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Application Received');
    expect(steps[1]).toHaveTextContent('Application in Progress');
    expect(steps[2]).toHaveTextContent('Transcript Generated');
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
  });
});
