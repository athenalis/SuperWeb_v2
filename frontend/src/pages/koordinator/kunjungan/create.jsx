
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import api from "../../../lib/axios";

export default function InputKoordinator({ onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    nama: "",
    nik: "",
    no_hp: "",
    tps: "",
    alamat: "",
    province_code: 31,
    city_code: "",
    district_code: "",
    village_code: "",
  });

  const [errors, setErrors] = useState({});
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreNik, setRestoreNik] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredUser, setRestoredUser] = useState(null);
  const [isRestoreMode, setIsRestoreMode] = useState(false);


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

case "no_hp": 
  // boleh angka dan + (khusus di awal)
  if (!/^\+?\d*$/.test(value))
    return "No HP hanya boleh angka atau +62";

  // normalisasi untuk hitung panjang
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

      case "tps":
        if (!/^\d*$/.test(value)) return "TPS harus angka";
        if (value.length !== 3) return "TPS wajib 3 digit";
        break;

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

      default:
        return "";
    }
    return "";
  };

  /* =========================
     HANDLE CHANGE
  ========================= */
  const handleChange = (e) => {
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

  const checkNik = async (nik) => {
    const res = await api.post("/koordinator/check-nik", { nik });
  
    if (res.data.exists && res.data.deleted) {
      setRestoreNik(nik);
      setShowRestoreConfirm(true);
    }
  };  

  const handleRestore = async () => {
    if (!restoreNik) return;
  
    setIsRestoring(true);
  
    try {
      const res = await api.post("/koordinator/restore", {
        nik: restoreNik,
      });
  
      const { koordinator, user } = res.data.data;
  
      setForm({
        nama: koordinator.nama,
        nik: koordinator.nik,
        no_hp: koordinator.no_hp,
        tps: koordinator.tps,
        alamat: koordinator.alamat,
        province_code: koordinator.province_code,
        city_code: koordinator.city_code,
        district_code: koordinator.district_code,
        village_code: koordinator.village_code,
      });
  
      setIsRestoreMode(true);
      setRestoredUser(user);
      setShowRestoreConfirm(false);
    } catch (err) {
      console.error(err.response?.data);
      toast.error("Gagal mengaktifkan koordinator");
    } finally {
      setIsRestoring(false);
    }
  };  

  /* =========================
     WILAYAH API
  ========================= */
  const { data: cities = [] } = useQuery({
    queryKey: ["cities", form.province_code],
    queryFn: async () => (await api.get(`/wilayah/cities/${form.province_code}`)).data,
    enabled: !!form.province_code,
  });

  const { data: districts = [] } = useQuery({
    queryKey: ["districts", form.city_code],
    queryFn: async () => (await api.get(`/wilayah/districts/${form.city_code}`)).data,
    enabled: !!form.city_code,
  });

  const { data: villages = [] } = useQuery({
    queryKey: ["villages", form.district_code],
    queryFn: async () => (await api.get(`/wilayah/villages/${form.district_code}`)).data,
    enabled: !!form.district_code,
  });

  /* =========================
     SUBMIT
  ========================= */
     const mutation = useMutation({
  mutationFn: async () => api.post("/koordinator", form),
onSuccess: (res) => {
  queryClient.invalidateQueries(["koordinators"]);

  const akun = res.data.data.user; 

  if (restoredUser) {
    toast.success(
      `Koordinator berhasil diaktifkan!\nEmail: ${restoredUser.email}\nPassword: ${restoredUser.password}`,
      {
        duration: 6000,
        style: { whiteSpace: "pre-line" },
      }
    );

    setRestoredUser(null);
  } else {
    // fallback: create baru
    const akun = res.data.data.user;

    toast.success(
      `Koordinator berhasil dibuat!\nEmail: ${akun.email}\nPassword: ${akun.password}`,
      {
        duration: 5000,
        style: { whiteSpace: "pre-line" },
      }
    );
  }

  navigate("/koordinator/kunjungan"); // hanya ini

  },
  onError: (err) => {
     console.log("ERROR:", err.response?.data); // 🔥 DEBUG PENTING

    const errors = err.response?.data?.errors;

    if (errors) {
      // tampilkan semua pesan validasi
      Object.values(errors).forEach((msgList) => {
        toast.error(msgList[0]);
      });
      return;
    }

    toast.error(err.response?.data?.message || "Gagal menyimpan data");
  },
});

  const handleSubmit = (e) => {
  e.preventDefault();
  if (!validateAll()) {
    toast.error("Periksa kembali form Anda");
    return;
  }
  if (isRestoreMode) {
    toast.success(
      `Koordinator berhasil diaktifkan!\nEmail: ${restoredUser.email}\nPassword: ${restoredUser.password}`,
      { duration: 6000, style: { whiteSpace: "pre-line" } }
    );

    navigate("/koordinator/kunjungan");
    return;
  }
  mutation.mutate();
};
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
          Input Koordinator
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
                  if (form.nik.length === 16) {
                    checkNik(form.nik);
                  }
                }}
                className="w-full text-lg border border-gray-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400 font-medium"
                inputMode="numeric"
                placeholder="Masukkan NIK"
              />
            </Field>
  
            <Field label="Nama Lengkap" required error={errors.nama}>
              <input
                name="nama"
                value={form.nama}
                onChange={handleChange}
                className="w-full text-lg border border-gray-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400 font-medium"
              />
            </Field>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="No HP" required error={errors.no_hp}>
              <input
                name="no_hp"
                value={form.no_hp}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!/^\+?\d*$/.test(value)) return;
                  if (value.length > 14) return;
                  handleChange(e);
                }}
                className="w-full text-lg border border-gray-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400 font-medium"
                inputMode="numeric"
                placeholder="Cth: 0821xxxx, 62821xxxx, +62821xxxx"
              />
            </Field>
  
            <Field label="TPS" required error={errors.tps}>
              <input
                name="tps"
                value={form.tps}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!/^\d*$/.test(value)) return;
                  if (value.length > 3) return;
                  handleChange(e);
                }}
                className="w-full text-lg border border-gray-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400 font-medium"
                inputMode="numeric"
                placeholder="Cth: 001"
              />
            </Field>
          </div>
  
          <Field label="Alamat" required error={errors.alamat}>
            <textarea
              name="alamat"
              value={form.alamat}
              onChange={handleChange}
              className="w-full text-lg border border-gray-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400 font-medium"
              placeholder="Masukkan alamat anda"
            />
          </Field>
  
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
              required
              error={errors.city_code}
              name="city_code"
              value={form.city_code}
              onChange={handleChange}
              options={cities}
              placeholder="Pilih Kota/Kabupaten"
              valueKey="city_code"
              labelKey="city"
              
            />
  
            <SelectField
              label="Kecamatan"
              required
              error={errors.district_code}
              name="district_code"
              value={form.district_code}
              onChange={handleChange}
              options={districts}
              placeholder="Pilih Kecamatan"
              disabled={!form.city_code}
              valueKey="district_code"
              labelKey="district"
            />
  
            <SelectField
              label="Kelurahan"
              required
              error={errors.village_code}
              name="village_code"
              value={form.village_code}
              onChange={handleChange}
              options={villages}
              placeholder="Pilih Kelurahan"
              disabled={!form.district_code}
              valueKey="village_code"
              labelKey="village"
            />
          </div>
  
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-bold"
            >
              {mutation.isLoading ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/koordinator")}
              className="bg-white-100 px-6 py-2 rounded-lg text-gray-600 hover:underline font-bold"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
  
      {/* =========================
          SHOW RESTORE MODAL
      ========================= */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-blue-900">
              NIK Sudah Pernah Terdaftar
            </h3>
            <p className="text-gray-600 mb-6">
              NIK ini pernah terdaftar dan saat ini nonaktif.
              Apakah ingin mengaktifkan kembali?
            </p>
  
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Batal
              </button>
              <button
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
      <label className="block mb-3 font-bold">
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
  valueKey,
  labelKey,
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
            <option key={o[valueKey]} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>

        <Icon
          icon="mdi:chevron-down"
          width="22"
          className="absolute right-4 top-1/2 -translate-y-1/2
                  text-slate-400 pointer-events-none"
        />
      </div>
    </Field>
  );
} 