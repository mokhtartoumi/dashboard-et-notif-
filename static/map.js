// Initialize Leaflet map centered on Tunisia
const map = L.map('map').setView([34.0, 9.0], 6);

// Add base map layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// Hardcoded gas station data
const gasStations = [
  {
    name: "Station Tunis Centre",
    latitude: 36.8065,
    longitude: 10.1815,
    status: "good"
  },
  {
    name: "Station Sousse",
    latitude: 35.8254,
    longitude: 10.6360,
    status: "in_progress"
  },
  {
    name: "Station Sfax",
    latitude: 34.7406,
    longitude: 10.7603,
    status: "bad"
  },
  {
    name: "Station Bizerte",
    latitude: 37.2744,
    longitude: 9.8739,
    status: "good"
  },
  {
    name: "Station Gabès",
    latitude: 33.8815,
    longitude: 10.0982,
    status: "bad"
  },
  {
    name: "Station Kairouan",
    latitude: 35.6712,
    longitude: 10.1006,
    status: "in_progress"
  }
];

// Add markers for each gas station
gasStations.forEach(station => {
  let color;
  if (station.status === 'good') color = 'green';
  else if (station.status === 'in_progress') color = 'yellow';
  else color = 'red';

  const marker = L.circleMarker([station.latitude, station.longitude], {
    color: color,
    radius: 10,
    fillOpacity: 0.8
  }).addTo(map);

  marker.bindPopup(`<strong>${station.name}</strong><br>Status: ${station.status}`);
});