import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/axios";

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

export default function RiwayatKoordinator() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [koordinator, setKoordinator] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================
  // LOAD API
  // =========================
  useEffect(() => {
    api
      .get(`/koordinator/${id}/history`)
      .then((res) => {
        setKoordinator(res.data.data.koordinator);
        setRiwayat(res.data.data.histories);
      })
      .catch(() => alert("Gagal memuat riwayat perubahan"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-center py-10">Loading...</p>;
  if (!koordinator) return <p className="text-center py-10">Data tidak ditemukan</p>;

  return (
    <div className="bg-[#eef4ef] flex items-center justify-center p-10">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow p-8">

        {/* TITLE */}
        <h1 className="text-3xl font-bold text-center text-blue-900">
          Riwayat Perubahan
        </h1>

        {/* SUBTITLE */}
        <p className="text-center text-slate-500 mt-1">
          Koordinator:{" "}
          <span className="font-medium text-slate-700">
            {koordinator.nama}
          </span>
        </p>

        {/* TABLE */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-50 text-center text-blue-900">
                <th className="px-4 py-3 font-semibold text-md">Waktu</th>
                <th className="px-4 py-3 font-semibold text-md">Kolom</th>
                <th className="px-4 py-3 font-semibold text-md">Dari</th>
                <th className="px-4 py-3 font-semibold text-md">Menjadi</th>
                <th className="px-4 py-3 font-semibold text-md">Diubah Oleh</th>
              </tr>
            </thead>

            <tbody>
              {riwayat.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-slate-500">
                    Belum ada perubahan
                  </td>
                </tr>
              ) : (
                riwayat.map((item, index) => (
                  <tr key={index} className="border-b last:border-b-0 text-slate-700">
                    <td className="px-4 py-3 text-sm">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-sm">{item.field}</td>
                    <td className="px-4 py-3 text-sm text-red-500">{item.old_value}</td>
                    <td className="px-4 py-3 text-sm text-green-700">{item.new_value}</td>
                    <td className="px-4 py-3 text-sm">{item.user?.name || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>  
          </table>
        </div>

        {/* BUTTON */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => navigate(-1)}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg font-medium transition"
          >
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
