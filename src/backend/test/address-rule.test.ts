// The address rule (docs/03 section 7.3): http or https, no credentials. Nothing about the host is judged here: a host
// that resolves to loopback or link-local is refused where it is fetched (the guarded fetch). Pure, so tested directly.
import assert from "node:assert/strict";
import test from "node:test";

import { addressRefusal, isAcceptedAddress } from "../src/services/address-rule.js";

test("http and https addresses are accepted, whatever the host", () => {
  for (const good of [
    "https://cdn.example/a.m3u8", "http://cdn.example/a.m3u8", "https://8.8.8.8/a", "http://10.0.0.5:8080/a",
    "http://192.168.1.9/a", "https://[2606:4700::1111]/a", "https://cdn.example:8443/a?x=1", "http://127.0.0.1:8097/live/a.m3u8",
    "http://localhost/a",
  ]) {
    assert.equal(isAcceptedAddress(good), true, good);
  }
});

test("credentials, other schemes and non-addresses are refused", () => {
  const bad = [
    "ftp://cdn.example/a", "file:///a.m3u", "not a url", "https://u:p@cdn.example/a", "http://u@cdn.example/a",
    "http://:p@cdn.example/a", "https://", "//cdn.example/a", "",
  ];
  for (const value of bad) assert.equal(isAcceptedAddress(value), false, value);
});

test("the refusal sentence names the field and the rule", () => {
  assert.equal(addressRefusal("stream address"), "The stream address must be an http or https address with no credentials.");
});
