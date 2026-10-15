import { Character, Content } from "./model";

export const ALCHEMY = "discipline-alquimia-sangue-ralo";
export const alchemyMethods = [
  { value: "athanor", label: "Athanor Corporis — Vigor + Alquimia" },
  { value: "calcinatio", label: "Calcinatio — Manipulação + Alquimia" },
  { value: "fixatio", label: "Fixatio — Inteligência + Alquimia" },
];
export const isThinBlood = (c: Character) =>
  c.nature === "vampire" && c.generation >= 14;
export const hasTrait = (c: Character, id: string) =>
  c.advantages.some((a) => a.contentId === id && a.level > 0);
export function thinBloodTraits(c: Character, catalog: Content[]) {
  return c.advantages
    .map((a) => ({ ...a, entry: catalog.find((e) => e.id === a.contentId) }))
    .filter((a) => a.entry?.category === "Sangue-Ralo");
}
export function effectiveBaneClan(c: Character) {
  return isThinBlood(c)
    ? hasTrait(c, "flaw-maldicao-de-cla")
      ? c.thinBlood.clanCurse
      : ""
    : c.clanId;
}
export function canTestFrenzy(c: Character, supernatural = false) {
  return (
    c.nature === "vampire" &&
    (!isThinBlood(c) ||
      hasTrait(c, "flaw-temperamento-bestial") ||
      supernatural)
  );
}
// Básico PDF 128,130–131,159–160. Escolhas ficam separadas dos pontos comuns.
export function projectThinBloodGrants(c: Character, catalog: Content[]) {
  const out = structuredClone(c);
  if (!isThinBlood(c)) return out;
  const choice = c.thinBlood;
  if (
    hasTrait(c, "merit-afinidade-de-disciplina") &&
    catalog.some(
      (e) =>
        e.id === choice.affinityDiscipline &&
        e.kind === "discipline" &&
        e.id !== ALCHEMY,
    )
  ) {
    out.disciplines[choice.affinityDiscipline] = Math.max(
      1,
      out.disciplines[choice.affinityDiscipline] ?? 0,
    );
    if (
      catalog.some(
        (e) =>
          e.id === choice.affinityPower &&
          e.kind === "power" &&
          e.parentId === choice.affinityDiscipline &&
          e.level === 1,
      ) &&
      !out.powers.includes(choice.affinityPower)
    )
      out.powers.push(choice.affinityPower);
  }
  if (hasTrait(c, "merit-alquimia-sangue-ralo")) {
    out.disciplines[ALCHEMY] = Math.max(1, out.disciplines[ALCHEMY] ?? 0);
    if (
      catalog.some(
        (e) =>
          e.id === choice.initialFormula &&
          e.kind === "formula" &&
          e.parentId === ALCHEMY &&
          e.level === 1,
      ) &&
      !out.powers.includes(choice.initialFormula)
    )
      out.powers.push(choice.initialFormula);
  }
  return out;
}
export function validateThinBloodCreation(
  c: Character,
  catalog: Content[],
  permitted: (entry: Content, character: Character) => boolean,
) {
  if (!isThinBlood(c)) return [];
  const issues: string[] = [],
    traits = thinBloodTraits(c, catalog);
  const merits = traits.filter((a) => a.entry?.kind === "merit"),
    flaws = traits.filter((a) => a.entry?.kind === "flaw");
  if (merits.length < 1 || merits.length > 3 || flaws.length !== merits.length)
    issues.push(
      "Sangue-Ralo: escolha de uma a três Qualidades e o mesmo número de Defeitos, sem custo em pontos.",
    );
  if (new Set(traits.map((a) => a.contentId)).size !== traits.length)
    issues.push("Não repita uma característica de Sangue-Ralo.");
  if (
    traits.some(
      (a) =>
        a.level !== 1 ||
        a.entry?.points !== 0 ||
        !["merit", "flaw"].includes(a.entry?.kind ?? ""),
    )
  )
    issues.push(
      "Características de Sangue-Ralo são escolhas únicas, sem custo, e não níveis ou pontos comuns.",
    );
  const choice = c.thinBlood,
    projected = projectThinBloodGrants(c, catalog);
  if (hasTrait(c, "merit-afinidade-de-disciplina")) {
    const disc = catalog.find(
      (e) =>
        e.id === choice.affinityDiscipline &&
        e.kind === "discipline" &&
        e.id !== ALCHEMY,
    );
    const power = catalog.find(
      (e) =>
        e.id === choice.affinityPower &&
        e.kind === "power" &&
        e.parentId === disc?.id &&
        e.level === 1,
    );
    if (!disc || !power || !permitted(power, projected))
      issues.push(
        "Afinidade de Disciplina exige uma Disciplina e um Poder permitido de nível 1.",
      );
  } else if (choice.affinityDiscipline || choice.affinityPower)
    issues.push(
      "As escolhas de Afinidade exigem a Qualidade Afinidade de Disciplina.",
    );
  if (hasTrait(c, "merit-alquimia-sangue-ralo")) {
    const formula = catalog.find(
      (e) =>
        e.id === choice.initialFormula &&
        e.kind === "formula" &&
        e.parentId === ALCHEMY &&
        e.level === 1,
    );
    if (!choice.alchemyMethod || !formula || !permitted(formula, projected))
      issues.push(
        "Alquimia inicial exige método de destilação e uma fórmula permitida de nível 1.",
      );
  } else if (choice.alchemyMethod || choice.initialFormula)
    issues.push("Alquimia inicial exige sua Qualidade de Sangue-Ralo.");
  if (hasTrait(c, "flaw-maldicao-de-cla")) {
    const clan = catalog.find(
      (e) =>
        e.id === choice.clanCurse &&
        ["clan", "lineage"].includes(e.kind) &&
        !["clan-sangue-ralo", "clan-caitiff"].includes(e.id),
    );
    if (!clan)
      issues.push(
        "Maldição de Clã exige selecionar uma Perdição de Clã; Gravidade fixa 1.",
      );
    if (
      ["clan-brujah", "clan-gangrel"].includes(choice.clanCurse) &&
      !hasTrait(c, "flaw-temperamento-bestial")
    )
      issues.push("Perdição Brujah ou Gangrel exige Temperamento Bestial.");
    if (
      choice.clanCurse === "clan-tremere" &&
      !hasTrait(c, "merit-sangue-concatenado")
    )
      issues.push("Perdição Tremere exige Sangue Concatenado.");
  } else if (choice.clanCurse)
    issues.push(
      "Uma Perdição de Clã selecionada exige o Defeito Maldição de Clã.",
    );
  return issues;
}
