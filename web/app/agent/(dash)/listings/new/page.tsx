import { ApiForm } from '@/components/ApiForm';

const SUBURBS = ['Surry Hills', 'Redfern', 'Waterloo', 'Zetland', 'Glebe', 'Pyrmont', 'Ultimo', 'Haymarket', 'Chippendale', 'Darlinghurst', 'Potts Point', 'Erskineville', 'Alexandria', 'Camperdown', 'Sydney'];

export default function NewListing() {
  return (
    <main className="wrap stack">
      <h1>New listing</h1>
      <p className="muted small">Pilot area: City of Sydney. Lumo adds Microburbs suburb and property data to the card automatically.</p>
      <div className="card">
        <ApiForm action="/api/agent/listings" submit="Publish listing">
          <div className="field"><label htmlFor="address">Street address</label><input id="address" name="address" placeholder="4/112 Albion St" required /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="suburb">Suburb</label><select id="suburb" name="suburb">{SUBURBS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="type">For</label><select id="type" name="type"><option value="rent">Lease</option><option value="sale">Sale</option></select></div>
            <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind"><option value="unit">Unit</option><option value="house">House</option><option value="townhouse">Townhouse</option></select></div>
            <div className="field"><label htmlFor="price">Price ($/wk for lease, $ for sale)</label><input id="price" name="price" type="number" min={100} required /></div>
            <div className="field"><label htmlFor="beds">Beds</label><input id="beds" name="beds" type="number" min={0} defaultValue={1} /></div>
            <div className="field"><label htmlFor="baths">Baths</label><input id="baths" name="baths" type="number" min={0} defaultValue={1} /></div>
            <div className="field"><label htmlFor="parking">Parking</label><input id="parking" name="parking" type="number" min={0} defaultValue={0} /></div>
            <div className="field"><label htmlFor="assignedAgentEmail">Assigned agent email (gets match emails)</label><input id="assignedAgentEmail" name="assignedAgentEmail" type="email" placeholder="Defaults to you" /></div>
          </div>
          <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" maxLength={2000} /></div>
          <div className="field"><label className="check"><input type="checkbox" name="petsConsidered" /> Pets considered</label></div>
          <div className="field"><label className="check"><input type="checkbox" name="photosEdited" /> Some photos are digitally altered or AI-edited (NSW law requires you to disclose this)</label></div>
          <p className="tiny faint">Pilot: demo photos are attached automatically. Photo upload comes with the storage setup.</p>
        </ApiForm>
      </div>
    </main>
  );
}
