const LOCAL_DATABASE_URL =
  "postgresql://sprint_intelligence:sprint_intelligence@localhost:5432/sprint_intelligence";

type Environment = Record<string, string | undefined>;

export function getDatabaseUrl(environment: Environment): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (!databaseUrl) return LOCAL_DATABASE_URL;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error(
      "DATABASE_URL must use the postgres or postgresql protocol",
    );
  }

  return databaseUrl;
}
