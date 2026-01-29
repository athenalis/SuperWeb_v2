import React from "react";
import { useNavigate } from "react-router-dom";

export default function KoordinatorApkCreate() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-slate-900">RELAWAN APK</h1>
        <p className="text-slate-500 mt-1">Hello World — halaman Create</p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate("/koordinator/apk")}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
