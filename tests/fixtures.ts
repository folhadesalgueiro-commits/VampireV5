import {
  Character,
  attributes,
  skills,
  characterSchema,
  emptyCharacter,
} from "../shared/model";
// Apenas cenários de teste; nunca carregados pelo catálogo ou pelo banco principal.
export function validThinCharacter(): Character {
  const c = {
    ...characterSchema.parse(emptyCharacter()),
    id: "fixture-thin",
    version: 1,
  };
  c.name = "Sangue-Ralo de teste";
  c.clanId = "clan-sangue-ralo";
  c.generation = 14;
  c.bloodPotency = 0;
  c.attributes = Object.fromEntries(
    attributes.map((k, i) => [k, [4, 3, 3, 3, 2, 2, 2, 2, 1][i]]),
  );
  c.skills = Object.fromEntries(
    skills.map((k, i) => [k, i < 3 ? 3 : i < 8 ? 2 : i < 15 ? 1 : 0]),
  );
  for (const k of ["erudicao", "oficios", "performance", "ciencia"])
    if (c.skills[k] > 0)
      c.specialties[k] = ["Especialização do cenário de teste"];
  c.specialties[skills[0]] = ["Especialização livre do cenário"];
  c.convictions = [
    {
      conviction: "Proteja sua família",
      pillar: "Familiar do cenário de teste",
    },
  ];
  c.advantages = [
    {
      contentId: "background-recursos",
      level: 3,
      source: "creation",
      notes: "",
    },
    {
      contentId: "background-refugio",
      level: 2,
      source: "creation",
      notes: "",
    },
    {
      contentId: "background-mascara",
      level: 2,
      source: "creation",
      notes: "",
    },
    { contentId: "flaw-inimigo", level: 2, source: "creation", notes: "" },
    {
      contentId: "merit-sangue-concatenado",
      level: 1,
      source: "creation",
      notes: "",
    },
    {
      contentId: "flaw-dentes-de-bebe",
      level: 1,
      source: "creation",
      notes: "",
    },
  ];
  return c;
}
