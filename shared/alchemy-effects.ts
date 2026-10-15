import { AlchemyActivation, Character } from "./model";

// Básico PDF 276–277. Separado do motor para evitar ciclos com combate.
export const FOG = "formula-alquimia-sangue-ralo-nevoa";
export const FOG_CONDITION = "Névoa alquímica";
export function concentrating(c: Character) {
  return c.alchemy.preparations.some(
    (p) => p.method === "athanor" && p.remainingTurns > 0,
  );
}
export function fogPenalty(target: Character) {
  // Nuvens simultâneas não multiplicam a mesma obstrução.
  return Math.max(
    0,
    ...target.activeEffects
      .filter(
        (e) =>
          e.effect.kind === "condition" && e.effect.target === FOG_CONDITION,
      )
      .map((e) => Math.max(0, -e.effect.value)),
  );
}
export function tickConcentration(
  c: Character,
  scope: "turn" | "scene" | "night",
) {
  const out = structuredClone(c);
  // Trocar a cena/noite não comprova turnos de concentração ininterrupta.
  if (scope === "turn")
    for (const p of out.alchemy.preparations)
      if (p.method === "athanor")
        p.remainingTurns = Math.max(0, p.remainingTurns - 1);
  return out;
}

export const LONG_REACH = "formula-alquimia-sangue-ralo-longo-alcance";
export const REACH_CONDITION = "Longo Alcance ativo";
export const FLOAT_CONDITION = "Suspenso por Longo Alcance";
export function endAlchemyEffects(
  c: Character,
  activationId: string,
  aspect = "",
) {
  const out = structuredClone(c),
    prefix = `alchemy:${activationId}:${aspect ? aspect + ":" : ""}`;
  const removed = out.activeEffects.filter((e) =>
    e.effectKey.startsWith(prefix),
  );
  out.activeEffects = out.activeEffects.filter(
    (e) => !e.effectKey.startsWith(prefix),
  );
  out.conditions = out.conditions.filter(
    (name) =>
      !removed.some(
        (e) => e.effect.kind === "condition" && e.effect.target === name,
      ) ||
      out.activeEffects.some(
        (e) => e.effect.kind === "condition" && e.effect.target === name,
      ),
  );
  return out;
}
export function closeFormulaTests(a: AlchemyActivation) {
  for (const t of a.formulaTests)
    if (t.status === "pending") {
      t.status = "cancelled";
      t.actorReview.state = "closed";
      t.oppositionReview.state = "closed";
    }
}
// O sucesso em sustentar preserva o Poder na transição para o turno seguinte.
// A nova manutenção deve ser resolvida nesse turno antes do próximo avanço.
export function sustainedAlchemy(
  characters: Character[],
  turn: (c: Character) => string,
) {
  return new Set(
    characters.flatMap((c) =>
      c.alchemy.activations
        .filter(
          (a) =>
            a.formulaId === LONG_REACH &&
            a.status === "active" &&
            a.longReach.sustaining &&
            a.longReach.lastHeldTurn === turn(c),
        )
        .map((a) => a.id),
    ),
  );
}
export function preserveSustainedAlchemy(c: Character, ids: Set<string>) {
  const out = structuredClone(c);
  for (const e of out.activeEffects)
    if (
      e.effect.duration === "turn" &&
      [...ids].some((key) => e.effectKey.startsWith(`alchemy:${key}:`))
    )
      e.remaining++;
  return out;
}

// Envolver: Básico PDF 277–278. A condição de inconsciência não tem
// recuperação definida na entrada; permanece narrativa até decisão do Narrador.
export const ENVELOP = "formula-alquimia-sangue-ralo-envolver";
export const ENVELOP_READY = "Envolver ativo";
export const ENVELOP_CONDITION = "Envolto em névoa alquímica";
export const SUFFOCATING = "Sufocando por Envolver";
export const UNCONSCIOUS_ENVELOP = "Inconsciente após Envolver";
export function envelopPenalty(
  c: Character,
  ctx: { skill?: string; tags?: string[]; targetContext?: string } = {},
) {
  const visual =
    ctx.skill === "armasFogo" ||
    ["identify", "ranged", "visual"].includes(ctx.targetContext ?? "") ||
    ctx.tags?.some((t) =>
      ["visao", "deteccaoVisual", "ataqueDistancia"].includes(t),
    );
  if (!visual) return 0;
  return Math.max(
    0,
    ...c.activeEffects
      .filter(
        (e) =>
          e.sourceId === ENVELOP &&
          e.effect.kind === "condition" &&
          e.effect.target === ENVELOP_CONDITION,
      )
      .map((e) => Math.max(0, -e.effect.value)),
  );
}
export function envelopActionBlocked(c: Character) {
  return (
    c.nature === "mortal" &&
    (c.conditions.includes(UNCONSCIOUS_ENVELOP) ||
      c.activeEffects.some(
        (e) =>
          e.sourceId === ENVELOP &&
          e.effect.kind === "condition" &&
          e.effect.target === SUFFOCATING,
      ))
  );
}

// Impulso Suspenso no Ar — Básico PDF 279–280; sem mapa ou dano de queda presumido.
export const FLIGHT = "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar";
export const FLIGHT_READY = "Impulso Suspenso no Ar ativo";
export const AIRBORNE = "Em voo alquímico";
export const FLIGHT_PASSENGER = "Transportado em voo alquímico";
export function flightSpeed(a: AlchemyActivation) {
  return !a.flight.airborne
    ? "No chão"
    : a.flight.load
      ? "Caminhada"
      : "Corrida aproximada";
}
