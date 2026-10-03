const EMAIL = "nico.builds@boing.network";

/** Site-wide invitation for anyone who wants to collaborate on Boing Network. */
export function CollaborationBanner() {
  return (
    <aside
      role="note"
      aria-label="Collaboration"
      className="border-b border-[color-mix(in_srgb,var(--express-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--express-primary)_10%,transparent)] px-3 py-2 text-center text-xs text-[var(--text-secondary)] sm:px-4 sm:text-sm"
    >
      <p className="m-0 leading-snug">
        Want to collaborate on the Boing Network? Email Nico at{" "}
        <a
          href={`mailto:${EMAIL}`}
          className="font-semibold text-[var(--express-primary)] underline underline-offset-2 hover:opacity-90"
        >
          {EMAIL}
        </a>
        .
      </p>
    </aside>
  );
}
