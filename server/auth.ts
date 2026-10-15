import {
  scryptSync,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
import { Request } from "express";
import { Store } from "./db";
export type User = {
  id: string;
  username: string;
  name: string;
  role: "narrator" | "player";
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function authUser(store: Store, req: Request): User | undefined {
  const token = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("v5_session="))
    ?.slice(11);
  if (!token) return;
  const u = store.db
    .prepare(
      "SELECT u.id,u.username,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
    )
    .get(tokenHash(token), Date.now()) as User | undefined;
  return u;
}
export function visible(store: Store, e: any, u: User) {
  if (e._type === "content") return true;
  if (e._type === "campaigns")
    return e.gmId === u.id || e.members.includes(u.id);
  if (e._type === "characters" && e.ownerId === u.id) return true;
  if (!e.campaignId) return e.ownerId === u.id;
  const camp = store.get(e.campaignId);
  if (!camp) return false;
  if (camp.gmId === u.id) return true;
  if (e._type === "records" && e.private) return false;
  return camp.members.includes(u.id);
}
export function isGM(store: Store, e: any, u: User) {
  const camp = store.get(e._type === "campaigns" ? e.id : e.campaignId);
  return camp
    ? camp.gmId === u.id
    : e.ownerId === u.id && u.role === "narrator";
}
export function editable(store: Store, e: any, u: User) {
  if (e._type === "content")
    return (
      e.ownerId === u.id && e.ownerId !== "system" && e.origin !== "official"
    );
  if (e._type === "campaigns") return e.gmId === u.id;
  if (e._type === "characters") return e.ownerId === u.id || isGM(store, e, u);
  return (
    isGM(store, e, u) ||
    (e.ownerId === u.id && e._type === "records" && e.kind !== "secret")
  );
}
export function publicEntity(store: Store, e: any, u: User) {
  const out = { ...e };
  delete out._type;
  delete out._deleted;
  if (!isGM(store, e, u)) delete out.privateNotes;
  return out;
}
