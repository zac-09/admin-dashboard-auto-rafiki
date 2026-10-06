import type { ThemeMode } from '@/theme/tokens';

import { darkMapStyle } from './darkStyle';
import { lightMapStyle } from './lightStyle';

export { darkMapStyle, lightMapStyle };

/** The map follows the dashboard's light/dark mode. */
export function mapStyleFor(mode: ThemeMode): google.maps.MapTypeStyle[] {
  return mode === 'dark' ? darkMapStyle : lightMapStyle;
}

/** Kampala city centre (Kampala Road), the default view. */
export const KAMPALA = { lat: 0.3136, lng: 32.5811 };
