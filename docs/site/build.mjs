// @ts-check

import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';

import { fetchReleaseDownloads } from '../../tools/releases/release-assets.ts';

const root = new URL('../../', import.meta.url);
const source = new URL('docs/site/', root);
const output = new URL('dist/site/', root);
const design = new URL('assets/design/', output);
let html = (await readFile(new URL('index.html', source), 'utf8')).replaceAll(
    '../../src/ui/styles/foundation.css',
    './assets/design/foundation.css',
);
const release = await fetchReleaseDownloads(
    'mbolaric/esm-viewer',
    [
        { id: 'windows-exe', suffix: 'x64-setup.exe' },
        { id: 'windows-msi', suffix: 'x64_en-US.msi' },
        { id: 'macos-dmg', suffix: 'aarch64.dmg' },
        { id: 'linux-appimage', suffix: 'amd64.AppImage' },
        { id: 'linux-deb', suffix: 'amd64.deb' },
        { id: 'linux-rpm', suffix: 'x86_64.rpm' },
    ],
    process.env.GITHUB_TOKEN,
);
for (const asset of release.packages) {
    const pattern = new RegExp(`<a\\b([^>]*data-release-asset="${asset.id}"[^>]*)>([\\s\\S]*?)</a>`, 'g');
    if (!pattern.test(html)) throw new Error(`Website is missing the ${asset.id} package link.`);
    html = html.replace(
        pattern,
        /** @param {string} _match @param {string} attributes @param {string} content */
        (_match, attributes, content) =>
            asset.url
                ? `<a${attributes.replace(/href="[^"]*"/, `href="${asset.url}"`)}>${content}</a>`
                : `<span class="package-unavailable">${content} — not available in this release</span>`,
    );
}
const escapedTag = release.tag.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
html = html.replace(
    /(<p\b[^>]*id="release-status"[^>]*>)[\s\S]*?(<\/p>)/,
    /** @param {string} _match @param {string} opening @param {string} closing */
    (_match, opening, closing) =>
        `${opening}Production installers · <a href="${release.url}">${escapedTag} release notes</a>${closing}`,
);
// A content version makes browsers fetch changed site assets instead of reusing a cached copy.
for (const name of ['site.css', 'site.js']) {
    const content = await readFile(new URL(`assets/${name}`, source));
    const version = createHash('sha256').update(content).digest('hex').slice(0, 12);
    html = html.replaceAll(`"./assets/${name}"`, `"./assets/${name}?v=${version}"`);
}

await mkdir(design, { recursive: true });
await Promise.all([
    writeFile(new URL('index.html', output), html),
    copyFile(new URL('.nojekyll', source), new URL('.nojekyll', output)),
    cp(new URL('assets/', source), new URL('assets/', output), { recursive: true }),
    ...['foundation.css', 'tokens.css', 'handbook.css', 'preferences.css'].map((name) =>
        copyFile(new URL('src/ui/styles/' + name, root), new URL(name, design)),
    ),
]);
await copyFile(new URL('src-tauri/icons/128x128@2x.png', root), new URL('assets/icon.png', output));
console.info('Product site built in dist/site. Open dist/site/index.html to preview.');
