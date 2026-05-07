import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import styles from './DayOfModeComingSoon.module.css';

// D.O.M. "Coming Soon" placeholder
// Renders when users click the Day of Mode tab while the feature is still in development.
// Converted from /public D.O.M. standalone HTML, scoped via CSS modules.

export default function DayOfModeComingSoon() {
  const [notified, setNotified] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('cuepoint_domNotifyRequested') === 'true') {
      setNotified(true);
    }
  }, []);

  const handleNotify = async () => {
    setIsSending(true);
    setError(null);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const user = session?.user;
      if (sessErr || !user?.email || !session?.access_token) {
        throw new Error('Could not verify your session. Refresh and try again.');
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: 'ivstudiogroup@gmail.com',
          subject: `[D.O.M. Interest] ${user.email}`,
          html: `
            <h2 style="font-family:system-ui,sans-serif;margin:0 0 12px">D.O.M. Notification Request</h2>
            <p style="font-family:system-ui,sans-serif;margin:0 0 16px;color:#444">A user wants to be notified when Day of Mode launches.</p>
            <table style="font-family:system-ui,sans-serif;border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0;font-weight:600">${user.email}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">User ID</td><td style="padding:4px 0;font-family:monospace;font-size:13px">${user.id}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Requested</td><td style="padding:4px 0">${new Date().toISOString()}</td></tr>
            </table>
          `,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status})`);
      }

      localStorage.setItem('cuepoint_domNotifyRequested', 'true');
      setNotified(true);
    } catch (err) {
      setError(err.message || 'Could not save your request. Try again?');
    } finally {
      setIsSending(false);
    }
  };

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

      <div className={styles.main}>
        <span className={styles.eyebrow}>Feature in development</span>
        <h1 className={styles.h1}>
          <span className={styles.amp}>D.O.M.</span>
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

        {notified ? (
          <div style={{ marginTop: 24, color: '#3aa0e8', fontWeight: 600, fontSize: 15, letterSpacing: '0.02em' }}>
            ✓ You'll be notified when it's ready
          </div>
        ) : (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleNotify}
              disabled={isSending}
              style={{
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: '#fff',
                background: isSending
                  ? 'linear-gradient(135deg, #8ab8d8 0%, #6a9bc0 100%)'
                  : 'linear-gradient(135deg, #3aa0e8 0%, #1f7cc2 100%)',
                border: 'none',
                borderRadius: 10,
                cursor: isSending ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(58, 160, 232, 0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (isSending) return;
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(58, 160, 232, 0.35)';
              }}
              onMouseLeave={(e) => {
                if (isSending) return;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(58, 160, 232, 0.25)';
              }}
            >
              {isSending ? 'Saving…' : "Notify me when it's ready"}
            </button>
            {error && (
              <div style={{ color: '#c0392b', fontSize: 13, maxWidth: 360 }}>
                {error}
              </div>
            )}
          </div>
        )}
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
