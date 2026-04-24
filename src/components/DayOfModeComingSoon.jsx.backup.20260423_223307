import styles from './DayOfModeComingSoon.module.css';

// D.O.M. "Coming Soon" placeholder
// Renders when users click the Day of Mode tab while the feature is still in development.
// Converted from /public D.O.M. standalone HTML, scoped via CSS modules.

export default function DayOfModeComingSoon() {
  // 6 columns x 10 rows = 60 bricks; odd rows are offset 6px for a stagger
  const bricks = Array.from({ length: 60 }, (_, idx) => {
    const row = Math.floor(idx / 6);
    return (
      <div
        key={idx}
        className={styles.brick}
        style={row % 2 === 1 ? { transform: 'translateX(6px)' } : undefined}
      />
    );
  });

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.brand} aria-label="CuePoint Planning">
          <svg
            className={styles.mark}
            viewBox="0 0 40 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="cpdcs-pinGrad"
                x1="0"
                y1="0"
                x2="40"
                y2="40"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#e65fb0" />
                <stop offset="0.5" stopColor="#8a6ae0" />
                <stop offset="1" stopColor="#29c7c7" />
              </linearGradient>
            </defs>
            <path
              d="M20 2 C9.5 2 2.5 9.5 2.5 18 C2.5 26 8 32 20 40 C32 32 37.5 26 37.5 18 C37.5 9.5 30.5 2 20 2 Z"
              stroke="url(#cpdcs-pinGrad)"
              strokeWidth="3"
              fill="none"
              strokeLinejoin="round"
            />
            <circle
              cx="20"
              cy="17"
              r="6"
              stroke="url(#cpdcs-pinGrad)"
              strokeWidth="3"
              fill="none"
            />
            <g stroke="#9aa3b2" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="47" x2="4" y2="49" />
              <line x1="8" y1="45" x2="8" y2="51" />
              <line x1="12" y1="42" x2="12" y2="51" />
              <line x1="16" y1="44" x2="16" y2="50" />
              <line x1="20" y1="41" x2="20" y2="51" />
              <line x1="24" y1="44" x2="24" y2="50" />
              <line x1="28" y1="42" x2="28" y2="51" />
              <line x1="32" y1="45" x2="32" y2="50" />
              <line x1="36" y1="47" x2="36" y2="49" />
            </g>
          </svg>
          <div className={styles.wordmark}>
            <span className={styles.top}>CuePoint Planning</span>
          </div>
        </div>
        <div className={styles.meta}>
          <span>
            <span className={styles.dot} />
            BUILD IN PROGRESS
          </span>
        </div>
      </header>

      <div className={styles.main}>
        <span className={styles.eyebrow}>Feature in development</span>
        <h1 className={styles.h1}>
          Day of <span className={styles.amp}>Mode</span>
        </h1>
        <p className={styles.subtitle}>
          <strong>Under construction</strong> — check back soon for this feature.
          Our team is hammering away so you can hit every cue on time.
        </p>

        <div className={styles.progressWrap} aria-hidden="true">
          <div className={styles.progress}>
            <span />
          </div>
          <div className={styles.progressLabel}>
            <span>Foundation</span>
            <span>Framing</span>
            <span>Finishing</span>
          </div>
        </div>
      </div>

      <div className={styles.zone} aria-hidden="true">
        <div className={styles.scene}>
          {/* Crane */}
          <div className={styles.crane}>
            <div className={styles.mast} />
            <div className={styles.arm}>
              <div className={styles.cable} />
              <div className={styles.hook} />
            </div>
          </div>

          {/* Scaffolding + wall */}
          <div className={styles.scaffold}>
            <div className={`${styles.post} ${styles.l}`} />
            <div className={`${styles.post} ${styles.r}`} />
            <div className={styles.rung} style={{ top: '30%' }} />
            <div className={styles.rung} style={{ top: '60%' }} />
            <div className={styles.rung} style={{ top: '90%' }} />
          </div>
          <div className={styles.wall}>{bricks}</div>

          {/* Cones */}
          <div className={`${styles.cone} ${styles.c1}`}>
            <div className={styles.band} />
          </div>
          <div className={`${styles.cone} ${styles.c2}`}>
            <div className={styles.band} />
          </div>

          {/* Welding bot (stationary near scaffold) */}
          <div className={`${styles.bot} ${styles.bot4}`}>
            <div className={styles.antenna} />
            <div className={styles.head}>
              <div className={styles.visor} />
            </div>
            <div className={styles.body} />
            <div className={styles.arm} />
            <div className={`${styles.arm} ${styles.right}`} />
            <div className={styles.torch} />
            <div className={styles.treads} />
          </div>
          <div className={styles.sparks}>
            <i style={{ '--tx': '14px' }} />
            <i style={{ '--tx': '-8px' }} />
            <i style={{ '--tx': '20px' }} />
            <i style={{ '--tx': '-14px' }} />
          </div>

          {/* Walking bot 1 — carrying a plank */}
          <div className={`${styles.bot} ${styles.bot1}`}>
            <div className={styles.plank} />
            <div className={styles.antenna} />
            <div className={styles.head}>
              <div className={styles.visor} />
            </div>
            <div className={styles.body} />
            <div className={styles.arm} />
            <div className={`${styles.arm} ${styles.right}`} />
            <div className={styles.treads} />
          </div>

          {/* Walking bot 2 — stacking bricks */}
          <div className={`${styles.bot} ${styles.bot2}`}>
            <div className={styles.stack}>
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
            </div>
            <div className={styles.antenna} />
            <div className={styles.head}>
              <div className={styles.visor} />
            </div>
            <div className={styles.body} />
            <div className={styles.arm} />
            <div className={`${styles.arm} ${styles.right}`} />
            <div className={styles.treads} />
          </div>

          {/* Walking bot 3 — carrying a beam */}
          <div className={`${styles.bot} ${styles.bot3}`}>
            <div className={styles.antenna} />
            <div className={styles.head}>
              <div className={styles.visor} />
            </div>
            <div className={styles.body} />
            <div className={styles.arm} />
            <div className={`${styles.arm} ${styles.right}`} />
            <div className={styles.beam} />
            <div className={styles.treads} />
          </div>
        </div>

        <div className={styles.ground} />
        <div className={styles.barricade} />
      </div>

      <footer className={styles.foot}>
        <span>© CUEPOINT · 2026</span>
        <span>STATUS: BUILDING · ETA: SOON</span>
      </footer>
    </div>
  );
}
