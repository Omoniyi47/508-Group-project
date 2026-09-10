import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { notificationApi } from '../../api/notificationApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { Pagination } from '../../components/common/Pagination';

const TYPE_OPTIONS = [
  { value: 'result_submitted', label: 'Approval needed' },
  { value: 'result_rejected', label: 'Rejected result' },
  { value: 'duplicate_detected', label: 'Duplicate student' },
  { value: 'curriculum_incomplete', label: 'Incomplete curriculum' },
  { value: 'transcript_approved', label: 'Transcript ready' },
  { value: 'transcript_requested', label: 'Transcript verification' },
  { value: 'transcript_verified', label: 'Transcript approval' },
  { value: 'transcript_rejected', label: 'Rejected transcript' },
  { value: 'result_approved', label: 'Approved result' },
];

function relativeTime(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, unread: 0 });
  const [filters, setFilters] = useState({ type: '', read: '' });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const response = await notificationApi.list({ page, limit: 20, ...filters });
      setItems(response.data.data);
      setMeta(response.data.meta);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openItem = async (item) => {
    try {
      if (!item.readAt) await notificationApi.markRead(item._id);
      if (item.link) navigate(item.link);
      else load();
    } catch {
      toast.error('Unable to update this notification');
    }
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      toast.success('Notifications marked as read');
      load();
    } catch {
      toast.error('Unable to mark notifications as read');
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications Centre"
        description="Role-specific workflow alerts and record-management reminders."
        actions={<Button variant="secondary" onClick={markAllRead} disabled={meta.unread === 0}>Mark all read ({meta.unread})</Button>}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate/15 bg-white p-4 sm:grid-cols-2">
        <Select label="Notification type" placeholder="All workflow alerts" options={TYPE_OPTIONS} value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} />
        <Select label="Read status" placeholder="All notifications" options={[{ value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }]} value={filters.read} onChange={(event) => updateFilter('read', event.target.value)} />
      </div>
      <section className="overflow-hidden rounded-xl border border-slate/15 bg-white">
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : items.length === 0 ? <EmptyState title="No matching notifications" description="You are up to date for this filter." /> : (
          <ul className="divide-y divide-slate/10">
            {items.map((item) => (
              <li key={item._id}>
                <button type="button" onClick={() => openItem(item)} className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-off-white ${item.readAt ? 'bg-white' : 'bg-indigo/5'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-navy">{item.title}</span>
                    <span className="mt-1 block text-sm text-slate">{item.message}</span>
                    <span className="mt-1.5 block text-xs font-medium capitalize text-indigo">{item.type.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate">{relativeTime(item.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
      </section>
    </div>
  );
}
