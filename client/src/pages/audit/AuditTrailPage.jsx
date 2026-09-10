import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { auditLogApi } from '../../api/auditLogApi';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../constants/auditLog';
import { PageHeader } from '../../components/common/PageHeader';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { Modal } from '../../components/common/Modal';

const ACTION_OPTIONS = AUDIT_ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, ' ') }));
const MODULE_OPTIONS = AUDIT_MODULES.map((m) => ({ value: m, label: m }));

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ module: '', action: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState({ module: '', action: '', from: '', to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [detailsLog, setDetailsLog] = useState(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit: 20 };
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value) params[key] = value;
      }
      const res = await auditLogApi.list(params);
      setLogs(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const clearedFilters = { module: '', action: '', from: '', to: '' };
    setFilters(clearedFilters);
    setPage(1);
    setAppliedFilters(clearedFilters);
  };

  return (
    <div>
      <PageHeader title="Audit Trail" description="Immutable record of every sensitive change made in the system." />

      <form onSubmit={applyFilters} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate/15 bg-white p-4 sm:grid-cols-4">
        <Select
          name="module"
          label="Module"
          placeholder="All modules"
          options={MODULE_OPTIONS}
          value={filters.module}
          onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value }))}
        />
        <Select
          name="action"
          label="Action"
          placeholder="All actions"
          options={ACTION_OPTIONS}
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
        />
        <Input
          label="From"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        <div className="col-span-2 flex gap-2 sm:col-span-4">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No matching audit entries" />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'createdAt', label: 'Timestamp', render: (row) => new Date(row.createdAt).toLocaleString() },
                {
                  key: 'actor',
                  label: 'Actor',
                  render: (row) => row.actor?.name || row.actorEmail || 'System',
                },
                { key: 'action', label: 'Action', render: (row) => row.action.replace(/_/g, ' ') },
                { key: 'module', label: 'Module' },
                { key: 'ipAddress', label: 'IP Address', render: (row) => row.ipAddress || '—' },
              ]}
              rows={logs}
              actions={(row) => (
                <Button variant="ghost" size="sm" onClick={() => setDetailsLog(row)}>
                  View details
                </Button>
              )}
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!detailsLog} onClose={() => setDetailsLog(null)} title="Audit Entry Details" size="lg">
        {detailsLog && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate">Actor</p>
                <p className="text-navy">
                  {detailsLog.actor?.name || detailsLog.actorEmail || 'System'} ({detailsLog.actorRole || 'n/a'})
                </p>
              </div>
              <div>
                <p className="text-xs text-slate">Timestamp</p>
                <p className="text-navy">{new Date(detailsLog.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate">Action / Module</p>
                <p className="text-navy">
                  {detailsLog.action.replace(/_/g, ' ')} &middot; {detailsLog.module}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate">IP Address / User Agent</p>
                <p className="truncate text-navy" title={detailsLog.userAgent}>
                  {detailsLog.ipAddress || '—'}
                </p>
              </div>
              {detailsLog.reason && (
                <div className="col-span-2">
                  <p className="text-xs text-slate">Reason</p>
                  <p className="text-navy">{detailsLog.reason}</p>
                </div>
              )}
            </div>

            {detailsLog.oldValue && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate">Old value</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-off-white p-3 text-xs">{JSON.stringify(detailsLog.oldValue, null, 2)}</pre>
              </div>
            )}
            {detailsLog.newValue && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate">New value</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-off-white p-3 text-xs">{JSON.stringify(detailsLog.newValue, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
