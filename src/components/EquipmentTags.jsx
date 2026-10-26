import { useEffect, useState } from "react";
import { BRAND_ACCENT, BRAND_FONT, BRAND_INK, BRAND_RADIUS, LIGHT_THEME as C } from "../brand";
import {
  deleteEquipmentTag,
  describeDestination,
  fetchEquipmentTag,
  listEquipmentTags,
  saveEquipmentTag,
  syncOperatorCookie,
  tagTapUrl,
  tagUrlHostWarning,
} from "../equipmentTagsApi";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: BRAND_FONT,
  fontSize: 16,
  padding: "12px 14px",
  borderRadius: BRAND_RADIUS.field,
  border: `1px solid ${C.border}`,
  background: C.surfaceAlt,
  color: C.text,
};

function Banner({ title, children }) {
  return (
    <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: C.text }}>{children}</div>
    </div>
  );
}

function TextButton({ children, onClick, variant = "primary", type = "button", disabled }) {
  const styles = {
    primary: { background: BRAND_ACCENT, color: "#fff", border: "none" },
    outline: { background: C.surfaceAlt, color: BRAND_INK, border: `1px solid ${C.border}` },
    danger: { background: C.surfaceAlt, color: C.red, border: `1px solid ${C.red}55` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        fontFamily: BRAND_FONT,
        fontWeight: 800,
        fontSize: 15,
        minHeight: 44,
        padding: "10px 16px",
        borderRadius: BRAND_RADIUS.pill,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function DestinationFields({
  legend,
  help,
  kindName,
  urlId,
  kind,
  onKind,
  url,
  onUrl,
  internalLabel,
  error,
}) {
  return (
    <fieldset style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, margin: 0 }}>
      <legend style={{ padding: "0 6px", fontWeight: 800, fontSize: 14 }}>{legend}</legend>
      <p style={{ margin: "0 0 10px", color: C.muted, fontSize: 14, lineHeight: 1.5 }}>{help}</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, fontSize: 15 }}>
        <input type="radio" name={kindName} checked={kind === "internal"} onChange={() => onKind("internal")} />
        <span>{internalLabel}</span>
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15 }}>
        <input type="radio" name={kindName} checked={kind === "external"} onChange={() => onKind("external")} />
        <span>An external URL</span>
      </label>
      {kind === "external" ? (
        <div style={{ marginTop: 12 }}>
          <label htmlFor={urlId} style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>URL</label>
          <input
            id={urlId}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/manual"
            value={url}
            onChange={(event) => onUrl(event.target.value)}
            aria-invalid={error ? true : undefined}
            style={fieldStyle}
          />
          {error ? <p style={{ color: C.red, fontSize: 13, margin: "6px 0 0" }}>{error}</p> : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function TagForm({ mode, tag, gear = [], onSaved }) {
  const [name, setName] = useState(tag?.name || "");
  const [note, setNote] = useState(tag?.note || "");
  const [inAppKind, setInAppKind] = useState(tag?.inApp?.kind || "internal");
  const [publicKind, setPublicKind] = useState(tag?.publicDestination?.kind || "internal");
  const [inAppUrl, setInAppUrl] = useState(tag?.inApp?.kind === "external" ? tag.inApp.url : "");
  const [publicUrl, setPublicUrl] = useState(tag?.publicDestination?.kind === "external" ? tag.publicDestination.url : "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const prefix = tag?.id || "new";

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFormError("");
    setErrors({});
    const input = {
      name,
      note,
      inApp: inAppKind === "external" ? { kind: "external", url: inAppUrl } : { kind: "internal" },
      publicDestination: publicKind === "external" ? { kind: "external", url: publicUrl } : { kind: "internal" },
    };
    try {
      const saved = await saveEquipmentTag(input, tag?.id);
      onSaved(saved);
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.fieldErrors ? "" : (error.message || "Could not save this tag."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {formError ? <Banner title="Not saved">{formError}</Banner> : null}
      {mode === "create" && gear.length > 0 ? (
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Start from gear you already track</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const item = gear.find((piece) => String(piece.id) === event.target.value);
              if (item?.name) setName(item.name);
            }}
            style={fieldStyle}
          >
            <option value="">None</option>
            {[...gear].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div>
        <label htmlFor={`${prefix}-name`} style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>Equipment name</label>
        <input
          id={`${prefix}-name`}
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="QSC K12 — left"
          aria-invalid={errors.name ? true : undefined}
          style={fieldStyle}
        />
        <p style={{ color: C.muted, fontSize: 13, margin: "6px 0 0" }}>Shown on the operator view and on the visitor page.</p>
        {errors.name ? <p style={{ color: C.red, fontSize: 13 }}>{errors.name}</p> : null}
      </div>
      <div>
        <label htmlFor={`${prefix}-note`} style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>Short note</label>
        <textarea
          id={`${prefix}-note`}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="XLR is in the back pocket. Spare fuse is taped inside the lid."
          style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }}
        />
        <p style={{ color: C.muted, fontSize: 13, margin: "6px 0 0" }}>Only the signed-in owner sees this note. Visitors never do.</p>
        {errors.note ? <p style={{ color: C.red, fontSize: 13 }}>{errors.note}</p> : null}
      </div>
      <DestinationFields
        legend="In-app destination"
        help="What you see when you open this tag inside CuePoint. Phone taps never use this."
        kindName={`${prefix}-in-app-kind`}
        urlId={`${prefix}-in-app-url`}
        kind={inAppKind}
        onKind={setInAppKind}
        url={inAppUrl}
        onUrl={setInAppUrl}
        internalLabel="This app — the equipment details page for this tag"
        error={errors.inAppUrl}
      />
      <DestinationFields
        legend="NFC / phone-tap destination"
        help="Where the NFC URL goes for every tap — Safari, Chrome, or any phone. Set your external link here."
        kindName={`${prefix}-public-kind`}
        urlId={`${prefix}-public-url`}
        kind={publicKind}
        onKind={setPublicKind}
        url={publicUrl}
        onUrl={setPublicUrl}
        internalLabel="This app — a visitor page with the equipment name only"
        error={errors.publicUrl}
      />
      <TextButton type="submit" disabled={pending}>
        {pending ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create tag" : "Save changes")}
      </TextButton>
    </form>
  );
}

function CopyUrl({ url }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const warning = tagUrlHostWarning();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input readOnly value={url} aria-label="NFC URL" onFocus={(event) => event.target.select()} style={{ ...fieldStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14 }} />
        <TextButton variant="outline" onClick={copy}>{copied ? "Copied" : "Copy URL"}</TextButton>
      </div>
      {failed ? <p style={{ color: C.red, fontSize: 13 }}>Clipboard access failed. Select the URL and copy it manually.</p> : null}
      {warning ? <p style={{ color: C.orange, fontSize: 13, lineHeight: 1.45 }}>{warning}</p> : null}
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: BRAND_FONT }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 18px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </main>
    </div>
  );
}

export function EquipmentTagsPanel({ gear = [] }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [browserReady, setBrowserReady] = useState(false);
  const [browserNote, setBrowserNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await syncOperatorCookie();
      if (cancelled) return;
      setBrowserReady(!!session.ok);
      setBrowserNote(session.ok ? "" : (session.error || ""));
      try {
        const next = await listEquipmentTags();
        if (!cancelled) setTags(next);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load tags.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>One NFC URL per item</div>
        <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.55 }}>
          The tag stores only <strong style={{ color: C.text }}>/t/…</strong>. Any regular tap on a phone opens the NFC destination you set (usually your external link). Equipment details show only when you open the tag inside CuePoint.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: browserReady ? C.green : C.orange }}>
          {browserReady
            ? "Signed in — you can manage tags and open equipment details in the app."
            : (browserNote || "Sign in to manage tags. Phone taps still open the NFC destination.")}
        </p>
      </div>

      {loading ? <p style={{ color: C.muted }}>Loading tags…</p> : null}
      {error ? <Banner title="Tags didn’t load">{error}</Banner> : null}

      {!loading && tags.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>No tags yet</div>
          <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>Add a name below. You will get one URL to write onto an NFC tag as a URI record.</p>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tags.map((tag) => (
          <a
            key={tag.id}
            href={`#/equipment-tag/${tag.id}/work`}
            style={{ display: "block", textDecoration: "none", color: "inherit", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}
          >
            <div style={{ fontWeight: 800, fontSize: 17 }}>{tag.name}</div>
            <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>{tag.note || "No note on this tag."}</div>
            <div style={{ fontSize: 13, marginTop: 8, wordBreak: "break-all" }}>
              <span style={{ color: C.muted }}>In CuePoint: </span>{describeDestination(tag.inApp, "inApp")}
            </div>
            <div style={{ fontSize: 13, wordBreak: "break-all" }}>
              <span style={{ color: C.muted }}>NFC tap: </span>{describeDestination(tag.publicDestination, "public")}
            </div>
            <div style={{ marginTop: 10, color: BRAND_ACCENT, fontWeight: 800, fontSize: 14 }}>Open tag</div>
          </a>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Add equipment</div>
        <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
          Both start as internal pages. Set the NFC destination to an external URL so phone taps leave CuePoint.
        </p>
        <TagForm
          mode="create"
          gear={gear || []}
          onSaved={(saved) => { window.location.hash = `#/equipment-tag/${saved.id}/work?created=1`; }}
        />
      </div>
    </div>
  );
}

export function EquipmentTagPublicPage({ id }) {
  const [tag, setTag] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEquipmentTag(id, { owner: false })
      .then((next) => { if (!cancelled) setTag(next); })
      .catch((error) => { if (!cancelled && error.status === 404) setMissing(true); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <PageShell>
      <p style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12, fontWeight: 800, color: C.muted, margin: 0 }}>Public page</p>
      {missing ? <h1 style={{ fontSize: 32, margin: 0 }}>No tag uses this address</h1> : null}
      {!missing && !tag ? <p style={{ color: C.muted }}>Loading this equipment…</p> : null}
      {tag ? (
        <>
          <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: 0 }}>{tag.name}</h1>
          <p style={{ margin: 0, color: C.muted, fontSize: 16, lineHeight: 1.5, maxWidth: 520 }}>
            This is the visitor page for this equipment. It shows the name only. Notes and destinations are not on this page.
          </p>
        </>
      ) : null}
      <a href="#equipment" style={{ color: BRAND_ACCENT, fontWeight: 800 }}>Back to CuePoint</a>
    </PageShell>
  );
}

export function EquipmentTagWorkPage({ id }) {
  const [tag, setTag] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  function load() {
    return fetchEquipmentTag(id, { owner: true })
      .then((next) => {
        setTag(next);
        setMissing(false);
      })
      .catch((err) => {
        if (err.status === 404) setMissing(true);
        else setError(err.message || "Could not load this tag.");
      });
  }

  useEffect(() => {
    const query = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(query);
    if (params.get("created") === "1") setBanner("created");
    if (params.get("saved") === "1") setBanner("saved");
    load();
  }, [id]);

  const owner = tag && Object.prototype.hasOwnProperty.call(tag, "note");
  const nfcUrl = tag ? tagTapUrl(tag.id) : "";

  async function remove() {
    setPendingDelete(true);
    try {
      await deleteEquipmentTag(id);
      window.location.hash = "equipment";
    } catch (err) {
      setError(err.message || "Could not delete this tag.");
      setPendingDelete(false);
    }
  }

  return (
    <PageShell>
      <p style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12, fontWeight: 800, color: C.muted, margin: 0 }}>Operator view</p>
      {missing ? <h1 style={{ margin: 0 }}>That tag is no longer in CuePoint</h1> : null}
      {!tag && !missing ? <p style={{ color: C.muted }}>Loading the operator view…</p> : null}
      {error ? <Banner title="Something went wrong">{error}</Banner> : null}
      {tag && !owner ? (
        <>
          <h1 style={{ fontSize: 32, margin: 0 }}>{tag.name}</h1>
          <p style={{ margin: 0, color: C.muted, lineHeight: 1.5 }}>
            This screen is for the CuePoint account that owns the tag. Sign in with that account in this browser, then open the tag again. Visitors only see the name.
          </p>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.setItem("cuepoint_tag_return", `#/equipment-tag/${id}/work`); } catch { /* ignore */ }
              window.location.hash = "";
              window.location.reload();
            }}
            style={{ background: "none", border: "none", padding: 0, color: BRAND_ACCENT, fontWeight: 800, fontFamily: BRAND_FONT, fontSize: 15, cursor: "pointer", textAlign: "left" }}
          >
            Sign in to CuePoint
          </button>
          <a href={`#/equipment-tag/${id}`} style={{ color: BRAND_ACCENT, fontWeight: 800 }}>Open the public page</a>
        </>
      ) : null}
      {owner ? (
        <>
          <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: 0 }}>{tag.name}</h1>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.5 }}>{tag.note || "No note on this tag."}</p>
          <a href="#equipment" style={{ color: BRAND_ACCENT, fontWeight: 800 }}>All equipment</a>
          {banner === "created" ? (
            <Banner title="Tag created">Copy the NFC URL below and write that full address onto the tag as a URI record.</Banner>
          ) : null}
          {banner === "saved" ? (
            <Banner title="Saved">The NFC URL did not change. Only the name, note, or destinations were updated.</Banner>
          ) : null}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Destinations</h2>
            <p style={{ margin: "0 0 8px", color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              The tag only stores the NFC URL. Every phone tap follows the NFC destination. Equipment details stay in CuePoint.
            </p>
            <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: 14 }}><span style={{ color: C.muted }}>In CuePoint: </span>{describeDestination(tag.inApp, "inApp")}</p>
            <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: 14 }}><span style={{ color: C.muted }}>NFC tap: </span>{describeDestination(tag.publicDestination, "public")}</p>
          </section>
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>NFC URL</h2>
            <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              Write this full URL to the tag as an NDEF URI record. Any phone tap opens the NFC destination above — not this equipment details page.
            </p>
            <CopyUrl url={nfcUrl} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a href={tagTapUrl(tag.id)} style={{ textDecoration: "none", background: BRAND_ACCENT, color: "#fff", fontWeight: 800, fontSize: 15, minHeight: 44, padding: "10px 16px", borderRadius: BRAND_RADIUS.pill, display: "inline-flex", alignItems: "center" }}>Try the NFC link</a>
            </div>
            <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              This follows the same path a phone tap uses. You are already on the in-app equipment details for this tag.
            </p>
          </section>
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Edit</h2>
            <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 14 }}>Changing a destination does not change the URL written on the tag.</p>
            <TagForm
              mode="edit"
              tag={tag}
              onSaved={async () => {
                setBanner("saved");
                await load();
              }}
            />
          </section>
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Delete</h2>
            <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 14 }}>The NFC URL will stop matching equipment in CuePoint.</p>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TextButton variant="danger" disabled={pendingDelete} onClick={remove}>
                  {pendingDelete ? "Deleting…" : `Delete ${tag.name}`}
                </TextButton>
                <TextButton variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</TextButton>
              </div>
            ) : (
              <TextButton variant="danger" onClick={() => setConfirmDelete(true)}>Delete</TextButton>
            )}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
