import { getCurrentInstance, onBeforeUnmount, ref } from "vue";
import type { Ref } from "vue";
import type { CompetitionSession } from '../types/competition';
import { createLiveReplay, createLiveRoundInbox, type GameplayInput, type LiveSyncStatus } from '../utils/live/session';
import type { ScoringMsg } from '../utils/live/protocol';
import { clockOffset } from "../utils/live/clock";
import type { ClientMessage, PlayerStatus, Role, RoomState } from "../utils/live/protocol";
import { liveWsUrl, openLiveSocket } from "../utils/live/socket";

export function useLiveConfig(): { liveUrl: string; enabled: boolean } {
  const liveUrl = String(useRuntimeConfig().public.liveUrl ?? "").trim();
  return { liveUrl, enabled: liveUrl !== "" };
}

export interface LiveRoom {
  state: Ref<RoomState | null>;
  scoring: Ref<ScoringMsg | null>;
  session: Ref<CompetitionSession | null>;
  syncStatus: Ref<LiveSyncStatus>;
  sendGameplay(event: GameplayInput): boolean;
  offset: Ref<number>;
  connected: Ref<boolean>;
  isHost: Ref<boolean | null>;
  /** This device's public player id (LivePlayer.id) and seat status, from the last `you`. */
  you: Ref<{ id: string; status: PlayerStatus } | null>;
  notice: Ref<"full" | "kicked" | null>;
  error: Ref<"not_host" | "bad_message" | null>;
  send(msg: ClientMessage, coalesceKey?: string): void;
  close(): void;
}

/** Connects to a live room; with no live URL configured (or on the server) it returns an inert room. */
export function useLiveRoom(opts: { code: string; role: Role; key?: string; hello: () => ClientMessage | null }): LiveRoom {
  const state = ref<RoomState | null>(null);
  const offset = ref(0);
  const connected = ref(false);
  const isHost = ref<boolean | null>(null);
  const you = ref<{ id: string; status: PlayerStatus } | null>(null);
  const notice = ref<"full" | "kicked" | null>(null);
  const error = ref<"not_host" | "bad_message" | null>(null);

  const scoring = ref<ScoringMsg | null>(null);
  const session = ref<CompetitionSession | null>(null);
  const syncStatus = ref<LiveSyncStatus>('resync');
  let pendingSince = Date.now();
  let recoveryAttempts = 0;
  const replay = createLiveReplay({
    room: opts.code, playerId: () => you.value?.id ?? '',
    send: event => socket?.send(event),
    changed(canonical, message, status) {
      session.value = canonical;
      if (message) { scoring.value = message; recoveryAttempts = 0; pendingSince = Date.now(); }
      if (syncStatus.value !== status) pendingSince = Date.now();
      syncStatus.value = status;
    },
  });
  const roundInbox = createLiveRoundInbox({
    invalidate() { replay.invalidate(); scoring.value = null; },
    accept: message => replay.accept(message),
  });
  const { liveUrl, enabled } = useLiveConfig();
  const socket =
    enabled && !import.meta.server
      ? openLiveSocket(liveWsUrl(liveUrl, opts.code, opts.role, opts.key), opts.hello, {
          onConnection(up) {
            connected.value = up;
            if (up) { recoveryAttempts = 0; replay.connecting(); }
            else replay.disconnected();
          },
          onMessage(m, receivedAt) {
            switch (m.type) {
              case "state":
                state.value = m.state;
                offset.value = clockOffset(m.state.serverNow, receivedAt);
                roundInbox.publicRound(m.state.roundId);
                break;
              case "scoring":
                roundInbox.privateState(m);
                break;
              case "reload":
                replay.reloadRequired();
                break;
              case "you":
                you.value = { id: m.id, status: m.status };
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

  // Lost acknowledgements are recovered by hello/private snapshot, before any replay.
  const recoveryTimer = enabled && !import.meta.server ? setInterval(() => {
    if (connected.value && opts.role === 'player' && you.value?.status === 'playing' && state.value?.phase !== 'lobby' && ['pending', 'resync'].includes(syncStatus.value) && Date.now() - pendingSince > 5000) {
      // Bounded handshake recovery also covers a missing private snapshot after rollover.
      if (++recoveryAttempts > 3) { replay.reloadRequired(); return; }
      replay.connecting();
      pendingSince = Date.now();
      const hello = opts.hello(); if (hello) socket?.send(hello);
    }
  }, 1000) : null;
  function close(): void {
    if (recoveryTimer) clearInterval(recoveryTimer);
    socket?.close();
    connected.value = false;
  }

  // Only inside a component setup: the host page opens its room after a form submit (no instance) and closes it itself.
  if (getCurrentInstance()) onBeforeUnmount(close);

  return {
    state,
    scoring, session, syncStatus,
    sendGameplay: event => replay.enqueue(event, Date.now() + offset.value),
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
