import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "@tsu-stack/i18n/server";

export default {
  async fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  }
};
