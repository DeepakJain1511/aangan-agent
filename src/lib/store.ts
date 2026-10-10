import fs from "node:fs";
import path from "node:path";
import { env } from "./config";
import type { EnquiryRecord } from "./types";

export interface Store {
  get(callId: string): Promise<EnquiryRecord | null>;
  /** Insert only if call_id is new. Returns false when the call was already stored (idempotency). */
  insert(r: EnquiryRecord): Promise<boolean>;
  update(callId: string, patch: Partial<EnquiryRecord>): Promise<void>;
  list(): Promise<EnquiryRecord[]>;
  /** Small key-value side table: room_name -> caller phone (only Vaani's call_started carries the number). */
  setMeta(key: string, value: string): Promise<void>;
  getMeta(key: string): Promise<string | null>;
}

class FileStore implements Store {
  constructor(private file: string) {}
  private read(): EnquiryRecord[] {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return [];
    }
  }
  private write(rows: EnquiryRecord[]) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(rows, null, 2));
  }
  async get(id: string) {
    return this.read().find((r) => r.call_id === id) ?? null;
  }
  async insert(r: EnquiryRecord) {
    const rows = this.read();
    if (rows.some((x) => x.call_id === r.call_id)) return false;
    rows.push(r);
    this.write(rows);
    return true;
  }
  async update(id: string, patch: Partial<EnquiryRecord>) {
    const rows = this.read().map((r) => (r.call_id === id ? { ...r, ...patch } : r));
    this.write(rows);
  }
  private metaFile() {
    return this.file.replace(/.json$/, ".meta.json");
  }
  async setMeta(k: string, v: string) {
    let m: Record<string, string> = {};
    try { m = JSON.parse(fs.readFileSync(this.metaFile(), "utf8")); } catch {}
    m[k] = v;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.metaFile(), JSON.stringify(m));
  }
  async getMeta(k: string) {
    try { return (JSON.parse(fs.readFileSync(this.metaFile(), "utf8")) as Record<string, string>)[k] ?? null; } catch { return null; }
  }
  async list() {
    return this.read().sort((a, b) => b.started_at.localeCompare(a.started_at));
  }
}

/** Supabase via PostgREST. Table `enquiries` (see supabase/schema.sql), call_id is the primary key. */
class SupabaseStore implements Store {
  constructor(private url: string, private key: string) {}
  private async req(pathAndQuery: string, init: RequestInit = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(`${this.url}/rest/v1/enquiries${pathAndQuery}`, {
        ...init,
        signal: ctl.signal,
        headers: {
          apikey: this.key,
          authorization: `Bearer ${this.key}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      return res;
    } finally {
      clearTimeout(t);
    }
  }
  async get(id: string) {
    const res = await this.req(`?call_id=eq.${encodeURIComponent(id)}&select=*`);
    if (!res.ok) throw new Error(`supabase get ${res.status}`);
    const rows = (await res.json()) as EnquiryRecord[];
    return rows[0] ?? null;
  }
  async insert(r: EnquiryRecord) {
    const res = await this.req("?on_conflict=call_id", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(r),
    });
    if (!res.ok) throw new Error(`supabase insert ${res.status}`);
    return ((await res.json()) as unknown[]).length > 0;
  }
  async update(id: string, patch: Partial<EnquiryRecord>) {
    const res = await this.req(`?call_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) throw new Error(`supabase update ${res.status}`);
  }
  async list() {
    const res = await this.req("?select=*&order=started_at.desc&limit=1000");
    if (!res.ok) throw new Error(`supabase list ${res.status}`);
    return (await res.json()) as EnquiryRecord[];
  }
  async setMeta(k: string, v: string) {
    const res = await fetch(`${this.url}/rest/v1/call_meta?on_conflict=room_name`, {
      method: "POST",
      headers: { apikey: this.key, authorization: `Bearer ${this.key}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ room_name: k, phone: v }),
    });
    if (!res.ok) throw new Error(`supabase meta ${res.status}`);
  }
  async getMeta(k: string) {
    const res = await fetch(`${this.url}/rest/v1/call_meta?room_name=eq.${encodeURIComponent(k)}&select=phone`, {
      headers: { apikey: this.key, authorization: `Bearer ${this.key}` },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { phone: string }[])[0]?.phone ?? null;
  }
}

let _store: Store | null = null;
export function getStore(): Store {
  if (_store) return _store;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  _store = url && key ? new SupabaseStore(url, key) : new FileStore(path.join(process.cwd(), "data", "store.json"));
  return _store;
}
export function setStoreForTests(s: Store | null) {
  _store = s;
}
export function memoryStore(): Store {
  const rows: EnquiryRecord[] = [];
  const meta: Record<string, string> = {};
  return {
    async get(id) { return rows.find((r) => r.call_id === id) ?? null; },
    async insert(r) { if (rows.some((x) => x.call_id === r.call_id)) return false; rows.push(r); return true; },
    async update(id, p) { const i = rows.findIndex((r) => r.call_id === id); if (i >= 0) rows[i] = { ...rows[i], ...p }; },
    async list() { return [...rows]; },
    async setMeta(k, v) { meta[k] = v; },
    async getMeta(k) { return meta[k] ?? null; },
  };
}
