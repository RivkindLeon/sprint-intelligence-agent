import { asc, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { SprintListResponse } from "@sprint-intelligence/shared";

import { sprints } from "./schema.js";
import type * as schema from "./schema.js";

export class SprintListRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async list(): Promise<SprintListResponse["sprints"]> {
    return this.db
      .select({
        id: sprints.id,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
      })
      .from(sprints)
      .orderBy(desc(sprints.startDate), asc(sprints.id));
  }
}
