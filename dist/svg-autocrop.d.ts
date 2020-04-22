/// <reference types="node" />
import { ChildProcess } from 'child_process';

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
declare function autocrop(input: string[], options?: Options): Promise<string[]>;

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
declare function autocrop(input: string, options?: Options): Promise<string>;
export { autocrop }
export default autocrop;

/**
 * Closes the Chrome instance
 *
 * @beta
 */
export declare function closeBrowser(): void;

/**
 * Options for the main autocrop function
 *
 * @beta
 */
export declare interface Options {
    /**
     * Height and width of a single bitmap in pixels
     * @defaultValue 100
     */
    size?: number;
    /**
     * How much to scale the viewbox after cropping
     * @defaultValue 1.05
     */
    scale?: number;
}

/**
 * Starts the Chrome instance
 *
 * @returns The instance of the spawned child process
 *
 * @beta
 */
export declare function startBrowser(): Promise<ChildProcess>;

export { }
