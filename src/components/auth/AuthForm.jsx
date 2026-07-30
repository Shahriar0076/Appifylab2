import { AuthField } from './AuthField';

export function AuthForm({ fields, submitLabel, formClassName, inputClassName, labelClassName, formInputClass, btnClass, btnLinkClass, onSubmit, values, onFieldChange, isSubmitting, errors, submitError }) {
  return (
    <form className={formClassName || '_social_login_form'} onSubmit={onSubmit}>
      {submitError && (
        <div className="row">
          <div className="col-12">
            <p className="_auth_submit_error">
              {submitError}
            </p>
          </div>
        </div>
      )}
      <div className="row">
        {fields.map((field) => (
          <AuthField
            key={field.name}
            field={field}
            value={values?.[field.name] || ''}
            onChange={(e) => onFieldChange?.(field.name, e.target.value)}
            inputClass={inputClassName}
            labelClass={labelClassName}
            formInputClass={formInputClass}
            error={errors?.[field.name]}
          />
        ))}
      </div>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
          <div className={`${btnClass || '_social_login_form_btn'} _mar_t40 _mar_b60`}>
            <button type="submit" className={`${btnLinkClass || '_social_login_form_btn_link'} _btn1`} disabled={isSubmitting}>
              {isSubmitting ? 'Please wait...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
