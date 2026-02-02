import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import Navbar from "../../../components/Navbar"; // <- sesuaikan path

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

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatJam = (d) =>
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatTanggal = (d) =>
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

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
    toast.loading("Mengambil lokasi...", { id: "gps" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        toast.success("Lokasi berhasil diambil", { id: "gps" });
        setGettingLocation(false);
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
  };

  const confirm = () => {
    if (!photoDataUrl) return toast.error("Belum ada foto");
    if (coords.lat == null || coords.lng == null) return toast.error("Lokasi belum ada. Ambil GPS dulu.");

    toast.success("Tersimpan (dummy). Foto lagi ya.");
    console.log("[DUMMY SAVE]", {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      device_time: new Date().toISOString(),
      photo_preview: photoDataUrl.slice(0, 40) + "...",
    });

    // balik lagi seperti refresh
    setPhotoDataUrl("");
    setMode("live");
    getLocation();
  };

  const locationText =
    coords.lat == null || coords.lng == null ? "Lokasi belum diambil" : `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:camera-marker" width={22} className="text-blue-700" />
              <div>
                <p className="font-bold text-slate-800">Foto Pemasangan APK</p>
                <p className="text-xs text-slate-500">Mode: {mode === "live" ? "Kamera" : "Review"}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2 justify-end">
                <Icon icon="mdi:clock-outline" width={18} className="text-blue-700" />
                {formatJam(now)}
              </p>
              <p className="text-xs text-slate-500">{formatTanggal(now)}</p>
            </div>
          </div>

          {/* camera area */}
          <div className="relative bg-black">
            {mode === "live" && (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-[68vh] object-cover" />

                {/* overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-0 right-0 text-center text-white drop-shadow">
                    <p className="text-sm font-semibold opacity-95">Foto APK yang sudah terpasang</p>
                    <p className="text-xs opacity-80">Pastikan APK terlihat jelas</p>
                  </div>

                  <div className="absolute left-6 right-6 top-20 bottom-28 border-2 border-blue-400/80 rounded-xl">
                    <span className="absolute -top-1 -left-1 w-10 h-10 border-l-4 border-t-4 border-blue-400 rounded-tl-xl" />
                    <span className="absolute -top-1 -right-1 w-10 h-10 border-r-4 border-t-4 border-blue-400 rounded-tr-xl" />
                    <span className="absolute -bottom-1 -left-1 w-10 h-10 border-l-4 border-b-4 border-blue-400 rounded-bl-xl" />
                    <span className="absolute -bottom-1 -right-1 w-10 h-10 border-r-4 border-b-4 border-blue-400 rounded-br-xl" />
                  </div>
                </div>

                {/* if camera not ready */}
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-xl p-5 w-[92%] max-w-sm text-center">
                      <p className="font-bold text-slate-800">Kamera belum aktif</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Klik tombol di bawah untuk mengaktifkan kamera (permission).
                      </p>
                      <button
                        onClick={startCamera}
                        disabled={startingCamera}
                        className={`mt-4 w-full px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2
                          ${startingCamera ? "bg-slate-200 text-slate-500" : "bg-blue-700 text-white hover:bg-blue-800"}`}
                      >
                        <Icon icon="mdi:camera" width={20} />
                        {startingCamera ? "Mengaktifkan..." : "Aktifkan Kamera"}
                      </button>
                    </div>
                  </div>
                )}

                {/* shutter */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <button
                    onClick={takePhoto}
                    disabled={!cameraReady}
                    className={`w-16 h-16 rounded-full border-4 flex items-center justify-center active:scale-95 transition
                      ${cameraReady ? "bg-white/90 border-blue-600" : "bg-white/30 border-slate-400 cursor-not-allowed"}`}
                    aria-label="Ambil foto"
                  >
                    <span className={`w-12 h-12 rounded-full ${cameraReady ? "bg-blue-600" : "bg-slate-400"}`} />
                  </button>
                </div>
              </>
            )}

            {mode === "review" && (
              <>
                <img src={photoDataUrl} alt="Hasil foto" className="w-full h-[68vh] object-cover" />

                <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-6">
                  <button
                    onClick={retake}
                    className="w-14 h-14 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center active:scale-95 transition"
                    aria-label="Ulang foto"
                  >
                    <Icon icon="mdi:close" width={28} className="text-rose-600" />
                  </button>

                  <button
                    onClick={confirm}
                    className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow active:scale-95 transition"
                    aria-label="Simpan"
                  >
                    <Icon icon="mdi:check" width={30} />
                  </button>
                </div>
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* bottom info */}
          <div className="p-5 bg-white border-t border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon icon="mdi:map-marker" width={22} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Lokasi (GPS)</p>
                  <p className="text-sm text-slate-600">{locationText}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${accuracyBadgeClass}`}>
                      {coords.accuracy ? `±${Math.round(coords.accuracy)}m • ${accuracyLabel}` : accuracyLabel}
                    </span>
                    {gettingLocation && <span className="text-xs text-slate-400">mengambil...</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Jam otomatis: <span className="font-semibold">{formatJam(now)}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={getLocation}
                disabled={gettingLocation}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition
                  ${gettingLocation ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200"}`}
              >
                <Icon icon="mdi:crosshairs-gps" width={18} />
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
