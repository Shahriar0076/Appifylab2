export function EyeOffIcon({ className, width = 20, height = 20, color = '#6B7280' }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 3L21 21" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.58 5.89C11.04 5.8 11.51 5.75 12 5.75C18.25 5.75 21.75 12 21.75 12C21.03 13.28 20.12 14.44 19.08 15.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.62 7.27C4.08 8.99 2.25 12 2.25 12C2.25 12 5.75 18.25 12 18.25C13.69 18.25 15.17 17.79 16.43 17.1" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 9.75C9.17 10.33 8.82 11.13 8.82 12C8.82 13.76 10.24 15.18 12 15.18C12.87 15.18 13.67 14.83 14.25 14.25" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
