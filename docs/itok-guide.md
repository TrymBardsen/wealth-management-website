# ITØK-guide: Hva går workshopen egentlig ut på?

## Kort sagt

Dette er **ikke** først og fremst en programmeringsoppgave. Det er en case-oppgave hvor dere
har fått et fungerende demo-produkt (Wealth Copilot), og skal jobbe som et team for å
**videreutvikle det som et produkt**.

Dere kan velge selv hvor teknisk dere vil gå:

- **Lite teknisk**: diskutere, tegne arkitektur, skrive ned beslutninger og begrunnelser
- **Middels teknisk**: endre tekster, tall, regler eller syntetiske data
- **Mer teknisk**: endre kode i frontend/API hvis noen i gruppa vil og kan

Alle nivåer er gyldige. Det viktigste er at dere kan **forklare og begrunne** valgene deres.

## Hva finnes i demoen fra før?

- **Kunder** med kontoer, transaksjoner og porteføljer (syntetiske data)
- **Portefølje-oversikt**: hva kunden eier, fordelt på aktivaklasser
- **Risikoscore**: en enkel, forklarbar modell (IKKE ekte finansiell rådgivning)
- **Innsikter**: automatisk genererte observasjoner om kundens økonomi
- **Wealth Copilot**: en enkel «chatbot» som svarer på spørsmål om kundens egen økonomi —
  i dag er den regelbasert (ikke en ekte AI/LLM)

Tallene og beregningene er laget for en pedagogisk demo. De er ikke ekte kundedata eller
finansiell rådgivning.

## Slik henger datamodellene sammen

API-et består av både rådata og beregnede modeller:

- En **kunde** kan ha én eller flere **kontoer**.
- En konto kan ha mange **transaksjoner**, for eksempel innbetalinger, uttak og overføringer.
- En **investeringsposisjon** er kundens beholdning i et instrument. Den har blant annet
  antall, kjøpspris og nåværende pris, og `account_id` viser hvilken investerings- eller
  pensjonskonto den tilhører. Kontoverdien beregnes ved å summere posisjonenes markedsverdi
  (antall × nåværende pris).
- Et **instrument** er selve produktet, for eksempel en aksje, ETF, et fond, en obligasjon
  eller kontanter. Det samme instrumentet kan eies av mange kunder.
- **Markedsdata** beskriver hvordan prisen på et instrument har utviklet seg over tid.
- API-et bruker disse dataene til å beregne en **porteføljeoversikt**, en illustrativ
  **risikoscore** og regelbaserte **innsikter**.

Se «Datamodeller i API-et» i `README.md` for feltene som inngår i hver modell.

## Hva skal dere egentlig gjøre?

Velg én av kundecasene i `docs/workshop.md`. Denne guiden viser hvordan dere kan bidra med
ITØK-perspektivet, uansett hvor mye kode dere ønsker å skrive.

Bruk de åtte spørsmålene i workshopoppgaven til å utforske både IT-siden og
forretningssiden av caset:

| Spørsmål | IT-vinkel | Økonomi- og forretningsvinkel |
| --- | --- | --- |
| Hvilke data bør samles inn, og hvor kommer de fra? | Datakilder, formater og oppdateringsfrekvens | Hvilke opplysninger trengs for å forstå kundens økonomi? |
| Hvordan bør dataplattformen designes? | Arkitektur og skalering | Hvem eier dataene, og hvem skal bruke dem? |
| Hvilke teknologier bør brukes, og hvorfor? | Modenhet, drift og integrasjoner | Kostnader og forventet nytte |
| Hvordan bør datakvalitet sikres, og hva skjer når data mangler eller er feil? | Validering og feilhåndtering | Hvordan kan feil tall påvirke kunden og beslutningene? |
| Hvordan bør sikkerhet og personvern håndteres? | Tilgangsstyring og beskyttelse av data | Samtykke, GDPR og tillit |
| Hvordan kan AI skape verdi, og hva bør AI-en ikke gjøre? | Hvor i løsningen passer AI inn? | Hvordan unngå villedende svar og uønskede investeringsråd? |
| Hvordan bør sanntidsdata og oppdateringer håndteres? | Hendelser og oppdateringsjobber | Hvor ferske må tallene være for å være nyttige? |
| Hva er de største risikoene, og hvordan reduseres de? | Systemfeil, nedetid og sikkerhetsbrudd | Feilinformasjon, økonomiske konsekvenser og tap av tillit |

Det er ikke nødvendig å koble på en ekte språkmodell. Dere kan drøfte hvor AI eventuelt kan
hjelpe, hvilke data den bør bruke, og hvordan dere kan begrense risikoen for feilinformasjon
eller uønskede investeringsråd.

## Hvor finner jeg mer?

- `README.md` — hvordan kjøre appen og hvordan datamodellene henger sammen
- `docs/workshop.md` — selve oppgaveteksten, de 8 spørsmålene og arbeidsstegene
- `prompts/` — ferdige prompts for å utforske/endre koden med GitHub Copilot CLI
