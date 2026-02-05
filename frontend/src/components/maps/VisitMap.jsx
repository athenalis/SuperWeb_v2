import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, GeoJSON, Tooltip, useMap } from "react-leaflet"
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

const toNumber = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : null
}

const formatVisitedAt = (v) => {
  const raw = v?.visited_at || v?.created_at
  if (!raw) return "—"

  // visited_at: "2026-02-04 08:07:30"
  // created_at:  "2026-02-04T08:07:30.000000Z"
  const d = new Date(raw.replace(" ", "T"))
  if (isNaN(d.getTime())) return raw

  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const findVillageByPoint = (villagesGeoJson, lat, lng) => {
  if (!villagesGeoJson?.features?.length) return null

  const pt = turf.point([lng, lat])

  // cari feature yang memuat titik
  return (
    villagesGeoJson.features.find((f) => {
      try {
        return turf.booleanPointInPolygon(pt, f)
      } catch {
        return false
      }
    }) || null
  )
}

const getVisitVillageName = (v) => {
  return (
    v?.relawan_village_name ||
    v?.relawanVillageName ||
    v?.village ||
    v?.village_name ||
    v?.kelurahan ||
    v?.kelurahan_name ||
    v?.nama_kelurahan ||
    v?.nama_kel ||
    ""
  )
}

// ===== helpers (ganti yang verifBadgeStyle + verifLabel) =====
const verifBadgeStyle = (status) => {
  const s = String(status || "").toLowerCase()

  // ✅ pending: font coklat #5c3a00
  if (s === "pending") return { bg: "#fecc5c", text: "#5c3a00" }

  if (s === "rejected" || s === "invalid") return { bg: "#f03b20", text: "#ffffff" }

  if (s === "approved" || s === "verified" || s === "valid")
    return { bg: "#31a354", text: "#ffffff" }

  return { bg: "#9ca3af", text: "#ffffff" }
}


const verifLabel = (status) => {
  const s = String(status || "").toLowerCase()
  if (!s) return "—"
  if (s === "invalid") return "Rejected"
  if (s === "verified" || s === "valid") return "Approved"
  if (s === "approved") return "Approved"
  if (s === "rejected") return "Rejected"
  if (s === "pending") return "Pending"

  // fallback: "some_status" => "Some status"
  const pretty = s.replaceAll("_", " ")
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

function FlyToActive({ target, zoom = 16 }) {
  const map = useMap()
  const prevTargetRef = useRef(null)

  useEffect(() => {
    if (!target) return

    const prev = prevTargetRef.current
    prevTargetRef.current = target

    // kalau target sama persis, skip
    if (prev && prev[0] === target[0] && prev[1] === target[1]) return

    // stop animasi sebelumnya biar nggak "geter"
    map.stop()

    const currentCenter = map.getCenter()
    const currentZoom = map.getZoom()
    const dist = map.distance(currentCenter, L.latLng(target[0], target[1]))

    // ✅ selalu minimal zoom ke `zoom`
    const targetZoom = Math.max(currentZoom, zoom)

    // durasi lebih smooth (dinamis by jarak)
    const duration =
      dist < 250 ? 0.45 :
      dist < 800 ? 0.60 :
      dist < 2000 ? 0.80 :
      1.10

    // kalau dekat dan nggak perlu zoom, cukup panTo biar halus (tanpa "fly" yang kadang geter)
    const near = dist < 300
    const needZoom = targetZoom !== currentZoom

    if (near && !needZoom) {
      map.panTo(target, { animate: true, duration: 0.45, easeLinearity: 0.18 })
      return
    }

    // ✅ jauh / atau butuh zoom naik -> flyTo
    map.flyTo(target, targetZoom, { animate: true, duration, easeLinearity: 0.18 })
  }, [map, target, zoom])

  return null
}

/* ================= COMPONENT ================= */
export default function VisitMap({ visits }) {
  const [villages, setVillages] = useState(null)
  const [activeVillage, setActiveVillage] = useState(null)
  const [activeVisitPos, setActiveVisitPos] = useState(null)
  const geoJsonRef = useRef(null)
  const markerRefs = useRef({})
  const [hoverVillage, setHoverVillage] = useState(null)
  const isDraggingRef = useRef(false)
  const touchStartRef = useRef(null)
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [hoverVisitId, setHoverVisitId] = useState(null)
  const mapRef = useRef(null)
  const activeVisitIdRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const apply = () => setIsMobile(!!mq.matches)
    apply()
    mq.addEventListener?.("change", apply)
    return () => mq.removeEventListener?.("change", apply)
  }, [])

  useEffect(() => {
    activeVisitIdRef.current = activeVisitId
  }, [activeVisitId])

  useEffect(() => {
    Object.entries(markerRefs.current).forEach(([key, marker]) => {
      if (!marker) return

      if (key === String(activeVisitId) || key === String(hoverVisitId)) {
        marker.openTooltip()
      } else {
        marker.closeTooltip()
      }
    })
  }, [activeVisitId, hoverVisitId])

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
  
  const visitsByCoord = visits.reduce((acc, v) => {
    const lat = toNumber(v.latitude)
    const lng = toNumber(v.longitude)
    if (lat == null || lng == null) return acc

    const key = `${lat.toFixed(6)}|${lng.toFixed(6)}`
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
        mapRef.current = map
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
      <FlyToActive target={activeVisitPos} zoom={16} />

      {/* ===== AREA ===== */}
      <GeoJSON
        ref={geoJsonRef}
        data={villages}
        style={villageStyle}
        onEachFeature={onEachVillage}
      />

      {/* ===== MARKER + TOOLTIP ===== */}
      {Object.entries(visitsByCoord).flatMap(([coordKey, samePointVisits]) => {
      const [latStr, lngStr] = coordKey.split("|")
      const lat0 = parseFloat(latStr)
      const lng0 = parseFloat(lngStr)
      if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return []
      const center = [lat0, lng0]

      return samePointVisits.map((v, idx) => {
        const position = getOffsetPosition(center, idx, samePointVisits.length)
        const markerKey = String(v.id) // UNIQUE & stabil

        const isActive = activeVisitId === v.id
        const isHover = hoverVisitId === v.id

        return (
          <Marker
            key={markerKey}
            position={position}
            icon={isActive ? pushPinIconActive : pushPinIcon}
            ref={(ref) => (markerRefs.current[markerKey] = ref)}
            eventHandlers={{
              mouseover: () => setHoverVisitId(v.id),
              mouseout: () => {
                if (activeVisitIdRef.current === v.id) return
                setHoverVisitId(null)
              },
              click: () => {
                if (isDraggingRef.current) return

                setActiveVisitId((prev) => {
                  const next = prev === v.id ? null : v.id

                  if (next) {
                    setActiveVisitPos(position)

                    const feature = findVillageByPoint(villages, position[0], position[1])
                    if (feature) {
                      const villageName = normalizeVillage(feature.properties.village)
                      setActiveVillage(villageName)
                      setHoverVillage(null)
                    } else {
                      setActiveVillage(null)
                    }

                    // ✅ paksa tooltip langsung kebuka & "nempel"
                    requestAnimationFrame(() => {
                      const m = markerRefs.current[markerKey]
                      if (m?.openTooltip) m.openTooltip()
                    })
                  } else {
                    setActiveVillage(null)
                    setActiveVisitPos(null)

                    requestAnimationFrame(() => {
                      const m = markerRefs.current[markerKey]
                      if (m?.closeTooltip) m.closeTooltip()
                    })
                  }

                  return next
                })
              },
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -28]}
              opacity={1}
              className="visit-tooltip"
              permanent={isActive}
              interactive={true}
            >
              <div
                className={`bg-white rounded-xl shadow-lg border border-slate-200
                ${isMobile ? "px-2 py-1.5 min-w-[180px] text-[10px]" : "px-4 py-3 min-w-[300px] text-[13px]"}`}
              >
                {/* Header ala DPT */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`${isMobile ? "text-[8px] mb-0.5" : "text-[10px] mb-1"} tracking-widest uppercase text-slate-400`}>
                      KELURAHAN
                    </div>
                    <div className={`${isMobile ? "text-[12px]" : "text-base"} font-semibold text-slate-800 leading-tight`}>
                      {getVisitVillageName(v) ? normalizeVillage(getVisitVillageName(v)) : "—"}
                    </div>
                  </div>

                  {(() => {
                    const badge = verifBadgeStyle(v.status_verifikasi)
                    return (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: isMobile ? 20 : 18,
                          lineHeight: isMobile ? "20px" : "18px",
                          padding: isMobile ? "0 8px" : "0 7px",
                          borderRadius: 9999,
                          backgroundColor: badge.bg,
                          color: badge.text,
                          fontSize: isMobile ? 10 : 9,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {verifLabel(v.status_verifikasi)}
                      </span>
                    )
                  })()}
                </div>

                <div className={`border-t border-slate-200 ${isMobile ? "my-1.5" : "my-3"}`} />

                {/* Rows ala DPT (label kiri - value kanan) */}
                <div className={`${isMobile ? "space-y-1" : "space-y-2"}`}>
                  <div className={`flex justify-between ${isMobile ? "gap-3" : "gap-6"}`}>
                    <span className="text-slate-500">Koordinator</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {v.koordinator_name ?? "—"}
                    </span>
                  </div>

                  <div className={`flex justify-between ${isMobile ? "gap-2" : "gap-6"}`}>
                    <span className="text-slate-500">Relawan</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {v.relawan_name ?? "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">Kepala Keluarga</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {v.kepala_keluarga_name ?? "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">Jumlah Anggota</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {v.jumlah_anggota_keluarga ?? 0}
                    </span>
                  </div>

                  {/* ✅ kasih jarak biar “Tanggal Kunjungan” ga mepet */}
                  <div className="pt-1 flex justify-between gap-6">
                    <span className="text-slate-500">Tanggal Kunjungan</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {formatVisitedAt(v)}
                    </span>
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