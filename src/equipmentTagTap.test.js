import assert from "node:assert/strict";
import test from "node:test";
import { parseEquipmentTagUrl, publicTarget, resolveEquipmentTagOpen } from "./equipmentTagTap.js";

const id = "abcdefghjk";
const tap = `https://cuepointplanning.com/t/${id}`;

test("parses the production tag URL and the visitor query", () => {
  assert.deepEqual(parseEquipmentTagUrl(tap), { id, asVisitor: false });
  assert.deepEqual(parseEquipmentTagUrl(`https://www.cuepointplanning.com/t/${id}/?as=visitor`), {
    id,
    asVisitor: true,
  });
  assert.equal(parseEquipmentTagUrl("https://example.com/t/abcdefghjk"), null);
  assert.equal(parseEquipmentTagUrl("https://cuepointplanning.com/t/short"), null);
  assert.equal(parseEquipmentTagUrl("https://cuepointplanning.com/app"), null);
  assert.equal(parseEquipmentTagUrl("http://cuepointplanning.com/t/abcdefghjk"), null);
});

test("a signed-in owner opens the in-app destination", () => {
  assert.deepEqual(
    resolveEquipmentTagOpen({
      rawUrl: tap,
      signedIn: true,
      ownerTag: { inApp: { kind: "internal" } },
    }),
    { type: "hash", hash: `#/equipment-tag/${id}/work` },
  );
  assert.deepEqual(
    resolveEquipmentTagOpen({
      rawUrl: tap,
      signedIn: true,
      ownerTag: { inApp: { kind: "external", url: "https://example.com/manual" } },
    }),
    { type: "external", url: "https://example.com/manual" },
  );
});

test("visitor mode and signed-out phones stay on the public destination", () => {
  const ownerTag = { inApp: { kind: "external", url: "https://example.com/secret" } };
  assert.deepEqual(
    resolveEquipmentTagOpen({
      rawUrl: `${tap}?as=visitor`,
      signedIn: true,
      ownerTag,
      publicLocation: `https://cuepointplanning.com/app#/equipment-tag/${id}`,
    }),
    { type: "hash", hash: `#/equipment-tag/${id}` },
  );
  assert.deepEqual(
    resolveEquipmentTagOpen({
      rawUrl: tap,
      signedIn: false,
      ownerTag,
      publicLocation: "https://example.com/visitor",
    }),
    { type: "external", url: "https://example.com/visitor" },
  );
  assert.deepEqual(publicTarget(id, ""), {
    type: "hash",
    hash: `#/equipment-tag/${id}`,
  });
});

test("a public redirect cannot open the operator view or a script URL", () => {
  assert.deepEqual(
    publicTarget(id, `https://cuepointplanning.com/app#/equipment-tag/${id}/work`),
    { type: "hash", hash: `#/equipment-tag/${id}` },
  );
  assert.deepEqual(publicTarget(id, "javascript:alert(1)"), {
    type: "hash",
    hash: `#/equipment-tag/${id}`,
  });
  assert.deepEqual(publicTarget(id, "https://cuepointplanning.com/gear-manual"), {
    type: "external",
    url: "https://cuepointplanning.com/gear-manual",
  });
  assert.deepEqual(publicTarget(id, "https://cuepointplanning.com/app"), {
    type: "hash",
    hash: `#/equipment-tag/${id}`,
  });
  assert.deepEqual(publicTarget(id, `/app#/equipment-tag/${id}`), {
    type: "hash",
    hash: `#/equipment-tag/${id}`,
  });
});
