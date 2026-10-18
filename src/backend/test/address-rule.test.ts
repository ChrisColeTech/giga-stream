// The address rule (docs/03 section 7.3): https, no credentials, and no non-public IP literal. A name is judged where it
// is fetched (the guarded fetch); this is the part an address can fail on its own text. Pure, so tested directly.
import assert from "node:assert/strict";
import test from "node:test";

import { isAcceptedAddress } from "../src/services/address-rule.js";

const accepted = (value: string, loopback = false): boolean => isAcceptedAddress(value, loopback);

test("https to a name or a public address is accepted; plain http and credentials are not", () => {
  for (const good of ["https://cdn.example/a.m3u8", "https://8.8.8.8/a", "https://[2606:4700::1111]/a", "https://cdn.example:8443/a?x=1"]) {
    assert.equal(accepted(good), true, good);
  }
  for (const bad of ["http://cdn.example/a", "ftp://cdn.example/a", "not a url", "https://u:p@cdn.example/a", "https://", "//cdn.example/a"]) {
    assert.equal(accepted(bad), false, bad);
  }
});

test("private, loopback, link-local, carrier-grade, reserved and documentation IPv4 literals are refused", () => {
  for (const host of [
    "0.0.0.0", "10.0.0.1", "10.255.255.255", "100.64.0.1", "100.127.255.254", "127.0.0.1", "127.8.8.8", "169.254.169.254",
    "172.16.0.1", "172.31.255.255", "192.0.0.8", "192.0.2.1", "192.168.1.1", "198.18.0.1", "198.19.255.255", "198.51.100.7",
    "203.0.113.9", "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255",
  ]) {
    assert.equal(accepted(`https://${host}/a`), false, host);
  }
  for (const host of ["100.63.255.255", "100.128.0.1", "172.15.255.255", "172.32.0.1", "198.17.255.255", "198.20.0.1", "9.255.255.255", "11.0.0.1"]) {
    assert.equal(accepted(`https://${host}/a`), true, `${host} is public`);
  }
});

test("IPv6 loopback, unspecified, mapped, NAT64, 6to4, Teredo, documentation, unique-local, link-local and multicast are refused", () => {
  for (const host of [
    "::", "::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:192.168.0.1", "64:ff9b::a00:1", "2002:a00:1::", "2002:c0a8:101::",
    "2001::1", "2001:db8::1", "fc00::1", "fd12:3456::1", "fe80::1", "fec0::1", "ff02::1",
  ]) {
    assert.equal(accepted(`https://[${host}]/a`), false, host);
  }
  assert.equal(accepted("https://[::ffff:8.8.8.8]/a"), true, "a mapped public address is public");
  assert.equal(accepted("https://[2002:808:808::1]/a"), true, "a 6to4 address embeds a public one");
  assert.equal(accepted("https://[64:ff9b::808:808]/a"), true, "a NAT64 address embeds a public one (docs/43 section 3.8)");
});

test("the names localhost and *.localhost are refused too", () => {
  for (const host of ["localhost", "LOCALHOST", "app.localhost"]) assert.equal(accepted(`https://${host}/a`), false, host);
});

test("the development flag lets loopback through, plain http on 127.0.0.1 and localhost only, and nothing private", () => {
  for (const good of ["http://127.0.0.1:8097/live/a.m3u8", "http://localhost/a", "https://127.0.0.1/a", "https://localhost:9/a", "https://[::1]/a"]) {
    assert.equal(accepted(good, true), true, good);
  }
  for (const bad of ["http://10.0.0.1/a", "https://10.0.0.1/a", "http://cdn.example/a", "http://127.5.5.5/a", "https://192.168.0.1/a"]) {
    assert.equal(accepted(bad, true), false, bad);
  }
});
