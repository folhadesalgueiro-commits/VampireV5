import { describe, expect, it } from "vitest";
import { alchemyActionSchema, alchemyOperation } from "../shared/alchemy";
import {
  AIRBORNE,
  FLIGHT,
  FLIGHT_PASSENGER,
  FLIGHT_READY,
  concentrating,
  flightSpeed,
} from "../shared/alchemy-effects";
import { Character, characterSchema, emptyCharacter } from "../shared/model";
import { expireEffects } from "../shared/blood-mechanics";
import { ALCHEMY } from "../shared/thin-blood";
import { seedCatalog } from "../server/seed";
import { validThinCharacter } from "./fixtures";
const catalog = seedCatalog();
let sequence = 0;
function source(method: "fixatio" | "athanor" | "calcinatio" = "fixatio") {
  const c = validThinCharacter();
  c.status = "active";
  c.thinBlood.alchemyMethod = method;
  c.disciplines[ALCHEMY] = 4;
  c.powers = [FLIGHT];
  c.attributes.inteligencia = 1;
  c.attributes.forca = 3;
  return c;
}
function other(id = "other"): Character {
  const c = characterSchema.parse({
    ...emptyCharacter(),
    name: "Passageiro de teste",
    nature: "mortal",
    hunger: 0,
  });
  c.attributes.forca = 2;
  c.attributes.vigor = 3;
  c.skills.atletismo = 1;
  c.attributes.determinacao = 3;
  c.attributes.autocontrole = 3;
  return { ...c, id, version: 1 };
}
function run(
  c: Character,
  data: any,
  opts: { characters?: Character[]; rng?: () => number; gm?: boolean } = {},
) {
  return alchemyOperation(
    c,
    catalog,
    alchemyActionSchema.parse(data),
    {
      gm: opts.gm ?? true,
      characters: opts.characters ?? [c, other()],
      id: () => `flight-${++sequence}`,
    },
    opts.rng ?? (() => 8),
  );
}
const prep = {
  operation: "prepare",
  formulaId: FLIGHT,
  ingredients:
    "Vitae própria, sangue colérico e sanguíneo, champagne e sangue de pássaro",
  ingredientsConfirmed: true,
  laboratoryConfirmed: true,
};
const conclusion = {
  operation: "completeCrafting",
  craftingConfirmed: true,
  donorConfirmed: true,
  researchConfirmed: true,
  narrativeConfirmed: true,
  concentrationConfirmed: true,
  vesselEmotionConfirmed: true,
  note: "Três noites de trabalho realizadas; pesquisa de três meses já concluída. Narrador conferiu e resolveu a origem da gota de vitae.",
};
function prepared(method: "fixatio" | "athanor" | "calcinatio" = "fixatio") {
  return run(source(method), {
    ...prep,
    vesselId: "other",
    vesselEmotionConfirmed: true,
    note: conclusion.note,
  }).character;
}
function ready() {
  let c = prepared();
  c = run(c, {
    ...conclusion,
    preparationId: c.alchemy.preparations[0].id,
  }).character;
  const values = [8, 8, 8, 8, 8, 1]; // Despertar e cinco dados: quatro sucessos, sem interpolar a tabela.
  return run(
    c,
    { operation: "activate", preparationId: c.alchemy.preparations[0].id },
    { rng: () => values.shift() ?? 8 },
  ).character;
}
const use = (c: Character, mode = "fly", extra = {}, options = {}) =>
  run(
    c,
    {
      operation: "formulaTest",
      activationId: c.alchemy.activations[0].id,
      mode,
      sceneConfirmed: true,
      ...extra,
    },
    options,
  );
const accept = (c: Character, options = {}) =>
  run(
    c,
    {
      operation: "acceptFormulaTest",
      activationId: c.alchemy.activations[0].id,
      testId: c.alchemy.activations[0].formulaTests.at(-1)!.id,
    },
    options,
  );
function flying() {
  return accept(use(ready()).character).character;
}
function next(c: Character) {
  const x = expireEffects(c, "turn");
  x.clock.turn++;
  return x;
}
const carrying = {
  targetId: "other",
  humanMassConfirmed: true,
  consentConfirmed: true,
};
describe("Impulso Suspenso no Ar — Básico PDF 279–280", () => {
  it.each(["fixatio", "athanor", "calcinatio"] as const)(
    "%s inicia preparação pendente e cobra só a destilação, sem rolar cedo",
    (method) => {
      let calls = 0;
      const r = run(
        source(method),
        {
          ...prep,
          vesselId: "other",
          vesselEmotionConfirmed: true,
          note: conclusion.note,
        },
        {
          rng: () => {
            calls++;
            return 8;
          },
        },
      );
      expect(calls).toBe(1);
      expect(r.result.rouses).toHaveLength(1);
      expect(r.result.distillation).toBeUndefined();
      expect(r.character.alchemy.preparations[0].distillation).toBeNull();
      expect(r.character.alchemy.preparations[0].crafting.nights).toBe(0);
      expect(concentrating(r.character)).toBe(false);
      expect(() =>
        run(r.character, {
          operation: "activate",
          preparationId: r.character.alchemy.preparations[0].id,
        }),
      ).toThrow(/três noites/);
    },
  );
  it("Fixatio conclui trabalho sem Despertar ou dados e só rola ao consumir", () => {
    const c = prepared();
    let calls = 0;
    const r = run(
      c,
      { ...conclusion, preparationId: c.alchemy.preparations[0].id },
      {
        rng: () => {
          calls++;
          return 8;
        },
      },
    );
    expect(calls).toBe(0);
    expect(r.result.rouses).toEqual([]);
    expect(r.character.hunger).toBe(c.hunger);
    expect(r.character.alchemy.preparations[0].crafting).toMatchObject({
      nights: 3,
      donorConfirmed: true,
      researchConfirmed: true,
    });
    expect(r.character.alchemy.preparations[0].distillation).toBeNull();
  });
  it.each(["athanor", "calcinatio"] as const)(
    "%s rola na conclusão, sem repetir o custo",
    (method) => {
      const c = prepared(method);
      let calls = 0;
      const r = run(
        c,
        { ...conclusion, preparationId: c.alchemy.preparations[0].id },
        {
          rng: () => {
            calls++;
            return 8;
          },
        },
      );
      expect(calls).toBe(
        c.attributes[method === "athanor" ? "vigor" : "manipulacao"] + 4,
      );
      expect(r.result.rouses).toEqual([]);
      expect(r.character.alchemy.preparations[0].review.state).toBe("open");
      expect(r.character.hunger).toBe(c.hunger);
    },
  );
  it("somente o Narrador confirma trabalho, pesquisa e vitae, com registro", () => {
    const c = prepared(),
      preparationId = c.alchemy.preparations[0].id;
    for (const extra of [
      { craftingConfirmed: false },
      { researchConfirmed: false },
      { donorConfirmed: false },
      { narrativeConfirmed: false },
      { note: "curto" },
    ])
      expect(() =>
        run(c, { ...conclusion, preparationId, ...extra }),
      ).toThrow();
    expect(() =>
      run(c, { ...conclusion, preparationId }, { gm: false }),
    ).toThrow(/Narrador/);
    const done = run(c, { ...conclusion, preparationId }).character;
    expect(() => run(done, { ...conclusion, preparationId })).toThrow(
      /concluída/,
    );
  });
  it("Athanor e Calcinatio exigem suas confirmações próprias ao concluir", () => {
    const a = prepared("athanor");
    expect(() =>
      run(a, {
        ...conclusion,
        preparationId: a.alchemy.preparations[0].id,
        concentrationConfirmed: false,
      }),
    ).toThrow(/concentração/);
    const c = prepared("calcinatio");
    expect(() =>
      run(c, {
        ...conclusion,
        preparationId: c.alchemy.preparations[0].id,
        vesselEmotionConfirmed: false,
      }),
    ).toThrow(/emoção/);
  });
  it("equipamento de campo não prepara fórmula de nível 4", () => {
    expect(() => run(source(), { ...prep, fieldEquipment: true })).toThrow(
      /nível 3/,
    );
  });
  it("efeito normal dá capacidade pessoal por cena e não decola antes do uso", () => {
    const c = ready();
    expect(c.alchemy.activations[0].status).toBe("active");
    expect(c.conditions).toContain(FLIGHT_READY);
    expect(c.conditions).not.toContain(AIRBORNE);
    expect(flightSpeed(c.alchemy.activations[0])).toBe("No chão");
    expect(expireEffects(c, "scene").conditions).not.toContain(FLIGHT_READY);
  });
  it("consumo não concede voo a outra pessoa", () => {
    const c = prepared(),
      done = run(c, {
        ...conclusion,
        preparationId: c.alchemy.preparations[0].id,
      }).character;
    expect(() =>
      run(done, {
        operation: "activate",
        preparationId: done.alchemy.preparations[0].id,
        targetIds: ["other"],
      }),
    ).toThrow(/somente ao alquimista/);
  });
  it("voar e pousar não sorteiam dados, não repetem custos e aguardam aceitação", () => {
    const c = ready();
    let calls = 0;
    const r = use(
      c,
      "fly",
      {},
      {
        rng: () => {
          calls++;
          return 8;
        },
      },
    );
    expect(calls).toBe(0);
    expect(r.result.formulaTest!.actor).toBeNull();
    expect(r.character.conditions).not.toContain(AIRBORNE);
    const flown = accept(r.character);
    expect(flown.character.conditions).toContain(AIRBORNE);
    expect(flown.character.hunger).toBe(c.hunger);
    expect(flightSpeed(flown.character.alchemy.activations[0])).toBe(
      "Corrida aproximada",
    );
    const landed = accept(use(next(flown.character), "land").character);
    expect(landed.character.conditions).not.toContain(AIRBORNE);
    expect(landed.character.conditions).toContain(FLIGHT_READY);
    expect(landed.result.formulaTest!.outcome!.rawDamage).toBe(0);
  });
  it("carga humana ou passageiro sem resistência reduz velocidade à caminhada", () => {
    const c = ready(),
      r = accept(use(c, "carry", carrying).character);
    expect(flightSpeed(r.character.alchemy.activations[0])).toBe("Caminhada");
    expect(r.targets[0].conditions).toContain(FLIGHT_PASSENGER);
    expect(r.targets[0].grappledBy).toBe("");
    expect(r.targets[0].health).toEqual(other().health);
    expect(r.result.formulaTest!.opposition).toBeNull();
    expect(() =>
      use(next(r.character), "carry", carrying, { characters: r.targets }),
    ).toThrow(/carga anterior/);
  });
  it("carga sem pessoa usa descrição e confirmação qualitativa, sem peso em kg inventado", () => {
    const c = ready(),
      r = accept(
        use(c, "carry", { object: "Mala da coterie", humanMassConfirmed: true })
          .character,
      );
    expect(r.character.alchemy.activations[0].flight.load).toBe(
      "Mala da coterie",
    );
    expect(r.targets).toEqual([]);
    expect(r.result.formulaTest!.weightKg).toBeNull();
    expect(flightSpeed(r.character.alchemy.activations[0])).toBe("Caminhada");
  });
  it("transporte consentido exige confirmação e pessoa precisa ser outra da mesma campanha", () => {
    const c = ready();
    for (const extra of [
      { humanMassConfirmed: false },
      { consentConfirmed: false },
      { targetId: c.id },
      { targetId: "missing" },
    ])
      expect(() => use(c, "carry", { ...carrying, ...extra })).toThrow();
    const t = other();
    t.campaignId = "foreign";
    expect(() => use(c, "capture", carrying, { characters: [t] })).toThrow(
      /mesma campanha/,
    );
  });
  it("levar quem resiste salva Força + Alquimia contra Força + Atletismo antes dos efeitos", () => {
    const c = ready(),
      r = use(c, "capture", carrying),
      t = r.result.formulaTest!;
    expect(t.actor!.normal).toHaveLength(6);
    expect(t.actor!.hunger).toHaveLength(1);
    expect(t.opposition!.normal).toHaveLength(3);
    expect(t.opposition!.hunger).toEqual([]);
    expect(r.targets).toEqual([]);
    expect(r.character.alchemy.activations[0].flight.passengerId).toBe("");
    const taken = accept(r.character);
    expect(taken.character.alchemy.activations[0].flight.passengerId).toBe(
      "other",
    );
    expect(taken.targets[0].conditions).toContain(FLIGHT_PASSENGER);
    expect(taken.result.formulaTest!.outcome).toMatchObject({
      success: true,
      margin: 4,
      rawDamage: 0,
    });
  });
  it("fracasso ao levar conserva o voo existente e não toca o alvo", () => {
    const c = next(flying()),
      t = other();
    t.attributes.forca = 5;
    t.skills.atletismo = 5;
    const r = accept(
      use(c, "capture", carrying, { characters: [t] }).character,
      { characters: [t] },
    );
    expect(r.result.formulaTest!.outcome!.success).toBe(false);
    expect(r.character.alchemy.activations[0].flight.airborne).toBe(true);
    expect(r.targets).toEqual([]);
  });
  it("empate favorece o alquimista ao levar e o oponente ao puxar ao chão", () => {
    const t = other();
    t.attributes.forca = 3;
    t.skills.atletismo = 4;
    const carried = accept(
      use(ready(), "capture", carrying, { characters: [t] }).character,
      { characters: [t] },
    );
    expect(carried.result.formulaTest!.outcome).toMatchObject({
      success: true,
      margin: 0,
    });
    const c = next(flying()),
      r = accept(
        use(c, "ground", { targetId: t.id }, { characters: [t] }).character,
        { characters: [t] },
      );
    expect(r.result.formulaTest!.outcome).toMatchObject({
      success: true,
      margin: 0,
    });
    expect(r.character.alchemy.activations[0].flight.airborne).toBe(false);
    expect(r.character.conditions).toContain(FLIGHT_READY);
  });
  it("voador que supera quem tenta puxá-lo ao chão permanece no ar", () => {
    const c = next(flying()),
      r = accept(use(c, "ground", { targetId: "other" }).character);
    expect(r.result.formulaTest!.outcome!.success).toBe(false);
    expect(r.character.alchemy.activations[0].flight.airborne).toBe(true);
  });
  it("não permite puxar ao chão alguém já no chão nem ator incapacitado", () => {
    expect(() => use(ready(), "ground", { targetId: "other" })).toThrow(
      /já está no chão/,
    );
    const t = other();
    t.conditions.push("Incapacitado: coma ou morte");
    expect(() =>
      use(next(flying()), "ground", { targetId: t.id }, { characters: [t] }),
    ).toThrow(/oponente/);
  });
  it("as duas paradas têm Vontade independente, originais e Fome preservada", () => {
    const c = use(ready(), "capture", carrying).character,
      a = c.alchemy.activations[0],
      testId = a.formulaTests[0].id;
    const request = {
      operation: "rerollFormulaTest",
      activationId: a.id,
      testId,
      indices: [0],
    };
    const r = run(c, request);
    expect(r.character.willpower.superficial).toBe(1);
    expect(r.result.formulaTest!.actor!.hunger).toEqual(
      r.result.formulaTest!.actorReview.original!.hunger,
    );
    const opposed = run(r.character, { ...request, side: "opposition" });
    expect(opposed.targets[0].willpower.superficial).toBe(1);
    expect(() =>
      run(opposed.character, request, { characters: opposed.targets }),
    ).toThrow(/outra rerrolagem/);
  });
  it("um uso por turno e aceitação única impedem movimentos repetidos", () => {
    const c = use(ready()).character;
    expect(() => use(c)).toThrow(/avance o turno/);
    const r = accept(c);
    expect(() => accept(r.character)).toThrow(/já foi resolvido/);
    expect(() => use(r.character)).toThrow(/avance o turno/);
  });
  it("pousar e encerrar limpam passageiro e voo sem dano de queda presumido", () => {
    const carried = accept(use(ready(), "carry", carrying).character),
      t = carried.targets[0];
    const r = accept(
      use(next(carried.character), "land", {}, { characters: [t] }).character,
      { characters: [t] },
    );
    expect(r.targets[0].conditions).not.toContain(FLIGHT_PASSENGER);
    expect(r.targets[0].health).toEqual(t.health);
    const ended = run(
      carried.character,
      { operation: "end", activationId: carried.result.activationId },
      { characters: [t] },
    );
    expect(ended.character.alchemy.activations[0].flight).toEqual({
      airborne: false,
      passengerId: "",
      load: "",
    });
    expect(ended.targets[0].conditions).not.toContain(FLIGHT_PASSENGER);
  });
  it("proíbe acumular duas ativações do próprio voo", () => {
    const c = next(ready()),
      p = run(c, prep).character,
      done = run(p, {
        ...conclusion,
        preparationId: p.alchemy.preparations[0].id,
      }).character;
    expect(() =>
      run(done, {
        operation: "activate",
        preparationId: done.alchemy.preparations[0].id,
      }),
    ).toThrow(/Impulso anterior/);
  });
  it("progressão posterior não muda o nível de Alquimia capturado", () => {
    const c = ready();
    c.disciplines[ALCHEMY] = 5;
    const r = use(c, "capture", carrying);
    expect(
      r.result.formulaTest!.actor!.normal.length +
        r.result.formulaTest!.actor!.hunger.length,
    ).toBe(7);
  });
  it("legado não inventa trabalho, decolagem ou passageiro e valida conclusão incompleta", () => {
    const c = prepared();
    delete (c.alchemy.preparations[0] as any).crafting;
    const parsed = characterSchema.parse(c);
    expect(parsed.alchemy.preparations[0].crafting.nights).toBe(0);
    const bad = prepared();
    bad.alchemy.preparations[0].crafting.nights = 3;
    expect(characterSchema.safeParse(bad).success).toBe(false);
    const active = ready();
    active.alchemy.activations[0].status = "ended";
    active.alchemy.activations[0].flight.airborne = true;
    expect(characterSchema.safeParse(active).success).toBe(false);
  });
});

it("a ativação conserva a confirmação após o frasco ser consumido e rejeita voo ativo sem ela", () => {
  const c = ready(),
    a = c.alchemy.activations[0];
  expect(c.alchemy.preparations).toEqual([]);
  expect(a.crafting).toMatchObject({
    nights: 3,
    donorConfirmed: true,
    researchConfirmed: true,
    note: conclusion.note,
  });
  a.crafting.researchConfirmed = false;
  expect(characterSchema.safeParse(c).success).toBe(false);
});
