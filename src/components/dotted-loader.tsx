export function DottedLoader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-dotted border-cyan-300/70 border-t-cyan-100" />
      <span>{label}</span>
    </span>
  );
}
