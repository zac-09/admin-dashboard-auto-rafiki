import { useMap } from '@vis.gl/react-google-maps';
import { useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GLIDE_MS = 900;

/**
 * Renders React content at a lat/lng with a plain OverlayView. Unlike AdvancedMarker this needs
 * no mapId, so the app's JSON map styles keep working; unlike Marker it is not deprecated.
 */
export function HtmlPin({
  position,
  children,
}: {
  position: google.maps.LatLngLiteral;
  children: ReactNode;
}) {
  const map = useMap();
  const [container] = useState(() => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.transform = 'translate(-50%, -100%)';
    return div;
  });
  const [overlay, setOverlay] = useState<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;
    class Pin extends google.maps.OverlayView {
      latLng = new google.maps.LatLng(position);
      onAdd() {
        this.getPanes()?.overlayMouseTarget.appendChild(container);
      }
      draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel(this.latLng);
        if (point) {
          container.style.left = `${point.x}px`;
          container.style.top = `${point.y}px`;
        }
      }
      onRemove() {
        container.remove();
      }
    }
    const pin = new Pin();
    pin.setMap(map);
    setOverlay(pin);
    return () => pin.setMap(null);
    // Position changes are applied below without re-creating the overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, container]);

  // Position updates (a mechanic's live location every ~5 s) glide instead of jumping.
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!overlay) return;
    const pin = overlay as google.maps.OverlayView & { latLng: google.maps.LatLng };
    const from = { lat: pin.latLng.lat(), lng: pin.latLng.lng() };
    const to = position;
    if (reduced || (from.lat === to.lat && from.lng === to.lng)) {
      pin.latLng = new google.maps.LatLng(to);
      overlay.draw();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / GLIDE_MS);
      const e = 1 - (1 - p) ** 3; // ease-out cubic
      pin.latLng = new google.maps.LatLng({
        lat: from.lat + (to.lat - from.lat) * e,
        lng: from.lng + (to.lng - from.lng) * e,
      });
      overlay.draw();
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [overlay, position.lat, position.lng, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(children, container);
}
