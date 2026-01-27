import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-100 relative">
      <Navbar />

      {/* CONTENT */}
      <main className="p-6">
        <Outlet />
      </main>

      {/* TEMPAT MODAL GLOBAL */}
      <div id="modal-root"></div>
    </div>
  );
}
