import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PaslonCard from "./PaslonCard";
import PaslonIndex from "../paslon";
import PartaiIndex from "../partai/index";
import IndexDpt from "../dpt/index";

const dummyPaslon = [
  {
    id: 1,
    name: "H. M. Ridwan Kamil - H.Suswono",
    image: "/paslon/1.png",
    parties: [
      "/partai/pkb.png",
      "/partai/gerindra.png",
      "/partai/golkar.png",
      "/partai/nasdem.png",
      "/partai/gelora.png",
      "/partai/pks.png",
      "/partai/pkn.png",
      "/partai/garuda.png",
      "/partai/pan.png",
      "/partai/pbb.png",
      "/partai/demokrat.png",
      "/partai/psi.png",
      "/partai/perindo.png",
      "/partai/ppp.png",
    ],
  },
  {
    id: 2,
    name: "Komjen Pol. (Purn). Dharma Pongrekun, S.I.K., M.M., M.Hum. - Dr. Ir. R. Kun Wardana Abyoto, M.T.",
    image: "/paslon/2.png",
    parties: [],
    isIndependent: true,
  },
  {
    id: 3,
    name: "Dr. Ir. Pramono Anung Wibowo M.M - H. Rano Karno, S.IP. (SI DOEL)",
    image: "/paslon/3.png",
    parties: [
      "/partai/pdi.png",
      "/partai/hanura.png",
    ]
  },
];



export default function PageSuaraDashboard() {
  const [activeFilter, setActiveFilter] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white rounded-lg shadow p-4">
      <div className="px-6 py-6 space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-blue-900">
          Analisis Data Suara
        </h1>
      </div>

      {activeFilter === null && (
        <>
          {/* FOTO PASLON */}
          {/* ===== MOBILE: SWIPE ===== */} 
          <div className="md:hidden">
            <div
              className="
                flex gap-4 overflow-x-auto
                snap-x snap-mandatory
                px-4 pb-4
                -mx-4
                scroll-smooth
              "
            >
              {dummyPaslon.map((paslon) => (
                <div
                  key={paslon.id}
                  className="min-w-[85%] snap-center select-none"
                >
                  <PaslonCard data={paslon} />
                </div>
              ))}
            </div>

            <div className="text-center text-xs text-slate-400 mt-2">
              Geser ke samping untuk melihat paslon →
            </div>
          </div>

          {/* ===== DESKTOP: GRID ===== */}
          <div className="hidden md:grid grid-cols-3 gap-6">
            {dummyPaslon.map((paslon) => (
              <PaslonCard key={paslon.id} data={paslon} />
            ))}
          </div>

        </>
      )}
        
      </div>
    </div>
  );
}
