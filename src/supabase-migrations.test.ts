/**
 * Migration sanity — integration-ish guard over supabase/migrations/.
 *
 * These run without a database: they parse the SQL text and assert the
 * invariants the integration wave verified by hand (run order, FK targets,
 * RLS on every table, no duplicate index/policy/constraint names, the
 * EXCLUDE anti-double-booking constraint, and seed-column agreement).
 * If a future migration breaks one of these, this fails before deploy.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const SEED_PATH = join(process.cwd(), "supabase", "seed.sql");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{5}_.*\.sql$/.test(f))
    .sort();
}

function readAll(): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of migrationFiles()) {
    map.set(f, readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  return map;
}

/** Extract top-level column names from each `create table public.X (...)`. */
function tableColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const re = /create table public\.(\w+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1];
    // Balance parens from the opening paren.
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < sql.length; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = sql.slice(start + 1, i);
    // Split top-level commas only.
    const cols = new Set<string>();
    let d = 0;
    let cur = "";
    const entries: string[] = [];
    for (const ch of body) {
      if (ch === "(") d++;
      if (ch === ")") d--;
      if (ch === "," && d === 0) {
        entries.push(cur);
        cur = "";
      } else cur += ch;
    }
    entries.push(cur);
    for (const e of entries) {
      const first = e.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (
        first &&
        ![
          "check",
          "constraint",
          "primary",
          "unique",
          "foreign",
          "exclude",
          "like",
        ].includes(first)
      ) {
        cols.add(first);
      }
    }
    tables.set(name!, cols);
  }
  return tables;
}

describe("migrations", () => {
  const files = migrationFiles();
  const all = readAll();
  const combined = [...all.values()].join("\n");

  it("applies in gapless numeric order", () => {
    const nums = files.map((f) => Number(f.slice(0, 5)));
    expect(nums[0]).toBe(1);
    nums.forEach((n, i) => expect(n).toBe(i + 1));
  });

  it("enables RLS on every created table", () => {
    const tables = new Set<string>();
    for (const sql of all.values()) {
      for (const m of sql.matchAll(/create table public\.(\w+)/gi)) {
        tables.add(m[1]!.toLowerCase());
      }
    }
    for (const t of tables) {
      expect(
        combined.toLowerCase(),
        `table ${t} missing ENABLE ROW LEVEL SECURITY`
      ).toContain(`alter table public.${t} enable row level security`);
    }
  });

  it("has no duplicate index, policy, or constraint names", () => {
    const names: string[] = [];
    for (const m of combined.matchAll(
      /create (?:unique )?index (\w+)|create policy (\w+)|add constraint (\w+)/gi
    )) {
      names.push((m[1] ?? m[2] ?? m[3])!.toLowerCase());
    }
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupeMessage(dupes)).toBe("");
  });

  it("keeps the bookings anti-double-booking EXCLUDE constraint on btree_gist", () => {
    expect(combined).toMatch(/create extension if not exists btree_gist/i);
    expect(combined).toMatch(/exclude using gist/);
    expect(combined).toMatch(/constraint no_overlap/);
  });

  it("FK references resolve to created tables", () => {
    const tables = new Set<string>();
    for (const m of combined.matchAll(/create table public\.(\w+)/gi)) {
      tables.add(m[1]!.toLowerCase());
    }
    tables.add("users"); // auth.users lives in the auth schema
    for (const m of combined.matchAll(
      /references public\.(\w+)|references auth\.(\w+)/gi
    )) {
      const target = (m[1] ?? m[2])!.toLowerCase();
      expect(tables, `FK target missing: ${target}`).toContain(target);
    }
  });

  it("00015 implements the invite RPCs as SECURITY DEFINER", () => {
    const sql = all.get("00015_staff_invite_rpcs.sql");
    expect(sql).toBeDefined();
    expect(sql!).toMatch(
      /create or replace function public\.get_staff_invite\(p_token text\)[\s\S]*?security definer/i
    );
    expect(sql!).toMatch(
      /create or replace function public\.accept_staff_invite\(p_token text\)[\s\S]*?security definer/i
    );
    // Token hashing matches the app's sha256-hex scheme (see staff/actions.ts).
    expect(sql!).toMatch(/digest\(p_token::bytea, 'sha256'\)/);
    // The accept page may resolve links while signed out.
    expect(sql!).toMatch(/grant execute on function public\.get_staff_invite\(text\) to anon/i);
  });

  it("00016 lets staff update their own staff row", () => {
    const sql = all.get("00016_staff_self_service.sql");
    expect(sql).toBeDefined();
    expect(sql!).toMatch(/create policy staff_own_update on public\.staff/i);
    expect(sql!).toMatch(/for update to authenticated/i);
  });

  it("seed.sql inserts only reference columns that exist", () => {
    const seed = readFileSync(SEED_PATH, "utf8");
    const tables = tableColumns(combined);
    const problems: string[] = [];
    for (const m of seed.matchAll(
      /insert into public\.(\w+)\s*\(([^)]+)\)/gi
    )) {
      const table = m[1]!.toLowerCase();
      const cols = tables.get(table);
      if (!cols) {
        problems.push(`seed inserts into unknown table ${table}`);
        continue;
      }
      for (const col of m[2]!.split(",").map((c) => c.trim().toLowerCase())) {
        if (col && !cols.has(col)) {
          problems.push(`seed: ${table}.${col} does not exist`);
        }
      }
    }
    expect(problems.join("; ")).toBe("");
  });
});

function dupeMessage(dupes: string[]): string {
  return dupes.length > 0 ? `duplicate names: ${[...new Set(dupes)].join(", ")}` : "";
}
