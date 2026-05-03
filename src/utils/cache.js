import Redis from "ioredis";

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.lists = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
    this.cleanupInterval.unref();
  }

  async get(key) {
    const entry = this.store.get(key);

    if (!entry || (entry.expiresAt && entry.expiresAt <= Date.now())) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null
    });
  }

  async delete(key) {
    this.store.delete(key);
    this.lists.delete(key);
  }

  async increment(key, ttlMs) {
    const current = Number((await this.get(key)) ?? 0) + 1;
    await this.set(key, String(current), ttlMs);
    return current;
  }

  async pushTimestamp(key, timestamp, windowMs) {
    const items = this.lists.get(key) ?? [];
    const filtered = items.filter((value) => value > timestamp - windowMs);
    filtered.push(timestamp);
    this.lists.set(key, filtered);
    return filtered.length;
  }

  cleanup() {
    const now = Date.now();

    for (const [key, value] of this.store.entries()) {
      if (value.expiresAt && value.expiresAt <= now) {
        this.store.delete(key);
      }
    }

    for (const [key, list] of this.lists.entries()) {
      const filtered = list.filter((value) => value > now - 60_000);

      if (filtered.length === 0) {
        this.lists.delete(key);
      } else {
        this.lists.set(key, filtered);
      }
    }
  }

  async disconnect() {
    clearInterval(this.cleanupInterval);
  }
}

class RedisCache {
  constructor(redis, keyPrefix) {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  formatKey(key) {
    return `${this.keyPrefix}:${key}`;
  }

  async get(key) {
    return this.redis.get(this.formatKey(key));
  }

  async set(key, value, ttlMs) {
    const formatted = this.formatKey(key);

    if (ttlMs) {
      await this.redis.psetex(formatted, ttlMs, value);
      return;
    }

    await this.redis.set(formatted, value);
  }

  async delete(key) {
    await this.redis.del(this.formatKey(key));
  }

  async increment(key, ttlMs) {
    const formatted = this.formatKey(key);
    const multi = this.redis.multi();
    multi.incr(formatted);

    if (ttlMs) {
      multi.pexpire(formatted, ttlMs);
    }

    const result = await multi.exec();
    return Number(result?.[0]?.[1] ?? 1);
  }

  async pushTimestamp(key, timestamp, windowMs) {
    const formatted = this.formatKey(key);
    const min = timestamp - windowMs;
    const multi = this.redis.multi();
    multi.zremrangebyscore(formatted, 0, min);
    multi.zadd(formatted, timestamp, `${timestamp}-${Math.random().toString(16).slice(2)}`);
    multi.zcard(formatted);
    multi.pexpire(formatted, windowMs);
    const result = await multi.exec();
    return Number(result?.[2]?.[1] ?? 0);
  }

  async disconnect() {
    await this.redis.quit();
  }
}

export async function createCache({ redisUrl, keyPrefix }) {
  if (!redisUrl) {
    return new MemoryCache();
  }

  try {
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    await redis.connect();
    return new RedisCache(redis, keyPrefix);
  } catch (error) {
    console.warn("[cache] falling back to memory cache:", error.message);
    return new MemoryCache();
  }
}
