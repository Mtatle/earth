export type HudNoticeMode = 'loading' | 'empty' | 'error';

const NOTICE_CONTENT: Record<HudNoticeMode, { title: string; body: string }> = {
  loading: {
    title: 'Initializing tactical surface',
    body: 'Aligning telemetry overlays and preparing live feed render.'
  },
  empty: {
    title: 'Awaiting operational data',
    body: 'No entities match the current filters. Keep stream active for updates.'
  },
  error: {
    title: 'HUD degraded mode',
    body: 'A subsystem reported errors. Core controls remain available while data recovers.'
  }
};

export type HudStateNoticeProps = {
  mode: HudNoticeMode;
};

export function HudStateNotice({ mode }: HudStateNoticeProps) {
  const content = NOTICE_CONTENT[mode];

  return (
    <div className={`hud-state-notice hud-state-${mode}`} role="status" aria-live="polite">
      <p className="hud-state-title">{content.title}</p>
      <p className="hud-state-body">{content.body}</p>
    </div>
  );
}
