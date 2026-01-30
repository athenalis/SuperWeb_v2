import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import Select from "react-select";
import toast from "react-hot-toast";
import api from "../../../lib/axios";

export default function EditRelawanApk() {
  const { id } = useParams();
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

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  /* =========================
     VALIDASI
  ========================= */
  const validateField = (name, value) => {
    switch (name) {
      case "nama":
        if (!value.trim()) return "Nama wajib diisi";
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

      case "alamat":
        if (!value.trim()) return "Alamat wajib diisi";
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
     FETCH DETAIL RELAWAN APK
  ========================= */
  useEffect(() => {
    api
      .get(`/relawan/apk/${id}`)
      .then((res) => {
        const d = res.data.data;

        setForm({
          nama: d.nama,
          nik: d.nik,
          no_hp: d.no_hp,
          alamat: d.alamat,
          province_code: d.province_code,
          city_code: d.city_code,
          district_code: d.district_code,
          village_code: d.village_code,
          ormas_id: d.ormas_id ?? "",
        });
      })
      .catch(() => {
        toast.error("Gagal memuat data relawan APK");
        navigate("/relawan/apk");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

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
     WILAYAH (LOCKED – KOOR APK)
  ========================= */
  const { data: wilayah, isLoading: loadingWilayah } = useQuery({
    queryKey: ["wilayah-koordinator-apk"],
    queryFn: async () => (await api.get("/me/wilayah-apk")).data.data,
  });

  /* =========================
     SUBMIT UPDATE
  ========================= */
  const mutation = useMutation({
    mutationFn: async () => api.put(`/relawan/apk/${id}`, form),

    onSuccess: () => {
      queryClient.invalidateQueries(["relawan-apk"]);
      toast.success("Data relawan APK berhasil diperbarui");
      navigate(`/relawan/apk/${id}`);
    },

    onError: (err) => {
      const msg =
        err.response?.data?.message || "Gagal memperbarui data";
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateAll()) {
      toast.error("Periksa kembali form Anda");
      return;
    }

    mutation.mutate();
  };

  if (loading || loadingWilayah) {
    return (
      <div className="p-10 text-center text-slate-500">
        Memuat data relawan APK...
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
    <div className="bg-white rounded-2xl p-8 shadow max-w-8xl mx-auto">
      <h2 className="text-4xl text-blue-900 font-bold mb-6 text-center">
        Edit Relawan APK
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="NIK">
            <input
              value={form.nik}
              disabled
              className={`${baseInput} bg-slate-100 cursor-not-allowed`}
            />
          </Field>

          <Field label="Nama" required error={errors.nama}>
            <input
              name="nama"
              value={form.nama}
              onChange={handleChange}
              className={baseInput}
            />
          </Field>
        </div>

        <Field label="No HP" required error={errors.no_hp}>
          <input
            name="no_hp"
            value={form.no_hp}
            onChange={handleChange}
            className={baseInput}
            inputMode="numeric"
          />
        </Field>

        <Field label="Alamat" required error={errors.alamat}>
          <textarea
            name="alamat"
            value={form.alamat}
            onChange={handleChange}
            className={baseInput}
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
            value={form.city_code}
            disabled
            options={[
              {
                id: wilayah.city.city_code,
                nama: wilayah.city.city,
              },
            ]}
          />

          <SelectField
            label="Kecamatan"
            value={form.district_code}
            disabled
            options={[
              {
                id: wilayah.district.district_code,
                nama: wilayah.district.district,
              },
            ]}
          />

          <SelectField
            label="Kelurahan"
            value={form.village_code}
            disabled
            options={[
              {
                id: wilayah.village.village_code,
                nama: wilayah.village.village,
              },
            ]}
          />

          <Field label="Ormas" required error={errors.ormas_id}>
            <Select
              options={ormasOptions}
              isClearable
              isSearchable
              placeholder="Pilih Ormas"
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
                control: (base) => ({
                  ...base,
                  minHeight: "48px",
                  borderRadius: "8px",
                }),
                menu: (base) => ({ ...base, zIndex: 50 }),
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
            {mutation.isLoading ? "Menyimpan..." : "Update"}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/relawan/apk/${id}`)}
            className="text-gray-500"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
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
   SELECT FIELD
========================= */
function SelectField({ label, value, options, disabled }) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          className={`w-full appearance-none border rounded-lg px-6 py-3 pr-12
                      bg-white focus:outline-none
                      ${disabled ? "bg-slate-100 cursor-not-allowed" : ""}`}
        >
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
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}
      </div>
    </Field>
  );
}
