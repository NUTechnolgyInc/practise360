"use client";

import { useResource } from "./use-resource";

export const useMyReports = () => useResource("/ai/usage-reports/mine");
export const useTeamReports = (period) => useResource(period ? `/ai/usage-reports?period=${period}` : null);
