# Workshop-oppgave: Bygg Wealth Copilot

## Utfordringen

Design og lag en prototype av en Wealth Copilot som gir kunder en samlet og intelligent
oversikt over sin økonomiske situasjon.

Ta utgangspunkt i den fungerende demoen i dette repoet. Deltakere kan utforske API-et, utvide
frontend, endre de syntetiske dataene og bruke instruksjonene i `/prompts` sammen med GitHub
Copilot CLI.

## 8 spørsmål å svare på

1. Hvilke data bør samles inn, og hvor kommer de fra?
2. Hvordan bør dataplattformen designes?
3. Hvilke teknologier bør brukes, og hvorfor akkurat disse?
4. Hvordan bør datakvalitet sikres, og hva skjer når data mangler eller er feil?
5. Hvordan bør sikkerhet og personvern håndteres?
6. Hvordan kan AI skape verdi, og hva bør AI-en aldri få lov til å gjøre?
7. Hvordan bør sanntidsdata og oppdateringer håndteres?
8. Hva er de største risikoene, og hvordan reduserer dere dem?

Se `docs/itok-guide.md` for en enklere, ikke-teknisk gjennomgang av disse 8 spørsmålene,
med både en IT-vinkel og en økonomi-vinkel for hvert av dem.

## Foreslåtte arbeidssteg

### 1. Forstå utgangspunktet

Kjør applikasjonen, bytt mellom de fiktive kundene og se på API-svarene bak Dashboard,
Portefølje, Innsikter og Wealth Copilot. Prøv å svare på: Hvilke data ligger bak hver
skjerm, og hvor "ferske" er de?

### 2. Velg et kundeproblem

Eksempler: veiledning om kontantstrøm, forklaring av porteføljediversifisering,
pensjonsplanlegging, konsolidering av eksterne aktiva eller tydelig sporing av hvor dataene
kommer fra.

### 3. Design dataflyten

Identifiser kildedata, krav til ferskhet, kvalitetsregler, behov for identitet/samtykke og
hvilket API eller hvilken hendelse som støtter opplevelsen. Skisser gjerne dette som et enkelt
arkitekturdiagram (bokser og piler holder fint).

### 4. Lag en prototype

Bruk de eksisterende API- og UI-mønstrene. Hold beregningene deterministiske og forklarbare.
Hvis dere legger til et AI-lag, definer nøyaktig hva modellen har lov til og ikke lov til.

### 5. Utfordre løsningen med et nytt scenario

Velg ett av scenarioene under og diskuter hvordan løsningen deres bør endres. Dere trenger
ikke bygge alt - poenget er å vise at dere har tenkt gjennom konsekvensene.

- **Eksterne investeringer:** Kunden har investeringer hos en annen finansinstitusjon.
  Hvordan håndterer dere samtykke, ferskhet på data, kobling av instrumenter, bekreftelse av
  eierskap og manglende kostpris? Hva sier Copilot når eksterne data er ufullstendige?
- **Kjøp skal vises umiddelbart:** Kunden kjøper et aktivum og forventer at Wealth Copilot
  reflekterer endringen med en gang. Hvordan håndterer dere ventende versus oppgjorte
  posisjoner, prisens ferskhet og foreløpige verdier i grensesnittet?
- **Åpenhet om personopplysninger:** Kunden ber om å få vist nøyaktig hvilke
  personopplysninger som ble brukt til å lage en AI-innsikt. Hvordan viser dere dataopprinnelse
  og svarer på «Hvorfor ser jeg dette?»
- **Feil AI-innsikt:** AI-en gir kunden en feilaktig investeringsrelatert innsikt. Hvordan
  oppdager, forklarer og retter dere dette, og hvem bør varsles?

### 6. Evaluer

Test normale tilfeller og kanttilfeller, se på dataopprinnelse, utfordre antakelser og
forklar hvordan feil håndteres.

### 7. Designoppgave (valgfri): gi appen en Nordea-inspirert stil

Gjør frontend mer visuelt lik en typisk nettbank, inspirert av en mørk og kraftig blåfarge,
ren nordisk stil og en tydelig topplinje/topptekst.

Ting å vurdere:

- Bytt fargepalett i frontend (bakgrunn, knapper, lenker, grafer) til blåtoner
- Legg til en enkel logo eller tekstlogo (for eksempel «Wealth Copilot») i toppteksten
- Vurder skrifttype, avrundede hjørner/kort-design og luftig layout, slik man ofte ser i
  nettbankapplikasjoner
- Sørg for at det fortsatt er tydelig, f.eks. i footer, at dette er en **fiktiv, syntetisk
  demo**

Dette er en god oppgave for dem i gruppa som vil jobbe mer med frontend/UI enn med data og
arkitektur.

## Leveranser

- fungerende prototype
- arkitekturdiagram
- teknologivalg
- forretningsverdi
- risikoer og utfordringer
- kort forklaring av datakvalitet, personvern og AI-styring

## Definisjon av ferdig

Prototypen skal fungere for minst én fiktiv kunde, vise hvor dataene kommer fra, synlig
håndtere manglende eller utdaterte data, og aldri fremstille den pedagogiske risikoscoren som
reell finansiell rådgivning.
