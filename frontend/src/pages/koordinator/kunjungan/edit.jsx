import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../lib/axios";
import toast from "react-hot-toast";
import { Icon } from "@iconify/react";

export default function EditKoordinator() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState({
    nama: "",
    nik: "",
    no_hp: "",
    alamat: "",
    province_code: 31,
    city_code: "",
    district_code: "",
    village_code: "",
  });

  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [loading, setLoading] = useState(false);

  /* =============================
      LOAD DETAIL KOORDINATOR
  ============================= */
  useEffect(() => {
    api.get(`/koordinator/${id}`)
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
        });

        // load wilayah
        loadCities(d.province_code);
        loadDistricts(d.city_code);
        loadVillages(d.district_code);
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* =============================
      LOAD WILAYAH
  ============================= */

  const loadCities = async (provinceCode) => {
    const res = await api.get(`/wilayah/cities/${provinceCode}`);
    setCities(res.data);
  };

  const loadDistricts = async (cityCode) => {
    if (!cityCode) return;
    const res = await api.get(`/wilayah/districts/${cityCode}`);
    setDistricts(res.data);
  };

  const loadVillages = async (districtCode) => {
    if (!districtCode) return;
    const res = await api.get(`/wilayah/villages/${districtCode}`);
    setVillages(res.data);
  };


  /* =============================
      HANDLE CHANGE (CASCADE)
  ============================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "city_code" && { district_code: "", village_code: "" }),
      ...(name === "district_code" && { village_code: "" }),
    }));

    if (name === "city_code") loadDistricts(value);
    if (name === "district_code") loadVillages(value);
  };

  /* =============================
      SUBMIT UPDATE
  ============================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    const toastId = toast.loading("Menyimpan perubahan...");

    try {
      const res = await api.put(`/koordinator/${id}`, form);

      const akun = res.data?.data?.user;

      if (akun) {
        toast.success(
          `Data koordinator berhasil diperbarui!\nEmail: ${akun.email}\nPassword: ${akun.password}`,
          {
            id: toastId,
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
      } else {
        toast.success("Data koordinator berhasil diperbarui", {
          id: toastId,
        });
      }

      navigate(`/koordinator/kunjungan/${id}`);
    } catch (err) {
      console.log(err.response?.data);

      const errors = err.response?.data?.errors;

      if (errors) {
        // tampilkan error pertama saja (UX lebih bersih)
        const firstError = Object.values(errors)[0][0];
        toast.error(firstError, { id: toastId });
        return;
      }

      toast.error("Gagal memperbarui data", {
        id: toastId,
      });
    }
  };


  if (loading) return <p className="text-center py-10">Loading...</p>;

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
        Edit Koordinator Kunjungan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* NIK */}
        <div>
            <label className="block mb-3 font-bold">NIK</label>
            <input
              name="nik"
              value={form.nik}
              onChange={handleChange}
              className="w-full text-md border border-slate-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              required
            />
          </div>

          {/* NAMA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-3 font-bold">Nama</label>
            <input
              name="nama"
              value={form.nama}
              onChange={handleChange}
              className="w-full text-md border border-slate-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              required
            />
          </div>
        
        {/* No HP */}
          <div>
            <label className="block mb-3 font-bold">No HP</label>
            <input
              name="no_hp"
              value={form.no_hp}
              onChange={handleChange}
              className="w-full text-md border border-slate-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              required
            />
          </div>
        </div>

        {/* Alamat */}
        <div>
          <label className="block mb-3 font-bold">Alamat</label>
          <textarea
            name="alamat"
            value={form.alamat}
            onChange={handleChange}
            className="w-full text-md border border-slate-400 pl-5 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
            required
          />
        </div>

        {/* WILAYAH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Provinsi */}
          <div>
            <div className="block mb-3 font-bold">Provinsi</div>
            <select
              value={31}
              disabled
              className={`border border-slate-400 px-6 py-3 pr-12 ${baseSelect} ${disabledSelect}`}
            >
              <option value={31}>DKI JAKARTA</option>
            </select>
          </div>

          {/* Kota */}
          <div>
            <div className="block mb-3 font-bold">Kota / Kabupaten</div>

            <div className="relative">
              <select
                name="city_code"
                value={form.city_code}
                onChange={handleChange}
                className="w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white"
                required
              >
                <option value="" disabled>
                  Pilih Kota
                </option>

                {cities.map((c) => (
                  <option key={c.city_code} value={c.city_code}>
                    {c.city}
                  </option>
                ))}
              </select>

              {/* ICON CHEVRON */}
              <Icon
                icon="mdi:chevron-down"
                width={22}
                className="absolute right-4 top-1/2 -translate-y-1/2
                          text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Kecamatan */}
          <div>
            <div className="block mb-3 font-bold">Kecamatan</div>
              <div className="relative">
                <select
                  name="district_code"
                  value={form.district_code}
                  onChange={handleChange}
                  className="w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white"
                  required
                  disabled={!form.city_code}
                >
                  <option value="" disabled>Pilih Kecamatan</option>

                  {districts.map((d) => (
                    <option key={d.district_code} value={d.district_code}>
                      {d.district}
                    </option>
                  ))}
                </select>

                {/* ICON CHEVRON */}
                  <Icon
                    icon="mdi:chevron-down"
                    width={22}
                    className="absolute right-4 top-1/2 -translate-y-1/2
                              text-slate-400 pointer-events-none"
                  />
              </div>
          </div>

          {/* Kelurahan */}
          <div>
            <div className="block mb-3 font-bold">Kelurahan</div>
              <div className="relative">
                <select
                  name="village_code"
                  value={form.village_code}
                  onChange={handleChange}
                  className="w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white"
                  required
                  disabled={!form.district_code}
                >
                  <option value="" disabled>Pilih Kelurahan</option>

                  {villages.map((v) => (
                    <option key={v.village_code} value={v.village_code}>
                      {v.village}
                    </option>
                  ))}
                </select>
                {/* ICON CHEVRON */}
                    <Icon
                      icon="mdi:chevron-down"
                      width={22}
                      className="absolute right-4 top-1/2 -translate-y-1/2
                                text-slate-400 pointer-events-none"
                    />
              </div>
              </div>
        </div>

        {/* BUTTON */}
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="submit"
            className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Update
          </button>

          <button
            type="button"
            onClick={() => navigate(`/koordinator/kunjungan/${id}`)}
            className="bg-white-100 px-6 py-2 rounded-lg text-gray-600 hover:underline font-semibold"
          >
            Batal
          </button>
        </div>

      </form>
    </div>
  );
}
