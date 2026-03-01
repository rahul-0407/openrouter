<<<<<<< HEAD
type CacheEntry<T> = {
    value: T;
    expiry: number | null;
};

export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheEntry<any>> = new Map();

    private constructor() {
        // Periodic cleanup
        setInterval(() => this.cleanup(), 60000);
    }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    /**
     * Get a value from the cache.
     * @param key The key to retrieve.
     * @returns The value, or null if not found or expired.
     */
    public get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (entry.expiry !== null && entry.expiry < Date.now()) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Set a value in the cache.
     * @param key The key to set.
     * @param value The value to set.
     * @param ttl Seconds until expiration.
     */
    public set<T>(key: string, value: T, ttl?: number): void {
        const expiry = ttl ? Date.now() + ttl * 1000 : null;
        this.cache.set(key, { value, expiry });
    }

    /**
     * Delete a value from the cache.
     * @param key The key to delete.
     */
    public del(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all expired entries.
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiry !== null && entry.expiry < now) {
                this.cache.delete(key);
            }
        }
    }
}

export const cache = CacheService.getInstance();
=======
console.log("Hello via Bun!");
>>>>>>> edbf48f (fixing bugs and reapply some features)
