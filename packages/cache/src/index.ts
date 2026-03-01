import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';

type CacheOptions = {
    ttl?: number; // in seconds
};

class CacheService {
    private lru: LRUCache<string, any>;
    private redis: Redis | null = null;
    private useRedis: boolean = false;

    constructor() {
        // Fallback In-memory cache
        this.lru = new LRUCache({
            max: 500,
            // Default TTL for LRU if not specified, though we'll use TTL per set
        });

        // Try connecting to Redis
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                lazyConnect: true,
            });

            this.redis.on('error', (err) => {
                console.warn('[Cache] Redis error, falling back to LRU:', err.message);
                this.useRedis = false;
            });

            this.redis.on('connect', () => {
                console.log('[Cache] Connected to Redis');
                this.useRedis = true;
            });

            this.redis.connect().catch(() => {
                this.useRedis = false;
            });
        } catch (e) {
            console.warn('[Cache] Could not initialize Redis client, using LRU.');
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (this.useRedis && this.redis) {
            try {
                const val = await this.redis.get(key);
                return val ? JSON.parse(val) : null;
            } catch (e) {
                console.error('[Cache] Redis get error:', e);
            }
        }
        return (this.lru.get(key) as T) || null;
    }

    async set(key: string, value: any, ttlSeconds: number): Promise<void> {
        // Always set in LRU as a fast local cache / backup
        this.lru.set(key, value, { ttl: ttlSeconds * 1000 });

        if (this.useRedis && this.redis) {
            try {
                await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
            } catch (e) {
                console.error('[Cache] Redis set error:', e);
            }
        }
    }

    async del(key: string): Promise<void> {
        this.lru.delete(key);
        if (this.useRedis && this.redis) {
            try {
                await this.redis.del(key);
            } catch (e) {
                console.error('[Cache] Redis del error:', e);
            }
        }
    }
}

export const cache = new CacheService();
