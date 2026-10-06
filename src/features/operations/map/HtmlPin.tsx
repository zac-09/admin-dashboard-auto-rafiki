import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

  useEffect(() => {
    if (!overlay) return;
    (overlay as google.maps.OverlayView & { latLng: google.maps.LatLng }).latLng =
      new google.maps.LatLng(position);
    overlay.draw();
  }, [overlay, position.lat, position.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(children, container);
}
