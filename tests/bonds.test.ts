import { describe, it, expect } from "vitest";
import {
  characterSchema,
  emptyCharacter,
  contentSchema,
  Character,
  Content,
  campaignSchema,
} from "../shared/model";
import {
  addDays,
  addMonths,
  requireStoryDate,
  drinkForBond,
  decayBloodBond,
  defyBloodBond,
  settleBondReleases,
  bondTraits,
} from "../shared/bonds";
import { advance } from "../shared/rules";
import { blushOfLife } from "../shared/blood-mechanics";
import { seedCatalog } from "../server/seed";
const catalog = seedCatalog();
const char = (id = "servo"): Character => ({
  ...characterSchema.parse(emptyCharacter()),
  id,
  version: 1,
});
const trait = (c: Character, id: string, level = 1) => {
  c.advantages.push({ contentId: id, level, source: "manual", notes: "" });
  return c;
};
const drink = (c: Character, donor = char("reinante"), date = "2026-01-01") =>
  drinkForBond(c, donor, catalog, date, "laco").character;
const formed = () =>
  drink(drink(drink(char()), undefined, "2026-01-02"), undefined, "2026-01-03");
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 8;
};
describe("Laço de Sangue — Básico PDF 101,157,212–213", () => {
  it("usa calendário válido da ficção, anos bissextos e aniversários mensais", () => {
    expect(() => requireStoryDate("2026-02-30")).toThrow();
    expect(() => requireStoryDate("")).toThrow();
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
  });
  it("exige três noites distintas; bebidas repetidas reforçam a Força sem adicionar noites", () => {
    let c = drink(char());
    c = drink(c);
    expect(c.bloodBonds[0].formationNights).toHaveLength(1);
    expect(c.bloodBonds[0].strength).toBe(2);
    expect(c.bloodBonds[0].formed).toBe(false);
    c = drink(c, undefined, "2026-01-02");
    c = drink(c, undefined, "2026-01-03");
    expect(c.bloodBonds[0].formed).toBe(true);
    for (let i = 0; i < 8; i++) c = drink(c, undefined, "2026-01-03");
    expect(c.bloodBonds[0].strength).toBe(6);
  });
  it("intervalo superior a um ano reinicia as noites de formação e rejeita retroatividade", () => {
    let c = drink(char());
    c = drink(c, undefined, "2027-01-01");
    expect(c.bloodBonds[0].formationNights).toHaveLength(2);
    c = drink(c, undefined, "2028-01-02");
    expect(c.bloodBonds[0].formationNights).toEqual(["2028-01-02"]);
    expect(c.bloodBonds[0].formed).toBe(false);
    expect(() => drink(c, undefined, "2027-01-01")).toThrow("anterior");
  });
  it("Escravo de Laço forma no primeiro gole; Inlaçável impede o vínculo", () => {
    expect(
      drink(trait(char(), "flaw-escravo-de-laco", 2)).bloodBonds[0].formed,
    ).toBe(true);
    expect(drink(trait(char(), "merit-inlacavel", 3)).bloodBonds).toHaveLength(
      0,
    );
  });
  it("um servo com reinante é imune a outro, mas pode reforçar o mesmo", () => {
    const c = formed();
    expect(drink(c, char("outro"), "2026-01-04").bloodBonds).toHaveLength(1);
    expect(drink(c, undefined, "2026-01-04").bloodBonds[0].strength).toBe(4);
  });
  it("Tremere não enlaça vampiros; Sangue Concatenado permite ao Sangue-Ralo", () => {
    const d = char("reinante");
    d.clanId = "clan-tremere";
    expect(drink(char(), d).bloodBonds).toHaveLength(0);
    d.clanId = "clan-sangue-ralo";
    d.generation = 14;
    d.bloodPotency = 0;
    expect(drink(char(), d).bloodBonds).toHaveLength(0);
    trait(d, "merit-sangue-concatenado");
    expect(drink(char(), d).bloodBonds).toHaveLength(1);
  });
  it("decadência normal usa meses completos, não repete e quebra apenas em Força zero", () => {
    const c = formed();
    expect(() => decayBloodBond(c, catalog, "laco", "2026-02-02")).toThrow(
      "período",
    );
    let r = decayBloodBond(c, catalog, "laco", "2026-02-03");
    expect(r.strength).toBe(2);
    expect(r.broken).toBe(false);
    expect(() =>
      decayBloodBond(r.character, catalog, "laco", "2026-02-03"),
    ).toThrow("período");
    r = decayBloodBond(r.character, catalog, "laco", "2026-04-03");
    expect(r.reduction).toBe(2);
    expect(r.broken).toBe(true);
  });
  it("um novo reforço reinicia o relógio de decadência", () => {
    let c = decayBloodBond(formed(), catalog, "laco", "2026-02-03").character;
    c = drink(c, undefined, "2026-02-10");
    expect(() => decayBloodBond(c, catalog, "laco", "2026-03-09")).toThrow(
      "período",
    );
    expect(decayBloodBond(c, catalog, "laco", "2026-03-10").reduction).toBe(1);
  });
  it("Laço Longo decai por três meses; Curto usa eventos de lua confirmados", () => {
    const c = trait(formed(), "flaw-laco-longo");
    expect(() => decayBloodBond(c, catalog, "laco", "2026-04-02")).toThrow(
      "período",
    );
    expect(decayBloodBond(c, catalog, "laco", "2026-04-03").strength).toBe(2);
    const short = trait(formed(), "merit-laco-curto", 2);
    expect(() => decayBloodBond(short, catalog, "laco", "2026-01-17")).toThrow(
      "lua",
    );
    const r = decayBloodBond(short, catalog, "laco", "2026-01-17", "full");
    expect(r.strength).toBe(2);
    expect(() =>
      decayBloodBond(r.character, catalog, "laco", "2026-01-17", "new"),
    ).toThrow("já foi registrada");
  });
  it("combinações sem procedimento documental não inventam uma velocidade de decadência", () => {
    const c = trait(trait(formed(), "flaw-laco-longo"), "merit-laco-curto", 2);
    expect(bondTraits(c, catalog).decay).toBe("manual");
    expect(() =>
      decayBloodBond(c, catalog, "laco", "2027-01-01", "full"),
    ).toThrow("conflitantes");
  });
  it("desafio usa parada oposta sem Fome, resistência por ponto e Fome do servo", () => {
    const c = trait(
      trait(formed(), "merit-resistencia-ao-laco", 2),
      "flaw-viciado-em-laco",
    );
    c.hunger = 2;
    const r = defyBloodBond(
      c,
      catalog,
      "laco",
      { date: "2026-01-03", present: false },
      sequence(6, 6, 1, 6, 6, 2),
    );
    expect(r.opposition.normal).toHaveLength(3);
    expect(r.opposition.hunger).toHaveLength(0);
    expect(r.result.normal.length + r.result.hunger.length).toBe(3);
    expect(r.result.hunger).toHaveLength(2);
    expect(r.result.difficulty).toBe(r.opposition.successes);
    expect(r.result.win).toBe(true);
    expect(r.character.bloodBonds[0].formed).toBe(true);
  });
  it("limita o desafio à cena/turno ou sessão e permite nova lembrança autorizada", () => {
    const c = formed();
    const r = defyBloodBond(
      c,
      catalog,
      "laco",
      { date: "2026-01-03", present: false },
      () => 8,
    );
    expect(() =>
      defyBloodBond(r.character, catalog, "laco", {
        date: "2026-01-03",
        present: false,
      }),
    ).toThrow("já foi realizado");
    const a = defyBloodBond(
      c,
      catalog,
      "laco",
      { date: "2026-01-03", present: false, sessionId: "sessao" },
      () => 8,
    );
    expect(() =>
      defyBloodBond(a.character, catalog, "laco", {
        date: "2026-01-03",
        present: false,
        sessionId: "sessao",
      }),
    ).toThrow();
    expect(
      defyBloodBond(
        a.character,
        catalog,
        "laco",
        {
          date: "2026-01-03",
          present: false,
          sessionId: "sessao",
          reminder: true,
        },
        () => 8,
      ).character.bloodBonds[0].lastAvoidanceSession,
    ).toBe("sessao");
  });
  it("encerra o Laço excedente no prazo de uma semana, preservando o registro", () => {
    const c = formed();
    c.bloodBonds[0].releaseOn = "2026-01-10";
    expect(settleBondReleases(c, "2026-01-09").bloodBonds[0].formed).toBe(true);
    const out = settleBondReleases(c, "2026-01-10");
    expect(out.bloodBonds[0].strength).toBe(0);
    expect(out.bloodBonds).toHaveLength(1);
  });
  it("um Laço encerrado pode se formar de novo sem herdar a data antiga de término", () => {
    let c = formed();
    c.bloodBonds[0].releaseOn = "2026-01-10";
    c = settleBondReleases(c, "2026-01-10");
    c = drink(c, undefined, "2026-01-11");
    c = drink(c, undefined, "2026-01-12");
    c = drink(c, undefined, "2026-01-13");
    expect(c.bloodBonds[0].releaseOn).toBe("");
    expect(settleBondReleases(c, "2026-01-14").bloodBonds[0].formed).toBe(true);
  });
  it("regra personalizada participa do vínculo e da resistência sem código", () => {
    const entry: Content = {
      ...contentSchema.parse({
        name: "Vontade Livre",
        kind: "merit",
        bondRule: { resistance: 2, perLevel: true, instant: true },
      }),
      id: "custom",
    };
    const c = trait(char(), entry.id, 2),
      d = char("doador");
    const r = drinkForBond(c, d, [...catalog, entry], "2026-01-01", "laco");
    expect(r.formed).toBe(true);
    expect(bondTraits(c, [...catalog, entry]).resistance).toBe(4);
  });
  it("compra uma Qualidade fixa de três pontos por nove XP, sem concedê-la por um ponto", () => {
    const c = char();
    c.xpTotal = 9;
    const r = advance(c, catalog, "advantage", "merit-inlacavel");
    expect(r.cost).toBe(9);
    expect(r.character.advantages[0].level).toBe(3);
    c.xpTotal = 8;
    expect(() => advance(c, catalog, "advantage", "merit-inlacavel")).toThrow(
      "Experiência insuficiente",
    );
  });
  it("Sangue-Ralo possui Brilho natural sem teste de Despertar — PDF 90", () => {
    const c = char();
    c.generation = 14;
    c.bloodPotency = 0;
    c.hunger = 5;
    const r = blushOfLife(c, undefined, () => 1);
    expect(r.result.dice).toHaveLength(0);
    expect(r.character.hunger).toBe(5);
  });
});
