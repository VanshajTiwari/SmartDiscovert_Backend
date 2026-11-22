let redisClient = null;

const initRedis = () => {
  if (process.env.REDIS_ENABLED === 'true') {
    try {
      const Redis = require('ioredis');

      // Check connection string from REDIS_URL or URL
      let connectionUrl = process.env.REDIS_URL || process.env.URL;

      // Upstash Redis requires TLS (rediss://) on port 6379
      if (connectionUrl && connectionUrl.startsWith('redis://') && connectionUrl.includes('upstash.io')) {
        connectionUrl = connectionUrl.replace(/^redis:\/\//, 'rediss://');
      }

      let redisOptions = {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 10000,
        retryStrategy(times) {
          if (times > 3) return null; // stop retrying after 3 failed attempts
          return Math.min(times * 500, 2000);
        }
      };

      if (connectionUrl) {
        // If TLS protocol is detected or connecting to Upstash, configure TLS options
        const isTLS = connectionUrl.startsWith('rediss://') || connectionUrl.includes('upstash.io');
        if (isTLS) {
          redisOptions.tls = {
            rejectUnauthorized: false
          };
        }
        redisClient = new Redis(connectionUrl, redisOptions);
      } else {
        const isUpstashHost = (process.env.REDIS_HOST || '').includes('upstash.io');
        const redisConfig = {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          ...redisOptions
        };

        if (process.env.REDIS_PASSWORD) {
          redisConfig.password = process.env.REDIS_PASSWORD;
        }

        if (isUpstashHost) {
          redisConfig.tls = { rejectUnauthorized: false };
        }

        redisClient = new Redis(redisConfig);
      }

      redisClient.connect().then(() => {
        console.log('[Redis] Connected successfully to Upstash / Redis instance.');
      }).catch((err) => {
        console.warn(`[Redis] Connection failed: ${err.message}. Falling back to in-memory mode.`);
        redisClient = null;
      });

      redisClient.on('error', (err) => {
        console.warn(`[Redis] Runtime warning: ${err.message}`);
      });
    } catch (err) {
      console.warn(`[Redis] Module error: ${err.message}. Running in direct DB mode.`);
      redisClient = null;
    }
  } else {
    console.log('[Redis] Disabled via REDIS_ENABLED=false. Running in direct DB mode.');
  }
};

const getRedisClient = () => redisClient;

/**
 * Cache helper functions with graceful fallback if Redis is unavailable
 */
const setCache = async (key, value, expireSeconds = 300) => {
  if (!redisClient) return false;
  try {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await redisClient.set(key, stringVal, 'EX', expireSeconds);
    return true;
  } catch (err) {
    console.warn(`[Redis] setCache failed for key ${key}: ${err.message}`);
    return false;
  }
};

const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (err) {
    console.warn(`[Redis] getCache failed for key ${key}: ${err.message}`);
    return null;
  }
};

const delCache = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.warn(`[Redis] delCache failed for key ${key}: ${err.message}`);
    return false;
  }
};

module.exports = {
  initRedis,
  getRedisClient,
  setCache,
  getCache,
  delCache
};
