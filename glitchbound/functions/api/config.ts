import type { PublicConfig } from '../../src/platform/apiTypes';
import { emailEnabled } from '../../server/email';
import { isLocal, json, type Ctx } from '../../server/http';

/** GET /api/config: public runtime settings, so sign-in can be switched on without a rebuild. */
export function onRequestGet({ env, request }: Ctx): Response {
  const config: PublicConfig = {
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    devLogin: env.DEV_LOGIN === '1' && isLocal(request),
    emailEnabled: emailEnabled(env),
  };
  return json(config);
}
