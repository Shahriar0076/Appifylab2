import { useAuthPage } from '../hooks/useAuthPage';
import { registerUser } from '../services/authService';
import { validateRegistration } from '../utils/authValidation';
import { PageShell } from '../components/common/PageShell';
import { AuthLayout } from '../components/auth/AuthLayout';

export function RegistrationPage() {
  const {
    content,
    values,
    errors,
    submitError,
    isSubmitting,
    handleFieldChange,
    handleSubmit,
  } = useAuthPage({
    variant: 'registration',
    validate: validateRegistration,
    submit: registerUser,
    mapValues: (formValues) => ({
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
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
