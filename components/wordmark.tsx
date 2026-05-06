export function Wordmark({ size = 22 }: { size?: number }) {
  const w = size;
  const stroke = Math.max(2, size * 0.13);
  const gap = size * 0.16;
  return (
    <span className="sv-wordmark" style={{ fontSize: size * 0.95 }}>
      <span className="sv-bars" style={{ height: w, gap }}>
        <span className="sv-bar" style={{ width: stroke, height: w * 0.55, background: 'var(--color-primary)' }} />
        <span className="sv-bar" style={{ width: stroke, height: w * 0.85, background: 'var(--color-primary)' }} />
        <span className="sv-bar" style={{ width: stroke, height: w, background: 'var(--color-primary)' }} />
        <span className="sv-bar" style={{ width: stroke, height: w * 0.7, background: 'var(--color-outline)' }} />
      </span>
      <span className="sv-text">
        Story<em>Vault</em>
      </span>
    </span>
  );
}
