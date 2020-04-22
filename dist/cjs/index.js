"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
const puppeteer_1 = __importDefault(require("puppeteer"));
const jimp_1 = __importDefault(require("jimp"));
const debug_1 = require("./debug");
const { window: { document } } = new jsdom_1.JSDOM();
/** The attributes used to infer the viewBox */
const DIMENSION_ATTRS = ['x', 'y', 'width', 'height'];
/** The RegExp used to match CSS enable-background property */
const BACKGROUND_REGEXP = /enable-background:\s*new\s+(?<viewBox>\d+\s+\d+\s+\d+\s+\d+)/;
/**
 * Prepares the SVG content for displaying inside the browser:
 * infers the viewBox and scopes id and class names.
 *
 * @param content - The content of the given SVG
 * @param i - The index of the processed svg in the input table - for error message purposes
 * @returns A DOM div element containing the given preprocessed SVG
 */
const preprocess = (content, i) => {
    var _a, _b, _c, _d;
    const root = document.createElement('div');
    root.innerHTML = content;
    const svg = root.querySelector('svg');
    if (!svg) {
        throw new Error(`Incorrect data in svg #${i}`);
    }
    if (!svg.hasAttribute('viewBox')) {
        const viewBoxDimensions = DIMENSION_ATTRS.map((attr) => { var _a; return parseFloat((_a = svg.getAttribute(attr)) !== null && _a !== void 0 ? _a : '0'); }).join(' ');
        const viewBoxBackground = (_b = (_a = svg.getAttribute('enable-background')) === null || _a === void 0 ? void 0 : _a.split(' ').slice(1).join(' ')) !== null && _b !== void 0 ? _b : (_c = svg
            .getAttribute('style')) === null || _c === void 0 ? void 0 : _c.split(';').filter((attr) => BACKGROUND_REGEXP.test(attr)).map((attr) => attr.match(BACKGROUND_REGEXP).groups.viewBox)[0];
        const viewBox = viewBoxDimensions !== '0 0 0 0' ? viewBoxDimensions : viewBoxBackground;
        if (viewBox) {
            svg.setAttribute('viewBox', viewBox);
        }
    }
    const viewBox = (_d = svg.getAttribute('viewBox')) === null || _d === void 0 ? void 0 : _d.split(' ').map(parseFloat);
    if (!viewBox ||
        viewBox.length !== 4 ||
        viewBox.every((dim) => dim === 0) ||
        viewBox.some(isNaN)) {
        throw new Error(`Invalid viewBox inferred for svg #${i}: "${viewBox === null || viewBox === void 0 ? void 0 : viewBox.join(' ')}"`);
    }
    DIMENSION_ATTRS.forEach(svg.removeAttribute.bind(svg));
    const scope = Math.random().toString(36).substring(7);
    const attrs = [
        { name: 'class', prefix: '\\.' },
        { name: 'id', prefix: '#' }
    ];
    attrs.forEach(({ name, prefix }) => {
        const set = new Set();
        root.querySelectorAll('*').forEach((el) => {
            const val = el.getAttribute(name);
            if (val) {
                const split = val.split(' ');
                split.forEach((val) => set.add(val));
                el.setAttribute(name, split.map((val) => `${val}-${scope}`).join(' '));
            }
        });
        if (set.size > 0) {
            root.innerHTML = root.innerHTML.replace(new RegExp(`(?<${name}>${[...set].map((val) => `${prefix}${val}`).join('|')})`, 'g'), `$<${name}>-${scope}`);
        }
    });
    return root;
};
/**
 * Gets the content of the <style> tag on the HTML page
 *
 * @param size - Height and width of the displayed SVGs
 * @returns A string containing the CSS
 */
const getStyle = (size) => `* {
    margin: 0;
    box-sizing: border-box;
  }
  .svg, svg {
    width: ${size}px;
    height: ${size}px;
    display: inline-flex;
    overflow: hidden;
    box-sizing: border-box;
  }`;
/**
 * Splits an array into chunks of equal length
 *
 * @typeParam T - The type of the array's elements
 * @param arr - The input array
 * @param n - The length of a chunk
 * @returns The split array
 */
const splitArray = (arr, n) => new Array(Math.ceil(arr.length / n)).fill(null).map((_, i) => arr.slice(i * n, (i + 1) * n));
/** The class using Puppeteer to manage Chrome instances and make screenshots */
class Converter {
    constructor() {
        this.startBrowser = () => __awaiter(this, void 0, void 0, function* () {
            if (this.child) {
                this.child.kill();
            }
            const browser = yield puppeteer_1.default.launch();
            this.endpoint = browser.wsEndpoint();
            const child = browser.process();
            child.stdio.forEach((stream) => stream === null || stream === void 0 ? void 0 : stream.destroy());
            child.unref();
            browser.disconnect();
            this.child = child;
            return child;
        });
        this.closeBrowser = () => { var _a; return (_a = this.child) === null || _a === void 0 ? void 0 : _a.kill(); };
        this.getBitmaps = (svgs, size) => __awaiter(this, void 0, void 0, function* () {
            const cols = Math.floor(1600 / size);
            const rows = Math.ceil(svgs.length / cols);
            const viewport = { width: cols * size, height: rows * size };
            const browser = yield (this.endpoint
                ? puppeteer_1.default.connect({ browserWSEndpoint: this.endpoint })
                : puppeteer_1.default.launch());
            const page = yield browser.newPage();
            const content = `<style>${getStyle(size)}</style><body>${svgs.map(this.wrap).join('')}</body>`;
            debug_1.debug(`content`, content);
            yield Promise.all([page.setViewport(viewport), page.setContent(content)]);
            const screen = yield page.screenshot({ omitBackground: true });
            this.dispose(page, browser);
            const image = yield jimp_1.default.read(screen);
            debug_1.debug(`image`, image);
            const { bitmap: { data } } = image;
            return splitArray(splitArray(splitArray(Array.from(data), 4).map((pixel) => pixel[3] !== 0), viewport.width).map((row) => splitArray(row, size)), size)
                .flatMap((imgRow) => new Array(cols).fill(null).map((_, i) => imgRow.map((pxRow) => pxRow[i])))
                .slice(0, svgs.length);
        });
        this.dispose = (page, browser) => __awaiter(this, void 0, void 0, function* () {
            yield page.close();
            yield (browser.process() ? browser.close() : browser.disconnect());
        });
        this.wrap = (root) => {
            const svg = root.querySelector('svg');
            return `<div class="svg">${svg.outerHTML}</div>`;
        };
    }
}
/**
 * Stores an instance of the {@link Converter} class to use throughout the library
 */
const converter = new Converter();
/**
 * Generates an array of numbers from 0 to n - 1 or the reverse
 *
 * @param length - The length of the range
 * @param ascend - Whether to use the ascending order
 * @returns The generated array
 */
const range = (length, ascend = true) => new Array(length).fill(null).map((_, i) => (ascend ? i : length - i - 1));
/**
 * Finds the location of extreme non-transparent pixels
 *
 * @param bitmap - The data to search through
 * @param vertical - Whether to search vertically through the data
 * @param forward - Whether to search from the start of the array
 * @returns The generated array
 */
const findOpaque = ({ height, width, data }, vertical, forward) => range(vertical ? height : width, forward).find((outer) => range(vertical ? width : height).find((inner) => data[vertical ? outer : inner][vertical ? inner : outer]) !== undefined);
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
const processBitmaps = (root, data, size, scale, i) => {
    const svg = root.querySelector('svg');
    const [x, y, width, height] = svg
        .getAttribute('viewBox')
        .split(' ')
        .map((n) => parseFloat(n));
    root.remove();
    const ratio = width / height;
    const bitmap = {
        width: Math.min(size, Math.ceil(size * ratio)),
        height: Math.min(size, Math.ceil(size / ratio)),
        data
    };
    const rowStart = Math.floor((size - bitmap.height) / 2);
    const colStart = Math.floor((size - bitmap.width) / 2);
    bitmap.data = data
        .slice(rowStart, rowStart + bitmap.height)
        .map((row) => row.slice(colStart, colStart + bitmap.width));
    const top = findOpaque(bitmap, true, true);
    const bottom = findOpaque(bitmap, true, false);
    const left = findOpaque(bitmap, false, true);
    const right = findOpaque(bitmap, false, false);
    if ([top, bottom, left, right].some((val) => val === undefined)) {
        throw new Error(`Error processing svg #${i}: no non-transparent pixels found`);
    }
    const newWidth = (width / bitmap.width) * (right - left);
    const newHeight = (height / bitmap.height) * (bottom - top);
    const newX = x + width * (left / bitmap.width) - (newWidth * (scale - 1)) / 2;
    const newY = y + height * (top / bitmap.height) - (newHeight * (scale - 1)) / 2;
    const viewBox = { x: newX, y: newY, width: newWidth * scale, height: newHeight * scale };
    return Object.entries(viewBox).reduce((acc, [key, val]) => (Object.assign(Object.assign({}, acc), { [key]: Number(val.toPrecision(5)) })), {});
};
/**
 * Applies the viewBox to our initial SVG content
 *
 * @param content - The SVG content to which we apply the new viewBox
 * @param viewBox - Parameters for the final viewBox
 * @returns the SVG content with the new viewBox set
 */
const applyViewBox = (content, viewBox) => {
    const attr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
    return content.replace(/\s+viewBox="(.*?)"/, '').replace(/<svg/, `$& viewBox="${attr}"`);
};
/**
 * Starts the Chrome instance
 *
 * @returns The instance of the spawned child process
 *
 * @beta
 */
function startBrowser() {
    return converter.startBrowser();
}
exports.startBrowser = startBrowser;
/**
 * Closes the Chrome instance
 *
 * @beta
 */
function closeBrowser() {
    converter.closeBrowser();
}
exports.closeBrowser = closeBrowser;
function autocrop(input, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { size = 100, scale = 1.05 } = options;
        if (size > 1600) {
            throw new Error(`Maximum bitmap size is 1600, got: ${size}`);
        }
        const contents = Array.isArray(input) ? input : [input];
        const svgs = contents.map(preprocess);
        const bitmaps = yield converter.getBitmaps(svgs, size);
        const viewBoxes = bitmaps.map((data, i) => processBitmaps(svgs[i], data, size, scale, i));
        const result = contents.map((content, i) => applyViewBox(content, viewBoxes[i]));
        return Array.isArray(input) ? result : result[0];
    });
}
exports.autocrop = autocrop;
exports.default = autocrop;
//# sourceMappingURL=index.js.map