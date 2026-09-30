# ITØK-guide: Hva går workshopen egentlig ut på?

## Problemstilling

I samarbeid med Private Banking ønsker Nordea å utvikle en Wealth Copilot kan gjøre kundens
økonomi og investeringer enklere å forstå.

## Kort sagt

Dette er **ikke** først og fremst en programmeringsoppgave. Det er en case-oppgave hvor dere
har fått et fungerende demo-produkt (Wealth Copilot), og skal jobbe som et team for å
**videreutvikle det som et produkt**.

Dere kan velge selv hvor teknisk dere vil gå:

- **Lite teknisk**: diskutere, tegne arkitektur, skrive ned beslutninger og begrunnelser
- **Middels teknisk**: endre tekster, tall, regler eller syntetiske data
- **Mer teknisk**: endre kode i frontend/API hvis noen i gruppa vil og kan

Alle nivåer er gyldige. Det viktigste er at dere kan **forklare og begrunne** valgene deres.

## Hva finnes i appen fra før?

- **Kunder** med kontoer, transaksjoner og porteføljer (fiktive/syntetiske data)
- **Portefølje-oversikt**: hva kunden eier, fordelt på aktivaklasser
- **Risikoscore**: en enkel, forklarbar modell (IKKE ekte finansiell rådgivning)
- **Innsikter**: automatisk genererte observasjoner om kundens økonomi
- **Wealth Copilot**: en enkel «chatbot» som svarer på spørsmål om kundens egen økonomi —
  i dag er den regelbasert (ikke en ekte AI/LLM)

## Slik henger datamodellene sammen

API-et består av både rådata og beregnede modeller:

- En **kunde** kan ha én eller flere **kontoer**.
- En konto kan ha mange **transaksjoner**, for eksempel innbetalinger, uttak og overføringer.
- En **investerings- eller pensjonskonto** kan ha mange **investeringsposisjoner**. Hver
  posisjon har en `account_id` som viser hvilken konto den tilhører. Kontoverdien beregnes
  ved å summere posisjonenes markedsverdi (antall × nåværende pris).
- En investering er kundens konkrete beholdning i et instrument, med antall, kjøpspris og
  nåværende pris.
- Et **instrument** er selve produktet, for eksempel en aksje, ETF, et fond, en obligasjon
  eller kontanter. Det samme instrumentet kan eies av mange kunder.
- **Markedsdata** beskriver hvordan prisen på et instrument har utviklet seg over tid.
- API-et bruker disse dataene til å beregne en **porteføljeoversikt**, en illustrativ
  **risikoscore** og regelbaserte **innsikter**.

Se «Datamodeller i API-et» i `README.md` for feltene som inngår i hver modell.

## Hva skal dere egentlig gjøre?

Velg ett av de tre Private Banking-problemområdene i `docs/workshop.md`. Finn ut hva kunden
trenger å forstå, hvilke data som trengs for å forklare det, og hvordan løsningen kan vise
forklaringen på en tydelig måte. Dere trenger ikke bygge en full bankløsning.

De 8 spørsmålene i `docs/workshop.md` hjelper dere med å tenke gjennom både IT-delen og
økonomi-delen:

| Spørsmål                          | IT-vinkel                                | Økonomi-vinkel                                  |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| Hvilke data trengs?               | Datakilder, format, oppdateringsfrekvens | Hvilke tall er relevante for kundens økonomi?   |
| Hvordan bør plattformen designes? | Arkitektur, skalering                    | Hvem eier/bruker dataene?                       |
| Hvordan sikre datakvalitet?       | Validering, feilhåndtering               | Konsekvens av feil tall for kunden              |
| Sikkerhet og personvern?          | Tilgangsstyring, kryptering              | GDPR, samtykke, bankhemmelighet                 |
| Hvordan kan AI skape verdi?       | Hvor i systemet passer AI inn?           | Hva bør/bør ikke AI si om kundens penger?       |
| Sanntidsdata?                     | Events, oppdateringsjobber               | Hvor "fersk" må et tall være for å være nyttig? |
| Største risikoer?                 | Systemfeil, nedetid                      | Feilinformasjon, tap av tillit                  |

## Om AI/LLM-spørsmålet spesielt

Dere trenger **ikke** koble på en ekte språkmodell (LLM). Det holder å **resonnere seg fram
til**:

- Hvor i systemet ville en AI passe inn (f.eks. for å forklare tall i tekst)?
- Hva bør AI-en få lov til (forklare/oppsummere) og **ikke** lov til (finne på tall, gi
  investeringsråd)?
- Hvilke risikoer følger med (feilinformasjon, personvern, kostnad, avhengighet av en
  ekstern leverandør)?

## Hvor finner jeg mer?

- `README.md` — hvordan kjøre appen og hvordan datamodellene henger sammen
- `docs/workshop.md` — selve oppgaveteksten, de 8 spørsmålene og arbeidsstegene
- `prompts/` — ferdige prompts for å utforske/endre koden med GitHub Copilot CLI
