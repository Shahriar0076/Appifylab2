export function Avatar({ name, initials, background, color, className }) {
  const letter = initials || (name ? name.trim().charAt(0).toUpperCase() : '?');
  return (
    <div
      className={`_letter_avatar ${className || ''}`}
      style={{ background: background || '#1890FF', color: color || '#fff' }}
    >
      {letter}
    </div>
  );
}
