import { describe, it, expect } from "vitest";
import { characterSchema, contentSchema } from "../shared/model";
import { seedCatalog } from "../server/seed";
import {
  validateCreation,
  finishCreation,
  advance,
  xpCost,
  pool,
} from "../shared/rules";
import {
  ALCHEMY,
  canTestFrenzy,
  effectiveBaneClan,
} from "../shared/thin-blood";
import { bondTraits } from "../shared/bonds";
import { validThinCharacter } from "./fixtures";
const catalog = seedCatalog();
const trait = (contentId: string) => ({
  contentId,
  level: 1,
  source: "creation" as const,
  notes: "",
});
const selected = (merits: string[], flaws: string[]) => {
  const c = validThinCharacter();
  c.advantages = c.advantages.filter(
    (a) =>
      catalog.find((e) => e.id === a.contentId)?.category !== "Sangue-Ralo",
  );
  c.advantages.push(...[...merits, ...flaws].map(trait));
  return c;
};
const affinity = () => {
  const c = selected(
    ["merit-afinidade-de-disciplina"],
    ["flaw-temperamento-bestial"],
  );
  c.thinBlood.affinityDiscipline = "discipline-fortitude";
  c.thinBlood.affinityPower = "power-fortitude-resiliencia";
  return c;
};
const alchemist = () => {
  const c = selected(["merit-alquimia-sangue-ralo"], ["flaw-dentes-de-bebe"]);
  c.thinBlood.alchemyMethod = "fixatio";
  c.thinBlood.initialFormula = "formula-alquimia-sangue-ralo-nevoa";
  return c;
};
describe("Criação de Sangues-Ralos — Básico PDF 90,128,130–131,159–160,275–277", () => {
  it("cataloga as oito Qualidades e oito Defeitos como escolhas sem pontos", () => {
    const entries = catalog.filter((e) => e.category === "Sangue-Ralo");
    expect(entries.filter((e) => e.kind === "merit")).toHaveLength(8);
    expect(entries.filter((e) => e.kind === "flaw")).toHaveLength(8);
    expect(
      entries.every(
        (e) =>
          e.points === 0 &&
          e.minLevel === 1 &&
          e.maxLevel === 1 &&
          e.origin === "official" &&
          e.references.length > 0,
      ),
    ).toBe(true);
  });
  it.each([1, 2, 3])(
    "aceita %i pares independentes dos sete pontos comuns e dois Defeitos",
    (n) => {
      const c = selected(
        [
          "merit-sangue-concatenado",
          "merit-resiliencia-vampirica",
          "merit-realistico",
        ].slice(0, n),
        [
          "flaw-dentes-de-bebe",
          "flaw-temperamento-bestial",
          "flaw-marcado-pela-camarilla",
        ].slice(0, n),
      );
      expect(validateCreation(c, catalog)).toEqual([]);
    },
  );
  it.each([0, 4])("recusa %i pares", (n) => {
    const c = selected(
      [
        "merit-sangue-concatenado",
        "merit-resiliencia-vampirica",
        "merit-realistico",
        "merit-contato-camarilla",
      ].slice(0, n),
      [
        "flaw-dentes-de-bebe",
        "flaw-temperamento-bestial",
        "flaw-marcado-pela-camarilla",
        "flaw-dependencia-de-vitae",
      ].slice(0, n),
    );
    expect(
      validateCreation(c, catalog).some((s) => s.includes("mesmo número")),
    ).toBe(true);
  });
  it("não usa características sem custo para preencher pontos comuns", () => {
    const c = validThinCharacter();
    c.advantages = c.advantages.filter(
      (a) =>
        a.contentId !== "background-refugio" && a.contentId !== "flaw-inimigo",
    );
    const errors = validateCreation(c, catalog);
    expect(errors.some((e) => e.includes("7 pontos"))).toBe(true);
    expect(errors.some((e) => e.includes("2 pontos de Defeitos"))).toBe(true);
  });
  it("restrições iniciais incluem Laço além de Mawla, Lacaios e Status", () => {
    for (const contentId of [
      "merit-inlacavel",
      "background-mawla",
      "background-lacaios",
      "background-status",
    ]) {
      const c = validThinCharacter();
      c.advantages.push(trait(contentId));
      expect(
        validateCreation(c, catalog).some((e) => e.includes("Laço, Mawla")),
      ).toBe(true);
    }
  });
  it("recusa pares desiguais, repetições e níveis acima de uma escolha", () => {
    const c = validThinCharacter();
    c.advantages.push(trait("merit-resiliencia-vampirica"));
    expect(
      validateCreation(c, catalog).some((e) => e.includes("mesmo número")),
    ).toBe(true);
    c.advantages.push(trait("flaw-dentes-de-bebe"));
    expect(validateCreation(c, catalog)).toContain(
      "Não repita uma característica de Sangue-Ralo.",
    );
    c.advantages.at(-1)!.level = 2;
    expect(
      validateCreation(c, catalog).some((e) => e.includes("escolhas únicas")),
    ).toBe(true);
  });
  it.each([
    ["merit-resiliencia-vampirica", "flaw-fragilidade-mortal"],
    ["merit-realistico", "flaw-carne-morta"],
    ["merit-companheiros-anarquistas", "flaw-evitado-pelos-anarquistas"],
  ])("recusa a incompatibilidade %s / %s", (m, f) => {
    expect(validateCreation(selected([m], [f]), catalog)).toContain(
      "Vantagens/Defeitos incompatíveis.",
    );
  });
  it("permite Contato Camarilla com Marcado pela Camarilla", () =>
    expect(
      validateCreation(
        selected(["merit-contato-camarilla"], ["flaw-marcado-pela-camarilla"]),
        catalog,
      ),
    ).toEqual([]));
  it("concede Afinidade e Poder exatamente uma vez ao finalizar", () => {
    const c = affinity();
    expect(validateCreation(c, catalog)).toEqual([]);
    const out = finishCreation(c, catalog);
    expect(out.disciplines["discipline-fortitude"]).toBe(1);
    expect(out.powers).toEqual(["power-fortitude-resiliencia"]);
    expect(c.disciplines).toEqual({});
    expect(c.powers).toEqual([]);
    expect(out.bloodPotency).toBe(0);
    expect(out.humanity).toBe(7);
    expect(out.xpTotal).toBe(0);
  });
  it("Afinidade exige escolhas válidas e não permite um Poder de nível 2", () => {
    const c = affinity();
    c.thinBlood.affinityPower = "power-fortitude-rigidez";
    expect(
      validateCreation(c, catalog).some((e) =>
        e.includes("Afinidade de Disciplina exige"),
      ),
    ).toBe(true);
    c.thinBlood.affinityDiscipline = ALCHEMY;
    c.thinBlood.affinityPower = "";
    expect(
      validateCreation(c, catalog).some((e) =>
        e.includes("Afinidade de Disciplina exige"),
      ),
    ).toBe(true);
  });
  it("integra uma Disciplina e um Poder personalizados na Afinidade", () => {
    const disc = {
      ...contentSchema.parse({
        name: "Disciplina do cenário",
        kind: "discipline",
      }),
      id: "discipline-custom",
    };
    const power = {
      ...contentSchema.parse({
        name: "Poder do cenário",
        kind: "power",
        parentId: disc.id,
        level: 1,
      }),
      id: "power-custom",
    };
    const c = affinity();
    c.thinBlood.affinityDiscipline = disc.id;
    c.thinBlood.affinityPower = power.id;
    const entries = [...catalog, disc, power];
    expect(validateCreation(c, entries)).toEqual([]);
    expect(finishCreation(c, entries).powers).toContain(power.id);
  });
  it.each(["athanor", "calcinatio", "fixatio"] as const)(
    "concede Alquimia 1, método %s e uma fórmula",
    (method) => {
      const c = alchemist();
      c.thinBlood.alchemyMethod = method;
      expect(validateCreation(c, catalog)).toEqual([]);
      const out = finishCreation(c, catalog);
      expect(out.disciplines[ALCHEMY]).toBe(1);
      expect(out.powers).toEqual([c.thinBlood.initialFormula]);
      expect(out.thinBlood.alchemyMethod).toBe(method);
    },
  );
  it("Alquimia exige método e fórmula de nível 1", () => {
    const c = alchemist();
    c.thinBlood.alchemyMethod = "";
    expect(
      validateCreation(c, catalog).some((e) =>
        e.includes("Alquimia inicial exige"),
      ),
    ).toBe(true);
    c.thinBlood.alchemyMethod = "fixatio";
    c.thinBlood.initialFormula = "formula-alquimia-sangue-ralo-envolver";
    expect(
      validateCreation(c, catalog).some((e) =>
        e.includes("Alquimia inicial exige"),
      ),
    ).toBe(true);
  });
  it("escolhas sobrenaturais exigem suas características e não Disciplinas intrínsecas", () => {
    const c = validThinCharacter();
    c.thinBlood.affinityDiscipline = "discipline-fortitude";
    c.disciplines["discipline-fortitude"] = 1;
    const errors = validateCreation(c, catalog);
    expect(errors.some((e) => e.includes("exigem a Qualidade"))).toBe(true);
    expect(errors.some((e) => e.includes("intrínsecas"))).toBe(true);
  });
  it("recusa Predador inicial, Potência positiva e perfil Neófito", () => {
    const c = validThinCharacter();
    c.predatorId = "predator-gato-de-rua";
    c.bloodPotency = 1;
    c.creation.age = "neonate";
    const errors = validateCreation(c, catalog);
    expect(
      errors.some((e) => e.includes("não escolhem Tipo de Predador")),
    ).toBe(true);
    expect(errors.some((e) => e.includes("Potência"))).toBe(true);
    expect(errors.some((e) => e.includes("Neófitos"))).toBe(true);
  });
  it.each(["clan-brujah", "clan-gangrel"])(
    "Perdição %s exige Temperamento Bestial",
    (clan) => {
      const c = selected(
        ["merit-sangue-concatenado"],
        ["flaw-maldicao-de-cla"],
      );
      c.thinBlood.clanCurse = clan;
      expect(
        validateCreation(c, catalog).some((e) =>
          e.includes("Temperamento Bestial"),
        ),
      ).toBe(true);
      c.advantages.push(
        trait("flaw-temperamento-bestial"),
        trait("merit-contato-camarilla"),
      );
      expect(validateCreation(c, catalog)).toEqual([]);
      expect(effectiveBaneClan(c)).toBe(clan);
    },
  );
  it("Perdição Tremere exige Sangue Concatenado e não presume capacidade de enlaçar", () => {
    const c = selected(["merit-realistico"], ["flaw-maldicao-de-cla"]);
    c.thinBlood.clanCurse = "clan-tremere";
    expect(
      validateCreation(c, catalog).some((e) =>
        e.includes("Sangue Concatenado"),
      ),
    ).toBe(true);
    c.advantages[4] = trait("merit-sangue-concatenado");
    expect(validateCreation(c, catalog)).toEqual([]);
    expect(bondTraits(c, catalog)).toMatchObject({
      canBind: false,
      ambiguousBinding: true,
    });
  });
  it("frenesi requer Temperamento Bestial ou provocação sobrenatural", () => {
    const c = validThinCharacter();
    expect(canTestFrenzy(c)).toBe(false);
    expect(canTestFrenzy(c, true)).toBe(true);
    c.advantages.push(trait("flaw-temperamento-bestial"));
    expect(canTestFrenzy(c)).toBe(true);
    c.nature = "mortal";
    expect(canTestFrenzy(c, true)).toBe(false);
  });
  it("Carne Morta penaliza somente o contexto social cara a cara com mortal confirmado", () => {
    const c = selected(["merit-sangue-concatenado"], ["flaw-carne-morta"]);
    const normal = pool(c, catalog, {
      attribute: "carisma",
      skill: "intimidacao",
    });
    expect(
      pool(c, catalog, {
        attribute: "carisma",
        skill: "intimidacao",
        tags: ["caraACaraMortal"],
      }),
    ).toBe(normal - 1);
    expect(
      pool(c, catalog, {
        attribute: "carisma",
        skill: "intimidacao",
        tags: ["alvoMortal"],
      }),
    ).toBe(normal);
  });
  it("normaliza escolhas antigas e rejeita métodos executáveis", () => {
    const old: any = validThinCharacter();
    delete old.thinBlood;
    expect(characterSchema.parse(old).thinBlood.affinityDiscipline).toBe("");
    old.thinBlood = { alchemyMethod: "eval(codigo)" };
    expect(characterSchema.safeParse(old).success).toBe(false);
  });
});
describe("Progressão de Afinidade e Alquimia — Básico PDF 128,160,275", () => {
  it("Afinidade usa custo de fora do Clã e rejeita outra Disciplina", () => {
    const c = finishCreation(affinity(), catalog);
    c.xpTotal = 100;
    expect(xpCost(c, catalog, "discipline", "discipline-fortitude")).toBe(14);
    const r = advance(
      c,
      catalog,
      "discipline",
      "discipline-fortitude",
      "",
      "power-fortitude-mente-inabalavel",
      true,
    );
    expect(r.character.disciplines["discipline-fortitude"]).toBe(2);
    expect(r.cost).toBe(14);
    expect(() =>
      advance(
        c,
        catalog,
        "discipline",
        "discipline-potencia",
        "",
        "power-potencia-corpo-letal",
        true,
        true,
      ),
    ).toThrow("só progride");
  });
  it("cada ponto de Alquimia concede uma fórmula e exige pesquisa", () => {
    const c = finishCreation(alchemist(), catalog);
    c.xpTotal = 100;
    const args = [
      c,
      catalog,
      "discipline",
      ALCHEMY,
      "",
      "formula-alquimia-sangue-ralo-longo-alcance",
      false,
      false,
    ] as const;
    expect(() => advance(...args)).toThrow("pesquisa");
    const r = advance(...args, true);
    expect(r.cost).toBe(14);
    expect(r.character.disciplines[ALCHEMY]).toBe(2);
    expect(r.character.powers).toHaveLength(2);
    expect(c.xpSpent).toBe(0);
    expect(() => advance(...args, true, "calcinatio")).toThrow(
      "Métodos adicionais",
    );
  });
  it("pode aprender Alquimia em jogo sem a Qualidade inicial, com método e fórmula", () => {
    const c = finishCreation(validThinCharacter(), catalog);
    c.xpTotal = 20;
    const r = advance(
      c,
      catalog,
      "discipline",
      ALCHEMY,
      "",
      "formula-alquimia-sangue-ralo-nevoa",
      false,
      false,
      true,
      "athanor",
    );
    expect(r.cost).toBe(7);
    expect(r.character.thinBlood.alchemyMethod).toBe("athanor");
    expect(r.character.powers).toHaveLength(1);
    expect(() =>
      advance(
        c,
        catalog,
        "discipline",
        ALCHEMY,
        "",
        "formula-alquimia-sangue-ralo-nevoa",
        false,
        false,
        true,
      ),
    ).toThrow("método");
  });
  it("fórmula adicional custa três vezes o nível, com pesquisa e sem duplicar", () => {
    const c = finishCreation(alchemist(), catalog);
    c.xpTotal = 20;
    const key = "formula-alquimia-sangue-ralo-longo-alcance";
    expect(() => advance(c, catalog, "formula", key)).toThrow("pesquisa");
    const r = advance(c, catalog, "formula", key, "", "", false, false, true);
    expect(r.cost).toBe(3);
    expect(r.character.powers).toContain(key);
    expect(() =>
      advance(r.character, catalog, "formula", key, "", "", false, false, true),
    ).toThrow("já adquirido");
    expect(() =>
      advance(
        c,
        catalog,
        "formula",
        "formula-alquimia-sangue-ralo-envolver",
        "",
        "",
        false,
        false,
        true,
      ),
    ).toThrow("Nível insuficiente");
  });
});
