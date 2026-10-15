import express, { Request, Response, NextFunction } from "express";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  alchemyActionSchema,
  alchemyOperation,
  alchemyOperationLabels,
} from "../shared/alchemy";
import {
  concentrating,
  fogPenalty,
  tickConcentration,
  closeFormulaTests,
  sustainedAlchemy,
  preserveSustainedAlchemy,
  LONG_REACH,
  endAlchemyEffects,
  ENVELOP,
  FLIGHT,
  SUFFOCATING,
  UNCONSCIOUS_ENVELOP,
  envelopActionBlocked,
} from "../shared/alchemy-effects";
import { Store } from "./db";
import {
  authUser,
  editable,
  hashPassword,
  isGM,
  publicEntity,
  tokenHash,
  User,
  verifyPassword,
  visible,
} from "./auth";
import {
  Character,
  Content,
  EntityType,
  entitySchemas,
  contentSchema,
  id,
  safeImage,
  characterSchema,
  storyDateSchema,
} from "../shared/model";
import {
  addStains,
  advance,
  applyDamage,
  blood,
  check,
  conflict,
  derived,
  effectValue,
  evaluate,
  feed,
  finishCreation,
  matches,
  pool,
  remorse,
  requirementsMet,
  reroll,
  roll,
  rouse,
  RuleError,
  validateCreation,
} from "../shared/rules";
import {
  storyClock,
  nightKey,
  turnKey,
  nextClock,
  expireEffects,
  wakeForNight,
  mendSuperficial,
  mendAggravated,
  blushOfLife,
  feedFromVampire,
  recoverWillpower,
} from "../shared/blood-mechanics";
import {
  addDays,
  requireStoryDate,
  storyDate,
  settleBondReleases,
  drinkForBond,
  decayBloodBond,
  defyBloodBond,
} from "../shared/bonds";
import {
  combatSchema,
  oneRollSchema,
  resolveCombat,
  oneRollConflict,
  receiveDamage,
} from "../shared/combat";
import {
  ALCHEMY,
  isThinBlood,
  hasTrait,
  canTestFrenzy,
  effectiveBaneClan,
} from "../shared/thin-blood";
const secureDie = () => randomInt(1, 11);
const actionSchema = z.object({
  action: z.string().max(100),
  amount: z.number().int().min(0).max(100).default(1),
  track: z.enum(["health", "willpower"]).default("health"),
  aggravated: z.boolean().default(false),
  forced: z.boolean().default(false),
  waking: z.boolean().default(false),
  reason: z.string().max(2000).default(""),
  kind: z.string().max(100).default(""),
  key: z.string().max(100).default(""),
  specialty: z.string().max(200).default(""),
  powerId: z.string().max(100).default(""),
  resonance: z.boolean().default(false),
  mentor: z.boolean().default(false),
  researchConfirmed: z.boolean().default(false),
  alchemyMethod: z.enum(["", "athanor", "calcinatio", "fixatio"]).default(""),
  dependencyConfirmed: z.boolean().default(false),
  source: z.enum(["human", "animal", "bag", "vampire"]).default("human"),
  tags: z.array(z.string().max(100)).max(20).default([]),
  direct: z.boolean().default(true),
  bondHandling: z.enum(["automatic", "manual"]).default("automatic"),
  bondId: z.string().max(100).default(""),
  present: z.boolean().default(false),
  avoided: z.boolean().default(false),
  reminder: z.boolean().default(false),
  moonPhase: z.enum(["full", "new"]).optional(),
  killed: z.boolean().default(false),
  processed: z.boolean().default(false),
  scope: z.enum(["turn", "scene", "night"]).default("scene"),
  itemId: z.string().max(100).default(""),
  targetId: z.string().max(100).default(""),
  equipped: z.boolean().default(false),
  rouseCount: z.number().int().min(0).max(5).optional(),
  duration: z.number().int().min(1).max(100).default(1),
  difficulty: z.number().int().min(0).max(30).optional(),
  narrativeConfirmed: z.boolean().default(false),
  note: z.string().max(5000).default(""),
});
const rollSchema = z.object({
  attribute: id,
  skill: z.string().max(100).default(""),
  modifier: z.number().int().min(-30).max(30).default(0),
  difficulty: z.number().int().min(1).max(30).default(2),
  specialty: z.boolean().default(false),
  tags: z.array(z.string().max(100)).max(20).default([]),
  surge: z.boolean().default(false),
  mode: z.enum(["normal", "willpower", "humanity", "frenzy"]).default("normal"),
  label: z.string().max(200).default(""),
  targetId: z.string().max(100).default(""),
  targetContext: z.enum(["", "identify", "ranged", "visual"]).default(""),
});
function httpError(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success)
    httpError(
      400,
      "Dados inválidos: " +
        r.error.issues.map((x) => x.path.join(".") || "registro").join(", "),
    );
  return r.data;
}
export function createApp(store = new Store(), die: () => number = secureDie) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "15mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    if (
      req.path.startsWith("/api") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-v5-csrf"] !== "1"
    )
      return res
        .status(403)
        .json({ error: "Requisição sem proteção de origem." });
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      database: !!store.db.prepare("SELECT 1").get(),
      application: "Crônica V5",
    }),
  );
  app.get("/api/auth/status", (req, res) =>
    res.json({
      initialized: !!store.db.prepare("SELECT 1 FROM users LIMIT 1").get(),
      user: authUser(store, req) ?? null,
    }),
  );
  const credentials = z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(10).max(200),
    name: z.string().trim().min(1).max(100).optional(),
  });
  function login(res: Response, u: User) {
    const token = randomBytes(32).toString("hex");
    store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(tokenHash(token), u.id, Date.now() + 86400000 * 7);
    res.cookie("v5_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.V5_SECURE_COOKIE === "1",
      maxAge: 604800000,
      path: "/",
    });
    res.json({ user: u });
  }
  app.post("/api/auth/setup", (req, res) => {
    const data = parse(credentials, req.body);
    const u = store.transaction(() => {
      check(
        !store.db.prepare("SELECT 1 FROM users LIMIT 1").get(),
        "O Narrador inicial já foi cadastrado.",
      );
      const u = {
        id: randomUUID(),
        username: data.username,
        name: data.name || data.username,
        role: "narrator" as const,
      };
      store.db
        .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .run(u.id, u.username, u.name, hashPassword(data.password), u.role);
      return u;
    });
    login(res, u);
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.post("/api/auth/login", (req, res) => {
    const data = parse(credentials.omit({ name: true }), req.body),
      key = req.ip || "local";
    let a = attempts.get(key);
    if (a && a.until > Date.now() && a.count >= 10)
      httpError(429, "Muitas tentativas. Aguarde alguns minutos.");
    if (!a || a.until < Date.now())
      a = { count: 0, until: Date.now() + 300000 };
    const u = store.db
      .prepare("SELECT * FROM users WHERE username=?")
      .get(data.username) as any;
    if (!u || !verifyPassword(data.password, u.password)) {
      a.count++;
      attempts.set(key, a);
      httpError(401, "Usuário ou senha incorretos.");
    }
    attempts.delete(key);
    login(res, { id: u.id, username: u.username, name: u.name, role: u.role });
  });
  app.use("/api", (req, res, next) => {
    const user = authUser(store, req);
    if (!user)
      return res
        .status(401)
        .json({ error: "Entre na sua conta para continuar." });
    res.locals.user = user;
    next();
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("v5_session="))
      ?.slice(11);
    if (token)
      store.db
        .prepare("DELETE FROM sessions WHERE token=?")
        .run(tokenHash(token));
    res.clearCookie("v5_session", { path: "/" }).json({ ok: true });
  });
  app.get("/api/users", (_req, res) => {
    const u = res.locals.user as User;
    if (u.role !== "narrator")
      return res.json([
        { id: u.id, name: u.name, username: u.username, role: u.role },
      ]);
    res.json(
      store.db
        .prepare("SELECT id,name,username,role FROM users ORDER BY name")
        .all(),
    );
  });
  app.post("/api/users", (req, res) => {
    const u = res.locals.user as User;
    check(u.role === "narrator", "Somente Narradores cadastram contas.");
    const data = parse(
      credentials.extend({
        role: z.enum(["narrator", "player"]).default("player"),
      }),
      req.body,
    );
    check(
      !store.db
        .prepare("SELECT id FROM users WHERE username=?")
        .get(data.username),
      "Esse usuário já existe.",
    );
    const userId = randomUUID();
    store.db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(
        userId,
        data.username,
        data.name || data.username,
        hashPassword(data.password),
        data.role,
      );
    res.status(201).json({
      id: userId,
      name: data.name || data.username,
      username: data.username,
      role: data.role,
    });
  });
  function getEntity(
    req: Request,
    res: Response,
    write = false,
    type?: string,
  ) {
    const e = store.get(String(req.params.id));
    if (!e || (type && e._type !== type))
      httpError(404, "Registro não encontrado.");
    const u = res.locals.user as User;
    if (!visible(store, e, u) || (write && !editable(store, e, u)))
      httpError(403, "Você não tem permissão para este registro.");
    return e;
  }
  function integrity(
    type: EntityType,
    data: any,
    u: User,
    old?: any,
    restoring = false,
  ) {
    if (type === "content") {
      check(
        data.minLevel <= data.maxLevel,
        "O nível mínimo não pode exceder o máximo.",
      );
      for (const effect of data.effects) {
        check(
          !["dice", "attribute", "health", "willpower", "condition"].includes(
            effect.kind,
          ) || effect.duration !== "instant",
          "Modificadores e condições precisam de duração de turno, cena, noite ou permanente.",
        );
      }

      check(
        safeImage(data.image),
        "Use uma imagem PNG, JPEG ou WebP enviada pelo formulário.",
      );
      check(
        data.origin !== "official",
        "Definições oficiais são preservadas. Crie uma variante ou conteúdo personalizado.",
      );
      check(
        Boolean(data.attribute) === Boolean(data.skill),
        "Preencha os dois componentes da parada ou deixe ambos vazios para um efeito narrativo.",
      );
      check(
        Boolean(data.resistanceAttribute) === Boolean(data.resistanceSkill),
        "Preencha os dois componentes da resistência.",
      );
      check(
        !data.resistanceAttribute || data.attribute,
        "Um teste resistido exige a parada do usuário e a do alvo.",
      );
      for (const g of data.grants)
        check(
          ["merit", "flaw", "background"].includes(
            store.get(g.contentId)?.kind,
          ),
          "Concessão com conteúdo inexistente.",
        );
      for (const key of data.disciplines)
        check(
          store.get(key)?._type === "content" &&
            store.get(key)?.kind === "discipline",
          "Vínculo com Disciplina inexistente.",
        );
      if (["power", "ritual", "ceremony", "formula"].includes(data.kind))
        check(
          store.get(data.parentId)?.kind === "discipline",
          "Escolha a Disciplina deste Poder.",
        );
      for (const r of data.requirements) {
        if (["discipline", "power", "clan", "content"].includes(r.kind))
          check(
            store.get(r.target)?._type === "content",
            "Pré-requisito inexistente.",
          );
      }
      check(
        !data.requirements.some((r: any) => r.target === old?.id),
        "Um conteúdo não pode exigir a si mesmo.",
      );
      for (const e of data.effects) {
        if (e.kind === "attribute")
          check(
            [
              "forca",
              "destreza",
              "vigor",
              "carisma",
              "manipulacao",
              "autocontrole",
              "inteligencia",
              "raciocinio",
              "determinacao",
            ].includes(e.target),
            "Alvo de Atributo inválido.",
          );
        if (e.kind === "resource")
          check(
            ["hunger", "humanity", "stains"].includes(e.target),
            "Recurso não automatizável; use efeito narrativo.",
          );
        if (["damage", "heal"].includes(e.kind))
          check(
            ["health", "willpower"].includes(e.target),
            "Trilha do efeito inválida.",
          );
        if (e.scale === "margin")
          check(
            ["damage", "heal"].includes(e.kind) && e.duration === "instant",
            "Escala por margem exige dano/cura instantâneo.",
          );
        if (
          [
            "clan",
            "lineage",
            "merit",
            "flaw",
            "background",
            "condition",
          ].includes(data.kind) &&
          e.kind !== "narrative"
        )
          check(
            e.duration === "permanent" &&
              e.recipient === "self" &&
              ["dice", "attribute", "health", "willpower"].includes(e.kind),
            "Conteúdo passivo aceita modificadores permanentes do usuário. Custos e ações pertencem aos Poderes.",
          );
        if (e.duration === "permanent" && e.kind !== "narrative")
          check(
            e.recipient === "self" &&
              ["dice", "attribute", "health", "willpower"].includes(e.kind),
            "Efeito permanente deve modificar o próprio personagem; mudanças de recursos usam efeitos instantâneos.",
          );
      }
    }
    if (type === "records" && ["combat", "session"].includes(data.kind)) {
      check(
        data.participants.every(
          (key: string) =>
            store.get(key)?._type === "characters" &&
            store.get(key).campaignId === data.campaignId,
        ),
        "Participantes incompatíveis com a crônica.",
      );
      if (data.kind === "combat")
        check(
          store.get(data.campaignId)?.gmId === u.id,
          "Somente o Narrador administra confrontos.",
        );
    }
    if (type === "campaigns") {
      data.gmId = old?.gmId || u.id;
      check(u.role === "narrator", "Somente Narradores criam campanhas.");
      check(
        data.members.every((m: string) =>
          store.db.prepare("SELECT id FROM users WHERE id=?").get(m),
        ),
        "Jogador não cadastrado.",
      );
    }
    if (type !== "campaigns" && type !== "content" && data.campaignId) {
      const camp = store.get(data.campaignId);
      check(
        camp?._type === "campaigns" && visible(store, camp, u),
        "Campanha inexistente ou sem acesso.",
      );
      if (["coteries", "records"].includes(type))
        check(
          camp.gmId === u.id ||
            (type === "records" && !data.private && data.kind !== "secret"),
          "Somente o Narrador configura esse conteúdo.",
        );
    }
    if (type === "campaigns" && old)
      check(
        JSON.stringify(data.clock) === JSON.stringify(old.clock) &&
          data.storyDate === old.storyDate,
        "Avance o tempo pelos controles do Narrador.",
      );
    if (type === "characters") {
      if (old) {
        if (!isGM(store, old, u))
          check(
            JSON.stringify(
              data.activeEffects.filter((e: any) =>
                [ENVELOP, FLIGHT].includes(e.sourceId),
              ),
            ) ===
              JSON.stringify(
                old.activeEffects.filter((e: any) =>
                  [ENVELOP, FLIGHT].includes(e.sourceId),
                ),
              ) &&
              (!envelopActionBlocked(old) || data.nature === old.nature) &&
              old.activeEffects
                .filter(
                  (e: any) =>
                    [ENVELOP, FLIGHT].includes(e.sourceId) &&
                    e.effect.kind === "condition",
                )
                .every((e: any) => data.conditions.includes(e.effect.target)),
            "Efeitos de Alquimia e a natureza de um alvo restringido exigem autorização do Narrador.",
          );
        check(
          isGM(store, old, u) ||
            !old.conditions.includes(UNCONSCIOUS_ENVELOP) ||
            data.conditions.includes(UNCONSCIOUS_ENVELOP),
          "O Narrador resolve a recuperação de consciência após Envolver.",
        );
        for (const key of [
          "clock",
          "storyDate",
          "bloodBonds",
          "grappledBy",
          "grappleSinceTurn",
          "grappleLastTurn",
          "lastWakeNight",
          "lastAggravatedMendNight",
          "lastAggravatedDamageNight",
          "lastSuperficialMendTurn",
          "lastPowerTurn",
          "lastBlushNight",
          "lastSessionRecovery",
          "aggravatedMendEligible",
          "alchemy",
        ])
          check(
            JSON.stringify(data[key]) === JSON.stringify(old[key]),
            "Marcadores de regras são atualizados pelas ações da sessão.",
          );
      } else if (!restoring) {
        data.aggravatedMendEligible = 0;
        data.storyDate = "";
        data.bloodBonds = [];
        data.alchemy = { preparations: [], activations: [] };
        data.grappledBy = "";
        data.grappleSinceTurn = "";
        data.grappleLastTurn = "";
        data.clock = { night: 1, scene: 1, turn: 1 };
        for (const key of [
          "lastWakeNight",
          "lastAggravatedMendNight",
          "lastAggravatedDamageNight",
          "lastSuperficialMendTurn",
          "lastPowerTurn",
          "lastBlushNight",
          "lastSessionRecovery",
        ])
          data[key] = "";
      }

      if (data.nature === "mortal") {
        check(
          !data.clanId &&
            !data.predatorId &&
            !Object.values(data.disciplines).some((n) => Number(n) > 0) &&
            !data.powers.length,
          "Mortais não possuem Clã, Predador ou Disciplinas.",
        );
        data.hunger = 0;
        data.bloodPotency = 0;
      }
      if (restoring && data.grappledBy) {
        const holder = store.get(data.grappledBy);
        check(
          holder?._type === "characters" &&
            holder.campaignId === data.campaignId,
          "Agarramento com participante incompatível no backup.",
        );
      }
      if (restoring) {
        for (const p of data.alchemy.preparations) {
          const formula = store.get(p.formulaId),
            vessel = p.vesselId && store.get(p.vesselId);
          check(
            formula?.kind === "formula" &&
              formula.parentId === ALCHEMY &&
              p.method === data.thinBlood.alchemyMethod,
            "Preparação de Alquimia incompatível no backup.",
          );
          check(
            (p.method === "fixatio" &&
              ["carried", "stored"].includes(p.location) &&
              !p.distillation &&
              !p.vesselId) ||
              (p.method === "athanor" &&
                p.location === "body" &&
                (!!p.distillation ||
                  (p.formulaId === FLIGHT && p.crafting.nights < 3)) &&
                !p.vesselId) ||
              (p.method === "calcinatio" &&
                p.location === "vessel" &&
                (!!p.distillation ||
                  (p.formulaId === FLIGHT && p.crafting.nights < 3)) &&
                vessel?.nature === "mortal" &&
                vessel.campaignId === data.campaignId),
            "Local, dados ou receptáculo incompatíveis no backup.",
          );
        }
        for (const a of data.alchemy.activations) {
          if (a.formulaId === ENVELOP && a.status === "active")
            check(
              a.targets.length === 2,
              "Envolver precisa de um único alvo externo no backup.",
            );
          check(
            a.targets.every(
              (key: string) =>
                store.get(key)?._type === "characters" &&
                store.get(key).campaignId === data.campaignId,
            ) &&
              a.formulaTests.every(
                (t: any) =>
                  t.status !== "pending" ||
                  !t.targetId ||
                  (store.get(t.targetId)?._type === "characters" &&
                    store.get(t.targetId).campaignId === data.campaignId),
              ) &&
              store.get(a.formulaId)?.kind === "formula",
            "Alvo ou fórmula de Alquimia incompatível no backup.",
          );
        }
      }
      check(safeImage(data.portrait), "Retrato inválido.");
      check(
        data.xpSpent <= data.xpTotal,
        "Experiência gasta não pode exceder a recebida.",
      );
      if (data.clanId)
        check(
          ["clan", "lineage"].includes(store.get(data.clanId)?.kind),
          "Clã inexistente.",
        );
      if (data.coterieId)
        check(
          store.get(data.coterieId)?._type === "coteries" &&
            store.get(data.coterieId).campaignId === data.campaignId,
          "Coterie incompatível com a campanha.",
        );
      for (const key of Object.keys(data.disciplines))
        check(store.get(key)?.kind === "discipline", "Disciplina inexistente.");
      for (const key of data.powers)
        check(
          ["power", "ritual", "ceremony", "formula"].includes(
            store.get(key)?.kind,
          ),
          "Poder inexistente.",
        );
      for (const a of data.advantages) {
        const entry = store.get(a.contentId);
        check(
          entry && ["merit", "flaw", "background"].includes(entry.kind),
          "Vantagem ou Defeito inexistente.",
        );
        check(
          a.level >= entry.minLevel && a.level <= entry.maxLevel,
          "Pontos de Vantagem ou Defeito fora dos níveis permitidos.",
        );
        check(
          entry.category !== "Sangue-Ralo" ||
            (data.nature === "vampire" && data.generation >= 14),
          "Estas características exigem um Sangue-Ralo.",
        );
      }
      if (restoring) {
        check(
          data.bloodBonds.filter(
            (b: any) =>
              b.formed &&
              b.strength > 0 &&
              (!b.releaseOn ||
                b.releaseOn >
                  (store.get(data.campaignId)?.storyDate || data.storyDate)),
          ).length <= 1,
          "Uma ficha não pode ter dois reinantes ativos.",
        );
        check(
          new Set(data.bloodBonds.map((b: any) => b.regnantId)).size ===
            data.bloodBonds.length,
          "Laços duplicados com o mesmo reinante.",
        );
      }
      if (restoring)
        for (const b of data.bloodBonds) {
          const donor = store.get(b.regnantId);
          check(
            donor?._type === "characters" &&
              donor.id !== data.id &&
              donor.campaignId === data.campaignId,
            "Laço com reinante incompatível no backup.",
          );
          check(
            b.strength > 0 || !b.formed,
            "Laço formado sem Força no backup.",
          );
          check(
            b.lastDrink &&
              b.formationNights.every((n: string) => n && n <= b.lastDrink),
            "Datas de bebida inválidas no backup.",
          );
          check(!b.formed || b.formedOn, "Laço formado sem data no backup.");
        }
      for (const entry of data.inventory)
        check(
          store.get(entry.contentId)?.kind === "equipment",
          "Equipamento inexistente.",
        );
      for (const [field, kinds] of [
        ["affinityDiscipline", ["discipline"]],
        ["affinityPower", ["power"]],
        ["clanCurse", ["clan", "lineage"]],
        ["initialFormula", ["formula"]],
      ] as const) {
        const selected = data.thinBlood[field];
        if (selected)
          check(
            kinds.includes(store.get(selected)?.kind as never),
            "Escolha de Sangue-Ralo referencia conteúdo inexistente ou incompatível.",
          );
      }
      if (old?.status === "active" && !isGM(store, old, u))
        check(
          JSON.stringify(data.thinBlood) === JSON.stringify(old.thinBlood),
          "Escolhas iniciais de Sangue-Ralo não podem ser alteradas pelo jogador após a criação.",
        );
      if (old?.status === "active" && old.thinBlood.alchemyMethod)
        check(
          data.thinBlood.alchemyMethod === old.thinBlood.alchemyMethod,
          "Um método aprendido não pode ser substituído; métodos adicionais exigem aquisição separada.",
        );
      if (old && u.role !== "narrator")
        for (const key of [
          "xpTotal",
          "xpSpent",
          "status",
          "ownerId",
          ...(old.status === "draft"
            ? []
            : [
                "bloodPotency",
                "generation",
                "nature",
                "campaignId",
                "clanId",
                "predatorId",
              ]),
        ])
          check(
            data[key] === old[key],
            "O Narrador deve autorizar a alteração deste campo.",
          );
    }
    if (
      type === "characters" &&
      old?.status === "active" &&
      !isGM(store, old, u)
    ) {
      for (const key of [
        "attributes",
        "skills",
        "disciplines",
        "powers",
        "advantages",
        "health",
        "willpower",
        "hunger",
        "humanity",
        "stains",
        "activeEffects",
        "specialties",
      ])
        check(
          JSON.stringify(data[key]) === JSON.stringify(old[key]),
          "Alterações mecânicas exigem ação do sistema ou autorização do Narrador.",
        );
      check(
        old.powers.every((key: string) => data.powers.includes(key)),
        "Somente o Narrador remove Poderes adquiridos.",
      );
      const newPowers = data.powers.filter(
        (key: string) => !old.powers.includes(key),
      );
      for (const key of newPowers) {
        const p = store.get(key);
        check(
          p?.kind === "power" &&
            (data.disciplines[p.parentId] ?? 0) >= p.level &&
            requirementsMet(p, data),
          "Poder não permitido.",
        );
      }
      for (const key of Object.keys(data.disciplines))
        check(
          data.powers.filter((pid: string) => {
            const p = store.get(pid);
            return p?.kind === "power" && p.parentId === key;
          }).length <= data.disciplines[key],
          "O número de Poderes excede os pontos da Disciplina.",
        );
    }
    if (type === "characters")
      data.aggravatedMendEligible = Math.min(
        data.aggravatedMendEligible,
        data.health.aggravated,
      );
    if (
      type === "characters" &&
      !restoring &&
      data.health.aggravated > (old?.health.aggravated ?? 0)
    )
      data.lastAggravatedDamageNight = nightKey(
        { ...data, id: old?.id ?? u.id },
        store.get(data.campaignId),
      );
    if (old && !isGM(store, old, u)) {
      data.privateNotes = old.privateNotes ?? "";
      if (type === "records") data.private = old.private;
    }
    if (!old && u.role === "player") {
      data.privateNotes = "";
      if (type === "records") {
        data.private = false;
        check(data.kind !== "secret", "Somente o Narrador cria segredos.");
      }
    }
    if (type === "coteries")
      check(
        data.members.every(
          (k: string) =>
            store.get(k)?._type === "characters" &&
            store.get(k).campaignId === data.campaignId,
        ),
        "Membro da Coterie fora da campanha.",
      );
  }
  function synchronizeCoterie(e: any) {
    if (e._type === "coteries") {
      for (const c of store.list("characters")) {
        if (e.members.includes(c.id) && c.coterieId !== e.id) {
          const prior = store.get(c.coterieId);
          if (prior?._type === "coteries")
            store.update(
              prior.id,
              {
                ...prior,
                members: prior.members.filter((key: string) => key !== c.id),
              },
              prior.version,
            );
          store.update(c.id, { ...c, coterieId: e.id }, c.version);
        } else if (!e.members.includes(c.id) && c.coterieId === e.id)
          store.update(c.id, { ...c, coterieId: "" }, c.version);
      }
    } else if (e._type === "characters") {
      for (const group of store.list("coteries")) {
        const has = group.members.includes(e.id),
          should = group.id === e.coterieId;
        if (has !== should)
          store.update(
            group.id,
            {
              ...group,
              members: should
                ? [...group.members, e.id]
                : group.members.filter((key: string) => key !== e.id),
            },
            group.version,
          );
      }
    }
  }
  function clockEntry(req: Request, res: Response) {
    const e = getEntity(req, res, true),
      u = res.locals.user as User;
    check(
      ["campaigns", "characters"].includes(e._type) && isGM(store, e, u),
      "Somente o Narrador avança o tempo.",
    );
    check(
      e._type !== "characters" || !e.campaignId,
      "Avance o tempo pela campanha para manter todos sincronizados.",
    );
    return { e, u };
  }
  function updateTime(
    e: any,
    u: User,
    scope: "night" | "scene" | "turn" | undefined,
    date: string,
    reason = "",
  ) {
    const clock = scope ? nextClock(e.clock, scope) : e.clock,
      characters =
        e._type === "campaigns"
          ? store.list("characters").filter((c) => c.campaignId === e.id)
          : [e];
    const sustained =
      scope === "turn"
        ? sustainedAlchemy(characters, (c) =>
            turnKey(c, e._type === "campaigns" ? e : undefined),
          )
        : new Set<string>();
    if (e._type === "campaigns")
      store.update(e.id, { ...e, clock, storyDate: date }, e.version);
    for (const c of characters) {
      const elapsed =
        scope === "night" && e.storyDate && date
          ? Math.max(
              1,
              Math.round(
                (Date.parse(date + "T00:00:00Z") -
                  Date.parse(e.storyDate + "T00:00:00Z")) /
                  86400000,
              ),
            )
          : 1;
      let out = scope
        ? expireEffects(preserveSustainedAlchemy(c, sustained), scope, elapsed)
        : structuredClone(c);
      if (scope) out = tickConcentration(out, scope);
      if (scope)
        for (const activation of out.alchemy.activations) {
          activation.review.state = "closed";
          closeFormulaTests(activation);
        }
      out = settleBondReleases(out, date);
      if (e._type === "characters") {
        out.clock = clock;
        out.storyDate = date;
      }
      if (scope === "night") out.aggravatedMendEligible = c.health.aggravated;
      store.update(c.id, out, c.version);
      store.audit(c.id, u.id, "Avanço de tempo", {
        scope,
        clock,
        date,
        reason,
      });
    }
    for (const old of characters) {
      const c = store.get(old.id);
      let changed = false;
      for (const a of c.alchemy.activations) {
        if (
          a.status === "active" &&
          !([LONG_REACH, ENVELOP, FLIGHT].includes(a.formulaId)
            ? c.activeEffects.some((effect: any) =>
                effect.effectKey.startsWith(`alchemy:${a.id}:`),
              )
            : a.targets.some((key: string) =>
                store
                  .get(key)
                  ?.activeEffects.some((effect: any) =>
                    effect.effectKey.startsWith(`alchemy:${a.id}:`),
                  ),
              ))
        ) {
          if ([LONG_REACH, ENVELOP, FLIGHT].includes(a.formulaId))
            for (const key of a.targets.filter((key: string) => key !== c.id)) {
              const target = store.get(key);
              if (
                target?.activeEffects.some((effect: any) =>
                  effect.effectKey.startsWith(`alchemy:${a.id}:`),
                )
              ) {
                store.update(
                  target.id,
                  endAlchemyEffects(target, a.id),
                  target.version,
                );
                store.audit(
                  target.id,
                  u.id,
                  a.formulaId === ENVELOP
                    ? "Envolver encerrado"
                    : "Sustentação de Longo Alcance encerrada",
                  { from: c.id, activationId: a.id },
                );
              }
            }
          a.status = "ended";
          a.longReach.sustaining = false;
          a.flight = { airborne: false, passengerId: "", load: "" };
          changed = true;
        }
      }
      if (changed) store.update(c.id, c, c.version);
    }
    store.audit(e.id, u.id, "Marcador narrativo atualizado", {
      scope,
      clock,
      date,
      reason,
    });
  }
  app.post("/api/clock/:id/advance", (req, res) => {
    const { e, u } = clockEntry(req, res),
      scope = parse(z.enum(["night", "scene", "turn"]), req.body.scope);
    const date =
      scope === "night" && e.storyDate ? addDays(e.storyDate, 1) : e.storyDate;
    store.transaction(() => updateTime(e, u, scope, date));
    res.json({ ok: true });
  });
  app.post("/api/clock/:id/date", (req, res) => {
    const { e, u } = clockEntry(req, res),
      date = requireStoryDate(parse(storyDateSchema, req.body.date)),
      reason = parse(z.string().trim().min(3).max(2000), req.body.reason);
    check(
      !e.storyDate || date > e.storyDate,
      "Use uma data posterior à atual. Correções retroativas exigem restauração ou resolução manual.",
    );
    store.transaction(() =>
      updateTime(e, u, e.storyDate ? "night" : undefined, date, reason),
    );
    res.json({ ok: true });
  });
  function applyBondDrink(
    reader: Character,
    donor: Character,
    u: User,
    date: string,
  ) {
    check(
      reader.campaignId === donor.campaignId,
      "Laços automatizados exigem a mesma crônica; use resolução manual para outros vínculos.",
    );
    const r = drinkForBond(reader, donor, store.catalog(), date, randomUUID());
    if (r.formed) {
      const b = r.character.bloodBonds.find((x) => x.id === r.bondId)!;
      b.formedOrder =
        store
          .list("characters")
          .reduce(
            (highest, c) =>
              c.bloodBonds.reduce(
                (n: number, b: any) => Math.max(n, b.formedOrder),
                highest,
              ),
            0,
          ) + 1;
      check(
        b.formedOrder <= 1000000000,
        "O limite de registros ordenados foi atingido.",
      );
    }
    if (r.formed && donor.bloodPotency > 0) {
      const survivors = store
        .list("characters")
        .map((c) => (c.id === reader.id ? r.character : c))
        .flatMap((c) =>
          c.bloodBonds
            .filter(
              (b: any) =>
                b.regnantId === donor.id &&
                b.formed &&
                b.strength > 0 &&
                !b.releaseOn,
            )
            .map((b: any) => ({ c, b })),
        )
        .sort(
          (a, b) =>
            a.b.formedOn.localeCompare(b.b.formedOn) ||
            a.b.formedOrder - b.b.formedOrder,
        );
      if (survivors.length > donor.bloodPotency) {
        const oldest = survivors[0];
        check(
          isGM(store, oldest.c, u),
          "O Narrador precisa ter acesso ao servo afetado pelo limite de Potência.",
        );
        oldest.b.releaseOn = addDays(date, 7);
        if (oldest.c.id !== reader.id) {
          store.update(oldest.c.id, oldest.c, oldest.c.version);
          store.audit(
            oldest.c.id,
            u.id,
            "Laço excedeu a capacidade do reinante",
            { donorId: donor.id, releaseOn: oldest.b.releaseOn },
          );
        }
        r.message +=
          " O Laço mais antigo se desfará ao longo da semana; encerramento registrado para " +
          oldest.b.releaseOn +
          ".";
      }
    } else if (r.formed && donor.bloodPotency === 0)
      r.message +=
        " O limite de servos em Potência zero exige resolução do Narrador.";
    return r;
  }
  app.get("/api/state", (_req, res) => {
    const u = res.locals.user as User;
    res.json(
      Object.fromEntries(
        Object.keys(entitySchemas).map((type) => [
          type,
          store
            .list(type as EntityType)
            .filter((e) => visible(store, e, u))
            .map((e) => ({
              ...publicEntity(store, e, u),
              canEdit: editable(store, e, u),
              isGM: isGM(store, e, u),
              ...(type === "characters"
                ? { derived: derived(e, store.catalog()) }
                : {}),
            })),
        ]),
      ),
    );
  });
  app.post("/api/entities/:type", (req, res) => {
    const u = res.locals.user as User,
      type = String(req.params.type) as EntityType;
    if (!(type in entitySchemas))
      httpError(404, "Tipo de registro desconhecido.");
    const data = parse(entitySchemas[type] as z.ZodType<any>, req.body);
    integrity(type, data, u);
    const entityId = randomUUID();
    if (type === "characters" && data.health.aggravated > 0 && !data.campaignId)
      data.lastAggravatedDamageNight = entityId + "@1";
    let owner = u.id;
    if (type === "characters" && data.ownerId && data.ownerId !== u.id) {
      const camp = store.get(data.campaignId);
      check(
        camp?.gmId === u.id && camp.members.includes(data.ownerId),
        "O proprietário deve ser jogador desta campanha.",
      );
      owner = data.ownerId;
    }
    const e = store.transaction(() => {
      const e = store.create(type, data, owner, entityId);
      synchronizeCoterie(e);
      store.audit(e.id, u.id, "Criação", { name: e.name });
      return e;
    });
    res.status(201).json(publicEntity(store, e, u));
  });
  app.put("/api/entities/:id", (req, res) => {
    const old = getEntity(req, res, true),
      u = res.locals.user as User;
    const data = parse(
      entitySchemas[old._type as EntityType] as z.ZodType<any>,
      req.body,
    );
    integrity(old._type, data, u, old);
    const version = parse(z.number().int().min(1), req.body.version);
    const e = store.transaction(() => {
      const e = store.update(old.id, data, version);
      synchronizeCoterie(e);
      store.audit(old.id, u.id, "Edição", {
        name: e.name,
        ...(old._type === "characters" &&
        JSON.stringify(old.thinBlood) !== JSON.stringify(e.thinBlood)
          ? { thinBlood: { before: old.thinBlood, after: e.thinBlood } }
          : {}),
      });
      return e;
    });
    res.json(publicEntity(store, e, u));
  });
  app.delete("/api/entities/:id", (req, res) => {
    const e = getEntity(req, res, true),
      u = res.locals.user as User;
    check(
      req.body.confirm === e.name,
      "Confirme a exclusão digitando o nome do registro.",
    );
    if (e._type === "content") {
      const all = Object.keys(entitySchemas).flatMap((t) =>
        store.list(t as EntityType),
      );
      check(
        !all.some(
          (x) =>
            x.id !== e.id &&
            (x.disciplines?.[e.id] ||
              (Array.isArray(x.disciplines) && x.disciplines.includes(e.id)) ||
              x.powers?.includes(e.id) ||
              x.clanId === e.id ||
              x.predatorId === e.id ||
              x.parentId === e.id ||
              x.advantages?.some((a: any) => a.contentId === e.id) ||
              x.inventory?.some((a: any) => a.contentId === e.id) ||
              x.requirements?.some((r: any) => r.target === e.id)),
        ),
        "Este conteúdo ainda está vinculado. Remova os vínculos antes de excluir.",
      );
    }
    if (e._type === "coteries")
      check(
        !store.list("characters").some((c) => c.coterieId === e.id),
        "Remova os membros da Coterie antes de arquivar.",
      );
    if (e._type === "characters")
      check(!e.coterieId, "Remova o personagem da Coterie antes de arquivar.");
    if (e._type === "characters")
      check(
        !store
          .list("characters")
          .some((c) => c.bloodBonds.some((b: any) => b.regnantId === e.id)),
        "Este personagem é citado em um registro de Laço; preserve o vínculo histórico antes de arquivar.",
      );
    if (e._type === "characters")
      check(
        !e.grappledBy &&
          !store.list("characters").some((c) => c.grappledBy === e.id),
        "Encerre os agarramentos antes de arquivar a ficha.",
      );
    if (e._type === "characters")
      check(
        !e.alchemy.preparations.length &&
          !e.alchemy.activations.some((a: any) => a.status !== "ended") &&
          !store
            .list("characters")
            .some(
              (c) =>
                c.alchemy.preparations.some((p: any) => p.vesselId === e.id) ||
                c.alchemy.activations.some(
                  (a: any) => a.status !== "ended" && a.targets.includes(e.id),
                ),
            ),
        "Descarte preparações e encerre os efeitos de Alquimia vinculados antes de arquivar.",
      );
    if (e._type === "campaigns")
      check(
        !["characters", "coteries", "records"].some((t) =>
          store.list(t as EntityType).some((x) => x.campaignId === e.id),
        ),
        "A campanha possui registros vinculados; arquive-os primeiro.",
      );
    store.transaction(() => {
      store.markDeleted(e.id, true);
      store.audit(e.id, u.id, "Arquivamento");
    });
    res.json({ ok: true });
  });
  app.get("/api/trash", (_req, res) => {
    const u = res.locals.user as User;
    res.json(
      Object.keys(entitySchemas)
        .flatMap((t) => store.list(t as EntityType, true))
        .filter((e) => editable(store, e, u))
        .map((e) => ({ id: e.id, name: e.name, type: e._type })),
    );
  });
  app.post("/api/trash/:id/restore", (req, res) => {
    const e = store.get(String(req.params.id), true),
      u = res.locals.user as User;
    check(
      e?._deleted && editable(store, e, u),
      "Registro indisponível para restauração.",
    );
    store.markDeleted(e.id, false);
    store.audit(e.id, u.id, "Restauração");
    res.json({ ok: true });
  });
  app.get("/api/characters/:id/validation", (req, res) => {
    const c = getEntity(req, res, false, "characters");
    res.json({ problems: validateCreation(c, store.catalog()) });
  });
  app.post("/api/characters/:id/finalize", (req, res) => {
    const c = getEntity(req, res, true, "characters"),
      u = res.locals.user as User;
    check(c.status === "draft", "A criação já foi concluída.");
    const problems = validateCreation(c, store.catalog());
    if (problems.length) {
      check(
        isGM(store, c, u) &&
          typeof req.body.exception === "string" &&
          req.body.exception.trim().length >= 10,
        "Corrija a ficha ou peça uma exceção fundamentada ao Narrador.",
      );
      c.creation.approvedException = req.body.exception;
    }
    const out = finishCreation(c, store.catalog());
    store.transaction(() => {
      store.update(c.id, out, c.version);
      store.audit(c.id, u.id, "Conclusão da criação", {
        problems,
        exception: c.creation.approvedException,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/characters/:id/roll", (req, res) => {
    const c = getEntity(req, res, true, "characters"),
      u = res.locals.user as User,
      data = parse(rollSchema, req.body),
      catalog = store.catalog();
    const camp = store.get(c.campaignId),
      ruleset = camp?.ruleset ?? "companion";
    check(
      data.mode === "frenzy" || !concentrating(c),
      "Athanor exige concentração exclusiva; descarte a preparação para interrompê-la.",
    );
    check(
      !envelopActionBlocked(c),
      "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
    );
    const rollTarget = data.targetId ? store.get(data.targetId) : undefined;
    if (data.targetContext && data.targetContext !== "visual")
      check(
        data.mode === "normal" &&
          rollTarget?._type === "characters" &&
          visible(store, rollTarget, u) &&
          rollTarget.campaignId === c.campaignId,
        "Selecione um alvo acessível da mesma campanha para este contexto.",
      );
    check(
      c.nature !== "mortal" || data.mode !== "frenzy",
      "Mortais não possuem Besta para testar Frenesi.",
    );
    if (data.mode === "frenzy")
      check(
        canTestFrenzy(c, data.tags.includes("provocacaoSobrenatural")),
        "Sangue-Ralo não sofre Frenesi espontâneo sem Temperamento Bestial; confirme uma provocação sobrenatural.",
      );
    const details = store.transaction(() => {
      let rouseResult;
      let n = 0;
      if (data.mode === "normal") {
        check(
          data.attribute in c.attributes || data.attribute in c.disciplines,
          "Atributo ou Disciplina não encontrado.",
        );
        check(
          !data.skill ||
            data.skill in c.skills ||
            data.skill in c.attributes ||
            data.skill in c.disciplines,
          "Perícia ou Disciplina não encontrada.",
        );
        if (data.specialty)
          check(
            c.specialties[data.skill]?.length,
            "A Perícia não possui especialização.",
          );
        if (
          c.lastBlushNight === nightKey(c, camp) ||
          c.humanity >= 9 ||
          c.generation >= 14
        )
          data.tags = [...new Set([...data.tags, "brilhoVida"])];
        n = pool(
          c,
          catalog,
          data,
          data.modifier -
            (["identify", "ranged"].includes(data.targetContext)
              ? fogPenalty(rollTarget)
              : 0),
          data.specialty,
          ruleset,
          data.skill.startsWith("discipline-"),
        );
        if (data.surge) {
          check(c.nature !== "mortal", "Mortais não usam Surto de Sangue.");
          n += blood(c.bloodPotency, ruleset).surge;
          rouseResult = rouse(c.hunger, {}, die);
        }
      } else {
        check(!data.surge, "Surto não se aplica a rolagens de trilha.");
        const d = derived(c, catalog);
        n =
          data.mode === "humanity"
            ? Math.max(1, c.humanity)
            : Math.max(
                1,
                d.willpowerMax -
                  c.willpower.superficial -
                  c.willpower.aggravated,
              ) + (data.mode === "frenzy" ? Math.floor(c.humanity / 3) : 0);
      }
      if (
        data.mode === "frenzy" &&
        effectiveBaneClan(c) === "clan-brujah" &&
        data.tags.includes("frenesiFuria")
      )
        n = Math.max(
          1,
          n - (isThinBlood(c) ? 1 : blood(c.bloodPotency, ruleset).bane),
        );
      const result = roll(
        n,
        c.nature === "mortal" ? 0 : c.hunger,
        data.difficulty,
        die,
        data.mode !== "normal",
      );
      if (rouseResult)
        store.update(c.id, { ...c, hunger: rouseResult.hunger }, c.version);
      return store.logRoll(c.id, u.id, {
        result,
        mode: data.mode,
        context: data,
        label: data.label || "Teste de " + (data.attribute || data.mode),
        rouse: rouseResult,
        rerolled: false,
      });
    });
    res.json(details);
  });
  app.get("/api/characters/:id/rolls", (req, res) => {
    const c = getEntity(req, res, false, "characters");
    res.json(
      (
        store.db
          .prepare(
            "SELECT * FROM rolls WHERE character_id=? ORDER BY date DESC LIMIT 100",
          )
          .all(c.id) as any[]
      ).map((r) => ({ id: r.id, date: r.date, ...JSON.parse(r.data) })),
    );
  });
  app.get("/api/characters/:id/history", (req, res) => {
    const c = getEntity(req, res, false, "characters"),
      u = res.locals.user as User;
    res.json(
      (
        store.db
          .prepare(
            "SELECT date,action,detail FROM audit WHERE entity_id=? ORDER BY date DESC LIMIT 100",
          )
          .all(c.id) as any[]
      ).map((r) => ({
        ...r,
        detail: isGM(store, c, u) ? JSON.parse(r.detail) : {},
      })),
    );
  });
  app.post("/api/rolls/:id/reroll", (req, res) => {
    const u = res.locals.user as User,
      r = store.db
        .prepare("SELECT * FROM rolls WHERE id=?")
        .get(String(req.params.id)) as any;
    check(r, "Rolagem não encontrada.");
    const c = store.get(r.character_id);
    check(c && editable(store, c, u), "Sem acesso à rolagem.");
    check(
      !envelopActionBlocked(c),
      "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
    );
    const saved = JSON.parse(r.data);
    check(
      saved.mode === "normal" && !saved.rerolled,
      "Esta rolagem não permite outra rerrolagem de Força de Vontade.",
    );
    const indices = parse(
      z.array(z.number().int()).min(1).max(3),
      req.body.indices,
    );
    check(
      c.willpower.aggravated < derived(c, store.catalog()).willpowerMax,
      "Força de Vontade indisponível.",
    );
    const result = reroll(saved.result, indices, die);
    store.transaction(() => {
      const wp = applyDamage(
        c.willpower,
        derived(c, store.catalog()).willpowerMax,
        1,
        false,
        false,
      );
      store.update(c.id, { ...c, willpower: wp }, c.version);
      store.db.prepare("UPDATE rolls SET data=? WHERE id=?").run(
        JSON.stringify({
          ...saved,
          result,
          original: saved.result,
          rerolled: true,
        }),
        r.id,
      );
      store.audit(c.id, u.id, "Rerrolagem de Força de Vontade", {
        rollId: r.id,
      });
    });
    res.json({ id: r.id, ...saved, result, rerolled: true });
  });
  app.post("/api/characters/:id/alchemy", (req, res) => {
    const c = getEntity(req, res, true, "characters") as Character,
      u = res.locals.user as User,
      data = parse(alchemyActionSchema, req.body),
      catalog = store.catalog();
    const characters = store
      .list("characters")
      .filter((x) => x.campaignId === c.campaignId && visible(store, x, u));
    check(
      [...data.targetIds, ...(data.targetId ? [data.targetId] : [])].every(
        (key) => characters.some((x) => x.id === key && editable(store, x, u)),
      ),
      "O Narrador ou proprietário do alvo deve autorizar o efeito.",
    );
    if (["rerollFormulaTest", "acceptFormulaTest"].includes(data.operation)) {
      const test = c.alchemy.activations
        .find((a) => a.id === data.activationId)
        ?.formulaTests.find((t) => t.id === data.testId);
      if (test?.targetId)
        check(
          characters.some(
            (x) => x.id === test.targetId && editable(store, x, u),
          ),
          "O Narrador ou proprietário do alvo deve autorizar o efeito.",
        );
    }
    if (
      ["formulaTest", "rerollFormulaTest", "acceptFormulaTest"].includes(
        data.operation,
      )
    ) {
      const activation = c.alchemy.activations.find(
        (a) => a.id === data.activationId,
      );
      if (activation && [ENVELOP, FLIGHT].includes(activation.formulaId))
        check(
          activation.targets.every((key) =>
            characters.some((x) => x.id === key && editable(store, x, u)),
          ),
          "O Narrador ou proprietário do alvo deve autorizar o efeito.",
        );
    }
    const result = store.transaction(() => {
      const operation = alchemyOperation(
        c,
        catalog,
        data,
        {
          gm: isGM(store, c, u),
          campaign: store.get(c.campaignId),
          characters,
          id: randomUUID,
        },
        die,
      );
      for (const target of operation.targets) {
        check(
          editable(store, store.get(target.id), u),
          "O Narrador ou proprietário do alvo deve autorizar o efeito.",
        );
        if (target.health.aggravated > store.get(target.id).health.aggravated)
          target.lastAggravatedDamageNight = nightKey(
            target,
            store.get(target.campaignId),
          );
        target.aggravatedMendEligible = Math.min(
          target.aggravatedMendEligible,
          target.health.aggravated,
        );
        store.update(target.id, target, target.version);
        store.audit(target.id, u.id, "Efeito de Alquimia", {
          from: c.id,
          operation: data.operation,
        });
      }
      operation.character.aggravatedMendEligible = Math.min(
        operation.character.aggravatedMendEligible,
        operation.character.health.aggravated,
      );
      if (operation.character.health.aggravated > c.health.aggravated)
        operation.character.lastAggravatedDamageNight = nightKey(
          c,
          store.get(c.campaignId),
        );
      store.update(c.id, operation.character, c.version);
      store.audit(
        c.id,
        u.id,
        "Alquimia: " + alchemyOperationLabels[data.operation],
        {
          request: data,
          ...operation.result,
        },
      );
      if (
        operation.result.distillation ||
        operation.result.rouses.length ||
        operation.result.formulaTest
      )
        store.logRoll(c.id, u.id, {
          mode: "alchemy",
          label: operation.result.formulaTest
            ? (operation.result.formulaTest.mode === "suffocate"
                ? "Asfixia de Envolver"
                : ["fly", "carry", "capture", "ground", "land"].includes(
                      operation.result.formulaTest.mode,
                    )
                  ? "Uso de Impulso Suspenso no Ar"
                  : "Teste de Longo Alcance") +
              (data.operation === "rerollFormulaTest"
                ? data.side === "actor"
                  ? " — rerrolagem do usuário"
                  : " — rerrolagem da resistência"
                : "")
            : "Destilação e ativação de Alquimia",
          ...operation.result,
          rerolled: operation.result.review?.rerolled ?? false,
        });
      return operation.result;
    });
    res.json({ result });
  });
  app.post("/api/characters/:id/action", (req, res) => {
    const c = getEntity(req, res, true, "characters") as Character,
      u = res.locals.user as User,
      data = parse(actionSchema, req.body),
      catalog = store.catalog(),
      d = derived(c, catalog),
      campaign = store.get(c.campaignId),
      ruleset = campaign?.ruleset ?? "companion";
    let out = structuredClone(c),
      result: any = {};
    if (envelopActionBlocked(c))
      check(
        ["damage", "xp", "stains", "expire"].includes(data.action),
        "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
      );
    if (concentrating(c))
      check(
        ["damage", "xp", "stains", "expire"].includes(data.action),
        "Athanor exige concentração exclusiva; descarte a preparação para interrompê-la.",
      );
    check(
      c.nature !== "mortal" ||
        ![
          "rouse",
          "mend",
          "mendAggravated",
          "blush",
          "feed",
          "bondDrink",
          "power",
        ].includes(data.action),
      "Esta ação vampírica não se aplica a mortais.",
    );
    store.transaction(() => {
      if (data.action === "damage") {
        check(data.amount > 0, "Informe uma quantidade positiva de dano.");
        const hit = receiveDamage(c, catalog, {
          amount: data.amount,
          track: data.track,
          aggravated: data.aggravated,
        });
        out = hit.character;
        result = hit.report;
      } else if (data.action === "rouse") {
        if (data.waking) {
          const r = wakeForNight(c, campaign, die);
          out = r.character;
          result = r.result;
        } else {
          result = rouse(c.hunger, { forced: data.forced }, die);
          out.hunger = result.hunger;
        }
        if (!canTestFrenzy(c, data.tags.includes("provocacaoSobrenatural")))
          result.frenzy = false;
        if (result.frenzy)
          result.message = "Teste imediato de Frenesi de Fome, dificuldade 4.";
      } else if (data.action === "mend") {
        const r = mendSuperficial(c, catalog, campaign, die);
        out = r.character;
        result = r.result;
      } else if (data.action === "mendAggravated") {
        const r = mendAggravated(c, campaign, die);
        out = r.character;
        result = r.result;
      } else if (data.action === "blush") {
        const r = blushOfLife(c, campaign, die);
        out = r.character;
        result = r.result;
      } else if (data.action === "sessionRecovery") {
        const session = store
          .list("records")
          .find(
            (s) =>
              s.kind === "session" &&
              s.status === "Em andamento" &&
              s.campaignId === c.campaignId &&
              s.participants.includes(c.id),
          );
        check(
          session,
          "Inicie uma sessão com este personagem para recuperar Força de Vontade.",
        );
        const r = recoverWillpower(c, catalog, session.id);
        out = r.character;
        result = { recovered: r.recoveredSuperficial };
      } else if (data.action === "stains") {
        check(isGM(store, c, u), "O Narrador registra as Máculas.");
        check(data.reason.trim(), "Descreva o acontecimento.");
        out = addStains(c, data.amount, catalog);
      } else if (data.action === "remorse") {
        const r = remorse(c, die);
        out = r.character;
        result = r.result;
        store.logRoll(c.id, u.id, {
          mode: "remorse",
          label: "Remorso",
          result,
          rerolled: false,
        });
      } else if (data.action === "feed") {
        if (data.source === "vampire") {
          check(
            !data.killed && !data.processed,
            "Selecione apenas as opções de sangue vampírico.",
          );
          const donor = store.get(data.targetId);
          check(
            donor?._type === "characters" &&
              isGM(store, c, u) &&
              isGM(store, donor, u),
            "O Narrador deve ter acesso ao bebedor e ao doador.",
          );
          const r = feedFromVampire(c, donor, data.amount, ruleset);
          out = r.reader;
          let bondMessage = "";
          if (data.direct) {
            if (data.bondHandling === "manual") {
              check(
                data.reason.trim().length >= 3,
                "Justifique a resolução manual do Laço.",
              );
              bondMessage = "Laço em resolução manual: " + data.reason;
            } else {
              const bond = applyBondDrink(
                out,
                donor,
                u,
                storyDate(c, campaign),
              );
              out = bond.character;
              bondMessage = bond.message;
            }
          }

          store.update(donor.id, r.donor, donor.version);
          store.audit(donor.id, u.id, "Doação de Sangue", {
            readerId: c.id,
            amount: data.amount,
            direct: data.direct,
          });
          result = {
            before: c.hunger,
            after: out.hunger,
            donorHunger: r.donor.hunger,
            ratio: r.ratio,
            message: data.direct
              ? bondMessage
              : "A saciedade foi registrada; o sangue fora da veia exige conferir tempo e conservação.",
          };
        } else {
          const iron = c.advantages.some(
            (a) => a.contentId === "merit-garganta-de-ferro",
          );
          out.hunger = feed(c, { ...data, source: data.source, iron }, ruleset);
          result = { before: c.hunger, after: out.hunger, source: data.source };
        }
      } else if (data.action === "bondDrink") {
        const donor = store.get(data.targetId);
        check(
          donor?._type === "characters" &&
            isGM(store, c, u) &&
            isGM(store, donor, u),
          "O Narrador deve ter acesso ao bebedor e ao doador.",
        );
        check(data.narrativeConfirmed, "Confirme o consumo direto da veia.");
        const r = applyBondDrink(c, donor, u, storyDate(c, campaign));
        out = r.character;
        result = { message: r.message };
      } else if (data.action === "bondDecay") {
        check(isGM(store, c, u), "Somente o Narrador confirma a decadência.");
        check(
          data.avoided && data.reason.trim().length >= 3,
          "Confirme o afastamento, os desafios por sessão e sua justificativa.",
        );
        const r = decayBloodBond(
          c,
          catalog,
          data.bondId,
          storyDate(c, campaign),
          data.moonPhase,
        );
        out = r.character;
        result = {
          ...r,
          character: undefined,
          message: r.broken
            ? "O Laço foi quebrado."
            : "Força do Laço reduzida para " + r.strength + ".",
        };
      } else if (["bondDefy", "bondAvoid"].includes(data.action)) {
        check(
          !data.reminder ||
            (isGM(store, c, u) && data.reason.trim().length >= 3),
          "Somente o Narrador autoriza um novo desafio por lembrança, com justificativa.",
        );
        let sessionId: string | undefined;
        if (data.action === "bondAvoid") {
          const session = store
            .list("records")
            .find(
              (s) =>
                s.kind === "session" &&
                s.status === "Em andamento" &&
                s.campaignId === c.campaignId &&
                s.participants.includes(c.id),
            );
          check(
            session,
            "Inicie uma sessão com este personagem para registrar o afastamento.",
          );
          sessionId = session.id;
        }
        const r = defyBloodBond(
          c,
          catalog,
          data.bondId,
          {
            campaign,
            date: storyDate(c, campaign),
            present: data.present,
            sessionId,
            reminder: data.reminder,
            ruleset,
          },
          die,
        );
        out = r.character;
        result = {
          result: r.result,
          opposition: r.opposition,
          message: r.message,
        };
        store.logRoll(c.id, u.id, {
          mode: "normal",
          label:
            data.action === "bondAvoid"
              ? "Afastamento do Laço"
              : "Desafio ao Laço",
          context: {
            attribute: "determinacao",
            skill: "inteligencia",
            tags: ["resistirLaco"],
          },
          result: r.result,
          opposition: r.opposition,
          rerolled: false,
        });
      } else if (data.action === "xp") {
        check(isGM(store, c, u), "Somente o Narrador concede experiência.");
        check(
          data.amount > 0 && data.reason.trim(),
          "Informe experiência e justificativa.",
        );
        out.xpTotal += data.amount;
      } else if (data.action === "advance") {
        if (
          hasTrait(c, "flaw-dependencia-de-vitae") &&
          ["discipline", "formula"].includes(data.kind)
        )
          check(
            isGM(store, c, u) &&
              data.dependencyConfirmed &&
              data.note.trim().length >= 10,
            "Dependência de Vitae exige confirmação do Narrador de saciedade vampírica na última semana, com registro.",
          );
        const r = advance(
          c,
          catalog,
          data.kind,
          data.key,
          data.specialty,
          data.powerId,
          data.resonance,
          data.mentor,
          data.researchConfirmed,
          data.alchemyMethod,
        );
        out = r.character;
        result = { cost: r.cost };
      } else if (data.action === "expire") {
        check(
          !c.activeEffects.some((e) =>
            [ENVELOP, FLIGHT].includes(e.sourceId),
          ) || isGM(store, c, u),
          "O Narrador encerra durações de Alquimia; o usuário da fórmula pode encerrá-la pela ativação.",
        );
        out.activeEffects = c.activeEffects.filter((x) => {
          if (x.effect.duration !== data.scope) return true;
          return --x.remaining > 0;
        });
        out.conditions = out.conditions.filter(
          (name) =>
            !c.activeEffects.some(
              (x) => x.effect.kind === "condition" && x.effect.target === name,
            ) ||
            out.activeEffects.some(
              (x) => x.effect.kind === "condition" && x.effect.target === name,
            ),
        );
      } else if (data.action === "equip") {
        const item = out.inventory.find((x) => x.id === data.itemId);
        check(item, "Item não encontrado.");
        item!.equipped = data.equipped;
      } else if (data.action === "transfer") {
        const item = out.inventory.find((x) => x.id === data.itemId),
          target = store.get(data.targetId);
        check(
          item && target?._type === "characters" && editable(store, target, u),
          "Item ou destinatário indisponível.",
        );
        check(
          data.amount >= 1 && data.amount <= item!.quantity,
          "Quantidade insuficiente.",
        );
        item!.quantity -= data.amount;
        out.inventory = out.inventory.filter((x) => x.quantity > 0);
        target.inventory.push({
          ...item,
          id: randomUUID(),
          quantity: data.amount,
          equipped: false,
        });
        target.aggravatedMendEligible = Math.min(
          target.aggravatedMendEligible,
          target.health.aggravated,
        );
        store.update(target.id, target, target.version);
        store.audit(target.id, u.id, "Recebimento de equipamento", {
          from: c.id,
          amount: data.amount,
        });
      } else if (data.action === "power") {
        if (hasTrait(c, "flaw-dependencia-de-vitae"))
          check(
            isGM(store, c, u) &&
              data.dependencyConfirmed &&
              data.note.trim().length >= 10,
            "Dependência de Vitae exige confirmação do Narrador de saciedade vampírica na última semana, com registro.",
          );
        const p = catalog.find((p) => p.id === data.powerId);
        check(
          p &&
            ["power", "ritual", "ceremony", "formula"].includes(p.kind) &&
            c.powers.includes(p.id),
          "Poder não adquirido.",
        );
        check(
          requirementsMet(p!, c) &&
            (c.disciplines[p!.parentId] ?? 0) >= p!.level,
          "Pré-requisitos do Poder não satisfeitos.",
        );
        check(
          !(p!.kind === "formula" && p!.parentId === ALCHEMY),
          "Use Preparação e ativação de Alquimia na ficha; fórmulas precisam de destilação antes do uso.",
        );
        if (p!.automation === "unreviewed")
          check(
            isGM(store, c, u) &&
              data.narrativeConfirmed &&
              data.rouseCount !== undefined,
            "Esse Poder requer revisão e resolução manual do Narrador.",
          );
        const target = data.targetId ? store.get(data.targetId) : null;
        check(
          !target || target.id !== c.id,
          "Use efeitos no usuário para atingir o próprio personagem.",
        );
        if (target)
          check(
            target._type === "characters" && editable(store, target, u),
            "O Narrador ou proprietário do alvo deve resolver seu efeito.",
          );
        const count =
          p!.automation === "unreviewed" ? data.rouseCount! : p!.rouse;
        const passive =
          p!.duration === "permanent" &&
          count === 0 &&
          p!.willpowerCost === 0 &&
          !p!.attribute;
        if (!passive) {
          check(
            c.lastPowerTurn !== turnKey(c, campaign),
            "Um Poder de Disciplina já foi ativado neste turno.",
          );
          check(
            !c.conditions.includes("Torpor"),
            "Um personagem em Torpor não ativa Poderes voluntariamente.",
          );
          out.lastPowerTurn = turnKey(c, campaign);
        }

        check(
          count === 0 || c.hunger < 5,
          "Fome 5 impede a ativação que exige Despertar.",
        );
        let powerResult: any;
        const difficulty = data.difficulty ?? p!.difficulty;
        if (p!.attribute && p!.skill) {
          const n = pool(
            c,
            catalog,
            {
              attribute: p!.attribute,
              skill: p!.skill,
              tags: ["disciplina", ...data.tags],
            },
            0,
            false,
            ruleset,
            true,
          );
          powerResult = roll(n, c.hunger, difficulty, die);
        }
        let resistance: any;
        if (target && p!.resistanceAttribute && p!.resistanceSkill) {
          resistance = roll(
            pool(
              target,
              catalog,
              {
                attribute: p!.resistanceAttribute,
                skill: p!.resistanceSkill,
                tags: ["resistirCoercao"],
              },
              0,
              false,
              ruleset,
              true,
            ),
            target.hunger,
            0,
            die,
          );
          powerResult = evaluate(
            powerResult.normal,
            powerResult.hunger,
            resistance.successes,
          );
        }
        if (p!.willpowerCost) {
          check(
            c.willpower.aggravated + p!.willpowerCost <= d.willpowerMax,
            "Força de Vontade insuficiente.",
          );
          out.willpower = applyDamage(
            out.willpower,
            d.willpowerMax,
            p!.willpowerCost,
            false,
            false,
          );
        }
        if (!powerResult || powerResult.win) {
          for (const [effectIndex, effect] of p!.effects.entries()) {
            const recipient = effect.recipient === "target" ? target : out;
            check(recipient, "Selecione o alvo exigido pelo efeito.");
            if (
              ["damage", "heal", "resource", "condition"].includes(
                effect.kind,
              ) &&
              !matches(effect, recipient, { tags: data.tags })
            )
              continue;
            const value = effectValue(effect, c, p!, {
              margin: powerResult?.margin ?? 0,
            });
            if (effect.kind === "damage") {
              const hit = receiveDamage(recipient, catalog, {
                track: effect.target === "willpower" ? "willpower" : "health",
                amount: Math.max(0, value),
                aggravated: effect.aggravated,
              });
              Object.assign(recipient, hit.character);
            } else if (effect.kind === "heal") {
              const track =
                effect.target === "willpower"
                  ? recipient.willpower
                  : recipient.health;
              track[effect.aggravated ? "aggravated" : "superficial"] =
                Math.max(
                  0,
                  track[effect.aggravated ? "aggravated" : "superficial"] -
                    Math.max(0, value),
                );
            } else if (effect.kind === "resource") {
              check(
                ["hunger", "humanity", "stains"].includes(effect.target),
                "Recurso não automatizável.",
              );
              const max =
                effect.target === "hunger"
                  ? 5
                  : effect.target === "humanity"
                    ? 10
                    : 100;
              recipient[effect.target] = Math.min(
                max,
                Math.max(0, recipient[effect.target] + value),
              );
            } else if (
              effect.kind !== "narrative" &&
              !(
                effect.duration === "permanent" &&
                effect.recipient === "self" &&
                passive
              )
            ) {
              recipient.activeEffects = recipient.activeEffects.filter(
                (x: any) =>
                  !(
                    x.sourceId === p!.id &&
                    (x.effectKey
                      ? x.effectKey === String(effectIndex)
                      : JSON.stringify(x.effect) === JSON.stringify(effect))
                  ),
              );
              recipient.activeEffects.push({
                id: randomUUID(),
                sourceId: p!.id,
                effectKey: String(effectIndex),
                label: p!.name,
                effect:
                  effect.scale === "margin"
                    ? { ...effect, value, scale: "fixed" }
                    : effect,
                createdAt: new Date().toISOString(),
                remaining: data.duration,
              });
              if (
                effect.kind === "condition" &&
                !recipient.conditions.includes(effect.target)
              )
                recipient.conditions.push(effect.target);
            }
          }
        }
        const rouses = [];
        for (let i = 0; i < count; i++) {
          const r = rouse(
            out.hunger,
            {
              forced: i > 0 || c.hunger < 5,
              double:
                p!.kind === "power" &&
                p!.level <= blood(c.bloodPotency, ruleset).rerollLevel,
            },
            die,
          );
          if (!canTestFrenzy(c, data.tags.includes("provocacaoSobrenatural")))
            r.frenzy = false;
          out.hunger = r.hunger;
          rouses.push(r);
          if (r.frenzy) out.conditions.push("Frenesi de Fome: teste requerido");
        }
        if (target) {
          if (target.health.aggravated > store.get(target.id).health.aggravated)
            target.lastAggravatedDamageNight = nightKey(
              target,
              store.get(target.campaignId),
            );
          target.aggravatedMendEligible = Math.min(
            target.aggravatedMendEligible,
            target.health.aggravated,
          );
          store.update(target.id, target, target.version);
          store.audit(target.id, u.id, "Efeito de Poder", {
            power: p!.name,
            from: c.id,
          });
        }
        result = {
          power: p!.name,
          result: powerResult,
          resistance,
          rouses,
          narrative: p!.automation !== "complete",
          note: data.note,
        };
        store.logRoll(c.id, u.id, {
          label: p!.name,
          mode: "power",
          result: powerResult,
          rouses,
          rerolled: false,
        });
      } else httpError(400, "Ação desconhecida.");
      if (out.health.aggravated > c.health.aggravated)
        out.lastAggravatedDamageNight = nightKey(c, store.get(c.campaignId));
      out.aggravatedMendEligible = Math.min(
        out.aggravatedMendEligible,
        out.health.aggravated,
      );
      store.update(c.id, characterSchema.parse(out), c.version);
      store.audit(c.id, u.id, data.action, { ...data, result });
    });
    res.json({ ok: true, result });
  });
  function encounter(recordId: string, characters: Character[], u: User) {
    if (!recordId) return undefined;
    const record = store.get(recordId);
    check(
      record?._type === "records" &&
        record.kind === "combat" &&
        isGM(store, record, u) &&
        record.status !== "Encerrado",
      "Selecione um confronto ativo sob controle do Narrador.",
    );
    check(
      characters.every(
        (c) =>
          record.participants.includes(c.id) &&
          c.campaignId === record.campaignId,
      ),
      "Os participantes devem pertencer ao confronto.",
    );
    return record;
  }
  function stampCombatDamage(c: Character, old: Character) {
    if (c.health.aggravated > old.health.aggravated)
      c.lastAggravatedDamageNight = nightKey(old, store.get(old.campaignId));
    c.aggravatedMendEligible = Math.min(
      c.aggravatedMendEligible,
      c.health.aggravated,
    );
  }
  app.post("/api/combat", (req, res) => {
    const u = res.locals.user as User,
      body = parse(combatSchema, req.body),
      a = store.get(body.a),
      b = store.get(body.b);
    check(
      a?._type === "characters" &&
        b?._type === "characters" &&
        isGM(store, a, u) &&
        isGM(store, b, u),
      "O Narrador deve ter acesso aos dois combatentes.",
    );
    check(
      a.campaignId === b.campaignId,
      "Selecione fichas da mesma crônica para sincronizar o conflito.",
    );
    const record = encounter(body.recordId, [a, b], u),
      catalog = store.catalog(),
      campaign = store.get(a.campaignId);
    const r = store.transaction(() => {
      const r = resolveCombat(
        a,
        b,
        catalog,
        body,
        { turn: turnKey(a, campaign), ruleset: campaign?.ruleset },
        die,
      );
      stampCombatDamage(r.a, a);
      stampCombatDamage(r.b, b);
      store.update(a.id, r.a, a.version);
      store.update(b.id, r.b, b.version);
      for (const [c, dice] of [
        [a, r.ar],
        [b, r.br],
      ] as const) {
        store.audit(c.id, u.id, "Conflito", {
          ...body,
          damage: r.damage,
          reports: r.reports,
          message: r.message,
        });
        if (dice)
          store.logRoll(c.id, u.id, {
            label: "Conflito: " + a.name + " × " + b.name,
            mode: "combat",
            result: dice,
            damage: r.damage,
            reports: r.reports,
            rerolled: false,
          });
      }
      if (record)
        store.audit(record.id, u.id, "Resolução de confronto", {
          ...body,
          damage: r.damage,
          reports: r.reports,
          message: r.message,
        });
      return r;
    });
    res.json({
      a: r.ar,
      b: r.br,
      damage: r.damage,
      reports: r.reports,
      track: r.track,
      message: r.message,
    });
  });
  app.post("/api/combat/one-roll", (req, res) => {
    const body = parse(oneRollSchema, req.body),
      u = res.locals.user as User;
    check(
      new Set(body.participants.map((p) => p.id)).size ===
        body.participants.length,
      "Selecione cada participante uma única vez.",
    );
    const chars = body.participants.map((p) => store.get(p.id));
    check(
      chars.every((c) => c?._type === "characters" && isGM(store, c, u)),
      "O Narrador deve ter acesso a todos os participantes.",
    );
    check(
      chars.every((c) => c.campaignId === chars[0].campaignId),
      "O confronto usa participantes da mesma crônica.",
    );
    const record = encounter(body.recordId, chars, u),
      catalog = store.catalog(),
      ruleset = store.get(chars[0].campaignId)?.ruleset;
    const results: any[] = [];
    store.transaction(() => {
      for (const [i, c] of chars.entries()) {
        const r = oneRollConflict(
          c,
          catalog,
          { ...body, ...body.participants[i], ruleset },
          die,
        );
        stampCombatDamage(r.character, c);
        store.update(c.id, r.character, c.version);
        const result = {
          id: c.id,
          name: c.name,
          result: r.result,
          damage: r.damage,
          report: r.report,
        };
        results.push(result);
        store.audit(c.id, u.id, "Conflito de uma rolagem", {
          ...result,
          difficulty: body.difficulty,
          note: body.note,
        });
        store.logRoll(c.id, u.id, {
          label: "Conflito de uma rolagem",
          mode: "one-roll",
          result: r.result,
          damage: r.damage,
          rerolled: false,
        });
      }
      if (record)
        store.audit(record.id, u.id, "Conflito de uma rolagem", {
          results,
          difficulty: body.difficulty,
          note: body.note,
        });
      if (record)
        store.update(
          record.id,
          { ...record, status: "Encerrado" },
          record.version,
        );
    });
    res.json({
      results,
      victories: results.filter((x) => x.result.win).length,
      participants: results.length,
    });
  });
  app.post("/api/sessions/:id/:operation", (req, res) => {
    const session = getEntity(req, res, true, "records"),
      u = res.locals.user as User;
    check(
      session.kind === "session" && isGM(store, session, u),
      "Somente o Narrador administra a sessão.",
    );
    const operation = String(req.params.operation);
    check(
      ["start", "finish"].includes(operation),
      "Operação de sessão desconhecida.",
    );
    const xp = parse(z.number().int().min(0).max(10), req.body.xp ?? 1);
    const ambitionIds = parse(z.array(id).max(100), req.body.ambitionIds ?? []);
    check(
      ambitionIds.every((key) => session.participants.includes(key)),
      "Confirme Ambição somente para participantes da sessão.",
    );
    const catalog = store.catalog(),
      results: any[] = [];
    check(
      operation === "start"
        ? session.status !== "Em andamento" && session.status !== "Encerrada"
        : session.status === "Em andamento",
      "A sessão não está no estado necessário.",
    );
    const participants = session.participants.map((key: string) =>
      store.get(key),
    );
    check(
      participants.every(
        (c: any) =>
          c?._type === "characters" &&
          c.campaignId === session.campaignId &&
          isGM(store, c, u),
      ),
      "Participantes incompatíveis com a sessão.",
    );
    store.transaction(() => {
      for (const c of participants) {
        let out = { ...c },
          result: any;
        if (operation === "start") {
          const r = recoverWillpower(
            c,
            catalog,
            session.id,
            ambitionIds.includes(c.id),
          );
          out = r.character;
          if (c.nature === "mortal")
            out.health.superficial = Math.max(
              0,
              out.health.superficial - derived(c, catalog).attributes.vigor,
            );
          result = {
            recoveredSuperficial: r.recoveredSuperficial,
            recoveredAggravated: r.recoveredAggravated,
            ambition: ambitionIds.includes(c.id),
          };
        } else {
          if (c.stains > 0) {
            const r = remorse(c, die);
            out = r.character;
            result = r.result;
            store.logRoll(c.id, u.id, {
              label: "Remorso — " + session.name,
              mode: "remorse",
              result,
              rerolled: false,
            });
          }
          out.xpTotal += xp;
        }
        if (out.health.aggravated > c.health.aggravated)
          out.lastAggravatedDamageNight = nightKey(c, store.get(c.campaignId));
        out.aggravatedMendEligible = Math.min(
          out.aggravatedMendEligible,
          out.health.aggravated,
        );
        store.update(c.id, characterSchema.parse(out), c.version);
        store.audit(
          c.id,
          u.id,
          operation === "start" ? "Início de sessão" : "Fim de sessão",
          {
            session: session.name,
            xp: operation === "finish" ? xp : 0,
            result,
          },
        );
        results.push({
          name: c.name,
          xp: operation === "finish" ? xp : 0,
          result,
        });
      }
      store.update(
        session.id,
        {
          ...session,
          status: operation === "start" ? "Em andamento" : "Encerrada",
        },
        session.version,
      );
      store.audit(
        session.id,
        u.id,
        operation === "start" ? "Sessão iniciada" : "Sessão encerrada",
        { participants: participants.length, xp },
      );
    });
    res.json({ ok: true, participants: results });
  });
  app.get("/api/documents", (_req, res) =>
    res.json(
      store.db
        .prepare(
          "SELECT id,name,pages,classification FROM documents ORDER BY name",
        )
        .all(),
    ),
  );
  app.get("/api/library", (req, res) => {
    const q = String(req.query.q ?? "")
        .trim()
        .slice(0, 200),
      document = String(req.query.document ?? "");
    let results: any[];
    if (q) {
      const query = q
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => '"' + w.replace(/"/g, '""') + '"')
        .join(" AND ");
      results = store.db
        .prepare(
          "SELECT document,page,snippet(pages,2,'[',']','…',45) AS excerpt FROM pages WHERE pages MATCH ? AND (?='' OR document=?) LIMIT 60",
        )
        .all(query, document, document) as any[];
    } else
      results = store.db
        .prepare(
          "SELECT document,page,substr(text,1,400) AS excerpt FROM pages WHERE (?='' OR document=?) LIMIT 60",
        )
        .all(document, document) as any[];
    res.json(results);
  });
  app.get("/api/documents/:document/pdf", (req, res) => {
    const doc = store.db
      .prepare("SELECT path FROM documents WHERE id=?")
      .get(String(req.params.document)) as any;
    if (!doc || !existsSync(doc.path))
      httpError(404, "PDF original não disponível neste ambiente.");
    res.type("pdf").sendFile(doc.path);
  });
  app.get("/api/documents/:document/pages/:page", (req, res) => {
    const document = String(req.params.document),
      page = Number(req.params.page);
    const row = store.db
      .prepare("SELECT text FROM pages WHERE document=? AND page=?")
      .get(document, page);
    if (!row) httpError(404, "Página não encontrada.");
    res.json(row);
  });
  app.get("/api/content/export", (_req, res) => {
    const u = res.locals.user as User;
    res.json({
      format: "v5-content",
      version: 1,
      entries: store
        .catalog()
        .filter((c) => c.ownerId === u.id && c.origin !== "official")
        .map((c) => {
          const out = { ...c } as any;
          delete out.ownerId;
          delete out._type;
          return out;
        }),
    });
  });
  app.post("/api/content/import", (req, res) => {
    const u = res.locals.user as User,
      body = parse(
        z.object({
          format: z.literal("v5-content"),
          version: z.literal(1),
          entries: z.array(contentSchema.extend({ id })).max(500),
        }),
        req.body,
      );
    check(
      body.entries.every((e) => e.origin !== "official"),
      "Importe conteúdo personalizado, opcional ou variantes; definições oficiais não são substituídas.",
    );
    const ids = new Map(body.entries.map((e) => [e.id, randomUUID()]));
    const remap = (v: string) => ids.get(v) || v;
    const entries = body.entries.map((e) => ({
      ...e,
      parentId: remap(e.parentId),
      disciplines: e.disciplines.map(remap),
      requirements: e.requirements.map((r) => ({
        ...r,
        target: remap(r.target),
      })),
      incompatible: e.incompatible.map(remap),
      grants: e.grants.map((r) => ({ ...r, contentId: remap(r.contentId) })),
    }));
    check(ids.size === body.entries.length, "IDs duplicados no arquivo.");
    store.transaction(() => {
      for (let i = 0; i < entries.length; i++)
        store.create("content", entries[i], u.id, ids.get(body.entries[i].id)!);
      for (let i = 0; i < entries.length; i++)
        integrity("content", entries[i], u);
    });
    res.json({ imported: entries.length });
  });
  app.get("/api/backup", (_req, res) => {
    const u = res.locals.user as User;
    const entities = Object.keys(entitySchemas)
      .flatMap((t) => store.list(t as EntityType))
      .filter((e) => e.ownerId !== "system" && visible(store, e, u));
    const included = new Set(entities.map((e) => e.id));
    const rolls = (
      store.db.prepare("SELECT * FROM rolls ORDER BY date").all() as any[]
    )
      .filter((r) => included.has(r.character_id))
      .map((r) => ({
        characterId: r.character_id,
        data: JSON.parse(r.data),
        date: r.date,
      }));
    const history = (
      store.db.prepare("SELECT * FROM audit ORDER BY date").all() as any[]
    )
      .filter((r) => included.has(r.entity_id))
      .map((r) => ({
        entityId: r.entity_id,
        action: r.action,
        detail: isGM(store, store.get(r.entity_id), u)
          ? JSON.parse(r.detail)
          : {},
        date: r.date,
      }));
    res.json({
      format: "v5-backup",
      version: 1,
      date: new Date().toISOString(),
      entities: entities.map((e) => ({
        type: e._type,
        id: e.id,
        data: publicEntity(store, e, u),
      })),
      rolls,
      history,
    });
  });
  app.post("/api/restore", (req, res) => {
    const u = res.locals.user as User;
    check(u.role === "narrator", "O Narrador restaura backups.");
    const body = parse(
      z.object({
        format: z.literal("v5-backup"),
        version: z.literal(1),
        entities: z
          .array(
            z.object({
              type: z.enum([
                "characters",
                "campaigns",
                "coteries",
                "records",
                "content",
              ]),
              id,
              data: z.unknown(),
            }),
          )
          .max(5000),
        rolls: z
          .array(
            z.object({
              characterId: id,
              data: z.record(z.string(), z.unknown()),
              date: z.string().max(100),
            }),
          )
          .max(20000)
          .default([]),
        history: z
          .array(
            z.object({
              entityId: id,
              action: z.string().max(200),
              detail: z.record(z.string(), z.unknown()),
              date: z.string().max(100),
            }),
          )
          .max(20000)
          .default([]),
      }),
      req.body,
    );
    const ids = new Map(body.entities.map((e) => [e.id, randomUUID()]));
    check(ids.size === body.entities.length, "IDs duplicados no backup.");
    const remap = (v: string) => ids.get(v) || v;
    const alchemyIds = new Map<string, string>();
    for (const entry of body.entities.filter((e) => e.type === "characters")) {
      const c = parse(characterSchema, entry.data);
      for (const a of [
        ...c.alchemy.preparations,
        ...c.alchemy.activations,
        ...c.alchemy.activations.flatMap((a) => a.formulaTests),
      ]) {
        check(
          !alchemyIds.has(a.id),
          "IDs de preparações ou ativações duplicados no backup.",
        );
        alchemyIds.set(a.id, randomUUID());
      }
    }
    const remapMarker = (value: string) => {
      const parts = value.split("@");
      return parts.length > 1
        ? remap(parts[0]) + "@" + parts.slice(1).join("@")
        : value;
    };
    const entries = body.entities.map((e) => {
      const data = parse(entitySchemas[e.type] as z.ZodType<any>, e.data);
      if (data.campaignId) data.campaignId = remap(data.campaignId);
      if (data.coterieId) data.coterieId = remap(data.coterieId);
      if (e.type === "campaigns") {
        data.gmId = u.id;
        data.members = [];
      }
      if (data.clanId) data.clanId = remap(data.clanId);
      if (data.predatorId) data.predatorId = remap(data.predatorId);
      if (e.type === "content") {
        data.parentId = remap(data.parentId);
        data.disciplines = data.disciplines.map(remap);
        data.requirements = data.requirements.map((r: any) => ({
          ...r,
          target: remap(r.target),
        }));
        data.incompatible = data.incompatible.map(remap);
        data.grants = data.grants.map((r: any) => ({
          ...r,
          contentId: remap(r.contentId),
        }));
      }
      if (e.type === "characters") {
        data.alchemy.preparations = data.alchemy.preparations.map((p: any) => ({
          ...p,
          id: alchemyIds.get(p.id),
          formulaId: remap(p.formulaId),
          vesselId: remap(p.vesselId),
          preparedAt: remapMarker(p.preparedAt),
        }));
        data.alchemy.activations = data.alchemy.activations.map((a: any) => ({
          ...a,
          id: alchemyIds.get(a.id),
          formulaId: remap(a.formulaId),
          targets: a.targets.map(remap),
          activatedAt: remapMarker(a.activatedAt),
          flight: { ...a.flight, passengerId: remap(a.flight.passengerId) },
          formulaTests: a.formulaTests.map((t: any) => ({
            ...t,
            id: alchemyIds.get(t.id),
            targetId: remap(t.targetId),
            turn: remapMarker(t.turn),
          })),
          longReach: {
            ...a.longReach,
            lastHeldTurn: remapMarker(a.longReach.lastHeldTurn),
            lastActionTurn: remapMarker(a.longReach.lastActionTurn),
          },
        }));
        data.disciplines = Object.fromEntries(
          Object.entries(data.disciplines).map(([k, v]) => [remap(k), v]),
        );
        data.powers = data.powers.map(remap);
        for (const key of [
          "affinityDiscipline",
          "affinityPower",
          "clanCurse",
          "initialFormula",
        ])
          data.thinBlood[key] = remap(data.thinBlood[key]);
        for (const key of [
          "lastWakeNight",
          "lastAggravatedMendNight",
          "lastAggravatedDamageNight",
          "lastSuperficialMendTurn",
          "lastPowerTurn",
          "lastBlushNight",
        ]) {
          const parts = data[key].split("@");
          if (parts.length > 1)
            data[key] = remap(parts[0]) + "@" + parts.slice(1).join("@");
        }
        data.lastSessionRecovery = remap(data.lastSessionRecovery);
        data.grappledBy = remap(data.grappledBy);
        for (const key of ["grappleSinceTurn", "grappleLastTurn"]) {
          const parts = data[key].split("@");
          if (parts.length > 1)
            data[key] = remap(parts[0]) + "@" + parts.slice(1).join("@");
        }
        data.bloodBonds = data.bloodBonds.map((b: any) => ({
          ...b,
          id: randomUUID(),
          regnantId: remap(b.regnantId),
          lastAvoidanceSession: remap(b.lastAvoidanceSession),
          lastDefiance: b.lastDefiance.replace(
            /(turno:|cena:)([^@]+)@/,
            (whole: string, prefix: string, key: string) =>
              prefix + remap(key) + "@",
          ),
        }));

        data.advantages = data.advantages.map((a: any) => ({
          ...a,
          contentId: remap(a.contentId),
        }));
        data.inventory = data.inventory.map((a: any) => ({
          ...a,
          contentId: remap(a.contentId),
          id: randomUUID(),
        }));
        data.activeEffects = data.activeEffects.map((a: any) => ({
          ...a,
          sourceId: remap(a.sourceId),
          effectKey: a.effectKey.replace(
            /^alchemy:([^:]+):/,
            (whole: string, key: string) =>
              `alchemy:${alchemyIds.get(key) || key}:`,
          ),
          id: randomUUID(),
        }));
      }
      if (data.members && e.type === "coteries")
        data.members = data.members.map(remap);
      if (data.participants) data.participants = data.participants.map(remap);
      return { type: e.type, id: ids.get(e.id)!, data };
    });
    store.transaction(() => {
      for (const e of entries) store.create(e.type, e.data, u.id, e.id);
      for (const e of entries) {
        if (e.type === "characters") {
          for (const a of e.data.alchemy.activations)
            if (
              a.formulaId === FLIGHT &&
              (a.status === "active" ||
                a.flight.airborne ||
                a.formulaTests.length > 0)
            )
              check(
                a.flight.passengerId !== e.id &&
                  a.targets.includes(e.id) &&
                  (a.flight.passengerId || a.targets.length === 1),
                "Usuário ou passageiro inválido no voo restaurado.",
              );
          for (const a of e.data.alchemy.activations)
            if (a.formulaId === ENVELOP && a.status === "active")
              check(
                new Set(a.targets).size === 2 &&
                  a.targets.includes(e.id) &&
                  a.formulaTests.every((t: any) => t.targetId !== e.id),
                "Alvo próprio, repetido ou ausente em Envolver no backup.",
              );
          check(
            e.data.grappledBy !== e.id,
            "Um personagem não pode agarrar a si mesmo.",
          );
          check(
            e.data.bloodBonds.every((b: any) => b.regnantId !== e.id),
            "Um personagem não pode ser seu próprio reinante.",
          );
        }
        integrity(e.type, e.data, u, undefined, true);
      }
      for (const r of body.rolls) {
        check(
          ids.has(r.characterId) &&
            store.get(remap(r.characterId))?._type === "characters",
          "Histórico de rolagem sem personagem no backup.",
        );
        if (r.data.mode === "normal") {
          const result = r.data.result as any;
          check(
            result &&
              Array.isArray(result.normal) &&
              Array.isArray(result.hunger) &&
              result.normal.length + result.hunger.length <= 100 &&
              result.hunger.length <= 5,
            "Rolagem inválida no backup.",
          );
          r.data.result = evaluate(
            result.normal,
            result.hunger,
            result.difficulty,
          );
          r.data.rerolled = true;
        }
        store.db
          .prepare("INSERT INTO rolls VALUES(?,?,?,?,?)")
          .run(
            randomUUID(),
            remap(r.characterId),
            u.id,
            JSON.stringify(r.data),
            r.date,
          );
      }
      for (const h of body.history) {
        check(ids.has(h.entityId), "Histórico sem registro no backup.");
        store.db
          .prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)")
          .run(
            randomUUID(),
            remap(h.entityId),
            u.id,
            h.action,
            JSON.stringify(h.detail),
            h.date,
          );
      }
      store.audit("restore", u.id, "Restauração de backup", {
        count: entries.length,
      });
    });
    res.json({
      restored: entries.length,
      message:
        "Registros restaurados como cópias. Reassocie as contas dos jogadores nas campanhas.",
    });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Recurso não encontrado." }),
  );
  const dist = resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || (err instanceof RuleError ? 400 : 500);
    if (status === 500) console.error("Falha interna:", err.message);
    res.status(status).json({
      error:
        status === 500
          ? "Não foi possível concluir a operação. Consulte o registro local do servidor."
          : err.type === "entity.parse.failed"
            ? "O corpo da requisição não contém JSON válido."
            : err.type === "entity.too.large"
              ? "Os dados excedem o limite de 15 MB."
              : err.message,
    });
  });
  return app;
}
