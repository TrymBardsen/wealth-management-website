# Workshop-oppgave: Bygg Wealth Copilot

## Utfordringen

I samarbeid med Private Banking ønsker Nordea å utvikle en Wealth Copilot som skal gjøre kundens
økonomi og investeringer enklere å forstå.

Ta utgangspunkt i den fungerende demoen i dette repoet. Deltakere kan utforske API-et, utvide
frontend, endre de syntetiske dataene og bruke instruksjonene i `/prompts` sammen med GitHub
Copilot CLI/claud code eller liknende.

## Velg ett problemområde

Under er det beskrevet tre reelle problemstillinger og kundecaser som privat banking har i dag.
Ta utgangspunkt i ett eller fler og finn ut hva kunden trenger å forstå, hvilke data som trengs for å forklare det, og hvordan løsningen kan hjelpe
kunden på en god måte. Dere trenger ikke bygge en full bankløsning. Svar så godt dere kan på de 8 spørsmålene mens dere jobber med kundecaset.

### A. Forstå hvorfor porteføljen utvikler seg

**Problemstilling:** Hvordan kan Wealth Copilot forklare porteføljeutviklingen gjennom
forståelige analyser og personlige innsikter?

**Kundecase:** Anne (52) ser at porteføljen har steget med 7 % det siste halvåret, men ser
bare totalsummen. Hun vil forstå hvilke investeringer som har påvirket utviklingen mest,
om økningen skyldes markedet eller egne investeringsvalg, og om utviklingen er forventet
gitt risikoprofilen hennes. Forklaringen bør være enkel og unngå unødvendige fagbegreper.

### B. Gjør investeringsrisiko synlig og forståelig

**Problemstilling:** Hvordan kan Wealth Copilot vise kundens investeringsrisiko på en måte
som er forståelig og relevant for kundens mål?

**Kundecase:** Jonas (36) oppfatter risikoprofilen sin som moderat, men porteføljen hans har
gradvis fått større eksponering mot teknologiaksjer og globale aksjefond. Når markedet faller,
blir han overrasket over svingningene. Han vil forstå hvor risikoen kommer fra, hvilke
investeringer som bidrar mest, og om porteføljen fortsatt samsvarer med målene hans.

### C. Følg med på økonomiske mål

**Problemstilling:** Hvordan kan Wealth Copilot hjelpe kunder med å forstå om de ligger an
til å nå økonomiske mål, og hvilke faktorer som påvirker muligheten for å nå dem?

**Kundecase:** Maria (29) ønsker å bli økonomisk uavhengig innen ti år og sparer hver måned.
Hun vil forstå om sparebeløpet kan være tilstrekkelig, hvordan markedsutviklingen påvirker
målet, og om hun ligger foran eller bak planen.

Alle tre problemområdene er like gyldige. Velg det som interesserer gruppa mest. Vær tydelige
på hvilke data og beregninger demoen allerede har, hva dere eventuelt må legge til, og hvilke
antakelser forklaringen bygger på.

## 8 spørsmål å svare på

1. Hvilke data bør samles inn, og hvor kommer de fra?
2. Hvordan bør dataplattformen designes?
3. Hvilke teknologier bør brukes, og hvorfor akkurat disse?
4. Hvordan bør datakvalitet sikres, og hva skjer når data mangler eller er feil?
5. Hvordan bør sikkerhet og personvern håndteres?
6. Hvordan kan AI skape verdi, og hva bør AI-en aldri få lov til å gjøre?
7. Hvordan bør sanntidsdata og oppdateringer håndteres?
8. Hva er de største risikoene, og hvordan reduserer dere dem?

## Foreslåtte arbeidssteg

### 1. Forstå utgangspunktet

Kjør applikasjonen, bytt mellom de fiktive kundene og se på API-svarene bak Dashboard,
Portefølje, Innsikter og Wealth Copilot. Prøv å svare på: Hvilke data ligger bak hver
skjerm og tall. Se også etter hva demoen ikke kan svare på i det valgte problemområdet.

### 2. Velg et kundeproblem

Velg ett av de tre problemområdene og kundecase-beskrivelsene over. Skriv kort hva kunden
prøver å forstå, og hvordan en bedre forklaring kan hjelpe kunden.

### 3. Design dataflyten

Identifiser kildedata, krav til ferskhet, kvalitetsregler, behov for identitet/samtykke og
hvilket API eller hvilken hendelse som støtter opplevelsen. Skisser gjerne dette som et enkelt
arkitekturdiagram (bokser og piler holder fint).

### 4. Lag en prototype

Bruk de eksisterende API- og UI-mønstrene. Prøv å legg til en feature som løser kundeproblemet ved hjelp av vibecoding eller tegning.
Hold beregningene deterministiske og forklarbare. Hvis dere legger til et AI-lag, definer nøyaktig hva modellen har lov til og ikke lov til.

### 5. Utfordre løsningen med et nytt scenario

Velg ett av scenarioene under og diskuter hvordan løsningen deres bør endres. Dere trenger
ikke bygge alt - poenget er å vise at dere har tenkt gjennom konsekvensene.

- **Eksterne investeringer:** Kunden har investeringer hos en annen finansinstitusjon.
  Hvordan håndterer dere samtykke, ferskhet på data, kobling av instrumenter, bekreftelse av
  eierskap og manglende kostpris? Hva sier Copilot når eksterne data er ufullstendige?
- **Kjøp skal vises umiddelbart:** Kunden kjøper et aktiva og forventer at Wealth Copilot
  reflekterer endringen med en gang. Hvordan håndterer dere ventende versus oppgjorte
  posisjoner, prisens ferskhet og foreløpige verdier i grensesnittet?
- **Åpenhet om personopplysninger:** Kunden ber om å få vist nøyaktig hvilke
  personopplysninger som ble brukt til å lage en AI-innsikt. Hvordan viser dere dataopprinnelse
  og svarer på «Hvorfor ser jeg dette?»
- **Feil AI-innsikt:** AI-en gir kunden en feilaktig investeringsrelatert innsikt. Hvordan
  oppdager, forklarer og retter dere dette, og hvem bør varsles?

### 6. Designoppgave (valgfri): gi appen en Nordea-inspirert stil

Gjør frontend mer visuelt lik en typisk nettbank, inspirert av en mørk og kraftig blåfarge,
ren nordisk stil og en tydelig topplinje/topptekst.

Ting å vurdere:

- Bytt fargepalett i frontend (bakgrunn, knapper, lenker, grafer) til blåtoner
- Legg til en enkel logo eller tekstlogo (for eksempel «Wealth Copilot») i toppteksten
- Vurder skrifttype, avrundede hjørner/kort-design og luftig layout, slik man ofte ser i
  nettbankapplikasjoner

Dette er en god oppgave for dem i gruppa som vil jobbe mer med frontend/UI enn med data og
arkitektur.

## Leveranser

- fungerende prototype
- arkitekturdiagram
- teknologivalg
- forretningsverdi
- risikoer og utfordringer
- kort forklaring av datakvalitet, personvern og AI-styring
