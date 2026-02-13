# TheOcean Extension Dictionary (MV3 + Vite)

Project la Chrome Extension (Manifest V3). Code trong `scripts/` da duoc chuyen sang ES modules va can bundle truoc khi load vao Chrome.

## Build

```powershell
npm.cmd install
npm.cmd run build
```

Output: `dist/`

## Dev (watch)

```powershell
npm.cmd run watch
```

## Load extension

- Chrome -> `chrome://extensions`
- Enable "Developer mode"
- "Load unpacked" -> chon thu muc `dist/`

