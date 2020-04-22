import { JSDOM } from 'jsdom'
import puppeteer, { Page, Browser } from 'puppeteer'
import Jimp from 'jimp'
import { ChildProcess } from 'child_process'

import { debug } from './debug'

const {
  window: { document }
} = new JSDOM()

/** The data representing the processed bitmap of an image */
interface BitmapData {
  /** Height in pixels */
  height: number
  /** Width in pixels */
  width: number
  /** Two-dimensional array indicating whether a pixel is transparent or not */
  data: boolean[][]
}

/** Parameters for the page viewport */
interface Viewport {
  /** Height in pixels */
  height: number
  /** Width in pixels */
  width: number
}

/** Data for the SVG viewBox */
interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Options for the main autocrop function
 *
 * @beta
 */
export interface Options {
  /**
   * Height and width of a single bitmap in pixels
   * @defaultValue 100
   */
  size?: number
  /**
   * How much to scale the viewbox after cropping
   * @defaultValue 1.05
   */
  scale?: number
}

/** The attributes used to infer the viewBox */
const DIMENSION_ATTRS = ['x', 'y', 'width', 'height']
/** The RegExp used to match CSS enable-background property */
const BACKGROUND_REGEXP = /enable-background:\s*new\s+(?<viewBox>\d+\s+\d+\s+\d+\s+\d+)/

/**
 * Prepares the SVG content for displaying inside the browser:
 * infers the viewBox and scopes id and class names.
 *
 * @param content - The content of the given SVG
 * @param i - The index of the processed svg in the input table - for error message purposes
 * @returns A DOM div element containing the given preprocessed SVG
 */
const preprocess = (content: string, i: number) => {
  const root = document.createElement('div')
  root.innerHTML = content
  const svg = root.querySelector('svg')

  if (!svg) {
    throw new Error(`Incorrect data in svg #${i}`)
  }

  if (!svg.hasAttribute('viewBox')) {
    const viewBoxDimensions = DIMENSION_ATTRS.map((attr) =>
      parseFloat(svg.getAttribute(attr) ?? '0')
    ).join(' ')

    const viewBoxBackground =
      svg.getAttribute('enable-background')?.split(' ').slice(1).join(' ') ??
      svg
        .getAttribute('style')
        ?.split(';')
        .filter((attr) => BACKGROUND_REGEXP.test(attr))
        .map((attr) => attr.match(BACKGROUND_REGEXP)!.groups!.viewBox)[0]

    const viewBox = viewBoxDimensions !== '0 0 0 0' ? viewBoxDimensions : viewBoxBackground

    if (viewBox) {
      svg.setAttribute('viewBox', viewBox)
    }
  }

  const viewBox = svg.getAttribute('viewBox')?.split(' ').map(parseFloat)
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    viewBox.every((dim) => dim === 0) ||
    viewBox.some(isNaN)
  ) {
    throw new Error(`Invalid viewBox inferred for svg #${i}: "${viewBox?.join(' ')}"`)
  }

  DIMENSION_ATTRS.forEach(svg.removeAttribute.bind(svg))

  const scope = Math.random().toString(36).substring(7)

  const attrs = [
    { name: 'class', prefix: '\\.' },
    { name: 'id', prefix: '#' }
  ]

  attrs.forEach(({ name, prefix }) => {
    const set = new Set()
    root.querySelectorAll('*').forEach((el) => {
      const val = el.getAttribute(name)
      if (val) {
        const split = val.split(' ')
        split.forEach((val) => set.add(val))
        el.setAttribute(name, split.map((val) => `${val}-${scope}`).join(' '))
      }
    })

    if (set.size > 0) {
      root.innerHTML = root.innerHTML.replace(
        new RegExp(`(?<${name}>${[...set].map((val) => `${prefix}${val}`).join('|')})`, 'g'),
        `$<${name}>-${scope}`
      )
    }
  })

  return root
}

/**
 * Gets the content of the <style> tag on the HTML page
 *
 * @param size - Height and width of the displayed SVGs
 * @returns A string containing the CSS
 */
const getStyle = (size: number) =>
  `* {
    margin: 0;
    box-sizing: border-box;
  }
  .svg, svg {
    width: ${size}px;
    height: ${size}px;
    display: inline-flex;
    overflow: hidden;
    box-sizing: border-box;
  }`

/**
 * Splits an array into chunks of equal length
 *
 * @typeParam T - The type of the array's elements
 * @param arr - The input array
 * @param n - The length of a chunk
 * @returns The split array
 */
const splitArray = <T>(arr: T[], n: number) =>
  new Array(Math.ceil(arr.length / n)).fill(null).map((_, i) => arr.slice(i * n, (i + 1) * n))

/** The class using Puppeteer to manage Chrome instances and make screenshots */
class Converter {
  endpoint?: string
  child?: ChildProcess

  startBrowser = async () => {
    if (this.child) {
      this.child.kill()
    }
    const browser = await puppeteer.launch()
    this.endpoint = browser.wsEndpoint()
    const child = browser.process()
    child.stdio.forEach((stream) => stream?.destroy())
    child.unref()
    browser.disconnect()
    this.child = child
    return child
  }

  closeBrowser = () => this.child?.kill()

  getBitmaps = async (svgs: HTMLElement[], size: number) => {
    const cols = Math.floor(1600 / size)
    const rows = Math.ceil(svgs.length / cols)
    const viewport = { width: cols * size, height: rows * size }

    const browser = await (this.endpoint
      ? puppeteer.connect({ browserWSEndpoint: this.endpoint })
      : puppeteer.launch())
    const page = await browser.newPage()
    const content = `<style>${getStyle(size)}</style><body>${svgs.map(this.wrap).join('')}</body>`
    debug(`content`, content)
    await Promise.all([page.setViewport(viewport), page.setContent(content)])

    const screen = await page.screenshot({ omitBackground: true })
    this.dispose(page, browser)
    const image = await Jimp.read(screen)
    debug(`image`, image)

    const {
      bitmap: { data }
    } = image

    return splitArray(
      splitArray(
        splitArray(Array.from(data), 4).map((pixel) => pixel[3] !== 0),
        viewport.width
      ).map((row) => splitArray(row, size)),
      size
    )
      .flatMap((imgRow) =>
        new Array(cols).fill(null).map((_, i) => imgRow.map((pxRow) => pxRow[i]))
      )
      .slice(0, svgs.length)
  }

  dispose = async (page: Page, browser: Browser) => {
    await page.close()
    await (browser.process() ? browser.close() : browser.disconnect())
  }

  wrap = (root: HTMLElement) => {
    const svg = root.querySelector('svg')!
    return `<div class="svg">${svg.outerHTML}</div>`
  }
}

/**
 * Stores an instance of the {@link Converter} class to use throughout the library
 */
const converter = new Converter()

/**
 * Generates an array of numbers from 0 to n - 1 or the reverse
 *
 * @param length - The length of the range
 * @param ascend - Whether to use the ascending order
 * @returns The generated array
 */
const range = (length: number, ascend = true) =>
  new Array(length).fill(null).map((_, i) => (ascend ? i : length - i - 1))

/**
 * Finds the location of extreme non-transparent pixels
 *
 * @param bitmap - The data to search through
 * @param vertical - Whether to search vertically through the data
 * @param forward - Whether to search from the start of the array
 * @returns The generated array
 */
const findOpaque = ({ height, width, data }: BitmapData, vertical: boolean, forward: boolean) =>
  range(vertical ? height : width, forward).find(
    (outer) =>
      range(vertical ? width : height).find(
        (inner) => data[vertical ? outer : inner][vertical ? inner : outer]
      ) !== undefined
  )

/**
 * Processes the bitmaps returned by the converter function
 *
 * @param root - The DOM element containing SVG data
 * @param data - The 2D array indicating transparent pixels
 * @param size - Width and height of the bitmap
 * @param scale - How much to scale the viewBox after calculating
 * @param i - The index of the processed SVG, for error message purposes
 * @returns The calculated viewBox
 */
const processBitmaps = (
  root: HTMLElement,
  data: boolean[][],
  size: number,
  scale: number,
  i: number
) => {
  const svg = root.querySelector('svg')!

  const [x, y, width, height] = svg
    .getAttribute('viewBox')!
    .split(' ')
    .map((n) => parseFloat(n))

  root.remove()

  const ratio = width / height

  const bitmap: BitmapData = {
    width: Math.min(size, Math.ceil(size * ratio)),
    height: Math.min(size, Math.ceil(size / ratio)),
    data
  }

  const rowStart = Math.floor((size - bitmap.height) / 2)
  const colStart = Math.floor((size - bitmap.width) / 2)

  bitmap.data = data
    .slice(rowStart, rowStart + bitmap.height)
    .map((row) => row.slice(colStart, colStart + bitmap.width))

  const top = findOpaque(bitmap, true, true)
  const bottom = findOpaque(bitmap, true, false)
  const left = findOpaque(bitmap, false, true)
  const right = findOpaque(bitmap, false, false)

  if ([top, bottom, left, right].some((val) => val === undefined)) {
    throw new Error(`Error processing svg #${i}: no non-transparent pixels found`)
  }

  const newWidth = (width / bitmap.width) * (right! - left!)
  const newHeight = (height / bitmap.height) * (bottom! - top!)
  const newX = x + width * (left! / bitmap.width) - (newWidth * (scale - 1)) / 2
  const newY = y + height * (top! / bitmap.height) - (newHeight * (scale - 1)) / 2

  const viewBox = { x: newX, y: newY, width: newWidth * scale, height: newHeight * scale }

  return Object.entries(viewBox).reduce(
    (acc, [key, val]) => ({ ...acc, [key]: Number(val.toPrecision(5)) }),
    {} as ViewBox
  )
}

/**
 * Applies the viewBox to our initial SVG content
 *
 * @param content - The SVG content to which we apply the new viewBox
 * @param viewBox - Parameters for the final viewBox
 * @returns the SVG content with the new viewBox set
 */
const applyViewBox = (content: string, viewBox: ViewBox) => {
  const attr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`

  return content.replace(/\s+viewBox="(.*?)"/, '').replace(/<svg/, `$& viewBox="${attr}"`)
}

/**
 * Starts the Chrome instance
 *
 * @returns The instance of the spawned child process
 *
 * @beta
 */
export function startBrowser() {
  return converter.startBrowser()
}

/**
 * Closes the Chrome instance
 *
 * @beta
 */
export function closeBrowser() {
  converter.closeBrowser()
}

/**
 * Automatically crops the SVG's viewBox so it doesn't contain redundant transparent content.
 *
 * @remarks For performance reasons, it's much preferable to batch requests by passing in an array
 * rather than making many frequent requests with single images
 *
 * @param input - A string array with the input SVGs
 * @param options - Settings for the function
 * @returns A promise containing the SVGs with the viewBoxes cropped
 *
 * @beta
 */
export async function autocrop(input: string[], options?: Options): Promise<string[]>

/**
 * Automatically crops the SVG's viewBox so it doesn't contain redundant transparent content.
 *
 * @remarks For performance reasons, it's much preferable to batch requests by passing in an array
 * rather than making many frequent requests with single images
 *
 * @param input - A string with the input SVG
 * @param options - Settings for the function
 * @returns A promise containing the SVG with the viewBox cropped
 *
 * @beta
 */
export async function autocrop(input: string, options?: Options): Promise<string>
export async function autocrop(input: string[] | string, options: Options = {}) {
  const { size = 100, scale = 1.05 } = options

  if (size > 1600) {
    throw new Error(`Maximum bitmap size is 1600, got: ${size}`)
  }

  const contents = Array.isArray(input) ? input : [input]
  const svgs = contents.map(preprocess)
  const bitmaps = await converter.getBitmaps(svgs, size)
  const viewBoxes = bitmaps.map((data, i) => processBitmaps(svgs[i], data, size, scale, i))
  const result = contents.map((content, i) => applyViewBox(content, viewBoxes[i]))

  return Array.isArray(input) ? result : result[0]
}

export default autocrop
