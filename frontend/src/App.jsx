import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import MainLayout from "./layouts/MainLayout";

import SuperAdmin1 from "./pages/superadmin/index";

import Koordinator from "./pages/koordinator/kunjungan/index";
import CreateKoordinator from "./pages/koordinator/kunjungan/create";
import EditKoordinator from "./pages/koordinator/kunjungan/edit";
import DetailKoordinator from "./pages/koordinator/kunjungan/detail";

import AdminApk from "./pages/apk/adminapk";
import KelolaBarang from "./pages/apk/kelolabarang";
import HistoryApk from "./pages/apk/history";
import KoordinatorApk from "./pages/koordinator/apk/index";
import CreateKoordinatorApk from "./pages/koordinator/apk/create";
import EditKoordinatorApk from "./pages/koordinator/apk/edit";
import DetailKoordinatorApk from "./pages/koordinator/apk/detail";
import RequestApk from "./pages/koordinator/apk/request";

import KurirApk from "./pages/kurirApk/index";
import RelawanApk from "./pages/relawan/apk/index";
import DetailRelawanApk from "./pages/relawan/apk/detail";
import EditRelawanApk from "./pages/relawan/apk/edit";
import CreateRelawanApk from "./pages/relawan/apk/create";
import PasangApk from "./pages/relawan/apk/pasangapk";

import Relawan from "./pages/relawan/kunjungan/index";
import DetailRelawan from "./pages/relawan/kunjungan/detail";
import EditRelawan from "./pages/relawan/kunjungan/edit";
import CreateRelawan from "./pages/relawan/kunjungan/create";

import Kunjungan from "./pages/kunjungan/index";
import KunjunganAnggota from "./pages/kunjungan/anggota";
import KunjunganDetail from "./pages/kunjungan/detail";
import KunjunganEdit from "./pages/kunjungan/edit";

import Suara from "./pages/suara/dashboard/index";
import SuaraTest from "./pages/suara/test";
import Paslon from "./pages/suara/paslon/index";
import Partai from "./pages/suara/partai/index";
import AnalisisPaslon from "./pages/suara/analisis/index";
import DPT from "./pages/suara/dpt/index";

import Content from "./pages/content/index";
import CreateContent from "./pages/content/create";
import EditContent from "./pages/content/edit";
import DetailContent from "./pages/content/detail";
import AnalyticContent from "./pages/content/analytic";

import Inbox from "./pages/inbox/index";

import SuperAdmin from "./pages/SuperAdmin/index";
import Apk from "./pages/apk/index";
import DetailApk from "./pages/apk/detail";
import EditApk from "./pages/apk/edit";

import DashboardKurirApk from "./pages/kurirApk/dashboard";

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
   * 6 = relawan (bisa is_kunjungan, is_apk, atau double job keduanya)
   * 7 = apk_kurir
   */
  return (
    <Routes>
      {/* ===== PUBLIC ROUTES ===== */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* ===== PROTECTED - HARUS LOGIN ===== */}
      <Route element={<RequireAuth />}>

        {/* ========================================
            PASANG APK - FULL SCREEN (tanpa MainLayout)
            Bisa diakses oleh: apk_koordinator(5), relawan(6), apk_kurir(7)
            Relawan bisa akses jika is_apk = 1
        ======================================== */}
        <Route element={<RequireRole allowedRoleIds={[5, 6, 7]} />}>
          <Route path="relawan/apk/pasangapk" element={<PasangApk />} />
        </Route>

        {/* ===== DASHBOARD KURIR APK - FULL SCREEN ===== */}
        <Route element={<RequireRole allowedRoleIds={[7]} />}>
          <Route path="Dashboardkurir-apk" element={<DashboardKurirApk />} />
        </Route>

        {/* ========================================
            ROUTES DENGAN MAIN LAYOUT (Navbar, Sidebar)
        ======================================== */}
        <Route path="/" element={<MainLayout />}>

          {/* Dashboard - semua role yang login bisa akses */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* ================= SUPERADMIN (1) ================= */}
          <Route element={<RequireRole allowedRoleIds={[1]} />}>
            <Route path="superadmin" element={<SuperAdmin1 />} />
          </Route>

          {/* ================= ADMIN_PASLON (2) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2]} />}>
            {/* Koordinator Kunjungan */}
            <Route path="koordinator/kunjungan" element={<Koordinator />} />
            <Route path="koordinator/kunjungan/create" element={<CreateKoordinator />} />
            <Route path="koordinator/kunjungan/:id/edit" element={<EditKoordinator />} />
            <Route path="koordinator/kunjungan/:id" element={<DetailKoordinator />} />

            {/* Suara & Analisis */}
            <Route path="suara/dashboard" element={<Suara />} />
            <Route path="suara/test" element={<SuaraTest />} />
            <Route path="suara/paslon" element={<Paslon />} />
            <Route path="suara/partai" element={<Partai />} />
            <Route path="suara/dpt" element={<DPT />} />
            <Route path="suara/analisis" element={<AnalisisPaslon />} />

            {/* Konten */}
            <Route path="konten" element={<Content />} />
            <Route path="konten/create" element={<CreateContent />} />
            <Route path="konten/:id/edit" element={<EditContent />} />
            <Route path="konten/:id" element={<DetailContent />} />
            <Route path="konten/:id/analytic" element={<AnalyticContent />} />

            
          </Route>

          {/* ================= ADMIN_APK (3) ================= */}
          <Route element={<RequireRole allowedRoleIds={[3]} />}>
            <Route path="kurir-apk" element={<KurirApk />} />
            <Route path="history" element={<HistoryApk />} />
          </Route>

          {/* ================= KUNJUNGAN_KOORDINATOR (4) ================= */}
          <Route element={<RequireRole allowedRoleIds={[4]} />}>
            <Route path="relawan/kunjungan/create" element={<CreateRelawan />} />
            <Route path="relawan/kunjungan/:id/edit" element={<EditRelawan />} />
          </Route>

          {/* ================= APK_KOORDINATOR (5) ================= */}
          <Route element={<RequireRole allowedRoleIds={[5]} />}>
            <Route path="relawan/apk/create" element={<CreateRelawanApk />} />
            <Route path="relawan/apk/:id/edit" element={<EditRelawanApk />} />
            <Route path="permintaan-apk" element={<RequestApk />} />
          </Route>

          {/* ================= RELAWAN (6) =================
              Relawan bisa is_kunjungan, is_apk, atau double job
              - Redirect ke /kunjungan jika is_kunjungan saja
              - Redirect ke /relawan/apk/pasangapk jika is_apk
          =============================================== */}
          <Route element={<RequireRole allowedRoleIds={[6]} />}>
            {/* Kunjungan routes - untuk relawan is_kunjungan */}
            <Route path="kunjungan" element={<Kunjungan />} />
            <Route path="kunjungan/anggota" element={<KunjunganAnggota />} />
            <Route path="kunjungan/:id" element={<KunjunganDetail />} />
            <Route path="kunjungan/:id/edit" element={<KunjunganEdit />} />
          </Route>

          {/* ================= SHARED: RELAWAN KUNJUNGAN READ (2, 4) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2, 4]} />}>
            <Route path="relawan/kunjungan" element={<Relawan />} />
            <Route path="relawan/kunjungan/:id" element={<DetailRelawan />} />
          </Route>

          {/* ================= SHARED: KOORDINATOR APK (2, 3) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2, 3]} />}>
            <Route path="koordinator/apk" element={<KoordinatorApk />} />
            <Route path="koordinator/apk/create" element={<CreateKoordinatorApk />} />
            <Route path="koordinator/apk/:id/edit" element={<EditKoordinatorApk />} />
            <Route path="koordinator/apk/:id" element={<DetailKoordinatorApk />} />

            <Route path="adminapk" element={<AdminApk />} />
            <Route path="kelolabarang" element={<KelolaBarang />} />
          </Route>

          {/* ================= SHARED: RELAWAN APK READ (2, 3, 5) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2, 3, 5]} />}>
            <Route path="relawan/apk" element={<RelawanApk />} />
            <Route path="relawan/apk/:id" element={<DetailRelawanApk />} />
          </Route>

          {/* ================= SHARED: RELAWAN APK WRITE (3, 5) ================= */}
          <Route element={<RequireRole allowedRoleIds={[3, 5]} />}>
            <Route path="relawan/apk/create" element={<CreateRelawanApk />} />
            <Route path="relawan/apk/:id/edit" element={<EditRelawanApk />} />
          </Route>

          {/* ================= SHARED: APK MAIN PAGE (2, 3, 5, 7) ================= */}
          <Route element={<RequireRole allowedRoleIds={[2, 3, 5, 7]} />}>
            <Route path="apk" element={<Apk />} />
            <Route path="apk/:id" element={<DetailApk />} />
            <Route path="apk/:id/edit" element={<EditApk />} />
          </Route>

          {/* ================= SHARED: INBOX / NOTIF (3, 4, 6) ================= */}
          <Route element={<RequireRole allowedRoleIds={[3, 4, 5, 6]} />}>
            <Route path="inbox" element={<Inbox />} />
          </Route>

        </Route>
        {/* END MainLayout */}

      </Route>
      {/* END RequireAuth */}

    </Routes>
  );
}
