import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import BatchVerificationView from "./BatchVerificationView";
import SingleVisitView from "./SingleVisitView";
import RelawanVisitView from "./RelawanVisitView";
import AdminApkRequestView from "./AdminApkRequestView";
import KoordinatorApkRequestView from "./KoordinatorApkRequestView";


// === ALERT MODAL FOR DELETED VISITS ===
const AlertModal = ({ isOpen, onClose, message, title = "Alert" }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 z-10 animate-in fade-in zoom-in duration-200">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
            <Icon icon="mdi:trash-can-alert" width="32" className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-sm text-slate-600 mb-6">{message}</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("modal-root") || document.body
  );
};

// === CONFIRM DELETE MODAL (MATCH DESIGN) ===
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl px-6 py-5 z-10 animate-in fade-in zoom-in duration-200">
        {/* Title */}
        <h3 className="text-2xl font-bold text-blue-900 mb-2">
          Hapus Notifikasi
        </h3>

        {/* Description */}
        <p className="text-lg text-slate-500 leading-relaxed mb-6">
          Apakah Anda yakin ingin menghapus notifikasi ini?
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition"
          >
            Batal
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-blue-900 text-white font-medium hover:bg-blue-700 transition"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("modal-root") || document.body
  );
};

export default function InboxIndex() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Pagination State (kept - tidak dipakai di mode mock)
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Get role from localStorage - same way as Navbar
  const role = localStorage.getItem("role") || "";

  // Filter out deleted notifications for the list, they will be shown as popups
  const listNotifications = notifications.filter(n => n.data?.type !== 'visit_deleted' || n.read_at);
  const deletedNotifications = notifications.filter(n => n.data?.type === 'visit_deleted' && !n.read_at);

  // Handle deleted notification popup
  const currentDeletedNotif = deletedNotifications[0]; // Process one by one

  // --- HELPER FUNCTIONS ---

  const markAsReadLocally = (id) => {
    // Immediate UI update without waiting for API
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read_at: new Date().toISOString() } : n
    ));
  };

  const handleDismissDeleted = async () => {
    if (currentDeletedNotif) {
      // Optimistic read
      markAsReadLocally(currentDeletedNotif.id);
      try {
        await api.post(`/notifications/${currentDeletedNotif.id}/read`);
      } catch (err) {
        console.error("Failed to mark deleted notif as read", err);
      }
    }
  };

  // ✅ Fetch notifications from real API
  const fetchNotifications = async (isLoadMore = false) => {
    const timeout = setTimeout(() => isLoadMore ? setLoadingMore(false) : setLoading(false), 5000);

    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const res = await api.get(`/notifications?page=${currentPage}`);
      const response = res.data;

      clearTimeout(timeout);

      const newData = response.data?.data || response.data || [];

      if (isLoadMore) {
        setNotifications(prev => [...prev, ...newData]);
      } else {
        setNotifications(newData);
      }

      setPage(currentPage);
      setHasMore(response.data?.next_page_url ? true : false);

      // Auto-select first unread notification if available (only on fresh load)
      if (!isLoadMore && !selectedNotification) {
        const firstUnread = newData.find(n => !n.read_at);
        if (firstUnread) {
          setSelectedNotification(firstUnread);
        }
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };


  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      setLoadingMore(true);
      fetchNotifications(true);
    }
  };

  // ✅ Read all via real API
  const handleReadAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      window.dispatchEvent(new Event('notification-read'));
    } catch (err) {
      console.error("Failed to mark all as read", err);
      toast.error("Gagal menandai semua dibaca");
    }
  };

  // ✅ Click notif — mark read via real API
  const handleNotificationClick = async (notif) => {
    console.log("Notification clicked:", notif.data); // Debug log

    // Optimistic read status update
    if (!notif.read_at) {
      markAsReadLocally(notif.id);
      try {
        await api.post(`/notifications/${notif.id}/read`);
        window.dispatchEvent(new Event('notification-read'));
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }


    const data = notif.data || {};

    // SAFE COPY to avoid direct state mutation issues and normalize keys
    const safeNotif = {
      ...notif,
      data: {
        ...data,
        kunjungan_id: data.kunjungan_id || data.visit_id // Normalize ID
      }
    };

    // ✅ NEW: APK REQUEST -> show in split view OR navigate if koordinator/kurir
    if ((data.type || "").startsWith("apk_request")) {
      // Jika user adalah koordinator, navigate ke halaman request dengan query param
      if (role === "apk_koordinator") {
        navigate(data.action_url || `/permintaan-apk?id=${data.apk_request_id}`);
        return;
      }

      // Jika user adalah kurir dan tipe assigned, navigate ke dashboard kurir
      if ((role === "apk_kurir" || role === "kurir_apk") && data.type === 'apk_request_assigned') {
        navigate("/Dashboardkurir-apk");
        return;
      }

      // Untuk admin atau lainnya, tampilkan di split view
      setSelectedNotification(notif);
      if (window.innerWidth < 768) {
        window.history.pushState({ view: 'detail' }, '');
      }
      return;
    }

    // If it's a batch verification, show in split view
    if (data.type === 'verification_batch') {
      setSelectedNotification(notif);
      if (window.innerWidth < 768) {
        window.history.pushState({ view: 'detail' }, '');
      }
      return;
    }

    // Special handling for deleted visits (history click)
    if (data.type === 'visit_deleted') {
      toast("Data kunjungan ini sudah dihapus.", {
        icon: '🗑️',
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }

    // If it has a visit ID (normalized), show in split view
    if (safeNotif.data.kunjungan_id) {
      setSelectedNotification(safeNotif);
      if (window.innerWidth < 768) {
        window.history.pushState({ view: 'detail' }, '');
      }
      return;
    }

    // Default legacy logic for other types
    try {
      if (data.redirect_url) {
        if (data.redirect_url.startsWith('http')) {
          window.open(data.redirect_url, '_blank');
        } else {
          navigate(data.redirect_url);
        }
        return;
      }
    } catch (err) {
      console.error("Failed to process notification click", err);
    }
  };

  const handleBatchComplete = async () => {
    if (window.history.state?.view === 'detail') {
      window.history.back();
    } else {
      setSelectedNotification(null);
    }

    // Refresh notifications
    fetchNotifications(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- EFFECTS ---
  useEffect(() => {
    fetchNotifications();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []); // only mount

  // === HARDWARE BACK BUTTON SUPPORT ===
  useEffect(() => {
    const handlePopState = (event) => {
      setSelectedNotification(prev => {
        if (prev) {
          return null;
        }
        return prev;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  console.log("Inbox - User role:", role); // Debug log

  return (
    <div className="h-[calc(100vh-80px)] flex bg-slate-50 overflow-hidden">
      {/* POPUP FOR DELETED VISITS */}
      <AlertModal
        isOpen={!!currentDeletedNotif}
        onClose={handleDismissDeleted}
        title="Kunjungan Dihapus"
        message={currentDeletedNotif?.data?.message || "Sebuah data kunjungan telah dihapus oleh Relawan."}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const notif = deleteTarget;
          setDeleteTarget(null);

          // Optimistic UI
          setNotifications(prev => prev.filter(n => n.id !== notif.id));
          if (selectedNotification?.id === notif.id) {
            setSelectedNotification(null);
          }

          // ✅ Delete via real API
          try {
            await api.delete(`/notifications/${notif.id}`);
          } catch (err) {
            console.error("Failed to delete notification", err);
            toast.error("Gagal menghapus pesan");
            fetchNotifications(); // rollback
          }
        }}
      />

      {/* LEFT SIDEBAR: LIST */}
      <div className={`${selectedNotification ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-slate-200 bg-white`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Icon icon="mdi:bell" className="text-blue-900" />
            Notifikasi
          </h1>
          {listNotifications.some(n => !n.read_at) && (
            <button
              onClick={handleReadAll}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              title="Tandai semua dibaca"
            >
              <Icon icon="mdi:check-all" width={18} />
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>
          ) : listNotifications.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Icon icon="mdi:bell-outline" width={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada pesan</p>
            </div>
          ) : (
            <>
              {listNotifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedNotification?.id === notif.id
                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                    : notif.read_at
                      ? 'bg-white border-transparent hover:bg-slate-50'
                      : 'bg-white border-l-4 border-l-blue-500 shadow-sm border-t-slate-100 border-r-slate-100 border-b-slate-100 font-medium'
                    }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const type = notif.data?.type;
                        let badgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
                        let iconName = 'mdi:bell';
                        let label = 'Sistem';

                        if (type === 'verification_batch') {
                          badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                          iconName = 'mdi:buffer';
                          label = 'Perlu Verifikasi';
                        } else if (type === 'visit_updated') {
                          badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                          iconName = 'mdi:pencil-circle';
                          label = 'Revisi Selesai';
                        } else if (type === 'new_visit') {
                          badgeClass = 'bg-green-50 text-green-700 border-green-200';
                          iconName = 'mdi:plus-circle';
                          label = 'Kunjungan Baru';
                        } else if (type === 'visit_needs_revision') {
                          badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                          iconName = 'mdi:alert-circle';
                          label = 'Perlu Revisi';
                        } else if (type === 'visit_deleted') {
                          badgeClass = 'bg-red-50 text-red-700 border-red-200';
                          iconName = 'mdi:trash-can';
                          label = 'Kunjungan Dihapus';
                        }
                        // ✅ NEW: APK REQUEST BADGES
                        else if (type === 'apk_request') {
                          badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                          iconName = 'mdi:clipboard-text-outline';
                          label = 'Permintaan APK';
                        } else if (type === 'apk_request_approved') {
                          badgeClass = 'bg-green-50 text-green-700 border-green-200';
                          iconName = 'mdi:check-circle';
                          label = 'Disetujui';
                        } else if (type === 'apk_request_rejected') {
                          badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                          iconName = 'mdi:close-circle';
                          label = 'Ditolak';
                        } else if (type === 'apk_request_assigned') {
                          badgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                          iconName = 'mdi:truck-fast';
                          label = 'Tugas Baru';
                        }

                        return (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 border shadow-sm ${badgeClass}`}>
                            <Icon icon={iconName} width={14} />
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{formatDate(notif.created_at)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(notif);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1 rounded-full hover:bg-red-50"
                        title="Hapus Pesan"
                      >
                        <Icon icon="mdi:close-thick" width={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {notif.data?.message || '-'}
                  </p>
                </div>
              ))}

              {/* Load More Button (disabled in mock) */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Icon icon="svg-spinners:180-ring-with-bg" width="16" />
                      Memuat...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:chevron-down" />
                      Muat Lebih Banyak
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANE: DETAIL */}
      <div className={`${!selectedNotification ? 'hidden md:flex' : 'flex'} w-full md:w-2/3 flex-col bg-slate-50 relative`}>
        {selectedNotification ? (
          selectedNotification.data?.type === "verification_batch" ? (
            <BatchVerificationView
              notification={selectedNotification}
              onComplete={handleBatchComplete}
            />
          ) : (selectedNotification.data?.type || "").startsWith("apk_request") ? (
            role === "admin_apk" ? (
              <AdminApkRequestView
                key={selectedNotification.id}
                requestId={selectedNotification.data?.apk_request_id}
                onComplete={handleBatchComplete}
                onBack={() => setSelectedNotification(null)}
              />
            ) : (
              <KoordinatorApkRequestView
                key={selectedNotification.id}
                requestId={selectedNotification.data?.apk_request_id}
                onComplete={handleBatchComplete}
                onBack={() => setSelectedNotification(null)}
              />
            )
          ) : selectedNotification.data?.kunjungan_id ? (
            (() => {
              console.log("Rendering visit view - Role:", role, "| Notification:", selectedNotification.data);
              return role === "relawan" ? (
                <RelawanVisitView
                  key={selectedNotification.id}
                  notification={selectedNotification}
                  onComplete={handleBatchComplete}
                />
              ) : (
                <SingleVisitView
                  key={selectedNotification.id}
                  notification={selectedNotification}
                  onComplete={handleBatchComplete}
                />
              );
            })()
          ) : (
            <div className="flex flex-col h-full bg-white m-0 md:m-4 md:rounded-2xl shadow-sm border border-slate-100 p-8">
              <button
                onClick={() => setSelectedNotification(null)}
                className="md:hidden mb-4 flex items-center text-slate-500"
              >
                <Icon icon="mdi:arrow-left" /> Kembali
              </button>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Detail Notifikasi</h2>
              <p className="text-slate-600">{selectedNotification.data?.message}</p>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <Icon icon="mdi:bell-outline" width={64} className="mb-4 opacity-50" />
            <p className="font-medium text-lg">Pilih notifikasi untuk melihat detail</p>
          </div>
        )}
      </div>

    </div >
  );
}
