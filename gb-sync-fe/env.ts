import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.url(),
    API_KEY: z.string(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    API_KEY: process.env.API_KEY,
  },
});
