import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_SESSION_CHANNEL_NAME,
  notifyAuthSessionChanged,
  subscribeToAuthSessionChanges,
} from './auth-session-sync.js';

class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];

  constructor(readonly name: string) {
    super();
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    for (const peer of FakeBroadcastChannel.instances) {
      if (peer !== this && peer.name === this.name) {
        peer.dispatchEvent(new MessageEvent('message', { data }));
      }
    }
  }

  close(): void {
    this.dispatchEvent(new Event('close'));
  }
}

describe('authentication session synchronization', () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies sibling tabs when the shared browser session changes', () => {
    const onSessionChanged = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSessionChanged);
    const siblingTab = new FakeBroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
    const siblingMessage = vi.fn();
    siblingTab.addEventListener('message', siblingMessage);

    siblingTab.postMessage({ type: 'session-changed' });
    expect(onSessionChanged).toHaveBeenCalledOnce();

    notifyAuthSessionChanged();
    expect(siblingMessage).toHaveBeenCalledOnce();
    expect(onSessionChanged).toHaveBeenCalledOnce();

    unsubscribe();
    siblingTab.close();
  });
});
