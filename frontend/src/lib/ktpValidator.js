import Tesseract from 'tesseract.js';

/**
 * Validates if an image file is likely a KTP (Indonesian ID Card)
 * by detecting specific keywords using OCR.
 * 
 * @param {File} file - The image file to validate
 * @returns {Promise<{isValid: boolean, message: string}>}
 */
export const validateKTP = async (file) => {
    if (!file) return { isValid: false, message: "File tidak ditemukan" };

    try {
        const worker = await Tesseract.createWorker('ind');

        // Process image
        const ret = await worker.recognize(file);
        const text = ret.data.text.toUpperCase();
        await worker.terminate();

        // Keywords commonly found on KTP
        // We check for a subset. Found 2-3 matches is usually enough.
        const keywords = [
            "PROVINSI", "KABUPATEN", "NIK", "GOL. DARAH",
            "STATUS PERKAWINAN", "KEWARGANEGARAAN", "BERLAKU HINGGA",
            "RTRW", "KELDESA", "KECAMATAN", "AGAMA", "PEKERJAAN"
        ];

        let matchCount = 0;
        keywords.forEach(word => {
            if (text.includes(word)) matchCount++;
        });

        // Threshold: At least 2 specific words (e.g. "NIK" and "PROVINSI")
        // or just "NIK" might be too generic if found in other text, but on a card it's likely KTP.
        // "PROVINSI" is very strong.

        const isValid = matchCount >= 2;

        if (!isValid) {
            console.warn("OCR Text failed validation:", text);
            return {
                isValid: false,
                message: "Foto tidak terdeteksi sebagai KTP. Pastikan posisi tegak, jelas, dan tulisan terbaca (Provinsi/NIK)."
            };
        }

        return { isValid: true, message: "KTP Valid" };

    } catch (err) {
        console.error("OCR Error:", err);
        // If OCR fails (network, etc), we might want to allow it with a warning, or fail.
        // User said "HARUS disyaratkan harus foto ktp". Failsafe: strict.
        return {
            isValid: false,
            message: "Gagal memindai foto. Pastikan koneksi internet stabil untuk validasi OCR."
        };
    }
};
