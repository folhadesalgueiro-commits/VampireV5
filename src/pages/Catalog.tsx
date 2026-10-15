import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Search,
  ChevronRight,
  BookOpen,
  ImagePlus,
} from "lucide-react";
import {
  Content,
  contentSchema,
  kinds,
  kindLabels,
  attributes,
  skills,
  labels,
  effectSchema,
  Effect,
  requirementSchema,
  effectLabels as readableEffects,
} from "../../shared/model";
import { Field, Modal, Empty, Badge, CheckBox } from "../components/ui";
import { api, send, download, readJSON, imageFile } from "../api";
import { PageProps } from "../types";
const kindOptions = kinds.map((value) => ({ value, label: kindLabels[value] }));
const durations = [
  { value: "instant", label: "Instantânea" },
  { value: "turn", label: "Turnos" },
  { value: "scene", label: "Cenas" },
  { value: "night", label: "Noites" },
  { value: "permanent", label: "Permanente / passivo" },
];
export function ContentEditor({
  initial,
  catalog,
  onSave,
  onClose,
}: {
  initial: Partial<Content>;
  catalog: Content[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [data, setData] = useState(
      contentSchema.parse({ name: "Novo conteúdo", ...initial }),
    ),
    [tab, setTab] = useState("descrição"),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const put = (k: string, v: any) => setData((p) => ({ ...p, [k]: v }));
  const f = (
    k: string,
    label: string,
    type = "text",
    options?: { value: string; label: string }[],
  ) => (
    <Field
      key={k}
      label={label}
      value={(data as any)[k]}
      type={type}
      options={options}
      onChange={(v) => put(k, v)}
    />
  );
  const ds = catalog
    .filter((c) => c.kind === "discipline")
    .map((c) => ({ value: c.id, label: c.name }));
  const traits = [...attributes, ...skills].map((value) => ({
    value,
    label: labels[value],
  }));
  const allTraits = [...traits, ...ds];
  const effectLabels: Record<string, string> = {
    dice: "Dados da parada",
    attribute: "Atributo",
    health: "Máximo de Vitalidade",
    willpower: "Máximo de Força de Vontade",
    damage: "Causar dano",
    heal: "Recuperar dano",
    condition: "Impor condição",
    resource: "Alterar recurso",
    narrative: "Efeito narrativo",
  };
  const save = async () => {
    try {
      setSaving(true);
      const validated = contentSchema.safeParse(data);
      if (!validated.success)
        throw new Error(
          "Dados inválidos; revise os campos: " +
            validated.error.issues
              .map((x) => x.path.join(".") || "conteúdo")
              .join(", "),
        );
      await onSave(validated.data);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={
        initial.id
          ? "Editar " + kindLabels[data.kind]
          : "Criar " + kindLabels[data.kind]
      }
      wide
      onClose={onClose}
    >
      <nav className="tabs">
        {["descrição", "mecânica", "efeitos", "requisitos", "referências"].map(
          (t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </nav>
      {tab === "descrição" && (
        <div className="form-grid">
          {f("name", "Nome")}
          {f("kind", "Tipo", "text", kindOptions)}
          {f("origin", "Origem", "text", [
            { value: "custom", label: "Personalizado" },
            { value: "variant", label: "Variante de regra" },
            { value: "optional", label: "Opcional" },
          ])}
          {f("category", "Categoria")}
          {f("description", "Descrição", "textarea")}
          {f("history", "História", "textarea")}
          {f("characteristics", "Características", "textarea")}
          {["clan", "lineage", "predator"].includes(data.kind) && (
            <>
              <label className="field wide">
                <span>Disciplinas associadas</span>
                <div className="check-grid">
                  {ds.map((d) => (
                    <CheckBox
                      key={d.value}
                      label={d.label}
                      checked={data.disciplines.includes(d.value)}
                      onChange={(b) =>
                        put(
                          "disciplines",
                          b
                            ? [...data.disciplines, d.value]
                            : data.disciplines.filter((k) => k !== d.value),
                        )
                      }
                    />
                  ))}
                </div>
              </label>
              {f("bane", "Perdição / Maldição", "textarea")}
              {f("baneSeverity", "Gravidade da Perdição")}
              {f("compulsion", "Compulsão", "textarea")}
            </>
          )}
          {f("restrictions", "Restrições", "textarea")}
          {f("notes", "Informações complementares", "textarea")}
          <label className="field">
            <span>Símbolo ou imagem</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                if (e.target.files?.[0])
                  try {
                    put("image", await imageFile(e.target.files[0]));
                  } catch (err: any) {
                    setError(err.message);
                  }
              }}
            />
            {data.image && <img className="image-preview" src={data.image} />}
          </label>
        </div>
      )}
      {tab === "mecânica" && (
        <div className="form-grid">
          {f(
            "parentId",
            "Disciplina do Poder / variante",
            "text",
            ["power", "ritual", "ceremony", "formula"].includes(data.kind)
              ? ds
              : catalog.map((c) => ({ value: c.id, label: c.name })),
          )}
          {f("level", "Nível", "number")}
          {f("points", "Custo ou valor em pontos", "number")}
          {f("maxLevel", "Nível máximo", "number")}
          {f("minLevel", "Nível mínimo", "number")}
          {f("rouse", "Testes de Despertar", "number")}
          {f("willpowerCost", "Custo de Força de Vontade", "number")}
          {f("attribute", "Atributo do teste", "text", allTraits)}
          {f("skill", "Perícia ou Disciplina do teste", "text", allTraits)}
          {f(
            "difficulty",
            "Dificuldade (0 = definida pelo Narrador)",
            "number",
          )}
          {f(
            "resistanceAttribute",
            "Atributo de resistência",
            "text",
            allTraits,
          )}
          {f("resistanceSkill", "Perícia de resistência", "text", allTraits)}
          {f("duration", "Duração", "text", durations)}
          {f("range", "Alcance")}
          {["clan", "lineage", "merit", "flaw", "background"].includes(
            data.kind,
          ) && (
            <details className="wide">
              <summary>Regras configuráveis de Laço de Sangue</summary>
              <div className="form-grid">
                <CheckBox
                  label="Imune ao Laço"
                  checked={data.bondRule.immune}
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, immune: v })
                  }
                />
                <CheckBox
                  label="Forma o Laço no primeiro gole"
                  checked={data.bondRule.instant}
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, instant: v })
                  }
                />
                <Field
                  label="Criação de Laços com vampiros"
                  value={data.bondRule.binding}
                  options={[
                    {
                      value: "default",
                      label: "Características normais do Sangue",
                    },
                    { value: "allowed", label: "Permite criar Laços" },
                    { value: "blocked", label: "Impede criar Laços" },
                  ]}
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, binding: v })
                  }
                />
                <Field
                  label="Modificador para desafiar Laços"
                  value={data.bondRule.resistance}
                  type="number"
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, resistance: v })
                  }
                />
                <CheckBox
                  label="Multiplicar resistência pelos pontos adquiridos"
                  checked={data.bondRule.perLevel}
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, perLevel: v })
                  }
                />
                <Field
                  label="Decadência do Laço"
                  value={data.bondRule.decay}
                  options={[
                    { value: "default", label: "Sem alteração" },
                    { value: "normal", label: "Um ponto por mês" },
                    { value: "long", label: "Um ponto por três meses" },
                    { value: "short", label: "Um ponto na lua cheia e nova" },
                  ]}
                  onChange={(v) =>
                    put("bondRule", { ...data.bondRule, decay: v })
                  }
                />
              </div>
              <p className="hint">
                Estas operações são integradas à ficha sem executar código.
                Combinações com regras de decadência ou criação conflitantes
                exigem resolução do Narrador.
              </p>
            </details>
          )}

          {f("damage", "Bônus de dano de arma", "number")}
          {data.kind === "equipment" && (
            <>
              <Field
                label="Tipo de equipamento"
                value={data.equipmentType}
                options={[
                  { value: "item", label: "Objeto" },
                  { value: "weapon", label: "Arma" },
                  { value: "armor", label: "Armadura" },
                ]}
                onChange={(v) => put("equipmentType", v)}
              />
              <Field
                label="Fonte de dano da arma"
                value={data.damageSource}
                options={[
                  { value: "manual", label: "Definida pelo Narrador" },
                  { value: "blunt", label: "Contundente leve" },
                  { value: "heavyBlunt", label: "Contundente pesado" },
                  { value: "piercing", label: "Corte / perfuração" },
                  { value: "gunshot", label: "Projétil de arma de fogo" },
                  { value: "fire", label: "Fogo" },
                  { value: "supernatural", label: "Agravado sobrenatural" },
                ]}
                onChange={(v) => put("damageSource", v)}
              />
              {f("armor", "Valor de blindagem", "number")}
              {f(
                "dexterityPenalty",
                "Penalidade de dados de Destreza ao equipar",
                "number",
              )}
              <CheckBox
                label="Armadura protege contra projéteis"
                checked={data.armorAgainstBullets}
                onChange={(v) => put("armorAgainstBullets", v)}
              />
            </>
          )}
          {f("cost", "Custo / obtenção por Recursos")}
          {f("properties", "Propriedades e estatísticas", "textarea")}
          {f("automation", "Resolução", "text", [
            {
              value: "complete",
              label: "Automatizada pelos efeitos cadastrados",
            },
            { value: "partial", label: "Automação parcial e interpretação" },
            { value: "narrative", label: "Resolução narrativa" },
          ])}
          {data.kind === "predator" && (
            <>
              {f("humanityChange", "Alteração inicial de Humanidade", "number")}
              {f("potencyChange", "Alteração inicial de Potência", "number")}
              <div className="wide">
                <h3>Especializações permitidas do Predador</h3>
                {data.specialties.map((s, i) => (
                  <div className="requirement" key={i}>
                    <Field
                      label="Perícia da especialização"
                      value={s.skill}
                      options={skills.map((value) => ({
                        value,
                        label: labels[value],
                      }))}
                      onChange={(v) =>
                        put(
                          "specialties",
                          data.specialties.map((x, j) =>
                            j === i ? { ...x, skill: v } : x,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Nome da especialização"
                      value={s.name}
                      onChange={(v) =>
                        put(
                          "specialties",
                          data.specialties.map((x, j) =>
                            j === i ? { ...x, name: v } : x,
                          ),
                        )
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label="Remover especialização do Predador"
                      onClick={() =>
                        put(
                          "specialties",
                          data.specialties.filter((_, j) => i !== j),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="secondary"
                  onClick={() =>
                    put("specialties", [
                      ...data.specialties,
                      { skill: "briga", name: "Nova especialização" },
                    ])
                  }
                >
                  Adicionar especialização do Predador
                </button>
                <h3>Vantagens e Defeitos concedidos</h3>
                {data.grants.map((g, i) => (
                  <div className="requirement" key={i}>
                    <Field
                      label="Conteúdo concedido"
                      value={g.contentId}
                      options={catalog
                        .filter((x) =>
                          ["merit", "flaw", "background"].includes(x.kind),
                        )
                        .map((x) => ({ value: x.id, label: x.name }))}
                      onChange={(v) =>
                        put(
                          "grants",
                          data.grants.map((x, j) =>
                            j === i ? { ...x, contentId: v } : x,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Pontos concedidos"
                      value={g.level}
                      type="number"
                      onChange={(v) =>
                        put(
                          "grants",
                          data.grants.map((x, j) =>
                            j === i ? { ...x, level: v } : x,
                          ),
                        )
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label="Remover concessão"
                      onClick={() =>
                        put(
                          "grants",
                          data.grants.filter((_, j) => i !== j),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="secondary"
                  onClick={() =>
                    put("grants", [
                      ...data.grants,
                      { contentId: "a-definir", level: 1 },
                    ])
                  }
                >
                  Adicionar concessão
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {tab === "efeitos" && (
        <div>
          <p className="hint">
            Cada efeito é validado pelo motor de regras. Modificadores são
            somados conforme seu alvo e condição. Custos nunca executam código.
            Efeitos narrativos são registrados para resolução do Narrador.
          </p>
          {data.effects.map((e, i) => (
            <section className="effect-card" key={i}>
              <header>
                <h3>Efeito {i + 1}</h3>
                <button
                  className="icon-button"
                  title="Remover efeito"
                  onClick={() =>
                    put(
                      "effects",
                      data.effects.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </header>
              <EffectForm
                effect={e}
                onChange={(next) =>
                  put(
                    "effects",
                    data.effects.map((x, j) => (j === i ? next : x)),
                  )
                }
                traits={allTraits}
              />
            </section>
          ))}
          <button
            className="secondary"
            onClick={() =>
              put("effects", [
                ...data.effects,
                effectSchema.parse({
                  kind: "narrative",
                  duration: [
                    "clan",
                    "lineage",
                    "merit",
                    "flaw",
                    "background",
                    "condition",
                  ].includes(data.kind)
                    ? "permanent"
                    : "scene",
                }),
              ])
            }
          >
            <Plus size={16} />
            Adicionar efeito
          </button>
        </div>
      )}
      {tab === "requisitos" && (
        <>
          <p className="hint">
            Pré-requisitos são verificáveis para compra e ativação. Restrições
            narrativas permanecem descritas no conteúdo.
          </p>
          {data.requirements.map((r, i) => (
            <div className="requirement" key={i}>
              <Field
                label="Tipo"
                value={r.kind}
                options={[
                  { value: "discipline", label: "Disciplina" },
                  { value: "attribute", label: "Atributo" },
                  { value: "skill", label: "Perícia" },
                  { value: "power", label: "Poder" },
                  { value: "clan", label: "Clã" },
                  { value: "content", label: "Vantagem / conteúdo" },
                ]}
                onChange={(v) =>
                  put(
                    "requirements",
                    data.requirements.map((x, j) =>
                      j === i ? { ...x, kind: v, target: "" } : x,
                    ),
                  )
                }
              />
              <Field
                label="Requisito"
                value={r.target}
                options={
                  r.kind === "attribute"
                    ? attributes.map((value) => ({
                        value,
                        label: labels[value],
                      }))
                    : r.kind === "skill"
                      ? skills.map((value) => ({ value, label: labels[value] }))
                      : catalog
                          .filter(
                            (c) => r.kind === "content" || c.kind === r.kind,
                          )
                          .map((c) => ({ value: c.id, label: c.name }))
                }
                onChange={(v) =>
                  put(
                    "requirements",
                    data.requirements.map((x, j) =>
                      j === i ? { ...x, target: v } : x,
                    ),
                  )
                }
              />
              <Field
                label="Nível mínimo"
                type="number"
                value={r.level}
                onChange={(v) =>
                  put(
                    "requirements",
                    data.requirements.map((x, j) =>
                      j === i ? { ...x, level: v } : x,
                    ),
                  )
                }
              />
              <button
                className="icon-button"
                title="Remover requisito"
                onClick={() =>
                  put(
                    "requirements",
                    data.requirements.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="secondary"
            onClick={() =>
              put("requirements", [
                ...data.requirements,
                requirementSchema.parse({
                  kind: "discipline",
                  target: "a-definir",
                }),
              ])
            }
          >
            Adicionar requisito
          </button>
          <label className="field">
            <span>Conteúdos incompatíveis</span>
            <select
              multiple
              value={data.incompatible}
              onChange={(e) =>
                put(
                  "incompatible",
                  [...e.target.selectedOptions].map((x) => x.value),
                )
              }
            >
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {tab === "referências" && (
        <>
          <p className="hint">
            Use a página do PDF fornecido. Uma referência não transforma
            material caseiro em regra oficial.
          </p>
          {data.references.map((r, i) => (
            <div className="requirement" key={i}>
              <Field
                label="Documento"
                value={r.document}
                options={[
                  "basico",
                  "companion",
                  "ficha",
                  "westhaven-75",
                  "westhaven-150",
                  "westhaven-200",
                  "westhaven-250",
                ].map((value) => ({ value, label: value }))}
                onChange={(v) =>
                  put(
                    "references",
                    data.references.map((x, j) =>
                      j === i ? { ...x, document: v } : x,
                    ),
                  )
                }
              />
              <Field
                label="Página do PDF"
                type="number"
                value={r.page}
                onChange={(v) =>
                  put(
                    "references",
                    data.references.map((x, j) =>
                      j === i ? { ...x, page: v } : x,
                    ),
                  )
                }
              />
              <Field
                label="Observação"
                value={r.note}
                onChange={(v) =>
                  put(
                    "references",
                    data.references.map((x, j) =>
                      j === i ? { ...x, note: v } : x,
                    ),
                  )
                }
              />
              <button
                className="icon-button"
                aria-label="Remover referência"
                onClick={() =>
                  put(
                    "references",
                    data.references.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="secondary"
            onClick={() =>
              put("references", [
                ...data.references,
                { document: "basico", page: 1, note: "" },
              ])
            }
          >
            Adicionar referência
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-actions">
        <button className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="primary" disabled={saving} onClick={save}>
          {saving ? "Salvando…" : "Salvar conteúdo"}
        </button>
      </footer>
    </Modal>
  );
}
function EffectForm({
  effect: e,
  onChange,
  traits,
}: {
  effect: Effect;
  onChange: (e: Effect) => void;
  traits: { value: string; label: string }[];
}) {
  const set = (key: string, value: any) => onChange({ ...e, [key]: value });
  const cond = (key: string, value: any) =>
    onChange({ ...e, when: { ...e.when, [key]: value } });
  const names: Record<string, string> = {
    dice: "Adicionar / remover dados",
    attribute: "Modificar Atributo",
    health: "Máximo de Vitalidade",
    willpower: "Máximo de Força de Vontade",
    damage: "Causar dano",
    heal: "Recuperar dano",
    condition: "Impor condição",
    resource: "Alterar recurso",
    narrative: "Efeito narrativo",
  };
  return (
    <div className="form-grid">
      <Field
        label="Operação"
        value={e.kind}
        options={Object.entries(names).map(([value, label]) => ({
          value,
          label,
        }))}
        onChange={(v) => set("kind", v)}
      />
      <Field
        label="Aplica-se a"
        value={e.recipient}
        options={[
          { value: "self", label: "Usuário" },
          { value: "target", label: "Alvo selecionado" },
        ]}
        onChange={(v) => set("recipient", v)}
      />
      <Field
        label="Alvo mecânico / etiqueta / condição"
        value={e.target}
        onChange={(v) => set("target", v)}
        placeholder="Ex.: briga, forca, health, fome"
      />
      {["attribute", "dice", "resource", "damage", "heal"].includes(e.kind) && (
        <Field
          label="Alvo predefinido"
          value={e.target}
          onChange={(v) => set("target", v)}
          options={
            e.kind === "resource"
              ? [
                  { value: "hunger", label: "Fome" },
                  { value: "humanity", label: "Humanidade" },
                  { value: "stains", label: "Máculas" },
                ]
              : ["damage", "heal"].includes(e.kind)
                ? [
                    { value: "health", label: "Vitalidade" },
                    { value: "willpower", label: "Força de Vontade" },
                  ]
                : [{ value: "all", label: "Todas as paradas" }, ...traits]
          }
        />
      )}
      <Field
        label="Quantidade (negativo = penalidade)"
        type="number"
        value={e.value}
        onChange={(v) => set("value", v)}
      />
      <Field
        label="Escala"
        value={e.scale}
        options={[
          { value: "fixed", label: "Valor fixo" },
          {
            value: "discipline",
            label: "Multiplicar pelo nível da Disciplina / Vantagem",
          },
          { value: "margin", label: "Multiplicar pela margem do teste" },
        ]}
        onChange={(v) => set("scale", v)}
      />
      <Field
        label="Duração"
        value={e.duration}
        options={durations}
        onChange={(v) => set("duration", v)}
      />
      <CheckBox
        label="Dano / cura agravado"
        checked={e.aggravated}
        onChange={(v) => set("aggravated", v)}
      />
      <Field
        label="Condição de ativação"
        value={e.when.field}
        options={[
          ["always", "Sempre"],
          ["tag", "Etiqueta do teste"],
          ["hunger", "Fome"],
          ["humanity", "Humanidade"],
          ["bloodPotency", "Potência"],
          ["condition", "Condição do personagem"],
          ["clan", "Clã"],
          ["skill", "Perícia"],
        ].map(([value, label]) => ({ value, label }))}
        onChange={(v) => cond("field", v)}
      />
      <Field
        label="Comparação"
        value={e.when.operator}
        options={[
          { value: "eq", label: "Igual a" },
          { value: "gte", label: "Maior ou igual" },
          { value: "lte", label: "Menor ou igual" },
          { value: "includes", label: "Contém" },
        ]}
        onChange={(v) => cond("operator", v)}
      />
      <Field
        label="Valor da condição"
        value={e.when.value}
        type={
          ["hunger", "humanity", "bloodPotency"].includes(e.when.field)
            ? "number"
            : "text"
        }
        onChange={(v) => cond("value", v)}
      />
      <Field
        label="Instrução narrativa"
        value={e.description}
        type="textarea"
        onChange={(v) => set("description", v)}
      />
    </div>
  );
}
export default function Catalog(props: PageProps & { kind?: string }) {
  const { state, refresh, notify, go, kind } = props,
    [filter, setFilter] = useState(kind || ""),
    [q, setQ] = useState(""),
    [origin, setOrigin] = useState(""),
    [selected, setSelected] = useState<Content | null>(null),
    [editor, setEditor] = useState<Partial<Content> | null>(null),
    [deleting, setDeleting] = useState<Content | null>(null),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  const entries = state.content
    .filter(
      (c) =>
        (!filter || filter === "advantages"
          ? !filter || ["merit", "flaw", "background"].includes(c.kind)
          : c.kind === filter) &&
        (!origin || c.origin === origin) &&
        [c.name, c.description, c.category, String(c.points)].some((v) =>
          v.toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR")),
        ),
    )
    .sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        a.level - b.level ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
  const save = async (data: any) => {
    if (editor?.id)
      await send(
        "/entities/" + editor.id,
        { ...data, version: editor.version },
        "PUT",
      );
    else await send("/entities/content", data);
    await refresh();
    notify("Conteúdo salvo e disponível para as fichas.");
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">ARQUIVO DA CRÔNICA</span>
          <h1>
            {kind === "clan"
              ? "Clãs e Linhagens"
              : kind === "discipline"
                ? "Disciplinas e Poderes"
                : kind === "advantages"
                  ? "Qualidades e Defeitos"
                  : kind === "equipment"
                    ? "Inventário e Equipamentos"
                    : "Oficina de Conteúdo"}
          </h1>
          <p>Definições preservadas. Novas possibilidades para suas noites.</p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEditor({
              kind: (kind && kind !== "advantages" ? kind : "clan") as any,
            })
          }
        >
          <Plus size={17} />
          Criar conteúdo
        </button>
      </header>
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Buscar conteúdo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, categoria, custo ou palavra-chave"
          />
        </div>
        <select
          aria-label="Tipo de conteúdo"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="advantages">Vantagens e Defeitos</option>
          {kindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Origem"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        >
          <option value="">Todas as origens</option>
          <option value="official">Oficial</option>
          <option value="custom">Personalizado</option>
          <option value="variant">Variante</option>
          <option value="optional">Opcional</option>
        </select>
        <button
          className="secondary"
          onClick={async () => {
            download("conteudo-v5.json", await api("/content/export"));
          }}
        >
          <Download size={16} />
          Exportar
        </button>
        <label className="file-button secondary">
          <Upload size={16} />
          Importar
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              if (e.target.files?.[0])
                try {
                  const r = await send(
                    "/content/import",
                    await readJSON(e.target.files[0]),
                  );
                  await refresh();
                  notify(r.imported + " conteúdos importados.");
                } catch (err: any) {
                  notify(err.message);
                }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="count">
        {entries.length} registros · Conteúdo oficial só pode ser alterado por
        uma variante
      </p>
      <div className="catalog-grid">
        {entries.map((c) => (
          <button
            key={c.id}
            className="catalog-card"
            onClick={() => setSelected(c)}
          >
            <div className="card-top">
              <span className="catalog-symbol">
                {c.image ? (
                  <img src={c.image} />
                ) : c.kind === "clan" ? (
                  "♜"
                ) : c.kind === "discipline" ? (
                  "✧"
                ) : c.kind === "power" ? (
                  "✦"
                ) : (
                  "◇"
                )}
              </span>
              <Badge origin={c.origin} />
            </div>
            <span className="eyebrow">
              {kindLabels[c.kind]}{" "}
              {["power", "ritual", "ceremony", "formula"].includes(c.kind)
                ? "· NÍVEL " + c.level
                : ""}
            </span>
            <h3>{c.name}</h3>
            <p>
              {c.bane ||
                c.description ||
                c.notes ||
                "Abra para consultar detalhes e referências."}
            </p>
            <div className="card-bottom">
              <span>
                {c.kind === "clan"
                  ? c.disciplines.length + " Disciplinas"
                  : c.category || "Vampiro V5"}
              </span>
              <ChevronRight size={17} />
            </div>
          </button>
        ))}
      </div>
      {!entries.length && (
        <Empty
          title="Nenhum conteúdo encontrado"
          detail="Crie seu primeiro conteúdo ou ajuste os filtros."
        />
      )}
      {selected && (
        <Modal title={selected.name} wide onClose={() => setSelected(null)}>
          <div className="row">
            <Badge origin={selected.origin} />
            <Badge origin={selected.automation} />
            <span>
              {kindLabels[selected.kind]} · Nível {selected.level}
            </span>
          </div>
          {selected.image && (
            <img className="image-preview" src={selected.image} />
          )}
          <p className="preserve-lines">{selected.description}</p>
          {[
            ["História", selected.history],
            ["Características", selected.characteristics],
            ["Perdição", selected.bane],
            ["Gravidade", selected.baneSeverity],
            ["Compulsão", selected.compulsion],
            ["Restrições", selected.restrictions],
            ["Informações complementares", selected.notes],
            ["Propriedades", selected.properties],
          ]
            .filter(([, value]) => value)
            .map(([title, value]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p className="preserve-lines">{value}</p>
              </section>
            ))}
          {selected.disciplines.length > 0 && (
            <section>
              <h3>Disciplinas associadas</h3>
              <div className="row">
                {selected.disciplines.map((k) => (
                  <span className="pill" key={k}>
                    {state.content.find((c) => c.id === k)?.name || k}
                  </span>
                ))}
              </div>
            </section>
          )}
          {selected.kind === "discipline" && (
            <section>
              <h3>Poderes, Rituais e Fórmulas</h3>
              {state.content
                .filter(
                  (c) =>
                    c.parentId === selected.id &&
                    ["power", "ritual", "ceremony", "formula"].includes(c.kind),
                )
                .sort((a, b) => a.level - b.level)
                .map((p) => (
                  <button
                    className="list-row"
                    key={p.id}
                    onClick={() => setSelected(p)}
                  >
                    <span>{p.name}</span>
                    <span>
                      Nível {p.level} <ChevronRight size={15} />
                    </span>
                  </button>
                ))}
              <button
                className="secondary"
                onClick={() => {
                  setEditor({ kind: "power", parentId: selected.id });
                  setSelected(null);
                }}
              >
                Criar Poder nesta Disciplina
              </button>
            </section>
          )}
          {["power", "ritual", "ceremony", "formula"].includes(
            selected.kind,
          ) && (
            <div className="stats-row">
              <div>
                <small>Despertar</small>
                <strong>
                  {selected.automation === "unreviewed"
                    ? "A revisar"
                    : selected.rouse}
                </strong>
              </div>
              <div>
                <small>Teste</small>
                <strong>
                  {labels[selected.attribute] ||
                    state.content.find((c) => c.id === selected.attribute)
                      ?.name ||
                    "Narrativo"}{" "}
                  {selected.skill
                    ? " + " +
                      (labels[selected.skill] ||
                        state.content.find((c) => c.id === selected.skill)
                          ?.name ||
                        selected.skill)
                    : ""}
                </strong>
              </div>
              <div>
                <small>Duração</small>
                <strong>
                  {durations.find((d) => d.value === selected.duration)?.label}
                </strong>
              </div>
            </div>
          )}
          {selected.effects.length > 0 && (
            <section>
              <h3>Efeitos configurados</h3>
              {selected.effects.map((e, i) => (
                <p className="rule-line" key={i}>
                  {e.description ||
                    readableEffects[e.kind] +
                      " · " +
                      (labels[e.target] || e.target) +
                      " · " +
                      e.value}{" "}
                  <small>
                    (
                    {e.when.field === "always"
                      ? "sempre"
                      : e.when.field +
                        " " +
                        e.when.operator +
                        " " +
                        e.when.value}
                    )
                  </small>
                </p>
              ))}
            </section>
          )}
          <section>
            <h3>Referências documentais</h3>
            {selected.references.map((r, i) => (
              <button
                key={i}
                className="reference"
                onClick={() => {
                  go("library", r.document + ":" + r.page);
                  setSelected(null);
                }}
              >
                <BookOpen size={16} />
                {r.document} · página PDF {r.page}{" "}
                {r.note && <small>{r.note}</small>}
              </button>
            ))}
            {!selected.references.length && (
              <p className="hint">
                Conteúdo sem referência documental cadastrada.
              </p>
            )}
          </section>
          <footer className="modal-actions">
            <button
              className="secondary"
              onClick={() => {
                const { id, ownerId, version, ...copy } = selected;
                setEditor({
                  ...copy,
                  name: selected.name + " — variante",
                  origin: "variant",
                  parentId:
                    selected.kind === "power" ? selected.parentId : selected.id,
                });
                setSelected(null);
              }}
            >
              <Copy size={16} />
              Duplicar como variante
            </button>
            {(selected as any).canEdit && (
              <>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditor(selected);
                    setSelected(null);
                  }}
                >
                  Editar
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setDeleting(selected);
                    setSelected(null);
                  }}
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </>
            )}
          </footer>
        </Modal>
      )}
      {editor && (
        <ContentEditor
          initial={editor}
          catalog={state.content}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Excluir conteúdo"
          onClose={() => {
            setDeleting(null);
            setConfirm("");
            setError("");
          }}
        >
          <p>
            O registro será enviado à lixeira. Digite{" "}
            <strong>{deleting.name}</strong> para confirmar.
          </p>
          <Field
            label="Nome para confirmação"
            value={confirm}
            onChange={setConfirm}
          />
          {error && <p className="error">{error}</p>}
          <button
            className="danger"
            onClick={async () => {
              try {
                await send("/entities/" + deleting.id, { confirm }, "DELETE");
                setDeleting(null);
                setConfirm("");
                await refresh();
                notify("Conteúdo movido para a lixeira.");
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Confirmar exclusão
          </button>
        </Modal>
      )}
    </>
  );
}
