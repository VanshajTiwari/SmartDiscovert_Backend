const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  // If already connected, reuse existing connection (crucial for Vercel/serverless environments)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hingebot';

  // Defensive cleanup: remove accidental duplicate slashes after protocol
  mongoURI = mongoURI.replace(/([^:])\/{2,}/g, '$1/');

  try {
    cachedConnection = await mongoose.connect(mongoURI, {
      autoIndex: false, // Avoid blocking cold starts with background index creation
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
    });

    console.log(`[MongoDB] Connected successfully to database: ${cachedConnection.connection.name}`);

    // Seed default super admin user on initial DB connection
    try {
      const { seedAdminUser } = require('../controllers/userController');
      await seedAdminUser();
    } catch (seedErr) {
      console.warn(`[MongoDB] Admin seed check: ${seedErr.message}`);
    }

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection lost. Attempting reconnect...');
      cachedConnection = null;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected successfully.');
    });

    return cachedConnection;
  } catch (error) {
    cachedConnection = null;
    console.error(`[MongoDB] Initial connection error: ${error.message}`);
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
