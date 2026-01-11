<h1 align="center">Welcome to Slick Client!</h1>

<p align="center">
    <em>
        Slick is a small, simple, and ultrafast client-side library built on Web Standards for Deno.
    </em>
</p>

<p align="center">
    <img src="https://img.shields.io/github/issues-closed/8borane8/webtools-slick-client.svg" alt="issues-closed" />
    &nbsp;
    <img src="https://img.shields.io/github/license/8borane8/webtools-slick-client.svg" alt="license" />
    &nbsp;
    <img src="https://img.shields.io/github/stars/8borane8/webtools-slick-client.svg" alt="stars" />
    &nbsp;
    <img src="https://img.shields.io/github/forks/8borane8/webtools-slick-client.svg" alt="forks" />
</p>

<hr>

## ✨ Features

- Lightweight client-side library
- Seamless Single Page Application (SPA) capabilities
- Efficient navigation and state management
- Utility class for easy cookie management
- Form handler with automatic validation and data transformation

## 📦 Installation

```bash
deno add jsr:@webtools/slick-client
```

## 🧠 Usage Example

Slick Client integrates smoothly with `slick-server` to enrich client-side functionality.

### Slick Class

The `Slick` class provides the backbone for managing your Single Page Application (SPA):

- **redirect**: Facilitates client-side navigation.
- **addOnloadListener**: Adds callbacks to be executed on page load.

#### Example Usage

```ts
import { Slick } from "@webtools/slick-client";

// Add custom on-load event listener
Slick.addOnloadListener(() => {
	console.log("Page loaded!");
});

// Redirect to another URL
async function navigateTo(url: string) {
	await Slick.redirect(url);
}
```

### Cookies Class

The `Cookies` class offers simple methods for managing browser cookies:

- **get(cname: string)**: Retrieves the value of a cookie by name.
- **set(cname: string, cvalue: string, exdays?: number)**: Sets a new cookie or updates an existing one.
- **delete(cname: string)**: Deletes a specified cookie.

#### Example Usage

```ts
import { Cookies } from "@webtools/slick-client";

// Set a cookie
Cookies.set("username", "john_doe");

// Get a cookie
const username = Cookies.get("username");
console.log(username); // Outputs: john_doe

// Delete a cookie
Cookies.delete("username");
```

### FormHandler Class

The `FormHandler` class provides automatic form handling with validation, data transformation, and type-safe form data
parsing:

- **Automatic form parsing**: Converts form elements to a structured object
- **Input validation**: Validates number inputs with min/max constraints
- **Email normalization**: Automatically trims and lowercases email inputs
- **Data transformation**: Supports CSV and JSON transformations via `data-transform` attribute
- **Type handling**: Properly handles checkboxes, radio buttons, files, numbers, dates, and more
- **Submit button management**: Automatically disables submit button during processing

#### Example Usage

```ts
import { FormHandler } from "@webtools/slick-client";

// Basic form handling
const form = document.querySelector("form") as HTMLFormElement;
new FormHandler(form, async (body) => {
	console.log("Form data:", body);
	// Send to server, etc.
});
```

#### Supported Input Types

- **Checkbox**: Returns boolean value
- **Radio**: Returns selected value
- **Number/Range**: Returns number or null if empty
- **File**: Returns File object (single) or FileList (multiple)
- **Email**: Automatically trimmed and lowercased
- **Text/Textarea**: Supports data transformations
- **Select**: Returns value or array for multiple selects

#### Data Transformations

Use the `data-transform` attribute to transform input values:

```html
<!-- CSV transformation: "tag1, tag2, tag3" → ["tag1", "tag2", "tag3"] -->
<input name="tags" data-transform="csv" />

<!-- JSON transformation: '{"key":"value"}' → {key: "value"} -->
<input name="payload" data-transform="json" />
```

#### Number Input Validation

Number inputs are automatically validated with regex patterns and min/max constraints:

```html
<!-- Integer only (no decimals) -->
<input type="number" name="age" data-integer-only min="0" max="120" />

<!-- Float allowed -->
<input type="number" name="price" min="0" step="0.01" />
```

#### Example Form

```html
<form id="myForm">
	<input type="text" name="username" required />
	<input type="email" name="email" required />
	<input type="number" name="age" data-integer-only min="0" max="120" />
	<input type="checkbox" name="newsletter" />
	<input type="radio" name="gender" value="male" />
	<input type="radio" name="gender" value="female" />
	<input type="file" name="avatar" />
	<input name="tags" data-transform="csv" />
	<textarea name="message" data-transform="json"></textarea>
	<button type="submit">Submit</button>
</form>
```

```ts
const form = document.getElementById("myForm") as HTMLFormElement;
new FormHandler(form, async (body) => {
	// body will contain:
	// {
	//   username: "john_doe",
	//   email: "john@example.com",
	//   age: 25,
	//   newsletter: true,
	//   gender: "male",
	//   avatar: File,
	//   tags: ["tag1", "tag2", "tag3"],
	//   message: { parsed: "json" }
	// }
});
```

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
