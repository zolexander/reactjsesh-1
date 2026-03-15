import { useMemo } from 'react'
import { buildGroupTree, parseMdC, tokenizeMdC } from './jsesh'
import './App.css'

const sampleMdC = 'A1-B1:C1*D1'

function App() {
  const tokens = useMemo(() => tokenizeMdC(sampleMdC), [])
  const topItemList = useMemo(() => parseMdC(sampleMdC), [])
  const groupedTree = useMemo(() => {
    const firstCadrat = topItemList.items[0]
    if (!firstCadrat) {
      return null
    }

    return buildGroupTree(firstCadrat.flattenHieroglyphs())
  }, [topItemList])

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
          <h2>Beispiel MdC</h2>
          <pre>{sampleMdC}</pre>
        </article>

        <article className="panel panel-wide">
          <h2>Lexer Tokens</h2>
          <pre>{JSON.stringify(tokens, null, 2)}</pre>
        </article>

        <article className="panel panel-wide">
          <h2>Parser AST</h2>
          <pre>{JSON.stringify(topItemList, null, 2)}</pre>
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
