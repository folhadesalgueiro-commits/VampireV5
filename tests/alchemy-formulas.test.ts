import { describe, expect, it } from "vitest";
import { alchemyActionSchema, alchemyOperation } from "../shared/alchemy";
import {
  FLOAT_CONDITION,
  LONG_REACH,
  REACH_CONDITION,
  closeFormulaTests,
  preserveSustainedAlchemy,
  sustainedAlchemy,
} from "../shared/alchemy-effects";
import { Character, characterSchema, emptyCharacter } from "../shared/model";
import { expireEffects, turnKey } from "../shared/blood-mechanics";
import { ALCHEMY } from "../shared/thin-blood";
import { seedCatalog } from "../server/seed";
import { validThinCharacter } from "./fixtures";
const catalog = seedCatalog();
let seq = 0;
function raw() {
  const c = validThinCharacter();
  c.status = "active";
  c.thinBlood.alchemyMethod = "fixatio";
  c.disciplines[ALCHEMY] = 1;
  c.powers = [LONG_REACH];
  c.attributes.inteligencia = 3;
  c.attributes.determinacao = 3;
  c.attributes.raciocinio = 2;
  return c;
}
function target(): Character {
  return {
    ...characterSchema.parse({
      ...emptyCharacter(),
      name: "Alvo de teste",
      nature: "mortal",
      hunger: 0,
      skills: { ...emptyCharacter().skills, atletismo: 1 },
      attributes: {
        ...emptyCharacter().attributes,
        forca: 1,
        vigor: 3,
        determinacao: 3,
        autocontrole: 3,
      },
    }),
    id: "target",
    version: 1,
  };
}
function run(
  c: Character,
  data: any,
  options: { characters?: Character[]; rng?: () => number; gm?: boolean } = {},
) {
  return alchemyOperation(
    c,
    catalog,
    alchemyActionSchema.parse(data),
    {
      gm: options.gm ?? true,
      characters: options.characters ?? [c, target()],
      id: () => `formula-${++seq}`,
    },
    options.rng ?? (() => 8),
  );
}
function ready() {
  const c = run(raw(), {
    operation: "prepare",
    formulaId: LONG_REACH,
    ingredients: "Vitae própria, sangue colérico e fio de náilon",
    ingredientsConfirmed: true,
    laboratoryConfirmed: true,
  }).character;
  return run(c, {
    operation: "activate",
    preparationId: c.alchemy.preparations[0].id,
  }).character;
}
const data = {
  operation: "formulaTest",
  mode: "throw",
  targetId: "target",
  object: "Arremessar o alvo",
  weightKg: 70,
  sceneConfirmed: true,
};
const test = (c: Character, extra = {}, options = {}) =>
  run(
    c,
    { ...data, activationId: c.alchemy.activations[0].id, ...extra },
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
const rerollData = (c: Character, extra = {}) => ({
  operation: "rerollFormulaTest",
  activationId: c.alchemy.activations[0].id,
  testId: c.alchemy.activations[0].formulaTests.at(-1)!.id,
  indices: [0],
  ...extra,
});
function advance(chars: Character[]) {
  const sustained = sustainedAlchemy(chars, (c) => turnKey(c));
  return chars.map((c) => {
    const x = expireEffects(preserveSustainedAlchemy(c, sustained), "turn");
    x.clock.turn++;
    x.alchemy.activations.forEach((a) => {
      closeFormulaTests(a);
      if (
        !x.activeEffects.some((e) => e.effectKey.startsWith(`alchemy:${a.id}:`))
      ) {
        a.status = "ended";
        a.longReach.sustaining = false;
      }
    });
    return x;
  });
}
describe("Longo Alcance — Básico PDF 101–105,277", () => {
  it("ativa o efeito normal por um turno depois de rever a destilação", () => {
    const c = ready();
    expect(c.conditions).toContain(REACH_CONDITION);
    expect(c.alchemy.activations[0].status).toBe("active");
    expect(c.activeEffects[0].remaining).toBe(1);
    expect(c.activeEffects[0].effect.duration).toBe("turn");
    expect(advance([c])[0].conditions).not.toContain(REACH_CONDITION);
  });
  it("uma destilação pendente não permite teste próprio", () => {
    const c = ready();
    c.alchemy.activations[0].status = "pending";
    expect(() => test(c)).toThrow(/destilação resolvida/);
  });
  it("salva as duas paradas sem aplicar dano, condição, movimento ou custo", () => {
    const c = ready(),
      t = target(),
      before = structuredClone(c);
    const r = test(c);
    expect(c).toEqual(before);
    expect(r.result.formulaTest?.actor?.normal).toHaveLength(3);
    expect(r.result.formulaTest?.actor?.hunger).toHaveLength(1);
    expect(r.result.formulaTest?.opposition?.normal).toHaveLength(2);
    expect(r.result.formulaTest?.opposition?.hunger).toHaveLength(0);
    expect(r.targets).toEqual([]);
    expect(t.health.superficial).toBe(0);
    expect(r.character.hunger).toBe(c.hunger);
    expect(r.character.lastPowerTurn).toBe(c.lastPowerTurn);
    expect(r.result.rouses).toEqual([]);
    expect(r.result.formulaTest?.outcome).toBeNull();
  });
  it("arremessa um metro por margem, aplica superficial dividido e deixa caído", () => {
    const c = test(ready()).character;
    const r = accept(c),
      t = r.targets[0];
    expect(r.result.formulaTest?.outcome).toMatchObject({
      success: true,
      margin: 2,
      meters: 2,
      rawDamage: 2,
      appliedDamage: 1,
    });
    expect(t.health.superficial).toBe(1);
    expect(t.health.aggravated).toBe(0);
    expect(t.conditions).toContain("Caído");
    expect(t.grappledBy).toBe("");
    expect(() => accept(r.character)).toThrow(/já foi resolvido/);
  });
  it("arremesso com empate não desloca, derruba ou causa dano", () => {
    const t = target();
    t.skills.atletismo = 3;
    const c = test(ready(), {}, { characters: [t] }).character;
    const r = accept(c, { characters: [t] });
    expect(r.result.formulaTest?.outcome).toMatchObject({
      success: false,
      margin: 0,
      rawDamage: 0,
      meters: 0,
    });
    expect(r.targets[0]?.conditions ?? t.conditions).not.toContain("Caído");
  });
  it("puxar vence empate sem criar agarramento ou dano", () => {
    const t = target();
    t.skills.atletismo = 3;
    const c = test(ready(), { mode: "pull" }, { characters: [t] }).character;
    const r = accept(c, { characters: [t] });
    expect(r.result.formulaTest?.outcome?.success).toBe(true);
    expect(r.result.message).toContain("alcance de agarramento");
    expect(t.grappledBy).toBe("");
    expect(r.result.formulaTest?.outcome?.rawDamage).toBe(0);
  });
  it("recalcula Falha Bestial e Crítico Confuso contra a resistência real", () => {
    const values = [1, 1, 1, 1, 8, 8];
    const c = test(ready(), {}, { rng: () => values.shift() ?? 8 }).character;
    const d = c.alchemy.activations[0].formulaTests[0];
    expect(d.actor?.hunger).toEqual([1]);
    expect(accept(c).result.formulaTest?.outcome?.success).toBe(false);
    const rolls = [10, 8, 1, 10, 8, 8];
    const critical = test(
      ready(),
      {},
      { rng: () => rolls.shift() ?? 8 },
    ).character;
    expect(accept(critical).result.formulaTest?.outcome?.margin).toBe(3);
  });
  it("mover objeto não rola dados nem causa dano por impacto", () => {
    let count = 0;
    const c = test(
      ready(),
      { mode: "move", targetId: "", object: "Mover vaso frágil" },
      {
        rng: () => {
          count++;
          return 8;
        },
      },
    ).character;
    expect(count).toBe(0);
    expect(c.alchemy.activations[0].formulaTests[0].actor).toBeNull();
    const r = accept(c);
    expect(r.result.formulaTest?.outcome).toMatchObject({
      success: true,
      rawDamage: 0,
    });
    expect(r.result.message).toContain("frágil");
  });
  it.each([100, 101, 0, -1])(
    "recusa peso incompatível %s antes de rolar",
    (weightKg) => {
      let calls = 0;
      expect(() =>
        test(
          ready(),
          { weightKg },
          {
            rng: () => {
              calls++;
              return 8;
            },
          },
        ),
      ).toThrow();
      expect(calls).toBe(0);
    },
  );
  it("exige descrição, confirmação de cena e alvo válido para a disputa", () => {
    const c = ready();
    for (const extra of [
      { sceneConfirmed: false },
      { object: "" },
      { targetId: "" },
      { targetId: "other" },
      { targetId: c.id },
    ])
      expect(() => test(c, extra)).toThrow();
    expect(() => test(c, { mode: "move" })).toThrow(/objetos/);
    const t = target();
    t.campaignId = "outro";
    expect(() => test(c, {}, { characters: [t] })).toThrow(/mesma campanha/);
  });
  it("impede outro uso na mesma ativação/turno e não altera os dados existentes", () => {
    const c = test(ready()).character;
    expect(() => test(c)).toThrow(/avance o turno/);
    expect(() => test(accept(c).character)).toThrow(/avance o turno/);
  });
  it("rerrola somente normais do usuário pagando Vontade uma única vez", () => {
    const c = test(ready(), {}, { rng: () => 1 }).character;
    const r = run(c, rerollData(c));
    expect(r.result.formulaTest?.actor?.normal[0]).toBe(8);
    expect(r.result.formulaTest?.actor?.hunger).toEqual([1]);
    expect(r.result.formulaTest?.actorReview.original?.normal).toEqual([
      1, 1, 1,
    ]);
    expect(r.character.willpower.superficial).toBe(1);
    expect(r.character.hunger).toBe(c.hunger);
    expect(r.targets).toEqual([]);
    expect(() => run(r.character, rerollData(r.character))).toThrow(
      /outra rerrolagem/,
    );
  });
  it("resistência tem rerrolagem e gasto próprios; não gasta a Vontade do usuário", () => {
    const c = test(ready()).character;
    const r = run(c, rerollData(c, { side: "opposition" }));
    expect(r.targets[0].willpower.superficial).toBe(1);
    expect(r.character.willpower.superficial).toBe(0);
    expect(r.result.formulaTest?.oppositionReview.rerolled).toBe(true);
    expect(r.result.formulaTest?.actorReview.rerolled).toBe(false);
    const both = run(r.character, rerollData(r.character), {
      characters: r.targets,
    });
    expect(both.character.willpower.superficial).toBe(1);
  });
  it.each(
    [[], [0, 0], [99], [-1], [0, 1, 2, 3]].map((indices) => ({ indices })),
  )("recusa seleção de rerrolagem $indices antes do sorteio", ({ indices }) => {
    const c = test(ready()).character;
    let calls = 0;
    expect(() =>
      run(c, rerollData(c, { indices }), {
        rng: () => {
          calls++;
          return 8;
        },
      }),
    ).toThrow();
    expect(calls).toBe(0);
  });
  it("trilha de Vontade cheia converte o gasto, toda agravada bloqueia", () => {
    let c = test(ready()).character;
    c.willpower.superficial =
      c.attributes.autocontrole + c.attributes.determinacao;
    const r = run(c, rerollData(c));
    expect(r.character.willpower.aggravated).toBe(1);
    c = test(ready()).character;
    c.willpower.aggravated =
      c.attributes.autocontrole + c.attributes.determinacao;
    expect(() => run(c, rerollData(c))).toThrow(/toda agravada/);
  });
  it("sustenta com dificuldade 3 e preserva o próximo turno, expirando sem manutenção", () => {
    const c = test(ready(), { mode: "hold" }).character;
    const r = accept(c);
    expect(r.result.formulaTest?.difficulty).toBe(3);
    expect(r.character.alchemy.activations[0].longReach.sustaining).toBe(true);
    expect(r.targets[0].conditions).toContain(FLOAT_CONDITION);
    const [next, held] = advance([r.character, r.targets[0]]);
    expect(next.conditions).toContain(REACH_CONDITION);
    expect(held.conditions).toContain(FLOAT_CONDITION);
    const [expired, dropped] = advance([next, held]);
    expect(expired.conditions).not.toContain(REACH_CONDITION);
    expect(dropped.conditions).not.toContain(FLOAT_CONDITION);
  });
  it("renova sustentação no turno seguinte sem repetir custo ou consumo", () => {
    const r = accept(test(ready(), { mode: "hold" }).character);
    const [c, t] = advance([r.character, r.targets[0]]);
    const next = test(c, { mode: "hold" }, { characters: [t] }).character;
    const renewed = accept(next, { characters: [t] });
    expect(renewed.character.hunger).toBe(c.hunger);
    expect(renewed.result.rouses).toEqual([]);
    expect(advance([renewed.character])[0].conditions).toContain(
      REACH_CONDITION,
    );
  });
  it("falha em sustentar encerra o Poder sem inventar dano de queda", () => {
    const c = test(ready(), { mode: "hold" }, { rng: () => 1 }).character;
    const r = accept(c);
    expect(r.character.alchemy.activations[0].status).toBe("ended");
    expect(r.character.conditions).not.toContain(REACH_CONDITION);
    expect(r.result.message).toContain("Queda");
    expect(r.targets[0]?.health.superficial ?? 0).toBe(0);
  });
  it("sustentar objeto também exige teste e renovação", () => {
    const c = test(ready(), {
      mode: "hold",
      targetId: "",
      object: "Manter mala suspensa",
    }).character;
    const r = accept(c);
    expect(r.character.alchemy.activations[0].longReach.sustaining).toBe(true);
    expect(r.targets).toHaveLength(0);
  });
  it("cancelar por tempo ou encerramento fecha revisões e impede efeitos retroativos", () => {
    const c = test(ready()).character;
    expect(advance([c])[0].alchemy.activations[0].formulaTests[0].status).toBe(
      "cancelled",
    );
    const ended = run(c, {
      operation: "end",
      activationId: c.alchemy.activations[0].id,
    }).character;
    expect(ended.alchemy.activations[0].formulaTests[0].actorReview.state).toBe(
      "closed",
    );
    expect(ended.alchemy.activations[0].formulaTests[0].status).toBe(
      "cancelled",
    );
    expect(() => accept(ended)).toThrow();
  });
  it("delicadeza usa Raciocínio e dificuldade registrada pelo Narrador", () => {
    const c = test(ready(), {
      mode: "delicate",
      targetId: "",
      object: "Retirar pino",
      difficulty: 2,
      note: "Dificuldade confirmada na cena.",
    }).character;
    expect(c.alchemy.activations[0].formulaTests[0].actor?.normal.length).toBe(
      2,
    );
    expect(c.alchemy.activations[0].formulaTests[0].difficulty).toBe(2);
    expect(() =>
      test(
        ready(),
        { mode: "delicate", targetId: "", difficulty: 2 },
        { gm: false },
      ),
    ).toThrow(/Narrador/);
  });
  it("precisão com faca retira dois dados e registra +1 sem dano automático", () => {
    const c = test(ready(), {
      mode: "knife",
      targetId: "",
      difficulty: 2,
      note: "Teste de precisão definido pelo Narrador.",
    }).character;
    const t = c.alchemy.activations[0].formulaTests[0];
    expect(t.actor!.normal.length + t.actor!.hunger.length).toBe(2);
    const r = accept(c);
    expect(r.result.message).toContain("+1 de dano");
    expect(r.result.formulaTest?.outcome?.rawDamage).toBe(0);
  });
  it("usa o nível adquirido na ativação mesmo após progressão", () => {
    const c = ready();
    c.disciplines[ALCHEMY] = 5;
    expect(test(c).result.formulaTest?.actor!.normal.length).toBe(3);
  });
  it("backup não aceita alterar Dados de Fome preservados nem reabrir resultado concluído", () => {
    const c = test(ready()).character;
    const rerolled = run(c, rerollData(c)).character;
    rerolled.alchemy.activations[0].formulaTests[0].actor!.hunger[0] = 1;
    expect(characterSchema.safeParse(rerolled).success).toBe(false);
    const resolved = accept(c).character;
    resolved.alchemy.activations[0].formulaTests[0].actorReview.state = "open";
    expect(characterSchema.safeParse(resolved).success).toBe(false);
  });
});

describe("Longo Alcance: transições e validação dos registros", () => {
  it("trocar de sustentação para arremesso remove a suspensão anterior", () => {
    const held = accept(test(ready(), { mode: "hold" }).character);
    const [c, t] = advance([held.character, held.targets[0]]);
    const used = test(c, {}, { characters: [t] });
    const r = accept(used.character, { characters: [t] });
    expect(r.targets[0].conditions).not.toContain(FLOAT_CONDITION);
    expect(r.targets[0].conditions).toContain("Caído");
    expect(r.character.alchemy.activations[0].longReach.sustaining).toBe(false);
  });
  it("uma nova ativação Athanor cancela o teste aberto do Poder anterior", () => {
    const prior = ready();
    prior.clock.turn++;
    const c = test(prior).character;
    c.thinBlood.alchemyMethod = "athanor";
    c.alchemy.activations[0].method = "athanor";
    const prepared = run(c, {
      operation: "prepare",
      formulaId: LONG_REACH,
      ingredients: "Vitae, sangue colérico e fio de náilon",
      ingredientsConfirmed: true,
    }).character;
    prepared.alchemy.preparations[0].remainingTurns = 0;
    const next = run(prepared, {
      operation: "activate",
      preparationId: prepared.alchemy.preparations[0].id,
      concentrationConfirmed: true,
    }).character;
    expect(next.alchemy.activations[0].status).toBe("ended");
    expect(next.alchemy.activations[0].formulaTests[0].status).toBe(
      "cancelled",
    );
    expect(next.alchemy.activations[0].formulaTests[0].actorReview.state).toBe(
      "closed",
    );
  });
  it("não usa testes próprios durante concentração exclusiva ou incapacidade", () => {
    const c = ready();
    c.conditions.push("Torpor");
    expect(() => test(c)).toThrow(/incapacidade/);
    c.conditions = [];
    c.thinBlood.alchemyMethod = "athanor";
    const preparing = run(c, {
      operation: "prepare",
      formulaId: LONG_REACH,
      ingredients: "Vitae, sangue colérico e fio de náilon",
      ingredientsConfirmed: true,
    }).character;
    expect(() => test(preparing)).toThrow(/Concentração/);
  });
  it("não aceita dificuldade de sustentação diferente de 3 nem teste aberto em ativação encerrada", () => {
    const c = test(ready(), { mode: "hold" }).character;
    c.alchemy.activations[0].formulaTests[0].difficulty = 2;
    expect(characterSchema.safeParse(c).success).toBe(false);
    c.alchemy.activations[0].formulaTests[0].difficulty = 3;
    c.alchemy.activations[0].status = "ended";
    expect(characterSchema.safeParse(c).success).toBe(false);
    const active = ready();
    active.alchemy.activations[0].longReach.sustaining = true;
    expect(characterSchema.safeParse(active).success).toBe(false);
  });
});
