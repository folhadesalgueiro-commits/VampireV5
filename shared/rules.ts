import {
  ALCHEMY,
  isThinBlood,
  hasTrait,
  projectThinBloodGrants,
  validateThinBloodCreation,
} from "./thin-blood";
import {
  Character,
  Content,
  Effect,
  attributes,
  skillGroups,
  skills,
} from "./model";
import { envelopPenalty } from "./alchemy-effects";
export class RuleError extends Error {}
export const check = (ok: unknown, message: string) => {
  if (!ok) throw new RuleError(message);
};
export type DiceResult = {
  normal: number[];
  hunger: number[];
  successes: number;
  difficulty: number;
  win: boolean;
  critical: boolean;
  messy: boolean;
  bestial: boolean;
  margin: number;
  label: string;
};
export function randomDie() {
  const a = new Uint32Array(1);
  let x: number;
  do {
    globalThis.crypto.getRandomValues(a);
    x = a[0];
  } while (x >= 4294967290);
  return (x % 10) + 1;
}
export function evaluate(
  normal: number[],
  hunger: number[],
  difficulty: number,
): DiceResult {
  check(
    Number.isInteger(difficulty) && difficulty >= 0 && difficulty <= 100,
    "Dificuldade inválida.",
  );
  check(
    [...normal, ...hunger].every(
      (v) => Number.isInteger(v) && v >= 1 && v <= 10,
    ),
    "Os dados devem ter valores entre 1 e 10.",
  );
  const all = [...normal, ...hunger],
    tens = all.filter((v) => v === 10).length;
  const successes = all.filter((v) => v >= 6).length + 2 * Math.floor(tens / 2),
    win = successes >= difficulty;
  const critical = win && tens >= 2,
    messy = critical && hunger.includes(10),
    bestial = !win && hunger.includes(1);
  return {
    normal,
    hunger,
    successes,
    difficulty,
    win,
    critical,
    messy,
    bestial,
    margin: successes - difficulty,
    label: messy
      ? "Crítico Confuso"
      : bestial
        ? "Falha Bestial"
        : critical
          ? "Vitória Crítica"
          : win
            ? "Vitória"
            : successes === 0
              ? "Falha Total"
              : "Falha",
  };
}
export function roll(
  pool: number,
  hunger: number,
  difficulty: number,
  rng = randomDie,
  excludeHunger = false,
) {
  check(
    Number.isInteger(pool) && pool >= 1 && pool <= 100,
    "A parada deve ter de 1 a 100 dados.",
  );
  check(
    Number.isInteger(hunger) && hunger >= 0 && hunger <= 5,
    "Fome inválida.",
  );
  const count = excludeHunger ? 0 : Math.min(pool, hunger);
  return evaluate(
    Array.from({ length: pool - count }, rng),
    Array.from({ length: count }, rng),
    difficulty,
  );
}
export function reroll(result: DiceResult, indices: number[], rng = randomDie) {
  check(
    indices.length >= 1 &&
      indices.length <= 3 &&
      new Set(indices).size === indices.length,
    "Selecione de um a três dados normais diferentes.",
  );
  check(
    indices.every(
      (i) => Number.isInteger(i) && i >= 0 && i < result.normal.length,
    ),
    "Dados de Fome não podem ser rerrolados.",
  );
  return evaluate(
    result.normal.map((v, i) => (indices.includes(i) ? rng() : v)),
    result.hunger,
    result.difficulty,
  );
}
export const potencyTable = [
  [0, 1, 0, 0, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 1],
  [1, 2, 1, 1, 1, 0, 1],
  [2, 2, 1, 2, 2, 0, 1],
  [2, 3, 2, 2, 2, 1, 1],
  [3, 3, 2, 3, 3, 1, 2],
  [3, 3, 3, 3, 3, 2, 2],
  [4, 3, 3, 4, 4, 2, 2],
  [4, 4, 4, 4, 4, 2, 3],
  [5, 4, 4, 5, 5, 2, 3],
  [5, 5, 5, 5, 5, 3, 3],
];
export function blood(potency: number, ruleset = "companion") {
  check(
    Number.isInteger(potency) && potency >= 0 && potency <= 10,
    "Potência do Sangue inválida.",
  );
  const [surge, mend, bonus, rerollLevel, bane, feedPenalty, floor] =
    potencyTable[potency];
  return {
    surge: surge + (ruleset === "companion" ? 1 : 0),
    mend,
    bonus,
    rerollLevel,
    bane: potency === 0 ? 0 : bane + (ruleset === "companion" ? 1 : 0),
    feedPenalty,
    floor,
    animal: potency < 2 ? 1 : potency === 2 ? 0.5 : 0,
  };
}
export function generationBounds(g: number) {
  return g >= 14
    ? [0, 0]
    : g >= 12
      ? [1, 3]
      : g >= 10
        ? [1, 4]
        : g === 9
          ? [2, 5]
          : g === 8
            ? [2, 6]
            : g === 7
              ? [3, 7]
              : g === 6
                ? [3, 8]
                : g === 5
                  ? [4, 9]
                  : [5, 10];
}
export function rouse(
  hunger: number,
  { forced = false, waking = false, double = false } = {},
  rng = randomDie,
) {
  check(
    forced || waking || hunger < 5,
    "Fome 5 impede um Despertar voluntário.",
  );
  const dice = Array.from({ length: double ? 2 : 1 }, rng),
    success = dice.some((x) => x >= 6),
    over = hunger === 5 && !success;
  return {
    dice,
    success,
    hunger: Math.min(5, hunger + (success ? 0 : 1)),
    torpor: waking && over,
    frenzy: !waking && hunger === 5 && forced,
  };
}
export type Context = {
  targetContext?: string;
  attribute?: string;
  skill?: string;
  tags?: string[];
  margin?: number;
};
export function matches(e: Effect, c: Character, ctx: Context) {
  const { field, operator, value } = e.when;
  if (field === "always") return true;
  const current =
    field === "tag"
      ? (ctx.tags ?? [])
      : field === "condition"
        ? c.conditions
        : field === "clan"
          ? c.clanId
          : field === "skill"
            ? ctx.skill
            : field === "hunger"
              ? c.hunger
              : field === "humanity"
                ? c.humanity
                : c.bloodPotency;
  if (operator === "includes")
    return Array.isArray(current)
      ? current.includes(String(value))
      : String(current).includes(String(value));
  if (operator === "gte") return Number(current) >= Number(value);
  if (operator === "lte") return Number(current) <= Number(value);
  return Array.isArray(current)
    ? current.includes(String(value))
    : current === value;
}
export function effectValue(
  e: Effect,
  c: Character,
  source: Content,
  ctx: Context = {},
) {
  const level =
    c.disciplines[source.parentId] ??
    c.advantages.find((x) => x.contentId === source.id)?.level ??
    source.level;
  return (
    e.value *
    (e.scale === "discipline"
      ? level
      : e.scale === "margin"
        ? Math.max(0, ctx.margin ?? 0)
        : 1)
  );
}
export function passiveEffects(c: Character, catalog: Content[]) {
  return catalog
    .filter(
      (e) => !(c.clanId === "clan-nosferatu" && e.id === "flaw-repulsivo"),
    )
    .filter(
      (e) =>
        c.advantages.some((a) => a.contentId === e.id) ||
        c.powers.includes(e.id) ||
        c.clanId === e.id,
    )
    .flatMap((source) =>
      source.effects
        .filter(
          (e) =>
            e.duration === "permanent" &&
            e.recipient === "self" &&
            (!["power", "ritual", "ceremony", "formula"].includes(
              source.kind,
            ) ||
              (source.duration === "permanent" &&
                source.rouse === 0 &&
                source.willpowerCost === 0 &&
                !source.attribute)),
        )
        .map((effect) => ({ effect, source })),
    );
}
export function derived(c: Character, catalog: Content[], ctx: Context = {}) {
  const a = { ...c.attributes },
    sources = [
      ...passiveEffects(c, catalog),
      ...c.activeEffects.map((x) => ({
        effect: x.effect,
        source:
          catalog.find((y) => y.id === x.sourceId) ??
          ({ id: x.sourceId, parentId: "", level: 1 } as Content),
      })),
    ];
  let healthBonus = 0,
    willBonus = 0,
    diceBonus = 0;
  for (const { effect: e, source } of sources) {
    if (!matches(e, c, ctx)) continue;
    const value = effectValue(e, c, source, ctx);
    if (e.kind === "attribute" && e.target in a)
      a[e.target] = Math.max(0, a[e.target] + value);
    if (e.kind === "health") healthBonus += value;
    if (e.kind === "willpower") willBonus += value;
    if (
      e.kind === "dice" &&
      (!e.target ||
        e.target === "all" ||
        e.target === ctx.skill ||
        e.target === ctx.attribute ||
        (ctx.tags ?? []).includes(e.target))
    )
      diceBonus += value;
  }
  const healthMax = Math.max(1, a.vigor + 3 + healthBonus),
    willpowerMax = Math.max(1, a.autocontrole + a.determinacao + willBonus);
  const healthImpaired =
      c.health.superficial + c.health.aggravated >= healthMax,
    willpowerImpaired =
      c.willpower.superficial + c.willpower.aggravated >= willpowerMax;
  const degeneration = c.stains > 10 - c.humanity;
  const physical = ["forca", "destreza", "vigor"].includes(ctx.attribute ?? "");
  // Degeneração estabelece a mesma condição Comprometido: a penalidade não se duplica.
  const penalty =
    degeneration || (physical ? healthImpaired : willpowerImpaired) ? 2 : 0;
  return {
    attributes: a,
    healthMax,
    willpowerMax,
    healthImpaired,
    willpowerImpaired,
    degeneration,
    diceBonus,
    penalty,
    xpAvailable: c.xpTotal - c.xpSpent,
  };
}
export function pool(
  c: Character,
  catalog: Content[],
  ctx: Context,
  modifier = 0,
  specialty = false,
  ruleset = "companion",
  discipline = false,
) {
  const d = derived(c, catalog, ctx);
  const a =
    d.attributes[ctx.attribute ?? ""] ??
    c.disciplines[ctx.attribute ?? ""] ??
    0;
  const s =
    c.skills[ctx.skill ?? ""] ??
    c.disciplines[ctx.skill ?? ""] ??
    d.attributes[ctx.skill ?? ""] ??
    0;
  const armorPenalty =
    ctx.attribute === "destreza"
      ? c.inventory
          .filter((x) => x.equipped)
          .reduce(
            (n, x) =>
              Math.max(
                n,
                catalog.find((e) => e.id === x.contentId)?.dexterityPenalty ??
                  0,
              ),
            0,
          )
      : 0;
  let humanityPenalty = 0;
  if (c.nature !== "mortal" && ctx.tags?.includes("interacaoHumana"))
    humanityPenalty =
      c.humanity >= 6
        ? 0
        : c.humanity === 5
          ? 1
          : c.humanity >= 3
            ? 2
            : c.humanity === 2
              ? 6
              : 8;
  if (
    c.nature !== "mortal" &&
    ctx.tags?.includes("interacaoHumana") &&
    ctx.tags?.includes("brilhoVida") &&
    c.humanity <= 2
  )
    humanityPenalty = c.humanity === 2 ? 4 : 5;
  return Math.max(
    1,
    Math.min(
      100,
      a +
        s +
        modifier +
        (specialty ? 1 : 0) +
        d.diceBonus -
        d.penalty -
        envelopPenalty(c, ctx) -
        humanityPenalty -
        armorPenalty +
        (discipline ? blood(c.bloodPotency, ruleset).bonus : 0),
    ),
  );
}
export function applyDamage(
  track: { superficial: number; aggravated: number },
  max: number,
  amount: number,
  aggravated = false,
  halve = true,
) {
  check(
    Number.isInteger(amount) && amount >= 0 && amount <= 100,
    "Quantidade de dano inválida.",
  );
  let points = !aggravated && halve ? Math.ceil(amount / 2) : amount;
  let { superficial, aggravated: agg } = track;
  while (points-- > 0) {
    if (superficial + agg < max) {
      if (aggravated) agg++;
      else superficial++;
    } else if (superficial > 0) {
      superficial--;
      agg++;
    }
  }
  return { superficial, aggravated: agg };
}
export function addStains(c: Character, amount: number, catalog: Content[]) {
  check(
    Number.isInteger(amount) && amount >= 1 && amount <= 10,
    "Registre de uma a dez Máculas.",
  );
  const capacity = 10 - c.humanity,
    before = Math.max(0, c.stains - capacity),
    after = Math.max(0, c.stains + amount - capacity);
  return {
    ...c,
    stains: c.stains + amount,
    willpower: applyDamage(
      c.willpower,
      derived(c, catalog).willpowerMax,
      after - before,
      true,
      false,
    ),
  };
}
export function remorse(c: Character, rng = randomDie) {
  check(c.stains > 0, "Não há Máculas para um teste de Remorso.");
  const result = roll(Math.max(1, 10 - c.humanity - c.stains), 0, 1, rng, true);
  return {
    character: {
      ...c,
      stains: 0,
      humanity: Math.max(0, c.humanity - (result.win ? 0 : 1)),
    },
    result,
  };
}
export function feed(
  c: Character,
  {
    source,
    amount,
    killed = false,
    processed = false,
    iron = false,
  }: {
    source: "human" | "animal" | "bag";
    amount: number;
    killed?: boolean;
    processed?: boolean;
    iron?: boolean;
  },
  ruleset = "companion",
) {
  check(
    Number.isInteger(amount) && amount >= 1 && amount <= 5,
    "Informe de uma a cinco unidades de Fome da fonte.",
  );
  check(
    !processed || iron,
    "Sangue processado exige Garganta de Ferro (Básico, p. 189).",
  );
  check(
    !killed || source === "human",
    "Somente drenar e matar um humano pode reduzir a Fome a zero.",
  );
  const b = blood(c.bloodPotency, ruleset),
    reduction =
      source === "human"
        ? Math.max(0, amount - b.feedPenalty)
        : Math.floor(amount * b.animal);
  return Math.min(
    c.hunger,
    Math.max(killed ? 0 : b.floor, c.hunger - reduction),
  );
}
export function requirementsMet(content: Content, c: Character) {
  return content.requirements.every((r) =>
    r.kind === "discipline"
      ? (c.disciplines[r.target] ?? 0) >= r.level
      : r.kind === "attribute"
        ? (c.attributes[r.target] ?? 0) >= r.level
        : r.kind === "skill"
          ? (c.skills[r.target] ?? 0) >= r.level
          : r.kind === "clan"
            ? c.clanId === r.target
            : r.kind === "power"
              ? c.powers.includes(r.target)
              : c.advantages.some(
                  (a) => a.contentId === r.target && a.level >= r.level,
                ),
  );
}
export function validateCreation(c: Character, catalog: Content[]) {
  const problems: string[] = [];
  const values = Object.values(c.attributes).sort((a, b) => a - b);
  if (values.join(",") !== "1,2,2,2,2,3,3,3,4")
    problems.push("Atributos: distribua um 4, três 3, quatro 2 e um 1.");
  const distribution = {
    generalist: [0, 10, 8, 1, 0],
    balanced: [0, 7, 5, 3, 0],
    specialist: [0, 3, 3, 3, 1],
  }[c.creation.skillDistribution];
  const count = Array.from(
    { length: 6 },
    (_, i) => Object.values(c.skills).filter((x) => x === i).length,
  );
  if (distribution.some((n, i) => i > 0 && count[i] !== n) || count[5])
    problems.push(
      "A distribuição de Perícias não corresponde ao perfil escolhido.",
    );
  const clan = catalog.find(
    (x) => x.id === c.clanId && ["clan", "lineage"].includes(x.kind),
  );
  const thin = c.nature === "vampire" && c.generation >= 14;
  const bounds = generationBounds(c.generation);
  if (c.nature === "mortal") {
    if (
      c.clanId ||
      c.sire ||
      c.predatorId ||
      Object.values(c.disciplines).some((x) => x > 0) ||
      c.powers.length
    )
      problems.push(
        "Mortais não têm Clã, Senhor, Disciplinas ou Predador na criação.",
      );
    if (c.hunger || c.bloodPotency)
      problems.push("Mortais não possuem Fome ou Potência do Sangue.");
    if (
      c.advantages.some(
        (a) =>
          [
            "flaw-arcaico",
            "background-rebanho",
            "background-status",
            "merit-garganta-de-ferro",
            "flaw-fazendeiro",
          ].includes(a.contentId) ||
          [
            "Arcaico",
            "Domínio",
            "Alimentação",
            "Rebanho",
            "Mítico",
            "Status",
            "Sangue-Ralo",
          ].includes(catalog.find((x) => x.id === a.contentId)?.category ?? ""),
      )
    )
      problems.push(
        "Vantagem ou Defeito exclusivo de vampiros não permitido para mortal.",
      );
  } else {
    if (!clan) problems.push("Escolha um Clã disponível.");
    if (c.bloodPotency < bounds[0] || c.bloodPotency > bounds[1])
      problems.push("Potência do Sangue incompatível com a Geração.");
    if (thin && clan?.id !== "clan-sangue-ralo")
      problems.push("Gerações 14–16 exigem Sangue-Ralo.");
    if (!thin && clan?.id === "clan-sangue-ralo")
      problems.push("Sangue-Ralo exige Geração 14–16.");
    if (c.creation.age === "ancilla" && ![10, 11].includes(c.generation))
      problems.push(
        "Ancillae iniciais usam Geração 10 ou 11 no perfil fornecido.",
      );
    if (c.creation.age === "neonate" && ![12, 13].includes(c.generation))
      problems.push("Neófitos iniciais usam Geração 12 ou 13.");
    if (c.creation.age === "fledgling" && c.generation < 12)
      problems.push("Crias iniciais usam Geração 12–16 no perfil fornecido.");
    if (c.bloodPotency !== (thin ? 0 : c.creation.age === "ancilla" ? 2 : 1))
      problems.push(
        "Potência inicial esperada: 0 para Sangue-Ralo, 2 para Ancillae e 1 para Crias/Neófitos.",
      );
    if (
      c.clanId === "clan-nosferatu" &&
      c.advantages.some((x) =>
        ["merit-belo", "merit-deslumbrante"].includes(x.contentId),
      )
    )
      problems.push("Nosferatu não adquire Qualidades de Aparência.");
    const ds = Object.entries(c.disciplines).filter(([, n]) => n > 0);
    if (
      !thin &&
      ds
        .map(([, n]) => n)
        .sort()
        .join(",") !== "1,2"
    )
      problems.push(
        "Disciplinas iniciais: duas do Clã, com níveis 2 e 1 antes do Predador.",
      );
    if (
      !thin &&
      clan?.id !== "clan-caitiff" &&
      ds.some(([k]) => !clan?.disciplines.includes(k))
    )
      problems.push("Há Disciplina inicial fora do Clã.");
    if (thin && (ds.length || c.powers.length))
      problems.push("Sangues-Ralos não possuem Disciplinas intrínsecas.");
    if (thin)
      problems.push(...validateThinBloodCreation(c, catalog, requirementsMet));
    for (const [key, level] of ds) {
      const ps = catalog
        .filter(
          (x) =>
            c.powers.includes(x.id) && x.kind === "power" && x.parentId === key,
        )
        .sort((a, b) => a.level - b.level);
      if (
        ps.length !== level ||
        ps.some((x, i) => x.level > i + 1 || !requirementsMet(x, c))
      )
        problems.push(
          "Escolha um Poder permitido por ponto em cada Disciplina.",
        );
    }
    if (
      c.powers.some(
        (k) =>
          !catalog.some(
            (p) =>
              p.id === k &&
              (p.kind === "power" ||
                (p.kind === "ritual" &&
                  p.level === 1 &&
                  p.parentId === "discipline-feiticaria-do-sangue")) &&
              (c.disciplines[p.parentId] ?? 0) >= p.level,
          ),
      )
    )
      problems.push("Há Poder não permitido na ficha.");
    if (
      c.powers.filter((k) =>
        catalog.some((p) => p.id === k && p.kind === "ritual"),
      ).length > 1
    )
      problems.push(
        "Na criação, Feitiçaria do Sangue concede um Ritual de nível 1.",
      );
  }
  const initial = c.advantages.filter(
    (a) =>
      !["predator", "clan"].includes(a.source) &&
      catalog.find((x) => x.id === a.contentId)?.category !== "Sangue-Ralo",
  );
  const points = (flaw: boolean) =>
    initial.reduce(
      (n, a) =>
        n +
        ((catalog.find((x) => x.id === a.contentId)?.kind === "flaw") === flaw
          ? a.level
          : 0),
      0,
    );
  if (
    points(false) !==
    (c.nature !== "mortal" && c.creation.age === "ancilla" ? 9 : 7)
  )
    problems.push(
      "Distribua 7 pontos em Vantagens (9 para Ancillae), sem contar o Predador.",
    );
  if (
    points(true) <
    (c.nature !== "mortal" && c.creation.age === "ancilla" ? 4 : 2)
  )
    problems.push(
      "Adquira pelo menos 2 pontos de Defeitos (4 para Ancillae), além do Predador.",
    );
  if (
    c.convictions.length < 1 ||
    c.convictions.length > 3 ||
    c.convictions.some((x) => !x.conviction.trim() || !x.pillar.trim())
  )
    problems.push("Vincule uma a três Convicções a seus Pilares.");
  if (
    ["erudicao", "oficios", "performance", "ciencia"].some(
      (k) => c.skills[k] > 0 && !c.specialties[k]?.length,
    )
  )
    problems.push(
      "Adicione especializações gratuitas em Erudição, Ofícios, Performance e Ciência quando tiver pontos.",
    );
  const free = Object.entries(c.specialties).reduce(
    (n, [k, v]) =>
      n +
      v.length -
      (["erudicao", "oficios", "performance", "ciencia"].includes(k) &&
      c.skills[k] > 0
        ? 1
        : 0),
    0,
  );
  if (free < 1) problems.push("Escolha mais uma especialização gratuita.");
  if (
    Object.entries(c.specialties).some(
      ([k, v]) => v.length && !(c.skills[k] > 0),
    )
  )
    problems.push("Especializações exigem pelo menos um ponto na Perícia.");
  if (
    c.advantages.some((a) => a.contentId === "flaw-analfabeto") &&
    (c.skills.erudicao > 1 || c.skills.ciencia > 1)
  )
    problems.push("Analfabeto limita Erudição e Ciência a 1.");
  if (
    c.advantages.some((a) => a.contentId === "flaw-arcaico") &&
    (c.creation.age !== "ancilla" || c.skills.tecnologia !== 0)
  )
    problems.push("Arcaico exige Ancillae ou mais velho e Tecnologia 0.");
  if (
    c.clanId === "clan-ventrue" &&
    c.advantages.some((a) =>
      ["merit-garganta-de-ferro", "flaw-fazendeiro"].includes(a.contentId),
    )
  )
    problems.push("Ventrue não adquire Garganta de Ferro nem Fazendeiro.");
  const pred = catalog.find(
    (x) => x.id === c.predatorId && x.kind === "predator",
  );
  if (c.predatorId && !pred) problems.push("Tipo de Predador desconhecido.");
  if (pred) {
    if (thin)
      problems.push(
        "Sangues-Ralos recém-criados não escolhem Tipo de Predador.",
      );
    if (
      c.clanId === "clan-ventrue" &&
      ["predator-ensacador", "predator-fazendeiro"].includes(pred.id)
    )
      problems.push("Ventrue não pode escolher esse Predador.");
    if (pred.id === "predator-fazendeiro" && c.bloodPotency >= 3)
      problems.push("Fazendeiro requer Potência do Sangue inferior a 3.");
    if (!pred.disciplines.includes(c.creation.predatorDiscipline))
      problems.push("Escolha o ponto de Disciplina do Predador.");
    if (
      c.creation.predatorDiscipline === "discipline-feiticaria-do-sangue" &&
      c.clanId !== "clan-tremere"
    )
      problems.push("Feitiçaria do Sangue do Predador é restrita a Tremere.");
    if (
      !pred.specialties.some(
        (x) => x.skill + ":" + x.name === c.creation.predatorSpecialty,
      )
    )
      problems.push("Escolha a especialização do Predador.");
    if (c.bloodPotency + pred.potencyChange > bounds[1])
      problems.push("O Predador ultrapassaria a Potência máxima da Geração.");
  }
  for (const a of c.advantages) {
    const v = catalog.find((x) => x.id === a.contentId);
    if (v && (a.level < v.minLevel || a.level > v.maxLevel))
      problems.push(
        "Pontos de Vantagem ou Defeito fora dos níveis permitidos.",
      );
    if (v?.category === "Sangue-Ralo" && c.generation < 14)
      problems.push(
        "Qualidades e Defeitos de Sangues-Ralos exigem geração 14–16.",
      );
    if (!v || !requirementsMet(v, c))
      problems.push("Vantagem ou Defeito com requisito não satisfeito.");
    if (
      v?.incompatible.some((k) => c.advantages.some((x) => x.contentId === k))
    )
      problems.push("Vantagens/Defeitos incompatíveis.");
  }
  if (
    c.clanId === "clan-caitiff" &&
    c.advantages.some((x) => x.contentId === "background-status")
  )
    problems.push("Caitiff não compra Status positivo na criação.");
  if (
    thin &&
    c.advantages.some(
      (x) =>
        catalog.find((e) => e.id === x.contentId)?.category === "Laço" ||
        [
          "background-mawla",
          "background-status",
          "background-lacaios",
        ].includes(x.contentId),
    )
  )
    problems.push(
      "Laço, Mawla, Status e Lacaios são restritos para Sangues-Ralos na criação (Básico PDF 126).",
    );
  return [...new Set(problems)];
}
export function finishCreation(c: Character, catalog: Content[]) {
  const out = structuredClone(c);
  if (out.nature === "mortal") {
    out.humanity = 7;
    out.hunger = 0;
    out.bloodPotency = 0;
    out.status = "active";
    return out;
  }
  const p = catalog.find((x) => x.id === c.predatorId);
  out.humanity = c.creation.age === "ancilla" ? 6 : 7;
  out.xpTotal =
    c.creation.age === "ancilla" ? 35 : c.creation.age === "neonate" ? 15 : 0;
  out.xpSpent = 0;
  if (isThinBlood(out)) {
    const granted = projectThinBloodGrants(out, catalog);
    granted.bloodPotency = 0;
    granted.status = "active";
    return granted;
  }
  if (p) {
    out.humanity = Math.min(10, Math.max(0, out.humanity + p.humanityChange));
    out.bloodPotency += p.potencyChange;
    const d = c.creation.predatorDiscipline;
    out.disciplines[d] = (out.disciplines[d] ?? 0) + 1;
    const s = p.specialties.find(
      (x) => x.skill + ":" + x.name === c.creation.predatorSpecialty,
    );
    if (s) {
      if (out.skills[s.skill] === 0) out.skills[s.skill] = 1;
      else
        out.specialties[s.skill] = [
          ...(out.specialties[s.skill] ?? []),
          s.name,
        ];
    }
    out.advantages.push(
      ...p.grants.map((x) => ({
        ...x,
        source: "predator" as const,
        notes: p.name,
      })),
    );
  }
  if (
    out.clanId === "clan-caitiff" &&
    !out.advantages.some((a) => a.contentId === "flaw-suspeito")
  )
    out.advantages.push({
      contentId: "flaw-suspeito",
      level: 1,
      source: "clan",
      notes: "Condição inicial de Caitiff, Básico PDF 87.",
    });
  out.status = "active";
  return out;
}
export function xpCost(
  c: Character,
  catalog: Content[],
  kind: string,
  key: string,
) {
  const clan = catalog.find((x) => x.id === c.clanId);
  let current = 0,
    multiplier = 0;
  if (kind === "attribute") {
    check(attributes.includes(key as any), "Atributo inexistente.");
    current = c.attributes[key];
    multiplier = 5;
  } else if (kind === "skill") {
    check(skills.includes(key as any), "Perícia inexistente.");
    current = c.skills[key];
    multiplier = 3;
  } else if (kind === "discipline") {
    check(
      catalog.some((x) => x.id === key && x.kind === "discipline"),
      "Disciplina inexistente.",
    );
    current = c.disciplines[key] ?? 0;
    multiplier = isThinBlood(c)
      ? 7
      : c.clanId === "clan-caitiff"
        ? 6
        : clan?.disciplines.includes(key)
          ? 5
          : 7;
  } else if (kind === "potency") {
    current = c.bloodPotency;
    multiplier = 10;
    check(
      current < generationBounds(c.generation)[1],
      "Potência máxima da Geração atingida.",
    );
  } else if (kind === "specialty") {
    check(c.skills[key] > 0, "Especialização exige pontos na Perícia.");
    return 3;
  } else if (kind === "advantage") {
    const entry = catalog.find(
      (x) => x.id === key && ["merit", "background"].includes(x.kind),
    );
    check(entry, "Vantagem inexistente.");
    check(
      entry!.category !== "Sangue-Ralo",
      "A aquisição posterior de características de Sangue-Ralo exige revisão do Narrador.",
    );
    const owned = c.advantages.find((a) => a.contentId === key);
    check(!owned || owned.level < entry!.maxLevel, "Nível máximo atingido.");
    return 3 * (owned ? 1 : Math.max(1, entry!.minLevel));
  } else if (kind === "ritual" || kind === "formula") {
    const entry = catalog.find((x) => x.id === key && x.kind === kind);
    check(entry, "Conteúdo inexistente.");
    return entry!.level * 3;
  } else throw new RuleError("Tipo de progressão inválido.");
  check(current < (kind === "potency" ? 10 : 5), "Nível máximo atingido.");
  return (current + 1) * multiplier;
}
export function advance(
  c: Character,
  catalog: Content[],
  kind: string,
  key: string,
  specialty = "",
  powerId = "",
  resonance = false,
  mentor = false,
  researchConfirmed = false,
  alchemyMethod = "",
) {
  check(
    c.nature !== "mortal" ||
      !["discipline", "potency", "ritual", "formula"].includes(kind),
    "Mortais não adquirem características vampíricas.",
  );
  const cost = xpCost(c, catalog, kind, key);
  check(c.xpTotal - c.xpSpent >= cost, "Experiência insuficiente.");
  const out = structuredClone(c);
  if (kind === "attribute") out.attributes[key]++;
  if (kind === "skill") out.skills[key]++;
  if (kind === "potency") out.bloodPotency++;
  if (kind === "specialty") {
    check(specialty.trim(), "Informe a especialização.");
    check(
      !c.specialties[key]?.includes(specialty),
      "Especialização já adquirida.",
    );
    out.specialties[key] = [...(out.specialties[key] ?? []), specialty];
  }
  if (kind === "discipline") {
    const alchemy = key === ALCHEMY;
    check(
      !alchemy || isThinBlood(c),
      "Alquimia Sangue-Ralo é reservada aos Sangues-Ralos.",
    );
    check(
      !isThinBlood(c) ||
        alchemy ||
        (hasTrait(c, "merit-afinidade-de-disciplina") &&
          c.thinBlood.affinityDiscipline === key),
      "Sangue-Ralo só progride em Alquimia ou em sua Disciplina de Afinidade; Ressonância temporária usa procedimento próprio.",
    );
    if (alchemy) {
      check(
        researchConfirmed,
        "Confirme a pesquisa e experimentação da Alquimia.",
      );
      const method = c.thinBlood.alchemyMethod || alchemyMethod;
      check(
        ["athanor", "calcinatio", "fixatio"].includes(method),
        "Escolha o método de destilação ao aprender Alquimia.",
      );
      check(
        !alchemyMethod ||
          !c.thinBlood.alchemyMethod ||
          alchemyMethod === c.thinBlood.alchemyMethod,
        "Métodos adicionais são Disciplinas separadas e ainda requerem resolução própria; não substitua o método existente.",
      );
      out.thinBlood.alchemyMethod =
        method as Character["thinBlood"]["alchemyMethod"];
    } else check(resonance, "Confirme a Ressonância apropriada.");
    const clan = catalog.find((x) => x.id === c.clanId);
    if (
      !alchemy &&
      !(c.disciplines[key] > 0) &&
      !clan?.disciplines.includes(key)
    )
      check(
        mentor,
        "Confirme que provou o Sangue de alguém com essa Disciplina.",
      );
    out.disciplines[key] = (out.disciplines[key] ?? 0) + 1;
    const power = catalog.find(
      (x) =>
        x.id === powerId &&
        x.kind === (alchemy ? "formula" : "power") &&
        x.parentId === key,
    );
    check(
      power &&
        power.level <= out.disciplines[key] &&
        !c.powers.includes(powerId) &&
        requirementsMet(power, out),
      alchemy
        ? "Escolha uma fórmula nova permitida para o ponto de Alquimia."
        : "Escolha um Poder novo com requisitos satisfeitos.",
    );
    out.powers.push(powerId);
  }
  if (kind === "advantage") {
    const v = catalog.find((x) => x.id === key)!;
    check(
      requirementsMet(v, c) &&
        !v.incompatible.some((x) =>
          c.advantages.some((a) => a.contentId === x),
        ),
      "Requisitos ou incompatibilidades impedem a compra.",
    );
    const a = out.advantages.find((x) => x.contentId === key);
    if (a) {
      check(a.level < v.maxLevel, "Nível máximo atingido.");
      a.level++;
    } else
      out.advantages.push({
        contentId: key,
        level: Math.max(1, v.minLevel),
        source: "progression",
        notes: "",
      });
  }
  if (kind === "ritual" || kind === "formula") {
    const v = catalog.find((x) => x.id === key)!;
    if (kind === "formula" && v.parentId === ALCHEMY) {
      check(
        isThinBlood(c) && !!c.thinBlood.alchemyMethod,
        "Fórmula de Alquimia exige Sangue-Ralo e um método aprendido.",
      );
      check(
        researchConfirmed,
        "Confirme a pesquisa e experimentação da fórmula.",
      );
    }
    check(
      requirementsMet(v, c) && !c.powers.includes(key),
      "Requisito não satisfeito ou conteúdo já adquirido.",
    );
    check(
      (c.disciplines[v.parentId] ?? 0) >= v.level,
      "Nível insuficiente na Disciplina.",
    );
    out.powers.push(key);
  }
  out.xpSpent += cost;
  return { character: out, cost };
}
export function conflict(
  a: DiceResult,
  b: DiceResult,
  unilateral = false,
  weaponA = 0,
  weaponB = 0,
) {
  const difference = a.successes - b.successes;
  return {
    toB:
      difference > 0
        ? difference + weaponA
        : difference === 0 && !unilateral
          ? 1 + weaponA
          : 0,
    toA:
      difference < 0 && !unilateral
        ? -difference + weaponB
        : difference === 0 && !unilateral
          ? 1 + weaponB
          : 0,
    margin: difference,
  };
}
