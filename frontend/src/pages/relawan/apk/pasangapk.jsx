import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import Navbar from "../../../components/Navbar"; // <- sesuaikan path
import api from "../../../lib/axios";
import { useMutation } from "@tanstack/react-query";

export default function PasangApk() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("live"); // live | review
  const [photoDataUrl, setPhotoDataUrl] = useState("");

  const [cameraReady, setCameraReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);

  const [gettingLocation, setGettingLocation] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null, accuracy: null });
  const [address, setAddress] = useState(""); // state untuk alamat
  const [gettingAddress, setGettingAddress] = useState(false);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatJam = (d) =>
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatTanggal = (d) =>
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

  // --- REVERSE GEOCODING ---
  const getAddressFromCoords = useCallback(async (lat, lng) => {
    if (!lat || !lng) return;

    setGettingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'id',
          }
        }
      );

      if (!response.ok) throw new Error("Gagal mengambil alamat");

      const data = await response.json();

      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress("Alamat tidak ditemukan");
      }
    } catch (error) {
      console.error("Error getting address:", error);
      setAddress("Gagal mengambil alamat");
    } finally {
      setGettingAddress(false);
    }
  }, []);

  // --- CAMERA ---
  const stopCamera = () => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Browser tidak mendukung kamera");
      return;
    }

    try {
      setStartingCamera(true);

      // stop dulu kalau ada stream lama
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      // iOS kadang butuh user gesture, tapi kita coba play dulu
      await video.play();

      setCameraReady(true);
    } catch (err) {
      console.error(err);
      toast.error("Gagal akses kamera. Cek permission camera & pastikan pakai HTTPS (ngrok).");
      setCameraReady(false);
    } finally {
      setStartingCamera(false);
    }
  };

  // start on mount
  useEffect(() => {
    startCamera();
    getLocation(); // coba ambil lokasi di awal
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- LOCATION ---
  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung GPS");
      return;
    }

    setGettingLocation(true);
    setAddress(""); // reset alamat
    toast.loading("Mengambil lokasi...", { id: "gps" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        toast.success("Lokasi berhasil diambil", { id: "gps" });
        setGettingLocation(false);

        // Ambil alamat dari koordinat
        getAddressFromCoords(latitude, longitude);
      },
      (err) => {
        console.error(err);
        toast.error(
          err.code === 1
            ? "Izin lokasi ditolak. Allow location + nyalakan GPS."
            : "Gagal ambil lokasi. Coba lagi.",
          { id: "gps" }
        );
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const accuracyLabel = useMemo(() => {
    if (!coords.accuracy) return "-";
    const a = Number(coords.accuracy);
    if (a <= 10) return "Sangat baik";
    if (a <= 25) return "Baik";
    if (a <= 50) return "Cukup";
    return "Kurang";
  }, [coords.accuracy]);

  const accuracyBadgeClass = useMemo(() => {
    if (!coords.accuracy) return "bg-slate-100 text-slate-600 border-slate-200";
    const a = Number(coords.accuracy);
    if (a <= 10) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (a <= 25) return "bg-blue-100 text-blue-700 border-blue-200";
    if (a <= 50) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-rose-100 text-rose-700 border-rose-200";
  }, [coords.accuracy]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoDataUrl(dataUrl);
    setMode("review");
  };

  const retake = () => {
    setPhotoDataUrl("");
    setMode("live");
    // Restart kamera setelah kembali ke mode live
    startCamera();
  };

  // --- MUTATION ---
  // --- MUTATION ---

  // const [note, setNote] = useState(""); // Note removed as per request

  const { isPending: isSubmitting, mutate: submitReport } = useMutation({
    mutationFn: async (formData) => {
      // Backend expects: photo, latitude, longitude, taken_at (and headers)
      return await api.post("/apk/installations", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.dismiss("submitting");
      toast.success("Laporan berhasil disimpan!");
      // Reset state
      setPhotoDataUrl("");
      setMode("live");
      setAddress("");
      // setNote(""); 
      startCamera();
      getLocation();
    },
    onError: (err) => {
      console.error(err);
      toast.dismiss("submitting");
      toast.error(err.response?.data?.message || "Gagal menyimpan laporan");
    }
  });

  // Convert DataURL to File
  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const confirm = () => {
    if (!photoDataUrl) return toast.error("Belum ada foto");
    if (coords.lat == null || coords.lng == null) return toast.error("Lokasi belum ada. Ambil GPS dulu.");

    toast.loading("Mengirim laporan...", { id: "submitting" });

    const file = dataURLtoFile(photoDataUrl, "apk_proof.jpg");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("latitude", coords.lat);
    formData.append("longitude", coords.lng);

    // Add taken_at (required by backend now)
    // Use ISO string or format 'YYYY-MM-DD HH:mm:ss' 
    // Laravel default date validation accepts Y-m-d H:i:s usually.
    // Let's formatting it to be safe or just send ISO. 
    // User backend: 'taken_at' => 'required|date'
    formData.append("taken_at", new Date().toISOString());

    // REMOVED: note, accuracy, address (Backend doesn't use them in create payload)
    // if (coords.accuracy) formData.append("accuracy", coords.accuracy);
    // if (address) formData.append("address", address);
    // formData.append("note", note || "Laporan Pemasangan APK");

    submitReport(formData);
  };

  const locationText =
    coords.lat == null || coords.lng == null ? "Belum diambil" : `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <Navbar />

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-2 md:px-6 py-2 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* header - compact */}
          <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:camera-marker" width={20} className="text-blue-700" />
              <div>
                <p className="font-bold text-slate-800 text-sm">Foto Pemasangan APK</p>
                <p className="text-xs text-slate-500">{formatJam(now)} • {formatTanggal(now)}</p>
              </div>
            </div>
          </div>

          {/* camera area - flex grow to fill available space */}
          <div className="relative bg-black flex-1 min-h-0">
            {mode === "live" && (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />

                {/* overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-0 right-0 text-center text-white drop-shadow">
                    <p className="text-sm font-semibold opacity-95">Foto APK yang sudah terpasang</p>
                  </div>

                  <div className="absolute left-4 right-4 top-12 bottom-20 border-2 border-blue-400/80 rounded-xl">
                    <span className="absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 border-blue-400 rounded-tl-xl" />
                    <span className="absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 border-blue-400 rounded-tr-xl" />
                    <span className="absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 border-blue-400 rounded-bl-xl" />
                    <span className="absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 border-blue-400 rounded-br-xl" />
                  </div>
                </div>

                {/* if camera not ready */}
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-xl p-4 w-[90%] max-w-sm text-center">
                      <p className="font-bold text-slate-800">Kamera belum aktif</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Klik tombol di bawah untuk mengaktifkan kamera.
                      </p>
                      <button
                        onClick={startCamera}
                        disabled={startingCamera}
                        className={`mt-3 w-full px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2
                          ${startingCamera ? "bg-slate-200 text-slate-500" : "bg-blue-700 text-white hover:bg-blue-800"}`}
                      >
                        <Icon icon="mdi:camera" width={20} />
                        {startingCamera ? "Mengaktifkan..." : "Aktifkan Kamera"}
                      </button>
                    </div>
                  </div>
                )}

                {/* shutter */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <button
                    onClick={takePhoto}
                    disabled={!cameraReady}
                    className={`w-14 h-14 rounded-full border-4 flex items-center justify-center active:scale-95 transition
                      ${cameraReady ? "bg-white/90 border-blue-600" : "bg-white/30 border-slate-400 cursor-not-allowed"}`}
                    aria-label="Ambil foto"
                  >
                    <span className={`w-10 h-10 rounded-full ${cameraReady ? "bg-blue-600" : "bg-slate-400"}`} />
                  </button>
                </div>
              </>
            )}

            {mode === "review" && (
              <>
                <div className="relative w-full h-full">
                  <img src={photoDataUrl} alt="Hasil foto" className="w-full h-full object-cover" />
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
                  <button
                    onClick={retake}
                    className="w-12 h-12 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center active:scale-95 transition"
                    aria-label="Ulang foto"
                  >
                    <Icon icon="mdi:close" width={24} className="text-rose-600" />
                  </button>

                  <button
                    onClick={confirm}
                    disabled={isSubmitting}
                    className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow active:scale-95 transition
                      ${isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                    aria-label="Simpan"
                  >
                    {isSubmitting ? (
                      <Icon icon="mdi:loading" width={26} className="animate-spin" />
                    ) : (
                      <Icon icon="mdi:check" width={26} />
                    )}
                  </button>
                </div>
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* bottom info - compact */}
          <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon icon="mdi:map-marker" width={18} className="text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Alamat */}
                  <p className="text-xs font-bold text-slate-800">Alamat</p>
                  <p className="text-xs text-slate-600 break-words line-clamp-2">
                    {gettingAddress ? (
                      <span className="text-slate-400 italic">Mengambil alamat...</span>
                    ) : address ? (
                      address
                    ) : (
                      <span className="text-slate-400">Belum ada alamat</span>
                    )}
                  </p>

                  {/* Latitude & Longitude */}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-800">Koordinat</p>
                    <p className="text-xs text-slate-600 font-mono">{locationText}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={getLocation}
                disabled={gettingLocation || gettingAddress}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition flex-shrink-0
                  ${gettingLocation || gettingAddress ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200"}`}
              >
                <Icon icon="mdi:crosshairs-gps" width={16} />
                GPS
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 text-center py-4">
          © SuperWeb • Pasang APK • Frontend only
        </div>
      </div>
    </div>
  );
}
