import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookMarked,
  Network,
  Shield,
  Flame,
  Sparkles,
  Package,
  Dices,
  Swords,
  Library,
  ScrollText,
  Wrench,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Moon,
  Plus,
  Search,
} from "lucide-react";
import { api, send } from "./api";
import { Field, Empty, flushAll } from "./components/ui";
import { PageProps, State } from "./types";
import { Characters } from "./pages/Characters";
import Catalog from "./pages/Catalog";
import Campaigns from "./pages/Campaigns";
import LibraryPage from "./pages/Library";
import Combat from "./pages/Combat";
import SettingsPage from "./pages/Settings";
const navigation = [
  ["dashboard", "Painel Inicial", LayoutDashboard],
  ["characters", "Meus Personagens", Users],
  ["create", "Criação de Personagem", UserPlus],
  ["campaigns", "Campanhas", BookMarked],
  ["coteries", "Coteries", Network],
  ["clans", "Clãs", Shield],
  ["disciplines", "Disciplinas", Flame],
  ["advantages", "Qualidades e Defeitos", Sparkles],
  ["equipment", "Inventário e Equipamentos", Package],
  ["rolls", "Rolagens e Mecânicas", Dices],
  ["combat", "Combate", Swords],
  ["library", "Biblioteca de Regras", Library],
  ["narrator", "Ferramentas do Narrador", ScrollText],
  ["workshop", "Oficina de Conteúdo", Wrench],
  ["settings", "Configurações", Settings],
] as const;
const empty: State = {
  characters: [],
  campaigns: [],
  coteries: [],
  records: [],
  content: [],
};
function parseRoute() {
  const [page = "dashboard", id] = window.location.hash
    .replace(/^#/, "")
    .split("/");
  return {
    page: page || "dashboard",
    id: id ? decodeURIComponent(id) : undefined,
  };
}
export default function App() {
  const [auth, setAuth] = useState<any>(null),
    [state, setState] = useState(empty),
    [route, setRoute] = useState(parseRoute),
    [menu, setMenu] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const notify = (s: string) => setNotice(s);
  const refresh = async () => {
    setState(await api("/state"));
    setLoaded(true);
  };
  useEffect(() => {
    void api("/auth/status")
      .then(setAuth)
      .catch((e) => setError(e.message));
    document.documentElement.classList.toggle(
      "reduced-motion",
      localStorage.getItem("v5-reduced-motion") === "1",
    );
  }, []);
  useEffect(() => {
    if (auth?.user) void refresh().catch((e) => setError(e.message));
  }, [auth?.user?.id]);
  useEffect(() => {
    const fn = () => setRoute(parseRoute());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const go = (page: string, id?: string) => {
    void flushAll()
      .then(() => {
        window.location.hash = page + (id ? "/" + encodeURIComponent(id) : "");
        setMenu(false);
        window.scrollTo(0, 0);
      })
      .catch((e) => notify("Salve as alterações antes de sair: " + e.message));
  };
  if (error)
    return (
      <div className="loading-screen">
        <h1>Não foi possível conectar</h1>
        <p>{error}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!auth)
    return (
      <div className="loading-screen">
        <span className="brand-mark">V</span>
        <p>Abrindo os arquivos da crônica…</p>
      </div>
    );
  if (!auth.user)
    return (
      <Auth
        initialized={auth.initialized}
        onAuth={(u) => setAuth({ ...auth, initialized: true, user: u })}
      />
    );
  const props: PageProps = { state, user: auth.user, go, refresh, notify };
  let content;
  switch (route.page) {
    case "characters":
      content = <Characters {...props} selectedId={route.id} />;
      break;
    case "create":
      content = <Characters {...props} create />;
      break;
    case "campaigns":
      content = <Campaigns {...props} selectedId={route.id} />;
      break;
    case "coteries":
      content = <Campaigns {...props} mode="coteries" />;
      break;
    case "narrator":
      content = <Campaigns {...props} mode="narrator" />;
      break;
    case "clans":
      content = <Catalog key="clans" {...props} kind="clan" />;
      break;
    case "disciplines":
      content = <Catalog key="disciplines" {...props} kind="discipline" />;
      break;
    case "advantages":
      content = <Catalog key="advantages" {...props} kind="advantages" />;
      break;
    case "equipment":
      content = <Catalog key="equipment" {...props} kind="equipment" />;
      break;
    case "workshop":
      content = <Catalog key="workshop" {...props} />;
      break;
    case "library":
      content = <LibraryPage {...props} selectedId={route.id} />;
      break;
    case "combat":
      content = <Combat {...props} />;
      break;
    case "settings":
      content = <SettingsPage {...props} />;
      break;
    case "rolls":
      content = <Mechanics {...props} />;
      break;
    default:
      content = <Dashboard {...props} />;
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <button className="brand" onClick={() => go("dashboard")}>
          <span className="brand-mark">V</span>
          <div>
            <strong>CRÔNICA</strong>
            <small>VAMPIRO · A MÁSCARA · V5</small>
          </div>
        </button>
        <div className="nav-label">ARQUIVOS DA NOITE</div>
        <nav>
          {navigation.map(([key, label, Icon]) => (
            <button
              key={key}
              className={route.page === key ? "active" : ""}
              onClick={() => go(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {route.page === key && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="user-avatar">
            {auth.user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{auth.user.name}</strong>
            <small>
              {auth.user.role === "narrator" ? "Narrador" : "Jogador"} · local
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Sair da conta"
            onClick={async () => {
              try {
                await flushAll();
                await send("/auth/logout", {});
                setAuth({ ...auth, user: null });
                setLoaded(false);
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </footer>
      </aside>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir navegação"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              CRÔNICA <ChevronRight size={13} />{" "}
              {navigation.find(([key]) => key === route.page)?.[1] ||
                "Painel Inicial"}
            </span>
          </div>
          <div className="row">
            <span className="local-status">
              <span />
              Banco local · SQLite
            </span>
            <button
              className="icon-button"
              title="Buscar regras"
              onClick={() => go("library")}
            >
              <Search size={17} />
            </button>
          </div>
        </header>
        <main>
          {loaded ? (
            content
          ) : (
            <div className="loading-screen">
              <p>Carregando seus arquivos…</p>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>CRÔNICA · Sistema digital para Vampiro V5</span>
          <span>Seu jogo. Suas escolhas. Suas noites.</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Fechar notificação" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Auth({
  initialized,
  onAuth,
}: {
  initialized: boolean;
  onAuth: (u: any) => void;
}) {
  const [data, setData] = useState({ username: "", password: "", name: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-screen">
      <div className="auth-art">
        <span className="eyebrow">VAMPIRO: A MÁSCARA · 5ª EDIÇÃO</span>
        <h1>
          Toda noite
          <br />
          tem uma
          <br />
          <em>história.</em>
        </h1>
        <p>
          Preserve seus personagens.
          <br />
          Conduza a crônica. Enfrente a Besta.
        </p>
        <span className="auth-seal">V</span>
      </div>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setBusy(true);
            setError("");
            const r = await send(
              initialized ? "/auth/login" : "/auth/setup",
              initialized
                ? { username: data.username, password: data.password }
                : data,
            );
            onAuth(r.user);
          } catch (err: any) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="row">
          <span className="brand-mark">V</span>
          <strong className="brand-name">CRÔNICA</strong>
        </div>
        <span className="eyebrow">
          {initialized ? "OS ARQUIVOS AGUARDAM" : "A PRIMEIRA NOITE"}
        </span>
        <h2>{initialized ? "Entre na sua crônica" : "Cadastre o Narrador"}</h2>
        <p>
          {initialized
            ? "Acesse sua conta local para retomar a sessão."
            : "Crie a conta inicial. Depois, cadastre os jogadores nas configurações."}
        </p>
        {!initialized && (
          <Field
            label="Seu nome"
            value={data.name}
            onChange={(v) => setData((d) => ({ ...d, name: v }))}
          />
        )}
        <Field
          label="Usuário"
          value={data.username}
          onChange={(v) => setData((d) => ({ ...d, username: v }))}
        />
        <Field
          label="Senha"
          type="password"
          value={data.password}
          onChange={(v) => setData((d) => ({ ...d, password: v }))}
        />
        {!initialized && (
          <p className="hint">
            Use no mínimo 10 caracteres. A senha fica protegida no banco local.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Aguarde…" : initialized ? "Entrar" : "Criar conta e começar"}
          <ChevronRight size={17} />
        </button>
        <small>
          Uma plataforma local, gratuita e inteiramente em português.
        </small>
      </form>
    </div>
  );
}
function Dashboard({ state, go, user }: PageProps) {
  const sessions = state.records.filter((r) => r.kind === "session");
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">BEM-VINDO AOS ARQUIVOS</span>
          <h1>Boa noite, {user.name.split(" ")[0]}.</h1>
          <p>Sua crônica continua de onde você parou.</p>
        </div>
        <span className="date-text">
          {new Date().toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">VAMPIRO: A MÁSCARA · V5</span>
          <h2>
            A cidade dorme.
            <br />
            <em>Sua história, não.</em>
          </h2>
          <p>
            Personagens, campanhas e os segredos que
            <br className="desktop-only" /> dão vida às suas noites, em um só
            lugar.
          </p>
          <div className="row">
            <button className="primary" onClick={() => go("create")}>
              <Plus size={17} />
              Criar personagem
            </button>
            <button className="hero-link" onClick={() => go("campaigns")}>
              Gerenciar campanhas <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="hero-emblem" aria-hidden="true">
          <div className="emblem-circle">
            V<span>NON OMNIS MORIAR</span>
          </div>
        </div>
        <span className="hero-index">ARQUIVO 001 / A CRÔNICA</span>
      </section>
      <div className="dashboard-stats">
        {[
          [Users, "Personagens", state.characters.length, "characters"],
          [BookMarked, "Campanhas", state.campaigns.length, "campaigns"],
          [Network, "Coteries", state.coteries.length, "coteries"],
          [CalendarIcon, "Sessões registradas", sessions.length, "narrator"],
        ].map(([Icon, title, count, page]: any) => (
          <button className="stat-card" key={title} onClick={() => go(page)}>
            <span className="stat-icon">
              <Icon size={21} />
            </span>
            <div>
              <small>{title}</small>
              <strong>{count}</strong>
            </div>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <header>
            <h2>Personagens em cena</h2>
            <button className="text-button" onClick={() => go("characters")}>
              Ver todos <ChevronRight size={14} />
            </button>
          </header>
          {state.characters.slice(0, 4).map((c) => (
            <button
              className="dashboard-character"
              key={c.id}
              onClick={() => go("characters", c.id)}
            >
              <span className="small-portrait">
                {c.portrait ? <img src={c.portrait} /> : c.name.slice(0, 1)}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.nature === "mortal"
                    ? "Mortal"
                    : state.content.find((x) => x.id === c.clanId)?.name ||
                      "Criação em andamento"}{" "}
                  · {c.concept || "Conceito a definir"}
                </small>
              </span>
              {c.nature !== "mortal" && (
                <span className="hunger-indicator">Fome {c.hunger}</span>
              )}
              <ChevronRight size={16} />
            </button>
          ))}
          {!state.characters.length && (
            <Empty
              title="Nenhum personagem ainda"
              detail="O primeiro nome nos arquivos pode ser o seu."
              action={
                <button className="text-button" onClick={() => go("create")}>
                  Criar uma ficha →
                </button>
              }
            />
          )}
        </section>
        <section className="panel quick-panel">
          <h2>Durante a sessão</h2>
          {[
            [
              Dices,
              "Rolagens e Fome",
              "Calcule paradas e acompanhe a Besta.",
              "rolls",
            ],
            [
              Swords,
              "Combate e conflitos",
              "Resolva disputas e aplique dano.",
              "combat",
            ],
            [
              Library,
              "Consulta de regras",
              "Pesquise suas fontes locais.",
              "library",
            ],
            [
              Wrench,
              "Oficina de Conteúdo",
              "Crie Clãs, Disciplinas e Poderes.",
              "workshop",
            ],
          ].map(([Icon, title, detail, page]: any) => (
            <button key={page} className="quick-link" onClick={() => go(page)}>
              <Icon size={22} />
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </div>
      <section className="panel">
        <header>
          <h2>Acontecimentos recentes</h2>
          <button className="text-button" onClick={() => go("narrator")}>
            Diário da crônica
          </button>
        </header>
        {state.records.slice(0, 5).map((r) => (
          <div key={r.id} className="timeline-item">
            <span>{r.date || "Sem data"}</span>
            <strong>{r.name}</strong>
            <p>{r.description}</p>
          </div>
        ))}
        {!state.records.length && (
          <p className="hint">
            As sessões e acontecimentos registrados pelo Narrador aparecerão
            aqui.
          </p>
        )}
      </section>
    </>
  );
}
function CalendarIcon(p: any) {
  return <ScrollText {...p} />;
}
function Mechanics({ state, go }: PageProps) {
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">O SANGUE E A BESTA</span>
          <h1>Rolagens e Mecânicas</h1>
          <p>Abra uma ficha para realizar testes e atualizar seus recursos.</p>
        </div>
        <Dices size={36} />
      </header>
      <section className="panel">
        <h2>Selecione um personagem</h2>
        {state.characters.map((c) => (
          <button
            className="list-row"
            key={c.id}
            onClick={() => go("characters", c.id)}
          >
            <span>{c.name}</span>
            <span>
              {c.nature !== "mortal" && <>Fome {c.hunger} · </>}Humanidade{" "}
              {c.humanity} <ChevronRight size={16} />
            </span>
          </button>
        ))}
        {!state.characters.length && (
          <Empty
            title="Crie um personagem primeiro"
            detail="Rolagens ficam ligadas à ficha e são preservadas no histórico."
          />
        )}
      </section>
      <div className="catalog-grid">
        {[
          [
            "Fome e Dados de Fome",
            "Substituição de dados; Críticos Confusos e Falhas Bestiais.",
            180,
          ],
          [
            "Despertar do Sangue",
            "Um d10, sucesso em 6+. Falha aumenta a Fome.",
            187,
          ],
          [
            "Dano e Força de Vontade",
            "Dano superficial, agravado e comprometimento.",
            104,
          ],
          [
            "Humanidade e Remorso",
            "Máculas, degeneração e teste ao fim da sessão.",
            218,
          ],
          [
            "Potência do Sangue",
            "Efeitos, geração e restrições de alimentação.",
            194,
          ],
          ["Progressão", "Custos de experiência e requisitos.", 131],
        ].map(([title, detail, page]) => (
          <button
            className="catalog-card"
            key={title}
            onClick={() => go("library", "basico:" + page)}
          >
            <h3>{title}</h3>
            <p>{detail}</p>
            <span className="text-link">Consultar referência →</span>
          </button>
        ))}
      </div>
    </>
  );
}
