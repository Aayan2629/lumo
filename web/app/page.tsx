export default function Home() {
  return (
    <main>
      <div className="wrap" style={{ paddingBottom: 40 }}>
        <div className="row between"><a className="logo" href="/"><i />Lumo</a><a className="btn ghost sm" href="/login">Sign in</a></div>
        <section style={{ margin: '40px 0 28px' }}>
          <h1 style={{ fontSize: 40 }}>Prove who you are once. Swipe on homes. Land in the agent’s inbox as a verified lead.</h1>
          <p className="muted" style={{ fontSize: 17 }}>Lumo checks your ID and finances itself, then shows agents a badge, never your documents. Every home comes with suburb data from Microburbs.</p>
        </section>
        <div className="stack">
          <a className="btn block" href="/login?role=renter">I’m looking to rent</a>
          <a className="btn secondary block" href="/login?role=investor">I’m looking to invest</a>
          <a className="btn ghost block" href="/agent/signup">I’m an agent</a>
        </div>
        <div className="grid2" style={{ marginTop: 32 }}>
          <div className="card"><h3>Verify once</h3><p className="muted small">Two government IDs checked live, plus income and bond through read-only open banking. Agents see “ID verified” and “Income covers rent 3x”, never the statements.</p></div>
          <div className="card"><h3>Swipe with data</h3><p className="muted small">Commute time, crime, amenities, rent trends and flood or bushfire flags on every card. Investors get yield, growth and vacancy.</p></div>
          <div className="card"><h3>Free for renters</h3><p className="muted small">Renters never pay. Agencies pay to reach verified people.</p></div>
          <div className="card"><h3>Safe by design</h3><p className="muted small">Lumo never stores ID images, account numbers or transactions. Lumo will never ask you to pay a deposit to view a property.</p></div>
        </div>
        <p className="tiny faint" style={{ marginTop: 28 }}>Pilot: City of Sydney. <a href="/privacy">Privacy</a> · <a href="/collection-notice">Collection notice</a></p>
      </div>
    </main>
  );
}
