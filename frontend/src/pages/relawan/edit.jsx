import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/axios";
import toast from "react-hot-toast";

export default function EditRelawan() {
  const navigate = useNavigate();
  const { id } = useParams();

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
    Koordinator_name: "",
  });

  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [ormases, setOrmases] = useState([]);


  const [loading, setLoading] = useState(true);

  /* =============================
      LOAD DETAIL RELAWAN
  ============================= */
  useEffect(() => {
    api.get(`/relawan/${id}`)
      .then((res) => {
        const d = res.data.data;

        setForm({
          nama: d.nama,
          nik: d.nik,
          no_hp: d.no_hp,
          tps: d.tps,
          alamat: d.alamat,
          province_code: d.province_code,
          city_code: d.city_code,
          district_code: d.district_code,
          village_code: d.village_code,
          ormas_id: d.ormas?.id || "",
          koordinator_name: d.koordinator?.user?.name || "",
        });

        // load wilayah
        loadCities(d.province_code);
        loadDistricts(d.city_code);
        loadVillages(d.district_code);
        loadOrmases(d.ormas_code);
        loadOrmases();
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* =============================
      LOAD WILAYAH
  ============================= */

  const loadCities = async (provCode) => {
    const res = await api.get(`/wilayah/cities/${provCode}`);
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

  const loadOrmases = async () => {
  const res = await api.get("/ormas");
  setOrmases(res.data.data);
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
    const res = await api.put(`/relawan/${id}`, form);

    const akun = res.data?.data?.user;

    if (akun) {
      toast.success(
        `Data relawan berhasil diperbarui!\nEmail: ${akun.email}\nPassword: ${akun.password}`,
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
      toast.success("Data relawan berhasil diperbarui", {
        id: toastId,
      });
    }

    navigate(`/relawan/${id}`);
  } catch (err) {
    console.log(err.response?.data);

    const errors = err.response?.data?.errors;

    if (errors) {
      const firstError = Object.values(errors)[0][0];
      toast.error(firstError, { id: toastId });
      return;
    }

    toast.error("Gagal memperbarui data relawan", {
      id: toastId,
    });
  }
};

  if (loading) return <p className="text-center py-10">Loading...</p>;

  return (
    <div className="bg-white rounded-2xl p-8 shadow max-w-8xl mx-auto">
      <h2 className="text-4xl text-blue-900 font-bold mb-6 text-center">
        Edit Relawan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Nama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Nama</label>
          <input
            name="nama"
            value={form.nama}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        </div>

        {/* NIK */}
        <div>
          <label className="block mb-1 font-medium">NIK</label>
          <input
            name="nik"
            value={form.nik}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        </div>
        </div>

        {/* No HP & TPS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">No HP</label>
            <input
              name="no_hp"
              value={form.no_hp}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">TPS</label>
            <input
              name="tps"
              value={form.tps}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
          </div>
        </div>

         {/* Ormas/koordinator*/}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Ormas</label>
              <select
                name="ormas_id"
                value={form.ormas_id}
                // disabled
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="">-</option>
                {ormases.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nama_ormas}
                  </option>
                ))}
              </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Koordinator</label>
              <input
                value={form.koordinator_name}
                disabled
                className="w-full border rounded-lg px-4 py-2 bg-gray-100"
              />
          </div>
        </div>

        {/* Alamat */}
        <div>
          <label className="block mb-1 font-medium">Alamat</label>
          <textarea
            name="alamat"
            value={form.alamat}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        </div>

        {/* WILAYAH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Provinsi */}
          <div>
            <div className="mb-1 font-medium">Provinsi</div>
            <select
              value={31}
              disabled
              className="w-full border rounded-lg px-4 py-2 bg-gray-100"
            >
              <option value={31}>DKI JAKARTA</option>
            </select>
          </div>

          {/* Kota */}
          <div>
            <div className="mb-1 font-medium">Kota / Kabupaten</div>
            <select
              value={form.city_code}
              disabled
              className="w-full border rounded-lg px-4 py-2 bg-gray-100"
            >
              {cities.map(c => (
                <option key={c.code} value={c.code}>
                  {c.city}
                </option>
              ))}
            </select>
          </div>

          {/* Kecamatan */}
          <div>
            <div className="mb-1 font-medium">Kecamatan</div>
            <select
              value={form.district_code}
              disabled
              className="w-full border rounded-lg px-4 py-2 bg-gray-100"
            >
              {districts.map(d => (
                <option key={d.code} value={d.code}>
                  {d.district}
                </option>
              ))}
            </select>

          </div>

          {/* Kelurahan */}
          <div>
            <div className="mb-1 font-medium">Kelurahan</div>
            <select
              value={form.village_code}
              disabled
              className="w-full border rounded-lg px-4 py-2 bg-gray-100"
            >
              {villages.map(v => (
                <option key={v.code} value={v.code}>
                  {v.village}
                </option>
              ))}
            </select>

          </div>

        </div>

        {/* BUTTON */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="bg-blue-900 text-white px-6 py-2 rounded-lg"
          >
            Update
          </button>

          <button
            type="button"
            onClick={() => navigate(`/relawan/${id}`)}
            className="text-gray-500"
          >
            Batal
          </button>
        </div>

      </form>
    </div>
  );
}
