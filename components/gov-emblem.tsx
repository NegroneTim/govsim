/** Minimal institutional seal — abstract columns + ring (no official insignia). */
export function GovEmblem({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="1.5" className="text-[#c9a227]" />
      <circle cx="28" cy="28" r="21" stroke="currentColor" strokeWidth="0.75" className="text-[#c9a227]/60" />
      <path
        d="M18 38V22h4v16h-4zm8 0V18h4v20h-4zm8 0V22h4v16h-4z"
        fill="currentColor"
        className="text-[#e8d5a3]"
      />
      <path d="M14 38h28" stroke="currentColor" strokeWidth="1.25" className="text-[#c9a227]" />
    </svg>
  );
}
