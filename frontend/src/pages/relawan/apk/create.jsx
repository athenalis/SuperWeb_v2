import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import Select from "react-select";
import toast from "react-hot-toast";
import api from "../../../lib/axios";

export default function InputRelawan({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // ✅ auto detect: halaman apk vs kunjungan
  const isApkPage = location.pathname.includes("/relawan/apk");
  const redirectPath = isApkPage ? "/relawan/apk" : "/relawan/kunjungan";

  const [form, setForm] = useState({
    nama: "",
    nik: "",
    no_hp: "",
    // ✅ TPS dihapus
    alamat: "",
    province_code: 31,
    city_code: "",
    district_code: "",
    village_code: "",
    ormas_id: "",
  });

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreNik, setRestoreNik] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredUser, setRestoredUser] = useState(null);
  const [isRestoreMode, setIsRestoreMode] = useState(false);
  const [isNikBlocked, setIsNikBlocked] = useState(false);
  const [errors, setErrors] = useState({});

  // ✅ NEW: simpan draft data dari check-nik (deleted=true)
  const [restoreDraft, setRestoreDraft] = useState(null);

  // ✅ NEW: lock input saat restore preview / sedang restore
  const isFormLocked = isRestoreMode || isRestoring;

  /* =========================
     VALIDASI PER FIELD
  ========================= */
  const validateField = (name, value) => {
    switch (name) {
      case "nama":
        if (!value.trim()) return "Nama wajib diisi";
        break;

      case "nik":
        if (!/^\d*$/.test(value)) return "NIK harus angka";
        if (value.length !== 16) return "NIK wajib 16 digit";
        break;

      case "no_hp": {
        if (!/^\+?\d*$/.test(value))
          return "No HP hanya boleh angka atau +62";

        const normalized = value.startsWith("+62")
          ? "0" + value.slice(3)
          : value.startsWith("62")
          ? "0" + value.slice(2)
          : value;

        if (!/^08\d+$/.test(normalized))
          return "No HP harus diawali 08, 62, atau +62";

        if (normalized.length < 10 || normalized.length > 13)
          return "No HP wajib 10–13 digit";
        break;
      }

      // ✅ TPS validation dihapus

      case "alamat":
        if (!value.trim()) return "Alamat wajib diisi";
        break;

      case "city_code":
        if (!value) return "Kota wajib dipilih";
        break;

      case "district_code":
        if (!value) return "Kecamatan wajib dipilih";
        break;

      case "village_code":
        if (!value) return "Kelurahan wajib dipilih";
        break;

      case "ormas_id":
        if (!value) return "Ormas wajib dipilih";
        break;

      default:
        return "";
    }
    return "";
  };

  /* =========================
     HANDLE CHANGE
  ========================= */
  const handleChange = (e) => {
    // ✅ NEW: kalau sudah restore preview, jangan boleh ubah isi form
    if (isFormLocked) return;

    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "city_code" && { district_code: "", village_code: "" }),
      ...(name === "district_code" && { village_code: "" }),
    }));

    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(form).forEach((key) => {
      const err = validateField(key, form[key]);
      if (err) newErrors[key] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* =========================
     CHECK NIK (RESTORE MODE)
     ✅ samakan dengan koordinator:
     - kalau soft deleted, backend kirim data lengkap di data.data
  ========================= */
  const checkNik = async (nik) => {
    // ✅ NEW: kalau sudah restore preview, jangan cek ulang
    if (isFormLocked) return;

    try {
      const res = await api.post("/relawan/check-nik", { nik });
      const data = res.data;

      if (data.exists && data.deleted === false) {
        toast.error(data.message || "NIK sudah terdaftar dan aktif");
        setIsNikBlocked(true);
        return;
      }

      if (data.exists && data.deleted === true) {
        setRestoreNik(nik);

        // ✅ NEW: simpan draft untuk autofill (samakan koordinator)
        setRestoreDraft(data?.data || null);

        setShowRestoreConfirm(true);
        setIsNikBlocked(false);
        return;
      }

      setIsNikBlocked(false);
      setRestoreDraft(null);
      setRestoreNik(null);
    } catch (err) {
      console.error(err);
      toast.error("Gagal cek NIK");
    }
  };

  /* =========================
     RESTORE (PREVIEW SAJA)
     ✅ hanya autofill dari restoreDraft
     ❌ JANGAN panggil /restore-by-nik di sini
  ========================= */
  const handleRestore = async () => {
    if (!restoreNik) return;

    const r = restoreDraft;

    if (!r || typeof r !== "object") {
      toast.error(
        "Data restore tidak tersedia dari check-nik. Pastikan response check-nik (deleted=true) mengandung no_hp/alamat/wilayah/ormas.",
        { id: "restore-relawan" }
      );
      return;
    }

    setIsRestoring(true);
    try {
      setForm((prev) => ({
        ...prev,
        nama: r?.nama ?? "",
        nik: r?.nik ?? restoreNik ?? "",
        no_hp: r?.no_hp ?? "",
        alamat: r?.alamat ?? "",
        province_code: r?.province_code ?? 31,
        city_code: r?.city_code ?? prev.city_code ?? "",
        district_code: r?.district_code ?? prev.district_code ?? "",
        village_code: r?.village_code ?? prev.village_code ?? "",
        ormas_id: r?.ormas_id ?? "",
      }));

      // ✅ form akan terkunci setelah ini
      setIsRestoreMode(true);
      setShowRestoreConfirm(false);

      toast.success(
        "Data relawan berhasil dimuat. Silakan klik Simpan untuk mengaktifkan.",
        { id: "restore-relawan", duration: 3500 }
      );
    } finally {
      setIsRestoring(false);
    }
  };

  /* =========================
     ORMAS
  ========================= */
  const { data: ormasRaw = [] } = useQuery({
    queryKey: ["ormas"],
    queryFn: async () => (await api.get("/ormas")).data.data,
  });

  const ormasOptions = ormasRaw.map((o) => ({
    value: o.id,
    label: o.nama_ormas,
  }));

  /* =========================
     WILAYAH (Bawaan Koor)
  ========================= */
  const { data: wilayah, isLoading: loadingWilayah } = useQuery({
    queryKey: ["wilayah-koordinator"],
    queryFn: async () => (await api.get("/me/wilayah")).data.data,
  });

  useEffect(() => {
    if (wilayah) {
      setForm((prev) => ({
        ...prev,
        province_code: wilayah.province.province_code,
        city_code: wilayah.city.city_code,
        district_code: wilayah.district.district_code,
        village_code: wilayah.village.village_code,
      }));
    }
  }, [wilayah]);

  /* =========================
     SUBMIT CREATE (NON-RESTORE)
  ========================= */
  const mutation = useMutation({
    mutationFn: async () => api.post("/relawan", form),

    onSuccess: (res) => {
      queryClient.invalidateQueries([isApkPage ? "relawan-apk" : "relawan"]);

      const akun = res?.data?.data?.user;

      if (akun?.email && akun?.password) {
        toast.success(
          `${isApkPage ? "Relawan APK" : "Relawan"} berhasil dibuat!\nEmail: ${
            akun.email
          }\nPassword: ${akun.password}`,
          {
            duration: 6000,
            style: {
              whiteSpace: "pre-line",
              background: "#1e293b",
              color: "white",
              padding: "14px",
              borderRadius: "10px",
            },
          }
        );
      } else {
        toast.success(
          `${isApkPage ? "Relawan APK" : "Relawan"} berhasil dibuat!`,
          { duration: 3000 }
        );
        console.log("Create response:", res?.data);
      }

      navigate(redirectPath, { replace: true });
    },

    onError: (err) => {
      const msg = err.response?.data?.message || "Gagal menyimpan data";
      toast.error(msg, {
        style: { background: "#dc2626", color: "white" },
      });
    },
  });

  if (loadingWilayah) {
    return (
      <div className="p-10 text-center text-slate-500">
        Memuat data wilayah Relawan...
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateAll()) {
      toast.error("Periksa kembali form Anda");
      return;
    }

    if (isNikBlocked) {
      toast.error("NIK tidak valid atau sudah aktif");
      return;
    }

    // ✅ restore mode: aktifkan beneran DI SINI saat klik Simpan (samakan koordinator)
    if (isRestoreMode) {
      try {
        toast.loading("Menyimpan & mengaktifkan relawan...", {
          id: "restore-save-relawan",
        });

        const res = await api.post("/relawan/restore", {
          nik: form.nik,
          nama: form.nama,
          no_hp: form.no_hp,
          alamat: form.alamat,
          // wilayah bisa ikut terkirim (walau sekarang locked dari /me/wilayah)
          province_code: form.province_code,
          city_code: form.city_code,
          district_code: form.district_code,
          village_code: form.village_code,
          ormas_id: form.ormas_id,
          // is_apk optional: biar aman utk case tertentu (walau role apk_koordinator pasti set apk=1 di backend)
          ...(isApkPage ? { is_apk: 1 } : {}),
        });

        const payload = res?.data?.data ?? {};
        const user = payload?.user || null;

        setRestoredUser(user || null);

        const email = user?.email || user?.username;
        const password = user?.password || user?.plain_password;

        toast.success(
          `Relawan APK berhasil diaktifkan!\n${
            email ? `Email: ${email}` : "Email: -"
          }\n${
            password
              ? `Password: ${password}`
              : "Password: - (tidak dikirim backend)"
          }`,
          {
            id: "restore-save-relawan",
            duration: 7000,
            style: { whiteSpace: "pre-line" },
          }
        );

        queryClient.invalidateQueries([isApkPage ? "relawan-apk" : "relawan"]);
        navigate(redirectPath, { replace: true });

        // reset restore state
        setIsRestoreMode(false);
        setRestoreDraft(null);
        setRestoreNik(null);
        return;
      } catch (err) {
        console.error(err?.response?.data || err);
        toast.error(
          err?.response?.data?.message || "Gagal mengaktifkan relawan",
          { id: "restore-save-relawan" }
        );
        return;
      }
    }

    mutation.mutate();
  };

  /* =========================
     STYLE
  ========================= */
  const baseInput =
    "w-full border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";

  const baseSelect =
    "w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";

  const disabledSelect = "bg-slate-100 cursor-not-allowed";

  return (
    <>
      <div className="bg-white rounded-2xl p-8 shadow max-w-8xl mx-auto">
        <h2 className="text-4xl text-blue-900 font-bold mb-6 text-center">
          Input Relawan
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="NIK" required error={errors.nik}>
              <input
                name="nik"
                value={form.nik}
                disabled={isFormLocked} // ✅ NEW
                onChange={(e) => {
                  if (isFormLocked) return; // ✅ NEW
                  const value = e.target.value;
                  if (!/^\d*$/.test(value)) return;
                  if (value.length > 16) return;
                  handleChange(e);
                }}
                onBlur={() => {
                  if (isFormLocked) return; // ✅ NEW
                  if (form.nik.length === 16) checkNik(form.nik);
                }}
                className={`${baseInput} ${
                  isFormLocked ? "bg-white cursor-not-allowed" : ""
                }`}
                inputMode="numeric"
                placeholder="Masukkan NIK"
              />
            </Field>

            <Field label="Nama" required error={errors.nama}>
              <input
                name="nama"
                value={form.nama}
                disabled={isFormLocked} // ✅ NEW
                onChange={handleChange}
                className={`${baseInput} ${
                  isFormLocked ? "bg-white cursor-not-allowed" : ""
                }`}
                placeholder="Masukkan nama lengkap"
              />
            </Field>
          </div>

          <Field label="No HP" required error={errors.no_hp}>
            <input
              name="no_hp"
              value={form.no_hp}
              disabled={isFormLocked} // ✅ NEW
              onChange={(e) => {
                if (isFormLocked) return; // ✅ NEW
                const value = e.target.value;
                if (!/^\+?\d*$/.test(value)) return;
                if (value.length > 14) return;
                handleChange(e);
              }}
              className={`${baseInput} ${
                isFormLocked ? "bg-white cursor-not-allowed" : ""
              }`}
              inputMode="numeric"
              placeholder="Cth: 0821xxxx, 62821xxxx, +62821xxxx"
            />
          </Field>

          {/* ✅ TPS FIELD DIHAPUS */}

          <Field label="Alamat" required error={errors.alamat}>
            <textarea
              name="alamat"
              value={form.alamat}
              disabled={isFormLocked} // ✅ NEW
              onChange={handleChange}
              className={`${baseInput} ${
                isFormLocked ? "bg-white cursor-not-allowed" : ""
              }`}
              placeholder="Masukkan alamat lengkap"
            />
          </Field>

          {/* WILAYAH (LOCKED) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Provinsi">
              <select
                disabled
                value={31}
                className={`${baseSelect} ${disabledSelect}`}
              >
                <option>DKI JAKARTA</option>
              </select>
            </Field>

            <SelectField
              label="Kota/Kabupaten"
              name="city_code"
              value={form.city_code}
              disabled
              options={
                wilayah?.city
                  ? [{ id: wilayah.city.city_code, nama: wilayah.city.city }]
                  : []
              }
              placeholder="Kota"
            />

            <SelectField
              label="Kecamatan"
              name="district_code"
              value={form.district_code}
              disabled
              options={
                wilayah?.district
                  ? [
                      {
                        id: wilayah.district.district_code,
                        nama: wilayah.district.district,
                      },
                    ]
                  : []
              }
              placeholder="Kecamatan"
            />

            <SelectField
              label="Kelurahan"
              name="village_code"
              value={form.village_code}
              disabled
              options={
                wilayah?.village
                  ? [
                      {
                        id: wilayah.village.village_code,
                        nama: wilayah.village.village,
                      },
                    ]
                  : []
              }
              placeholder="Kelurahan"
            />

            <Field label="Ormas" required error={errors.ormas_id}>
              <Select
                options={ormasOptions}
                placeholder="Pilih Ormas"
                isClearable
                isSearchable
                isDisabled={isFormLocked} // ✅ NEW: lock juga saat restore preview
                value={
                  ormasOptions.find((o) => o.value === form.ormas_id) || null
                }
                onChange={(selected) => {
                  if (isFormLocked) return; // ✅ NEW
                  setForm((prev) => ({
                    ...prev,
                    ormas_id: selected ? selected.value : "",
                  }));

                  setErrors((prev) => ({
                    ...prev,
                    ormas_id: selected ? "" : "Ormas wajib dipilih",
                  }));
                }}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: "48px",
                    borderRadius: "8px",
                    backgroundColor: isFormLocked ? "#ffffff" : "#ffffff",
                    borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
                    boxShadow: "none",
                    "&:hover": { borderColor: "#cbd5e1" },
                    cursor: isFormLocked ? "not-allowed" : "default",
                    opacity: isFormLocked ? 0.9 : 1,
                  }),
                  valueContainer: (base) => ({ ...base, padding: "0 16px" }),
                  placeholder: (base) => ({ ...base, color: "#94a3b8" }),
                  singleValue: (base) => ({ ...base, color: "#0f172a" }),
                  indicatorsContainer: (base) => ({
                    ...base,
                    color: "#94a3b8",
                  }),
                  indicatorSeparator: () => ({ display: "none" }),
                  dropdownIndicator: (base) => ({
                    ...base,
                    color: "#94a3b8",
                    "&:hover": { color: "#64748b" },
                  }),
                  menu: (base) => ({ ...base, zIndex: 50 }),
                  menuList: (base) => ({ ...base, maxHeight: "120px" }),
                }}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg"
            >
              {mutation.isLoading ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              type="button"
              onClick={() => navigate(redirectPath)}
              className="text-gray-500 hover:text-underline"
            >
              Batal
            </button>
          </div>
        </form>
      </div>

      {/* RESTORE CONFIRM MODAL */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-blue-900">
              NIK Sudah Pernah Terdaftar
            </h3>

            <p className="text-gray-600 mb-6">
              NIK ini pernah terdaftar sebagai relawan dan saat ini nonaktif.
              Apakah ingin mengaktifkan kembali?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 rounded-lg border text-gray-600"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-lg bg-blue-900 text-white"
              >
                {isRestoring ? "Memuat..." : "Ya, Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================
   FIELD
========================= */
function Field({ label, required = false, error, children }) {
  return (
    <div>
      <label className="block mb-1 font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/* =========================
   SELECT FIELD (ICONIFY)
========================= */
function SelectField({
  label,
  required,
  error,
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) {
  return (
    <Field label={label} required={required} error={error}>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full appearance-none border rounded-lg px-6 py-3 pr-12
                      bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none
                      ${disabled ? "bg-slate-100 cursor-not-allowed" : ""}`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>

        {!disabled && (
          <Icon
            icon="mdi:chevron-down"
            width="22"
            className="absolute right-4 top-1/2 -translate-y-1/2
                      text-slate-400 pointer-events-none"
          />
        )}
      </div>
    </Field>
  );
}
