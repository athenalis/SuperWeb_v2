import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { createPortal } from "react-dom";

export default function PaslonCard({ data }) {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(false);

  const isIndependent =
    data.isIndependent || data.parties?.length === 0;

  const handleClick = () => {
    if (isIndependent) {
      setOpenModal(true);
      return;
    }

  };

  return (
    <>
      <div
        onClick={handleClick}
        className="cursor-pointer
                   bg-white border border-gray-400 rounded-lg p-6
                   flex flex-col hover:shadow-md transition h-full"
      >
        {/* FOTO PASLON */}
        <div className="w-full h-68 bg-gray-100 rounded overflow-hidden
                        flex items-center justify-center mb-4">
          <img
            src={data.image}
            alt={data.name}
            className="h-full w-auto object-contain"
          />
        </div>

        {/* NAMA PASLON */}
        <div className="min-h-[40px] flex items-center justify-center mb-4">
          <h3 className="font-semibold text-md text-center leading-snug">
            {data.name}
          </h3>
        </div>

        <div className="flex-grow" />

        {/* PARTAI / INDEPENDEN */}
        <div className="pt-3 border-t min-h-[96px]">
          <p className="text-[11px] text-gray-500 text-center mb-2">
            {isIndependent ? "Status Pencalonan" : "Partai Pendukung"}
          </p>

          {isIndependent ? (
            <div className="flex justify-center">
              <span className="px-3 py-1 text-xs rounded-full
                               bg-slate-100 text-slate-600">
                Pasangan Calon Perseorangan
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {data.parties.map((logo, idx) => (
                <div
                  key={idx}
                  className="w-10 h-10 bg-white border rounded
                             flex items-center justify-center"
                >
                  <img
                    src={logo}
                    alt="Partai"
                    className="max-h-6 object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL INDEPENDEN ================= */}
      {openModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            
            {/* BACKDROP */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpenModal(false)}
            />

            {/* MODAL */}
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Analisis Tidak Tersedia
              </h2>

              <p className="text-slate-600 mb-6">
                Paslon ini merupakan
                <span className="font-semibold"> pasangan calon independen</span>,
                sehingga tidak memiliki analisis koalisi partai politik.
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setOpenModal(false)}
                  className="px-5 py-2 rounded-lg bg-blue-900 text-white
                             hover:bg-blue-800 transition"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>,
          document.getElementById("modal-root")
        )
      }
    </>
  );
}
