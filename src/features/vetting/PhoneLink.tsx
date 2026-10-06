export function PhoneLink({ phone }: { phone?: string }) {
  if (!phone) return <span className="text-muted">No phone</span>;
  return (
    <a href={`tel:${phone}`} className="underline">
      {phone}
    </a>
  );
}
