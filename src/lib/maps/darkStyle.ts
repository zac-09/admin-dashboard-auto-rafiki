/**
 * Ported verbatim from the app repo's src/lib/maps/darkStyle.ts (react-native-maps and Maps JS
 * share the same style JSON). Map styles are not themed components, so literal colours are
 * allowed here only.
 */
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#171B21' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#B7C0C9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101215' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#333C47' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#19241F' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1B212A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#242C37' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8B96A3' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#242C37' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A3440' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1A20' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4E5A66' }] },
];
