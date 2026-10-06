export function PageHeader({ label, title }: { label: string; title: string }) {
  return (
    <header className="mb-6 flex flex-col gap-1">
      <span className="micro-label">{label}</span>
      <h1 className="text-xl font-semibold">{title}</h1>
    </header>
  );
}
