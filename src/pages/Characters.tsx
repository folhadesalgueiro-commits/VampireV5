import { BloodBonds } from "../components/BloodBonds";
import { ThinBloodProfile } from "../components/ThinBloodProfile";
import { Alchemy } from "../components/Alchemy";
import { FormulaDice } from "../components/LongReach";
import {
  fogPenalty,
  ENVELOP_CONDITION,
  ENVELOP_READY,
  FLIGHT_READY,
  AIRBORNE,
  FLIGHT_PASSENGER,
  SUFFOCATING,
  UNCONSCIOUS_ENVELOP,
} from "../../shared/alchemy-effects";
import {
  ALCHEMY,
  alchemyMethods,
  isThinBlood,
  hasTrait,
  effectiveBaneClan,
} from "../../shared/thin-blood";
import { storyDate } from "../../shared/bonds";
import { StoryClockControls } from "../components/StoryClock";
import { storyClock, nightKey } from "../../shared/blood-mechanics";
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowLeft,
  UserRound,
  Dices,
  Trash2,
  ImagePlus,
  BookOpen,
  Shield,
  ChevronRight,
} from "lucide-react";
import {
  Character,
  Content,
  attributes,
  attributeGroups,
  skillGroups,
  skills,
  labels,
  emptyCharacter,
  characterSchema,
  kindLabels,
  effectLabels,
  durationLabels,
  actionLabels,
} from "../../shared/model";
import {
  blood,
  derived,
  pool,
  requirementsMet,
  validateCreation,
  xpCost,
} from "../../shared/rules";
import {
  Field,
  Dots,
  Empty,
  Modal,
  CheckBox,
  Badge,
  useAutosave,
  SaveState,
} from "../components/ui";
import { api, send, imageFile } from "../api";
import { PageProps } from "../types";
export function Characters(
  props: PageProps & { selectedId?: string; create?: boolean },
) {
  const { state, go, refresh, notify, selectedId } = props,
    [q, setQ] = useState(""),
    [deleting, setDeleting] = useState<any>(null),
    [confirm, setConfirm] = useState("");
  const selected = state.characters.find((c) => c.id === selectedId);
  const create = async (npc = false) => {
    try {
      const c = await send("/entities/characters", {
        ...emptyCharacter(),
        npc,
        name: npc ? "Novo NPC" : "Novo personagem",
      });
      await refresh();
      go("characters", c.id);
    } catch (e: any) {
      notify(e.message);
    }
  };
  useEffect(() => {
    if (props.create && !selectedId) void create();
  }, [props.create]);
  if (selected)
    return <CharacterSheet key={selected.id} {...props} initial={selected} />;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">OS AMALDIÇOADOS</span>
          <h1>Meus Personagens</h1>
          <p>Histórias humanas. Noites eternas.</p>
        </div>
        <div className="row">
          {props.user.role === "narrator" && (
            <button className="secondary" onClick={() => create(true)}>
              Criar NPC
            </button>
          )}
          <button className="primary" onClick={() => create()}>
            <Plus size={17} />
            Criar personagem
          </button>
        </div>
      </header>
      <div className="toolbar">
        <input
          aria-label="Buscar personagem"
          placeholder="Buscar por nome ou conceito"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="count">{state.characters.length} personagens</span>
      </div>
      <div className="character-grid">
        {state.characters
          .filter((c) =>
            (c.name + c.concept)
              .toLocaleLowerCase("pt-BR")
              .includes(q.toLocaleLowerCase("pt-BR")),
          )
          .map((c) => (
            <article className="character-card" key={c.id}>
              <div className="portrait">
                {c.portrait ? (
                  <img src={c.portrait} />
                ) : (
                  <UserRound size={54} />
                )}
                <span className="portrait-tag">
                  {c.npc
                    ? "NPC"
                    : c.status === "draft"
                      ? "EM CRIAÇÃO"
                      : "PERSONAGEM"}
                </span>
              </div>
              <div className="character-card-body">
                <span className="eyebrow">
                  {c.nature === "mortal"
                    ? "Mortal"
                    : state.content.find((x) => x.id === c.clanId)?.name ||
                      "Clã a definir"}
                </span>
                <h2>{c.name}</h2>
                <p>{c.concept || "Uma história ainda por escrever."}</p>
                <div className="mini-resources">
                  {c.nature !== "mortal" && (
                    <span>
                      Fome <strong>{c.hunger}</strong>
                    </span>
                  )}
                  <span>
                    Humanidade <strong>{c.humanity}</strong>
                  </span>
                  <span>
                    XP <strong>{c.xpTotal - c.xpSpent}</strong>
                  </span>
                </div>
                <div className="row">
                  <button
                    className="primary"
                    onClick={() => go("characters", c.id)}
                  >
                    Abrir ficha <ChevronRight size={16} />
                  </button>
                  {c.canEdit && (
                    <button
                      className="icon-button"
                      title="Arquivar personagem"
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
      </div>
      {!state.characters.length && (
        <Empty
          title="A próxima história começa com você"
          detail="Crie uma ficha guiada; seus personagens serão salvos automaticamente."
          action={
            <button className="primary" onClick={() => create()}>
              Criar primeiro personagem
            </button>
          }
        />
      )}
      {deleting && (
        <Modal title="Arquivar personagem" onClose={() => setDeleting(null)}>
          <p>
            Digite <strong>{deleting.name}</strong>. A ficha poderá ser
            restaurada na lixeira.
          </p>
          <Field label="Confirmação" value={confirm} onChange={setConfirm} />
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
            Arquivar ficha
          </button>
        </Modal>
      )}
    </>
  );
}
function Track({
  label,
  max,
  track,
}: {
  label: string;
  max: number;
  track: { superficial: number; aggravated: number };
}) {
  return (
    <div className="track">
      <div>
        <span>{label}</span>
        <small>
          {Math.max(0, max - track.superficial - track.aggravated)} / {max}{" "}
          livres
        </small>
      </div>
      <div className="track-boxes">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={
              i < track.aggravated
                ? "aggravated"
                : i < track.aggravated + track.superficial
                  ? "superficial"
                  : ""
            }
          >
            {i < track.aggravated
              ? "×"
              : i < track.aggravated + track.superficial
                ? "/"
                : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
export function DiceView({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="dice-result">
      <div className="dice-values">
        {result.normal?.map((v: number, i: number) => (
          <span className={"die " + (v >= 6 ? "success" : "")} key={"n" + i}>
            {v}
          </span>
        ))}
        {result.hunger?.map((v: number, i: number) => (
          <span
            className={"die hunger " + (v >= 6 ? "success" : "")}
            key={"h" + i}
          >
            {v}
          </span>
        ))}
      </div>
      <h3 className={result.bestial || result.messy ? "blood-text" : ""}>
        {result.label}
      </h3>
      <p>
        {result.successes} sucessos · dificuldade {result.difficulty} · margem{" "}
        {result.margin}
      </p>
      {result.messy && (
        <p className="hint">
          A vitória é marcada pela Besta. O Narrador deve resolver a
          consequência narrativa; Máculas e Compulsões exigem decisão.
        </p>
      )}
      {result.bestial && (
        <p className="hint">
          O teste falhou com um 1 em Dado de Fome. Registre a Compulsão ou outra
          consequência conforme a fonte e o Narrador.
        </p>
      )}
    </div>
  );
}
function RollDialog({
  c,
  catalog,
  ruleset,
  onClose,
  onRoll,
  initialSkill = "briga",
  characters = [],
}: {
  c: Character;
  catalog: Content[];
  ruleset: string;
  onClose: () => void;
  onRoll: (d: any) => Promise<any>;
  initialSkill?: string;
  characters?: Character[];
}) {
  const [data, setData] = useState({
      attribute: "forca",
      skill: initialSkill,
      modifier: 0,
      difficulty: 2,
      specialty: false,
      tags: [] as string[],
      surge: false,
      mode: "normal",
      label: "",
      targetId: "",
      targetContext: "",
    }),
    [result, setResult] = useState<any>(null),
    [indices, setIndices] = useState<number[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [tagText, setTagText] = useState("");
  const put = (k: string, v: any) => setData((p) => ({ ...p, [k]: v }));
  const traits = [...attributes, ...skills].map((value) => ({
      value,
      label: labels[value],
    })),
    ds = catalog
      .filter((x) => x.kind === "discipline")
      .map((x) => ({ value: x.id, label: x.name }));
  return (
    <Modal title="Rolagem de dados" onClose={onClose}>
      <div className="form-grid">
        <Field
          label="Tipo de teste"
          value={data.mode}
          onChange={(v) =>
            setData((d) => ({
              ...d,
              mode: v,
              surge: v === "normal" ? d.surge : false,
              targetContext: v === "normal" ? d.targetContext : "",
              targetId: v === "normal" ? d.targetId : "",
            }))
          }
          options={[
            { value: "normal", label: "Atributo + Perícia / Disciplina" },
            { value: "willpower", label: "Força de Vontade (sem Fome)" },
            { value: "humanity", label: "Humanidade (sem Fome)" },
            ...(c.nature !== "mortal"
              ? [{ value: "frenzy", label: "Resistir ao Frenesi (sem Fome)" }]
              : []),
          ]}
        />
        {data.mode === "normal" && (
          <>
            <Field
              label="Atributo"
              value={data.attribute}
              onChange={(v) => put("attribute", v)}
              options={traits}
            />
            <Field
              label="Perícia / Disciplina"
              value={data.skill}
              onChange={(v) => put("skill", v)}
              options={[...traits, ...ds]}
            />
            <Field
              label="Modificador"
              type="number"
              value={data.modifier}
              onChange={(v) => put("modifier", v)}
            />
            <Field
              label="Contexto com alvo"
              value={data.targetContext}
              options={[
                { value: "identify", label: "Identificar alvo" },
                { value: "ranged", label: "Ataque à distância" },
                { value: "visual", label: "Percepção visual (sem alvo)" },
              ]}
              onChange={(v) => put("targetContext", v)}
            />
            {data.targetContext && data.targetContext !== "visual" && (
              <Field
                label="Alvo do teste"
                value={data.targetId}
                options={characters
                  .filter((x) => x.id !== c.id && x.campaignId === c.campaignId)
                  .map((x) => ({ value: x.id, label: x.name }))}
                onChange={(v) => put("targetId", v)}
              />
            )}
            <CheckBox
              label="Especialização aplicável (+1 dado)"
              checked={data.specialty}
              onChange={(v) => put("specialty", v)}
            />
            {c.nature !== "mortal" && (
              <CheckBox
                label={
                  "Surto de Sangue (+" +
                  blood(c.bloodPotency, ruleset).surge +
                  " dados e Despertar)"
                }
                checked={data.surge}
                onChange={(v) => put("surge", v)}
              />
            )}
            <Field
              label="Etiquetas do contexto (separadas por vírgulas)"
              value={tagText}
              onChange={(v) => {
                setTagText(v);
                put(
                  "tags",
                  v
                    .split(",")
                    .map((x: string) => x.trim())
                    .filter(Boolean),
                );
              }}
              placeholder="alvoMortal, caraACaraMortal, resistirCoercao…"
            />
          </>
        )}
        {data.mode === "frenzy" &&
          isThinBlood(c) &&
          !hasTrait(c, "flaw-temperamento-bestial") && (
            <CheckBox
              label="Frenesi provocado por poder sobrenatural"
              checked={data.tags.includes("provocacaoSobrenatural")}
              onChange={(v) =>
                put(
                  "tags",
                  v
                    ? [...new Set([...data.tags, "provocacaoSobrenatural"])]
                    : data.tags.filter((t) => t !== "provocacaoSobrenatural"),
                )
              }
            />
          )}
        {data.mode === "frenzy" && effectiveBaneClan(c) === "clan-brujah" && (
          <CheckBox
            label="Teste de Frenesi de Fúria"
            checked={data.tags.includes("frenesiFuria")}
            onChange={(v) =>
              put(
                "tags",
                v
                  ? [...new Set([...data.tags, "frenesiFuria"])]
                  : data.tags.filter((t) => t !== "frenesiFuria"),
              )
            }
          />
        )}
        <Field
          label="Dificuldade"
          type="number"
          value={data.difficulty}
          onChange={(v) => put("difficulty", v)}
        />
        <Field
          label="Descrição do teste"
          value={data.label}
          onChange={(v) => put("label", v)}
        />
      </div>
      {data.mode === "normal" && (
        <p className="pool-preview">
          <strong>
            {pool(
              c,
              catalog,
              data,
              data.modifier -
                (["identify", "ranged"].includes(data.targetContext) &&
                characters.find((x) => x.id === data.targetId)
                  ? fogPenalty(characters.find((x) => x.id === data.targetId)!)
                  : 0),
              data.specialty,
              ruleset,
              data.skill.startsWith("discipline-"),
            ) + (data.surge ? blood(c.bloodPotency, ruleset).surge : 0)}
          </strong>{" "}
          dados · até {c.hunger} Dados de Fome
        </p>
      )}
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          try {
            setBusy(true);
            setError("");
            setResult(await onRoll(data));
            setIndices([]);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Dices size={18} />
        {busy ? "Rolando…" : "Rolar dados"}
      </button>
      {error && <p className="error">{error}</p>}
      <DiceView result={result?.result} />
      {result?.rouse && (
        <p>
          Despertar do Surto: {result.rouse.dice.join(", ")} ·{" "}
          {result.rouse.success ? "Fome mantida" : "Fome +1"}
        </p>
      )}
      {result?.result && result.mode === "normal" && !result.rerolled && (
        <section>
          <h3>Rerrolar com Força de Vontade</h3>
          <p className="hint">
            Selecione até três dados normais. O gasto causa 1 dano superficial
            de Força de Vontade, sem divisão.
          </p>
          <div className="row">
            {result.result.normal.map((v: number, i: number) => (
              <button
                key={i}
                className={
                  "die selectable " + (indices.includes(i) ? "selected" : "")
                }
                aria-label={"Selecionar dado normal " + (i + 1)}
                onClick={() =>
                  setIndices((p) =>
                    p.includes(i)
                      ? p.filter((x) => x !== i)
                      : p.length < 3
                        ? [...p, i]
                        : p,
                  )
                }
              >
                {v}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            disabled={!indices.length || busy}
            onClick={async () => {
              try {
                setBusy(true);
                setResult(
                  await send("/rolls/" + result.id + "/reroll", { indices }),
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Gastar 1 Força de Vontade e rerrolar
          </button>
        </section>
      )}
    </Modal>
  );
}
export function CharacterSheet(props: PageProps & { initial: any }) {
  const { state, refresh, notify, go, initial } = props;
  const save = useAutosave<any>(initial, refresh),
    c = save.value as Character,
    edit = initial.canEdit,
    gm = initial.isGM;
  const [tab, setTab] = useState("identidade"),
    [rollSkill, setRollSkill] = useState<string | null>(null),
    [action, setAction] = useState<string | null>(null),
    [amount, setAmount] = useState(1),
    [reason, setReason] = useState(""),
    [track, setTrack] = useState("health"),
    [aggravated, setAggravated] = useState(false),
    [result, setResult] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [rolls, setRolls] = useState<any[]>([]),
    [advId, setAdvId] = useState(""),
    [advLevel, setAdvLevel] = useState(1),
    [discId, setDiscId] = useState(""),
    [itemId, setItemId] = useState(""),
    [newCondition, setNewCondition] = useState(""),
    [exception, setException] = useState("");
  const catalog = state.content,
    clan = catalog.find((x) => x.id === c.clanId),
    campaign = state.campaigns.find((x) => x.id === c.campaignId),
    ruleset = campaign?.ruleset ?? "companion",
    d = derived(c, catalog),
    b = blood(c.bloodPotency, ruleset);
  const put = (k: string, v: any) => save.update({ ...c, [k]: v });
  const field = (
    k: string,
    label: string,
    type = "text",
    options?: { value: string; label: string }[],
  ) => (
    <Field
      key={k}
      label={label}
      value={(c as any)[k]}
      onChange={(v) => put(k, v)}
      type={type}
      options={options}
      disabled={
        !edit ||
        (c.status !== "draft" &&
          !gm &&
          ["generation", "bloodPotency", "campaignId"].includes(k))
      }
    />
  );
  const run = async (data: any, showResult = true) => {
    try {
      await save.flush();
      const r = await send("/characters/" + c.id + "/action", data);
      await refresh();
      if (showResult) setResult(r.result);
      notify("Alteração registrada na ficha.");
      return r;
    } catch (e: any) {
      notify(e.message);
      throw e;
    }
  };
  useEffect(() => {
    void Promise.all([
      api("/characters/" + c.id + "/history"),
      api("/characters/" + c.id + "/rolls"),
    ])
      .then(([h, r]) => {
        setHistory(h);
        setRolls(r);
      })
      .catch((e) => notify(e.message));
  }, [initial.version, tab]);
  const leave = async () => {
    try {
      await save.flush();
      go("characters");
    } catch {
      notify("Salve as alterações antes de sair.");
    }
  };
  const tabs =
    c.status === "draft"
      ? [
          "identidade",
          "atributos",
          "perícias",
          "sangue",
          "vantagens",
          "história",
          "revisão",
        ]
      : [
          "identidade",
          "atributos",
          "perícias",
          "sangue",
          "vantagens",
          "história",
          "inventário",
          "progressão",
          "registro",
        ];
  const problems = validateCreation(c, catalog);
  return (
    <>
      <div className="sheet-top">
        <button className="text-button" onClick={leave}>
          <ArrowLeft size={16} />
          Personagens
        </button>
        <SaveState {...save} />
      </div>
      <header className="sheet-header">
        <div className="sheet-avatar">
          {c.portrait ? <img src={c.portrait} /> : <UserRound size={40} />}
        </div>
        <div>
          <span className="eyebrow">
            {c.nature === "mortal"
              ? "MORTAL"
              : (clan?.name || "CLÃ A DEFINIR") +
                " · " +
                c.generation +
                "ª GERAÇÃO"}{" "}
            {c.npc ? "· NPC" : ""}
          </span>
          <h1>{c.name}</h1>
          <p>
            {c.concept || "Ficha digital da crônica"} ·{" "}
            {c.status === "draft"
              ? "Criação em andamento"
              : campaign?.name || "Sem campanha"}
          </p>
        </div>
        <div className="row">
          {edit && (
            <button
              className="primary"
              onClick={async () => {
                try {
                  await save.flush();
                  setRollSkill("briga");
                } catch {}
              }}
            >
              <Dices size={18} />
              Rolar teste
            </button>
          )}
          <button
            className="secondary"
            onClick={() => go("library", "ficha:1")}
          >
            <BookOpen size={16} />
            Referência
          </button>
        </div>
      </header>
      <StoryClockControls
        clock={storyClock(c, campaign)}
        date={storyDate(c, campaign)}
        id={campaign?.id || c.id}
        editable={gm}
        refresh={refresh}
        notify={notify}
        beforeAdvance={save.flush}
      />
      <section className="resource-panel">
        {c.nature !== "mortal" && (
          <div>
            <button
              className="resource-title"
              onClick={() => go("library", "basico:180")}
            >
              Fome <BookOpen size={12} />
            </button>
            <div className="hunger-boxes">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < c.hunger ? "filled" : ""}>
                  ◆
                </span>
              ))}
            </div>
            <small>
              {c.hunger} / 5 ·{" "}
              {c.hunger === 5
                ? "Despertar voluntário bloqueado"
                : "A Besta aguarda"}
            </small>
          </div>
        )}
        <Track label="Vitalidade" max={d.healthMax} track={c.health} />
        <Track
          label="Força de Vontade"
          max={d.willpowerMax}
          track={c.willpower}
        />
        <div>
          <button
            className="resource-title"
            onClick={() => go("library", "basico:218")}
          >
            Humanidade <BookOpen size={12} />
          </button>
          <div className="humanity-track">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={
                  i < c.humanity ? "human" : i >= 10 - c.stains ? "stained" : ""
                }
              />
            ))}
          </div>
          <small>
            {c.humanity} / 10 · {c.stains} Máculas
          </small>
        </div>
      </section>
      {d.healthImpaired || d.willpowerImpaired || d.degeneration ? (
        <p className="warning">
          Comprometido: −2 dados nas paradas afetadas.{" "}
          {c.conditions.join(" · ")}
        </p>
      ) : null}
      {edit && (
        <div className="quick-actions">
          {c.nature !== "mortal" && (
            <button onClick={() => setAction("rouse")}>
              Despertar do Sangue
            </button>
          )}
          <button onClick={() => setAction("damage")}>Registrar dano</button>
          {c.nature !== "mortal" && (
            <button onClick={() => setAction("mendAggravated")}>
              Recuperar dano agravado
            </button>
          )}
          {c.nature !== "mortal" && (
            <button
              onClick={() => void run({ action: "blush" }).catch(() => {})}
            >
              Brilho de Vida
            </button>
          )}

          {c.nature !== "mortal" && (
            <button onClick={() => setAction("feed")}>Alimentar-se</button>
          )}
          {c.nature !== "mortal" && (
            <button
              onClick={() => void run({ action: "mend" }).catch(() => {})}
            >
              Recuperar Vitalidade
            </button>
          )}
          <button
            onClick={() =>
              void run({ action: "sessionRecovery" }).catch(() => {})
            }
          >
            Recuperar Vontade
          </button>
          {gm && (
            <button onClick={() => setAction("stains")}>
              Registrar Máculas
            </button>
          )}
          <button
            disabled={!c.stains}
            onClick={() => void run({ action: "remorse" }).catch(() => {})}
          >
            Remorso
          </button>
          <button onClick={() => setAction("expire")}>Encerrar duração</button>
        </div>
      )}
      <nav className="tabs sheet-tabs">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {c.status === "draft" ? (
              <span className="step-number">{i + 1}</span>
            ) : null}
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {tab === "identidade" && (
        <section className="panel">
          <h2>Identidade e vínculos</h2>
          <div className="form-grid three">
            {field("name", "Nome")}
            {field("concept", "Conceito")}
            <Field
              label="Natureza"
              value={c.nature}
              disabled={!edit || (!gm && c.status !== "draft")}
              options={[
                { value: "vampire", label: "Vampiro (inclui Sangue-Ralo)" },
                { value: "mortal", label: "Mortal" },
              ]}
              onChange={(v) =>
                save.update({
                  ...c,
                  nature: v as "vampire" | "mortal",
                  hunger: v === "mortal" ? 0 : 1,
                  bloodPotency: v === "mortal" ? 0 : 1,
                  clanId: "",
                  sire: "",
                  predatorId: "",
                  disciplines: {},
                  powers: [],
                })
              }
            />

            {c.nature !== "mortal" && (
              <Field
                label="Clã / Linhagem"
                value={c.clanId}
                disabled={!edit || (c.status !== "draft" && !gm)}
                options={catalog
                  .filter((x) => ["clan", "lineage"].includes(x.kind))
                  .map((x) => ({ value: x.id, label: x.name }))}
                onChange={(v) => {
                  if (c.status === "draft" && v === "clan-sangue-ralo")
                    save.update({
                      ...c,
                      clanId: v,
                      generation: c.generation >= 14 ? c.generation : 14,
                      bloodPotency: 0,
                      predatorId: "",
                      disciplines: {},
                      powers: [],
                      creation: {
                        ...c.creation,
                        age: "fledgling",
                        predatorDiscipline: "",
                        predatorSpecialty: "",
                      },
                    });
                  else put("clanId", v);
                }}
              />
            )}
            {c.nature !== "mortal" && field("sire", "Senhor")}
            {c.nature !== "mortal" && field("generation", "Geração", "number")}
            {c.nature !== "mortal" &&
              field("bloodPotency", "Potência do Sangue", "number")}
            {field("ambition", "Ambição")}
            {field("desire", "Desejo")}
            {field("sect", "Seita")}
            {field(
              "campaignId",
              "Campanha",
              "text",
              state.campaigns.map((x) => ({ value: x.id, label: x.name })),
            )}
            {field(
              "coterieId",
              "Coterie",
              "text",
              state.coteries
                .filter((x) => x.campaignId === c.campaignId)
                .map((x) => ({ value: x.id, label: x.name })),
            )}
            {field("haven", "Refúgio")}
            {field("age", "Idade verdadeira")}
            {field("apparentAge", "Idade aparente")}
            {field("birthDate", "Data de nascimento", "date")}
            {c.nature !== "mortal" &&
              field("deathDate", "Data do Abraço", "date")}
            <label className="field">
              <span>Retrato</span>
              <input
                disabled={!edit}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  if (e.target.files?.[0])
                    try {
                      put("portrait", await imageFile(e.target.files[0]));
                    } catch (e: any) {
                      notify(e.message);
                    }
                }}
              />
            </label>
          </div>
          {c.status === "draft" && c.nature !== "mortal" && (
            <div className="form-grid">
              <Field
                label="Idade da Coterie"
                value={c.creation.age}
                options={[
                  { value: "fledgling", label: "Cria — sem XP inicial" },
                  { value: "neonate", label: "Neófito — 15 XP iniciais" },
                  {
                    value: "ancilla",
                    label:
                      "Ancilla — 35 XP, Humanidade −1, Vantagens +2, Defeitos +2",
                  },
                ]}
                onChange={(v) => put("creation", { ...c.creation, age: v })}
              />
            </div>
          )}
          {clan && !isThinBlood(c) && (
            <div className="callout">
              <h3>Perdição e Compulsão · {clan.name}</h3>
              <p>{clan.bane || "Consulte a referência do Clã."}</p>
              <p>{clan.compulsion}</p>
              <small>
                Gravidade atual: {b.bane} ·{" "}
                {ruleset === "companion" ? "Companion" : "Básico"} · resolução
                narrativa
              </small>
            </div>
          )}
        </section>
      )}
      {tab === "atributos" && (
        <section className="panel">
          <h2>Atributos</h2>
          {c.status === "draft" && (
            <p className="hint">
              Distribua um Atributo 4, três 3, quatro 2 e um 1. Vitalidade =
              Vigor + 3; Força de Vontade = Autocontrole + Determinação.
            </p>
          )}
          <div className="trait-columns">
            {Object.entries(attributeGroups).map(([group, keys]) => (
              <div key={group}>
                <h3>{group}</h3>
                {keys.map((k) => (
                  <div className="trait-row" key={k}>
                    <span>{labels[k]}</span>
                    <Dots
                      label={labels[k]}
                      value={c.attributes[k]}
                      disabled={!edit || (c.status === "active" && !gm)}
                      onChange={(v) =>
                        put("attributes", {
                          ...c.attributes,
                          [k]: Math.max(1, v),
                        })
                      }
                    />
                    {d.attributes[k] !== c.attributes[k] && (
                      <small>Efetivo: {d.attributes[k]}</small>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "perícias" && (
        <section className="panel">
          <header>
            <h2>Perícias e especializações</h2>
            {c.status === "draft" && (
              <Field
                label="Distribuição"
                value={c.creation.skillDistribution}
                options={[
                  {
                    value: "generalist",
                    label: "Pau pra toda obra: 1×3, 8×2, 10×1",
                  },
                  { value: "balanced", label: "Equilibrado: 3×3, 5×2, 7×1" },
                  {
                    value: "specialist",
                    label: "Especialista: 1×4, 3×3, 3×2, 3×1",
                  },
                ]}
                onChange={(v) =>
                  put("creation", { ...c.creation, skillDistribution: v })
                }
              />
            )}
          </header>
          <div className="trait-columns">
            {Object.entries(skillGroups).map(([group, keys]) => (
              <div key={group}>
                <h3>{group}</h3>
                {keys.map((k) => (
                  <div className="skill-item" key={k}>
                    <div className="trait-row">
                      <button
                        className="trait-name"
                        onClick={() => setRollSkill(k)}
                        disabled={!edit}
                      >
                        {labels[k]}
                        <Dices size={13} />
                      </button>
                      <Dots
                        label={labels[k]}
                        value={c.skills[k]}
                        disabled={!edit || (c.status === "active" && !gm)}
                        onChange={(v) => put("skills", { ...c.skills, [k]: v })}
                      />
                    </div>
                    <input
                      className="specialty-input"
                      aria-label={"Especializações de " + labels[k]}
                      disabled={!edit || (c.status === "active" && !gm)}
                      value={(c.specialties[k] ?? []).join("; ")}
                      placeholder="Especializações (separe por ;)"
                      onChange={(e) =>
                        put("specialties", {
                          ...c.specialties,
                          [k]: e.target.value
                            .split(";")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="hint">
            Descrições: Básico, páginas PDF 136–147. Terminologia da ficha
            fornecida; “Perseverança” é mapeada para “Determinação”.
          </p>
          <button
            className="text-button"
            onClick={() => go("library", "basico:136")}
          >
            Consultar descrições de Perícias
          </button>
        </section>
      )}
      {(isThinBlood(c) ||
        c.alchemy.preparations.length > 0 ||
        c.alchemy.activations.some((a) => a.status !== "ended")) &&
        tab === "sangue" && (
          <Alchemy
            c={c}
            catalog={catalog}
            characters={state.characters}
            campaign={campaign}
            edit={edit}
            gm={gm}
            go={go}
            run={async (data) => {
              await save.flush();
              const result = await send(
                "/characters/" + c.id + "/alchemy",
                data,
              );
              await refresh();
              notify("Operação de Alquimia registrada.");
              return result;
            }}
          />
        )}
      {tab === "sangue" && c.nature !== "mortal" && (
        <>
          <section className="panel">
            <h2>Potência do Sangue</h2>
            <div className="stats-row">
              <div>
                <small>Potência</small>
                <strong>{c.bloodPotency}</strong>
              </div>
              <div>
                <small>Surto de Sangue</small>
                <strong>+{b.surge} dados</strong>
              </div>
              <div>
                <small>Recuperação</small>
                <strong>{b.mend} superficial</strong>
              </div>
              <div>
                <small>Bônus de Disciplina</small>
                <strong>+{b.bonus}</strong>
              </div>
              <div>
                <small>Rerrolagem de Despertar</small>
                <strong>Até nível {b.rerollLevel}</strong>
              </div>
            </div>
            <p className="hint">
              Sangue animal/ensacado:{" "}
              {b.animal === 1
                ? "sacia normalmente"
                : b.animal === 0.5
                  ? "sacia metade"
                  : "não sacia"}
              . Alimentação humana: −{b.feedPenalty} Fome saciada. Mínimo sem
              matar: {b.floor}.
            </p>
            {c.status === "draft" && !isThinBlood(c) && (
              <div className="form-grid">
                {field(
                  "predatorId",
                  "Tipo de Predador",
                  "text",
                  catalog
                    .filter((x) => x.kind === "predator")
                    .map((x) => ({ value: x.id, label: x.name })),
                )}
                {c.predatorId && (
                  <>
                    <Field
                      label="Disciplina do Predador"
                      value={c.creation.predatorDiscipline}
                      options={(
                        catalog.find((x) => x.id === c.predatorId)
                          ?.disciplines ?? []
                      ).map((k) => ({
                        value: k,
                        label: catalog.find((x) => x.id === k)?.name || k,
                      }))}
                      onChange={(v) =>
                        put("creation", {
                          ...c.creation,
                          predatorDiscipline: v,
                        })
                      }
                    />
                    <Field
                      label="Especialização do Predador"
                      value={c.creation.predatorSpecialty}
                      options={(
                        catalog.find((x) => x.id === c.predatorId)
                          ?.specialties ?? []
                      ).map((s) => ({
                        value: s.skill + ":" + s.name,
                        label: labels[s.skill] + " (" + s.name + ")",
                      }))}
                      onChange={(v) =>
                        put("creation", { ...c.creation, predatorSpecialty: v })
                      }
                    />
                    <p className="hint wide">
                      O ponto de Disciplina, a especialização e as concessões
                      cadastradas são aplicados ao finalizar a criação. Escolha
                      o Poder do novo ponto após finalizar.{" "}
                      {catalog.find((x) => x.id === c.predatorId)?.notes}
                    </p>
                  </>
                )}
              </div>
            )}
            {field("resonance", "Ressonância")}
            {field("temperament", "Temperamento")}
          </section>
          <BloodBonds
            c={c}
            catalog={catalog}
            date={storyDate(c, campaign)}
            gm={gm}
            editable={edit}
            onAction={setAction}
          />
          <section className="panel">
            <header>
              <h2>Disciplinas e Poderes</h2>
              {edit &&
                (c.status === "draft" || gm) &&
                !(c.status === "draft" && isThinBlood(c)) && (
                  <div className="row">
                    <select
                      aria-label="Adicionar Disciplina"
                      value={discId}
                      onChange={(e) => setDiscId(e.target.value)}
                    >
                      <option value="">Adicionar Disciplina</option>
                      {catalog
                        .filter((x) => x.kind === "discipline")
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="secondary"
                      disabled={!discId}
                      onClick={() => {
                        put("disciplines", { ...c.disciplines, [discId]: 1 });
                        setDiscId("");
                      }}
                    >
                      Adicionar
                    </button>
                  </div>
                )}
            </header>
            {Object.entries(c.disciplines)
              .filter(([, v]) => v > 0)
              .map(([key, level]) => (
                <div className="discipline-block" key={key}>
                  <div className="trait-row">
                    <h3>{catalog.find((x) => x.id === key)?.name || key}</h3>
                    <Dots
                      label={"Nível de " + key}
                      disabled={!edit || (c.status !== "draft" && !gm)}
                      value={level}
                      onChange={(v) =>
                        put("disciplines", { ...c.disciplines, [key]: v })
                      }
                    />
                  </div>
                  {catalog
                    .filter(
                      (x) =>
                        x.parentId === key &&
                        ["power", "ritual", "ceremony", "formula"].includes(
                          x.kind,
                        ),
                    )
                    .sort((a, b) => a.level - b.level)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={
                          "power-row " +
                          (c.powers.includes(p.id) ? "owned" : "")
                        }
                      >
                        <div>
                          <CheckBox
                            label={
                              p.name +
                              " · " +
                              kindLabels[p.kind] +
                              " " +
                              p.level
                            }
                            checked={c.powers.includes(p.id)}
                            onChange={(v) => {
                              if (
                                !edit ||
                                p.level > level ||
                                !requirementsMet(p, c)
                              ) {
                                notify(
                                  "Nível, requisitos ou permissão insuficientes.",
                                );
                                return;
                              }
                              if (
                                c.status !== "draft" &&
                                !gm &&
                                p.kind === "power" &&
                                c.powers.filter((k) =>
                                  catalog.some(
                                    (x) =>
                                      x.id === k &&
                                      x.parentId === key &&
                                      x.kind === "power",
                                  ),
                                ).length >= level
                              ) {
                                notify(
                                  "Escolha novos Poderes pela progressão.",
                                );
                                return;
                              }
                              put(
                                "powers",
                                v
                                  ? [...c.powers, p.id]
                                  : c.powers.filter((k) => k !== p.id),
                              );
                            }}
                          />
                          <span className="hint">{p.description}</span>
                        </div>
                        <div className="row">
                          <Badge origin={p.automation} />
                          <button
                            className="text-button"
                            onClick={() =>
                              go(
                                "library",
                                p.references[0]
                                  ? p.references[0].document +
                                      ":" +
                                      p.references[0].page
                                  : "",
                              )
                            }
                          >
                            Regra
                          </button>
                          {c.powers.includes(p.id) &&
                            edit &&
                            !(
                              p.kind === "formula" && p.parentId === ALCHEMY
                            ) && (
                              <button
                                className="secondary"
                                onClick={async () => {
                                  try {
                                    await save.flush();
                                    setAction("power:" + p.id);
                                  } catch {}
                                }}
                              >
                                Utilizar
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            {!Object.values(c.disciplines).some((v) => v > 0) && (
              <Empty
                title="Disciplinas ainda não adquiridas"
                detail={
                  isThinBlood(c)
                    ? "Afinidade e Alquimia concedem escolhas próprias. Na criação, selecione suas características na aba Vantagens; as concessões são aplicadas ao concluir."
                    : "Selecione as Disciplinas do Clã durante a criação ou utilize experiência para adquiri-las."
                }
              />
            )}
          </section>
        </>
      )}
      {isThinBlood(c) && ["sangue", "vantagens"].includes(tab) && (
        <ThinBloodProfile
          c={c}
          catalog={catalog}
          edit={edit}
          gm={gm}
          onChange={save.update}
          notify={notify}
          go={go}
        />
      )}
      {tab === "sangue" && c.nature === "mortal" && (
        <section className="panel">
          <h2>Condição mortal</h2>
          <p>
            Mortais não usam Fome, Potência, Predadores ou Disciplinas. Corte,
            perfuração e projéteis causam agravado; armaduras convertem parte em
            superficial. O Companion também trata contundentes pesados como
            agravado. Sua recuperação exige descanso ou assistência; o início da
            sessão recupera superficial até Vigor.
          </p>
        </section>
      )}
      {c.grappledBy && (
        <p className="warning">
          Agarrado por{" "}
          {state.characters.find((x) => x.id === c.grappledBy)?.name ||
            "outro participante"}
          . Só pode agir contra seu agarrador até escapar ou ser solto.
        </p>
      )}
      {tab === "vantagens" && (
        <section className="panel">
          <h2>Vantagens, Qualidades e Defeitos</h2>
          <div className="row">
            <Field
              label="Conteúdo"
              value={advId}
              onChange={(v) => {
                setAdvId(v);
                setAdvLevel(
                  Math.max(1, catalog.find((x) => x.id === v)?.minLevel ?? 0),
                );
              }}
              options={catalog
                .filter(
                  (x) =>
                    ["merit", "flaw", "background"].includes(x.kind) &&
                    (x.category !== "Sangue-Ralo" || !isThinBlood(c)),
                )
                .map((x) => ({
                  value: x.id,
                  label: kindLabels[x.kind] + ": " + x.name,
                }))}
            />
            <Field
              label="Pontos / Nível"
              type="number"
              value={advLevel}
              onChange={setAdvLevel}
            />
            <button
              className="secondary"
              disabled={!edit || (c.status === "active" && !gm) || !advId}
              onClick={() => {
                const entry = catalog.find((x) => x.id === advId);
                if (
                  !entry ||
                  advLevel < entry.minLevel ||
                  advLevel > entry.maxLevel ||
                  !requirementsMet(entry, c) ||
                  entry.incompatible.some((k) =>
                    c.advantages.some((a) => a.contentId === k),
                  )
                ) {
                  notify(
                    "Requisitos não satisfeitos ou combinação incompatível.",
                  );
                  return;
                }
                put("advantages", [
                  ...c.advantages,
                  {
                    contentId: advId,
                    level: advLevel,
                    source: c.status === "draft" ? "creation" : "manual",
                    notes: "",
                  },
                ]);
                setAdvId("");
              }}
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>
          {c.advantages.map((a, i) => (
            <div className="list-row" key={i}>
              <div>
                <strong>
                  {catalog.find((x) => x.id === a.contentId)?.name ||
                    a.contentId}
                </strong>
                <small>
                  {
                    kindLabels[
                      catalog.find((x) => x.id === a.contentId)?.kind || ""
                    ]
                  }{" "}
                  ·{" "}
                  {catalog.find((x) => x.id === a.contentId)?.category ===
                  "Sangue-Ralo"
                    ? "sem custo em pontos"
                    : a.level + " pontos"}{" "}
                  · {a.source === "predator" ? "Predador" : "Ficha"}
                </small>
              </div>
              <div className="row">
                <button
                  className="text-button"
                  onClick={() =>
                    go(
                      "library",
                      catalog.find((x) => x.id === a.contentId)?.references[0]
                        ? catalog.find((x) => x.id === a.contentId)!
                            .references[0].document +
                            ":" +
                            catalog.find((x) => x.id === a.contentId)!
                              .references[0].page
                        : "",
                    )
                  }
                >
                  Referência
                </button>
                {edit && (c.status === "draft" || gm) && (
                  <button
                    className="icon-button"
                    title="Remover Vantagem"
                    onClick={() =>
                      put(
                        "advantages",
                        c.advantages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button className="text-button" onClick={() => go("workshop")}>
            Criar Qualidade ou Defeito na Oficina
          </button>
        </section>
      )}
      {tab === "história" && (
        <section className="panel">
          <h2>A pessoa por trás da Máscara</h2>
          <div className="form-grid">
            {field("appearance", "Aparência", "textarea")}
            {field("distinctive", "Traços distintivos", "textarea")}
            {field("history", "História pessoal", "textarea")}
            {field("notes", "Anotações", "textarea")}
            {gm &&
              field(
                "privateNotes",
                "Anotações privadas do Narrador",
                "textarea",
              )}
          </div>
          <h3>Convicções e Pilares</h3>
          {c.convictions.map((v, i) => (
            <div className="requirement" key={i}>
              <Field
                disabled={!edit}
                label="Convicção"
                value={v.conviction}
                onChange={(x) =>
                  put(
                    "convictions",
                    c.convictions.map((a, j) =>
                      i === j ? { ...a, conviction: x } : a,
                    ),
                  )
                }
              />
              <Field
                disabled={!edit}
                label="Pilar associado"
                value={v.pillar}
                onChange={(x) =>
                  put(
                    "convictions",
                    c.convictions.map((a, j) =>
                      i === j ? { ...a, pillar: x } : a,
                    ),
                  )
                }
              />
              {edit && (
                <button
                  className="icon-button"
                  title="Remover Convicção"
                  onClick={() =>
                    put(
                      "convictions",
                      c.convictions.filter((_, j) => i !== j),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {edit && (
            <button
              className="secondary"
              onClick={() =>
                put("convictions", [
                  ...c.convictions,
                  { conviction: "", pillar: "" },
                ])
              }
            >
              Adicionar Convicção e Pilar
            </button>
          )}
          <h3>Condições</h3>
          {c.conditions.includes(UNCONSCIOUS_ENVELOP) && (
            <p className="callout">
              Envolver causou inconsciência. O fim da névoa não presume
              recuperação; o Narrador remove esta condição após resolver o
              despertar.
            </p>
          )}
          <div className="row">
            {c.conditions.map((name, i) => (
              <span className="pill" key={i}>
                {name}
                {edit &&
                  (name !== UNCONSCIOUS_ENVELOP || gm) &&
                  ![
                    ENVELOP_CONDITION,
                    ENVELOP_READY,
                    SUFFOCATING,
                    FLIGHT_READY,
                    AIRBORNE,
                    FLIGHT_PASSENGER,
                  ].includes(name) && (
                    <button
                      title="Remover condição"
                      onClick={() =>
                        put(
                          "conditions",
                          c.conditions.filter((_, j) => i !== j),
                        )
                      }
                    >
                      ×
                    </button>
                  )}
              </span>
            ))}
          </div>
          {edit && (
            <div className="row">
              <Field
                label="Nova condição narrativa"
                value={newCondition}
                onChange={setNewCondition}
              />
              <button
                className="secondary"
                disabled={!newCondition.trim()}
                onClick={() => {
                  put("conditions", [...c.conditions, newCondition.trim()]);
                  setNewCondition("");
                }}
              >
                Registrar
              </button>
            </div>
          )}
          <h3>Efeitos ativos</h3>
          {c.activeEffects.map((x) => (
            <p className="rule-line" key={x.id}>
              {x.label} · {effectLabels[x.effect.kind]} · {x.remaining}{" "}
              {durationLabels[x.effect.duration]}
            </p>
          ))}
        </section>
      )}
      {tab === "revisão" && (
        <section className="panel">
          <h2>Revisão da criação</h2>
          <p className="hint">
            {c.nature === "mortal"
              ? "Mortais: Companion PDF 41–47. Humanidade inicial 7; sete pontos de Vantagens e dois de Defeitos, sem concessões de Predador."
              : isThinBlood(c)
                ? "Sangues-Ralos: Básico PDF 128,159–160. Características sem custo são equilibradas separadamente; Afinidade e Alquimia concedem seus pontos e escolhas ao concluir."
                : "Básico PDF 130–131 e Companion PDF 66. Pontos e concessões do Predador são aplicados ao concluir; escolhas adicionais e exceções exigem revisão."}
          </p>
          {problems.length ? (
            <ul className="validation-list">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="success-message">
              A ficha atende às validações implementadas.
            </p>
          )}
          {gm && problems.length > 0 && (
            <Field
              label="Exceção autorizada pelo Narrador (justificativa mínima de 10 caracteres)"
              value={exception}
              type="textarea"
              onChange={setException}
            />
          )}
          <button
            className="primary"
            disabled={
              !edit ||
              (problems.length > 0 && !(gm && exception.trim().length >= 10))
            }
            onClick={async () => {
              try {
                await save.flush();
                await send("/characters/" + c.id + "/finalize", { exception });
                await refresh();
                setTab("identidade");
                notify(
                  c.nature === "mortal"
                    ? "Ficha mortal concluída."
                    : isThinBlood(c)
                      ? "Ficha de Sangue-Ralo concluída. Confira as concessões de Afinidade e Alquimia."
                      : "Ficha concluída. Confira o novo Poder concedido pelo Predador.",
                );
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            Concluir criação
          </button>
        </section>
      )}
      {tab === "inventário" && (
        <section className="panel">
          <h2>Inventário</h2>
          <p className="hint">
            Aquisição por Recursos e narrativa. Nenhuma moeda universal é
            imposta à campanha.
          </p>
          <div className="row">
            <Field
              label="Equipamento"
              value={itemId}
              onChange={setItemId}
              options={catalog
                .filter((x) => x.kind === "equipment")
                .map((x) => ({ value: x.id, label: x.name }))}
            />
            <Field
              label="Quantidade"
              type="number"
              value={amount}
              onChange={setAmount}
            />
            <button
              className="secondary"
              disabled={!edit || !itemId}
              onClick={() => {
                put("inventory", [
                  ...c.inventory,
                  {
                    id: crypto.randomUUID(),
                    contentId: itemId,
                    quantity: amount,
                    equipped: false,
                    notes: "",
                  },
                ]);
                setItemId("");
              }}
            >
              Adicionar
            </button>
            <button className="text-button" onClick={() => go("equipment")}>
              Catálogo / criar item
            </button>
          </div>
          {c.inventory.map((item, i) => {
            const entry = catalog.find((x) => x.id === item.contentId);
            return (
              <div className="inventory-row" key={item.id}>
                <div>
                  <strong>{entry?.name}</strong>
                  <p>{entry?.properties || entry?.description}</p>
                  <small>
                    {entry?.cost} · {item.quantity} unidades
                  </small>
                </div>
                <CheckBox
                  label="Equipado"
                  checked={item.equipped}
                  onChange={(v) =>
                    void run({
                      action: "equip",
                      itemId: item.id,
                      equipped: v,
                    }).catch(() => {})
                  }
                />
                <button
                  className="secondary"
                  disabled={!edit}
                  onClick={() => {
                    setAction("transfer:" + item.id);
                    setAmount(1);
                  }}
                >
                  Transferir
                </button>
                {edit && (
                  <button
                    className="icon-button"
                    title="Remover item"
                    onClick={() =>
                      put(
                        "inventory",
                        c.inventory.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}
      {tab === "progressão" && (
        <Progression c={c} catalog={catalog} gm={gm} run={run} />
      )}
      {tab === "registro" && (
        <section className="panel">
          <h2>Histórico da ficha</h2>
          {history.map((h, i) => (
            <div className="timeline-item" key={i}>
              <span>{new Date(h.date).toLocaleString("pt-BR")}</span>
              <strong>{actionLabels[h.action] || h.action}</strong>
              {h.detail?.reason && <p>{h.detail.reason}</p>}
              {h.detail?.result?.cost && (
                <small>{h.detail.result.cost} XP gastos</small>
              )}
            </div>
          ))}
          <h2>Rolagens anteriores</h2>
          {rolls.map((r) => (
            <div className="roll-history" key={r.id}>
              <strong>{r.label}</strong>
              <small>{new Date(r.date).toLocaleString("pt-BR")}</small>
              <DiceView result={r.result || r.distillation} />
              {r.formulaTest && <FormulaDice t={r.formulaTest} />}
              {r.review?.original && (
                <small>
                  Antes da rerrolagem: dados normais{" "}
                  {r.review.original.normal.join(", ")}; Dados de Fome{" "}
                  {r.review.original.hunger.join(", ") || "nenhum"}.
                </small>
              )}
              {r.willpowerSpent > 0 && (
                <small>Força de Vontade gasta: {r.willpowerSpent}.</small>
              )}
              {r.quality && <p>{r.quality}</p>}
              {r.message && <p>{r.message}</p>}
              {r.rouses?.map((cost: any, i: number) => (
                <small key={i}>
                  Despertar {i + 1}: {cost.dice.join(", ")} ·{" "}
                  {cost.success ? "Fome mantida" : "Fome +1"}
                </small>
              ))}
            </div>
          ))}
        </section>
      )}
      {gm && tab === "identidade" && (
        <details className="panel">
          <summary>Ajustes manuais autorizados pelo Narrador</summary>
          <p className="hint">
            Alterações são registradas. Use os controles de mecânica durante a
            sessão; estes ajustes permitem corrigir a ficha.
          </p>
          <div className="form-grid">
            {field("hunger", "Fome", "number")}
            {field("humanity", "Humanidade", "number")}
            {field("stains", "Máculas", "number")}
            {field("xpTotal", "Experiência total", "number")}
            {field("xpSpent", "Experiência gasta", "number")}
            {["health", "willpower"].flatMap((track) =>
              ["superficial", "aggravated"].map((kind) => (
                <Field
                  key={track + kind}
                  label={
                    (track === "health" ? "Vitalidade" : "Força de Vontade") +
                    " · " +
                    (kind === "superficial" ? "Superficial" : "Agravado")
                  }
                  type="number"
                  value={(c as any)[track][kind]}
                  onChange={(v) =>
                    put(track, { ...(c as any)[track], [kind]: v })
                  }
                />
              )),
            )}
          </div>
        </details>
      )}
      {rollSkill && (
        <RollDialog
          c={c}
          characters={state.characters}
          catalog={catalog}
          ruleset={ruleset}
          initialSkill={rollSkill}
          onClose={() => {
            setRollSkill(null);
            void refresh();
          }}
          onRoll={async (data) => {
            await save.flush();
            const result = await send("/characters/" + c.id + "/roll", data);
            await refresh();
            return result;
          }}
        />
      )}
      {action && (
        <ActionDialog
          action={action}
          c={c}
          catalog={catalog}
          characters={state.characters}
          gm={gm}
          run={(data) => run(data, false)}
          onClose={() => {
            setAction(null);
            setResult(null);
          }}
        />
      )}
      {result && !action && (
        <Modal title="Resultado registrado" onClose={() => setResult(null)}>
          {result.label ? (
            <DiceView result={result} />
          ) : (
            <>
              <p>
                {result.dice
                  ? "Dado(s): " + result.dice.join(", ")
                  : result.before !== undefined
                    ? "Fome: " + result.before + " → " + result.after
                    : "A ficha foi atualizada."}
              </p>
              {result.success !== undefined && (
                <p>
                  {result.success
                    ? "Despertar bem-sucedido; Fome mantida."
                    : "Falha no Despertar; Fome aumentada."}
                </p>
              )}
              {result.message && <p className="warning">{result.message}</p>}
              {result.torpor && (
                <p className="warning">O personagem entrou em Torpor.</p>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function ActionDialog({
  action,
  c,
  catalog,
  characters,
  gm,
  run,
  onClose,
}: {
  action: string;
  c: Character;
  catalog: Content[];
  characters: Character[];
  gm: boolean;
  run: (d: any) => Promise<any>;
  onClose: () => void;
}) {
  const [data, setData] = useState({
      action: action.split(":")[0],
      amount: 1,
      track: "health",
      aggravated: false,
      reason: "",
      source: "human",
      killed: false,
      processed: false,
      direct: true,
      bondHandling: "automatic",
      bondId: action.startsWith("bond") ? (action.split(":")[1] ?? "") : "",
      present: false,
      avoided: false,
      reminder: false,
      moonPhase: "full",
      tags: "",
      forced: false,
      waking: false,
      scope: "scene",
      targetId: "",
      powerId: action.startsWith("power:") ? action.slice(6) : "",
      itemId: action.startsWith("transfer:") ? action.slice(9) : "",
      duration: 1,
      rouseCount: 0,
      difficulty:
        catalog.find(
          (x) => x.id === (action.startsWith("power:") ? action.slice(6) : ""),
        )?.difficulty || 2,
      narrativeConfirmed: false,
      dependencyConfirmed: false,
      note: "",
    }),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));
  const p = catalog.find((x) => x.id === data.powerId);
  const names: Record<string, string> = {
    damage: "Registrar dano",
    rouse: "Despertar do Sangue",
    feed: "Registrar alimentação",
    stains: "Registrar Máculas",
    expire: "Encerrar duração",
    power: p?.name || "Utilizar Poder",
    transfer: "Transferir equipamento",
    mendAggravated: "Recuperar dano agravado",
    bondDrink: "Registrar gole de vitae",
    bondDefy: "Desafiar o Laço",
    bondAvoid: "Afastamento do reinante",
    bondDecay: "Aplicar decadência do Laço",
  };
  return (
    <Modal title={names[data.action] || data.action} onClose={onClose}>
      <div className="form-grid">
        {["damage", "feed", "stains", "transfer"].includes(data.action) && (
          <Field
            label={
              data.action === "feed"
                ? data.source === "vampire"
                  ? "Fome aumentada no doador"
                  : "Fome saciada pela fonte, antes das penalidades"
                : "Quantidade"
            }
            type="number"
            value={data.amount}
            onChange={(v) => set("amount", v)}
          />
        )}
        {data.action === "damage" && (
          <>
            <Field
              label="Trilha"
              value={data.track}
              options={[
                { value: "health", label: "Vitalidade" },
                { value: "willpower", label: "Força de Vontade" },
              ]}
              onChange={(v) => set("track", v)}
            />
            <CheckBox
              label="Dano agravado"
              checked={data.aggravated}
              onChange={(v) => set("aggravated", v)}
            />
            <p className="hint">
              Dano superficial é dividido por dois e arredondado para cima. Após
              preencher a trilha, novos danos convertem superficial em agravado.
            </p>
          </>
        )}
        {data.action === "rouse" && (
          <>
            <CheckBox
              label="Despertar noturno (falha em Fome 5 causa Torpor)"
              checked={data.waking}
              onChange={(v) => set("waking", v)}
            />
            <CheckBox
              label="Despertar forçado por fator externo"
              checked={data.forced}
              onChange={(v) => set("forced", v)}
            />
          </>
        )}
        {data.action === "feed" && (
          <>
            <Field
              label="Fonte"
              value={data.source}
              options={[
                { value: "human", label: "Humano" },
                { value: "animal", label: "Animal" },
                { value: "bag", label: "Bolsa de sangue" },
                ...(gm ? [{ value: "vampire", label: "Outro vampiro" }] : []),
              ]}
              onChange={(v) => {
                set("source", v);
                set("killed", false);
                set("processed", false);
              }}
            />
            {data.source === "vampire" && (
              <>
                <Field
                  label="Vampiro doador"
                  value={data.targetId}
                  options={characters
                    .filter((x) => x.id !== c.id)
                    .map((x) => ({
                      value: x.id,
                      label: x.name + " · Fome " + x.hunger,
                    }))}
                  onChange={(v) => set("targetId", v)}
                />
                <CheckBox
                  label="Sangue bebido diretamente da veia (risco de Laço)"
                  checked={data.direct}
                  onChange={(v) => set("direct", v)}
                />
                {data.direct && (
                  <CheckBox
                    label="Resolver o Laço manualmente (exige justificativa)"
                    checked={data.bondHandling === "manual"}
                    onChange={(v) =>
                      set("bondHandling", v ? "manual" : "automatic")
                    }
                  />
                )}
              </>
            )}
            {data.source === "human" && (
              <CheckBox
                label="Humano drenado e morto"
                checked={data.killed}
                onChange={(v) => set("killed", v)}
              />
            )}
            {data.source === "bag" && (
              <CheckBox
                label="Sangue processado (exige Garganta de Ferro)"
                checked={data.processed}
                onChange={(v) => set("processed", v)}
              />
            )}
            <p className="hint">
              Registre restrições do Clã e Predador, danos à vítima e
              Ressonância conforme a fonte. Na alimentação entre vampiros, a
              Potência define a saciedade e o doador ganha Fome. O Narrador
              integra o Laço à data da crônica; exceções podem ser resolvidas
              manualmente, com justificativa.
            </p>
          </>
        )}
        {data.action === "bondDrink" && (
          <>
            <Field
              label="Vampiro doador"
              value={data.targetId}
              options={characters
                .filter((x) => x.id !== c.id && x.campaignId === c.campaignId)
                .map((x) => ({ value: x.id, label: x.name }))}
              onChange={(v) => set("targetId", v)}
            />
            <CheckBox
              label="O personagem tomou um gole diretamente da veia"
              checked={data.narrativeConfirmed}
              onChange={(v) => set("narrativeConfirmed", v)}
            />
            <p className="hint">
              Um gole fortalece o vínculo sem representar saciedade de Fome.
              Para transferir uma quantidade de sangue que sacie Fome, use
              Alimentar-se.
            </p>
          </>
        )}
        {["bondDefy", "bondAvoid", "bondDecay"].includes(data.action) && (
          <p className="hint wide">
            Determinação + Inteligência contra uma parada da Força do Laço.
            Dados de Fome participam do teste do servo. O Narrador resolve os
            desejos do reinante e se o servo conseguiu permanecer afastado.
          </p>
        )}
        {data.action === "bondDefy" && (
          <CheckBox
            label="Na presença do reinante (teste por turno)"
            checked={data.present}
            onChange={(v) => set("present", v)}
          />
        )}
        {["bondDefy", "bondAvoid"].includes(data.action) && gm && (
          <>
            <CheckBox
              label="Lembrança exige novo desafio, autorizado pelo Narrador"
              checked={data.reminder}
              onChange={(v) => set("reminder", v)}
            />
            {data.reminder && (
              <Field
                label="Motivo do novo desafio"
                value={data.reason}
                onChange={(v) => set("reason", v)}
              />
            )}
          </>
        )}
        {data.action === "bondDecay" && (
          <>
            <CheckBox
              label="Confirmo o afastamento sem reforço e a resolução dos desafios exigidos por sessão"
              checked={data.avoided}
              onChange={(v) => set("avoided", v)}
            />
            <Field
              label="Registro do afastamento e dos desafios"
              type="textarea"
              value={data.reason}
              onChange={(v) => set("reason", v)}
            />
            <Field
              label="Lua confirmada (apenas para Laço Curto)"
              value={data.moonPhase}
              options={[
                { value: "full", label: "Lua cheia" },
                { value: "new", label: "Lua nova" },
              ]}
              onChange={(v) => set("moonPhase", v)}
            />
            <p className="hint">
              Nenhuma mudança de lua é deduzida de dias corridos. Para Laço
              normal ou Longo, a aplicação calcula os meses completos desde o
              último reforço.
            </p>
          </>
        )}
        {data.action === "mendAggravated" && (
          <p className="hint wide">
            Após o próximo cair da noite e o Despertar regular, realize três
            testes de Despertar adicionais para recuperar um ponto agravado. A
            recuperação é limitada a uma por noite; uma falha em Fome 5 causa
            Torpor.
          </p>
        )}
        {["stains", "damage", "feed"].includes(data.action) && (
          <Field
            label="Acontecimento / motivo"
            type="textarea"
            value={data.reason}
            onChange={(v) => set("reason", v)}
          />
        )}
        {data.action === "expire" && (
          <Field
            label="Duração encerrada"
            value={data.scope}
            options={[
              { value: "turn", label: "Turno" },
              { value: "scene", label: "Cena" },
              { value: "night", label: "Noite" },
            ]}
            onChange={(v) => set("scope", v)}
          />
        )}
        {["transfer", "power"].includes(data.action) && (
          <Field
            label="Alvo / destinatário"
            value={data.targetId}
            options={characters
              .filter((x) => x.id !== c.id)
              .map((x) => ({ value: x.id, label: x.name }))}
            onChange={(v) => set("targetId", v)}
          />
        )}
        {data.action === "power" && (
          <>
            <p className="hint wide">
              {p?.description} {p?.restrictions} {p?.notes}
            </p>
            <Badge origin={p?.automation || "narrative"} />
            {hasTrait(c, "flaw-dependencia-de-vitae") && (
              <>
                <CheckBox
                  label="Narrador confirmou saciedade vampírica na última semana"
                  checked={data.dependencyConfirmed}
                  disabled={!gm}
                  onChange={(v) => set("dependencyConfirmed", v)}
                />
                <p className="warning">
                  Registre a saciedade na Resolução narrativa. O controle
                  semanal e os poderes passivos ainda exigem resolução do
                  Narrador; esta confirmação fica no histórico.
                </p>
              </>
            )}
            <Field
              label="Etiquetas das circunstâncias (separadas por vírgulas)"
              value={data.tags}
              onChange={(v) => set("tags", v)}
              placeholder="alvoMortal, resistirCoercao…"
            />
            <Field
              label="Duração em unidades cadastradas"
              value={data.duration}
              type="number"
              onChange={(v) => set("duration", v)}
            />
            {p?.attribute && (
              <Field
                label="Dificuldade aplicável"
                value={data.difficulty}
                type="number"
                onChange={(v) => set("difficulty", v)}
              />
            )}
            <Field
              label="Resolução narrativa / alvo / circunstâncias"
              value={data.note}
              type="textarea"
              onChange={(v) => set("note", v)}
            />
            {p?.automation === "unreviewed" && (
              <>
                <Field
                  label="Despertar confirmado na fonte"
                  value={data.rouseCount}
                  type="number"
                  onChange={(v) => set("rouseCount", v)}
                />
                <CheckBox
                  label="O Narrador consultou a fonte e autoriza esta resolução manual"
                  checked={data.narrativeConfirmed}
                  onChange={(v) => set("narrativeConfirmed", v)}
                />
              </>
            )}
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          try {
            setBusy(true);
            setError("");
            const r = await run({
              ...data,
              tags: data.tags
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              ...(p?.automation === "unreviewed"
                ? {}
                : { rouseCount: undefined }),
            });
            setResult(r.result);
            if (
              ![
                "rouse",
                "power",
                "feed",
                "mendAggravated",
                "bondDrink",
                "bondDefy",
                "bondAvoid",
                "bondDecay",
              ].includes(data.action)
            )
              onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Registrando…" : "Confirmar e registrar"}
      </button>
      {result && (
        <>
          {data.action === "power" && (
            <p className="success-message">Uso do Poder registrado.</p>
          )}
          <DiceView result={result.result} />
          {result.opposition && (
            <>
              <p>Oposição: Força do Laço</p>
              <DiceView result={result.opposition} />
            </>
          )}
          {result.dice && (
            <p>
              Dados: {result.dice.join(", ")} · Fome {result.hunger}
            </p>
          )}
          {result.before !== undefined && (
            <p>
              Fome: {result.before} → {result.after}
            </p>
          )}
          {result.donorHunger !== undefined && (
            <p>
              Fome do doador: {result.donorHunger} · Saciedade: {result.ratio}
            </p>
          )}
          {result.rouses?.map((r: any, i: number) => (
            <p key={i}>
              Despertar {i + 1}: {r.dice.join(", ")} ·{" "}
              {r.success ? "Fome mantida" : "Fome +1"}
            </p>
          ))}
          {result.torpor && <p className="warning">Torpor</p>}
          {result.message && <p className="warning">{result.message}</p>}
        </>
      )}
    </Modal>
  );
}
function Progression({
  c,
  catalog,
  gm,
  run,
}: {
  c: Character;
  catalog: Content[];
  gm: boolean;
  run: (d: any) => Promise<any>;
}) {
  const [data, setData] = useState({
      kind: "attribute",
      key: "forca",
      specialty: "",
      powerId: "",
      resonance: false,
      mentor: false,
      researchConfirmed: false,
      alchemyMethod: "",
      dependencyConfirmed: false,
      note: "",
    }),
    [xp, setXp] = useState(1),
    [reason, setReason] = useState("");
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));
  const alchemy = data.kind === "discipline" && data.key === ALCHEMY;
  const formula =
    data.kind === "formula" &&
    catalog.find((x) => x.id === data.key)?.parentId === ALCHEMY;
  let cost: any;
  try {
    cost = xpCost(c, catalog, data.kind, data.key);
  } catch (e: any) {
    cost = e.message;
  }
  const options =
    data.kind === "attribute"
      ? attributes.map((value) => ({ value, label: labels[value] }))
      : ["skill", "specialty"].includes(data.kind)
        ? skills.map((value) => ({ value, label: labels[value] }))
        : catalog
            .filter((x) =>
              data.kind === "advantage"
                ? ["merit", "background"].includes(x.kind)
                : x.kind === data.kind &&
                  (data.kind !== "discipline" ||
                    !isThinBlood(c) ||
                    x.id === ALCHEMY ||
                    (hasTrait(c, "merit-afinidade-de-disciplina") &&
                      x.id === c.thinBlood.affinityDiscipline)),
            )
            .map((x) => ({ value: x.id, label: x.name }));
  return (
    <section className="panel">
      <h2>Experiência e progressão</h2>
      <div className="stats-row">
        <div>
          <small>Recebida</small>
          <strong>{c.xpTotal}</strong>
        </div>
        <div>
          <small>Utilizada</small>
          <strong>{c.xpSpent}</strong>
        </div>
        <div>
          <small>Disponível</small>
          <strong>{c.xpTotal - c.xpSpent}</strong>
        </div>
      </div>
      {gm && (
        <div className="row">
          <Field
            label="Conceder XP"
            type="number"
            value={xp}
            onChange={setXp}
          />
          <Field label="Justificativa" value={reason} onChange={setReason} />
          <button
            className="secondary"
            onClick={() =>
              void run({ action: "xp", amount: xp, reason }).catch(() => {})
            }
          >
            Conceder experiência
          </button>
        </div>
      )}
      <div className="form-grid">
        <Field
          label="Evolução"
          value={data.kind}
          onChange={(v) => setData({ ...data, kind: v, key: "", powerId: "" })}
          options={[
            ["attribute", "Atributo"],
            ["skill", "Perícia"],
            ["specialty", "Especialização"],
            ["discipline", "Disciplina"],
            ["potency", "Potência do Sangue"],
            ["advantage", "Vantagem"],
            ["ritual", "Ritual"],
            ["formula", "Fórmula"],
          ].map(([value, label]) => ({ value, label }))}
        />
        {data.kind !== "potency" && (
          <Field
            label="Característica"
            value={data.key}
            options={options}
            onChange={(v) => set("key", v)}
          />
        )}{" "}
        {data.kind === "specialty" && (
          <Field
            label="Nova especialização"
            value={data.specialty}
            onChange={(v) => set("specialty", v)}
          />
        )}
        {data.kind === "discipline" && (
          <>
            <Field
              label={
                alchemy
                  ? "Fórmula recebida com o novo nível"
                  : "Poder adquirido no novo nível"
              }
              value={data.powerId}
              options={catalog
                .filter(
                  (x) =>
                    x.kind === (alchemy ? "formula" : "power") &&
                    x.parentId === data.key &&
                    x.level <= (c.disciplines[data.key] ?? 0) + 1 &&
                    !c.powers.includes(x.id),
                )
                .map((x) => ({ value: x.id, label: x.name + " · " + x.level }))}
              onChange={(v) => set("powerId", v)}
            />
            {!alchemy && (
              <CheckBox
                label="Ressonância adequada obtida em jogo"
                checked={data.resonance}
                onChange={(v) => set("resonance", v)}
              />
            )}
            {!alchemy && (
              <CheckBox
                label="Provou o Sangue de alguém com a Disciplina, se exigido"
                checked={data.mentor}
                onChange={(v) => set("mentor", v)}
              />
            )}
            {alchemy && (
              <Field
                label="Método de Alquimia aprendido"
                value={c.thinBlood.alchemyMethod || data.alchemyMethod}
                disabled={!!c.thinBlood.alchemyMethod}
                options={alchemyMethods}
                onChange={(v) => set("alchemyMethod", v)}
              />
            )}
          </>
        )}
        {(alchemy || formula) && (
          <CheckBox
            label="Pesquisa e experimentação concluídas"
            checked={data.researchConfirmed}
            onChange={(v) => set("researchConfirmed", v)}
          />
        )}
        {hasTrait(c, "flaw-dependencia-de-vitae") &&
          ["discipline", "formula"].includes(data.kind) && (
            <>
              <CheckBox
                label="Narrador confirmou saciedade vampírica na última semana"
                checked={data.dependencyConfirmed}
                disabled={!gm}
                onChange={(v) => set("dependencyConfirmed", v)}
              />
              <Field
                label="Registro da confirmação de Vitae"
                type="textarea"
                value={data.note}
                disabled={!gm}
                onChange={(v) => set("note", v)}
              />
            </>
          )}
      </div>
      <p className="pool-preview">
        Custo: <strong>{typeof cost === "number" ? cost + " XP" : cost}</strong>
      </p>
      <button
        className="primary"
        disabled={typeof cost !== "number" || cost > c.xpTotal - c.xpSpent}
        onClick={() => void run({ action: "advance", ...data }).catch(() => {})}
      >
        Adquirir evolução
      </button>
      <p className="hint">
        Tabela: Básico PDF 131 e Companion PDF 66. Novos poderes, requisitos e
        experiência são validados no servidor.
      </p>
    </section>
  );
}
