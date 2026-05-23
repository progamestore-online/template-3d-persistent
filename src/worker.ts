import { DurableObject } from 'cloudflare:workers';

const ID_RE = /^[a-z0-9]{6,12}$/;

function randomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

interface Peer {
  ws: WebSocket;
  id: string;
}

// WorldDO persists state in SQLite between sessions.
// When all players disconnect, the world keeps its state.
// When players reconnect, they get the latest world state.
export class WorldDO extends DurableObject {
  peers: Peer[] = [];
  nextPeerId = 1;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    // Initialize SQLite table for world state persistence
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS world_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  // Read persisted world state
  getWorldState(): Record<string, unknown> {
    const rows = this.ctx.storage.sql.exec('SELECT key, value FROM world_state').toArray();
    const state: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        state[row.key as string] = JSON.parse(row.value as string);
      } catch {
        state[row.key as string] = row.value;
      }
    }
    return state;
  }

  // Persist a key-value pair to SQLite
  persistState(key: string, value: unknown): void {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO world_state (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))',
      key,
      JSON.stringify(value),
    );
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = pair;
    server.accept();

    const peerId = `p${this.nextPeerId++}`;
    this.peers.push({ ws: server, id: peerId });

    // Send current world state + peer list to the new connection
    this.send(server, {
      type: 'welcome',
      peerId,
      peers: this.peers.map((p) => p.id),
      worldState: this.getWorldState(),
    });

    this.broadcast({ type: 'peer_joined', peerId }, server);

    server.addEventListener('message', (e) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }

      // Persist state updates to SQLite so they survive disconnects
      if (msg.type === 'world_update' && typeof msg.key === 'string') {
        this.persistState(msg.key, msg.value);
      }

      this.broadcast({ ...msg, from: peerId }, server);
    });

    server.addEventListener('close', () => this.removePeer(server));
    server.addEventListener('error', () => this.removePeer(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  removePeer(ws: WebSocket): void {
    const peer = this.peers.find((p) => p.ws === ws);
    this.peers = this.peers.filter((p) => p.ws !== ws);
    if (peer) {
      this.broadcast({ type: 'peer_left', peerId: peer.id });
    }
  }

  send(ws: WebSocket, msg: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch { /* closed */ }
  }

  broadcast(msg: Record<string, unknown>, except?: WebSocket): void {
    for (const p of this.peers) {
      if (p.ws !== except) this.send(p.ws, msg);
    }
  }
}

interface Env {
  WORLD: DurableObjectNamespace;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Single persistent world -- all players share one WorldDO instance
    if (url.pathname === '/api/rooms/new') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return Response.json({ roomId: 'world' });
    }

    const wsMatch = url.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/ws$/);
    if (wsMatch) {
      const id = wsMatch[1];
      if (!ID_RE.test(id)) return new Response('Invalid room id', { status: 400 });
      const doId = env.WORLD.idFromName(id);
      const obj = env.WORLD.get(doId);
      return obj.fetch(req);
    }

    if (url.pathname.startsWith('/g/')) {
      url.pathname = '/';
      return env.ASSETS.fetch(new Request(url.toString(), req));
    }

    return env.ASSETS.fetch(req);
  },
};
