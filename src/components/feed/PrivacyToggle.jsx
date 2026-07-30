import { PublicIcon, PrivateIcon } from '../icons';

export function PrivacyToggle({ value, onChange, options }) {
  return (
    <div className="_privacy_toggle_wrap" id="_privacy_toggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`_privacy_toggle_btn ${value === opt.value ? '_privacy_toggle_active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.value === 'public' ? (
            <PublicIcon className="_privacy_icon" />
          ) : (
            <PrivateIcon className="_privacy_icon" />
          )}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
