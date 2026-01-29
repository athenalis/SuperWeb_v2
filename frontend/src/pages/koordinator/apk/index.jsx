import React from "react";
import { useNavigate } from "react-router-dom";

export default function KoordinatorApkIndex() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-slate-900">Koordinator APK</h1>
        <p className="text-slate-500 mt-1">Hello World — halaman Index</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/koordinator/apk/create")}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Ke Create
          </button>

          <button
            onClick={() => navigate("/koordinator/apk/detail/1")}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Ke Detail (id: 1)
          </button>

          <button
            onClick={() => navigate("/koordinator/apk/edit/1")}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          >
            Ke Edit (id: 1)
          </button>
        </div>
      </div>
    </div>
  );
}
