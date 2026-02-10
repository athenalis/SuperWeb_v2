import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import toast from "react-hot-toast";

const TYPE = {
  IN: "penerimaan",
  OUT: "pengambilan",
  ADJUST: "penyesuaian",
};

// "100.000" -> 100
const qtyToInt = (val) => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  const first = s.split(".")[0];
  const n = Number(first.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// "2026-02-09T08:48:38.000000Z" -> "2026-02-09"
const isoToDate = (iso) => (iso ? String(iso).slice(0, 10) : "");

const mapHistoryBEtoFE = (h) => {
  const typeLabel =
    h?.type === "IN" ? TYPE.IN : h?.type === "OUT" ? TYPE.OUT : TYPE.ADJUST;

  const person =
    h?.type === "OUT"
      ? (h?.coordinator?.nama || h?.actor_name || "-")
      : (h?.creator?.name || h?.actor_name || "-");

  return {
    id: h.id,
    item_name: h?.item?.name || `Item #${h.item_id}`,
    type: typeLabel,
    qty: qtyToInt(h.qty),
    date: isoToDate(h.created_at),
    person,
    location: h?.note || "-",
  };
};


function formatDate(dateStr) {
  try {
    const [y, m, d] = (dateStr || "").split("-").map(Number);
    if (!y || !m || !d) return dateStr || "-";
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr || "-";
  }
}

function Badge({ type }) {
  const isIn = type === TYPE.IN;
  const isOut = type === TYPE.OUT;
  const cls = isIn
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : isOut
    ? "bg-slate-50 text-slate-700 border-slate-200"
    : "bg-amber-50 text-amber-800 border-amber-200";

  const label = isIn ? "PENERIMAAN" : isOut ? "PENGAMBILAN" : "ADJUST";

  return (
    <span className={["inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border", cls].join(" ")}>
      {label}
    </span>
  );
}

function DirectionIcon({ type }) {
  const isIn = type === TYPE.IN;
  const isOut = type === TYPE.OUT;

  const boxCls = isIn
    ? "bg-blue-50 border-blue-100"
    : isOut
    ? "bg-slate-50 border-slate-100"
    : "bg-amber-50 border-amber-100";

  const icon = isIn ? "solar:arrow-down-outline" : isOut ? "solar:arrow-up-outline" : "solar:refresh-outline";
  const iconCls = isIn ? "text-blue-700" : isOut ? "text-slate-700" : "text-amber-800";

  return (
    <div className={["w-11 h-11 rounded-xl flex items-center justify-center border", boxCls].join(" ")}>
      <Icon icon={icon} width={22} className={iconCls} />
    </div>
  );
}

function Amount({ qty, type }) {
  const isIn = type === TYPE.IN;
  const isOut = type === TYPE.OUT;
  const val = Number(qty || 0);

  // ADJUST: tampilkan tanpa +/- (atau mau pakai "≈" juga bisa)
  const prefix = isIn ? "+" : isOut ? "-" : "";

  return (
    <div className="text-right font-extrabold text-lg sm:text-xl tabular-nums text-slate-900">
      {prefix}
      {val.toLocaleString("id-ID")}
    </div>
  );
}

export default function History({ onBackToGudang }) {
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | penerimaan | pengambilan | penyesuaian

  // ✅ DATA dari BE
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    if (typeof onBackToGudang === "function") return onBackToGudang();
    window.history.back();
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/apk/stock/history");
        if (!data?.status) {
          toast.error(data?.message || "Gagal ambil histori");
          setRows([]);
          return;
        }

        const list = (data?.data?.data || []).map(mapHistoryBEtoFE); // paginated
        setRows(list);
      } catch (e) {
        toast.error("Gagal ambil histori (/apk/stock/history)");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filtered = useMemo(() => {
    const kw = (keyword || "").toLowerCase().trim();

    return rows.filter((x) => {
      const typeOk = typeFilter === "all" ? true : x.type === typeFilter;
      if (!kw) return typeOk;

      const hay = [x.item_name, x.person, x.location, x.type, x.date, String(x.qty)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return typeOk && hay.includes(kw);
    });
  }, [rows, keyword, typeFilter]);

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-6 md:p-8 space-y-4">
      {/* HEADER BAR */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={goBack}
              className="mt-1 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
              title="Kembali"
              aria-label="Kembali"
            >
              <Icon icon="mdi:arrow-left" width={22} />
            </button>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-blue-900 flex items-center gap-3">
                Histori Barang
              </h1>
              <p className="font-semibold text-slate-500 mt-1">
                Catatan penerimaan, pengambilan, & penyesuaian stok
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CARD */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 relative group">
            <Icon
              icon="mdi:magnify"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"
              width={22}
            />
            <input
              className="w-full border border-gray-300 pl-12 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              placeholder="Cari barang / orang / catatan..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="md:col-span-5 relative group">
            <Icon
              icon="mdi:chevron-down"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
              width={22}
            />
            <select
              className="w-full appearance-none border border-gray-300 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Semua Tipe</option>
              <option value={TYPE.IN}>Penerimaan</option>
              <option value={TYPE.OUT}>Pengambilan</option>
              <option value={TYPE.ADJUST}>Penyesuaian</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setKeyword("");
              setTypeFilter("all");
            }}
            className="w-full md:w-12 h-12 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-700 hover:border-slate-400 transition"
            title="Reset filter"
            aria-label="Reset filter"
          >
            <Icon icon="mdi:refresh" width={22} />
          </button>
        </div>
      </div>

      {/* LIST CARD */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="px-6 py-14 text-center text-slate-500">
            <Icon icon="mdi:loading" width={44} className="mx-auto mb-3 text-slate-300 animate-spin" />
            <p className="font-semibold text-lg text-slate-700">Loading histori...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-slate-500">
            <Icon icon="mdi:database-off-outline" width={44} className="mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-lg text-slate-700">Tidak ada histori</p>
            <p className="text-sm mt-1">Coba ubah filter atau kata kunci.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((h) => (
              <div key={h.id} className="px-6 py-5 hover:bg-slate-50 transition">
                <div className="flex items-start gap-4">
                  <DirectionIcon type={h.type} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="text-[18px] font-extrabold text-slate-900 truncate">
                            {h.item_name}
                          </div>
                          <Badge type={h.type} />
                        </div>

                        <div className="text-[15px] text-slate-500 mt-1">
                          {h.type === TYPE.IN
                            ? "Penerimaan barang"
                            : h.type === TYPE.OUT
                            ? "Pengambilan barang"
                            : "Penyesuaian stok"}{" "}
                          • {formatDate(h.date)}
                        </div>
                      </div>

                      <Amount qty={h.qty} type={h.type} />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-[15px] text-slate-700 min-w-0">
                        <Icon icon="solar:user-outline" width={18} className="text-slate-400" />
                        <span className="truncate">{h.person || "-"}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[15px] text-slate-700 shrink-0">
                        <Icon icon="solar:map-point-outline" width={18} className="text-slate-400" />
                        <span className="truncate max-w-[240px]">{h.location || "-"}</span>
                      </div>
                    </div>

                    {/* optional: tampilkan raw note kalau mau beda field */}
                    {/* <div className="text-xs text-slate-400 mt-2">{h.location}</div> */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
