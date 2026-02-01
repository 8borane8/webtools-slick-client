export abstract class Slick {
	private static template: string;
	private static newVersion: boolean = false;
	private static initialized: boolean = false;
	private static redirecting: boolean = false;

	private static readonly root = document.querySelector<HTMLDivElement>("#root")!;
	private static readonly title = document.querySelector<HTMLTitleElement>("title")!;
	private static readonly favicon = document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']")!;

	private static readonly onloadListeners: Array<() => Promise<void> | void> = [];

	public static initialize(template: string, newVersion: boolean = false): void {
		if (Slick.initialized) return;

		Slick.template = template;
		Slick.newVersion = newVersion;
		Slick.initialized = true;

		globalThis.addEventListener("popstate", async (event) => {
			event.preventDefault();
			await Slick.redirect(Slick.getPathFromUrl(new URL(globalThis.location.href)));
		});

		globalThis.addEventListener("DOMContentLoaded", () => Slick.addEventListeners(false));
	}

	private static getPathFromUrl(url: URL): string {
		return url.pathname + url.search + url.hash;
	}

	private static addEventListeners(app = true): void {
		const pre = app ? "#app " : "";

		document.querySelectorAll<HTMLLinkElement>(`${pre}a`).forEach((link) => {
			link.addEventListener("click", async (event) => {
				if (!["", "_self"].includes(link.getAttribute("target") || "")) return;

				const url = new URL(link.href);
				if (globalThis.location.host !== url.host) return;

				event.preventDefault();
				await Slick.redirect(Slick.getPathFromUrl(url));
			});
		});

		const formGetSelector = `${pre}form[method='get'], ${pre}form[method='GET']`;
		document.querySelectorAll<HTMLFormElement>(formGetSelector).forEach((form) => {
			form.addEventListener("submit", async (event) => {
				const action = new URL(
					form.getAttribute("action") || globalThis.location.pathname,
					globalThis.location.origin,
				);
				if (globalThis.location.host !== action.host) return;

				event.preventDefault();
				const formData = new FormData(form);
				const params = new URLSearchParams();
				for (const [key, value] of formData.entries()) {
					params.append(key, value.toString());
				}

				await Slick.redirect(`${Slick.getPathFromUrl(action)}?${params}`);
			});
		});

		const formPostSelector = `${pre}form[method='post'], ${pre}form[method='POST']`;
		document.querySelectorAll<HTMLFormElement>(formPostSelector).forEach((form) => {
			form.addEventListener("submit", async (event) => {
				const action = new URL(
					form.getAttribute("action") || globalThis.location.pathname,
					globalThis.location.origin,
				);
				if (globalThis.location.host !== action.host) return;

				event.preventDefault();
				const response = await fetch(Slick.getPathFromUrl(action), {
					method: "POST",
					redirect: "manual",
					body: new FormData(form),
				});

				const location = response.headers.get("Location");
				if (location) await Slick.redirect(location);
			});
		});
	}

	private static async loadStyles(styles: string[], type: string): Promise<void> {
		await Promise.all(
			styles.map((href) => {
				return new Promise<void>((resolve) => {
					const style = document.createElement("link");
					style.setAttribute("rel", "stylesheet");
					style.setAttribute("slick-type", type);
					style.setAttribute("href", href);

					style.onload = () => resolve();
					Slick.favicon.insertAdjacentElement("beforebegin", style);
				});
			}),
		);
	}

	private static async loadScripts(scripts: string[], type: string): Promise<void> {
		await Promise.all(
			scripts.map((src) => {
				return new Promise<void>((resolve) => {
					const script = document.createElement("script");
					script.setAttribute("src", `${src}?cacheBust=${Date.now()}`);
					script.setAttribute("slick-type", type);
					script.setAttribute("type", "module");

					script.onload = () => resolve();
					document.body.appendChild(script);
				});
			}),
		);
	}

	public static async redirect(url: string, reload: boolean = false, goTop: boolean = true): Promise<void> {
		if (Slick.redirecting) return;
		Slick.redirecting = true;

		try {
			const response = Slick.newVersion
				? await fetch(url, {
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

			const jsonResponse = await response.json();
			globalThis.history.pushState({}, "", response.redirected ? response.url : url);

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
				Slick.addEventListeners(false);
			}

			headChildren.slice(headChildren.indexOf(Slick.favicon) + 1).forEach((e) => e.remove());
			Slick.favicon.insertAdjacentHTML("afterend", jsonResponse.page.head);

			const oldPageStyles = document.querySelectorAll("link[rel='stylesheet'][slick-type='page']");
			await Slick.loadStyles(jsonResponse.page.styles, "page");

			document.querySelector("#app")!.innerHTML = jsonResponse.page.body;

			oldPageStyles.forEach((s) => s.remove());
			Array.from(document.querySelectorAll("script[slick-type='page']")).forEach((s) => s.remove());

			await Slick.loadScripts(jsonResponse.page.scripts, "page");
			Slick.addEventListeners();

			if (globalThis.location.hash !== "") {
				const target = document.querySelector(globalThis.location.hash);
				if (target) target.scrollIntoView({ behavior: "smooth" });
			} else if (goTop) {
				globalThis.scrollTo(0, 0);
			}

			await Promise.all(Slick.onloadListeners.map((fnc) => fnc()));
		} catch (error) {
			throw error;
		} finally {
			Slick.redirecting = false;
		}
	}

	public static addOnloadListener(fnc: () => Promise<void> | void): void {
		Slick.onloadListeners.push(fnc);
	}
}
