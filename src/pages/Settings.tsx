import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  UserPlus,
  RotateCcw,
  Database,
  ShieldCheck,
} from "lucide-react";
import { api, send, download, readJSON } from "../api";
import { Field, CheckBox, Modal } from "../components/ui";
import { PageProps } from "../types";
export default function Settings({ user, notify, refresh }: PageProps) {
  const [users, setUsers] = useState<any[]>([]),
    [trash, setTrash] = useState<any[]>([]),
    [form, setForm] = useState({
      username: "",
      name: "",
      password: "",
      role: "player",
    }),
    [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [reduced, setReduced] = useState(
      localStorage.getItem("v5-reduced-motion") === "1",
    );
  const load = () =>
    Promise.all([api("/users"), api("/trash")]).then(([u, t]) => {
      setUsers(u);
      setTrash(t);
    });
  useEffect(() => {
    void load().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">PRESERVE SUAS NOITES</span>
          <h1>Configurações</h1>
          <p>Contas locais, cópias de segurança e recuperação de dados.</p>
        </div>
        <ShieldCheck size={36} />
      </header>
      <section className="panel">
        <h2>
          <Database size={20} />
          Backup e restauração
        </h2>
        <p>
          O SQLite salva as alterações entre sessões. Exporte uma cópia antes de
          modificar muitos registros. A restauração cria cópias e mantém os
          registros existentes; contas e senhas não são exportadas.
        </p>
        <div className="row">
          <button
            className="primary"
            onClick={async () => {
              try {
                download("cronica-v5-backup.json", await api("/backup"));
                notify("Backup JSON exportado.");
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            <Download size={17} />
            Exportar backup
          </button>
          {user.role === "narrator" && (
            <label className="secondary file-button">
              <Upload size={17} />
              Restaurar backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  if (e.target.files?.[0])
                    try {
                      const json = await readJSON(e.target.files[0]);
                      if (json.format !== "v5-backup" || json.version !== 1)
                        throw new Error(
                          "Backup inválido ou versão incompatível.",
                        );
                      setPending(json);
                    } catch (err: any) {
                      notify(err.message);
                    }
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </section>
      {user.role === "narrator" && (
        <section className="panel">
          <h2>Contas de jogadores e Narradores</h2>
          <p className="hint">
            Adicione as contas à campanha para conceder acesso. Anotações e
            registros privados são filtrados pelo servidor.
          </p>
          <div className="form-grid">
            {[
              ["name", "Nome de exibição", "text"],
              ["username", "Usuário", "text"],
              ["password", "Senha (mínimo de 10 caracteres)", "password"],
            ].map(([key, label, type]) => (
              <Field
                key={key}
                label={label}
                type={type}
                value={(form as any)[key]}
                onChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
              />
            ))}
            <Field
              label="Papel"
              value={form.role}
              options={[
                { value: "player", label: "Jogador" },
                { value: "narrator", label: "Narrador" },
              ]}
              onChange={(v) => setForm((p) => ({ ...p, role: v }))}
            />
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                await send("/users", form);
                setForm({
                  name: "",
                  username: "",
                  password: "",
                  role: "player",
                });
                await load();
                notify("Conta criada. Adicione-a à campanha.");
              } catch (e: any) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <UserPlus size={17} />
            Criar conta
          </button>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuário</th>
                  <th>Papel</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.username}</td>
                    <td>{u.role === "narrator" ? "Narrador" : "Jogador"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <h2>Lixeira</h2>
        <p className="hint">
          Registros arquivados podem ser recuperados. Conteúdo com vínculos
          ativos não pode ser excluído.
        </p>
        {trash.length ? (
          trash.map((e) => (
            <div className="list-row" key={e.id}>
              <strong>{e.name}</strong>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await send("/trash/" + e.id + "/restore", {});
                    await refresh();
                    await load();
                    notify("Registro restaurado.");
                  } catch (err: any) {
                    notify(err.message);
                  }
                }}
              >
                <RotateCcw size={16} />
                Restaurar
              </button>
            </div>
          ))
        ) : (
          <p>Nenhum registro na lixeira.</p>
        )}
      </section>
      <section className="panel">
        <h2>Acessibilidade</h2>
        <CheckBox
          label="Reduzir animações"
          checked={reduced}
          onChange={(v) => {
            setReduced(v);
            localStorage.setItem("v5-reduced-motion", v ? "1" : "0");
            document.documentElement.classList.toggle("reduced-motion", v);
          }}
        />
        <p className="hint">
          A preferência é armazenada somente neste navegador. Todos os dados de
          campanha ficam no servidor local.
        </p>
      </section>
      {pending && (
        <Modal
          title="Restaurar cópia de segurança"
          onClose={() => setPending(null)}
        >
          <p>
            Serão importados {pending.entities?.length ?? 0} registros como
            cópias. As campanhas restauradas ficam sob sua conta; associe
            novamente os jogadores depois da importação.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                const r = await send("/restore", pending);
                await refresh();
                await load();
                setPending(null);
                notify(r.message);
              } catch (e: any) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Validar e restaurar
          </button>
        </Modal>
      )}
    </>
  );
}
