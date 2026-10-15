import {
  BloodBond,
  Campaign,
  Character,
  Content,
  bloodBondSchema,
  storyDateSchema,
} from "./model";
import { check, evaluate, pool, randomDie, roll } from "./rules";
import { nightKey, storyClock, turnKey } from "./blood-mechanics";
import { effectiveBaneClan } from "./thin-blood";

export function storyDate(c: Character, campaign?: Campaign) {
  return campaign?.storyDate ?? c.storyDate;
}
export function requireStoryDate(date: string) {
  check(
    storyDateSchema.safeParse(date).success && !!date,
    "Defina uma data válida da crônica nos controles do Narrador.",
  );
  return date;
}
export function addDays(date: string, days: number) {
  const d = new Date(requireStoryDate(date) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return requireStoryDate(d.toISOString().slice(0, 10));
}
export function addMonths(date: string, months: number) {
  const d = new Date(requireStoryDate(date) + "T00:00:00Z"),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(d);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  d.setUTCDate(Math.min(day, end.getUTCDate()));
  return requireStoryDate(d.toISOString().slice(0, 10));
}
export function bondTraits(c: Character, catalog: Content[]) {
  const sources = catalog.filter(
    (x) =>
      x.id === c.clanId ||
      x.id === effectiveBaneClan(c) ||
      c.advantages.some((a) => a.contentId === x.id && a.level > 0),
  );
  const decays = new Set(
    sources.map((x) => x.bondRule.decay).filter((x) => x !== "default"),
  );
  const binding = sources
    .map((x) => x.bondRule.binding)
    .filter((x) => x !== "default");
  return {
    immune: sources.some((x) => x.bondRule.immune),
    instant: sources.some((x) => x.bondRule.instant),
    canBind: binding.includes("blocked")
      ? false
      : binding.includes("allowed")
        ? true
        : c.generation < 14,
    ambiguousBinding:
      binding.includes("allowed") && binding.includes("blocked"),
    resistance: sources.reduce(
      (n, x) =>
        n +
        x.bondRule.resistance *
          (x.bondRule.perLevel
            ? (c.advantages.find((a) => a.contentId === x.id)?.level ?? 1)
            : 1),
      0,
    ),
    decay:
      decays.size > 1
        ? "manual"
        : (([...decays][0] ?? "normal") as
            "normal" | "long" | "short" | "manual"),
  };
}
export function currentBond(c: Character, date = "") {
  return c.bloodBonds.find(
    (b) =>
      b.formed &&
      b.strength > 0 &&
      (!b.releaseOn || !date || b.releaseOn > date),
  );
}
export function settleBondReleases(c: Character, date: string) {
  const out = structuredClone(c);
  if (!date) return out;
  for (const b of out.bloodBonds)
    if (b.releaseOn && b.releaseOn <= date) {
      b.strength = 0;
      b.formed = false;
      b.formationNights = [];
      b.lastDefiance = "";
      b.lastAvoidanceSession = "";
    }
  return out;
}
// Básico PDF 157, 212–213. Datas pertencem à ficção, nunca ao relógio da máquina.
export function drinkForBond(
  c: Character,
  donor: Character,
  catalog: Content[],
  date: string,
  bondId: string,
) {
  requireStoryDate(date);
  check(
    c.nature !== "mortal" && donor.nature !== "mortal",
    "Laços com mortais/carniçais exigem resolução própria do Narrador nesta versão.",
  );
  check(c.id !== donor.id, "Selecione outro vampiro como reinante.");
  const out = settleBondReleases(c, date),
    traits = bondTraits(c, catalog),
    source = bondTraits(donor, catalog),
    existing = currentBond(out, date);
  check(
    !source.ambiguousBinding,
    "As regras de criação de Laços do doador são conflitantes; resolva a variante com o Narrador.",
  );
  if (traits.immune)
    return {
      character: out,
      formed: false,
      message: "A imunidade ao Laço impede o vínculo.",
    };
  if (!source.canBind)
    return {
      character: out,
      formed: false,
      message:
        "O doador não pode criar Laços com vampiros pelas suas características.",
    };
  if (existing && existing.regnantId !== donor.id)
    return {
      character: out,
      formed: false,
      message:
        "O servo já possui um reinante e está imune a outros Laços enquanto o vínculo persistir.",
    };
  let b = out.bloodBonds.find((x) => x.regnantId === donor.id);
  if (!b) {
    check(
      out.bloodBonds.length < 100,
      "O limite de registros de Laço desta ficha foi atingido.",
    );
    b = bloodBondSchema.parse({
      id: bondId,
      regnantId: donor.id,
      regnantName: donor.name,
    });
    out.bloodBonds.push(b);
  }
  check(
    !b.lastDrink || date >= b.lastDrink,
    "Não registre uma bebida anterior ao último reforço do Laço.",
  );
  if (!b.formed && b.lastDrink && date > addMonths(b.lastDrink, 12))
    b.formationNights = [];
  if (!b.formationNights.includes(date))
    b.formationNights = [...b.formationNights, date].slice(-3);
  if (b.strength === 0) {
    b.releaseOn = "";
    b.formedOn = "";
    b.formedOrder = 0;
  }
  b.regnantName = donor.name;
  const wasFormed = b.formed;
  b.strength = Math.min(6, b.strength + 1);
  b.lastDrink = date;
  b.decayPeriods = 0;
  b.moonEvents = [];
  if (!b.formed && (traits.instant || b.formationNights.length >= 3)) {
    b.formed = true;
    b.formedOn = date;
  }
  return {
    character: out,
    formed: !wasFormed && b.formed,
    bondId: b.id,
    message: b.formed
      ? "Laço de Sangue formado ou reforçado."
      : "Bebida registrada: " +
        b.formationNights.length +
        " de " +
        (traits.instant ? 1 : 3) +
        " noites para formar o Laço.",
  };
}
export function decayBloodBond(
  c: Character,
  catalog: Content[],
  bondId: string,
  date: string,
  moonPhase?: "full" | "new",
) {
  requireStoryDate(date);
  const out = settleBondReleases(c, date),
    b = out.bloodBonds.find((x) => x.id === bondId),
    traits = bondTraits(c, catalog);
  check(
    b && b.formed && b.strength > 0,
    "Selecione um Laço formado e ainda ativo.",
  );
  check(
    date >= b!.lastDrink,
    "A data de decadência não pode anteceder a última bebida.",
  );
  check(
    traits.decay !== "manual",
    "Há regras de decadência conflitantes; o Narrador deve resolver e ajustar a variante.",
  );
  let reduction = 0;
  if (traits.decay === "short") {
    check(
      moonPhase,
      "Laço Curto exige registrar uma lua cheia ou nova confirmada pelo Narrador.",
    );
    const key = date + ":" + moonPhase;
    check(
      date > b!.lastDrink,
      "A mudança de lua precisa ser posterior à última bebida.",
    );
    check(
      !b!.moonEvents.some((x) => x.startsWith(date + ":")),
      "Esta mudança de lua já foi registrada.",
    );
    check(
      b!.moonEvents.length < 12,
      "O limite de mudanças de lua deste reforço foi atingido.",
    );
    b!.moonEvents.push(key);
    reduction = 1;
  } else {
    const step = traits.decay === "long" ? 3 : 1;
    while (
      b!.decayPeriods < 100000 &&
      addMonths(b!.lastDrink, (b!.decayPeriods + 1) * step) <= date &&
      reduction < b!.strength
    ) {
      b!.decayPeriods++;
      reduction++;
    }
    check(
      reduction > 0,
      "Ainda não decorreu um novo período completo sem reforço.",
    );
  }
  b!.strength = Math.max(0, b!.strength - reduction);
  if (b!.strength === 0) {
    b!.formed = false;
    b!.formationNights = [];
    b!.lastDefiance = "";
    b!.lastAvoidanceSession = "";
  }
  return {
    character: out,
    reduction,
    broken: b!.strength === 0,
    strength: b!.strength,
  };
}
export function defyBloodBond(
  c: Character,
  catalog: Content[],
  bondId: string,
  context: {
    campaign?: Campaign;
    date: string;
    present: boolean;
    sessionId?: string;
    reminder?: boolean;
    ruleset?: string;
  },
  rng = randomDie,
) {
  const b = c.bloodBonds.find((x) => x.id === bondId);
  check(
    b &&
      b.formed &&
      b.strength > 0 &&
      (!b.releaseOn || b.releaseOn > context.date),
    "Selecione um Laço formado e ainda ativo.",
  );
  const t = storyClock(c, context.campaign),
    key = context.sessionId
      ? "sessao:" + context.sessionId
      : context.present
        ? "turno:" + turnKey(c, context.campaign)
        : "cena:" + nightKey(c, context.campaign) + "." + t.scene;
  check(
    context.reminder ||
      (context.sessionId
        ? b!.lastAvoidanceSession !== context.sessionId
        : b!.lastDefiance !== key),
    "O desafio deste período já foi realizado. Consulte o resultado no histórico.",
  );
  const n = Math.max(
    1,
    Math.min(
      100,
      pool(
        c,
        catalog,
        {
          attribute: "determinacao",
          skill: "inteligencia",
          tags: ["resistirLaco"],
        },
        0,
        false,
        context.ruleset,
      ) + bondTraits(c, catalog).resistance,
    ),
  );
  const opposition = roll(b!.strength, 0, 0, rng, true),
    r = roll(n, c.hunger, 0, rng),
    result = evaluate(r.normal, r.hunger, opposition.successes),
    out = structuredClone(c),
    updated = out.bloodBonds.find((x) => x.id === bondId)!;
  if (context.sessionId) updated.lastAvoidanceSession = context.sessionId;
  else updated.lastDefiance = key;
  return {
    character: out,
    result,
    opposition,
    key,
    message: result.win
      ? "Desafio ao Laço bem-sucedido; o vínculo permanece."
      : "Desafio ao Laço falhou. O Narrador resolve a obediência e o afastamento.",
  };
}
