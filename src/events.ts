import { EventEmitter } from "node:events";

export type AppEvent =
  | { type: "person"; id: number; status: string; progress?: unknown; name?: string }
  | { type: "date_started"; dateId: number; aId: number; bId: number }
  | { type: "turn"; dateId: number; idx: number; speakerId: number; text: string }
  | { type: "date_finished"; dateId: number; matchScore: number | null; mutual: boolean; failed?: boolean };

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export const publish = (e: AppEvent) => emitter.emit("event", e);
export const subscribe = (fn: (e: AppEvent) => void) => {
  emitter.on("event", fn);
  return () => emitter.off("event", fn);
};
