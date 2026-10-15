import { Character, Content } from "../../shared/model";
import { bondTraits } from "../../shared/bonds";
export function BloodBonds({
  c,
  catalog,
  date,
  gm,
  editable,
  onAction,
}: {
  c: Character;
  catalog: Content[];
  date: string;
  gm: boolean;
  editable: boolean;
  onAction: (s: string) => void;
}) {
  const traits = bondTraits(c, catalog);
  return (
    <section className="panel">
      <header>
        <h2>Laços de Sangue</h2>
        {gm && (
          <button className="secondary" onClick={() => onAction("bondDrink")}>
            Registrar gole de vitae
          </button>
        )}
      </header>
      <p className="hint">
        Básico PDF 157 e 212–213. Três noites distintas formam o Laço; o servo
        só possui um reinante. Força máxima 6. Goles podem ser registrados sem
        alterar a Fome; Alimentar-se integra o vínculo ao consumo.
      </p>
      <p>
        Calendário:{" "}
        {date
          ? date.split("-").reverse().join("/")
          : "defina a data da crônica"}{" "}
        · Resistência: {traits.resistance >= 0 ? "+" : ""}
        {traits.resistance} dados · Decadência:{" "}
        {traits.decay === "long"
          ? "três meses"
          : traits.decay === "short"
            ? "luas cheia/nova"
            : traits.decay === "manual"
              ? "conflito a resolver"
              : "um mês"}
        {traits.immune ? " · Imune ao Laço" : ""}
      </p>
      {c.bloodBonds.map((b) => (
        <article className="bond-entry" key={b.id}>
          <h3>{b.regnantName}</h3>
          <p>
            <strong>Força {b.strength} / 6</strong> ·{" "}
            {b.formed
              ? "Laço formado"
              : b.strength > 0
                ? "Vínculo em formação · " +
                  b.formationNights.length +
                  " noite(s)"
                : "Vínculo encerrado"}
          </p>
          <small>
            Última bebida: {b.lastDrink.split("-").reverse().join("/") || "—"}
            {b.formedOn
              ? " · Formado em " + b.formedOn.split("-").reverse().join("/")
              : ""}
            {b.releaseOn
              ? " · Encerramento por limite de servos: " +
                b.releaseOn.split("-").reverse().join("/")
              : ""}
          </small>
          {b.formed && b.strength > 0 && (
            <div className="row">
              {editable && (
                <>
                  <button
                    className="secondary"
                    onClick={() => onAction("bondDefy:" + b.id)}
                  >
                    Desafiar o Laço
                  </button>
                  <button
                    className="secondary"
                    onClick={() => onAction("bondAvoid:" + b.id)}
                  >
                    Testar afastamento por sessão
                  </button>
                </>
              )}
              {gm && (
                <button
                  className="secondary"
                  onClick={() => onAction("bondDecay:" + b.id)}
                >
                  Aplicar decadência
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {!c.bloodBonds.length && (
        <p>Nenhuma bebida de vitae registrada para Laços.</p>
      )}
    </section>
  );
}
