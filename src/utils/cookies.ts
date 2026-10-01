/** Characters that would end the cookie or inject attributes. Values stay raw, like in expressapi. */
const FORBIDDEN = /[\s;,"\\]/;

export abstract class Cookies {
	public static get(cname: string): string | null {
		const csequence = cname + "=";
		const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
		const cookie = cookies.find((cookie) => cookie.startsWith(csequence));
		if (!cookie) return null;

		return cookie.slice(csequence.length);
	}

	/**
	 * @throws {Error} If the name or the value contains a character that is not allowed in a cookie.
	 */
	public static set(cname: string, cvalue: string, days: number = 365): void {
		if (!cname || cname.includes("=") || FORBIDDEN.test(cname) || FORBIDDEN.test(cvalue)) {
			throw new Error(`Invalid cookie '${cname}'.`);
		}

		// `Secure` cookies are ignored on plain http.
		const secure = globalThis.location.protocol === "https:" ? "; Secure" : "";

		document.cookie = `${cname}=${cvalue}; Max-Age=${
			Math.round(days * 24 * 60 * 60)
		}; Path=/; SameSite=Lax${secure}`;
	}

	public static delete(cname: string): void {
		document.cookie = `${cname}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
	}
}
