import { useDesktopAlerts } from './desktopAlerts';

const BUTTON =
  'inline-flex min-h-8 items-center gap-2 rounded-control border border-hairline px-2 text-xs font-semibold normal-case tracking-normal hover:border-primary';

/** "Desktop alerts" on/off for this browser, with the reason when the browser says no. */
export function DesktopAlertsToggle() {
  const { enabled, permission, turnOn, turnOff } = useDesktopAlerts();
  if (permission === 'unsupported') return null;
  if (permission === 'denied') {
    return (
      <span className="text-xs font-normal tracking-normal normal-case text-muted">
        Desktop alerts blocked in this browser's site settings
      </span>
    );
  }
  const on = enabled && permission === 'granted';
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? turnOff() : void turnOn())}
      className={BUTTON}
      title="Pop-up alerts on this computer while any dashboard tab is open"
    >
      <span aria-hidden className={`diamond ${on ? 'text-success' : 'text-muted'}`} />
      Desktop alerts: {on ? 'on' : 'off'}
    </button>
  );
}
