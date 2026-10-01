import { Window } from "happy-dom";

export const window = new Window({ url: "http://localhost/" });

// Only what the library reads is installed: replacing everything (as a global registrator does) would also replace
// `dispatchEvent` of `globalThis`, which Deno itself uses for its own events.
const globals = [
	"document",
	"history",
	"location",
	"Element",
	"HTMLAnchorElement",
	"HTMLFormElement",
	"HTMLInputElement",
	"HTMLSelectElement",
	"HTMLTextAreaElement",
	"CustomEvent",
	"MouseEvent",
	"SubmitEvent",
	"FormData",
	"File",
	"Blob",
] as const;

for (const name of globals) {
	Object.defineProperty(globalThis, name, { value: window[name], configurable: true, writable: true });
}

for (const name of ["matchMedia", "scrollTo"] as const) {
	Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true, writable: true });
}

Object.defineProperty(globalThis, "scrollY", { get: () => window.scrollY, configurable: true });

/** Replaces the body of the document and returns the form with the given id. */
export function setupForm(html: string): HTMLFormElement {
	document.body.innerHTML = `<form id="form">${html}</form>`;
	return document.querySelector<HTMLFormElement>("#form")!;
}
