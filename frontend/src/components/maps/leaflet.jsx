import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function LeafletMap() {
  return (
    <MapContainer
      center={[-6.2, 106.8]}
      zoom={13}
      className="h-64 w-full rounded"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <Marker position={[-6.2, 106.8]}>
        <Popup>Halo dari Leaflet</Popup>
      </Marker>
    </MapContainer>
  );
}
