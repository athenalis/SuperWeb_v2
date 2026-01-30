import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import Select from "react-select";
import toast from "react-hot-toast";
import api from "../../../lib/axios";

export default function InputRelawanApk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    nama: "",
    nik: "",
    no_hp: "",
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
        // boleh angka dan + (khusus di awal)
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
     HANDLE CHANGE
  ========================= */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  /* =========================
     CHECK NIK (APK)
  ========================= */
  const checkNik = async (nik) => {
    try {
      const res = await api.post("/relawan/apk/check-nik", { nik });
      const data = res.data;

      // ❌ NIK sudah aktif
      if (data.exists && data.deleted === false) {
        toast.error(data.message || "NIK sudah terdaftar dan aktif");
        setIsNikBlocked(true);
        return;
      }

      // 🔁 NIK pernah ada (soft delete) → restore
      if (data.exists && data.deleted === true) {
        setRestoreNik(nik);
        setShowRestoreConfirm(true);
        setIsNikBlocked(false);
        return;
      }

      // ✅ aman
      setIsNikBlocked(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal cek NIK");
    }
  };

  const handleRestore = async () => {
    if (!restoreNik) return;

    setIsRestoring(true);

    try {
      const res = await api.post("/relawan/apk/restore", { nik: restoreNik });
      const { relawan, user } = res.data.data;

      setForm({
        nama: relawan.nama,
        nik: relawan.nik,
        no_hp: relawan.no_hp,
        alamat: relawan.alamat,
        province_code: relawan.province_code,
        city_code: relawan.city_code,
        district_code: relawan.district_code,
        village_code: relawan.village_code,
        ormas_id: relawan.ormas_id ?? "",
      });

      setIsRestoreMode(true);
      setRestoredUser(user);
      setShowRestoreConfirm(false);
    } catch (err) {
      toast.error("Gagal mengaktifkan relawan");
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
     WILAYAH (Bawaan Koor APK)
  ========================= */
  const { data: wilayah, isLoading: loadingWilayah } = useQuery({
    queryKey: ["wilayah-koordinator-apk"],
    queryFn: async () => (await api.get("/me/wilayah-apk")).data.data,
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
     SUBMIT
  ========================= */
  const mutation = useMutation({
    // NOTE: kalau backend kamu pakai /relawan-apk, ganti di sini
    mutationFn: async () => api.post("/relawan/apk", form),

    onSuccess: (res) => {
      queryClient.invalidateQueries(["relawan-apk"]);

      const akun = res.data.data.user;

      toast.success(
        `Relawan APK berhasil dibuat!\nEmail: ${akun.email}\nPassword: ${akun.password}`,
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

      navigate("/relawan/apk");
    },

    onError: (err) => {
      const msg = err.response?.data?.message || "Gagal menyimpan data";

      toast.error(msg, {
        style: {
          background: "#dc2626",
          color: "white",
        },
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateAll()) {
      toast.error("Periksa kembali form Anda");
      return;
    }

    if (isNikBlocked) {
      toast.error("NIK tidak valid atau sudah aktif");
      return;
    }

    if (isRestoreMode) {
      toast.success(
        `Relawan berhasil diaktifkan!\nEmail: ${restoredUser.email}\nPassword: ${restoredUser.password}`,
        { duration: 6000, style: { whiteSpace: "pre-line" } }
      );

      navigate("/relawan/apk");
      return;
    }

    mutation.mutate();
  };

  if (loadingWilayah) {
    return (
      <div className="p-10 text-center text-slate-500">
        Memuat data wilayah Relawan APK...
      </div>
    );
  }

  /* =========================
     STYLE
  ========================= */
  const baseInput =
    "w-full border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";

  const baseSelect =
    "w-full appearance-none border rounded-lg px-4 py-2 pr-10 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";

  const disabledSelect = "bg-slate-100 cursor-not-allowed";

  return (
    <>
      <div className="bg-white rounded-2xl p-8 shadow max-w-8xl mx-auto">
        <h2 className="text-4xl text-blue-900 font-bold mb-6 text-center">
          Input Relawan APK
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="NIK" required error={errors.nik}>
              <input
                name="nik"
                value={form.nik}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!/^\d*$/.test(value)) return;
                  if (value.length > 16) return;
                  handleChange(e);
                }}
                onBlur={() => {
                  if (form.nik.length === 16) checkNik(form.nik);
                }}
                className={baseInput}
                inputMode="numeric"
                placeholder="Masukkan NIK"
              />
            </Field>

            <Field label="Nama" required error={errors.nama}>
              <input
                name="nama"
                value={form.nama}
                onChange={handleChange}
                className={baseInput}
                placeholder="Masukkan nama lengkap"
              />
            </Field>
          </div>

          <Field label="No HP" required error={errors.no_hp}>
            <input
              name="no_hp"
              value={form.no_hp}
              onChange={(e) => {
                const value = e.target.value;
                if (!/^\d*$/.test(value)) return;
                if (value.length > 13) return;
                handleChange(e);
              }}
              className={baseInput}
              inputMode="numeric"
              placeholder="Masukkan No. HP"
            />
          </Field>

          <Field label="Alamat" required error={errors.alamat}>
            <textarea
              name="alamat"
              value={form.alamat}
              onChange={handleChange}
              className={baseInput}
              placeholder="Masukkan alamat lengkap"
            />
          </Field>

          {/* WILAYAH (LOCKED) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Provinsi">
              <select
                disabled
                value={31}
                className={`px-6 py-3 pr-12 ${baseSelect} ${disabledSelect}`}
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
                value={
                  ormasOptions.find((o) => o.value === form.ormas_id) || null
                }
                onChange={(selected) => {
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
                    backgroundColor: "#ffffff",
                    borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
                    boxShadow: "none",
                    "&:hover": { borderColor: "#cbd5e1" },
                  }),
                  valueContainer: (base) => ({ ...base, padding: "0 16px" }),
                  placeholder: (base) => ({ ...base, color: "#94a3b8" }),
                  singleValue: (base) => ({ ...base, color: "#0f172a" }),
                  indicatorsContainer: (base) => ({ ...base, color: "#94a3b8" }),
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
              onClick={() => navigate("/relawan/apk")}
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
                {isRestoring ? "Mengaktifkan..." : "Ya, Aktifkan"}
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
