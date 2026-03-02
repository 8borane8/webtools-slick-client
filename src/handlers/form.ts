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
		this.form.querySelectorAll<HTMLInputElement>("input[inputmode='decimal'], input[inputmode='numeric']")
			.forEach((input) => {
				const allowFloat = input.getAttribute("inputmode") === "decimal";
				const min = parseFloat(input.min);
				const max = parseFloat(input.max);
				const step = parseFloat(input.step);

				input.addEventListener("input", () => {
					const cursor = input.selectionStart ?? 0;
					const prev = input.value;

					let value = prev.replace(/[^\d.-]/g, "");

					const isNegative = value.startsWith("-");
					value = value.replace(/-/g, "");
					if (isNegative) value = "-" + value;

					if (allowFloat) {
						const dotIndex = value.indexOf(".");
						if (dotIndex !== -1) {
							value = value.slice(0, dotIndex + 1) +
								value.slice(dotIndex + 1).replace(/\./g, "");
						}
					} else {
						value = value.replace(/\./g, "");
					}

					if (value !== prev) {
						const diff = value.length - prev.length;
						input.value = value;

						const newCursor = Math.max(0, cursor + diff);
						input.setSelectionRange(newCursor, newCursor);
					}
				});

				input.addEventListener("change", () => {
					let value = parseFloat(input.value);
					if (isNaN(value)) {
						input.value = "";
						return;
					}

					if (!isNaN(min) && value < min) value = min;
					else if (!isNaN(max) && value > max) value = max;

					if (!isNaN(step) && step > 0) {
						const decimals = step.toString().split(".")[1]?.length || 0;
						const rounded = Math.round(value / step) * step;
						input.value = rounded.toFixed(decimals);
					} else {
						input.value = allowFloat ? value.toString() : Math.trunc(value).toString();
					}
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
				try {
					return JSON.parse(input.value);
				} catch {
					return null;
				}
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

					const inputmode = input.getAttribute("inputmode");

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
							} else if (!(input.name in body)) {
								body[input.name] = null;
							}
							break;

						case "file":
							body[input.name] = input.files?.length === 0
								? null
								: input.files?.length === 1
								? input.files[0]
								: input.files;
							break;

						default: {
							if (inputmode === "decimal") {
								const value = parseFloat(input.value);
								body[input.name] = !isNaN(value) ? value : null;
							} else if (inputmode === "numeric") {
								const value = parseInt(input.value);
								body[input.name] = !isNaN(value) ? value : null;
							} else {
								body[input.name] = FormHandler.transform(input);
							}
							break;
						}
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

			try {
				const body = FormHandler.parseForm(this.form);
				await this.handler(body, submitButton);
			} finally {
				if (submitButton) submitButton.disabled = false;
			}
		});
	}
}
