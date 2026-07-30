import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../icons';

export function AuthField({ field, value, onChange, inputClass, labelClass, formInputClass, error }) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = field.type === 'password';
  const inputType = isPasswordField && isPasswordVisible ? 'text' : field.type;

  return (
    <div className={`col-xl-12 col-lg-12 col-md-12 col-sm-12`}>
      <div className={`${formInputClass || '_social_login_form_input'} _mar_b14`}>
        <label className={`${labelClass || '_social_login_label'} _mar_b8`}>{field.label}</label>
        <div className={isPasswordField ? '_auth_password_input_wrap' : undefined}>
          <input
            type={inputType}
            className={`form-control ${inputClass || '_social_login_input'}${isPasswordField ? ' _auth_password_input' : ''}${error ? ' _auth_field_error' : ''}`}
            name={field.name}
            value={value || ''}
            onChange={onChange}
          />
          {isPasswordField ? (
            <button
              type="button"
              className="_auth_password_toggle"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              onClick={() => setIsPasswordVisible((current) => !current)}
            >
              {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          ) : null}
        </div>
        {error && (
          <p className="_auth_field_error_text">{error}</p>
        )}
      </div>
    </div>
  );
}
