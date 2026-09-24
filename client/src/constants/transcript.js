export const retrievalLabel = (method) => method === 'manual' ? 'Manual — collect in person' : 'Online — download';

export const TRANSCRIPT_PROCESS_STEPS = [
  { value: 'received', label: 'Application Received' },
  { value: 'in_progress', label: 'Application in Progress' },
  { value: 'generated', label: 'Transcript Generated' },
];

export function transcriptProcessStage(request) {
  if (!request) return null;
  if (request.status === 'rejected') return 'rejected';
  if (request.generatedAt || request.status === 'released') return 'generated';
  return request.status === 'requested' ? 'received' : 'in_progress';
}

export function transcriptProcessLabel(request) {
  return TRANSCRIPT_PROCESS_STEPS.find((step) => step.value === transcriptProcessStage(request))?.label || 'Application needs attention';
}
