export function PageShell({ children, className }) {
  return (
    <div className={'_layout_main_wrapper' + (className ? ' ' + className : '')}>
      {children}
    </div>
  );
}
