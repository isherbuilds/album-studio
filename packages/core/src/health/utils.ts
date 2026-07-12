import { type HealthStatus } from "@tsu-stack/contract/health";

import { HEALTH_STATUS_LABELS } from "#@/health/constants";

// TODO: Add schema-derived health options or helpers here when more than one UI surface needs them.
export function formatHealthStatus(status: HealthStatus) {
  return HEALTH_STATUS_LABELS[status];
}
