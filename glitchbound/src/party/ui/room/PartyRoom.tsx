import { useEffect, useState } from 'react';
import { createRoom, roomInfo, type RoomGame } from '../../../platform/rooms';
import { navigate } from '../../../router/router';
import { ImpostorRoomPage } from '../ImpostorRoom';
import { ModeBar } from '../shared';
import { AuctionRoomPage } from './AuctionRoom';
import { BoardRoomPage } from './BoardRoom';
import { NhieRoomPage } from './NhieRoom';
import { RpsRoomPage } from './RpsRoom';

/** /party?room=CODE: finds out which game the room plays and opens it. */
export function PartyRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [game, setGame] = useState<RoomGame | 'missing' | null>(null);
  useEffect(() => {
    let live = true;
    void roomInfo(code).then((r) => live && setGame(r ? (r.game ?? 'crass-act') : 'missing'));
    return () => {
      live = false;
    };
  }, [code]);
  useEffect(() => {
    if (game === 'crass-act') navigate(`/games/crass-act?room=${code}`);
  }, [game, code]);
  if (game === null || game === 'crass-act')
    return (
      <div className="pt-screen">
        <ModeBar title={`Room ${code}`} onExit={onLeave} />
        <p className="pt-muted pt-center">Finding the room…</p>
      </div>
    );
  if (game === 'nhie') return <NhieRoomPage code={code} onLeave={onLeave} />;
  if (game === 'auction') return <AuctionRoomPage code={code} onLeave={onLeave} />;
  if (game === 'board') return <BoardRoomPage code={code} onLeave={onLeave} />;
  if (game === 'rps') return <RpsRoomPage code={code} onLeave={onLeave} />;
  // Impostor, and closed rooms (its page explains that the room has closed).
  return <ImpostorRoomPage code={code} onLeave={onLeave} />;
}

/** Opens a new room for a Party Mode game and goes into it. */
export async function openPartyRoom(game: RoomGame): Promise<void> {
  const code = await createRoom(game);
  navigate(`/party?room=${code}`);
}
