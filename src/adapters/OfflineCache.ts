const registerOfflineCache = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    try {
        await navigator.serviceWorker.register('./sw.js');
    } catch {
        // Offline enhancement must never prevent the semantic boot shell from loading.
    }
};

export { registerOfflineCache };
