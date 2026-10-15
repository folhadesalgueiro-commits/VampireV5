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
import { receiveDamage } from "./combat";
import { turnKey } from "./blood-mechanics";
import { ALCHEMY } from "./thin-blood";
import {
  FLOAT_CONDITION,
  LONG_REACH,
  REACH_CONDITION,
  ENVELOP,
  ENVELOP_CONDITION,
  SUFFOCATING,
  UNCONSCIOUS_ENVELOP,
  envelopActionBlocked,
  concentrating,
  endAlchemyEffects,
} from "./alchemy-effects";

export const longReachModes = {
  move: "Mover objeto sem resistência",
  pull: "Puxar pessoa que resiste",
  throw: "Arremessar pessoa que resiste",
  hold: "Sustentar no ar",
  delicate: "Manipulação delicada",
  knife: "Precisão com faca ou ferramenta",
};
const dice = (r: ReturnType<typeof evaluate>) => ({
  normal: r.normal,
  hunger: r.hunger,
});
const validCharacter = (c: Character): Character => ({
  ...characterSchema.parse(c),
  id: c.id,
  version: c.version,
});
export function formulaOperation(
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
  const updates = new Map<string, Character>();
  const a = structuredClone(
    c.alchemy.activations.find((x) => x.id === data.activationId),
  );
  check(
    a && [LONG_REACH, ENVELOP].includes(a.formulaId) && a.status === "active",
    "A fórmula precisa estar ativa e com a destilação resolvida.",
  );
  if (!a) throw new Error("Ativação ausente.");
  const envelop = a.formulaId === ENVELOP;
  const currentTurn = turnKey(c, context.campaign);
  const read = (key: string) =>
    key === c.id
      ? out
      : (updates.get(key) ?? context.characters.find((x) => x.id === key));
  const write = (x: Character) => {
    if (x.id === c.id) out = x;
    else updates.set(x.id, x);
  };
  const usable = (x: Character) =>
    !x.conditions.some((name) =>
      ["Torpor", "Morte Final", "Incapacitado: coma ou morte"].includes(name),
    );
  check(
    !concentrating(c) && usable(c) && !envelopActionBlocked(c),
    "Concentração exclusiva ou incapacidade impede usar Longo Alcance.",
  );
  let t: AlchemyFormulaTest | undefined;
  let willpowerSpent = 0;
  if (data.operation === "formulaTest") {
    if (envelop) {
      check(
        data.mode === "suffocate",
        "Envolver usa o teste próprio de asfixia; não aceita usos de Longo Alcance.",
      );
      check(
        !a.formulaTests.some(
          (t) => t.status === "pending" || t.turn === currentTurn,
        ),
        "Resolva o teste aberto ou avance o turno antes de outra tentativa de asfixia.",
      );
      check(
        a.formulaTests.length < 1000,
        "Limite de testes desta ativação alcançado.",
      );
      const targetId = a.targets.find((key) => key !== c.id),
        target = targetId ? read(targetId) : undefined;
      check(
        target &&
          target.campaignId === c.campaignId &&
          target.nature === "mortal" &&
          target.id !== c.id,
        "A asfixia de Envolver exige o mesmo alvo mortal da ativação.",
      );
      check(
        target?.activeEffects.some(
          (e) =>
            e.sourceId === ENVELOP &&
            e.effect.target === ENVELOP_CONDITION &&
            e.effectKey.startsWith(`alchemy:${a.id}:`),
        ),
        "O alvo já não está envolto pela névoa desta ativação.",
      );
      check(
        !data.targetId || data.targetId === targetId,
        "Envolver não troca de alvo sem uma nova ativação.",
      );
      check(
        data.sceneConfirmed,
        "Confirme que o alvo de Envolver permanece à vista nesta cena.",
      );
      check(
        target &&
          usable(target) &&
          !target.conditions.includes(UNCONSCIOUS_ENVELOP),
        "O alvo está inconsciente ou incapacitado; resolva suas consequências com o Narrador.",
      );
      const source = {
        ...out,
        disciplines: {
          ...out.disciplines,
          [ALCHEMY]: a.alchemyLevel || out.disciplines[ALCHEMY],
        },
      };
      const actor = dice(
        roll(
          pool(
            source,
            catalog,
            {
              attribute: "raciocinio",
              skill: ALCHEMY,
              tags: ["alquimia", "envolver", ...a.tags],
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
      );
      const opposition = dice(
        roll(
          pool(
            target!,
            catalog,
            {
              attribute: "vigor",
              skill: "sobrevivencia",
              tags: ["resistirEnvolver"],
            },
            0,
            false,
            context.campaign?.ruleset,
          ),
          0,
          0,
          rng,
          true,
        ),
      );
      t = {
        id: context.id(),
        mode: "suffocate",
        status: "pending",
        targetId: targetId!,
        object: "Sufocar mortal com Envolver",
        weightKg: null,
        turn: currentTurn,
        difficulty: 0,
        actor,
        opposition,
        actorReview: { state: "open", rerolled: false, original: null },
        oppositionReview: { state: "open", rerolled: false, original: null },
        note: data.note,
        outcome: null,
      };
      a.formulaTests.push(t);
    } else {
      check(
        data.mode !== "suffocate",
        "Longo Alcance não possui asfixia; use a fórmula Envolver.",
      );
      check(
        a.longReach.lastActionTurn !== currentTurn &&
          !a.formulaTests.some((x) => x.status === "pending"),
        "Resolva o teste aberto ou avance o turno antes de outro uso desta ativação.",
      );
      check(
        a.formulaTests.length < 1000,
        "Limite de registros desta ativação alcançado; encerre o Poder.",
      );
      check(
        data.sceneConfirmed && data.object.trim().length >= 3,
        "Confirme o alvo à vista, com menos de 100 kg, a cerca de 10 metros, e descreva a ação.",
      );
      const target = data.targetId ? read(data.targetId) : undefined;
      if (data.targetId)
        check(
          target && target.campaignId === c.campaignId && target.id !== c.id,
          "Escolha outro personagem da mesma campanha como alvo.",
        );
      const resisted = ["pull", "throw"].includes(data.mode);
      check(
        !resisted || target,
        "Puxar ou arremessar alguém que resiste exige uma ficha de alvo.",
      );
      check(
        !["move", "delicate", "knife"].includes(data.mode) || !target,
        "Use mover para objetos; pessoas que resistem exigem disputa. Sustentar é uma opção própria.",
      );
      const manual = ["delicate", "knife"].includes(data.mode);
      check(
        !manual ||
          (context.gm && !!data.difficulty && data.note.trim().length >= 10),
        "O Narrador deve definir a dificuldade e registrar a interpretação para esta manipulação.",
      );
      const difficulty =
        data.mode === "hold" ? 3 : manual ? data.difficulty! : 0;
      const source = {
        ...out,
        disciplines: {
          ...out.disciplines,
          [ALCHEMY]: a.alchemyLevel || out.disciplines[ALCHEMY],
        },
      };
      const actor =
        data.mode === "move"
          ? null
          : dice(
              roll(
                pool(
                  source,
                  catalog,
                  {
                    attribute:
                      data.mode === "delicate" ? "raciocinio" : "determinacao",
                    skill: ALCHEMY,
                    tags: ["alquimia", "longoAlcance", data.mode, ...a.tags],
                  },
                  data.mode === "knife" ? -2 : 0,
                  false,
                  context.campaign?.ruleset,
                  true,
                ),
                source.hunger,
                difficulty,
                rng,
              ),
            );
      const opposition = resisted
        ? dice(
            roll(
              pool(
                target!,
                catalog,
                {
                  attribute: "forca",
                  skill: "atletismo",
                  tags: ["resistirLongoAlcance", "alquimia"],
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
        mode: data.mode,
        status: "pending",
        targetId: target?.id ?? "",
        object: data.object.trim(),
        weightKg: data.weightKg,
        turn: currentTurn,
        difficulty,
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
      a.longReach.lastActionTurn = currentTurn;
    }
  } else {
    t = a.formulaTests.find((x) => x.id === data.testId);
    check(
      t?.status === "pending" && t.turn === currentTurn,
      "Este teste já foi resolvido ou seu turno terminou.",
    );
    if (!t) throw new Error("Teste ausente.");
    if (data.operation === "rerollFormulaTest") {
      const side = data.side;
      const prior = t[side],
        review = side === "actor" ? t.actorReview : t.oppositionReview;
      check(
        prior && review.state === "open" && !review.rerolled,
        "Esta parada não permite outra rerrolagem.",
      );
      const roller = read(side === "actor" ? c.id : t.targetId);
      check(
        roller && usable(roller),
        "Participante da rolagem não disponível.",
      );
      const d = derived(roller!, catalog);
      check(
        roller!.willpower.aggravated < d.willpowerMax,
        "Força de Vontade toda agravada impede este gasto.",
      );
      // A seleção é validada antes de sortear ou pagar. Nunca inclui Dados de Fome.
      const next = reroll(
        evaluate(prior!.normal, prior!.hunger, 0),
        data.indices,
        rng,
      );
      review.original = structuredClone(prior!);
      review.rerolled = true;
      t[side] = dice(next);
      const paid = structuredClone(roller!);
      paid.willpower = applyDamage(
        paid.willpower,
        d.willpowerMax,
        1,
        false,
        false,
      );
      write(paid);
      willpowerSpent = 1;
    } else {
      check(
        data.operation === "acceptFormulaTest",
        "Operação de teste próprio inválida.",
      );
      const oppositionSuccesses = t.opposition
        ? evaluate(t.opposition.normal, t.opposition.hunger, 0).successes
        : 0;
      const actor = t.actor
        ? evaluate(
            t.actor.normal,
            t.actor.hunger,
            t.opposition ? oppositionSuccesses : t.difficulty,
          )
        : null;
      const margin = actor?.margin ?? 0;
      // Puxar usa a disputa geral (empates favorecem o agente). Arremessar é
      // conflito físico unilateral e exige margem positiva para causar dano.
      const success =
        t.mode === "move" ||
        (!!actor?.win && (t.mode !== "throw" || margin > 0));
      let rawDamage = 0,
        appliedDamage = 0,
        meters = 0;
      let message = success
        ? "A manipulação foi bem-sucedida. Registre a consequência na cena."
        : "A manipulação falhou; resolva as consequências narrativas.";
      if (envelop) {
        const target = read(t.targetId);
        check(
          target?.nature === "mortal" && a.targets.includes(t.targetId),
          "Alvo mortal da asfixia não está disponível.",
        );
        check(
          target?.activeEffects.some(
            (e) =>
              e.sourceId === ENVELOP &&
              e.effect.target === ENVELOP_CONDITION &&
              e.effectKey.startsWith(`alchemy:${a.id}:`),
          ),
          "O alvo já não está envolto pela névoa desta ativação.",
        );
        message = success
          ? "O mortal só pode tossir e sufocar enquanto o efeito o restringe. Nenhum dano periódico foi presumido."
          : "A asfixia não venceu a resistência. A obstrução visual e eventuais consequências anteriores permanecem até sua resolução.";
        if (success) {
          const affected = endAlchemyEffects(target!, a.id, "suffocation");
          check(
            affected.activeEffects.length < 200,
            "Limite de efeitos ativos do alvo alcançado.",
          );
          affected.activeEffects.push({
            id: context.id(),
            sourceId: ENVELOP,
            effectKey: `alchemy:${a.id}:suffocation:stage`,
            label: "Asfixia de Envolver",
            effect: effectSchema.parse({
              kind: "condition",
              target: SUFFOCATING,
              duration: "scene",
              recipient: "target",
            }),
            createdAt: new Date().toISOString(),
            remaining: 1,
          });
          if (!affected.conditions.includes(SUFFOCATING))
            affected.conditions.push(SUFFOCATING);
          if (actor?.critical) {
            if (!affected.conditions.includes(UNCONSCIOUS_ENVELOP))
              affected.conditions.push(UNCONSCIOUS_ENVELOP);
            message =
              "Vitória crítica: o mortal perdeu a consciência. O fim da névoa não presume despertar; o Narrador resolve a recuperação e remove a condição na ficha. Nenhum dano foi aplicado.";
          }
          write(affected);
        }
        if (actor?.messy)
          message +=
            " Crítico Confuso: o Narrador resolve as consequências da Besta.";
        if (actor?.bestial)
          message +=
            " Falha Bestial: o Narrador resolve as consequências da Besta.";
      } else {
        if (t.mode === "move")
          message =
            "Objeto deslocado. O movimento não causa dano; quebra de objeto frágil exige resolução narrativa.";
        if (t.mode === "pull" && success)
          message =
            "Alvo puxado ao alcance de agarramento. Nenhum agarramento foi aplicado automaticamente.";
        if (t.mode === "knife")
          message +=
            " Precisão usa −2 dados. A faca concede +1 de dano em um ataque resolvido separadamente; este teste não aplica dano.";
        if (t.mode === "throw" && success) {
          const target = read(t.targetId);
          check(target, "Alvo do arremesso não disponível.");
          rawDamage = meters = margin;
          const damage = receiveDamage(target!, catalog, {
            amount: rawDamage,
            aggravated: false,
            source: "manual",
            ruleset: context.campaign?.ruleset,
          });
          appliedDamage = damage.report.superficial;
          if (!damage.character.conditions.includes("Caído"))
            damage.character.conditions.push("Caído");
          write(damage.character);
          message = `Alvo arremessado ${meters} metro(s), com ${rawDamage} de dano superficial bruto e ${appliedDamage} após mitigação/divisão. Alvo caído; levantar e obstáculos são resolvidos na cena.`;
        }
        // Retira a sustentação anterior antes de mudar de alvo/ação. O marcador
        // próprio será recolocado; não há repetição de ativação ou Despertar.
        for (const key of a.targets) {
          const target = read(key);
          if (target) write(endAlchemyEffects(target, a.id));
        }
        a.longReach.sustaining = success && t.mode === "hold";
        a.targets = [...new Set([c.id, ...(t.targetId ? [t.targetId] : [])])];
        if (t.mode === "hold" && !success) {
          a.status = "ended";
          message +=
            " A sustentação terminou. Queda, altura e eventual dano ficam para o Narrador.";
        } else {
          const mark = (key: string, condition: string, suffix: string) => {
            const target = structuredClone(read(key)!);
            check(
              target.activeEffects.length < 200,
              "Limite de efeitos ativos alcançado.",
            );
            target.activeEffects.push({
              id: context.id(),
              sourceId: LONG_REACH,
              effectKey: `alchemy:${a.id}:${suffix}`,
              label: "Longo Alcance",
              effect: effectSchema.parse({
                kind: "condition",
                target: condition,
                duration: "turn",
              }),
              createdAt: new Date().toISOString(),
              remaining: 1,
            });
            if (!target.conditions.includes(condition))
              target.conditions.push(condition);
            write(target);
          };
          mark(c.id, REACH_CONDITION, "ready");
          if (a.longReach.sustaining) {
            a.longReach.lastHeldTurn = currentTurn;
            if (t.targetId) mark(t.targetId, FLOAT_CONDITION, "held");
            message =
              "Sustentação mantida. Teste Determinação + Alquimia, dificuldade 3, novamente no próximo turno. Nenhum custo de ativação é repetido.";
          }
        }
      }
      t.status = "resolved";
      t.actorReview.state = t.oppositionReview.state = "closed";
      t.outcome = {
        success,
        margin,
        meters,
        rawDamage,
        appliedDamage,
        message,
      };
    }
  }
  out.alchemy.activations = out.alchemy.activations.map((x) =>
    x.id === a.id ? a : x,
  );
  return {
    character: validCharacter(out),
    targets: [...updates.values()].map(validCharacter),
    result: {
      operation: data.operation,
      activationId: a.id,
      status: a.status,
      rouses: [],
      formulaTest: t,
      review:
        data.operation === "rerollFormulaTest"
          ? data.side === "actor"
            ? t.actorReview
            : t.oppositionReview
          : undefined,
      willpowerSpent,
      message:
        t.outcome?.message ??
        (willpowerSpent
          ? "Rerrolagem registrada; dados de Fome e custos anteriores preservados. Revise antes de resolver."
          : "Teste registrado. Revise os dados antes de resolver; nenhum deslocamento ou dano foi aplicado."),
    },
  };
}
