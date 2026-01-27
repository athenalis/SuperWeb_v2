import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/* ======================
   UTIL NORMALIZE
====================== */
const normalizeKey = (str = "") =>
  str
    .toString()
    .toUpperCase()
    .replace(/KECAMATAN/g, "")
    .replace(/KEC\./g, "")
    .replace(/[^A-Z]/g, "")
    .trim();

/* ======================
   ALIAS KECAMATAN
====================== */
const DISTRICT_ALIAS_RAW = {
  TANJUNGPRIUK: "TANJUNGPRIOK",
  GROGOLPETAMBURAN: "GROGOLPERTAMBURAN",
};

const DISTRICT_ALIAS = Object.fromEntries(
  Object.entries(DISTRICT_ALIAS_RAW).map(([k, v]) => [
    normalizeKey(k),
    normalizeKey(v),
  ])
);

const getDistrictKey = (name = "") => {
  const raw = normalizeKey(name);
  return DISTRICT_ALIAS[raw] || raw;
};

/* ======================
   AMBIL NAMA DARI GEOJSON
====================== */
const getGeoDistrictName = (p = {}) =>
  p.district || p.WADMKC || p.NAMOBJ || p.NAME || p.name || "";

/* ======================
   COLOR berdasarkan kategori backend
====================== */
const COLOR = {
  "Straight Ticket": "#22c55e",  // hijau
  "Split Ticket": "#ef4444",     // merah
  "Non-Partisan": "#facc15",     // kuning
};

/* ======================
   MAPPING PARTY CODE KE NAMA
====================== */
const PARTY_NAMES = {
  100001: "PKB",
  100002: "Gerindra",
  100003: "PDIP",
  100004: "Golkar",
  100005: "NasDem",
  100006: "Demokrat",
  100007: "PAN",
  100008: "PKS",
  100009: "PPP",
  100010: "Perindo",
  100011: "PSI",
  100012: "Hanura",
};

const PASLON_NAMES = {
  "01": "Ridwan Kamil - Suswono",
  "02": "Dharma Pongrekun - Kun Wardana", 
  "03": "Pramono Anung - Rano Karno",
};

export default function MapAnalisis({ data }) {
  const mapRef = useRef();
  const [geojson, setGeojson] = useState(null);

  /* ======================
     LOAD GEOJSON
  ====================== */
  useEffect(() => {
    fetch("/data/district.geojson")
      .then((res) => res.json())
      .then(setGeojson)
      .catch((e) => console.error("GeoJSON error:", e));
  }, []);

  /* ======================
     MAP DATA API (BY DISTRICT CODE OR NAME)
  ====================== */
  const districtData = useMemo(() => {
    const out = {};
    (data || []).forEach((d) => {
      // Map by normalized district name
      out[getDistrictKey(d.district)] = d;
      // Also map by district_code if available
      if (d.district_code) {
        out[d.district_code] = d;
      }
    });
    return out;
  }, [data]);

  /* ======================
     STYLE POLYGON
  ====================== */
  const styleFeature = ({ properties }) => {
    const name = getGeoDistrictName(properties);
    const key = getDistrictKey(name);
    const d = districtData[key];

    return {
      fillColor: COLOR[d?.category] || "#e5e7eb",
      color: "#374151",
      weight: 0.7,
      fillOpacity: 0.8,
    };
  };

  /* ======================
     TOOLTIP
  ====================== */
const onEachFeature = (feature, layer) => {
  const name = getGeoDistrictName(feature.properties);
  const key = getDistrictKey(name);
  const d = districtData[key];

  if (!d) {
    layer.bindTooltip(
      `<strong>${name}</strong><br/><i>Data tidak tersedia</i>`,
      { sticky: true }
    );
    return;
  }

  // ✅ Extract party winner dari party_votes
  const partyWinner = d.party_votes 
    ? Object.keys(d.party_votes).reduce((a, b) => 
        d.party_votes[a] > d.party_votes[b] ? a : b
      )
    : null;

  // ✅ Convert to number if needed
  const partyName = PARTY_NAMES[Number(partyWinner)] || 
                    PARTY_NAMES[partyWinner] || 
                    "-";

  const paslonName = PASLON_NAMES[d.winner_paslon] || `Paslon ${d.winner_paslon}`;
  
  const categoryColor = {
    "Straight Ticket": "#22c55e",
    "Split Ticket": "#ef4444",
    "Non-Partisan": "#facc15",
  };

  layer.bindTooltip(
    `
    <div style="font-size:12px; min-width: 180px;">
      <strong style="font-size:14px;">${d.district}</strong><br/>
      <hr style="margin: 4px 0; border-color: #e5e7eb;"/>
      <div style="margin-bottom: 4px;">
        <span style="color: #6b7280;">Paslon Pemenang:</span><br/>
        <strong>${paslonName}</strong>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #6b7280;">Partai Dominan:</span><br/>
        <strong>${partyName}</strong>
      </div>
      <div style="margin-top: 8px;">
        <span style="
          background: ${categoryColor[d.category] || '#e5e7eb'}; 
          color: ${d.category === 'Non-Partisan' ? '#000' : '#fff'}; 
          padding: 2px 8px; 
          border-radius: 4px; 
          font-size: 11px;
          font-weight: 600;
        ">
          ${d.category}
        </span>
      </div>
    </div>
    `,
    { sticky: true }
  );
};

  return (
    <div className="relative" style={{ zIndex: 0 }}>
      <MapContainer
        ref={mapRef}
        center={[-6.2, 106.8]}
        zoom={11}
        className="
          w-full
          h-[380px]
          sm:h-[450px]
          md:h-[520px]
          lg:h-[600px]
        "
        style={{ zIndex: 0 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {geojson && (
          <GeoJSON
            key={JSON.stringify(districtData)}
            data={geojson}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow-lg z-[400]">
        <div className="text-xs font-semibold mb-2">Legenda</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#22c55e" }}></div>
            <span className="text-xs">Straight Ticket</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#ef4444" }}></div>
            <span className="text-xs">Split Ticket</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#facc15" }}></div>
            <span className="text-xs">Non-Partisan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#e5e7eb" }}></div>
            <span className="text-xs">No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
