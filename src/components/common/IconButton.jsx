export function IconButton({ icon: Icon, className, type = 'button', onClick, title }) {
  return (
    <button type={type} className={className} onClick={onClick} title={title}>
      {Icon && <Icon />}
    </button>
  );
}
