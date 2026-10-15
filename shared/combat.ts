import { z } from "zod";
import {
  concentrating,
  fogPenalty,
  envelopActionBlocked,
} from "./alchemy-effects";
import { Character, Content, id } from "./model";
import {
  applyDamage,
  check,
  conflict,
  derived,
  evaluate,
  pool,
  randomDie,
  roll,
} from "./rules";

export const damageSourceSchema = z.enum([
  "manual",
  "blunt",
  "heavyBlunt",
  "piercing",
  "gunshot",
  "fire",
  "supernatural",
]);
export type DamageSource = z.infer<typeof damageSourceSchema>;
export const techniqueSchema = z.enum([
  "strike",
  "grapple",
  "hold",
  "crush",
  "bite",
  "escape",
  "stake",
  "release",
]);
export const combatSchema = z.object({
  a: id,
  b: id,
  attributeA: id,
  skillA: id,
  attributeB: id,
  skillB: id,
  modifierA: z.number().int().min(-30).max(30).default(0),
  modifierB: z.number().int().min(-30).max(30).default(0),
  tagsA: z.array(z.string().max(100)).max(40).default([]),
  tagsB: z.array(z.string().max(100)).max(40).default([]),
  weaponA: z.number().int().min(0).max(10).default(0),
  weaponB: z.number().int().min(0).max(10).default(0),
  weaponItemA: z.string().max(100).default(""),
  weaponItemB: z.string().max(100).default(""),
  armorItemA: z.string().max(100).default(""),
  armorItemB: z.string().max(100).default(""),
  sourceA: damageSourceSchema.default("manual"),
  sourceB: damageSourceSchema.default("manual"),
  unilateral: z.boolean().default(false),
  social: z.boolean().default(false),
  aggravated: z.boolean().default(false),
  technique: techniqueSchema.default("strike"),
  calledPenaltyA: z.number().int().min(0).max(10).default(0),
  calledPenaltyB: z.number().int().min(0).max(10).default(0),
  rangedA: z.boolean().default(false),
  rangedB: z.boolean().default(false),
  coverA: z.number().int().min(-2).max(2).default(0),
  coverB: z.number().int().min(-2).max(2).default(0),
  fullDefenseB: z.boolean().default(false),
  successiveDefenseA: z.number().int().min(0).max(20).default(0),
  successiveDefenseB: z.number().int().min(0).max(20).default(0),
  staticDefense: z.boolean().default(false),
  difficulty: z.number().int().min(1).max(30).default(1),
  lethalBody: z.boolean().default(false),
  recordId: z.string().max(100).default(""),
  mixedOrderA: z
    .enum(["aggravatedFirst", "superficialFirst"])
    .default("aggravatedFirst"),
  mixedOrderB: z
    .enum(["aggravatedFirst", "superficialFirst"])
    .default("aggravatedFirst"),
  note: z.string().max(2000).default(""),
});
export type CombatInput = z.infer<typeof combatSchema>;
export function equipped(
  c: Character,
  catalog: Content[],
  itemId: string,
  kind: "weapon" | "armor",
) {
  if (!itemId) return undefined;
  const item = c.inventory.find((x) => x.id === itemId && x.equipped),
    entry = catalog.find((x) => x.id === item?.contentId);
  check(
    item && entry?.kind === "equipment" && entry.equipmentType === kind,
    "Selecione um equipamento do tipo correto, equipado na ficha.",
  );
  return entry!;
}
export function hasPower(c: Character, name: string) {
  return c.powers.includes(name);
}
export function vampireDurability(c: Character) {
  return (
    c.nature === "vampire" &&
    (c.generation < 14 ||
      c.advantages.some(
        (a) => a.contentId === "merit-resiliencia-vampirica" && a.level > 0,
      ))
  );
}
export function damageIsAggravated(
  c: Character,
  source: DamageSource,
  manual = false,
  ruleset = "companion",
) {
  if (source === "manual") return manual;
  if (source === "fire" || source === "supernatural") return true;
  if (source === "piercing" || source === "gunshot")
    return !vampireDurability(c);
  check(
    source !== "heavyBlunt" || c.nature !== "mortal" || ruleset === "companion",
    "Contundente pesado contra mortal não tem classificação inequívoca no Básico fornecido. Selecione tipo definido pelo Narrador e indique superficial ou agravado, ou use a versão Companion.",
  );
  return (
    source === "heavyBlunt" && c.nature === "mortal" && ruleset === "companion"
  );
}
export function receiveDamage(
  c: Character,
  catalog: Content[],
  request: {
    amount: number;
    track?: "health" | "willpower";
    source?: DamageSource;
    aggravated?: boolean;
    armorItem?: string;
    armorIgnore?: number;
    halve?: boolean;
    ignoreMitigation?: boolean;
    ruleset?: string;
    mixedOrder?: "aggravatedFirst" | "superficialFirst";
  },
) {
  const out = structuredClone(c),
    track = request.track ?? "health",
    source = request.source ?? "manual",
    d = derived(c, catalog),
    max = track === "health" ? d.healthMax : d.willpowerMax;
  check(
    Number.isInteger(request.amount) &&
      request.amount >= 0 &&
      request.amount <= 1000,
    "Quantidade de dano inválida.",
  );
  const aggravated =
    track === "willpower"
      ? !!request.aggravated
      : damageIsAggravated(c, source, request.aggravated, request.ruleset);
  let superficial = aggravated ? 0 : request.amount,
    agg = aggravated ? request.amount : 0,
    converted = 0,
    reduction = 0;
  if (
    !request.ignoreMitigation &&
    track === "health" &&
    aggravated &&
    ["piercing", "gunshot"].includes(source)
  ) {
    const armor = equipped(c, catalog, request.armorItem ?? "", "armor");
    const rating =
      source === "gunshot" && armor && !armor.armorAgainstBullets
        ? 0
        : Math.max(0, (armor?.armor ?? 0) - (request.armorIgnore ?? 0));
    converted = Math.min(agg, rating);
    agg -= converted;
    superficial += converted;
  }
  if (
    !request.ignoreMitigation &&
    track === "health" &&
    superficial > 0 &&
    c.activeEffects.some(
      (x) => x.effect.kind === "condition" && x.effect.target === "Rigidez",
    )
  ) {
    reduction = Math.min(
      superficial - 1,
      c.disciplines["discipline-fortitude"] ?? 0,
    );
    superficial -= reduction;
  }
  const appliedSuperficial =
    request.halve === false ? superficial : Math.ceil(superficial / 2);
  const aggr = (t: Character["health"]) =>
      applyDamage(t, max, agg, true, false),
    sup = (t: Character["health"]) =>
      applyDamage(t, max, appliedSuperficial, false, false);
  out[track] =
    request.mixedOrder === "superficialFirst"
      ? aggr(sup(c[track]))
      : sup(aggr(c[track]));
  let consequence = "";
  if (track === "health" && out.health.aggravated >= max) {
    consequence =
      c.nature === "vampire" ? "Torpor" : "Incapacitado: coma ou morte";
    if (!out.conditions.includes(consequence)) out.conditions.push(consequence);
  } else if (track === "willpower" && out.willpower.aggravated >= max)
    consequence =
      "Força de Vontade esgotada: resolva a derrota e suas consequências narrativas.";
  return {
    character: out,
    report: {
      raw: request.amount,
      aggravated: agg,
      superficial: appliedSuperficial,
      converted,
      reduction,
      consequence,
      mixed: agg > 0 && appliedSuperficial > 0,
      order: request.mixedOrder ?? "aggravatedFirst",
    },
  };
}
function checkedPool(
  c: Character,
  catalog: Content[],
  attribute: string,
  skill: string,
  modifier: number,
  ruleset: string,
  tags: string[] = [],
) {
  check(attribute in c.attributes, "Atributo do conflito inexistente.");
  check(
    skill in c.skills || skill in c.attributes || skill in c.disciplines,
    "Perícia do conflito inexistente.",
  );
  return pool(
    c,
    catalog,
    { attribute, skill, tags: ["combate", ...tags] },
    modifier,
    false,
    ruleset,
  );
}
export function resolveCombat(
  a: Character,
  b: Character,
  catalog: Content[],
  body: CombatInput,
  context: { turn: string; ruleset?: string },
  rng = randomDie,
) {
  const ruleset = context.ruleset ?? "companion",
    ao = structuredClone(a),
    bo = structuredClone(b),
    track = body.social ? "willpower" : "health",
    tech = body.technique;
  check(a.id !== b.id, "Selecione participantes diferentes.");
  check(
    !envelopActionBlocked(a),
    "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
  );
  check(
    !concentrating(a),
    "Athanor exige concentração exclusiva; interrompa a preparação antes de agir.",
  );
  check(
    !body.social || tech === "strike",
    "Técnicas físicas não se aplicam a conflito social.",
  );
  check(
    !["bite", "stake"].includes(tech) || !body.staticDefense || body.unilateral,
    "Ataque contra defesa estática deve ser unilateral.",
  );
  if (tech === "release") {
    check(
      b.grappledBy === a.id,
      "O alvo não está restringido por este personagem.",
    );
    bo.grappledBy = "";
    bo.grappleSinceTurn = "";
    bo.grappleLastTurn = "";
    return {
      a: ao,
      b: bo,
      ar: null,
      br: null,
      damage: { toA: 0, toB: 0, margin: 0 },
      reports: { toA: null, toB: null },
      track,
      message: "O alvo foi solto.",
    };
  }
  check(
    !a.conditions.includes("Torpor") &&
      !a.conditions.includes("Incapacitado: coma ou morte") &&
      !a.conditions.includes("Morte Final"),
    "O participante ativo está incapacitado; resolva sua recuperação antes de agir.",
  );
  check(
    a.health.aggravated < derived(a, catalog).healthMax,
    "O participante ativo está incapacitado pela Vitalidade esgotada.",
  );
  check(
    !a.conditions.includes("Estacado") || body.social,
    "Um personagem estacado não pode realizar uma ação física.",
  );
  const inactiveDefense =
    envelopActionBlocked(b) ||
    concentrating(b) ||
    b.health.aggravated >= derived(b, catalog).healthMax ||
    b.conditions.some((x) =>
      ["Torpor", "Morte Final", "Incapacitado: coma ou morte"].includes(x),
    ) ||
    (!body.social && b.conditions.includes("Estacado"));
  check(
    !inactiveDefense || (!body.social && body.staticDefense),
    "O alvo está incapacitado; selecione defesa estática e resolva as consequências com o Narrador.",
  );
  check(
    !a.grappledBy || a.grappledBy === b.id,
    "O personagem está restringido e só pode agir contra seu agarrador.",
  );
  check(
    !b.grappledBy || b.grappledBy === a.id,
    "O alvo está envolvido em outro agarramento; o Narrador deve resolver a intervenção.",
  );
  if (["hold", "crush"].includes(tech)) {
    check(b.grappledBy === a.id, "Esta ação exige um alvo já agarrado.");
    check(
      b.grappleSinceTurn !== context.turn,
      "Avance ao próximo turno antes de resolver a continuação do agarramento.",
    );
  }
  if (tech === "escape")
    check(
      a.grappledBy === b.id,
      "O personagem não está agarrado pelo oponente.",
    );
  if (tech === "grapple") check(!b.grappledBy, "O alvo já está agarrado.");
  if (tech === "bite")
    check(
      a.nature === "vampire" &&
        !a.advantages.some((x) => x.contentId === "flaw-dentes-de-bebe"),
      "Mordida vampírica exige presas funcionais.",
    );
  if (tech === "stake")
    check(
      b.nature === "vampire" && b.generation < 14,
      "O estaqueamento paralisante se aplica a vampiros regulares; resolva Sangues-Ralos conforme sua fonte.",
    );
  check(
    !body.social || !body.staticDefense,
    "Conflito social exige oposição; use teste normal para uma ação sem adversário.",
  );
  const grappleContest =
    ["hold", "crush", "escape"].includes(tech) ||
    (tech === "bite" && b.grappledBy === a.id);
  if (tech === "bite" && b.grappledBy === a.id)
    check(
      b.grappleSinceTurn !== context.turn,
      "A mordida no agarramento exige o próximo turno.",
    );
  if (grappleContest) {
    const victim = tech === "escape" ? a : b;
    check(
      victim.grappleLastTurn !== context.turn,
      "O agarramento já foi resolvido neste turno.",
    );
    if (tech === "escape") ao.grappleLastTurn = context.turn;
    else bo.grappleLastTurn = context.turn;
  }
  const attributeA =
      grappleContest || tech === "grapple" || tech === "bite"
        ? "forca"
        : body.attributeA,
    skillA =
      grappleContest || tech === "grapple" || tech === "bite"
        ? "briga"
        : body.skillA;
  const attributeB = grappleContest ? "forca" : body.attributeB,
    skillB = grappleContest ? "briga" : body.skillB;
  const wa = body.social
      ? undefined
      : equipped(a, catalog, body.weaponItemA, "weapon"),
    wb = body.social
      ? undefined
      : equipped(b, catalog, body.weaponItemB, "weapon");
  equipped(a, catalog, body.armorItemA, "armor");
  equipped(b, catalog, body.armorItemB, "armor");
  const penaltyA =
      body.calledPenaltyA +
      (tech === "bite" && b.grappledBy !== a.id ? 1 : tech === "stake" ? 2 : 0),
    penaltyB = body.calledPenaltyB;
  let sourceA = wa?.damageSource ?? body.sourceA,
    sourceB = wb?.damageSource ?? body.sourceB;
  let weaponA = wa?.damage ?? body.weaponA,
    weaponB = wb?.damage ?? body.weaponB;
  if (tech === "stake") {
    check(!wa || wa.damage === 0, "A estaca tem bônus de dano zero.");
    weaponA = 0;
    sourceA = "piercing";
  }
  if (tech === "bite") weaponA = 0;
  let ar0 = roll(
    checkedPool(
      a,
      catalog,
      attributeA,
      skillA,
      body.modifierA +
        (!body.social && body.rangedA ? -fogPenalty(b) : 0) +
        (!body.social && body.rangedB ? body.coverA : 0) -
        body.successiveDefenseA,
      ruleset,
      [
        ...body.tagsA,
        ...(!body.social && body.rangedA ? ["ataqueDistancia"] : []),
        ...(b.nature === "mortal" ? ["alvoMortal"] : []),
      ],
    ),
    a.nature === "mortal" ? 0 : a.hunger,
    0,
    rng,
  );
  let br0 = body.staticDefense
    ? undefined
    : roll(
        checkedPool(
          b,
          catalog,
          attributeB,
          skillB,
          body.modifierB +
            (!body.social && body.rangedB ? -fogPenalty(a) : 0) +
            (!body.social && body.rangedA ? body.coverB : 0) +
            (body.fullDefenseB ? 1 : 0) -
            body.successiveDefenseB,
          ruleset,
          [
            ...body.tagsB,
            ...(!body.social && body.rangedB ? ["ataqueDistancia"] : []),
            ...(a.nature === "mortal" ? ["alvoMortal"] : []),
          ],
        ),
        b.nature === "mortal" ? 0 : b.hunger,
        0,
        rng,
      );
  const as = Math.max(0, ar0.successes - penaltyA),
    bs = body.staticDefense
      ? body.difficulty
      : Math.max(0, br0!.successes - penaltyB);
  const strict = grappleContest || tech === "grapple" || tech === "stake";
  const ar = {
      ...evaluate(ar0.normal, ar0.hunger, bs + penaltyA + (strict ? 1 : 0)),
      netSuccesses: as,
      successPenalty: penaltyA,
      margin: as - bs,
    },
    br = br0
      ? {
          ...evaluate(
            br0.normal,
            br0.hunger,
            as + penaltyB + (grappleContest ? 1 : 0),
          ),
          netSuccesses: bs,
          successPenalty: penaltyB,
          margin: bs - as,
        }
      : null;
  let damage = conflict(
      { ...ar, successes: as },
      { ...(br ?? ar), successes: bs },
      body.unilateral || body.fullDefenseB || body.staticDefense,
      weaponA,
      weaponB,
    ),
    message = "Conflito resolvido.";
  if (["grapple", "hold", "crush", "escape", "bite", "stake"].includes(tech)) {
    const win =
      ar.win && (tech === "bite" && !grappleContest ? as >= bs : as > bs);
    damage = { toA: 0, toB: 0, margin: as - bs };
    if (tech === "escape") {
      if (win) {
        ao.grappledBy = "";
        ao.grappleSinceTurn = "";
        ao.grappleLastTurn = "";
        message = "Escapou; pode mover-se livremente na próxima rodada.";
      } else message = "O agarramento continua.";
    } else if (grappleContest || tech === "grapple" || tech === "bite") {
      if (win) {
        if (tech === "crush") damage.toB = as - bs;
        else if (tech === "bite") damage.toB = 2;
        if (tech !== "crush") {
          bo.grappledBy = a.id;
          bo.grappleLastTurn = context.turn;
          bo.grappleSinceTurn = b.grappleSinceTurn || context.turn;
        }
        message =
          tech === "bite"
            ? "Mordida: exatamente dois danos agravados; alvo agarrado."
            : tech === "crush"
              ? "Dano por margem no agarramento."
              : "Alvo restringido sem dano.";
      } else if (b.grappledBy === a.id && bs > as) {
        bo.grappledBy = "";
        bo.grappleSinceTurn = "";
        bo.grappleLastTurn = "";
        message = "O alvo escapou e pode mover-se na próxima rodada.";
      } else message = "A técnica não venceu a oposição.";
    } else if (tech === "stake") {
      if (win) {
        damage.toB = as - bs;
        if (damage.toB >= 5) {
          const condition = bo.advantages.some(
            (x) => x.contentId === "flaw-isca-de-estaca",
          )
            ? "Morte Final"
            : "Estacado";
          if (!bo.conditions.includes(condition)) bo.conditions.push(condition);
          message = bo.conditions.includes("Morte Final")
            ? "Isca de Estaca: Morte Final."
            : "Estaca atingiu o coração: alvo paralisado e inicialmente consciente.";
        } else
          message =
            "Ataque atingiu, mas não causou os cinco danos necessários para estaquear.";
      } else message = "O estaqueamento falhou.";
    }
  }
  if (
    ["grapple", "bite", "stake"].includes(tech) &&
    !grappleContest &&
    !body.unilateral &&
    !body.fullDefenseB &&
    !body.staticDefense &&
    bs >= as
  )
    damage.toA = (bs - as || 1) + weaponB;
  const lethal = body.lethalBody && hasPower(a, "power-potencia-corpo-letal");
  check(!body.lethalBody || lethal, "Corpo Letal precisa estar adquirido.");
  if (lethal && skillA === "briga" && !wa && b.nature === "mortal")
    sourceA = "piercing";
  const da = receiveDamage(ao, catalog, {
    amount: damage.toA,
    track,
    source: body.social ? "manual" : sourceB,
    aggravated: body.aggravated,
    armorItem: body.armorItemA,
    armorIgnore: hasPower(b, "power-potencia-corpo-letal")
      ? (b.disciplines["discipline-potencia"] ?? 0)
      : 0,
    ruleset,
    mixedOrder: body.mixedOrderA,
  });
  const db = receiveDamage(bo, catalog, {
    amount: damage.toB,
    track,
    source: tech === "bite" ? "supernatural" : body.social ? "manual" : sourceA,
    aggravated: body.aggravated,
    armorItem: body.armorItemB,
    armorIgnore: hasPower(a, "power-potencia-corpo-letal")
      ? (a.disciplines["discipline-potencia"] ?? 0)
      : 0,
    ruleset,
    mixedOrder: body.mixedOrderB,
  });
  return {
    a: da.character,
    b: db.character,
    ar,
    br,
    damage,
    reports: { toA: da.report, toB: db.report },
    track,
    message,
  };
}
export const oneRollSchema = z.object({
  difficulty: z.number().int().min(1).max(30),
  social: z.boolean().default(false),
  aggravated: z.boolean().default(false),
  recordId: z.string().max(100).default(""),
  note: z.string().max(2000).default(""),
  participants: z
    .array(
      z.object({
        id,
        attribute: id,
        skill: id,
        modifier: z.number().int().min(-30).max(30).default(0),
        tags: z.array(z.string().max(100)).max(40).default([]),
        surge: z.literal(false).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export function oneRollConflict(
  c: Character,
  catalog: Content[],
  input: {
    attribute: string;
    skill: string;
    modifier: number;
    difficulty: number;
    social: boolean;
    aggravated: boolean;
    ruleset?: string;
    tags?: string[];
  },
  rng = randomDie,
) {
  check(
    !envelopActionBlocked(c),
    "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
  );
  check(
    !concentrating(c),
    "Athanor exige concentração exclusiva; interrompa a preparação antes de agir.",
  );
  check(
    !c.conditions.some((x) =>
      ["Torpor", "Morte Final", "Incapacitado: coma ou morte"].includes(x),
    ) && c.health.aggravated < derived(c, catalog).healthMax,
    "O participante está incapacitado.",
  );
  check(
    input.social || !c.conditions.includes("Estacado"),
    "Um personagem estacado não pode participar de um conflito físico.",
  );
  const result = roll(
    checkedPool(
      c,
      catalog,
      input.attribute,
      input.skill,
      input.modifier,
      input.ruleset ?? "companion",
      input.tags,
    ),
    c.nature === "mortal" ? 0 : c.hunger,
    input.difficulty,
    rng,
  );
  const damage = Math.max(0, 2 * input.difficulty - result.successes),
    out = receiveDamage(c, catalog, {
      amount: damage,
      track: input.social ? "willpower" : "health",
      aggravated: input.aggravated,
      halve: false,
      ignoreMitigation: true,
    });
  return { ...out, result, damage };
}
