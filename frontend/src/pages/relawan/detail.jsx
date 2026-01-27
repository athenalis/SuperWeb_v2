import { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../lib/axios";
import { Icon } from "@iconify/react";

/* =========================
   HELPERS
========================= */
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status) {
  const config = {
    pending: { label: "Pending", bg: "bg-amber-100 text-amber-700" },
    accepted: { label: "Setuju", bg: "bg-green-100 text-green-700" },
    rejected: { label: "Tolak", bg: "bg-red-100 text-red-700" },
  };
  const c = config[status] || { label: status, bg: "bg-slate-100 text-slate-700" };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.bg}`}>
      {c.label}
    </span>
  );
}

/* =========================
   SUB COMPONENTS
========================= */
function Section({ title, children, action }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-6 bg-blue-900 rounded-full" />
          <h2 className="text-lg font-semibold text-slate-800">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {children}
    </div>
  );
}

function Field({ label, value, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="border rounded-lg px-5 py-4 space-y-1">
        <div className="text-sm font-medium text-slate-500">
          {label}
        </div>
        <div className="text-base text-slate-800">
          {value || "-"}
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function RelawanDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ormasList, setOrmasList] = useState([]);
  const role = localStorage.getItem("role");

  const ormasName = useMemo(() => {
    if (!data || !ormasList.length) return "-";
    return ormasList.find(o => o.id === data.ormas_id)?.nama_ormas || "-";
  }, [data, ormasList]);

  // GET DATA DETAIL
  useEffect(() => {
    setNotFound(false);
    api.get(`/relawan/${id}`)
      .then(res => setData(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setNotFound(true);
          toast.error("Data relawan tidak ditemukan");
        } else {
          toast.error("Gagal memuat data relawan");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.get("/ormas")
      .then(res => setOrmasList(res.data.data))
      .catch(() => setOrmasList([]));
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-900"></div>
            <Icon
              icon="mdi:account-group"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-900"
              width="28"
            />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">Memuat Data</p>
            <p className="text-sm text-slate-500">Mohon tunggu sebentar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Icon icon="mdi:account-off-outline" width="64" className="mb-4 opacity-30" />
        <h3 className="text-xl font-bold text-slate-600 mb-2">Relawan Tidak Ditemukan</h3>
        <p className="mb-6">Data relawan dengan ID tersebut tidak tersedia atau sudah dihapus.</p>
        <button
          onClick={() => navigate("/relawan")}
          className="px-5 py-2 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition"
        >
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-2 sm:px-4">
      <div className="w-full max-w-8xl bg-white rounded-xl shadow p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 lg:space-y-12">

        <div className="relative pt-2 sm:pt-4 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 border-b pb-4 sm:pb-6 lg:pb-8">
          <div className="text-center md:text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-blue-900 leading-tight">
              {data.nama}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Detail Profil Relawan</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            {role !== "admin" && (
              <button
                onClick={() => navigate(`/relawan/${id}/edit`)}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm hover:bg-amber-100 transition-all shadow-sm"
              >
                <Icon icon="solar:pen-outline" width={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Edit Profil</span>
                <span className="sm:hidden">Edit</span>
              </button>
            )}
            <button
              onClick={() => navigate("/relawan")}
              className="flex-1 md:flex-none px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 bg-slate-100 text-slate-600 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-200 transition-all"
            >
              Kembali
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {/* LEFT COLUMN: BASIC INFO */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 lg:space-y-12">
            <Section title="Informasi Personal">
              <Grid>
                <Field label="Nama Lengkap" value={data.nama} />
                <Field label="NIK" value={data.nik} />
                <Field label="Email" value={data.user?.email || "-"} />
                <Field label="Nomor Telepon" value={data.no_hp} />
                <Field label="TPS" value={data.tps} />
                <Field label="Ormas" value={ormasName} />
                <Field label="Koordinator" value={data.koordinator?.nama || data.koordinator || "-"} />
                <Field label="Alamat Detail" value={data.alamat} full />
              </Grid>
            </Section>

            <Section title="Wilayah Penugasan">
              <Grid>
                <Field label="Provinsi" value={data.province?.province} />
                <Field label="Kota/Kabupaten" value={data.city?.city} />
                <Field label="Kecamatan" value={data.district?.district} />
                <Field label="Kelurahan" value={data.village?.village} />
              </Grid>
            </Section>
          </div>

          {/* RIGHT COLUMN: STATS & STATUS */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-100 space-y-4 sm:space-y-6">
              <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">Status Akun</h3>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${data.status === "active" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                <span className="text-lg sm:text-xl font-bold text-slate-800">
                  {data.status === "active" ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
