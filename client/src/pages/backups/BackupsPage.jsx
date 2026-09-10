import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { backupApi } from '../../api/backupApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(1)} ${units[exp]}`;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await backupApi.list({ page, limit: 10 });
      setBackups(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await backupApi.trigger();
      toast.success('Backup created successfully');
      setPage(1);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      await backupApi.download(backup._id, backup.fileName);
    } catch {
      toast.error('Unable to download backup');
    }
  };

  return (
    <div>
      <PageHeader
        title="Backups"
        description="Create and download full data backups of the system."
        actions={
          <Button isLoading={isCreating} onClick={handleCreate}>
            Create Backup
          </Button>
        }
      />

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : backups.length === 0 ? (
          <EmptyState title="No backups yet" description="Create your first backup to see it listed here." />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleString() },
                { key: 'fileName', label: 'File' },
                { key: 'sizeBytes', label: 'Size', render: (row) => formatBytes(row.sizeBytes) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === 'completed' ? 'bg-success text-navy' : 'bg-danger text-white'
                      }`}
                    >
                      {row.status}
                    </span>
                  ),
                },
                { key: 'triggeredBy', label: 'Triggered By', render: (row) => row.triggeredBy?.name || '—' },
              ]}
              rows={backups}
              actions={(row) =>
                row.status === 'completed' && (
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(row)}>
                    Download
                  </Button>
                )
              }
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
