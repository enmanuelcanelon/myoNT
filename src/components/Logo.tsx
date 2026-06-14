export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="eac-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#eac-logo)" />
      <path
        d="M32 13c1.6 6.7 4.3 9.4 11 11-6.7 1.6-9.4 4.3-11 11-1.6-6.7-4.3-9.4-11-11 6.7-1.6 9.4-4.3 11-11z"
        fill="#fff"
      />
      <circle cx="46" cy="44" r="3.2" fill="#fff" opacity="0.9" />
      <circle cx="20" cy="42" r="2.2" fill="#fff" opacity="0.7" />
    </svg>
  );
}
