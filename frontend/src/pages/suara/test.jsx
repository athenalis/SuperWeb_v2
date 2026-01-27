import { useMemo, useState } from "react";
import SuaraCharts from "../../components/chart";

export default function PageSuara() {
  const [activeTab, setActiveTab] = useState("paslon");
  const [showFilter, setShowFilter] = useState(false);

  // ===== CASCADING STATE =====
  const [selectedKota, setSelectedKota] = useState("");
  const [selectedKecamatan, setSelectedKecamatan] = useState("");
  const [selectedKelurahan, setSelectedKelurahan] = useState("");

  /* ======================
     DATA PASLON (DUMMY)
  ====================== */
  const kandidat = [
    { nama: "Ridwan Kamil - Suswono", suara: 1718162 },
    { nama: "Dharma Pongrekun - Kun Wardana", suara: 459230 },
    { nama: "Pramono Anung - Rano Karno", suara: 2183239 },
  ];

  const suaraSah = 4360631;
  const suaraTidakSah = 363747;

  const summary = useMemo(
    () => ({
      labels: kandidat.map((k) => k.nama),
      values: kandidat.map((k) => k.suara),
    }),
    []
  );

  /* ======================
     DATA WILAYAH (DUMMY)
  ====================== */
  const wilayah = {
    "Jakarta Selatan": {
      Tebet: ["Manggarai", "Menteng Dalam"],
      Pancoran: ["Kalibata", "Rawajati"],
    },
    "Jakarta Barat": {
      KebonJeruk: ["Sukabumi Utara", "Sukabumi Selatan"],
      Palmerah: ["Slipi", "Kota Bambu"],
    },
  };

  const kotaList = Object.keys(wilayah);
  const kecamatanList = selectedKota
    ? Object.keys(wilayah[selectedKota])
    : [];
  const kelurahanList =
    selectedKota && selectedKecamatan
      ? wilayah[selectedKota][selectedKecamatan]
      : [];

  /* ======================
     DATA TABLE (DUMMY)
  ====================== */
  const tableData = [
    { nama: "Wilayah A", rk: 120000, dp: 30000, pr: 150000 },
    { nama: "Wilayah B", rk: 98000, dp: 21000, pr: 130000 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ================= HEADER ================= */}
        <div className="bg-white rounded-2xl shadow p-8">
          {/* <h2 className="text-3xl font-bold text-slate-800">
            Dashboard Suara
          </h2>
          <p className="text-slate-500">
            Ringkasan & visualisasi data suara
          </p> */}

          {/* TAB */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {[
              { id: "paslon", label: "Suara Paslon", desc: "Perolehan suara pasangan calon" },
              { id: "partai", label: "Suara Partai", desc: "Distribusi suara partai politik" },
              { id: "dpt", label: "Data Pemilih Tetap (DPT)", desc: "Jumlah pemilih terdaftar" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  rounded-xl p-6 text-left transition border
                  ${activeTab === tab.id
                    ? "bg-blue-900 text-white border-blue-900"
                    : "border-slate-200 hover:border-blue-500 hover:bg-blue-50"}
                `}
              >
                <div className={`text-xl font-semibold ${activeTab === tab.id ? "text-white" : "text-slate-800"}`}>
                  {tab.label}
                </div>
                <div className={`text-sm mt-1 ${activeTab === tab.id ? "text-blue-100" : "text-slate-500"}`}>
                  {tab.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ================= TAB PASLON ================= */}
        {activeTab === "paslon" && (
          <div className="space-y-6">
          

            {/* FILTER BUTTON */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="px-4 py-2 rounded-lg border border-blue-600
                           text-blue-600 hover:bg-blue-600 hover:text-white transition"
              >
                {showFilter ? "Tutup Filter" : "Filter"}
              </button>
            </div>

            {/* ===== DEFAULT VIEW ===== */}
            {!showFilter && (
              <>
                <SuaraCharts summary={summary} />

                {/* SUARA SAH / TIDAK SAH */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="flex">
                    <div className="w-[92.3%] bg-green-500 text-white p-4">
                      <div className="text-2xl font-bold">92.3%</div>
                      <div>{suaraSah.toLocaleString()}</div>
                      <div className="text-sm">Suara Sah</div>
                    </div>
                    <div className="w-[7.7%] bg-red-500 text-white p-4 text-right">
                      <div className="text-2xl font-bold">7.7%</div>
                      <div>{suaraTidakSah.toLocaleString()}</div>
                      <div className="text-sm">Tidak Sah</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== FILTER MODE (CASCADING) ===== */}
            {showFilter && (
              <div className="bg-white rounded-xl shadow p-6 space-y-6">

                {/* FILTER SELECT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={selectedKota}
                    onChange={(e) => {
                      setSelectedKota(e.target.value);
                      setSelectedKecamatan("");
                      setSelectedKelurahan("");
                    }}
                    className="border rounded-lg p-2"
                  >
                    <option value="">Pilih Kota</option>
                    {kotaList.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>

                  <select
                    value={selectedKecamatan}
                    onChange={(e) => {
                      setSelectedKecamatan(e.target.value);
                      setSelectedKelurahan("");
                    }}
                    disabled={!selectedKota}
                    className="border rounded-lg p-2 disabled:bg-slate-100"
                  >
                    <option value="">Pilih Kecamatan</option>
                    {kecamatanList.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>

                  <select
                    value={selectedKelurahan}
                    onChange={(e) => setSelectedKelurahan(e.target.value)}
                    disabled={!selectedKecamatan}
                    className="border rounded-lg p-2 disabled:bg-slate-100"
                  >
                    <option value="">Pilih Kelurahan</option>
                    {kelurahanList.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                {/* CHART + TABLE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SuaraCharts summary={summary} />

                  <div className="overflow-x-auto">
                    <table className="w-full border text-sm rounded-lg overflow-hidden">
                      <thead className="bg-blue-600 text-white">
                        <tr>
                          <th className="p-3 text-left">Wilayah</th>
                          <th className="p-3">RK</th>
                          <th className="p-3">DP</th>
                          <th className="p-3">PR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row) => (
                          <tr key={row.nama} className="border-t text-center">
                            <td className="p-3 text-left">{row.nama}</td>
                            <td className="p-3">{row.rk.toLocaleString()}</td>
                            <td className="p-3">{row.dp.toLocaleString()}</td>
                            <td className="p-3 bg-emerald-100 font-semibold">
                              {row.pr.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ================= TAB PARTAI ================= */}
        {activeTab === "partai" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-semibold">Suara Partai</h3>
            <p className="text-slate-500">(Placeholder)</p>
          </div>
        )}

        {/* ================= TAB DPT ================= */}
        {activeTab === "dpt" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-semibold">Data Pemilih Tetap (DPT)</h3>
            <p className="text-slate-500">(Placeholder)</p>
          </div>
        )}

      </div>
    </div>
  );
}
