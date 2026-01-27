const DB_NAME = 'SuperWebOfflineDB';
const DB_VERSION = 2;

export const initOfflineDb = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Kunjungan forms and their full state
            if (!db.objectStoreNames.contains('visits')) {
                db.createObjectStore('visits', { keyPath: 'offline_id' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

export const offlineDb = {
    async saveVisit(visitData) {
        const db = await initOfflineDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('visits', 'readwrite');
            const store = transaction.objectStore('visits');

            // Add a timestamp to know when it was created offline
            const data = {
                ...visitData,
                offline_created_at: new Date().toISOString(),
                sync_status: 'pending'
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(data.offline_id);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllVisits() {
        const db = await initOfflineDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('visits', 'readonly');
            const store = transaction.objectStore('visits');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getVisitById(offlineId) {
        const db = await initOfflineDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('visits', 'readonly');
            const store = transaction.objectStore('visits');
            const request = store.get(offlineId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteVisit(offlineId) {
        const db = await initOfflineDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('visits', 'readwrite');
            const store = transaction.objectStore('visits');
            const request = store.delete(offlineId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async updateVisitSyncStatus(offlineId, status) {
        const visit = await this.getVisitById(offlineId);
        if (visit) {
            visit.sync_status = status;
            return this.saveVisit(visit);
        }
    }
};
