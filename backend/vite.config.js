import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    server: {
        host: true,              // ⬅️ PENTING
        allowedHosts: 'all',     // ⬅️ BIAR NGGAK KE-BLOCK
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
