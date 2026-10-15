import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { seedCatalog } from "./seed";
import { Content, EntityType, entitySchemas } from "../shared/model";
export class Store {
  db: DatabaseSync;
  constructor(
    path = process.env.V5_DB_PATH || resolve(".data/cronica.sqlite"),
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,type TEXT NOT NULL,owner TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,deleted INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS entity_type ON entities(type,deleted);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,entity_id TEXT NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rolls(id TEXT PRIMARY KEY,character_id TEXT NOT NULL,user_id TEXT NOT NULL,data TEXT NOT NULL,date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,name TEXT,path TEXT,pages INTEGER,hash TEXT,classification TEXT);
    CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(document UNINDEXED,page UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');`);
    this.transaction(() => {
      for (const c of seedCatalog()) {
        const old = this.get(c.id, true);
        if (!old) this.create("content", c, "system", c.id);
        else if (
          old.ownerId === "system" &&
          !old._deleted &&
          (old.revision ?? 1) < c.revision
        ) {
          this.update(c.id, c, old.version);
          this.audit(c.id, "system", "Revisão de catálogo", {
            revision: c.revision,
          });
        }
      }
    });
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(id: string, deleted = false): any {
    if (!id || typeof id !== "string") return undefined;
    const r = this.db
      .prepare(
        "SELECT * FROM entities WHERE id=?" + (deleted ? "" : " AND deleted=0"),
      )
      .get(id) as any;
    return r
      ? {
          ...entitySchemas[r.type as EntityType].parse(JSON.parse(r.data)),
          id: r.id,
          version: r.version,
          ownerId: r.owner,
          _type: r.type,
          _deleted: !!r.deleted,
        }
      : undefined;
  }
  list(type: EntityType, deleted = false): any[] {
    return (
      this.db
        .prepare(
          "SELECT id FROM entities WHERE type=? AND deleted=? ORDER BY updated DESC",
        )
        .all(type, deleted ? 1 : 0) as any[]
    ).map((x) => this.get(x.id, deleted));
  }
  create(
    type: EntityType,
    data: any,
    owner: string,
    id: string = randomUUID(),
  ): any {
    this.db
      .prepare(
        "INSERT INTO entities(id,type,owner,data,updated) VALUES(?,?,?,?,?)",
      )
      .run(id, type, owner, JSON.stringify(data), new Date().toISOString());
    return this.get(id);
  }
  update(id: string, data: any, version: number): any {
    const r = this.db
      .prepare(
        "UPDATE entities SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND deleted=0",
      )
      .run(JSON.stringify(data), new Date().toISOString(), id, version);
    if (!r.changes)
      throw Object.assign(
        new Error(
          "Outro acesso alterou este registro. Recarregue antes de salvar.",
        ),
        { status: 409 },
      );
    return this.get(id);
  }
  markDeleted(id: string, deleted: boolean) {
    this.db
      .prepare(
        "UPDATE entities SET deleted=?,version=version+1,updated=? WHERE id=?",
      )
      .run(deleted ? 1 : 0, new Date().toISOString(), id);
  }
  audit(id: string, user: string, action: string, detail: any = {}) {
    this.db
      .prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)")
      .run(
        randomUUID(),
        id,
        user,
        action,
        JSON.stringify(detail),
        new Date().toISOString(),
      );
  }
  logRoll(character: string, user: string, data: any) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO rolls VALUES(?,?,?,?,?)")
      .run(id, character, user, JSON.stringify(data), new Date().toISOString());
    return { id, ...data };
  }
  catalog(): Content[] {
    return this.list("content");
  }
  close() {
    this.db.close();
  }
}
