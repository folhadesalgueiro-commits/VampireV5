import { test, expect, Route } from "@playwright/test";
import { emptyCharacter } from "../../shared/model";
import { validThinCharacter } from "../fixtures";
import { ALCHEMY } from "../../shared/thin-blood";
test("Oficina, ficha, rolagens, campanha, persistência e backup pela interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Seu nome").fill("Narrador de Teste");
  await page.getByLabel("Usuário", { exact: true }).fill("narrador_ui");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-de-teste-na-interface");
  await page.getByRole("button", { name: "Criar conta e começar" }).click();
  await expect(
    page.getByRole("heading", { name: "Boa noite, Narrador." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Oficina de Conteúdo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Criar conteúdo", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Umbromancia");
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("discipline");
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill("Disciplina personalizada para a campanha de teste.");
  await dialog.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Criar conteúdo", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Nocturnos");
  await dialog.getByLabel("Umbromancia", { exact: true }).check();
  await dialog
    .getByLabel("Perdição / Maldição")
    .fill("Temem as auroras das cidades.");
  await dialog.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Criar conteúdo", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Força Sombria");
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("power");
  await dialog.getByRole("button", { name: "Mecânica", exact: true }).click();
  await dialog
    .getByLabel("Disciplina do Poder / variante")
    .selectOption({ label: "Umbromancia" });
  await dialog
    .getByLabel("Resolução", { exact: true })
    .selectOption("complete");
  await dialog.getByRole("button", { name: "Efeitos", exact: true }).click();
  await dialog.getByRole("button", { name: "Adicionar efeito" }).click();
  await dialog.getByLabel("Operação").selectOption("attribute");
  await dialog.getByLabel("Alvo predefinido").selectOption("forca");
  await dialog.getByLabel("Quantidade (negativo = penalidade)").fill("2");
  await dialog.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Campanhas", exact: true }).click();
  await page.getByRole("button", { name: "Nova Campanha" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Noites de Salvador");
  await dialog
    .getByLabel("Princípios da Crônica")
    .fill("Não abandone os vulneráveis.");
  await dialog.getByRole("button", { name: "Salvar registro" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Criação de Personagem", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Novo personagem", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Helena da Noite");
  await page
    .getByLabel("Conceito", { exact: true })
    .fill("Historiadora dos becos");
  await page
    .getByLabel("Ambição", { exact: true })
    .fill("Proteger os arquivos da cidade.");
  await page.getByLabel("Clã / Linhagem").selectOption({ label: "Nocturnos" });
  await page
    .getByLabel("Campanha", { exact: true })
    .selectOption({ label: "Noites de Salvador" });
  await page
    .locator(".sheet-tabs")
    .getByRole("button", { name: /Sangue/ })
    .click();
  await page
    .getByLabel("Adicionar Disciplina")
    .selectOption({ label: "Umbromancia" });
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByLabel("Força Sombria · Poder 1").check();
  await page
    .locator(".sheet-tabs")
    .getByRole("button", { name: /Revisão/ })
    .click();
  await page
    .getByLabel("Exceção autorizada pelo Narrador", { exact: false })
    .fill(
      "Personagem especial autorizado pelo Narrador para validar a integração.",
    );
  await page.getByRole("button", { name: "Concluir criação" }).click();
  await expect(
    page.getByText("Criação em andamento", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  // Reproduz o fechamento durante a operação, sem alterar os dados ou o resultado da API.
  let holdPower!: (route: Route) => void;
  const pendingPower = new Promise<Route>((resolve) => {
    holdPower = resolve;
  });
  const actionPattern = "**/api/characters/*/action";
  await page.route(actionPattern, (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().action === "power"
    )
      holdPower(route);
    else void route.continue();
  });
  await page.getByRole("button", { name: "Utilizar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  const heldRoute = await pendingPower;
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await heldRoute.continue();
  await expect(
    page.getByText("Alteração registrada na ficha.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.unroute(actionPattern);
  await page.getByRole("button", { name: "Rolar teste", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Rolar dados", exact: true })
    .click();
  await expect(dialog.getByText(/sucessos · dificuldade/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Helena da Noite", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "História", exact: true }).click();
  await expect(
    page.getByText("Força Sombria · Atributo · 1 cena(s)", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar dano", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantidade", { exact: true }).fill("2");
  await dialog.getByLabel("Dano agravado", { exact: true }).check();
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Recuperar dano agravado", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(dialog.getByText(/Realize o Despertar noturno/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("button", { name: "Próxima noite", exact: true })
    .click();
  await expect(
    page.getByText("Noite 2 · Cena 1 · Turno 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Força Sombria · Atributo · 1 cena(s)", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Despertar do Sangue", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Despertar noturno (falha em Fome 5 causa Torpor)")
    .check();
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(dialog.getByText(/Dados: /)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("button", { name: "Recuperar dano agravado", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(dialog.getByText(/Despertar 3:/)).toBeVisible();
  await expect(
    dialog.getByText("Um ponto de dano agravado recuperado.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Noite 2 · Cena 1 · Turno 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar dano", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Trilha", { exact: true }).selectOption("willpower");
  await dialog.getByLabel("Quantidade", { exact: true }).fill("1");
  await dialog.getByLabel("Dano agravado", { exact: true }).check();
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Campanhas", exact: true }).click();
  await page
    .getByRole("button", { name: "Sessões e registros", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Novo Registro", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("A ambição de Helena");
  await dialog.getByLabel("Helena da Noite", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Iniciar sessão", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Helena da Noite", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Confirmar início da sessão", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const saved = (
    await (await page.request.get("/api/state")).json()
  ).characters.find((c: any) => c.name === "Helena da Noite");
  expect(saved.willpower.aggravated).toBe(0);
  expect(saved.health.aggravated).toBe(1);
  expect(saved.lastWakeNight).toBe(saved.campaignId + "@2");
  await page
    .getByRole("button", {
      name: "Encerrar sessão · Remorso e 1 XP",
      exact: true,
    })
    .click();
  await expect(page.getByText("Encerrada", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup" }).click();
  expect((await download).suggestedFilename()).toBe("cronica-v5-backup.json");
  await page.screenshot({
    path: "/tmp/v5-settings-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Painel Inicial", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/v5-dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/v5-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await expect(
    page.getByRole("button", { name: "Oficina de Conteúdo", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Ficha mortal, equipamentos e confronto persistente pela interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("narrador_ui");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-de-teste-na-interface");
  if (await page.getByLabel("Seu nome").isVisible()) {
    await page.getByLabel("Seu nome").fill("Narrador de Teste");
    await page.getByRole("button", { name: "Criar conta e começar" }).click();
  } else
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Boa noite, Narrador." }),
  ).toBeVisible();
  // Fixtures privadas apenas neste banco temporário; as resoluções seguintes usam a interface.
  const post = async (url: string, data: any) => {
    const response = await page.request.post(url, {
      data,
      headers: { "X-V5-CSRF": "1" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const campaign = await post("/api/entities/campaigns", {
    name: "Crônica de Confrontos",
    gmId: "atribuido-pelo-servidor",
  });
  const state = await (await page.request.get("/api/state")).json();
  const pistol = state.content.find(
    (e: any) =>
      e.equipmentType === "weapon" &&
      e.damageSource === "gunshot" &&
      e.damage === 3,
  );
  const attacker = await post("/api/entities/characters", {
    ...emptyCharacter(),
    name: "Ícaro Combatente",
    campaignId: campaign.id,
    status: "active",
    inventory: [
      {
        id: "pistola-ui",
        contentId: pistol.id,
        quantity: 1,
        equipped: true,
        notes: "Fixture de teste",
      },
    ],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Criação de Personagem", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Marina Mortal");
  await page.getByLabel("Natureza", { exact: true }).selectOption("mortal");
  await expect(page.getByLabel("Clã / Linhagem")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Despertar do Sangue", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Campanha", { exact: true }).selectOption(campaign.id);
  await page
    .locator(".sheet-tabs")
    .getByRole("button", { name: /Revisão/ })
    .click();
  await page
    .getByLabel("Exceção autorizada pelo Narrador", { exact: false })
    .fill(
      "NPC mortal de teste; características simplificadas autorizadas pelo Narrador.",
    );
  await page.getByRole("button", { name: "Concluir criação" }).click();
  await expect(
    page.getByText("Criação em andamento", { exact: false }),
  ).toHaveCount(0);
  const afterCreation = await (await page.request.get("/api/state")).json();
  const mortal = afterCreation.characters.find(
    (c: any) => c.name === "Marina Mortal",
  );
  expect(mortal.nature).toBe("mortal");
  const withArmor = await page.request.put("/api/entities/" + mortal.id, {
    headers: { "X-V5-CSRF": "1" },
    data: {
      ...mortal,
      inventory: [
        {
          id: "kevlar-ui",
          contentId: "equipment-colete-de-kevlar",
          quantity: 1,
          equipped: true,
          notes: "Fixture de teste",
        },
      ],
    },
  });
  expect(withArmor.ok(), await withArmor.text()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page
    .getByRole("button", { name: "Criar confronto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do confronto").fill("Emboscada na garagem");
  await dialog.getByLabel("Campanha do confronto").selectOption(campaign.id);
  await dialog
    .getByLabel("Apostas do confronto")
    .fill("Escapar antes que a Máscara seja comprometida.");
  await dialog.getByLabel(attacker.name, { exact: true }).check();
  await dialog.getByLabel(mortal.name, { exact: true }).check();
  await dialog.getByRole("button", { name: "Salvar confronto" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByLabel("Participante A", { exact: true })
    .selectOption(attacker.id);
  await page
    .getByLabel("Participante B", { exact: true })
    .selectOption(mortal.id);
  await page
    .getByLabel("Arma equipada A", { exact: true })
    .selectOption("pistola-ui");
  await page
    .getByLabel("Armadura equipada B", { exact: true })
    .selectOption("kevlar-ui");
  await page.getByLabel("Unilateral (oposição só se defende)").check();
  await page
    .getByLabel("Etiquetas de circunstância A", { exact: true })
    .fill("combate, teste");
  const exchangeResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/combat") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Resolver conflito", exact: true })
    .click();
  const exchange = await exchangeResponse;
  expect(exchange.ok()).toBe(true);
  expect(exchange.request().postDataJSON().tagsA).toEqual(["combate", "teste"]);
  expect((await exchange.json()).reports.toB).toHaveProperty("converted");
  await expect(
    page.getByRole("heading", { name: "Resolução", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Procedimento", { exact: true }).selectOption("single");
  await page.getByLabel(attacker.name, { exact: true }).check();
  await page.getByLabel(mortal.name, { exact: true }).check();
  await page.getByLabel("Dificuldade da oposição", { exact: true }).fill("4");
  await page
    .getByLabel("Agravado quando o tipo for definido pelo Narrador")
    .check();
  await page
    .getByLabel("Apostas, circunstâncias e resolução narrativa")
    .fill(
      "A oposição foi definida como letal pelo Narrador para este teste de integração.",
    );
  const singleResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/combat/one-roll") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Resolver conflito", exact: true })
    .click();
  expect((await singleResponse).ok()).toBe(true);
  await expect(page.getByText("Torpor", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Incapacitado: coma ou morte", { exact: true }),
  ).toBeVisible();
  await page.reload();
  const persisted = await (await page.request.get("/api/state")).json();
  expect(
    persisted.records.find((r: any) => r.name === "Emboscada na garagem")
      .status,
  ).toBe("Encerrado");
  expect(
    persisted.characters.find((c: any) => c.id === mortal.id).conditions,
  ).toContain("Incapacitado: coma ou morte");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-combat-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Calendário, formação, desafio e decadência de Laço pela interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("narrador_ui");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-de-teste-na-interface");
  if (await page.getByLabel("Seu nome").isVisible()) {
    await page.getByLabel("Seu nome").fill("Narrador de Teste");
    await page.getByRole("button", { name: "Criar conta e começar" }).click();
  } else
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Boa noite, Narrador." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Campanhas", exact: true }).click();
  await page
    .getByRole("button", { name: "Nova Campanha", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Crônica de Laços");
  await dialog.getByRole("button", { name: "Salvar registro" }).click();
  await expect(dialog).toHaveCount(0);
  for (const name of ["Duarte Reinante", "Rosa Enlaçada"]) {
    await page
      .getByRole("button", { name: "Criação de Personagem", exact: true })
      .click();
    await page.getByLabel("Nome", { exact: true }).fill(name);
    await page.getByLabel("Clã / Linhagem").selectOption({ label: "Brujah" });
    await page
      .getByLabel("Campanha", { exact: true })
      .selectOption({ label: "Crônica de Laços" });
    await page
      .locator(".sheet-tabs")
      .getByRole("button", { name: /Revisão/ })
      .click();
    await page
      .getByLabel("Exceção autorizada pelo Narrador", { exact: false })
      .fill(
        "Ficha especial autorizada para testar o vínculo narrativo entre dois vampiros.",
      );
    await page.getByRole("button", { name: "Concluir criação" }).click();
    await expect(
      page.getByText("Criação em andamento", { exact: false }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await page.getByRole("button", { name: "Definir data", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Data da crônica", { exact: true })
    .fill("2026-01-01");
  await dialog
    .getByLabel("Motivo do avanço de data")
    .fill("Primeira noite da história.");
  await dialog.getByRole("button", { name: "Salvar data da crônica" }).click();
  await expect(dialog).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    if (i) {
      await page
        .getByRole("button", { name: "Próxima noite", exact: true })
        .click();
      await expect(
        page.getByText("Data da crônica: 0" + (i + 1) + "/01/2026", {
          exact: true,
        }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Registrar gole de vitae", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Vampiro doador", { exact: true })
      .selectOption({ label: "Duarte Reinante" });
    await dialog
      .getByLabel("O personagem tomou um gole diretamente da veia")
      .check();
    await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
    await expect(
      dialog.getByText(
        i === 2
          ? "Laço de Sangue formado ou reforçado."
          : "Bebida registrada: " +
              (i + 1) +
              " de 3 noites para formar o Laço.",
        { exact: true },
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  }
  await expect(page.getByText("Força 3 / 6", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Desafiar o Laço", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(
    dialog.getByText("Oposição: Força do Laço", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(
    dialog.getByText(
      "O desafio deste período já foi realizado. Consulte o resultado no histórico.",
      { exact: true },
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Definir data", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Data da crônica", { exact: true })
    .fill("2026-02-03");
  await dialog
    .getByLabel("Motivo do avanço de data")
    .fill("Um mês afastada do reinante.");
  await dialog.getByRole("button", { name: "Salvar data da crônica" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Força 3 / 6", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Aplicar decadência", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(
      "Confirmo o afastamento sem reforço e a resolução dos desafios exigidos por sessão",
    )
    .check();
  await dialog
    .getByLabel("Registro do afastamento e dos desafios")
    .fill(
      "O Narrador confirmou o afastamento e os desafios das sessões do período.",
    );
  await dialog.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(
    dialog.getByText("Força do Laço reduzida para 2.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Rosa Enlaçada", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(page.getByText("Força 2 / 6", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-bonds-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Jogadora cria Sangue-Ralo com Afinidade e Alquimia sem exceção", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("narrador_ui");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-de-teste-na-interface");
  if (await page.getByLabel("Seu nome").isVisible()) {
    await page.getByLabel("Seu nome").fill("Narrador de Teste");
    await page.getByRole("button", { name: "Criar conta e começar" }).click();
  } else
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Boa noite, Narrador." }),
  ).toBeVisible();
  const headers = { "X-V5-CSRF": "1" };
  const accountResponse = await page.request.post("/api/users", {
    headers,
    data: {
      username: "jogadora_crepusculo",
      name: "Jogadora do Crepúsculo",
      password: "senha-exclusiva-do-cenario",
    },
  });
  expect(accountResponse.ok(), await accountResponse.text()).toBe(true);
  const account = await accountResponse.json();
  const campaignResponse = await page.request.post("/api/entities/campaigns", {
    headers,
    data: {
      name: "Crônica do Crepúsculo",
      gmId: "atribuido-pelo-servidor",
      members: [account.id],
    },
  });
  expect(campaignResponse.ok()).toBe(true);
  const campaign = await campaignResponse.json();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.getByLabel("Usuário", { exact: true }).fill("jogadora_crepusculo");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-exclusiva-do-cenario");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Boa noite, Jogadora." }),
  ).toBeVisible();
  // Distribuições e orçamento corretos preparados no banco temporário; as escolhas específicas e a conclusão usam a interface.
  const fixture = validThinCharacter();
  fixture.name = "Lia do Crepúsculo";
  fixture.clanId = "";
  fixture.generation = 13;
  fixture.bloodPotency = 1;
  fixture.advantages = fixture.advantages.filter(
    (a) =>
      !["merit-sangue-concatenado", "flaw-dentes-de-bebe"].includes(
        a.contentId,
      ),
  );
  const created = await page.request.post("/api/entities/characters", {
    headers,
    data: fixture,
  });
  expect(created.ok(), await created.text()).toBe(true);
  const c = await created.json();
  await page.reload();
  await page
    .getByRole("button", { name: "Meus Personagens", exact: true })
    .click();
  await page
    .locator("article.character-card")
    .filter({
      has: page.getByRole("heading", { name: fixture.name, exact: true }),
    })
    .getByRole("button", { name: "Abrir ficha" })
    .click();
  await page.getByLabel("Clã / Linhagem").selectOption("clan-sangue-ralo");
  await expect(page.getByLabel("Geração", { exact: true })).toHaveValue("14");
  await expect(
    page.getByLabel("Potência do Sangue", { exact: true }),
  ).toHaveValue("0");
  await page.getByLabel("Campanha", { exact: true }).selectOption(campaign.id);
  await page
    .locator(".sheet-tabs")
    .getByRole("button", { name: /Vantagens/ })
    .click();
  for (const name of [
    "Afinidade de Disciplina",
    "Alquimia Sangue-Ralo",
    "Dentes de Bebê",
    "Temperamento Bestial",
  ]) {
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await page
    .getByLabel("Disciplina de Afinidade", { exact: true })
    .selectOption("discipline-fortitude");
  await page
    .getByLabel("Poder inicial de Afinidade", { exact: true })
    .selectOption("power-fortitude-resiliencia");
  await page
    .getByLabel("Método inicial de destilação", { exact: true })
    .selectOption("fixatio");
  await page
    .getByLabel("Fórmula inicial de Alquimia", { exact: true })
    .selectOption("formula-alquimia-sangue-ralo-nevoa");
  await page
    .locator(".sheet-tabs")
    .getByRole("button", { name: /Revisão/ })
    .click();
  await expect(
    page.getByText("A ficha atende às validações implementadas.", {
      exact: true,
    }),
  ).toBeVisible();
  const finalized = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/characters/" + c.id + "/finalize") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Concluir criação", exact: true })
    .click();
  expect((await finalized).ok()).toBe(true);
  await expect(
    page.getByText("Criação em andamento", { exact: false }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    page.getByLabel("Método inicial de destilação", { exact: true }),
  ).toHaveValue("fixatio");
  await expect(
    page.getByLabel("Método inicial de destilação", { exact: true }),
  ).toBeDisabled();
  const persisted = (
    await (await page.request.get("/api/state")).json()
  ).characters.find((entry: any) => entry.id === c.id);
  expect(persisted.disciplines).toEqual({
    "discipline-fortitude": 1,
    "discipline-alquimia-sangue-ralo": 1,
  });
  expect(persisted.powers).toEqual(
    expect.arrayContaining([
      "power-fortitude-resiliencia",
      "formula-alquimia-sangue-ralo-nevoa",
    ]),
  );
  expect(persisted.creation.approvedException).toBe("");
  expect(persisted.derived.healthMax).toBe(7);
  await page.getByRole("button", { name: "Rolar teste", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tipo de teste").selectOption("frenzy");
  await dialog
    .getByRole("button", { name: "Rolar dados", exact: true })
    .click();
  await expect(dialog.getByText(/sucessos · dificuldade/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-thin-blood-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Alquimia: preparar, armazenar, transportar, consumir, resolver e aplicar Névoa pela interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const initialized = (
    await (await page.request.get("/api/auth/status")).json()
  ).initialized;
  const login = await page.request.post(
    initialized ? "/api/auth/login" : "/api/auth/setup",
    {
      headers: { "X-V5-CSRF": "1" },
      data: {
        username: "narrador_ui",
        password: "senha-de-teste-na-interface",
        ...(initialized ? {} : { name: "Narrador de Teste" }),
      },
    },
  );
  expect(login.ok(), await login.text()).toBe(true);
  const fixture = validThinCharacter();
  fixture.name = "Alquimista do fluxo de destilação";
  fixture.status = "active";
  fixture.attributes.inteligencia = 3;
  fixture.thinBlood.alchemyMethod = "fixatio";
  fixture.disciplines[ALCHEMY] = 1;
  fixture.powers = ["formula-alquimia-sangue-ralo-nevoa"];
  const created = await page.request.post("/api/entities/characters", {
    headers: { "X-V5-CSRF": "1" },
    data: fixture,
  });
  expect(created.ok(), await created.text()).toBe(true);
  const c = await created.json();
  const open = async (name: string) => {
    await page
      .getByRole("button", { name: "Meus Personagens", exact: true })
      .click();
    await page
      .locator("article.character-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Abrir ficha" })
      .click();
  };
  const snapshot = async () =>
    (await (await page.request.get("/api/state")).json()).characters.find(
      (x: any) => x.id === c.id,
    );
  await page.reload();
  await open(fixture.name);
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Preparação e ativação de Alquimia",
  });
  await panel
    .getByRole("button", { name: "Preparar fórmula", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ingredientes, amostras e Ressonância")
    .fill("Vitae própria, sangue fleumático e gelo seco da cena.");
  await dialog
    .getByLabel(
      "Vitae própria e sangue humano da Ressonância adequada disponíveis",
    )
    .check();
  await dialog
    .getByLabel("Laboratório e equipamento adequado disponíveis")
    .check();
  await dialog.getByLabel("Local do frasco").selectOption("stored");
  await dialog
    .getByRole("button", {
      name: "Confirmar operação de Alquimia",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByText("Preparação registrada; o custo de destilação foi pago.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  let saved = await snapshot();
  expect(saved.alchemy.preparations[0].location).toBe("stored");
  expect(saved.alchemy.preparations[0].distillation).toBeNull();
  const preparationId = saved.alchemy.preparations[0].id;
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    panel.getByText("Frasco armazenado", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Ativar", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Transportar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Local do frasco").selectOption("carried");
  await dialog
    .getByRole("button", {
      name: "Confirmar operação de Alquimia",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByText("Operação de Alquimia registrada.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  expect((await snapshot()).alchemy.preparations[0].id).toBe(preparationId);
  await panel.getByRole("button", { name: "Ativar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "Confirmar operação de Alquimia",
      exact: true,
    })
    .click();
  await expect(dialog.getByText(/sucessos de destilação/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  saved = await snapshot();
  expect(saved.alchemy.preparations).toHaveLength(0);
  expect(["pending", "active"]).toContain(saved.alchemy.activations[0].status);
  if (saved.alchemy.activations[0].review.state === "open") {
    await panel
      .getByRole("button", { name: "Aceitar dados da destilação" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", {
        name: "Confirmar operação de Alquimia",
        exact: true,
      })
      .click();
    await expect(
      dialog.getByText(
        /Operação de Alquimia registrada|O Narrador deve resolver/,
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
    saved = await snapshot();
  }
  if (saved.alchemy.activations[0].status === "pending") {
    await panel
      .getByRole("button", { name: "Resolver qualidade e efeito" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Narrador consultou a fonte e confirma a resolução")
      .check();
    await dialog
      .getByLabel("Registro e resolução do Narrador")
      .fill(
        "A qualidade foi conferida na tabela; a névoa encobre o usuário nesta cena.",
      );
    await dialog
      .getByRole("button", {
        name: "Confirmar operação de Alquimia",
        exact: true,
      })
      .click();
    await expect(
      dialog.getByText("Operação de Alquimia registrada.", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  }
  await page.reload();
  saved = await snapshot();
  expect(saved.conditions).toContain("Névoa alquímica");
  expect(saved.alchemy.activations).toHaveLength(1);
  expect(saved.alchemy.activations[0].status).toBe("active");
  const observer = await page.request.post("/api/entities/characters", {
    headers: { "X-V5-CSRF": "1" },
    data: {
      ...emptyCharacter(),
      name: "Observadora da névoa",
      nature: "mortal",
      attributes: { ...emptyCharacter().attributes, inteligencia: 4 },
      skills: { ...emptyCharacter().skills, percepcao: 3 },
    },
  });
  expect(observer.ok(), await observer.text()).toBe(true);
  await page.reload();
  await open("Observadora da névoa");
  await page.getByRole("button", { name: "Rolar teste", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Atributo", { exact: true })
    .selectOption("inteligencia");
  await dialog.getByLabel("Perícia / Disciplina").selectOption("percepcao");
  await dialog.getByLabel("Contexto com alvo").selectOption("identify");
  await dialog.getByLabel("Alvo do teste").selectOption(c.id);
  const rolled = page.waitForResponse(
    (r) => r.url().endsWith("/roll") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Rolar dados", exact: true })
    .click();
  const dice = await (await rolled).json();
  expect(dice.result.normal).toHaveLength(5);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await open(fixture.name);
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-alchemy-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Avançar cena", exact: true }).click();
  await expect
    .poll(async () => (await snapshot()).alchemy.activations[0].status)
    .toBe("ended");
  expect((await snapshot()).conditions).not.toContain("Névoa alquímica");
  await page.reload();
  expect((await snapshot()).alchemy.activations[0].status).toBe("ended");
  expect(errors).toEqual([]);
});

test("Rerrolagem de destilação preserva Fome e consumo, gasta Vontade e persiste antes dos efeitos", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const initialized = (
    await (await page.request.get("/api/auth/status")).json()
  ).initialized;
  const session = await page.request.post(
    initialized ? "/api/auth/login" : "/api/auth/setup",
    {
      headers: { "X-V5-CSRF": "1" },
      data: {
        username: "narrador_ui",
        password: "senha-de-teste-na-interface",
        ...(initialized ? {} : { name: "Narrador de Teste" }),
      },
    },
  );
  expect(session.ok(), await session.text()).toBe(true);
  const fixture = validThinCharacter();
  fixture.name = "Alquimista da revisão de dados";
  fixture.status = "active";
  fixture.thinBlood.alchemyMethod = "fixatio";
  fixture.disciplines[ALCHEMY] = 1;
  fixture.attributes.inteligencia = 4;
  fixture.powers = ["formula-alquimia-sangue-ralo-nevoa"];
  const created = await page.request.post("/api/entities/characters", {
    headers: { "X-V5-CSRF": "1" },
    data: fixture,
  });
  expect(created.ok(), await created.text()).toBe(true);
  const c = await created.json();
  const snapshot = async () =>
    (await (await page.request.get("/api/state")).json()).characters.find(
      (x: any) => x.id === c.id,
    );
  await page.reload();
  await page
    .getByRole("button", { name: "Meus Personagens", exact: true })
    .click();
  await page
    .locator("article.character-card")
    .filter({
      has: page.getByRole("heading", { name: fixture.name, exact: true }),
    })
    .getByRole("button", { name: "Abrir ficha" })
    .click();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Preparação e ativação de Alquimia",
  });
  await panel
    .getByRole("button", { name: "Preparar fórmula", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ingredientes, amostras e Ressonância")
    .fill("Vitae, amostra fleumática e gelo seco disponíveis nesta cena.");
  await dialog
    .getByLabel(
      "Vitae própria e sangue humano da Ressonância adequada disponíveis",
    )
    .check();
  await dialog
    .getByLabel("Laboratório e equipamento adequado disponíveis")
    .check();
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByText("Preparação registrada; o custo de destilação foi pago.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  await panel.getByRole("button", { name: "Ativar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Revisar dados antes de aplicar os efeitos"),
  ).toBeChecked();
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByText(/Revise os dados normais ou aceite o resultado/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  const before = await snapshot(),
    original = before.alchemy.activations[0].distillation;
  expect(before.alchemy.preparations).toHaveLength(0);
  expect(before.activeEffects).toHaveLength(0);
  expect(before.alchemy.activations[0].review.state).toBe("open");
  await panel
    .getByRole("button", { name: "Rerrolar destilação", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Gastar 1 Vontade e rerrolar" }),
  ).toBeDisabled();
  await expect(
    dialog
      .getByLabel("Dados de Fome protegidos da destilação")
      .getByRole("button"),
  ).toHaveCount(0);
  const normal = dialog
    .getByRole("group", { name: "Dados normais da destilação" })
    .getByRole("button");
  expect(await normal.count()).toBeGreaterThanOrEqual(2);
  await normal.nth(0).click();
  await normal.nth(1).click();
  await dialog
    .getByRole("button", { name: "Gastar 1 Vontade e rerrolar" })
    .click();
  await expect(dialog.getByText(/Rerrolagem registrada/)).toBeVisible();
  await expect(
    dialog.getByText("Força de Vontade gasta: 1.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  let saved = await snapshot();
  expect(saved.hunger).toBe(before.hunger);
  expect(saved.willpower.superficial).toBe(1);
  expect(saved.alchemy.preparations).toHaveLength(0);
  expect(saved.alchemy.activations).toHaveLength(1);
  expect(saved.alchemy.activations[0].review).toMatchObject({
    state: "open",
    rerolled: true,
    original,
  });
  expect(saved.alchemy.activations[0].distillation.hunger).toEqual(
    original.hunger,
  );
  expect(saved.activeEffects).toHaveLength(0);
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Rerrolar destilação", exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByText(/Dados normais anteriores:/)).toBeVisible();
  await panel
    .getByRole("button", { name: "Aceitar dados da destilação" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByText(
      /Operação de Alquimia registrada|O Narrador deve resolver/,
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  saved = await snapshot();
  expect(saved.alchemy.activations[0].review.state).toBe("closed");
  if (saved.alchemy.activations[0].status === "pending") {
    await panel
      .getByRole("button", { name: "Resolver qualidade e efeito" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Narrador consultou a fonte e confirma a resolução")
      .check();
    await dialog
      .getByLabel("Registro e resolução do Narrador")
      .fill(
        "A mistura foi avaliada com os dados rerrolados; a nuvem dura esta cena.",
      );
    await dialog
      .getByRole("button", { name: "Confirmar operação de Alquimia" })
      .click();
    await expect(
      dialog.getByText("Operação de Alquimia registrada.", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  }
  saved = await snapshot();
  expect(saved.hunger).toBe(before.hunger);
  expect(saved.willpower.superficial).toBe(1);
  expect(saved.conditions).toContain("Névoa alquímica");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-alchemy-reroll-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Longo Alcance: disputa revisável, Vontade própria, resolução e persistência móvel", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const initialized = (
    await (await page.request.get("/api/auth/status")).json()
  ).initialized;
  const post = async (url: string, data: any) => {
    const r = await page.request.post(url, {
      headers: { "X-V5-CSRF": "1" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  await post(initialized ? "/api/auth/login" : "/api/auth/setup", {
    username: "narrador_ui",
    password: "senha-de-teste-na-interface",
    ...(initialized ? {} : { name: "Narrador de Teste" }),
  });
  const campaign = await post("/api/entities/campaigns", {
    name: "Crônica de Longo Alcance",
    gmId: "atribuido-pelo-servidor",
  });
  const f = validThinCharacter();
  f.name = "Alquimista de Longo Alcance";
  f.status = "active";
  f.campaignId = campaign.id;
  f.thinBlood.alchemyMethod = "fixatio";
  f.disciplines[ALCHEMY] = 1;
  f.attributes.inteligencia = 3;
  f.attributes.determinacao = 4;
  const formulaId = "formula-alquimia-sangue-ralo-longo-alcance";
  f.powers = [formulaId];
  const c = await post("/api/entities/characters", f);
  const target = await post("/api/entities/characters", {
    ...emptyCharacter(),
    name: "Alvo da disputa de Longo Alcance",
    campaignId: campaign.id,
    nature: "mortal",
    hunger: 0,
    attributes: {
      ...emptyCharacter().attributes,
      vigor: 3,
      determinacao: 3,
      autocontrole: 3,
      forca: 1,
    },
    skills: { ...emptyCharacter().skills, atletismo: 1 },
  });
  const state = async () => await (await page.request.get("/api/state")).json();
  const snapshot = async () =>
    (await state()).characters.find((x: any) => x.id === c.id);
  await post(`/api/characters/${c.id}/alchemy`, {
    operation: "prepare",
    formulaId,
    ingredients: "Vitae própria, sangue colérico e fio de náilon na cena.",
    ingredientsConfirmed: true,
    laboratoryConfirmed: true,
  });
  await post(`/api/characters/${c.id}/alchemy`, {
    operation: "activate",
    preparationId: (await snapshot()).alchemy.preparations[0].id,
    reviewDistillation: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Meus Personagens", exact: true })
    .click();
  await page
    .locator("article.character-card")
    .filter({ has: page.getByRole("heading", { name: f.name, exact: true }) })
    .getByRole("button", { name: "Abrir ficha" })
    .click();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Preparação e ativação de Alquimia",
  });
  await panel
    .getByRole("button", { name: "Aceitar dados da destilação" })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  if ((await snapshot()).alchemy.activations[0].status === "pending") {
    await panel
      .getByRole("button", { name: "Resolver qualidade e efeito" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Narrador consultou a fonte e confirma a resolução")
      .check();
    await dialog
      .getByLabel("Registro e resolução do Narrador")
      .fill(
        "Qualidade consultada na fonte; efeito normal de Longo Alcance autorizado nesta cena.",
      );
    await dialog
      .getByRole("button", { name: "Confirmar operação de Alquimia" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Fechar resultado" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  }
  const before = await snapshot();
  await panel.getByRole("button", { name: "Usar fórmula ativa" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Uso de Longo Alcance").selectOption("throw");
  await dialog
    .getByLabel("Alvo da fórmula (vazio para objeto ao sustentar)")
    .selectOption(target.id);
  await dialog
    .getByLabel("Objeto ou ação na cena")
    .fill("Arremessar o adversário sobre o piso livre");
  await dialog.getByLabel("Peso estimado em kg (menor que 100)").fill("70");
  await dialog
    .getByLabel(
      "Confirmo alvo à vista, com menos de 100 kg e a cerca de 10 metros",
    )
    .check();
  await dialog
    .getByRole("button", { name: "Registrar teste da fórmula" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    panel.getByText("Dados em revisão; efeito ainda não aplicado"),
  ).toBeVisible();
  expect(
    (await state()).characters.find((x: any) => x.id === target.id).health
      .superficial,
  ).toBe(0);
  await panel
    .getByRole("button", { name: "Rerrolar usuário", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /^Dado normal 1:/ }).check();
  await dialog
    .getByRole("button", { name: "Gastar Vontade e rerrolar" })
    .click();
  await expect(dialog).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Rerrolar resistência", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /^Dado normal 1:/ }).check();
  await dialog
    .getByRole("button", { name: "Gastar Vontade e rerrolar" })
    .click();
  await expect(dialog).toHaveCount(0);
  let saved = await snapshot(),
    t = saved.alchemy.activations[0].formulaTests[0];
  expect(t.actor.hunger).toEqual(t.actorReview.original.hunger);
  expect(saved.willpower.superficial).toBe(1);
  expect(
    (await state()).characters.find((x: any) => x.id === target.id).willpower
      .superficial,
  ).toBe(1);
  expect(saved.hunger).toBe(before.hunger);
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    panel.getByText("Dados em revisão; efeito ainda não aplicado"),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Aceitar dados e resolver uso" })
    .click();
  await expect(
    panel.getByText("Teste resolvido", { exact: true }),
  ).toBeVisible();
  saved = await snapshot();
  t = saved.alchemy.activations[0].formulaTests[0];
  const actorSuccesses =
    t.actor.normal.concat(t.actor.hunger).filter((x: number) => x >= 6).length +
    2 *
      Math.floor(
        t.actor.normal.concat(t.actor.hunger).filter((x: number) => x === 10)
          .length / 2,
      );
  const opposition =
    t.opposition.normal.filter((x: number) => x >= 6).length +
    2 *
      Math.floor(
        t.opposition.normal.filter((x: number) => x === 10).length / 2,
      );
  const rawDamage = Math.max(0, actorSuccesses - opposition);
  expect(t.outcome.rawDamage).toBe(rawDamage);
  const targetAfter = (await state()).characters.find(
    (x: any) => x.id === target.id,
  );
  expect(targetAfter.health.superficial).toBe(Math.ceil(rawDamage / 2));
  expect(targetAfter.conditions.includes("Caído")).toBe(rawDamage > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-longo-alcance-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await post(`/api/clock/${campaign.id}/advance`, { scope: "turn" });
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Usar fórmula ativa" }),
  ).toHaveCount(0);
  expect((await snapshot()).alchemy.activations[0].status).toBe("ended");
  expect(errors).toEqual([]);
});

test("Envolver: penalidade visual, asfixia revisável, condições e encerramento persistente", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const initialized = (
    await (await page.request.get("/api/auth/status")).json()
  ).initialized;
  const post = async (url: string, data: any) => {
    const r = await page.request.post(url, {
      headers: { "X-V5-CSRF": "1" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  await post(initialized ? "/api/auth/login" : "/api/auth/setup", {
    username: "narrador_ui",
    password: "senha-de-teste-na-interface",
    ...(initialized ? {} : { name: "Narrador de Teste" }),
  });
  const campaign = await post("/api/entities/campaigns", {
    name: "Crônica de Envolver",
    gmId: "atribuido-pelo-servidor",
  });
  const target = await post("/api/entities/characters", {
    ...emptyCharacter(),
    name: "Alvo mortal de Envolver",
    campaignId: campaign.id,
    nature: "mortal",
    hunger: 0,
    attributes: {
      ...emptyCharacter().attributes,
      vigor: 1,
      destreza: 4,
      raciocinio: 4,
      determinacao: 3,
      autocontrole: 3,
    },
    skills: { ...emptyCharacter().skills, sagacidade: 3, armasFogo: 3 },
  });
  const f = validThinCharacter();
  f.name = "Alquimista de Envolver";
  f.status = "active";
  f.campaignId = campaign.id;
  f.thinBlood.alchemyMethod = "fixatio";
  f.disciplines[ALCHEMY] = 2;
  f.attributes.inteligencia = 2;
  f.attributes.raciocinio = 5;
  const formulaId = "formula-alquimia-sangue-ralo-envolver";
  f.powers = [formulaId];
  const c = await post("/api/entities/characters", f);
  const state = async () => await (await page.request.get("/api/state")).json();
  const snapshot = async (id = c.id) =>
    (await state()).characters.find((x: any) => x.id === id);
  await post(`/api/characters/${c.id}/alchemy`, {
    operation: "prepare",
    formulaId,
    ingredients:
      "Vitae própria, sangue melancólico e fleumático e fumaça disponíveis.",
    ingredientsConfirmed: true,
    laboratoryConfirmed: true,
  });
  const open = async (name: string) => {
    await page
      .getByRole("button", { name: "Meus Personagens", exact: true })
      .click();
    await page
      .locator("article.character-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Abrir ficha" })
      .click();
  };
  await page.reload();
  await open(f.name);
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Preparação e ativação de Alquimia",
  });
  await panel.getByRole("button", { name: "Ativar", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(target.name, { exact: true }).check();
  await dialog.getByLabel("O alvo escolhido de Envolver está à vista").check();
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  expect((await snapshot(target.id)).conditions).not.toContain(
    "Envolto em névoa alquímica",
  );
  await panel
    .getByRole("button", { name: "Aceitar dados da destilação" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  if ((await snapshot()).alchemy.activations[0].status === "pending") {
    await panel
      .getByRole("button", { name: "Resolver qualidade e efeito" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Narrador consultou a fonte e confirma a resolução")
      .check();
    await dialog
      .getByLabel("Registro e resolução do Narrador")
      .fill(
        "Qualidade consultada na fonte; Envolver terá o efeito normal nesta cena.",
      );
    await dialog
      .getByRole("button", { name: "Confirmar operação de Alquimia" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Fechar resultado" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  }
  expect((await snapshot(target.id)).conditions).toContain(
    "Envolto em névoa alquímica",
  );
  await open(target.name);
  await page.getByRole("button", { name: "Rolar teste", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Atributo", { exact: true })
    .selectOption("raciocinio");
  await dialog.getByLabel("Perícia / Disciplina").selectOption("sagacidade");
  await dialog.getByLabel("Contexto com alvo").selectOption("visual");
  await expect(dialog.locator(".pool-preview strong")).toHaveText("4");
  await expect(dialog.getByLabel("Alvo do teste")).toHaveCount(0);
  const rolled = page.waitForResponse(
    (r) => r.url().endsWith("/roll") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Rolar dados", exact: true })
    .click();
  expect((await (await rolled).json()).result.normal).toHaveLength(4);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await open(f.name);
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const use = page.getByRole("region", { name: "Usos de Envolver" });
  await use
    .getByLabel("O alvo de Envolver permanece à vista nesta cena")
    .check();
  await use.getByRole("button", { name: "Testar asfixia de Envolver" }).click();
  await expect(
    use.getByText("Dados em revisão; asfixia ainda não aplicada"),
  ).toBeVisible();
  expect((await snapshot(target.id)).conditions).not.toContain(
    "Sufocando por Envolver",
  );
  for (const side of ["usuário", "resistência"]) {
    await use
      .getByRole("button", { name: `Rerrolar ${side}`, exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /^Dado normal 1:/ }).check();
    await dialog
      .getByRole("button", { name: "Gastar Vontade e rerrolar" })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await expect(
    use.getByText("Dados em revisão; asfixia ainda não aplicada"),
  ).toBeVisible();
  await use
    .getByRole("button", { name: "Aceitar dados e resolver asfixia" })
    .click();
  await expect(
    use.getByText("Asfixia resolvida", { exact: true }),
  ).toBeVisible();
  const saved = await snapshot(),
    affected = await snapshot(target.id),
    test = saved.alchemy.activations[0].formulaTests[0];
  const successes = (d: any) =>
    d.normal.concat(d.hunger).filter((x: number) => x >= 6).length +
    2 *
      Math.floor(
        d.normal.concat(d.hunger).filter((x: number) => x === 10).length / 2,
      );
  const won = successes(test.actor) >= successes(test.opposition);
  const critical =
    won &&
    test.actor.normal.concat(test.actor.hunger).filter((x: number) => x === 10)
      .length >= 2;
  expect(test.outcome.success).toBe(won);
  expect(affected.conditions.includes("Sufocando por Envolver")).toBe(won);
  expect(affected.conditions.includes("Inconsciente após Envolver")).toBe(
    critical,
  );
  expect(affected.health).toEqual(target.health);
  expect(saved.willpower.superficial).toBe(1);
  expect(affected.willpower.superficial).toBe(1);
  expect(test.actor.hunger).toEqual(test.actorReview.original.hunger);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-envolver-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await panel.getByRole("button", { name: "Encerrar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(
      "Confirmo o descarte ou encerramento; custos não são devolvidos",
    )
    .check();
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  const ended = await snapshot(target.id);
  expect(ended.conditions).not.toContain("Envolto em névoa alquímica");
  expect(ended.conditions).not.toContain("Sufocando por Envolver");
  expect(ended.conditions.includes("Inconsciente após Envolver")).toBe(
    critical,
  );
  await page.reload();
  expect((await snapshot()).alchemy.activations[0].status).toBe("ended");
  expect(errors).toEqual([]);
});

test("Impulso: três noites confirmadas, disputa de transporte, voo pessoal e pouso pela interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const initialized = (
    await (await page.request.get("/api/auth/status")).json()
  ).initialized;
  const post = async (url: string, data: any) => {
    const r = await page.request.post(url, {
      headers: { "X-V5-CSRF": "1" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  await post(initialized ? "/api/auth/login" : "/api/auth/setup", {
    username: "narrador_ui",
    password: "senha-de-teste-na-interface",
    ...(initialized ? {} : { name: "Narrador de Teste" }),
  });
  const campaign = await post("/api/entities/campaigns", {
    name: "Crônica de Impulso",
    gmId: "atribuido-pelo-servidor",
  });
  const target = await post("/api/entities/characters", {
    ...emptyCharacter(),
    name: "Passageira de Impulso",
    campaignId: campaign.id,
    nature: "mortal",
    hunger: 0,
    attributes: {
      ...emptyCharacter().attributes,
      determinacao: 3,
      autocontrole: 3,
    },
    skills: { ...emptyCharacter().skills },
  });
  const f = validThinCharacter();
  f.name = "Alquimista de voo na interface";
  f.status = "active";
  f.campaignId = campaign.id;
  f.thinBlood.alchemyMethod = "fixatio";
  f.disciplines[ALCHEMY] = 4;
  f.attributes.inteligencia = 1;
  f.attributes.forca = 3;
  f.powers = ["formula-alquimia-sangue-ralo-impulso-suspenso-no-ar"];
  const c = await post("/api/entities/characters", f);
  const snapshot = async (id = c.id) =>
    (await (await page.request.get("/api/state")).json()).characters.find(
      (x: any) => x.id === id,
    );
  await page.reload();
  await page
    .getByRole("button", { name: "Meus Personagens", exact: true })
    .click();
  await page
    .locator("article.character-card")
    .filter({ has: page.getByRole("heading", { name: f.name, exact: true }) })
    .getByRole("button", { name: "Abrir ficha" })
    .click();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Preparação e ativação de Alquimia",
  });
  await panel
    .getByRole("button", { name: "Preparar fórmula", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ingredientes, amostras e Ressonância")
    .fill(
      "Vitae própria, sangue colérico e sanguíneo, champagne e sangue de pássaro.",
    );
  await dialog
    .getByLabel(
      "Vitae própria e sangue humano da Ressonância adequada disponíveis",
    )
    .check();
  await dialog
    .getByLabel("Laboratório e equipamento adequado disponíveis")
    .check();
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  await expect(
    panel.getByRole("button", { name: "Ativar", exact: true }),
  ).toBeDisabled();
  const prepared = await snapshot();
  expect(prepared.alchemy.preparations[0].crafting.nights).toBe(0);
  await panel
    .getByRole("button", { name: "Concluir três noites", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ao menos três noites de destilação foram concluídas")
    .check();
  await dialog
    .getByLabel(
      "Pesquisa prévia de ao menos três meses concluída para esta fórmula",
    )
    .check();
  await dialog
    .getByLabel("Gota de vitae de origem compatível confirmada pelo Narrador")
    .check();
  await dialog
    .getByLabel("Narrador consultou a fonte e confirma a resolução")
    .check();
  await dialog
    .getByLabel("Registro e resolução do Narrador")
    .fill(
      "Narrador conferiu as três noites de trabalho, pesquisa prévia de três meses e decidiu a origem compatível da gota de vitae nesta crônica.",
    );
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  expect((await snapshot()).hunger).toBe(prepared.hunger);
  await panel.getByRole("button", { name: "Ativar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  await panel
    .getByRole("button", { name: "Aceitar dados da destilação" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirmar operação de Alquimia" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Fechar resultado" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  if ((await snapshot()).alchemy.activations[0].status === "pending") {
    await panel
      .getByRole("button", { name: "Resolver qualidade e efeito" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Narrador consultou a fonte e confirma a resolução")
      .check();
    await dialog
      .getByLabel("Registro e resolução do Narrador")
      .fill(
        "Mistura consultada na fonte; Narrador autoriza o efeito normal do voo nesta cena.",
      );
    await dialog
      .getByRole("button", { name: "Confirmar operação de Alquimia" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Fechar resultado" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar resultado" }).click();
  }
  const use = page.getByRole("region", {
    name: "Usos de Impulso Suspenso no Ar",
  });
  await use
    .getByRole("button", { name: "Usar voo alquímico", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Uso do voo").selectOption("capture");
  await dialog
    .getByLabel("Participante (vazio para carga sem pessoa)")
    .selectOption(target.id);
  await dialog
    .getByLabel("A carga cabe em uma massa de tamanho humano")
    .check();
  await dialog
    .getByLabel("Confirmo espaço, contato e circunstâncias de voo na cena")
    .check();
  await dialog.getByRole("button", { name: "Registrar uso do voo" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    use.getByText("Uso em revisão; movimento ainda não aplicado"),
  ).toBeVisible();
  expect((await snapshot()).conditions).not.toContain("Em voo alquímico");
  for (const side of ["usuário", "resistência"]) {
    await use
      .getByRole("button", { name: `Rerrolar ${side}`, exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /^Dado normal 1:/ }).check();
    await dialog
      .getByRole("button", { name: "Gastar Vontade e rerrolar" })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole("button", { name: "Sangue", exact: true }).click();
  await use
    .getByRole("button", { name: "Aceitar dados e resolver voo" })
    .click();
  await expect(
    use.getByText("Uso de voo resolvido", { exact: true }),
  ).toBeVisible();
  const captured = await snapshot(),
    t = captured.alchemy.activations[0].formulaTests[0];
  const successes = (d: any) =>
    d.normal.concat(d.hunger).filter((x: number) => x >= 6).length +
    2 *
      Math.floor(
        d.normal.concat(d.hunger).filter((x: number) => x === 10).length / 2,
      );
  const won = successes(t.actor) >= successes(t.opposition);
  expect(t.outcome.success).toBe(won);
  expect(
    (await snapshot(target.id)).conditions.includes(
      "Transportado em voo alquímico",
    ),
  ).toBe(won);
  expect(captured.willpower.superficial).toBe(1);
  expect((await snapshot(target.id)).willpower.superficial).toBe(1);
  expect(t.actor.hunger).toEqual(t.actorReview.original.hunger);
  const after = captured.hunger;
  for (const mode of ["fly", "land"]) {
    await page
      .getByRole("button", { name: "Avançar turno", exact: true })
      .click();
    await use
      .getByRole("button", { name: "Usar voo alquímico", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Uso do voo").selectOption(mode);
    await dialog
      .getByLabel("Confirmo espaço, contato e circunstâncias de voo na cena")
      .check();
    await dialog.getByRole("button", { name: "Registrar uso do voo" }).click();
    await expect(dialog).toHaveCount(0);
    await use
      .getByRole("button", { name: "Aceitar dados e resolver voo" })
      .click();
    await expect(
      use.getByText("Uso em revisão; movimento ainda não aplicado"),
    ).toHaveCount(0);
    expect((await snapshot()).alchemy.activations[0].flight.airborne).toBe(
      mode === "fly",
    );
  }
  expect((await snapshot()).hunger).toBe(after);
  expect((await snapshot(target.id)).conditions).not.toContain(
    "Transportado em voo alquímico",
  );
  expect((await snapshot(target.id)).health).toEqual(target.health);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/v5-impulso-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Avançar cena", exact: true }).click();
  await expect
    .poll(async () => (await snapshot()).alchemy.activations[0].status)
    .toBe("ended");
  expect((await snapshot()).conditions).not.toContain(
    "Impulso Suspenso no Ar ativo",
  );
  expect(errors).toEqual([]);
});
