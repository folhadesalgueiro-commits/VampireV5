import { describe, expect, it } from "vitest";
import {
  characterSchema,
  contentSchema,
  emptyCharacter,
  Character,
} from "../shared/model";
import {
  alchemyActionSchema,
  alchemyOperation,
  distillationQuality,
  fixatioLimits,
} from "../shared/alchemy";
import {
  FOG,
  concentrating,
  fogPenalty,
  tickConcentration,
} from "../shared/alchemy-effects";
import { expireEffects } from "../shared/blood-mechanics";
import { ALCHEMY } from "../shared/thin-blood";
import { derived, pool } from "../shared/rules";
import { combatSchema, resolveCombat, oneRollConflict } from "../shared/combat";
import { seedCatalog } from "../server/seed";
import { validThinCharacter } from "./fixtures";
const catalog = seedCatalog();
let sequence = 0;
function alchemist(method: "athanor" | "calcinatio" | "fixatio" = "fixatio") {
  const c = validThinCharacter();
  c.status = "active";
  c.thinBlood.alchemyMethod = method;
  c.disciplines[ALCHEMY] = 1;
  c.powers = [FOG];
  c.attributes.inteligencia = 3;
  c.attributes.vigor = 3;
  c.attributes.manipulacao = 3;
  return c;
}
const human = (): Character => ({
  ...characterSchema.parse({
    ...emptyCharacter(),
    name: "Receptáculo de teste",
    nature: "mortal",
    hunger: 0,
  }),
  id: "human",
  version: 1,
});
const preparation = {
  operation: "prepare",
  formulaId: FOG,
  ingredients: "Vitae própria, sangue fleumático e gelo seco",
  ingredientsConfirmed: true,
  laboratoryConfirmed: true,
};
const narrator = {
  narrativeConfirmed: true,
  note: "O Narrador conferiu o procedimento e resolve as consequências.",
};
function run(
  c: Character,
  data: any,
  options: {
    gm?: boolean;
    characters?: Character[];
    catalog?: typeof catalog;
    rng?: () => number;
  } = {},
) {
  return alchemyOperation(
    c,
    options.catalog ?? catalog,
    alchemyActionSchema.parse(data),
    {
      gm: options.gm ?? true,
      characters: options.characters ?? [c, human()],
      id: () => `alchemy-test-${++sequence}`,
    },
    options.rng ?? (() => 8),
  );
}
const activate = (c: Character, extra = {}, options = {}) =>
  run(
    c,
    {
      operation: "activate",
      preparationId: c.alchemy.preparations[0].id,
      ...extra,
    },
    options,
  );
const prepared = (method: "athanor" | "calcinatio" | "fixatio" = "fixatio") =>
  run(alchemist(method), {
    ...preparation,
    vesselId: "human",
    vesselEmotionConfirmed: true,
    ...narrator,
  }).character;

describe("Destilação e ativação — Básico PDF 274–277", () => {
  it("conserva fichas anteriores sem inventar preparações", () => {
    const old = { ...alchemist() } as any;
    delete old.alchemy;
    expect(characterSchema.parse(old).alchemy).toEqual({
      preparations: [],
      activations: [],
    });
  });
  it("reproduz apenas as três linhas da tabela de qualidade", () => {
    expect(distillationQuality(2)).toContain("fraco");
    expect(distillationQuality(4)).toContain("pretendido");
    expect(distillationQuality(6)).toContain("aumentado");
    for (const n of [0, 1, 3, 5, 7])
      expect(distillationQuality(n)).toContain("sem efeito definido");
  });
  it("preparar Fixatio paga somente um Despertar e não rola destilação", () => {
    let calls = 0;
    const c = alchemist(),
      before = structuredClone(c);
    const r = run(c, preparation, {
      rng: () => {
        calls++;
        return 1;
      },
    });
    expect(c).toEqual(before);
    expect(calls).toBe(1);
    expect(r.character.hunger).toBe(2);
    expect(r.result.distillation).toBeUndefined();
    expect(r.character.alchemy.preparations[0].distillation).toBeNull();
    expect(r.character.id).toBe(c.id);
  });
  it.each(["athanor", "calcinatio"] as const)(
    "%s rola na preparação e reutiliza os dados ao ativar",
    (method) => {
      let c = prepared(method);
      expect(c.alchemy.preparations[0].distillation?.normal.length).toBe(3);
      if (method === "athanor")
        for (let i = 0; i < 3; i++) c = tickConcentration(c, "turn");
      let calls = 0;
      const r = activate(
        c,
        {
          concentrationConfirmed: true,
          vesselEmotionConfirmed: true,
          feedingConfirmed: true,
          ...narrator,
        },
        {
          rng: () => {
            calls++;
            return 8;
          },
        },
      );
      expect(calls).toBe(1);
      expect(r.result.distillation?.successes).toBe(4);
      expect(r.character.alchemy.preparations).toHaveLength(
        method === "calcinatio" ? 1 : 0,
      );
    },
  );
  it("não prepara com Fome 5 nem sem fórmula adquirida, vitae ou Ressonância confirmadas", () => {
    const c = alchemist();
    expect(() =>
      run(c, { ...preparation, ingredientsConfirmed: false }),
    ).toThrow(/ingredientes/);
    expect(() => run(c, { ...preparation, formulaId: "ausente" })).toThrow(
      /Fórmula/,
    );
    c.hunger = 5;
    expect(() => run(c, preparation)).toThrow(/Fome 5/);
    expect(c.alchemy.preparations).toHaveLength(0);
  });
  it("fórmulas especiais não recebem o procedimento genérico incorreto", () => {
    const c = alchemist();
    const f = catalog.find(
      (x) => x.kind === "formula" && x.name === "Defracionar",
    )!;
    expect(f).toBeDefined();
    c.disciplines[ALCHEMY] = 3;
    c.powers.push(f.id);
    expect(() => run(c, { ...preparation, formulaId: f.id })).toThrow(
      /procedimento especial/,
    );
  });
  it("reserva modificadores de ingredientes ao Narrador e valida o intervalo", () => {
    expect(() =>
      run(alchemist(), { ...preparation, modifier: 1 }, { gm: false }),
    ).toThrow(/Narrador/);
    expect(() => run(alchemist(), { ...preparation, modifier: 3 })).toThrow();
  });
  it("Fixatio exige laboratório ou equipamento de campo e limita o campo ao nível 3", () => {
    const c = alchemist();
    expect(() =>
      run(c, { ...preparation, laboratoryConfirmed: false }),
    ).toThrow(/laboratório/);
    const f = {
      ...contentSchema.parse({
        kind: "formula",
        name: "Fórmula de campo",
        parentId: ALCHEMY,
        level: 3,
        rouse: 0,
      }),
      id: "custom-field",
      version: 1,
    };
    const list = [...catalog, f];
    c.disciplines[ALCHEMY] = 3;
    c.powers.push(f.id);
    const p = run(
      c,
      { ...preparation, formulaId: f.id, fieldEquipment: true },
      { catalog: list },
    ).character;
    expect(
      activate(p, {}, { catalog: list }).result.distillation?.successes,
    ).toBe(4); // Inteligência 3 + Alquimia 3 − 2
    f.level = 4;
    c.disciplines[ALCHEMY] = 4;
    expect(() =>
      run(
        c,
        { ...preparation, formulaId: f.id, fieldEquipment: true },
        { catalog: list },
      ),
    ).toThrow(/nível 3/);
  });
  it("limita frascos por um Atributo e armazenamento por duas vezes Alquimia mais Refúgio", () => {
    const c = alchemist();
    c.attributes.raciocinio = 1;
    c.attributes.destreza = 3;
    expect(fixatioLimits(c, catalog, "raciocinio")).toEqual({
      carried: 1,
      stored: 6,
    });
    expect(fixatioLimits(c, catalog, "destreza").carried).toBe(3);
    const first = run(c, preparation).character;
    expect(() => run(first, preparation)).toThrow(/carregados/);
    const second = run(first, {
      ...preparation,
      carryAttribute: "destreza",
    }).character;
    expect(second.alchemy.preparations).toHaveLength(2);
    let stored = c;
    for (let i = 0; i < 6; i++)
      stored = run(stored, { ...preparation, location: "stored" }).character;
    expect(() => run(stored, { ...preparation, location: "stored" })).toThrow(
      /armazenados/,
    );
  });
  it("transportar conserva o frasco e o custo; frasco armazenado não é consumido", () => {
    const p = run(alchemist(), {
      ...preparation,
      location: "stored",
    }).character;
    expect(() => activate(p)).toThrow(/armazenamento/);
    const moved = run(p, {
      operation: "move",
      preparationId: p.alchemy.preparations[0].id,
      location: "carried",
    });
    expect(moved.result.rouses).toHaveLength(0);
    expect(moved.character.alchemy.preparations[0].id).toBe(
      p.alchemy.preparations[0].id,
    );
    expect(
      activate(moved.character).character.alchemy.preparations,
    ).toHaveLength(0);
  });
  it("Athanor exige três turnos exclusivos e não presume concentração ao trocar de cena", () => {
    let c = prepared("athanor");
    expect(concentrating(c)).toBe(true);
    expect(() => activate(c, { concentrationConfirmed: true })).toThrow(
      /três turnos/,
    );
    expect(
      tickConcentration(c, "scene").alchemy.preparations[0].remainingTurns,
    ).toBe(3);
    expect(
      tickConcentration(c, "night").alchemy.preparations[0].remainingTurns,
    ).toBe(3);
    for (let i = 0; i < 3; i++) c = tickConcentration(c, "turn");
    expect(() => activate(c)).toThrow(/concentração exclusiva/);
    expect(activate(c, { concentrationConfirmed: true }).result.status).toBe(
      "active",
    );
  });
  it("Narrador registra concentração transcorrida; jogador não pode saltar a espera", () => {
    const c = prepared("athanor"),
      data = {
        operation: "completeConcentration",
        preparationId: c.alchemy.preparations[0].id,
        ...narrator,
      };
    expect(() => run(c, data, { gm: false })).toThrow(/Narrador/);
    expect(concentrating(run(c, data).character)).toBe(false);
  });
  it("concentração bloqueia confronto, incluindo o procedimento de uma rolagem", () => {
    const a = prepared("athanor"),
      b = human();
    expect(() =>
      resolveCombat(
        a,
        b,
        catalog,
        combatSchema.parse({
          a: a.id,
          b: b.id,
          attributeA: "forca",
          skillA: "briga",
          attributeB: "forca",
          skillB: "briga",
        }),
        { turn: "teste" },
      ),
    ).toThrow(/concentração/);
    expect(() =>
      oneRollConflict(a, catalog, {
        attribute: "forca",
        skill: "briga",
        modifier: 0,
        difficulty: 2,
        social: false,
        aggravated: false,
      }),
    ).toThrow(/concentração/);
  });
  it("Athanor mantém apenas uma mistura e descartar não devolve Despertar", () => {
    const c = prepared("athanor");
    expect(() => run(c, preparation)).toThrow(/concentração/);
    const out = run(c, {
      operation: "discard",
      preparationId: c.alchemy.preparations[0].id,
    });
    expect(out.character.alchemy.preparations).toHaveLength(0);
    expect(out.result.rouses).toHaveLength(0);
    expect(out.character.hunger).toBe(c.hunger);
  });
  it("Calcinatio exige humano e apenas uma fórmula por receptáculo", () => {
    const c = alchemist("calcinatio");
    expect(() =>
      run(c, {
        ...preparation,
        vesselId: c.id,
        vesselEmotionConfirmed: true,
        ...narrator,
      }),
    ).toThrow(/receptáculo humano/);
    const p = prepared("calcinatio");
    expect(() =>
      run(p, {
        ...preparation,
        vesselId: "human",
        vesselEmotionConfirmed: true,
        ...narrator,
      }),
    ).toThrow(/já contém/);
    expect(() => activate(p)).toThrow(/alimentação/);
  });
  it("Calcinatio nível 1 bebe amostra sem inventar Fome saciada; conserva o receptáculo", () => {
    const c = prepared("calcinatio");
    const r = activate(c, {
      vesselEmotionConfirmed: true,
      feedingConfirmed: true,
      ...narrator,
    });
    expect(r.result.feedingAmount).toBe(0);
    expect(r.character.alchemy.preparations).toHaveLength(1);
    expect(r.targets).toHaveLength(0);
  });
  it("Calcinatio nociva usa nível menos um, dano agravado e Força + Vigor para sobreviver — PDF 188", () => {
    let c = alchemist("calcinatio");
    c.disciplines[ALCHEMY] = 4;
    c.hunger = 4;
    const f = {
      ...contentSchema.parse({
        kind: "formula",
        name: "Fórmula nociva",
        level: 4,
        parentId: ALCHEMY,
      }),
      id: "harmful",
      version: 1,
    };
    c.powers.push(f.id);
    const list = [...catalog, f];
    c = run(
      c,
      {
        ...preparation,
        formulaId: f.id,
        vesselId: "human",
        vesselEmotionConfirmed: true,
        ...narrator,
      },
      { catalog: list },
    ).character;
    expect(() =>
      activate(
        c,
        { vesselEmotionConfirmed: true, feedingConfirmed: true, ...narrator },
        { catalog: list },
      ),
    ).toThrow(/alimentação é nociva/);
    const r = activate(
      c,
      {
        vesselEmotionConfirmed: true,
        feedingConfirmed: true,
        feedingMode: "harmful",
        ...narrator,
      },
      { catalog: list },
    );
    expect(r.result.feedingAmount).toBe(3);
    expect(r.character.hunger).toBe(1);
    expect(r.targets[0].id).toBe("human");
    expect(r.targets[0].health.aggravated).toBe(3);
    expect(r.result.feeding.survival.normal).toHaveLength(2);
    expect(r.result.feeding.survival.difficulty).toBe(3);
  });
});

describe("Névoa, resolução e efeitos personalizados — Básico PDF 274,276–277", () => {
  it("Névoa com 4 sucessos aplica −2 a quem identifica ou ataca à distância", () => {
    const r = activate(prepared());
    expect(r.result.status).toBe("active");
    expect(r.result.rouses).toHaveLength(1);
    expect(fogPenalty(r.character)).toBe(2);
    expect(r.character.conditions).toContain("Névoa alquímica");
    expect(fogPenalty(expireEffects(r.character, "scene"))).toBe(0);
    const attacker = human();
    attacker.attributes.destreza = 4;
    attacker.skills.armasFogo = 3;
    const hit = resolveCombat(
      attacker,
      r.character,
      catalog,
      combatSchema.parse({
        a: attacker.id,
        b: r.character.id,
        attributeA: "destreza",
        skillA: "armasFogo",
        attributeB: "destreza",
        skillB: "atletismo",
        rangedA: true,
        unilateral: true,
        staticDefense: true,
        difficulty: 1,
      }),
      { turn: "teste" },
      () => 8,
    );
    expect(hit.ar!.normal).toHaveLength(5); // 4 + 3 − 2
  });
  it("consumir é único e uma segunda ativação no mesmo turno é bloqueada", () => {
    const p = prepared(),
      used = activate(p).character;
    expect(() =>
      run(used, {
        operation: "activate",
        preparationId: p.alchemy.preparations[0].id,
      }),
    ).toThrow(/Preparação não encontrada/);
    const another = run(used, preparation).character;
    expect(() => activate(another)).toThrow(/já foi ativado/);
  });
  it("grupo de Névoa custa outro Despertar e respeita cinco incluindo o usuário", () => {
    const c = prepared(),
      members = Array.from({ length: 5 }, (_, i) => ({
        ...human(),
        id: "target-" + i,
      }));
    expect(() =>
      activate(
        c,
        { group: true, targetIds: members.map((x) => x.id) },
        { characters: [c, ...members] },
      ),
    ).toThrow(/quatro alvos/);
    const r = activate(
      c,
      { group: true, targetIds: members.slice(0, 4).map((x) => x.id) },
      { characters: [c, ...members] },
    );
    expect(r.result.rouses).toHaveLength(2);
    expect(r.targets).toHaveLength(4);
    expect(r.targets.every((x) => fogPenalty(x) === 2)).toBe(true);
  });
  it("resultado intermediário consome frasco e custo, preserva dados e aguarda Narrador", () => {
    const c = prepared();
    const values = [8, 8, 8, 1, 8]; // custo, três dados normais e um de Fome
    const r = activate(c, {}, { rng: () => values.shift()! });
    expect(r.result.distillation?.successes).toBe(3);
    expect(r.result.status).toBe("pending");
    expect(r.character.alchemy.preparations).toHaveLength(0);
    expect(fogPenalty(r.character)).toBe(0);
    expect(() =>
      run(
        r.character,
        {
          operation: "resolve",
          activationId: r.result.activationId,
          ...narrator,
        },
        { gm: false },
      ),
    ).toThrow(/Narrador/);
    const resolved = run(r.character, {
      operation: "resolve",
      activationId: r.result.activationId,
      fogPenalty: 1,
      duration: 2,
      ...narrator,
    });
    expect(resolved.result.rouses).toHaveLength(0);
    expect(resolved.result.distillation).toEqual(r.result.distillation);
    expect(fogPenalty(resolved.character)).toBe(1);
    expect(resolved.character.activeEffects[0].remaining).toBe(2);
    expect(() =>
      run(resolved.character, {
        operation: "resolve",
        activationId: r.result.activationId,
        ...narrator,
      }),
    ).toThrow(/já foi resolvida/);
  });
  it("Crítico Confuso com 4 sucessos não aplica efeitos sem decisão narrativa", () => {
    const values = [8, 10, 1, 1, 10];
    const r = activate(prepared(), {}, { rng: () => values.shift()! });
    expect(r.result.distillation?.successes).toBe(4);
    expect(r.result.distillation?.messy).toBe(true);
    expect(r.result.status).toBe("pending");
  });
  it("encerrar um efeito remove a nuvem sem devolver custos", () => {
    const r = activate(prepared());
    const ended = run(r.character, {
      operation: "end",
      activationId: r.result.activationId,
    });
    expect(fogPenalty(ended.character)).toBe(0);
    expect(ended.character.conditions).not.toContain("Névoa alquímica");
    expect(ended.character.hunger).toBe(r.character.hunger);
  });
  it("custos de grupo já incorridos se resolvem em Fome 5 sem Frenesi espontâneo do Sangue-Ralo comum", () => {
    const c = prepared();
    c.hunger = 4;
    const r = activate(c, { group: true }, { rng: () => 1 });
    expect(r.result.rouses).toHaveLength(2);
    expect(r.character.hunger).toBe(5);
    expect(r.result.rouses.every((x) => !x.frenzy)).toBe(true);
    expect(r.result.status).toBe("pending");
  });
  it("efeitos personalizados calculam nível, custo de Vontade e duração, sem limitar o valor ao formulário", () => {
    const f = {
      ...contentSchema.parse({
        name: "Vigor alquímico de teste",
        kind: "formula",
        parentId: ALCHEMY,
        level: 2,
        willpowerCost: 1,
        effects: [
          {
            kind: "attribute",
            target: "forca",
            value: 20,
            scale: "discipline",
            duration: "scene",
          },
        ],
      }),
      id: "scaled",
      version: 1,
    };
    const c = alchemist();
    c.disciplines[ALCHEMY] = 2;
    c.attributes.inteligencia = 2;
    c.powers.push(f.id);
    const list = [...catalog, f];
    const p = run(
      c,
      { ...preparation, formulaId: f.id },
      { catalog: list },
    ).character;
    const r = activate(p, {}, { catalog: list });
    expect(r.character.activeEffects[0].effect.value).toBe(40);
    expect(derived(r.character, list).attributes.forca).toBe(
      c.attributes.forca + 40,
    );
    expect(r.character.willpower.superficial).toBe(1);
    expect(
      derived(expireEffects(r.character, "scene"), list).attributes.forca,
    ).toBe(c.attributes.forca);
  });
  it("resolução personalizada aplica dano por margem e identifica alvo mortal sem código", () => {
    const f = {
      ...contentSchema.parse({
        name: "Elixir ofensivo de teste",
        kind: "formula",
        parentId: ALCHEMY,
        effects: [
          {
            kind: "damage",
            recipient: "target",
            target: "health",
            value: 1,
            scale: "margin",
            duration: "instant",
            aggravated: true,
            when: { field: "tag", operator: "includes", value: "alvoMortal" },
          },
        ],
      }),
      id: "margin-formula",
      version: 1,
    };
    const list = [...catalog, f],
      c = alchemist();
    c.powers.push(f.id);
    const p = run(
      c,
      { ...preparation, formulaId: f.id },
      { catalog: list },
    ).character;
    const pending = activate(p, { targetIds: ["human"] }, { catalog: list });
    expect(pending.result.status).toBe("pending");
    const r = run(
      pending.character,
      {
        operation: "resolve",
        activationId: pending.result.activationId,
        effectMargin: 2,
        ...narrator,
      },
      { catalog: list },
    );
    expect(r.targets[0].health.aggravated).toBe(2);
    expect(r.result.rouses).toHaveLength(0);
  });
  it("encerramento e descarte continuam disponíveis depois de ajuste manual de nível ou perfil", () => {
    let c = prepared();
    c.disciplines[ALCHEMY] = 0;
    c.status = "retired";
    const r = run(c, {
      operation: "discard",
      preparationId: c.alchemy.preparations[0].id,
    });
    expect(r.character.alchemy.preparations).toHaveLength(0);
    c = activate(prepared()).character;
    c.status = "retired";
    const ended = run(c, {
      operation: "end",
      activationId: c.alchemy.activations[0].id,
    });
    expect(fogPenalty(ended.character)).toBe(0);
  });
  it("Athanor encerra efeito anterior ao ativar outra mistura", () => {
    let c = prepared("athanor");
    for (let i = 0; i < 3; i++) c = tickConcentration(c, "turn");
    const first = activate(c, { concentrationConfirmed: true });
    c = run(first.character, preparation).character;
    for (let i = 0; i < 3; i++) {
      c = tickConcentration(c, "turn");
      c.clock.turn++;
    }
    const second = activate(c, { concentrationConfirmed: true });
    expect(second.character.alchemy.activations[0].status).toBe("ended");
    expect(second.character.activeEffects).toHaveLength(1);
    expect(fogPenalty(second.character)).toBe(2);
  });
  it("fórmula personalizada aplica dados condicionais, atributos e efeitos sem código", () => {
    const f = {
      ...contentSchema.parse({
        name: "Elixir de teste",
        kind: "formula",
        parentId: ALCHEMY,
        rouse: 1,
        effects: [
          { kind: "attribute", target: "forca", value: 1, duration: "scene" },
          {
            kind: "dice",
            target: "briga",
            value: 2,
            duration: "scene",
            when: {
              field: "tag",
              operator: "includes",
              value: "protegerAliado",
            },
          },
        ],
      }),
      id: "custom-formula",
      version: 1,
    };
    const list = [...catalog, f],
      c = alchemist();
    c.powers.push(f.id);
    const p = run(
      c,
      { ...preparation, formulaId: f.id },
      { catalog: list },
    ).character;
    const r = activate(p, {}, { catalog: list });
    expect(derived(r.character, list).attributes.forca).toBe(
      c.attributes.forca + 1,
    );
    expect(
      pool(r.character, list, {
        attribute: "forca",
        skill: "briga",
        tags: ["protegerAliado"],
      }) - pool(r.character, list, { attribute: "forca", skill: "briga" }),
    ).toBe(2);
  });
  it("catálogo legado não revisado exige custo conferido e revisão antes de resolver", () => {
    const list = catalog.map((f) =>
      f.id === FOG ? { ...f, automation: "unreviewed" as const } : f,
    );
    const c = alchemist();
    const p = run(c, preparation, { catalog: list }).character;
    expect(() => activate(p, {}, { catalog: list })).toThrow(/consulta/);
    const r = activate(
      p,
      { rouseCount: 1, reviewDistillation: true, ...narrator },
      { catalog: list },
    );
    expect(r.result.status).toBe("pending");
    const ended = run(
      r.character,
      {
        operation: "resolve",
        activationId: r.result.activationId,
        applyEffects: false,
        ...narrator,
      },
      { catalog: list },
    );
    expect(ended.result.status).toBe("ended");
    expect(ended.character.alchemy.activations[0].resolution).toBe(
      narrator.note,
    );
  });
  it("encerra simultaneamente efeitos próprios e externos de uma fórmula personalizada", () => {
    const f = {
      ...contentSchema.parse({
        name: "Elixir compartilhado de teste",
        kind: "formula",
        parentId: ALCHEMY,
        effects: [
          { kind: "attribute", target: "forca", value: 1, duration: "scene" },
          {
            kind: "dice",
            recipient: "target",
            target: "briga",
            value: 2,
            duration: "scene",
          },
        ],
      }),
      id: "mixed-recipients",
      version: 1,
    };
    const list = [...catalog, f],
      c = alchemist();
    c.powers.push(f.id);
    const p = run(
      c,
      { ...preparation, formulaId: f.id },
      { catalog: list },
    ).character;
    expect(() => activate(p, {}, { catalog: list })).toThrow(
      /Selecione um alvo/,
    );
    const used = activate(p, { targetIds: ["human"] }, { catalog: list });
    expect(used.character.activeEffects).toHaveLength(1);
    expect(used.targets[0].activeEffects).toHaveLength(1);
    const ended = run(
      used.character,
      { operation: "end", activationId: used.result.activationId },
      { catalog: list, characters: [used.character, ...used.targets] },
    );
    expect(ended.character.activeEffects).toHaveLength(0);
    expect(ended.targets[0].activeEffects).toHaveLength(0);
  });
});

describe("Rerrolagem de destilação — Básico PDF 100,104–105,135,183,274–276", () => {
  it("o nível usado nos efeitos fica preservado durante a revisão dos dados", () => {
    const f = {
      ...contentSchema.parse({
        name: "Elixir escalado durante a revisão",
        kind: "formula",
        parentId: ALCHEMY,
        effects: [
          {
            kind: "attribute",
            target: "forca",
            value: 1,
            scale: "discipline",
            duration: "scene",
          },
        ],
      }),
      id: "frozen-level",
      version: 1,
    };
    const list = [...catalog, f],
      c = alchemist();
    c.powers.push(f.id);
    const p = run(
      c,
      { ...preparation, formulaId: f.id },
      { catalog: list },
    ).character;
    const used = activate(
      p,
      { reviewDistillation: true },
      { catalog: list },
    ).character;
    expect(used.alchemy.activations[0].alchemyLevel).toBe(1);
    used.disciplines[ALCHEMY] = 3; // Ajuste posterior não amplia uma ativação já paga.
    const accepted = run(
      used,
      {
        operation: "acceptDistillation",
        activationId: used.alchemy.activations[0].id,
      },
      { catalog: list },
    );
    expect(derived(accepted.character, list).attributes.forca).toBe(
      c.attributes.forca + 1,
    );
  });
  const rerollPreparation = (c: Character, indices = [0], options = {}) =>
    run(
      c,
      {
        operation: "rerollDistillation",
        preparationId: c.alchemy.preparations[0].id,
        indices,
      },
      options,
    );
  const rerollActivation = (c: Character, indices = [0], options = {}) =>
    run(
      c,
      {
        operation: "rerollDistillation",
        activationId: c.alchemy.activations.at(-1)!.id,
        indices,
      },
      options,
    );
  const accept = (c: Character, options = {}) =>
    run(
      c,
      {
        operation: "acceptDistillation",
        activationId: c.alchemy.activations.at(-1)!.id,
      },
      options,
    );

  it.each(["athanor", "calcinatio"] as const)(
    "%s rerrola na preparação, preservando Fome, concentração e custos",
    (method) => {
      const values = [8, 1, 2, 8, 8];
      const p = run(
        alchemist(method),
        {
          ...preparation,
          vesselId: "human",
          vesselEmotionConfirmed: true,
          ...narrator,
        },
        { rng: () => values.shift()! },
      ).character;
      const original = structuredClone(p),
        first = p.alchemy.preparations[0];
      const r = rerollPreparation(p, [0, 1], { gm: false });
      expect(r.result.distillation?.successes).toBe(4);
      expect(p).toEqual(original);
      expect(r.character.hunger).toBe(p.hunger);
      expect(r.character.willpower.superficial).toBe(1);
      expect(r.result.rouses).toHaveLength(0);
      expect(r.result.willpowerSpent).toBe(1);
      expect(r.character.alchemy.preparations[0]).toMatchObject({
        id: first.id,
        preparedAt: first.preparedAt,
        remainingTurns: first.remainingTurns,
        review: { state: "open", rerolled: true, original: first.distillation },
      });
      expect(r.character.alchemy.preparations[0].distillation?.hunger).toEqual(
        first.distillation?.hunger,
      );
    },
  );
  it("não permite repetir a operação, selecionar Dados de Fome, índices inválidos ou mais de três", () => {
    const c = prepared("athanor"),
      original = structuredClone(c);
    for (const indices of [[], [0, 0], [-1], [3], [0, 1, 2, 3]]) {
      let draws = 0;
      expect(() =>
        rerollPreparation(c, indices, {
          rng: () => {
            draws++;
            return 8;
          },
        }),
      ).toThrow();
      expect(draws).toBe(0);
      expect(c).toEqual(original);
    }
    const r = rerollPreparation(c);
    expect(() => rerollPreparation(r.character)).toThrow(/já recebeu/);
  });
  it("gasto de Vontade cheio de superficial converte um em agravado, sem metade", () => {
    const c = prepared("athanor"),
      max = derived(c, catalog).willpowerMax;
    c.willpower = { superficial: max, aggravated: 0 };
    const r = rerollPreparation(c, [0, 1, 2]);
    expect(r.character.willpower).toEqual({
      superficial: max - 1,
      aggravated: 1,
    });
    expect(
      r.result.distillation!.normal.length +
        r.result.distillation!.hunger.length,
    ).toBe(4);
  });
  it("Vontade toda agravada impede a rerrolagem sem consumir aleatoriedade", () => {
    const c = prepared("athanor");
    c.willpower.aggravated = derived(c, catalog).willpowerMax;
    let draws = 0;
    expect(() =>
      rerollPreparation(c, [0], {
        rng: () => {
          draws++;
          return 8;
        },
      }),
    ).toThrow(/Vontade indisponível/);
    expect(draws).toBe(0);
    expect(c.alchemy.preparations[0].review.rerolled).toBe(false);
  });
  it("Fixatio ainda não rolado não permite rerrolar o teste de Despertar", () => {
    const c = prepared();
    expect(c.alchemy.preparations[0].distillation).toBeNull();
    expect(() => rerollPreparation(c)).toThrow(/dados ainda não foram rolados/);
  });
  it("Fixatio pode revisar antes dos efeitos, aceitar sem custo e não aceitar duas vezes", () => {
    const c = prepared(),
      used = activate(c, { reviewDistillation: true });
    expect(used.result.status).toBe("pending");
    expect(used.result.review?.state).toBe("open");
    expect(used.character.activeEffects).toHaveLength(0);
    const r = accept(used.character);
    expect(r.result.status).toBe("active");
    expect(r.result.review?.state).toBe("closed");
    expect(r.result.rouses).toHaveLength(0);
    expect(r.result.willpowerSpent).toBe(0);
    expect(r.character.hunger).toBe(used.character.hunger);
    expect(r.character.lastPowerTurn).toBe(used.character.lastPowerTurn);
    expect(fogPenalty(r.character)).toBe(2);
    expect(() => accept(r.character)).toThrow(/já foi encerrada/);
    expect(() => rerollActivation(r.character)).toThrow(/já foi encerrada/);
  });
  it("rerrolar não repete ativação ou frasco e não aplica efeitos até aceitar", () => {
    const values = [8, 1, 8, 8, 8];
    const used = activate(
      prepared(),
      { reviewDistillation: true },
      { rng: () => values.shift()! },
    );
    expect(used.result.distillation?.successes).toBe(3);
    const r = rerollActivation(used.character);
    expect(r.result.distillation?.successes).toBe(4);
    expect(r.character.alchemy.preparations).toHaveLength(0);
    expect(r.character.alchemy.activations).toHaveLength(1);
    expect(r.character.activeEffects).toHaveLength(0);
    expect(r.character.hunger).toBe(used.character.hunger);
    const resolved = accept(r.character);
    expect(resolved.result.status).toBe("active");
    expect(resolved.character.willpower.superficial).toBe(1);
  });
  it("a rerrolagem pode reduzir sucessos e um resultado não normal aguarda Narrador", () => {
    const used = activate(prepared(), { reviewDistillation: true });
    const r = rerollActivation(used.character, [0, 1, 2], { rng: () => 1 });
    expect(r.result.distillation?.successes).toBe(1);
    const accepted = accept(r.character);
    expect(accepted.result.status).toBe("pending");
    expect(accepted.result.review?.state).toBe("closed");
    expect(accepted.character.activeEffects).toHaveLength(0);
    const resolved = run(accepted.character, {
      operation: "resolve",
      activationId: accepted.result.activationId,
      applyEffects: false,
      ...narrator,
    });
    expect(resolved.result.status).toBe("ended");
    expect(resolved.character.willpower).toEqual(r.character.willpower);
  });
  it("pode desarmar um Crítico Confuso ao rerrolar um dez normal, nunca o de Fome", () => {
    const values = [8, 10, 1, 1, 10];
    const used = activate(
      prepared(),
      { reviewDistillation: true },
      { rng: () => values.shift()! },
    );
    expect(used.result.distillation?.messy).toBe(true);
    const r = rerollActivation(used.character, [0]);
    expect(r.result.distillation?.messy).toBe(false);
    expect(r.result.distillation?.hunger).toEqual([10]);
    expect(r.result.distillation?.successes).toBe(2);
    expect(r.result.review?.original?.normal[0]).toBe(10);
  });
  it("Calcinatio não ganha nova rerrolagem ao reutilizar o mesmo receptáculo", () => {
    const p = rerollPreparation(prepared("calcinatio")).character;
    const used = activate(p, {
      vesselEmotionConfirmed: true,
      feedingConfirmed: true,
      ...narrator,
    });
    expect(used.character.alchemy.preparations[0].review.state).toBe("closed");
    expect(used.character.alchemy.activations[0].review).toMatchObject({
      state: "closed",
      rerolled: true,
    });
    expect(() => rerollPreparation(used.character)).toThrow(/já foi encerrada/);
    const next = structuredClone(used.character);
    next.clock.turn++;
    const reused = activate(next, {
      reviewDistillation: true,
      vesselEmotionConfirmed: true,
      feedingConfirmed: true,
      ...narrator,
    });
    expect(reused.result.review).toMatchObject({
      state: "closed",
      rerolled: true,
    });
    expect(reused.character.willpower).toEqual(used.character.willpower);
    expect(() => rerollActivation(reused.character)).toThrow(
      /já foi encerrada/,
    );
  });
  it("ativar Athanor fecha a revisão feita durante a preparação", () => {
    let c = prepared("athanor");
    for (let i = 0; i < 3; i++) c = tickConcentration(c, "turn");
    const used = activate(c, {
      reviewDistillation: true,
      concentrationConfirmed: true,
    });
    expect(used.result.review?.state).toBe("closed");
    expect(() => rerollActivation(used.character)).toThrow(/já foi encerrada/);
  });
  it("encerrar ou resolver manualmente também encerra a revisão dos dados", () => {
    const used = activate(prepared(), { reviewDistillation: true });
    const data = { activationId: used.result.activationId };
    const ended = run(used.character, { operation: "end", ...data });
    const resolved = run(used.character, {
      operation: "resolve",
      ...data,
      ...narrator,
    });
    for (const c of [ended.character, resolved.character]) {
      expect(c.alchemy.activations[0].review.state).toBe("closed");
      expect(() => rerollActivation(c)).toThrow(/já foi encerrada/);
    }
  });
  it("registros anteriores à revisão recebem estado fechado e não são alterados retroativamente", () => {
    const old = prepared("athanor") as any;
    delete old.alchemy.preparations[0].review;
    const c = { ...old, ...characterSchema.parse(old) } as Character;
    expect(c.alchemy.preparations[0].review).toEqual({
      state: "closed",
      rerolled: false,
      original: null,
    });
    expect(() => rerollPreparation(c)).toThrow(/já foi encerrada/);
    const oldUsed = activate(prepared()) as any;
    delete oldUsed.character.alchemy.activations[0].review;
    const legacy = {
      ...oldUsed.character,
      ...characterSchema.parse(oldUsed.character),
    } as Character;
    expect(legacy.alchemy.activations[0].review.state).toBe("closed");
    expect(() => rerollActivation(legacy)).toThrow(/já foi encerrada/);
  });
});
