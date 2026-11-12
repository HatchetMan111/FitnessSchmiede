/** Einheitliche Segment-Auswahl (Fitness-Level, Fokus, Minuten-Budget). */
export function Segmented({ options, value, onChange, columns }) {
  const style = columns ? { "--cols": columns } : undefined;
  return (
    <div className={columns ? "segmented segmented--grid" : "segmented"} style={style}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`segmented-option ${String(o.value) === String(value) ? "is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.hint ? <small>{o.hint}</small> : null}
        </button>
      ))}
    </div>
  );
}
