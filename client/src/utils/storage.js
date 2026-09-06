/**
 * storage.js
 * Utility to handle localStorage and sessionStorage transparently
 */

const STORAGE_KEY_PERSIST = 'auth_persist';

export const storage = {
    /**
     * Get the current storage type based on persist flag
     */
    getStorage() {
        const persist = localStorage.getItem(STORAGE_KEY_PERSIST) === 'true';
        return persist ? localStorage : sessionStorage;
    },

    /**
     * Save item to the appropriate storage
     */
    setItem(key, value, persist = null) {
        if (persist !== null) {
            localStorage.setItem(STORAGE_KEY_PERSIST, persist ? 'true' : 'false');
        }

        // Remove from both first to avoid duplicates/confusion
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);

        this.getStorage().setItem(key, value);
    },

    /**
     * Get item from storage (checks both)
     */
    getItem(key) {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
    },

    /**
     * Remove item from all storages
     */
    removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },

    /**
     * Clear all auth related storage
     */
    clear() {
        localStorage.removeItem(STORAGE_KEY_PERSIST);
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('cas_sso_token');
        localStorage.removeItem('cas_jwt_token');
        localStorage.removeItem('cas_user_info');
        sessionStorage.clear();
    },

    /**
     * Check if user is logged in
     */
    isAuthenticated() {
        return !!this.getItem('token');
    }
};

export async function logoutFromCas(token) {
    const t = token || storage.getItem('token') || storage.getItem('cas_sso_token');
    if (t) {
        try {
            const casApiUrl = import.meta.env.VITE_CAS_API_URL || 'https://centerlizedlogin.sewedy.com.eg';
            await fetch(`${casApiUrl}/api/Auth/logout?revokeSso=true`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${t}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (e) {
            console.warn('[CAS] Logout request failed:', e);
        }
    }
}

export default storage;
