import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '../common/PageHeader';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import { DataTable } from '../common/DataTable';
import { Pagination } from '../common/Pagination';
import { EmptyState } from '../common/EmptyState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { Spinner } from '../common/Spinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { loadDropdownOptions } from '../../api/dropdownOptions';

function FieldInput({ field, register, error, optionsMap }) {
  if (field.type === 'select') {
    return (
      <div>
        <Select
          label={field.label}
          required={field.required}
          error={error}
          options={optionsMap[field.name] || field.options || []}
          {...register(field.name)}
        />
        {field.hint && <p className="mt-1 text-xs text-slate">{field.hint}</p>}
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div>
        <Checkbox label={field.label} {...register(field.name)} />
        {field.hint && <p className="mt-1 text-xs text-slate">{field.hint}</p>}
      </div>
    );
  }
  return (
    <div>
      <Input
        label={field.label}
        type={field.type || 'text'}
        required={field.required}
        error={error}
        {...register(field.name, field.type === 'number' ? { valueAsNumber: true } : undefined)}
      />
      {field.hint && <p className="mt-1 text-xs text-slate">{field.hint}</p>}
    </div>
  );
}

export function ResourceCrudPage({
  title,
  description,
  api,
  columns,
  fields,
  schema,
  searchable = true,
  canManage = true,
  createLabel = '+ New',
  getRowLabel = (row) => row.name || row.code || row._id,
  emptyMessage = 'No records found.',
}) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isLoading, setIsLoading] = useState(true);
  const [optionsMap, setOptionsMap] = useState({});

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectFields = useMemo(() => fields.filter((f) => f.type === 'select' && f.optionsFrom), [fields]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      selectFields.map((f) =>
        loadDropdownOptions(f.optionsFrom.api, f.optionsFrom.params).then((res) => ({
          name: f.name,
          options: res.data.data.map((item) => ({
            value: item._id,
            label: f.optionsFrom.labelKey ? item[f.optionsFrom.labelKey] : item.name,
          })),
        }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      for (const r of results) map[r.name] = r.options;
      setOptionsMap(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const res = await api.list({ page, limit: 10, search: debouncedSearch || undefined });
      setItems(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: schema ? zodResolver(schema) : undefined });

  const openCreateForm = () => {
    setEditingItem(null);
    reset(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'checkbox' ? false : '')])));
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    const values = {};
    for (const f of fields) {
      const raw = item[f.name];
      if (f.type === 'select' && raw && typeof raw === 'object') {
        values[f.name] = raw._id;
      } else if (f.type === 'date' && raw) {
        values[f.name] = new Date(raw).toISOString().slice(0, 10);
      } else {
        values[f.name] = raw ?? (f.type === 'checkbox' ? false : '');
      }
    }
    reset(values);
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editingItem) {
        await api.update(editingItem._id, values);
        toast.success(`${title.slice(0, -1)} updated`);
      } else {
        await api.create(values);
        toast.success(`${title.slice(0, -1)} created`);
      }
      setFormOpen(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.remove(deletingItem._id);
      toast.success(`${title.slice(0, -1)} deleted`);
      setDeletingItem(null);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete this record');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={canManage && <Button onClick={openCreateForm}>{createLabel}</Button>}
      />

      {searchable && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            aria-label={`Search ${title.toLowerCase()}`}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={emptyMessage} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={items}
              actions={
                canManage
                  ? (row) => (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditForm(row)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeletingItem(row)}>
                          Delete
                        </Button>
                      </div>
                    )
                  : undefined
              }
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingItem ? `Edit ${title.slice(0, -1)}` : `New ${title.slice(0, -1)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              register={register}
              error={errors[field.name]?.message}
              optionsMap={optionsMap}
            />
          ))}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title={`Delete ${title.slice(0, -1)}`}
        message={deletingItem ? `Are you sure you want to delete "${getRowLabel(deletingItem)}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
