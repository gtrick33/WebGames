import { useEffect, useState } from 'react';
import { createRoom, GAME_ROOM_PAGE, roomInfo, type RoomGame } from '../../../platform/rooms';
import { navigate } from '../../../router/router';
import { ImpostorRoomPage } from '../ImpostorRoom';
import { ModeBar } from '../shared';
import { AuctionRoomPage } from './AuctionRoom';
import { BoardRoomPage } from './BoardRoom';
import { DialRoomPage } from './DialRoom';
import { HuesRoomPage } from './HuesRoom';
import { NhieRoomPage } from './NhieRoom';
import { RpsRoomPage } from './RpsRoom';
import { ScribbleRoomPage } from './ScribbleRoom';
import { UniqueRoomPage } from './UniqueRoom';
import { t, useT } from '../../../i18n';

/** /party?room=CODE: finds out which game the room plays and opens it. */
export function PartyRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  // Re-render the party screens when the language changes (they use the plain t()).
  useT();
  const [game, setGame] = useState<RoomGame | 'missing' | null>(null);
  useEffect(() => {
    let live = true;
    void roomInfo(code).then((r) => live && setGame(r ? (r.game ?? 'crass-act') : 'missing'));
    return () => {
      live = false;
    };
  }, [code]);
  const page = game && game !== 'missing' ? GAME_ROOM_PAGE[game] : undefined;
  useEffect(() => {
    if (page) navigate(`${page}?room=${code}`);
  }, [page, code]);
  if (game === null || page)
    return (
      <div className="pt-screen">
        <ModeBar title={`Room ${code}`} onExit={onLeave} />
        <p className="pt-muted pt-center">{t('Finding the room…')}</p>
      </div>
    );
  if (game === 'missing')
    return (
      <div className="pt-screen">
        <ModeBar title={`Room ${code}`} onExit={onLeave} />
        <section className="pt-panel pt-center">
          <h2>{t('We can’t find room {code}', { code })}</h2>
          <p className="pt-muted">{t('Check the code, or it closed after three quiet hours. Pick a game in Party Mode to open a new room or quick match.')}</p>
          <button className="pt-btn pt-btn-go" onClick={onLeave}>
            {t('Open a new room or quick match')}
          </button>
        </section>
      </div>
    );
  if (game === 'nhie') return <NhieRoomPage code={code} onLeave={onLeave} />;
  if (game === 'auction') return <AuctionRoomPage code={code} onLeave={onLeave} />;
  if (game === 'board') return <BoardRoomPage code={code} onLeave={onLeave} />;
  if (game === 'rps') return <RpsRoomPage code={code} onLeave={onLeave} />;
  if (game === 'dial') return <DialRoomPage code={code} onLeave={onLeave} />;
  if (game === 'unique') return <UniqueRoomPage code={code} onLeave={onLeave} />;
  if (game === 'hues') return <HuesRoomPage code={code} onLeave={onLeave} />;
  if (game === 'scribble') return <ScribbleRoomPage code={code} onLeave={onLeave} />;
  return <ImpostorRoomPage code={code} onLeave={onLeave} />;
}

/** Opens a new room for a Party Mode game (public when `listed`) and goes into it. */
export async function openPartyRoom(game: RoomGame, listed = false): Promise<void> {
  const code = await createRoom(game, listed);
  navigate(`/party?room=${code}`);
}

/** Goes into a room from the room list or quick match (which skips asking for a name). */
export function goToRoom(game: RoomGame, code: string, matched = false): void {
  navigate(`${GAME_ROOM_PAGE[game] ?? '/party'}?room=${code}${matched ? '&match=1' : ''}`);
}
