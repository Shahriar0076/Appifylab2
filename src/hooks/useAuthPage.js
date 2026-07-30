import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthPageContent } from '../services/authContentService';
import { toast } from '../utils/toast';
import { mapAuthError } from '../utils/authValidation';

/**
 * Shared hook for LoginPage / RegistrationPage.
 * Manages form state, validation, submission, and error handling.
 *
 * @param {object} options
 * @param {'login'|'registration'} options.variant
 * @param {(values: object) => { valid: boolean, errors: object }} options.validate
 * @param {(values: object) => Promise<*>} options.submit - async submit function
 * @param {(values: object) => object} [options.mapValues] - transform raw form values before submit
 * @returns {{
 *   content: object|null,
 *   values: object,
 *   errors: object,
 *   submitError: string,
 *   isSubmitting: boolean,
 *   handleFieldChange: (name: string, value: string) => void,
 *   handleSubmit: (formValues: object) => Promise<void>,
 * }}
 */
export function useAuthPage({ variant, validate, submit, mapValues }) {
  const [content, setContent] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAuthPageContent(variant).then(setContent);
    import('../app/FeedRoute');
  }, [variant]);

  const handleFieldChange = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (prev[name]) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return prev;
    });
    setSubmitError('');
  }, []);

  const handleSubmit = useCallback(
    async (formValues) => {
      const validation = validate(formValues);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      setErrors({});
      setSubmitError('');
      setIsSubmitting(true);

      try {
        const submitValues = mapValues ? mapValues(formValues) : formValues;
        const authenticatedUser = await submit(submitValues);
        void import('../app/FeedRoute');
        if (authenticatedUser?.uid) {
          void import('../services/firestoreFeedService')
            .then(({ preloadInitialRemotePosts }) =>
              preloadInitialRemotePosts(authenticatedUser.uid)
            )
            .catch((error) => {
              // Navigation should still succeed; the feed will retry the request.
              console.warn('Initial feed preload failed:', error);
            });
        }
        toast.success(
          variant === 'login'
            ? 'Welcome back! Redirecting to your feed...'
            : 'Account created! Welcome to Buddy Script \uD83C\uDF89'
        );
        navigate('/feed', { replace: true });
      } catch (err) {
        const errorMessage = mapAuthError(err.code || err.message);
        setSubmitError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, submit, mapValues, navigate, variant]
  );

  return {
    content,
    values,
    errors,
    submitError,
    isSubmitting,
    handleFieldChange,
    handleSubmit,
  };
}
