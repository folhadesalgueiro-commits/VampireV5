import { useEffect, useState } from "react";
import { Search, BookOpen, ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "../api";
import { Field, Modal, Empty } from "../components/ui";
import { PageProps } from "../types";
export default function Library({
  notify,
  selectedId,
}: PageProps & { selectedId?: string }) {
  const [documents, setDocuments] = useState<any[]>([]),
    [document, setDocument] = useState(""),
    [q, setQ] = useState(""),
    [results, setResults] = useState<any[]>([]),
    [page, setPage] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api("/documents")
      .then(setDocuments)
      .catch((e) => notify(e.message));
  }, []);
  const open = async (doc: string, n: number) => {
    try {
      const r = await api(
        "/documents/" + encodeURIComponent(doc) + "/pages/" + n,
      );
      setPage({ document: doc, page: n, text: r.text });
    } catch (e: any) {
      notify(e.message);
    }
  };
  useEffect(() => {
    if (selectedId) {
      const [d, n] = selectedId.split(":");
      if (d && Number(n)) void open(d, Number(n));
    }
  }, [selectedId]);
  const search = async () => {
    try {
      setBusy(true);
      setResults(
        await api(
          "/library?q=" +
            encodeURIComponent(q) +
            "&document=" +
            encodeURIComponent(document),
        ),
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void search();
  }, [document]);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">CONHECIMENTO PRESERVADO</span>
          <h1>Biblioteca de Regras</h1>
          <p>Consulte as fontes locais por palavra-chave e página do PDF.</p>
        </div>
        <BookOpen size={35} />
      </header>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Buscar regras"
            placeholder="Fome, Remorso, Dominação…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Documento"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
        >
          <option value="">Todos os documentos</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="primary" type="submit">
          {busy ? "Buscando…" : "Buscar"}
        </button>
      </form>
      <div className="callout">
        <p>
          Westhaven contém material V5, adaptações e conteúdo caseiro. As
          remissões internas do básico traduzido podem usar outra paginação; as
          referências da aplicação sempre indicam a página do PDF carregado.
        </p>
      </div>
      <div className="document-list">
        {documents.map((d) => (
          <div className="document-card" key={d.id}>
            <BookOpen size={20} />
            <div>
              <strong>{d.name}</strong>
              <small>
                {d.pages} páginas ·{" "}
                {d.classification === "compilacao-mista"
                  ? "Compilação mista — verificar origem"
                  : "Referência V5"}
              </small>
            </div>
            <button className="text-button" onClick={() => open(d.id, 1)}>
              Abrir
            </button>
          </div>
        ))}
      </div>
      <h2>Resultados</h2>
      {results.map((r, i) => (
        <button
          className="search-result"
          key={i}
          onClick={() => open(r.document, Number(r.page))}
        >
          <span className="eyebrow">
            {documents.find((d) => d.id === r.document)?.name || r.document} ·
            PDF {r.page}
          </span>
          <p>{r.excerpt}</p>
          <span className="text-link">Consultar página →</span>
        </button>
      ))}
      {!results.length && (
        <Empty
          title={
            documents.length
              ? "Nenhum resultado"
              : "Fontes ainda não importadas"
          }
          detail={
            documents.length
              ? "Experimente outros termos ou selecione outro documento."
              : "Importe os documentos privados seguindo o manual de instalação."
          }
        />
      )}
      {page && (
        <Modal
          title={
            (documents.find((d) => d.id === page.document)?.name ||
              page.document) +
            " · PDF " +
            page.page
          }
          wide
          onClose={() => setPage(null)}
        >
          <div className="row">
            <button
              className="secondary"
              disabled={page.page <= 1}
              onClick={() => open(page.document, page.page - 1)}
            >
              <ArrowLeft size={16} />
              Anterior
            </button>
            <Field
              label="Página do PDF"
              type="number"
              value={page.page}
              onChange={(v) => {
                if (
                  v >= 1 &&
                  v <= documents.find((d) => d.id === page.document)?.pages
                )
                  void open(page.document, v);
              }}
            />
            <button
              className="secondary"
              disabled={
                page.page >=
                documents.find((d) => d.id === page.document)?.pages
              }
              onClick={() => open(page.document, page.page + 1)}
            >
              Próxima
              <ArrowRight size={16} />
            </button>
          </div>
          <details className="pdf-view">
            <summary>
              Ver PDF original (símbolos, imagens e diagramação)
            </summary>
            <iframe
              title="Página do documento original"
              src={"/api/documents/" + page.document + "/pdf#page=" + page.page}
              style={{ width: "100%", height: 650, border: 0, marginTop: 15 }}
            />
          </details>
          <pre className="document-text">{page.text}</pre>
        </Modal>
      )}
    </>
  );
}
