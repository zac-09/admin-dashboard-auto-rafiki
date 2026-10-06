import { WheelMark } from '@/components/ui';

export function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <WheelMark size={56} />
      <h1 className="text-lg font-semibold">AutoRafiki Ops</h1>
      <p className="micro-label">Operations dashboard</p>
    </main>
  );
}
