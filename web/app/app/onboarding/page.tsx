import { requireUser } from '@/lib/auth';
import { myProfile } from '@/lib/session-data';
import { PLACES } from '@/lib/geo';
import { ApiForm } from '@/components/ApiForm';

export default async function Onboarding() {
  const u = await requireUser(['renter', 'investor']);
  const { user, profile: p } = await myProfile(u.id);
  const inv = user.role === 'investor';
  const placeId = PLACES.find((x) => x.label === p?.commute_place)?.id ?? '';
  return (
    <main className="wrap stack">
      <a className="logo" href="/app"><i />Lumo</a>
      <h1>{p?.onboarded_at ? 'Your preferences' : 'Let’s set you up'}</h1>
      <p className="muted">Agents only ever see your first name, badges and the move-in details below, and only after you like one of their homes.</p>
      <div className="card">
        <ApiForm action="/api/profile" submit={p?.onboarded_at ? 'Save' : 'Continue to verification'}>
          <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" defaultValue={user.name ?? ''} autoComplete="name" required /></div>
          <div className="field"><label htmlFor="role">I’m looking to</label>
            <select id="role" name="role" defaultValue={user.role}><option value="renter">Rent</option><option value="investor">Buy to invest</option></select></div>
          {!inv ? (
            <>
              <div className="field"><label htmlFor="moveIn">Move-in date</label><input id="moveIn" name="moveIn" type="date" defaultValue={p?.move_in_date ? new Date(p.move_in_date).toISOString().slice(0, 10) : ''} /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="occupants">Number of people</label><input id="occupants" name="occupants" type="number" min={1} max={12} defaultValue={p?.occupants ?? 1} /></div>
                <div className="field"><label htmlFor="pets">Pets</label>
                  <select id="pets" name="pets" defaultValue={p?.pets ?? 'none'}><option value="none">None</option><option value="cat">Cat</option><option value="dog">Dog</option><option value="other">Other</option></select></div>
              </div>
              <div className="field"><label htmlFor="maxRent">Max rent per week ($)</label><input id="maxRent" name="maxRent" type="number" min={100} step={10} defaultValue={p?.max_rent_weekly ?? 750} required /></div>
              <div className="field"><label htmlFor="commute">Commute to</label>
                <select id="commute" name="commute" defaultValue={placeId}><option value="">Skip for now</option>{PLACES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
            </>
          ) : (
            <>
              <div className="field"><label htmlFor="maxPrice">Max price ($)</label><input id="maxPrice" name="maxPrice" type="number" min={100000} step={10000} defaultValue={p?.max_price ?? 1000000} required /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="kind">Property type</label>
                  <select id="kind" name="kind" defaultValue={p?.property_kind ?? 'any'}><option value="any">Any</option><option value="house">House</option><option value="unit">Unit</option></select></div>
                <div className="field"><label htmlFor="strategy">Strategy</label>
                  <select id="strategy" name="strategy" defaultValue={p?.investor_strategy ?? 'growth'}><option value="growth">Capital growth</option><option value="cashflow">Cash flow</option></select></div>
              </div>
              <div className="field"><label htmlFor="minYield">Minimum gross yield (%)</label><input id="minYield" name="minYield" type="number" step="0.1" min={0} max={15} defaultValue={p?.min_yield ?? ''} /></div>
              <div className="field"><label className="check"><input type="checkbox" name="noRisk" defaultChecked={p?.no_risk_overlay} /> Hide homes with a flood or bushfire overlay</label></div>
            </>
          )}
          <div className="field"><label className="check"><input type="checkbox" name="consent" defaultChecked={!!p?.consented_collection_at} required />
            <span>I’ve read the <a href="/collection-notice" target="_blank">collection notice</a> and <a href="/privacy" target="_blank">privacy policy</a>.</span></label></div>
        </ApiForm>
      </div>
    </main>
  );
}
