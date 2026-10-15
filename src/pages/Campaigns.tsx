import { StoryClockControls } from "../components/StoryClock";
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowLeft,
  Trash2,
  BookOpen,
  LockKeyhole,
  CalendarDays,
  Users,
} from "lucide-react";
import {
  campaignSchema,
  coterieSchema,
  recordSchema,
  recordKinds,
  recordLabels,
} from "../../shared/model";
import { api, send } from "../api";
import {
  Field,
  Modal,
  Empty,
  CheckBox,
  useAutosave,
  SaveState,
} from "../components/ui";
import { PageProps } from "../types";
export default function Campaigns(
  props: PageProps & { selectedId?: string; mode?: string },
) {
  const { state, refresh, notify, user, go, mode } = props,
    [editor, setEditor] = useState<any>(null),
    [users, setUsers] = useState<any[]>([]),
    [filter, setFilter] = useState(
      mode === "coteries"
        ? "coteries"
        : mode === "narrator"
          ? "records"
          : "campaigns",
    ),
    [campaignId, setCampaignId] = useState(""),
    [kind, setKind] = useState(""),
    [deleting, setDeleting] = useState<any>(null),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [sessionStart, setSessionStart] = useState<any>(null),
    [ambitionIds, setAmbitionIds] = useState<string[]>([]);
  useEffect(() => {
    void api("/users")
      .then(setUsers)
      .catch((e) => notify(e.message));
  }, []);
  const entries = (state as any)[filter].filter(
    (e: any) =>
      (!campaignId || e.campaignId === campaignId || e.id === campaignId) &&
      (!kind || e.kind === kind),
  );
  const create = () => {
    if (user.role !== "narrator" && filter !== "records") {
      notify("Somente o Narrador cria esse registro.");
      return;
    }
    if (filter === "campaigns")
      setEditor({
        type: filter,
        data: campaignSchema.parse({ name: "Nova campanha", gmId: user.id }),
      });
    else if (!state.campaigns.length)
      notify("Crie uma campanha antes de adicionar Coteries e acontecimentos.");
    else if (filter === "coteries")
      setEditor({
        type: filter,
        data: coterieSchema.parse({
          name: "Nova Coterie",
          campaignId: campaignId || state.campaigns[0].id,
        }),
      });
    else
      setEditor({
        type: filter,
        data: recordSchema.parse({
          name: "Novo registro",
          kind: kind || "session",
          campaignId: campaignId || state.campaigns[0].id,
        }),
      });
  };
  const set = (k: string, v: any) =>
    setEditor((p: any) => ({ ...p, data: { ...p.data, [k]: v } }));
  const field = (
    k: string,
    label: string,
    type = "text",
    options?: { value: string; label: string }[],
  ) => (
    <Field
      key={k}
      label={label}
      value={editor.data[k]}
      type={type}
      options={options}
      onChange={(v) => set(k, v)}
    />
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">O MUNDO ALÉM DA FICHA</span>
          <h1>
            {mode === "coteries"
              ? "Coteries e Domínios"
              : mode === "narrator"
                ? "Ferramentas do Narrador"
                : "Campanhas"}
          </h1>
          <p>
            Organize a crônica, seus territórios e as consequências de cada
            noite.
          </p>
        </div>
        <button className="primary" onClick={create}>
          <Plus size={17} />
          {filter === "campaigns"
            ? "Nova Campanha"
            : filter === "coteries"
              ? "Nova Coterie"
              : "Novo Registro"}
        </button>
      </header>
      <nav className="tabs">
        {[
          ["campaigns", "Campanhas"],
          ["coteries", "Coteries e Domínios"],
          ["records", "Sessões e narrativa"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={filter === k ? "active" : ""}
            onClick={() => {
              setFilter(k);
              setKind("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="toolbar">
        <select
          aria-label="Filtrar campanha"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">Todas as campanhas</option>
          {state.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filter === "records" && (
          <select
            aria-label="Tipo de registro"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Todos os registros</option>
            {recordKinds.map((k) => (
              <option key={k} value={k}>
                {recordLabels[k]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="campaign-grid">
        {entries.map((entry: any) => (
          <article key={entry.id} className="panel campaign-card">
            <div className="card-top">
              <span className="eyebrow">
                {filter === "records"
                  ? recordLabels[entry.kind]
                  : filter === "coteries"
                    ? "COTERIE"
                    : "CRÔNICA"}
              </span>
              {entry.private && <LockKeyhole size={17} />}
            </div>
            <h2>{entry.name}</h2>
            <p className="preserve-lines">
              {entry.description ||
                entry.objectives ||
                entry.setting ||
                "Registre os detalhes da sua crônica."}
            </p>
            {filter === "campaigns" && (
              <StoryClockControls
                clock={entry.clock}
                date={entry.storyDate}
                id={entry.id}
                editable={entry.isGM}
                refresh={refresh}
                notify={notify}
              />
            )}
            {filter === "campaigns" && (
              <>
                <div className="stats-row">
                  <div>
                    <small>Personagens</small>
                    <strong>
                      {
                        state.characters.filter(
                          (c) => c.campaignId === entry.id,
                        ).length
                      }
                    </strong>
                  </div>
                  <div>
                    <small>Sessões</small>
                    <strong>
                      {
                        state.records.filter(
                          (r) =>
                            r.campaignId === entry.id && r.kind === "session",
                        ).length
                      }
                    </strong>
                  </div>
                </div>
                <p className="hint">
                  Versão de regras:{" "}
                  {entry.ruleset === "companion"
                    ? "Companion atualizado"
                    : "Básico fornecido"}
                </p>
                <h3>Princípios da Crônica</h3>
                <p className="preserve-lines">
                  {entry.principles || "Ainda não definidos."}
                </p>
              </>
            )}
            {filter === "coteries" && (
              <>
                <div className="stats-row">
                  <div>
                    <small>Chasse</small>
                    <strong>{entry.chasse}</strong>
                  </div>
                  <div>
                    <small>Lien</small>
                    <strong>{entry.lien}</strong>
                  </div>
                  <div>
                    <small>Portillon</small>
                    <strong>{entry.portillon}</strong>
                  </div>
                </div>
                <p className="hint">
                  Caça no Domínio:{" "}
                  {entry.chasse > 0
                    ? "dificuldade " + (7 - entry.chasse)
                    : "Domínio sem Chasse definido"}{" "}
                  · {entry.territory}
                </p>
                <p>
                  {entry.members
                    .map(
                      (id: string) =>
                        state.characters.find((c) => c.id === id)?.name,
                    )
                    .join(", ")}
                </p>
              </>
            )}
            {filter === "records" && entry.kind === "session" && entry.isGM && (
              <div className="row">
                <span className="pill">{entry.status}</span>
                {entry.status !== "Em andamento" &&
                  entry.status !== "Encerrada" && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setSessionStart(entry);
                        setAmbitionIds([]);
                      }}
                    >
                      Iniciar sessão
                    </button>
                  )}
                {entry.status === "Em andamento" && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        const r = await send(
                          "/sessions/" + entry.id + "/finish",
                          { xp: 1 },
                        );
                        await refresh();
                        notify(
                          "Sessão encerrada: Remorso resolvido e 1 XP concedido aos " +
                            r.participants.length +
                            " participantes.",
                        );
                      } catch (e: any) {
                        notify(e.message);
                      }
                    }}
                  >
                    Encerrar sessão · Remorso e 1 XP
                  </button>
                )}
              </div>
            )}
            {entry.date && (
              <p className="date-label">
                <CalendarDays size={15} />
                {entry.date}
              </p>
            )}
            {entry.notes && <p className="preserve-lines">{entry.notes}</p>}
            {entry.privateNotes && (
              <div className="private-block">
                <LockKeyhole size={16} />
                <span>Anotações privadas</span>
                <p className="preserve-lines">{entry.privateNotes}</p>
              </div>
            )}
            <div className="row">
              <button
                className="secondary"
                onClick={() =>
                  setEditor({
                    type: filter,
                    data: entry,
                    readonly: !entry.canEdit,
                  })
                }
              >
                {entry.canEdit ? "Gerenciar" : "Consultar"}
              </button>
              {entry.canEdit && (
                <button
                  className="icon-button"
                  title="Arquivar registro"
                  onClick={() => setDeleting(entry)}
                >
                  <Trash2 size={16} />
                </button>
              )}
              {filter === "campaigns" && (
                <button
                  className="text-button"
                  onClick={() => {
                    setCampaignId(entry.id);
                    setFilter("records");
                  }}
                >
                  Sessões e registros
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!entries.length && (
        <Empty
          title="Nenhum registro nesta área"
          detail="Crie uma campanha, reúna a Coterie e registre a primeira sessão."
          action={
            <button className="primary" onClick={create}>
              Criar registro
            </button>
          }
        />
      )}
      {sessionStart && (
        <Modal
          title={"Iniciar sessão — " + sessionStart.name}
          onClose={() => setSessionStart(null)}
        >
          <p>
            A recuperação superficial será aplicada aos participantes. Marque
            quem agiu de acordo com sua Ambição na sessão anterior para
            recuperar também um ponto agravado de Força de Vontade.
          </p>
          {sessionStart.participants.map((key: string) => (
            <CheckBox
              key={key}
              label={
                state.characters.find((c) => c.id === key)?.name ||
                "Personagem indisponível"
              }
              checked={ambitionIds.includes(key)}
              onChange={(b) =>
                setAmbitionIds((p) =>
                  b ? [...p, key] : p.filter((x) => x !== key),
                )
              }
            />
          ))}
          <button
            className="primary"
            onClick={async () => {
              try {
                const r = await send(
                  "/sessions/" + sessionStart.id + "/start",
                  { ambitionIds },
                );
                await refresh();
                setSessionStart(null);
                notify(
                  "Sessão iniciada: recuperação aplicada a " +
                    r.participants.length +
                    " participantes.",
                );
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            Confirmar início da sessão
          </button>
        </Modal>
      )}
      {editor && (
        <Modal
          title={editor.data.name}
          wide
          onClose={() => {
            setEditor(null);
            setError("");
          }}
        >
          <fieldset disabled={editor.readonly} className="form-grid">
            {field("name", "Nome")}
            {editor.type !== "campaigns" &&
              field(
                "campaignId",
                "Campanha",
                "text",
                state.campaigns.map((c) => ({ value: c.id, label: c.name })),
              )}
            {editor.type === "campaigns" && (
              <>
                {field("setting", "Cenário")}
                {field("description", "Descrição", "textarea")}
                {field("principles", "Princípios da Crônica", "textarea")}
                {field("ruleset", "Versão aplicável", "text", [
                  { value: "companion", label: "Companion — PDF 61–63" },
                  { value: "basic", label: "Básico fornecido — PDF 194–195" },
                ])}
                <label className="field wide">
                  <span>Jogadores com acesso à campanha</span>
                  <div className="check-grid">
                    {users
                      .filter((u) => u.id !== editor.data.gmId)
                      .map((u) => (
                        <CheckBox
                          key={u.id}
                          label={
                            u.name +
                            " (" +
                            (u.role === "narrator" ? "Narrador" : "Jogador") +
                            ")"
                          }
                          checked={editor.data.members.includes(u.id)}
                          onChange={(b) =>
                            set(
                              "members",
                              b
                                ? [...editor.data.members, u.id]
                                : editor.data.members.filter(
                                    (x: string) => x !== u.id,
                                  ),
                            )
                          }
                        />
                      ))}
                  </div>
                </label>
              </>
            )}
            {editor.type === "coteries" && (
              <>
                {field("type", "Tipo da Coterie")}
                {field("objectives", "Objetivos", "textarea")}
                {field("pool", "Reserva de pontos", "number")}
                {field("chasse", "Chasse (0–5)", "number")}
                {field("lien", "Lien (0–5)", "number")}
                {field("portillon", "Portillon (0–5)", "number")}
                {field("territory", "Territórios e locais de caça", "textarea")}
                {field(
                  "resources",
                  "Recursos, Vantagens e Defeitos coletivos",
                  "textarea",
                )}
                {field("allies", "Contatos e aliados", "textarea")}
                {field(
                  "problems",
                  "Problemas, segurança e conflitos",
                  "textarea",
                )}
                {field("debts", "Dívidas e obrigações", "textarea")}
                <label className="field wide">
                  <span>Membros</span>
                  <div className="check-grid">
                    {state.characters
                      .filter((c) => c.campaignId === editor.data.campaignId)
                      .map((c) => (
                        <CheckBox
                          key={c.id}
                          label={c.name}
                          checked={editor.data.members.includes(c.id)}
                          onChange={(b) =>
                            set(
                              "members",
                              b
                                ? [...editor.data.members, c.id]
                                : editor.data.members.filter(
                                    (x: string) => x !== c.id,
                                  ),
                            )
                          }
                        />
                      ))}
                  </div>
                </label>
              </>
            )}
            {editor.type === "records" && (
              <>
                {field(
                  "kind",
                  "Tipo",
                  "text",
                  recordKinds.map((value) => ({
                    value,
                    label: recordLabels[value],
                  })),
                )}
                {field("date", "Data", "date")}
                {field("status", "Situação")}
                {field(
                  "relatedId",
                  "Registro relacionado",
                  "text",
                  [
                    ...state.characters,
                    ...state.records,
                    ...state.coteries,
                  ].map((r) => ({ value: r.id, label: r.name })),
                )}
                {field(
                  "description",
                  "Descrição / diário / acontecimento",
                  "textarea",
                )}
                {user.role === "narrator" && (
                  <CheckBox
                    label="Registro privado do Narrador"
                    checked={editor.data.private}
                    onChange={(v) => set("private", v)}
                  />
                )}
                <label className="field wide">
                  <span>Participantes / relações</span>
                  <div className="check-grid">
                    {state.characters
                      .filter((c) => c.campaignId === editor.data.campaignId)
                      .map((c) => (
                        <CheckBox
                          key={c.id}
                          label={c.name}
                          checked={editor.data.participants.includes(c.id)}
                          onChange={(v) =>
                            set(
                              "participants",
                              v
                                ? [...editor.data.participants, c.id]
                                : editor.data.participants.filter(
                                    (x: string) => x !== c.id,
                                  ),
                            )
                          }
                        />
                      ))}
                  </div>
                </label>
              </>
            )}
            {field("notes", "Anotações públicas", "textarea")}
            {user.role === "narrator" &&
              (editor.type === "campaigns" || editor.type === "records") &&
              field(
                "privateNotes",
                "Anotações privadas do Narrador",
                "textarea",
              )}
          </fieldset>
          {error && <p className="error">{error}</p>}
          <footer className="modal-actions">
            <button className="secondary" onClick={() => setEditor(null)}>
              Fechar
            </button>
            {!editor.readonly && (
              <button
                className="primary"
                onClick={async () => {
                  try {
                    const data = editor.data;
                    await send(
                      "/entities/" + (data.id || editor.type),
                      data,
                      data.id ? "PUT" : "POST",
                    );
                    await refresh();
                    setEditor(null);
                    notify("Registro salvo.");
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                Salvar registro
              </button>
            )}
          </footer>
        </Modal>
      )}
      {deleting && (
        <Modal title="Arquivar registro" onClose={() => setDeleting(null)}>
          <p>
            Digite <strong>{deleting.name}</strong> para enviar este registro à
            lixeira.
          </p>
          <Field
            label="Nome para confirmação"
            value={confirm}
            onChange={setConfirm}
          />
          <button
            className="danger"
            onClick={async () => {
              try {
                await send("/entities/" + deleting.id, { confirm }, "DELETE");
                await refresh();
                setDeleting(null);
                setConfirm("");
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            Arquivar
          </button>
        </Modal>
      )}
    </>
  );
}
