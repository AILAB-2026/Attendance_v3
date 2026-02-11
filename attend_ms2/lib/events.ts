// Simple event bus for cross-screen notifications (React Native friendly)
// Usage:
//   import { events } from '@/lib/events';
//   const off = events.on('schedule:tasks-updated', () => { ... });
//   events.emit('schedule:tasks-updated');
//   off();

type Handler = (...args: any[]) => void;

class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler) {
    const set = this.map.get(event) || new Set<Handler>();
    set.add(handler);
    this.map.set(event, set);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    const set = this.map.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.map.delete(event);
  }

  emit(event: string, ...args: any[]) {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(...args); } catch {}
    }
  }
}

export const events = new EventBus();
