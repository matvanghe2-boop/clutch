import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupIfDue, decode, encode, hasDatabase, lockInDatabase, readDoc, writeDoc } from "@/lib/store";
import { publishIfNeeded, stateOf } from "@/lib/sync/publish";
import { emptySnapshot } from "@/lib/snapshot";

const put = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@vercel/blob", () => ({ put }));

const BASE = "https://base.test";
const BLOB = "https://blob.test/snapshot.json";

/** Une base Redis réduite aux commandes employées, et les fichiers de Blob. */
function fakes({ down = false, blob = {} as Record<string, unknown> } = {}) {
  const redis = new Map<string, string>();
  const calls: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === BASE) {
        if (down) return new Response(JSON.stringify({ error: "panne" }), { status: 500 });
        const [cmd, key, value, ...opts] = JSON.parse(String(init?.body)) as string[];
        calls.push([cmd, key]);
        if (cmd === "GET") return Response.json({ result: redis.get(key) ?? null });
        if (opts.includes("NX") && redis.has(key)) return Response.json({ result: null });
        redis.set(key, value);
        return Response.json({ result: "OK" });
      }
      const name = url.split("/").pop()!;
      return name in blob ? Response.json(blob[name]) : new Response("", { status: 404 });
    }),
  );
  return { redis, calls };
}

beforeEach(() => {
  put.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("KV_REST_API_URL", BASE);
  vi.stubEnv("KV_REST_API_TOKEN", "jeton");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("SNAPSHOT_URL", BLOB);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("les documents compressés", () => {
  it("se relisent à l'identique, en bien moins de place", () => {
    const doc = { teams: Array.from({ length: 500 }, (_, i) => ({ id: i, name: "Paris Gentle Mates" })) };
    const raw = encode(doc);
    expect(decode(raw)).toEqual(doc);
    expect(raw.length).toBeLessThan(JSON.stringify(doc).length / 5);
  });
});

describe("quelle base", () => {
  it("jamais celle de production hors de Vercel, sauf demande explicite", () => {
    expect(hasDatabase()).toBe(true);
    vi.stubEnv("VERCEL", "");
    expect(hasDatabase()).toBe(false);
    vi.stubEnv("CLUTCH_USE_DB", "1");
    expect(hasDatabase()).toBe(true);
  });

  it("se contente de l'adresse Redis si c'est tout ce que Vercel donne", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("REDIS_URL", "rediss://default:secret@exemple.upstash.io:6379");
    expect(hasDatabase()).toBe(true);
    const f = vi.fn(async () => Response.json({ result: "OK" }));
    vi.stubGlobal("fetch", f);
    await lockInDatabase(1000, "test");
    expect(f).toHaveBeenCalledWith("https://exemple.upstash.io", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer secret" }) }));
  });

  it("sans base, tout reste sur Blob", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    const { calls } = fakes({ blob: { "config.json": ["a"] } });
    expect(await readDoc("config")).toEqual(["a"]);
    expect(await writeDoc("config", ["b"])).toBe(true);
    expect(put).toHaveBeenCalledWith("config.json", '["b"]', expect.anything());
    expect(calls).toEqual([]);
  });
});

describe("la reprise depuis Blob", () => {
  it("copie le document à sa première lecture, puis ne relit plus que la base", async () => {
    const { redis } = fakes({ blob: { "predictions.json": { m: 1 } } });
    expect(await readDoc("predictions")).toEqual({ m: 1 });
    expect(decode(redis.get("clutch:predictions")!)).toEqual({ m: 1 });
    await writeDoc("predictions", { m: 2 });
    expect(await readDoc("predictions")).toEqual({ m: 2 });
    expect(put).not.toHaveBeenCalled();
  });

  it("un document qui n'existe nulle part reste vide", async () => {
    fakes();
    expect(await readDoc("config")).toBeNull();
  });
});

describe("si la base tombe", () => {
  it("le site lit la sauvegarde", async () => {
    fakes({ down: true, blob: { "snapshot.json": { from: "blob" } } });
    expect(await readDoc("snapshot")).toEqual({ from: "blob" });
  });

  it("une lecture avant écriture échoue plutôt que d'écraser avec une vieille copie", async () => {
    fakes({ down: true, blob: { "predictions.json": { vieux: 1 } } });
    await expect(readDoc("predictions", { strict: true })).rejects.toThrow(/Base de données/);
  });
});

describe("le verrou", () => {
  it("une seule passe l'obtient", async () => {
    fakes();
    expect(await lockInDatabase(60_000, "a")).toBe(true);
    expect(await lockInDatabase(60_000, "b")).toBe(false);
  });
});

describe("la sauvegarde quotidienne", () => {
  it("copie les documents dans Blob une seule fois", async () => {
    fakes();
    await writeDoc("snapshot", { a: 1 });
    await writeDoc("config", ["x"]);
    expect(await backupIfDue()).toBe(true);
    expect(put.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["snapshot.json", "config.json"]);
    expect(await backupIfDue()).toBe(false);
    expect(put).toHaveBeenCalledTimes(2);
  });
});

describe("la publication", () => {
  const snap = (over = {}) => ({ ...emptySnapshot(), updatedAt: "2026-11-07T10:00:00Z", checkedAt: new Date().toISOString(), ...over });
  const read = { teams: { a: { fetchedAt: "2026-11-07T11:00:00Z", name: "A" } } };
  const reread = { teams: { a: { fetchedAt: "2026-11-07T12:00:00Z", name: "A" } } };

  it("avec la base, garde l'heure d'une lecture même sans changement de données", async () => {
    const { calls } = fakes();
    const before = stateOf(snap(read) as never);
    expect(await publishIfNeeded(snap(reread) as never, before)).toBe("saved");
    expect(calls).toContainEqual(["SET", "clutch:snapshot"]);
  });

  it("sans aucune lecture, n'écrit rien", async () => {
    const { calls } = fakes();
    const before = stateOf(snap(read) as never);
    expect(await publishIfNeeded(snap({ ...read, checkedAt: new Date().toISOString() }) as never, before)).toBe("unchanged");
    expect(calls).toEqual([]);
  });

  it("sans base, une relecture identique n'écrit pas : le quota de Blob l'interdit", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    fakes();
    const before = stateOf(snap(read) as never);
    expect(await publishIfNeeded(snap(reread) as never, before)).toBe("unchanged");
    expect(put).not.toHaveBeenCalled();
  });

  it("un vrai changement est publié", async () => {
    fakes();
    const before = stateOf(snap(read) as never);
    expect(await publishIfNeeded(snap({ teams: { a: { name: "B" } } }) as never, before)).toBe("published");
  });
});
