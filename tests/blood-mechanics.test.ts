import { describe, it, expect, vi } from "vitest";
import {
  characterSchema,
  emptyCharacter,
  campaignSchema,
} from "../shared/model";
import {
  blushOfLife,
  expireEffects,
  feedFromVampire,
  mendAggravated,
  mendSuperficial,
  nextClock,
  nightKey,
  recoverWillpower,
  turnKey,
  wakeForNight,
} from "../shared/blood-mechanics";
import { seedCatalog } from "../server/seed";
const catalog = seedCatalog();
const character = () => ({
  ...characterSchema.parse(emptyCharacter()),
  id: "vampiro",
  version: 1,
});
const campaign = () => ({
  ...campaignSchema.parse({ name: "Crônica", gmId: "gm" }),
  id: "cronica",
  version: 1,
});
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 8;
};

describe("Recuperação e Despertar — Básico PDF 106, 187, 196–197", () => {
  it("registra o Despertar uma vez por noite e identifica Torpor", () => {
    const c = character();
    c.hunger = 5;
    const r = wakeForNight(c, undefined, () => 1);
    expect(r.character.conditions).toContain("Torpor");
    expect(r.character.lastWakeNight).toBe(nightKey(c));
    expect(() => wakeForNight(r.character)).toThrow("já foi realizado");
    r.character.clock = nextClock(c.clock, "night");
    expect(() => wakeForNight(r.character)).toThrow("Torpor");
  });
  it("cura superficial segue Potência e permite um Despertar por turno", () => {
    const c = character();
    c.bloodPotency = 4;
    c.health.superficial = 4;
    const first = mendSuperficial(c, catalog, undefined, () => 2);
    expect(first.character.health.superficial).toBe(1);
    expect(first.character.hunger).toBe(2);
    expect(() => mendSuperficial(first.character, catalog)).toThrow(
      "neste turno",
    );
    first.character.clock = nextClock(c.clock, "turn");
    expect(
      mendSuperficial(first.character, catalog, undefined, () => 8).character
        .health.superficial,
    ).toBe(0);
  });
  it("não cobra cura sem ferimento nem inicia uma cura voluntária em Fome 5", () => {
    const c = character(),
      rng = vi.fn(() => 8);
    expect(() => mendSuperficial(c, catalog, undefined, rng)).toThrow(
      "Não há dano",
    );
    expect(rng).not.toHaveBeenCalled();
    c.health.superficial = 1;
    c.hunger = 5;
    expect(() => mendSuperficial(c, catalog)).toThrow("Fome 5");
  });
  it("cura agravada aguarda a noite seguinte e exige o Despertar regular", () => {
    const c = character();
    c.health.aggravated = 2;
    expect(() => mendAggravated(c)).toThrow("Despertar noturno");
    c.lastWakeNight = nightKey(c);
    expect(() => mendAggravated(c)).toThrow("próximo cair");
    c.clock = nextClock(c.clock, "night");
    c.aggravatedMendEligible = 2;
    const awake = wakeForNight(c, undefined, () => 8).character;
    const r = mendAggravated(awake, undefined, sequence(2, 8, 2));
    expect(r.result.rouses).toHaveLength(3);
    expect(r.character.health.aggravated).toBe(1);
    expect(r.character.hunger).toBe(3);
    expect(() => mendAggravated(r.character)).toThrow("por noite");
  });
  it("falhas dos três custos em Fome 4 levam ao Torpor, preservando o efeito da cura", () => {
    const c = character();
    c.hunger = 4;
    c.health.aggravated = 2;
    c.aggravatedMendEligible = 2;
    c.lastWakeNight = nightKey(c);
    const r = mendAggravated(c, undefined, () => 1);
    expect(r.result.rouses).toHaveLength(3);
    expect(r.result.torpor).toBe(true);
    expect(r.character.conditions).toContain("Torpor");
    expect(r.character.health.aggravated).toBe(1);
    expect(r.character.hunger).toBe(5);
  });
  it("ferimentos novos não impedem recuperar um ponto elegível de noites anteriores", () => {
    const c = character();
    c.health.aggravated = 3;
    c.aggravatedMendEligible = 1;
    c.lastWakeNight = nightKey(c);
    c.lastAggravatedDamageNight = nightKey(c);
    const r = mendAggravated(c, undefined, () => 8);
    expect(r.character.health.aggravated).toBe(2);
    expect(r.character.aggravatedMendEligible).toBe(0);
  });
  it("Sangues-Ralos curam como vampiros; Fragilidade Mortal impede o Despertar de cura — PDF 90,159", () => {
    const c = character();
    c.generation = 14;
    c.bloodPotency = 0;
    c.health = { superficial: 1, aggravated: 1 };
    expect(
      mendSuperficial(c, catalog, undefined, () => 8).character.health
        .superficial,
    ).toBe(0);
    c.aggravatedMendEligible = 1;
    c.lastWakeNight = nightKey(c);
    expect(
      mendAggravated(c, undefined, () => 8).character.health.aggravated,
    ).toBe(0);
    c.advantages = [
      {
        contentId: "flaw-fragilidade-mortal",
        level: 1,
        source: "manual",
        notes: "",
      },
    ];
    expect(() => mendSuperficial(c, catalog)).toThrow("Fragilidade Mortal");
    expect(() => mendAggravated(c)).toThrow("Fragilidade Mortal");
  });
  it("recupera Força de Vontade por sessão e um agravado quando a Ambição é confirmada", () => {
    const c = character();
    c.attributes.autocontrole = 3;
    c.attributes.determinacao = 3;
    c.willpower = { superficial: 4, aggravated: 2 };
    const r = recoverWillpower(c, catalog, "sessao-1", true);
    expect(r.character.willpower).toEqual({ superficial: 1, aggravated: 1 });
    expect(() => recoverWillpower(r.character, catalog, "sessao-1")).toThrow(
      "já foi aplicada",
    );
    expect(
      recoverWillpower(r.character, catalog, "sessao-2").character.willpower,
    ).toEqual({ superficial: 0, aggravated: 1 });
  });
});
describe("Brilho de Vida — Básico PDF 195, 216", () => {
  it("Humanidade 8 usa dois dados; a falha não cancela o Brilho", () => {
    const c = character();
    c.humanity = 8;
    const r = blushOfLife(c, undefined, sequence(2, 8));
    expect(r.result.dice).toEqual([2, 8]);
    expect(r.character.hunger).toBe(1);
    c.humanity = 7;
    const failed = blushOfLife(c, undefined, () => 2);
    expect(failed.character.hunger).toBe(2);
    expect(failed.character.lastBlushNight).toBe(nightKey(c));
  });
  it("Humanidade 9 permite aparência humana sem Despertar, inclusive em Fome 5", () => {
    const c = character();
    c.humanity = 9;
    c.hunger = 5;
    const rng = vi.fn(() => 1);
    const r = blushOfLife(c, undefined, rng);
    expect(rng).not.toHaveBeenCalled();
    expect(r.character.hunger).toBe(5);
    expect(() => blushOfLife(r.character)).toThrow("já está ativo");
  });
});
describe("Sangue vampírico — Básico PDF 188–189", () => {
  it("mesma Potência sacia um por um e atualiza as duas Fomes", () => {
    const a = character(),
      b = { ...character(), id: "doador" };
    a.hunger = 4;
    b.hunger = 2;
    const r = feedFromVampire(a, b, 2);
    expect(r.reader.hunger).toBe(2);
    expect(r.donor.hunger).toBe(4);
    expect(a.hunger).toBe(4);
  });
  it("doador pelo menos duas Potências superior sacia dois por um", () => {
    const a = character(),
      b = { ...character(), id: "doador" };
    a.hunger = 4;
    b.bloodPotency = 3;
    expect(feedFromVampire(a, b, 1).reader.hunger).toBe(2);
  });
  it("doador duas Potências inferior exige dois por um, sem atingir Fome zero", () => {
    const a = character(),
      b = { ...character(), id: "doador" };
    a.hunger = 4;
    a.bloodPotency = 3;
    expect(feedFromVampire(a, b, 1).reader.hunger).toBe(4);
    expect(feedFromVampire(a, b, 4).reader.hunger).toBe(2);
    a.hunger = 1;
    expect(feedFromVampire(a, b, 4).reader.hunger).toBe(1);
  });
  it("rejeita autodoação, quantidades inválidas e sangue insuficiente", () => {
    const a = character(),
      b = { ...character(), id: "doador", hunger: 4 };
    expect(() => feedFromVampire(a, a, 1)).toThrow("outro vampiro");
    expect(() => feedFromVampire(a, b, 2)).toThrow("suficiente");
    expect(() => feedFromVampire(a, b, 0)).toThrow("1 a 5");
  });
});
describe("Tempo narrativo e durações configuradas", () => {
  it("campanha fornece o marcador comum e cenas/noites reiniciam marcadores menores", () => {
    const c = character(),
      g = campaign();
    g.clock = { night: 2, scene: 3, turn: 4 };
    expect(turnKey(c, g)).toBe("cronica@2.3.4");
    expect(nextClock(g.clock, "scene")).toEqual({
      night: 2,
      scene: 4,
      turn: 1,
    });
    expect(nextClock(g.clock, "night")).toEqual({
      night: 3,
      scene: 1,
      turn: 1,
    });
  });
  it("encerra durações menores e mantém condição enquanto outro efeito a sustenta", () => {
    const c = characterSchema.parse({
      ...emptyCharacter(),
      conditions: ["Oculto", "Dívida"],
      activeEffects: [
        {
          id: "a",
          sourceId: "p",
          label: "Oculto",
          effect: { kind: "condition", target: "Oculto", duration: "turn" },
          createdAt: "",
          remaining: 1,
        },
        {
          id: "b",
          sourceId: "q",
          label: "Oculto",
          effect: { kind: "condition", target: "Oculto", duration: "night" },
          createdAt: "",
          remaining: 2,
        },
        {
          id: "c",
          sourceId: "r",
          label: "Bônus",
          effect: { kind: "dice", target: "all", duration: "scene" },
          createdAt: "",
          remaining: 1,
        },
      ],
    });
    let out = expireEffects({ ...c, id: "vampiro", version: 1 }, "scene");
    expect(out.activeEffects).toHaveLength(1);
    expect(out.conditions).toEqual(["Oculto", "Dívida"]);
    out = expireEffects(out, "night");
    expect(out.activeEffects[0].remaining).toBe(1);
    out = expireEffects(out, "night");
    expect(out.conditions).toEqual(["Dívida"]);
    expect(c.activeEffects).toHaveLength(3);
  });
});
