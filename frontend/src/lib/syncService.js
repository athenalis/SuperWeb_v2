import api from './axios';
import { offlineDb } from './offlineDb';
import { toast } from 'react-hot-toast';

export const syncService = {
    async syncPendingVisits() {
        if (!navigator.onLine) {
            console.log('Skipping sync: Device is offline');
            return;
        }

        const visits = await offlineDb.getAllVisits();
        const pending = visits.filter(v => v.sync_status === 'pending');

        if (pending.length === 0) return;

        let successCount = 0;
        let failCount = 0;

        for (const visit of pending) {
            try {
                const result = await this.uploadVisit(visit);
                if (result) {
                    await offlineDb.deleteVisit(visit.offline_id);
                    successCount++;
                }
            } catch (err) {
                console.error(`Failed to sync visit ${visit.offline_id}:`, err);
                failCount++;
            }
        }

        if (successCount > 0) {
            toast.success(`Berhasil sinkronisasi ${successCount} data kunjungan offline.`);
        }
        if (failCount > 0) {
            toast.error(`Gagal sinkronisasi ${failCount} data. Akan dicoba lagi nanti.`);
        }

        // Trigger UI Refresh globally
        window.dispatchEvent(new Event('sync-complete'));
    },

    async uploadVisit(visit) {
        // Construct FormData for the visit
        const fd = new FormData();

        // Metadata
        fd.append('offline_id', visit.offline_id);
        fd.append('is_draft', visit.is_draft ? 'true' : 'false');

        // Fields from visit.form
        Object.keys(visit.form).forEach(key => {
            if (key === 'fotoKtp' && visit.form[key] instanceof Blob) {
                fd.append('foto_ktp', visit.form[key], 'ktp_offline.jpg');
            } else if (visit.form[key] !== null && visit.form[key] !== undefined) {
                fd.append(key, visit.form[key]);
            }
        });

        // Note: Coordinates should be in visit.form.latitude/longitude

        const endpoint = visit.id ? `/kunjungan/${visit.id}?_method=PUT` : '/kunjungan';
        const response = await api.post(endpoint, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const kunjunganId = response.data?.data?.id || visit.id;

        // If it's a new kunjungan, we might need to sync members and answers separately 
        // if the backend stores them in separate requests. 
        // But our current system usually handles store in one go or step-by-step.

        // Let's assume for now it's a full Step 1 save. 
        // If there are members (Step 2) and Answers (Step 3), we need to handle them too.
        if (visit.members && visit.members.length > 0 && kunjunganId) {
            for (const member of visit.members) {
                const mfd = new FormData();
                Object.keys(member).forEach(k => {
                    if (k === 'fotoKtp' && member[k] instanceof Blob) {
                        mfd.append('foto_ktp', member[k], 'member_offline.jpg');
                    } else if (member[k] !== null && member[k] !== undefined && k !== 'isLocal' && k !== 'previewUrl') {
                        mfd.append(k, member[k]);
                    }
                });
                await api.post(`/kunjungan/${kunjunganId}/anggota`, mfd);
            }
        }

        if (visit.answers && kunjunganId) {
            await api.post(`/kunjungan/${kunjunganId}/selesai`, {
                ...visit.answers,
                pernah_dikunjungi: (visit.answers.pernah_dikunjungi === "ya" || visit.answers.pernah_dikunjungi === 1) ? 1 : 0
            });
        }

        return true;
    }
};

// Auto-sync listener
window.addEventListener('online', () => {
    console.log('Online detected, triggering sync...');
    syncService.syncPendingVisits();
});
