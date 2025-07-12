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

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
