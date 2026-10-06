/**
 * Ported verbatim from the app repo's src/lib/maps/lightStyle.ts (react-native-maps and Maps JS
 * share the same style JSON). Map styles are not themed components, so literal colours are
 * allowed here only.
 */
export const lightMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#F3F5F7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5B6570' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#D9DEE3' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EFE7' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#EEF1F4' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E1E6EB' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6B7681' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#DCE3EA' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C9DEEA' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7A8A99' }] },
];
