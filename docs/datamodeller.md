# Datamodeller i API-et

API-et skiller mellom rådata, referansedata og beregnede visninger:

| Modell             | Betydning                                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Customer`         | Én fiktiv kunde med grunnleggende profil, land, risikoprofil, investeringshorisont, inntekt og kundeforholdets startdato.                                                                                                                                            |
| `Account`          | En konto kunden har, for eksempel brukskonto, sparekonto, investeringskonto eller pensjonskonto. Saldoen på investerings- og pensjonskontoer beregnes fra markedsverdien av posisjonene som tilhører kontoen.                                                        |
| `Transaction`      | En bevegelse på en konto, med dato, type, kategori, beskrivelse, beløp og valuta. Transaksjoner er kontodata og er ikke det samme som investeringer.                                                                                                                 |
| `Investment`       | Kundens konkrete posisjon i et instrument. `account_id` viser hvilken konto posisjonen tilhører. Posisjonen inneholder blant annet antall, kjøpspris, nåværende pris, aktivaklasse, sektor og geografi. Én kunde kan ha flere `Investment`-rader i samme instrument. |
| `Instrument`       | Referanseinformasjon om selve investeringsproduktet, for eksempel et aksjesymbol, fond, ETF, obligasjon eller kontantinstrument. Her finnes én rad per unikt ticker-symbol, uavhengig av hvor mange kunder som eier det.                                             |
| `MarketDataPoint`  | Historisk markedsinformasjon for et instrument på en bestemt dato, blant annet pris og dagsavkastning. Brukes til å beregne den illustrative historiske utviklingen.                                                                                                 |
| `HoldingSummary`   | En beregnet og mer visningsvennlig versjon av en investering, med konto-ID, markedsverdi, urealisert gevinst/tap og andel av porteføljen.                                                                                                                            |
| `PortfolioSummary` | Samlet beregning for én kunde: totalverdi, kontantandel, gevinst/tap, fordeling på aktivaklasse, geografi og sektor, samt største beholdninger.                                                                                                                      |
| `RiskSummary`      | En pedagogisk risikoberegning basert på porteføljens egenskaper. Den er ikke en ekte egnethetsvurdering eller investeringsanbefaling.                                                                                                                                |
| `InsightsSummary`  | Regelbaserte observasjoner som er utledet fra kundens kontoer, transaksjoner og portefølje.                                                                                                                                                                          |

Det er derfor normalt at `/instruments` har langt færre rader enn `/holdings`:
`/instruments` viser unike produkter i hele datasettet, mens `/holdings` viser hver kundes
posisjon. Det samme instrumentet kan dermed opptre mange ganger i `/holdings`, én gang for
hver kunde som eier det.

Saldoene på `Investment Account` og `Pension` beregnes ved å summere markedsverdien
(`quantity × current_price`) til posisjonene som har den aktuelle kontoens `account_id`.
Dashboardets «Net worth» summerer saldoene på alle kontoer; kontantkontoer bruker egne
syntetiske saldoer, mens investerings- og pensjonskontoer bygger på posisjonene. Dette er
fortsatt en forenklet demoformue uten gjeld, ikke en fullstendig beregning av nettoformue.
