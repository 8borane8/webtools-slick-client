import { assertEquals } from "@std/assert";

import "./dom.ts";
import { Slick } from "../src/mod.ts";

interface Call {
	readonly url: string;
	readonly template: string | null;
}

const calls: Call[] = [];

const payload = (title: string, body: string) => ({
	title,
	favicon: "/favicon.ico",
	template: null,
	page: { styles: [], scripts: [], head: "", body },
});

function respond(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } });
}

function mockFetch(handler: (url: URL, signal: AbortSignal) => Promise<Response>): void {
	globalThis.fetch = ((input: URL, init: RequestInit) => {
		calls.push({ url: input.pathname, template: new Headers(init.headers).get("x-slick-template") });
		return handler(input, init.signal!);
	}) as typeof fetch;
}

const navigated = () => new Promise((resolve) => document.addEventListener("slick:navigate", resolve, { once: true }));
const app = () => document.querySelector("#app")!;

function click(link: Element, init: MouseEventInit = {}): MouseEvent {
	const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
	link.dispatchEvent(event);
	return event;
}

Deno.test("Slick client navigation", { sanitizeOps: false, sanitizeResources: false }, async (t) => {
	document.head.innerHTML = `<title>Home</title><link rel="shortcut icon" href="/favicon.ico">`;
	document.body.innerHTML = `
		<div id="root">
			<main id="app">
				<a id="about" href="/about">About</a>
				<a id="docs" href="/docs">Docs</a>
				<a id="section" href="/#section">Section</a>
				<a id="external" href="https://example.com/">External</a>
				<a id="ignored" href="/ignored" data-slick-ignore>Ignored</a>
				<a id="blank" href="/blank" target="_blank">Blank</a>
			</main>
		</div>
	`;

	Slick.initialize("app");

	const link = (id: string) => document.querySelector(`#${id}`)!;

	await t.step("a click renders the page without a full reload", async () => {
		mockFetch(() => Promise.resolve(respond(payload("About", "<h1>About</h1>"))));

		let listenerCalls = 0;
		const remove = Slick.addOnloadListener(() => {
			listenerCalls++;
		});

		const done = navigated();
		const event = click(link("about"));
		await done;

		assertEquals(event.defaultPrevented, true);
		assertEquals(calls, [{ url: "/about", template: "app" }]);
		assertEquals(document.title, "About");
		assertEquals(app().innerHTML, "<h1>About</h1>");
		assertEquals(location.pathname, "/about");
		assertEquals(listenerCalls, 1);
		assertEquals(document.documentElement.hasAttribute("data-slick-loading"), false);

		remove();
	});

	await t.step("the hash of the target is kept and scrolled to", async () => {
		mockFetch(() => Promise.resolve(respond(payload("Guide", "<h2 id='install'>Install</h2>"))));

		let scrolledTo: string | undefined;
		Element.prototype.scrollIntoView = function (this: Element) {
			scrolledTo = this.id;
		};

		const done = navigated();
		Slick.redirect("/guide#install");
		await done;

		assertEquals(location.pathname + location.hash, "/guide#install");
		assertEquals(scrolledTo, "install");
	});

	await t.step("links the browser should handle are left alone", () => {
		calls.length = 0;
		document.querySelector("#app")!.innerHTML = `
			<a id="plain" href="/plain">Plain</a>
			<a id="external" href="https://example.com/">External</a>
			<a id="ignored" href="/ignored" data-slick-ignore>Ignored</a>
			<a id="blank" href="/blank" target="_blank">Blank</a>
		`;

		assertEquals(click(link("external")).defaultPrevented, false);
		assertEquals(click(link("ignored")).defaultPrevented, false);
		assertEquals(click(link("blank")).defaultPrevented, false);
		assertEquals(click(link("plain"), { ctrlKey: true }).defaultPrevented, false);
		assertEquals(click(link("plain"), { metaKey: true }).defaultPrevented, false);
		assertEquals(click(link("plain"), { button: 1 }).defaultPrevented, false);
		assertEquals(calls, []);
	});

	await t.step("a removed listener is not called anymore", async () => {
		mockFetch(() => Promise.resolve(respond(payload("Home", "<a id='about' href='/about'>About</a>"))));

		let listenerCalls = 0;
		Slick.addOnloadListener(() => {
			listenerCalls++;
		})();

		const done = navigated();
		Slick.redirect("/");
		await done;

		assertEquals(listenerCalls, 0);
	});

	await t.step("the latest navigation wins", async () => {
		calls.length = 0;
		app().innerHTML = `<a id="about" href="/about">About</a><a id="docs" href="/docs">Docs</a>`;

		mockFetch((url, signal) => {
			if (url.pathname === "/about") {
				return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
			}
			return Promise.resolve(respond(payload("Docs", "<h1>Docs</h1>")));
		});

		const done = navigated();
		click(link("about"));
		await new Promise((resolve) => setTimeout(resolve, 0));
		click(link("docs"));
		await done;

		assertEquals(calls.map((call) => call.url), ["/about", "/docs"]);
		assertEquals(document.title, "Docs");
		assertEquals(location.pathname, "/docs");
		assertEquals(app().innerHTML, "<h1>Docs</h1>");
	});

	await t.step("a hash on the displayed page does not fetch", () => {
		calls.length = 0;
		Slick.redirect("/docs");
		assertEquals(calls, []);

		Slick.redirect("/docs#section", { replace: true });
		assertEquals(calls, []);
		assertEquals(location.hash, "#section");
	});

	await t.step("a hash that is not a valid selector does not throw", () => {
		Slick.redirect("/docs#1abc:x");
		assertEquals(location.hash, "#1abc:x");
	});

	await t.step("a GET form is submitted as a query string", async () => {
		calls.length = 0;
		document.querySelector("#app")!.innerHTML = `
			<form id="search" action="/search?lang=fr#top">
				<input name="q" value="slick">
				<input name="page" value="2">
				<button id="go" type="submit" name="go" value="1">Go</button>
			</form>
		`;

		mockFetch(() => Promise.resolve(respond(payload("Search", "<h1>Search</h1>"))));

		const done = navigated();
		const form = document.querySelector("#search")!;
		const submit = new SubmitEvent("submit", {
			bubbles: true,
			cancelable: true,
			submitter: document.querySelector("#go"),
		});
		form.dispatchEvent(submit);
		await done;

		assertEquals(submit.defaultPrevented, true);
		assertEquals(calls.length, 1);
		assertEquals(location.pathname + location.search, "/search?q=slick&page=2&go=1");
	});
});
