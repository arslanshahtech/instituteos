import mongoose from 'mongoose';

export async function connectDatabase(
  uri: string,
  serverSelectionTimeoutMs: number,
): Promise<void> {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: serverSelectionTimeoutMs,
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return states[mongoose.connection.readyState] ?? 'unknown';
}
