import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import MainLayout from "./layouts/MainLayout";

import SuperAdmin1 from "./pages/superadmin/index";

import Koordinator from "./pages/koordinator/index";
import CreateKoordinator from "./pages/koordinator/create";
import EditKoordinator from "./pages/koordinator/edit";
import RiwayatKoordinator from "./pages/koordinator/history";
import DetailKoordinator from "./pages/koordinator/detail";

import Relawan from "./pages/relawan/index";
import DetailRelawan from "./pages/relawan/detail";
import EditRelawan from "./pages/relawan/edit";
import CreateRelawan from "./pages/relawan/create";

import Kunjungan from "./pages/kunjungan/index";
import KunjunganAnggota from "./pages/kunjungan/anggota";
import KunjunganDetail from "./pages/kunjungan/detail";
import KunjunganEdit from "./pages/kunjungan/edit";
import Verifikasi from "./pages/verifikasi/index";

import Suara from "./pages/suara/dashboard/index";
import SuaraTest from "./pages/suara/test";

import Paslon from "./pages/suara/paslon/index";

import Content from "./pages/content/index";
import CreateContent from "./pages/content/create";
import EditContent from "./pages/content/edit";
import DetailContent from "./pages/content/detail";
import AnalyticContent from "./pages/content/analytic";

import Partai from "./pages/suara/partai/index";

import AnalisisPaslon from "./pages/suara/analisis/index";

import DPT from "./pages/suara/dpt/index";

import Inbox from "./pages/inbox/index";

import SuperAdmin from "./pages/SuperAdmin/index";
import Apk from "./pages/apk/index";

import RequireAuth from "./middlewares/RequireAuth";
import RequireRole from "./middlewares/RequireRole";

export default function App() {
  /**
   * ROLE ID MAPPING:
   * 1 = superadmin
   * 2 = admin_paslon
   * 3 = admin_apk
   * 4 = kunjungan_koordinator
   * 5 = apk_koordinator
   * 6 = relawan
   * 7 = apk_kurir
   */
  return (
    <Routes>

      {/* ROOT */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* LOGIN */}
      <Route path="/login" element={<Login />} />

      {/* SUPERADMIN (dengan layout sendiri) */}
      <Route path="/superadmin" element={<SuperAdmin />} />

      <Route path="/apk" element={<Apk />} />

      {/* SEMUA HARUS LOGIN */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<MainLayout />}>

          {/* SEMUA ROLE */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* ================= ADMIN_PASLON ONLY (role_id: 2) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2]} />}>
            <Route path="koordinator" element={<Koordinator />} />
            <Route path="koordinator/create" element={<CreateKoordinator />} />
            <Route path="koordinator/:id/edit" element={<EditKoordinator />} />
            <Route path="koordinator/:id/history" element={<RiwayatKoordinator />} />
            <Route path="koordinator/:id" element={<DetailKoordinator />} />
            <Route path="suara/dashboard" element={<Suara />} />
            <Route path="suara/test" element={<SuaraTest />} />
            <Route path="suara/paslon" element={<Paslon />} />
            <Route path="suara/partai" element={<Partai />} />
            <Route path="suara/dpt" element={<DPT />} />
            <Route path="suara/analisis" element={<AnalisisPaslon />} />
            <Route path="content" element={<Content />} />
            <Route path="content/create" element={<CreateContent />} />
            <Route path="content/:id/edit" element={<EditContent />} />
            <Route path="content/:id" element={<DetailContent />} />
            <Route path="content/:id/analytic" element={<AnalyticContent />} />

          </Route>

          {/* =========== ADMIN_PASLON & KUNJUNGAN_KOORDINATOR (role_id: 2, 4) =========== */}
          <Route element={<RequireRole allowedRoleIds={[2, 4]} />}>
            <Route path="relawan" element={<Relawan />} />
            <Route path="relawan/:id" element={<DetailRelawan />} />
          </Route>

          {/* =========== KUNJUNGAN_KOORDINATOR ONLY (role_id: 4) =========== */}
          <Route element={<RequireRole allowedRoleIds={[4]} />}>
            <Route path="relawan/create" element={<CreateRelawan />} />
            <Route path="relawan/:id/edit" element={<EditRelawan />} />
          </Route>

          {/* =========== ADMIN_PASLON, KUNJUNGAN_KOORDINATOR & RELAWAN (role_id: 2, 4, 6) =========== */}
          <Route element={<RequireRole allowedRoleIds={[2, 4, 6]} />}>
            <Route path="kunjungan" element={<Kunjungan />} />
            <Route path="kunjungan/anggota" element={<KunjunganAnggota />} />
            <Route path="kunjungan/:id" element={<KunjunganDetail />} />
            <Route path="kunjungan/:id/edit" element={<KunjunganEdit />} />
            <Route path="inbox" element={<Inbox />} />
          </Route>

          {/* =========== SUPER ADMIN (role_id: 1) =========== */}
          <Route element={<RequireRole allowedRoleIds={[1]} />}>
            <Route path="superadmin" element={<SuperAdmin1 />} />
          </Route>

        </Route>
      </Route>
    </Routes>
  );
}
