import { ENV_SERVER } from "@tsu-stack/env/server/env";

export function getInvitationUrl(invitationId: string) {
  const base = new URL(ENV_SERVER.VITE_WEB_URL);
  base.pathname = `${base.pathname.replace(/\/$/, "")}/`;
  const url = new URL("accept-invitation", base);
  url.searchParams.set("id", invitationId);
  return url.toString();
}
