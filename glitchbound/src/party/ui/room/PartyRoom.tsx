import { useEffect, useState } from 'react';
import { createRoom, roomInfo, type RoomGame } from '../../../platform/rooms';
import { navigate } from '../../../router/router';
import { ImpostorRoomPage } from '../ImpostorRoom';
import { ModeBar } from '../shared';
import { AuctionRoomPage } from './AuctionRoom';
import { BoardRoomPage } from './BoardRoom';
import { DialRoomPage } from './DialRoom';
import { HuesRoomPage } from './HuesRoom';
import { NhieRoomPage } from './NhieRoom';
import { RpsRoomPage } from './RpsRoom';
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
  useEffect(() => {
    if (game === 'crass-act') navigate(`/games/crass-act?room=${code}`);
    if (game === 'drag') navigate(`/games/launch-control?room=${code}`);
  }, [game, code]);
  if (game === null || game === 'crass-act' || game === 'drag')
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
          <h2>{t('This room has closed')}</h2>
          <p className="pt-muted">{t('Rooms close after three quiet hours. Open a new one and send the link.')}</p>
          <button className="pt-btn pt-btn-go" onClick={onLeave}>
            {t('Back to Party Mode')}
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
  return <ImpostorRoomPage code={code} onLeave={onLeave} />;
}

/** Opens a new room for a Party Mode game and goes into it. */
export async function openPartyRoom(game: RoomGame): Promise<void> {
  const code = await createRoom(game);
  navigate(`/party?room=${code}`);
}
