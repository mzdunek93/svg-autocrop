## API Report File for "@mzdunek/svg-autocrop"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { ChildProcess } from 'child_process';

// @beta
function autocrop(input: string[], options?: Options): Promise<string[]>;

// @beta
function autocrop(input: string, options?: Options): Promise<string>;

export { autocrop }

export default autocrop;

// @beta
export function closeBrowser(): void;

// @beta
export interface Options {
    scale?: number;
    size?: number;
}

// @beta
export function startBrowser(): Promise<ChildProcess>;


// (No @packageDocumentation comment for this package)

```
