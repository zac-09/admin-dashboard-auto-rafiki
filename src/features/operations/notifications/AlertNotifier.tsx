import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useNow } from '@/lib/useLive';

import { computeAlerts } from '../alerts';
import { useAppSettings } from '@/features/settings/hooks';
import { BROADCAST } from '@/types';

import { useActiveJobs, useLowRatings, useOnlineMechanics } from '../hooks';

import { useDesktopAlerts } from './desktopAlerts';
import { planNotifications } from './plan';

/** Mounted by the shell while desktop alerts are on, so they arrive from any page. */
function Watcher() {
  const active = useActiveJobs();
  const lowRatings = useLowRatings();
  const online = useOnlineMechanics();
  const appSettings = useAppSettings();
  const radiusKm =
    appSettings.effective?.settings.broadcast.initialRadiusKm ?? BROADCAST.initialRadiusKm;
  const now = useNow();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (active.status !== 'ready' || lowRatings.status !== 'ready' || online.status !== 'ready') {
      return;
    }
    const alerts = computeAlerts(active.data.jobs, lowRatings.data, now, {
      online: online.data,
      radiusKm,
    });
    const planned = planNotifications(alerts, seen.current);
    for (const a of alerts) seen.current.add(a.key);
    // The operator is already looking at the alert rail: nothing to interrupt them with.
    const watching =
      pathname === '/operations' && document.visibilityState === 'visible' && document.hasFocus();
    if (watching) return;
    for (const p of planned) {
      const n = new Notification(p.title, { body: p.body, tag: p.tag });
      n.onclick = () => {
        window.focus();
        navigate(p.path);
        n.close();
      };
    }
  }, [active, lowRatings, online, radiusKm, now, pathname, navigate]);

  return null;
}

export function AlertNotifier() {
  const { enabled, permission } = useDesktopAlerts();
  return enabled && permission === 'granted' ? <Watcher /> : null;
}
