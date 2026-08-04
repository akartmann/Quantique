import { defineConfig } from 'vite';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => id.includes('/node_modules/phaser/') ? 'phaser' : undefined
            }
        }
    },
    server: {
        port: 8080
    },
    preview: {
        headers: {
            'Cache-Control': 'public, max-age=600, stale-if-error=86400'
        },
        port: 4173,
        strictPort: true
    },
    plugins: [
        phasermsg()
    ]
});
