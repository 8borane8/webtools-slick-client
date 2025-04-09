export abstract class Cookies {
	public static get(cname: string): string | null {
		const csequence = cname + "=";

		const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
		const cookie = cookies.find((cookie) => cookie.startsWith(csequence));

		if (!cookie) return null;
		return cookie.slice(csequence.length);
	}

	public static set(cname: string, cvalue: string, exdays: number = 365): void {
		const date = new Date(Date.now() + exdays * 24 * 60 * 60 * 1000);
		document.cookie = `${cname}=${cvalue}; expires=${date.toUTCString()}; path=/; secure; SameSite=Lax;`;
	}

	public static delete(cname: string): void {
		document.cookie = `${cname}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;`;
	}
}
