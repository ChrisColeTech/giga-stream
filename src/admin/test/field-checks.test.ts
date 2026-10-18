import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstRefusal, rating, required, schedule, webAddress, wholeNumber, year } from "@/lib/field-checks";

describe("required", () => {
  it("refuses an empty or blank value with `<Label> is required.`", () => {
    assert.equal(required("Name", ""), "Name is required.");
    assert.equal(required("Stream address", "   "), "Stream address is required.");
    assert.equal(required("Name", " a "), null);
  });
});

describe("a whole number from 1 to 9999", () => {
  it("accepts the ends and anything between", () => {
    for (const value of ["1", "42", "9999", " 7 "]) assert.equal(wholeNumber("Number", value), null, value);
  });

  it("refuses zero, ten thousand, decimals, signs and words, naming the range", () => {
    for (const value of ["0", "10000", "1.5", "-3", "+3", "abc", "1e3", "12a"]) {
      assert.equal(wholeNumber("Number", value), "Number must be a whole number from 1 to 9999.", value);
    }
  });

  it("passes an empty value: whether it may be empty is the page's own required list", () => {
    assert.equal(wholeNumber("Number", ""), null);
  });

  it("takes other bounds", () => {
    assert.equal(wholeNumber("Pages", "11", 1, 10), "Pages must be a whole number from 1 to 10.");
  });
});

describe("a web address", () => {
  it("accepts a parsable http or https address, a private one included", () => {
    assert.equal(webAddress("Stream address", "https://streams.example.test/a.m3u8"), null);
    assert.equal(webAddress("Origin", "HTTPS://example.test"), null);
    assert.equal(webAddress("Stream address", "http://example.test"), null);
    assert.equal(webAddress("Stream address", "http://192.168.1.4:8080/a.m3u8"), null);
  });

  it("refuses other schemes, text that is no address and credentials", () => {
    for (const value of ["ftp://example.test", "example.test", "not a url", "javascript:alert(1)"]) {
      assert.equal(webAddress("Stream address", value), "Stream address must be an http or https address.", value);
    }
    for (const value of ["http://u:p@example.test", "https://user@example.test"]) {
      assert.equal(webAddress("Stream address", value), "Stream address must not contain a user name or password.", value);
    }
    assert.equal(webAddress("Stream address", ""), null);
  });
});

describe("a job's interval", () => {
  it("accepts a number with m or h, and off", () => {
    for (const value of ["6h", "30m", "24h", "1m", "off", "OFF", " 6h ", ""]) assert.equal(schedule("Interval", value), null, value);
  });

  it("refuses everything else, and says what is accepted", () => {
    for (const value of ["x", "6", "h", "0m", "06h", "1.5h", "6d", "-1h", "6 h"]) {
      assert.equal(schedule("Interval", value), "Interval is a number and s, m or h, like 30m or 6h, or off.", value);
    }
  });
});

describe("year and rating", () => {
  it("takes a year from 1888 to 2100", () => {
    assert.equal(year("Year", "1999"), null);
    assert.equal(year("Year", "1887"), "Year must be a whole number from 1888 to 2100.");
    assert.equal(year("Year", "2101"), "Year must be a whole number from 1888 to 2100.");
    assert.equal(year("Year", "19x9"), "Year must be a whole number from 1888 to 2100.");
    assert.equal(year("Year", ""), null);
  });

  it("takes a rating from 0 to 10 with decimals", () => {
    for (const value of ["0", "7.8", "10", "10.0"]) assert.equal(rating("Rating", value), null, value);
    for (const value of ["10.1", "11", "-1", "abc", "7,8", ".5"]) assert.equal(rating("Rating", value), "Rating must be from 0 to 10.", value);
    assert.equal(rating("Rating", ""), null);
  });
});

describe("firstRefusal", () => {
  it("is the first sentence in order, or null when every check passes", () => {
    assert.equal(firstRefusal([null, "B is required.", "C is required."]), "B is required.");
    assert.equal(firstRefusal([null, null]), null);
    assert.equal(firstRefusal([]), null);
  });
});
