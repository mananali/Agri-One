export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 56" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="brand-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#53e000" />
          <stop offset="1" stopColor="#087b31" />
        </linearGradient>
        <linearGradient id="brand-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffbd00" />
          <stop offset="1" stopColor="#f02b11" />
        </linearGradient>
      </defs>
      <path d="M3 51 20 10c2-5 8-6 11-1l12 25-9 5-9-18-9 22h12l-3 8Z" fill="url(#brand-green)" />
      <path d="M42 8 54 2v39h8v10H38V41h7V17l-7 4v-9Z" fill="url(#brand-orange)" />
      <path d="M17 43c8-15 19-22 39-26-4 16-15 25-30 26-4 0-7 0-9 0Z" fill="#48d916" />
      <path d="M21 43c8-8 18-14 30-21" fill="none" stroke="#073d1e" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 51c16 0 31-5 47-16" fill="none" stroke="#148b38" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
