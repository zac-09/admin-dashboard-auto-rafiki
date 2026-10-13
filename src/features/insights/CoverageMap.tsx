import { APIProvider, Map } from '@vis.gl/react-google-maps';

import { HtmlPin } from '@/features/operations/map/HtmlPin';
import { env } from '@/lib/env';
import { KAMPALA, mapStyleFor } from '@/lib/maps';
import { useThemeMode } from '@/theme/themeMode';
import type { MechanicDoc } from '@/types';

import type { CoverageArea } from './coverage';

/** Lazy-loaded with the Maps JS API. Areas carry their numbers as text, never colour alone. */
export default function CoverageMap({
  areas,
  mechanics,
}: {
  areas: readonly CoverageArea[];
  mechanics: readonly MechanicDoc[];
}) {
  const mode = useThemeMode((s) => s.mode);
  if (!env.mapsApiKey) {
    return (
      <p className="panel p-6 text-sm text-muted">
        The map needs VITE_MAPS_API_KEY (see README → Env vars). The list below has the same areas.
      </p>
    );
  }
  const spots = mechanics.filter((m) => m.vetting === 'verified' && m.lastKnownLocation);
  return (
    <div className="flex flex-col gap-2">
      <div className="panel h-[55vh] min-h-80 overflow-hidden">
        <APIProvider apiKey={env.mapsApiKey}>
          <Map
            defaultCenter={KAMPALA}
            defaultZoom={11}
            styles={mapStyleFor(mode)}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            clickableIcons={false}
          >
            {spots.map((m) => (
              <HtmlPin
                key={`m:${m.userId}`}
                position={{
                  lat: m.lastKnownLocation!.latitude,
                  lng: m.lastKnownLocation!.longitude,
                }}
              >
                <span
                  title={`${m.businessName} (last known location)`}
                  aria-label={`Mechanic ${m.businessName}, last known location`}
                  className="block size-4 rounded-full border-2 border-background bg-accent shadow"
                />
              </HtmlPin>
            ))}
            {areas.map((a) => (
              <HtmlPin key={a.key} position={{ lat: a.center.latitude, lng: a.center.longitude }}>
                <span
                  aria-label={`${a.label}: ${a.unserved} of ${a.requests} requests unanswered`}
                  className={`flex items-center gap-1.5 rounded-control border-2 bg-background px-2 py-1 text-xs font-semibold whitespace-nowrap text-primary shadow ${
                    a.unserved > 0 ? 'border-warning' : 'border-hairline'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`diamond ${a.unserved > 0 ? 'text-warning' : 'text-success'}`}
                  />
                  {a.unserved}/{a.requests}
                </span>
              </HtmlPin>
            ))}
          </Map>
        </APIProvider>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="diamond text-warning" /> Area: unanswered / all requests
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-accent" /> Verified mechanic, last
          known location
        </li>
      </ul>
    </div>
  );
}
