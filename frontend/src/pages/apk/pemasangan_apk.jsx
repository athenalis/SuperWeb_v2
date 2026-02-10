import { useEffect, useMemo, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import DataTable from "react-data-table-component"; // ✅ tetap pakai datatable
import api from "../../lib/axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

/* =====================
  HELPERS
===================== */
function normalizePaginated(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

async function safeGet(url) {
  const res = await api.get(url);
  return res.data;
}

async function fetchApkInstallations({ page, perPage }) {
  const res = await api.get("/apk-installations", {
    params: { page, per_page: perPage },
  });
  return res.data;
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${iso} WIB`;
  return (
    new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d) + " WIB"
  );
}

function fmtBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function chipClassByPaslon(paslonId) {
  const id = Number(paslonId || 0);
  if (!id) return "bg-slate-50 text-slate-700 border-slate-200";
  if (id % 3 === 0) return "bg-blue-50 text-blue-700 border-blue-200";
  if (id % 3 === 1) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

function avatarText(row) {
  const rel = row.relawan_id ? `R${row.relawan_id}` : "APK";
  return rel.slice(0, 3).toUpperCase();
}

function AvatarPhoto({ id, fallbackText }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!id) return;

    let alive = true;
    let objectUrl = null;

    (async () => {
      try {
        const res = await api.get(`/apk-installations/${id}/photo`, {
          responseType: "blob",
        });
        objectUrl = URL.createObjectURL(res.data);
        if (alive) setSrc(objectUrl);
      } catch (e) {
        if (alive) setErr(true);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center">
      {!err && src ? (
        <img
          src={src}
          alt={`Pemasangan ${id}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErr(true)}
        />
      ) : (
        <div className="w-full h-full bg-blue-600 text-white font-bold flex items-center justify-center">
          {fallbackText}
        </div>
      )}
    </div>
  );
}

/* =====================
  PAGE
===================== */
export default function PemasanganApk({ onBack }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const listQuery = useQuery({
    queryKey: ["apk-installations", page, perPage],
    queryFn: () => fetchApkInstallations({ page, perPage }),
    staleTime: 10_000,
    retry: false,
    keepPreviousData: true, // ✅ biar gak flicker
  });

  useEffect(() => {
    setPage(1);
  }, [perPage]);

  const totalPage = useMemo(() => {
    const p = listQuery.data;
    return Number(p?.last_page) || Number(p?.meta?.last_page) || 1;
  }, [listQuery.data]);

  const totalCount = useMemo(() => {
    const p = listQuery.data;
    return (
      Number(p?.total) ||
      Number(p?.meta?.total) ||
      Number(p?.pagination?.total) ||
      0
    );
  }, [listQuery.data]);

  const pages = useMemo(() => {
    return Array.from({ length: totalPage }, (_, i) => i + 1);
  }, [totalPage]);

  const rows = useMemo(() => {
    const payload = listQuery.data;
    const list = normalizePaginated(payload);

    return list.map((it) => ({
      id: it.id,
      user_id: it.user_id,
      paslon_id: it.paslon_id,
      relawan_id: it.relawan_id,
      apk_kurir_id: it.apk_kurir_id,
      relawan_nama: it.relawan_nama || null,
      apk_kurir_nama: it.apk_kurir_nama || null,
      latitude: it.latitude,
      longitude: it.longitude,
      taken_at: it.taken_at,
      photo_size: it.photo_size,
      photo_hash: it.photo_hash,
      created_at: it.created_at,
      updated_at: it.updated_at,
      photo_url: it.photo_url || null,
      raw: it,
    }));
  }, [listQuery.data]);

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.id,
        r.user_id,
        r.paslon_id,
        r.relawan_id,
        r.latitude,
        r.longitude,
        r.taken_at,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const openDetail = useCallback((row) => setSelected(row), []);

  // scroll lock modal
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev || "");
  }, [selected]);

  /**
   * ✅ DataTable dipakai sebagai “engine”
   * - UI bawaan dimatiin
   * - Kita tetap render <table> lama di bawah, jadi desain 100% sama
   */
  const dtColumns = useMemo(
    () => [
      { name: "Item", selector: (r) => r.id, sortable: false },
      { name: "Paslon", selector: (r) => r.paslon_id, sortable: false },
      {
        name: "Koordinat",
        selector: (r) => `${r.latitude},${r.longitude}`,
        sortable: false,
      },
      { name: "Ukuran", selector: (r) => r.photo_size, sortable: false },
      { name: "Waktu", selector: (r) => r.taken_at, sortable: false },
      { name: "Aksi", selector: (r) => r.id, sortable: false },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-6 md:p-8 space-y-4">
      {/* HEADER mirip Admin APK */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-blue-900 flex items-center gap-3">
                Pemasangan APK
              </h1>
              <p className="font-semibold text-slate-500 mt-1">
                Data pemasangan APK oleh relawan
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              width={20}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari relawan / paslon / tanggal"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <div className="flex font-semibold items-center gap-2">
            <span>Tampilkan</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1 bg-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>data</span>
          </div>

          <div className="text-md font-semibold text-slate-500">
            {listQuery.isLoading
              ? "Memuat..."
              : listQuery.isError
              ? "Gagal memuat"
              : `${totalCount} Data`}
          </div>
        </div>
      </div>

      {/* ✅ DataTable ENGINE (disembunyikan UI-nya, cuma buat optimasi render) */}
      <div className="hidden">
        <DataTable
          columns={dtColumns}
          data={filtered}
          noHeader
          pagination={false}
          persistTableHead={false}
          dense
        />
      </div>

      {/* TABLE CARD (DESAIN LAMA DIPERTAHANKAN 100%) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Item
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Paslon
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Koordinat Lokasi
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Ukuran Foto
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Waktu
                </th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Memuat data pemasangan...
                  </td>
                </tr>
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-red-600">
                    Gagal load. Cek endpoint GET /apk-installations
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shadow-sm">
                          <AvatarPhoto id={r.id} fallbackText={avatarText(r)} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            Pemasangan #{r.id}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.relawan_id
                              ? `Relawan ${r.relawan_nama ?? `#${r.relawan_id}`}`
                              : `Kurir ${r.apk_kurir_nama ?? `#${r.apk_kurir_id ?? "-"}`}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${chipClassByPaslon(
                          r.paslon_id
                        )}`}
                      >
                        Paslon {r.paslon_id}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                        {Number(r.latitude).toFixed(6)}, {Number(r.longitude).toFixed(6)}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {fmtBytes(r.photo_size)}
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {fmtDate(r.taken_at)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Detail"
                        >
                          <Icon icon="solar:eye-linear" width={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ✅ PAGINATION LAMA (tetap sama) */}
          {!listQuery.isLoading && !listQuery.isError && totalPage > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200">
              <div className="text-sm font-semibold text-slate-500">
                Halaman {page} dari {totalPage}
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Sebelumnya
                </button>

                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 rounded-lg border ${
                      p === page
                        ? "bg-blue-900 text-white border-blue-900"
                        : "border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  disabled={page === totalPage}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETAIL (foto + ringkasan) */}
      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* =====================
  MODAL DETAIL
===================== */
function DetailModal({ row, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    if (!row?.id) return;

    let alive = true;
    let objectUrl = null;

    (async () => {
      try {
        const res = await api.get(`/apk-installations/${row.id}/photo`, {
          responseType: "blob",
        });

        objectUrl = URL.createObjectURL(res.data);
        if (alive) setImgSrc(objectUrl);
      } catch (e) {
        if (alive) setImgError(true);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row?.id]);

  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon icon="mdi:image-multiple-outline" className="text-blue-600" width={24} />
            Detail Pemasangan #{row.id}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
            type="button"
          >
            <Icon icon="mdi:close" width={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              {!imgError && imgSrc ? (
                <img
                  src={imgSrc}
                  alt={`Pemasangan ${row.id}`}
                  className="w-full max-h-[70vh] object-contain"
                  onError={() => setImgError(true)}
                />
              ) : imgError ? (
                <div className="py-16 text-center text-slate-500">
                  Foto gagal dimuat.
                  <div className="mt-2 text-xs">
                    Cek endpoint:{" "}
                    <span className="font-mono">/apk-installations/{row.id}/photo</span>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500">Memuat foto...</div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:pl-6 lg:border-l lg:border-slate-200">
            <div className="space-y-1">
              <div className="text-sm font-bold tracking-wider text-blue-800 uppercase">
                {row.relawan_id ? "Relawan" : "Kurir"}
              </div>

              <div className="text-[20px] font-bold text-slate-800">
                {row.relawan_id
                  ? row.relawan_nama ?? `#${row.relawan_id}`
                  : row.apk_kurir_nama ?? `#${row.apk_kurir_id ?? "-"}`}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoBox label="Latitude" value={row.latitude} mono />
              <InfoBox label="Longitude" value={row.longitude} mono />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <InfoBox label="Waktu Pemasangan" value={fmtDate(row.taken_at)} />
              <InfoBox label="Ukuran Foto" value={fmtBytes(row.photo_size)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, mono = false }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>
        {String(value ?? "-")}
      </div>
    </div>
  );
}
