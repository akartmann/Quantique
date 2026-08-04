import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => id.includes('/node_modules/phaser/') ? 'phaser' : undefined
            }
        },
    },
    server: {
        port: 8080
    }
});
