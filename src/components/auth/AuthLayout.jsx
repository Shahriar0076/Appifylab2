import { Link } from 'react-router-dom';
import { DecorativeShapes } from './DecorativeShapes';
import { AuthHero } from './AuthHero';
import { AuthForm } from './AuthForm';
import { Logo } from '../common/Logo';

export function AuthLayout({
  variant: _variant,
  heroImage,
  introText,
  title,
  submitLabel,
  footerText,
  footerLinkText,
  footerLinkTo,
  wrapperClass,
  wrapClass,
  leftClass,
  leftImageClass,
  contentClass,
  logoClass,
  contentParaClass,
  contentTitleClass,
  formClass,
  formInputClass,
  labelClass,
  inputClass,
  btnClass,
  btnLinkClass,
  bottomTxtClass,
  bottomTxtParaClass,
  fields,
  values,
  onFieldChange,
  onSubmit,
  isSubmitting,
  errors,
  submitError
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <section className={wrapperClass || '_social_login_wrapper'}>
      <DecorativeShapes />
      <div className={wrapClass || '_social_login_wrap'}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-xl-8 col-lg-8 col-md-12 col-sm-12">
              <AuthHero
                heroImage={heroImage}
                leftClass={leftClass}
                leftImageClass={leftImageClass}
              />
            </div>
            <div className="col-xl-4 col-lg-4 col-md-12 col-sm-12">
              <div className={contentClass || '_social_login_content'}>
                <div className={`${logoClass || '_social_login_left_logo'} _mar_b28`}>
                  <Logo logoFile="logo.svg" className="_left_logo" />
                </div>
                <p className={`${contentParaClass || '_social_login_content_para'} _mar_b8`}>{introText}</p>
                <h4 className={`${contentTitleClass || '_social_login_content_title'} _titl4 _mar_b50`}>{title}</h4>
                <AuthForm
                  fields={fields}
                  submitLabel={submitLabel}
                  formClassName={formClass}
                  inputClassName={inputClass}
                  labelClassName={labelClass}
                  formInputClass={formInputClass}
                  btnClass={btnClass}
                  btnLinkClass={btnLinkClass}
                  values={values}
                  onFieldChange={onFieldChange}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  errors={errors}
                  submitError={submitError}
                />
                <div className="row">
                  <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                    <div className={bottomTxtClass || '_social_login_bottom_txt'}>
                      <p className={bottomTxtParaClass || '_social_login_bottom_txt_para'}>
                        {footerText} <Link to={footerLinkTo || '/'}>{footerLinkText}</Link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
