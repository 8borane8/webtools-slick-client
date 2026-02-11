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

#### Automatic DOM Handling

Slick automatically intercepts and handles navigation and form submissions within your application:

##### Links (`<a>` tags)

All links are automatically intercepted for client-side navigation:

- **Same-origin only**: Only links to the same host are intercepted
- **Target handling**: Links with `target` attribute (except `""` or `"_self"`) are ignored
- **Automatic redirect**: Clicking a link triggers `Slick.redirect()` with the link's URL

```html
<!-- This link will be intercepted and handled by Slick -->
<a href="/about">About</a>

<!-- This link will open in a new tab (not intercepted) -->
<a href="/external" target="_blank">External</a>

<!-- This link to another domain won't be intercepted -->
<a href="https://example.com">External Site</a>
```

##### Forms with GET method

Forms with `method="get"` are automatically converted to query parameters:

- Form data is serialized to URL query parameters
- Navigation happens via `Slick.redirect()` with query string
- Works seamlessly with search/filter forms

```html
<form method="get" action="/search">
	<input type="text" name="q" />
	<input type="number" name="page" value="1" />
	<button type="submit">Search</button>
</form>
<!-- Submitting will navigate to: /search?q=...&page=1 -->
```

##### Forms with POST method

Forms with `method="post"` are submitted via fetch and follow redirects:

- Form data is sent as `FormData` via POST request
- Server should return a `Location` header for redirect
- Slick automatically follows the redirect using `Slick.redirect()`
- Supports optional attributes for redirect behavior

**Optional form attributes:**

- `data-reload-template` - Reload the template on redirect (passes `reload: true` to redirect)
- `data-go-top` - Scroll to top after redirect (passes `goTop: true` to redirect)

```html
<!-- Basic POST form -->
<form method="post" action="/submit">
	<input type="text" name="username" />
	<button type="submit">Submit</button>
</form>

<!-- POST form with template reload -->
<form method="post" action="/update" data-reload-template>
	<input type="text" name="data" />
	<button type="submit">Update</button>
</form>

<!-- POST form that doesn't scroll to top -->
<form method="post" action="/save" data-go-top="false">
	<input type="text" name="content" />
	<button type="submit">Save</button>
</form>
```

**Note**: The server should respond with a `Location` header pointing to the next page. Slick will automatically follow
this redirect.

#### Manual Navigation

```ts
// Redirect to a URL
await Slick.redirect("/about");

// Redirect with options
await Slick.redirect("/page", false, true);
// Parameters: url, reload (reload template), goTop (scroll to top)
```

#### Page Load Listeners

```ts
// Add callback to execute after page navigation
Slick.addOnloadListener(() => {
	console.log("Page loaded!");
	// Initialize page-specific code here
});
```

**Note**: Listeners are executed after each navigation, allowing you to reinitialize page-specific functionality.

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
- **Input sanitization**: Automatically filters invalid characters from number inputs
- **Input validation**: Applies min/max constraints and step rounding on blur
- **Email normalization**: Automatically trims and lowercases email inputs
- **Data transformation**: Supports CSV and JSON transformations via `data-transform` attribute (with error handling)
- **Type handling**: Properly handles checkboxes, radio buttons, files, numbers, dates, and more
- **Submit button management**: Automatically disables submit button during processing (always re-enabled, even on
  error)

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
- **Radio**: Returns selected value or `null` if none selected
- **Number/Range**: Returns number or `null` if empty. Automatically sanitizes input and applies min/max/step on blur
- **File**: Returns File object (single), FileList (multiple), or `null` if empty
- **Email**: Automatically trimmed and lowercased during input
- **Text/Textarea**: Supports data transformations
- **Select**: Returns value or array for multiple selects

#### Data Transformations

Use the `data-transform` attribute to transform input values:

```html
<!-- CSV transformation: "tag1, tag2, tag3" → ["tag1", "tag2", "tag3"] -->
<input name="tags" data-transform="csv" />

<!-- JSON transformation: '{"key":"value"}' → {key: "value"}
     Returns null if JSON is invalid -->
<input name="payload" data-transform="json" />
```

**Note**: JSON transformation returns `null` if the JSON string is invalid, preventing errors.

#### Number Input Validation

Number inputs are automatically sanitized during input (removes invalid characters) and validated on blur:

- **Input event**: Filters out non-numeric characters (except `.` and `-` for floats)
- **Change event**: Applies min/max constraints and step rounding
- **Integer mode**: Use `data-integer-only` to prevent decimal points

```html
<!-- Integer only (no decimals) -->
<input type="number" name="age" data-integer-only min="0" max="120" />

<!-- Float allowed with step rounding -->
<input type="number" name="price" min="0" max="1000" step="0.01" />
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
new FormHandler(form, async (body, submitButton) => {
	// body will contain:
	// {
	//   username: "john_doe",
	//   email: "john@example.com",
	//   age: 25,
	//   newsletter: true,
	//   gender: "male", // or null if none selected
	//   avatar: File, // or null if no file selected
	//   tags: ["tag1", "tag2", "tag3"],
	//   message: { parsed: "json" } // or null if invalid JSON
	// }

	// submitButton is provided for custom loading states
	// Note: The button is automatically re-enabled even if an error occurs
});
```

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
