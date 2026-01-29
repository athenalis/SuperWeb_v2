import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import Select from "react-select";
import toast from "react-hot-toast";
import api from "../../../lib/axios";


export default function InputRelawan({ onClose }) {
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
    try {
      const res = await api.post("/relawan/check-nik", { nik });
      const data = res.data;
  
      // ❌ NIK sudah aktif → stop
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
  
      // ✅ NIK aman
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
      const res = await api.post("/relawan/restore", { nik: restoreNik });

      const { relawan, user } = res.data.data;

      setForm({
        nama: relawan.nama,
        nik: relawan.nik,
        no_hp: relawan.no_hp,
        tps: relawan.tps,
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

  const { data: ormasRaw = [] } = useQuery({
    queryKey: ["ormas"],
    queryFn: async () => (await api.get("/ormas")).data.data,
  });

  const ormasOptions = ormasRaw.map((o) => ({
    value: o.id,
    label: o.nama_ormas,
  }));

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

  const mutation = useMutation({
    mutationFn: async () => api.post("/relawan", form),

    onSuccess: (res) => {
      queryClient.invalidateQueries(["relawan"]);

      const akun = res.data.data.user;

      toast.success(
        `Relawan berhasil dibuat!\nEmail: ${akun.email}\nPassword: ${akun.password}`,
        {
          duration: 5000,
          style: {
            whiteSpace: "pre-line",
            background: "#1e293b",
            color: "white",
            padding: "14px",
            borderRadius: "10px",
          },
        }
      );

      navigate("/relawan");
    },

    onError: (err) => {
      const msg =
        err.response?.data?.message || "Gagal menyimpan data";

      toast.error(msg, {
        style: {
          background: "#dc2626",
          color: "white",
        },
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
  
      navigate("/relawan");
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
          Input Relawan
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
                  checkNik(form.nik); // 🔥 ADD
                }
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className={baseInput}
                inputMode="numeric"
                placeholder="Cth: 001"
              />
            </Field>
          </div>

          <Field label="Alamat" required error={errors.alamat}>
            <textarea name="alamat" value={form.alamat} onChange={handleChange} className={baseInput} placeholder="Masukkan alamat lengkap" />
          </Field>

          {/* WILAYAH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Field label="Provinsi">
              <select disabled value={31} className={`px-6 py-3 pr-12 ${baseSelect} ${disabledSelect}`}>
                <option>DKI JAKARTA</option>
              </select>
            </Field>

            <SelectField
              label="Kota/Kabupaten"
              name="city_code"
              value={form.city_code}
              disabled
              options={
                wilayah.city
                  ? [{ id: wilayah.city.city_code, nama: wilayah.city.city }]
                  : []
              }
            />


            <SelectField
              label="Kecamatan"
              name="district_code"
              value={form.district_code}
              disabled
              options={
                wilayah.district
                  ? [{ id: wilayah.district.district_code, nama: wilayah.district.district }]
                  : []
              }
            />


            <SelectField
              label="Kelurahan"
              name="village_code"
              value={form.village_code}
              disabled
              options={
                wilayah.village
                  ? [{ id: wilayah.village.village_code, nama: wilayah.village.village }]
                  : []
              }
            />

            <Field label="Ormas" required error={errors.ormas_id}>
            <Select
              options={ormasOptions}
              placeholder="Pilih Ormas"
              isClearable
              isSearchable

              value={ormasOptions.find(o => o.value === form.ormas_id) || null}

              onChange={(selected) => {
                setForm(prev => ({
                  ...prev,
                  ormas_id: selected ? selected.value : "",
                }));

                setErrors(prev => ({
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
                "&:hover": {
                  borderColor: "#cbd5e1",
                },
              }),

              valueContainer: (base) => ({
                ...base,
                padding: "0 16px",
              }),

              placeholder: (base) => ({
                ...base,
                color: "#94a3b8", // slate-400
              }),

              singleValue: (base) => ({
                ...base,
                color: "#0f172a", // slate-900
              }),

              indicatorsContainer: (base) => ({
                ...base,
                color: "#94a3b8",
              }),

              indicatorSeparator: () => ({
                display: "none",
              }),

              dropdownIndicator: (base) => ({
                ...base,
                color: "#94a3b8",
                "&:hover": {
                  color: "#64748b",
                },
              }),

              menu: (base) => ({
                ...base,
                zIndex: 50,
              }),

              menuList: (base) => ({
                ...base,
                maxHeight: "120px",
              }),
            }}
            />
          </Field>

          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button type="submit" disabled={mutation.isLoading} className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg">
              {mutation.isLoading ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => navigate("/relawan")} className="text-gray-500 hover:text-underline">
              Batal
            </button>
          </div>
        </form>
      </div>
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
