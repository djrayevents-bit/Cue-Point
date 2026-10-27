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
      equipmentId: tag?.equipmentId || "",
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
        help="Where this phone goes after a tap, when this CuePoint account is signed in here."
        kindName={`${prefix}-in-app-kind`}
        urlId={`${prefix}-in-app-url`}
        kind={inAppKind}
        onKind={setInAppKind}
        url={inAppUrl}
        onUrl={setInAppUrl}
        internalLabel="This app — the operator page for this tag"
        error={errors.inAppUrl}
      />
      <DestinationFields
        legend="Public destination"
        help="Where every other phone goes when it taps the same tag."
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
          The tag stores only <strong style={{ color: C.text }}>/t/…</strong>. In the Safari window where this CuePoint account is signed in, a tap opens the in-app destination. Every other phone opens the public destination. An iPhone tap opens Safari, so sign in with Safari on the phone you use at the gig — not a different browser on that phone.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: browserReady ? C.green : C.orange }}>
          {browserReady
            ? "This browser will open in-app destinations for your tags."
            : (browserNote || "This browser still opens the public destination.")}
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
              <span style={{ color: C.muted }}>In-app: </span>{describeDestination(tag.inApp, "inApp")}
            </div>
            <div style={{ fontSize: 13, wordBreak: "break-all" }}>
              <span style={{ color: C.muted }}>Public: </span>{describeDestination(tag.publicDestination, "public")}
            </div>
            <div style={{ marginTop: 10, color: BRAND_ACCENT, fontWeight: 800, fontSize: 14 }}>Open tag</div>
          </a>
        ))}
      </div>

    </div>
  );
}

function destinationUrl(destination) {
  return destination && destination.kind === "external" ? destination.url : "";
}

function LinkField({ label, help, value, onChange, copyValue, error }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue || value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <p style={{ margin: "0 0 8px", color: C.muted, fontSize: 13, lineHeight: 1.45 }}>{help}</p>
      <input
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={copyValue || "https://"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        style={fieldStyle}
      />
      {error ? <p style={{ color: C.red, fontSize: 13, margin: "6px 0 0" }}>{error}</p> : null}
      <div style={{ marginTop: 8 }}>
        <TextButton variant="outline" onClick={copy}>{copied ? "Copied" : "Copy link"}</TextButton>
      </div>
    </div>
  );
}

export function EquipmentNfcModal({ item, onClose }) {
  const [tag, setTag] = useState(null);
  const [inAppUrl, setInAppUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await syncOperatorCookie();
        const tags = await listEquipmentTags();
        if (cancelled) return;
        const equipmentId = String(item.id);
        let match = tags.find((row) => String(row.equipmentId || "") === equipmentId);
        if (!match) {
          match = await saveEquipmentTag({
            name: item.name || "Equipment",
            note: "",
            equipmentId,
            inApp: { kind: "internal" },
            publicDestination: { kind: "internal" },
          });
        }
        if (cancelled) return;
        setTag(match);
        setInAppUrl(destinationUrl(match.inApp) || tagTapUrl(match.id));
        setPublicUrl(destinationUrl(match.publicDestination) || tagTapUrl(match.id, true));
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open NFC for this equipment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id, item.name]);

  async function save(event) {
    event.preventDefault();
    if (!tag) return;
    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      const inAppTap = tagTapUrl(tag.id);
      const publicTap = tagTapUrl(tag.id, true);
      const inAppTrimmed = inAppUrl.trim();
      const publicTrimmed = publicUrl.trim();
      const saved = await saveEquipmentTag({
        name: item.name || tag.name,
        note: tag.note || "",
        equipmentId: String(item.id),
        inApp: !inAppTrimmed || inAppTrimmed === inAppTap ? { kind: "internal" } : { kind: "external", url: inAppTrimmed },
        publicDestination: !publicTrimmed || publicTrimmed === publicTap ? { kind: "internal" } : { kind: "external", url: publicTrimmed },
      }, tag.id);
      setTag(saved);
      setInAppUrl(destinationUrl(saved.inApp) || tagTapUrl(saved.id));
      setPublicUrl(destinationUrl(saved.publicDestination) || tagTapUrl(saved.id, true));
      onClose();
    } catch (err) {
      setFieldErrors(err.fieldErrors || {});
      setError(err.fieldErrors ? "" : (err.message || "Could not save these links."));
    } finally {
      setPending(false);
    }
  }

  const inAppLink = inAppUrl.trim() || (tag ? tagTapUrl(tag.id) : "");
  const publicLink = publicUrl.trim() || (tag ? tagTapUrl(tag.id, true) : "");
  const hostWarning = tagUrlHostWarning();

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15, 15, 20, 0.45)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
        style={{ width: "min(520px, 100%)", background: C.surface, borderRadius: 18, padding: 22, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>NFC</div>
          <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{item.name}</h3>
        </div>
        {loading ? <p style={{ color: C.muted, margin: 0 }}>Opening this tag…</p> : null}
        {error ? <Banner title="NFC">{error}</Banner> : null}
        {tag ? (
          <>
            <LinkField
              label="In-app link"
              help="Opens when this CuePoint account is signed in on the phone that taps the tag."
              value={inAppUrl}
              onChange={setInAppUrl}
              copyValue={inAppLink}
              error={fieldErrors.inAppUrl}
            />
            <LinkField
              label="Public link"
              help="Opens for every other phone."
              value={publicUrl}
              onChange={setPublicUrl}
              copyValue={publicLink}
              error={fieldErrors.publicUrl}
            />
            {hostWarning ? <p style={{ color: C.orange, fontSize: 13, lineHeight: 1.45, margin: 0 }}>{hostWarning}</p> : null}
          </>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <TextButton variant="outline" onClick={onClose}>Close</TextButton>
          <TextButton type="submit" disabled={pending || loading || !tag}>{pending ? "Saving…" : "Save links"}</TextButton>
        </div>
      </form>
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
              The tag itself only stores the NFC URL. CuePoint chooses the destination from the account signed in on the phone.
            </p>
            <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: 14 }}><span style={{ color: C.muted }}>In-app: </span>{describeDestination(tag.inApp, "inApp")}</p>
            <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: 14 }}><span style={{ color: C.muted }}>Public: </span>{describeDestination(tag.publicDestination, "public")}</p>
          </section>
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>NFC URL</h2>
            <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              Write this full URL to the tag as an NDEF URI record. It is the only address the tag should open.
            </p>
            <CopyUrl url={nfcUrl} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a href={tagTapUrl(tag.id)} style={{ textDecoration: "none", background: BRAND_ACCENT, color: "#fff", fontWeight: 800, fontSize: 15, minHeight: 44, padding: "10px 16px", borderRadius: BRAND_RADIUS.pill, display: "inline-flex", alignItems: "center" }}>Open as me</a>
              <a href={tagTapUrl(tag.id, true)} style={{ textDecoration: "none", background: C.surfaceAlt, color: BRAND_INK, border: `1px solid ${C.border}`, fontWeight: 800, fontSize: 15, minHeight: 44, padding: "10px 16px", borderRadius: BRAND_RADIUS.pill, display: "inline-flex", alignItems: "center" }}>Open as a visitor</a>
            </div>
            <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              Open as a visitor forces the public destination even though this browser is signed in. Open as me follows the in-app destination. On one phone, use both buttons to try both taps.
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
