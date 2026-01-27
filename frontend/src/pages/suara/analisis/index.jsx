import { useEffect, useMemo, useState } from "react";
import api from "../../../lib/axios";
import { Icon } from "@iconify/react";
import MapAnalisis from "./mapAnalisis";

/* =========================
   CONSTANT
========================= */

const CATEGORY_MAP = {
  "Straight Ticket": "straight",
  "Split Ticket": "split",
  "Non-Partisan": "nonpartisan",
};

const PASLON_NAMES = {
  "01": "Ridwan Kamil - Suswono",
  "02": "Dharma Pongrekun - Kun Wardana",
  "03": "Pramono Anung - Rano Karno",
};

const PARTY_NAMES = {
  "100001": "PKB",
  "100002": "GERINDRA",
  "100003": "PDIP",
  "100004": "GOLKAR",
  "100005": "NASDEM",
  "100006": "BURUH",
  "100007": "GELORA",
  "100008": "PKS",
  "100009": "PKN",
  "100010": "HANURA",
  "100011": "GARUDA",
  "100012": "PAN",
  "100013": "PBB",
  "100014": "DEMOKRAT",
  "100015": "PSI",
  "100016": "PERINDO",
  "100017": "PPP",
  "100024": "UMMAT",
};

/* =========================
   MAIN PAGE
========================= */

export default function AnalisisPaslonIndex() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaslon, setSelectedPaslon] = useState(null);

  useEffect(() => {
    api.get("/persebaran/straight-ticket/district")
      .then((res) => {
        setData(res.data || []);
      })
      .catch((err) => {
        console.error("Analisis error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);



  /* =========================
     SUMMARY ATAS
  ========================= */
  const summary = useMemo(() => {
    const total = data.length || 1;
    const count = { straight: 0, split: 0, nonpartisan: 0 };

    data.forEach((d) => {
      const key = CATEGORY_MAP[d.category];
      if (count[key] !== undefined) count[key]++;
    });

    return {
      straight: Math.round((count.straight / total) * 100),
      split: Math.round((count.split / total) * 100),
      nonpartisan: Math.round((count.nonpartisan / total) * 100),
      count,
    };
  }, [data]);

  /* =========================
     PASLON SUMMARY
  ========================= */
  const paslonSummary = useMemo(() => {
    const base = {
      "01": { straight: 0, split: 0 },
      "02": { straight: 0, split: 0 },
      "03": { straight: 0, split: 0 },
    };

    data.forEach((d) => {
      if (!base[d.winner_paslon]) return;
      if (d.category === "Non-Partisan") return;
      base[d.winner_paslon][CATEGORY_MAP[d.category]]++;
    });

    return base;
  }, [data]);

  if (loading) return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-900"></div>
          <Icon
            icon="mdi:account-details"
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

  return (
    <div className="p-4 space-y-4">

      {/* ================= HEADER + SUMMARY ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4">
        <h1 className="text-3xl font-bold text-blue-900">
          Sebaran Data Pola Straight vs Split Ticket
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title="Straight Ticket"
            percent={summary.straight}
            count={summary.count.straight}
            color="green"
          />
          <SummaryCard
            title="Split Ticket"
            percent={summary.split}
            count={summary.count.split}
            color="red"
          />
          <SummaryCard
            title="Non-Partisan"
            percent={summary.nonpartisan}
            count={summary.count.nonpartisan}
            color="yellow"
          />
        </div>
      </div>

      {/* ================= MAP + PASLON ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* MAP */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <MapAnalisis data={data} />
        </div>

        {/* PASLON CARD */}
        <div className="lg:col-span-5 space-y-4">
          {["01", "02", "03"].map((p) => (
            <PaslonCard
              key={p}
              code={p}
              data={paslonSummary[p]}
              onClick={() =>
                setSelectedPaslon({
                  code: p,
                  districts: data.filter(
                    (d) =>
                      d.winner_paslon === p &&
                      d.category !== "Non-Partisan"
                  ),
                })
              }
            />
          ))}
        </div>
      </div>

      {/* ================= MODAL ================= */}
      {selectedPaslon && (
        <PaslonModal
          data={selectedPaslon}
          onClose={() => setSelectedPaslon(null)}
        />
      )}
    </div>
  );
}

/* =========================
   COMPONENTS
========================= */

function SummaryCard({ title, percent, count, color }) {
  const map = {
    green: "border-emerald-500 bg-emerald-50",
    red: "border-rose-500 bg-rose-50",
    yellow: "border-amber-500 bg-amber-50",
  };

  return (
    <div className={`border-l-4 p-4 rounded-lg ${map[color]}`}>
      <div className="text-sm text-slate-600">{title}</div>
      <div className="text-2xl font-bold text-slate-800">{percent}%</div>
      <div className="text-xs text-slate-500">{count} kecamatan</div>
    </div>
  );
}

function PaslonCard({ code, data, onClick }) {
  return (
    <div
      onClick={onClick}
      className="
        group cursor-pointer
        border border-slate-200 rounded-xl
        p-5 bg-white
        transition-all duration-200
        hover:border-blue-500
        hover:shadow-lg
        active:scale-[0.99]
      "
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-semibold text-slate-800">
            Paslon {code}
          </div>
          <div className="text-sm text-slate-500">
            {PASLON_NAMES[code]}
          </div>
        </div>

        {/* indikator klik */}
        <span className="
          text-slate-400
          group-hover:text-blue-600
          transition
        ">
          →
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-emerald-50 p-3 rounded-lg">
          <div className="text-slate-500">Straight</div>
          <div className="font-semibold text-emerald-700 text-lg">
            {data.straight}
          </div>
        </div>

        <div className="bg-rose-50 p-3 rounded-lg">
          <div className="text-slate-500">Split</div>
          <div className="font-semibold text-rose-700 text-lg">
            {data.split}
          </div>
        </div>
      </div>

      {/* hint kecil */}
      <div className="
        mt-3 text-xs text-slate-400
        group-hover:text-blue-600
        transition
      ">
        Klik untuk melihat detail
      </div>
    </div>
  );
}

/* =========================
   PASLON MODAL
========================= */

function PaslonModal({ data, onClose }) {
  const [open, setOpen] = useState(null);
  const districts = data.districts || [];

  const straight = districts.filter(d => d.category === "Straight Ticket");
  const split = districts.filter(d => d.category === "Split Ticket");

  const renderDistrict = (d, i) => {
    const key = `${d.district}-${i}`;

    return (
      <div key={key} className="border-b last:border-b-0">
        <button
          onClick={() => setOpen(open === key ? null : key)}
          className="w-full flex justify-between px-4 py-2 text-sm hover:bg-slate-50"
        >
          <span className="font-medium">{d.district}</span>
          <span>{open === key ? "▴" : "▾"}</span>
        </button>

        {open === key && (
          <div className="px-4 py-4 bg-slate-50 text-sm space-y-4">
                <div>
                  <div className="font-semibold mb-2">Suara Paslon</div>

                  <div className="border rounded-lg overflow-hidden bg-white">
                    {Object.entries(d.votes_paslon).map(([code, votes], i, arr) => (
                      <div
                        key={code}
                        className={`
                          flex justify-between items-center
                          px-3 py-2 text-sm
                          ${i !== arr.length - 1 ? "border-b border-slate-200" : ""}
                        `}
                      >
                        <span className="text-slate-700">
                          {PASLON_NAMES[code]}
                        </span>

                        <span className="font-medium text-slate-900">
                          {votes.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
            <hr />

           <div>  
              <div className="font-semibold mb-2">Suara Partai</div>

              <div className="border rounded-lg overflow-hidden bg-white">
                {Object.entries(d.party_votes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, votes], i, arr) => (
                    <div
                      key={code}
                      className={`
                        flex justify-between items-center
                        px-3 py-2 text-sm
                        ${i !== arr.length - 1 ? "border-b border-slate-200" : ""}
                      `}
                    >
                      <span className="text-slate-700">
                        {PARTY_NAMES[code]}
                      </span>

                      <span className="font-medium text-slate-900">
                        {votes.toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between mb-4">
          <div>
            <div className="text-sm text-slate-500">Paslon {data.code}</div>
            <div className="font-semibold text-lg">
              {PASLON_NAMES[data.code]}
            </div>
          </div>
          <button onClick={onClose} className="text-xl">×</button>
        </div>

        <Section title="Straight Ticket" color="green" count={straight.length}>
          {straight.length ? straight.map(renderDistrict) : <Empty />}
        </Section>

        <Section title="Split Ticket" color="red" count={split.length}>
          {split.length ? split.map(renderDistrict) : <Empty />}
        </Section>

        <div className="text-right mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, count, children }) {
  const map = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-rose-100 text-rose-800",
  };

  return (
    <div className="border rounded-lg mb-4">
      <div className={`px-4 py-3 flex justify-between ${map[color]}`}>
        <div className="font-semibold">{title}</div>
        <span className="text-xs px-2 py-1 bg-black/10 rounded-full">
          {count}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-3 text-sm italic text-slate-500">
      Tidak ada data
    </div>
  );
}
