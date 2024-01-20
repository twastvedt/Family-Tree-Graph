## Project Setup

1. Tag one family in Gramps with a tag named "root".
2. Export an xml file from Gramps to `public/data/family-tree.xml`. If compressed, unzip.

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

1. Marriages get wider at edge??
1. type="about" dateVal - estimate? Other types?
1. Fix the center (see poster for ideas).
1. Use parsed event dates to place nodes
