# Third-party notices

Fatorati itself is proprietary (see `LICENSE`). It bundles or depends on the
following third-party components. Nothing here changes their licenses.

## Runtime libraries (included in the APK)

| Component | Version | License |
|---|---|---|
| @capacitor/core, @capacitor/android | 8.5.2 | MIT |
| @capacitor/app | 8.1.1 | MIT |
| @capacitor/filesystem | 8.1.3 | MIT |
| @capacitor/haptics | 8.0.2 | MIT |
| @capacitor/keyboard | 8.0.5 | MIT |
| @capacitor/local-notifications | 8.3.1 | MIT |
| @capacitor/preferences | 8.0.1 | MIT |
| @capacitor/share | 8.0.2 | MIT |
| @capacitor/splash-screen | 8.0.2 | MIT |
| @capacitor/status-bar | 8.0.3 | MIT |
| @capgo/capacitor-native-biometric | 8.7.0 | **MPL-2.0** |
| jspdf | 4.2.x | MIT |
| lucide-react | 1.4x | ISC |
| react, react-dom | 19.x | MIT |
| write-excel-file | 4.1.x | MIT |
| zustand | 5.x | MIT |
| canvg (via jspdf) | 3.0.11 | MIT |
| core-js (via jspdf) | 3.x | MIT |
| dompurify (via jspdf) | 3.x | **MPL-2.0 OR Apache-2.0** |
| fflate (via jspdf, write-excel-file) | 0.8.x | MIT |
| html2canvas (via jspdf) | 1.4.1 | MIT |
| pako (via jspdf) | 2.x | (MIT AND Zlib) |

### Bundled transitive libraries

`jspdf` and `write-excel-file` are the only runtime libraries with dependencies of
their own, and those dependencies end up inside the APK bundle (they are visible
in `dist/` as `html2canvas-*.js`, `purify.es-*.js` and inside `jspdf.es.min-*.js`).
They are listed above with their real license and copyright lines:

| Library | Version | License | Copyright notice |
|---|---|---|---|
| html2canvas | 1.4.1 | MIT | Copyright (c) 2012 Niklas von Hertzen |
| dompurify | 3.4.16 | MPL-2.0 OR Apache-2.0 | Author recorded in its package.json: Dr.-Ing. Mario Heiderich, Cure53 (`mario@cure53.de`); its `LICENSE` holds the Apache-2.0 text and `LICENSE-MPL` the MPL-2.0 text |
| canvg | 3.0.11 | MIT | Copyright (c) 2010 - present Gabe Lerner (gabelerner@gmail.com) |
| core-js | 3.50.0 | MIT | Copyright (c) 2013–2025 Denis Pushkarev (zloirock.ru) · Copyright (c) 2025–2026 CoreJS Company (core-js.io) |
| pako | 2.2.0 | MIT AND Zlib | Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn |
| fflate | 0.8.3 | MIT | Copyright (c) 2026 Arjun Barrett |

The MIT permission notice, reproduced once and applying to every MIT-licensed
component listed in this file:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`pako` is also available under the Zlib license. The full texts of every licence
mentioned here ship inside the installed packages
(`node_modules/.pnpm/<package>/node_modules/<package>/LICENSE*`), and the upstream
repositories are the ones recorded in each package's `package.json`.

### MPL-2.0 note

`@capgo/capacitor-native-biometric` is used **unmodified** as a compiled
dependency. `dompurify` is **dual-licensed MPL-2.0 OR Apache-2.0**, so either
option may be relied on; nothing in this project modifies it either. Its source is available at
https://github.com/Cap-go/capacitor-native-biometric (MPL-2.0). Because no
MPL-covered file was modified, this project's own source remains under its own
license; the plugin's files stay under MPL-2.0 and are not vendored into this
repository.

## Development-only tools (not shipped in the APK)

@capacitor/cli (MIT), @tailwindcss/vite and tailwindcss (MIT), @vitejs/plugin-react
(MIT), vite (MIT), typescript (Apache-2.0), tsx (MIT), playwright (Apache-2.0),
fake-indexeddb (Apache-2.0), @types/* (MIT).

`write-excel-file` bundles `fflate` (MIT) to write the .xlsx container. No
network access is involved in generating or opening an export.

## Fonts (bundled as WOFF2 in `public/fonts`)

| Family | License | License text |
|---|---|---|
| Inter | SIL Open Font License 1.1 | `public/fonts/inter-LICENSE.txt` |
| Tajawal | SIL Open Font License 1.1 | `public/fonts/tajawal-LICENSE.txt` |
| Sora | SIL Open Font License 1.1 | `public/fonts/sora-LICENSE.txt` |
| JetBrains Mono | SIL Open Font License 1.1 | `public/fonts/jetbrains-mono-LICENSE.txt` |

Fonts are distributed by Fontsource 5.3.0 and originate from their respective
upstream projects. OFL permits bundling inside proprietary applications as long
as the fonts are not sold by themselves, are not renamed, and the license texts
accompany them — all satisfied here.

## Release checklist for notices

Run `pnpm licenses list` after any dependency change and update this file when a
package is added or removed. `pnpm licenses list | grep -iE "GPL|AGPL|SSPL|unknown"`
must stay empty: everything shipped is MIT, ISC, BSD, Apache-2.0, BlueOak, 0BSD,
Unlicense, `MIT AND Zlib`, or the MPL-2.0/Apache-2.0 dual licence noted above.

## Android platform

The app builds against the Android SDK and AndroidX libraries distributed under
the Apache License 2.0. Gradle and the Android Gradle Plugin are used as build
tools only.

## Trademarks

"Fatorati", the app icon and the bundled artwork are the property of the
copyright holder. Android, Google Play and Gradle are trademarks of their
respective owners and are used only to describe compatibility.
