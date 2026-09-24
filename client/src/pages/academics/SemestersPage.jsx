import { PageHeader } from '../../components/common/PageHeader';

export default function SemestersPage() {
  return <div>
    <PageHeader title="Semesters" description="Every academic session has two semesters." />
    <ol className="grid gap-4 sm:grid-cols-2">
      {['Harmattan', 'Rain'].map((name, index) => <li key={name} className="rounded-xl border border-slate/15 bg-white p-6"><p className="text-sm text-slate">Semester {index + 1}</p><h2 className="mt-2 text-lg font-semibold text-navy">{name}</h2></li>)}
    </ol>
  </div>;
}
