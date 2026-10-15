import { z } from "zod";
export const attributeGroups = {
  Físicos: ["forca", "destreza", "vigor"],
  Sociais: ["carisma", "manipulacao", "autocontrole"],
  Mentais: ["inteligencia", "raciocinio", "determinacao"],
} as const;
export const skillGroups = {
  Físicas: [
    "armasBrancas",
    "armasFogo",
    "atletismo",
    "briga",
    "conducao",
    "furtividade",
    "ladroagem",
    "oficios",
    "sobrevivencia",
  ],
  Sociais: [
    "empatiaAnimais",
    "etiqueta",
    "intimidacao",
    "lideranca",
    "manha",
    "performance",
    "persuasao",
    "sagacidade",
    "subterfugio",
  ],
  Mentais: [
    "ciencia",
    "erudicao",
    "financas",
    "investigacao",
    "medicina",
    "ocultismo",
    "percepcao",
    "politica",
    "tecnologia",
  ],
} as const;
export const labels: Record<string, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  carisma: "Carisma",
  manipulacao: "Manipulação",
  autocontrole: "Autocontrole",
  inteligencia: "Inteligência",
  raciocinio: "Raciocínio",
  determinacao: "Determinação",
  armasBrancas: "Armas Brancas",
  armasFogo: "Armas de Fogo",
  atletismo: "Atletismo",
  briga: "Briga",
  conducao: "Condução",
  furtividade: "Furtividade",
  ladroagem: "Ladroagem",
  oficios: "Ofícios",
  sobrevivencia: "Sobrevivência",
  empatiaAnimais: "Empatia com Animais",
  etiqueta: "Etiqueta",
  intimidacao: "Intimidação",
  lideranca: "Liderança",
  manha: "Manha",
  performance: "Performance",
  persuasao: "Persuasão",
  sagacidade: "Sagacidade",
  subterfugio: "Subterfúgio",
  ciencia: "Ciência",
  erudicao: "Erudição",
  financas: "Finanças",
  investigacao: "Investigação",
  medicina: "Medicina",
  ocultismo: "Ocultismo",
  percepcao: "Percepção",
  politica: "Política",
  tecnologia: "Tecnologia",
};
export const attributes = Object.values(attributeGroups).flat();
export const skills = Object.values(skillGroups).flat();
const text = z.string().max(50000);
const name = z.string().trim().min(1).max(160);
export const id = z.string().min(1).max(100);
const dots = z.number().int().min(0).max(5);
export const refSchema = z.object({
  document: z.string().max(100),
  page: z.number().int().min(1),
  note: z.string().max(500).default(""),
});
export const conditionSchema = z.object({
  field: z.enum([
    "always",
    "tag",
    "hunger",
    "humanity",
    "bloodPotency",
    "condition",
    "clan",
    "skill",
  ]),
  operator: z.enum(["eq", "gte", "lte", "includes"]).default("eq"),
  value: z
    .union([z.string().max(160), z.number().min(-100).max(100)])
    .default(""),
});
export const effectSchema = z.object({
  kind: z.enum([
    "dice",
    "attribute",
    "health",
    "willpower",
    "damage",
    "heal",
    "condition",
    "resource",
    "narrative",
  ]),
  target: z.string().max(100).default(""),
  value: z.number().int().min(-30).max(30).default(0),
  scale: z.enum(["fixed", "discipline", "margin"]).default("fixed"),
  when: conditionSchema.default({ field: "always", operator: "eq", value: "" }),
  duration: z
    .enum(["instant", "turn", "scene", "night", "permanent"])
    .default("scene"),
  aggravated: z.boolean().default(false),
  recipient: z.enum(["self", "target"]).default("self"),
  description: text.default(""),
});
export const requirementSchema = z.object({
  kind: z.enum([
    "discipline",
    "attribute",
    "skill",
    "power",
    "clan",
    "content",
  ]),
  target: id,
  level: dots.default(1),
});
export const kinds = [
  "clan",
  "lineage",
  "discipline",
  "power",
  "ritual",
  "ceremony",
  "formula",
  "merit",
  "flaw",
  "background",
  "predator",
  "equipment",
  "condition",
  "optional",
] as const;
export const kindLabels: Record<string, string> = {
  clan: "Clã",
  lineage: "Linhagem",
  discipline: "Disciplina",
  power: "Poder",
  ritual: "Ritual",
  ceremony: "Cerimônia",
  formula: "Fórmula",
  merit: "Qualidade",
  flaw: "Defeito",
  background: "Antecedente",
  predator: "Tipo de Predador",
  equipment: "Equipamento",
  condition: "Condição",
  optional: "Regra opcional",
};
export const contentSchema = z.object({
  revision: z.number().int().min(1).default(1),
  name,
  kind: z.enum(kinds),
  origin: z
    .enum(["official", "custom", "variant", "optional"])
    .default("custom"),
  parentId: z.string().max(100).default(""),
  description: text.default(""),
  history: text.default(""),
  characteristics: text.default(""),
  image: z.string().max(2500000).default(""),
  disciplines: z.array(id).max(20).default([]),
  bane: text.default(""),
  baneSeverity: z.string().max(400).default(""),
  compulsion: text.default(""),
  restrictions: text.default(""),
  notes: text.default(""),
  category: z.string().max(100).default(""),
  level: dots.default(1),
  points: z.number().int().min(0).max(10).default(1),
  maxLevel: dots.default(5),
  minLevel: dots.default(0),
  bondRule: z
    .object({
      immune: z.boolean().default(false),
      instant: z.boolean().default(false),
      binding: z.enum(["default", "allowed", "blocked"]).default("default"),
      resistance: z.number().int().min(-5).max(5).default(0),
      perLevel: z.boolean().default(false),
      decay: z.enum(["default", "normal", "long", "short"]).default("default"),
    })
    .default({
      immune: false,
      instant: false,
      binding: "default",
      resistance: 0,
      perLevel: false,
      decay: "default",
    }),
  requirements: z.array(requirementSchema).max(30).default([]),
  incompatible: z.array(id).max(30).default([]),
  rouse: z.number().int().min(0).max(5).default(0),
  willpowerCost: z.number().int().min(0).max(5).default(0),
  attribute: z.string().max(100).default(""),
  skill: z.string().max(100).default(""),
  resistanceAttribute: z.string().max(100).default(""),
  resistanceSkill: z.string().max(100).default(""),
  difficulty: z.number().int().min(0).max(30).default(0),
  duration: z
    .enum(["instant", "turn", "scene", "night", "permanent"])
    .default("scene"),
  range: z.string().max(500).default(""),
  effects: z.array(effectSchema).max(30).default([]),
  damage: z.number().int().min(0).max(10).default(0),
  equipmentType: z.enum(["item", "weapon", "armor"]).default("item"),
  damageSource: z
    .enum([
      "manual",
      "blunt",
      "heavyBlunt",
      "piercing",
      "gunshot",
      "fire",
      "supernatural",
    ])
    .default("manual"),
  armor: z.number().int().min(0).max(20).default(0),
  armorAgainstBullets: z.boolean().default(true),
  dexterityPenalty: z.number().int().min(0).max(5).default(0),
  cost: z.string().max(500).default(""),
  properties: text.default(""),
  references: z.array(refSchema).max(50).default([]),
  automation: z
    .enum(["complete", "partial", "narrative", "unreviewed"])
    .default("narrative"),
  humanityChange: z.number().int().min(-5).max(5).default(0),
  potencyChange: z.number().int().min(0).max(2).default(0),
  specialties: z
    .array(z.object({ skill: id, name }))
    .max(10)
    .default([]),
  grants: z
    .array(z.object({ contentId: id, level: dots }))
    .max(20)
    .default([]),
});
export type Content = z.infer<typeof contentSchema> & {
  id: string;
  ownerId?: string;
  version?: number;
};
export type Effect = z.infer<typeof effectSchema>;
export const effectLabels: Record<string, string> = {
  dice: "Dados",
  attribute: "Atributo",
  health: "Vitalidade máxima",
  willpower: "Força de Vontade máxima",
  damage: "Dano",
  heal: "Recuperação",
  condition: "Condição",
  resource: "Recurso",
  narrative: "Narrativo",
};
export const durationLabels: Record<string, string> = {
  instant: "instantâneo",
  turn: "turno(s)",
  scene: "cena(s)",
  night: "noite(s)",
  permanent: "permanente",
};
export const actionLabels: Record<string, string> = {
  damage: "Dano",
  rouse: "Despertar do Sangue",
  mend: "Recuperação de Vitalidade",
  mendAggravated: "Recuperação de dano agravado",
  sessionRecovery: "Recuperação de Força de Vontade",
  stains: "Máculas",
  remorse: "Remorso",
  feed: "Alimentação",
  bondDrink: "Bebida de vitae",
  bondDefy: "Desafio ao Laço",
  bondAvoid: "Afastamento do Laço",
  bondDecay: "Decadência do Laço",
  xp: "Experiência concedida",
  advance: "Progressão",
  expire: "Fim de duração",
  equip: "Equipamento",
  transfer: "Transferência",
  power: "Uso de Poder",
  hunt: "Caçada",
};
const pointMap = (keys: readonly string[], min: number) =>
  z.object(
    Object.fromEntries(keys.map((k) => [k, z.number().int().min(min).max(5)])),
  );
export const damageSchema = z.object({
  superficial: z.number().int().min(0).max(100).default(0),
  aggravated: z.number().int().min(0).max(100).default(0),
});
export const clockSchema = z.object({
  night: z.number().int().min(1).max(100000).default(1),
  scene: z.number().int().min(1).max(100000).default(1),
  turn: z.number().int().min(1).max(100000).default(1),
});
export type StoryClock = z.infer<typeof clockSchema>;
export const storyDateSchema = z
  .string()
  .max(10)
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number(value.slice(0, 4)) > 0 &&
        !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
        new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value),
    "Informe uma data válida no calendário da crônica.",
  )
  .default("");
export const bloodBondSchema = z.object({
  id,
  regnantId: id,
  regnantName: z.string().max(160),
  strength: z.number().int().min(0).max(6).default(0),
  formed: z.boolean().default(false),
  formedOrder: z.number().int().min(0).max(1000000000).default(0),
  formationNights: z.array(storyDateSchema).max(3).default([]),
  lastDrink: storyDateSchema,
  formedOn: storyDateSchema,
  releaseOn: storyDateSchema,
  decayPeriods: z.number().int().min(0).max(100000).default(0),
  moonEvents: z.array(z.string().max(20)).max(12).default([]),
  lastDefiance: z.string().max(200).default(""),
  lastAvoidanceSession: z.string().max(100).default(""),
});
export type BloodBond = z.infer<typeof bloodBondSchema>;
export const alchemyMethodSchema = z.enum(["athanor", "calcinatio", "fixatio"]);
const alchemyIdentifier = id.regex(
  /^[a-zA-Z0-9_-]+$/,
  "Identificador de Alquimia inválido.",
);
const alchemyDiceSchema = z
  .object({
    normal: z.array(z.number().int().min(1).max(10)).max(100),
    hunger: z.array(z.number().int().min(1).max(10)).max(5),
  })
  .refine(
    (dice) =>
      dice.normal.length + dice.hunger.length >= 1 &&
      dice.normal.length + dice.hunger.length <= 100,
    "Parada de destilação inválida.",
  );
const alchemyReviewSchema = z
  .object({
    state: z.enum(["open", "closed"]).default("closed"),
    rerolled: z.boolean().default(false),
    original: alchemyDiceSchema.nullable().default(null),
  })
  .refine(
    (review) => review.rerolled === (review.original !== null),
    "Registro original de rerrolagem incompatível.",
  );
const closedAlchemyReview = {
  state: "closed" as const,
  rerolled: false,
  original: null,
};
const alchemyCraftingSchema = z
  .object({
    nights: z.number().int().min(0).max(100).default(0),
    donorConfirmed: z.boolean().default(false),
    researchConfirmed: z.boolean().default(false),
    note: z.string().max(4000).default(""),
  })
  .default({
    nights: 0,
    donorConfirmed: false,
    researchConfirmed: false,
    note: "",
  });
export const alchemyPreparationSchema = z
  .object({
    id: alchemyIdentifier,
    formulaId: id,
    method: alchemyMethodSchema,
    location: z.enum(["body", "vessel", "carried", "stored"]),
    vesselId: z.string().max(100).default(""),
    ingredients: z.string().trim().min(10).max(2000),
    modifier: z.number().int().min(-2).max(2).default(0),
    fieldEquipment: z.boolean().default(false),
    carryAttribute: z.enum(["raciocinio", "destreza"]).default("raciocinio"),
    remainingTurns: z.number().int().min(0).max(100).default(0),
    distillation: alchemyDiceSchema.nullable().default(null),
    // Dados legados ficam fechados: não se presume uma resolução ainda aberta.
    review: alchemyReviewSchema.default(closedAlchemyReview),
    preparedAt: z.string().max(150),
    crafting: alchemyCraftingSchema,
  })
  .refine(
    (p) =>
      (p.review.state !== "open" ||
        (p.method !== "fixatio" && !!p.distillation)) &&
      preservedAlchemyDice(p.distillation, p.review.original) &&
      (p.crafting.nights === 0 ||
        (p.formulaId ===
          "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar" &&
          p.crafting.nights >= 3 &&
          p.crafting.donorConfirmed &&
          p.crafting.researchConfirmed &&
          p.crafting.note.trim().length >= 10)),
    "Revisão ou Dados de Fome da preparação incompatíveis.",
  );
// Básico PDF 277: testes do Poder após a destilação, com revisão independente.
export const alchemyFormulaTestSchema = z
  .object({
    id: alchemyIdentifier,
    mode: z.enum([
      "move",
      "pull",
      "throw",
      "hold",
      "delicate",
      "knife",
      "suffocate",
      "fly",
      "carry",
      "capture",
      "ground",
      "land",
    ]),
    status: z.enum(["pending", "resolved", "cancelled"]),
    targetId: z.string().max(100).default(""),
    object: z.string().trim().min(3).max(500),
    weightKg: z.number().positive().lt(100).nullable(),
    turn: z.string().max(150),
    difficulty: z.number().int().min(0).max(30),
    actor: alchemyDiceSchema.nullable(),
    opposition: alchemyDiceSchema.nullable(),
    actorReview: alchemyReviewSchema.default(closedAlchemyReview),
    oppositionReview: alchemyReviewSchema.default(closedAlchemyReview),
    note: z.string().max(4000).default(""),
    outcome: z
      .object({
        success: z.boolean(),
        margin: z.number().int().min(-200).max(200),
        meters: z.number().int().min(0).max(200),
        rawDamage: z.number().int().min(0).max(200),
        appliedDamage: z.number().int().min(0).max(200),
        message: z.string().max(4000),
      })
      .nullable()
      .default(null),
  })
  .refine(
    (t) =>
      preservedAlchemyDice(t.actor, t.actorReview.original) &&
      preservedAlchemyDice(t.opposition, t.oppositionReview.original) &&
      (t.actorReview.state !== "open" ||
        (t.status === "pending" && !!t.actor)) &&
      (t.oppositionReview.state !== "open" ||
        (t.status === "pending" && !!t.opposition)) &&
      (t.status === "resolved") === !!t.outcome &&
      (["move", "fly", "carry", "land"].includes(t.mode)
        ? !t.actor && !t.opposition
        : !!t.actor) &&
      (["pull", "throw", "suffocate", "capture", "ground"].includes(t.mode)
        ? !!t.opposition && !!t.targetId
        : !t.opposition) &&
      (t.mode === "hold"
        ? t.difficulty === 3
        : ["delicate", "knife"].includes(t.mode)
          ? t.difficulty > 0 && !t.targetId
          : t.difficulty === 0) &&
      (t.mode !== "move" || !t.targetId) &&
      (["suffocate", "fly", "carry", "capture", "ground", "land"].includes(
        t.mode,
      )
        ? t.weightKg === null
        : t.weightKg !== null),
    "Teste próprio, revisão ou Dados de Fome incompatíveis.",
  );
export type AlchemyFormulaTest = z.infer<typeof alchemyFormulaTestSchema>;
export const alchemyActivationSchema = z
  .object({
    id: alchemyIdentifier,
    formulaId: id,
    method: alchemyMethodSchema,
    alchemyLevel: z.number().int().min(0).max(5).default(0),
    distillation: alchemyDiceSchema,
    review: alchemyReviewSchema.default(closedAlchemyReview),
    status: z.enum(["pending", "active", "ended"]),
    targets: z.array(id).max(5),
    group: z.boolean().default(false),
    tags: z.array(z.string().max(100)).max(40).default([]),
    activatedAt: z.string().max(150),
    note: z.string().max(4000).default(""),
    resolution: z.string().max(4000).default(""),
    formulaTests: z.array(alchemyFormulaTestSchema).max(1000).default([]),
    crafting: alchemyCraftingSchema,
    flight: z
      .object({
        airborne: z.boolean().default(false),
        passengerId: z.string().max(100).default(""),
        load: z.string().max(500).default(""),
      })
      .default({ airborne: false, passengerId: "", load: "" }),
    longReach: z
      .object({
        sustaining: z.boolean().default(false),
        lastHeldTurn: z.string().max(150).default(""),
        lastActionTurn: z.string().max(150).default(""),
      })
      .default({ sustaining: false, lastHeldTurn: "", lastActionTurn: "" }),
  })
  .refine(
    (a) =>
      (a.review.state !== "open" ||
        (a.method === "fixatio" &&
          a.status === "pending" &&
          a.alchemyLevel > 0)) &&
      preservedAlchemyDice(a.distillation, a.review.original) &&
      new Set(a.formulaTests.map((t) => t.id)).size === a.formulaTests.length &&
      (a.formulaTests.length === 0 ||
        [
          "formula-alquimia-sangue-ralo-longo-alcance",
          "formula-alquimia-sangue-ralo-envolver",
          "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar",
        ].includes(a.formulaId)) &&
      a.formulaTests.every(
        (t) =>
          (t.mode === "suffocate") ===
            (a.formulaId === "formula-alquimia-sangue-ralo-envolver") &&
          ["fly", "carry", "capture", "ground", "land"].includes(t.mode) ===
            (a.formulaId ===
              "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar"),
      ) &&
      a.formulaTests.every(
        (t) =>
          t.status !== "pending" ||
          (a.status === "active" &&
            (t.mode === "suffocate"
              ? a.targets.includes(t.targetId)
              : ["fly", "carry", "capture", "ground", "land"].includes(t.mode)
                ? true
                : t.turn === a.longReach.lastActionTurn)),
      ) &&
      (a.formulaId !== "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar" ||
        (a.status !== "active" && a.formulaTests.length === 0) ||
        (a.crafting.nights >= 3 &&
          a.crafting.donorConfirmed &&
          a.crafting.researchConfirmed &&
          a.crafting.note.trim().length >= 10)) &&
      ((!a.flight.airborne && !a.flight.passengerId && !a.flight.load) ||
        (a.formulaId ===
          "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar" &&
          a.status === "active" &&
          a.flight.airborne &&
          (!a.flight.passengerId ||
            (!!a.flight.load && a.targets.includes(a.flight.passengerId))))) &&
      (!a.longReach.sustaining ||
        (a.status === "active" &&
          a.formulaId === "formula-alquimia-sangue-ralo-longo-alcance" &&
          a.formulaTests.some(
            (t) =>
              t.mode === "hold" &&
              t.status === "resolved" &&
              t.outcome?.success &&
              t.turn === a.longReach.lastHeldTurn,
          ))),
    "Revisão ou Dados de Fome da ativação incompatíveis.",
  );
function preservedAlchemyDice(
  current: z.infer<typeof alchemyDiceSchema> | null,
  original: z.infer<typeof alchemyDiceSchema> | null,
) {
  return (
    !original ||
    (!!current &&
      original.normal.length === current.normal.length &&
      original.hunger.length === current.hunger.length &&
      original.hunger.every((die, index) => die === current.hunger[index]))
  );
}
export const alchemyStateSchema = z.object({
  preparations: z.array(alchemyPreparationSchema).max(100).default([]),
  activations: z.array(alchemyActivationSchema).max(1000).default([]),
});
export type AlchemyPreparation = z.infer<typeof alchemyPreparationSchema>;
export type AlchemyActivation = z.infer<typeof alchemyActivationSchema>;
export const characterSchema = z.object({
  name,
  nature: z.enum(["vampire", "mortal"]).default("vampire"),
  concept: text.default(""),
  clanId: z.string().max(100).default(""),
  predatorId: z.string().max(100).default(""),
  sire: text.default(""),
  generation: z.number().int().min(4).max(16).default(13),
  bloodPotency: z.number().int().min(0).max(10).default(1),
  ambition: text.default(""),
  desire: text.default(""),
  sect: text.default(""),
  campaignId: z.string().max(100).default(""),
  coterieId: z.string().max(100).default(""),
  ownerId: z.string().max(100).default(""),
  npc: z.boolean().default(false),
  clock: clockSchema.default({ night: 1, scene: 1, turn: 1 }),
  storyDate: storyDateSchema,
  bloodBonds: z.array(bloodBondSchema).max(100).default([]),
  grappledBy: z.string().max(100).default(""),
  grappleSinceTurn: z.string().max(150).default(""),
  grappleLastTurn: z.string().max(150).default(""),
  lastWakeNight: z.string().max(150).default(""),
  lastAggravatedMendNight: z.string().max(150).default(""),
  lastAggravatedDamageNight: z.string().max(150).default(""),
  aggravatedMendEligible: z.number().int().min(0).max(100).default(0),
  lastSuperficialMendTurn: z.string().max(150).default(""),
  lastPowerTurn: z.string().max(150).default(""),
  lastBlushNight: z.string().max(150).default(""),
  lastSessionRecovery: z.string().max(100).default(""),
  appearance: text.default(""),
  history: text.default(""),
  haven: text.default(""),
  notes: text.default(""),
  privateNotes: text.default(""),
  portrait: z.string().max(2500000).default(""),
  age: text.default(""),
  apparentAge: text.default(""),
  birthDate: text.default(""),
  deathDate: text.default(""),
  distinctive: text.default(""),
  convictions: z
    .array(z.object({ conviction: text, pillar: text }))
    .max(10)
    .default([]),
  attributes: pointMap(attributes, 1),
  skills: pointMap(skills, 0),
  specialties: z
    .record(z.string().max(100), z.array(z.string().max(200)).max(20))
    .default({}),
  disciplines: z.record(z.string().max(100), dots).default({}),
  powers: z.array(id).max(100).default([]),
  alchemy: alchemyStateSchema.default({ preparations: [], activations: [] }),
  thinBlood: z
    .object({
      affinityDiscipline: z.string().max(100).default(""),
      affinityPower: z.string().max(100).default(""),
      clanCurse: z.string().max(100).default(""),
      alchemyMethod: z
        .enum(["", "athanor", "calcinatio", "fixatio"])
        .default(""),
      initialFormula: z.string().max(100).default(""),
    })
    .default({
      affinityDiscipline: "",
      affinityPower: "",
      clanCurse: "",
      alchemyMethod: "",
      initialFormula: "",
    }),
  advantages: z
    .array(
      z.object({
        contentId: id,
        level: z.number().int().min(0).max(10),
        source: z
          .enum(["creation", "predator", "clan", "progression", "manual"])
          .default("manual"),
        notes: text.default(""),
      }),
    )
    .max(100)
    .default([]),
  hunger: z.number().int().min(0).max(5).default(1),
  humanity: z.number().int().min(0).max(10).default(7),
  stains: z.number().int().min(0).max(100).default(0),
  health: damageSchema.default({ superficial: 0, aggravated: 0 }),
  willpower: damageSchema.default({ superficial: 0, aggravated: 0 }),
  xpTotal: z.number().int().min(0).max(100000).default(0),
  xpSpent: z.number().int().min(0).max(100000).default(0),
  resonance: z.string().max(200).default(""),
  temperament: z.string().max(200).default(""),
  conditions: z.array(z.string().max(160)).max(100).default([]),
  activeEffects: z
    .array(
      z.object({
        id,
        sourceId: id,
        effectKey: z.string().max(100).default(""),
        label: z.string().max(160),
        // Valores já calculados podem incluir nível (até 5) ou margem (até 100).
        effect: effectSchema.extend({
          value: z.number().int().min(-3000).max(3000).default(0),
        }),
        createdAt: z.string(),
        remaining: z.number().int().min(0).max(100).default(1),
      }),
    )
    .max(200)
    .default([]),
  inventory: z
    .array(
      z.object({
        id,
        contentId: id,
        quantity: z.number().int().min(1).max(10000),
        equipped: z.boolean().default(false),
        notes: text.default(""),
      }),
    )
    .max(200)
    .default([]),
  status: z.enum(["draft", "active", "retired"]).default("draft"),
  creation: z
    .object({
      age: z.enum(["fledgling", "neonate", "ancilla"]).default("fledgling"),
      skillDistribution: z
        .enum(["generalist", "balanced", "specialist"])
        .default("balanced"),
      predatorDiscipline: z.string().default(""),
      predatorSpecialty: z.string().default(""),
      approvedException: text.default(""),
    })
    .default({
      age: "fledgling",
      skillDistribution: "balanced",
      predatorDiscipline: "",
      predatorSpecialty: "",
      approvedException: "",
    }),
});
export type Character = z.infer<typeof characterSchema> & {
  id: string;
  version: number;
};
export const campaignSchema = z.object({
  name,
  description: text.default(""),
  setting: text.default(""),
  principles: text.default(""),
  ruleset: z.enum(["basic", "companion"]).default("companion"),
  notes: text.default(""),
  privateNotes: text.default(""),
  gmId: id,
  members: z.array(id).max(100).default([]),
  clock: clockSchema.default({ night: 1, scene: 1, turn: 1 }),
  storyDate: storyDateSchema,
});
export type Campaign = z.infer<typeof campaignSchema> & {
  id: string;
  version: number;
};
export const coterieSchema = z.object({
  name,
  campaignId: id,
  type: text.default(""),
  objectives: text.default(""),
  members: z.array(id).max(100).default([]),
  pool: z.number().int().min(0).max(100).default(0),
  chasse: dots.default(1),
  lien: dots.default(0),
  portillon: dots.default(0),
  territory: text.default(""),
  resources: text.default(""),
  allies: text.default(""),
  problems: text.default(""),
  debts: text.default(""),
  notes: text.default(""),
});
export const recordKinds = [
  "session",
  "npc",
  "antagonist",
  "mission",
  "location",
  "faction",
  "relationship",
  "boon",
  "masquerade",
  "event",
  "secret",
  "feeding",
  "combat",
] as const;
export const recordLabels: Record<string, string> = {
  session: "Sessão",
  npc: "NPC",
  antagonist: "Antagonista",
  mission: "Missão",
  location: "Local",
  faction: "Facção",
  relationship: "Relação",
  boon: "Favor ou dívida",
  masquerade: "Ocorrência da Máscara",
  event: "Acontecimento",
  secret: "Segredo",
  feeding: "Fonte de alimentação",
  combat: "Confronto",
};
export const recordSchema = z.object({
  name,
  kind: z.enum(recordKinds),
  campaignId: id,
  date: z.string().max(100).default(""),
  description: text.default(""),
  privateNotes: text.default(""),
  private: z.boolean().default(false),
  participants: z.array(id).max(100).default([]),
  status: z.string().max(100).default("Aberto"),
  relatedId: z.string().max(100).default(""),
  notes: text.default(""),
});
export type EntityType =
  "characters" | "campaigns" | "coteries" | "records" | "content";
export const entitySchemas = {
  characters: characterSchema,
  campaigns: campaignSchema,
  coteries: coterieSchema,
  records: recordSchema,
  content: contentSchema,
};
export function emptyCharacter(): z.input<typeof characterSchema> {
  return {
    name: "Novo personagem",
    attributes: Object.fromEntries(attributes.map((k) => [k, 1])),
    skills: Object.fromEntries(skills.map((k) => [k, 0])),
  };
}
export const safeImage = (s: string) =>
  !s || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
