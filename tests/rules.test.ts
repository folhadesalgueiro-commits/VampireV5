import { describe, it, expect } from "vitest";
import {
  characterSchema,
  emptyCharacter,
  contentSchema,
  attributes,
  skills,
  Content,
} from "../shared/model";
import {
  evaluate,
  roll,
  rouse,
  reroll,
  applyDamage,
  derived,
  pool,
  remorse,
  addStains,
  blood,
  feed,
  advance,
  validateCreation,
  xpCost,
  finishCreation,
  conflict,
  requirementsMet,
} from "../shared/rules";
import { seedCatalog } from "../server/seed";
const catalog = seedCatalog();
const char = () => ({
  ...characterSchema.parse(emptyCharacter()),
  id: "test",
  version: 1,
});
const custom = (data: any): Content => ({
  ...contentSchema.parse({ name: "Conteúdo de teste", kind: "merit", ...data }),
  id: data.id ?? "custom-test",
});
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 2;
};
describe("Dados V5 — Básico PDF 94–100, 180–183", () => {
  it("cada par de 10 soma quatro sucessos", () => {
    expect(evaluate([10, 10], [], 1).successes).toBe(4);
    expect(evaluate([10, 10, 10], [], 1).successes).toBe(5);
    expect(evaluate([10, 10, 10, 10], [], 1).successes).toBe(8);
  });
  it("um único 10 não é crítico", () =>
    expect(evaluate([10], [2], 1).critical).toBe(false));
  it("crítico confuso exige vitória e um 10 de Fome", () => {
    expect(evaluate([10], [10], 4).messy).toBe(true);
    expect(evaluate([10], [10], 5).messy).toBe(false);
  });
  it("falha bestial pode conter sucessos insuficientes", () =>
    expect(evaluate([6, 4], [1], 2).bestial).toBe(true));
  it("um 1 de Fome numa vitória não causa falha bestial", () =>
    expect(evaluate([6, 6], [1], 2).bestial).toBe(false));
  it("Fome substitui dados, não acrescenta", () => {
    const r = roll(2, 5, 1, () => 7);
    expect(r.hunger).toHaveLength(2);
    expect(r.normal).toHaveLength(0);
    expect(r.successes).toBe(2);
  });
  it("rolagens de trilha excluem Fome", () =>
    expect(roll(3, 5, 2, () => 7, true).hunger).toHaveLength(0));
  it("rerrolagem só altera os índices normais selecionados", () => {
    const r = evaluate([2, 3, 10], [10, 1], 6);
    const next = reroll(r, [0, 1], () => 8);
    expect(next.hunger).toEqual([10, 1]);
    expect(next.normal).toEqual([8, 8, 10]);
    expect(next.messy).toBe(true);
  });
  it("não permite índices inválidos, repetidos ou mais de três", () => {
    const r = evaluate([1, 2, 3, 4], [1], 1);
    expect(() => reroll(r, [4])).toThrow();
    expect(() => reroll(r, [0, 0])).toThrow();
    expect(() => reroll(r, [0, 1, 2, 3])).toThrow();
  });
  it("valida paradas, Fome e valores dos dados", () => {
    expect(() => roll(0, 1, 1)).toThrow();
    expect(() => roll(2, -1, 1)).toThrow();
    expect(() => evaluate([11], [], 1)).toThrow();
  });
});
describe("Despertar e Potência — Básico PDF 187, 192–197; Companion PDF 61–63", () => {
  it("falha aumenta a Fome, sucesso a mantém", () => {
    expect(rouse(2, {}, () => 5).hunger).toBe(3);
    expect(rouse(2, {}, () => 6).hunger).toBe(2);
  });
  it("Fome 5 impede uso voluntário; forçado requer Frenesi", () => {
    expect(() => rouse(5, {}, () => 8)).toThrow();
    expect(rouse(5, { forced: true }, () => 8).frenzy).toBe(true);
  });
  it("despertar noturno em Fome 5 pode levar ao Torpor", () => {
    expect(rouse(5, { waking: true }, () => 1).torpor).toBe(true);
    expect(rouse(5, { waking: true }, () => 6).torpor).toBe(false);
  });
  it("rerrolagem por Potência considera o maior dado", () =>
    expect(rouse(4, { double: true }, sequence(2, 7)).hunger).toBe(4));
  it("separa versões de Surto e Perdição", () => {
    expect(blood(1, "basic").surge).toBe(1);
    expect(blood(1, "companion").surge).toBe(2);
    expect(blood(1, "basic").bane).toBe(1);
    expect(blood(1, "companion").bane).toBe(2);
    expect(blood(0, "companion").surge).toBe(1);
    expect(blood(0, "companion").bane).toBe(0);
  });
  it("confere os onze níveis da tabela", () => {
    for (let i = 0; i < 11; i++) {
      expect(blood(i).mend).toBe([1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 5][i]);
      expect(blood(i).bonus).toBe([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5][i]);
    }
  });
});
describe("Dano e Força de Vontade — Básico PDF 104–106", () => {
  it("superficial é dividido por dois com arredondamento para cima", () =>
    expect(applyDamage({ superficial: 0, aggravated: 0 }, 5, 3)).toEqual({
      superficial: 2,
      aggravated: 0,
    }));
  it("gastos não são divididos", () =>
    expect(
      applyDamage({ superficial: 0, aggravated: 0 }, 5, 3, false, false)
        .superficial,
    ).toBe(3));
  it("excesso converte superficial em agravado sem exceder a trilha", () =>
    expect(applyDamage({ superficial: 4, aggravated: 1 }, 5, 6)).toEqual({
      superficial: 1,
      aggravated: 4,
    }));
  it("agravado preenche espaços vazios e converte superficial", () =>
    expect(applyDamage({ superficial: 2, aggravated: 1 }, 5, 4, true)).toEqual({
      superficial: 0,
      aggravated: 5,
    }));
  it("máximos seguem os Atributos e efeitos passivos adquiridos", () => {
    const c = char();
    c.attributes.vigor = 3;
    c.attributes.autocontrole = 2;
    c.attributes.determinacao = 3;
    expect(derived(c, catalog).healthMax).toBe(6);
    expect(derived(c, catalog).willpowerMax).toBe(5);
    c.disciplines["discipline-fortitude"] = 2;
    c.powers = ["power-fortitude-resiliencia"];
    expect(derived(c, catalog).healthMax).toBe(8);
  });
  it("penalidade de comprometimento afeta a categoria apropriada", () => {
    const c = char();
    c.attributes.forca = 4;
    c.skills.briga = 3;
    c.health = { superficial: 4, aggravated: 0 };
    expect(pool(c, catalog, { attribute: "forca", skill: "briga" })).toBe(5);
    expect(pool(c, catalog, { attribute: "carisma", skill: "persuasao" })).toBe(
      1,
    );
  });
});
describe("Humanidade, Máculas, alimentação — Básico PDF 188–189, 218–220", () => {
  it("Remorso usa as caixas livres e exclui Fome", () => {
    const c = char();
    c.humanity = 6;
    c.stains = 2;
    c.hunger = 5;
    const r = remorse(c, () => 6);
    expect(r.result.normal).toHaveLength(2);
    expect(r.result.hunger).toHaveLength(0);
    expect(r.character.humanity).toBe(6);
    expect(r.character.stains).toBe(0);
  });
  it("falha em Remorso remove uma Humanidade e limpa Máculas", () => {
    const c = char();
    c.stains = 2;
    expect(remorse(c, () => 1).character.humanity).toBe(6);
  });
  it("Remorso tem mínimo de um dado", () => {
    const c = char();
    c.humanity = 7;
    c.stains = 6;
    expect(remorse(c, () => 1).result.normal).toHaveLength(1);
  });
  it("excesso de Máculas só aplica novo dano agravado uma vez", () => {
    let c = char();
    c = addStains(c, 4, catalog);
    expect(c.willpower.aggravated).toBe(1);
    c = addStains(c, 1, catalog);
    expect(c.willpower.aggravated).toBe(2);
  });
  it("alimentação sem matar preserva a Fome mínima", () => {
    const c = char();
    c.hunger = 4;
    expect(feed(c, { source: "human", amount: 5 })).toBe(1);
    expect(feed(c, { source: "human", amount: 5, killed: true })).toBe(0);
  });
  it("Potência 2 exige o dobro de sangue animal; 3 impede saciedade", () => {
    const c = char();
    c.hunger = 4;
    c.bloodPotency = 2;
    expect(feed(c, { source: "animal", amount: 2 })).toBe(3);
    c.bloodPotency = 3;
    expect(feed(c, { source: "animal", amount: 5 })).toBe(4);
  });
  it("sangue processado exige a Qualidade", () => {
    const c = char();
    expect(() =>
      feed(c, { source: "bag", amount: 1, processed: true }),
    ).toThrow();
    expect(
      feed(c, { source: "bag", amount: 1, processed: true, iron: true }),
    ).toBe(1);
  });
});
describe("Conteúdo personalizado e Disciplinas", () => {
  it("modificador condicional soma dados ao teste apropriado", () => {
    const c = char();
    c.attributes.forca = 3;
    c.skills.briga = 2;
    c.hunger = 3;
    const v = custom({
      effects: [
        {
          kind: "dice",
          target: "briga",
          value: -2,
          when: { field: "hunger", operator: "gte", value: 3 },
          duration: "permanent",
        },
      ],
    });
    c.advantages = [{ contentId: v.id, level: 1, source: "manual", notes: "" }];
    expect(pool(c, [v], { attribute: "forca", skill: "briga" })).toBe(3);
    c.hunger = 2;
    expect(pool(c, [v], { attribute: "forca", skill: "briga" })).toBe(5);
  });
  it("efeito de Atributo sincroniza a Vitalidade sem alterar a definição", () => {
    const c = char();
    const v = custom({
      effects: [
        { kind: "attribute", target: "vigor", value: 2, duration: "permanent" },
      ],
    });
    c.advantages = [{ contentId: v.id, level: 1, source: "manual", notes: "" }];
    expect(derived(c, [v]).healthMax).toBe(6);
    expect(c.attributes.vigor).toBe(1);
  });
  it("não executa operações arbitrárias", () =>
    expect(
      contentSchema.safeParse({
        name: "Inseguro",
        kind: "power",
        effects: [{ kind: "eval", code: "process.exit()" }],
      }).success,
    ).toBe(false));
  it("pré-requisitos de amálgama são verificados", () => {
    const c = char(),
      p = custom({
        kind: "power",
        requirements: [
          { kind: "discipline", target: "discipline-auspicios", level: 2 },
        ],
      });
    expect(requirementsMet(p, c)).toBe(false);
    c.disciplines["discipline-auspicios"] = 2;
    expect(requirementsMet(p, c)).toBe(true);
  });
});
function validCreation() {
  const c = char();
  c.name = "Teste de criação";
  c.clanId = "clan-brujah";
  attributes.forEach(
    (k, i) => (c.attributes[k] = [4, 3, 3, 3, 2, 2, 2, 2, 1][i]),
  );
  skills.forEach(
    (k, i) => (c.skills[k] = i < 3 ? 3 : i < 8 ? 2 : i < 15 ? 1 : 0),
  );
  c.disciplines = { "discipline-celeridade": 2, "discipline-potencia": 1 };
  c.powers = [
    "power-celeridade-elegancia-de-gato",
    "power-celeridade-reflexos-rapidos",
    "power-potencia-corpo-letal",
  ];
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
  c.convictions = [
    { conviction: "Não abandone amigos", pillar: "Uma amiga mortal" },
  ];
  c.specialties = {
    briga: ["Agarrar"],
    oficios: ["Marcenaria"],
    performance: ["Canto"],
  };
  return c;
}
describe("Criação — Básico PDF 130–131; Companion PDF 66", () => {
  it("valida distribuições e integração de Clã/Disciplina", () =>
    expect(validateCreation(validCreation(), catalog)).toEqual([]));
  it("rejeita uma distribuição ilegal de Atributos", () => {
    const c = validCreation();
    c.attributes.forca = 5;
    expect(
      validateCreation(c, catalog).some((p) => p.startsWith("Atributos")),
    ).toBe(true);
  });
  it("rejeita uma distribuição ilegal de Perícias", () => {
    const c = validCreation();
    c.skills.briga = 5;
    expect(
      validateCreation(c, catalog).some((p) =>
        p.includes("distribuição de Perícias"),
      ),
    ).toBe(true);
  });
  it("rejeita Disciplina inicial fora do Clã", () => {
    const c = validCreation();
    c.disciplines = { "discipline-fortitude": 2, "discipline-potencia": 1 };
    expect(
      validateCreation(c, catalog).some((p) => p.includes("fora do Clã")),
    ).toBe(true);
  });
  it("Clã personalizado participa da validação imediatamente", () => {
    const c = validCreation();
    const v = custom({
      id: "nocturnos",
      kind: "clan",
      disciplines: ["discipline-celeridade", "discipline-potencia"],
    });
    c.clanId = v.id;
    expect(validateCreation(c, [...catalog, v])).toEqual([]);
  });
  it("finalização aplica concessões do Predador sem alterar o catálogo", () => {
    const c = validCreation();
    c.predatorId = "predator-gato-de-rua";
    c.creation.predatorDiscipline = "discipline-potencia";
    c.creation.predatorSpecialty = "briga:Agarrar";
    expect(validateCreation(c, catalog)).toEqual([]);
    const out = finishCreation(c, catalog);
    expect(out.humanity).toBe(6);
    expect(out.disciplines["discipline-potencia"]).toBe(2);
    expect(out.advantages.filter((a) => a.source === "predator")).toHaveLength(
      1,
    );
    expect(c.disciplines["discipline-potencia"]).toBe(1);
  });
});
describe("Experiência e conflito — Básico PDF 101–105, 131", () => {
  it("custos usam o novo nível", () => {
    const c = char();
    expect(xpCost(c, catalog, "attribute", "forca")).toBe(10);
    expect(xpCost(c, catalog, "skill", "briga")).toBe(3);
  });
  it("distingue Clã, fora de Clã e Caitiff", () => {
    const c = char();
    c.clanId = "clan-brujah";
    expect(xpCost(c, catalog, "discipline", "discipline-potencia")).toBe(5);
    expect(xpCost(c, catalog, "discipline", "discipline-auspicios")).toBe(7);
    c.clanId = "clan-caitiff";
    expect(xpCost(c, catalog, "discipline", "discipline-potencia")).toBe(6);
  });
  it("progressão debita experiência e modifica a ficha", () => {
    const c = char();
    c.xpTotal = 10;
    const r = advance(c, catalog, "attribute", "forca");
    expect(r.character.attributes.forca).toBe(2);
    expect(r.character.xpSpent).toBe(10);
    expect(c.attributes.forca).toBe(1);
  });
  it("experiência insuficiente não muda a ficha", () => {
    const c = char();
    expect(() => advance(c, catalog, "attribute", "forca")).toThrow();
    expect(c.xpSpent).toBe(0);
  });
  it("Disciplina exige Poder e a Ressonância adequada", () => {
    const c = char();
    c.clanId = "clan-brujah";
    c.xpTotal = 10;
    expect(() =>
      advance(
        c,
        catalog,
        "discipline",
        "discipline-potencia",
        "",
        "power-potencia-corpo-letal",
        false,
      ),
    ).toThrow();
    const r = advance(
      c,
      catalog,
      "discipline",
      "discipline-potencia",
      "",
      "power-potencia-corpo-letal",
      true,
    );
    expect(r.character.powers).toContain("power-potencia-corpo-letal");
  });
  it("empate bilateral causa margem 1 para ambos", () => {
    const a = evaluate([6], [], 0);
    expect(conflict(a, a, false, 2, 3)).toEqual({ toB: 3, toA: 4, margin: 0 });
    expect(conflict(a, a, true).toA).toBe(0);
  });
});
describe("Restrições e concessões de Clã", () => {
  it("Caitiff recebe Suspeito ao concluir, sem alterar as definições", () => {
    const c = validCreation();
    c.clanId = "clan-caitiff";
    const result = finishCreation(c, catalog);
    expect(
      result.advantages.some(
        (a) => a.contentId === "flaw-suspeito" && a.source === "clan",
      ),
    ).toBe(true);
    expect(c.advantages.some((a) => a.contentId === "flaw-suspeito")).toBe(
      false,
    );
  });
  it("Repulsivo não duplica a Perdição Nosferatu", () => {
    const c = char();
    c.clanId = "clan-nosferatu";
    c.attributes.carisma = 4;
    c.skills.persuasao = 3;
    c.advantages = [
      { contentId: "flaw-repulsivo", level: 2, source: "manual", notes: "" },
    ];
    expect(
      pool(c, catalog, {
        attribute: "carisma",
        skill: "persuasao",
        tags: ["testeAparencia"],
      }),
    ).toBe(5);
  });
  it("Analfabeto impede uma criação com Ciência acima de 1", () => {
    const c = validCreation();
    c.skills.ciencia = 2;
    c.advantages.push({
      contentId: "flaw-analfabeto",
      level: 2,
      source: "creation",
      notes: "",
    });
    expect(validateCreation(c, catalog)).toContain(
      "Analfabeto limita Erudição e Ciência a 1.",
    );
  });
});
