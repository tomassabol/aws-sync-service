"use server";

import { env } from "~/env";

export type TableListResponse = {
  tables: string[];
  count: number;
  requestId: string;
};

export async function getTableList(): Promise<TableListResponse> {
  "use cache";
  const response = await fetch(`${env.API_URL}/tables`, {
    headers: {
      "x-api-key": env.API_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch tables");
  }

  return (await response.json()) as TableListResponse;
}
