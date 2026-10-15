import { beforeEach, afterEach, describe, it, expect } from "vitest";
import request from "supertest";
import { Store } from "../server/db";
import { createApp } from "../server/app";
import { emptyCharacter } from "../shared/model";
import { validThinCharacter } from "./fixtures";
import { ALCHEMY } from "../shared/thin-blood";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let store: Store,
  app: ReturnType<typeof createApp>,
  gm: ReturnType<typeof request.agent>,
  player: ReturnType<typeof request.agent>,
  campaign: any,
  playerId: string;
const mutation = (agent: any, method: string, path: string, data: any = {}) =>
  agent[method](path).set("X-V5-CSRF", "1").send(data);
beforeEach(async () => {
  store = new Store(":memory:");
  app = createApp(store);
  gm = request.agent(app);
  player = request.agent(app);
  await mutation(gm, "post", "/api/auth/setup", {
    username: "narrador",
    name: "Narrador",
    password: "senha-de-teste-segura",
  }).expect(200);
  const account = await mutation(gm, "post", "/api/users", {
    username: "jogador",
    name: "Jogador",
    password: "senha-de-teste-segura",
  }).expect(201);
  playerId = account.body.id;
  await mutation(player, "post", "/api/auth/login", {
    username: "jogador",
    password: "senha-de-teste-segura",
  }).expect(200);
  const c = await mutation(gm, "post", "/api/entities/campaigns", {
    name: "Crônica de integração",
    gmId: "ignored",
    members: [playerId],
    privateNotes: "segredo do Narrador",
    ruleset: "companion",
  }).expect(201);
  campaign = c.body;
});
afterEach(() => store.close());
const createCharacter = async (agent = gm, extra: any = {}) =>
  (
    await mutation(agent, "post", "/api/entities/characters", {
      ...emptyCharacter(),
      name: "Personagem de teste",
      campaignId: campaign.id,
      ...extra,
    }).expect(201)
  ).body;
describe("API, SQLite e permissões", () => {
  it("exige sessão e proteção de origem", async () => {
    await request(app).get("/api/state").expect(401);
    await gm
      .post("/api/entities/content")
      .send({ name: "Teste", kind: "clan" })
      .expect(403);
  });
  it("login não exige nome de cadastro, inclusive quando um cliente envia nome vazio", async () => {
    const returning = request.agent(app);
    await mutation(returning, "post", "/api/auth/login", {
      username: "narrador",
      password: "senha-de-teste-segura",
      name: "",
    }).expect(200);
    expect((await returning.get("/api/state")).body.campaigns).toHaveLength(1);
  });
  it("a conta inicial só pode ser criada uma vez", async () => {
    await mutation(gm, "post", "/api/auth/setup", {
      username: "duplicado",
      password: "senha-de-teste-segura",
    }).expect(400);
  });
  it("ficha persiste e conflitos de versão não sobrescrevem trabalho", async () => {
    const c = await createCharacter();
    const result = await mutation(gm, "put", "/api/entities/" + c.id, {
      ...c,
      name: "Nome salvo",
    }).expect(200);
    expect(result.body.version).toBe(2);
    await mutation(gm, "put", "/api/entities/" + c.id, {
      ...c,
      name: "Nome antigo",
    }).expect(409);
    expect((await gm.get("/api/state")).body.characters[0].name).toBe(
      "Nome salvo",
    );
  });
  it("filtra anotações privadas no servidor", async () => {
    await createCharacter(gm, {
      ownerId: playerId,
      privateNotes: "informação secreta",
    });
    await mutation(gm, "post", "/api/entities/records", {
      name: "Segredo privado",
      kind: "secret",
      campaignId: campaign.id,
      private: true,
      privateNotes: "sigilo",
    }).expect(201);
    const s = (await player.get("/api/state")).body;
    expect(s.campaigns[0]).not.toHaveProperty("privateNotes");
    expect(s.characters[0]).not.toHaveProperty("privateNotes");
    expect(s.records).toHaveLength(0);
    expect(
      JSON.stringify((await player.get("/api/backup")).body),
    ).not.toContain("informação secreta");
  });
  it("jogador não pode conceder XP nem alterar outra ficha", async () => {
    const c = await createCharacter();
    await mutation(player, "put", "/api/entities/" + c.id, c).expect(403);
    const own = await createCharacter(player);
    await mutation(player, "post", "/api/characters/" + own.id + "/action", {
      action: "xp",
      amount: 30,
      reason: "Não autorizado",
    }).expect(400);
    await mutation(player, "put", "/api/entities/" + own.id, {
      ...own,
      xpTotal: 50,
    }).expect(400);
  });
  it("não modifica definições oficiais", async () => {
    const c = store.get("clan-brujah");
    await mutation(gm, "put", "/api/entities/" + c.id, c).expect(403);
    await mutation(gm, "delete", "/api/entities/" + c.id, {
      confirm: c.name,
    }).expect(403);
  });
  it("exclusão exige nome e permite restauração", async () => {
    const c = await createCharacter();
    await mutation(gm, "delete", "/api/entities/" + c.id, {
      confirm: "errado",
    }).expect(400);
    await mutation(gm, "delete", "/api/entities/" + c.id, {
      confirm: c.name,
    }).expect(200);
    expect((await gm.get("/api/state")).body.characters).toHaveLength(0);
    await mutation(gm, "post", "/api/trash/" + c.id + "/restore").expect(200);
    expect((await gm.get("/api/state")).body.characters).toHaveLength(1);
  });
  it("concessão e compra de XP são atômicas", async () => {
    const c = await createCharacter();
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "xp",
      amount: 10,
      reason: "Sessões concluídas",
    }).expect(200);
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "advance",
      kind: "attribute",
      key: "forca",
    }).expect(200);
    const out = store.get(c.id);
    expect(out.attributes.forca).toBe(2);
    expect(out.xpSpent).toBe(10);
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "advance",
      kind: "attribute",
      key: "forca",
    }).expect(400);
    expect(store.get(c.id).xpSpent).toBe(10);
  });
  it("rolagem funcional usa a ficha e registra o histórico", async () => {
    const c = await createCharacter(gm, {
      hunger: 3,
      attributes: { ...emptyCharacter().attributes, forca: 4 },
      skills: { ...emptyCharacter().skills, briga: 3 },
    });
    const r = await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      difficulty: 2,
    }).expect(200);
    expect(r.body.result.normal.length + r.body.result.hunger.length).toBe(7);
    expect(r.body.result.hunger.length).toBe(3);
    expect(
      (await gm.get("/api/characters/" + c.id + "/rolls")).body,
    ).toHaveLength(1);
  });
  it("gasto de Força de Vontade rerrola apenas dados normais uma vez", async () => {
    const c = await createCharacter(gm, {
      hunger: 1,
      attributes: { ...emptyCharacter().attributes, forca: 3 },
      skills: { ...emptyCharacter().skills, briga: 2 },
    });
    const r = await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      difficulty: 2,
    }).expect(200);
    const out = await mutation(
      gm,
      "post",
      "/api/rolls/" + r.body.id + "/reroll",
      { indices: [0, 1] },
    ).expect(200);
    expect(out.body.result.hunger).toEqual(r.body.result.hunger);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    await mutation(gm, "post", "/api/rolls/" + r.body.id + "/reroll", {
      indices: [0],
    }).expect(400);
  });
  it("dano e Remorso atualizam recursos e histórico", async () => {
    const c = await createCharacter(gm, { stains: 1 });
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "damage",
      amount: 3,
    }).expect(200);
    expect(store.get(c.id).health.superficial).toBe(2);
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "remorse",
    }).expect(200);
    expect(store.get(c.id).stains).toBe(0);
    expect(
      (await gm.get("/api/characters/" + c.id + "/history")).body.length,
    ).toBeGreaterThan(1);
  });
  it("não finaliza uma criação inválida sem exceção do Narrador", async () => {
    const c = await createCharacter(player);
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/finalize",
      {},
    ).expect(400);
    await mutation(gm, "post", "/api/characters/" + c.id + "/finalize", {
      exception: "Ficha especial autorizada para este teste de integração.",
    }).expect(200);
    expect(store.get(c.id).status).toBe("active");
  });
  it("backup e restauração preservam os dados como cópias", async () => {
    await createCharacter(gm, { history: "História persistente", humanity: 6 });
    const backup = (await gm.get("/api/backup")).body;
    const out = await mutation(gm, "post", "/api/restore", backup).expect(200);
    expect(out.body.restored).toBe(2);
    const s = (await gm.get("/api/state")).body;
    expect(s.characters).toHaveLength(2);
    expect(
      s.characters.every(
        (c: any) => c.history === "História persistente" && c.humanity === 6,
      ),
    ).toBe(true);
    expect(s.characters[0].campaignId).not.toBe(s.characters[1].campaignId);
  });
  it("restauração inválida não importa parcialmente", async () => {
    const before = store.list("campaigns").length;
    await mutation(gm, "post", "/api/restore", {
      format: "v5-backup",
      version: 1,
      entities: [
        {
          id: "copia",
          type: "campaigns",
          data: { name: "Cópia", gmId: "ignored" },
        },
        { id: "bad", type: "characters", data: { name: "Dados incompletos" } },
      ],
    }).expect(400);
    expect(store.list("campaigns")).toHaveLength(before);
  });
  it("consulta documental usa FTS local e paginação", async () => {
    store.db
      .prepare("INSERT INTO pages(document,page,text) VALUES(?,?,?)")
      .run("basico", 181, "Dados de Fome substituem os dados normais.");
    expect((await gm.get("/api/library?q=Fome")).body[0].page).toBe(181);
    expect(
      (await gm.get("/api/documents/basico/pages/181")).body.text,
    ).toContain("substituem");
  });
  it("dados de uma nova conexão sobrevivem ao fechamento do banco", async () => {
    const dir = mkdtempSync(join(tmpdir(), "v5-"));
    try {
      const path = join(dir, "persist.sqlite");
      let s = new Store(path);
      const e = s.create(
        "records",
        { name: "Persistente", kind: "event", campaignId: "test" },
        "user",
      );
      s.close();
      s = new Store(path);
      expect(s.get(e.id).name).toBe("Persistente");
      s.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe("Oficina integrada", () => {
  it("cria Disciplina, Clã e Poder e aplica efeito real ao alvo", async () => {
    const ds = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Disciplina configurável",
        kind: "discipline",
      }).expect(201)
    ).body;
    const clan = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Nocturnos",
        kind: "clan",
        disciplines: [ds.id],
        bane: "Perdição personalizada",
      }).expect(201)
    ).body;
    const power = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Toque das Sombras",
        kind: "power",
        parentId: ds.id,
        level: 1,
        automation: "complete",
        effects: [
          {
            kind: "damage",
            recipient: "target",
            target: "health",
            value: 3,
            aggravated: true,
          },
        ],
      }).expect(201)
    ).body;
    const a = await createCharacter(gm, {
        clanId: clan.id,
        disciplines: { [ds.id]: 1 },
        powers: [power.id],
      }),
      b = await createCharacter();
    await mutation(gm, "post", "/api/characters/" + a.id + "/action", {
      action: "power",
      powerId: power.id,
      targetId: b.id,
    }).expect(200);
    expect(store.get(b.id).health.aggravated).toBe(3);
    expect(store.get("clan-brujah").disciplines).not.toContain(ds.id);
  });
  it("Qualidade e Defeito condicionais participam das paradas", async () => {
    const merit = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Determinação Noturna",
        kind: "merit",
        effects: [
          { kind: "dice", target: "briga", value: 2, duration: "permanent" },
        ],
      }).expect(201)
    ).body;
    const flaw = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Sangue Instável",
        kind: "flaw",
        effects: [
          {
            kind: "dice",
            target: "briga",
            value: -1,
            duration: "permanent",
            when: { field: "hunger", operator: "gte", value: 2 },
          },
        ],
      }).expect(201)
    ).body;
    const c = await createCharacter(gm, {
      hunger: 2,
      attributes: { ...emptyCharacter().attributes, forca: 3 },
      skills: { ...emptyCharacter().skills, briga: 2 },
      advantages: [
        { contentId: merit.id, level: 1 },
        { contentId: flaw.id, level: 1 },
      ],
    });
    const r = await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      difficulty: 2,
    }).expect(200);
    expect(r.body.result.normal.length + r.body.result.hunger.length).toBe(6);
  });
  it("efeito temporário é aplicado e termina ao encerrar a cena", async () => {
    const ds = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Umbromancia",
        kind: "discipline",
      })
    ).body;
    const power = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Força das Sombras",
        kind: "power",
        parentId: ds.id,
        automation: "complete",
        effects: [
          { kind: "attribute", target: "forca", value: 2, duration: "scene" },
        ],
      })
    ).body;
    const c = await createCharacter(gm, {
      disciplines: { [ds.id]: 1 },
      powers: [power.id],
    });
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "power",
      powerId: power.id,
    }).expect(200);
    expect(store.get(c.id).activeEffects).toHaveLength(1);
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "expire",
      scope: "scene",
    }).expect(200);
    expect(store.get(c.id).activeEffects).toHaveLength(0);
  });
  it("importação remapeia vínculos sem modificar oficiais", async () => {
    const data = {
      format: "v5-content",
      version: 1,
      entries: [
        { id: "d", name: "Umbromancia", kind: "discipline" },
        { id: "c", name: "Nocturnos", kind: "clan", disciplines: ["d"] },
      ],
    };
    await mutation(gm, "post", "/api/content/import", data).expect(200);
    const s = (await gm.get("/api/state")).body;
    const d = s.content.find((x: any) => x.name === "Umbromancia"),
      c = s.content.find((x: any) => x.name === "Nocturnos");
    expect(c.disciplines).toEqual([d.id]);
    expect(store.get("clan-brujah").name).toBe("Brujah");
  });
  it("arquivo incompatível e efeito inseguro são rejeitados", async () => {
    await mutation(gm, "post", "/api/content/import", {
      format: "v5-content",
      version: 99,
      entries: [],
    }).expect(400);
    await mutation(gm, "post", "/api/entities/content", {
      name: "Inseguro",
      kind: "merit",
      effects: [{ kind: "eval" }],
    }).expect(400);
  });
  it("conteúdo vinculado não pode ser excluído", async () => {
    const clan = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Clã em uso",
        kind: "clan",
      })
    ).body;
    await createCharacter(gm, { clanId: clan.id });
    await mutation(gm, "delete", "/api/entities/" + clan.id, {
      confirm: clan.name,
    }).expect(400);
  });
  it("transferência move quantidades entre fichas em uma transação", async () => {
    const item = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Objeto pessoal",
        kind: "equipment",
      })
    ).body;
    const a = await createCharacter(gm, {
        inventory: [{ id: "inventory1", contentId: item.id, quantity: 3 }],
      }),
      b = await createCharacter();
    await mutation(gm, "post", "/api/characters/" + a.id + "/action", {
      action: "transfer",
      itemId: "inventory1",
      targetId: b.id,
      amount: 2,
    }).expect(200);
    expect(store.get(a.id).inventory[0].quantity).toBe(1);
    expect(store.get(b.id).inventory[0].quantity).toBe(2);
  });
  it("combate funcional atualiza as duas fichas e seu histórico", async () => {
    const a = await createCharacter(),
      b = await createCharacter();
    const r = await mutation(gm, "post", "/api/combat", {
      a: a.id,
      b: b.id,
      attributeA: "forca",
      skillA: "briga",
      attributeB: "forca",
      skillB: "briga",
    }).expect(200);
    expect(r.body).toHaveProperty("damage");
    expect(
      (await gm.get("/api/characters/" + a.id + "/history")).body.some(
        (x: any) => x.action === "Conflito",
      ),
    ).toBe(true);
  });
});
describe("Integração de sessões", () => {
  it("inicia com recuperação, encerra com Remorso e XP, sem premiar duas vezes", async () => {
    const c = await createCharacter(gm, {
      willpower: { superficial: 1, aggravated: 0 },
      stains: 1,
    });
    const s = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Primeira sessão",
        kind: "session",
        campaignId: campaign.id,
        participants: [c.id],
      })
    ).body;
    await mutation(gm, "post", "/api/sessions/" + s.id + "/start").expect(200);
    expect(store.get(c.id).willpower.superficial).toBe(0);
    await mutation(gm, "post", "/api/sessions/" + s.id + "/finish", {
      xp: 1,
    }).expect(200);
    expect(store.get(c.id).stains).toBe(0);
    expect(store.get(c.id).xpTotal).toBe(1);
    await mutation(gm, "post", "/api/sessions/" + s.id + "/finish", {
      xp: 1,
    }).expect(400);
    expect(store.get(c.id).xpTotal).toBe(1);
  });
});
describe("Conservação dos efeitos e sigilo", () => {
  it("reaplicar um modificador temporário renova sua duração sem empilhamento", async () => {
    const ds = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Teste de duração",
        kind: "discipline",
      })
    ).body;
    const p = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Bônus que não empilha",
        kind: "power",
        parentId: ds.id,
        effects: [
          { kind: "dice", target: "briga", value: 2, duration: "scene" },
        ],
      })
    ).body;
    const c = await createCharacter(gm, {
      disciplines: { [ds.id]: 1 },
      powers: [p.id],
    });
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "power",
      powerId: p.id,
      duration: 1,
    }).expect(200);
    await mutation(gm, "post", "/api/clock/" + campaign.id + "/advance", {
      scope: "turn",
    }).expect(200);
    await mutation(gm, "post", "/api/characters/" + c.id + "/action", {
      action: "power",
      powerId: p.id,
      duration: 2,
    }).expect(200);
    expect(store.get(c.id).activeEffects).toHaveLength(1);
    expect(store.get(c.id).activeEffects[0].remaining).toBe(2);
  });
  it("jogador não altera Atributos de ficha ativa para evitar o custo de XP", async () => {
    const c = await createCharacter(player);
    await mutation(gm, "post", "/api/characters/" + c.id + "/finalize", {
      exception: "Exceção autorizada para testar a segurança da ficha.",
    });
    const active = store.get(c.id);
    await mutation(player, "put", "/api/entities/" + c.id, {
      ...active,
      attributes: { ...active.attributes, forca: 5 },
    }).expect(400);
    expect(store.get(c.id).attributes.forca).toBe(1);
  });
  it("custo de Despertar não verificado só pode ser resolvido pelo Narrador", async () => {
    const p = store.get("power-potencia-facanha");
    const c = await createCharacter(player, {
      disciplines: { "discipline-potencia": 2 },
      powers: [p.id],
    });
    await mutation(player, "post", "/api/characters/" + c.id + "/action", {
      action: "power",
      powerId: p.id,
      narrativeConfirmed: true,
      rouseCount: 1,
    }).expect(400);
    expect(store.get(c.id).activeEffects).toHaveLength(0);
  });
});
describe("Coteries e Domínios", () => {
  it("sincroniza os membros do Domínio com os vínculos das fichas", async () => {
    const c = await createCharacter();
    const group = (
      await mutation(gm, "post", "/api/entities/coteries", {
        name: "Guardiões do Porto",
        campaignId: campaign.id,
        members: [c.id],
        chasse: 3,
        lien: 2,
        portillon: 2,
      }).expect(201)
    ).body;
    expect(store.get(c.id).coterieId).toBe(group.id);
    await mutation(gm, "delete", "/api/entities/" + group.id, {
      confirm: group.name,
    }).expect(400);
    await mutation(gm, "put", "/api/entities/" + group.id, {
      ...group,
      members: [],
    }).expect(200);
    expect(store.get(c.id).coterieId).toBe("");
  });
  it("não permite vincular um personagem de outra campanha", async () => {
    const c = await createCharacter();
    const other = (
      await mutation(gm, "post", "/api/entities/campaigns", {
        name: "Outra campanha",
        gmId: "ignored",
      })
    ).body;
    await mutation(gm, "post", "/api/entities/coteries", {
      name: "Inválida",
      campaignId: other.id,
      members: [c.id],
    }).expect(400);
  });
});
describe("Backup dos acontecimentos e rolagens", () => {
  it("restaura os registros de rolagens e alterações junto à ficha", async () => {
    const c = await createCharacter();
    await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(200);
    const backup = (await gm.get("/api/backup")).body;
    expect(backup.rolls).toHaveLength(1);
    expect(backup.history.length).toBeGreaterThan(0);
    await mutation(gm, "post", "/api/restore", backup).expect(200);
    const copy = store.list("characters").find((x) => x.id !== c.id);
    expect(
      (await gm.get("/api/characters/" + copy.id + "/rolls")).body,
    ).toHaveLength(1);
    expect(
      (await gm.get("/api/characters/" + copy.id + "/history")).body.length,
    ).toBeGreaterThan(0);
  });
});
describe("Mensagens e respostas em português", () => {
  it("retorna JSON e erro em português para rota inexistente e arquivo inválido", async () => {
    const missing = await gm.get("/api/recurso-inexistente").expect(404);
    expect(missing.body.error).toBe("Recurso não encontrado.");
    const invalid = await gm
      .post("/api/entities/content")
      .set("X-V5-CSRF", "1")
      .set("Content-Type", "application/json")
      .send("{invalido")
      .expect(400);
    expect(invalid.body.error).toBe(
      "O corpo da requisição não contém JSON válido.",
    );
  });
});

const deterministicGM = async (rng: () => number = () => 8) => {
  gm = request.agent(createApp(store, rng));
  await mutation(gm, "post", "/api/auth/login", {
    username: "narrador",
    password: "senha-de-teste-segura",
  }).expect(200);
};
const act = (c: any, data: any) =>
  mutation(gm, "post", "/api/characters/" + c.id + "/action", data);
const tick = (scope = "turn", entry = campaign) =>
  mutation(gm, "post", "/api/clock/" + entry.id + "/advance", { scope });
const createThinCharacter = (agent = gm, fixture = validThinCharacter()) =>
  createCharacter(agent, { ...fixture, campaignId: campaign.id });
const activeAlchemist = async (
  method: "athanor" | "calcinatio" | "fixatio" = "fixatio",
  extra: any = {},
) => {
  const f = validThinCharacter();
  f.status = "active";
  f.ownerId = playerId;
  f.thinBlood.alchemyMethod = method;
  f.disciplines[ALCHEMY] = 1;
  f.powers = ["formula-alquimia-sangue-ralo-nevoa"];
  f.attributes.inteligencia = 3;
  f.attributes.vigor = 3;
  f.attributes.manipulacao = 3;
  return createThinCharacter(gm, { ...f, ...extra });
};
const alchemyPrep = {
  operation: "prepare",
  formulaId: "formula-alquimia-sangue-ralo-nevoa",
  ingredients: "Vitae própria, sangue fleumático e gelo seco",
  ingredientsConfirmed: true,
  laboratoryConfirmed: true,
};
const alchemyNarrator = {
  narrativeConfirmed: true,
  note: "Fonte consultada e consequências resolvidas pelo Narrador da crônica.",
};
const alchemy = (c: any, data: any, agent = gm) =>
  mutation(agent, "post", "/api/characters/" + c.id + "/alchemy", data);
const deterministicPlayer = async () => {
  player = request.agent(createApp(store, () => 8));
  await mutation(player, "post", "/api/auth/login", {
    username: "jogador",
    password: "senha-de-teste-segura",
  }).expect(200);
};
describe("Alquimia persistente — Básico PDF 188,274–277", () => {
  it("jogador prepara e consome Fixatio pela API, sem poder criar ou alterar frascos por edição", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep, player).expect(200);
    const current = store.get(c.id),
      p = current.alchemy.preparations[0];
    expect(p.distillation).toBeNull();
    for (const agent of [gm, player])
      await mutation(agent, "put", "/api/entities/" + c.id, {
        ...current,
        alchemy: { preparations: [], activations: [] },
      }).expect(400);
    await act(c, {
      action: "power",
      powerId: alchemyPrep.formulaId,
      ...alchemyNarrator,
      rouseCount: 1,
    }).expect(400);
    const used = await alchemy(
      c,
      { operation: "activate", preparationId: p.id },
      player,
    ).expect(200);
    expect(used.body.result.distillation.successes).toBe(4);
    expect(store.get(c.id).alchemy.preparations).toHaveLength(0);
    expect(store.get(c.id).conditions).toContain("Névoa alquímica");
    const before = store.get(c.id);
    await alchemy(
      c,
      { operation: "activate", preparationId: p.id },
      player,
    ).expect(400);
    expect(store.get(c.id)).toEqual(before);
    const rolls = (await player.get("/api/characters/" + c.id + "/rolls")).body;
    expect(rolls.filter((x: any) => x.mode === "alchemy")).toHaveLength(2);
  });
  it("não permite importar uma preparação gratuita pelo cadastro normal", async () => {
    const first = await activeAlchemist();
    await alchemy(first, alchemyPrep).expect(200);
    const forged = await createCharacter(gm, {
      ...store.get(first.id),
      name: "Cadastro sem frascos gratuitos",
    });
    expect(forged.alchemy.preparations).toHaveLength(0);
  });
  it("aplica a penalidade de Névoa em identificação e ataque à distância, sem afetar teste comum", async () => {
    await deterministicGM();
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
    }).expect(200);
    const attacker = await createCharacter(gm, {
      nature: "mortal",
      attributes: { ...emptyCharacter().attributes, inteligencia: 4 },
      skills: { ...emptyCharacter().skills, percepcao: 3 },
    });
    for (const targetContext of ["identify", "ranged", ""]) {
      const r = await mutation(
        gm,
        "post",
        "/api/characters/" + attacker.id + "/roll",
        {
          attribute: "inteligencia",
          skill: "percepcao",
          targetId: c.id,
          targetContext,
        },
      ).expect(200);
      expect(r.body.result.normal).toHaveLength(targetContext ? 5 : 7);
    }
    const low = await mutation(
      gm,
      "post",
      "/api/characters/" + attacker.id + "/roll",
      {
        attribute: "forca",
        skill: "briga",
        targetId: c.id,
        targetContext: "ranged",
      },
    ).expect(200);
    expect(low.body.result.normal).toHaveLength(1); // Básico PDF 95,97: penalidades não levam a menos de um dado.
    await tick("scene").expect(200);
    expect(store.get(c.id).conditions).not.toContain("Névoa alquímica");
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
  });
  it("concentração Athanor bloqueia ações e rolagens; três marcadores liberam a ativação", async () => {
    await deterministicGM();
    const c = await activeAlchemist("athanor");
    await alchemy(c, alchemyPrep).expect(200);
    const id = store.get(c.id).alchemy.preparations[0].id;
    await mutation(player, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
    }).expect(400);
    await act(c, { action: "rouse" }).expect(400);
    await alchemy(
      c,
      {
        operation: "completeConcentration",
        preparationId: id,
        ...alchemyNarrator,
      },
      player,
    ).expect(400);
    await tick("scene").expect(200);
    expect(store.get(c.id).alchemy.preparations[0].remainingTurns).toBe(3);
    for (let i = 0; i < 3; i++) await tick().expect(200);
    expect(store.get(c.id).alchemy.preparations[0].remainingTurns).toBe(0);
    await alchemy(c, {
      operation: "activate",
      preparationId: id,
      concentrationConfirmed: true,
    }).expect(200);
    expect(store.get(c.id).alchemy.preparations).toHaveLength(0);
  });
  it("qualidade intermediária fica paga e pendente; só Narrador resolve sem rolar outra vez", async () => {
    const dice = [8, 8, 8, 8, 1, 8];
    await deterministicGM(() => dice.shift() ?? 8);
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    const r = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
    }).expect(200);
    expect(r.body.result.distillation.successes).toBe(3);
    expect(r.body.result.status).toBe("pending");
    expect(store.get(c.id).activeEffects).toHaveLength(0);
    const data = {
      operation: "resolve",
      activationId: r.body.result.activationId,
      fogPenalty: 1,
      ...alchemyNarrator,
    };
    await alchemy(c, data, player).expect(400);
    const resolved = await alchemy(c, data).expect(200);
    expect(resolved.body.result.rouses).toHaveLength(0);
    expect(resolved.body.result.distillation).toEqual(
      r.body.result.distillation,
    );
    expect(store.get(c.id).activeEffects[0].effect.value).toBe(-1);
    const before = store.get(c.id);
    await alchemy(c, data).expect(400);
    expect(store.get(c.id)).toEqual(before);
  });
  it("alvos de grupo exigem permissão e a falha conserva frasco e estado", async () => {
    await deterministicGM();
    const c = await activeAlchemist(),
      ally = await createCharacter();
    await alchemy(c, alchemyPrep).expect(200);
    const before = store.get(c.id),
      data = {
        operation: "activate",
        preparationId: before.alchemy.preparations[0].id,
        group: true,
        targetIds: [ally.id],
      };
    await alchemy(c, data, player).expect(400);
    expect(store.get(c.id)).toEqual(before);
    const r = await alchemy(c, data).expect(200);
    expect(r.body.result.rouses).toHaveLength(2);
    expect(store.get(ally.id).conditions).toContain("Névoa alquímica");
    await alchemy(c, {
      operation: "end",
      activationId: r.body.result.activationId,
    }).expect(200);
    expect(store.get(c.id).conditions).not.toContain("Névoa alquímica");
    expect(store.get(ally.id).conditions).not.toContain("Névoa alquímica");
  });
  it("Calcinatio exige Narrador, humano e emoção; não permite outra fórmula no mesmo corpo", async () => {
    await deterministicGM();
    const c = await activeAlchemist("calcinatio"),
      vessel = await createCharacter(gm, { nature: "mortal" });
    const data = {
      ...alchemyPrep,
      vesselId: vessel.id,
      vesselEmotionConfirmed: true,
      ...alchemyNarrator,
    };
    await alchemy(c, data, player).expect(400);
    await alchemy(c, data).expect(200);
    const other = await activeAlchemist("calcinatio");
    await alchemy(other, data).expect(400);
    await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      vesselEmotionConfirmed: true,
      feedingConfirmed: true,
      ...alchemyNarrator,
    }).expect(200);
    expect(store.get(c.id).alchemy.preparations).toHaveLength(1);
    await mutation(gm, "delete", "/api/entities/" + vessel.id, {
      confirm: vessel.name,
    }).expect(400);
  });
  it("Calcinatio nociva atualiza humano e vampiro atomicamente e registra sobrevivência", async () => {
    await deterministicGM();
    const vessel = await createCharacter(gm, { nature: "mortal" });
    const formula = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Elixir nocivo de teste",
        kind: "formula",
        parentId: ALCHEMY,
        level: 4,
        origin: "custom",
      }).expect(201)
    ).body;
    const c = await activeAlchemist("calcinatio", {
      hunger: 4,
      disciplines: { [ALCHEMY]: 4 },
      powers: [formula.id],
    });
    await alchemy(c, {
      ...alchemyPrep,
      formulaId: formula.id,
      vesselId: vessel.id,
      vesselEmotionConfirmed: true,
      ...alchemyNarrator,
    }).expect(200);
    const p = store.get(c.id).alchemy.preparations[0];
    const r = await alchemy(c, {
      operation: "activate",
      preparationId: p.id,
      vesselEmotionConfirmed: true,
      feedingConfirmed: true,
      feedingMode: "harmful",
      ...alchemyNarrator,
    }).expect(200);
    expect(r.body.result.feeding.amount).toBe(3);
    expect(r.body.result.feeding.survival.difficulty).toBe(3);
    expect(store.get(vessel.id).health.aggravated).toBe(3);
    expect(store.get(c.id).hunger).toBe(1);
  });
  it("fórmulas próprias participam da destilação e aplicam seus efeitos seguros", async () => {
    await deterministicGM();
    const formula = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Elixir da força de teste",
        kind: "formula",
        parentId: ALCHEMY,
        origin: "custom",
        rouse: 1,
        effects: [
          { kind: "attribute", target: "forca", value: 2, duration: "scene" },
        ],
      }).expect(201)
    ).body;
    const c = await activeAlchemist("fixatio", { powers: [formula.id] });
    await alchemy(c, { ...alchemyPrep, formulaId: formula.id }, player).expect(
      200,
    );
    const used = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
    }).expect(200);
    expect(used.body.result.status).toBe("active");
    expect(
      (await player.get("/api/state")).body.characters.find(
        (x: any) => x.id === c.id,
      ).derived.attributes.forca,
    ).toBe(c.attributes.forca + 2);
  });
  it("backup remapeia preparações, grupo, efeitos e limites de turno, sem mexer nos originais", async () => {
    await deterministicGM();
    const c = await activeAlchemist(),
      ally = await createCharacter();
    await alchemy(c, alchemyPrep).expect(200);
    await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      group: true,
      targetIds: [ally.id],
    }).expect(200);
    await alchemy(c, alchemyPrep).expect(200);
    const original = store.get(c.id),
      backup = (await gm.get("/api/backup")).body;
    await mutation(gm, "post", "/api/restore", backup).expect(200);
    const copy = store
      .list("characters")
      .find((x) => x.id !== c.id && x.name === c.name)!;
    const copiedAlly = store
      .list("characters")
      .find((x) => x.id !== ally.id && x.name === ally.name)!;
    expect(copy.alchemy.preparations[0].id).not.toBe(
      original.alchemy.preparations[0].id,
    );
    expect(copy.alchemy.activations[0].targets.sort()).toEqual(
      [copy.id, copiedAlly.id].sort(),
    );
    expect(copy.activeEffects[0].effectKey).toContain(
      copy.alchemy.activations[0].id,
    );
    expect(copiedAlly.activeEffects[0].effectKey).toContain(
      copy.alchemy.activations[0].id,
    );
    expect(copy.lastPowerTurn).toContain(copy.campaignId);
    expect(store.get(c.id)).toEqual(original);
    await alchemy(copy, {
      operation: "activate",
      preparationId: copy.alchemy.preparations[0].id,
    }).expect(400);
    await alchemy(copy, {
      operation: "end",
      activationId: copy.alchemy.activations[0].id,
    }).expect(200);
    expect(store.get(copiedAlly.id).activeEffects).toHaveLength(0);
    expect(store.get(ally.id).activeEffects).toHaveLength(1);
  });
  it("backup inválido é rejeitado integralmente sem referências órfãs de receptáculo", async () => {
    const c = await activeAlchemist("calcinatio"),
      vessel = await createCharacter(gm, { nature: "mortal" });
    await alchemy(c, {
      ...alchemyPrep,
      vesselId: vessel.id,
      vesselEmotionConfirmed: true,
      ...alchemyNarrator,
    }).expect(200);
    const backup = (await gm.get("/api/backup")).body;
    backup.entities.find(
      (x: any) => x.id === c.id,
    ).data.alchemy.preparations[0].vesselId = "humano-ausente";
    const before = store.list("characters").length;
    await mutation(gm, "post", "/api/restore", backup).expect(400);
    expect(store.list("characters")).toHaveLength(before);
  });
  it("backup rejeita identificadores ambíguos nas chaves de efeitos", async () => {
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    const backup = (await gm.get("/api/backup")).body;
    backup.entities.find(
      (x: any) => x.id === c.id,
    ).data.alchemy.preparations[0].id = "prefixo:outro";
    const before = store.list("characters").length;
    await mutation(gm, "post", "/api/restore", backup).expect(400);
    expect(store.list("characters")).toHaveLength(before);
  });
});
describe("Revisão e rerrolagem de destilação — Básico PDF 100,104–105,135,274–276", () => {
  it("backup rejeita adulteração dos Dados de Fome e estados de revisão incompatíveis", async () => {
    await deterministicGM();
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    const used = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      reviewDistillation: true,
    }).expect(200);
    await alchemy(c, {
      operation: "rerollDistillation",
      activationId: used.body.result.activationId,
      indices: [0],
    }).expect(200);
    const backup = (await gm.get("/api/backup")).body,
      count = store.list("characters").length;
    for (const corrupt of [
      (a: any) => (a.distillation.hunger[0] = 1),
      (a: any) => (a.review.rerolled = false),
      (a: any) => (a.status = "active"),
      (a: any) => a.distillation.normal.pop(),
    ]) {
      const invalid = structuredClone(backup);
      corrupt(
        invalid.entities.find((x: any) => x.id === c.id).data.alchemy
          .activations[0],
      );
      await mutation(gm, "post", "/api/restore", invalid).expect(400);
      expect(store.list("characters")).toHaveLength(count);
    }
  });
  it("jogador rerrola preparação uma única vez, preservando fonte, custos e histórico", async () => {
    const values = [8, 1, 2, 8, 8];
    await deterministicGM(() => values.shift() ?? 8);
    await deterministicPlayer();
    const c = await activeAlchemist("athanor");
    await alchemy(c, alchemyPrep).expect(200);
    const initial = store.get(c.id),
      p = initial.alchemy.preparations[0];
    const r = await alchemy(
      c,
      { operation: "rerollDistillation", preparationId: p.id, indices: [0, 1] },
      player,
    ).expect(200);
    expect(r.body.result.distillation.successes).toBe(4);
    expect(r.body.result.rouses).toHaveLength(0);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    expect(store.get(c.id).hunger).toBe(initial.hunger);
    expect(store.get(c.id).alchemy.preparations[0].review.original).toEqual(
      p.distillation,
    );
    const before = store.get(c.id);
    await alchemy(
      c,
      { operation: "rerollDistillation", preparationId: p.id, indices: [0] },
      player,
    ).expect(400);
    await mutation(player, "put", "/api/entities/" + c.id, {
      ...before,
      alchemy: initial.alchemy,
    }).expect(400);
    expect(store.get(c.id)).toEqual(before);
    const rolls = (await player.get("/api/characters/" + c.id + "/rolls")).body;
    const log = rolls.find((x: any) => x.operation === "rerollDistillation");
    expect(log.rerolled).toBe(true);
    expect(log.review.original).toEqual(p.distillation);
    await mutation(player, "post", "/api/rolls/" + log.id + "/reroll", {
      indices: [0],
    }).expect(400);
  });
  it("requisições repetidas não cobram dois gastos, mesmo concorrentes", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const c = await activeAlchemist("athanor");
    await alchemy(c, alchemyPrep).expect(200);
    const data = {
      operation: "rerollDistillation",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      indices: [0],
    };
    const results = await Promise.all([
      alchemy(c, data, player),
      alchemy(c, data, player),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(store.get(c.id).willpower.superficial).toBe(1);
  });
  it("índices inválidos ou de Fome não alteram ficha, dados nem registros", async () => {
    await deterministicGM();
    const c = await activeAlchemist("athanor");
    await alchemy(c, alchemyPrep).expect(200);
    const before = store.get(c.id),
      id = before.alchemy.preparations[0].id;
    const count = store.db
      .prepare("SELECT count(*) AS n FROM rolls")
      .get() as any;
    for (const indices of [[], [0, 0], [-1], [3], [0, 1, 2, 3]])
      await alchemy(c, {
        operation: "rerollDistillation",
        preparationId: id,
        indices,
      }).expect(400);
    await alchemy(c, {
      operation: "rerollDistillation",
      preparationId: id,
      activationId: "outra",
      indices: [0],
    }).expect(400);
    expect(store.get(c.id)).toEqual(before);
    expect(
      (store.db.prepare("SELECT count(*) AS n FROM rolls").get() as any).n,
    ).toBe(count.n);
  });
  it("Fixatio revisa após consumo e conserva autorização de todos os alvos ao aceitar", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const c = await activeAlchemist(),
      ally = await createCharacter();
    await alchemy(c, alchemyPrep).expect(200);
    const used = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      group: true,
      targetIds: [ally.id],
      reviewDistillation: true,
    }).expect(200);
    expect(used.body.result.status).toBe("pending");
    expect(used.body.result.review.state).toBe("open");
    expect(store.get(c.id).activeEffects).toHaveLength(0);
    const id = used.body.result.activationId,
      initialHunger = store.get(c.id).hunger;
    await alchemy(
      c,
      { operation: "rerollDistillation", activationId: id, indices: [0] },
      player,
    ).expect(200);
    const before = store.get(c.id);
    await alchemy(
      c,
      { operation: "acceptDistillation", activationId: id },
      player,
    ).expect(400);
    expect(store.get(c.id)).toEqual(before);
    const accepted = await alchemy(c, {
      operation: "acceptDistillation",
      activationId: id,
    }).expect(200);
    expect(accepted.body.result.rouses).toHaveLength(0);
    expect(store.get(c.id).hunger).toBe(initialHunger);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    expect(store.get(c.id).alchemy.preparations).toHaveLength(0);
    expect(store.get(c.id).conditions).toContain("Névoa alquímica");
    expect(store.get(ally.id).conditions).toContain("Névoa alquímica");
  });
  it("avanço de tempo fecha a revisão de uma ativação sem aplicar efeitos retroativos", async () => {
    await deterministicGM();
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    const used = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      reviewDistillation: true,
    }).expect(200);
    await tick().expect(200);
    const id = used.body.result.activationId;
    expect(store.get(c.id).alchemy.activations[0].review.state).toBe("closed");
    await alchemy(c, {
      operation: "rerollDistillation",
      activationId: id,
      indices: [0],
    }).expect(400);
    await alchemy(c, {
      operation: "acceptDistillation",
      activationId: id,
    }).expect(400);
    expect(store.get(c.id).activeEffects).toHaveLength(0);
    await alchemy(c, {
      operation: "resolve",
      activationId: id,
      applyEffects: false,
      ...alchemyNarrator,
    }).expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
  });
  it("backup conserva dados originais, gasto e revisão aberta, com alvos remapeados", async () => {
    await deterministicGM();
    const c = await activeAlchemist(),
      ally = await createCharacter();
    await alchemy(c, alchemyPrep).expect(200);
    const used = await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
      group: true,
      targetIds: [ally.id],
      reviewDistillation: true,
    }).expect(200);
    await alchemy(c, {
      operation: "rerollDistillation",
      activationId: used.body.result.activationId,
      indices: [0],
    }).expect(200);
    const original = store.get(c.id);
    await mutation(
      gm,
      "post",
      "/api/restore",
      (await gm.get("/api/backup")).body,
    ).expect(200);
    const copy = store
      .list("characters")
      .find((x) => x.id !== c.id && x.name === c.name);
    const a = copy.alchemy.activations[0];
    expect(a.review).toEqual(original.alchemy.activations[0].review);
    expect(a.review.state).toBe("open");
    expect(copy.willpower).toEqual(original.willpower);
    expect(a.targets).not.toContain(ally.id);
    await alchemy(copy, {
      operation: "rerollDistillation",
      activationId: a.id,
      indices: [0],
    }).expect(400);
    await alchemy(copy, {
      operation: "acceptDistillation",
      activationId: a.id,
    }).expect(200);
    expect(store.get(copy.id).conditions).toContain("Névoa alquímica");
    expect(store.get(c.id)).toEqual(original);
  });
  it("migra registros da versão anterior sem abrir revisão retroativa", async () => {
    await deterministicGM();
    const c = await activeAlchemist();
    await alchemy(c, alchemyPrep).expect(200);
    await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
    }).expect(200);
    const legacy = store.get(c.id);
    delete legacy.alchemy.activations[0].review;
    store.db
      .prepare("UPDATE entities SET data=? WHERE id=?")
      .run(JSON.stringify(legacy), c.id);
    const read = store.get(c.id),
      id = read.alchemy.activations[0].id;
    expect(read.alchemy.activations[0].review).toEqual({
      state: "closed",
      rerolled: false,
      original: null,
    });
    await alchemy(c, {
      operation: "rerollDistillation",
      activationId: id,
      indices: [0],
    }).expect(400);
    expect(store.get(c.id).conditions).toContain("Névoa alquímica");
  });
});
describe("Criação e evolução de Sangues-Ralos integradas", () => {
  it("Narrador registra método em ficha antiga sem perder XP e não troca o método aprendido", async () => {
    const f = validThinCharacter();
    f.status = "active";
    f.disciplines[ALCHEMY] = 1;
    f.powers = ["formula-alquimia-sangue-ralo-nevoa"];
    f.xpTotal = 20;
    f.xpSpent = 7;
    const c = await createThinCharacter(gm, f);
    const saved = await mutation(gm, "put", "/api/entities/" + c.id, {
      ...c,
      thinBlood: { ...c.thinBlood, alchemyMethod: "fixatio" },
    }).expect(200);
    expect(saved.body.xpTotal).toBe(20);
    expect(saved.body.xpSpent).toBe(7);
    await mutation(gm, "put", "/api/entities/" + c.id, {
      ...saved.body,
      thinBlood: { ...saved.body.thinBlood, alchemyMethod: "calcinatio" },
    }).expect(400);
    expect(
      (await gm.get("/api/characters/" + c.id + "/history")).body.some(
        (r: any) => r.detail.thinBlood?.after.alchemyMethod === "fixatio",
      ),
    ).toBe(true);
  });
  it("permite escolhas iniciais de perfil e campanha ao jogador, preservando travas após finalizar", async () => {
    const initial = await createCharacter(player, { campaignId: "" });
    const fixture = validThinCharacter();
    const saved = await mutation(player, "put", "/api/entities/" + initial.id, {
      ...fixture,
      ownerId: initial.ownerId,
      version: initial.version,
      campaignId: campaign.id,
    }).expect(200);
    await mutation(
      player,
      "post",
      "/api/characters/" + initial.id + "/finalize",
    ).expect(200);
    const active = store.get(initial.id);
    await mutation(player, "put", "/api/entities/" + initial.id, {
      ...active,
      bloodPotency: 1,
    }).expect(400);
    await mutation(player, "put", "/api/entities/" + initial.id, {
      ...active,
      clanId: "clan-brujah",
    }).expect(400);
    expect(saved.body.generation).toBe(14);
    const other = (
      await mutation(gm, "post", "/api/entities/campaigns", {
        name: "Crônica sem convite",
        gmId: "atribuido",
      })
    ).body;
    const draft = await createCharacter(player);
    await mutation(player, "put", "/api/entities/" + draft.id, {
      ...draft,
      campaignId: other.id,
    }).expect(400);
  });
  it("jogador finaliza uma criação válida sem exceção, com características sem custo e uma única conclusão", async () => {
    const c = await createThinCharacter(player, validThinCharacter());
    expect(
      (await player.get("/api/characters/" + c.id + "/validation")).body
        .problems,
    ).toEqual([]);
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/finalize",
    ).expect(200);
    expect(store.get(c.id)).toMatchObject({
      status: "active",
      bloodPotency: 0,
      humanity: 7,
      xpTotal: 0,
    });
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/finalize",
    ).expect(400);
  });
  it("pares inválidos bloqueiam jogador sem mutação e exceção do Narrador fica registrada", async () => {
    const fixture = validThinCharacter();
    fixture.advantages = fixture.advantages.filter(
      (a) => a.contentId !== "flaw-dentes-de-bebe",
    );
    const c = await createThinCharacter(player, fixture);
    await mutation(player, "post", "/api/characters/" + c.id + "/finalize", {
      exception: "Tentativa sem permissão",
    }).expect(400);
    expect(store.get(c.id).status).toBe("draft");
    expect(store.get(c.id).version).toBe(1);
    await mutation(gm, "post", "/api/characters/" + c.id + "/finalize", {
      exception: "Variante explícita autorizada para este cenário de teste.",
    }).expect(200);
    expect(store.get(c.id).creation.approvedException).toContain(
      "Variante explícita",
    );
  });
  it("Afinidade, Alquimia e suas escolhas são concedidas atomicamente, sem Predador", async () => {
    const fixture = validThinCharacter();
    fixture.advantages = fixture.advantages.filter(
      (a) => !a.contentId.startsWith("merit-sangue-concatenado"),
    );
    fixture.advantages.push(
      {
        contentId: "merit-afinidade-de-disciplina",
        level: 1,
        source: "creation",
        notes: "",
      },
      {
        contentId: "merit-alquimia-sangue-ralo",
        level: 1,
        source: "creation",
        notes: "",
      },
      {
        contentId: "flaw-temperamento-bestial",
        level: 1,
        source: "creation",
        notes: "",
      },
    );
    fixture.thinBlood = {
      affinityDiscipline: "discipline-fortitude",
      affinityPower: "power-fortitude-resiliencia",
      clanCurse: "",
      alchemyMethod: "fixatio",
      initialFormula: "formula-alquimia-sangue-ralo-nevoa",
    };
    const c = await createThinCharacter(player, fixture);
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/finalize",
    ).expect(200);
    expect(store.get(c.id).disciplines).toEqual({
      "discipline-fortitude": 1,
      [ALCHEMY]: 1,
    });
    expect(store.get(c.id).powers).toEqual(
      expect.arrayContaining([
        fixture.thinBlood.affinityPower,
        fixture.thinBlood.initialFormula,
      ]),
    );
    const state = (await player.get("/api/state")).body.characters.find(
      (entry: any) => entry.id === c.id,
    );
    expect(state.derived.healthMax).toBe(7);
    const original = store.get(c.id);
    await mutation(player, "put", "/api/entities/" + c.id, {
      ...original,
      thinBlood: { ...original.thinBlood, alchemyMethod: "athanor" },
    }).expect(400);
    expect(store.get(c.id).thinBlood.alchemyMethod).toBe("fixatio");
    await mutation(player, "put", "/api/entities/" + c.id, {
      ...original,
      powers: [...original.powers, "power-fortitude-mente-inabalavel"],
    }).expect(400);
    await act(c, {
      action: "xp",
      amount: 30,
      reason: "Sessões de teste concluídas",
    }).expect(200);
    await mutation(player, "post", "/api/characters/" + c.id + "/action", {
      action: "advance",
      kind: "discipline",
      key: ALCHEMY,
      powerId: "formula-alquimia-sangue-ralo-longo-alcance",
      researchConfirmed: true,
    }).expect(200);
    expect(store.get(c.id).xpSpent).toBe(14);
    expect(store.get(c.id).disciplines[ALCHEMY]).toBe(2);
    const before = store.get(c.id);
    await act(c, {
      action: "advance",
      kind: "discipline",
      key: ALCHEMY,
      powerId: "formula-alquimia-sangue-ralo-envolver",
      researchConfirmed: true,
      alchemyMethod: "calcinatio",
    }).expect(400);
    expect(store.get(c.id)).toEqual(before);
    await act(c, {
      action: "power",
      powerId: fixture.thinBlood.initialFormula,
    }).expect(400);
  });
  it("Frenesi espontâneo requer Temperamento Bestial e Perdição Brujah aplica Gravidade 1", async () => {
    await deterministicGM();
    const c = await createThinCharacter(gm, validThinCharacter());
    const body = {
      attribute: "forca",
      skill: "briga",
      mode: "frenzy",
      difficulty: 1,
    };
    await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      body,
    ).expect(400);
    const supernatural = await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      { ...body, tags: ["provocacaoSobrenatural"] },
    ).expect(200);
    expect(supernatural.body.result.normal).toHaveLength(5);
    expect(supernatural.body.result.hunger).toHaveLength(0);
    const old = store.get(c.id);
    await mutation(gm, "put", "/api/entities/" + c.id, {
      ...old,
      advantages: [
        ...old.advantages,
        { contentId: "flaw-temperamento-bestial", level: 1 },
        { contentId: "flaw-maldicao-de-cla", level: 1 },
      ],
      thinBlood: { ...old.thinBlood, clanCurse: "clan-brujah" },
    }).expect(200);
    const fury = await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      { ...body, tags: ["frenesiFuria"] },
    ).expect(200);
    expect(fury.body.result.normal).toHaveLength(4);
  });
  it("Despertar forçado não impõe Frenesi espontâneo a Sangue-Ralo comum", async () => {
    await deterministicGM(() => 2);
    const c = await createThinCharacter(gm, {
      ...validThinCharacter(),
      hunger: 5,
    });
    const r = await act(c, { action: "rouse", forced: true }).expect(200);
    expect(r.body.result.frenzy).toBe(false);
    expect(store.get(c.id).hunger).toBe(5);
  });
  it("Dependência de Vitae exige resolução do Narrador registrada antes de ativação ou evolução", async () => {
    const f = validThinCharacter();
    f.advantages = f.advantages.filter(
      (a) =>
        a.contentId !== "merit-sangue-concatenado" &&
        a.contentId !== "flaw-dentes-de-bebe",
    );
    f.advantages.push(
      {
        contentId: "merit-afinidade-de-disciplina",
        level: 1,
        source: "creation",
        notes: "",
      },
      {
        contentId: "flaw-dependencia-de-vitae",
        level: 1,
        source: "creation",
        notes: "",
      },
    );
    f.thinBlood.affinityDiscipline = "discipline-fortitude";
    f.thinBlood.affinityPower = "power-fortitude-resiliencia";
    const c = await createThinCharacter(player, f);
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/finalize",
    ).expect(200);
    const body = {
      action: "power",
      powerId: f.thinBlood.affinityPower,
      dependencyConfirmed: true,
      note: "Saciedade vampírica confirmada pelo Narrador na última semana.",
    };
    await mutation(
      player,
      "post",
      "/api/characters/" + c.id + "/action",
      body,
    ).expect(400);
    await act(c, { ...body, dependencyConfirmed: false }).expect(400);
    await act(c, body).expect(200);
    await act(c, {
      action: "xp",
      amount: 20,
      reason: "Evolução autorizada",
    }).expect(200);
    await act(c, {
      action: "advance",
      kind: "discipline",
      key: "discipline-fortitude",
      powerId: "power-fortitude-mente-inabalavel",
      resonance: true,
    }).expect(400);
    await act(c, {
      ...body,
      action: "advance",
      kind: "discipline",
      key: "discipline-fortitude",
      powerId: "power-fortitude-mente-inabalavel",
      resonance: true,
    }).expect(200);
    expect(
      (await gm.get("/api/characters/" + c.id + "/history")).body.some(
        (entry: any) => entry.detail.dependencyConfirmed,
      ),
    ).toBe(true);
  });
  it("backup remapeia Afinidade, Poder e Perdição personalizados e preserva escolhas", async () => {
    const disc = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Disciplina da linhagem de teste",
        kind: "discipline",
      })
    ).body;
    const power = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Poder da linhagem de teste",
        kind: "power",
        parentId: disc.id,
        level: 1,
      })
    ).body;
    const clan = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Clã da Perdição de teste",
        kind: "clan",
        bane: "Perdição narrativa personalizada",
      })
    ).body;
    const f = validThinCharacter();
    f.advantages.push(
      {
        contentId: "merit-afinidade-de-disciplina",
        level: 1,
        source: "creation",
        notes: "",
      },
      {
        contentId: "flaw-maldicao-de-cla",
        level: 1,
        source: "creation",
        notes: "",
      },
    );
    f.thinBlood.affinityDiscipline = disc.id;
    f.thinBlood.affinityPower = power.id;
    f.thinBlood.clanCurse = clan.id;
    const c = await createThinCharacter(gm, f);
    await mutation(gm, "post", "/api/characters/" + c.id + "/finalize").expect(
      200,
    );
    await mutation(
      gm,
      "post",
      "/api/restore",
      (await gm.get("/api/backup")).body,
    ).expect(200);
    const copy = store.list("characters").find((entry) => entry.id !== c.id);
    for (const field of ["affinityDiscipline", "affinityPower", "clanCurse"]) {
      expect(copy.thinBlood[field]).not.toBe(
        f.thinBlood[field as keyof typeof f.thinBlood],
      );
      expect(store.get(copy.thinBlood[field])).toBeTruthy();
    }
    expect(copy.disciplines[copy.thinBlood.affinityDiscipline]).toBe(1);
    expect(copy.powers).toContain(copy.thinBlood.affinityPower);
  });
});
const combatBody = (a: any, b: any, extra: any = {}) => ({
  a: a.id,
  b: b.id,
  attributeA: "forca",
  skillA: "briga",
  attributeB: "forca",
  skillB: "briga",
  unilateral: true,
  ...extra,
});
const combatCharacter = (agent = gm, extra: any = {}) =>
  createCharacter(agent, {
    ...extra,
    attributes: { ...emptyCharacter().attributes, ...extra.attributes },
    skills: { ...emptyCharacter().skills, ...extra.skills },
  });
describe("Confrontos persistentes e mortais — Básico 189,201,292–298; Companion 41–47", () => {
  it("agarramento persiste, limita cada turno, protege exclusão e permite soltar", async () => {
    await deterministicGM();
    const a = await combatCharacter(gm, {
      attributes: { ...emptyCharacter().attributes, forca: 4 },
      skills: { briga: 2 },
    });
    const b = await combatCharacter();
    const run = (technique: string) =>
      mutation(gm, "post", "/api/combat", combatBody(a, b, { technique }));
    await run("grapple").expect(200);
    expect(store.get(b.id).grappledBy).toBe(a.id);
    expect(store.get(b.id).health).toEqual({ superficial: 0, aggravated: 0 });
    await run("bite").expect(400);
    await mutation(gm, "delete", "/api/entities/" + a.id, {
      confirm: a.name,
    }).expect(400);
    await tick().expect(200);
    await run("bite").expect(200);
    expect(store.get(b.id).health.aggravated).toBe(2);
    const before = store.get(b.id);
    await run("crush").expect(400);
    expect(store.get(b.id)).toEqual(before);
    await run("release").expect(200);
    expect(store.get(b.id).grappledBy).toBe("");
    expect(store.get(b.id).grappleLastTurn).toBe("");
  });
  it("arma e armadura equipadas produzem dano misto persistente e preservam a ordem escolhida", async () => {
    await deterministicGM();
    const a = await combatCharacter(gm, {
      attributes: { forca: 4 },
      skills: { briga: 2 },
    });
    const b = await combatCharacter(gm, {
      nature: "mortal",
      hunger: 5,
      bloodPotency: 4,
      health: { superficial: 3, aggravated: 0 },
      inventory: [
        {
          id: "armor",
          contentId: "equipment-colete-de-kevlar",
          quantity: 1,
          equipped: true,
        },
      ],
    });
    expect(b.hunger).toBe(0);
    expect(b.bloodPotency).toBe(0);
    const r = await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, {
        sourceA: "gunshot",
        armorItemB: "armor",
        mixedOrderB: "superficialFirst",
      }),
    ).expect(200);
    expect(r.body.reports.toB).toMatchObject({
      raw: 5,
      converted: 4,
      superficial: 2,
      aggravated: 1,
      order: "superficialFirst",
    });
    expect(store.get(b.id).health).toEqual({ superficial: 2, aggravated: 2 });
    const oldA = store.get(a.id),
      oldB = store.get(b.id);
    await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, { weaponItemA: "armor" }),
    ).expect(400);
    expect(store.get(a.id)).toEqual(oldA);
    expect(store.get(b.id)).toEqual(oldB);
    const weaponId = store
      .catalog()
      .find(
        (e: any) =>
          e.kind === "equipment" &&
          e.equipmentType === "weapon" &&
          e.damage === 2 &&
          e.damageSource === "piercing",
      )!.id;
    await mutation(gm, "put", "/api/entities/" + a.id, {
      ...oldA,
      inventory: [
        { id: "knife", contentId: weaponId, quantity: 1, equipped: true },
      ],
    }).expect(200);
    const hit = await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, { weaponItemA: "knife", armorItemB: "armor" }),
    ).expect(200);
    expect(hit.body.damage.toB).toBe(7);
  });
  it("estaqueamento precisa de cinco danos antes da divisão e impede ações físicas", async () => {
    await deterministicGM();
    const a = await combatCharacter(gm, {
        attributes: { forca: 5 },
        skills: { briga: 3 },
      }),
      b = await combatCharacter();
    const r = await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, { technique: "stake" }),
    ).expect(200);
    expect(r.body.a.successPenalty).toBe(2);
    expect(r.body.damage.toB).toBe(5);
    expect(store.get(b.id).health.superficial).toBe(3);
    expect(store.get(b.id).conditions).toContain("Estacado");
    await mutation(gm, "post", "/api/combat", combatBody(b, a)).expect(400);
  });
  it("uma rolagem aplica dano sem divisão, encerra o confronto e rejeita Surto ou rerrolagem", async () => {
    await deterministicGM();
    const a = await combatCharacter(gm, { attributes: { vigor: 5 } }),
      b = await combatCharacter(gm, { attributes: { vigor: 5 } });
    const record = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Confronto de integração",
        kind: "combat",
        campaignId: campaign.id,
        participants: [a.id, b.id],
        status: "Em andamento",
      }).expect(201)
    ).body;
    const body = {
      difficulty: 4,
      recordId: record.id,
      participants: [a, b].map((c) => ({
        id: c.id,
        attribute: "forca",
        skill: "briga",
      })),
    };
    await mutation(gm, "post", "/api/combat/one-roll", {
      ...body,
      participants: [{ ...body.participants[0], surge: true }],
    }).expect(400);
    const result = await mutation(
      gm,
      "post",
      "/api/combat/one-roll",
      body,
    ).expect(200);
    expect(result.body.results.map((r: any) => r.damage)).toEqual([7, 7]);
    expect(store.get(a.id).health).toEqual({ superficial: 7, aggravated: 0 });
    expect(store.get(record.id).status).toBe("Encerrado");
    await mutation(gm, "post", "/api/combat/one-roll", body).expect(400);
    const logged = (
      await gm.get("/api/characters/" + a.id + "/rolls")
    ).body.find((r: any) => r.mode === "one-roll");
    await mutation(gm, "post", "/api/rolls/" + logged.id + "/reroll", {
      indices: [0],
    }).expect(400);
    expect(store.get(a.id).willpower.superficial).toBe(0);
    expect(
      (await gm.get("/api/characters/" + a.id + "/history")).body.some(
        (r: any) => r.action === "Conflito de uma rolagem",
      ),
    ).toBe(true);
  });
  it("uma falha no grupo desfaz todas as fichas, históricos e rolagens da operação", async () => {
    await deterministicGM();
    const a = await combatCharacter(),
      b = await combatCharacter(gm, { conditions: ["Torpor"] });
    const rollsBefore = (await gm.get("/api/characters/" + a.id + "/rolls"))
      .body.length;
    await mutation(gm, "post", "/api/combat/one-roll", {
      difficulty: 4,
      participants: [a, b].map((c) => ({
        id: c.id,
        attribute: "forca",
        skill: "briga",
      })),
    }).expect(400);
    expect(store.get(a.id)).toMatchObject(a);
    expect(
      (await gm.get("/api/characters/" + a.id + "/rolls")).body,
    ).toHaveLength(rollsBefore);
    expect(
      (await gm.get("/api/characters/" + a.id + "/history")).body.filter(
        (r: any) => r.action === "Conflito de uma rolagem",
      ),
    ).toHaveLength(0);
  });
  it("confronto recusa repetição de participantes, fichas de outra campanha e jogadores", async () => {
    const a = await combatCharacter(player),
      b = await combatCharacter(player);
    await mutation(player, "post", "/api/combat", combatBody(a, b)).expect(400);
    const body = {
      difficulty: 4,
      participants: [a, a].map((c) => ({
        id: c.id,
        attribute: "forca",
        skill: "briga",
      })),
    };
    await mutation(gm, "post", "/api/combat/one-roll", body).expect(400);
    const other = (
      await mutation(gm, "post", "/api/entities/campaigns", {
        name: "Outra crônica",
        gmId: "atribuido-pelo-servidor",
      }).expect(201)
    ).body;
    const outsider = await combatCharacter(gm, { campaignId: other.id });
    await mutation(gm, "post", "/api/combat", combatBody(a, outsider)).expect(
      400,
    );
    const r = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Confronto restrito",
        kind: "combat",
        campaignId: campaign.id,
        participants: [a.id],
        status: "Em andamento",
      })
    ).body;
    await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, { recordId: r.id }),
    ).expect(400);
  });
  it("backup remapeia o agarrador e os limites de turno sem liberar uma segunda ação", async () => {
    await deterministicGM();
    const a = await combatCharacter(gm, {
        name: "Agarrador",
        attributes: { forca: 4 },
        skills: { briga: 2 },
      }),
      b = await combatCharacter(gm, { name: "Vítima" });
    await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(a, b, { technique: "grapple" }),
    ).expect(200);
    const backup = (await gm.get("/api/backup")).body;
    const invalid = structuredClone(backup);
    invalid.entities.find((e: any) => e.id === b.id).data.grappledBy = b.id;
    const count = store.list("characters").length;
    await mutation(gm, "post", "/api/restore", invalid).expect(400);
    expect(store.list("characters")).toHaveLength(count);
    await mutation(gm, "post", "/api/restore", backup).expect(200);
    const copyA = store
        .list("characters")
        .find((c) => c.name === a.name && c.id !== a.id),
      copyB = store
        .list("characters")
        .find((c) => c.name === b.name && c.id !== b.id);
    expect(copyB.grappledBy).toBe(copyA.id);
    expect(copyB.grappleLastTurn.startsWith(copyB.campaignId + "@")).toBe(true);
    await mutation(
      gm,
      "post",
      "/api/combat",
      combatBody(copyA, copyB, { technique: "bite" }),
    ).expect(400);
  });
  it("mortais rolam sem Fome, não usam sangue e recuperam Vitalidade superficial por sessão", async () => {
    await deterministicGM();
    const c = await combatCharacter(gm, {
      nature: "mortal",
      attributes: { vigor: 3 },
      health: { superficial: 4, aggravated: 0 },
    });
    const r = await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(200);
    expect(r.body.result.hunger).toHaveLength(0);
    for (const action of ["rouse", "mend", "mendAggravated", "blush"])
      await act(c, { action }).expect(400);
    await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "forca",
      skill: "briga",
      surge: true,
    }).expect(400);
    const session = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Recuperação mortal",
        kind: "session",
        campaignId: campaign.id,
        participants: [c.id],
      })
    ).body;
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start").expect(
      200,
    );
    expect(store.get(c.id).health.superficial).toBe(1);
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start").expect(
      400,
    );
    expect(store.get(c.id).health.superficial).toBe(1);
  });
  it("dano que completa a Vitalidade agravada registra Torpor e impede agir", async () => {
    await deterministicGM();
    const c = await combatCharacter();
    await act(c, {
      action: "damage",
      track: "health",
      amount: 4,
      aggravated: true,
    }).expect(200);
    expect(store.get(c.id).conditions).toContain("Torpor");
    const b = await combatCharacter();
    await mutation(gm, "post", "/api/combat", combatBody(c, b)).expect(400);
  });
});
describe("Noites, cura e integridade dos marcadores", () => {
  it("cura agravada requer uma nova noite, preserva ferimentos elegíveis e não se repete", async () => {
    await deterministicGM();
    const c = await createCharacter(gm, {
      health: { superficial: 0, aggravated: 2 },
    });
    await act(c, { action: "rouse", waking: true }).expect(200);
    await act(c, { action: "mendAggravated" }).expect(400);
    await tick("night").expect(200);
    expect(store.get(c.id).aggravatedMendEligible).toBe(2);
    await act(c, { action: "damage", amount: 1, aggravated: true }).expect(200);
    await act(c, { action: "rouse", waking: true }).expect(200);
    const r = await act(c, { action: "mendAggravated" }).expect(200);
    expect(r.body.result.rouses).toHaveLength(3);
    expect(store.get(c.id).health.aggravated).toBe(2);
    expect(store.get(c.id).aggravatedMendEligible).toBe(1);
    await act(c, { action: "mendAggravated" }).expect(400);
    await act(c, { action: "rouse", waking: true }).expect(400);
  });
  it("Narrador avança tempo comum, resolve durações e jogadores não burlam marcadores", async () => {
    const c = await createCharacter(player, {
      health: { superficial: 2, aggravated: 0 },
    });
    await mutation(player, "post", "/api/clock/" + campaign.id + "/advance", {
      scope: "turn",
    }).expect(403);
    await mutation(player, "put", "/api/entities/" + c.id, {
      ...c,
      lastPowerTurn: "fraude",
    }).expect(400);
    await mutation(gm, "post", "/api/clock/" + c.id + "/advance", {
      scope: "turn",
    }).expect(400);
    await tick().expect(200);
    expect(store.get(campaign.id).clock.turn).toBe(2);
    await mutation(gm, "put", "/api/entities/" + campaign.id, {
      ...store.get(campaign.id),
      clock: { night: 9, scene: 1, turn: 1 },
    }).expect(400);
  });
  it("limita recuperação superficial ao turno e evita gastar Sangue sem dano", async () => {
    await deterministicGM();
    const c = await createCharacter(gm, {
      health: { superficial: 2, aggravated: 0 },
    });
    await act(c, { action: "mend" }).expect(200);
    await act(c, { action: "mend" }).expect(400);
    await tick().expect(200);
    await act(c, { action: "mend" }).expect(200);
    await tick().expect(200);
    await act(c, { action: "mend" }).expect(400);
    expect(store.get(c.id).hunger).toBe(1);
  });
  it("backup remapeia marcadores e conserva o limite de cura da noite restaurada", async () => {
    await deterministicGM();
    const c = await createCharacter(gm, {
      health: { superficial: 0, aggravated: 2 },
    });
    await tick("night");
    await act(c, { action: "rouse", waking: true });
    await act(c, { action: "mendAggravated" });
    const backup = (await gm.get("/api/backup")).body;
    await mutation(gm, "post", "/api/restore", backup).expect(200);
    const copy = store.list("characters").find((x) => x.id !== c.id);
    expect(copy.lastWakeNight).toBe(copy.campaignId + "@2");
    expect(copy.lastAggravatedMendNight).toBe(copy.campaignId + "@2");
    expect(copy.aggravatedMendEligible).toBe(1);
    await act(copy, { action: "mendAggravated" }).expect(400);
  });
  it("Ambição recupera um agravado na sessão e os registros não permitem recuperação ilimitada", async () => {
    const c = await createCharacter(gm, {
      willpower: { superficial: 0, aggravated: 2 },
    });
    const session = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Ambição",
        kind: "session",
        campaignId: campaign.id,
        participants: [c.id],
      })
    ).body;
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start", {
      ambitionIds: ["invalido"],
    }).expect(400);
    expect(store.get(session.id).status).not.toBe("Em andamento");
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start", {
      ambitionIds: [c.id],
    }).expect(200);
    expect(store.get(c.id).willpower.aggravated).toBe(1);
    await act(c, { action: "sessionRecovery" }).expect(400);
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start", {
      ambitionIds: [c.id],
    }).expect(400);
  });
  it("alimentação vampírica atualiza doador e bebedor juntos, preserva Fome mínima e exige Narrador", async () => {
    await mutation(gm, "post", "/api/clock/" + campaign.id + "/date", {
      date: "2026-01-01",
      reason: "Calendário do teste de alimentação.",
    }).expect(200);
    const c = await createCharacter(player, { hunger: 4 }),
      donor = await createCharacter(gm, { bloodPotency: 3, hunger: 1 });
    await mutation(player, "post", "/api/characters/" + c.id + "/action", {
      action: "feed",
      source: "vampire",
      targetId: donor.id,
      amount: 1,
    }).expect(400);
    await act(c, {
      action: "feed",
      source: "vampire",
      targetId: donor.id,
      amount: 1,
    }).expect(200);
    expect(store.get(c.id).hunger).toBe(2);
    expect(store.get(donor.id).hunger).toBe(2);
    await act(c, {
      action: "feed",
      source: "vampire",
      targetId: donor.id,
      amount: 4,
    }).expect(400);
    expect(store.get(c.id).hunger).toBe(2);
    expect(store.get(donor.id).hunger).toBe(2);
    await act(c, {
      action: "feed",
      source: "vampire",
      targetId: donor.id,
      amount: 1,
    }).expect(200);
    expect(store.get(c.id).hunger).toBe(1);
  });
  it("Brilho persiste apenas nesta noite e suas penalidades só afetam interação humana", async () => {
    await deterministicGM();
    const c = await createCharacter(gm, {
      humanity: 2,
      attributes: { ...emptyCharacter().attributes, forca: 4, carisma: 4 },
      skills: { ...emptyCharacter().skills, briga: 3, persuasao: 3 },
    });
    await act(c, { action: "blush" }).expect(200);
    const count = (r: any) =>
      r.body.result.normal.length + r.body.result.hunger.length;
    expect(
      count(
        await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
          attribute: "forca",
          skill: "briga",
        }).expect(200),
      ),
    ).toBe(7);
    expect(
      count(
        await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
          attribute: "carisma",
          skill: "persuasao",
          tags: ["interacaoHumana"],
        }).expect(200),
      ),
    ).toBe(3);
    await tick("night").expect(200);
    expect(
      count(
        await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
          attribute: "carisma",
          skill: "persuasao",
          tags: ["interacaoHumana"],
        }).expect(200),
      ),
    ).toBe(1);
  });
});
describe("Poderes e efeitos condicionais", () => {
  it("conserva dois bônus condicionais do mesmo Poder e os aplica somente nos testes correspondentes", async () => {
    await deterministicGM();
    const ds = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Percepção contextual",
        kind: "discipline",
      })
    ).body;
    const p = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Olhos para a Besta",
        kind: "power",
        parentId: ds.id,
        rouse: 1,
        effects: [
          {
            kind: "dice",
            target: "persuasao",
            value: 2,
            when: { field: "tag", value: "alvoMortal" },
            duration: "scene",
          },
          {
            kind: "dice",
            target: "persuasao",
            value: 1,
            when: { field: "hunger", operator: "gte", value: 1 },
            duration: "scene",
          },
        ],
      }).expect(201)
    ).body;
    const c = await createCharacter(gm, {
      disciplines: { [ds.id]: 1 },
      powers: [p.id],
      attributes: { ...emptyCharacter().attributes, carisma: 3 },
      skills: { ...emptyCharacter().skills, persuasao: 2 },
    });
    const used = await act(c, { action: "power", powerId: p.id }).expect(200);
    expect(used.body.result.rouses[0].dice).toHaveLength(2);
    expect(store.get(c.id).activeEffects).toHaveLength(2);
    await act(c, { action: "power", powerId: p.id }).expect(400);
    const r = await mutation(gm, "post", "/api/characters/" + c.id + "/roll", {
      attribute: "carisma",
      skill: "persuasao",
      tags: ["alvoMortal"],
    }).expect(200);
    expect(r.body.result.normal.length + r.body.result.hunger.length).toBe(8);
    const plain = await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      { attribute: "carisma", skill: "persuasao" },
    ).expect(200);
    expect(
      plain.body.result.normal.length + plain.body.result.hunger.length,
    ).toBe(6);
    await tick("scene");
    expect(store.get(c.id).activeEffects).toHaveLength(0);
  });
  it("aplica modificadores permanentes com custo somente após ativação e rejeita testes resistidos incompletos", async () => {
    await deterministicGM();
    const ds = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Transmutação",
        kind: "discipline",
      })
    ).body;
    await mutation(gm, "post", "/api/entities/content", {
      name: "Resistência inválida",
      kind: "power",
      parentId: ds.id,
      resistanceAttribute: "vigor",
      resistanceSkill: "atletismo",
    }).expect(400);
    await mutation(gm, "post", "/api/entities/content", {
      name: "Bônus sem duração",
      kind: "power",
      parentId: ds.id,
      effects: [{ kind: "dice", value: 2, duration: "instant" }],
    }).expect(400);
    const p = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Fortalecer",
        kind: "power",
        parentId: ds.id,
        rouse: 1,
        duration: "permanent",
        effects: [
          {
            kind: "attribute",
            target: "vigor",
            value: 2,
            duration: "permanent",
          },
        ],
      }).expect(201)
    ).body;
    const c = await createCharacter(gm, {
      disciplines: { [ds.id]: 1 },
      powers: [p.id],
    });
    expect(store.get(c.id).activeEffects).toHaveLength(0);
    const before = await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      { attribute: "vigor", skill: "atletismo" },
    );
    expect(
      before.body.result.normal.length + before.body.result.hunger.length,
    ).toBe(1);
    await act(c, { action: "power", powerId: p.id }).expect(200);
    expect(store.get(c.id).activeEffects[0].effect.duration).toBe("permanent");
    await tick("night");
    const after = await mutation(
      gm,
      "post",
      "/api/characters/" + c.id + "/roll",
      { attribute: "vigor", skill: "atletismo" },
    );
    expect(
      after.body.result.normal.length + after.body.result.hunger.length,
    ).toBe(3);
  });
});
describe("Atualização de dados existentes", () => {
  it("normaliza fichas antigas e atualiza apenas definições oficiais com revisão nova", () => {
    const dir = mkdtempSync(join(tmpdir(), "v5-migration-"));
    try {
      const path = join(dir, "migration.sqlite");
      let s = new Store(path);
      const legacy = { ...emptyCharacter(), name: "Legado" } as any;
      for (const key of [
        "clock",
        "lastWakeNight",
        "aggravatedMendEligible",
        "lastSessionRecovery",
      ])
        delete legacy[key];
      s.create("characters", legacy, "gm", "legado");
      const official = s.get("clan-brujah");
      s.update(
        official.id,
        { ...official, revision: 1, name: "Catálogo antigo" },
        official.version,
      );
      s.create(
        "content",
        { name: "Minha variante", kind: "clan", origin: "variant" },
        "gm",
        "variante",
      );
      s.close();
      s = new Store(path);
      expect(s.get("legado").clock).toEqual({ night: 1, scene: 1, turn: 1 });
      expect(s.get("legado").aggravatedMendEligible).toBe(0);
      expect(s.get("clan-brujah").name).toBe("Brujah");
      expect(s.get("clan-brujah").revision).toBe(9);
      expect(s.get("variante").name).toBe("Minha variante");
      s.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const calendar = (date: string) =>
  mutation(gm, "post", "/api/clock/" + campaign.id + "/date", {
    date,
    reason: "Avanço narrativo autorizado para os testes.",
  });
const sip = (c: any, donor: any) =>
  act(c, { action: "bondDrink", targetId: donor.id, narrativeConfirmed: true });
const bind = async (c: any, donor: any) => {
  await sip(c, donor).expect(200);
  await tick("night").expect(200);
  await sip(c, donor).expect(200);
  await tick("night").expect(200);
  await sip(c, donor).expect(200);
  return store.get(c.id).bloodBonds[0];
};
describe("Laços integrados à campanha e calendário", () => {
  it("um salto de datas consome também as noites restantes dos efeitos", async () => {
    await calendar("2026-01-01");
    const c = await createCharacter(gm, {
      activeEffects: [
        {
          id: "efeito",
          sourceId: "clan-brujah",
          label: "Efeito de duas noites",
          effect: { kind: "dice", target: "all", duration: "night", value: 1 },
          createdAt: "",
          remaining: 2,
        },
      ],
    });
    await calendar("2026-01-04").expect(200);
    expect(store.get(c.id).activeEffects).toHaveLength(0);
  });
  it("exige calendário no consumo direto e inclui o vínculo na transação de alimentação", async () => {
    const a = await createCharacter(gm, { hunger: 4 }),
      b = await createCharacter(gm, { hunger: 1 });
    await act(a, {
      action: "feed",
      source: "vampire",
      targetId: b.id,
      amount: 1,
    }).expect(400);
    expect(store.get(a.id).hunger).toBe(4);
    expect(store.get(b.id).hunger).toBe(1);
    await calendar("2026-01-01").expect(200);
    for (let i = 0; i < 3; i++) {
      if (i) await tick("night");
      await act(a, {
        action: "feed",
        source: "vampire",
        targetId: b.id,
        amount: 1,
      }).expect(200);
    }
    expect(store.get(a.id).bloodBonds[0].formed).toBe(true);
    expect(store.get(a.id).hunger).toBe(1);
    expect(store.get(b.id).hunger).toBe(4);
    expect(store.get(campaign.id).storyDate).toBe("2026-01-03");
  });
  it("sangue fora da veia não cria Laço e resolução manual exige justificativa", async () => {
    const a = await createCharacter(gm, { hunger: 4 }),
      b = await createCharacter();
    await act(a, {
      action: "feed",
      source: "vampire",
      targetId: b.id,
      amount: 1,
      direct: false,
    }).expect(200);
    expect(store.get(a.id).bloodBonds).toHaveLength(0);
    await act(a, {
      action: "feed",
      source: "vampire",
      targetId: b.id,
      amount: 1,
      bondHandling: "manual",
    }).expect(400);
    await act(a, {
      action: "feed",
      source: "vampire",
      targetId: b.id,
      amount: 1,
      bondHandling: "manual",
      reason: "Exceção narrativa registrada pelo Narrador.",
    }).expect(200);
    expect(store.get(a.id).bloodBonds).toHaveLength(0);
  });
  it("controle de acesso e proteção de marcadores impedem adulterar vínculos", async () => {
    await calendar("2026-01-01");
    const a = await createCharacter(player),
      b = await createCharacter();
    await mutation(player, "post", "/api/characters/" + a.id + "/action", {
      action: "bondDrink",
      targetId: b.id,
      narrativeConfirmed: true,
    }).expect(400);
    await mutation(player, "post", "/api/clock/" + campaign.id + "/date", {
      date: "2026-01-02",
      reason: "Sem permissão.",
    }).expect(403);
    await sip(a, b).expect(200);
    const saved = store.get(a.id);
    await mutation(player, "put", "/api/entities/" + a.id, {
      ...saved,
      bloodBonds: [],
    }).expect(400);
    await mutation(gm, "put", "/api/entities/" + a.id, {
      ...saved,
      bloodBonds: [],
    }).expect(400);
    await calendar("2025-12-31").expect(400);
    expect(store.get(campaign.id).storyDate).toBe("2026-01-01");
  });
  it("limite de Potência encerra o vínculo mais antigo ao fim da semana", async () => {
    await calendar("2026-01-01");
    const donor = await createCharacter(),
      a = await createCharacter(gm, {
        advantages: [{ contentId: "flaw-escravo-de-laco", level: 2 }],
      }),
      b = await createCharacter(gm, {
        advantages: [{ contentId: "flaw-escravo-de-laco", level: 2 }],
      });
    await sip(a, donor).expect(200);
    await sip(b, donor).expect(200);
    expect(store.get(a.id).bloodBonds[0].releaseOn).toBe("2026-01-08");
    expect(store.get(b.id).bloodBonds[0].releaseOn).toBe("");
    await calendar("2026-01-07").expect(200);
    expect(store.get(a.id).bloodBonds[0].formed).toBe(true);
    await tick("night").expect(200);
    expect(store.get(a.id).bloodBonds[0].strength).toBe(0);
    expect(store.get(b.id).bloodBonds[0].formed).toBe(true);
  });
  it("desafios são disputas reais por cena e afastamento por sessão, com histórico e sem repetição", async () => {
    await deterministicGM();
    await calendar("2026-01-01");
    const a = await createCharacter(player),
      b = await createCharacter();
    const bond = await bind(a, b);
    const r = await mutation(
      player,
      "post",
      "/api/characters/" + a.id + "/action",
      { action: "bondDefy", bondId: bond.id },
    ).expect(200);
    expect(r.body.result.opposition.normal).toHaveLength(3);
    await act(a, { action: "bondDefy", bondId: bond.id }).expect(400);
    await tick("scene");
    await act(a, { action: "bondDefy", bondId: bond.id }).expect(200);
    await act(a, { action: "bondAvoid", bondId: bond.id }).expect(400);
    const session = (
      await mutation(gm, "post", "/api/entities/records", {
        name: "Afastamento",
        kind: "session",
        campaignId: campaign.id,
        participants: [a.id],
      })
    ).body;
    await mutation(gm, "post", "/api/sessions/" + session.id + "/start").expect(
      200,
    );
    await act(a, { action: "bondAvoid", bondId: bond.id }).expect(200);
    await act(a, { action: "bondAvoid", bondId: bond.id }).expect(400);
    await mutation(player, "post", "/api/characters/" + a.id + "/action", {
      action: "bondAvoid",
      bondId: bond.id,
      reminder: true,
      reason: "Nova lembrança.",
    }).expect(400);
    await act(a, {
      action: "bondAvoid",
      bondId: bond.id,
      reminder: true,
      reason: "O reinante apareceu na narrativa.",
    }).expect(200);
    expect(
      (await gm.get("/api/characters/" + a.id + "/rolls")).body.some(
        (r: any) => r.label === "Afastamento do Laço",
      ),
    ).toBe(true);
  });
  it("decadência exige confirmação do Narrador e não ocorre apenas porque a data avançou", async () => {
    await calendar("2026-01-01");
    const a = await createCharacter(player),
      b = await createCharacter();
    const bond = await bind(a, b);
    await calendar("2026-02-03").expect(200);
    expect(store.get(a.id).bloodBonds[0].strength).toBe(3);
    await act(a, { action: "bondDecay", bondId: bond.id }).expect(400);
    await mutation(player, "post", "/api/characters/" + a.id + "/action", {
      action: "bondDecay",
      bondId: bond.id,
      avoided: true,
      reason: "Tentativa sem permissão.",
    }).expect(400);
    await act(a, {
      action: "bondDecay",
      bondId: bond.id,
      avoided: true,
      reason:
        "O servo se manteve afastado e resolveu os desafios de cada sessão.",
    }).expect(200);
    expect(store.get(a.id).bloodBonds[0].strength).toBe(2);
    await act(a, {
      action: "bondDecay",
      bondId: bond.id,
      avoided: true,
      reason: "Tentativa de repetir.",
    }).expect(400);
  });
  it("backup remapeia reinante e limites de desafios, preservando calendário e Laço", async () => {
    await calendar("2026-01-01");
    const a = await createCharacter(gm, { name: "Servo persistente" }),
      b = await createCharacter(gm, { name: "Reinante persistente" });
    const bond = await bind(a, b);
    await act(a, { action: "bondDefy", bondId: bond.id }).expect(200);
    const backup = (await gm.get("/api/backup")).body;
    await mutation(gm, "post", "/api/restore", backup).expect(200);
    const copy = store
        .list("characters")
        .find((c) => c.id !== a.id && c.name === a.name),
      donor = store
        .list("characters")
        .find((c) => c.id !== b.id && c.name === b.name);
    expect(copy.bloodBonds[0].regnantId).toBe(donor.id);
    expect(copy.bloodBonds[0].lastDefiance).toContain(copy.campaignId + "@");
    expect(store.get(copy.campaignId).storyDate).toBe("2026-01-03");
    await act(copy, {
      action: "bondDefy",
      bondId: copy.bloodBonds[0].id,
    }).expect(400);
    await mutation(gm, "delete", "/api/entities/" + donor.id, {
      confirm: donor.name,
    }).expect(400);
  });
  it("regras de Laço personalizadas são exportáveis e funcionam ao serem adquiridas", async () => {
    await calendar("2026-01-01");
    const custom = (
      await mutation(gm, "post", "/api/entities/content", {
        name: "Espírito Insubmisso",
        kind: "merit",
        bondRule: { immune: true, resistance: 2 },
      }).expect(201)
    ).body;
    const a = await createCharacter(gm, {
        advantages: [{ contentId: custom.id, level: 1 }],
      }),
      b = await createCharacter();
    await sip(a, b).expect(200);
    expect(store.get(a.id).bloodBonds).toHaveLength(0);
    const content = (await gm.get("/api/content/export")).body;
    expect(content.entries[0].bondRule.immune).toBe(true);
  });
});

const reachId = "formula-alquimia-sangue-ralo-longo-alcance";
async function readyReach(extra: any = {}) {
  const fixture = validThinCharacter();
  const c = await activeAlchemist("fixatio", {
    powers: [reachId],
    attributes: { ...fixture.attributes, inteligencia: 3, determinacao: 3 },
    ...extra,
  });
  await alchemy(c, { ...alchemyPrep, formulaId: reachId }).expect(200);
  const activated = await alchemy(c, {
    operation: "activate",
    preparationId: store.get(c.id).alchemy.preparations[0].id,
    reviewDistillation: true,
  }).expect(200);
  const activationId = activated.body.result.activationId;
  await alchemy(c, { operation: "acceptDistillation", activationId }).expect(
    200,
  );
  return { c, activationId };
}
const reachTarget = () =>
  createCharacter(gm, {
    name: "Alvo de Longo Alcance",
    nature: "mortal",
    hunger: 0,
    attributes: {
      ...emptyCharacter().attributes,
      forca: 1,
      vigor: 3,
      determinacao: 3,
      autocontrole: 3,
    },
    skills: { ...emptyCharacter().skills, atletismo: 1 },
  });
const reachUse = {
  operation: "formulaTest",
  mode: "throw",
  object: "Arremessar adversário",
  weightKg: 70,
  sceneConfirmed: true,
};
describe("Longo Alcance integrado, turnos e backup", () => {
  it("salva paradas separadas e aplica o arremesso uma única vez após aceitar", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const before = store.get(c.id);
    const used = await alchemy(c, {
      ...reachUse,
      activationId,
      targetId: target.id,
    }).expect(200);
    const t = used.body.result.formulaTest;
    expect(t.actor.normal).toHaveLength(3);
    expect(t.opposition.normal).toHaveLength(2);
    expect(store.get(target.id).health.superficial).toBe(0);
    expect(store.get(c.id).hunger).toBe(before.hunger);
    const accept = {
      operation: "acceptFormulaTest",
      activationId,
      testId: t.id,
    };
    const r = await alchemy(c, accept).expect(200);
    expect(r.body.result.formulaTest.outcome).toMatchObject({
      margin: 2,
      rawDamage: 2,
      appliedDamage: 1,
      meters: 2,
    });
    expect(store.get(target.id).health.superficial).toBe(1);
    expect(store.get(target.id).conditions).toContain("Caído");
    const after = store.get(c.id);
    await alchemy(c, accept).expect(400);
    expect(store.get(c.id)).toEqual(after);
    expect(store.get(target.id).health.superficial).toBe(1);
    expect(
      (await gm.get(`/api/characters/${c.id}/rolls`)).body.some(
        (x: any) => x.formulaTest?.id === t.id,
      ),
    ).toBe(true);
  });
  it("jogador não pode rolar contra alvo alheio, rerrolar resistência nem aceitar dano sem autorização", async () => {
    let calls = 0;
    await deterministicGM();
    await deterministicPlayer();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const playerWithCounter = request.agent(
      createApp(store, () => {
        calls++;
        return 8;
      }),
    );
    await mutation(playerWithCounter, "post", "/api/auth/login", {
      username: "jogador",
      password: "senha-de-teste-segura",
    }).expect(200);
    await alchemy(
      c,
      { ...reachUse, activationId, targetId: target.id },
      playerWithCounter,
    ).expect(400);
    expect(calls).toBe(0);
    const used = await alchemy(c, {
      ...reachUse,
      activationId,
      targetId: target.id,
    }).expect(200);
    const testId = used.body.result.formulaTest.id,
      before = store.get(target.id);
    await alchemy(
      c,
      {
        operation: "rerollFormulaTest",
        activationId,
        testId,
        side: "opposition",
        indices: [0],
      },
      playerWithCounter,
    ).expect(400);
    await alchemy(
      c,
      { operation: "acceptFormulaTest", activationId, testId },
      playerWithCounter,
    ).expect(400);
    expect(calls).toBe(0);
    expect(store.get(target.id)).toEqual(before);
  });
  it("jogador move objeto próprio e revisão não pode ser alterada por PUT ou endpoint genérico", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, activationId } = await readyReach();
    const used = await alchemy(
      c,
      { ...reachUse, mode: "move", activationId, targetId: "" },
      player,
    ).expect(200);
    const testId = used.body.result.formulaTest.id;
    const before = store.get(c.id),
      changed = structuredClone(before);
    changed.alchemy.activations[0].formulaTests[0].status = "cancelled";
    await mutation(player, "put", `/api/entities/${c.id}`, changed).expect(400);
    expect(store.get(c.id)).toEqual(before);
    const log = (await player.get(`/api/characters/${c.id}/rolls`)).body.find(
      (x: any) => x.formulaTest?.id === testId,
    );
    await mutation(player, "post", `/api/rolls/${log.id}/reroll`, {
      indices: [0],
    }).expect(400);
    await alchemy(
      c,
      { operation: "acceptFormulaTest", activationId, testId },
      player,
    ).expect(200);
    expect(
      store.get(c.id).alchemy.activations[0].formulaTests[0].outcome.success,
    ).toBe(true);
  });
  it("rerrolagens concorrentes cobram uma vez, com resistência e usuário independentes", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const used = await alchemy(c, {
      ...reachUse,
      activationId,
      targetId: target.id,
    }).expect(200);
    const testId = used.body.result.formulaTest.id;
    const requestData = {
      operation: "rerollFormulaTest",
      activationId,
      testId,
      indices: [0],
    };
    const rs = await Promise.all([
      alchemy(c, requestData),
      alchemy(c, requestData),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    expect(store.get(target.id).willpower.superficial).toBe(0);
    await alchemy(c, { ...requestData, side: "opposition" }).expect(200);
    expect(store.get(target.id).willpower.superficial).toBe(1);
    const t = store.get(c.id).alchemy.activations[0].formulaTests[0];
    expect(t.actorReview.original.hunger).toEqual(t.actor.hunger);
    expect(t.oppositionReview.original.hunger).toEqual(t.opposition.hunger);
    const history = (await gm.get(`/api/characters/${c.id}/rolls`)).body.filter(
      (x: any) => x.operation === "rerollFormulaTest",
    );
    expect(history).toHaveLength(2);
    expect(history.every((x: any) => x.rerolled && x.review.original)).toBe(
      true,
    );
  });
  it("sustentação persiste ao turno seguinte e cessa quando a manutenção é omitida", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const use = async () => {
      const r = await alchemy(c, {
        ...reachUse,
        mode: "hold",
        activationId,
        targetId: target.id,
      }).expect(200);
      await alchemy(c, {
        operation: "acceptFormulaTest",
        activationId,
        testId: r.body.result.formulaTest.id,
      }).expect(200);
    };
    await use();
    await tick().expect(200);
    expect(store.get(c.id).conditions).toContain("Longo Alcance ativo");
    expect(store.get(target.id).conditions).toContain(
      "Suspenso por Longo Alcance",
    );
    const hunger = store.get(c.id).hunger;
    await use();
    await tick().expect(200);
    expect(store.get(c.id).conditions).toContain("Longo Alcance ativo");
    expect(store.get(c.id).hunger).toBe(hunger);
    await tick().expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
    expect(store.get(target.id).conditions).not.toContain(
      "Suspenso por Longo Alcance",
    );
    expect(store.get(target.id).health.superficial).toBe(0);
  });
  it.each(["turn", "scene", "night"])(
    "avanço de %s cancela testes pendentes sem aplicar dano",
    async (scope) => {
      await deterministicGM();
      const { c, activationId } = await readyReach(),
        target = await reachTarget();
      const used = await alchemy(c, {
        ...reachUse,
        activationId,
        targetId: target.id,
      }).expect(200);
      await tick(scope).expect(200);
      const t = store.get(c.id).alchemy.activations[0].formulaTests[0];
      expect(t.status).toBe("cancelled");
      expect(t.actorReview.state).toBe("closed");
      await alchemy(c, {
        operation: "acceptFormulaTest",
        activationId,
        testId: used.body.result.formulaTest.id,
      }).expect(400);
      expect(store.get(target.id).health.superficial).toBe(0);
    },
  );
  it("backup remapeia teste, alvo e marcadores e conserva dados originais sem modificar a origem", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const used = await alchemy(c, {
      ...reachUse,
      mode: "hold",
      activationId,
      targetId: target.id,
    }).expect(200);
    const testId = used.body.result.formulaTest.id;
    await alchemy(c, {
      operation: "rerollFormulaTest",
      activationId,
      testId,
      indices: [0],
    }).expect(200);
    const before = store.get(c.id);
    await mutation(
      gm,
      "post",
      "/api/restore",
      (await gm.get("/api/backup")).body,
    ).expect(200);
    const copy = store
      .list("characters")
      .find((x) => x.id !== c.id && x.name === c.name);
    const a = copy.alchemy.activations[0],
      t = a.formulaTests[0];
    expect(t.id).not.toBe(testId);
    expect(a.id).not.toBe(activationId);
    expect(t.targetId).not.toBe(target.id);
    expect(t.turn.startsWith(copy.campaignId + "@")).toBe(true);
    expect(a.longReach.lastActionTurn).toBe(t.turn);
    expect(t.actorReview).toEqual(
      before.alchemy.activations[0].formulaTests[0].actorReview,
    );
    await alchemy(copy, {
      operation: "acceptFormulaTest",
      activationId: a.id,
      testId: t.id,
    }).expect(200);
    expect(store.get(t.targetId).conditions).toContain(
      "Suspenso por Longo Alcance",
    );
    expect(store.get(target.id).conditions).not.toContain(
      "Suspenso por Longo Alcance",
    );
    expect(store.get(c.id)).toEqual(before);
  });
  it("restauração rejeita Fome adulterada, teste duplicado ou alvo pendente inexistente, com rollback", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach(),
      target = await reachTarget();
    const used = await alchemy(c, {
      ...reachUse,
      activationId,
      targetId: target.id,
    }).expect(200);
    await alchemy(c, {
      operation: "rerollFormulaTest",
      activationId,
      testId: used.body.result.formulaTest.id,
      indices: [0],
    }).expect(200);
    const backup = (await gm.get("/api/backup")).body,
      count = store.list("characters").length;
    for (const corrupt of [
      (a: any) => (a.formulaTests[0].actor.hunger[0] = 1),
      (a: any) => a.formulaTests.push(a.formulaTests[0]),
      (a: any) => (a.formulaTests[0].targetId = "missing"),
    ]) {
      const b = structuredClone(backup);
      corrupt(
        b.entities.find((x: any) => x.id === c.id).data.alchemy.activations[0],
      );
      await mutation(gm, "post", "/api/restore", b).expect(400);
      expect(store.list("characters")).toHaveLength(count);
    }
  });
});

describe("Longo Alcance em fichas avulsas", () => {
  it("avançar só o relógio do alquimista limpa suspensão externa quando a manutenção termina", async () => {
    await deterministicGM();
    const { c, activationId } = await readyReach({ ownerId: campaign.gmId }),
      target = await reachTarget();
    for (const x of [c, target])
      store.update(
        x.id,
        { ...store.get(x.id), campaignId: "" },
        store.get(x.id).version,
      );
    const used = await alchemy(c, {
      ...reachUse,
      mode: "hold",
      activationId,
      targetId: target.id,
    }).expect(200);
    await alchemy(c, {
      operation: "acceptFormulaTest",
      activationId,
      testId: used.body.result.formulaTest.id,
    }).expect(200);
    await tick("turn", c).expect(200);
    expect(store.get(c.id).conditions).toContain("Longo Alcance ativo");
    expect(store.get(target.id).conditions).toContain(
      "Suspenso por Longo Alcance",
    );
    await tick("turn", c).expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
    expect(store.get(target.id).conditions).not.toContain(
      "Suspenso por Longo Alcance",
    );
    expect(
      store
        .get(target.id)
        .activeEffects.some((e: any) =>
          e.effectKey.startsWith(`alchemy:${activationId}:`),
        ),
    ).toBe(false);
  });
});

const envelopId = "formula-alquimia-sangue-ralo-envolver";
async function readyEnvelop(extra: any = {}, targetExtra: any = {}) {
  const t = await createCharacter(gm, {
    name: "Alvo de Envolver",
    nature: "mortal",
    hunger: 0,
    ownerId: playerId,
    attributes: {
      ...emptyCharacter().attributes,
      vigor: 2,
      destreza: 4,
      raciocinio: 4,
    },
    skills: {
      ...emptyCharacter().skills,
      armasFogo: 3,
      sagacidade: 3,
      sobrevivencia: 1,
    },
    ...targetExtra,
  });
  const fixture = validThinCharacter();
  const c = await activeAlchemist("fixatio", {
    powers: [envelopId],
    disciplines: { [ALCHEMY]: 2 },
    attributes: { ...fixture.attributes, inteligencia: 2, raciocinio: 3 },
    ...extra,
  });
  await alchemy(c, { ...alchemyPrep, formulaId: envelopId }).expect(200);
  const r = await alchemy(c, {
    operation: "activate",
    preparationId: store.get(c.id).alchemy.preparations[0].id,
    targetIds: [t.id],
    sceneConfirmed: true,
    reviewDistillation: true,
  }).expect(200);
  const activationId = r.body.result.activationId;
  await alchemy(c, { operation: "acceptDistillation", activationId }).expect(
    200,
  );
  return { c, t, activationId };
}
const envelopUse = {
  operation: "formulaTest",
  mode: "suffocate",
  sceneConfirmed: true,
};
async function choke(c: any, activationId: string) {
  const r = await alchemy(c, { ...envelopUse, activationId }).expect(200);
  const testId = r.body.result.formulaTest.id;
  await alchemy(c, {
    operation: "acceptFormulaTest",
    activationId,
    testId,
  }).expect(200);
  return testId;
}
describe("Envolver integrado — obstrução, asfixia e permissões", () => {
  it("contexto visual sem alvo e ataques de Armas de Fogo aplicam −3; audição não é penalizada", async () => {
    await deterministicGM();
    const { t } = await readyEnvelop();
    for (const [skill, targetContext, count] of [
      ["sagacidade", "visual", 4],
      ["sagacidade", "", 7],
      ["armasFogo", "", 4],
    ] as const) {
      const r = await mutation(gm, "post", `/api/characters/${t.id}/roll`, {
        attribute: "raciocinio",
        skill,
        targetContext,
        difficulty: 1,
      }).expect(200);
      expect(r.body.result.normal).toHaveLength(count);
    }
    expect(store.get(t.id).conditions).toContain("Envolto em névoa alquímica");
  });
  it("asfixia só aplica restrição ao aceitar, impede ações e preserva Vitalidade", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, t, activationId } = await readyEnvelop();
    const r = await alchemy(c, { ...envelopUse, activationId }, player).expect(
      200,
    );
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
    const accept = {
      operation: "acceptFormulaTest",
      activationId,
      testId: r.body.result.formulaTest.id,
    };
    await alchemy(c, accept, player).expect(200);
    expect(store.get(t.id).conditions).toContain("Sufocando por Envolver");
    expect(store.get(t.id).health).toEqual(t.health);
    await mutation(player, "post", `/api/characters/${t.id}/roll`, {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(400);
    await mutation(player, "post", `/api/characters/${t.id}/action`, {
      action: "equip",
      itemId: "none",
    }).expect(400);
    const before = store.get(c.id);
    await alchemy(c, accept, player).expect(400);
    expect(store.get(c.id)).toEqual(before);
    await alchemy(c, { operation: "end", activationId }, player).expect(200);
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
    await mutation(player, "post", `/api/characters/${t.id}/roll`, {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(200);
  });
  it("não contorna acesso ao alvo salvo omitindo targetId, antes de sortear", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop(
      {},
      { ownerId: campaign.gmId },
    );
    let calls = 0;
    const attacker = request.agent(
      createApp(store, () => {
        calls++;
        return 8;
      }),
    );
    await mutation(attacker, "post", "/api/auth/login", {
      username: "jogador",
      password: "senha-de-teste-segura",
    }).expect(200);
    await alchemy(c, { ...envelopUse, activationId }, attacker).expect(400);
    expect(calls).toBe(0);
    const r = await alchemy(c, { ...envelopUse, activationId }).expect(200);
    for (const operation of ["rerollFormulaTest", "acceptFormulaTest"])
      await alchemy(
        c,
        {
          operation,
          activationId,
          testId: r.body.result.formulaTest.id,
          indices: [0],
        },
        attacker,
      ).expect(400);
    expect(calls).toBe(0);
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
  });
  it("nem ficha em rascunho remove efeitos, expira a cena ou muda natureza para escapar sem autorização", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, t, activationId } = await readyEnvelop();
    await choke(c, activationId);
    const before = store.get(t.id);
    for (const extra of [{ activeEffects: [] }, { nature: "vampire" }])
      await mutation(player, "put", `/api/entities/${t.id}`, {
        ...before,
        ...extra,
      }).expect(400);
    await mutation(player, "post", `/api/characters/${t.id}/action`, {
      action: "expire",
      scope: "scene",
    }).expect(400);
    const cosmeticallyRemoved = { ...before, conditions: [] };
    await mutation(
      player,
      "put",
      `/api/entities/${t.id}`,
      cosmeticallyRemoved,
    ).expect(400);
    await mutation(player, "post", `/api/characters/${t.id}/roll`, {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(400);
    expect(store.get(t.id).activeEffects).toEqual(before.activeEffects);
  });
  it("vitória crítica deixa inconsciência persistente, cuja recuperação cabe ao Narrador", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, t, activationId } = await readyEnvelop();
    const values = [10, 10, 1, 1, 8, 8, 8, 8];
    await deterministicGM(() => values.shift() ?? 8);
    await choke(c, activationId);
    expect(store.get(t.id).conditions).toContain("Inconsciente após Envolver");
    await tick("scene").expect(200);
    const after = store.get(t.id);
    expect(after.conditions).not.toContain("Sufocando por Envolver");
    expect(after.conditions).toContain("Inconsciente após Envolver");
    await mutation(player, "put", `/api/entities/${t.id}`, {
      ...after,
      conditions: [],
    }).expect(400);
    await mutation(player, "post", `/api/characters/${t.id}/roll`, {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(400);
    await mutation(gm, "put", `/api/entities/${t.id}`, {
      ...after,
      conditions: [],
    }).expect(200);
    await mutation(player, "post", `/api/characters/${t.id}/roll`, {
      attribute: "forca",
      skill: "briga",
      difficulty: 1,
    }).expect(200);
    expect(store.get(t.id).health).toEqual(t.health);
  });
  it("rerrolagens têm originais, Fome e Vontade independentes e não aplicam asfixia", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop();
    const r = await alchemy(c, { ...envelopUse, activationId }).expect(200),
      testId = r.body.result.formulaTest.id;
    for (const side of ["actor", "opposition"])
      await alchemy(c, {
        operation: "rerollFormulaTest",
        activationId,
        testId,
        side,
        indices: [0],
      }).expect(200);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    expect(store.get(t.id).willpower.superficial).toBe(1);
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
    const test = store.get(c.id).alchemy.activations[0].formulaTests[0];
    expect(test.actor.hunger).toEqual(test.actorReview.original.hunger);
    const logs = (await gm.get(`/api/characters/${c.id}/rolls`)).body;
    expect(
      logs
        .filter((x: any) => x.operation === "rerollFormulaTest")
        .every(
          (x: any) => x.label.startsWith("Asfixia de Envolver") && x.rerolled,
        ),
    ).toBe(true);
  });
  it("avanço cancela teste aberto e a cena retira os efeitos, sem aplicação retroativa", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop();
    const r = await alchemy(c, { ...envelopUse, activationId }).expect(200);
    await tick().expect(200);
    expect(store.get(t.id).conditions).toContain("Envolto em névoa alquímica");
    expect(store.get(c.id).alchemy.activations[0].formulaTests[0].status).toBe(
      "cancelled",
    );
    await alchemy(c, {
      operation: "acceptFormulaTest",
      activationId,
      testId: r.body.result.formulaTest.id,
    }).expect(400);
    await tick("scene").expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
    expect(store.get(t.id).conditions).not.toContain(
      "Envolto em névoa alquímica",
    );
  });
  it("backup remapeia asfixia em revisão, preserva ambos os originais e resolve só na cópia", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop();
    const r = await alchemy(c, { ...envelopUse, activationId }).expect(200),
      testId = r.body.result.formulaTest.id;
    await alchemy(c, {
      operation: "rerollFormulaTest",
      activationId,
      testId,
      side: "opposition",
      indices: [0],
    }).expect(200);
    const original = store.get(c.id);
    await mutation(
      gm,
      "post",
      "/api/restore",
      (await gm.get("/api/backup")).body,
    ).expect(200);
    const copy = store
      .list("characters")
      .find((x) => x.id !== c.id && x.name === c.name);
    const a = copy.alchemy.activations[0],
      test = a.formulaTests[0];
    expect(test.id).not.toBe(testId);
    expect(test.targetId).not.toBe(t.id);
    expect(a.targets).toContain(copy.id);
    expect(test.oppositionReview).toEqual(
      original.alchemy.activations[0].formulaTests[0].oppositionReview,
    );
    await alchemy(copy, {
      operation: "acceptFormulaTest",
      activationId: a.id,
      testId: test.id,
    }).expect(200);
    expect(store.get(test.targetId).conditions).toContain(
      "Sufocando por Envolver",
    );
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
    expect(store.get(c.id)).toEqual(original);
  });
  it("restauração rejeita alvo próprio, múltiplo ou teste de outra fórmula com rollback", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop();
    await alchemy(c, { ...envelopUse, activationId }).expect(200);
    const backup = (await gm.get("/api/backup")).body,
      count = store.list("characters").length;
    for (const corrupt of [
      (a: any) => (a.targets = [t.id]),
      (a: any) => (a.targets = [t.id, t.id]),
      (a: any) => (a.formulaTests[0].targetId = c.id),
      (a: any) => (a.formulaTests[0].mode = "throw"),
    ]) {
      const b = structuredClone(backup);
      corrupt(
        b.entities.find((x: any) => x.id === c.id).data.alchemy.activations[0],
      );
      await mutation(gm, "post", "/api/restore", b).expect(400);
      expect(store.list("characters")).toHaveLength(count);
    }
  });
  it("relógio avulso encerra névoa e asfixia no alvo externo", async () => {
    await deterministicGM();
    const { c, t, activationId } = await readyEnvelop(
      { ownerId: campaign.gmId },
      { ownerId: campaign.gmId },
    );
    for (const x of [c, t])
      store.update(
        x.id,
        { ...store.get(x.id), campaignId: "" },
        store.get(x.id).version,
      );
    await choke(c, activationId);
    await tick("scene", c).expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
    expect(store.get(t.id).conditions).not.toContain("Sufocando por Envolver");
    expect(store.get(t.id).conditions).not.toContain(
      "Envolto em névoa alquímica",
    );
  });
});

it("backup de Envolver antigo ainda pendente e sem alvo pode ser restaurado e encerrado sem inventar alvo", async () => {
  await deterministicGM();
  const { c } = await readyEnvelop();
  const backup = (await gm.get("/api/backup")).body;
  const data = backup.entities.find((x: any) => x.id === c.id).data;
  data.alchemy.activations[0].status = "pending";
  data.alchemy.activations[0].targets = [c.id];
  delete data.alchemy.activations[0].formulaTests;
  delete data.alchemy.activations[0].longReach;
  for (const e of backup.entities.filter((e: any) => e.type === "characters")) {
    e.data.activeEffects = [];
    e.data.conditions = [];
  }
  data.activeEffects = [];
  data.conditions = [];
  await mutation(gm, "post", "/api/restore", backup).expect(200);
  const copy = store
    .list("characters")
    .find((x) => x.id !== c.id && x.name === c.name);
  expect(copy.alchemy.activations[0].status).toBe("pending");
  await alchemy(copy, {
    operation: "resolve",
    activationId: copy.alchemy.activations[0].id,
    ...alchemyNarrator,
    applyEffects: true,
  }).expect(400);
  await alchemy(copy, {
    operation: "end",
    activationId: copy.alchemy.activations[0].id,
  }).expect(200);
  expect(store.get(copy.id).alchemy.activations[0].status).toBe("ended");
});

const flightId = "formula-alquimia-sangue-ralo-impulso-suspenso-no-ar";
const flightConclusion = {
  operation: "completeCrafting",
  craftingConfirmed: true,
  donorConfirmed: true,
  researchConfirmed: true,
  narrativeConfirmed: true,
  note: "Narrador conferiu três noites de destilação, pesquisa prévia de três meses e origem compatível da gota de vitae.",
};
async function flightSource(extra: any = {}) {
  const fixture = validThinCharacter();
  return activeAlchemist("fixatio", {
    name: "Alquimista de Impulso",
    powers: [flightId],
    disciplines: { [ALCHEMY]: 4 },
    attributes: { ...fixture.attributes, inteligencia: 1, forca: 3 },
    ...extra,
  });
}
async function readyFlight(extra: any = {}) {
  const c = await flightSource(extra);
  await alchemy(c, { ...alchemyPrep, formulaId: flightId }).expect(200);
  await alchemy(c, {
    ...flightConclusion,
    preparationId: store.get(c.id).alchemy.preparations[0].id,
  }).expect(200);
  const used = await alchemy(c, {
    operation: "activate",
    preparationId: store.get(c.id).alchemy.preparations[0].id,
    reviewDistillation: true,
  }).expect(200);
  const activationId = used.body.result.activationId;
  await alchemy(c, { operation: "acceptDistillation", activationId }).expect(
    200,
  );
  if (store.get(c.id).alchemy.activations[0].status === "pending")
    await alchemy(c, {
      operation: "resolve",
      activationId,
      ...alchemyNarrator,
    }).expect(200);
  return { c, activationId };
}
const flightTarget = (extra: any = {}) =>
  createCharacter(gm, {
    name: "Passageiro de Impulso",
    nature: "mortal",
    hunger: 0,
    ownerId: playerId,
    attributes: {
      ...emptyCharacter().attributes,
      forca: 2,
      vigor: 3,
      determinacao: 3,
      autocontrole: 3,
    },
    skills: { ...emptyCharacter().skills, atletismo: 1 },
    ...extra,
  });
const flightUse = {
  operation: "formulaTest",
  mode: "fly",
  sceneConfirmed: true,
};
async function resolveFlightUse(
  c: any,
  activationId: string,
  extra: any = {},
  agent = gm,
) {
  const used = await alchemy(
    c,
    { ...flightUse, activationId, ...extra },
    agent,
  ).expect(200);
  const testId = used.body.result.formulaTest.id;
  return alchemy(
    c,
    { operation: "acceptFormulaTest", activationId, testId },
    agent,
  ).expect(200);
}
describe("Impulso integrado — preparação, voo, passageiros e backup", () => {
  it("jogador inicia, mas só o Narrador conclui trabalho/pesquisa/vitae sem repetir custo", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const c = await flightSource();
    await alchemy(c, { ...alchemyPrep, formulaId: flightId }, player).expect(
      200,
    );
    const before = store.get(c.id),
      preparationId = before.alchemy.preparations[0].id;
    await alchemy(c, { operation: "activate", preparationId }, player).expect(
      400,
    );
    await alchemy(c, { ...flightConclusion, preparationId }, player).expect(
      400,
    );
    const completed = await alchemy(c, {
      ...flightConclusion,
      preparationId,
    }).expect(200);
    expect(completed.body.result.rouses).toEqual([]);
    expect(store.get(c.id).hunger).toBe(before.hunger);
    expect(
      store.get(c.id).alchemy.preparations[0].crafting.researchConfirmed,
    ).toBe(true);
    await alchemy(c, { ...flightConclusion, preparationId }).expect(400);
  });
  it("avançar três noites não presume trabalho concluído", async () => {
    await deterministicGM();
    const c = await flightSource();
    await alchemy(c, { ...alchemyPrep, formulaId: flightId }).expect(200);
    for (let n = 0; n < 3; n++) await tick("night").expect(200);
    expect(store.get(c.id).alchemy.preparations[0].crafting.nights).toBe(0);
    await alchemy(c, {
      operation: "activate",
      preparationId: store.get(c.id).alchemy.preparations[0].id,
    }).expect(400);
  });
  it("voo pessoal sem dados aguarda aceitação, persiste e não repete consumo", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, activationId } = await readyFlight();
    const before = store.get(c.id);
    const used = await alchemy(
      c,
      { ...flightUse, activationId },
      player,
    ).expect(200);
    expect(used.body.result.formulaTest.actor).toBeNull();
    expect(store.get(c.id).conditions).not.toContain("Em voo alquímico");
    const accepted = {
      operation: "acceptFormulaTest",
      activationId,
      testId: used.body.result.formulaTest.id,
    };
    await alchemy(c, accepted, player).expect(200);
    expect(store.get(c.id).conditions).toContain("Em voo alquímico");
    expect(store.get(c.id).hunger).toBe(before.hunger);
    expect(store.get(c.id).alchemy.preparations).toHaveLength(0);
    await alchemy(c, accepted, player).expect(400);
    const state = (await player.get("/api/state")).body.characters.find(
      (x: any) => x.id === c.id,
    );
    expect(state.alchemy.activations[0].flight.airborne).toBe(true);
  });
  it("levar quem resiste usa duas paradas, rerrolagens próprias e aceita transporte uma única vez", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      target = await flightTarget();
    const used = await alchemy(c, {
        ...flightUse,
        mode: "capture",
        targetId: target.id,
        humanMassConfirmed: true,
        activationId,
      }).expect(200),
      testId = used.body.result.formulaTest.id;
    expect(used.body.result.formulaTest.actor.normal).toHaveLength(6);
    expect(used.body.result.formulaTest.opposition.normal).toHaveLength(3);
    expect(store.get(target.id).conditions).not.toContain(
      "Transportado em voo alquímico",
    );
    for (const side of ["actor", "opposition"])
      await alchemy(c, {
        operation: "rerollFormulaTest",
        activationId,
        testId,
        side,
        indices: [0],
      }).expect(200);
    expect(store.get(c.id).willpower.superficial).toBe(1);
    expect(store.get(target.id).willpower.superficial).toBe(1);
    await alchemy(c, {
      operation: "acceptFormulaTest",
      activationId,
      testId,
    }).expect(200);
    expect(store.get(c.id).alchemy.activations[0].flight.passengerId).toBe(
      target.id,
    );
    expect(store.get(target.id).conditions).toContain(
      "Transportado em voo alquímico",
    );
    expect(store.get(target.id).health).toEqual(target.health);
    const log = (await gm.get(`/api/characters/${c.id}/rolls`)).body.find(
      (x: any) => x.operation === "rerollFormulaTest",
    );
    expect(log.label).toContain("Impulso Suspenso");
    expect(log.rerolled).toBe(true);
  });
  it("empate na tentativa do oponente puxa ao chão sem dano nem perda da capacidade da cena", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      target = await flightTarget({
        attributes: { ...emptyCharacter().attributes, forca: 3 },
        skills: { ...emptyCharacter().skills, atletismo: 4 },
      });
    await resolveFlightUse(c, activationId);
    await tick().expect(200);
    const r = await resolveFlightUse(c, activationId, {
      mode: "ground",
      targetId: target.id,
    });
    expect(r.body.result.formulaTest.outcome).toMatchObject({
      success: true,
      margin: 0,
      rawDamage: 0,
    });
    expect(store.get(c.id).conditions).not.toContain("Em voo alquímico");
    expect(store.get(c.id).conditions).toContain(
      "Impulso Suspenso no Ar ativo",
    );
    expect(store.get(c.id).health).toEqual(c.health);
  });
  it("alvo e passageiro salvos exigem autorização antes do sorteio mesmo se omitidos na requisição", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      target = await flightTarget({ ownerId: campaign.gmId });
    let calls = 0;
    const requester = request.agent(
      createApp(store, () => {
        calls++;
        return 8;
      }),
    );
    await mutation(requester, "post", "/api/auth/login", {
      username: "jogador",
      password: "senha-de-teste-segura",
    }).expect(200);
    await alchemy(
      c,
      {
        ...flightUse,
        activationId,
        mode: "capture",
        targetId: target.id,
        humanMassConfirmed: true,
      },
      requester,
    ).expect(400);
    expect(calls).toBe(0);
    await resolveFlightUse(c, activationId, {
      mode: "carry",
      targetId: target.id,
      humanMassConfirmed: true,
      consentConfirmed: true,
    });
    await tick().expect(200);
    await alchemy(
      c,
      { ...flightUse, activationId, mode: "land" },
      requester,
    ).expect(400);
    expect(calls).toBe(0);
  });
  it("passageiro em rascunho não remove condição/efeito ou antecipa expiração", async () => {
    await deterministicGM();
    await deterministicPlayer();
    const { c, activationId } = await readyFlight(),
      target = await flightTarget();
    await resolveFlightUse(c, activationId, {
      mode: "carry",
      targetId: target.id,
      humanMassConfirmed: true,
      consentConfirmed: true,
    });
    const current = store.get(target.id);
    for (const extra of [{ activeEffects: [] }, { conditions: [] }])
      await mutation(player, "put", `/api/entities/${target.id}`, {
        ...current,
        ...extra,
      }).expect(400);
    await mutation(player, "post", `/api/characters/${target.id}/action`, {
      action: "expire",
      scope: "scene",
    }).expect(400);
    await alchemy(c, { operation: "end", activationId }).expect(200);
    expect(store.get(target.id).conditions).not.toContain(
      "Transportado em voo alquímico",
    );
  });
  it("avanço cancela uso aberto, e cena limpa passageiro e estado de voo", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      target = await flightTarget();
    const pending = await alchemy(c, { ...flightUse, activationId }).expect(
      200,
    );
    await tick().expect(200);
    await alchemy(c, {
      operation: "acceptFormulaTest",
      activationId,
      testId: pending.body.result.formulaTest.id,
    }).expect(400);
    await resolveFlightUse(c, activationId, {
      mode: "capture",
      targetId: target.id,
      humanMassConfirmed: true,
    });
    await tick("scene").expect(200);
    expect(store.get(c.id).alchemy.activations[0].status).toBe("ended");
    expect(store.get(c.id).alchemy.activations[0].flight.airborne).toBe(false);
    expect(store.get(target.id).conditions).not.toContain(
      "Transportado em voo alquímico",
    );
    expect(store.get(target.id).health).toEqual(target.health);
  });
  it("backup remapeia passageiro, efeitos e uso aberto, preservando custos, originais e fonte", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      passenger = await flightTarget(),
      challenger = await flightTarget({ name: "Oponente do voo" });
    await resolveFlightUse(c, activationId, {
      mode: "carry",
      targetId: passenger.id,
      humanMassConfirmed: true,
      consentConfirmed: true,
    });
    await tick().expect(200);
    const pending = await alchemy(c, {
      ...flightUse,
      activationId,
      mode: "ground",
      targetId: challenger.id,
    }).expect(200);
    await alchemy(c, {
      operation: "rerollFormulaTest",
      activationId,
      testId: pending.body.result.formulaTest.id,
      indices: [0],
    }).expect(200);
    const original = store.get(c.id);
    await mutation(
      gm,
      "post",
      "/api/restore",
      (await gm.get("/api/backup")).body,
    ).expect(200);
    const copy = store
        .list("characters")
        .find((x) => x.id !== c.id && x.name === c.name),
      a = copy.alchemy.activations[0],
      t = a.formulaTests.at(-1);
    expect(a.flight.passengerId).not.toBe(passenger.id);
    expect(t.targetId).not.toBe(challenger.id);
    expect(t.id).not.toBe(pending.body.result.formulaTest.id);
    expect(t.actorReview).toEqual(
      original.alchemy.activations[0].formulaTests.at(-1).actorReview,
    );
    await alchemy(copy, {
      operation: "acceptFormulaTest",
      activationId: a.id,
      testId: t.id,
    }).expect(200);
    expect(store.get(c.id)).toEqual(original);
    expect(
      store
        .get(a.flight.passengerId)
        .activeEffects.every((e: any) => !e.effectKey.includes(activationId)),
    ).toBe(true);
  });
  it.each(["athanor", "calcinatio"] as const)(
    "backup conserva preparação %s ainda sem dados e conclui depois sem nova destilação paga",
    async (method) => {
      await deterministicGM();
      const human = await flightTarget({ ownerId: campaign.gmId });
      const c = await flightSource({
        thinBlood: { ...validThinCharacter().thinBlood, alchemyMethod: method },
      });
      await alchemy(c, {
        ...alchemyPrep,
        formulaId: flightId,
        vesselId: human.id,
        vesselEmotionConfirmed: true,
        ...alchemyNarrator,
      }).expect(200);
      const original = store.get(c.id);
      await mutation(
        gm,
        "post",
        "/api/restore",
        (await gm.get("/api/backup")).body,
      ).expect(200);
      const copy = store
        .list("characters")
        .find((x) => x.id !== c.id && x.name === c.name);
      const result = await alchemy(copy, {
        ...flightConclusion,
        preparationId: copy.alchemy.preparations[0].id,
        concentrationConfirmed: true,
        vesselEmotionConfirmed: true,
      }).expect(200);
      expect(result.body.result.rouses).toEqual([]);
      expect(
        store.get(copy.id).alchemy.preparations[0].distillation,
      ).not.toBeNull();
      expect(store.get(c.id)).toEqual(original);
    },
  );
  it("restauração rejeita passageiro próprio/inexistente e confirmação incompleta com rollback", async () => {
    await deterministicGM();
    const { c, activationId } = await readyFlight(),
      passenger = await flightTarget();
    await resolveFlightUse(c, activationId, {
      mode: "carry",
      targetId: passenger.id,
      humanMassConfirmed: true,
      consentConfirmed: true,
    });
    const backup = (await gm.get("/api/backup")).body,
      count = store.list("characters").length;
    for (const corrupt of [
      (a: any) => (a.flight.passengerId = c.id),
      (a: any) => (a.flight.passengerId = "missing"),
      (a: any) => (a.status = "ended"),
    ]) {
      const b = structuredClone(backup);
      corrupt(
        b.entities.find((x: any) => x.id === c.id).data.alchemy.activations[0],
      );
      await mutation(gm, "post", "/api/restore", b).expect(400);
      expect(store.list("characters")).toHaveLength(count);
    }
  });
});

it("restaura voo legado pendente sem inventar trabalho ou passageiro, permitindo encerrar", async () => {
  await deterministicGM();
  const { c } = await readyFlight(),
    other = await flightTarget();
  const backup = (await gm.get("/api/backup")).body,
    data = backup.entities.find((e: any) => e.id === c.id).data;
  const a = data.alchemy.activations[0];
  a.status = "pending";
  a.targets = [c.id, other.id];
  delete a.crafting;
  delete a.flight;
  delete a.formulaTests;
  data.activeEffects = [];
  data.conditions = [];
  await mutation(gm, "post", "/api/restore", backup).expect(200);
  const copy = store
    .list("characters")
    .find((x) => x.id !== c.id && x.name === c.name);
  await alchemy(copy, {
    operation: "resolve",
    activationId: copy.alchemy.activations[0].id,
    ...alchemyNarrator,
  }).expect(400);
  await alchemy(copy, {
    operation: "end",
    activationId: copy.alchemy.activations[0].id,
  }).expect(200);
  expect(store.get(copy.id).alchemy.activations[0].status).toBe("ended");
});
