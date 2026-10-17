import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlayerNavigation, settleLatestNavigation } from "@/lib/player-navigation";

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("latest Player navigation", () => {
  it("cannot reopen A after rapid A then B when A's progress flush settles last", async () => {
    const navigation = new PlayerNavigation();
    const a = deferred();
    const b = deferred();
    const opened: string[] = [];
    const open = async (name: string, wait: Promise<void>) => {
      const generation = navigation.next();
      await wait;
      if (navigation.isLatest(generation)) opened.push(name);
    };
    const openingA = open("A", a.promise);
    const openingB = open("B", b.promise);
    b.resolve();
    await openingB;
    a.resolve();
    await openingA;
    assert.deepEqual(opened, ["B"]);
  });

  it("does not show the stale refusal from A after B owns navigation", async () => {
    const navigation = new PlayerNavigation();
    const a = deferred();
    const refusals: string[] = [];
    const generationA = navigation.next();
    const settleA = settleLatestNavigation(
      navigation,
      generationA,
      a.promise.then(() => Promise.reject(new Error("A failed"))),
      (error) => refusals.push(error instanceof Error ? error.message : "unknown"),
    );
    const generationB = navigation.next();
    assert.equal(await settleLatestNavigation(navigation, generationB, Promise.resolve(), () => undefined), true);
    a.resolve();
    assert.equal(await settleA, false);
    assert.deepEqual(refusals, []);
  });
});
