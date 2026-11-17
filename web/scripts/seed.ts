// Seeds a demo agency, team and City of Sydney listings for the pilot. Safe to re-run: it
// wipes only rows belonging to the demo agency. Addresses are made up for the demo.
import { Client } from 'pg';
import { migrate } from './migrate';

const SUBURB_CENTRES: Record<string, [number, number, string]> = {
  'Surry Hills': [-33.8861, 151.2111, '2010'], Redfern: [-33.8928, 151.2048, '2016'], Waterloo: [-33.9003, 151.2063, '2017'],
  Zetland: [-33.9078, 151.2093, '2017'], Glebe: [-33.8798, 151.1866, '2037'], Pyrmont: [-33.8698, 151.1944, '2009'],
  Ultimo: [-33.8790, 151.1975, '2007'], Haymarket: [-33.8803, 151.2050, '2000'], Chippendale: [-33.8870, 151.1990, '2008'],
  Darlinghurst: [-33.8790, 151.2196, '2010'], 'Potts Point': [-33.8693, 151.2257, '2011'], Erskineville: [-33.9026, 151.1857, '2043'],
  Alexandria: [-33.9050, 151.1940, '2015'], Camperdown: [-33.8889, 151.1790, '2050'],
};
const P = (...n: string[]) => n.map((x) => `/img/${x}.jpg`);

type L = [address: string, suburb: string, type: 'rent' | 'sale', kind: 'unit' | 'house' | 'townhouse', price: number, beds: number, baths: number, parking: number, pets: boolean, photos: string[], desc: string, edited?: boolean, boosted?: boolean];
const LISTINGS: L[] = [
  ['4/112 Albion St', 'Surry Hills', 'rent', 'unit', 720, 1, 1, 0, false, P('lounge', 'kitchen', 'bedroom'), 'Sunny one-bedder a block from Crown St cafes.', false, true],
  ['17 Cooper St', 'Surry Hills', 'rent', 'townhouse', 1150, 2, 1, 1, true, P('living', 'kitchen-b', 'bedroom-c'), 'Terrace with courtyard, pets considered.'],
  ['9/45 Pitt St', 'Redfern', 'rent', 'unit', 690, 1, 1, 1, false, P('kitchen-c', 'lounge-b', 'bedroom'), 'Walk to Redfern station and Uni of Sydney.'],
  ['22/1 Phillip St', 'Waterloo', 'rent', 'unit', 650, 1, 1, 0, true, P('bedroom-b', 'living-c', 'kitchen'), 'New build near Waterloo metro.'],
  ['805/8 Defries Ave', 'Zetland', 'rent', 'unit', 820, 2, 2, 1, false, P('living-b', 'kitchen', 'bedroom-c'), 'Two bed two bath with balcony, East Village shops downstairs.'],
  ['3/60 Glebe Point Rd', 'Glebe', 'rent', 'unit', 640, 1, 1, 0, false, P('lounge-c', 'bedroom', 'kitchen-b'), 'Leafy street, 10 minutes walk to Sydney Uni.', true],
  ['1204/2 Jones Bay Rd', 'Pyrmont', 'rent', 'unit', 950, 2, 1, 1, false, P('living', 'bedroom-b', 'kitchen-c'), 'Harbour glimpses, light rail at the door.'],
  ['12/700 Harris St', 'Ultimo', 'rent', 'unit', 560, 1, 1, 0, false, P('bedroom-c', 'lounge', 'kitchen'), 'Student favourite, opposite UTS.', false, true],
  ['1503/1 Sussex St', 'Haymarket', 'rent', 'unit', 610, 1, 1, 0, false, P('kitchen-b', 'living-c', 'bedroom'), 'Central location above Paddy\'s Markets.'],
  ['2/14 Abercrombie St', 'Chippendale', 'rent', 'unit', 700, 2, 1, 0, true, P('lounge-b', 'bedroom-b', 'kitchen-c'), 'Warehouse conversion near Central Park.'],
  ['7/220 Victoria St', 'Darlinghurst', 'rent', 'unit', 680, 1, 1, 0, false, P('living-c', 'kitchen', 'bedroom-c'), 'Art deco flat, steps to Kings Cross station.'],
  ['31 Macleay St', 'Potts Point', 'rent', 'unit', 760, 1, 1, 1, false, P('lounge', 'bedroom', 'living-b'), 'Top floor, parking included.'],
  ['48 Erskineville Rd', 'Erskineville', 'rent', 'house', 1250, 3, 2, 1, true, P('living', 'kitchen-b', 'lounge-c'), 'Family terrace with garden, dogs considered.'],
  ['5/9 Bourke Rd', 'Alexandria', 'rent', 'unit', 740, 2, 1, 1, false, P('kitchen-c', 'living-b', 'bedroom'), 'Quiet complex near Green Square station.'],
  ['10/30 Missenden Rd', 'Camperdown', 'rent', 'unit', 620, 1, 1, 0, false, P('bedroom-b', 'lounge-c', 'kitchen'), 'Next to RPA and Sydney Uni.'],
  ['602/88 Wattle St', 'Ultimo', 'sale', 'unit', 780000, 1, 1, 0, false, P('lounge-b', 'kitchen', 'bedroom-c'), 'Tenanted at $600/wk until May.'],
  ['14 George St', 'Redfern', 'sale', 'house', 1450000, 2, 1, 0, false, P('living-c', 'kitchen-b', 'bedroom'), 'Renovated terrace close to the station.'],
  ['1101/5 Joynton Ave', 'Zetland', 'sale', 'unit', 920000, 2, 2, 1, false, P('living', 'bedroom-b', 'kitchen-c'), 'Corner apartment, strong rental demand.'],
  ['8/3 Wentworth Park Rd', 'Glebe', 'sale', 'unit', 690000, 1, 1, 0, false, P('kitchen', 'lounge', 'bedroom-b'), 'Park views, low strata.'],
  ['2306/38 Bay St', 'Haymarket', 'sale', 'unit', 650000, 1, 1, 0, false, P('bedroom', 'living-b', 'kitchen-b'), 'High floor, CBD views.'],
];

async function main() {
  await migrate();
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('begin');
  const old = await c.query(`select id from agencies where licence_no = '1234567'`);
  if (old.rows[0]) {
    await c.query(`delete from users where id in (select user_id from agents where agency_id = $1)`, [old.rows[0].id]);
    await c.query(`delete from agencies where id = $1`, [old.rows[0].id]);
  }
  const ag = await c.query(
    `insert into agencies (name, licence_no, licence_status, licence_checked_at, leasing_email, plan, billing_status)
     values ('Harbour & Co Realty (demo)', '1234567', 'current', now(), 'leasing@harbour.example', 'pilot', 'trial') returning id`);
  const agencyId = ag.rows[0].id;
  const mk = async (email: string, name: string, role: 'owner' | 'agent') => {
    await c.query(`delete from users where email = $1`, [email]);
    const u = await c.query(`insert into users (email, name, role) values ($1, $2, 'agent') returning id`, [email, name]);
    await c.query(`insert into agents (user_id, agency_id, licence_no, role) values ($1, $2, $3, $4)`, [u.rows[0].id, agencyId, '20' + Math.floor(Math.random() * 1e5), role]);
    return u.rows[0].id;
  };
  await mk('alex@harbour.example', 'Alex Nguyen', 'owner');
  await mk('sam@harbour.example', 'Sam Patel', 'agent');

  let i = 0;
  for (const [address, suburb, type, kind, price, beds, baths, parking, pets, photos, desc, edited, boosted] of LISTINGS) {
    const [lat, lng, pc] = SUBURB_CENTRES[suburb];
    const j = (n: number) => ((Math.sin(i * 12.9898 + n) * 43758.5453) % 1) * 0.004;
    const r = await c.query(
      `insert into listings (agency_id, assigned_agent_email, address, suburb, postcode, lat, lng, type, kind, price, beds, baths, parking,
         pets_considered, photos, photos_edited_disclosed, description, microburbs_property_id, boosted_until)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
      [agencyId, i % 3 === 2 ? null : i % 2 ? 'sam@harbour.example' : 'alex@harbour.example', address, suburb, pc, lat + j(1), lng + j(2), type, kind, price,
        beds, baths, parking, pets, JSON.stringify(photos), !!edited, desc, `GANSW7${String(10000000 + i * 7919).slice(0, 8)}`,
        boosted ? new Date(Date.now() + 14 * 86_400_000) : null]);
    // Three inspection slots over the coming week for rentals.
    if (type === 'rent') {
      for (const d of [2, 4, 6]) {
        // Slots at 10:00, 17:00 and 10:30 Sydney time, whatever timezone the server runs in.
        const day = new Date(Date.now() + d * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
        const local = `${day} ${d === 4 ? '17:00' : d === 6 ? '10:30' : '10:00'}`;
        await c.query(`insert into inspection_slots (listing_id, starts_at) values ($1, ($2::timestamp at time zone 'Australia/Sydney'))`, [r.rows[0].id, local]);
      }
    }
    i++;
  }
  await c.query('commit');
  await c.end();
  console.log(`Seeded demo agency with ${LISTINGS.length} listings. Agent logins: alex@harbour.example (owner), sam@harbour.example`);
}
main().catch((e) => { console.error(e); process.exit(1); });
