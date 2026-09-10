import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { systemSettingApi } from '../../api/systemSettingApi';
import { systemSettingUpdateSchema } from '../../validators/systemSettingValidators';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { Spinner } from '../../components/common/Spinner';

export default function SystemSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(systemSettingUpdateSchema) });

  useEffect(() => {
    systemSettingApi
      .get()
      .then((res) => reset(res.data.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, [reset]);

  const onSubmit = async (values) => {
    try {
      const res = await systemSettingApi.update(values);
      reset(res.data.data);
      toast.success('Settings updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Institutional details used on official transcript exports and system-wide defaults."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-xl flex-col gap-4 rounded-xl border border-slate/15 bg-white p-6">
        <Input label="Institution name" required error={errors.institutionName?.message} {...register('institutionName')} />
        <Textarea label="Institution address" error={errors.institutionAddress?.message} {...register('institutionAddress')} />
        <Input label="Registrar name" error={errors.registrarName?.message} {...register('registrarName')} />
        <Input label="Registrar email" type="email" error={errors.registrarEmail?.message} {...register('registrarEmail')} />
        <Input label="Registrar phone" error={errors.registrarPhone?.message} {...register('registrarPhone')} />
        <Input
          label="Required special-elective units for undergraduate programmes"
          type="number"
          min="0"
          error={errors.specialElectiveRequiredUnits?.message}
          {...register('specialElectiveRequiredUnits', { valueAsNumber: true })}
        />
        <Textarea
          label="Transcript footer / verification note"
          error={errors.transcriptFooterNote?.message}
          {...register('transcriptFooterNote')}
        />
        <Input
          label="Official transcript watermark text (optional)"
          hint="Leave blank until the institution supplies approved watermark wording."
          error={errors.officialTranscriptWatermarkText?.message}
          {...register('officialTranscriptWatermarkText')}
        />
        <Input
          label="Official seal label (optional)"
          hint="Reserved for the approved institutional seal or stamp wording."
          error={errors.officialTranscriptSealLabel?.message}
          {...register('officialTranscriptSealLabel')}
        />
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Save changes
        </Button>
      </form>
    </div>
  );
}
