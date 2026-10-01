import { assertEquals, assertThrows } from "@std/assert";

import "./dom.ts";
import { Cookies } from "../src/mod.ts";

Deno.test("Cookies sets, gets and deletes a value", () => {
	Cookies.set("username", "john_doe");
	assertEquals(Cookies.get("username"), "john_doe");
	assertEquals(Cookies.get("missing"), null);

	Cookies.delete("username");
	assertEquals(Cookies.get("username"), null);
});

Deno.test("Cookies keeps values raw", () => {
	Cookies.set("token", "a=b+c/d==");
	assertEquals(Cookies.get("token"), "a=b+c/d==");
	Cookies.delete("token");
});

Deno.test("Cookies refuses values that would inject attributes", () => {
	assertThrows(() => Cookies.set("a", "x; path=/admin"), Error, "Invalid cookie");
	assertThrows(() => Cookies.set("a", "x y"), Error, "Invalid cookie");
	assertThrows(() => Cookies.set("a=b", "x"), Error, "Invalid cookie");
	assertThrows(() => Cookies.set("", "x"), Error, "Invalid cookie");
});
