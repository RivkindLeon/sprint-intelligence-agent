import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl } from "./src/database/config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: getDatabaseUrl(process.env) },
});
