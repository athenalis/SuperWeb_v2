import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../lib/axios";
import { Icon } from "@iconify/react";
import CameraCapture from "../../components/CameraCapture";
import { validateKTP } from "../../lib/ktpValidator";
import { offlineDb } from "../../lib/offlineDb";

const generateOfflineId = () => `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const maxDate17 = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().split('T')[0];
};

  export default function CreateKunjungan() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [kunjunganId, setKunjunganId] = useState(null);
    const [address, setAddress] = useState("");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [showExitModal, setShowExitModal] = useState(false);
    const stepRef = useRef();
    const [paslon, setPaslon] = useState(null);


    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 1024);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

  const fetchPaslon = async (id) => {
    try {
      if (!id || id.toString().startsWith("off_")) return; // offline skip
      const res = await api.get(`/kunjungan/${id}`);
      if (res.data?.success) {
        setPaslon(res.data.data?.paslon || null);
      }
    } catch (e) {
      // silent fail
    }
  };

  const paslonName =
    paslon?.nama ||
    paslon?.name ||
    paslon?.label ||
    "pasangan calon";

  const handleBackClick = () => {
    // Clear all drafts to ensure fresh start next time
    localStorage.removeItem("kunjungan_draft_v1");
    localStorage.removeItem("kunjungan_draft_step1");
    localStorage.removeItem("kunjungan_draft_members");

    // Navigate back immediately without confirmation
    navigate('/kunjungan');
  };

  const handleConfirmExit = async () => {
    // If we have a submitDraft method in the current step, call it
    if (stepRef.current?.submitDraft) {
      const saved = await stepRef.current.submitDraft();
      if (!saved) return; // Stay on page if error
    }
    toast.success("Data tersimpan sebagai pending");
    navigate("/kunjungan");
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 md:py-8 md:px-4">
      <div className="w-full md:max-w-5xl md:mx-auto h-full">
        <div className="bg-white w-full min-h-[100dvh] md:min-h-0 md:rounded-2xl md:shadow-xl overflow-hidden flex flex-col">
          {/* Header with Back Button */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 md:px-8 md:py-6 flex items-center gap-4">
            <button
              onClick={handleBackClick}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all active:scale-95"
            >
              <Icon icon="mdi:arrow-left" className="text-xl md:text-2xl" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white leading-tight">Form Kunjungan</h1>
              <p className="text-blue-100 text-xs md:text-base hidden md:block">Lengkapi data kunjungan secara bertahap</p>
            </div>
          </div>

          <div className="px-5 md:px-8 py-4 md:py-6 bg-gray-50 border-b">
            <Stepper step={step} isMobile={isMobile} />
          </div>

          <div className="p-4 md:p-6">
            {isMobile ? (
              // --- MOBILE FLOW (2 STEPS -> 3) ---
              <>
                {step === 1 && <StepMobileBiodata ref={stepRef} onNext={async (id, addr) => { setKunjunganId(id); setAddress(addr); fetchPaslon(id); setStep(2); }} />}
                {step === 2 && <Step3 kunjunganId={kunjunganId} paslon={paslon} onBack={() => setStep(1)} onComplete={() => {
                  localStorage.removeItem("kunjungan_draft_v1");
                  localStorage.removeItem("kunjungan_draft_step1");
                  localStorage.removeItem("kunjungan_draft_members");
                  setStep(3);
                }} />}
                {step === 3 && <StepComplete onFinish={() => window.location.reload()} />}
              </>
            ) : (
              // --- DESKTOP FLOW (3 STEPS) ---
              <>
                {step === 1 && <Step1 ref={stepRef} onNext={async (id, addr) => { setKunjunganId(id); setAddress(addr); fetchPaslon(id); setStep(2); }} />}
                {step === 2 && <Step2 kunjunganId={kunjunganId} address={address} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                {step === 3 && <Step3 kunjunganId={kunjunganId} paslon={paslon} onBack={() => setStep(2)} onComplete={() => setStep(4)} />}
                {step === 4 && <StepComplete onFinish={() => {
                  localStorage.removeItem("kunjungan_draft_v1");
                  localStorage.removeItem("kunjungan_draft_step1");
                  localStorage.removeItem("kunjungan_draft_members");
                }} />}
              </>
            )}
          </div>
        </div>

        {/* Exit Confirmation Modal */}
        {showExitModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:help-circle" width="32" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Keluar dari Form?</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Data yang sudah diisi akan disimpan sebagai <strong className="text-blue-600">Pending</strong> dan menunggu verifikasi.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleConfirmExit}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition active:scale-95"
                  >
                    Ya, Simpan & Keluar
                  </button>
                  <button
                    onClick={handleCancelExit}
                    className="w-full py-2 text-slate-600 font-bold text-sm hover:text-slate-800 transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ step, isMobile }) {
  const steps = isMobile ? [
    { num: 1, label: "Data Keluarga", icon: "mdi:account-group" },
    { num: 2, label: "Kuisioner", icon: "mdi:clipboard-text" },
  ] : [
    { num: 1, label: "Info Dasar", icon: "mdi:account" },
    { num: 2, label: "Anggota", icon: "mdi:account-multiple" },
    { num: 3, label: "Kuisioner", icon: "mdi:clipboard-check" },
  ];

  return (
    <div className="relative max-w-2xl mx-auto px-4">
      {/* Progress Bar Background */}
      <div className="absolute top-5 left-8 right-8 h-1 bg-gray-100 rounded-full overflow-hidden z-0">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 ease-out rounded-full"
          style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      <div className="relative z-10 flex justify-between">
        {steps.map((s, idx) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;

          return (
            <div key={s.num} className="flex flex-col items-center group cursor-default">
              <div
                className={`
                  w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center 
                  transition-all duration-300 transform
                  ${isActive
                    ? "bg-white border-2 border-blue-600 text-blue-600 shadow-lg shadow-blue-500/20 scale-110 ring-4 ring-blue-50"
                    : isCompleted
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-none shadow-md scale-100"
                      : "bg-white border-2 border-slate-100 text-slate-300"
                  }
                `}
              >
                {isCompleted ? (
                  <Icon icon="mdi:check" className="text-lg md:text-xl" />
                ) : (
                  <Icon icon={s.icon} className="text-lg md:text-xl" />
                )}
              </div>

              <span
                className={`
                  mt-3 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors duration-300
                  ${isActive ? "text-blue-700" : isCompleted ? "text-blue-600/70" : "text-slate-300"}
                `}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const compressImage = (file, maxWidth = 720, quality = 0.6) => {
  return new Promise((resolve) => {
    // If file is small enough, skip compression
    if (file.size < 500 * 1024) { // < 500KB - skip compression
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
    };
  });
};

const Step1 = forwardRef(({ onNext }, ref) => {
  const [form, setForm] = useState({
    nama: "", nik: "", tanggal: "", pendidikan: "", pekerjaan: "", penghasilan: "",
    fotoKtp: null, alamat: "", latitude: "", longitude: ""
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("");
  const [error, setError] = useState("");
  const [pekerjaanList, setPekerjaanList] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    // Load persisted data
    const saved = localStorage.getItem("kunjungan_draft_step1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...parsed }));
        // Jika sudah ada alamat dari draft, tidak perlu ambil GPS lagi
        if (parsed.alamat && parsed.alamat.length > 10) {
          fetchPekerjaan();
          return;
        }
      } catch (e) {
        console.error("Failed to parse draft step 1");
      }
    }

    fetchPekerjaan();

    // Auto fetch GPS dinyalakan kembali
    getLocationAndAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localstorage on change
  useEffect(() => {
    // Avoid saving empty init state if verified
    if (form.nama || form.nik) {
      localStorage.setItem("kunjungan_draft_step1", JSON.stringify(form));
    }
  }, [form]);

  const fetchPekerjaan = async () => {
    // Fallback data jika API gagal
    const fallbackPekerjaan = [
      "Belum / Tidak Bekerja",
      "Pelajar / Mahasiswa",
      "PNS / ASN",
      "TNI / POLRI",
      "Karyawan Swasta",
      "Wiraswasta",
      "Petani / Nelayan",
      "Buruh",
      "Pedagang",
      "Ibu Rumah Tangga",
      "Pensiunan",
      "Lainnya"
    ];

    try {
      const res = await api.get("/wilayah/pekerjaan");
      if (res.data && res.data.length > 0) {
        setPekerjaanList(res.data.map(item => item.nama));
      } else {
        setPekerjaanList(fallbackPekerjaan);
      }
    } catch (err) {
      console.error("Failed to fetch pekerjaan, using fallback", err);
      setPekerjaanList(fallbackPekerjaan);
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      setGpsStatus("Menerjemahkan alamat...");
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data.display_name) {
        setForm(prev => ({ ...prev, alamat: data.display_name }));
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  };

  const getLocationAndAddress = () => {
    if (!navigator.geolocation) {
      toast.error("Fitur Lokasi tidak didukung browser ini (Pastikan menggunakan HTTPS).");
      return;
    }

    setLoadingGps(true);
    setGpsStatus("Mencari lokasi...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm(prev => ({ ...prev, latitude, longitude }));
        try {
          await reverseGeocode(latitude, longitude);
          setGpsStatus("✓ Lokasi & Alamat terbaca");
        } catch (e) {
          setGpsStatus("✓ Lokasi terbaca");
        }
        setLoadingGps(false);
      },
      (err) => {
        console.error("GPS Error:", err);
        setLoadingGps(false);
        setGpsStatus("");
        if (err.code === 1) {
          setShowPermissionModal(true);
          setGpsStatus("");
          setError(""); // Ensure red alert is gone
        } else {
          toast.error("Gagal mengambil GPS: " + err.message);
          setError("Gagal mengambil lokasi. Pastikan GPS aktif.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRefreshGps = () => {
    setError("");
    setShowPermissionModal(false);
    getLocationAndAddress();
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran foto maksimal 5MB");
      return;
    }

    // Validasi tipe file
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError("Format foto harus JPG, JPEG, atau PNG");
      return;
    }

    setForm(prev => ({ ...prev, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  };

  const handleCameraCapture = (file) => {
    setForm(prev => ({ ...prev, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    toast.success("Foto KTP berhasil diambil");
  };

  useImperativeHandle(ref, () => ({
    submitDraft: async () => {
      // If basic data (nama/nik) is missing, don't even try to save to DB
      if (!form.nama || !form.nik) return true;

      try {
        setLoading(true);
        const fd = new FormData();
        fd.append("nama", form.nama);
        fd.append("nik", form.nik);
        fd.append("is_draft", "1");

        if (form.tanggal) fd.append("tanggal", form.tanggal);
        if (form.pendidikan) fd.append("pendidikan", form.pendidikan);
        if (form.pekerjaan) fd.append("pekerjaan", form.pekerjaan);
        if (form.penghasilan) fd.append("penghasilan", form.penghasilan);
        if (form.alamat) fd.append("alamat", form.alamat);
        if (form.latitude) fd.append("latitude", form.latitude);
        if (form.longitude) fd.append("longitude", form.longitude);

        if (form.fotoKtp instanceof File) {
          const compressedFoto = await compressImage(form.fotoKtp);
          fd.append("foto_ktp", compressedFoto);
        }

        const res = await api.post("/kunjungan", fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        return res.data.success;
      } catch (err) {
        console.error("Save draft error:", err);
        return true; // Still allow exit, data is in localStorage
      } finally {
        setLoading(false);
      }
    }
  }));

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Mohon lengkapi semua field yang wajib diisi");
      return;
    }

    setError("");
    setLoading(true);

    const compressedFoto = await compressImage(form.fotoKtp);

    try {
      const fd = new FormData();
      fd.append("nama", form.nama);
      fd.append("nik", form.nik);
      fd.append("tanggal", form.tanggal);
      fd.append("pendidikan", form.pendidikan);
      fd.append("pekerjaan", form.pekerjaan);
      fd.append("penghasilan", form.penghasilan);
      fd.append("foto_ktp", compressedFoto);
      fd.append("alamat", form.alamat);
      if (form.latitude) fd.append("latitude", form.latitude);
      if (form.longitude) fd.append("longitude", form.longitude);

      // Gunakan api helper (otomatis handle token via interceptor)
      const res = await api.post("/kunjungan", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (!res.data.success) {
        throw new Error(res.data.message || "Gagal menyimpan kunjungan");
      }

      // Success - proceed to next step
      localStorage.removeItem("kunjungan_draft_step1");

      if (!res.data.data?.id) {
        throw new Error("Gagal mendapatkan ID Kunjungan dari server");
      }
      onNext(res.data.data.id, form.alamat);

    } catch (err) {
      console.error("Step1 submit error:", err);

      // --- OFFLINE FALLBACK ---
      if (!navigator.onLine || err.message === 'Network Error') {
        const offId = generateOfflineId();
        await offlineDb.saveVisit({
          offline_id: offId,
          is_draft: false,
          nama: form.nama,
          nik: form.nik,
          alamat: form.alamat,
          created_at: new Date().toISOString(),
          family_form: { members_count: 0 },
          form: { ...form },
          members: [],
          answers: null
        });
        toast.success("Kunjungan disimpan offline. Silakan lanjut ke Anggota Keluarga. 📶");
        onNext(offId, form.alamat);
        return;
      }

      if (err.response?.data?.errors) {
        const backendErrors = Object.values(err.response.data.errors).flat().join(", ");
        setError(`Validasi Gagal: ${backendErrors}`);
        toast.error("Validasi Gagal. Periksa kembali isian Anda.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
        toast.error(err.response.data.message);
      } else {
        setError(err.message || "Terjadi kesalahan saat menyimpan data");
        toast.error(err.message || "Terjadi kesalahan");
      }
    } finally {
      setLoading(false);
    }
  };

  const getValidationError = () => {
    if (!form.nama) return "Nama Lengkap belum diisi";
    if (!form.nik) return "NIK belum diisi";
    if (!/^\d{16}$/.test(form.nik)) return "NIK harus berjumlah 16 digit angka";
    if (!form.tanggal) return "Tanggal Lahir belum diisi";
    if (!form.pendidikan) return "Pendidikan belum dipilih";
    if (!form.pekerjaan) return "Pekerjaan belum dipilih";
    if (!form.penghasilan) return "Penghasilan belum dipilih";
    if (!form.fotoKtp) return "Foto KTP wajib diupload";
    if (!form.alamat || form.alamat.length < 10) return "Alamat minimal 10 karakter";
    return null;
  };



  // DEBOUNCE NIK CHECK
  const checkNikTimer = useRef(null);
  const [nikError, setNikError] = useState(null);
  const [isNikChecking, setIsNikChecking] = useState(false);

  const checkNikAvailability = async (nikValue) => {
    if (!nikValue || nikValue.length < 16) {
      setNikError(null);
      return;
    }

    setIsNikChecking(true);
    try {
      // Gunakan endpoint baru yang ringan
      const res = await api.post('/kunjungan/check-nik', { nik: nikValue });
      if (res.data.available === false) {
        setNikError(res.data.message);
      } else {
        setNikError(null);
      }
    } catch (err) {
      // Silent fail if offline or error
      console.log("Check NIK skipped");
    } finally {
      setIsNikChecking(false);
    }
  };

  const handleNikChange = (v) => {
    if (/^\d{0,16}$/.test(v)) {
      setForm({ ...form, nik: v });

      if (checkNikTimer.current) clearTimeout(checkNikTimer.current);

      if (v.length === 16) {
        checkNikTimer.current = setTimeout(() => {
          checkNikAvailability(v);
        }, 800); // 800ms debounce (ringan buat HP kentang)
      } else {
        setNikError(null);
      }
    }
  };

  const isValid = !getValidationError();

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800">Informasi Kepala Keluarga</h2>

      {error && <Alert type="error" message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Input
          label="Nama Lengkap"
          value={form.nama}
          onChange={(v) => {
            const clean = v.replace(/[^a-zA-Z\s\.\`\']/g, '');
            setForm({ ...form, nama: clean });
          }}
          required
        />
        <Input
          label="NIK (16 digit)"
          value={form.nik}
          onChange={handleNikChange}
          maxLength={16}
          placeholder="3201234567891234"
          required
          readOnly={false}
        />
        {isNikChecking && <p className="text-xs text-blue-500 animate-pulse mt-1">Mengecek ketersediaan NIK...</p>}
        {nikError && <p className="text-xs text-red-500 font-bold mt-1">⚠️ {nikError}</p>}
        <Input
          type="date"
          label="Tanggal Lahir"
          value={form.tanggal}
          onChange={(v) => setForm({ ...form, tanggal: v })}
          required
          max={maxDate17()}
        />
        <Select label="Pendidikan" value={form.pendidikan} onChange={(v) => setForm({ ...form, pendidikan: v })}
          options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
        <Select label="Pekerjaan" value={form.pekerjaan} onChange={(v) => setForm({ ...form, pekerjaan: v })}
          options={pekerjaanList} required />
        <Select label="Penghasilan" value={form.penghasilan} onChange={(v) => setForm({ ...form, penghasilan: v })}
          options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />
      </div>

      <div>
        <label className="block font-semibold mb-2 text-sm md:text-base">Foto KTP <span className="text-red-500">*</span></label>
        <div
          onClick={() => setShowCamera(true)}
          className="border-2 border-dashed rounded-xl p-4 md:p-8 text-center transition border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50"
        >
          {!previewUrl ? (
            <div className="space-y-1 md:space-y-2 flex flex-col items-center justify-center text-center">
              <Icon icon="mdi:camera" className="text-4xl md:text-5xl text-gray-500" />
              <p className="text-gray-600 font-medium text-sm md:text-base">Klik untuk ambil foto KTP</p>
              <p className="text-xs text-gray-400">Gunakan kamera untuk hasil terbaik</p>
            </div>
          ) : (
            <div className="space-y-3">
              <img src={previewUrl} className="mx-auto max-h-48 md:max-h-64 rounded-lg shadow-lg" alt="Preview KTP" />
              <div className="text-green-600 font-medium text-sm flex items-center gap-1">
                <Icon icon="mdi:check" />
                Foto KTP berhasil dipilih
              </div>
            </div>
          )}
        </div>



        <input
          id="fotoKtp"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFotoChange}
        />
      </div>

      {/* GPS section dihide - latitude/longitude tetap bisa dikirim jika ada */}
      <input type="hidden" value={form.latitude || ""} />
      <input type="hidden" value={form.longitude || ""} />

      <div>
        <label className="block font-semibold mb-2 text-sm md:text-base">
          Alamat Lengkap <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.alamat}
          onChange={(e) => setForm({ ...form, alamat: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm md:text-base"
          rows={3}
          placeholder="Masukkan alamat lengkap..."
        />
      </div>

      <div className="pt-2">
        {!isValid && (
          <p className="text-xs text-red-500 text-right mb-2 font-medium italic">
            * {getValidationError()}
          </p>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Menyimpan..." : "Lanjut ke Anggota Keluarga →"}
          </button>
        </div>
      </div>
      {showPermissionModal && <PermissionModal onRetry={handleRefreshGps} loading={loadingGps} />}
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
    </div>
  );
});

function Step2({ kunjunganId, onNext, onBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pekerjaanList, setPekerjaanList] = useState([]);
  const [cameraMemberId, setCameraMemberId] = useState(null);

  useEffect(() => {
    fetchPekerjaan();
  }, []);

  const fetchPekerjaan = async () => {
    // Fallback data jika API gagal
    const fallbackPekerjaan = [
      "Belum / Tidak Bekerja",
      "Pelajar / Mahasiswa",
      "PNS / ASN",
      "TNI / POLRI",
      "Karyawan Swasta",
      "Wiraswasta",
      "Petani / Nelayan",
      "Buruh",
      "Pedagang",
      "Ibu Rumah Tangga",
      "Pensiunan",
      "Lainnya"
    ];

    try {
      const res = await api.get("/wilayah/pekerjaan");
      if (res.data && res.data.length > 0) {
        const p = res.data.map(item => item.nama);
        setPekerjaanList(p);
      } else {
        setPekerjaanList(fallbackPekerjaan);
      }
    } catch (err) {
      console.error("Failed to fetch pekerjaan, using fallback", err);
      setPekerjaanList(fallbackPekerjaan);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("kunjungan_draft_members");
    if (saved) {
      try {
        setMembers(JSON.parse(saved));
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    if (members.length > 0) {
      localStorage.setItem("kunjungan_draft_members", JSON.stringify(members));
    }
  }, [members]);

  const addMember = () => {
    setMembers([...members, {
      id: Date.now(),
      nama: "",
      nik: "",
      hubungan: "",
      tanggalLahir: "",
      pekerjaan: "",
      pendidikan: "",
      penghasilan: "",
      fotoKtp: null,
      previewUrl: ""
    }]);
  };

  const removeMember = (id) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const updateMember = (id, key, value) => {
    setMembers(members.map(m => m.id === id ? { ...m, [key]: value } : m));
  };

  const handleCameraCapture = (file) => {
    if (!cameraMemberId) return;
    updateMember(cameraMemberId, "fotoKtp", file);
    updateMember(cameraMemberId, "previewUrl", URL.createObjectURL(file));
    setCameraMemberId(null);
    toast.success("Foto KTP berhasil diambil");
  };

  const handleSubmit = async () => {
    if (!kunjunganId) {
      setError("ID Kunjungan tidak ditemukan. Silakan kembali ke tahap sebelumnya.");
      return;
    }

    setError("");
    setLoading(true);

    if (members.length === 0) {
      setError("");
      setLoading(false);
      onNext();
      return;
    }

    const invalidMembers = members.filter(m => {
      // Validasi field wajib termasuk NIK
      if (!m.nama || !m.nik || !m.hubungan || !m.tanggalLahir || !m.pendidikan || !m.penghasilan) return true;
      // Validasi NIK harus 16 digit
      if (!/^\d{16}$/.test(m.nik)) return true;
      return false;
    });

    if (invalidMembers.length > 0) {
      const missingFields = [];
      const m = invalidMembers[0];
      if (!m.nama) missingFields.push("Nama");
      if (!m.nik) missingFields.push("NIK");
      if (m.nik && !/^\d{16}$/.test(m.nik)) missingFields.push("NIK harus 16 digit");
      if (!m.hubungan) missingFields.push("Hubungan");
      if (!m.tanggalLahir) missingFields.push("Tanggal Lahir");
      if (!m.pendidikan) missingFields.push("Pendidikan");
      if (!m.penghasilan) missingFields.push("Penghasilan");

      setError(`Mohon lengkapi data anggota: ${missingFields.join(", ")}`);
      toast.error("Lengkapi data anggota keluarga");
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);

    try {
      // --- OFFLINE FALLBACK CHECK ---
      const isOfflineId = kunjunganId?.toString().startsWith('off_');

      if (isOfflineId || !navigator.onLine) {
        const visit = await offlineDb.getVisitById(kunjunganId);
        if (visit) {
          visit.members = [...members];
          await offlineDb.saveVisit(visit);
          localStorage.removeItem("kunjungan_draft_members");
          toast.success("Data anggota disimpan offline 📶");
          onNext();
          return;
        }
      }

      for (const member of members) {
        const fd = new FormData();
        fd.append("nama", member.nama);
        fd.append("nik", member.nik);
        fd.append("hubungan", member.hubungan);
        fd.append("tanggal_lahir", member.tanggalLahir);
        fd.append("pekerjaan", member.pekerjaan || "");
        fd.append("pendidikan", member.pendidikan);
        fd.append("penghasilan", member.penghasilan);
        if (member.fotoKtp instanceof File) {
          const compressedFoto = await compressImage(member.fotoKtp);
          fd.append("foto_ktp", compressedFoto);
        }

        const res = await api.post(`/kunjungan/${kunjunganId}/anggota`, fd);

        if (!res.data.success) {
          throw new Error(res.data.message || "Gagal menyimpan anggota");
        }
      }

      localStorage.removeItem("kunjungan_draft_members");
      onNext();
    } catch (err) {
      console.error("Step2 submit error:", err);

      if (!navigator.onLine || err.message === 'Network Error') {
        // If it was online but failed during loop
        const visit = await offlineDb.getVisitById(kunjunganId) || {
          offline_id: kunjunganId?.toString().startsWith('off_') ? kunjunganId : generateOfflineId(),
          id: kunjunganId,
          is_draft: false,
          form: {},
          members: [...members],
          answers: null
        };
        visit.members = [...members];
        await offlineDb.saveVisit(visit);
        toast.success("Progres disimpan secara offline 📶");
        onNext();
        return;
      }

      const backendErrors = err?.response?.data?.errors;
      if (backendErrors) {
        const firstErrorKey = Object.keys(backendErrors)[0];
        const firstErrorMessage = backendErrors[firstErrorKey][0];
        setError(`Error: ${firstErrorMessage}`);
      } else {
        setError(err?.response?.data?.message || err.message || "Terjadi kesalahan saat menyimpan data anggota");
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid = members.length === 0 || members.every(m => {
    // Field wajib termasuk NIK
    if (!m.nama || !m.nik || !m.hubungan || !m.tanggalLahir || !m.pendidikan || !m.penghasilan) return false;
    // NIK harus 16 digit
    if (!/^\d{16}$/.test(m.nik)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Data Anggota Keluarga</h2>
        <button onClick={addMember} className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-sm">
          + Tambah Anggota
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      {members.length === 0 && (
        <div className="text-center py-10 md:py-14 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 flex flex-col items-center justify-center">
          <Icon icon="mdi:account-group" className="text-5xl md:text-6xl text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">Belum ada anggota keluarga</p>
          <p className="text-xs text-gray-400 mt-2">Klik tombol di atas untuk menambahkan anggota Baru</p>
        </div>
      )}

      {members.map((member, idx) => (
        <div key={member.id} className="border border-gray-200 rounded-2xl p-4 md:p-6 bg-white relative shadow-sm">
          <button
            onClick={() => removeMember(member.id)}
            className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            <Icon icon="mdi:close" width="20" />
          </button>

          <h4 className="font-bold mb-5 text-lg text-blue-900 border-b pb-2">Anggota #{idx + 1}</h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input label="Nama Lengkap" value={member.nama} onChange={(v) => updateMember(member.id, "nama", v)} required />
              <Input
                label="NIK"
                value={member.nik}
                onChange={(v) => /^\d{0,16}$/.test(v) && updateMember(member.id, "nik", v)}
                required
                maxLength={16}
                placeholder="16 digit NIK"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Hubungan" value={member.hubungan} onChange={(v) => updateMember(member.id, "hubungan", v)}
                  options={["ayah", "ibu", "anak", "lainnya"]} required />
                <Input
                  type="date"
                  label="Tanggal Lahir"
                  value={member.tanggalLahir}
                  max={maxDate17()}
                  onChange={(v) => updateMember(member.id, "tanggalLahir", v)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Pendidikan" value={member.pendidikan} onChange={(v) => updateMember(member.id, "pendidikan", v)}
                  options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
                <Select label="Pekerjaan" value={member.pekerjaan} onChange={(v) => updateMember(member.id, "pekerjaan", v)}
                  options={pekerjaanList} />
              </div>

              <Select label="Penghasilan" value={member.penghasilan} onChange={(v) => updateMember(member.id, "penghasilan", v)}
                options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />
            </div>

            <div className="flex flex-col">
              <label className="block font-semibold mb-2 text-sm md:text-base">Foto KTP <span className="text-gray-400 text-xs md:text-sm font-normal">(Opsional)</span></label>
              <div
                onClick={() => setCameraMemberId(member.id)}
                className="flex-1 border-2 border-dashed rounded-2xl p-4 text-center transition border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center justify-center min-h-[180px] md:min-h-[200px]"
              >
                {!member.previewUrl ? (
                  <div className="space-y-1 md:space-y-2 flex flex-col items-center justify-center text-center">
                    <Icon icon="mdi:camera" className="text-4xl md:text-5xl text-gray-500" />
                    <p className="text-xs text-gray-600 font-medium">Klik untuk ambil foto</p>
                  </div>
                ) : (
                  <img src={member.previewUrl} className="max-h-40 rounded-lg shadow-md" alt="Preview" />
                )}
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => document.getElementById(`foto-member-${member.id}`).click()}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Atau upload dari galeri
                </button>
              </div>

              <input
                id={`foto-member-${member.id}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    updateMember(member.id, "fotoKtp", file);
                    updateMember(member.id, "previewUrl", URL.createObjectURL(file));
                  }
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          ← Kembali
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          loading={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Menyimpan..." : members.length === 0 ? "Lanjut ke Kuisioner (Skip) →" : "Lanjut ke Kuisioner →"}
        </Button>

      </div>
      {cameraMemberId && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraMemberId(null)}
        />
      )}
    </div>
  );
}


const StepMobileBiodata = forwardRef(({ onNext }, ref) => {
  // --- STATE KEPALA KELUARGA (STEP 1) ---
  // Lazy init from localStorage to prevent race condition overwrite
  const [createdId, setCreatedId] = useState(() => {
    try {
      const saved = localStorage.getItem("kunjungan_draft_v1");
      return saved ? JSON.parse(saved).createdId : null;
    } catch { return null; }
  });

  const [form, setForm] = useState(() => {
    const defaultForm = {
      nama: "", nik: "", tanggal: "", pendidikan: "", pekerjaan: "", penghasilan: "",
      fotoKtp: null, alamat: "", latitude: "", longitude: ""
    };
    try {
      const saved = localStorage.getItem("kunjungan_draft_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) return { ...defaultForm, ...parsed.form, fotoKtp: null };
      }
    } catch (e) { console.error("Draft load error", e); }
    return defaultForm;
  });

  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("");
  const [error, setError] = useState("");
  const [pekerjaanList, setPekerjaanList] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false); // Untuk Kepala Keluarga

  // --- STATE ANGGOTA KELUARGA (STEP 2) ---
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem("kunjungan_draft_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.members) return parsed.members.map(m => ({ ...m, fotoKtp: null, previewUrl: "" }));
      }
    } catch { }
    return [];
  });
  const [cameraMemberId, setCameraMemberId] = useState(null); // Untuk Anggota

  useEffect(() => {
    fetchPekerjaan();
  }, []);

  // DEBOUNCE NIK CHECK (MOBILE)
  const checkNikTimer = useRef(null);
  const [nikError, setNikError] = useState(null);
  const [isNikChecking, setIsNikChecking] = useState(false);

  const checkNikAvailability = async (nikValue) => {
    if (!nikValue || nikValue.length < 16) {
      setNikError(null);
      return;
    }

    setIsNikChecking(true);
    try {
      const res = await api.post('/kunjungan/check-nik', { nik: nikValue });
      if (res.data.available === false) {
        setNikError(res.data.message);
      } else {
        setNikError(null);
      }
    } catch (err) {
      console.log("Check NIK skipped");
    } finally {
      setIsNikChecking(false);
    }
  };

  const handleNikChange = (v) => {
    if (/^\d{0,16}$/.test(v)) {
      setForm({ ...form, nik: v });

      if (checkNikTimer.current) clearTimeout(checkNikTimer.current);

      if (v.length === 16) {
        checkNikTimer.current = setTimeout(() => {
          checkNikAvailability(v);
        }, 800);
      } else {
        setNikError(null);
      }
    }
  };

  // --- AUTO SAVE (FIXED RACE CONDITION) ---
  const DRAFT_KEY = "kunjungan_draft_v1";

  // Save Draft on Change
  useEffect(() => {
    // Prevent saving empty initial state if we just barely mounted
    // But since we use lazy init, the state is ALREADY loaded.
    const draftData = {
      form: { ...form, fotoKtp: undefined }, // Skip file
      members: members.map(m => ({ ...m, fotoKtp: undefined, previewUrl: undefined })),
      createdId
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
  }, [form, members, createdId]);

  // Clear Draft Helper
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  const fetchPekerjaan = async () => {
    const fallbackPekerjaan = [
      "Belum / Tidak Bekerja", "Pelajar / Mahasiswa", "PNS / ASN", "TNI / POLRI",
      "Karyawan Swasta", "Wiraswasta", "Petani / Nelayan", "Buruh", "Pedagang",
      "Ibu Rumah Tangga", "Pensiunan", "Lainnya"
    ];
    try {
      const res = await api.get("/wilayah/pekerjaan");
      if (res.data && res.data.length > 0) {
        setPekerjaanList(res.data.map(item => item.nama));
      } else {
        setPekerjaanList(fallbackPekerjaan);
      }
    } catch (err) {
      setPekerjaanList(fallbackPekerjaan);
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      setGpsStatus("Menerjemahkan alamat...");
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data.display_name) {
        setForm(prev => ({ ...prev, alamat: data.display_name }));
      }
    } catch (err) { }
  };

  const getLocationAndAddress = () => {
    if (!navigator.geolocation) {
      toast.error("Fitur Lokasi tidak didukung browser ini (Pastikan menggunakan HTTPS).");
      return;
    }
    setLoadingGps(true);
    setGpsStatus("Mencari lokasi...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm(prev => ({ ...prev, latitude, longitude }));
        reverseGeocode(latitude, longitude);
        setLoadingGps(false);
        setGpsStatus("✓ Lokasi terbaca");
      },
      (err) => {
        setLoadingGps(false);
        setGpsStatus("");
        if (err.code === 1) setShowPermissionModal(true);
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 0 }
    );
  };

  const handleRefreshGps = () => { setShowPermissionModal(false); getLocationAndAddress(); };

  // Auto-detect location on mount if address is empty
  useEffect(() => {
    if (!form.alamat && !form.latitude) {
      getLocationAndAddress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS KEPALA KELUARGA ---
  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran foto maksimal 5MB"); return; }

    // OCR Check
    const toastId = toast.loading("Memindai KTP (OCR)...");
    const validation = await validateKTP(file);
    toast.dismiss(toastId);

    if (!validation.isValid) {
      toast.error(validation.message, { duration: 5000 });
      return;
    }

    setForm(prev => ({ ...prev, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  };

  const handleCameraCaptureHead = async (file) => {
    const toastId = toast.loading("Validasi Foto KTP...");
    const validation = await validateKTP(file);
    toast.dismiss(toastId);

    if (!validation.isValid) {
      toast.error(validation.message, { duration: 5000 });
      return;
    }

    setForm(prev => ({ ...prev, fotoKtp: file }));
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    toast.success("Foto KTP berhasil diambil");
  };

  // --- HANDLERS ANGGOTA KELUARGA ---
  const addMember = () => {
    setMembers([...members, {
      id: Date.now(), nama: "", nik: "", hubungan: "", tanggalLahir: "",
      pekerjaan: "", pendidikan: "", penghasilan: "", fotoKtp: null, previewUrl: "", isSynced: false
    }]);
  };

  const removeMember = (id) => setMembers(members.filter(m => m.id !== id));
  const updateMember = (id, key, value) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, [key]: value, isSynced: false } : m));
  };

  const handleMemberFoto = async (id, file) => {
    if (!file) return;
    const toastId = toast.loading("Validasi KTP Anggota...");
    const res = await validateKTP(file);
    toast.dismiss(toastId);

    if (!res.isValid) {
      toast.error(res.message);
      return;
    }
    updateMember(id, "fotoKtp", file);
    updateMember(id, "previewUrl", URL.createObjectURL(file));
  };

  const handleCameraCaptureMember = async (file) => {
    if (!cameraMemberId) return;
    const toastId = toast.loading("Validasi Foto Kamera...");
    const res = await validateKTP(file);
    toast.dismiss(toastId);

    if (!res.isValid) {
      toast.error(res.message);
      return;
    }
    updateMember(cameraMemberId, "fotoKtp", file);
    updateMember(cameraMemberId, "previewUrl", URL.createObjectURL(file));
    setCameraMemberId(null);
    toast.success("Foto KTP Anggota berhasil diambil");
  };

  useImperativeHandle(ref, () => ({
    submitDraft: async () => {
      // If basic data (nama/nik) is missing, don't even try to save to DB
      if (!form.nama || !form.nik) return true;

      try {
        setLoading(true);
        const fd = new FormData();
        fd.append("nama", form.nama);
        fd.append("nik", form.nik);
        fd.append("is_draft", "1");

        if (form.tanggal) fd.append("tanggal", form.tanggal);
        if (form.pendidikan) fd.append("pendidikan", form.pendidikan);
        if (form.pekerjaan) fd.append("pekerjaan", form.pekerjaan);
        if (form.penghasilan) fd.append("penghasilan", form.penghasilan);
        if (form.alamat) fd.append("alamat", form.alamat);
        if (form.latitude) fd.append("latitude", form.latitude);
        if (form.longitude) fd.append("longitude", form.longitude);

        if (form.fotoKtp instanceof File) {
          const compressedFoto = await compressImage(form.fotoKtp);
          fd.append("foto_ktp", compressedFoto);
        }

        const res = await api.post("/kunjungan", fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        return res.data.success;
      } catch (err) {
        console.error("Save mobile draft error:", err);

        // --- OFFLINE FALLBACK ---
        if (!navigator.onLine || err.message === 'Network Error') {
          const offId = generateOfflineId();
          await offlineDb.saveVisit({
            offline_id: offId,
            is_draft: true,
            nama: form.nama,
            nik: form.nik,
            alamat: form.alamat,
            created_at: new Date().toISOString(),
            form: { ...form },
            members: [],
            answers: null
          });
          toast.success("Draft disimpan secara offline 📶");
          return true;
        }

        return true;
      } finally {
        setLoading(false);
      }
    }
  }));

  // --- SUBMIT LOGIC (CHAINED & RETRY-SAFE) ---
  const handleSubmit = async () => {
    // 1. Validate Head
    if (!form.nama || !form.nik || !form.tanggal || !form.pendidikan || !form.pekerjaan || !form.penghasilan || !form.alamat) {
      setError("Mohon lengkapi data Kepala Keluarga");
      toast.error("Lengkapi data Kepala Keluarga");
      window.scrollTo(0, 0);
      return;
    }
    if (!form.fotoKtp && !createdId) {
      setError("Foto KTP Kepala Keluarga wajib diupload");
      toast.error("Foto KTP wajib diupload");
      window.scrollTo(0, 0);
      return;
    }
    if (!/^\d{16}$/.test(form.nik)) {
      setError("NIK Kepala Keluarga harus 16 digit");
      toast.error("NIK harus 16 digit");
      window.scrollTo(0, 0);
      return;
    }

    // 2. Validate Members
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.nama) { setError(`Anggota #${i + 1}: Nama wajib diisi`); return; }
      if (!m.nik || !/^\d{16}$/.test(m.nik)) { setError(`Anggota #${i + 1}: NIK harus 16 digit`); return; }
      if (!m.hubungan) { setError(`Anggota #${i + 1}: Hubungan wajib dipilih`); return; }
      if (!m.tanggalLahir) { setError(`Anggota #${i + 1}: Tanggal Lahir wajib diisi`); return; }
      if (!m.pendidikan) { setError(`Anggota #${i + 1}: Pendidikan wajib dipilih`); return; }
      if (!m.penghasilan) { setError(`Anggota #${i + 1}: Penghasilan wajib dipilih`); return; }
      if (!m.fotoKtp) { setError(`Anggota #${i + 1}: Foto KTP wajib diupload`); return; }
    }

    setLoading(true);
    setError("");

    try {
      let currentId = createdId;
      const fd = new FormData();

      // Compress & Append Head Data
      if (form.fotoKtp instanceof File) {
        const compressedFotoHead = await compressImage(form.fotoKtp);
        fd.append("foto_ktp", compressedFotoHead);
      }

      Object.keys(form).forEach(key => {
        if (key === 'fotoKtp') return; // Handled above
        if (form[key]) fd.append(key, form[key]);
      });

      // A. Submit Head (Create OR Update)
      if (!currentId) {
        // Create
        const res = await api.post("/kunjungan", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (!res.data.success || !res.data.data?.id) throw new Error(res.data.message || "Gagal membuat kunjungan");
        currentId = res.data.data.id;
        setCreatedId(currentId);
      } else {
        // Update (Retry Scenario - PUT)
        await api.post(`/kunjungan/${currentId}?_method=PUT`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }

      // B. Submit Members (Loop - Only Unsynced)
      const updatedMembers = [...members];
      for (let i = 0; i < updatedMembers.length; i++) {
        const member = updatedMembers[i];
        if (member.isSynced) continue; // Skip if already saved

        const fdMember = new FormData();
        fdMember.append("nama", member.nama);
        fdMember.append("nik", member.nik);
        fdMember.append("hubungan", member.hubungan);
        fdMember.append("tanggal_lahir", member.tanggalLahir);
        fdMember.append("pekerjaan", member.pekerjaan || "");
        fdMember.append("pendidikan", member.pendidikan);
        fdMember.append("penghasilan", member.penghasilan);
        if (member.fotoKtp instanceof File) {
          const compressedMemberFoto = await compressImage(member.fotoKtp);
          fdMember.append("foto_ktp", compressedMemberFoto);
        }

        await api.post(`/kunjungan/${currentId}/anggota`, fdMember, { headers: { "Content-Type": "multipart/form-data" } });

        // Mark as synced immediately
        updatedMembers[i].isSynced = true;
        setMembers([...updatedMembers]);
      }

      // C. Done -> Next Step
      clearDraft(); // Safe to clear now
      onNext(currentId, form.alamat);

    } catch (err) {
      console.error(err);

      // --- OFFLINE FALLBACK FOR SUBMIT ---
      if (!navigator.onLine || err.message === 'Network Error') {
        const offId = generateOfflineId();
        await offlineDb.saveVisit({
          offline_id: offId,
          is_draft: false,
          nama: form.nama,
          nik: form.nik,
          alamat: form.alamat,
          created_at: new Date().toISOString(),
          family_form: { members_count: members.length },
          form: { ...form },
          members: [...members],
          answers: null
        });
        toast.success("Kunjungan disimpan offline. Silakan isi kuisioner. 📶");
        clearDraft();
        onNext(offId, form.alamat);
        return;
      }

      if (err.response?.data?.errors) {
        const backendErrors = Object.values(err.response.data.errors).flat().join(", ");
        setError(`Validasi Gagal: ${backendErrors}`);
      } else {
        setError(err?.response?.data?.message || err.message || "Gagal menyimpan data");
      }
      window.scrollTo(0, 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <Alert type="error" message={error} />}

      {/* --- BAGIAN 1: KEPALA KELUARGA --- */}
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
          <Input
            label="Nama Lengkap"
            value={form.nama}
            onChange={(v) => {
              const clean = v.replace(/[^a-zA-Z\s\.\`\']/g, '');
              setForm({ ...form, nama: clean });
            }}
            required
          />
          <Input
            label="NIK (16 digit)"
            value={form.nik}
            onChange={handleNikChange}
            maxLength={16}
            required
          />
          {isNikChecking && <p className="text-xs text-blue-500 animate-pulse mt-1">Mengecek ketersediaan NIK...</p>}
          {nikError && <p className="text-xs text-red-500 font-bold mt-1">⚠️ {nikError}</p>}
          <Input type="date" label="Tanggal Lahir" value={form.tanggal} onChange={(v) => setForm({ ...form, tanggal: v })} required max={maxDate17()} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pendidikan" value={form.pendidikan} onChange={(v) => setForm({ ...form, pendidikan: v })} options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
            <Select label="Pekerjaan" value={form.pekerjaan} onChange={(v) => setForm({ ...form, pekerjaan: v })} options={pekerjaanList} required />
          </div>
          <Select label="Penghasilan" value={form.penghasilan} onChange={(v) => setForm({ ...form, penghasilan: v })} options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />

          {/* FOTO KTP HEAD */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Foto KTP <span className="text-red-500">*</span></label>
            <div
              onClick={() => setShowCamera(true)}
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${previewUrl ? 'border-green-500 bg-green-50' : 'border-blue-300 bg-blue-50 active:bg-blue-100'}`}
            >
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
                    <span className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-sm">
                      <Icon icon="mdi:check" /> Terisi
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => document.getElementById("HeadKtpInput").click()} className="w-full py-2 text-xs font-bold text-slate-500 mt-1 active:text-blue-600">
              Atau upload dari galeri
            </button>
            <input id="HeadKtpInput" type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
          </div>

          <Input label="Alamat Lengkap" value={form.alamat} onChange={(v) => setForm({ ...form, alamat: v })} required />
        </div>
      </div>

      {/* --- BAGIAN 2: ANGGOTA KELUARGA --- */}
      <div>
        <div className="flex justify-between items-end mb-6 border-b border-dashed border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:account-group-outline" className="text-blue-600" />
              Daftar Anggota
            </h2>
            <p className="text-xs text-slate-500 mt-1 ml-7">Total: {members.length} Orang</p>
          </div>
          <button
            onClick={addMember}
            className="flex items-center gap-1 pl-3 pr-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-100 transition active:scale-95"
          >
            <Icon icon="mdi:plus-circle" className="text-lg" />
            Tambah
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-gray-500 text-sm">Tidak ada anggota keluarga</p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member, idx) => (
              <div key={member.id} className="bg-white rounded-xl border border-slate-300">
                {/* Card Header - Flat Design, No Transparency */}
                <div className="flex justify-between items-center bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">Anggota Keluarga</h4>
                  </div>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-red-500 p-2 active:bg-red-50 rounded-full" // Hit area bigger
                    title="Hapus"
                  >
                    <Icon icon="mdi:trash-can-outline" width="20" />
                  </button>
                </div>

                {/* Card Body - No transitions */}
                <div className="p-4 space-y-4">
                  <Input
                    label="Nama Lengkap"
                    value={member.nama}
                    onChange={(v) => {
                      const clean = v.replace(/[^a-zA-Z\s\.\`\']/g, '');
                      updateMember(member.id, "nama", clean);
                    }}
                    required
                    placeholder="Sesuai KTP"
                  />
                  <Input label="NIK" value={member.nik} onChange={(v) => /^\d{0,16}$/.test(v) && updateMember(member.id, "nik", v)} maxLength={16} required placeholder="16 Digit Angka" />

                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Hubungan" value={member.hubungan} onChange={(v) => updateMember(member.id, "hubungan", v)} options={["Istri", "Suami", "Anak", "Orang Tua", "Mertua", "Famili Lain"]} required />
                    <Input type="date" label="Tgl Lahir" value={member.tanggalLahir} onChange={(v) => updateMember(member.id, "tanggalLahir", v)} required max={maxDate17()} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Pendidikan" value={member.pendidikan} onChange={(v) => updateMember(member.id, "pendidikan", v)} options={["SD", "SMP", "SMA/SMK", "D3", "S1", "S2+"]} required />
                    <Select label="Pekerjaan" value={member.pekerjaan} onChange={(v) => updateMember(member.id, "pekerjaan", v)} options={pekerjaanList} required />
                  </div>

                  <Select label="Penghasilan" value={member.penghasilan} onChange={(v) => updateMember(member.id, "penghasilan", v)} options={["< Rp500.000", "Rp500.000 - Rp1.500.000", "Rp1.500.000 - Rp3.000.000", "Rp3.000.000 - Rp5.000.000", "> Rp5.000.000"]} required />

                  {/* FOTO MEMBER - Simple Border, No Hover Scale */}
                  <div className="pt-3 mt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Foto KTP Anggota <span className="text-red-500">*</span>
                    </label>

                    <div
                      onClick={() => setCameraMemberId(member.id)}
                      className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${member.previewUrl ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50 active:bg-blue-50'}`}
                    >
                      {!member.previewUrl ? (
                        <div className="flex flex-col items-center gap-1">
                          <Icon icon="mdi:camera" className="text-2xl text-slate-400" />
                          <span className="text-sm font-bold text-blue-600">Ambil Foto</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={member.previewUrl} className="h-24 mx-auto rounded shadow-sm object-cover" alt="KTP" />
                          <div className="mt-1 text-center">
                            <span className="text-green-700 text-xs font-bold flex items-center justify-center gap-1">
                              <Icon icon="mdi:check-circle" /> Tersimpan
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={() => document.getElementById(`MemberKtpInput-${member.id}`).click()} className="w-full py-2 text-xs font-bold text-slate-500 mt-1 active:text-blue-600">
                      Upload File
                    </button>
                  </div>
                  <input id={`MemberKtpInput-${member.id}`} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleMemberFoto(member.id, e.target.files?.[0])}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white p-4 border-t border-slate-200 z-30">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold active:bg-blue-700"
        >
          {loading ? <span className="flex items-center justify-center gap-2"><Icon icon="mdi:loading" className="animate-spin" /> Menyimpan...</span> : "Lanjut ke Kuisioner →"}
        </button>
      </div>

      {showPermissionModal && <PermissionModal onRetry={handleRefreshGps} loading={loadingGps} />}
      {showCamera && <CameraCapture onCapture={handleCameraCaptureHead} onClose={() => setShowCamera(false)} />}
      {cameraMemberId && <CameraCapture onCapture={handleCameraCaptureMember} onClose={() => setCameraMemberId(null)} />}
    </div>
  );
});

function Step3({ kunjunganId, paslon, onBack, onComplete }) {
  const [answers, setAnswers] = useState({
    tau_paslon: 0,
    tau_informasi: 0,
    tau_visi_misi: 0,
    tau_program_kerja: 0,
    tau_rekam_jejak: 0,
    pernah_dikunjungi: null,
    percaya: 0,
    harapan: "",
    pertimbangan: 0,
    ingin_memilih: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateAnswer = (key, val) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    // Validasi setiap jawaban
    const missingAnswers = [];

    if (answers.tau_paslon === 0) missingAnswers.push("Mengenal pasangan calon");
    if (answers.tau_informasi === 0) missingAnswers.push("Informasi pemilihan");
    if (answers.tau_visi_misi === 0) missingAnswers.push("Visi dan misi");
    if (answers.tau_program_kerja === 0) missingAnswers.push("Program kerja");
    if (answers.tau_rekam_jejak === 0) missingAnswers.push("Rekam jejak");
    if (answers.pernah_dikunjungi === null) missingAnswers.push("Pernah dikunjungi");
    if (answers.percaya === 0) missingAnswers.push("Kepercayaan");
    if (!answers.harapan || answers.harapan.trim().length < 3) missingAnswers.push(`Harapan (minimal 3 karakter, sekarang: ${answers.harapan?.trim().length || 0})`);
    if (answers.pertimbangan === 0) missingAnswers.push("Pertimbangan");
    if (answers.ingin_memilih === 0) missingAnswers.push("Kesediaan memilih");

    if (missingAnswers.length > 0) {
      setError(`Mohon lengkapi jawaban: ${missingAnswers.join(", ")}`);
      return;
    }

    if (!kunjunganId) {
      setError("ID Kunjungan tidak ditemukan. Mohon ulangi proses dari awal.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // --- OFFLINE FALLBACK CHECK ---
      const isOfflineId = kunjunganId?.toString().startsWith('off_');

      if (isOfflineId || !navigator.onLine) {
        const visit = await offlineDb.getVisitById(kunjunganId);
        if (visit) {
          visit.answers = {
            ...answers,
            pernah_dikunjungi: answers.pernah_dikunjungi === "ya" ? 1 : 0
          };
          await offlineDb.saveVisit(visit);
          toast.success("Jawaban kuisioner disimpan offline 📶");
          onComplete();
          return;
        }
      }

      const res = await api.post(`/kunjungan/${kunjunganId}/selesai`, {
        ...answers,
        pernah_dikunjungi: answers.pernah_dikunjungi === "ya" ? 1 : 0
      });

      if (!res.data.success) {
        throw new Error(res.data.message || "Gagal menyelesaikan kunjungan");
      }

      onComplete();
    } catch (err) {
      console.error("Step3 submit error:", err);

      // --- RETRY/OFFLINE FALLBACK ON ERROR ---
      if (!navigator.onLine || err.message === 'Network Error') {
        const visit = await offlineDb.getVisitById(kunjunganId) || {
          offline_id: kunjunganId?.toString().startsWith('off_') ? kunjunganId : generateOfflineId(),
          id: kunjunganId,
          is_draft: false,
          form: {},
          members: [],
          answers: null,
          created_at: new Date().toISOString()
        };
        visit.answers = {
          ...answers,
          pernah_dikunjungi: answers.pernah_dikunjungi === "ya" ? 1 : 0
        };
        await offlineDb.saveVisit(visit);
        toast.success("Kuisioner disimpan offline 📶");
        onComplete();
        return;
      }

      setError(err?.response?.data?.message || err.message || "Terjadi kesalahan saat menyelesaikan kunjungan");
    } finally {
      setLoading(false);
    }
  };

  const questions = [
    { key: "tau_paslon", label: "Saya mengenal ${paslonName} yang maju dalam pemilihan gubernur ini." },
    { key: "tau_informasi", label: "Informasi mengenai pemilihan gubernur saat ini sudah saya pahami dengan cukup jelas." },
    { key: "tau_visi_misi", label: "Saya mengetahui visi dan misi ${paslonName} yang maju dalam pemilihan gubernur." },
    { key: "tau_program_kerja", label: "Program kerja pasangan calon menjadi pertimbangan utama saya dalam menentukan pilihan." },
    { key: "tau_rekam_jejak", label: "Rekam jejak digital ${paslonName} memengaruhi keputusan saya dalam memilih." },
    { key: "pernah_dikunjungi", label: "Pernah dikunjungi sebelumnya oleh relawan atau tim sukses?", type: "yesno" },
    { key: "percaya", label: "Saya percaya pasangan calon ${paslonName} memiliki kemampuan untuk memimpin daerah dengan baik." },
    { key: "harapan", label: "Saya berharap pemimpin terpilih nanti dapat membawa perubahan yang lebih baik bagi daerah ini.", type: "text" },
    { key: "pertimbangan", label: "Saya bersedia mempertimbangkan atau memilih ${paslonName} apabila programnya sesuai dengan kebutuhan daerah saya." },
    { key: "ingin_memilih", label: "Saya bersedia memilih ${paslonName} pada pemilihan gubernur mendatang." },
  ];

  const likertOptions = [
    { value: 4, label: "Sangat Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 3, label: "Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 2, label: "Tidak Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: 1, label: "Sangat Tidak Setuju", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ];

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">Kuisioner Kunjungan</h2>
        <p className="text-sm text-gray-600">Lengkapi data kuisioner akhir kunjungan</p>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Questionnaire */}
      <section>
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
                  value={answers[q.key]}
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
      </section>

      <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4 pt-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">← Kembali</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          loading={loading}
          className="w-full sm:px-10"
        >
          {loading ? "Menyelesaikan..." : "Selesaikan Kunjungan"}
        </Button>
      </div>
    </div>
  );
}

function StepComplete({ onFinish }) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-4 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
        <Icon icon="mdi:check-circle" className="text-green-600" width="64" height="64" />
      </div>
      <h3 className="text-3xl font-bold text-gray-800 mb-3">Kunjungan Berhasil!</h3>
      <p className="text-gray-600 mb-8">Data kunjungan keluarga telah tersimpan dengan baik</p>
      <div className="hidden md:flex flex-col gap-3 mt-4">
        <Button onClick={() => {
          if (onFinish) onFinish();
          window.location.reload();
        }}>Buat Kunjungan Baru</Button>

        <button
          onClick={() => {
            if (onFinish) onFinish();
            window.location.href = '/kunjungan';
          }}
          className="text-slate-500 font-bold hover:text-blue-600 transition-colors"
        >
          Kembali ke Daftar
        </button>
      </div>

      {/* MOBILE FIXED BUTTON */}
      {createPortal(
        <div
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, width: '100%' }}
          className="md:hidden bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex flex-col gap-3"
        >
          <button
            onClick={() => {
              if (onFinish) onFinish();
              window.location.reload();
            }}
            className="pointer-events-auto bg-blue-600 text-white w-full py-3.5 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2.5 font-bold text-base active:scale-[0.98] transition-all"
          >
            <Icon icon="mdi:plus-circle" width="24" />
            BUAT KUNJUNGAN BARU
          </button>

          <button
            onClick={() => {
              if (onFinish) onFinish();
              window.location.href = '/kunjungan';
            }}
            className="w-full py-3 text-slate-500 font-bold active:text-blue-600"
          >
            Kembali ke Daftar Kunjungan
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}


// === MODERN UI COMPONENTS ===

function Input({ label, type = "text", value, onChange, required, readOnly, maxLength, placeholder, disabled, max, min }) {
  return (
    <div className="relative group">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        max={max}
        min={min}
        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium placeholder-gray-400
          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-blue-50/10 
          transition-all duration-200 ease-in-out shadow-sm
          ${readOnly || disabled ? 'bg-gray-100/50 cursor-not-allowed text-gray-500' : ''}
        `}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div className="relative group">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full appearance-none px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium
            focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-blue-50/10 
            transition-all duration-200 ease-in-out shadow-sm cursor-pointer"
        >
          <option value="">-- {label} --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
          <Icon icon="mdi:chevron-down" className="text-xl" />
        </div>
      </div>
    </div>
  );
}

function Button({ children, onClick, disabled = false, loading = false, variant = "primary", className = "" }) {
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 active:scale-[0.98]",
    outline: "border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 active:scale-[0.98]",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98]",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-6 py-3.5 rounded-xl font-bold transition-all duration-200 flex justify-center items-center gap-2 
        ${styles[variant] || styles.primary} 
        ${disabled || loading ? "opacity-60 cursor-not-allowed transform-none shadow-none" : ""} 
        ${className}`}
    >
      {loading && (
        <Icon icon="mdi:loading" className="animate-spin text-xl" />
      )}
      {children}
    </button>
  );
}


function PermissionModal({ onRetry, loading }) {
  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 transition-all">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-blue-50/50">
            <Icon icon="mdi:map-marker-radius" width="32" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Izin Lokasi Diperlukan</h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Aplikasi ini membutuhkan akses lokasi untuk memverifikasi data kunjungan.
            <br /><span className="font-semibold text-blue-600">Mohon aktifkan izin lokasi di browser Anda.</span>
          </p>
          <div className="space-y-3">
            <button
              onClick={onRetry}
              disabled={loading}
              className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-wait' : ''}`}
            >
              {loading ? (
                <>
                  <Icon icon="mdi:loading" className="animate-spin text-xl" />
                  Mencari Lokasi...
                </>
              ) : (
                <>
                  <Icon icon="mdi:crosshairs-gps" className="text-xl" />
                  Nyalakan / Izinkan Lokasi
                </>
              )}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold rounded-xl transition-all"
            >
              Muat Ulang Halaman
            </button>
            <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="h-px bg-slate-100 flex-1"></div>
                <span>ATAU</span>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
              <button
                onClick={() => window.location.href = '/kunjungan'}
                className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors py-2 px-3 rounded-lg hover:bg-red-50"
              >
                Kembali ke Data Kunjungan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function Alert({ type, message, loading = false }) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-700",
    success: "bg-green-50 border-green-200 text-green-700",
    info: "bg-blue-50 border-blue-200 text-blue-700"
  };

  return (
    <div className={`border rounded-xl p-4 ${styles[type]}`}>
      <div className="flex items-center gap-3">
        {loading && (
          <Icon icon="mdi:loading" className="animate-spin" />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}
