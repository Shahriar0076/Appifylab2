import { useAuthPage } from '../hooks/useAuthPage';
import { loginUser } from '../services/authService';
import { validateLogin } from '../utils/authValidation';
import { PageShell } from '../components/common/PageShell';
import { AuthLayout } from '../components/auth/AuthLayout';

export function LoginPage() {
  const {
    content,
    values,
    errors,
    submitError,
    isSubmitting,
    handleFieldChange,
    handleSubmit,
  } = useAuthPage({
    variant: 'login',
    validate: validateLogin,
    submit: loginUser,
    mapValues: (formValues) => ({
      email: formValues.email.trim(),
      password: formValues.password,
    }),
  });

  if (!content) return null;

  return (
    <PageShell>
      <AuthLayout
        {...content}
        values={values}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        errors={errors}
        submitError={submitError}
      />
    </PageShell>
  );
}
