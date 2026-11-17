import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { houseCard, setMicroburbsForTests } from '@/lib/housecard';
import { parseSuburb, sampleMicroburbs, type Microburbs } from '@/lib/providers/microburbs';
import { makeAgency, makeListing } from './helpers';

describe('houseCard', () => {
  it('calls Microburbs once per listing and serves the cache after that', async () => {
    const inner = sampleMicroburbs();
    let suburbCalls = 0, propertyCalls = 0;
    const counting: Microburbs = {
      calls: () => suburbCalls + propertyCalls,
      suburb: (s) => { suburbCalls++; return inner.suburb(s); },
      property: (g, s) => { propertyCalls++; return inner.property(g, s); },
    };
    setMicroburbsForTests(counting);
    const { agencyId } = await makeAgency();
    const a = await makeListing(agencyId, { suburb: 'Glebe' });
    const b = await makeListing(agencyId, { suburb: 'Glebe' });
    for (let i = 0; i < 50; i++) await houseCard(a); // 50 swipes
    await houseCard(b);
    expect(propertyCalls).toBe(2);   // one per listing
    expect(suburbCalls).toBe(1);     // suburb data shared across listings
  });

  it('labels every number with its source and date', async () => {
    const { agencyId } = await makeAgency();
    const card = (await houseCard(await makeListing(agencyId, { type: 'sale', price: 900000 })))!;
    const metrics = [...Object.values(card.renter), ...Object.values(card.investor)];
    expect(metrics.length).toBeGreaterThan(10);
    for (const m of metrics) {
      expect(m.source, m.label).toMatch(/Microburbs/);
      expect(m.asOf, m.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(card.investor.grossYield.estimate).toBe(true);
    expect(card.poweredBy.name).toBe('Microburbs');
  });

  it('parses real Microburbs sandbox answers (Bondi)', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/bondi.json'), 'utf8'));
    const s = parseSuburb('Bondi', {
      crime_breakdown: raw.crime_breakdown.data, livability: raw.lifestyle_livability.data, risks: raw.risks_all.data,
      median_rent_series: raw['market_median-rent-series'].data, pois: raw.pois.data, da_list: raw['development_da-list'].data,
    });
    expect(s.crime?.level).toBe('High');
    expect(s.livability?.safety).toBe(44);
    expect(s.risks.floodPct).toBe(0);
    expect(s.amenities?.cafes).toBe(133);
    expect(s.medianRentHouse).toBeGreaterThan(500);
  });
});
