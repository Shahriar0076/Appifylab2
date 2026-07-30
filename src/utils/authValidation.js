/**
 * Validate a login form submission.
 * @param {object} values - { email, password }
 * @returns {{ valid: boolean, errors: object }} errors keyed by field name
 */
export function validateLogin(values) {
  const errors = {};

  if (!values.email?.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a registration form submission.
 * @param {object} values - { firstName, lastName, email, password }
 * @returns {{ valid: boolean, errors: object }}
 */
export function validateRegistration(values) {
  const errors = {};

  if (!values.firstName?.trim()) {
    errors.firstName = 'First name is required.';
  } else if (values.firstName.trim().length < 2 || values.firstName.trim().length > 50) {
    errors.firstName = 'First name must be between 2 and 50 characters.';
  }

  if (!values.lastName?.trim()) {
    errors.lastName = 'Last name is required.';
  } else if (values.lastName.trim().length < 2 || values.lastName.trim().length > 50) {
    errors.lastName = 'Last name must be between 2 and 50 characters.';
  }

  if (!values.email?.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Map Firebase Auth error codes to user-friendly messages.
 * @param {string} code - Error code from Firebase
 * @returns {string}
 */
export function mapAuthError(code) {
  const errorMap = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
    'auth/network-request-failed': 'Network error. Try again when online.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-email': 'The email address is not valid.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not enabled. Please contact the administrator.',
    'auth/admin-restricted-operation': 'Email/Password sign-in is not enabled. Please contact the administrator.',
  };

  return errorMap[code] || 'Something went wrong. Please try again.';
}
