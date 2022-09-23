# Promising Artist

A small library that simplies communication between a Figma plugin code and its UI code. The methods on one side are exposed to the other as methods that return promises and encapsulate all of the details of the inter-frame messaging.

* NPM: [@travisspomer/promising-artist](https://www.npmjs.com/package/@travisspomer/promising-artist) <br />[![](https://badgen.net/bundlephobia/minzip/@travisspomer/promising-artist@latest)](https://bundlephobia.com/package/@travisspomer/promising-artist@latest)

## Usage

```sh
npm i @travisspomer/promising-artist
```

Both sides need to call `PromisingArtist.collab`, or its React equivalent `useCollab`, before either side calls methods on the other. If using TypeScript, you should also make `interface`s for each side's methods.

### In your plugin code

```ts
import * as PromisingArtist from "@travisspomer/promising-artist"

export interface PluginMethods {
	getColors(): string[]
}

const UI = PromisingArtist.collab<PluginMethods, UIMethods>(
	{
		getColors() {
			return ["#ffaaaa", "#c0c0c0"]
		},
	},
	PromisingArtist.FigmaPlugin
)
```

### In your UI

This example assumes you're using React, but you can also call `collab` again instead of `useCollab`.

```tsx
import * as PromisingArtist from "@travisspomer/promising-artist"

export interface UIMethods {}

const MyComponent = () => {
	const Plugin = PromisingArtist.useCollab<UIMethods, PluginMethods>(
		{
			// UIMethods doesn't need anything in this example
		},
		PromisingArtist.FigmaPluginUI
	)
	const [colors, setColors] = React.useState<string[]>([])

	const refreshColors = async () => {
		setColors(await Plugin.getColors())
	}

	return (
		<>
			{colors.map((fill, index) => (
				<li key={index}>{fill.color}</li>
			))}
			<button onClick={refreshColors}>Refresh</button>
		</>
	)
}
```

## Tips

### `async` methods

`async` methods are supported too.

```ts
const Plugin = PromisingArtist.useCollab<UIMethods, PluginMethods>(
	return42(): number {
		return 42
	},
	async sleepAndReturn42(): Promise<number> {
		await sleep(1000)
		return 42
	},
	PromisingArtist.FigmaPluginUI
)
```

If a method returns a promise, then the result won't be sent to the other side until the promise is fulfilled. The return type of the version of the method on the other side's proxy will not be wrapped in a second promise.

In the above example, the implementation of `return42` returns `number` and its async twin `sleepAndReturn42` returns `Promise<number>` since it's async. On the other side, the proxy returned by `collab` will have `return42` and `sleepAndReturn42`, but **both** will return `Promise<number>`. (`sleepAndReturn42` will **not** return `Promise<Promise<number>>`.) Both `await UI.return42()` and `await UI.sleepAndReturn42()` will return the `number` 42.

### Interfaces

In TypeScript, the interfaces for your methods can be called anything you want; `UIMethods` and `PluginMethods` are just suggestions.

---

© 2022 Travis Spomer. Released under the [MIT license](license.txt) and provided as-is, and no warranties are made as to its functionality or suitability.
