const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 3000;

// ── Environment Guard ────────────────────────────────────────────────────────
if (!process.env.MONGO_URI) {
  console.error('[DATABASE] FATAL: MONGO_URI environment variable is not set.');
  console.error('[DATABASE] Set MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>');
  process.exit(1);
}

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS : 10000,   // 10 s to find a primary
  socketTimeoutMS          : 45000,   // 45 s socket idle timeout
  maxPoolSize              : 10,      // connection pool
  retryWrites              : true,
  w                        : 'majority'
};

// ── Connect with Retry ───────────────────────────────────────────────────────
const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    logger.info(`[DATABASE] Connected to MongoDB Atlas — host: ${conn.connection.host}`);
    logger.info(`[DATABASE] Database name: ${conn.connection.name}`);

    // ── Ensure critical indexes exist ────────────────────────────────────────
    mongoose.connection.once('open', async () => {
      try {
        const db = mongoose.connection.db;

        // attackevents indexes
        await db.collection('attackevents').createIndex({ ip: 1 });
        await db.collection('attackevents').createIndex({ timestamp: -1 });
        await db.collection('attackevents').createIndex({ severity: 1 });
        await db.collection('attackevents').createIndex({ attackType: 1 });
        await db.collection('attackevents').createIndex({ status: 1 });
        await db.collection('attackevents').createIndex({ severity: 1, timestamp: -1 });
        await db.collection('attackevents').createIndex({ ip: 1, timestamp: -1 });

        // systemlogs indexes
        await db.collection('systemlogs').createIndex({ ip: 1 });
        await db.collection('systemlogs').createIndex({ timestamp: -1 });

        // audit_log indexes
        await db.collection('audit_log').createIndex({ status: 1 });
        await db.collection('audit_log').createIndex({ ip: 1 });
        await db.collection('audit_log').createIndex({ createdAt: -1 });

        // action_queue indexes
        await db.collection('action_queue').createIndex({ attackId: 1 });
        await db.collection('action_queue').createIndex({ status: 1 });

        // alerts indexes
        await db.collection('alerts').createIndex({ severity: 1 });
        await db.collection('alerts').createIndex({ createdAt: -1 });

        logger.info('[DATABASE] All indexes verified / created successfully.');
      } catch (idxErr) {
        logger.warn(`[DATABASE] Index creation warning: ${idxErr.message}`);
      }
    });
  } catch (error) {
    logger.error(`[DATABASE] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
    if (attempt < MAX_RETRIES) {
      logger.info(`[DATABASE] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }
    logger.error('[DATABASE] All retry attempts exhausted. Exiting.');
    process.exit(1);
  }
};

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('[DATABASE] MongoDB Atlas connection closed gracefully.');
  } catch (err) {
    logger.error(`[DATABASE] Error during disconnect: ${err.message}`);
  }
};

process.on('SIGINT',  async () => { await disconnectDB(); process.exit(0); });
process.on('SIGTERM', async () => { await disconnectDB(); process.exit(0); });

module.exports = { connectDB, disconnectDB };
