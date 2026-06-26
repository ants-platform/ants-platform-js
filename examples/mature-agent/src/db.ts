/**
 * A real local database (SQLite via better-sqlite3) standing in for the
 * platform's operational store. Seeded in-memory so the example is zero-config.
 *
 * The lookup is wrapped in a `retriever` observation — that is the observation
 * type meant for "fetch context from a knowledge store" steps, and it is what
 * makes retrieval latency + row counts show up in the trace.
 */
import Database from "better-sqlite3";
import { startActiveObservation } from "ants-platform";

const db = new Database(":memory:");

db.exec(`
  CREATE TABLE customers (
    id TEXT PRIMARY KEY, name TEXT, plan TEXT, region TEXT, mrr INTEGER
  );
  CREATE TABLE incidents (
    id INTEGER PRIMARY KEY, customer_id TEXT, topic TEXT, summary TEXT, resolved_at TEXT
  );
`);

db.prepare(
  `INSERT INTO customers VALUES (@id, @name, @plan, @region, @mrr)`,
).run({
  id: "cus_8841",
  name: "Helio Robotics",
  plan: "Scale",
  region: "Berlin",
  mrr: 4200,
});

const insIncident = db.prepare(
  `INSERT INTO incidents (customer_id, topic, summary, resolved_at) VALUES (?, ?, ?, ?)`,
);
insIncident.run(
  "cus_8841",
  "dashboard-slow",
  "Dashboard slow during EU evening peak; p95 backend was healthy, root cause was client network.",
  "2026-04-02",
);
insIncident.run(
  "cus_8841",
  "billing-discrepancy",
  "Invoice mismatch reconciled against usage ledger; $120 credit issued.",
  "2026-01-15",
);

export interface AccountContext {
  customer: {
    id: string;
    name: string;
    plan: string;
    region: string;
    mrr: number;
  };
  pastIncidents: { topic: string; summary: string; resolved_at: string }[];
}

/** Look up a customer + their incident history, traced as a retriever step. */
export function lookupAccount(customerId: string): Promise<AccountContext> {
  return startActiveObservation(
    "kb-account-lookup",
    async (retriever) => {
      retriever.update({
        input: { customerId },
        metadata: { store: "sqlite" },
      });

      const customer = db
        .prepare(`SELECT * FROM customers WHERE id = ?`)
        .get(customerId) as AccountContext["customer"] | undefined;
      if (!customer) throw new Error(`Unknown customer ${customerId}`);

      const pastIncidents = db
        .prepare(
          `SELECT topic, summary, resolved_at FROM incidents WHERE customer_id = ? ORDER BY resolved_at DESC`,
        )
        .all(customerId) as AccountContext["pastIncidents"];

      const result = { customer, pastIncidents };
      retriever.update({
        output: result,
        metadata: { rowCount: pastIncidents.length + 1 },
      });
      return result;
    },
    { asType: "retriever" },
  );
}
