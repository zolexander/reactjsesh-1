import { useMemo, useState } from 'react'
import { HieroglyphCanvas, buildGroupTree, parseMdC, tokenizeMdC } from './jsesh'
import './App.css'

const sampleMdC = 'A1-B1:C1*D1'

function App() {
  const [mdcText, setMdcText] = useState(sampleMdC)

  const tokens = useMemo(() => tokenizeMdC(mdcText), [mdcText])
  const parseResult = useMemo(() => {
    try {
      return { topItemList: parseMdC(mdcText), error: null as string | null }
    } catch (error) {
      return {
        topItemList: null,
        error: error instanceof Error ? error.message : 'Unknown parser error',
      }
    }
  }, [mdcText])

  const groupedTree = useMemo(() => {
    if (!parseResult.topItemList) {
      return null
    }

    const firstCadrat = parseResult.topItemList.items[0]
    if (!firstCadrat) {
      return null
    }

    return buildGroupTree(firstCadrat.flattenHieroglyphs())
  }, [parseResult.topItemList])

  const astPreview = useMemo(() => {
    if (parseResult.error) {
      return `Parser error: ${parseResult.error}`
    }

    return JSON.stringify(parseResult.topItemList, null, 2)
  }, [parseResult.error, parseResult.topItemList])

  return (
    <main className="app-shell">
      <header className="hero-card">
        <p className="eyebrow">React + TypeScript + Library Core</p>
        <h1>jsesh MdC Workspace</h1>
        <p className="subtitle">
          Der Kern liegt jetzt separat in src/jsesh und ist in Lexer, Parser,
          Model, Layout, Glyphs und Renderer aufgeteilt.
        </p>
      </header>

      <section className="overview-grid">
        <article className="panel panel-wide">
          <h2>MdC Eingabe</h2>
          <textarea
            className="mdc-input"
            value={mdcText}
            onChange={(event) => setMdcText(event.target.value)}
            spellCheck={false}
            aria-label="MdC Eingabetext"
          />
          <div className="render-preview">
            <HieroglyphCanvas mdc={mdcText} />
          </div>
        </article>

        <article className="panel">
          <h2>Ordner</h2>
          <ul>
            <li>src/jsesh/parser</li>
            <li>src/jsesh/model</li>
            <li>src/jsesh/layout</li>
            <li>src/jsesh/glyphs</li>
            <li>src/jsesh/renderer</li>
            <li>src/jsesh/resources</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Aktuelles MdC</h2>
          <pre>{mdcText}</pre>
        </article>

        <article className="panel panel-wide">
          <h2>Lexer Tokens</h2>
          <pre>{JSON.stringify(tokens, null, 2)}</pre>
        </article>

        <article className="panel panel-wide">
          <h2>Parser AST</h2>
          <pre>{astPreview}</pre>
        </article>

        <article className="panel panel-wide">
          <h2>Gruppenbaum</h2>
          <pre>{JSON.stringify(groupedTree, null, 2)}</pre>
        </article>
      </section>
    </main>
  )
}

export default App
