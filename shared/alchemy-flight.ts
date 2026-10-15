import type { AlchemyAction, AlchemyOperationResult } from "./alchemy";
import {
  AlchemyFormulaTest,
  Campaign,
  Character,
  Content,
  characterSchema,
  effectSchema,
} from "./model";
import {
  applyDamage,
  check,
  derived,
  evaluate,
  pool,
  reroll,
  roll,
} from "./rules";
import { turnKey } from "./blood-mechanics";
import { ALCHEMY } from "./thin-blood";
import {
  AIRBORNE,
  FLIGHT,
  FLIGHT_PASSENGER,
  FLIGHT_READY,
  concentrating,
  endAlchemyEffects,
  envelopActionBlocked,
} from "./alchemy-effects";

export const flightModes = {
  fly: "Voar ou pairar",
  carry: "Carregar carga ou passageiro sem resistência",
  capture: "Levar pessoa que resiste",
  ground: "Oponente tenta puxar o voador ao chão",
  land: "Pousar e descarregar",
};
export type FlightMode = keyof typeof flightModes;
const clean = (c: Character): Character => ({
  ...characterSchema.parse(c),
  id: c.id,
  version: c.version,
});
const dice = (r: ReturnType<typeof evaluate>) => ({
  normal: r.normal,
  hunger: r.hunger,
});
export function flightOperation(
  c: Character,
  catalog: Content[],
  data: AlchemyAction,
  context: {
    gm: boolean;
    campaign?: Campaign;
    characters: Character[];
    id: () => string;
  },
  rng: () => number,
): AlchemyOperationResult {
  let out = structuredClone(c);
  const a = structuredClone(
    c.alchemy.activations.find((a) => a.id === data.activationId),
  );
  check(
    a?.formulaId === FLIGHT && a.status === "active",
    "Impulso Suspenso no Ar precisa estar ativo e com a destilação resolvida.",
  );
  if (!a) throw new Error("Ativação ausente.");
  check(
    !concentrating(c) &&
      !envelopActionBlocked(c) &&
      !c.conditions.some((x) =>
        [
          "Torpor",
          "Morte Final",
          "Incapacitado: coma ou morte",
          "Estacado",
        ].includes(x),
      ),
    "Concentração exclusiva ou incapacidade impede utilizar o voo.",
  );
  check(
    c.health.aggravated < derived(c, catalog).healthMax,
    "A Vitalidade esgotada impede utilizar o voo.",
  );
  const updates = new Map<string, Character>(),
    currentTurn = turnKey(c, context.campaign);
  const read = (key: string) =>
    key === c.id
      ? out
      : (updates.get(key) ?? context.characters.find((x) => x.id === key));
  const write = (target: Character) => {
    if (target.id === c.id) out = target;
    else updates.set(target.id, target);
  };
  let t: AlchemyFormulaTest | undefined,
    willpowerSpent = 0;
  if (data.operation === "formulaTest") {
    check(
      data.mode in flightModes,
      "Escolha um uso de Impulso Suspenso no Ar.",
    );
    const mode = data.mode as FlightMode;
    check(
      data.sceneConfirmed,
      "Confirme espaço, contato e circunstâncias de voo na cena.",
    );
    check(
      !a.formulaTests.some(
        (t) => t.status === "pending" || t.turn === currentTurn,
      ),
      "Resolva o uso aberto ou avance o turno antes de outro uso desta ativação.",
    );
    check(
      a.formulaTests.length < 1000,
      "Limite de usos desta ativação alcançado.",
    );
    const target = data.targetId ? read(data.targetId) : undefined;
    if (data.targetId)
      check(
        target && target.id !== c.id && target.campaignId === c.campaignId,
        "Escolha outro participante da mesma campanha.",
      );
    const resisted = ["capture", "ground"].includes(mode);
    check(!resisted || target, "A disputa de voo exige outro participante.");
    check(
      !["fly", "land"].includes(mode) || !data.targetId,
      "Voar e pousar são ações do próprio alquimista.",
    );
    if (["carry", "capture"].includes(mode)) {
      check(
        data.humanMassConfirmed && !a.flight.load,
        "Confirme uma massa de tamanho humano e descarregue a carga anterior antes de outra.",
      );
      check(
        mode !== "carry" || !target || data.consentConfirmed,
        "Confirme que o passageiro não oferece resistência ou selecione a disputa.",
      );
      check(
        !!target || data.object.trim().length >= 3,
        "Descreva a carga transportada.",
      );
      if (target)
        check(
          !target.activeEffects.some(
            (e) =>
              e.sourceId === FLIGHT && e.effect.target === FLIGHT_PASSENGER,
          ),
          "O passageiro já está sendo transportado; resolva o transporte anterior.",
        );
    }
    if (mode === "ground") {
      check(a.flight.airborne, "O alquimista já está no chão.");
      check(
        !envelopActionBlocked(target!) &&
          !target!.conditions.some((x) =>
            [
              "Torpor",
              "Morte Final",
              "Incapacitado: coma ou morte",
              "Estacado",
            ].includes(x),
          ),
        "O oponente não pode iniciar a tentativa de puxar ao chão enquanto incapacitado.",
      );
    }
    const source = {
      ...out,
      disciplines: {
        ...out.disciplines,
        [ALCHEMY]: a.alchemyLevel || out.disciplines[ALCHEMY],
      },
    };
    const actor = resisted
      ? dice(
          roll(
            pool(
              source,
              catalog,
              {
                attribute: "forca",
                skill: ALCHEMY,
                tags: ["alquimia", "voo", mode, ...a.tags],
              },
              0,
              false,
              context.campaign?.ruleset,
              true,
            ),
            source.hunger,
            0,
            rng,
          ),
        )
      : null;
    const opposition = resisted
      ? dice(
          roll(
            pool(
              target!,
              catalog,
              {
                attribute: "forca",
                skill: "atletismo",
                tags: ["disputaVoo", mode],
              },
              0,
              false,
              context.campaign?.ruleset,
            ),
            target!.hunger,
            0,
            rng,
            target!.nature === "mortal",
          ),
        )
      : null;
    t = {
      id: context.id(),
      mode,
      status: "pending",
      targetId: target?.id ?? "",
      object:
        data.object.trim() ||
        flightModes[mode] + (target ? `: ${target.name}` : ""),
      weightKg: null,
      turn: currentTurn,
      difficulty: 0,
      actor,
      opposition,
      actorReview: {
        state: actor ? "open" : "closed",
        rerolled: false,
        original: null,
      },
      oppositionReview: {
        state: opposition ? "open" : "closed",
        rerolled: false,
        original: null,
      },
      note: data.note,
      outcome: null,
    };
    a.formulaTests.push(t);
  } else {
    t = a.formulaTests.find((t) => t.id === data.testId);
    check(
      t?.status === "pending" && t.turn === currentTurn,
      "Este uso de voo já foi resolvido ou seu turno terminou.",
    );
    if (!t) throw new Error("Uso de voo ausente.");
    if (data.operation === "rerollFormulaTest") {
      const prior = t[data.side],
        review = data.side === "actor" ? t.actorReview : t.oppositionReview;
      check(
        prior && review.state === "open" && !review.rerolled,
        "Esta parada não permite outra rerrolagem.",
      );
      const who = read(data.side === "actor" ? c.id : t.targetId);
      check(
        who && who.willpower.aggravated < derived(who, catalog).willpowerMax,
        "Força de Vontade toda agravada ou participante indisponível.",
      );
      const next = reroll(
        evaluate(prior!.normal, prior!.hunger, 0),
        data.indices,
        rng,
      );
      review.original = structuredClone(prior!);
      review.rerolled = true;
      t[data.side] = dice(next);
      const paid = structuredClone(who!);
      paid.willpower = applyDamage(
        paid.willpower,
        derived(paid, catalog).willpowerMax,
        1,
        false,
        false,
      );
      write(paid);
      willpowerSpent = 1;
    } else {
      check(
        data.operation === "acceptFormulaTest",
        "Operação de voo inválida.",
      );
      if (t.targetId)
        check(
          read(t.targetId)?.campaignId === c.campaignId,
          "Participante da disputa indisponível.",
        );
      const opposition = t.opposition
        ? evaluate(t.opposition.normal, t.opposition.hunger, 0)
        : null;
      const actor = t.actor
        ? evaluate(
            t.actor.normal,
            t.actor.hunger,
            opposition!.successes + (t.mode === "ground" ? 1 : 0),
          )
        : null;
      const margin =
        t.mode === "ground"
          ? opposition!.successes -
            evaluate(t.actor!.normal, t.actor!.hunger, 0).successes
          : (actor?.margin ?? 0);
      const success = t.mode === "ground" ? margin >= 0 : !actor || actor.win;
      let message =
        "O uso foi registrado. Espaço, percurso, altura e obstáculos são resolvidos na cena.";
      if (t.mode === "fly") {
        a.flight.airborne = true;
        message =
          "Voo ou flutuação em qualquer direção, aproximadamente à velocidade de corrida; com carga, caminhada. Não há distância numérica presumida.";
      }
      if (["carry", "capture"].includes(t.mode)) {
        if (success) {
          a.flight = {
            airborne: true,
            passengerId: t.targetId,
            load: t.object,
          };
          message =
            "Carga de tamanho humano transportada em voo; velocidade reduzida à caminhada. A disputa própria não cria um agarramento comum nem penalidades adicionais.";
        } else
          message =
            "O alvo resistiu ao transporte. O voo e a carga anteriores não foram alterados.";
      }
      if (t.mode === "land" || (t.mode === "ground" && success)) {
        a.flight = { airborne: false, passengerId: "", load: "" };
        message =
          t.mode === "ground"
            ? "O oponente puxou o voador ao chão. A capacidade de voo permanece até o fim da cena. Altura, queda, carga e consequências exigem resolução do Narrador; nenhum dano automático."
            : "Alquimista no chão e carga descarregada. Altura, percurso e consequências são confirmados pelo Narrador; a capacidade de voo permanece nesta cena.";
      } else if (t.mode === "ground")
        message =
          "O alquimista resistiu à tentativa de ser puxado ao chão e continua em voo.";
      // Limpa apenas esta ativação e reconstrói seu estado corrente, sem apagar
      // efeitos de outras fontes ou criar regras de queda/posição.
      for (const key of a.targets) {
        const target = read(key);
        if (target) write(endAlchemyEffects(target, a.id));
      }
      const mark = (key: string, condition: string, suffix: string) => {
        const target = structuredClone(read(key)!);
        check(
          target.activeEffects.length < 200,
          "Limite de efeitos ativos alcançado.",
        );
        target.activeEffects.push({
          id: context.id(),
          sourceId: FLIGHT,
          effectKey: `alchemy:${a.id}:${suffix}`,
          label: "Impulso Suspenso no Ar",
          effect: effectSchema.parse({
            kind: "condition",
            target: condition,
            duration: "scene",
          }),
          createdAt: new Date().toISOString(),
          remaining: 1,
        });
        if (!target.conditions.includes(condition))
          target.conditions.push(condition);
        write(target);
      };
      mark(c.id, FLIGHT_READY, "ready");
      if (a.flight.airborne) mark(c.id, AIRBORNE, "airborne");
      if (a.flight.passengerId) {
        check(read(a.flight.passengerId), "Passageiro indisponível.");
        mark(a.flight.passengerId, FLIGHT_PASSENGER, "passenger");
      }
      a.targets = [
        c.id,
        ...(a.flight.passengerId ? [a.flight.passengerId] : []),
      ];
      t.status = "resolved";
      t.actorReview.state = t.oppositionReview.state = "closed";
      const initiator =
        t.mode === "ground"
          ? evaluate(
              t.opposition!.normal,
              t.opposition!.hunger,
              evaluate(t.actor!.normal, t.actor!.hunger, 0).successes,
            )
          : actor;
      if (initiator?.messy)
        message +=
          " Crítico Confuso: o Narrador resolve a consequência da Besta.";
      if (initiator?.bestial)
        message +=
          " Falha Bestial: o Narrador resolve a consequência da Besta.";
      t.outcome = {
        success,
        margin,
        meters: 0,
        rawDamage: 0,
        appliedDamage: 0,
        message,
      };
    }
  }
  out.alchemy.activations = out.alchemy.activations.map((x) =>
    x.id === a.id ? a : x,
  );
  return {
    character: clean(out),
    targets: [...updates.values()].map(clean),
    result: {
      operation: data.operation,
      activationId: a.id,
      status: a.status,
      rouses: [],
      formulaTest: t,
      willpowerSpent,
      review:
        data.operation === "rerollFormulaTest"
          ? data.side === "actor"
            ? t.actorReview
            : t.oppositionReview
          : undefined,
      message:
        t.outcome?.message ??
        (willpowerSpent
          ? "Rerrolagem de voo registrada, com Vontade própria e Dados de Fome preservados."
          : "Uso de voo registrado para revisão; nenhum movimento ou transporte aplicado antes de aceitar."),
    },
  };
}
