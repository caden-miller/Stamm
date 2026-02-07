interface Props {
  date: string | null;
  aliveCount: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(iso: string): { year: string; detail: string } {
  const year = iso.slice(0, 4);
  const month = parseInt(iso.slice(5, 7), 10);
  const day = parseInt(iso.slice(8, 10), 10);

  if (month && day && day > 0) {
    return { year, detail: `${MONTHS[month - 1]} ${day}, ${year}` };
  }
  if (month) {
    return { year, detail: `${MONTHS[month - 1]} ${year}` };
  }
  return { year, detail: year };
}

export default function PlaybackDateDisplay({ date, aliveCount }: Props) {
  if (!date) return null;

  const { year, detail } = formatDate(date);

  return (
    <div className="playback-date-overlay">
      <div
        className="text-5xl font-light tracking-wide"
        style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
      >
        {year}
      </div>
      {detail !== year && (
        <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {detail}
        </div>
      )}
      <div
        className="text-xs mt-1.5 font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {aliveCount} alive
      </div>
    </div>
  );
}
