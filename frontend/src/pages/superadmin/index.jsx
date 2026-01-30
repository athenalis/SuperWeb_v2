import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Select from "react-select";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import Navbar from "../../components/Navbar";

/* =====================
  NORMALIZER
===================== */
function normalizeArrayPayload(payload) {
  // payload bisa:
  // - [] (array langsung)
  // - { data: [] }
  // - { status: true, data: [] }
  // - { success: true, data: [] }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

async function safeGet(url) {
  const res = await api.get(url);
  return res.data;
}

/* =====================
  API HELPERS
===================== */
const qk = {
  parties: ["parties"],
  paslons: ["paslons"],
  adminPaslons: ["admin-paslon-list"],
};

async function fetchParties() {
  return normalizeArrayPayload(await safeGet("/parties"));
}

async function fetchPaslons() {
  return normalizeArrayPayload(await safeGet("/paslon"));
}

async function fetchAdminPaslonsList() {
  const payload = await safeGet("/admin-paslon");
  return normalizeArrayPayload(payload);
}

/* =====================
  PARTY LOGO MAP
  file ada di: public/partai/*.png
===================== */
const PARTY_LOGO_BY_CODE = {
  100001: "pkb",
  100002: "gerindra",
  100003: "pdi",
  100004: "golkar",
  100005: "nasdem",
  100007: "gelora",
  100008: "pks",
  100009: "pkn",
  100010: "hanura",
  100011: "garuda",
  100012: "pan",
  100013: "pbb",
  100014: "demokrat",
  100015: "psi",
  100016: "perindo",
  100017: "ppp",
};

/* =====================
  PAGE
===================== */
export default function SuperadminDashboard() {
  const role = localStorage.getItem("role") || "superadmin";
  const qc = useQueryClient();

  const [showAddPaslon, setShowAddPaslon] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [selectedPaslon, setSelectedPaslon] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [newPaslon, setNewPaslon] = useState({
    cagub: "",
    cawagub: "",
    nomor_urut: 1,
    parties: [],
    imageFile: null,
  });

  const [newAdmin, setNewAdmin] = useState({
    paslonId: "",
  });

  const fileInputRef = useRef(null);

  /* =====================
    QUERIES
  ===================== */
  const partiesQuery = useQuery({
    queryKey: qk.parties,
    queryFn: fetchParties,
    staleTime: 60_000,
    onError: (e) => toast.error(e?.message || "Gagal load partai"),
  });

  const paslonsQuery = useQuery({
    queryKey: qk.paslons,
    queryFn: fetchPaslons,
    staleTime: 10_000,
    onError: (e) => toast.error(e?.message || "Gagal load paslon"),
  });

  const adminListQuery = useQuery({
    queryKey: qk.adminPaslons,
    queryFn: fetchAdminPaslonsList,
    staleTime: 10_000,
  });

  const partiesOptions = useMemo(() => {
    const list = partiesQuery.data || [];
    return list.map((p) => ({
      value: p.party_code,
      label: p.party,
    }));
  }, [partiesQuery.data]);

  const paslonCards = useMemo(() => {
    const list = paslonsQuery.data || [];

    return list.map((p) => {
      let img = null;

      if (p.image_url) {
        img = p.image_url;
      } else if (p.image) {
        const baseUrl = api.defaults.baseURL || "";
        const rootUrl = baseUrl.replace(/\/api\/?$/, "");
        const cleanPath = p.image.replace(/^\//, "");
        img = `${rootUrl}/storage/${cleanPath}`;
      } else {
        img = `/paslon/${p.nomor_urut}.png`;
      }

      return {
        id: p.id,
        name: `${p.cagub} - ${p.cawagub}`,
        cagub: p.cagub,
        cawagub: p.cawagub,
        nomor_urut: p.nomor_urut,
        image_url: img,
        parties: p.parties || [],
      };
    });
  }, [paslonsQuery.data]);

  const nextNomorUrut = useMemo(() => {
    const list = paslonsQuery.data || [];
    const nums = list
      .map((x) => Number(x.nomor_urut))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return max + 1;
  }, [paslonsQuery.data]);

  useEffect(() => {
    if (!showAddPaslon) return;
    setNewPaslon((prev) => ({ ...prev, nomor_urut: nextNomorUrut }));
  }, [showAddPaslon, nextNomorUrut]);

  /* =====================
    MUTATIONS
  ===================== */
  const createPaslon = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("cagub", newPaslon.cagub);
      fd.append("cawagub", newPaslon.cawagub);
      fd.append("nomor_urut", String(newPaslon.nomor_urut));

      (newPaslon.parties || []).forEach((opt) => {
        fd.append("party_codes[]", String(opt.value));
      });

      if (newPaslon.imageFile) fd.append("image", newPaslon.imageFile);

      const res = await api.post("/paslon", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: async (payload) => {
      if (payload?.status || payload?.success) {
        toast.success(payload?.message || "Paslon berhasil dibuat");
        await qc.invalidateQueries({ queryKey: qk.paslons });
        setShowAddPaslon(false);
        setNewPaslon({
          cagub: "",
          cawagub: "",
          nomor_urut: nextNomorUrut + 1,
          parties: [],
          imageFile: null,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error(payload?.message || "Gagal membuat paslon");
      }
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal membuat paslon"
      ),
  });

  const createAdminPaslon = useMutation({
    mutationFn: async () => {
      const body = { paslon_id: Number(newAdmin.paslonId) };
      const res = await api.post("/admin-paslon", body);
      return res.data;
    },
    onSuccess: async (payload) => {
      if (payload?.status || payload?.success) {
        toast.success(payload?.message || "Admin Paslon berhasil dibuat");

        const user = payload?.data?.user;
        if (user?.email && user?.password) {
          toast(
            () => (
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">
                  Credential Admin Paslon
                </div>
                <div className="text-sm text-slate-700">
                  Email: <span className="font-semibold">{user.email}</span>
                </div>
                <div className="text-sm text-slate-700">
                  Password:{" "}
                  <span className="font-semibold">{user.password}</span>
                </div>
              </div>
            ),
            { duration: 7000 }
          );
        }

        await qc.invalidateQueries({ queryKey: qk.adminPaslons });
        setShowAddAdmin(false);
        setNewAdmin({ paslonId: "" });
      } else {
        toast.error(payload?.message || "Gagal membuat admin paslon");
      }
    },
    onError: (err) => {
      const message = err?.response?.data?.message || err?.message || "";
      if (
        message.toLowerCase().includes("duplicate") ||
        message.toLowerCase().includes("unique") ||
        err?.response?.status === 409
      ) {
        toast.error("Admin untuk paslon ini sudah ada! Silakan pilih paslon lain.");
      } else {
        toast.error(message || "Gagal membuat admin paslon");
      }
    },
  });

  const adminRows = useMemo(() => {
    const list = adminListQuery.data || [];
    return list.map((it) => {
      const user = it.user || it?.data?.user || it;
      const paslonId =
        it.paslon_id ||
        it.admin_paslon?.paslon_id ||
        it?.data?.admin_paslon?.paslon_id;
      const p = paslonCards.find((x) => x.id === Number(paslonId));
      return {
        id:
          it.id ||
          it.admin_paslon?.id ||
          it?.data?.admin_paslon?.id ||
          `${user?.email}-${paslonId}`,
        name: user?.name || "-",
        email: user?.email || "-",
        password: user?.password || it?.password || null,
        paslonName: p?.name || (paslonId ? `Paslon #${paslonId}` : "-"),
        paslonId: Number(paslonId),
      };
    });
  }, [adminListQuery.data, paslonCards]);

  const paslonIdsWithAdmin = useMemo(() => {
    return new Set(adminRows.map((a) => a.paslonId).filter((id) => id));
  }, [adminRows]);

  const isBusy = partiesQuery.isLoading || paslonsQuery.isLoading;

  /* =====================
    DETAIL HANDLERS
  ===================== */
  const handleViewPaslonDetail = async (paslonId) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/paslon/${paslonId}`);
      const data = res.data?.data || res.data;

      let img = data.image_url;
      if (!img && data.image) {
        if (data.image.startsWith("http")) {
          img = data.image;
        } else {
          const baseUrl =
            api.defaults.baseURL ||
            import.meta.env.VITE_API_BASE_URL ||
            "http://192.168.1.14:9000/api";
          const rootUrl = baseUrl.replace(/\/api\/?$/, "");
          const cleanPath = data.image.replace(/^\//, "");
          img = `${rootUrl}/storage/${cleanPath}`;
        }
      }

      setSelectedPaslon({ ...data, image_url: img });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Gagal memuat detail paslon");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleViewAdminDetail = async (admin) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin-paslon/${admin.id}`);
      const data = res.data?.data || res.data;

      const user = data.user || {};
      const paslon = data.paslon || {};

      setSelectedAdmin({
        id: data.id,
        name: user.name || admin.name,
        email: user.email || admin.email,
        password: user.credential_password || null,
        paslonName:
          paslon.cagub && paslon.cawagub
            ? `${paslon.cagub} - ${paslon.cawagub}`
            : admin.paslonName,
        paslonId: data.paslon_id,
      });
    } catch (err) {
      setSelectedAdmin(admin);
      toast.error("Gagal memuat detail credential");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      
      <div className="px-8 py-8 space-y-8">
        <HeaderBanner
          title={`Selamat Datang, ${role}`}
          subtitle="Sistem Manajemen SuperWeb"
          icon="proicons:home"
        />

        {/* PASLON */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-blue-800">
                Daftar Pasangan Calon
              </h2>
              <p className="text-md text-slate-500 mt-1">
                Kelola paslon & partai pengusung
              </p>
            </div>

            <button
              onClick={() => setShowAddPaslon(true)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-800 text-white rounded-xl text-md font-semibold shadow-sm flex items-center gap-2"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              Tambah Paslon
            </button>
          </div>

          {isBusy ? (
            <div className="grid md:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 rounded-2xl bg-white/70 border border-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : paslonCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Icon
                icon="mdi:database-off"
                className="w-12 h-12 text-slate-300 mx-auto mb-2"
              />
              <div className="text-slate-700 font-semibold">
                Data paslon kosong
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Silakan tambah paslon.
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {paslonCards.map((p) => (
                <div
                  key={p.id}
                  className="group bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 overflow-hidden
                    shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                  onClick={() => handleViewPaslonDetail(p.id)}
                >
                  <div className="relative">
                    <div className="relative h-44 bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200/70 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                        <Icon icon="mdi:account-circle" className="w-20 h-20" />
                      </div>

                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="relative z-10 w-full h-full object-cover bg-slate-100"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      )}
                    </div>

                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 text-[13px] text-slate-700 bg-white/80 border border-slate-200 px-2.5 py-1 rounded-full font-semibold backdrop-blur">
                        Nomor Urut {p.nomor_urut}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-blue-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <span className="text-white font-semibold text-sm flex items-center gap-2">
                        <Icon icon="solar:eye-linear" width="24" height="24" />
                        Lihat Detail
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-semibold text-slate-900 text-lg leading-snug line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                      {p.parties?.length || 0} partai pengusung
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ADMIN */}
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm">
          <div className="bg-slate-50/70 px-6 py-5 border-b border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Daftar Admin Paslon
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {adminRows.length} administrator terdaftar
                </p>
              </div>

              <button
                onClick={() => setShowAddAdmin(true)}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-800 text-white rounded-xl text-md font-semibold flex items-center gap-2"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                Tambah Admin
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Paslon
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminListQuery.isLoading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                      Memuat daftar admin...
                    </td>
                  </tr>
                ) : adminRows.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      Belum ada admin / atau endpoint list belum tersedia.
                    </td>
                  </tr>
                ) : (
                  adminRows.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => handleViewAdminDetail(a)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-b from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                            {(a.name || "A").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-800 font-semibold">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{a.email}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {a.paslonName}
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Icon icon="solar:eye-linear" className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL ADD PASLON */}
        {showAddPaslon && (
          <Modal onClose={() => setShowAddPaslon(false)} title="Tambah Paslon Baru">
            <div className="space-y-5">
              <InputField
                label="Nama Calon Gubernur"
                placeholder="Contoh: Ara"
                value={newPaslon.cagub}
                onChange={(e) => setNewPaslon((p) => ({ ...p, cagub: e.target.value }))}
              />
              <InputField
                label="Nama Calon Wakil Gubernur"
                placeholder="Contoh: Reva"
                value={newPaslon.cawagub}
                onChange={(e) => setNewPaslon((p) => ({ ...p, cawagub: e.target.value }))}
              />

              <div className="space-y-2">
                <label className="block text-md font-semibold text-slate-800">
                  Partai Pengusung
                </label>
                <Select
                  isMulti
                  isLoading={partiesQuery.isLoading}
                  options={partiesOptions}
                  value={newPaslon.parties}
                  onChange={(val) => setNewPaslon((p) => ({ ...p, parties: val || [] }))}
                  placeholder="Pilih partai (bisa lebih dari satu)"
                  className="text-sm"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: 12,
                      borderColor: "#cbd5e1",
                      minHeight: 46,
                      boxShadow: "none",
                    }),
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-md font-semibold text-slate-800">
                  Foto Paslon
                </label>
                <div
                  className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors bg-slate-50 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setNewPaslon((p) => ({ ...p, imageFile: e.target.files?.[0] || null }))
                    }
                  />
                  {newPaslon.imageFile ? (
                    <img
                      src={URL.createObjectURL(newPaslon.imageFile)}
                      alt="Preview"
                      className="mx-auto h-44 w-auto rounded-xl object-cover shadow-sm"
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                        <Icon icon="mdi:cloud-upload" className="w-7 h-7 text-blue-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        Klik untuk upload foto
                      </p>
                      <p className="text-xs text-slate-500">JPG / PNG</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <ModalActions
              onCancel={() => setShowAddPaslon(false)}
              onSubmit={() => {
                if (!newPaslon.cagub.trim() || !newPaslon.cawagub.trim())
                  return toast.error("Cagub & Cawagub wajib");
                if (!newPaslon.parties?.length)
                  return toast.error("Pilih partai minimal 1");
                createPaslon.mutate();
              }}
              submitText={createPaslon.isPending ? "Menyimpan..." : "Simpan Paslon"}
              isSubmitting={createPaslon.isPending}
            />
          </Modal>
        )}

        {/* MODAL ADD ADMIN */}
        {showAddAdmin && (
          <Modal onClose={() => setShowAddAdmin(false)} title="Tambah Admin Paslon">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Pilih Paslon
                </label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm bg-white appearance-none cursor-pointer"
                    value={newAdmin.paslonId}
                    onChange={(e) => setNewAdmin({ paslonId: e.target.value })}
                  >
                    <option value="">Pilih pasangan calon</option>
                    {paslonCards.map((p) => {
                      const hasAdmin = paslonIdsWithAdmin.has(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={hasAdmin}>
                          No Urut {p.nomor_urut} — {p.name} {hasAdmin ? "(sudah ada admin)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
                  />
                </div>
                {paslonCards.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Belum ada paslon. Tambahkan paslon terlebih dahulu.
                  </p>
                )}
              </div>
            </div>

            <ModalActions
              onCancel={() => setShowAddAdmin(false)}
              onSubmit={() => {
                if (!newAdmin.paslonId) return toast.error("Pilih paslon dulu");
                if (paslonIdsWithAdmin.has(Number(newAdmin.paslonId))) {
                  return toast.error("Paslon ini sudah memiliki admin!");
                }
                createAdminPaslon.mutate();
              }}
              submitText={createAdminPaslon.isPending ? "Membuat..." : "Tambah Admin"}
              isSubmitting={createAdminPaslon.isPending}
            />
          </Modal>
        )}

        {/* MODAL DETAIL PASLON (UI dibikin lebih clean, tapi logic foto tetap) */}
        {selectedPaslon && (
          <Modal onClose={() => setSelectedPaslon(null)} title="Detail Pasangan Calon">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                    {selectedPaslon.image_url ? (
                      <img
                        src={selectedPaslon.image_url}
                        alt={`${selectedPaslon.cagub} - ${selectedPaslon.cawagub}`}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Icon icon="mdi:account-circle" className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    Nomor Urut {selectedPaslon.nomor_urut}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-[13px] text-slate-500 font-medium tracking-wide uppercase">
                        Calon Gubernur
                      </div>
                      <div className="text-lg font-semibold text-slate-900 leading-snug">
                        {selectedPaslon.cagub}
                      </div>
                    </div>
                    <div>
                      <div className="text-[13px] text-slate-500 font-medium tracking-wide uppercase">
                        Calon Wakil Gubernur
                      </div>
                      <div className="text-lg font-semibold text-slate-900 leading-snug">
                        {selectedPaslon.cawagub}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    Partai Pengusung
                  </h4>
                  <span className="text-xs text-slate-500">
                    {selectedPaslon.parties?.length || 0} partai
                  </span>
                </div>

                {selectedPaslon.parties?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPaslon.parties.map((party) => {
                      const code = Number(party.party_code);
                      const file = PARTY_LOGO_BY_CODE[code];
                      const logoSrc = file ? `/partai/${file}.png` : null;

                      return (
                        <div
                          key={party.party_code}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                          title={party.party}
                        >
                          <div className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                            {logoSrc ? (
                              <img
                                src={logoSrc}
                                alt={party.party}
                                className="w-5 h-5 object-contain"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : (
                              <Icon
                                icon="mdi:shield-outline"
                                className="w-4 h-4 text-slate-400"
                              />
                            )}
                          </div>
                          <span className="text-sm text-slate-700 font-medium">
                            {party.party}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tidak ada partai pengusung.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-5 border-t border-slate-200 mt-6">
              <button
                onClick={() => setSelectedPaslon(null)}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-blue-700 hover:bg-blue-900 transition-colors"
              >
                Tutup
              </button>
            </div>
          </Modal>
        )}

        {/* MODAL DETAIL ADMIN */}
        {selectedAdmin && (
          <Modal onClose={() => setSelectedAdmin(null)} title="Detail Admin Paslon">
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md">
                  {(selectedAdmin.name || "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedAdmin.name}</h3>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-800 uppercase">
                    Paslon yang Dikelola
                  </span>
                </div>
                <p className="text-base font-bold text-slate-800">
                  {selectedAdmin.paslonName}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                Akun
                </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">
                    Email
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-900">{selectedAdmin.email}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAdmin.email);
                        toast.success("Email disalin!");
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Icon icon="mdi:content-copy" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">
                    Password
                  </p>
                  <div className="flex items-center justify-between">
                    {selectedAdmin.password ? (
                      <>
                        <span className="text-sm text-slate-800">
                          {selectedAdmin.password}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedAdmin.password);
                            toast.success("Password disalin!");
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Icon icon="mdi:content-copy" className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Tidak tersedia</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div className="flex justify-end pt-5 border-t border-slate-200 mt-6">
              <button
                onClick={() => setSelectedAdmin(null)}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </Modal>
        )}

        {/* Loading overlay */}
        {loadingDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-700 font-medium">Memuat detail...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================
  UI COMPONENTS
===================== */
function HeaderBanner({ title, subtitle, icon = "proicons:home" }) {
  return (
    <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-5 md:p-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 sm:w-40 sm:h-40 md:w-64 md:h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-20 h-20 sm:w-32 sm:h-32 md:w-48 md:h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Icon icon={icon} width={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-sm text-blue-100 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-[modalIn_.18s_ease-out]">
        <div className="px-6 py-5 flex items-start justify-between">
          <div className="pr-10">
            <h2 className="mt-2 text-2xl font-bold text-blue-800 leading-snug">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm hover:shadow transition-all flex items-center justify-center"
            aria-label="Tutup modal"
          >
            <Icon icon="mdi:close" className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(10px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function ModalActions({ onCancel, onSubmit, submitText = "Simpan", isSubmitting = false }) {
  return (
    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200/70 mt-6">
      <button
        onClick={onCancel}
        disabled={isSubmitting}
        className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60"
      >
        Batal
      </button>
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl bg-blue-600 hover:bg-blue-800 disabled:opacity-70"
      >
        {submitText}
      </button>
    </div>
  );
}

function InputField({ label, icon, ...props }) {
  return (
    <div className="space-y-2">
      <label className="block text-md font-semibold text-slate-800">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input
          {...props}
          className={`w-full border border-slate-300 rounded-xl ${
            icon ? "pl-11" : "pl-4"
          } pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white`}
        />
      </div>
    </div>
  );
}
