import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, GeoJSON, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import * as turf from "@turf/turf"

/* ================= ICON ================= */
const createPushPinIconActive = (color, extraClass = "") =>
  L.divIcon({
    html: `
      <div class="pin-wrapper ${extraClass}">
        <svg xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 256 256"
          fill="${color}">
          <path d="M136 127.42V232a8 8 0 0 1-16 0V127.42a56 56 0 1 1 16 0Z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: "", // jangan diisi
  })

const createPushPinIcon = (color = "#ffffffff") =>
  L.divIcon({
    html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,.35));
        ">
          <svg xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 256 256"
            fill="${color}">
            <path d="M136 127.42V232a8 8 0 0 1-16 0V127.42a56 56 0 1 1 16 0Z"/>
          </svg>
        </div>
      `,
    iconSize: [32, 32],
    iconAnchor: [16, 32], // ujung pin ke titik
    className: "",
  })

const pushPinIcon = createPushPinIcon("rgba(0, 64, 240, 1)")
const pushPinIconActive = createPushPinIconActive("#ffffff", "pin-active")


/* ================= HELPERS ================= */
const BASE_FILL_OPACITY = 0.15
const ACTIVE_FILL_OPACITY = 0.5

const normalizeVillage = (value = "") => {
  const raw = value.trim().toUpperCase()
  const key = raw.replace(/\s+/g, "")

  const map = {
    HALIMPERDANAKUSUMAH: "HALIM PERDANA KUSUMA",
    PAPANGO: "PAPANGGO",
    KAMPUNGTENGAH: "TENGAH",
    PALMERIEM: "PALMERIAM",
    TANJUNGPRIUK: "TANJUNG PRIOK",
    WIJAYAKESUMA: "WIJAYA KUSUMA",
    HARAPANMULYA: "HARAPAN MULIA",
    PREPEDAN: "TEGAL ALUR",
    BALEKAMBANG: "BALEKAMBANG",
    JATIPULO: "JATIPULO",
    KALIBARU: "KALIBARU",
    KALIANYAR: "KALI ANYAR",
    RAWABADAKSELATAN: "RAWA BADAK SELATAN",
    RAWABADAKUTARA: "RAWA BADAK UTARA",
  }

  return map[key] ?? raw
}

const getOffsetPosition = (center, index, total) => {
  if (total === 1) return center

  const radius = 0.00035 // jarak offset (AMAN untuk zoom 12)
  const angle = (index / total) * Math.PI * 2

  return [
    center[0] + radius * Math.sin(angle),
    center[1] + radius * Math.cos(angle),
  ]
}

/* ================= COMPONENT ================= */
export default function VisitMap({ visits }) {
  const [villages, setVillages] = useState(null)
  const [activeVillage, setActiveVillage] = useState(null)
  const geoJsonRef = useRef(null)
  const markerRefs = useRef({})
  const [hoverVillage, setHoverVillage] = useState(null)
  const isDraggingRef = useRef(false)
  const touchStartRef = useRef(null)

  useEffect(() => {
    Object.entries(markerRefs.current).forEach(([key, marker]) => {
      if (!marker) return

      if (key === activeVillage || key === hoverVillage) {
        marker.openTooltip()
      } else {
        marker.closeTooltip()
      }
    })
  }, [activeVillage, hoverVillage])


  useEffect(() => {
    fetch("/data/id31_dki_jakarta_village.geojson")
      .then(res => res.json())
      .then(setVillages)
  }, [])

  const getVillageFeature = (name) => {
    if (!villages) return null
    const target = normalizeVillage(name)
    return villages.features.find(
      f => normalizeVillage(f.properties.village) === target
    )
  }

  const getVillageCenter = (name) => {
    const feature = getVillageFeature(name)
    if (!feature) return null
    const [lng, lat] = turf.centroid(feature).geometry.coordinates
    return [lat, lng]
  }

  /* ================= STYLE (SINGLE SOURCE OF TRUTH) ================= */
  const villageStyle = (feature) => {
    const name = normalizeVillage(feature.properties.village)

    const isActive = name === activeVillage
    const isHover = name === hoverVillage && !activeVillage

    return {
      color: "#ffffff",
      weight: isActive || isHover ? 2 : 0,
      opacity: 0.9,
      fillColor: "#2563eb",
      fillOpacity:
        isActive
          ? ACTIVE_FILL_OPACITY
          : isHover
            ? ACTIVE_FILL_OPACITY
            : BASE_FILL_OPACITY,
    }
  }

  const onEachVillage = (feature, layer) => {
    const name = normalizeVillage(feature.properties.village)

    layer.on({
      mouseover: () => {
        if (name === activeVillage) return
        setHoverVillage(name)
      },

      mouseout: () => {
        if (name === activeVillage) return
        setHoverVillage(null)
      },

      click: () => {
        if (isDraggingRef.current) return

        setActiveVillage(prev => (prev === name ? null : name))
        setHoverVillage(null)
      },
    })
  }

  if (!villages) return null
  
  const uniqueVisits = Object.values(
    visits.reduce((acc, v) => {
      const key = `${v.village_code}-${v.koordinator_id}`
      acc[key] = v
      return acc
    }, {})
  )

  const visitsByVillage = uniqueVisits.reduce((acc, v) => {
    const key = normalizeVillage(v.village_name)
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {})



  return (
    <MapContainer
      center={[-6.237812, 106.854268]}
      zoom={12}
      className="h-full w-full"
      whenCreated={(map) => {
        map.on("touchstart", (e) => {
          touchStartRef.current = e.touches?.[0] || null
          isDraggingRef.current = false
        })

        map.on("touchmove", (e) => {
          if (!touchStartRef.current) return
          const t = e.touches?.[0]
          if (!t) return

          const dx = Math.abs(t.clientX - touchStartRef.current.clientX)
          const dy = Math.abs(t.clientY - touchStartRef.current.clientY)

          // threshold drag (PIXEL BASED, BUKAN TIME)
          if (dx > 6 || dy > 6) {
            isDraggingRef.current = true
          }
        })

        map.on("touchend", () => {
          // JANGAN reset langsung
          setTimeout(() => {
            isDraggingRef.current = false
            touchStartRef.current = null
          }, 150)
        })
      }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* ===== AREA ===== */}
      <GeoJSON
        ref={geoJsonRef}
        data={villages}
        style={villageStyle}
        onEachFeature={onEachVillage}
      />

      {/* ===== MARKER + TOOLTIP ===== */}
      {Object.entries(visitsByVillage).flatMap(([villageName, villageVisits]) => {
        const center = getVillageCenter(villageName)
        if (!center) return []

        return villageVisits.map((v, idx) => {
          const position = getOffsetPosition(
            center,
            idx,
            villageVisits.length
          )

          const name = normalizeVillage(v.village_name)
          const markerKey = `${v.village_code}-${v.koordinator_id}`

          return (
            <Marker
              key={markerKey}
              position={position}
              icon={activeVillage === name ? pushPinIconActive : pushPinIcon}
              eventHandlers={{
                mouseover: () => {
                  if (name === activeVillage) return
                  setHoverVillage(name)
                },
                mouseout: () => {
                  if (name === activeVillage) return
                  setHoverVillage(null)
                },
                click: () => {
                  if (isDraggingRef.current) return
                  setActiveVillage(prev => (prev === name ? null : name))
                  setHoverVillage(null)
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -25]}
                opacity={1}
                className="visit-tooltip"
                permanent={activeVillage === name || hoverVillage === name}
              >
                <div className="bg-white rounded-lg shadow-lg px-4 py-3 min-w-[220px] text-sm">
                  <div className="text-xs text-slate-500 uppercase mb-1">
                    Kelurahan
                  </div>
                  <div className="font-semibold text-slate-800 mb-2">
                    {v.village_name}
                  </div>

                  <div className="text-xs text-slate-500 mb-2">
                    Koordinator
                  </div>
                  <div className="font-medium mb-3">
                    {v.koordinator_name ?? "—"}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="font-semibold">{v.total_kunjungan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="text-green-600">{v.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending</span>
                      <span className="text-yellow-600">{v.pending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rejected</span>
                      <span className="text-red-600">{v.rejected}</span>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          )
        })
      })}

    </MapContainer>
  )
}