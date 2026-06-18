export abstract class Slick {
	private static template: string;
	private static newVersion: boolean = false;
	private static initialized: boolean = false;
	private static redirecting: boolean = false;

	private static root: HTMLDivElement;
	private static title: HTMLTitleElement;
	private static favicon: HTMLLinkElement;

	private static readonly onloadListeners: Array<() => Promise<void> | void> = [];
	private static readonly boundLinks = new WeakSet<HTMLAnchorElement>();
	private static readonly boundForms = new WeakSet<HTMLFormElement>();
	private static eventObserver: MutationObserver | null = null;

	public static initialize(template: string, newVersion: boolean = false): void {
		if (Slick.initialized) return;

		Slick.template = template;
		Slick.newVersion = newVersion;
		Slick.initialized = true;

		Slick.root = document.querySelector<HTMLDivElement>("#root")!;
		Slick.title = document.querySelector<HTMLTitleElement>("title")!;
		Slick.favicon = document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']")!;

		globalThis.addEventListener("popstate", async (event) => {
			event.preventDefault();
			await Slick.redirectWrapper(globalThis.location.href);
		});

		if (document.readyState === "loading") {
			globalThis.addEventListener("DOMContentLoaded", () => Slick.startEventObserver());
		} else {
			Slick.startEventObserver();
		}
	}

	private static startEventObserver(): void {
		if (Slick.eventObserver) return;

		Slick.eventObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					Slick.scanNode(node);
				}
			}
		});

		Slick.eventObserver.observe(document.body, { childList: true, subtree: true });
		Slick.scanNode(document.body);
	}

	private static scanNode(node: Node): void {
		if (node instanceof HTMLAnchorElement) {
			Slick.bindLink(node);
		} else if (node instanceof HTMLFormElement) {
			Slick.bindForm(node);
		}

		if (node instanceof Element) {
			node.querySelectorAll("a").forEach((link) => Slick.bindLink(link));
			node.querySelectorAll<HTMLFormElement>("form[method='get'], form[method='GET']").forEach((form) =>
				Slick.bindForm(form)
			);
		}
	}

	private static bindLink(link: HTMLAnchorElement): void {
		if (Slick.boundLinks.has(link)) return;
		Slick.boundLinks.add(link);

		link.addEventListener("click", async (event) => {
			if (!["", "_self"].includes(link.getAttribute("target") || "")) return;

			event.preventDefault();
			await Slick.redirectWrapper(
				link.href,
				link.hasAttribute("data-slick-reload"),
			);
		});
	}

	private static bindForm(form: HTMLFormElement): void {
		if (Slick.boundForms.has(form)) return;
		if ((form.getAttribute("method") || "").toLowerCase() !== "get") return;

		Slick.boundForms.add(form);

		form.addEventListener("submit", async (event) => {
			const action = new URL(
				form.getAttribute("action") || globalThis.location.pathname,
				globalThis.location.href,
			);
			if (globalThis.location.host !== action.host) return;

			event.preventDefault();
			const formData = new FormData(form);
			const params = new URLSearchParams();
			for (const [key, value] of formData.entries()) {
				params.append(key, value.toString());
			}

			await Slick.redirectWrapper(`${action.href}?${params}`);
		});
	}

	private static async loadStyles(styles: string[], type: string): Promise<void> {
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

	private static async loadScripts(scripts: string[], type: string): Promise<void> {
		await Promise.all(
			scripts.map((src) => {
				return new Promise<void>((resolve, reject) => {
					const script = document.createElement("script");
					script.setAttribute("src", `${src}?cacheBust=${Date.now()}`);
					script.setAttribute("slick-type", type);
					script.setAttribute("type", "module");

					script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
					script.onload = () => resolve();

					document.body.appendChild(script);
				});
			}),
		);
	}

	private static handleHash(hash: string, goTop: boolean): void {
		if (hash !== "") {
			const target = document.querySelector(hash);
			if (target) target.scrollIntoView({ behavior: "smooth" });
		} else if (goTop) {
			globalThis.scrollTo({ top: 0, behavior: "smooth" });
		}
	}

	private static isSamePage(url: URL | string): boolean {
		url = new URL(url, globalThis.location.href);
		return globalThis.location.pathname + globalThis.location.search == url.pathname + url.search;
	}

	private static redirectWrapper(to: string, reload: boolean = false, goTop: boolean = true): Promise<void> | void {
		if (Slick.redirecting) return;

		const url = new URL(to, globalThis.location.href);
		if (globalThis.location.host !== url.host) {
			globalThis.location.href = url.href;
			return;
		}

		if (!reload && Slick.isSamePage(url)) {
			globalThis.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
			Slick.handleHash(url.hash, goTop);
			return;
		}

		return Slick.redirect(url.href, reload, goTop);
	}

	public static async redirect(url: string, reload: boolean = false, goTop: boolean = true): Promise<void> {
		if (Slick.redirecting) return;
		Slick.redirecting = true;

		try {
			const response = Slick.newVersion
				? await fetch(url, {
					method: "POST",
					headers: {
						"X-Slick-Template": reload ? "" : Slick.template,
					},
				})
				: await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						agent: "slick-client",
						template: reload ? null : Slick.template,
					}),
				});

			if (response.redirected && Slick.isSamePage(response.url)) {
				Slick.redirecting = false;
				return;
			}

			globalThis.history.pushState({}, "", response.redirected ? response.url : url);

			const jsonResponse = await response.json();
			Slick.title.innerHTML = jsonResponse.title;
			Slick.favicon.href = jsonResponse.favicon;

			const headChildren = Array.from(document.head.children);

			if (jsonResponse.template !== null) {
				Slick.template = jsonResponse.template.name;

				headChildren.slice(0, headChildren.indexOf(Slick.title)).forEach((e) => e.remove());
				Slick.title.insertAdjacentHTML("beforebegin", jsonResponse.template.head);

				const oldTemplateStyles = document.querySelectorAll("link[rel='stylesheet'][slick-type='template']");
				await Slick.loadStyles(jsonResponse.template.styles, "template");

				Slick.root.innerHTML = jsonResponse.template.body;

				oldTemplateStyles.forEach((s) => s.remove());
				Array.from(document.querySelectorAll("script[slick-type='template']")).forEach((s) => s.remove());

				await Slick.loadScripts(jsonResponse.template.scripts, "template");
			}

			headChildren.slice(headChildren.indexOf(Slick.favicon) + 1).forEach((e) => e.remove());
			Slick.favicon.insertAdjacentHTML("afterend", jsonResponse.page.head);

			const oldPageStyles = document.querySelectorAll("link[rel='stylesheet'][slick-type='page']");
			await Slick.loadStyles(jsonResponse.page.styles, "page");

			document.querySelector("#app")!.innerHTML = jsonResponse.page.body;

			oldPageStyles.forEach((s) => s.remove());
			Array.from(document.querySelectorAll("script[slick-type='page']")).forEach((s) => s.remove());

			await Slick.loadScripts(jsonResponse.page.scripts, "page");

			Slick.handleHash(globalThis.location.hash, goTop);
			await Promise.all(Slick.onloadListeners.map((fnc) => fnc()));
		} catch (error) {
			console.error(error);
			globalThis.location.href = url;
		} finally {
			Slick.redirecting = false;
		}
	}

	public static addOnloadListener(fnc: () => Promise<void> | void): void {
		Slick.onloadListeners.push(fnc);
	}
}
