# What Lumo checks

Checks Lumo can run on a listing, ranked by how much renters want them and whether the hackathon data can prove them. Ideas: verify each against real data before claiming it.

Ranked by how much renters want it and whether the hackathon data can prove it. Tier 1 is built first.


## Tier 1: Build first

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 1 | 1 | Fair rent vs asking rent | Your own model's price for this flat, with and without parking, against what the ad asks. | Past-leases file (hackathon), Flats file (hackathon) |
| 2 | 11 | What a car space is worth here | Model's with-parking minus without-parking price for this flat. | Past-leases file (hackathon) |
| 3 | 42 | Your commute, at your time | Monday 8 am to your uni or work, not leave now. | OpenStreetMap, Transport for NSW data |
| 4 | 91 | Real weekly cost | Rent plus transport plus parking plus likely bills. | Past-leases file (hackathon), Microburbs API |
| 5 | 36 | Last rent paid | What this exact flat rented for last time, adjusted for time. | Past-leases file (hackathon) |
| 6 | 31 | Relisted often | This flat was advertised many times recently; tenants don't stay. | Past-leases file (hackathon) |
| 7 | 41 | Close to transport check | Real walk time to the nearest station, not straight-line distance. | OpenStreetMap |
| 8 | 51 | Quiet street check | Pubs, bars and late venues within 150 m. | Microburbs API, OpenStreetMap |
| 9 | 3 | Same building, cheaper flat | Similar flats in this exact building that rented for less in the last year. | Past-leases file (hackathon) |
| 10 | 2 | Rare value check | Flags ads that say great value or priced to lease but sit above fair rent. | Past-leases file (hackathon) |

## Tier 2: Strong addition

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 11 | 33 | Days on market | How long similar flats took to lease; room to negotiate. | Past-leases file (hackathon) |
| 12 | 4 | Price-drop history | How many times this flat's asking rent was cut before it leased. | Past-leases file (hackathon) |
| 13 | 37 | Rent jump at relisting | How much rent rose between the last two leases of this flat. | Past-leases file (hackathon) |
| 14 | 73 | Crime on this street | Street-level incidents, not just the suburb. | Microburbs API |
| 15 | 71 | Flood risk | Flood overlay on the property. | Microburbs API |
| 16 | 14 | Parking unknown | The ad doesn't say; show the price both ways. | Flats file (hackathon) |
| 17 | 13 | Paying for parking you won't use | Someone with no car looking at a flat whose rent includes a space. | Past-leases file (hackathon) |
| 18 | 20 | Car-free saving | Weekly saving from the no-parking version plus an Opal card. | Past-leases file (hackathon) |
| 19 | 21 | What each floor adds | Extra weekly rent per floor up in the same building. | Past-leases file (hackathon), Flats file (hackathon) |
| 20 | 9 | Rent growth vs wages | How fast this suburb's rent has risen compared with local incomes. | Microburbs API, Blocks file: 2021 Census and 2026 estimates |
| 21 | 83 | Rising or cooling | Rent trend over three years for this pocket. | Microburbs API |
| 22 | 5 | Overpriced and sitting | Flats asking over fair rent that have been listed longer than the suburb average. | Microburbs API, Past-leases file (hackathon) |
| 23 | 55 | Construction next door | Approved developments within 200 m. | City of Sydney or NSW open data |
| 24 | 61 | Which way it faces | North vs south-facing in the same building. | Flats file (hackathon), OpenStreetMap |
| 25 | 62 | Light-filled check | Taller buildings to the north that block the sun. | OpenStreetMap |

## Tier 3: Personal fit

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 26 | 92 | Your gym, nearest branch | Walk time to the chain you picked. | OpenStreetMap |
| 27 | 93 | Your supermarket | Nearest branch of the one you shop at. | OpenStreetMap |
| 28 | 54 | Main road frontage | Facing a major road vs a side street. | OpenStreetMap |
| 29 | 44 | Night bus gap | Whether you can get home after 1 am without a car. | Transport for NSW data |
| 30 | 32 | Building turnover | Share of the building's flats relisted each year vs the suburb. | Past-leases file (hackathon) |
| 31 | 6 | Rent per bedroom | Whether a 3-bed is actually cheaper per room than two 1-beds nearby. | Past-leases file (hackathon) |
| 32 | 53 | Flight path | Under a Sydney Airport flight path. | City of Sydney or NSW open data |
| 33 | 52 | Weekend noise | Pedestrian counts on Friday and Saturday nights. | City of Sydney or NSW open data |
| 34 | 78 | Foot traffic at night | Busy streets feel safer after dark. | City of Sydney or NSW open data |
| 35 | 77 | Lighting at night | Street lighting on the walk home. | City of Sydney or NSW open data |
| 36 | 100 | Livability score for you | Suburb livability reweighted by what matters to you. | Microburbs API |
| 37 | 12 | Parking premium by suburb | Car spaces are worth far more in some suburbs than next to a station. | Past-leases file (hackathon) |
| 38 | 22 | Ground-floor discount | How much less ground-floor flats rent for. | Past-leases file (hackathon), Flats file (hackathon) |
| 39 | 10 | Studio trap | Flats typed as studio but listed with a bedroom count, priced like a 1-bed. | Flats file (hackathon) |
| 40 | 8 | Seasonal timing | Whether rents in this suburb are cheaper to sign in winter than in January. | Past-leases file (hackathon) |

## Tier 4: Useful extra

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 41 | 48 | Rent saved per minute | How much less you pay for each extra minute of commute. | Past-leases file (hackathon), OpenStreetMap |
| 42 | 30 | Strata red flags | Buildings with many development applications for repairs. | City of Sydney or NSW open data |
| 43 | 76 | Building defects | Buildings named in public defect orders. | City of Sydney or NSW open data |
| 44 | 26 | Investor-heavy buildings | Share of flats in the building ever advertised for lease. | Flats file (hackathon) |
| 45 | 27 | Owner-occupier buildings | Fewer rentals often means better upkeep. | Flats file (hackathon) |
| 46 | 68 | Heat in summer | West-facing top floors get hottest. | Flats file (hackathon), OpenStreetMap |
| 47 | 65 | Winter sun | Hours of direct sun in June. | OpenStreetMap |
| 48 | 96 | Pet friendliness | Off-leash dog areas nearby. | City of Sydney or NSW open data |
| 49 | 98 | Schools for families | Catchment schools for the address. | Microburbs API |
| 50 | 95 | Parks you'll use | Green space within 5 minutes. | City of Sydney or NSW open data |
| 51 | 34 | Ghost listing | Ads that keep coming back unchanged for months. | Microburbs API |
| 52 | 38 | Off-market listings | Only on the agency's site, fewer competitors. | Microburbs API |
| 53 | 35 | First time on the market | Never advertised before, often newly bought by an investor. | Flats file (hackathon) |
| 54 | 40 | Attributes not confirmed | The flat's details haven't been confirmed in years. | Flats file (hackathon) |
| 55 | 63 | Views at risk | Approved towers that will block the view. | City of Sydney or NSW open data |
| 56 | 79 | Flood-prone basement parking | Car spaces in flood zones. | Microburbs API |
| 57 | 43 | Hill penalty | Walks that look short but climb steeply. | City of Sydney or NSW open data |
| 58 | 45 | Light rail vs train | Which line actually gets you there faster. | Transport for NSW data |
| 59 | 47 | Bike lanes | Separated cycleways to your uni. | City of Sydney or NSW open data, OpenStreetMap |
| 60 | 59 | Licensed venue hours | Late trading licences nearby. | City of Sydney or NSW open data |

## Tier 5: Niche or later

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 61 | 56 | Bus route outside | Buses per hour on the street. | Transport for NSW data |
| 62 | 84 | Who lives here | Age mix: students vs families. | Blocks file: 2021 Census and 2026 estimates |
| 63 | 85 | Renters vs owners | Share of renters on the block. | Blocks file: 2021 Census and 2026 estimates |
| 64 | 82 | New station coming | Future Metro stations that could lift rent. | City of Sydney or NSW open data |
| 65 | 81 | What's being built nearby | Development applications within 500 m. | City of Sydney or NSW open data |
| 66 | 72 | Heat island | Block surface temperature vs the suburb. | City of Sydney or NSW open data |
| 67 | 80 | Insurance hint | Contents insurance likely to cost more. | Microburbs API |
| 68 | 7 | Rent per square metre | Where floor area is known. | Flats file (hackathon) |
| 69 | 23 | Top-floor premium | Whether the top floors break the trend. | Past-leases file (hackathon), Flats file (hackathon) |
| 70 | 25 | Building age | Rent difference between new builds and older blocks of the same size. | Microburbs API |
| 71 | 29 | Same layout, different price | Identical flats on similar floors renting far apart. | Past-leases file (hackathon) |
| 72 | 60 | Quiet-side flats | Whether back-of-building flats rent for more. | Past-leases file (hackathon), Flats file (hackathon) |
| 73 | 66 | Harbour glimpse premium | What water views add to rent. | Past-leases file (hackathon), OpenStreetMap |
| 74 | 69 | Floor vs view | The floor where the view opens up and rent jumps. | Past-leases file (hackathon), Flats file (hackathon) |
| 75 | 16 | Street parking pressure | Homes per kerb space in the block. | Blocks file: 2021 Census and 2026 estimates, OpenStreetMap |
| 76 | 17 | Parking vs transport | Parking premium falls the closer you are to a station. | Past-leases file (hackathon), OpenStreetMap |
| 77 | 15 | Second car space value | Whether a second space adds anything at all. | Past-leases file (hackathon) |
| 78 | 18 | Garage or car space | Whether lock-up garages rent higher than open spaces. | Past-leases file (hackathon) |
| 79 | 19 | Visitor parking myth | Buildings advertising visitor parking in permit-only streets. | City of Sydney or NSW open data |
| 80 | 58 | Event venues | Stadiums and concert halls nearby. | OpenStreetMap |

## Tier 6: Lowest priority

| Rank | # | Check | What it tests | Data |
|---|---|---|---|---|
| 81 | 94 | Late-night food | Open after 10 pm within walking distance. | OpenStreetMap |
| 82 | 97 | Laundry | Laundromats for flats without one. | OpenStreetMap |
| 83 | 99 | Mobile coverage | Known black spots in basements and towers. | City of Sydney or NSW open data |
| 84 | 49 | Car share nearby | Car-share bays within 300 m. | OpenStreetMap |
| 85 | 39 | Agent turnover | Buildings where the managing agency changes often. | Past-leases file (hackathon) |
| 86 | 86 | People per home | Crowded blocks may mean share houses. | Blocks file: 2021 Census and 2026 estimates |
| 87 | 87 | Moving in, moving out | Population change since 2021. | Blocks file: 2021 Census and 2026 estimates |
| 88 | 90 | Zoning change | Rezoning that allows taller buildings. | City of Sydney or NSW open data |
| 89 | 75 | Heritage limits | Heritage areas that block changes. | Microburbs API, City of Sydney or NSW open data |
| 90 | 74 | Bushfire overlay | Mostly outside the city. | Microburbs API |
| 91 | 64 | Tree cover | Street trees outside. | City of Sydney or NSW open data |
| 92 | 67 | Park outlook | Facing a park vs a wall. | OpenStreetMap |
| 93 | 70 | Overlooked | Distance to the facing building's windows. | OpenStreetMap |
| 94 | 24 | Building size effect | Big towers vs small walk-ups. | Flats file (hackathon) |
| 95 | 28 | Corner flats | Whether corner positions rent higher. | Flats file (hackathon) |
| 96 | 88 | Shops closing | Venues on the main street that shut recently. | OpenStreetMap |
| 97 | 89 | New cafés opening | A sign the area is getting busier. | OpenStreetMap |
| 98 | 46 | Station crowding | Pedestrian counts near the station at peak. | City of Sydney or NSW open data |
| 99 | 50 | Airport access | Time to the airport. | Transport for NSW data |
| 100 | 57 | Rubbish truck time | Early commercial collections on mixed-use streets. | City of Sydney or NSW open data |
