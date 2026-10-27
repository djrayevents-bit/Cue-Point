export const PACK_LISTEN_KEY = "cuepoint_pack_listen";

export function readPackListen() {
  try {
    const data = JSON.parse(sessionStorage.getItem(PACK_LISTEN_KEY) || "null");
    if (!data || data.eventId == null) return null;
    return {
      eventId: data.eventId,
      leg: data.leg === "toHome" ? "toHome" : "toEvent",
    };
  } catch {
    return null;
  }
}

export function writePackListen(eventId, leg) {
  try {
    sessionStorage.setItem(PACK_LISTEN_KEY, JSON.stringify({
      eventId,
      leg: leg === "toHome" ? "toHome" : "toEvent",
    }));
  } catch { /* ignore */ }
}

export function clearPackListen() {
  try { sessionStorage.removeItem(PACK_LISTEN_KEY); } catch { /* ignore */ }
}

export function gearPackLists(ev) {
  const pack = ev?.gearPack || {};
  const toEvent = Array.isArray(pack.toEvent) ? pack.toEvent : (ev?.gearPackedIds || []);
  const toHome = Array.isArray(pack.toHome) ? pack.toHome : [];
  return { toEvent, toHome };
}

export function idsInclude(ids, id) {
  return (ids || []).some((row) => String(row) === String(id));
}

const EQUIPMENT_CATEGORY_ORDER = [
  "Speakers", "Subwoofers", "Mixers", "Controllers", "Lighting",
  "Microphones", "Cables & Stands", "Laptops", "DJ Accessories", "Other", "Uncategorized",
];

/** Group inventory or a pack list into category sections, in a stable order. */
export function groupEquipmentByCategory(items, categoryOrder = EQUIPMENT_CATEGORY_ORDER) {
  const buckets = new Map();
  (items || []).forEach((item) => {
    const category = String(item?.category || "").trim() || "Uncategorized";
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(item);
  });
  const rank = (name) => {
    const index = categoryOrder.indexOf(name);
    return index === -1 ? categoryOrder.length : index;
  };
  return [...buckets.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, rows]) => ({
      category,
      items: rows.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    }));
}

export function withItemLoaded(ev, equipmentId, leg, loaded) {
  const lists = gearPackLists(ev);
  const key = leg === "toHome" ? "toHome" : "toEvent";
  const current = lists[key];
  const next = loaded
    ? (idsInclude(current, equipmentId) ? current : [...current, equipmentId])
    : current.filter((row) => String(row) !== String(equipmentId));
  const gearPack = {
    toEvent: key === "toEvent" ? next : lists.toEvent,
    toHome: key === "toHome" ? next : lists.toHome,
  };
  return { ...ev, gearPack, gearPackedIds: gearPack.toEvent };
}

export function packReceiveFromHash(hash) {
  const match = String(hash || "").match(/^#\/equipment-tag\/([a-z0-9]{10})\/work/);
  if (!match) return null;
  const listen = readPackListen();
  if (!listen) return null;
  return { tagId: match[1], ...listen };
}
