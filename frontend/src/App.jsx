import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import MainLayout from "./layouts/MainLayout";

import SuperAdmin1 from "./pages/superadmin/index";

import Koordinator from "./pages/koordinator/kunjungan/index";
import CreateKoordinator from "./pages/koordinator/kunjungan/create";
import EditKoordinator from "./pages/koordinator/kunjungan/edit";
import DetailKoordinator from "./pages/koordinator/kunjungan/detail";

import KoordinatorApk from "./pages/koordinator/apk/index";
import CreateKoordinatorApk from "./pages/koordinator/apk/create";
import EditKoordinatorApk from "./pages/koordinator/apk/edit";
import DetailKoordinatorApk from "./pages/koordinator/apk/detail";

import RelawanApk from "./pages/relawan/apk/index";
import DetailRelawanApk from "./pages/relawan/apk/detail";
import EditRelawanApk from "./pages/relawan/apk/edit";
import CreateRelawanApk from "./pages/relawan/apk/create";

import Relawan from "./pages/relawan/kunjungan/index";
import DetailRelawan from "./pages/relawan/kunjungan/detail";
import EditRelawan from "./pages/relawan/kunjungan/edit";
import CreateRelawan from "./pages/relawan/kunjungan/create";

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

      {/* SEMUA HARUS LOGIN */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<MainLayout />}>

          {/* SEMUA ROLE */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* ================= ADMIN_PASLON ONLY (role_id: 2) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2]} />}>
            <Route path="koordinator/kunjungan" element={<Koordinator />} />
            <Route path="koordinator/kunjungan/create" element={<CreateKoordinator />} />
            <Route path="koordinator/kunjungan/:id/edit" element={<EditKoordinator />} />
            <Route path="koordinator/kunjungan/:id" element={<DetailKoordinator />} />
            <Route path="koordinator/apk" element={<KoordinatorApk />} />
            <Route path="koordinator/apk/create" element={<CreateKoordinatorApk />} />
            <Route path="koordinator/apk/:id/edit" element={<EditKoordinatorApk />} />
            <Route path="koordinator/apk/:id" element={<DetailKoordinatorApk />} />
            <Route path="suara/dashboard" element={<Suara />} />
            <Route path="suara/test" element={<SuaraTest />} />
            <Route path="suara/paslon" element={<Paslon />} />
            <Route path="suara/partai" element={<Partai />} />
            <Route path="suara/dpt" element={<DPT />} />
            <Route path="suara/analisis" element={<AnalisisPaslon />} />
            <Route path="konten" element={<Content />} />
            <Route path="konten/create" element={<CreateContent />} />
            <Route path="konten/:id/edit" element={<EditContent />} />
            <Route path="konten/:id" element={<DetailContent />} />
            <Route path="konten/:id/analytic" element={<AnalyticContent />} />

          </Route>

          {/* =========== ADMIN_PASLON & KUNJUNGAN_KOORDINATOR (role_id: 2, 4) =========== */}
          <Route element={<RequireRole allowedRoleIds={[2, 4]} />}>
            <Route path="relawan" element={<Relawan />} />
            <Route path="relawan/:id" element={<DetailRelawan />} />
            <Route path="relawan/apk/:id" element={<DetailRelawanApk />} />
            <Route path="relawan/apk" element={<RelawanApk />} />
          </Route>

          {/* =========== KUNJUNGAN_KOORDINATOR ONLY (role_id: 4) =========== */}
          <Route element={<RequireRole allowedRoleIds={[4]} />}>
            <Route path="relawan/create" element={<CreateRelawan />} />
            <Route path="relawan/:id/edit" element={<EditRelawan />} />
            <Route path="relawan/apk" element={<RelawanApk />} />
            <Route path="relawan/apk/create" element={<CreateRelawanApk />} />
            <Route path="relawan/apk/:id/edit" element={<EditRelawanApk />} />
            <Route path="relawan/apk/:id" element={<DetailRelawanApk />} />
          </Route>

          {/* =========== KUNJUNGAN (role_id: 6 only) =========== */}
          <Route element={<RequireRole allowedRoleIds={[6]} />}>
            <Route path="kunjungan" element={<Kunjungan />} />
            <Route path="kunjungan/anggota" element={<KunjunganAnggota />} />
            <Route path="kunjungan/:id" element={<KunjunganDetail />} />
            <Route path="kunjungan/:id/edit" element={<KunjunganEdit />} />
          </Route>

          {/* =========== INBOX/NOTIF (role_id: 4 & 6 only) =========== */}
          <Route element={<RequireRole allowedRoleIds={[4, 6]} />}>
            <Route path="inbox" element={<Inbox />} />
          </Route>

          {/* =========== SUPER ADMIN (role_id: 1) =========== */}
          <Route element={<RequireRole allowedRoleIds={[1]} />}>
            <Route path="superadmin" element={<SuperAdmin1 />} />
          </Route>

          {/* =========== APK (role_id: 5,7, + relawan_apk kalau ada) =========== */}
          <Route element={<RequireRole allowedRoleIds={[5, 7]} />}>
            <Route path="apk" element={<Apk />} />
          </Route>

        </Route>
      </Route>
    </Routes>
  );
}
