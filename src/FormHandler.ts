export type FormHandlerSubmit = (
	body: Record<string, unknown>,
	submitButton: HTMLButtonElement | HTMLInputElement | null,
) => void | Promise<void>;

export class FormHandler {
	constructor(private readonly form: HTMLFormElement, private readonly handler: FormHandlerSubmit) {
		this.setupInputs();
		this.setupSubmit();
	}

	private setupInputs(): void {
		this.form.querySelectorAll<HTMLInputElement>("input[type='number']").forEach((input) => {
			const allowFloat = !input.hasAttribute("data-integer-only");
			const numberRegex = allowFloat ? /^-?\d*\.?\d*$/ : /^-?\d+$/;

			const min = input.min ? parseFloat(input.min) : undefined;
			const max = input.max ? parseFloat(input.max) : undefined;
			const step = input.step ? parseFloat(input.step) : undefined;

			let lastValue = input.value;
			input.addEventListener("input", () => {
				const value = input.value;

				if (value !== "" && !numberRegex.test(value)) {
					input.value = lastValue;
					return;
				}

				const numValue = parseFloat(value);

				if (min && numValue < min) {
					input.value = min.toString();
				} else if (max && numValue > max) {
					input.value = max.toString();
				}

				if (step) {
					const rounded = Math.round(numValue / step) * step;
					input.value = rounded.toString();
				}

				lastValue = input.value;
			});
		});

		this.form.querySelectorAll<HTMLInputElement>("input[type='email']").forEach((input) => {
			input.addEventListener("input", () => {
				input.value = input.value.trim().toLowerCase();
			});
		});
	}

	private static transform(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
		switch (input.getAttribute("data-transform")) {
			case "csv":
				return input.value.split(",").map((v) => v.trim());
			case "json":
				return JSON.parse(input.value);
			default:
				return input.value;
		}
	}

	private static parseForm(form: HTMLFormElement): Record<string, unknown> {
		const body: Record<string, unknown> = {};

		const elements = Array.from(form.elements) as Array<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>;

		for (const el of elements) {
			if (!el.name || el.disabled) continue;

			switch (el.tagName) {
				case "INPUT": {
					const input = el as HTMLInputElement;

					switch (input.type) {
						case "checkbox":
							body[input.name] = input.checked;
							break;

						case "number":
						case "range":
							body[input.name] = input.value === "" ? null : input.valueAsNumber;
							break;

						case "radio":
							if (input.checked) {
								body[input.name] = input.value;
							}
							break;

						case "file":
							body[input.name] = input.files?.length === 1 ? input.files[0] : input.files;
							break;

						default:
							body[input.name] = FormHandler.transform(input);
					}
					break;
				}

				case "SELECT": {
					const select = el as HTMLSelectElement;
					const value = select.multiple
						? Array.from(select.selectedOptions).map((o) => o.value)
						: select.value;

					body[select.name] = value;
					break;
				}

				case "TEXTAREA": {
					const textarea = el as HTMLTextAreaElement;
					body[textarea.name] = FormHandler.transform(textarea);
					break;
				}
			}
		}

		return body;
	}

	private setupSubmit(): void {
		this.form.addEventListener("submit", async (event) => {
			event.preventDefault();

			const submitButton = this.form.querySelector<HTMLButtonElement | HTMLInputElement>('*[type="submit"]');
			if (submitButton) submitButton.disabled = true;

			const body = FormHandler.parseForm(this.form);
			await this.handler(body, submitButton);

			if (submitButton) submitButton.disabled = false;
		});
	}
}
