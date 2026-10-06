import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router';

import { env } from '@/lib/env';
import { KAMPALA, mapStyleFor } from '@/lib/maps';
import { useThemeMode } from '@/theme/themeMode';

import type { JobPin, MechanicPin } from './pins';
import { HtmlPin } from './HtmlPin';

function JobMarker({ pin }: { pin: JobPin }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/operations/jobs/${pin.id}`)}
      aria-label={`Job: ${pin.label}${pin.attention ? ', needs attention' : ''}`}
      className={`flex items-center gap-1.5 rounded-control border-2 bg-background px-2 py-1 text-xs font-semibold whitespace-nowrap text-primary shadow ${
        pin.attention ? 'border-warning' : 'border-primary'
      }`}
    >
      <span
        aria-hidden
        className={`diamond ${pin.attention ? 'sonar text-warning' : 'text-accent'}`}
      />
      {pin.attention ? `${pin.label} !` : pin.label}
    </button>
  );
}

function MechanicMarker({ pin }: { pin: MechanicPin }) {
  const navigate = useNavigate();
  const status = pin.receivesJobs ? 'available' : 'online, not verified';
  return (
    <button
      type="button"
      onClick={() => navigate(`/vetting/${pin.id}`)}
      title={`${pin.name} (${status})`}
      aria-label={`Mechanic ${pin.name}, ${status}`}
      className={`size-4 rounded-full border-2 border-background shadow ${
        pin.receivesJobs ? 'bg-accent' : 'bg-background ring-2 ring-muted'
      }`}
    />
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="diamond text-accent" /> Job (status written on the pin)
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="diamond sonar text-warning" /> Job needing attention (marked !)
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full bg-accent" /> Mechanic receiving jobs
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full ring-2 ring-muted" /> Online, not verified
      </li>
    </ul>
  );
}

/** Lazy-loaded: the Maps JS API only loads when someone opens the map. Never embed publicly. */
export default function OpsMap({ jobs, mechanics }: { jobs: JobPin[]; mechanics: MechanicPin[] }) {
  const mode = useThemeMode((s) => s.mode);
  if (!env.mapsApiKey) {
    return (
      <p className="panel p-6 text-sm text-muted">
        The map needs VITE_MAPS_API_KEY (see README → Env vars).
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="panel h-[60vh] min-h-80 overflow-hidden">
        <APIProvider apiKey={env.mapsApiKey}>
          <Map
            defaultCenter={KAMPALA}
            defaultZoom={12}
            styles={mapStyleFor(mode)}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            clickableIcons={false}
          >
            {mechanics.map((pin) => (
              <HtmlPin key={`m:${pin.id}`} position={pin.position}>
                <MechanicMarker pin={pin} />
              </HtmlPin>
            ))}
            {jobs.map((pin) => (
              <HtmlPin key={`j:${pin.id}`} position={pin.position}>
                <JobMarker pin={pin} />
              </HtmlPin>
            ))}
          </Map>
        </APIProvider>
      </div>
      <Legend />
    </div>
  );
}
