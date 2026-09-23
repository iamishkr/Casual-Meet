import dns from 'dns';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

export async function connectDB(): Promise<string> {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim()) {
    try {
      console.log(`[MongoDB] Connecting to external MongoDB at ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}...`);
      if (uri.startsWith('mongodb+srv://')) {
        try {
          dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch {
          // ignore if environment restricts custom DNS
        }
      }
      await mongoose.connect(uri);
      console.log('[MongoDB] Connected successfully to external MongoDB database.');
      return uri;
    } catch (err: any) {
      console.warn('[MongoDB] Failed to connect to external MongoDB URI:', err?.message || err);
      console.warn('[MongoDB] Falling back to embedded in-process database...');
    }
  }

  // Fallback: in-process MongoMemoryServer
  try {
    console.log('[MongoDB] Initializing in-process MongoDB engine (zero-config local database)...');
    mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    await mongoose.connect(memUri);
    console.log(`[MongoDB] Connected to in-process MongoDB at ${memUri}`);
    return memUri;
  } catch (err) {
    console.error('[MongoDB] Critical error initializing MongoDB engine:', err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}
