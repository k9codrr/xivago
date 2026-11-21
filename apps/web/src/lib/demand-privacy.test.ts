import { test } from "node:test";
import assert from "node:assert/strict";
import { ANONYMOUS_AUTHOR_NAME, canSeeDemandAuthor, maskDemandAuthor } from "@/lib/demand-privacy";

const demand = {
  id: "d1",
  summary: "Need a lawyer",
  authorId: "author",
  author: {
    id: "author",
    name: "Real Name",
    avatarUrl: "https://example.com/me.png",
    companyName: "Real Co",
    companyLogo: "https://example.com/logo.png",
    bio: "About me",
    location: "Pune",
    trust: [{ tier: "GOLD" }],
  },
  bids: [{ slot: 1, bidder: { id: "holder", name: "Holder", avatarUrl: null } }],
};

test("canSeeDemandAuthor: only the poster, an admin or a slot holder", () => {
  assert.equal(canSeeDemandAuthor(demand, { id: "author" }), true);
  assert.equal(canSeeDemandAuthor(demand, { id: "holder" }), true);
  assert.equal(canSeeDemandAuthor(demand, { id: "someone", isAdmin: true }), true);
  assert.equal(canSeeDemandAuthor(demand, { id: "someone" }), false);
  assert.equal(canSeeDemandAuthor(demand, null), false);
});

test("maskDemandAuthor: no identifying value reaches a viewer without a slot", () => {
  const masked = maskDemandAuthor(demand, { id: "someone" });
  assert.equal(masked.authorHidden, true);
  assert.equal(masked.author.name, ANONYMOUS_AUTHOR_NAME);
  const json = JSON.stringify(masked);
  for (const secret of ["Real Name", "me.png", "Real Co", "logo.png", "About me"]) {
    assert.ok(!json.includes(secret), `leaked ${secret}`);
  }
  assert.equal(masked.authorId, "");
  assert.equal(masked.author.id, "");
});

test("maskDemandAuthor: keeps what isn't identity", () => {
  const masked = maskDemandAuthor(demand, null);
  assert.equal(masked.summary, "Need a lawyer");
  assert.equal(masked.author.location, "Pune");
  assert.deepEqual(masked.author.trust, [{ tier: "GOLD" }]);
  assert.equal(masked.bids.length, 1);
});

test("maskDemandAuthor: a viewer with access gets the demand unchanged", () => {
  const seen = maskDemandAuthor(demand, { id: "holder" });
  assert.equal(seen.authorHidden, false);
  assert.deepEqual(seen.author, demand.author);
  assert.equal(seen.authorId, "author");
});
