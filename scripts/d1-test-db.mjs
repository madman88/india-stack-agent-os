import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export function testDb(path = ":memory:", migrate = true) {
  const sqlite = new DatabaseSync(path);
  let tail = Promise.resolve();
  if (migrate) for (const name of readdirSync("drizzle").filter((n) => n.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
  return {
    close: () => sqlite.close(),
    prepare(sql) {
      const prepared = sqlite.prepare(sql);
      let args = [];
      return { bind(...values) { args = values; return this; },
        first: async () => prepared.get(...args) ?? null,
        all: async () => ({ results: prepared.all(...args) }),
        run: async () => ({ meta: { changes: Number(prepared.run(...args).changes) } }) };
    },
    batch(statements) {
      const operation = async () => {
      sqlite.exec("BEGIN");
      try { const result = []; for (const s of statements) result.push(await s.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      };
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    }
  };
}
