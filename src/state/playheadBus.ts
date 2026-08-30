/**
 * 60 fps playhead transport, deliberately OUTSIDE the Zustand store.
 *
 * Why this exists: the RAF render loop advances the playhead every frame while
 * playing. Routing that through the store means every subscriber's selector
 * runs 60x/second and any component selecting `playhead` re-renders 60x/second.
 * `Timeline` did exactly that, so a project's whole track/clip/waveform tree
 * was rebuilt every frame — cost that grows with clip count, which is why the
 * editor got slower the more you cut.
 *
 * The store still holds the authoritative `playhead` (so `getState().playhead`
 * stays exact for shortcuts, splits, marker insertion, autoEdit, ...). What
 * changed is that the *rendering* of the moving playhead no longer goes through
 * React: subscribers here get the value imperatively and poke the DOM directly.
 */
type Listener = (t: number) => void;

const listeners = new Set<Listener>();
let current = 0;

export const playheadBus = {
  get(): number {
    return current;
  },
  /** Publish a new playhead time. Safe to call every frame. */
  set(t: number): void {
    if (t === current) return;
    current = t;
    for (const l of listeners) {
      try {
        l(t);
      } catch {
        /* a bad listener must not kill the render loop */
      }
    }
  },
  /** Subscribe imperatively. Returns an unsubscribe fn. Listener is invoked
   *  immediately with the current value so callers can paint their initial
   *  state without duplicating the formula. */
  subscribe(l: Listener): () => void {
    listeners.add(l);
    l(current);
    return () => {
      listeners.delete(l);
    };
  },
};
