import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Icon } from "@iconify/react";
// import api from "../../lib/axios";
import { validateKTP } from "../../lib/ktpValidator";
import CameraCapture from "../../components/CameraCapture";

// --- REUSABLE COMPONENTS ---
const Input = ({ label, className = "", ...props }) => (
  <div className={className}>
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{label} {props.required && <span className="text-red-500">*</span>}</label>
    <input className="w-full px-4 py-3 bg-slate-50 border-slate-200 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400" {...props} />
  </div>
);

const Select = ({ label, options, className = "", ...props }) => (
  <div className={className}>
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{label} {props.required && <span className="text-red-500">*</span>}</label>
    <div className="relative">
      <select className="w-full px-4 py-3 bg-slate-50 border-slate-200 border rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none font-medium text-slate-800" {...props}>
        <option value="">Pilih {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <Icon icon="mdi:chevron-down" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

const Alert = ({ type, message }) => {
  const styles = type === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-blue-50 border-blue-200 text-blue-700';
  const icon = type === 'error' ? 'mdi:alert-circle' : 'mdi:information';
  return (
    <div className={`p-4 rounded-xl border ${styles} flex gap-3 text-sm animate-in fade-in zoom-in-95`}>
      <Icon icon={icon} className="text-xl shrink-0 mt-0.5" />
      <div>{message}</div>
    </div>
  );
};

const PermissionModal = ({ onRetry, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon icon="mdi:map-marker-off" width="32" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Izin Lokasi Ditolak</h3>
      <p className="text-slate-500 text-sm mt-2 mb-6">
        Aplikasi membutuhkan akses lokasi untuk menyimpan koordinat kunjungan. Mohon aktifkan GPS.
      </p>
      <button onClick={onRetry} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
        {loading ? "Mencoba lagi..." : "Coba Lagi"}
      </button>
    </div>
  </div>
);

const maxDate17 = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().split('T')[0];
};

const compressImage = (file, maxWidth = 1024, quality = 0.7) => {
  return new Promise((resolve) => {
    if (file.size < 500 * 1024) { resolve(file); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", quality);
      };
    };
  });
};

// --- MAIN PAGE ---
export default function EditKunjungan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get(`/kunjungan/${id}`);
      if (res.data.success) {
        const data = res.data.data;
        if (data.status_verifikasi !== 'rejected' && data.status_verifikasi !== 'pending') {
          toast.error('Hanya kunjungan Pending/Ditolak yang bisa diedit.');
          navigate(`/kunjungan/${id}`, { replace: true });
          return;
        }
        setInitialData(data);
      }
    } catch (err) {
      toast.error('Gagal memuat data');
      navigate('/kunjungan');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishDirectly = () => {
    toast.success("Perubahan Disimpan ");
    navigate(`/kunjungan/${id}`, { replace: true });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 md:py-8 md:px-4">
      <div className="w-full md:max-w-5xl md:mx-auto h-full">
        <div className="bg-white w-full min-h-[100dvh] md:min-h-0 md:rounded-2xl md:shadow-xl overflow-hidden flex flex-col">
          {/* Header matches CreateKunjungan exactly */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 md:px-8 md:py-6 flex items-center gap-4 sticky top-0 z-20 shadow-sm md:shadow-none md:relative">
            <button onClick={() => setShowExitModal(true)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all active:scale-95">
              <Icon icon="mdi:arrow-left" className="text-xl md:text-2xl" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl md:text-3xl font-bold text-white leading-tight">Edit Kunjungan</h1>
              <p className="text-blue-100 text-xs md:text-base hidden md:block">Perbarui data kunjungan</p>
            </div>
          </div>

          <div className="px-5 md:px-8 py-4 bg-gray-50 border-b">
            {/* Simple stepper reuse */}
            <div className="flex justify-center gap-4">
              {[{ n: 1, t: "Data Keluarga" }, { n: 2, t: "Kuisioner" }].map(s => (
                <div key={s.n} className={`flex items-center gap-2 px-4 py-2 rounded-full border ${step === s.n ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.n ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{s.n}</div>
                  <span className="text-xs font-bold uppercase">{s.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6 flex-1 overflow-y-auto">
            {step === 1 && (
              <StepMobileEdit
                initial={initialData}
                kunjunganId={id}
                onNext={() => { setStep(2); window.scrollTo(0, 0); }}
                onFinishDirect={handleFinishDirectly}
              />
            )}
            {step === 2 && (
              <Step3
                kunjunganId={id}
                initialAnswers={initialData.kepuasan || {}}
                onBack={() => { setStep(1); window.scrollTo(0, 0); }}
                onComplete={handleFinishDirectly}
              />
            )}
          </div>
        </div>
      </div>

      {showExitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Batal Edit?</h3>
            <p className="text-slate-500 mb-6">Perubahan yang belum disimpan mungkin akan hilang.</p>
            <div className="space-y-3">
              <button onClick={() => navigate('/kunjungan')} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold">Keluar Tanpa Simpan</button>
              <button onClick={() => setShowExitModal(false)} className="w-full py-3 text-slate-600 font-bold">Lanjut Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STEP MOBILE EDIT (Copied from StepMobileBiodata + Adaptations for Edit) ---
const StepMobileEdit = ({ initial, kunjunganId, onNext, onFinishDirect }) => {
  const url = (p) => p ? (p.startsWith('http') ? p : `${api.defaults.baseURL.replace('/api', '')}/storage/${p}`) : "";

  const [form, setForm] = useState({
    nama: initial?.nama || "",
    nik: initial?.nik || "",
    tanggal: initial?.tanggal || "",
    pendidikan: initial?.pendidikan || "",
    pekerjaan: initial?.pekerjaan || "",
    penghasilan: initial?.penghasilan || "",
    fotoKtp: null,
    alamat: initial?.alamat || "",
    latitude: initial?.latitude || "",
    longitude: initial?.longitude || ""
  });

  const [previewUrl, setPreviewUrl] = useState(url(initial?.foto_ktp));
  const [members, setMembers] = useState(initial?.family_form?.members?.map(m => ({
    ...m,
    isLocal: false,
    previewUrl: url(m.foto_ktp),
    tanggalLahir: m.tanggal_lahir
  })) || []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pekerjaanList, setPekerjaanList] = useState([]);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMemberId, setCameraMemberId] = useState(null);

  useEffect(() => {
    api.get("/wilayah/pekerjaan").then(res => setPekerjaanList(res.data.map(i => i.nama))).catch(() => { });

    // Auto-GPS if missing
    if (!form.latitude || !form.longitude) {
      handleGPS();
    }
  }, []);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const l = toast.loading("Validasi KTP...");
    const val = await validateKTP(file);
    toast.dismiss(l);
    if (!val.isValid) return toast.error(val.message);
    setForm(p => ({ ...p, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCameraHead = async (file) => {
    const l = toast.loading("Validasi KTP...");
    const val = await validateKTP(file);
    toast.dismiss(l);
    if (!val.isValid) return toast.error(val.message);
    setForm(p => ({ ...p, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
    setShowCamera(false);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) return toast.error("Browser tidak mendukung GPS");
    setLoadingGps(true);
    setGpsStatus("Mencari...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm(p => ({ ...p, latitude, longitude }));
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error("Gagal mengambil alamat response not ok");
          const d = await res.json();
          if (d.display_name) {
            setForm(p => ({ ...p, alamat: d.display_name }));
            setGpsStatus("Alamat OK");
          } else {
            setGpsStatus("Alamat Gagal");
          }
        } catch (err) {
          console.error(err);
          toast.error("Gagal deteksi alamat otomatis, mohon isi manual.");
          setGpsStatus("Lokasi OK");
        }
        setLoadingGps(false);
      },
      (e) => {
        setLoadingGps(false);
        if (e.code === 1) {
          setShowPermissionModal(true);
        } else {
          toast.error("Gagal ambil GPS: " + e.message);
        }
        setGpsStatus("Gagal");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // Member
  const addMember = () => setMembers([...members, { id: Date.now(), isLocal: true, nama: "", nik: "", hubungan: "", tanggalLahir: "", pekerjaan: "", pendidikan: "", penghasilan: "", fotoKtp: null, previewUrl: "" }]);
  const removeMember = async (id, isLocal) => {
    if (!isLocal && !window.confirm("Hapus anggota ini dari database?")) return;
    if (!isLocal) { try { await api.delete(`/kunjungan/anggota/${id}`); } catch { } }
    setMembers(members.filter(m => m.id !== id));
  };
  const updateMember = (id, k, v) => setMembers(p => p.map(m => m.id === id ? { ...m, [k]: v } : m));

  const handleMemberFoto = async (id, file) => {
    if (!file) return;
    const l = toast.loading("Validasi KTP...");
    const val = await validateKTP(file);
    toast.dismiss(l);
    if (!val.isValid) return toast.error(val.message);
    updateMember(id, "fotoKtp", file);
    updateMember(id, "previewUrl", URL.createObjectURL(file));
  };

  const handleCameraMember = async (file) => {
    if (!cameraMemberId) return;
    const l = toast.loading("Validasi...");
    const val = await validateKTP(file);
    toast.dismiss(l);
    if (!val.isValid) return toast.error(val.message);
    updateMember(cameraMemberId, "fotoKtp", file);
    updateMember(cameraMemberId, "previewUrl", URL.createObjectURL(file));
    setCameraMemberId(null);
  };

  // Submit
  const handleSubmit = async (skipQuestionnaire = false) => {
    if (!form.nama || !form.nik || !form.alamat) return setError("Data Kepala Keluarga belum lengkap");
    setLoading(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => { if (k !== 'fotoKtp' && form[k]) fd.append(k, form[k]); });
      if (form.fotoKtp instanceof File) fd.append("foto_ktp", await compressImage(form.fotoKtp));

      await api.post(`/kunjungan/${kunjunganId}?_method=PUT`, fd, { headers: { "Content-Type": "multipart/form-data" } });

      for (const m of members) {
        const fdm = new FormData();
        fdm.append("nama", m.nama);
        fdm.append("nik", m.nik);
        fdm.append("hubungan", m.hubungan);
        fdm.append("tanggal_lahir", m.tanggalLahir);
        fdm.append("pekerjaan", m.pekerjaan || "");
        fdm.append("pendidikan", m.pendidikan);
        fdm.append("penghasilan", m.penghasilan);
        if (m.fotoKtp instanceof File) fdm.append("foto_ktp", await compressImage(m.fotoKtp));

        if (m.isLocal) {
          await api.post(`/kunjungan/${kunjunganId}/anggota`, fdm, { headers: { "Content-Type": "multipart/form-data" } });
        } else {
          try { await api.post(`/kunjungan/anggota/${m.id}?_method=PUT`, fdm, { headers: { "Content-Type": "multipart/form-data" } }); } catch { } // Retry silent
        }
      }

      if (skipQuestionnaire) onFinishDirect();
      else onNext();

    } catch (e) {
      console.error(e);
      let msg = e.response?.data?.message || e.message || "Gagal menyimpan data.";
      if (e.response?.data?.error) {
        msg += " (" + e.response.data.error + ")";
      }
      setError(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      {error && <Alert type="error" message={error} />}

      {/* KEPALA KELUARGA (Identical to Create StepMobileBiodata) */}
      <div className="bg-white p-5 rounded-xl border border-slate-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Icon icon="mdi:account-tie" width="24" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Kepala Keluarga</h2>
            <p className="text-xs text-slate-500">Informasi utama penanggung jawab</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input label="Nama Lengkap" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value.replace(/[^a-zA-Z\s\.\`\']/g, '') })} required />
          <Input label="NIK (16 digit)" value={form.nik} onChange={e => setForm({ ...form, nik: e.target.value.replace(/\D/g, '').slice(0, 16) })} required />
          <Input type="date" label="Tanggal Lahir" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} required max={maxDate17()} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pendidikan" value={form.pendidikan} onChange={e => setForm({ ...form, pendidikan: e.target.value })} options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
            <Select label="Pekerjaan" value={form.pekerjaan} onChange={e => setForm({ ...form, pekerjaan: e.target.value })} options={pekerjaanList} required />
          </div>
          <Select label="Penghasilan" value={form.penghasilan} onChange={e => setForm({ ...form, penghasilan: e.target.value })} options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Foto KTP <span className="text-red-500">*</span></label>
            <div onClick={() => setShowCamera(true)} className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${previewUrl ? 'border-green-500 bg-green-50' : 'border-blue-300 bg-blue-50 active:bg-blue-100'}`}>
              {!previewUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <Icon icon="mdi:camera" className="text-3xl text-blue-500" />
                  <span className="text-sm font-bold text-blue-700">Ambil Foto KTP</span>
                  <span className="text-xs text-slate-500">Pastikan foto jelas & terbaca</span>
                </div>
              ) : (
                <div className="relative">
                  <img src={previewUrl} className="h-32 mx-auto rounded shadow-sm object-cover" alt="KTP" />
                  <div className="mt-2 text-center">
                    <span className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-sm"><Icon icon="mdi:check" /> Terisi</span>
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => document.getElementById("headUp").click()} className="w-full py-2 text-xs font-bold text-slate-500 mt-1 active:text-blue-600">Atau upload dari galeri</button>
            <input id="headUp" type="file" className="hidden" onChange={handleFotoChange} />
          </div>

          <div className="relative">
            <Input label="Alamat Lengkap" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} required />
            <button onClick={handleGPS} disabled={loadingGps} className="absolute right-2 top-8 text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
              <Icon icon="mdi:crosshairs-gps" className={loadingGps && "animate-spin"} /> {gpsStatus || "GPS"}
            </button>
          </div>
        </div>
      </div>

      {/* ANGGOTA */}
      <div>
        <div className="flex justify-between items-end mb-6 border-b border-dashed border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Icon icon="mdi:account-group-outline" className="text-blue-600" /> Daftar Anggota</h2>
            <p className="text-xs text-slate-500 mt-1 ml-7">Total: {members.length} Orang</p>
          </div>
          <button onClick={addMember} className="flex items-center gap-1 pl-3 pr-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-100 transition active:scale-95">
            <Icon icon="mdi:plus-circle" className="text-lg" /> Tambah
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-gray-500 text-sm">Tidak ada anggota keluarga</p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((m, i) => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-300">
                <div className="flex justify-between items-center bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{i + 1}</span>
                    <h4 className="font-bold text-slate-800 text-sm">Anggota Keluarga</h4>
                  </div>
                  <button onClick={() => removeMember(m.id, m.isLocal)} className="text-red-500 p-2 active:bg-red-50 rounded-full"><Icon icon="mdi:trash-can-outline" width="20" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <Input label="Nama Lengkap" value={m.nama} onChange={e => updateMember(m.id, "nama", e.target.value.replace(/[^a-zA-Z\s\.\`\']/g, ''))} required placeholder="Sesuai KTP" />
                  <Input label="NIK" value={m.nik} onChange={e => updateMember(m.id, "nik", e.target.value.replace(/\D/g, '').slice(0, 16))} required maxLength={16} placeholder="16 Digit Angka" />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Hubungan" value={m.hubungan} onChange={e => updateMember(m.id, "hubungan", e.target.value)} options={["ayah", "ibu", "anak", "lainnya"]} required />
                    <Input type="date" label="Tgl Lahir" value={m.tanggalLahir} onChange={e => updateMember(m.id, "tanggalLahir", e.target.value)} required max={maxDate17()} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Pendidikan" value={m.pendidikan} onChange={e => updateMember(m.id, "pendidikan", e.target.value)} options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
                    <Select label="Pekerjaan" value={m.pekerjaan} onChange={e => updateMember(m.id, "pekerjaan", e.target.value)} options={pekerjaanList} required />
                  </div>
                  <Select label="Penghasilan" value={m.penghasilan} onChange={e => updateMember(m.id, "penghasilan", e.target.value)} options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />

                  <div className="pt-3 mt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Foto KTP Anggota <span className="text-red-500">*</span></label>
                    <div onClick={() => setCameraMemberId(m.id)} className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${m.previewUrl ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50 active:bg-blue-50'}`}>
                      {!m.previewUrl ? (
                        <div className="flex flex-col items-center gap-1">
                          <Icon icon="mdi:camera" className="text-2xl text-slate-400" />
                          <span className="text-sm font-bold text-blue-600">Ambil Foto</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={m.previewUrl} className="h-24 mx-auto rounded shadow-sm object-cover" alt="KTP" />
                          <div className="mt-1 text-center">
                            <span className="text-green-700 text-xs font-bold flex items-center justify-center gap-1"><Icon icon="mdi:check-circle" /> Tersimpan</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => document.getElementById(`mbrup-${m.id}`).click()} className="w-full py-2 text-xs font-bold text-slate-500 mt-1 active:text-blue-600">Upload File</button>
                    <input id={`mbrup-${m.id}`} type="file" className="hidden" onChange={e => handleMemberFoto(m.id, e.target.files[0])} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createPortal(
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-40 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => handleSubmit(true)} disabled={loading} className="flex-1 py-3 bg-green-50 text-green-700 font-bold rounded-xl border border-green-200 shadow-sm active:scale-95 transition flex items-center justify-center gap-2">
            {loading ? "..." : <><Icon icon="mdi:check-all" /> Simpan & Selesai</>}
          </button>
          <button onClick={() => handleSubmit(false)} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition">
            {loading ? "Menyimpan..." : "Lanjut Kuisioner →"}
          </button>
        </div>,
        document.body
      )}

      {showPermissionModal && <PermissionModal onRetry={handleGPS} loading={loadingGps} />}
      {showCamera && <CameraCapture onCapture={handleCameraHead} onClose={() => setShowCamera(false)} />}
      {cameraMemberId && <CameraCapture onCapture={handleCameraMember} onClose={() => setCameraMemberId(null)} />}
    </div>
  );
};

// --- STEP 3 Identical Reuse ---
// --- STEP 3: Kuisioner (Aligned with Create Flow) ---
function Step3({ kunjunganId, initialAnswers, onBack, onComplete }) {
  const [answers, setAnswers] = useState({
    tau_paslon: 0, tau_informasi: 0, tau_visi_misi: 0, tau_program_kerja: 0, tau_rekam_jejak: 0,
    pernah_dikunjungi: null, percaya: 0, harapan: "", pertimbangan: 0, ingin_memilih: 0,
    ...initialAnswers
  });

  useEffect(() => {
    if (initialAnswers) {
      setAnswers(p => ({
        ...p,
        ...initialAnswers,
        pernah_dikunjungi: initialAnswers.pernah_dikunjungi === 1 ? 'ya' : (initialAnswers.pernah_dikunjungi === 0 ? 'tidak' : null)
      }));
    }
  }, [initialAnswers]);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    const missing = [];
    if (!answers.tau_paslon) missing.push("1");
    if (!answers.tau_informasi) missing.push("2");
    if (!answers.tau_visi_misi) missing.push("3");
    if (!answers.tau_program_kerja) missing.push("4");
    if (!answers.tau_rekam_jejak) missing.push("5");
    if (!answers.pernah_dikunjungi) missing.push("6");
    if (!answers.percaya) missing.push("7");
    if (!answers.harapan || answers.harapan.trim().length < 3) missing.push("Harapan");
    if (!answers.pertimbangan) missing.push("9");
    if (!answers.ingin_memilih) missing.push("10");

    if (missing.length > 0) return toast.error("Mohon lengkapi semua pertanyaan");

    setLoading(true);
    try {
      await api.post(`/kunjungan/${kunjunganId}/selesai`, {
        ...answers,
        pernah_dikunjungi: answers.pernah_dikunjungi === "ya" ? 1 : 0
      });
      onComplete();
    } catch (e) {
      toast.error("Gagal simpan kuisioner");
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (key, val) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  };

  const questions = [
    { key: "tau_paslon", label: "Saya mengenal pasangan Pramono Anung - Rano Karno yang maju dalam pemilihan gubernur ini." },
    { key: "tau_informasi", label: "Informasi mengenai pemilihan gubernur saat ini sudah saya pahami dengan cukup jelas." },
    { key: "tau_visi_misi", label: "Saya mengetahui visi dan misi pasangan calon Pramono Anung - Rano Karno yang maju dalam pemilihan gubernur." },
    { key: "tau_program_kerja", label: "Program kerja pasangan calon menjadi pertimbangan utama saya dalam menentukan pilihan." },
    { key: "tau_rekam_jejak", label: "Rekam jejak digital Pramono Anung - Rano Karno memengaruhi keputusan saya dalam memilih." },
    { key: "pernah_dikunjungi", label: "Pernah dikunjungi sebelumnya oleh relawan atau tim sukses?", type: "yesno" },
    { key: "percaya", label: "Saya percaya pasangan calon Pramono Anung - Rano Karno memiliki kemampuan untuk memimpin daerah dengan baik." },
    { key: "harapan", label: "Saya berharap pemimpin terpilih nanti dapat membawa perubahan yang lebih baik bagi daerah ini.", type: "text" },
    { key: "pertimbangan", label: "Saya bersedia mempertimbangkan atau memilih Pramono Anung - Rano Karno apabila programnya sesuai dengan kebutuhan daerah saya." },
    { key: "ingin_memilih", label: "Saya bersedia memilih pasangan Pramono Anung - Rano Karno pada pemilihan gubernur mendatang." },
  ];

  const likertOptions = [
    { value: 4, label: "Sangat Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 3, label: "Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 2, label: "Tidak Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 1, label: "Sangat Tidak Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">Kuisioner Kunjungan</h2>
        <p className="text-sm text-gray-600">Lengkapi data kuisioner akhir kunjungan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {questions.map((q, idx) => (
          <div
            key={q.key}
            className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 h-full"
          >
            <p className="font-semibold text-gray-800 text-sm md:text-base mb-3 md:mb-4">
              {idx + 1}. {q.label}
            </p>

            {q.type === "text" ? (
              <textarea
                value={answers[q.key] || ""}
                onChange={(e) => updateAnswer(q.key, e.target.value)}
                rows={4}
                placeholder="Tuliskan harapan Anda secara singkat dan jelas..."
                className="
                  w-full px-4 py-3 border border-gray-300 rounded-xl
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm md:text-base resize-none
                "
              />
            ) : q.type === "yesno" ? (
              <div className="flex gap-3 md:gap-4">
                {["ya", "tidak"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateAnswer(q.key, opt)}
                    className={`
                  flex-1 px-6 py-2 md:py-2.5 rounded-xl font-bold border-2 capitalize transition-all
                  ${answers[q.key] === opt
                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                        : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"}
                `}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {likertOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateAnswer(q.key, opt.value)}
                    className={`
                  p-2 md:p-2.5 rounded-xl text-[10px] md:text-xs font-bold border-2 transition-all
                  ${answers[q.key] === opt.value
                        ? `${opt.color} border-current shadow-sm`
                        : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"}
                `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {createPortal(
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-40 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={onBack} className="w-1/3 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition">Kembali</button>
          <button onClick={handleSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition">{loading ? "Menyimpan..." : "Selesai"}</button>
        </div>,
        document.body
      )}
    </div>
  );
}
