/**
 * The attention box LIVE — `GET /api/v1/stream/attention`.
 *
 * **Why a reader built on `fetch` and not the native `EventSource`.** The first
 * version used the native one, for the free resume: the browser keeps the last
 * `id:` and resends it as `Last-Event-ID`. But `EventSource` **cannot send a
 * header**, and the BFF requires `Authorization: Bearer` and `x-account-id` —
 * the connection came back 401, always.
 *
 * There were three ways out. A session cookie and a short-lived ticket both
 * solve it, and both create a SECOND authentication path for the same
 * credential. A signed ticket would still require a signing key in the BFF,
 * which is precisely what ADR-0016 forbids: **the BFF holds no secret**.
 *
 * So: a single path. The reader sends the same headers as every call, and the
 * resume — which was the reason to use the native one — becomes ~40 lines here,
 * with the cursor coming from the `id:` the server emits.
 *
 * **The cursor now exists.** The core's `AttentionUpdate` carries `event_id`,
 * the POSITION in the log; the BFF emits it as `id:` and we return it in
 * `?since_event_id=`. The old rule still holds: only a cursor the server sent is
 * kept — an invented cursor asks the core for a position that does not exist.
 *
 * What arrives here is NOT applied over the local list. The notice triggers a
 * reread of `GET /api/v1/attention`, and the order is still the one the core
 * sent. Stitching `opened`/`resolved` into the screen's list would be a second
 * ruler of priority — exactly what the box exists not to have.
 */
import React from 'react';

import { API_BASE_URL } from '../lib/platform/config';
import { currentIdToken } from '../lib/platform/firebase';

export type StreamState = 'connecting' | 'live' | 'unavailable';

/** What the BFF emits in `event: attention` — a CHANGE, not the whole box. */
export type AttentionUpdateEvent = {
  change?: string;
  item?: { id?: string; demand_id?: string; kind?: string };
};

/** An SSE frame already split into its name, id and data. */
type Frame = { event: string; id: string; data: string };

/**
 * It splits the buffer into complete frames, returning the remainder.
 *
 * SSE separates frames by a blank line, and one `read()` may deliver half a
 * frame: processing what arrived without waiting for the terminator would
 * produce JSON cut off on every read — and the error would show up as "an
 * unreadable frame", which sends you looking in the wrong place.
 */
function splitFrames(buffer: string): { frames: Frame[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const frames: Frame[] = [];

  for (const raw of parts) {
    let event = 'message';
    let id = '';
    const data: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith(':')) continue; // a comment; the heartbeat looks like this
      const sep = line.indexOf(':');
      const field = sep === -1 ? line : line.slice(0, sep);
      const value = sep === -1 ? '' : line.slice(sep + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'id') id = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0) frames.push({ event, id, data: data.join('\n') });
  }
  return { frames, rest };
}

export function useAttentionStream(
  onUpdate: (update: AttentionUpdateEvent) => void,
  activeAccount: string,
): StreamState {
  const [state, setState] = React.useState<StreamState>('connecting');
  const cursor = React.useRef<string>('');

  // The ref stops the connection from being reopened on every render just
  // because the callback is a new function — reconnecting for free would lose
  // events in the interval.
  const callback = React.useRef(onUpdate);
  React.useEffect(() => {
    callback.current = onUpdate;
  }, [onUpdate]);

  React.useEffect(() => {
    // Cursors belong to one account's event log. A Boolean(activeAccount)
    // dependency would keep replaying the previous account's cursor.
    cursor.current = '';
    if (!activeAccount) {
      setState('unavailable');
      return;
    }

    const accountId = activeAccount;
    const controller = new AbortController();
    let alive = true;
    // A growing backoff: against a 401 or a core that is down, trying every
    // second is a storm with no chance of success.
    let waitMs = 1000;

    async function connect(): Promise<void> {
      while (alive) {
        setState('connecting');
        try {
          const url = new URL('/api/v1/stream/attention', API_BASE_URL);
          if (cursor.current) {
            url.searchParams.set('since_event_id', cursor.current);
          }

          const token = await currentIdToken();
          if (!alive) return;
          const response = await fetch(url.toString(), {
            method: 'GET',
            signal: controller.signal,
            headers: {
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'x-account-id': accountId,
            },
          });

          if (!response.ok || !response.body) {
            // A 401/403 does not improve with fast insistence; let the backoff
            // act.
            setState('unavailable');
            throw new Error(`the stream was refused: ${response.status}`);
          }

          setState('live');
          waitMs = 1000; // it connected: reset the backoff

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (alive) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const { frames, rest } = splitFrames(buffer);
            buffer = rest;

            for (const frame of frames) {
              if (!alive) break;
              // Only a cursor the SERVER sent is kept.
              if (frame.id) cursor.current = frame.id;

              if (frame.event === 'error') {
                try {
                  const body = JSON.parse(frame.data) as {
                    retryable?: boolean;
                    since_event_id?: string;
                  };
                  if (body.since_event_id) cursor.current = body.since_event_id;
                  if (body.retryable === false) {
                    alive = false;
                    setState('unavailable');
                  }
                } catch {
                  /* an unreadable error frame does not make things worse */
                }
                continue;
              }

              if (frame.event !== 'attention') continue;
              try {
                callback.current(JSON.parse(frame.data) as AttentionUpdateEvent);
              } catch {
                // An unreadable frame does not bring the stream down: the next
                // notice fixes the screen, and the box is reread from the
                // endpoint anyway.
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          // A network drop is normal in a long stream; the backoff avoids
          // hammering.
        }

        if (!alive) return;
        await new Promise((r) => setTimeout(r, waitMs));
        waitMs = Math.min(waitMs * 2, 30000);
      }
    }

    void connect();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [activeAccount]);

  return state;
}
