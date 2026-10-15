import { describe, it, expect } from "vitest";
import {
  characterSchema,
  emptyCharacter,
  attributes,
  skills,
  Character,
  contentSchema,
} from "../shared/model";
import {
  combatSchema,
  resolveCombat,
  receiveDamage,
  oneRollConflict,
  damageIsAggravated,
} from "../shared/combat";
import { seedCatalog } from "../server/seed";
import { pool, validateCreation, finishCreation } from "../shared/rules";
const catalog = seedCatalog();
const actor = (id = "a"): Character => ({
  ...characterSchema.parse(emptyCharacter()),
  id,
  version: 1,
});
const input = (extra: any = {}) =>
  combatSchema.parse({
    a: "a",
    b: "b",
    attributeA: "forca",
    skillA: "briga",
    attributeB: "forca",
    skillB: "briga",
    unilateral: true,
    ...extra,
  });
const context = { turn: "cronica@1.1.1", ruleset: "companion" };
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 8;
};
const strong = () => {
  const c = actor();
  c.attributes.forca = 4;
  c.skills.briga = 2;
  return c;
};
const mortal = () => {
  const c = actor("b");
  c.nature = "mortal";
  c.hunger = 0;
  c.bloodPotency = 0;
  c.attributes.vigor = 3;
  return c;
};
const armored = (c: Character, id = "equipment-colete-de-kevlar") => {
  c.inventory = [
    { id: "armor", contentId: id, quantity: 1, equipped: true, notes: "" },
  ];
  return c;
};
const rigid = (c: Character) => {
  c.disciplines["discipline-fortitude"] = 2;
  c.activeEffects = characterSchema.parse({
    ...c,
    activeEffects: [
      {
        id: "rigidez",
        sourceId: "power-fortitude-rigidez",
        label: "Rigidez",
        effect: { kind: "condition", target: "Rigidez", duration: "scene" },
        createdAt: "",
        remaining: 1,
      },
    ],
  }).activeEffects;
  return c;
};
describe("Dano, blindagem e sangue — Básico PDF 104–105,242,250,297–298; Companion 46", () => {
  it("efeitos personalizados condicionais integram trocas e a opção de uma rolagem", () => {
    const a = strong(),
      b = mortal();
    const flaw = {
      ...contentSchema.parse({
        name: "Sangue Instável",
        kind: "flaw",
        effects: [
          {
            kind: "dice",
            target: "briga",
            value: -2,
            duration: "permanent",
            when: { field: "tag", value: "neblina" },
          },
          {
            kind: "dice",
            target: "briga",
            value: 1,
            duration: "permanent",
            when: { field: "tag", value: "alvoMortal" },
          },
        ],
      }),
      id: "flaw-custom",
      version: 1,
    };
    a.advantages = [
      { contentId: flaw.id, level: 1, source: "manual", notes: "" },
    ];
    const entries = [...catalog, flaw];
    const clear = resolveCombat(a, b, entries, input(), context, () => 8);
    const fog = resolveCombat(
      a,
      b,
      entries,
      input({ tagsA: ["neblina"] }),
      context,
      () => 8,
    );
    expect(clear.ar?.normal.length).toBe(6);
    expect(clear.ar?.hunger.length).toBe(1);
    expect(fog.ar?.normal.length).toBe(4);
    const single = oneRollConflict(
      a,
      entries,
      {
        attribute: "forca",
        skill: "briga",
        modifier: 0,
        difficulty: 4,
        social: false,
        aggravated: false,
        tags: ["neblina"],
      },
      () => 8,
    );
    expect(single.result.successes).toBe(4);
    expect(single.damage).toBe(4);
  });
  it("encaminha a ordem de dano misto selecionada no confronto à ficha", () => {
    const a = strong(),
      b = armored(mortal());
    b.attributes.vigor = 1;
    b.health.superficial = 3;
    const r = resolveCombat(
      a,
      b,
      catalog,
      input({
        sourceA: "gunshot",
        armorItemB: "armor",
        mixedOrderB: "superficialFirst",
      }),
      context,
      sequence(...Array(6).fill(8), 8),
    );
    expect(r.damage.toB).toBe(5);
    expect(r.reports.toB?.order).toBe("superficialFirst");
    expect(r.b.health).toEqual({ superficial: 2, aggravated: 2 });
  });
  it("alvo incapacitado não realiza uma defesa ativa; aceita defesa estática", () => {
    const a = strong(),
      b = actor("b");
    b.conditions = ["Estacado"];
    expect(() => resolveCombat(a, b, catalog, input(), context)).toThrow(
      "defesa estática",
    );
    const r = resolveCombat(
      a,
      b,
      catalog,
      input({ staticDefense: true }),
      context,
      () => 8,
    );
    expect(r.br).toBeNull();
    expect(r.damage.toB).toBe(5);
  });
  it("projéteis são superficiais para vampiros e agravados para mortais e Sangues-Ralos comuns", () => {
    const v = actor(),
      m = mortal(),
      t = actor();
    t.generation = 14;
    t.bloodPotency = 0;
    expect(damageIsAggravated(v, "gunshot")).toBe(false);
    expect(damageIsAggravated(m, "gunshot")).toBe(true);
    expect(damageIsAggravated(t, "gunshot")).toBe(true);
    t.advantages = [
      {
        contentId: "merit-resiliencia-vampirica",
        level: 1,
        source: "manual",
        notes: "",
      },
    ];
    expect(damageIsAggravated(t, "piercing")).toBe(false);
  });
  it("separa versões do contundente pesado contra mortal", () => {
    expect(() =>
      damageIsAggravated(mortal(), "heavyBlunt", false, "basic"),
    ).toThrow("inequívoca");
    expect(damageIsAggravated(mortal(), "manual", false, "basic")).toBe(false);
    expect(damageIsAggravated(mortal(), "manual", true, "basic")).toBe(true);
    expect(damageIsAggravated(mortal(), "heavyBlunt", false, "companion")).toBe(
      true,
    );
    expect(damageIsAggravated(actor(), "heavyBlunt")).toBe(false);
  });
  it("converte agravado pela armadura e divide apenas a parte superficial uma vez", () => {
    const r = receiveDamage(armored(mortal()), catalog, {
      amount: 5,
      source: "gunshot",
      armorItem: "armor",
    });
    expect(r.report.converted).toBe(4);
    expect(r.character.health).toEqual({ superficial: 2, aggravated: 1 });
  });
  it("roupa reforçada não protege contra balas; fogo não é convertido", () => {
    const m = armored(mortal(), "equipment-roupa-reforcada");
    expect(
      receiveDamage(m, catalog, {
        amount: 3,
        source: "gunshot",
        armorItem: "armor",
      }).report.converted,
    ).toBe(0);
    expect(
      receiveDamage(m, catalog, {
        amount: 3,
        source: "piercing",
        armorItem: "armor",
      }).report.converted,
    ).toBe(2);
    expect(
      receiveDamage(m, catalog, {
        amount: 3,
        source: "fire",
        armorItem: "armor",
      }).report.converted,
    ).toBe(0);
  });
  it("Rigidez reduz antes da divisão, preserva mínimo um e não reduz agravado", () => {
    const c = rigid(actor());
    expect(receiveDamage(c, catalog, { amount: 7 }).report.superficial).toBe(3);
    expect(receiveDamage(c, catalog, { amount: 1 }).report.superficial).toBe(1);
    expect(receiveDamage(c, catalog, { amount: 0 }).report.superficial).toBe(0);
    expect(
      receiveDamage(c, catalog, { amount: 3, aggravated: true }).report
        .aggravated,
    ).toBe(3);
  });
  it("blindagem militar penaliza testes de Destreza ao estar equipada", () => {
    const c = armored(actor(), "equipment-blindagem-militar-swat");
    c.attributes.destreza = 4;
    c.skills.atletismo = 2;
    expect(
      pool(c, catalog, { attribute: "destreza", skill: "atletismo" }),
    ).toBe(5);
    c.inventory[0].equipped = false;
    expect(
      pool(c, catalog, { attribute: "destreza", skill: "atletismo" }),
    ).toBe(6);
  });
  it("dano misto preserva o critério de ordem do Narrador quando a fonte não o define", () => {
    const c = armored(mortal());
    c.attributes.vigor = 1;
    c.health.superficial = 3;
    const first = receiveDamage(c, catalog, {
        amount: 5,
        source: "gunshot",
        armorItem: "armor",
        mixedOrder: "aggravatedFirst",
      }),
      second = receiveDamage(c, catalog, {
        amount: 5,
        source: "gunshot",
        armorItem: "armor",
        mixedOrder: "superficialFirst",
      });
    expect(first.character.health).toEqual({ superficial: 1, aggravated: 3 });
    expect(second.character.health).toEqual({ superficial: 2, aggravated: 2 });
    expect(first.report.mixed).toBe(true);
  });
  it("Vitalidade inteiramente agravada provoca Torpor vampírico ou incapacidade mortal", () => {
    expect(
      receiveDamage(actor(), catalog, { amount: 4, aggravated: true }).character
        .conditions,
    ).toContain("Torpor");
    expect(
      receiveDamage(mortal(), catalog, { amount: 6, aggravated: true })
        .character.conditions,
    ).toContain("Incapacitado: coma ou morte");
  });
});
describe("Mordidas, agarramentos e estacas — Básico PDF 101,189–190,201,294,296–297", () => {
  it("agarrar restringe sem dano e permite defender inicialmente com Destreza + Atletismo", () => {
    const a = strong(),
      b = actor("b");
    b.attributes.destreza = 3;
    b.skills.atletismo = 1;
    const r = resolveCombat(
      a,
      b,
      catalog,
      input({
        technique: "grapple",
        attributeB: "destreza",
        skillB: "atletismo",
      }),
      context,
      () => 8,
    );
    expect(r.b.grappledBy).toBe(a.id);
    expect(r.damage.toB).toBe(0);
    expect(r.br?.normal.length! + r.br?.hunger.length!).toBe(4);
  });
  it("não permite continuar o agarramento na mesma rodada e só resolve uma disputa por turno", () => {
    const r = resolveCombat(
      strong(),
      actor("b"),
      catalog,
      input({ technique: "grapple" }),
      context,
      () => 8,
    );
    expect(() =>
      resolveCombat(
        r.a,
        r.b,
        catalog,
        input({ technique: "hold" }),
        context,
        () => 8,
      ),
    ).toThrow("próximo turno");
    const next = { ...context, turn: "cronica@1.1.2" },
      hold = resolveCombat(
        r.a,
        r.b,
        catalog,
        input({ technique: "hold" }),
        next,
        () => 8,
      );
    expect(hold.b.health.aggravated).toBe(0);
    expect(() =>
      resolveCombat(
        hold.a,
        hold.b,
        catalog,
        input({ technique: "bite" }),
        next,
        () => 8,
      ),
    ).toThrow("já foi resolvido");
  });
  it("mordida direta subtrai um sucesso e causa exatamente dois agravados, sem bônus de arma", () => {
    const r = resolveCombat(
      strong(),
      actor("b"),
      catalog,
      input({ technique: "bite", weaponA: 10 }),
      context,
      () => 8,
    );
    expect(r.ar?.successPenalty).toBe(1);
    expect(r.ar?.normal.length! + r.ar?.hunger.length!).toBe(6);
    expect(r.damage.toB).toBe(2);
    expect(r.b.health.aggravated).toBe(2);
    expect(r.b.grappledBy).toBe("a");
  });
  it("mordida sem sucesso não produz dano mesmo contra oposição sem sucesso", () => {
    const r = resolveCombat(
      actor(),
      actor("b"),
      catalog,
      input({ technique: "bite" }),
      context,
      () => 1,
    );
    expect(r.damage.toB).toBe(0);
    expect(r.b.grappledBy).toBe("");
  });
  it("morder um alvo já agarrado não subtrai o sucesso da mordida direta", () => {
    const r = resolveCombat(
      strong(),
      actor("b"),
      catalog,
      input({ technique: "grapple" }),
      context,
      () => 8,
    );
    const bite = resolveCombat(
      r.a,
      r.b,
      catalog,
      input({ technique: "bite" }),
      { ...context, turn: "cronica@1.1.2" },
      () => 8,
    );
    expect(bite.ar?.successPenalty).toBe(0);
    expect(bite.damage.toB).toBe(2);
  });
  it("alvo que vence a disputa escapa; alvo solto perde os marcadores", () => {
    const a = actor(),
      b = strong();
    b.id = "b";
    a.grappledBy = "b";
    a.grappleSinceTurn = "cronica@1.1.0";
    const r = resolveCombat(
      a,
      b,
      catalog,
      input({ technique: "escape" }),
      context,
      sequence(10, 2, 2, 2, 2, 2, 2),
    );
    expect(r.a.grappledBy).toBe("");
    b.grappledBy = "a";
    b.grappleSinceTurn = context.turn;
    expect(
      resolveCombat(a, b, catalog, input({ technique: "release" }), context).b
        .grappledBy,
    ).toBe("");
  });
  it("mortal ou Dentes de Bebê não executa mordida vampírica", () => {
    const m = mortal();
    m.id = "a";
    expect(() =>
      resolveCombat(
        m,
        actor("b"),
        catalog,
        input({ technique: "bite" }),
        context,
      ),
    ).toThrow("presas");
    const t = strong();
    t.generation = 14;
    t.advantages = [
      {
        contentId: "flaw-dentes-de-bebe",
        level: 1,
        source: "manual",
        notes: "",
      },
    ];
    expect(() =>
      resolveCombat(
        t,
        actor("b"),
        catalog,
        input({ technique: "bite" }),
        context,
      ),
    ).toThrow("presas");
  });
  it("estaqueamento subtrai dois sucessos, usa bônus zero e exige cinco danos antes da metade", () => {
    const a = actor();
    a.attributes.forca = 5;
    a.skills.armasBrancas = 4;
    const r = resolveCombat(
      a,
      actor("b"),
      catalog,
      input({ technique: "stake", skillA: "armasBrancas", weaponA: 10 }),
      context,
      () => 8,
    );
    expect(r.ar?.successPenalty).toBe(2);
    expect(r.damage.toB).toBe(6);
    expect(r.b.conditions).toContain("Estacado");
    expect(r.b.health.superficial).toBe(3);
    a.skills.armasBrancas = 2;
    expect(
      resolveCombat(
        a,
        actor("b"),
        catalog,
        input({ technique: "stake", skillA: "armasBrancas" }),
        context,
        () => 8,
      ).b.conditions,
    ).not.toContain("Estacado");
  });
  it("Isca de Estaca causa Morte Final; estaqueado ainda não é Torpor automático", () => {
    const a = actor();
    a.attributes.forca = 5;
    a.skills.armasBrancas = 4;
    const b = actor("b");
    b.advantages = [
      {
        contentId: "flaw-isca-de-estaca",
        level: 2,
        source: "manual",
        notes: "",
      },
    ];
    expect(
      resolveCombat(
        a,
        b,
        catalog,
        input({ technique: "stake", skillA: "armasBrancas" }),
        context,
        () => 8,
      ).b.conditions,
    ).toContain("Morte Final");
    b.advantages = [];
    const normal = resolveCombat(
      a,
      b,
      catalog,
      input({ technique: "stake", skillA: "armasBrancas" }),
      context,
      () => 8,
    );
    expect(normal.b.conditions).not.toContain("Torpor");
  });
  it("Corpo Letal escolhe agravado desarmado em mortal e ignora armadura por Potência", () => {
    const a = strong();
    a.disciplines["discipline-potencia"] = 2;
    a.powers = ["power-potencia-corpo-letal"];
    const r = resolveCombat(
      a,
      armored(mortal()),
      catalog,
      input({ lethalBody: true, armorItemB: "armor" }),
      context,
      () => 8,
    );
    expect(r.reports.toB?.converted).toBe(2);
    expect(r.b.health).toEqual({ superficial: 1, aggravated: 3 });
  });
});
describe("Opções de conflito e criação mortal", () => {
  it("cobertura, defesa total e defesas sucessivas modificam dados, não sucessos", () => {
    const b = actor("b");
    b.attributes.destreza = 4;
    b.skills.atletismo = 2;
    const r = resolveCombat(
      strong(),
      b,
      catalog,
      input({
        attributeB: "destreza",
        skillB: "atletismo",
        rangedA: true,
        coverB: -2,
        fullDefenseB: true,
        successiveDefenseB: 1,
      }),
      context,
      () => 8,
    );
    expect(r.br?.normal.length! + r.br?.hunger.length!).toBe(4);
  });
  it("alvo imóvel usa dificuldade estática e não rola uma defesa fictícia", () => {
    const r = resolveCombat(
      strong(),
      actor("b"),
      catalog,
      input({ staticDefense: true, difficulty: 1 }),
      context,
      () => 8,
    );
    expect(r.br).toBe(null);
    expect(r.damage.toB).toBe(5);
  });
  it("Conflito de Uma Rolagem reproduz o exemplo de Rebecca: cinco sucessos, dificuldade quatro, três agravados de Vontade", () => {
    const c = rigid(actor());
    c.attributes.carisma = 3;
    c.skills.performance = 2;
    c.attributes.autocontrole = 3;
    c.attributes.determinacao = 3;
    const r = oneRollConflict(
      c,
      catalog,
      {
        attribute: "carisma",
        skill: "performance",
        modifier: 0,
        difficulty: 4,
        social: true,
        aggravated: true,
      },
      () => 8,
    );
    expect(r.result.win).toBe(true);
    expect(r.damage).toBe(3);
    expect(r.character.willpower.aggravated).toBe(3);
  });
  it("uma rolagem não divide superficial nem permite reduzi-lo com Rigidez", () => {
    const c = rigid(actor());
    c.attributes.forca = 3;
    c.skills.briga = 2;
    c.attributes.vigor = 5;
    const r = oneRollConflict(
      c,
      catalog,
      {
        attribute: "forca",
        skill: "briga",
        modifier: 0,
        difficulty: 4,
        social: false,
        aggravated: false,
      },
      () => 8,
    );
    expect(r.damage).toBe(3);
    expect(r.character.health.superficial).toBe(3);
    expect(r.report.reduction).toBe(0);
  });
  it("criação mortal usa distribuição comum, sete Vantagens/dois Defeitos, sem Clã ou Disciplinas", () => {
    const c = mortal();
    c.name = "Mortal válido";
    attributes.forEach(
      (k, i) => (c.attributes[k] = [4, 3, 3, 3, 2, 2, 2, 2, 1][i]),
    );
    skills.forEach(
      (k, i) => (c.skills[k] = i < 3 ? 3 : i < 8 ? 2 : i < 15 ? 1 : 0),
    );
    c.specialties = {
      briga: ["Agarrar"],
      oficios: ["Marcenaria"],
      performance: ["Canto"],
    };
    c.advantages = [
      {
        contentId: "background-recursos",
        level: 5,
        source: "creation",
        notes: "",
      },
      {
        contentId: "background-contatos",
        level: 2,
        source: "creation",
        notes: "",
      },
      { contentId: "flaw-repulsivo", level: 2, source: "creation", notes: "" },
    ];
    c.convictions = [{ conviction: "Proteja amigos", pillar: "Uma amiga" }];
    expect(validateCreation(c, catalog)).toEqual([]);
    const out = finishCreation(c, catalog);
    expect(out.hunger).toBe(0);
    expect(out.humanity).toBe(7);
    expect(out.status).toBe("active");
    c.clanId = "clan-brujah";
    expect(
      validateCreation(c, catalog).some((x) => x.includes("Mortais não têm")),
    ).toBe(true);
  });
});
