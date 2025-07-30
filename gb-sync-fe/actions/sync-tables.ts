"use server";

import { env } from "~/env";

export async function syncTablesToEnvironments({
  tables,
  environments,
}: {
  tables: string[];
  environments: string[];
}) {
  const response = await fetch(`${env.API_URL}/trigger-export`, {
    method: "POST",
    headers: {
      "x-api-key": env.API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tablesToBackup: tables,
      targetStages: environments,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to trigger export: ${response.status} ${errorText}`
    );
  }

  return await response.json();
}
