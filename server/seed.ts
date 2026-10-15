import { contentSchema, Content } from "../shared/model";
import powerIndex from "../shared/power-index.json";
export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const d = (name: string) => "discipline-" + slug(name);
const reference = (document: string, page: number, note = "") => ({
  document,
  page,
  note,
});
const make = (id: string, data: Record<string, unknown>): Content => ({
  ...contentSchema.parse(data),
  revision: 9,
  id,
  version: 1,
});
export function seedCatalog(): Content[] {
  const catalog: Content[] = [];
  const add = (id: string, data: Record<string, unknown>) =>
    catalog.push(make(id, data));
  const disciplines = [
    ["Animalismo", 223],
    ["Auspícios", 228],
    ["Celeridade", 233],
    ["Dominação", 237],
    ["Fortitude", 241],
    ["Ofuscação", 245],
    ["Potência", 249],
    ["Presença", 253],
    ["Metamorfose", 257],
    ["Feitiçaria do Sangue", 260],
    ["Alquimia Sangue-Ralo", 273],
  ] as const;
  for (const [name, page] of disciplines)
    add(d(name), {
      kind: "discipline",
      name,
      origin: "official",
      description: "Consulte os poderes e a referência local desta Disciplina.",
      references: [reference("basico", page)],
      automation: "partial",
    });
  const clans = [
    [
      "Brujah",
      ["Celeridade", "Potência", "Presença"],
      63,
      64,
      "Subtraia dados iguais à Gravidade da Perdição para resistir ao frenesi de fúria, mínimo um dado.",
      "Rebeldia",
    ],
    [
      "Gangrel",
      ["Animalismo", "Fortitude", "Metamorfose"],
      67,
      67,
      "Traços animais após um frenesi; duração e penalidades exigem decisão do Narrador.",
      "Impulsos selvagens",
    ],
    [
      "Malkavian",
      ["Auspícios", "Dominação", "Ofuscação"],
      70,
      71,
      "Aflição escolhida com o Narrador; penalidades conforme a Gravidade da Perdição.",
      "Delírio",
    ],
    [
      "Nosferatu",
      ["Animalismo", "Ofuscação", "Potência"],
      74,
      75,
      "Aparência sobrenaturalmente repulsiva e restrições de disfarce.",
      "Criptofilia",
    ],
    [
      "Toreador",
      ["Auspícios", "Celeridade", "Presença"],
      77,
      78,
      "Penalidades em ambientes considerados esteticamente desagradáveis.",
      "Obsessão",
    ],
    [
      "Tremere",
      ["Auspícios", "Dominação", "Feitiçaria do Sangue"],
      81,
      82,
      "Não consegue criar Laços com outros vampiros; vínculos com mortais e carniçais são alterados.",
      "Perfeccionismo",
    ],
    [
      "Ventrue",
      ["Dominação", "Fortitude", "Presença"],
      84,
      85,
      "Restrição de presa definida na criação; alimentar-se fora dela exige as verificações da fonte.",
      "Arrogância",
    ],
  ] as const;
  for (const [name, ds, page, banePage, bane, compulsion] of clans)
    add("clan-" + slug(name), {
      kind: "clan",
      name,
      origin: "official",
      disciplines: ds.map(d),
      bane,
      compulsion,
      baneSeverity:
        "Derivada da Potência do Sangue e da versão de regras da campanha.",
      references: [reference("basico", page), reference("basico", banePage)],
      automation: "narrative",
    });
  for (const [name, ds, page] of [
    ["Ravnos", ["Animalismo", "Ofuscação", "Presença"], 6],
    ["Salubri", ["Auspícios", "Dominação", "Fortitude"], 12],
    ["Tzimisce", ["Animalismo", "Dominação", "Metamorfose"], 16],
  ] as const)
    add("clan-" + slug(name), {
      kind: "clan",
      name,
      origin: "official",
      disciplines: ds.map(d),
      description:
        "Clã adicional do Guia Suplementar. Consulte sua Perdição e Compulsão na fonte local.",
      references: [reference("companion", page)],
      automation: "narrative",
    });
  add("clan-caitiff", {
    kind: "clan",
    name: "Caitiff",
    origin: "official",
    disciplines: disciplines
      .filter(([n]) => !n.startsWith("Alquimia"))
      .map(([n]) => d(n)),
    bane: "Sem Perdição comum de Clã. Começa Suspeito; restrição a Status na criação.",
    references: [reference("basico", 87)],
    automation: "partial",
  });
  add("clan-sangue-ralo", {
    kind: "clan",
    name: "Sangue-Ralo",
    origin: "official",
    description:
      "Gerações 14–16, Potência 0; criação e Alquimia exigem os procedimentos próprios.",
    references: [reference("basico", 87), reference("basico", 128)],
    automation: "partial",
  });
  for (const p of powerIndex) {
    const kind = p.id.startsWith("ritual-")
      ? "ritual"
      : p.id.startsWith("formula-")
        ? "formula"
        : "power";
    const parentId = d(
      kind === "ritual" ? "Feitiçaria do Sangue" : p.discipline,
    );
    add(p.id, {
      kind,
      name: p.name,
      level: p.level,
      parentId,
      origin: "official",
      description:
        "Entrada de consulta. Leia a página indicada antes de resolver este efeito.",
      references: [
        reference(
          "basico",
          p.page,
          "Página do PDF fornecido; a remissão interna pode usar a paginação de outra edição.",
        ),
      ],
      automation: "unreviewed",
      notes:
        "Custos, exceções e efeitos desta entrada ainda precisam de revisão individual. A interface não assume custo zero como regra oficial.",
    });
  }
  for (const [name, disc, level, page] of [
    ["Manipulação em Massa", "Dominação", 5, 240],
    ["Pegada Assombrosa", "Potência", 3, 251],
    ["Círculo de Proteção Contra Carniçais", "Rituais", 2, 268],
    ["Longo Alcance", "Alquimia Sangue-Ralo", 1, 277],
  ] as const) {
    const kind =
      disc === "Rituais"
        ? "ritual"
        : disc.startsWith("Alquimia")
          ? "formula"
          : "power";
    add(kind + "-" + slug(disc) + "-" + slug(name), {
      kind,
      name,
      level,
      parentId: d(disc === "Rituais" ? "Feitiçaria do Sangue" : disc),
      origin: "official",
      references: [reference("basico", page)],
      automation: "unreviewed",
      description:
        "Consulte a regra na fonte local; automação individual pendente.",
    });
  }
  // Automação limitada aos efeitos revistos diretamente nos PDFs.
  const fogIndex = catalog.findIndex(
    (x) => x.kind === "formula" && x.name === "Névoa",
  );
  if (fogIndex >= 0)
    catalog[fogIndex] = make(catalog[fogIndex].id, {
      ...catalog[fogIndex],
      automation: "partial",
      rouse: 1,
      duration: "scene",
      description:
        "Névoa acompanha o usuário. Identificar ou atingir com ataque à distância sofre −2 dados; um Despertar adicional amplia a nuvem a até cinco pessoas. Dura uma cena ou até encerrar. Use a preparação própria do método de Alquimia.",
      references: [
        reference("basico", 277, "Névoa"),
        reference("basico", 274, "Custos e qualidade da mistura"),
        reference("basico", 276, "Métodos de destilação"),
      ],
      notes:
        "A tabela de destilação descreve apenas 2, 4 e 6 sucessos. Resultados fracos, aumentados, intermediários ou Críticos Confusos exigem resolução do Narrador. O grupo inclui o usuário no limite de cinco, como critério desta implementação.",
    });
  const reachIndex = catalog.findIndex(
    (x) => x.id === "formula-alquimia-sangue-ralo-longo-alcance",
  );
  if (reachIndex >= 0)
    catalog[reachIndex] = make(catalog[reachIndex].id, {
      ...catalog[reachIndex],
      automation: "partial",
      rouse: 1,
      duration: "turn",
      description:
        "Move alvos visíveis de menos de 100 kg a cerca de 10 metros. Determinação + Alquimia contra Força + Atletismo para quem resiste; sustentar exige dificuldade 3 a cada turno. Manipulação delicada usa Raciocínio + Alquimia; precisão com faca ou ferramenta usa −2 dados. Use preparação e ativação próprias do método.",
      references: [
        reference("basico", 277, "Longo Alcance"),
        reference("basico", 101, "Disputas"),
        reference("basico", 102, "Conflitos"),
        reference("basico", 104, "Dano"),
      ],
      notes:
        "Automação do efeito normal: movimento, disputa, arremesso superficial por margem e sustentação. Peso, visibilidade e alcance aproximado são confirmados na cena. Puxar usa empate a favor do agente; arremesso exige margem positiva como conflito físico unilateral. Faca: precisão registrada, mas ataque e bônus +1 de dano são resolvidos separadamente. Altura, queda e objetos frágeis exigem Narrador. Um registro de uso por ativação/turno e fechamento ao avançar são critérios operacionais; divisão de ações não implementada.",
    });
  const envelopIndex = catalog.findIndex(
    (x) => x.id === "formula-alquimia-sangue-ralo-envolver",
  );
  if (envelopIndex >= 0)
    catalog[envelopIndex] = make(catalog[envelopIndex].id, {
      ...catalog[envelopIndex],
      automation: "partial",
      rouse: 1,
      duration: "scene",
      description:
        "Envolve um único alvo visível em névoa: −3 dados em detecção visual e ataques à distância. Para sufocar um mortal, dispute Raciocínio + Alquimia contra Vigor + Sobrevivência. Vitória restringe a tossir/sufocar; vitória crítica causa inconsciência. Dura uma cena ou até encerrar voluntariamente.",
      references: [
        reference("basico", 277, "Envolver: custo, alvo e penalidade"),
        reference("basico", 278, "Asfixia, alvo único e duração"),
        reference("basico", 101, "Disputas"),
      ],
      notes:
        "A obstrução visual não exige a disputa de asfixia. Um alvo por alquimista, incluindo substituição de Fixatio. A ferramenta limita uma tentativa de asfixia por ativação/turno e usa empate favorável ao agente como critério de disputa. Não há dano periódico presumido. Inconsciência permanece até recuperação resolvida pelo Narrador, mesmo após a névoa encerrar. −3 não se multiplica pela sobreposição; com Névoa defensiva, as penalidades distintas são cumulativas. Detecção visual exige contexto explícito; Armas de Fogo é reconhecida automaticamente.",
    });
  const flightIndex = catalog.findIndex(
    (x) => x.id === "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar",
  );
  if (flightIndex >= 0)
    catalog[flightIndex] = make(catalog[flightIndex].id, {
      ...catalog[flightIndex],
      automation: "partial",
      rouse: 1,
      duration: "scene",
      description:
        "Voo pessoal em qualquer direção, aproximadamente à velocidade de corrida; transportar uma massa humana reduz à caminhada. Levar quem resiste ou puxar o voador ao chão exige Força + Alquimia contra Força + Atletismo. Dura uma cena. Nível 4: ao menos três noites de destilação e pesquisa prévia de três meses, com gota de vitae confirmada pelo Narrador.",
      references: [
        reference("basico", 279, "Impulso e requisitos do nível 4"),
        reference("basico", 280, "Duração"),
        reference("basico", 101, "Disputas"),
      ],
      notes:
        "Preparação paga ao iniciar; o Narrador registra a conclusão do trabalho e a pesquisa já realizada, sem presumir atividade a cada noite avançada. A fórmula própria não nomeia uma Disciplina simulada para a compatibilidade da gota de vitae: origem resolvida e registrada pelo Narrador. Não há metros por turno, peso numérico de massa humana, altura máxima ou dano de queda presumidos. Um uso por ativação/turno é critério operacional. Empate favorece o agente: alquimista ao levar, oponente ao puxar ao chão. Transporte não cria agarramento comum; posicionamento e interações complexas são narrativos.",
    });
  const patch = (name: string, changes: Record<string, unknown>) => {
    const i = catalog.findIndex((x) => x.kind === "power" && x.name === name);
    if (i >= 0) catalog[i] = make(catalog[i].id, { ...catalog[i], ...changes });
  };
  patch("Resiliência", {
    description: "Adiciona o nível de Fortitude à Vitalidade.",
    automation: "complete",
    duration: "permanent",
    effects: [
      { kind: "health", value: 1, scale: "discipline", duration: "permanent" },
    ],
  });
  patch("Mente Inabalável", {
    description:
      "Fortitude acrescenta dados à resistência a coerção quando aplicável.",
    automation: "partial",
    duration: "permanent",
    effects: [
      {
        kind: "dice",
        target: "all",
        value: 1,
        scale: "discipline",
        duration: "permanent",
        when: { field: "tag", operator: "includes", value: "resistirCoercao" },
      },
    ],
  });
  patch("Sentidos Aguçados", {
    description:
      "Auspícios acrescenta dados à percepção. Sobrecarga sensorial deve ser resolvida pelo Narrador.",
    automation: "partial",
    effects: [
      {
        kind: "dice",
        target: "percepcao",
        value: 1,
        scale: "discipline",
        duration: "scene",
      },
    ],
  });
  patch("Fascínio", {
    description:
      "Presença acrescenta dados à Persuasão e Performance em situações apropriadas. Resistência e exceções seguem a fonte.",
    automation: "partial",
    effects: ["persuasao", "performance"].map((target) => ({
      kind: "dice",
      target,
      value: 1,
      scale: "discipline",
      duration: "scene",
    })),
  });
  patch("Amedrontar", {
    description: "Consulte restrições e resistência na fonte antes de aplicar.",
    automation: "partial",
    effects: [
      {
        kind: "dice",
        target: "intimidacao",
        value: 1,
        scale: "discipline",
        duration: "scene",
      },
    ],
  });
  patch("Olhos da Besta", {
    description:
      "Visão na escuridão e +2 dados de Intimidação contra mortais; a remoção de penalidades de escuridão é narrativa.",
    automation: "partial",
    effects: [
      {
        kind: "dice",
        target: "intimidacao",
        value: 2,
        duration: "scene",
        when: { field: "tag", operator: "includes", value: "alvoMortal" },
      },
    ],
  });
  patch("O Peso da Pena", {
    description:
      "Ativação reativa usa Raciocínio + Sobrevivência, dificuldade 3. Efeito sobre quedas é narrativo.",
    automation: "partial",
    attribute: "raciocinio",
    skill: "sobrevivencia",
    difficulty: 3,
  });
  patch("Sentir a Besta", {
    description:
      "Teste resistido; a informação e sua interpretação são narrativas.",
    automation: "partial",
    attribute: "determinacao",
    skill: d("Animalismo"),
    resistanceAttribute: "autocontrole",
    resistanceSkill: "subterfugio",
  });
  patch("Memória Inativa", {
    description:
      "Sem teste contra mortal despreparado; resistência usa as paradas abaixo. A memória é resolvida pelo Narrador.",
    automation: "partial",
    attribute: "carisma",
    skill: d("Dominação"),
    resistanceAttribute: "raciocinio",
    resistanceSkill: "determinacao",
  });
  patch("Corpo Letal", {
    description:
      "Ataques desarmados podem causar agravado a mortais, à escolha do usuário; ignora um nível de armadura por ponto de Potência. Integrado ao combate.",
    automation: "partial",
    duration: "permanent",
    rouse: 0,
    references: [reference("basico", 250)],
  });
  patch("Rigidez", {
    description:
      "Reduz dano superficial antes da divisão, mínimo 1; gerido no módulo de dano.",
    automation: "partial",
    rouse: 1,
    effects: [{ kind: "condition", target: "Rigidez", duration: "scene" }],
  });
  const bonus = (
    name: string,
    points: number,
    kind = "background",
    page = 160,
  ) =>
    add(kind + "-" + slug(name), {
      kind,
      name,
      points,
      maxLevel: kind === "background" ? 5 : points,
      origin: "official",
      references: [reference("basico", page)],
      automation: "narrative",
    });
  for (const [name, page] of [
    ["Aliados", 160],
    ["Contatos", 161],
    ["Fama", 161],
    ["Refúgio", 164],
    ["Rebanho", 166],
    ["Influência", 167],
    ["Máscara", 168],
    ["Mawla", 169],
    ["Recursos", 169],
    ["Lacaios", 170],
    ["Status", 170],
  ] as const)
    bonus(name, 1, "background", page);
  for (const [name, points, kind, page] of [
    ["Garganta de Ferro", 2, "merit", 158],
    ["Belo", 1, "merit", 156],
    ["Deslumbrante", 2, "merit", 156],
    ["Feio", 1, "flaw", 156],
    ["Repulsivo", 2, "flaw", 156],
    ["Analfabeto", 2, "flaw", 156],
    ["Arcaico", 2, "flaw", 157],
    ["Segredo Sombrio", 1, "flaw", 162],
    ["Exclusão de Presa", 1, "flaw", 158],
    ["Fazendeiro", 2, "flaw", 157],
    ["Inimigo", 2, "flaw", 160],
    ["Suspeito", 1, "flaw", 171],
    ["Evitado", 2, "flaw", 171],
    ["Linguística", 1, "merit", 155],
  ] as const)
    bonus(name, points, kind, page);
  for (const [name, modifier] of [
    ["Belo", 1],
    ["Deslumbrante", 2],
    ["Feio", -1],
    ["Repulsivo", -2],
  ] as const) {
    const e = catalog.find((c) => c.name === name)!;
    e.automation = "partial";
    e.description =
      "Modificador de Aparência em paradas sociais apropriadas quando o personagem pode ser visto, conforme o Narrador.";
    e.effects = contentSchema.parse({
      ...e,
      effects: [
        {
          kind: "dice",
          target: "all",
          value: modifier,
          duration: "permanent",
          when: { field: "tag", operator: "includes", value: "testeAparencia" },
        },
      ],
    }).effects;
  }
  const nosferatu = catalog.find((c) => c.id === "clan-nosferatu")!;
  nosferatu.effects = contentSchema.parse({
    ...nosferatu,
    effects: [
      {
        kind: "dice",
        target: "all",
        value: -2,
        duration: "permanent",
        when: { field: "tag", operator: "includes", value: "testeAparencia" },
      },
    ],
  }).effects;
  nosferatu.automation = "partial";
  const bondEntries = [
    {
      name: "Escravo de Laço",
      kind: "flaw",
      points: 2,
      bondRule: { instant: true },
      description:
        "Forma o Laço com o primeiro gole direto; a condição inicial com o Senhor exige registro do Narrador.",
    },
    {
      name: "Viciado em Laço",
      kind: "flaw",
      points: 1,
      bondRule: { resistance: -1 },
      description: "Subtrai um dado dos desafios ao Laço.",
    },
    {
      name: "Laço Longo",
      kind: "flaw",
      points: 1,
      bondRule: { decay: "long" },
      description: "Perde um ponto de Força por três meses sem reforço.",
    },
    {
      name: "Resistência ao Laço",
      kind: "merit",
      points: 1,
      maxLevel: 3,
      bondRule: { resistance: 1, perLevel: true },
      description:
        "Acrescenta um dado por ponto aos desafios, até três pontos.",
    },
    {
      name: "Laço Curto",
      kind: "merit",
      points: 2,
      bondRule: { decay: "short" },
      description:
        "Perde Força nas luas cheia e nova sem reforço. O Narrador confirma a mudança de lua.",
    },
    {
      name: "Inlaçável",
      kind: "merit",
      points: 3,
      bondRule: { immune: true },
      description:
        "Não pode ser enlaçado pelo Sangue. Também chamado Imune ao Laço no Companion.",
    },
  ];
  for (const e of bondEntries)
    add(e.kind + "-" + slug(e.name), {
      ...e,
      minLevel: e.points,
      maxLevel: e.maxLevel ?? e.points,
      origin: "official",
      category: "Laço",
      references: [reference("basico", 157)],
      automation: "partial",
    });
  catalog.find((x) => x.id === "clan-tremere")!.bondRule = contentSchema.parse({
    name: "Tremere",
    kind: "clan",
    bondRule: { binding: "blocked" },
  }).bondRule;
  add("merit-sangue-concatenado", {
    name: "Sangue Concatenado",
    kind: "merit",
    points: 0,
    minLevel: 1,
    maxLevel: 1,
    category: "Sangue-Ralo",
    origin: "official",
    bondRule: { binding: "allowed" },
    references: [reference("basico", 160)],
    automation: "partial",
    description:
      "Permite criar Laços e realizar o Abraço; limite de servos em Potência zero precisa de decisão do Narrador.",
  });
  add("flaw-fragilidade-mortal", {
    name: "Fragilidade Mortal",
    kind: "flaw",
    points: 0,
    minLevel: 1,
    maxLevel: 1,
    category: "Sangue-Ralo",
    origin: "official",
    references: [reference("basico", 159)],
    automation: "partial",
    description:
      "Impede recuperar Vitalidade ao Despertar o Sangue; cura mortal precisa de assistência e tempo próprios.",
  });
  const thinEntries = [
    {
      id: "flaw-temperamento-bestial",
      name: "Temperamento Bestial",
      kind: "flaw",
      page: 159,
      description:
        "Sofre Frenesi espontâneo conforme as regras vampíricas normais.",
      automation: "partial",
    },
    {
      id: "flaw-marcado-pela-camarilla",
      name: "Marcado pela Camarilla",
      kind: "flaw",
      page: 159,
      description:
        "Marca incurável e vigilância da Camarilla; pode coexistir com Contato Camarilla.",
      automation: "narrative",
    },
    {
      id: "flaw-maldicao-de-cla",
      name: "Maldição de Clã",
      kind: "flaw",
      page: 159,
      description:
        "Selecione uma Perdição de Clã, com Gravidade 1. Brujah/Gangrel exigem Temperamento Bestial; Tremere exige Sangue Concatenado. Não concede Compulsão de Clã.",
      automation: "partial",
    },
    {
      id: "flaw-carne-morta",
      name: "Carne Morta",
      kind: "flaw",
      page: 159,
      description:
        "Aparência de decomposição; exames médicos identificam morte. Penalidade de um dado em teste social cara a cara com mortal: confirme a etiqueta caraACaraMortal.",
      incompatible: ["merit-realistico"],
      automation: "partial",
      effects: [
        {
          kind: "dice",
          target: "all",
          value: -1,
          duration: "permanent",
          when: { field: "tag", value: "caraACaraMortal" },
        },
      ],
    },
    {
      id: "flaw-evitado-pelos-anarquistas",
      name: "Evitado pelos Anarquistas",
      kind: "flaw",
      page: 159,
      description:
        "Rejeição pelos Anarquistas; incompatível com Companheiros Anarquistas.",
      incompatible: ["merit-companheiros-anarquistas"],
      automation: "narrative",
    },
    {
      id: "flaw-dependencia-de-vitae",
      name: "Dependência de Vitae",
      kind: "flaw",
      page: 159,
      description:
        "Precisa saciar pelo menos uma Fome com Sangue vampírico por semana; sem isso não ganha ou usa Disciplinas, incluindo Alquimia. Controle da semana e poderes passivos ainda exigem resolução do Narrador.",
      automation: "narrative",
    },
    {
      id: "merit-companheiros-anarquistas",
      name: "Companheiros Anarquistas",
      kind: "merit",
      page: 159,
      description:
        "Uma Coterie Anarquista tolera e protege o personagem, atuando coletivamente como Mawla. A fonte não define um nível numérico; registre a relação.",
      incompatible: ["flaw-evitado-pelos-anarquistas"],
      automation: "narrative",
    },
    {
      id: "merit-contato-camarilla",
      name: "Contato Camarilla",
      kind: "merit",
      page: 160,
      description:
        "Recrutador Camarilla equivalente a Mawla 1, com tarefas e vigilância. Compatível com Marcado pela Camarilla.",
      automation: "narrative",
    },
    {
      id: "merit-bebedor-do-dia",
      name: "Bebedor do Dia",
      kind: "merit",
      page: 160,
      description:
        "Sob luz diurna, Vitalidade é reduzida à metade (para cima), perde capacidades vampíricas e benefícios de Vitalidade, mas não recebe dano solar. Fome permanece; comprometimento/Torpor temporários dependem dos ferimentos. Estado diurno e cálculos desse efeito ainda são narrativos.",
      automation: "narrative",
    },
    {
      id: "merit-afinidade-de-disciplina",
      name: "Afinidade de Disciplina",
      kind: "merit",
      page: 160,
      description:
        "Na criação, escolhe uma Disciplina e ganha um ponto com um Poder. Pode evoluí-la a custo de fora do Clã. Ressonância não concede pontos temporários adicionais nessa Disciplina.",
      automation: "partial",
    },
    {
      id: "merit-realistico",
      name: "Realístico",
      kind: "merit",
      page: 160,
      description:
        "Batimento cardíaco, alimentação e atividades humanas; inspeções noturnas comuns parecem normais. Incompatível com Carne Morta.",
      incompatible: ["flaw-carne-morta"],
      automation: "narrative",
    },
    {
      id: "merit-alquimia-sangue-ralo",
      name: "Alquimia Sangue-Ralo",
      kind: "merit",
      page: 160,
      description:
        "Concede Alquimia 1 e uma fórmula de nível 1. Escolha o método inicial ao obter o ponto; pontos adicionais concedem uma fórmula cada. Preparação e ativação ainda exigem procedimentos de destilação próprios.",
      automation: "partial",
    },
  ];
  for (const { id, page, ...entry } of thinEntries)
    add(id, {
      ...entry,
      category: "Sangue-Ralo",
      origin: "official",
      points: 0,
      minLevel: 1,
      maxLevel: 1,
      references: [reference("basico", page)],
    });
  const predators = [
    [
      "Gato de Rua",
      152,
      ["Celeridade", "Potência"],
      [
        ["briga", "Agarrar"],
        ["intimidacao", "Assalto a Mão Armada"],
      ],
      -1,
      0,
      [["background-contatos", 3]],
    ],
    [
      "Ensacador",
      152,
      ["Feitiçaria do Sangue", "Ofuscação"],
      [
        ["ladroagem", "Arrombar Fechaduras"],
        ["manha", "Mercado Negro"],
      ],
      0,
      0,
      [
        ["merit-garganta-de-ferro", 2],
        ["flaw-inimigo", 2],
      ],
    ],
    [
      "Sanguessuga",
      152,
      ["Celeridade", "Metamorfose"],
      [
        ["briga", "Membros"],
        ["furtividade", "Contra Membros"],
      ],
      -1,
      1,
      [
        ["flaw-segredo-sombrio", 2],
        ["flaw-exclusao-de-presa", 2],
      ],
    ],
    [
      "Apegado",
      153,
      ["Dominação", "Animalismo"],
      [
        ["persuasao", "Abuso Psicológico"],
        ["subterfugio", "Disfarces"],
      ],
      0,
      0,
      [
        ["flaw-segredo-sombrio", 1],
        ["background-rebanho", 2],
      ],
    ],
    [
      "Consensualista",
      153,
      ["Auspícios", "Fortitude"],
      [
        ["medicina", "Flebotomia"],
        ["persuasao", "Recipientes"],
      ],
      1,
      0,
      [
        ["flaw-segredo-sombrio", 1],
        ["flaw-exclusao-de-presa", 1],
      ],
    ],
    [
      "Fazendeiro",
      153,
      ["Animalismo", "Metamorfose"],
      [
        ["empatiaAnimais", "Animal específico"],
        ["sobrevivencia", "Caçar"],
      ],
      1,
      0,
      [["flaw-fazendeiro", 2]],
    ],
    [
      "Osíris",
      154,
      ["Feitiçaria do Sangue", "Presença"],
      [
        ["ocultismo", "Tradição específica"],
        ["performance", "Campo de entretenimento"],
      ],
      0,
      0,
      [],
    ],
    [
      "João Pestana",
      154,
      ["Auspícios", "Ofuscação"],
      [
        ["medicina", "Anestésico"],
        ["furtividade", "Invasão"],
      ],
      0,
      0,
      [["background-recursos", 1]],
    ],
    [
      "Rainha da Cena",
      154,
      ["Dominação", "Potência"],
      [
        ["etiqueta", "Cena específica"],
        ["lideranca", "Cena específica"],
        ["manha", "Cena específica"],
      ],
      0,
      0,
      [
        ["background-fama", 1],
        ["background-contatos", 1],
      ],
    ],
    [
      "Sedutor",
      155,
      ["Fortitude", "Presença"],
      [
        ["persuasao", "Sedução"],
        ["subterfugio", "Sedução"],
      ],
      0,
      0,
      [
        ["merit-belo", 2],
        ["flaw-inimigo", 1],
      ],
    ],
  ] as const;
  for (const [
    name,
    page,
    ds,
    ss,
    humanityChange,
    potencyChange,
    grants,
  ] of predators)
    add("predator-" + slug(name), {
      kind: "predator",
      name,
      origin: "official",
      disciplines: ds.map(d),
      specialties: ss.map(([skill, name]) => ({ skill, name })),
      humanityChange,
      potencyChange,
      grants: grants.map(([contentId, level]) => ({ contentId, level })),
      references: [reference("basico", page)],
      automation: ["Osíris", "Rainha da Cena", "Ensacador"].includes(name)
        ? "partial"
        : "complete",
      notes: ["Osíris", "Rainha da Cena"].includes(name)
        ? "Escolhas de Vantagens/Defeitos adicionais exigem registro manual autorizado; consulte a página."
        : name === "Ensacador"
          ? "Conflito documental: o bloco do Predador lista Esôfago de Ferro •••, mas a Qualidade Garganta de Ferro aparece com •• na p. 158. Revisão com Narrador necessária."
          : "",
    });
  add("merit-resiliencia-vampirica", {
    name: "Resiliência Vampírica",
    kind: "merit",
    points: 0,
    minLevel: 1,
    maxLevel: 1,
    category: "Sangue-Ralo",
    origin: "official",
    incompatible: ["flaw-fragilidade-mortal"],
    description:
      "Sangue-Ralo trata perfurações e cortes comuns como superficial, como um vampiro regular.",
    references: [reference("basico", 160)],
    automation: "partial",
  });
  catalog.find((x) => x.id === "flaw-fragilidade-mortal")!.incompatible = [
    "merit-resiliencia-vampirica",
  ];
  add("flaw-dentes-de-bebe", {
    name: "Dentes de Bebê",
    kind: "flaw",
    points: 0,
    minLevel: 1,
    maxLevel: 1,
    category: "Sangue-Ralo",
    origin: "official",
    description:
      "Presas ausentes ou inúteis para se alimentar; use cortes ou extração. Mordida vampírica automatizada bloqueada.",
    references: [reference("basico", 159)],
    automation: "partial",
  });
  add("flaw-isca-de-estaca", {
    name: "Isca de Estaca",
    kind: "flaw",
    points: 2,
    minLevel: 2,
    maxLevel: 2,
    category: "Mítico",
    origin: "official",
    description:
      "Estaqueamento através do coração causa Morte Final, em vez de apenas paralisar.",
    references: [reference("basico", 158)],
    automation: "partial",
  });
  for (const [name, damage] of [
    ["Estaca / arma improvisada", 0],
    ["Soco-inglês", 1],
    ["Bastão / porrete", 2],
    ["Canivete / seta de besta", 2],
    ["Pistola .22", 2],
    ["Espada larga / machado", 3],
    ["Pistola 9 mm / rifle .308", 3],
    ["Espingarda 12 / Magnum .357", 4],
    ["Claymore / viga de aço", 4],
  ] as const)
    add("equipment-" + slug(name), {
      name,
      kind: "equipment",
      origin: "official",
      equipmentType: "weapon",
      damageSource:
        name.includes("Pistola") || name.includes("Espingarda")
          ? "gunshot"
          : name.includes("Espada") ||
              name.includes("Canivete") ||
              name.includes("Claymore") ||
              name.includes("Estaca")
            ? "piercing"
            : name.includes("Bastão")
              ? "heavyBlunt"
              : "blunt",
      damage,
      description:
        "Índice de arma padrão. Adicione à margem da disputa. Tipo de dano depende da vítima e da fonte.",
      references: [reference("basico", 297)],
      automation: "partial",
      cost: "Aquisição por Recursos e decisão do Narrador; não há preço universal nesta tabela.",
    });
  for (const [name, armor] of [
    ["Roupa reforçada", 2],
    ["Tecido balístico", 2],
    ["Colete de kevlar", 4],
    ["Blindagem militar / SWAT", 6],
  ] as const)
    add("equipment-" + slug(name), {
      name,
      kind: "equipment",
      origin: "official",
      equipmentType: "armor",
      armor,
      armorAgainstBullets: name !== "Roupa reforçada",
      dexterityPenalty: armor === 6 ? 1 : 0,
      properties:
        "Blindagem " +
        armor +
        ". Converte dano agravado de armas cortantes/perfurantes em superficial para mortais e Sangues-Ralos. Roupa reforçada não protege contra balas; blindagem militar impõe −1 dado à Destreza.",
      references: [reference("basico", 298)],
      automation: "partial",
      cost: "Definido pelo Narrador conforme Recursos.",
    });
  return catalog;
}
