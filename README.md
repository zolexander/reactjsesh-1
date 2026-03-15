# reactjsesh

Dieses Repository ist jetzt auf eine schlanke jsesh-Kernbibliothek fuer Manuel de Codage (MdC) ausgerichtet.

## Struktur

Die Bibliothek liegt in src/jsesh und ist in diese Bereiche getrennt:

- parser: Lexer und rekursiver Parser
- model: AST- und Model-Klassen
- layout: Gruppierung und Bounding-Box-Layout
- glyphs: Glyph-Metriken aus XML
- renderer: Canvas- und SVG-Ausgabe
- resources: Platz fuer Fonts, XML und weitere Daten

## Entwicklung

```bash
npm install
npm run dev
```

## Builds

Gesamtes Projekt bauen:

```bash
npm run build
```

Nur die jsesh-Library bauen:

```bash
npm run build:jsesh
```

## Library verwenden

Nach dem Build ist die Library ueber den Package-Subpath verfuegbar:

```ts
import { tokenizeMdC, parseMdC } from 'reactjsesh/jsesh'
```

## Hinweise

- Der Parser ist absichtlich schlank gehalten und noch nicht vollstaendig.
- groupOp wird in Hieroglyph gespeichert, wie von dir gewuenscht.
- Das Ziel ist zuerst eine saubere Bibliotheksbasis, nicht eine fertig ausprogrammierte Editor-App.
