export function Button({ children, className, type = 'button', onClick, icon: Icon }) {
  return (
    <button type={type} className={className} onClick={onClick}>
      {Icon && <Icon className="_mar_img" />}
      {children}
    </button>
  );
}
