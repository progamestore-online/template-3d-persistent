import { useEffect, useRef, useState } from 'react';
import { GameShell, GameTopbar, GameAuth, GameButton, useRooms } from '@progamestore/games';

type ServerMsg =
  | { type: 'welcome'; peerId: string; peers: string[]; worldState: Record<string, unknown> }
  | { type: 'peer_joined'; peerId: string }
  | { type: 'peer_left'; peerId: string }
  | { type: 'world_update'; from: string; key: string; value: unknown }
  | { type: 'update'; from: string; [key: string]: unknown };

type ClientMsg =
  | { type: 'world_update'; key: string; value: unknown }
  | { type: 'update'; [key: string]: unknown };

export default function App() {
  const [peerId, setPeerId] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistent world: auto-connect to "world" room on mount
  const room = useRooms<ServerMsg, ClientMsg>({
    gameId: 'APPNAME',
    roomId: 'world',
    onMessage(msg) {
      if (msg.type === 'welcome') {
        setPeerId(msg.peerId);
        setPeers(msg.peers);
        // TODO: Load msg.worldState into your 3D scene
      }
      if (msg.type === 'peer_joined') setPeers((p) => [...p, msg.peerId]);
      if (msg.type === 'peer_left') setPeers((p) => p.filter((id) => id !== msg.peerId));
      if (msg.type === 'world_update') {
        // TODO: Apply world state update to your 3D scene
        // msg.key, msg.value, msg.from
      }
      if (msg.type === 'update') {
        // TODO: Handle real-time peer updates (position, animation)
      }
    },
  });

  useEffect(() => {
    // TODO: Initialize Babylon.js scene on canvasRef.current
    // import('@babylonjs/core').then(BABYLON => {
    //   const engine = new BABYLON.Engine(canvasRef.current!, true);
    //   const scene = new BABYLON.Scene(engine);
    //   // ... set up camera, lights, ground, etc.
    //   engine.runRenderLoop(() => scene.render());
    // });
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="APPNAME" stats={[{ label: 'Players', value: peers.length }]} />}>
      <GameAuth />
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', background: '#111' }}
        />
        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', fontSize: '0.7rem', color: '#888', background: '#000a', padding: '0.3rem 0.6rem', borderRadius: '0.3rem' }}>
          {room.status === 'connected' ? (
            <>You: {peerId} | Players: {peers.length}</>
          ) : (
            <>Connecting...</>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Add Babylon.js: <code style={{ background: '#222', padding: '0.2rem 0.4rem', borderRadius: '0.25rem' }}>pnpm add @babylonjs/core</code>
          </p>
          <GameButton variant="primary" onClick={() => room.send({ type: 'world_update', key: 'test', value: Date.now() })}>
            Persist State (placeholder)
          </GameButton>
        </div>
      </div>
    </GameShell>
  );
}
