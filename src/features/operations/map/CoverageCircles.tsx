import { useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';

import { palettes } from '@/theme/tokens';
import { useThemeMode } from '@/theme/themeMode';

import type { MechanicPin } from './pins';

/**
 * A broadcast-radius circle around each mechanic receiving jobs, so ground nobody covers
 * right now stands out. Maps draws outside CSS, so the colour comes from the palette for the
 * current mode; the legend names it, so it is never colour alone.
 */
export function CoverageCircles({ pins, radiusKm }: { pins: MechanicPin[]; radiusKm: number }) {
  const map = useMap();
  const mode = useThemeMode((s) => s.mode);
  useEffect(() => {
    if (!map) return;
    const accent = palettes[mode].accent;
    const circles = pins
      .filter((p) => p.receivesJobs)
      .map(
        (p) =>
          new google.maps.Circle({
            map,
            center: p.position,
            radius: radiusKm * 1000,
            strokeColor: accent,
            strokeOpacity: 0.6,
            strokeWeight: 1,
            fillColor: accent,
            fillOpacity: 0.08,
            clickable: false,
          }),
      );
    return () => circles.forEach((c) => c.setMap(null));
  }, [map, pins, radiusKm, mode]);
  return null;
}
