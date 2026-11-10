/**
 * A minimal publish/subscribe bus. Game actions publish what happened ("fish caught",
 * "cat fed"); progress tracking, sound and UI subscribe without the actions knowing about them.
 */

/**
 * @template {Record<string, any>} Events
 */
export function createEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /**
     * Subscribes to an event. Returns an unsubscribe function.
     * @param {string} name
     * @param {(payload: any) => void} handler
     */
    on(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)?.add(handler);
      return () => listeners.get(name)?.delete(handler);
    },
    /**
     * Publishes an event to every subscriber, in subscription order.
     * @param {string} name
     * @param {any} [payload]
     */
    emit(name, payload) {
      for (const handler of listeners.get(name) ?? []) handler(payload);
    },
  };
}
