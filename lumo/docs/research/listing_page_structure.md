# Page structure of Australian rental listing pages (domain.com.au and realestate.com.au) for an in-browser Chrome extension

Research date: 2026-11-05. Neither site could be fetched directly from the research environment. domain.com.au returned an Akamai "Access Denied" (HTTP 403) even for robots.txt. realestate.com.au returned HTTP 429 for a rental search page but served robots.txt. Per the brief, I did not try to get around either block. Everything below comes from secondary sources: public GitHub parsers and extensions, Scrapfly's tutorials (updated Oct 2026) and their sample outputs, and the sites' terms. **None of the selectors or JSON paths here were checked against a live 2026 page by me.** Treat them as starting hypotheses and verify them in a real browser before building on them.

## 1. URL patterns: single rental listing vs search results

### Takeaway
On both sites a single listing URL ends in a numeric listing ID. A search URL starts with `/rent/` (or `/buy/`, `/sale/`). On realestate.com.au a rental listing and a for-sale listing share the same `/property-...-{id}` shape, so "is this a rental?" has to come from page data, not the URL.

### Cited Findings
- **Domain single listing:** `https://www.domain.com.au/{address-slug}-{listingId}`, e.g. `/610-399-bourke-street-melbourne-vic-3000-2018835548` — [Scrapfly, Domain guide (updated 5 Oct 2026)](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **Domain rental listing example:** `https://www.domain.com.au/1518-474-flinders-street-melbourne-vic-3000-17773317`. Its embedded data has `listingSummary.listingType: "rent"` and `mode: "rent"`, so the URL itself gives no rent/sale signal — [Scrapfly sample output, scrapfly-scrapers repo](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/domaincom-scraper/results/properties.json)
- **Domain sold or off-market pages** use `/property-profile/{address-slug}`, e.g. `/property-profile/308-9-degraves-street-melbourne-vic-3000`, and have a different data shape (see Q2) — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **Domain search:** `https://www.domain.com.au/rent/{suburb}-{state}-{postcode}/`, with paging via `?page=N` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- One open-source Domain extension decides whether it is on a listing page with `window.location.pathname.match(/\d{5,}$/)`, i.e. the path ends in 5 or more digits — [mprater97/International_relocation content.js](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
- The Property Seeker extension (Plasmo, v2.0.12) matches `https://www.domain.com.au/*` and sets `exclude_matches: ['https://www.domain.com.au/rent/*']`. It also treats `data-testid="listing-details__listing-summary-title-name"` as a "project" (new development) page, which it does not support — [cheesestringer/property-seeker domainProperty.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/contents/domainProperty.tsx), [domain.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/components/domain.tsx)
- **REA single listing:** `https://www.realestate.com.au/property-{type}-{state}-{suburb}-{id}`, e.g. `/property-townhouse-vic-glenroy-143556608` — [Scrapfly, REA guide (updated 5 Oct 2026)](https://scrapfly.io/blog/posts/how-to-scrape-realestate-com-au-property-listing-data); `/property-house-vic-tarneit-143160680` — [Scrapfly REA sample output](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/realestatecom-scraper/results/properties.json)
- **REA search:** `/buy/in-{location}/list-{page}` — [Scrapfly REA guide](https://scrapfly.io/blog/posts/how-to-scrape-realestate-com-au-property-listing-data). The rent form, with filters, is `/rent/property-apartment-with-2-bedrooms-1-car-space-in-sydney,+nsw+2000/list-1`. Filters chain under a single leading `with-`, and a malformed filter segment is silently ignored (HTTP 200) — [ErrolMc/SydneyRentalDataPipeline CLAUDE.md](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/CLAUDE.md)
- One REA parser infers rent vs sale first from `listing.channel` (`'rent'` / `'buy'`) and only falls back to URL or price text (`/rent|per-week|pw/`) — [OxyHQ/Homiio realestateCom/parse.ts](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/packages/listing-providers/src/providers/au/realestateCom/parse.ts)
- One REA parser fills in og/title-based booleans: `for_rent` is true when `<title>` contains "for rent" — [RealEstateWebTools au_realestate.json (last_checked 2026-02-20)](https://raw.githubusercontent.com/RealEstateWebTools/property_web_scraper/HEAD/config/scraper_mappings/au_realestate.json)

### Inferences
- Suggested manifest `matches`: Domain `https://www.domain.com.au/*`, then test the path at runtime with `/-\d{5,}\/?$/` and exclude `/rent/`, `/sale/`, `/sold-listings/`, `/property-profile/` and `/project/`. REA: `https://www.realestate.com.au/property-*`.
- Confirm "rental" from embedded data: Domain `listingSummary.listingType === "rent"`, REA `listing.channel === "rent"`. Use the "for rent" `<title>` text as a fallback.
- Domain listing IDs have moved from 8 digits (17773317) to 10 (2018835548), so don't hard-code an ID length.

### Gaps
- I couldn't confirm Domain's project (new development) URL prefix or REA's `/project/` pages from a primary source.
- I couldn't verify whether REA's rent search uses `/rent/in-{suburb},+{state}+{postcode}/list-1` without filters. It's consistent with the filtered example above, but my direct fetch got a 429.

## 2. Embedded data: JSON-LD, `__NEXT_DATA__`, `ArgonautExchange` and meta tags, with field paths

### Takeaway
Embedded JSON is the most reliable source on both sites, and both ship the full listing in the initial HTML:
- **Domain** is a Next.js app. The data is in `<script id="__NEXT_DATA__">` → `props.pageProps.componentProps`.
- **REA** uses its own hydration blob, `window.ArgonautExchange`. It contains a doubly JSON-encoded GraphQL (urql) cache, and the listing sits at `details.listing`.

I found no evidence that either site carries usable schema.org JSON-LD on listing pages. Two traps matter for an extension: REA deletes the global after hydration, and Domain's `__NEXT_DATA__` goes stale after client-side navigation.

### Cited Findings

**Domain: `__NEXT_DATA__`**
- Data is read with XPath `//script[@id='__NEXT_DATA__']/text()`, then `data["props"]["pageProps"]["componentProps"]` — [Scrapfly domaincom.py](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/domaincom-scraper/domaincom.py), [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- Top-level `componentProps` fields Scrapfly extracts: `listingId`, `listingUrl`, `unitNumber`, `streetNumber`, `street`, `suburb`, `postcode`, `createdOn`, `propertyType`, `beds`, `phone`, `agencyName`, `propertyDeveloperName`, `agencyProfileUrl`, `description`, `loanfinder`, `schoolCatchment.schools`, `suburbInsights`, `gallery`, `listingSummary`, `agents`, `features`, `structuredFeatures`, `faqs` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- Values from a real rental sample (created 2025-09-23) — [Scrapfly sample properties.json](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/domaincom-scraper/results/properties.json):

  | Field | Path | Sample value / note |
  |---|---|---|
  | Price | `listingSummary.title` | `"$750 per week"` (display string, not a number) |
  | Address | `listingSummary.address` | `"1518/474 Flinders Street, Melbourne VIC 3000"` |
  | Address parts | `unitNumber`, `streetNumber`, `street`, `suburb`, `postcode` | — |
  | Beds / baths / parking | `listingSummary.beds`, `.baths`, `.parking` | 2 / 2 / 0 |
  | Rental flags | `listingSummary.listingType`, `.mode`, `.propertyType` | `"rent"` / `"rent"` / `"Apartment / Unit / Flat"` |
  | Available date | `listingSummary.stats[]` with `key: "availableFrom"` | `value` "Thursday, 23rd October 2025", plus `iso8601Value` |
  | Bond | `listingSummary.stats[]` with `key: "bond"` | `value: 3259` |
  | Description | `description` | **array of paragraph strings**, not one string |
  | Agents | `agents[]` | `{name, photo, phone, mobile, agentProfileUrl, email}`; `email` is base64-encoded |
  | Agency | `agencyName`, `agencyProfileUrl`, `phone` | — |
  | Photos | `gallery.slides[]` | see Q4 |
  | FAQs | `faqs[]` | e.g. "What is the weekly rent for …?" |
  | Features | `features[]`, `structuredFeatures[]` | both empty `[]` in this sample, so shape unconfirmed |

- Domain search pages: `componentProps.listingsMap[id].listingModel` holds `price` (e.g. "$620 pw"), `address{street,suburb,state,postcode,lat,lng}`, `features{beds,baths,parking,propertyType,landSize}`, `inspection{openTime,closeTime}`, `auction`, `images`, `branding` and `tags`. Total pages are in `totalPages` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- Sold or property-profile pages instead use `props.pageProps.__APOLLO_STATE__`, with keys prefixed `"Property:"` and `"media("` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **Conflicting shape.** Property Seeker requests the listing URL with header `accept: application/json` and reads `props.id`, `props.listingSummary` (`.propertyType`, `.mode`), `props.street`, `props.footer.suburb.slug` and `props.domainSays.firstListedDate` / `.updatedDate`. That differs from `pageProps.componentProps`, so Domain serves (or once served) a JSON variant of the page with a `props` root — [property-seeker domainService.ts](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/services/domainService.ts), [domain.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/components/domain.tsx)
- **Conflicting paths.** A different extension reads `props.pageProps.listingDetail` / `props.pageProps.listing` with `addressParts`, `bedrooms`, `carspaces` and `photos[].fullUrl`. These paths don't match Scrapfly's verified 2025 sample and are probably outdated or guessed — [mprater97 content.js](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)

**Domain: inspection times**
- Search-card data has `listingModel.inspection.openTime/closeTime` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- An Apify actor lists an output field `inspectionDetails` ("Open home times and inspection dates"). It doesn't say whether that comes from page JSON or another source — [Apify shahidirfan Domain scraper](https://apify.com/shahidirfan/domain-com-au-property-scraper)

**REA: `window.ArgonautExchange`**
- The blob sits in an inline `<script>`: `window.ArgonautExchange={"resi-property_listing-experience-web":{"urqlClientCache":"{\"<hash>\":{\"data\":\"{...}\"}}"}}`. `urqlClientCache` is a JSON *string*, and each entry's `data` is another JSON string holding the raw "Lexa" GraphQL response — [ErrolMc/SydneyRentalDataPipeline parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts); same nesting in [Homie content.js](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js)
- **Key trap:** "the app deletes `window.ArgonautExchange` once it has hydrated, so reading the live global gives `undefined` on a page that loaded perfectly. Always parse the `<script>` tag's source text." — [ErrolMc parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts)
- Regex in use: `/window\.ArgonautExchange\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:window\.|<\/script>|$)/` — [ErrolMc parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts). Scrapfly uses `window.ArgonautExchange=(\{.+\});` — [Scrapfly REA guide](https://scrapfly.io/blog/posts/how-to-scrape-realestate-com-au-property-listing-data)
- Detail pages put the listing at `details.listing`, next to `details.relatedListings`, `recentSales` and `marketInsights`. Search pages use `{rent|buy|sold}Search.results.exact.items[].listing` **plus** `results.surrounding.items[]` — [ErrolMc CLAUDE.md](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/CLAUDE.md), [parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts)
- Field paths under `details.listing`, taken from the parsers cited in the Source column ([ErrolMc parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts) was updated with Sept 2026 run notes; [Scrapfly REA sample](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/realestatecom-scraper/results/properties.json); [RealEstateWebTools mapping, checked 2026-02-20](https://raw.githubusercontent.com/RealEstateWebTools/property_web_scraper/HEAD/config/scraper_mappings/au_realestate.json); [OxyHQ parse.ts](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/packages/listing-providers/src/providers/au/realestateCom/parse.ts)):

  | Field | Path | Note | Source |
  |---|---|---|---|
  | Price | `price.display` | fallback `price.information`; sometimes the numeric `priceValue` | ErrolMc, OxyHQ |
  | Address | `address.display.fullAddress`, `.shortAddress` | also `address.suburb`, `.state`, `.postcode` | all |
  | Coordinates | `address.display.geocode.{latitude,longitude}` | detail pages only; search results have none | ErrolMc |
  | Beds | `generalFeatures.bedrooms.value` | also `studies.value` | all |
  | Baths | `generalFeatures.bathrooms.value` | — | all |
  | Parking | `generalFeatures.parkingSpaces.value` | — | all |
  | Property type | `propertyType.display` | — | all |
  | Description | `description` | HTML string with `<br/>` line breaks | Scrapfly sample |
  | Features | `propertyFeatures[]` | `{featureName, value}`; `value` is null for flag features (e.g. "Dishwasher") or `{displayValue}` / `{displayValue, sizeUnit}` | Scrapfly sample |
  | Inspection times | `inspections[]` | `{startTime, endTime, display.longLabel}` | ErrolMc |
  | Agents | `listers[]` | `{id, name, jobTitle, photo.templatedUrl, phoneNumber.display, _links.canonical.href}` | Scrapfly sample, ErrolMc |
  | Agency | `listingCompany` | `{name, id, businessPhone / phoneNumber, address, companyLink, ratingsReviews}` | Scrapfly sample, OxyHQ |
  | Photos | `media.images[].templatedUrl` | also `media.floorplans`, `videos` | all |
  | Canonical URL | `_links.canonical.href` | — | ErrolMc, OxyHQ |
  | Rent vs sale | `channel` | `"rent"` / `"buy"` | OxyHQ |

- **Format quirks:** `sizeUnit` is "sometimes a plain string ('m²') and sometimes an object with a display field", and REA has "moved [coordinates] around between schema versions" — [ErrolMc parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts)
- Some extensions regex the blob for `"marketing_price_range":"([^"]+)"` (e.g. `"800000_900000"`) to show the hidden price range on sale listings — [tomquirk/rea-marketing-price content.js](https://raw.githubusercontent.com/tomquirk/rea-marketing-price/HEAD/content.js), [RealEstateWebTools mapping](https://raw.githubusercontent.com/RealEstateWebTools/property_web_scraper/HEAD/config/scraper_mappings/au_realestate.json)
- One parser types the payload with different names (`propertyDetails.bedrooms`, `carspaces`, `media.images[].url`, `lifeStatus`). These don't match the verified samples and look speculative — [uprez-net/propure-main rea-parser.ts](https://raw.githubusercontent.com/uprez-net/propure-main/HEAD/packages/mcp-shared/src/parsers/rea-parser.ts)

**JSON-LD and meta tags**
- No source I found confirms that Domain or REA listing pages carry `application/ld+json` with listing data. Several parsers keep JSON-LD only as a fallback branch:
  - propure checks for `@type` "Product" or "RealEstateListing" — [propure rea-parser.ts](https://raw.githubusercontent.com/uprez-net/propure-main/HEAD/packages/mcp-shared/src/parsers/rea-parser.ts)
  - Homie checks for `floorSize` — [Homie content.js](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js)
  - Homiio describes JSON-LD as "fallback only" — [OxyHQ/Homiio docs](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/docs/listing-providers.md)
- A maintained REA mapping (checked 2026-02-20) uses `<title>`, `meta[property='og:title']`, `og:description` / `meta[name='description']`, `og:image` (main image only) and `og:url` as fallbacks. It takes everything structured from ArgonautExchange — [RealEstateWebTools au_realestate.json](https://raw.githubusercontent.com/RealEstateWebTools/property_web_scraper/HEAD/config/scraper_mappings/au_realestate.json)
- A Domain extension falls back to `meta[property="og:image"]` for the hero photo — [mprater97 content.js](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
- schema.org `RealEstateListing` sits under `Thing > CreativeWork > WebPage > RealEstateListing`. It is in the "new" area, has its own properties `datePosted` and `leaseLength`, and is described as a listing of one or more real-estate `Offer`s — [schema.org/RealEstateListing](https://schema.org/RealEstateListing)

**How content loads (affects the extension)**
- **Next.js (Domain):** "When a user visits the page through next/link or next/router, Next.js sends an API request to the server, which runs getServerSideProps" and "getServerSideProps returns JSON". So after a client-side move (search results → listing), the `__NEXT_DATA__` script in the DOM still holds the *first* page's data — [Next.js docs, getServerSideProps](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props)
- **REA:** server-renders, then hands the client the hydration blob — [ErrolMc parse.ts](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts). One REA extension attaches a `MutationObserver` to `#argonaut-wrapper` (childList) and re-runs on changes. It checks that the `h1.property-info-address` text appears in the script blob, so it can detect stale data after in-app navigation; if not, it shows a "refresh" button — [tomquirk/rea-marketing-price content.js](https://raw.githubusercontent.com/tomquirk/rea-marketing-price/HEAD/content.js)
- Other extensions just wait for React to render: `setTimeout(injectButton, 2000)` — [Assistantbot content-portal.js](https://raw.githubusercontent.com/michaelwu1407-droid/Assistantbot/HEAD/extension/content-portal.js); `setTimeout(init, 1000)` — [mprater97 content.js](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js). Property Seeker uses an IntersectionObserver to process cards lazily — [property-seeker domain.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/components/domain.tsx)
- REA search pages blend in neighbouring suburbs (`results.surrounding`), so reading only `exact` "silently drops up to two-thirds of a page" — [ErrolMc CLAUDE.md](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/CLAUDE.md)

### Inferences
- **Extraction order on both sites:** (1) parse the embedded JSON from the `<script>` text, (2) fall back to og/meta tags, (3) fall back to DOM text. A content script runs in Chrome's isolated world, so it can't see page globals like `window.__NEXT_DATA__` anyway. Reading `document.getElementById('__NEXT_DATA__').textContent`, or the inline script containing `window.ArgonautExchange`, works and avoids REA's deleted-global trap.
- **Staleness check:** compare the embedded listing ID (Domain `componentProps.listingId`, REA `details.listing.id`) with the ID at the end of `location.pathname`. If they differ, the page was reached by client-side navigation and the data is stale. Then fall back to DOM reading, or ask the user to reload. Don't fire background requests; that keeps the "reads only what the user has open" stance clean.
- **Search the JSON, don't hard-code paths:** both sites have renamed keys before (ErrolMc's fallback "key naming has changed before"). Look for an object with `id` + `address` (REA), or with `listingSummary` + `gallery` (Domain), and search for any key matching `/inspection/i`.
- **Normalise descriptions:** Domain's `description` is an array of paragraphs; REA's is HTML with `<br/>`.

### Gaps
- **Domain inspection times on detail pages:** I couldn't confirm the path inside `componentProps`. Scrapfly doesn't extract it, and the Apify field `inspectionDetails` has no stated source. Needs a live-page check.
- **Domain `features` / `structuredFeatures`:** both were empty in the only sample, so their item shape is unconfirmed.
- **JSON-LD:** whether either site ships `application/ld+json` on listing pages in 2026 is unverified, because the sites blocked direct fetches.
- **Domain structure is unresolved:** I couldn't tell whether it still serves the `props.*` JSON variant (property-seeker) next to `pageProps.componentProps` (Scrapfly), or whether one replaced the other.
- **Domain routing:** I couldn't confirm whether it has moved any listing pages to the Next.js App Router. That would replace `__NEXT_DATA__` with RSC `self.__next_f.push(...)` payloads. Scrapfly's Oct 2026 update still uses `__NEXT_DATA__`, which suggests it hasn't, but that's indirect evidence.

## 3. DOM patterns (data-testid / class) for price, address, description, features, inspections, agent, and how robust they are

### Takeaway
Domain exposes many semantic `data-testid` attributes (`listing-details__*`, `property-features__*`, `address-wrapper`, `listing-card-*`), and several independent extensions use them. REA leans on BEM-ish classes (`property-info-address`, `property-info__price`), `aria-label`s, and hashed design-system class names. REA DOM selectors in public code are much less consistent, and some are clearly guessed. DOM selectors should be the fallback, not the primary source.

### Cited Findings

**Domain**
- **Price:** `[data-testid="listing-details__summary-title"]` is used by many independent projects:
  - extensions: [Assistantbot](https://raw.githubusercontent.com/michaelwu1407-droid/Assistantbot/HEAD/extension/content-portal.js), [mprater97](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js), [property-seeker](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/components/domain.tsx), [RentWise](https://raw.githubusercontent.com/Zahi-Saba/RentWise/HEAD/RentWise/RentWiseShare/ListingPage.js)
  - Univ. of Melbourne MAST30034 student scrapers (GitHub code search, 2022-era repos)
  - RentWise tries `[data-testid="property-price"]` and `.property-price` first. It regex-matches `$NNN per week | pw | /wk` and cuts the text before "similar properties|recommended properties|you may also like" so recommendation cards don't pollute it — [RentWise ListingPage.js](https://raw.githubusercontent.com/Zahi-Saba/RentWise/HEAD/RentWise/RentWiseShare/ListingPage.js)
- **Address:** `[data-testid='listing-details__button-copy-wrapper'] h1` on detail pages; `[data-testid="address-wrapper"]` on cards — [property-seeker domain.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/components/domain.tsx)
- **Summary column:** `[data-testid="listing-details__summary-left-column"]` is used as the injection anchor — [property-seeker domainProperty.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/contents/domainProperty.tsx)
- **Beds/baths/parking:** `[data-testid="property-features__feature"]` elements whose text contains "Bed"/"Bath"/"Car|Parking" — [Assistantbot](https://raw.githubusercontent.com/michaelwu1407-droid/Assistantbot/HEAD/extension/content-portal.js), [mprater97](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
- **Feature list:** `[data-testid="expander-wrapper"] li`, `.listing-details__features li` — [mprater97](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
- **Gallery:** `[data-testid="listing-details__photo-gallery"] img`, `picture img` — [mprater97](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
- **Search results:** `[data-testid="results"] > li`; ads carry `adSpot` in their testid; also `listing-card-topspot`, `listing-card-price-wrapper`, `listing-card-project`, `listing-card-project-details` — [property-seeker hideDomainListing](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/contents/hideListing/hideDomainListing/index.tsx), [domainListing.tsx](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/contents/domainListing.tsx)
- **Robustness signal:** `listing-details__summary-title` appears both in 2022 student scrapers and in current extensions, so it has lasted years. Commit dates for the extensions weren't retrievable (GitHub API access was blocked in this environment).

**realestate.com.au**
- **Address:** `h1.property-info-address` — [tomquirk/rea-marketing-price](https://raw.githubusercontent.com/tomquirk/rea-marketing-price/HEAD/content.js), [Assistantbot](https://raw.githubusercontent.com/michaelwu1407-droid/Assistantbot/HEAD/extension/content-portal.js), [Homie](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js). Homie also tries `.property-info__header h1` and `[class*="property-info-address"]`.
- **Price:** `.property-info__price` — [tomquirk](https://raw.githubusercontent.com/tomquirk/rea-marketing-price/HEAD/content.js); `span[class*="property-price"]` — [Homie](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js)
- **App root:** `#argonaut-wrapper`, used as the MutationObserver target — [tomquirk](https://raw.githubusercontent.com/tomquirk/rea-marketing-price/HEAD/content.js)
- **Beds via aria-label:** `li[aria-label*="bedroom"]`, e.g. `li[aria-label="2 bedrooms"]`. Feature lists also show up as `ul[aria-label*="House"|"Apartment"|"Townhouse"]`, and design-system text as `p[class*="Text_Typography"]` — [Homie content.js](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js) (CHANGELOG 1.1.0, 2024-07-07, "Added new CSS selectors for modern realestate.com.au page layouts" — [CHANGELOG](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/CHANGELOG.md))
- **Other testids in Homie:** `property-features-feature-beds`, `listing-details__description`, `listing-details__inspection`, `agent-name`, `agent-agency`, `gallery-image`, `hero-image`. These sit in long guess-lists of fallbacks (`[class*="Carousel"] img`, `[style*="background-image"]`, `[data-src]`), so treat them as unverified — [Homie content.js](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js)
- **Mixed-up testids:** one extension's REA scraper uses `[data-testid="listing-details__summary-title"]` and `property-features-feature-beds/baths` for REA. The first is the Domain testid, which suggests copy-paste rather than verification — [Assistantbot content-portal.js](https://raw.githubusercontent.com/michaelwu1407-droid/Assistantbot/HEAD/extension/content-portal.js)

### Inferences
- **Domain:** the `data-testid` selectors are reasonable second-line fallbacks and seem stable over years. Still, prefer `componentProps`.
- **REA:** DOM selectors are fragile (hashed classes, layouts redesigned in 2024). Use ArgonautExchange as the primary source and the `h1` address and aria-labels only as a sanity check or fallback.
- **Rental price text:** parse with a weekly-rent regex (`$X per week | pw | /wk`) and restrict it to the main listing region, since both sites show "similar properties" cards that contain prices.
- **Self-check:** build a test that alerts when extraction falls back to the DOM, so breakage shows up quickly.

### Gaps
- No verified, recent (2025–2026) REA `data-testid` list for description, inspection times or agent blocks. Every candidate found is either guessed or of unknown date.
- No Domain DOM selector found for inspection times or the agent card.

## 4. How photos and galleries are rendered

### Takeaway
On both sites, the complete photo list with full-resolution URLs is in the embedded JSON. Extensions should take photos from there, not from the carousel DOM, which loads lazily and only renders a few slides.
- **Domain:** `gallery.slides[].images.{original,tablet,mobile}.url` on the `rimh2.domainstatic.com.au` CDN.
- **REA:** `media.images[].templatedUrl` on `i2.au.reastatic.net`, with a `{size}` placeholder.

### Cited Findings
- **Domain slide structure:** each slide has `thumbnail` (144x106), `images.original` (`fit-in/1920x1080`, sample width 1620 × height 1080), `images.tablet` (`fit-in/1020x1020`), `images.mobile` (`fit-in/600x800`), plus `embedUrl` and `mediaType` ("image"; presumably video for others). The sample rental had 10 slides — [Scrapfly sample properties.json](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/domaincom-scraper/results/properties.json)
- **Domain URL format:** `https://rimh2.domainstatic.com.au/{signature}=/fit-in/1920x1080/filters:format(jpeg):quality(80):no_upscale()/{listingId}_{n}_1_{yymmdd}_{hhmmss}-w3000-h2000`. The leading hash segment is a per-size signature (Thumbor-style), so you **can't** just edit the size in the URL; use the provided variants — [Scrapfly sample](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/domaincom-scraper/results/properties.json), [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **Domain search thumbnails:** `.../660x440/filters:format(jpeg):quality(80)/...`. Scrapfly strips `skeletonImages` (placeholder images) from `listingModel` — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **REA URL format:** `https://i2.au.reastatic.net/{size}/{sha256-like-hash}/image.jpg`. Agent photos end in `/main.jpg`. Parsers substitute `{size}` with `1024x768` ([ErrolMc](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/src/parse.ts)) or `800x600` ([OxyHQ](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/packages/listing-providers/src/providers/au/realestateCom/parse.ts)); sample data in [Scrapfly REA sample](https://raw.githubusercontent.com/scrapfly/scrapfly-scrapers/HEAD/realestatecom-scraper/results/properties.json)
- **REA floor plans and video:** `media.floorplans[].templatedUrl` and `videos` — [Scrapfly REA guide](https://scrapfly.io/blog/posts/how-to-scrape-realestate-com-au-property-listing-data)
- **REA image CDN access:** `i2.au.reastatic.net` (images) is not behind REA's bot protection — [ErrolMc CLAUDE.md](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/CLAUDE.md)
- **DOM fallbacks seen in extensions:**
  - Domain: `[data-testid="listing-details__photo-gallery"] img`, `picture img` — [mprater97](https://raw.githubusercontent.com/mprater97/International_relocation/HEAD/chrome-extension/content.js)
  - REA: a guess-list covering `img`, `[style*="background-image"]` and `[data-src]` / `[data-image-src]` (i.e. possible lazy-load attributes and CSS backgrounds) — [Homie content.js](https://raw.githubusercontent.com/joeysudo/Homie/HEAD/content.js)
- **Order matters:** "the cover photo is decided by position" — [OxyHQ/Homiio docs](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/docs/listing-providers.md)

### Inferences
- Read the photo list from JSON and keep array order (index 0 = hero). For Domain, pick `images.tablet` or `images.mobile` for thumbnails sent to any model or UI, and `original` for full view. For REA, choose a size string (e.g. `800x600`) at substitution time.
- If the extension sends photos to a backend for analysis, send URLs only for what the user is viewing. Don't bulk-download whole galleries; see Q5 on terms.
- Use the carousel DOM only as a last resort. It will under-count because of lazy loading and virtualisation, and its `src` may be a placeholder until a slide scrolls into view.

### Gaps
- I couldn't verify how each carousel renders in the 2026 UI: `<img>` vs `<picture>`/`srcset` vs CSS background, `loading="lazy"`, or how many slides are mounted at once. That needs inspection in a real browser.
- The set of valid REA `{size}` tokens isn't documented anywhere I found. `800x600` and `1024x768` are used in working code.

## 5. Terms of use on automated access, and what a "reads only the page the user has open" extension implies

### Takeaway
Both sites' terms ban automated scraping, data mining and building property databases. REA's robots.txt header restates this ban. Both run strong bot protection:
- **Domain:** Akamai. Datacenter requests get 403.
- **REA:** Kasada. Raw HTTP and headless browsers get 429.

An extension that only parses the DOM the user has already loaded, on the user's own action, sends no extra requests to either site. That is a different technical activity from crawling. Even so, it is still "automated means to retrieve" content under REA's very broad wording. The legal risk is not zero; it grows with storage, aggregation, background fetching and commercial use.

### Cited Findings
- **REA robots.txt header:** "In accessing or using any REA Group Website you agree that you will not use any automated device, software, process or means to access, retrieve, scrape, or index any REA Group Website or any content…", with an exception only for "publicly available general search engines". The same file disallows `GPTBot`, `CCBot`, `anthropic-ai` and `cohere-ai` from the whole site — [realestate.com.au/robots.txt (fetched 2026-11-05)](https://www.realestate.com.au/robots.txt)
- **REA Terms of Use** (snapshot dated 2026-02-28) prohibit using "any automated device, software, process or means to access, retrieve, scrape, or index our Platforms" and using content to build a "searchable database of properties" or a property data or insights product. Copyright material may be downloaded "only for private and non-commercial purposes". REA reserves "whatever means we deem necessary to prevent unauthorised access". The snapshot says nothing about browser extensions — [tostracker snapshot of REA Terms](https://tostracker.app/document/property) (secondary copy; the primary page at about.realestate.com.au could not be fetched)
- **Domain Conditions of Use** bar you from "directly or indirectly scrape or index the Product or any part of it including information, images", from deploying "data mining, robots, or similar data gathering and extraction methods", from using the Product "for the purposes of building a database of property information", and from inserting "data tracking or collection devices (including any tag, code, cookie or pixel)" into any Product. You get "a limited, revocable, non-exclusive… licence to access and use the Product". No last-updated date is shown, and browser extensions are not mentioned — [Domain Group Conditions of Use](https://www.domain.com.au/group/conditions-of-use/)
- **Domain bot protection:** domain.com.au served an Akamai "Access Denied" (edgesuite reference) to a plain request, even for robots.txt (observed 2026-11-05 from this research environment). Homiio notes Domain "deferred (Akamai)" — [OxyHQ/Homiio docs](https://raw.githubusercontent.com/OxyHQ/Homiio/HEAD/docs/listing-providers.md). Scrapfly says repeated requests without proxies are "very likely to get blocked" — [Scrapfly Domain guide](https://scrapfly.io/blog/posts/how-to-scrape-domain-com-au-real-estate-property-data)
- **REA bot protection:** uses Kasada and changes defences "on a very regular basis" (Feb 2020) — [iTnews](https://www.itnews.com.au/news/rea-group-mutates-site-scraping-credential-stuffing-defences-537873). In 2026, raw HTTP to REA pages and to `lexa.realestate.com.au/graphql` returns "429 + `x-kpsdk-ct`", and so do headless Playwright and cold-profile Chrome — [ErrolMc CLAUDE.md](https://raw.githubusercontent.com/ErrolMc/SydneyRentalDataPipeline/HEAD/CLAUDE.md). My own plain request to an REA rent search page also got 429.
- **Anti-pattern to avoid:** Property Seeker's background script opens an offscreen document with the stated justification "Solve the javascript challenges to generate cookies and enable scraping". It also uses `declarativeNetRequest` to strip `Content-Security-Policy` and `X-Frame-Options` from property.com.au (an REA Group site), and it sends rate-limited background `fetch`es to Domain listing URLs — [property-seeker background.ts](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/background.ts), [domainService.ts](https://raw.githubusercontent.com/cheesestringer/property-seeker/HEAD/src/services/domainService.ts)
- **Developer API:** Domain has a separate official developer API with its own terms — [Domain developer Terms & Conditions](https://developer.domain.com.au/docs/latest/support/terms) (listed in search results; not reviewed in detail)

### Inferences
- **Lower-risk design**, consistent with "reads only what the user has open":
  - content script only, with `activeTab` or narrow host permissions
  - extraction runs on user action, e.g. clicking the toolbar button
  - parse only the already-loaded DOM and inline script text
  - no background or offscreen fetches to Domain/REA, no challenge solving, no header stripping
  - no prefetching of other listings, and no crawling of search result pages
- **Raises risk under both sets of terms:**
  - persisting listings server-side into a shared database (both terms single out "building a database")
  - re-hosting photos
  - aggregating across users
  - commercial resale of the data
- **Lower-risk data handling:**
  - keep extracted data per user and ephemeral, or user-saved only
  - hotlink, or show photo URLs only transiently
  - attribute and link back to the source listing
- **Not legal advice.** The terms' wording ("any automated … software … to retrieve") could arguably cover a client-side extension. If the product grows, a formal legal review or a data agreement (e.g. Domain's developer API) is the safer path.
- **No-spoofing rule:** the extension shouldn't fake user agents or replay Kasada/Akamai tokens. Since it runs in the user's real browser session, it needs none of that, which is the key technical advantage over a server-side scraper.

### Gaps
- I couldn't read REA's primary Terms of Use page directly (fetch failed), so I relied on a third-party snapshot dated Feb 2026.
- I found no Australian case law or official REA/Domain statement specifically about consumer browser extensions that read the open page.
- Domain's Conditions of Use show no version date, so I can't tell how current the wording is.
