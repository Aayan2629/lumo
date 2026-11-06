# Microburbs API checks for the Lumo rental-listing fact-checking extension

Source key used below:
- SPEC = the Microburbs OpenAPI spec (`openapi` 3.x, "Microburbs Property Data API" v1.0.0, 174 paths, rate-card version 1). The local copy is at /tmp/claude-0/-home-claude/6f87d839-1c8f-55d7-a505-0523164621db/scratchpad/mb.json. The same reference is published at [Microburbs API docs](https://www.microburbs.com.au/developers/api-docs) and, for the hackathon host, at [api-ht docs](https://api-ht.microburbs.com.au/docs). Prices come from each operation's `x-price-cents` field and its "Price: N¢ per call" text.
- PROBE = live calls I made on 5 Nov 2026 against `https://api.microburbs.com.au/v1` with the public sandbox key `test`. The sandbox serves only the sample suburbs and properties (Bondi, Belmont North, GANSW704074813 and the others listed in the spec) and bills 0¢. The URL cited for these is the [production API](https://api.microburbs.com.au/v1/ping).

---

## 1. Hackathon rules, key scope, cutoffs and the Chrome-extension task

### Takeaway
A dedicated Chrome-extension task exists. Its rules matter for Lumo: the brief says to read only the listing's address, fetch facts from the Microburbs API and never copy listing text or photos. Lumo therefore cannot scrape the ad text to find claims. The team key covers only the City of Sydney LGA (29 suburbs) and returns 403 for any address outside it.

### Cited Findings
**Chrome extension task page**
- Goal: "Show Microburbs facts beside the listing a buyer is viewing on a property site." Example sites are realestate.com.au and domain.com.au. — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Context on the page: a property-search extension founder (about 52–54k downloads) wants Microburbs data and branding in his extension. A rival listing-history extension has about 10k active users. "The main challenge is matching the viewed address and showing the correct facts while the buyer browses." — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Recommended starting endpoints: `GET /v1/geocode/address`, `GET /v1/properties/{gnaf_id}/valuation/avm` and `GET /v1/properties/{gnaf_id}/basics/all`. — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Supplied files: `addresses-city-of-sydney.csv` (for address matching) and `public-housing-homes-city-of-sydney.csv`, which holds estimated flags rather than checked owners. Both arrive with the team key at 11 am on Sat 7 Nov 2026 and are "use on the day only, do not republish". — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Listing-reading rules: "Read only the viewed address, or ask the user to type it." Get facts from the Microburbs API after matching. "Do not collect or copy any listing text or photos." — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Task deliverables: demo.mp4 showing the extension working beside real listings, and report.html comparing existing browser extensions and the property sites. The report should show what buyers already see, explain the panel's added value and justify the chosen facts. A pitch is also required. There is no scored CSV. — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Judging for this task: the extension must work end to end on real listings. Judges open several real listings, check each matched address, verify the displayed facts against the correct home and judge whether the facts add value for buyers. — [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)

**Guide (common rules and hand-in)**
- Schedule on Sat 7 Nov 2026: 10:00–16:00. Team keys arrive at 11:00, the build runs 11:00–15:00 and submissions close at 15:00. Pitches run 15:10–15:30, top-team demos at 15:30 and winners are announced at 16:00. — [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- Common hand-in is one public repo containing README.md (what you built, who it helps, the data, the clever step, how to run it), report.html (data, method, what worked, what did not, your own held-out check), pitch.mp4 (≤45 s) and demo.mp4 (≤3 min). Each video must be under 95 MB. — [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- Do not put the API key, supplied files, API output or hidden judging data in the repo. Credit every source in README.md. Do not scrape sites whose terms forbid it. "A clever, non-obvious step beats polish. A toy or demo is fine." — [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- "The AI first pass selects up to 25 pitch videos" for the room session. — [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- Main page judging: "whether the thing is useful, whether it is explained well and whether it grabs attention". Code cleverness is not judged. — [Hackathon page](https://www.microburbs.com.au/hackathon)

**Key, host, scope and limits**
- The hackathon base URL is `https://api-ht.microburbs.com.au`, using `Authorization: Bearer YOUR_TEAM_KEY`. Scope is "The City of Sydney's 29 suburbs and every address in them. Anything outside returns `403`." The rate limit is about 10 requests a second per key, with retries on 429. — [Getting started](https://www.microburbs.com.au/p/hackathon-getting-started)
- "For browser apps, call the API from your server so the key never reaches the page." — [Getting started](https://www.microburbs.com.au/p/hackathon-getting-started)
- No-data responses come back as HTTP 200 with `{"data": null, "available": false, "reason", "message"}`, so code must branch on `data !== null`. — [Getting started](https://www.microburbs.com.au/p/hackathon-getting-started); SPEC info.description
- Every metered response carries `X-Cost-Cents`, `X-Spent-Cents`, `X-Remaining-Cents` and `X-Request-Id` headers. — SPEC info.description
- Demo apps (MIT licence) are in one repo: https://github.com/David-Mib/microburbs-hackathon-demos (Python quickstart, Next.js map, Streamlit, FastAPI). None is a Chrome extension. — [Getting started](https://www.microburbs.com.au/p/hackathon-getting-started)
- PROBE: `GET /v1/suburbs/list?lga=Sydney` (free) returns exactly 29 SALs: Alexandria, Barangaroo, Beaconsfield (NSW), Camperdown (NSW), Centennial Park (NSW), Chippendale, Darlinghurst, Darlington (Sydney - NSW), Dawes Point, Elizabeth Bay, Erskineville, Eveleigh, Forest Lodge, Glebe (NSW), Haymarket, Millers Point, Moore Park, Potts Point, Pyrmont, Redfern, Rosebery (NSW), Rushcutters Bay, Surry Hills, Sydney, The Rocks (Sydney - NSW), Ultimo, Waterloo (NSW), Woolloomooloo, Zetland. — [production API](https://api.microburbs.com.au/v1/ping) (PROBE)

**Cutoff dates**
- The rents task's as-at date is 31 July 2026 ("Use nothing dated after that date"), scored on adverts dated 1 Aug – 30 Sep 2026. The API has "no as-of switch". This cutoff is stated for the rents task only. The Chrome-extension page states no date cutoff. — [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents); [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)
- Rents-task baseline: a simple estimate "would typically miss by $100 a week" and the rental valuation missed by $86. The rents data includes `rents-past-leases-city-of-sydney.csv` (private historic adverts, day-only use). — [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents)
- The main page dates current listings to October 2026 and references the 2026 Census. The guide says "Our 2026 block figures are estimates, not Census results" and NSW Planning Portal DA data runs "since 2019". — [Hackathon page](https://www.microburbs.com.au/hackathon); [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)

**Conflicts between Microburbs pages**
- Suburb count: getting-started (and my PROBE) give 29 suburbs, but the rents task input covers "65,777 flats across 33 suburbs", with 4,246 addresses absent from the supplied City files. The likely explanation is suburbs that straddle the LGA boundary, but that is unconfirmed. — [Getting started](https://www.microburbs.com.au/p/hackathon-getting-started); [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents)
- Venue: the main page says UTS Business School Level 4. The guide says 14 Ultimo Road, Level 2. — [Hackathon page](https://www.microburbs.com.au/hackathon); [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- Prizes: the main page says the winning team gets $10k API credits, $2k cash and a job. The guide splits these: first prize is $2,000 cash, second prize is $10,000 API credits, and top teams are invited to interview. — [Hackathon page](https://www.microburbs.com.au/hackathon); [Hackathon guide](https://www.microburbs.com.au/p/hackathon-guide)
- The main page says ">200 endpoints". The SPEC has 174 paths (173 GET plus HEAD /ping). — [Hackathon page](https://www.microburbs.com.au/hackathon); SPEC

**Browser and CORS behaviour**
- PROBE: a CORS preflight (`OPTIONS`) from `Origin: chrome-extension://…` returned HTTP 400 with no `access-control-allow-origin`. Direct calls from a content script or web page would therefore be blocked. — [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- Chrome MV3: "A script executing in an extension service worker or foreground tab can talk to remote servers outside of its origin" when the host is in `host_permissions`. However, "Cross-origin requests are always treated as such in content scripts, even if the extension has host permissions." — [Chrome network requests docs](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)

### Inferences
- **The claim-detection design has to change.** Lumo cannot read the ad text off realestate.com.au or Domain. Three compliant options:
  - (a) Run every check for the address regardless of claims and present them as "claims renters usually see vs what the data says".
  - (b) Show checkboxes so the user ticks the claims they saw ("quiet street", "close to station").
  - (c) Get the ad copy from Microburbs itself. `GET /v1/suburbs/{suburb}/listings/for-rent?verbose=true&limit=200` returns "the agent's full ad-copy in `attributes.description`". Matching the listing's `gnaf_pid` gives Lumo the claim text as API data, without scraping the portal. This needs confirming with organisers. API output also must not go in the repo.
- The key must stay off the page. The safest architecture is a content script that reads only the address and sends it to the extension service worker, which calls Lumo's own backend proxy (for example a Cloudflare Worker holding the key). The proxy then calls api-ht. A service worker calling api-ht directly would bypass CORS but expose the key inside the extension bundle.
- Because only 29 suburbs are in scope, all suburb-level data can be pre-fetched and cached once on the day (about $2.75 per suburb for the full set below, about $80 total). Per-listing calls are then property-level only.
- Judges verify the matched address, so the panel should show the resolved G-NAF address and its unit number, and ask the user to confirm when geocode returns several candidates.

### Gaps
- Neither page gives a credit or quota on the hackathon key. The key is described as "free", so it is unclear whether the per-call prices below are billed against a team wallet. `X-Remaining-Cents` will show this on the day.
- I could not verify whether api-ht serves exactly the same spec as production. The hackathon page's ">200 endpoints" against 174 in this SPEC suggests it may differ.
- The task page does not say whether reading ad text locally in the browser, without storing it, is acceptable. It only says not to "collect or copy". Ask the organisers.

---

## 2. From listing address to API identifiers (gnaf_id, exact SAL, mesh block)

### Takeaway
The chain is three calls costing 4¢ in total plus one free call: geocode the address to get `gnaf_id`, fetch the property profile to get the exact SAL, mesh block and LGA, and use the free suburbs list to check the LGA scope. The SAL often carries a suffix (e.g. `Glebe (NSW)`, `The Rocks (Sydney - NSW)`) that differs from what portals display, so never use the portal's suburb text directly.

### Cited Findings
- `GET /v1/geocode/address?address=<freeform>` costs 1¢. It returns up to 10 candidates ranked by Meilisearch score, with fields `id` (the gnaf_id), `name`, `display_name`, `abbr` and `property_type`. Example: `{"abbr":"27 ARLINGTON ST BELMONT NORTH","display_name":"27 Arlington Street, Belmont North","id":"GANSW704074813","property_type":"house"}`. — SPEC `/v1/geocode/address`
- `GET /v1/properties/{gnaf_id}/profile` costs 3¢. It returns the full ABS chain plus admin fields: `mesh_block`, `sa1`, `sa2`, `sa3`, `sa4`, `gccsa`, `state`, `lga`, `postcode` and `suburb`, where `suburb` is the exact SAL with suffix (example `"suburb":"Kambah (ACT)"`). "Call this once to get every ABS key the rest of the data layers index on." — SPEC `/v1/properties/{gnaf_id}/profile`
- `GET /v1/geocode/suburb?q=&state=` is free. It autocompletes against the ABS SAL list and returns `area_name` plus `information` (lga, poa, sa2–sa4, state). PROBE: `q=surry hills` returned `Surry Hills` with `lga: "Sydney"`, followed by Surrey Hills VIC and Surrey Downs SA. — SPEC `/v1/geocode/suburb`; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- Every suburb endpoint requires "Exact ABS Suburb and Locality (SAL) name, e.g. `Burwood (NSW)` … Suburb data endpoints do not guess a state or typo-correct names." — SPEC (all `/v1/suburbs/{suburb_name}/…` descriptions)
- `GET /v1/suburbs/list` is free, with filters `state`, `lga`, `sa4`, `sa3`, `postcode` and `q` (typo-tolerant). It returns `match` and `score`, and the docs say to "tell the user which suburb you resolved to". — SPEC `/v1/suburbs/list`
- Property lat/lng is not in the geocode or profile response. It comes back as `center_lat` and `center_lng` from `/transport/nearby` and `/amenities/nearby`. PROBE: GANSW704074813 gave `center_lat -33.015986, center_lng 151.676975`. — SPEC; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- Live rental listings carry unit-style addresses such as `"street":"Unit 1, 272 Birrell Street"` and a `gnaf_pid` (which can be null if unmatched). — [production API](https://api.microburbs.com.au/v1/ping) (PROBE of `/suburbs/Bondi/listings/for-rent`); SPEC ForRentListing schema
- Mesh-block utilities: `GET /v1/mbs/list?sal=` and `GET /v1/mbs/{mb_code}/profile` cost 3¢ each. — SPEC

### Inferences
- Recommended flow:
  1. The content script extracts the address string from the listing header (e.g. "3/12 Smith St, Surry Hills NSW 2010").
  2. Normalise it ("3/12" → "Unit 3, 12"), because portals use slash notation.
  3. Call `geocode/address` and take the top candidate, but compare street number, unit and suburb tokens. If they do not match exactly, show the candidates for the user to pick.
  4. Call `properties/{id}/profile`. If `lga !== "Sydney"`, show "Outside Lumo's hackathon coverage (City of Sydney only)" instead of an error, because the API would return 403 anyway.
  5. Use `profile.suburb` as the `{suburb_name}` (URL-encoded) and `profile.mesh_block` to look up per-mesh-block rows in the suburb maps (livability-map, rent-map, crime/by-mesh-block, vacancy-map, built-year, construction-activity).
  6. Call `transport/nearby` once to get lat/lng for distance maths against suburb-level point and line data (POIs, DAs, busy roads, noise cells).
- The supplied `addresses-city-of-sydney.csv` can be used as a local lookup, avoiding geocode calls and handling unit numbers more reliably. Day-only use, and do not commit it.

### Gaps
- I could not test `geocode/address` (the sandbox returns 403 "this endpoint isn't in the public sandbox"), so how it handles unit and slash formats is unverified.
- The columns of `addresses-city-of-sydney.csv` are not published.

---

## 3. Claim and question → endpoint mapping (with price, fields and level)

### Takeaway
Most checks can be computed at property or mesh-block level ("microburb", about 30–60 dwellings). Property-level endpoints cover transport, amenities, risks, rent history, basics, street profile and schools. Suburb endpoints that return per-mesh-block arrays or point and line geometries can be localised to the property with the mesh-block code or lat/lng. A few claims have no direct data and should be shown as "can't verify": views/light, renovated, strata quality and Metro stations.

### Cited Findings
Prices in ¢ per call. P = property-level (`/properties/{gnaf_id}`), S = suburb-level (`/suburbs/{SAL}`), S→MB = a suburb call that returns per-mesh-block or point-level detail.

**"Quiet street"**
- S→MB `/lifestyle/livability-map` (20¢): seven dimensions per mesh block (affluence, lifestyle, hip, convenience, family, safety, tranquility), each scored 0–100 with `levels` bands 'Very low' (<25), 'Low' (25–49), 'Moderate' (50–74), 'High' (75–89) and 'Very high' (90+). Each row has `mb` and `street`. — SPEC (LivabilityMb schema)
- S `/lifestyle/livability` (10¢): suburb scores plus an SA4 benchmark. PROBE for Bondi: tranquility 10 ("Very low"), convenience 92, hip 94, safety 44 ("Low"), family 60. — SPEC; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- S→point `/shapes/noise-heatmap?geojson=false` (20¢): `heat` holds `[lat, lng, intensity]` cells. Intensity is "Relative noise intensity, 0-1 (scaled composite of road-traffic and noisy-POI proximity; 1 = noisiest cell in the source grid). Not a decibel measurement." PROBE for Bondi: 4,491 cells, median 0.077, p75 0.173, p90 0.295, max 0.439. — SPEC; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- S→line `/shapes/busy-roads` (10¢): LineStrings with `road_class` (e.g. "primary"), described as "the report's road-noise exposure proxy". — SPEC
- S `/risks/property-hazard-counts` (15¢) includes `aircraft_noise` (`anef_avg` and `anef_max`, ANEF across properties). — SPEC (AircraftNoise schema)
- Also relevant: the pubs and bars POI check (below) and the `/lifestyle/narrative` tranquility sentence (10¢). — SPEC

**"Close to transport / station / light rail"**
- P `/transport/nearby?radius_m=100–5000` (default 1000), 5¢. Returns `counts` {train, tram, bus, ferry} and `nearest` per mode, each with `name` (blank for bus and tram), `label` ("Train station" / "Tram stop" / "Bus stop" / "Ferry terminal"), `lat`, `lng` and `distance_m` ("Straight-line distance"). `nearest.<mode>` is null when none is within the radius. "Widen `radius_m` for the nearest station beyond 1km." — SPEC (TransportNearby and TransportStop schemas)
- S `/lifestyle/summary` (10¢) gives `nearest_train` {name, dist_km} and `nearest_shop` at suburb level. — SPEC

**"Walk to shops / cafes"**
- P `/amenities/nearby?radius_m=` (10¢): curated buckets `supermarket`, `green_spaces` and `restaurant` (restaurants and cafes), nearest-first and capped at 80, with `counts` exact before the cap. — SPEC (AmenitiesNearby schema)
- S→point `/lifestyle/pois?category=&limit=&offset=` (25¢, flat per call): GeoJSON points with `name`, `category` and `subtype` (e.g. `pub`, `bar`, `cafe`, `restaurant`, `gym`, `supermarket`, `school`, `pharmacy`), plus `dim` (e.g. "convenience"). "Sydney is ~3.7 MB of features", so page or filter by category. — SPEC

**"Great value / priced to lease" (fair rent)**
- S `/market/median-rent` (12¢): `house` and `unit` weekly medians plus `as_of`. PROBE for Bondi: house $1,800, unit $1,000, as_of 2026-11-08. — SPEC; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- S `/market/median-rent-series` (30¢): full advertised-median history. Older points are month-end, recent ones weekly ("not a uniformly quarterly series"). PROBE for Bondi units: 331 points, weekly through 2026-11-08. — SPEC; (PROBE)
- S→MB `/market/rent-map` (20¢): per-mesh-block modelled median weekly rent, plus highest and lowest. Metric is `median_weekly_rent_house` only. "Microburbs with too little rental signal are absent rather than zero." — SPEC
- S `/listings/for-rent?limit≤200&verbose&off_market` (20¢): live rental ads with `price` (weekly, can be null), `attributes` {bedrooms, bathrooms, garage_spaces, building_size, land_size, description}, `property_type` / `property_type_raw`, `listing_date` ("first observed on market"), `coordinates`, `gnaf_pid` and `off_market`. `total` gives the full count. PROBE for Bondi: total 53. — SPEC (ForRentListing schema); (PROBE)
- S `/market/vacancy-rate` (8¢, decimal fraction, by type, with rank), `/market/vacancy-rate-series` and `/market/vacancy-map` (10¢, per mesh block with `vacancy_pct`, `rental_listings` and `rental_stock`). — SPEC
- P `/street/profile` (20¢): `median_house_rent_week`, `renters_pct`, `rental_turnover_years`, `sale_turnover_years`, suburb medians to compare against, and `houses_on_street` / `units_on_street`. It "404s when the street has no forecast row". — SPEC
- S `/market/bedroom-stats` (10¢): price and median car spaces per bedroom count. It covers sale prices, not rents. — SPEC
- Area stats: `/area-stats/fields?query=median rent` (free) and `/area-stats/SAL/{suburb}/values?fields=Median_rent_weekly` (3¢) give the 2021 Census value (Bondi example 656). `mode=sa1` returns per-SA1 values. — SPEC
- The rents-task benchmark error is about $86–$100 a week. — [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents)

**"Parking included"**
- P `/basics/parking-count` (5¢) or `/basics/all` (23¢: bed_count, bath_count, parking_count, dwelling_type, land_area_sqm). These are "from the latest matching listing". — SPEC
- `garage_spaces` per live ad in `/listings/for-rent`. — SPEC

**Rent history, past leases, relisting frequency**
- P `/rent-history` (30¢): "All For Rent records, most-recent first", each with `date`, `price` (can be absent), `type` and `address`. P `/rent-history-latest` costs 10¢. P `/history/all` (80¢) adds the full sale history. PROBE: the sandbox property returned `{"data":[]}`, so empty history is a normal case. — SPEC; (PROBE)
- P `/surroundings/listing-history-signals` (20¢): for every property within 200 m, `last_rent_date` / `last_sold_date` and a `signal` (`previously_rented` = likely investor, `previously_for_sale`, `no_recent_listings`), plus a `summary` count. — SPEC
- The rents task notes rent-history-latest "may be too recent … Check its date". — [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents)

**"Near parks"**
- P `/amenities/nearby`, bucket `green_spaces` (`category: "Green Spaces"`, `distance_m`). — SPEC

**"Family friendly / schools"**
- P `/schools/nearby` (5¢): schools within about 5 km with `distance_m`, `name`, `school_level_type` and `sector`. P `/schools/ranking` (100¢) adds `naplan_rank`, `naplan_label`, `socioeconomic_rank` and `attendance_rate`. P `/schools/all` costs 105¢. — SPEC
- S `/schools/catchment` (200¢): public-school catchment polygons. S `/schools/nearby` (5¢) includes naplan_rank and attendance. — SPEC
- The `family` dimension appears in livability and livability-map. — SPEC

**"Secure / safe area" and crime**
- S `/crime/summary` (10¢): `suburb_median`, `national_median`, `vs_national_pct` and `verdict` ('Very low' / 'Below average' / 'Average' / 'Above average' / 'High'). PROBE for Bondi: 3,732.9 vs national 3,265.7, +14%, "Above average". — SPEC; (PROBE)
- S `/crime/breakdown` (10¢): per type (property, drugs, etc.) with `rate`, `national_median`, `diff_pct` and `verdict`. — SPEC
- S→MB `/crime/by-mesh-block` (15¢): total predicted rate per mesh block. Definition: "model trained on QLD Police mesh-block incidents averaged over 2020-2022, predicted for all Australian mesh blocks". — SPEC
- The livability `safety` dimension "is an inverse-scaled crime score built from the same per-mesh-block crime model". — SPEC
- P `/risks/public-housing` (4¢) and `/surroundings/public-housing` (15¢) exist. The task page says the public-housing file holds "estimated flags, not checked owners". — SPEC; [Chrome extension task](https://www.microburbs.com.au/p/hackathon-task-chrome-extension)

**"Renovated / new"**
- S `/development/applications` (15¢): up to 100 DAs, newest first, each with `title`, `address`, `lat`, `lng`, `stage` / `stage_display`, `date`, `category` ("New Dwelling", "Renovation", "Demolition", "Other") and `dollar_value`. `min_date` and `max_date` cover the full record. — SPEC
- S→MB `/market/built-year` (10¢): suburb and per-mesh-block `median_yr`, `p10_yr`, `p90_yr` and `modal_era`. These are estimates. — SPEC
- P `/sale-history` (30¢) or `/history/all` (80¢): a recent sale followed by a lease is context. — SPEC

**"Views / light"**
- No direct views or aspect endpoint at property level. S `/lifestyle/summary` gives a suburb `terrain` block (`aspect_compass`, `median_elevation_m`, slope). P `/development/zoning-overlays` (5¢) returns layers such as `hob` (height of building). S `/development/building-controls` (20¢) returns HOB and FSR polygons. — SPEC
- The rents task itself suggests teams "test whether nearby buildings block light or views", which implies the API does not supply this ready-made. — [Rents task](https://www.microburbs.com.au/p/hackathon-task-rents)

**"Low-maintenance strata"**
- S `/market/strata-levies` (5¢): `median_levy_annual` and `n_properties` (suburb median, estimated). There is no building-level strata, defects or maintenance data in the SPEC. — SPEC

**Risks (flood, bushfire, heritage, power lines, mobile black spots)**
- P `/risks/all` (48¢) bundles bushfire (15¢), flood (10¢), historical-flood (3¢), heritage (3¢), public-housing (4¢), landslide (3¢), erosion (3¢), environment (3¢), hv-power-line (2¢) and mobile-black-spot (2¢), so the bundle equals the sum of the parts. Each row has `name`, `value` (e.g. "Not on property; nearest 257 m away"), `on_property`, `nearest_distance_m`, `search_radius_m` (1000) and `features_within_radius`. The docs warn: "Read `on_property` — a returned row means 'found nearby', not 'this property is in a [hazard] zone'." `?geojson=true` adds polygons clipped to 1 km. — SPEC
- PROBE of `/risks/all` on GANSW704074813: bushfire "nearest 10 m", flood "nearest 257 m", `historical_flood: null`, heritage "nearest 174 m", and several public-housing rows. — [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- Suburb level: `/risks/all` (11¢, bushfire and flood area %), `/risks/property-hazard-counts` (15¢, share of dwellings, which "our own reports headline"), `/risks/heritage-share` (5¢), `/risks/hv-power-lines` (5¢: present, line_count, max_kv, overhead only), `/risks/extras` (10¢: storm tide, EPA notices, landlord-insurance medians) and `/risks/slope` (10¢). The docs note area % differs a lot from property %. — SPEC

**Livability, median rent and history**: covered above (`/lifestyle/livability`, `/livability-map`, `/market/median-rent`, `/median-rent-series`, `/rent-map`, `/vacancy-rate`).

**Development applications and construction nearby**
- S `/development/applications` (15¢, with lat/lng, so distance to the property can be computed). S `/development/da-count` (6¢) and `/da-list` (18¢) are simpler. S→MB `/development/construction-activity` (10¢): satellite NDBI/NDVI change 2019→2023 per mesh block, with `construction_score` (positive means net building), plus a summary `active_mb_count`. S→MB `/development/supply` (10¢): new dwellings in the last 24 months, units vs houses. S `/development/council-intelligence` (20¢): capex and project signals from council minutes, with stage, dollar value and location. — SPEC

**Pubs / bars nearby**
- S→point `/lifestyle/pois`, filtered on `subtype` in {pub, bar, nightclub, bottle_shop}. PROBE for Bondi with `category=Restaurant / Cafe`: 133 POIs, including 33 subtype `pub`, 42 `restaurant`, 18 `cafe` and 2 `bottle_shop`. So pubs sit under the "Restaurant / Cafe" category, and filtering must use `subtype`, not `category`. — SPEC; [production API](https://api.microburbs.com.au/v1/ping) (PROBE)
- S `/lifestyle/poi-impacts` (10¢): price premium for absence of petrol stations, fast food and bottle shops. This is sale-market context. — SPEC

**Documentation quirks to code around**
- The `/risks/all` description says "Flat 30¢" while its price field says 48¢. — SPEC
- The `/history/all` description points to `/history/sale/latest`, which does not exist. The real path is `/sale-history-latest`. — SPEC
- The sample responses for `/risks/historical-flood`, `/risks/erosion` and `/risks/mobile-black-spot` show a "Fire" row (copy-paste samples). Read the `name` field, and don't hard-code it. — SPEC

### Inferences: suggested flag thresholds (my proposals, not Microburbs guidance)

| Claim | Flag "not supported" when | Data |
|---|---|---|
| Quiet street | Mesh-block `tranquility` < 25 (Very low) **or** the nearest noise cell is ≥ the suburb's p75 intensity **or** a `primary`/`trunk` busy-road segment lies within about 50 m **or** ≥3 pub/bar/nightclub POIs lie within 200 m. Show "quiet" only if tranquility ≥ 50 and none of the others apply. Noise intensity is relative (0–1, not dB), so compare within the suburb, not against a fixed number. | livability-map, noise-heatmap, busy-roads, pois |
| Close to train / station | Nearest `train` > 800 m straight-line (about a 10-minute walk; the City of Sydney's own target is a "ten-minute walk to daily necessities", [Hackathon page](https://www.microburbs.com.au/hackathon)). Use "a short walk" for ≤ 500 m. Query with `radius_m=2000` so a far station still returns a distance rather than null. | transport/nearby |
| Close to light rail | Nearest `tram` > 800 m (Sydney Light Rail probably appears as mode `tram`, label "Tram stop"; unverified) | transport/nearby |
| Close to buses | Nearest `bus` > 400 m | transport/nearby |
| Walk to shops / cafes | Nearest supermarket > 800 m, or fewer than 3 cafes/restaurants within 400 m. Straight-line distances understate walking, so multiply by about 1.3 before comparing. | amenities/nearby, pois |
| Near parks | No `green_spaces` within 400 m | amenities/nearby |
| Great value / priced to lease | Asking rent > like-for-like median by **both** > $100/wk **and** > 10%. The $100 margin mirrors the rents-task baseline error ($86–$100), so smaller gaps are within model noise. Like-for-like means: same suburb, same `property_type`, same bedrooms (± garage) from live `/listings/for-rent`. Fall back to `/market/median-rent` (unit or house). Also flag if asking rent is > 15% above this property's own last `rent-history` price from within 12 months (a big relist jump). Show "below market" if ≥ 10% under. | listings/for-rent, median-rent, rent-history, vacancy-rate |
| Family friendly | Mesh-block `family` < 50, or no primary school within 1.5 km | livability-map, schools/nearby |
| Secure / safe | Suburb crime `verdict` is "Above average" or "High", **or** the mesh-block crime rate is > 1.5× the suburb median, **or** mesh-block `safety` < 50. Label it "modelled crime (QLD-trained model)". | crime/summary, by-mesh-block, livability-map |
| Renovated / new | Unverifiable unless a `Renovation`/`New Dwelling` DA matches the address (or lies within 30 m), or the mesh-block `median_yr` is ≥ 2015. Otherwise say "no record of recent renovation". | development/applications, built-year |
| Parking included | API `parking_count` = 0 or null while the ad says parking: "unconfirmed". Equally, show the parking premium (median rent with vs without `garage_spaces` in same-bed live ads). | basics, listings/for-rent |
| Relisted often | ≥ 2 For Rent records within 24 months, or a rental turnover shorter than the street's `rental_turnover_years` | rent-history, street/profile |
| Construction nearby | Any DA within 200 m with stage under assessment or approved and category New Dwelling or Demolition, dated in the last 24 months, or the property's mesh block has `construction_score` > 0 | development/applications, construction-activity |
| Flood / bushfire / heritage / landslide | `on_property: true` means red. `nearest_distance_m` < 100 means amber ("nearby"). | risks/all |
| HV power line | `on_property` or `nearest_distance_m` < 100 | risks/hv-power-line |
| Mobile black spot | `on_property: true` | risks/mobile-black-spot |

**Cost plan (production rate card, rate-card version 1)**
- Per listing (property calls): geocode 1 + profile 3 + transport 5 + amenities 10 + risks/all 48 + rent-history 30 + basics/all 23 + street/profile 20 + schools/nearby 5 = **145¢ ≈ $1.45**. A lean version (geocode, profile, transport, amenities, flood, hv-power-line, mobile-black-spot, rent-history-latest, parking-count) costs about 51¢.
- Per suburb, cached once (29 suburbs): median-rent 12, median-rent-series 30, rent-map 20, vacancy-rate 8, livability-map 20, crime summary 10, breakdown 10, by-mesh-block 15, noise-heatmap 20, busy-roads 10, pois 25, development/applications 15, construction-activity 10, strata-levies 5, built-year 10, listings/for-rent 20, hv-power-lines 5, property-hazard-counts 15, heritage-share 5, tenure 10 = **275¢ per suburb ≈ $80 for all 29**. Re-pull for-rent listings more often, since they are live.
- Free helpers: `/suburbs/list`, `/geocode/suburb`, `/area-stats/fields`, `/area-stats/regions`, `/suburbs/finder/fields` and `/v1/me` (balance).

**Product inferences**
- Display wording should follow the API's own caution, e.g. "flood overlay 257 m away, not on this property", rather than "flood risk".
- The rent-map is house-only, and most City of Sydney rentals are flats (the rents task is all flats). For units, rely on live same-bedroom ads and the suburb `unit` median rather than the mesh-block rent map.
- Strata levies are paid by owners, not tenants, so "low-maintenance strata" has weak renter relevance. The strata check could be dropped or reframed.

### Gaps
- No property-level noise in decibels, no views, aspect or floor-level data, no building condition or defects data, and no record of renovations beyond DAs.
- Unclear whether Sydney Metro stations count under `train` or are missing. The SPEC lists only train, tram, bus and ferry.
- No published distance thresholds from Microburbs. The 400 m and 800 m transport thresholds above are conventional planning rules of thumb I could not tie to a NSW source within this research, so treat them as proposals.
- The crime model is trained on Queensland police data and predicted nationally. How well it fits City of Sydney (vs NSW BOCSAR recorded crime) is unknown.
- The rent-history response gives no bedroom or parking details per record, so a rent jump could reflect a different configuration. I could not check whether City of Sydney properties typically have rich histories (the sandbox property had none).
- Whether the live `/listings/for-rent` index includes the same listing the user is viewing (for matching `gnaf_pid` and `verbose` ad copy) is unverified for the hackathon key.

---

## 4. Property-level vs suburb-level summary

### Takeaway
Address-specific checks are the property endpoints (`/properties/{gnaf_id}/…`). Most "neighbourhood feel" data (noise, livability, crime, rent maps, DAs, POIs) is suburb-scoped, but returns mesh-block rows or coordinates, so it can be localised to the listing.

### Cited Findings
- Property-level (`gnaf_id`): valuation/avm, basics/*, profile, sale-history, rent-history(-latest), history/all, neighbours, comparables/*, development/zoning-code and zoning-overlays, schools/nearby and ranking, amenities/nearby, transport/nearby, risks/* (11 overlays plus bundle), valuation/land-values, value-series, agent-quoting (for-sale listings only), surroundings/* (200 m radius: properties, tenure, public-housing, parcels, listing-history-signals), context/mesh-blocks (1 km), context/nearby-for-sale and street/profile. — SPEC
- Suburb-only aggregates (no finer detail): market/median-rent(-series), vacancy-rate, strata-levies, crime/summary and breakdown, lifestyle/livability, summary, landmarks and cbd, risks/all, slope, heritage-share and hv-power-lines, development/da-count and council-rates. — SPEC
- Suburb calls with per-mesh-block or geometry detail: lifestyle/livability-map, market/rent-map, vacancy-map, built-year, yield-map, median-price-map, crime/by-mesh-block, development/construction-activity and supply, demographics/tenure and income-map, and shapes/noise-heatmap, busy-roads, hazards and mesh-blocks. lifestyle/pois and development/applications return points with lat/lng. — SPEC
- `agent-quoting` works "Only while the property is listed for sale with a tracked agency", so it does not apply to rentals. — SPEC

### Inferences
- Lumo can honestly present most results as "this block" (mesh block) rather than "this suburb". That is a differentiator worth naming in report.html, given that the judges compare against existing extensions.

### Gaps
- Mesh-block codes are ABS 2021 (`mb` is described as an "ABS 2021 mesh-block code"). It is unverified whether `properties/{id}/profile.mesh_block` is also 2021 vintage, though the matching format suggests so.
