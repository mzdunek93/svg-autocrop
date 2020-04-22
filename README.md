# svg-autocrop

A tool for cutting out redundant transparent space from SVG images. It returns the original SVG without any changes besides a `viewBox` attribute updated/added to be as small as possible to fit all of the opaque content.

## Functions

### autocrop

Automatically crops the SVG's viewBox so it doesn't contain redundant transparent content. For performance reasons, it's much preferable to batch requests by passing in an array of images rather than making many frequent requests with single ones. That way all of the SVGs in the array are put on the same page and screenshotted at the same time.

**Overloads:**
<details>
<summary><code class="language-typescript">(input: string, options?: <a href="#Options">Options</a>): Promise&lt;string&gt;</code></summary>

```typescript
async function autocrop(input: string, options?: Options): Promise<string>
```

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`input` | string | A string with the input SVG |
`options?` | [Options](#Options) | Settings for the function |

**Returns:** A promise containing the SVG with the viewBox cropped
</details>

<details>
<summary><code class="language-typescript">(input: string[], options?: <a href="#Options">Options</a>): Promise&lt;string[]&gt;</code></summary>

```typescript
async function autocrop(input: string[], options?: Options): Promise<string[]>
```

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`input` | string[] | A string array with the input SVGs |
`options?` | [Options](#Options) | Settings for the function |

**Returns:** A promise containing the SVGs with the viewBoxes cropped
</details>

___

### startBrowser

Starts the Chrome instance. Used to achieve extra performance by keeping a single browser instance instead of creating a new one for each request. The browser will keep running until the [closeBrowser](#closebrowser) function is invoked or the process emits the `exit` event. In some environments like Jest invoking [closeBrowser](#closebrowser) might be necessary to prevent memory leaks as the process doesn't close the browser on its own when exiting.

```typescript
const startBrowser: () => Promise<ChildProcess>
```

**Returns:** A promise containing the instance of the spawned child process

___

### closeBrowser

Closes the Chrome instance that was started using the [startBrowser](#startbrowser) function.

```typescript
const closeBrowser: () => void
```

## Inferfaces

### Options

Options for the main [autocrop](#autocrop) function

```typescript
interface Options {
  size?: number
  scale?: number
}
```

**Properties:**

• **scale** - How much to scale the viewbox after cropping. Used to prevent opaque parts of the image from being cut and/or to put extra whitespace around it. *Default:* `1.05`

• **size** - Height and width of a single bitmap in pixels. The higher the size the better the precision, but the slower the performance. *Default:* `100`
