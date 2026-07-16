import { z } from "zod";

import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

export const OrganizationDashboardInputSchema = OrgSlugInputSchema;
export const PlatformDashboardInputSchema = z.void();
