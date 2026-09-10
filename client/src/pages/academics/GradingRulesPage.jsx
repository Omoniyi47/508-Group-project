import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { gradingRuleApi } from '../../api/gradingRuleApi';
import { gradingRuleSchema } from '../../validators/academicValidators';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Checkbox } from '../../components/common/Checkbox';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';

const emptyRule = {
  name: '',
  isActive: false,
  gradeBands: [{ grade: '', minScore: '', maxScore: '', point: '' }],
  classificationBands: [{ classification: '', minCgpa: '', maxCgpa: '' }],
};

export default function GradingRulesPage() {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deletingRule, setDeletingRule] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(gradingRuleSchema), defaultValues: emptyRule });

  const gradeBands = useFieldArray({ control, name: 'gradeBands' });
  const classificationBands = useFieldArray({ control, name: 'classificationBands' });

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const res = await gradingRuleApi.list({ limit: 100 });
      setRules(res.data.data);
    } catch {
      toast.error('Failed to load grading rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreateForm = () => {
    setEditingRule(null);
    reset(emptyRule);
    setFormOpen(true);
  };

  const openEditForm = (rule) => {
    setEditingRule(rule);
    reset({
      name: rule.name,
      isActive: rule.isActive,
      gradeBands: rule.gradeBands,
      classificationBands: rule.classificationBands,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editingRule) {
        await gradingRuleApi.update(editingRule._id, values);
        toast.success('Grading rule updated');
      } else {
        await gradingRuleApi.create(values);
        toast.success('Grading rule created');
      }
      setFormOpen(false);
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const activate = async (rule) => {
    try {
      await gradingRuleApi.update(rule._id, { isActive: true });
      toast.success(`"${rule.name}" is now the active grading rule`);
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to activate this rule');
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await gradingRuleApi.remove(deletingRule._id);
      toast.success('Grading rule deleted');
      setDeletingRule(null);
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete this rule');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Grading Rules"
        description="Configure grade boundaries, grade points, and degree classification bands. Only one rule can be active at a time."
        actions={<Button onClick={openCreateForm}>+ New Rule</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState title="No grading rules yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule._id} className="rounded-xl border border-slate/15 bg-white p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-navy">{rule.name}</h3>
                  {rule.isActive ? (
                    <span className="mt-1 inline-block rounded-full bg-success px-2 py-0.5 text-xs font-medium text-navy">
                      Active
                    </span>
                  ) : (
                    <span className="mt-1 inline-block rounded-full bg-slate px-2 py-0.5 text-xs font-medium text-white">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Grade bands</p>
              <p className="mb-3 text-sm text-navy">
                {rule.gradeBands.map((b) => `${b.grade} (${b.minScore}-${b.maxScore} = ${b.point}pt)`).join(', ')}
              </p>

              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Classification bands</p>
              <p className="mb-4 text-sm text-navy">
                {rule.classificationBands.map((b) => `${b.classification} (${b.minCgpa}-${b.maxCgpa})`).join(', ')}
              </p>

              <div className="flex gap-2">
                {!rule.isActive && (
                  <Button variant="teal" size="sm" onClick={() => activate(rule)}>
                    Activate
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => openEditForm(rule)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeletingRule(rule)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editingRule ? 'Edit Grading Rule' : 'New Grading Rule'}
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
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Input label="Rule name" required error={errors.name?.message} {...register('name')} />
          <Checkbox label="Set as active rule" {...register('isActive')} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-navy">Grade bands</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => gradeBands.append({ grade: '', minScore: '', maxScore: '', point: '' })}
              >
                + Add grade band
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {gradeBands.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-start gap-2">
                  <Input placeholder="Grade (A)" {...register(`gradeBands.${index}.grade`)} />
                  <Input placeholder="Min score" type="number" {...register(`gradeBands.${index}.minScore`)} />
                  <Input placeholder="Max score" type="number" {...register(`gradeBands.${index}.maxScore`)} />
                  <Input placeholder="Points" type="number" {...register(`gradeBands.${index}.point`)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => gradeBands.remove(index)}
                    disabled={gradeBands.fields.length <= 1}
                    aria-label="Remove grade band"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            {errors.gradeBands?.message && <p className="mt-1 text-sm text-danger">{errors.gradeBands.message}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-navy">Classification bands</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => classificationBands.append({ classification: '', minCgpa: '', maxCgpa: '' })}
              >
                + Add classification band
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {classificationBands.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-start gap-2">
                  <Input placeholder="Classification" {...register(`classificationBands.${index}.classification`)} />
                  <Input placeholder="Min CGPA" type="number" step="0.01" {...register(`classificationBands.${index}.minCgpa`)} />
                  <Input placeholder="Max CGPA" type="number" step="0.01" {...register(`classificationBands.${index}.maxCgpa`)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => classificationBands.remove(index)}
                    disabled={classificationBands.fields.length <= 1}
                    aria-label="Remove classification band"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            {errors.classificationBands?.message && (
              <p className="mt-1 text-sm text-danger">{errors.classificationBands.message}</p>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingRule}
        onClose={() => setDeletingRule(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Delete Grading Rule"
        message={deletingRule ? `Are you sure you want to delete "${deletingRule.name}"?` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
