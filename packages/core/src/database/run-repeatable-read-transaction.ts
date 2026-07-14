import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";

export async function runRepeatableReadTransaction<T>(
  db: Pick<Database, "transaction">,
  operation: (tx: DatabaseOrTransaction) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(operation, { isolationLevel: "repeatable read" });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      if (
        attempt > 0 ||
        !(cause instanceof Error) ||
        !("code" in cause) ||
        cause.code !== "40001"
      ) {
        throw error;
      }
    }
  }
}
