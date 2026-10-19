import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlayerNavigation, settleEpisodeSwitch, settleLatestNavigation } from "@/lib/player-navigation";

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
  it("settles final progress before committing the exact episode identity", async () => {
    const navigation = new PlayerNavigation();
    const write = deferred();
    const events: string[] = [];
    const generation = navigation.next();
    const switching = settleEpisodeSwitch(
      navigation, generation, { season: 3, episode: 7 },
      write.promise.then(() => { events.push("flushed"); }),
      (target) => events.push(`S${target.season}E${target.episode}`),
      () => undefined,
    );
    await Promise.resolve();
    assert.deepEqual(events, []);
    write.resolve();
    assert.equal(await switching, true);
    assert.deepEqual(events, ["flushed", "S3E7"]);
  });

  it("commits only Next after rapid Previous then Next", async () => {
    const navigation = new PlayerNavigation();
    const previous = deferred();
    const next = deferred();
    const committed: string[] = [];
    const switchTo = (name: string, target: { season: number; episode: number }, wait: Promise<void>) =>
      settleEpisodeSwitch(navigation, navigation.next(), target, wait, () => committed.push(name), () => undefined);
    const switchingPrevious = switchTo("Previous", { season: 1, episode: 1 }, previous.promise);
    const switchingNext = switchTo("Next", { season: 1, episode: 3 }, next.promise);
    next.resolve();
    await switchingNext;
    previous.resolve();
    await switchingPrevious;
    assert.deepEqual(committed, ["Next"]);
  });

  it("does not let a pending episode overwrite Close or a new title", async () => {
    for (const later of ["close", "new title"]) {
      const navigation = new PlayerNavigation();
      const write = deferred();
      const committed: string[] = [];
      const switching = settleEpisodeSwitch(
        navigation, navigation.next(), { season: 2, episode: 4 }, write.promise,
        () => committed.push("episode"), () => undefined,
      );
      navigation.commitLatest(navigation.next(), () => committed.push(later));
      write.resolve();
      assert.equal(await switching, false);
      assert.deepEqual(committed, [later]);
    }
  });

  it("warns for a failed flush only while that episode operation is latest", async () => {
    const navigation = new PlayerNavigation();
    const failures: string[] = [];
    const stale = settleEpisodeSwitch(
      navigation, navigation.next(), { season: 1, episode: 1 }, Promise.reject(new Error("stale")),
      () => undefined, (error) => failures.push(error instanceof Error ? error.message : "unknown"),
    );
    navigation.next();
    assert.equal(await stale, false);
    const latest = settleEpisodeSwitch(
      navigation, navigation.next(), { season: 1, episode: 2 }, Promise.reject(new Error("latest")),
      () => undefined, (error) => failures.push(error instanceof Error ? error.message : "unknown"),
    );
    assert.equal(await latest, true);
    assert.deepEqual(failures, ["latest"]);
  });

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

  it("does not let a pending close clear a newer open", async () => {
    const navigation = new PlayerNavigation();
    const closeWrite = deferred();
    const state: string[] = [];
    const closeGeneration = navigation.next();
    const close = closeWrite.promise.then(() => navigation.commitLatest(closeGeneration, () => state.push("closed")));
    const openGeneration = navigation.next();
    assert.equal(navigation.commitLatest(openGeneration, () => state.push("opened B")), true);
    closeWrite.resolve();
    assert.equal(await close, false);
    assert.deepEqual(state, ["opened B"]);
  });
});
