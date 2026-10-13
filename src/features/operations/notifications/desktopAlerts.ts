import { create } from 'zustand';

const STORAGE_KEY = 'autorafiki.desktopAlerts';

export type DesktopPermission = NotificationPermission | 'unsupported';

export function desktopPermission(): DesktopPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

interface DesktopAlertsState {
  /** The operator asked for desktop alerts on this browser. */
  enabled: boolean;
  permission: DesktopPermission;
  /** Asks the browser when needed; stays off when permission is refused. */
  turnOn(): Promise<void>;
  turnOff(): void;
}

function store(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** Per-browser preference: alerts are for whoever sits at this laptop. */
export const useDesktopAlerts = create<DesktopAlertsState>((set) => ({
  enabled: readStored(),
  permission: desktopPermission(),
  async turnOn() {
    let permission = desktopPermission();
    if (permission === 'default') permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    store(enabled);
    set({ enabled, permission });
  },
  turnOff() {
    store(false);
    set({ enabled: false });
  },
}));
