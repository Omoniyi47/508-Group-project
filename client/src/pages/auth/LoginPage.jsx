import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { loginSchema } from '../../validators/authValidators';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-navy px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo text-lg font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-semibold text-navy">Transcript & Result Retrieval System</h1>
          <p className="mt-1 text-sm text-slate">Sign in with your department-issued account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {serverError && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          <Input
            label="Email address"
            type="email"
            autoComplete="username"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="relative">
            <Input
              label="Password"
              type={isPasswordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              error={errors.password?.message}
              className="pr-11"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={isPasswordVisible}
              className="absolute right-3 top-8 rounded p-1 text-slate transition-colors hover:text-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
            >
              {isPasswordVisible ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 3 18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 5 9.3 8s-1.5 4.5-3.7 6.1" />
                  <path d="M6.2 6.2C4 7.8 2.7 10 2.7 12c0 3 3.8 8 9.3 8 1.1 0 2.1-.2 3.1-.6" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.7 12s3.8-8 9.3-8 9.3 5 9.3 8-3.8 8-9.3 8-9.3-5-9.3-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
