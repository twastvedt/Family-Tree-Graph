## Project Setup

1. Export an xml file from Gramps to `public/data/family-tree.xml`.

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## To Do

1. Fix family arc dragging.
1. Save drags to file.
1. Allow dragging uncertain start/end lifelines and family arcs.
1. Update to current d3 version and fix everything.
1. Nicer styles.
1. Life lines fading.
1. Fix the center (see poster for ideas).
1. Change default locations to level date averages
1. Use parsed event dates to place nodes
