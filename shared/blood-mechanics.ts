import { Campaign, Character, Content, StoryClock, clockSchema } from "./model";
import { blood, check, derived, rouse, randomDie } from "./rules";

// Marcadores narrativos: não são iniciativa ou ações de outra edição.
export function storyClock(c: Character, campaign?: Campaign): StoryClock {
  return campaign?.clock ?? c.clock ?? clockSchema.parse({});
}
export function nightKey(c: Character, campaign?: Campaign) {
  return `${campaign?.id || c.campaignId || c.id}@${storyClock(c, campaign).night}`;
}
export function turnKey(c: Character, campaign?: Campaign) {
  const t = storyClock(c, campaign);
  return `${nightKey(c, campaign)}.${t.scene}.${t.turn}`;
}
export function nextClock(
  clock: StoryClock,
  scope: "night" | "scene" | "turn",
): StoryClock {
  const c = { ...clock };
  if (scope === "night") {
    c.night++;
    c.scene = 1;
    c.turn = 1;
  } else if (scope === "scene") {
    c.scene++;
    c.turn = 1;
  } else c.turn++;
  check(
    c.night <= 100000 && c.scene <= 100000 && c.turn <= 100000,
    "O limite deste marcador narrativo foi alcançado.",
  );
  return clockSchema.parse(c);
}
export function expireEffects(
  c: Character,
  scope: "night" | "scene" | "turn",
  units = 1,
) {
  const out = structuredClone(c);
  const shorter =
    scope === "night" ? ["turn", "scene"] : scope === "scene" ? ["turn"] : [];
  out.activeEffects = out.activeEffects.filter((x) => {
    if (shorter.includes(x.effect.duration)) return false;
    if (x.effect.duration !== scope) return true;
    x.remaining -= units;
    return x.remaining > 0;
  });
  out.conditions = out.conditions.filter(
    (name) =>
      !c.activeEffects.some(
        (x) => x.effect.kind === "condition" && x.effect.target === name,
      ) ||
      out.activeEffects.some(
        (x) => x.effect.kind === "condition" && x.effect.target === name,
      ),
  );
  return out;
}
export function wakeForNight(
  c: Character,
  campaign?: Campaign,
  rng = randomDie,
) {
  check(c.nature !== "mortal", "Esta ação vampírica não se aplica a mortais.");
  const key = nightKey(c, campaign);
  check(c.lastWakeNight !== key, "O Despertar desta noite já foi realizado.");
  check(
    !c.conditions.includes("Torpor"),
    "Um personagem em Torpor exige a resolução do Narrador para despertar.",
  );
  const result = rouse(c.hunger, { waking: true }, rng);
  const out = {
    ...structuredClone(c),
    hunger: result.hunger,
    lastWakeNight: key,
  };
  if (result.torpor && !out.conditions.includes("Torpor"))
    out.conditions.push("Torpor");
  return { character: out, result };
}
export function mendSuperficial(
  c: Character,
  catalog: Content[],
  campaign?: Campaign,
  rng = randomDie,
) {
  check(c.nature !== "mortal", "Mortais não se curam pelo Sangue.");
  check(
    !c.advantages.some(
      (a) => a.contentId === "flaw-fragilidade-mortal" && a.level > 0,
    ),
    "Fragilidade Mortal impede a recuperação vampírica; resolva a cura mortal com o Narrador.",
  );
  check(
    c.health.superficial > 0,
    "Não há dano superficial de Vitalidade para recuperar.",
  );
  check(
    !c.conditions.includes("Torpor"),
    "Um personagem em Torpor não realiza recuperação voluntária.",
  );
  const key = turnKey(c, campaign);
  check(
    c.lastSuperficialMendTurn !== key,
    "A recuperação superficial já foi usada neste turno.",
  );
  const result = rouse(c.hunger, {}, rng),
    out = structuredClone(c);
  out.health.superficial = Math.max(
    0,
    c.health.superficial - blood(c.bloodPotency, campaign?.ruleset).mend,
  );
  out.hunger = result.hunger;
  out.lastSuperficialMendTurn = key;
  return {
    character: out,
    result: {
      ...result,
      recovered: c.health.superficial - out.health.superficial,
    },
  };
}
export function mendAggravated(
  c: Character,
  campaign?: Campaign,
  rng = randomDie,
) {
  check(c.nature !== "mortal", "Mortais não se curam pelo Sangue.");
  check(
    !c.advantages.some(
      (a) => a.contentId === "flaw-fragilidade-mortal" && a.level > 0,
    ),
    "Fragilidade Mortal impede a recuperação vampírica; resolva a cura mortal com o Narrador.",
  );
  check(c.hunger < 5, "Fome 5 impede iniciar a recuperação voluntária.");
  check(
    c.health.aggravated > 0,
    "Não há dano agravado de Vitalidade para recuperar.",
  );
  check(
    !c.conditions.includes("Torpor"),
    "Um personagem em Torpor não realiza recuperação voluntária.",
  );
  check(c.nature !== "mortal", "Esta ação vampírica não se aplica a mortais.");
  const key = nightKey(c, campaign);
  check(
    c.lastWakeNight === key,
    "Realize o Despertar noturno antes da cura agravada.",
  );
  check(
    c.aggravatedMendEligible > 0,
    "Aguarde o próximo cair da noite para recuperar este dano agravado.",
  );
  check(
    c.lastAggravatedMendNight !== key,
    "Somente um ponto de dano agravado pode ser recuperado por noite.",
  );
  const out = structuredClone(c),
    rouses = [];
  let torpor = false;
  // Os três custos já incorridos se resolvem mesmo quando a Fome alcança 5.
  for (let i = 0; i < 3; i++) {
    const r = rouse(out.hunger, { waking: true }, rng);
    out.hunger = r.hunger;
    torpor ||= r.torpor;
    rouses.push(r);
  }
  out.health.aggravated--;
  out.aggravatedMendEligible--;
  out.lastAggravatedMendNight = key;
  if (torpor && !out.conditions.includes("Torpor"))
    out.conditions.push("Torpor");
  return {
    character: out,
    result: {
      rouses,
      torpor,
      hunger: out.hunger,
      recovered: 1,
      message: torpor
        ? "A falha na recuperação agravada em Fome 5 levou ao Torpor."
        : "Um ponto de dano agravado recuperado.",
    },
  };
}
export function blushOfLife(
  c: Character,
  campaign?: Campaign,
  rng = randomDie,
) {
  check(
    !c.conditions.includes("Torpor"),
    "Um personagem em Torpor não ativa Brilho de Vida.",
  );
  check(c.nature !== "mortal", "Esta ação vampírica não se aplica a mortais.");
  const key = nightKey(c, campaign);
  check(c.lastBlushNight !== key, "Brilho de Vida já está ativo nesta noite.");
  const result =
    c.humanity >= 9 || c.generation >= 14
      ? {
          dice: [],
          success: true,
          hunger: c.hunger,
          torpor: false,
          frenzy: false,
        }
      : rouse(c.hunger, { double: c.humanity === 8 }, rng);
  return {
    character: { ...c, hunger: result.hunger, lastBlushNight: key },
    result: {
      ...result,
      message:
        c.generation >= 14
          ? "Sangues-Ralos são considerados sob Brilho de Vida naturalmente, conforme sua Humanidade."
          : c.humanity >= 9
            ? "Humanidade 9 ou 10 permite aparência humana sem Despertar."
            : "Brilho de Vida permanece ativo até o fim da noite.",
    },
  };
}
export function feedFromVampire(
  reader: Character,
  donor: Character,
  amount: number,
  ruleset = "companion",
) {
  check(
    reader.nature !== "mortal" && donor.nature !== "mortal",
    "Esta operação exige dois vampiros.",
  );
  check(reader.id !== donor.id, "Selecione outro vampiro como doador.");
  check(
    Number.isInteger(amount) && amount >= 1 && amount <= 5,
    "Informe de 1 a 5 pontos de Fome infligidos ao doador.",
  );
  check(
    donor.hunger + amount <= 5,
    "O doador não possui sangue suficiente para esse aumento de Fome.",
  );
  const difference = donor.bloodPotency - reader.bloodPotency;
  const sated =
    difference >= 2
      ? amount * 2
      : difference <= -2
        ? Math.floor(amount / 2)
        : amount;
  // O mínimo da tabela e a regra que reserva Fome zero à morte humana são preservados.
  const hunger = Math.min(
    reader.hunger,
    Math.max(blood(reader.bloodPotency, ruleset).floor, reader.hunger - sated),
  );
  return {
    reader: { ...reader, hunger },
    donor: { ...donor, hunger: donor.hunger + amount },
    sated: reader.hunger - hunger,
    ratio:
      difference >= 2 ? "2 por 1" : difference <= -2 ? "1 por 2" : "1 por 1",
  };
}
export function recoverWillpower(
  c: Character,
  catalog: Content[],
  sessionId: string,
  ambition = false,
) {
  check(
    c.lastSessionRecovery !== sessionId,
    "A recuperação desta sessão já foi aplicada.",
  );
  const out = structuredClone(c),
    a = derived(c, catalog).attributes;
  out.willpower.superficial = Math.max(
    0,
    c.willpower.superficial - Math.max(a.autocontrole, a.determinacao),
  );
  if (ambition)
    out.willpower.aggravated = Math.max(0, out.willpower.aggravated - 1);
  out.lastSessionRecovery = sessionId;
  return {
    character: out,
    recoveredSuperficial: c.willpower.superficial - out.willpower.superficial,
    recoveredAggravated: c.willpower.aggravated - out.willpower.aggravated,
  };
}
