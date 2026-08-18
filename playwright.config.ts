import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    /**
     * The suite's worker budget — the decision carried from the 2.9 review to Story 2.10.
     *
     * **Capped, not defaulted, and the measurements are why.** Playwright's default here resolves to 9
     * on an 18-core machine, and the canvas walks are the specs that mind. They are not slow because
     * they are badly written: they drive a *game*, and Phaser processes pointer and keyboard input once
     * per rendered frame. Nine concurrent browsers stretch that frame, and every wait calibrated in
     * frames stretches with it.
     *
     * Measured at HEAD, whole chromium suite:
     *
     * | Workers | Result | Wall clock |
     * | --- | --- | --- |
     * | 5 | 53 passed / 7 failed, **three consecutive runs identical** | 1.7–1.8 min |
     * | 9 | 52–53 passed / 7–8 failed, `canvas-transitions` intermittent | 1.4 min |
     *
     * The seven are the long-standing retired-DOM failures Story 2.12 owns; nothing here changes them.
     *
     * Two of the three fixes the 2.9 review left open were done in the specs rather than here, because
     * they were real defects rather than budget: `dragDesignUntil` replaced fixed waits that were
     * calibrated in frames, and `canvas-transitions` raised **its own** timeout by what its two run
     * animations actually cost. What remains is contention, and contention is a suite-level fact — so it
     * is settled at suite level. Twenty-odd seconds is a cheap price for a release gate that gives the
     * same answer twice.
     *
     * Splitting the walk was the third option and is the wrong one: the single continuous walk *is* the
     * property that spec asserts.
     */
    workers: 5,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry'
    },
    /**
     * Two servers, because one of them is the deploy target and the other is not.
     *
     * The root-origin server is what every spec but `subpath-hosting.spec.ts` runs against. The second
     * serves a `--base=/Quantique/` build, which is how GitHub Pages actually hosts this: authored asset
     * paths are root paths by schema contract and Phaser fails a load silently, so a subpath regression
     * is invisible to a suite that only ever sees `/`. It builds into its own `dist-subpath/` so the two
     * never clobber each other's output.
     */
    webServer: [
        {
            command: 'npm run build && npm run preview',
            url: 'http://127.0.0.1:4173',
            reuseExistingServer: !process.env.CI
        },
        {
            command: 'npm run build:subpath && npm run preview:subpath',
            url: 'http://127.0.0.1:4273/Quantique/',
            reuseExistingServer: !process.env.CI
        }
    ],
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } }
    ]
});
