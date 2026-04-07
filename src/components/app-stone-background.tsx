"use client";

/**
 * Fixed overlay: vignette + engraved neon path graph. Stone slab texture lives on
 * `body.app-page-canvas` so all pages (including long scroll) share the same base.
 */
export function AppStoneBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="app-stone-vignette absolute inset-0" />

      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 400 900"
      >
        <defs>
          <linearGradient id="app-bg-neon-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--network-cyan-light)" stopOpacity="0.95" />
            <stop offset="35%" stopColor="var(--network-primary-light)" stopOpacity="0.85" />
            <stop offset="70%" stopColor="var(--network-cyan)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--network-nebula)" stopOpacity="0.8" />
          </linearGradient>
          <filter
            id="app-bg-neon-glow"
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b2" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="b1" />
              <feMergeNode in="b2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="app-bg-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Groove / chiseled underlay (no glow) */}
        <path
          className="app-bg-path-groove"
          d="M 210 0 L 210 42 C 210 78 155 92 128 118 C 98 148 168 168 198 198 C 232 232 118 258 88 308 C 58 358 268 378 302 428 C 338 482 152 512 118 562 C 82 616 318 642 352 698 C 382 748 188 778 152 828 C 128 862 210 888 210 900"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
          vectorEffect="non-scaling-stroke"
        />

        {/* Neon trace */}
        <path
          className="app-bg-path-neon app-bg-glow-pulse"
          d="M 210 0 L 210 42 C 210 78 155 92 128 118 C 98 148 168 168 198 198 C 232 232 118 258 88 308 C 58 358 268 378 302 428 C 338 482 152 512 118 562 C 82 616 318 642 352 698 C 382 748 188 778 152 828 C 128 862 210 888 210 900"
          fill="none"
          filter="url(#app-bg-neon-glow)"
          stroke="url(#app-bg-neon-stroke)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Branch segments — same graph, connected */}
        <g className="app-bg-branch-opacity" filter="url(#app-bg-neon-glow)">
          <path
            d="M 128 118 C 72 108 42 168 32 228 C 22 288 58 332 98 358"
            fill="none"
            stroke="url(#app-bg-neon-stroke)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.85"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M 302 428 C 348 398 382 452 368 512 C 354 572 312 598 272 618"
            fill="none"
            stroke="url(#app-bg-neon-stroke)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.85"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M 198 198 L 268 188 C 312 182 338 228 322 272"
            fill="none"
            stroke="url(#app-bg-neon-stroke)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.75"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Junction nodes */}
        <g filter="url(#app-bg-soft-glow)">
          {[
            [210, 42],
            [128, 118],
            [198, 198],
            [88, 308],
            [302, 428],
            [118, 562],
            [352, 698],
            [152, 828],
            [98, 358],
            [272, 618],
            [322, 272],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              className="app-bg-node-fill"
              cx={cx}
              cy={cy}
              r={3.2}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
