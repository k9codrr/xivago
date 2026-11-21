import test from "node:test";
import assert from "node:assert/strict";
import { creditAuthSchema, isWeakTpin, newTpinSchema, tpinResetSchema } from "./tpin";

test("weak T-PINs are the repeated and straight-run ones", () => {
  for (const pin of ["111111", "000000", "123456", "987654", "456789"]) assert.equal(isWeakTpin(pin), true, pin);
  for (const pin of ["120394", "112233", "135790", "121212"]) assert.equal(isWeakTpin(pin), false, pin);
});

test("a new T-PIN must be six digits and not weak", () => {
  assert.equal(newTpinSchema.safeParse("120394").success, true);
  assert.equal(newTpinSchema.safeParse("123456").success, false);
  assert.equal(newTpinSchema.safeParse("1203").success, false);
  assert.equal(newTpinSchema.safeParse("12039a").success, false);
});

test("a payment can use an existing T-PIN of any strength, but needs a positive amount", () => {
  assert.equal(creditAuthSchema.safeParse({ tpin: "123456", expectedCredits: 40 }).success, true);
  assert.equal(creditAuthSchema.safeParse({ tpin: "123456", expectedCredits: 0 }).success, false);
  assert.equal(creditAuthSchema.safeParse({ expectedCredits: 40 }).success, false);
});

test("a reset takes exactly one proof of identity", () => {
  const tpin = "120394";
  assert.equal(tpinResetSchema.safeParse({ tpin, code: "004821" }).success, true);
  assert.equal(tpinResetSchema.safeParse({ tpin, password: "secret" }).success, true);
  assert.equal(tpinResetSchema.safeParse({ tpin }).success, false);
  assert.equal(tpinResetSchema.safeParse({ tpin, code: "004821", password: "secret" }).success, false);
});
