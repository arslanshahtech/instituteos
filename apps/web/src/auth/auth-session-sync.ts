export const AUTH_SESSION_CHANNEL_NAME = 'instituteos-auth-session';
const STORAGE_EVENT_KEY = 'instituteos-auth-session-changed';

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (
    typeof window === 'undefined' ||
    typeof BroadcastChannel === 'undefined'
  ) {
    channel = null;
    return channel;
  }
  try {
    channel = new BroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

/** Notify sibling tabs after the browser's shared authentication cookie changes. */
export function notifyAuthSessionChanged(): void {
  const currentChannel = getChannel();
  if (currentChannel) {
    currentChannel.postMessage({ type: 'session-changed' });
    return;
  }

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_EVENT_KEY,
      `${Date.now()}-${Math.random()}`,
    );
    window.localStorage.removeItem(STORAGE_EVENT_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

/** Subscribe to authentication changes initiated in another browser tab. */
export function subscribeToAuthSessionChanges(
  onSessionChanged: () => void,
): () => void {
  const currentChannel = getChannel();
  if (currentChannel) {
    const handleMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'session-changed') onSessionChanged();
    };
    currentChannel.addEventListener('message', handleMessage);
    return () => currentChannel.removeEventListener('message', handleMessage);
  }

  if (typeof window === 'undefined') return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_EVENT_KEY && event.newValue) {
      onSessionChanged();
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
