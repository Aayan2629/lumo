# Lumo Investor Mode: 100 misleading claims and traps in property listings

Things in sale listings that can make investors overpay. Each line: the claim or trap, then what Lumo could check. [MB] = Microburbs API, [Open] = free open data, [Model] = our Task 4 rent model, [Ask] = a question Lumo tells the buyer to ask the agent.

## 1. Price tricks

1. "Offers above $X" or a price guide set low to pull buyers in (underquoting). Check: comparable sales [MB]  
2. "Contact agent" with no price at all. Check: estimated value [MB/Model]  
3. Price range so wide it means nothing. Check: comparable sales [MB]  
4. "Priced to sell" when it is above the suburb median. Check: suburb median [MB]  
5. "Reduced" when it was overpriced to begin with. Check: listing history [MB]  
6. "Below bank valuation" with no valuation shown. [Ask] for the valuation report  
7. Comparing to the dearest sale in the street, not the typical one. Check: median of comparables [MB]  
8. "Auction" with a reserve far above the guide. Check: comparables [MB]  
9. "Motivated vendor" used as pressure. Check: days on market [MB]  
10. "Multiple offers received" to rush you. [Ask] Check days on market [MB]

## 2. Rental return and yield claims

11. "Rental appraisal $X a week" written by the selling agent. Check: our rent estimate [Model]  
12. Gross yield shown, not net yield after costs. Check: net yield [Model]  
13. "Currently leased at $X" to a friend or above market. Check: rent estimate [Model]  
14. Rent guarantee that ends soon after you buy. [Ask] when it ends  
15. Furnished or short-stay rent quoted as if normal long-term rent. Check: long-term rent [Model]  
16. Holiday-letting income in an area that restricts it. Check: local short-stay rules [Open]  
17. Rent counted for a granny flat that is not approved. Check: DA records [Open]  
18. Rent quoted for every room in a share house. [Ask] about boarding house rules  
19. "Strong rental demand" with high vacancy in the suburb. Check: vacancy, days to lease [MB]  
20. Rent history hidden while the place has been relisted often. Check: rent history [MB]

## 3. Growth and "hot suburb" hype

21. "Suburb up 20%" over a cherry-picked time period. Check: 1, 5 and 10 year growth [MB]  
22. Growth figure for houses used on a unit listing. Check: growth by property type [MB]  
23. "Next big growth area" with no evidence. Check: growth trend [MB]  
24. Growth claim based on one big sale. Check: median trend [MB]  
25. "Gentrifying" claim in a suburb with flat prices. Check: price trend [MB]  
26. "Infrastructure coming" that is not funded or approved. Check: project status [Open]  
27. "New metro station" years away or on a different line. Check: actual walk to station [Open]  
28. "Blue chip location" for a street on the suburb edge. Check: block-level prices [MB]  
29. Off-the-plan "projected value" from the developer. Check: comparable resales [MB]  
30. "Land is scarce" while big towers are approved nearby. Check: DAs nearby [Open]

## 4. Supply and oversupply

31. Hundreds of new units approved nearby, not mentioned. Check: DAs within 1 km [Open]  
32. "Boutique building" with a huge development next door. Check: DAs [Open]  
33. "Limited release" when the developer has many unsold units. Check: listings in the building [MB]  
34. Many identical units for sale in the same building. Check: listings at the address [MB]  
35. Investor-heavy building that will be hard to resell. Check: sales frequency [Open: Valuer General]  
36. Same unit resold several times recently. Check: sale history [Open]  
37. Student housing towers going up near "student demand" claim. Check: DAs [Open]  
38. "Rare opportunity" when similar homes sit unsold. Check: days on market [MB]  
39. New supply that will push rents down. Check: approved dwellings [Open]  
40. Rezoning that allows more towers on the street. Check: zoning [Open]

## 5. Size, space and photos

41. Size that includes balcony, car space and storage. [Ask] for internal size  
42. "Approximately" sizes that are much bigger than the floor plan. Check: floor plan  
43. Wide-angle photos that make rooms look bigger. Check: photo flag  
44. Virtual staging or digitally furnished rooms. Check: photo flag  
45. Old photos from before the place got worn. Check: street photos [Open: Mapillary]  
46. Photos that crop out a highway, rail line or tower. Check: map and street view  
47. "Third bedroom" that is a study with no window. [Ask] for floor plan  
48. "Two car spaces" that are tandem or stacked. [Ask]  
49. Car space on a separate title or only leased. [Ask]  
50. Storage cage counted as living space. Check: floor plan

## 6. Location claims

51. "Walk to station" that is 20 minutes away. Check: walking route [Open: OSM]  
52. "Minutes to the CBD" by car at 3 am. Check: peak commute [Open: TfNSW]  
53. "Close to the beach" across a highway. Check: walk time [Open]  
54. Uses a better neighbouring suburb's name. Check: actual suburb [Open]  
55. "Quiet street" next to pubs or bars. Check: licensed venues [MB]  
56. "Leafy" with no street trees. Check: tree count [Open: City of Sydney]  
57. "Near schools" outside the school catchment. Check: catchment [Open]  
58. "Near uni" but the campus is far by transport. Check: commute [Open]  
59. Under a flight path, not mentioned. Check: noise maps [Open]  
60. Main road or rail line behind the building. Check: map [Open: OSM]

## 7. Risk the ad leaves out

61. Flood overlay on the lot. Check: flood [MB]  
62. Bushfire zone. Check: hazard layers [Open]  
63. Crime above average. Check: crime vs median [MB]  
64. Combustible cladding on the building. [Ask] for cladding register  
65. Known building defects or a defect lawsuit. [Ask] for strata minutes  
66. Contaminated land (old industrial site). Check: land use history [Open]  
67. Heritage listing that blocks renovation. Check: heritage register [Open]  
68. Road widening or compulsory acquisition plans. Check: planning [Open]  
69. Mobile tower or substation next door. Check: map [Open]  
70. Late-night trading street. Check: council late trading [Open: City of Sydney]

## 8. Strata and apartment traps

71. Low strata fees hiding an empty sinking fund. [Ask] for sinking fund balance  
72. Special levy coming for big repairs. [Ask] for strata minutes  
73. "Strata $X" quoted per quarter but looks like per year (or the reverse). [Ask]  
74. Pool, gym and concierge that push up fees. [Ask] fee breakdown  
75. Bans on pets or short-stay that cut rental demand. [Ask] by-laws  
76. Serviced apartment with restricted use and banks that won't lend. [Ask]  
77. Studio under 50 m2 that many banks won't lend on. Check: size  
78. Leasehold, not freehold. [Ask]  
79. Developer still controls the strata committee. [Ask]  
80. Building still under defect warranty, hidden issues. [Ask]

## 9. Renovation and condition

81. "Renovated" years ago, now dated. Check: listing history photos [MB]  
82. Cosmetic paint over damp or mould. [Ask] for building report  
83. Unapproved works (extension, granny flat). Check: DA records [Open]  
84. "Development potential" the zoning doesn't allow. Check: zoning [Open]  
85. "Knock down and rebuild" on a heritage lot. Check: heritage [Open]  
86. "Renovator's delight" with structural problems. [Ask] for building report  
87. Old wiring, asbestos or plumbing not mentioned. [Ask]  
88. "Light-filled" but faces south or a wall. Check: aspect, nearby heights [Open]  
89. "Views" that a new building will block. Check: DAs [Open]  
90. "Air conditioning" that is one old unit. Check: photos [Ask]

## 10. Money, tax and sales pressure

91. Depreciation promises from the seller, not a quantity surveyor. [Ask]  
92. "Negative gearing benefits" as a reason to overpay. Check: cash flow [Model]  
93. Rental yield ignoring land tax. Check: land value [Open]  
94. Free "investment seminar" or adviser paid by the developer. [Ask] about commissions  
95. Off-the-plan cash-back or rebates hiding a high price. Check: comparables [MB]  
96. Furniture package or rental guarantee built into the price. Check: value [MB]  
97. Bank valuation lower than price at settlement (off-the-plan). Check: comparables [MB]  
98. Stamp duty concessions that don't apply to investors. [Ask]  
99. "Must sell this week" pressure. Check: days on market [MB]  
100. One overall fake-feeling "investment score" from the agent. Check: Lumo's own score with sources

## Best for the demo

Pick ones Lumo can prove with data tomorrow: underquoting vs comparables, agent rent appraisal vs our model, gross vs net yield, new supply nearby (DAs), "walk to station" walking time, "quiet street" vs venues, flood and crime.