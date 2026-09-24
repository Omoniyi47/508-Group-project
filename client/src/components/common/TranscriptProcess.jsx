import { TRANSCRIPT_PROCESS_STEPS, transcriptProcessStage } from '../../constants/transcript';

export function TranscriptProcess({ request }) {
  if (!request) return null;
  const stage = transcriptProcessStage(request);
  const current = TRANSCRIPT_PROCESS_STEPS.findIndex((step) => step.value === stage);
  const dates = [request.createdAt, request.verifiedAt, request.generatedAt || request.releasedAt];
  const descriptions = ['The application has been received.', 'Records are being verified and the transcript is awaiting approval or generation.', 'The official transcript has been generated. Retrieval is tracked separately below.'];
  return <section className="my-5" aria-label="Transcript process">
    <h3 className="mb-3 font-semibold text-navy">Transcript Process</h3>
    <ol className="grid gap-4 sm:grid-cols-3">
      {TRANSCRIPT_PROCESS_STEPS.map((step, index) => <li key={step.value} aria-current={current === index ? 'step' : undefined} className={`rounded-lg border p-4 ${index <= current ? 'border-teal/40 bg-teal/5' : 'border-slate/15'}`}>
        <p className="font-medium text-navy">{index + 1}. {step.label}</p>
        <p className="mt-2 text-sm text-slate">{descriptions[index]}</p>
        {dates[index] && <p className="mt-2 text-xs text-slate">{new Date(dates[index]).toLocaleString()}</p>}
      </li>)}
    </ol>
    {stage === 'rejected' && <p className="mt-3 text-sm text-danger">Application needs attention: {request.rejectionReason || 'Review the application before submitting again.'}</p>}
  </section>;
}
