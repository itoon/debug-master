import { getCurrentInstance, onBeforeUnmount, ref } from "vue";
import type { Ref } from "vue";
import { clockOffset } from "../utils/live/clock";
import type { ClientMessage, PlayerStatus, Role, RoomState } from "../utils/live/protocol";
import { liveWsUrl, openLiveSocket } from "../utils/live/socket";

export function useLiveConfig(): { liveUrl: string; enabled: boolean } {
  const liveUrl = String(useRuntimeConfig().public.liveUrl ?? "").trim();
  return { liveUrl, enabled: liveUrl !== "" };
}

export interface LiveRoom {
  state: Ref<RoomState | null>;
  offset: Ref<number>;
  connected: Ref<boolean>;
  isHost: Ref<boolean | null>;
  you: Ref<{ pid: string; status: PlayerStatus } | null>;
  notice: Ref<"full" | "kicked" | null>;
  error: Ref<"not_host" | "bad_message" | null>;
  send(msg: ClientMessage, coalesceKey?: string): void;
  close(): void;
}

/** Connects to a live room; with no live URL configured (or on the server) it returns an inert room. */
export function useLiveRoom(opts: { code: string; role: Role; key?: string; hello: () => ClientMessage }): LiveRoom {
  const state = ref<RoomState | null>(null);
  const offset = ref(0);
  const connected = ref(false);
  const isHost = ref<boolean | null>(null);
  const you = ref<{ pid: string; status: PlayerStatus } | null>(null);
  const notice = ref<"full" | "kicked" | null>(null);
  const error = ref<"not_host" | "bad_message" | null>(null);

  const { liveUrl, enabled } = useLiveConfig();
  const socket =
    enabled && !import.meta.server
      ? openLiveSocket(liveWsUrl(liveUrl, opts.code, opts.role, opts.key), opts.hello, {
          onConnection(up) {
            connected.value = up;
          },
          onMessage(m, receivedAt) {
            switch (m.type) {
              case "state":
                state.value = m.state;
                offset.value = clockOffset(m.state.serverNow, receivedAt);
                break;
              case "you":
                you.value = { pid: m.pid, status: m.status };
                break;
              case "host":
                isHost.value = m.host === true;
                break;
              case "full":
                notice.value = "full";
                break;
              case "kicked":
                notice.value = "kicked";
                break;
              case "error":
                error.value = m.error;
                break;
            }
          },
        })
      : null;

  function close(): void {
    socket?.close();
    connected.value = false;
  }

  // Only inside a component setup: the host page opens its room after a form submit (no instance) and closes it itself.
  if (getCurrentInstance()) onBeforeUnmount(close);

  return {
    state,
    offset,
    connected,
    isHost,
    you,
    notice,
    error,
    send: (msg, coalesceKey) => socket?.send(msg, coalesceKey),
    close,
  };
}
