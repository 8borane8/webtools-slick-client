import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert";
import { z } from "@webtools/expressapi";

import { setupForm } from "./dom.ts";
import { encodeBody, FormHandler, parseForm } from "../src/mod.ts";

Deno.test("parseForm reads text, checkbox, select and textarea", () => {
	const form = setupForm(`
		<input name="username" value="john">
		<input type="checkbox" name="newsletter" checked>
		<input type="checkbox" name="terms">
		<select name="country"><option value="fr" selected>FR</option><option value="us">US</option></select>
		<textarea name="message">hello</textarea>
		<input name="disabled" value="x" disabled>
		<input name="nameless-ignored">
		<button type="submit" name="action" value="save">Save</button>
		<input type="submit" name="other" value="Other">
	`);

	assertEquals(parseForm(form), {
		username: "john",
		newsletter: true,
		terms: false,
		country: "fr",
		message: "hello",
		"nameless-ignored": "",
	});
});

Deno.test("parseForm reads numbers and leaves empty ones out", () => {
	const form = setupForm(`
		<input type="number" name="age" value="25">
		<input type="number" name="empty" value="">
		<input type="range" name="level" value="3">
		<input inputmode="numeric" name="count" value="12">
		<input inputmode="decimal" name="price" value="9.5">
		<input inputmode="decimal" name="none" value="  ">
		<input inputmode="numeric" name="bad" value="12abc">
	`);

	assertEquals(parseForm(form), {
		age: 25,
		level: 3,
		count: 12,
		price: 9.5,
		bad: "12abc",
	});
});

Deno.test("parseForm reads radios and grouped checkboxes", () => {
	const form = setupForm(`
		<input type="radio" name="gender" value="male">
		<input type="radio" name="gender" value="female" checked>
		<input type="radio" name="size" value="s">
		<input type="radio" name="size" value="m">
		<input type="checkbox" name="tags" value="a" checked>
		<input type="checkbox" name="tags" value="b">
		<input type="checkbox" name="tags" value="c" checked>
		<input type="checkbox" name="none" value="a">
		<input type="checkbox" name="none" value="b">
		<select name="many" multiple><option value="1" selected>1</option><option value="2" selected>2</option></select>
	`);

	assertEquals(parseForm(form), {
		gender: "female",
		tags: ["a", "c"],
		none: [],
		many: ["1", "2"],
	});
});

Deno.test("parseForm lowercases emails and applies data-transform", () => {
	const form = setupForm(`
		<input type="email" name="email" value="John@Example.COM">
		<input name="csv" data-transform="csv" value="a, b,, c">
		<input name="csvEmpty" data-transform="csv" value="">
		<input name="json" data-transform="json" value='{"a":1}'>
		<input name="badJson" data-transform="json" value="{nope">
	`);

	assertEquals(parseForm(form), {
		email: "john@example.com",
		csv: ["a", "b", "c"],
		csvEmpty: [],
		json: { a: 1 },
	});
});

Deno.test("parseForm reads files from the multiple attribute", () => {
	const form = setupForm(`
		<input type="file" name="avatar">
		<input type="file" name="photos" multiple>
	`);

	assertEquals(parseForm(form), {});

	const avatar = form.querySelector<HTMLInputElement>("[name=avatar]")!;
	const photos = form.querySelector<HTMLInputElement>("[name=photos]")!;
	const first = new File(["a"], "a.txt");
	const second = new File(["b"], "b.txt");

	Object.defineProperty(avatar, "files", { value: [first] });
	Object.defineProperty(photos, "files", { value: [second] });

	const body = parseForm<{ avatar: File; photos: File[] }>(form);
	assertEquals(body.avatar, first);
	assertEquals(body.photos, [second]);
});

Deno.test("encodeBody sends JSON without files", () => {
	const { body, headers } = encodeBody({ name: "john", age: 25, skipped: undefined, tags: ["a"] });

	assertEquals(headers, { "Content-Type": "application/json" });
	assertEquals(JSON.parse(body as string), { name: "john", age: 25, tags: ["a"] });
});

Deno.test("encodeBody sends multipart with files, objects as JSON strings", () => {
	const file = new File(["a"], "a.txt");
	const { body, headers } = encodeBody({ avatar: file, name: "john", age: 25, tags: ["a"], skipped: undefined });

	assertEquals(headers, undefined);
	assertInstanceOf(body, FormData);
	assertEquals(body.get("name"), "john");
	assertEquals(body.get("age"), "25");
	assertEquals(body.get("tags"), '["a"]');
	assertEquals(body.has("skipped"), false);
	assertInstanceOf(body.get("avatar"), File);
});

Deno.test("parseForm output is validated as is by expressapi schemas", () => {
	const schema = z.object({
		username: z.string().min(1),
		age: z.number().int(),
		height: z.optional(z.number()),
		newsletter: z.boolean(),
		tags: z.array(z.string()),
		role: z.enum(["admin", "user"]),
	});

	const form = setupForm(`
		<input name="username" value="john">
		<input type="number" name="age" value="25">
		<input type="number" name="height" value="">
		<input type="checkbox" name="newsletter" checked>
		<input type="checkbox" name="tags" value="a" checked>
		<input type="checkbox" name="tags" value="b" checked>
		<input type="radio" name="role" value="admin" checked>
		<input type="radio" name="role" value="user">
	`);

	const expected = { username: "john", age: 25, newsletter: true, tags: ["a", "b"], role: "admin" };

	assertEquals(schema.parse(parseForm(form)), expected);

	// The server reads a multipart body as strings and JSON strings: the same values come out.
	const { body } = encodeBody({ ...parseForm(form), file: new File(["a"], "a.txt") });
	assertEquals(schema.parse(Object.fromEntries(body as FormData)), expected);
	assertThrows(() => schema.parse({ ...expected, age: "abc" }));
});

Deno.test("FormHandler blocks double submits and restores the form", async () => {
	const form = setupForm(`
		<input name="username" value="john">
		<button type="submit" id="save">Save</button>
	`);
	const button = form.querySelector<HTMLButtonElement>("#save")!;

	const calls: unknown[] = [];
	let release!: () => void;
	const pending = new Promise<void>((resolve) => release = resolve);

	new FormHandler(form, async (body, submitter) => {
		calls.push([body, submitter]);
		await pending;
	});

	const submit = () => form.dispatchEvent(new SubmitEvent("submit", { submitter: button, cancelable: true }));

	submit();
	submit();

	assertEquals(calls, [[{ username: "john" }, button]]);
	assertEquals(form.getAttribute("aria-busy"), "true");
	assertEquals(button.hasAttribute("disabled"), true);

	release();
	await pending;
	await new Promise((resolve) => setTimeout(resolve, 0));

	assertEquals(form.hasAttribute("aria-busy"), false);
	assertEquals(button.hasAttribute("disabled"), false);

	submit();
	assertEquals(calls.length, 2);
});
