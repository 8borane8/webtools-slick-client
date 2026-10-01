export interface RedirectOptions {
	/** Asks the server for the template again, even when it is already displayed. */
	reload?: boolean;
	/** Scrolls to the hash target, or to the top, once rendered. Defaults to `true`. */
	scroll?: boolean;
	/** Replaces the current history entry instead of adding one. */
	replace?: boolean;
}

interface Assets {
	readonly styles: readonly string[];
	readonly scripts: readonly string[];
	readonly head: string;
	readonly body: string;
}

interface SpaPayload {
	readonly title: string;
	readonly favicon: string;
	readonly template: (Assets & { readonly name: string }) | null;
	readonly page: Assets;
}

interface Navigation {
	readonly reload: boolean;
	readonly history: "push" | "replace" | "none";
	/** Position to scroll to once rendered, `null` to leave the scroll alone. */
	readonly scrollY: number | null;
}

const NAVIGATION_TIMEOUT = 30_000;

export abstract class Slick {
	private static template: string;
	private static initialized: boolean = false;
	private static renderedPath: string;

	private static root: HTMLDivElement;
	private static title: HTMLTitleElement;
	private static favicon: HTMLLinkElement;

	private static controller: AbortController | null = null;
	private static rendering: Promise<void> = Promise.resolve();
	private static scrollTimer: ReturnType<typeof setTimeout> | undefined;

	private static readonly onloadListeners = new Set<() => Promise<void> | void>();

	public static initialize(template: string): void {
		if (Slick.initialized) return;

		Slick.template = template;
		Slick.initialized = true;

		Slick.root = document.querySelector<HTMLDivElement>("#root")!;
		Slick.title = document.querySelector<HTMLTitleElement>("title")!;
		Slick.favicon = document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']")!;
		Slick.renderedPath = Slick.getPath(globalThis.location.href);

		// The browser would restore the scroll of the previous page onto the one not rendered yet.
		globalThis.history.scrollRestoration = "manual";
		const savedY = globalThis.history.state?.scrollY;
		if (typeof savedY === "number") globalThis.scrollTo(0, savedY);

		document.addEventListener("click", Slick.onClick);
		document.addEventListener("submit", Slick.onSubmit);
		globalThis.addEventListener("pagehide", Slick.saveScroll);
		globalThis.addEventListener("scroll", () => {
			clearTimeout(Slick.scrollTimer);
			Slick.scrollTimer = setTimeout(Slick.saveScroll, 100);
		}, { passive: true });

		globalThis.addEventListener("popstate", (event) => {
			// The pending save belongs to the entry that was just left.
			clearTimeout(Slick.scrollTimer);
			Slick.navigate(globalThis.location.href, {
				reload: false,
				history: "none",
				scrollY: event.state?.scrollY ?? 0,
			});
		});
	}

	public static redirect(to: string, options: RedirectOptions = {}): Promise<void> {
		return Slick.navigate(to, {
			reload: options.reload ?? false,
			history: options.replace ? "replace" : "push",
			scrollY: options.scroll === false ? null : 0,
		});
	}

	/** Runs after every navigation. Returns a function that removes the listener. */
	public static addOnloadListener(fnc: () => Promise<void> | void): () => void {
		Slick.onloadListeners.add(fnc);

		return () => {
			Slick.onloadListeners.delete(fnc);
		};
	}

	private static onClick(event: MouseEvent): void {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
		if (!(link instanceof HTMLAnchorElement)) return;
		if (!["", "_self"].includes(link.target) || link.hasAttribute("download")) return;
		if (link.hasAttribute("data-slick-ignore")) return;
		if (new URL(link.href).origin !== globalThis.location.origin) return;

		event.preventDefault();
		Slick.navigate(link.href, {
			reload: link.hasAttribute("data-slick-reload"),
			history: "push",
			scrollY: 0,
		});
	}

	private static onSubmit(event: SubmitEvent): void {
		const form = event.target;
		if (event.defaultPrevented || !(form instanceof HTMLFormElement)) return;

		const { submitter } = event;
		const method = submitter?.getAttribute("formmethod") || form.method;
		const target = submitter?.getAttribute("formtarget") || form.target;
		// `form.action` could be shadowed by an input named "action".
		const action = submitter?.getAttribute("formaction") || form.getAttribute("action") || "";

		if (method.toLowerCase() !== "get" || !["", "_self"].includes(target)) return;
		if (form.hasAttribute("data-slick-ignore") || submitter?.hasAttribute("data-slick-ignore")) return;

		const url = new URL(action, globalThis.location.href);
		if (url.origin !== globalThis.location.origin) return;

		const params = new URLSearchParams();
		for (const [key, value] of new FormData(form, submitter)) {
			params.append(key, typeof value === "string" ? value : value.name);
		}
		url.search = params.toString();

		event.preventDefault();
		Slick.navigate(url.href, {
			reload: form.hasAttribute("data-slick-reload"),
			history: "push",
			scrollY: 0,
		});
	}

	private static saveScroll(): void {
		clearTimeout(Slick.scrollTimer);
		globalThis.history.replaceState({ ...globalThis.history.state, scrollY: globalThis.scrollY }, "");
	}

	private static getPath(url: URL | string): string {
		const parsed = new URL(url, globalThis.location.href);
		return parsed.pathname + parsed.search;
	}

	private static commitHistory(url: URL, mode: Navigation["history"]): void {
		if (mode === "none") return;

		Slick.saveScroll();

		const replace = mode === "replace" || url.href === globalThis.location.href;
		globalThis.history[replace ? "replaceState" : "pushState"]({}, "", url.href);
	}

	/** Scrolls to the hash target when it exists, otherwise to `scrollY`. Returns whether a target was found. */
	private static scroll(hash: string, scrollY: number | null): boolean {
		let target: HTMLElement | null = null;
		try {
			target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
		} catch {
			// A malformed hash targets nothing.
		}

		if (target) {
			const reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
			target.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth" });
		} else if (scrollY !== null) {
			globalThis.scrollTo({ top: scrollY, behavior: "instant" });
		}

		return target !== null;
	}

	private static async navigate(to: string, navigation: Navigation): Promise<void> {
		const url = new URL(to, globalThis.location.href);
		if (url.origin !== globalThis.location.origin) {
			globalThis.location.assign(url.href);
			return;
		}

		if (!navigation.reload && Slick.renderedPath === Slick.getPath(url)) {
			// Going back to the displayed page cancels a navigation still loading.
			Slick.controller?.abort();
			Slick.commitHistory(url, navigation.history);
			Slick.scroll(url.hash, navigation.scrollY);
			return;
		}

		// The latest navigation wins: the previous request is cancelled, a previous render is waited for.
		Slick.controller?.abort();
		const controller = Slick.controller = new AbortController();
		document.documentElement.setAttribute("data-slick-loading", "");

		try {
			await Slick.rendering;
			if (controller.signal.aborted) return;

			const response = await fetch(url, {
				method: "POST",
				headers: { "X-Slick-Template": navigation.reload ? "" : Slick.template },
				signal: AbortSignal.any([controller.signal, AbortSignal.timeout(NAVIGATION_TIMEOUT)]),
			});

			if (!response.ok || !response.headers.get("content-type")?.startsWith("application/json")) {
				throw new Error(`Unexpected response (${response.status}) for ${url.href}`);
			}

			// `response.url` never carries the fragment: a redirect keeps the one of the request, like a browser does.
			const finalUrl = new URL(response.redirected ? response.url : url);
			finalUrl.hash ||= url.hash;
			const payload: SpaPayload = await response.json();
			if (controller.signal.aborted) return;

			Slick.commitHistory(finalUrl, navigation.history);

			if (!navigation.reload && Slick.renderedPath === Slick.getPath(finalUrl)) {
				Slick.scroll(finalUrl.hash, navigation.scrollY);
				return;
			}

			const render = Slick.render(payload);
			Slick.rendering = render.catch(() => {});
			await render;

			Slick.renderedPath = Slick.getPath(finalUrl);
			if (!Slick.scroll(finalUrl.hash, navigation.scrollY)) Slick.focusApp();

			await Promise.all([...Slick.onloadListeners].map(async (fnc) => {
				try {
					await fnc();
				} catch (error) {
					console.error(error);
				}
			}));
			document.dispatchEvent(new CustomEvent("slick:navigate", { detail: { url: finalUrl.href } }));
		} catch (error) {
			if (controller.signal.aborted) return;

			console.error(error);
			globalThis.location.assign(url.href);
		} finally {
			if (Slick.controller === controller) {
				Slick.controller = null;
				document.documentElement.removeAttribute("data-slick-loading");
			}
		}
	}

	private static async render(payload: SpaPayload): Promise<void> {
		document.title = payload.title;
		Slick.favicon.href = payload.favicon;

		const headChildren = Array.from(document.head.children);

		if (payload.template) {
			const { template } = payload;
			Slick.template = template.name;

			headChildren.slice(0, headChildren.indexOf(Slick.title)).forEach((e) => e.remove());
			Slick.title.insertAdjacentHTML("beforebegin", template.head);

			await Slick.swapAssets("template", template, () => {
				Slick.root.innerHTML = template.body;
			});
		}

		headChildren.slice(headChildren.indexOf(Slick.favicon) + 1).forEach((e) => e.remove());
		Slick.favicon.insertAdjacentHTML("afterend", payload.page.head);

		await Slick.swapAssets("page", payload.page, () => {
			document.querySelector("#app")!.innerHTML = payload.page.body;
		});
	}

	/** Loads the new styles, swaps the markup, drops the previous assets, then runs the new scripts. */
	private static async swapAssets(type: string, assets: Assets, swapBody: () => void): Promise<void> {
		const previous = document.querySelectorAll(`[slick-type='${type}']`);

		await Slick.loadStyles(assets.styles, type);
		swapBody();
		previous.forEach((e) => e.remove());
		await Slick.loadScripts(assets.scripts, type);
	}

	private static async loadStyles(styles: readonly string[], type: string): Promise<void> {
		await Promise.all(
			styles.map((href) => {
				return new Promise<void>((resolve, reject) => {
					const style = document.createElement("link");
					style.setAttribute("rel", "stylesheet");
					style.setAttribute("slick-type", type);
					style.setAttribute("href", href);

					style.onerror = () => reject(new Error(`Failed to load style: ${href}`));
					style.onload = () => resolve();

					Slick.favicon.insertAdjacentElement("beforebegin", style);
				});
			}),
		);
	}

	private static async loadScripts(scripts: readonly string[], type: string): Promise<void> {
		// Modules are cached by URL: a new one is needed to run the script again.
		const cacheBust = Date.now().toString();

		await Promise.all(
			scripts.map((src) => {
				return new Promise<void>((resolve, reject) => {
					const url = new URL(src, globalThis.location.href);
					url.searchParams.set("cacheBust", cacheBust);

					const script = document.createElement("script");
					script.setAttribute("src", url.href);
					script.setAttribute("slick-type", type);
					script.setAttribute("type", "module");
					// Scripts added at once still run in the order they were declared.
					script.async = false;

					script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
					script.onload = () => resolve();

					document.body.appendChild(script);
				});
			}),
		);
	}

	/** Moves the focus to the page content so keyboards and screen readers follow the navigation. */
	private static focusApp(): void {
		const app = document.querySelector<HTMLElement>("#app");
		if (!app) return;

		app.setAttribute("tabindex", "-1");
		app.focus({ preventScroll: true });
	}
}
