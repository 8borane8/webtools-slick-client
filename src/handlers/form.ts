type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export type FormHandlerSubmit<TBody> = (body: TBody, submitter: HTMLElement | null) => void | Promise<void>;

/** Inputs that only trigger an action: they are not data. */
const ACTION_INPUTS = new Set(["submit", "button", "image", "reset"]);

function transform(field: Field, value: string): unknown {
	switch (field.getAttribute("data-transform")) {
		case "csv":
			return value.split(",").map((v) => v.trim()).filter(Boolean);
		case "json":
			try {
				return JSON.parse(value);
			} catch {
				return undefined;
			}
		default:
			return value;
	}
}

function readInput(input: HTMLInputElement): unknown {
	switch (input.type) {
		case "number":
		case "range":
			return input.value === "" ? undefined : input.valueAsNumber;

		case "radio":
			return input.checked ? input.value : undefined;

		case "file": {
			const files = Array.from(input.files ?? []);
			if (input.multiple) return files.length ? files : undefined;
			return files[0];
		}

		default: {
			const inputmode = input.getAttribute("inputmode");
			if (inputmode === "numeric" || inputmode === "decimal") {
				if (input.value.trim() === "") return undefined;

				// Text that is not a number is kept as is, so the server refuses it instead of reading half of it.
				const value = Number(input.value);
				return Number.isNaN(value) ? input.value : value;
			}

			return transform(input, input.type === "email" ? input.value.toLowerCase() : input.value);
		}
	}
}

/**
 * Reads a form into an object a server schema can validate as is: checkboxes are booleans (or an array of values when
 * several share a name), numeric fields are numbers, files are `File`. Empty numbers, unchecked radios and missing
 * files are left out, as `z.optional` expects.
 */
export function parseForm<TBody = Record<string, unknown>>(form: HTMLFormElement): TBody {
	const fields = (Array.from(form.elements) as Field[]).filter((field) => field.name && !field.matches(":disabled"));

	const checkboxCounts = new Map<string, number>();
	for (const field of fields) {
		if ((field as HTMLInputElement).type === "checkbox") {
			checkboxCounts.set(field.name, (checkboxCounts.get(field.name) ?? 0) + 1);
		}
	}

	const body: Record<string, unknown> = {};

	for (const field of fields) {
		let value: unknown;

		switch (field.tagName) {
			case "INPUT": {
				const input = field as HTMLInputElement;
				if (ACTION_INPUTS.has(input.type)) continue;

				if (input.type === "checkbox") {
					if (checkboxCounts.get(input.name)! === 1) {
						body[input.name] = input.checked;
						continue;
					}

					const checked = (body[input.name] ??= []) as string[];
					if (input.checked) checked.push(input.value);
					continue;
				}

				value = readInput(input);
				break;
			}

			case "SELECT": {
				const select = field as HTMLSelectElement;
				value = select.multiple ? Array.from(select.selectedOptions).map((o) => o.value) : select.value;
				break;
			}

			case "TEXTAREA":
				value = transform(field, field.value);
				break;

			default:
				continue;
		}

		if (value !== undefined) body[field.name] = value;
	}

	return body as TBody;
}

const isFile = (value: unknown): value is Blob => value instanceof Blob;

/**
 * Encodes a body the way `HttpClient` of expressapi does, ready for `fetch(url, { method: "POST", ...encodeBody(body) })`:
 * JSON, or multipart as soon as a file is present (objects and arrays are then sent as JSON strings, which the
 * expressapi schemas parse back). `undefined` values are left out.
 */
export function encodeBody(body: object): { body: BodyInit; headers?: Record<string, string> } {
	const entries = Object.entries(body).filter(([, value]) => value !== undefined);

	if (!entries.some(([, value]) => isFile(value) || (Array.isArray(value) && value.some(isFile)))) {
		return {
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		};
	}

	const form = new FormData();
	for (const [key, value] of entries) {
		if (isFile(value)) {
			form.append(key, value);
		} else if (Array.isArray(value) && value.some(isFile)) {
			value.forEach((file) => form.append(key, file));
		} else {
			form.append(key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value));
		}
	}

	return { body: form };
}

export class FormHandler<TBody = Record<string, unknown>> {
	private submitting: boolean = false;

	constructor(private readonly form: HTMLFormElement, private readonly handler: FormHandlerSubmit<TBody>) {
		form.addEventListener("submit", (event) => this.submit(event));
	}

	private async submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (this.submitting) return;

		const { submitter } = event;
		this.submitting = true;
		this.form.setAttribute("aria-busy", "true");
		submitter?.setAttribute("disabled", "");

		try {
			await this.handler(parseForm<TBody>(this.form), submitter);
		} finally {
			this.submitting = false;
			this.form.removeAttribute("aria-busy");
			submitter?.removeAttribute("disabled");
		}
	}
}
