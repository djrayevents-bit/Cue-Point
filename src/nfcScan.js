import { Capacitor } from "@capacitor/core";

const URI_PREFIXES = [
  "",
  "http://www.",
  "https://www.",
  "http://",
  "https://",
  "tel:",
  "mailto:",
  "ftp://anonymous:anonymous@",
  "ftp://ftp.",
  "ftps://",
  "sftp://",
  "smb://",
  "nfs://",
  "ftp://",
  "dav://",
  "news:",
  "telnet://",
  "imap:",
  "rtsp://",
  "urn:",
  "pop:",
  "sip:",
  "sips:",
  "tftp:",
  "btspp://",
  "btl2cap://",
  "btgoep://",
  "tcpobex://",
  "irdaobex://",
  "file://",
  "urn:epc:id:",
  "urn:epc:tag:",
  "urn:epc:pat:",
  "urn:epc:raw:",
  "urn:epc:",
  "urn:nfc:",
];

function bytesToString(bytes) {
  try {
    return new TextDecoder().decode(Uint8Array.from(bytes || []));
  } catch {
    return "";
  }
}

function typeString(record) {
  const type = record?.type;
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return String.fromCharCode(...type);
  return "";
}

function errMessage(err) {
  if (!err) return "Couldn’t start NFC.";
  if (typeof err === "string") return err;
  return err.message || err.errorMessage || err.code || "Couldn’t start NFC.";
}

/** Decode a single NDEF record into a URL string when possible. */
export function decodeNdefUri(record) {
  if (!record) return "";
  const tnf = Number(record.tnf);
  const type = typeString(record);
  const payload = Array.isArray(record.payload) ? record.payload : [];

  if (tnf === 3) return bytesToString(payload).trim();

  if ((tnf === 1 || tnf === 0x01) && (type === "U" || type === "u")) {
    const code = payload[0] || 0;
    const prefix = URI_PREFIXES[code] || "";
    return `${prefix}${bytesToString(payload.slice(1))}`.trim();
  }

  if ((tnf === 1 || tnf === 0x01) && (type === "T" || type === "t") && payload.length > 1) {
    const langLen = payload[0] & 0x3f;
    return bytesToString(payload.slice(1 + langLen)).trim();
  }

  const raw = bytesToString(payload).trim();
  if (/^https?:\/\//i.test(raw) || /\/t\/[a-z0-9]{10}/i.test(raw)) return raw;
  return "";
}

export function extractEquipmentTagId(urlOrText) {
  const s = String(urlOrText || "");
  const match = s.match(/\/t\/([a-z0-9]{10})/i)
    || s.match(/equipment-tag\/([a-z0-9]{10})/i);
  return match ? match[1] : null;
}

export function extractEquipmentTagIdFromNfcEvent(event) {
  const records = event?.tag?.ndefMessage || [];
  for (const record of records) {
    const id = extractEquipmentTagId(decodeNdefUri(record));
    if (id) return id;
  }
  return null;
}

export function canUseNativeNfc() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Start a native NFC read session (iOS Core NFC / Android).
 * Calls onTagId(id) when a CuePoint gear tag is read.
 * Returns a stop() function.
 */
export async function startNativeNfcScan({ onTagId, onError, alertMessage } = {}) {
  if (!canUseNativeNfc()) {
    const err = new Error("Open Gear pack in the CuePoint iPhone app to scan tags.");
    onError?.(err);
    throw err;
  }

  const { CapacitorNfc } = await import("@capgo/capacitor-nfc");

  let listener;
  let stopped = false;
  let reported = false;

  const report = (err) => {
    if (reported) return;
    reported = true;
    onError?.(err instanceof Error ? err : new Error(errMessage(err)));
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await listener?.remove?.(); } catch { /* ignore */ }
    try { await CapacitorNfc.stopScanning(); } catch { /* ignore */ }
  };

  try {
    // Confirm the native plugin is actually linked (web stub returns 0.0.0-web).
    const ver = await CapacitorNfc.getPluginVersion?.().catch(() => null);
    const version = ver?.version || "";
    if (!version || String(version).includes("web")) {
      const err = new Error("NFC isn’t linked in this install. Rebuild from Xcode (Product → Clean Build Folder, then Run).");
      report(err);
      throw err;
    }

    const supported = await CapacitorNfc.isSupported?.().catch(() => null);
    if (supported && supported.supported === false) {
      const err = new Error("This device doesn’t support NFC tag reading.");
      report(err);
      throw err;
    }

    // getStatus returns { status: 'NFC_OK' | ... }, not a bare string.
    const statusResult = await CapacitorNfc.getStatus?.().catch(() => null);
    const status = statusResult?.status || statusResult;
    if (status === "NFC_DISABLED") {
      const err = new Error("Turn on NFC in Settings, then try again.");
      report(err);
      throw err;
    }

    listener = await CapacitorNfc.addListener("nfcEvent", (event) => {
      const id = extractEquipmentTagIdFromNfcEvent(event);
      if (!id) {
        report(new Error("That tag isn’t a CuePoint gear tag."));
        reported = false; // allow another attempt while session stays open
        return;
      }
      onTagId?.(id);
    });

    await CapacitorNfc.startScanning({
      invalidateAfterFirstRead: false,
      alertMessage: alertMessage || "Hold the top of your iPhone near the gear tag.",
      iosSessionType: "ndef",
    });
  } catch (err) {
    await stop();
    const msg = errMessage(err);
    let friendly = msg;
    if (/browser environment|not implemented|unimplemented/i.test(msg)) {
      friendly = "NFC isn’t linked in this install. Rebuild from Xcode, then try Scan tag again.";
    } else if (/not available on this device|NO_NFC/i.test(msg)) {
      friendly = "iPhone couldn’t start NFC. In Xcode → Signing & Capabilities, add “Near Field Communication Tag Reading”, then Run again.";
    }
    const wrapped = new Error(friendly);
    report(wrapped);
    throw wrapped;
  }

  return stop;
}
