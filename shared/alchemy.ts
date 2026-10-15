import { z } from "zod";
import {
  AlchemyActivation,
  AlchemyPreparation,
  Campaign,
  Character,
  Content,
  alchemyPreparationSchema,
  alchemyStateSchema,
  characterSchema,
  effectSchema,
} from "./model";
import {
  applyDamage,
  check,
  derived,
  effectValue,
  evaluate,
  feed,
  matches,
  pool,
  randomDie,
  reroll,
  requirementsMet,
  roll,
  rouse,
} from "./rules";
import { turnKey } from "./blood-mechanics";
import { ALCHEMY, canTestFrenzy, isThinBlood } from "./thin-blood";
import {
  FOG,
  FOG_CONDITION,
  LONG_REACH,
  REACH_CONDITION,
  ENVELOP,
  ENVELOP_CONDITION,
  ENVELOP_READY,
  FLIGHT,
  FLIGHT_READY,
  envelopActionBlocked,
  concentrating,
  endAlchemyEffects as endEffects,
  closeFormulaTests,
} from "./alchemy-effects";
import { formulaOperation } from "./alchemy-formulas";
import { flightOperation } from "./alchemy-flight";
import { receiveDamage } from "./combat";

export const alchemyActionSchema = z.object({
  operation: z.enum([
    "prepare",
    "activate",
    "resolve",
    "move",
    "discard",
    "end",
    "completeConcentration",
    "completeCrafting",
    "rerollDistillation",
    "acceptDistillation",
    "formulaTest",
    "rerollFormulaTest",
    "acceptFormulaTest",
  ]),
  testId: z.string().max(100).default(""),
  side: z.enum(["actor", "opposition"]).default("actor"),
  mode: z
    .enum([
      "move",
      "pull",
      "throw",
      "hold",
      "delicate",
      "knife",
      "suffocate",
      "fly",
      "carry",
      "capture",
      "ground",
      "land",
    ])
    .default("move"),
  targetId: z.string().max(100).default(""),
  object: z.string().max(500).default(""),
  weightKg: z.number().positive().lt(100).default(1),
  sceneConfirmed: z.boolean().default(false),
  humanMassConfirmed: z.boolean().default(false),
  consentConfirmed: z.boolean().default(false),
  craftingConfirmed: z.boolean().default(false),
  donorConfirmed: z.boolean().default(false),
  researchConfirmed: z.boolean().default(false),
  difficulty: z.number().int().min(1).max(30).optional(),
  formulaId: z.string().max(100).default(""),
  preparationId: z.string().max(100).default(""),
  activationId: z.string().max(100).default(""),
  reviewDistillation: z.boolean().default(false),
  indices: z.array(z.number().int().min(0).max(99)).max(3).default([]),
  ingredients: z.string().max(2000).default(""),
  ingredientsConfirmed: z.boolean().default(false),
  modifier: z.number().int().min(-2).max(2).default(0),
  location: z.enum(["carried", "stored"]).default("carried"),
  carryAttribute: z.enum(["raciocinio", "destreza"]).default("raciocinio"),
  fieldEquipment: z.boolean().default(false),
  laboratoryConfirmed: z.boolean().default(false),
  vesselId: z.string().max(100).default(""),
  vesselEmotionConfirmed: z.boolean().default(false),
  feedingConfirmed: z.boolean().default(false),
  feedingMode: z.enum(["safe", "harmful"]).default("safe"),
  concentrationConfirmed: z.boolean().default(false),
  dependencyConfirmed: z.boolean().default(false),
  targetIds: z.array(z.string().min(1).max(100)).max(5).default([]),
  group: z.boolean().default(false),
  rouseCount: z.number().int().min(0).max(5).optional(),
  narrativeConfirmed: z.boolean().default(false),
  applyEffects: z.boolean().default(true),
  fogPenalty: z.number().int().min(0).max(10).default(2),
  duration: z.number().int().min(1).max(100).default(1),
  effectMargin: z.number().int().min(0).max(100).default(0),
  tags: z.array(z.string().max(100)).max(40).default([]),
  note: z.string().max(4000).default(""),
});
export type AlchemyAction = z.infer<typeof alchemyActionSchema>;
export const alchemyOperationLabels: Record<
  AlchemyAction["operation"],
  string
> = {
  prepare: "Preparação",
  activate: "Ativação",
  resolve: "Resolução",
  move: "Transporte",
  discard: "Descarte",
  end: "Encerramento",
  completeConcentration: "Concentração concluída",
  completeCrafting: "Destilação de três noites concluída",
  rerollDistillation: "Rerrolagem de destilação",
  acceptDistillation: "Resultado de destilação aceito",
  formulaTest: "Teste próprio da fórmula",
  rerollFormulaTest: "Rerrolagem do teste próprio",
  acceptFormulaTest: "Resolução do teste próprio",
};
export function standardAlchemyFormula(formula: Content) {
  return (
    formula.origin !== "official" ||
    [
      FOG,
      "formula-alquimia-sangue-ralo-longo-alcance",
      "formula-alquimia-sangue-ralo-envolver",
      "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar",
    ].includes(formula.id)
  );
}
export function distillationQuality(successes: number) {
  return successes === 2
    ? "Poder fraco, casual e tardio"
    : successes === 4
      ? "Poder funciona como pretendido"
      : successes === 6
        ? "Poder aumentado no efeito"
        : "Resultado sem efeito definido na tabela; resolução do Narrador";
}
export function fixatioLimits(
  c: Character,
  catalog: Content[],
  carryAttribute: "raciocinio" | "destreza",
) {
  const haven = Math.max(
    0,
    ...c.advantages
      .filter((a) => a.contentId === "background-refugio")
      .map((a) => a.level),
  );
  return {
    carried: derived(c, catalog).attributes[carryAttribute],
    stored: 2 * ((c.disciplines[ALCHEMY] ?? 0) + haven),
  };
}
function capacity(c: Character, catalog: Content[], p: AlchemyPreparation) {
  const limits = fixatioLimits(c, catalog, p.carryAttribute);
  check(
    c.alchemy.preparations.filter(
      (x) => x.method === "fixatio" && x.location === p.location,
    ).length <= limits[p.location as "carried" | "stored"],
    p.location === "carried"
      ? "Limite de frascos carregados alcançado para o Atributo escolhido."
      : "Limite de frascos armazenados no Refúgio alcançado.",
  );
}
function distill(
  c: Character,
  catalog: Content[],
  p: AlchemyPreparation,
  ruleset: string,
  rng: () => number,
) {
  const attribute = {
    athanor: "vigor",
    calcinatio: "manipulacao",
    fixatio: "inteligencia",
  }[p.method];
  const n = pool(
    c,
    catalog,
    { attribute, skill: ALCHEMY, tags: ["destilacao"] },
    p.modifier - (p.fieldEquipment ? 2 : 0),
    false,
    ruleset,
    true,
  );
  return roll(n, c.hunger, 0, rng);
}
export type AlchemyOperationResult = {
  character: Character;
  targets: Character[];
  result: {
    operation: AlchemyAction["operation"];
    rouses: ReturnType<typeof rouse>[];
    distillation?: ReturnType<typeof evaluate>;
    quality?: string;
    activationId?: string;
    preparationId?: string;
    review?: AlchemyActivation["review"];
    willpowerSpent?: number;
    status?: AlchemyActivation["status"];
    feedingAmount?: number;
    feeding?: any;
    formulaTest?: AlchemyActivation["formulaTests"][number];
    message: string;
  };
};
export function alchemyOperation(
  c: Character,
  catalog: Content[],
  input: AlchemyAction,
  context: {
    gm: boolean;
    campaign?: Campaign;
    characters: Character[];
    id: () => string;
  },
  rng = randomDie,
): AlchemyOperationResult {
  const data = alchemyActionSchema.parse(input),
    { gm, campaign } = context;
  check(
    ["discard", "end"].includes(data.operation) ||
      (c.status === "active" &&
        isThinBlood(c) &&
        !!c.thinBlood.alchemyMethod &&
        (c.disciplines[ALCHEMY] ?? 0) > 0),
    "A Alquimia exige Sangue-Ralo ativo, nível e método aprendidos.",
  );
  if (
    ["formulaTest", "rerollFormulaTest", "acceptFormulaTest"].includes(
      data.operation,
    )
  )
    return c.alchemy.activations.find((a) => a.id === data.activationId)
      ?.formulaId === FLIGHT
      ? flightOperation(c, catalog, data, context, rng)
      : formulaOperation(c, catalog, data, context, rng);
  check(
    ["discard", "end"].includes(data.operation) || !envelopActionBlocked(c),
    "Envolver impede ações voluntárias enquanto o personagem sufoca ou está inconsciente.",
  );
  let out = structuredClone(c);
  const updates = new Map<string, Character>();
  const read = (key: string) =>
    key === c.id
      ? out
      : (updates.get(key) ?? context.characters.find((x) => x.id === key));
  const write = (character: Character) => {
    if (character.id === c.id) out = character;
    else updates.set(character.id, character);
  };
  const requireNarrator = (message: string) =>
    check(
      gm && data.narrativeConfirmed && data.note.trim().length >= 10,
      message,
    );
  const rouses: ReturnType<typeof rouse>[] = [];
  const pay = (count: number) => {
    if (count)
      check(
        out.hunger < 5,
        "Fome 5 impede iniciar um custo voluntário de Despertar.",
      );
    for (let i = 0; i < count; i++) {
      const r = rouse(out.hunger, { forced: i > 0 && out.hunger >= 5 }, rng);
      if (!canTestFrenzy(c)) r.frenzy = false;
      out.hunger = r.hunger;
      rouses.push(r);
    }
  };
  const ownedFormula = (key: string) => {
    const f = catalog.find((x) => x.id === key);
    check(
      f?.kind === "formula" &&
        f.parentId === ALCHEMY &&
        c.powers.includes(key) &&
        f.level <= c.disciplines[ALCHEMY] &&
        requirementsMet(f, c),
      "Fórmula não adquirida ou requisitos não satisfeitos.",
    );
    return f!;
  };
  if (["prepare", "activate"].includes(data.operation)) {
    check(
      !c.conditions.some((x) =>
        ["Torpor", "Morte Final", "Incapacitado: coma ou morte"].includes(x),
      ),
      "Um personagem incapacitado não prepara ou ativa fórmulas.",
    );
    if (
      c.advantages.some(
        (a) => a.contentId === "flaw-dependencia-de-vitae" && a.level > 0,
      )
    )
      check(
        gm && data.dependencyConfirmed && data.note.trim().length >= 10,
        "Dependência de Vitae exige confirmação do Narrador de saciedade vampírica na última semana, com registro.",
      );
  }
  let distillation: ReturnType<typeof evaluate> | undefined;
  let preparationId = "";
  let review: AlchemyPreparation["review"] | undefined;
  let willpowerSpent = 0;
  let activation: AlchemyActivation | undefined;
  let feedingAmount = 0;
  let feeding: any;
  if (data.operation === "prepare") {
    const formula = ownedFormula(data.formulaId),
      method = c.thinBlood.alchemyMethod;
    check(
      standardAlchemyFormula(formula),
      "Esta fórmula tem extração, transformação ou procedimento especial ainda pendente; registre a resolução na crônica.",
    );
    check(
      data.ingredientsConfirmed && data.ingredients.trim().length >= 10,
      "Registre os ingredientes e confirme vitae própria e Ressonância humana adequada.",
    );
    check(
      data.modifier === 0 || gm,
      "O Narrador define o modificador de qualidade dos ingredientes.",
    );
    check(
      !concentrating(c),
      "Conclua ou interrompa a concentração em andamento.",
    );
    const p = alchemyPreparationSchema.parse({
      id: context.id(),
      formulaId: formula.id,
      method,
      location:
        method === "fixatio"
          ? data.location
          : method === "athanor"
            ? "body"
            : "vessel",
      vesselId: method === "calcinatio" ? data.vesselId : "",
      ingredients: data.ingredients,
      modifier: data.modifier,
      fieldEquipment: method === "fixatio" && data.fieldEquipment,
      carryAttribute: data.carryAttribute,
      remainingTurns: method === "athanor" && formula.id !== FLIGHT ? 3 : 0,
      preparedAt: turnKey(c, campaign),
    });
    if (method === "athanor")
      check(
        !c.alchemy.preparations.some((x) => x.method === "athanor"),
        "Já existe uma mistura no próprio corpo; descarte-a antes de destilar outra.",
      );
    if (method === "calcinatio") {
      const vessel = read(data.vesselId);
      check(
        gm &&
          data.vesselEmotionConfirmed &&
          data.note.trim().length >= 10 &&
          vessel?.nature === "mortal",
        "Calcinatio exige receptáculo humano e confirmação emocional do Narrador, com registro.",
      );
      check(
        !context.characters.some((x) =>
          x.alchemy.preparations.some(
            (y) => y.method === "calcinatio" && y.vesselId === data.vesselId,
          ),
        ),
        "Este receptáculo já contém uma fórmula; somente uma por pessoa.",
      );
    }
    if (method === "fixatio") {
      check(
        data.laboratoryConfirmed || data.fieldEquipment,
        "Confirme o laboratório ou selecione equipamento de campo.",
      );
      check(
        !data.fieldEquipment || formula.level <= 3,
        "Equipamento de campo permite somente fórmulas de nível 3 ou menor.",
      );
    }
    out.alchemy.preparations.push(p);
    check(
      out.alchemy.preparations.length <= 100,
      "Limite de preparações alcançado; consuma ou descarte uma preparação.",
    );
    if (method === "fixatio") capacity(out, catalog, p);
    pay(1);
    if (method !== "fixatio" && formula.id !== FLIGHT) {
      distillation = distill(
        out,
        catalog,
        p,
        campaign?.ruleset ?? "companion",
        rng,
      );
      p.distillation = {
        normal: distillation.normal,
        hunger: distillation.hunger,
      };
      p.review.state = "open";
    }
    preparationId = p.id;
    review = p.review;
  } else if (data.operation === "rerollDistillation") {
    check(
      Boolean(data.preparationId) !== Boolean(data.activationId),
      "Selecione uma preparação ou uma ativação para rerrolar.",
    );
    const p = data.preparationId
      ? out.alchemy.preparations.find((x) => x.id === data.preparationId)
      : undefined;
    activation = data.activationId
      ? out.alchemy.activations.find((x) => x.id === data.activationId)
      : undefined;
    const entry = p || activation;
    check(
      entry?.distillation && entry.review.state === "open",
      "A revisão desta destilação já foi encerrada ou os dados ainda não foram rolados.",
    );
    check(
      !entry!.review.rerolled,
      "Esta destilação já recebeu sua rerrolagem de Força de Vontade.",
    );
    check(
      !activation || activation.status === "pending",
      "Os efeitos desta ativação já foram resolvidos.",
    );
    const max = derived(out, catalog).willpowerMax;
    check(out.willpower.aggravated < max, "Força de Vontade indisponível.");
    const original = structuredClone(entry!.distillation!);
    distillation = reroll(
      evaluate(original.normal, original.hunger, 0),
      data.indices,
      rng,
    );
    out.willpower = applyDamage(out.willpower, max, 1, false, false);
    willpowerSpent = 1;
    entry!.distillation = {
      normal: distillation.normal,
      hunger: distillation.hunger,
    };
    entry!.review = { state: "open", rerolled: true, original };
    review = entry!.review;
    preparationId = p?.id || "";
  } else if (
    [
      "activate",
      "move",
      "discard",
      "completeConcentration",
      "completeCrafting",
    ].includes(data.operation)
  ) {
    const p = out.alchemy.preparations.find((x) => x.id === data.preparationId);
    check(p, "Preparação não encontrada; ela pode já ter sido consumida.");
    if (data.operation === "discard")
      out.alchemy.preparations = out.alchemy.preparations.filter(
        (x) => x.id !== p!.id,
      );
    else if (data.operation === "move") {
      check(
        p!.method === "fixatio",
        "Somente frascos de Fixatio podem ser transportados.",
      );
      p!.location = data.location;
      p!.carryAttribute = data.carryAttribute;
      capacity(out, catalog, p!);
    } else if (data.operation === "completeCrafting") {
      check(
        p!.formulaId === FLIGHT,
        "Este procedimento de três noites pertence ao Impulso Suspenso no Ar.",
      );
      requireNarrator(
        "O Narrador confirma ao menos três noites de destilação e resolve a origem compatível da gota de vitae, com registro.",
      );
      check(
        data.craftingConfirmed &&
          data.donorConfirmed &&
          data.researchConfirmed &&
          p!.crafting.nights < 3,
        "Confirme pesquisa prévia de três meses, três noites de trabalho e gota de vitae; uma preparação concluída não é refeita.",
      );
      check(
        p!.method !== "athanor" || data.concentrationConfirmed,
        "Confirme a concentração exclusiva final de Athanor.",
      );
      check(
        p!.method !== "calcinatio" ||
          (data.vesselEmotionConfirmed &&
            read(p!.vesselId)?.nature === "mortal"),
        "Calcinatio exige receptáculo humano disponível e emoção mantida.",
      );
      p!.crafting = {
        nights: 3,
        donorConfirmed: true,
        researchConfirmed: true,
        note: data.note,
      };
      p!.remainingTurns = 0;
      if (p!.method !== "fixatio" && !p!.distillation) {
        distillation = distill(
          out,
          catalog,
          p!,
          campaign?.ruleset ?? "companion",
          rng,
        );
        p!.distillation = {
          normal: distillation.normal,
          hunger: distillation.hunger,
        };
        p!.review.state = "open";
      }
      preparationId = p!.id;
      review = p!.review;
    } else if (data.operation === "completeConcentration") {
      requireNarrator(
        "O Narrador confirma ao menos três turnos de concentração exclusiva, com registro.",
      );
      check(
        p!.method === "athanor",
        "Esta preparação não usa concentração de Athanor.",
      );
      p!.remainingTurns = 0;
    } else {
      const formula = ownedFormula(p!.formulaId);
      if (formula.id === FLIGHT) {
        check(
          p!.crafting.nights >= 3 &&
            p!.crafting.donorConfirmed &&
            p!.crafting.researchConfirmed &&
            p!.crafting.note.trim().length >= 10,
          "O Narrador precisa concluir as três noites de destilação e a confirmação de vitae antes de consumir esta preparação.",
        );
        check(
          data.targetIds.length === 0,
          "Impulso Suspenso no Ar permite voo somente ao alquimista; passageiros são registrados depois.",
        );
        check(
          !out.alchemy.activations.some(
            (a) => a.formulaId === FLIGHT && a.status !== "ended",
          ),
          "Encerre o Impulso anterior antes de ativar outra mistura de voo.",
        );
      }
      // O histórico completo continua no registro de auditoria e no backup.
      out.alchemy.activations = out.alchemy.activations.filter(
        (a, i, all) => a.status !== "ended" || i >= all.length - 100,
      );
      check(
        out.alchemy.activations.length < 1000,
        "Resolva ou encerre ativações pendentes antes de continuar.",
      );
      check(
        c.lastPowerTurn !== turnKey(c, campaign),
        "Um Poder de Disciplina já foi ativado neste turno.",
      );
      check(
        p!.remainingTurns === 0,
        "Aguarde ao menos três turnos de concentração ou peça o registro do tempo ao Narrador.",
      );
      if (p!.method === "athanor")
        check(
          data.concentrationConfirmed,
          "Confirme que a preparação teve concentração exclusiva, sem outras ações.",
        );
      if (p!.method === "calcinatio") {
        check(
          gm &&
            data.vesselEmotionConfirmed &&
            data.feedingConfirmed &&
            data.note.trim().length >= 10,
          "O Narrador confirma emoção mantida, tempo de alimentação e consequências no receptáculo, com registro.",
        );
        check(
          read(p!.vesselId)?.nature === "mortal",
          "O receptáculo humano não está disponível.",
        );
        feedingAmount = formula.level - 1;
        check(
          data.feedingMode === "harmful" || feedingAmount <= 2,
          "Acima de dois pontos a alimentação é nociva; consulte Básico PDF 188.",
        );
        const vessel = read(p!.vesselId)!;
        check(
          !vessel.conditions.some((x) =>
            ["Morte Final", "Incapacitado: coma ou morte"].includes(x),
          ),
          "O receptáculo está incapacitado; resolva sua condição antes de alimentá-lo ou drená-lo.",
        );
        feeding = {
          amount: feedingAmount,
          mode: data.feedingMode,
          time:
            feedingAmount === 0
              ? "Amostra; tempo decidido pelo Narrador"
              : data.feedingMode === "harmful"
                ? `${feedingAmount} turno(s)`
                : feedingAmount === 1
                  ? "Três turnos"
                  : "Uma cena",
        };
        if (feedingAmount && data.feedingMode === "harmful") {
          const hit = receiveDamage(vessel, catalog, {
            amount: feedingAmount,
            aggravated: true,
            halve: false,
          });
          write(hit.character);
          feeding.damage = hit.report;
          feeding.survival = roll(
            pool(hit.character, catalog, {
              attribute: "forca",
              skill: "vigor",
              tags: ["perdaSangue"],
            }),
            0,
            feedingAmount,
            rng,
          );
          feeding.message =
            "O Narrador resolve tratamento e sobrevivência; falha não declara morte automática.";
        }
        if (feedingAmount)
          out.hunger = feed(
            out,
            { source: "human", amount: feedingAmount },
            campaign?.ruleset,
          );
      }
      check(
        p!.method !== "fixatio" || p!.location === "carried",
        "Retire o frasco do armazenamento antes de consumi-lo.",
      );
      const manualCost = formula.automation === "unreviewed";
      if (manualCost) {
        requireNarrator(
          "Esta fórmula exige consulta e resolução do Narrador antes da ativação.",
        );
        check(
          data.rouseCount !== undefined,
          "Informe o custo de ativação conferido na fonte; destilação já foi paga.",
        );
      }
      if (formula.id === ENVELOP)
        check(
          data.sceneConfirmed &&
            data.targetIds.length === 1 &&
            data.targetIds[0] !== c.id,
          "Envolver exige exatamente um outro alvo visível, confirmado na cena.",
        );
      // Inclui o usuário para encerrar também efeitos próprios de fórmulas com alvos externos.
      const targets = [...new Set([c.id, ...data.targetIds])];
      check(
        targets.length <= 5,
        "Selecione até quatro alvos adicionais ao usuário.",
      );
      if (
        formula.id !== FOG &&
        formula.effects.some((e) => e.recipient === "target")
      )
        check(
          data.targetIds.some((key) => key !== c.id),
          "Selecione um alvo para os efeitos dirigidos a outra pessoa.",
        );
      check(
        targets.every((key) => !!read(key)),
        "Alvo indisponível nesta campanha.",
      );
      check(
        formula.id === FOG || !data.group,
        "Ampliação de grupo pertence à fórmula Névoa.",
      );
      check(
        formula.id !== FOG ||
          (targets.length <= 5 && (data.group || targets.length === 1)),
        "Névoa abrange até cinco pessoas; ampliar exige um Despertar adicional.",
      );
      pay(
        (manualCost ? data.rouseCount! : formula.rouse) + (data.group ? 1 : 0),
      );
      if (formula.willpowerCost) {
        const max = derived(out, catalog).willpowerMax;
        check(
          out.willpower.aggravated < max,
          "Força de Vontade indisponível para o custo da fórmula.",
        );
        out.willpower = applyDamage(
          out.willpower,
          max,
          formula.willpowerCost,
          false,
          false,
        );
      }
      distillation = p!.distillation
        ? evaluate(p!.distillation.normal, p!.distillation.hunger, 0)
        : distill(out, catalog, p!, campaign?.ruleset ?? "companion", rng);
      activation = {
        id: context.id(),
        formulaId: formula.id,
        method: p!.method,
        alchemyLevel: out.disciplines[ALCHEMY],
        distillation: {
          normal: distillation.normal,
          hunger: distillation.hunger,
        },
        review:
          p!.method === "fixatio"
            ? {
                state: data.reviewDistillation ? "open" : "closed",
                rerolled: false,
                original: null,
              }
            : { ...structuredClone(p!.review), state: "closed" },
        status: "pending",
        targets,
        group: data.group,
        tags: data.tags,
        activatedAt: turnKey(c, campaign),
        note: data.note,
        resolution: "",
        formulaTests: [],
        crafting: structuredClone(p!.crafting),
        flight: { airborne: false, passengerId: "", load: "" },
        longReach: { sustaining: false, lastHeldTurn: "", lastActionTurn: "" },
      };
      // Athanor não sustenta dois poderes, inclusive quando o novo aguarda interpretação.
      for (const old of out.alchemy.activations.filter(
        (x) =>
          x.status !== "ended" &&
          ((p!.method === "athanor" && x.method === "athanor") ||
            (formula.id === ENVELOP && x.formulaId === ENVELOP)),
      )) {
        for (const key of old.targets) {
          const target = read(key);
          if (target) write(endEffects(target, old.id));
        }
        const ended = out.alchemy.activations.find((x) => x.id === old.id)!;
        ended.status = "ended";
        ended.review.state = "closed";
        ended.longReach.sustaining = false;
        ended.flight = { airborne: false, passengerId: "", load: "" };
        closeFormulaTests(ended);
      }
      out.lastPowerTurn = turnKey(c, campaign);
      // O humano mantém a fórmula enquanto o estado emocional persistir (PDF 276).
      if (p!.method !== "calcinatio")
        out.alchemy.preparations = out.alchemy.preparations.filter(
          (x) => x.id !== p!.id,
        );
      else p!.review.state = "closed";
      out.alchemy.activations.push(activation);
      if (
        activation.review.state === "closed" &&
        automaticResult(formula, distillation)
      )
        apply(activation, formula);
    }
  } else {
    activation = out.alchemy.activations.find(
      (x) => x.id === data.activationId,
    );
    check(activation, "Ativação não encontrada.");
    if (data.operation === "acceptDistillation") {
      check(
        activation!.status === "pending" && activation!.review.state === "open",
        "A revisão desta destilação já foi encerrada.",
      );
      activation!.review.state = "closed";
      distillation = evaluate(
        activation!.distillation.normal,
        activation!.distillation.hunger,
        0,
      );
      const formula = ownedFormula(activation!.formulaId);
      if (automaticResult(formula, distillation)) apply(activation!, formula);
    } else if (data.operation === "end") {
      check(activation!.status !== "ended", "Esta ativação já foi encerrada.");
      for (const key of activation!.targets) {
        const target = read(key);
        if (target) write(endEffects(target, activation!.id));
      }
      out.alchemy.activations.find((x) => x.id === activation!.id)!.status =
        "ended";
      const ended = out.alchemy.activations.find(
        (x) => x.id === activation!.id,
      )!;
      ended.review.state = "closed";
      ended.longReach.sustaining = false;
      ended.flight = { airborne: false, passengerId: "", load: "" };
      closeFormulaTests(ended);
    } else {
      check(
        activation!.status === "pending",
        "Esta ativação já foi resolvida; custos e efeitos não são repetidos.",
      );
      requireNarrator(
        "O Narrador resolve a qualidade e os efeitos, com registro.",
      );
      activation!.resolution = data.note;
      activation!.review.state = "closed";
      const formula = ownedFormula(activation!.formulaId);
      if (data.applyEffects) apply(activation!, formula);
      else activation!.status = "ended";
      distillation = evaluate(
        activation!.distillation.normal,
        activation!.distillation.hunger,
        0,
      );
    }
  }
  function apply(a: AlchemyActivation, formula: Content) {
    if (formula.id === FLIGHT)
      check(
        a.crafting.nights >= 3 &&
          a.crafting.donorConfirmed &&
          a.crafting.researchConfirmed &&
          a.crafting.note.trim().length >= 10 &&
          a.targets.length === 1 &&
          a.targets[0] === c.id,
        "Este registro antigo de voo não confirma trabalho e alvo pessoal; encerre-o e prepare uma nova mistura com os requisitos confirmados.",
      );
    if (formula.id === ENVELOP)
      check(
        a.targets.length === 2 &&
          a.targets.includes(c.id) &&
          a.targets.some((key) => key !== c.id && !!read(key)),
        "Esta ativação de Envolver não tem um alvo único válido; encerre o registro antigo e ative uma preparação com alvo.",
      );
    const effects =
      formula.id === FLIGHT
        ? [
            effectSchema.parse({
              kind: "condition",
              target: FLIGHT_READY,
              duration: "scene",
              recipient: "self",
            }),
          ]
        : formula.id === LONG_REACH
          ? [
              effectSchema.parse({
                kind: "condition",
                target: REACH_CONDITION,
                value: 0,
                duration: "turn",
                recipient: "self",
              }),
            ]
          : formula.id === ENVELOP
            ? [
                effectSchema.parse({
                  kind: "condition",
                  target: ENVELOP_CONDITION,
                  value: -3,
                  duration: "scene",
                  recipient: "target",
                }),
                effectSchema.parse({
                  kind: "condition",
                  target: ENVELOP_READY,
                  duration: "scene",
                  recipient: "self",
                }),
              ]
            : formula.id === FOG
              ? [
                  effectSchema.parse({
                    kind: "condition",
                    target: FOG_CONDITION,
                    value: -(data.operation === "resolve"
                      ? data.fogPenalty
                      : 2),
                    duration: "scene",
                  }),
                ]
              : formula.origin === "official"
                ? []
                : formula.effects;
    for (const [i, e] of effects.entries()) {
      if (!automatableEffect(e)) continue; // A resolução registrada pelo Narrador cobre os efeitos não representáveis.
      const recipients =
        formula.id === FOG
          ? a.targets
          : e.recipient === "self"
            ? [c.id]
            : a.targets.filter((key) => key !== c.id);
      for (const key of recipients) {
        const target = structuredClone(read(key)!);
        const source = {
          ...out,
          disciplines: {
            ...out.disciplines,
            [ALCHEMY]: a.alchemyLevel || out.disciplines[ALCHEMY],
          },
        };
        const value = effectValue(e, source, formula, {
          margin: data.effectMargin,
        });
        const ctx = {
          attribute: formula.attribute,
          skill: formula.skill,
          tags: [
            "alquimia",
            ...new Set([...a.tags, ...data.tags]),
            ...(target.nature === "mortal" ? ["alvoMortal"] : []),
          ],
        };
        if (e.duration === "instant" && !matches(e, target, ctx)) continue;
        if (e.kind === "damage" && e.duration === "instant") {
          write(
            receiveDamage(target, catalog, {
              amount: Math.max(0, value),
              track: e.target === "willpower" ? "willpower" : "health",
              aggravated: e.aggravated,
            }).character,
          );
          continue;
        }
        if (e.kind === "heal" && e.duration === "instant") {
          const track = e.target === "willpower" ? "willpower" : "health";
          target[track][e.aggravated ? "aggravated" : "superficial"] = Math.max(
            0,
            target[track][e.aggravated ? "aggravated" : "superficial"] - value,
          );
        } else if (
          e.kind === "resource" &&
          e.duration === "instant" &&
          e.target === "hunger"
        )
          target.hunger = Math.max(0, Math.min(5, target.hunger + value));
        else if (
          e.kind === "condition" &&
          e.duration === "instant" &&
          !target.conditions.includes(e.target)
        )
          target.conditions.push(e.target);
        else if (e.kind !== "narrative" && e.duration !== "instant") {
          check(
            target.activeEffects.length < 200,
            "Encerre outros efeitos ativos do alvo antes de aplicar esta resolução.",
          );
          target.activeEffects.push({
            id: context.id(),
            sourceId: formula.id,
            effectKey: `alchemy:${a.id}:${i}`,
            label: formula.name,
            effect: { ...e, value, scale: "fixed" },
            createdAt: new Date().toISOString(),
            remaining: [LONG_REACH, ENVELOP, FLIGHT].includes(formula.id)
              ? 1
              : data.operation === "resolve"
                ? data.duration
                : 1,
          });
          if (
            e.kind === "condition" &&
            matches(e, target, ctx) &&
            !target.conditions.includes(e.target)
          )
            target.conditions.push(e.target);
        }
        write(target);
      }
    }
    // Fórmulas oficiais sem automação individual conservam a resolução textual.
    out.alchemy.activations.find((x) => x.id === a.id)!.status = effects.some(
      (e) => !["instant"].includes(e.duration) && e.kind !== "narrative",
    )
      ? "active"
      : "ended";
  }
  out.alchemy = alchemyStateSchema.parse(out.alchemy);
  const savedActivation =
    activation && out.alchemy.activations.find((x) => x.id === activation!.id);
  if (savedActivation) review = savedActivation.review;
  return {
    character: {
      ...characterSchema.parse(out),
      id: c.id,
      version: c.version,
    } as Character,
    targets: [...updates.values()].map(
      (x) =>
        ({
          ...characterSchema.parse(x),
          id: x.id,
          version: x.version,
        }) as Character,
    ),
    result: {
      operation: data.operation,
      rouses,
      distillation,
      quality: distillation && distillationQuality(distillation.successes),
      activationId: savedActivation?.id,
      preparationId: preparationId || undefined,
      review,
      willpowerSpent,
      status: savedActivation?.status,
      feedingAmount,
      feeding,
      message:
        data.operation === "rerollDistillation"
          ? "Rerrolagem registrada. Um ponto de Força de Vontade foi gasto; Fome, custos e consumo anteriores foram preservados."
          : savedActivation?.review.state === "open"
            ? "Ativação paga e registrada. Revise os dados normais ou aceite o resultado antes de aplicar efeitos."
            : savedActivation?.status === "pending"
              ? "Ativação paga e registrada. O Narrador deve resolver a qualidade ou os efeitos; não consuma outra preparação."
              : data.operation === "prepare"
                ? "Preparação registrada; o custo de destilação foi pago."
                : "Operação de Alquimia registrada.",
    },
  };
}

function automaticResult(
  formula: Content,
  result: ReturnType<typeof evaluate>,
) {
  const safeCustom =
    formula.origin !== "official" &&
    formula.automation !== "unreviewed" &&
    !formula.attribute &&
    !formula.effects.some((e) => e.scale === "margin") &&
    formula.effects.every(automatableEffect);
  return (
    result.successes === 4 &&
    !result.messy &&
    ([FOG, LONG_REACH, ENVELOP, FLIGHT].includes(formula.id) || safeCustom)
  );
}

function automatableEffect(e: Content["effects"][number]) {
  if (e.kind === "narrative") return true;
  if (e.kind === "condition") return true;
  if (e.duration === "instant")
    return (
      ["damage", "heal"].includes(e.kind) ||
      (e.kind === "resource" && e.target === "hunger")
    );
  return ["dice", "attribute", "health", "willpower"].includes(e.kind);
}
