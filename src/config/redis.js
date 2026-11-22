let redisClient = null;
let connectionAttempted = false;

const initRedis = () => {
  if (process.env.REDIS_ENABLED === 'true' && !connectionAttempted) {
    connectionAttempted = true;
    try {
      const Redis = require('ioredis');

      // Check connection string from REDIS_URL or URL
      let connectionUrl = process.env.REDIS_URL || process.env.URL;

      // Upstash Redis requires TLS (rediss://) on port 6379
      if (connectionUrl && connectionUrl.startsWith('redis://') && connectionUrl.includes('upstash.io')) {
        connectionUrl = connectionUrl.replace(/^redis:\/\//, 'rediss://');
      }

      const isServerless = Boolean(process.env.VERCEL);

      let redisOptions = {
        lazyConnect: true,
        maxRetriesPerRequest: isServerless ? 0 : 1,
        connectTimeout: isServerless ? 2500 : 5000,
        enableOfflineQueue: false,
        retryStrategy: () => null // Prevent infinite reconnection loops in serverless lambdas
      };

      if (connectionUrl) {
        const isTLS = connectionUrl.startsWith('rediss://') || connectionUrl.includes('upstash.io');
        if (isTLS) {
          redisOptions.tls = { rejectUnauthorized: false };
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
        // In serverless, gracefully drop to in-memory mode without blocking
        redisClient = null;
      });

      redisClient.on('error', () => {
        redisClient = null;
      });
    } catch (err) {
      redisClient = null;
    }
  }
};

const getRedisClient = () => redisClient;

const setCache = async (key, value, expireSeconds = 300) => {
  if (!redisClient) return false;
  try {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await redisClient.set(key, stringVal, 'EX', expireSeconds);
    return true;
  } catch {
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
  } catch {
    return null;
  }
};

const delCache = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch {
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
