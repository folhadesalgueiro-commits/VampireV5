import { describe, expect, it } from "vitest";
import { alchemyActionSchema, alchemyOperation } from "../shared/alchemy";
import {
  Character,
  characterSchema,
  emptyCharacter,
  effectSchema,
} from "../shared/model";
import {
  ENVELOP,
  ENVELOP_CONDITION,
  ENVELOP_READY,
  SUFFOCATING,
  UNCONSCIOUS_ENVELOP,
  FOG,
  FOG_CONDITION,
  envelopPenalty,
  envelopActionBlocked,
} from "../shared/alchemy-effects";
import { expireEffects } from "../shared/blood-mechanics";
import { combatSchema, oneRollConflict, resolveCombat } from "../shared/combat";
import { ALCHEMY } from "../shared/thin-blood";
import { pool, evaluate } from "../shared/rules";
import { seedCatalog } from "../server/seed";
import { validThinCharacter } from "./fixtures";
const catalog = seedCatalog();
let seq = 0;
function source() {
  const c = validThinCharacter();
  c.status = "active";
  c.thinBlood.alchemyMethod = "fixatio";
  c.disciplines[ALCHEMY] = 2;
  c.powers = [ENVELOP];
  c.attributes.inteligencia = 2;
  c.attributes.raciocinio = 3;
  return c;
}
function mortal(id = "target"): Character {
  const c = characterSchema.parse({
    ...emptyCharacter(),
    name: "Alvo da névoa",
    nature: "mortal",
    hunger: 0,
  });
  c.attributes.vigor = 2;
  c.attributes.destreza = 4;
  c.attributes.raciocinio = 4;
  c.skills.sobrevivencia = 1;
  c.skills.armasFogo = 3;
  c.skills.sagacidade = 3;
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
      characters: opts.characters ?? [c, mortal()],
      id: () => `envelop-${++seq}`,
    },
    opts.rng ?? (() => 8),
  );
}
const combat = (data: any) =>
  combatSchema.parse({
    a: "target",
    b: "enemy",
    attributeA: "forca",
    skillA: "briga",
    attributeB: "destreza",
    skillB: "atletismo",
    ...data,
  });
const prep = {
  operation: "prepare",
  formulaId: ENVELOP,
  ingredients: "Vitae, sangue melancólico e fleumático e fumaça",
  ingredientsConfirmed: true,
  laboratoryConfirmed: true,
};
function ready(t = mortal()) {
  const prepared = run(source(), prep).character;
  const used = run(
    prepared,
    {
      operation: "activate",
      preparationId: prepared.alchemy.preparations[0].id,
      targetIds: [t.id],
      sceneConfirmed: true,
      reviewDistillation: true,
    },
    { characters: [t] },
  );
  const accepted = run(
    used.character,
    { operation: "acceptDistillation", activationId: used.result.activationId },
    { characters: [t] },
  );
  return { c: accepted.character, t: accepted.targets[0] };
}
const tryChoke = (c: Character, t: Character, opts = {}) =>
  run(
    c,
    {
      operation: "formulaTest",
      mode: "suffocate",
      activationId: c.alchemy.activations[0].id,
      sceneConfirmed: true,
    },
    { characters: [t], ...opts },
  );
const accept = (c: Character, t: Character) =>
  run(
    c,
    {
      operation: "acceptFormulaTest",
      activationId: c.alchemy.activations[0].id,
      testId: c.alchemy.activations[0].formulaTests.at(-1)!.id,
    },
    { characters: [t] },
  );
describe("Envolver — Básico PDF 277–278", () => {
  it("a revisão da destilação precede a obstrução, sem uma disputa inicial de asfixia", () => {
    const c = run(source(), prep).character;
    const used = run(c, {
      operation: "activate",
      preparationId: c.alchemy.preparations[0].id,
      targetIds: ["target"],
      sceneConfirmed: true,
      reviewDistillation: true,
    });
    expect(used.targets).toEqual([]);
    expect(used.character.activeEffects).toEqual([]);
    let calls = 0;
    const r = run(
      used.character,
      {
        operation: "acceptDistillation",
        activationId: used.result.activationId,
      },
      {
        rng: () => {
          calls++;
          return 8;
        },
      },
    );
    expect(calls).toBe(0);
    expect(r.targets[0].conditions).toContain(ENVELOP_CONDITION);
    expect(r.character.conditions).toContain(ENVELOP_READY);
    expect(r.targets[0].conditions).not.toContain(SUFFOCATING);
    expect(r.character.alchemy.activations[0].formulaTests).toEqual([]);
  });
  it("cobra um Despertar para preparar e outro para ativar; testes próprios não repetem custos", () => {
    const c = run(source(), prep, { rng: () => 1 }).character;
    expect(c.hunger).toBe(2);
    const r = run(c, {
      operation: "activate",
      preparationId: c.alchemy.preparations[0].id,
      targetIds: ["target"],
      sceneConfirmed: true,
    });
    expect(r.result.rouses).toHaveLength(1);
    const before = r.character.hunger;
    const used = tryChoke(r.character, r.targets[0]);
    expect(used.character.hunger).toBe(before);
    expect(used.result.rouses).toEqual([]);
    expect(used.character.alchemy.preparations).toHaveLength(0);
  });
  it("exige um único outro alvo visível antes de sortear ou consumir", () => {
    const c = run(source(), prep).character,
      before = structuredClone(c);
    for (const extra of [
      { targetIds: [] },
      { targetIds: [c.id] },
      { targetIds: ["target", "second"] },
      { sceneConfirmed: false },
    ]) {
      let calls = 0;
      expect(() =>
        run(
          c,
          {
            operation: "activate",
            preparationId: c.alchemy.preparations[0].id,
            targetIds: ["target"],
            sceneConfirmed: true,
            ...extra,
          },
          {
            rng: () => {
              calls++;
              return 8;
            },
          },
        ),
      ).toThrow();
      expect(calls).toBe(0);
      expect(c).toEqual(before);
    }
  });
  it("aplica −3 somente em visão ou ataque à distância, uma vez por teste", () => {
    const { c, t } = ready();
    expect(envelopPenalty(c, { skill: "armasFogo" })).toBe(0);
    expect(
      pool(t, catalog, { attribute: "raciocinio", skill: "sagacidade" }),
    ).toBe(7);
    for (const context of [
      { targetContext: "visual" },
      { tags: ["visao"] },
      { tags: ["deteccaoVisual"] },
    ])
      expect(
        pool(t, catalog, {
          attribute: "raciocinio",
          skill: "sagacidade",
          ...context,
        }),
      ).toBe(4);
    expect(
      pool(t, catalog, { attribute: "destreza", skill: "armasFogo" }),
    ).toBe(4);
    expect(
      pool(t, catalog, {
        attribute: "destreza",
        skill: "armasFogo",
        tags: ["visao", "ataqueDistancia"],
      }),
    ).toBe(4);
    expect(
      pool(t, catalog, {
        attribute: "raciocinio",
        skill: "sagacidade",
        tags: ["audicao"],
      }),
    ).toBe(7);
  });
  it("não empilha a mesma obstrução e permite efeitos condicionais junto à penalidade", () => {
    const { t } = ready();
    t.activeEffects.push({
      ...structuredClone(t.activeEffects[0]),
      id: "duplicate",
    });
    expect(envelopPenalty(t, { targetContext: "visual" })).toBe(3);
    t.activeEffects.push({
      id: "bonus",
      sourceId: "custom",
      effectKey: "bonus",
      label: "Bônus contextual",
      createdAt: "",
      remaining: 1,
      effect: effectSchema.parse({
        kind: "dice",
        target: "sagacidade",
        value: 2,
        when: { field: "tag", value: "proteger", operator: "includes" },
      }),
    });
    expect(
      pool(t, catalog, {
        attribute: "raciocinio",
        skill: "sagacidade",
        tags: ["visao", "proteger"],
      }),
    ).toBe(6);
  });
  it("penaliza o atacante envolto e soma a proteção de Névoa do alvo no confronto", () => {
    const { t } = ready(),
      other = mortal("other");
    other.activeEffects.push({
      id: "fog",
      sourceId: FOG,
      effectKey: "fog",
      label: "Névoa",
      createdAt: "",
      remaining: 1,
      effect: effectSchema.parse({
        kind: "condition",
        target: FOG_CONDITION,
        value: -2,
      }),
    });
    const r = resolveCombat(
      t,
      other,
      catalog,
      combat({
        attributeA: "destreza",
        skillA: "armasFogo",
        rangedA: true,
        unilateral: true,
        staticDefense: true,
        difficulty: 1,
      }),
      { turn: "teste" },
      () => 8,
    );
    expect(r.ar!.normal).toHaveLength(2);
    expect(r.ar!.hunger).toEqual([]);
  });
  it("rolagem de asfixia salva Raciocínio + Alquimia e Vigor + Sobrevivência sem dano imediato", () => {
    const { c, t } = ready(),
      before = structuredClone(c),
      r = tryChoke(c, t);
    expect(c).toEqual(before);
    expect(r.targets).toEqual([]);
    expect(r.result.formulaTest?.actor!.normal).toHaveLength(4);
    expect(r.result.formulaTest?.actor!.hunger).toHaveLength(1);
    expect(r.result.formulaTest?.opposition!.normal).toHaveLength(3);
    expect(r.result.formulaTest?.opposition!.hunger).toEqual([]);
    expect(r.result.formulaTest?.weightKg).toBeNull();
    expect(envelopActionBlocked(t)).toBe(false);
  });
  it("vitória restringe a tossir e sufocar, sem dano nem inconsciência", () => {
    const { c, t } = ready(),
      r = accept(tryChoke(c, t).character, t),
      affected = r.targets[0];
    expect(affected.conditions).toContain(SUFFOCATING);
    expect(affected.conditions).not.toContain(UNCONSCIOUS_ENVELOP);
    expect(envelopActionBlocked(affected)).toBe(true);
    expect(affected.health).toEqual(t.health);
    expect(r.result.formulaTest?.outcome).toMatchObject({
      success: true,
      margin: 2,
      rawDamage: 0,
    });
    expect(() => accept(r.character, affected)).toThrow(/já foi resolvido/);
  });
  it("empate favorece o agente como disputa geral", () => {
    const m = mortal();
    m.skills.sobrevivencia = 3;
    const { c, t } = ready(m),
      r = accept(tryChoke(c, t).character, t);
    expect(r.result.formulaTest?.outcome).toMatchObject({
      success: true,
      margin: 0,
    });
    expect(r.targets[0].conditions).toContain(SUFFOCATING);
  });
  it("falha conserva somente a obstrução e classifica Falha Bestial", () => {
    const { c, t } = ready();
    const values = [1, 1, 1, 1, 1, 8, 8, 8];
    const used = tryChoke(c, t, { rng: () => values.shift() ?? 8 }),
      r = accept(used.character, t);
    expect(r.targets).toEqual([]);
    expect(t.conditions).toContain(ENVELOP_CONDITION);
    expect(envelopActionBlocked(t)).toBe(false);
    expect(r.result.message).toContain("Falha Bestial");
  });
  it("vitória crítica causa inconsciência sem inventar dano ou recuperação ao dissipar a névoa", () => {
    const { c, t } = ready(),
      values = [10, 10, 1, 1, 8, 8, 8, 8];
    const r = accept(
        tryChoke(c, t, { rng: () => values.shift() ?? 8 }).character,
        t,
      ),
      affected = r.targets[0];
    expect(affected.conditions).toContain(UNCONSCIOUS_ENVELOP);
    expect(affected.health).toEqual(t.health);
    const ended = run(
      r.character,
      { operation: "end", activationId: r.result.activationId },
      { characters: [affected] },
    );
    expect(ended.targets[0].conditions).toContain(UNCONSCIOUS_ENVELOP);
    expect(ended.targets[0].conditions).not.toContain(SUFFOCATING);
    expect(envelopActionBlocked(ended.targets[0])).toBe(true);
    expect(expireEffects(affected, "scene").conditions).toContain(
      UNCONSCIOUS_ENVELOP,
    );
  });
  it("Crítico Confuso conserva o efeito crítico e pede resolução narrativa", () => {
    const { c, t } = ready(),
      values = [10, 8, 1, 1, 10, 8, 8, 8];
    const r = accept(
      tryChoke(c, t, { rng: () => values.shift() ?? 8 }).character,
      t,
    );
    expect(r.result.message).toContain("Crítico Confuso");
    expect(r.targets[0].conditions).toContain(UNCONSCIOUS_ENVELOP);
  });
  it("vampiros sofrem obstrução, mas não a asfixia da fórmula", () => {
    const vampire = mortal();
    vampire.nature = "vampire";
    const { c, t } = ready(vampire);
    let calls = 0;
    expect(envelopPenalty(t, { skill: "armasFogo" })).toBe(3);
    expect(() =>
      tryChoke(c, t, {
        rng: () => {
          calls++;
          return 8;
        },
      }),
    ).toThrow(/alvo mortal/);
    expect(calls).toBe(0);
  });
  it("não troca alvo, fórmula ou visibilidade durante o teste próprio", () => {
    const { c, t } = ready(),
      a = c.alchemy.activations[0];
    for (const extra of [
      { mode: "throw" },
      { targetId: "second" },
      { sceneConfirmed: false },
    ])
      expect(() =>
        run(
          c,
          {
            operation: "formulaTest",
            mode: "suffocate",
            activationId: a.id,
            sceneConfirmed: true,
            ...extra,
          },
          { characters: [t] },
        ),
      ).toThrow();
  });
  it("rerrolagens preservam Fome e têm Vontade própria para usuário/resistência", () => {
    const { c, t } = ready();
    let r = tryChoke(c, t);
    const data = {
      operation: "rerollFormulaTest",
      activationId: r.result.activationId,
      testId: r.result.formulaTest!.id,
      indices: [0],
    };
    const hunger = r.result.formulaTest!.actor!.hunger;
    r = run(r.character, data, { characters: [t] });
    expect(r.character.willpower.superficial).toBe(1);
    expect(r.result.formulaTest!.actor!.hunger).toEqual(hunger);
    const opposed = run(
      r.character,
      { ...data, side: "opposition" },
      { characters: [t] },
    );
    expect(opposed.targets[0].willpower.superficial).toBe(1);
    expect(opposed.character.willpower.superficial).toBe(1);
    expect(() =>
      run(opposed.character, data, { characters: opposed.targets }),
    ).toThrow(/outra rerrolagem/);
  });
  it("não repete tentativa no turno; avanço não encerra a obstrução da cena", () => {
    const { c, t } = ready();
    const r = accept(tryChoke(c, t).character, t);
    expect(() => tryChoke(r.character, r.targets[0])).toThrow(/avance o turno/);
    const next = expireEffects(r.character, "turn");
    next.clock.turn++;
    expect(expireEffects(r.targets[0], "turn").conditions).toContain(
      ENVELOP_CONDITION,
    );
    expect(tryChoke(next, r.targets[0]).result.formulaTest!.status).toBe(
      "pending",
    );
  });
  it("sufocamento impede ações físicas/sociais e defesa ativa; defesa estática continua disponível", () => {
    const { c, t } = ready(),
      affected = accept(tryChoke(c, t).character, t).targets[0],
      enemy = mortal("enemy");
    expect(() =>
      resolveCombat(
        affected,
        enemy,
        catalog,
        combat({}),
        { turn: "teste" },
        () => 8,
      ),
    ).toThrow(/Envolver/);
    expect(() =>
      oneRollConflict(
        affected,
        catalog,
        {
          attribute: "raciocinio",
          skill: "sagacidade",
          modifier: 0,
          difficulty: 1,
          social: true,
          aggravated: false,
        },
        () => 8,
      ),
    ).toThrow(/Envolver/);
    expect(() =>
      resolveCombat(
        enemy,
        affected,
        catalog,
        combat({}),
        { turn: "teste" },
        () => 8,
      ),
    ).toThrow(/defesa estática/);
    expect(
      resolveCombat(
        enemy,
        affected,
        catalog,
        combat({ staticDefense: true, unilateral: true }),
        { turn: "teste" },
        () => 8,
      ).br,
    ).toBeNull();
  });
  it("um novo Envolver substitui o anterior e limpa seu alvo, inclusive Fixatio", () => {
    const { c, t } = ready();
    c.clock.turn++;
    const prepared = run(c, prep, { characters: [t] }).character;
    const second = mortal("second");
    const r = run(
      prepared,
      {
        operation: "activate",
        preparationId: prepared.alchemy.preparations[0].id,
        targetIds: [second.id],
        sceneConfirmed: true,
      },
      { characters: [t, second] },
    );
    expect(r.character.alchemy.activations[0].status).toBe("ended");
    expect(r.character.alchemy.activations[1].status).toBe("active");
    expect(r.targets.find((x) => x.id === t.id)!.conditions).not.toContain(
      ENVELOP_CONDITION,
    );
    expect(r.targets.find((x) => x.id === second.id)!.conditions).toContain(
      ENVELOP_CONDITION,
    );
  });
  it("fim de cena e encerramento retiram névoa/asfixia sem curar dano", () => {
    const { c, t } = ready(),
      r = accept(tryChoke(c, t).character, t);
    const target = expireEffects(r.targets[0], "scene");
    expect(target.conditions).not.toContain(ENVELOP_CONDITION);
    expect(target.conditions).not.toContain(SUFFOCATING);
    expect(envelopActionBlocked(target)).toBe(false);
    expect(target.health).toEqual(t.health);
    const ended = run(
      r.character,
      { operation: "end", activationId: r.result.activationId },
      { characters: r.targets },
    );
    expect(ended.targets[0].conditions).not.toContain(SUFFOCATING);
  });
  it("progressão posterior não amplia a parada do elixir já ativado", () => {
    const { c, t } = ready();
    c.disciplines[ALCHEMY] = 5;
    const r = tryChoke(c, t);
    expect(
      r.result.formulaTest!.actor!.normal.length +
        r.result.formulaTest!.actor!.hunger.length,
    ).toBe(5);
  });
  it("valida modo/fórmula, alvo, peso inaplicável e Fome de revisões importadas", () => {
    const { c, t } = ready(),
      r = tryChoke(c, t);
    const saved = r.character;
    saved.alchemy.activations[0].formulaTests[0].weightKg = 1;
    expect(characterSchema.safeParse(saved).success).toBe(false);
    saved.alchemy.activations[0].formulaTests[0].weightKg = null;
    saved.alchemy.activations[0].formulaTests[0].targetId = "unrelated";
    expect(characterSchema.safeParse(saved).success).toBe(false);
  });
});

it("Envolver não sufoca se a névoa já foi retirada, inclusive após rolar", () => {
  const { c, t } = ready(),
    removed = { ...t, activeEffects: [] };
  expect(() => tryChoke(c, removed)).toThrow(/já não está envolto/);
  const used = tryChoke(c, t);
  expect(() => accept(used.character, removed)).toThrow(/já não está envolto/);
});
