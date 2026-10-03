import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('vendor/esm-parser/types/wasm-boundary.d.ts');
const target = resolve('src/viewer/parser/generated/esm_parser.d.ts');

await copyFile(source, target);
