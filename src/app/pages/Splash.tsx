import { DiamondDivider, WheelMark } from '@/components/ui';
import { Reveal } from '@/components/motion';

/** Shown while the session restores (the app's design-00 splash, for the ops dashboard). */
export function Splash() {
  return (
    <main
      role="status"
      aria-label="Starting AutoRafiki Ops"
      className="flex min-h-dvh flex-col items-center justify-between p-6"
    >
      <span />
      <div className="flex flex-col items-center">
        <Reveal from="scale" className="relative flex size-40 items-center justify-center">
          <svg viewBox="0 0 160 160" className="absolute inset-0" aria-hidden>
            <circle
              cx={80}
              cy={80}
              r={78}
              fill="none"
              strokeWidth={1}
              className="stroke-hairline"
            />
            <circle
              cx={80}
              cy={80}
              r={70}
              fill="none"
              strokeWidth={1.2}
              className="stroke-accent"
            />
          </svg>
          <WheelMark size={116} ring={false} label={null} />
        </Reveal>
        <Reveal delay={120} className="mt-8 flex flex-col items-center">
          <span className="text-[22px] font-semibold tracking-[0.25em]">AUTORAFIKI</span>
          <DiamondDivider className="my-5 w-52" />
          <span className="text-sm text-muted">Operations dashboard</span>
        </Reveal>
      </div>
      <Reveal from="fade" delay={300}>
        <span className="text-xs text-muted">Kampala</span>
      </Reveal>
    </main>
  );
}
