# Stripe: postup zapnutia (platby kartou za lístky)

Kód je hotový, ale **vypnutý** (`CARD_CHECKOUT_ENABLED = false` v `src/lib/plans.ts`) a **netestovaný proti skutočnému Stripe**, lebo nemal kľúče. Postupuj v tomto poradí a **celé najprv v testovacom režime** (Test mode, kľúče `sk_test_…`).

## 1. Firebase
1. Projekt `bandmate-5e67a` prepni na plán **Blaze** (Firebase konzola → Upgrade). Bez neho sa funkcie nedajú nasadiť.
2. Služba na e-maily: účet na [resend.com](https://resend.com), pridať a overiť odosielaciu doménu (napr. `bandmate.shop`), vytvoriť API kľúč. Odosielateľ je v `functions/src/index.ts` (`MAIL_FROM`, predvolene `BandMate <tickets@bandmate.shop>`).

## 2. Stripe (Test mode)
1. **Connect → Get started** → platforma/marketplace, typ účtov **Express**.
2. **Developers → Webhooks → Add endpoint**, adresa funkcie `stripeWebhook` (po nasadení ju ukáže Firebase, tvar `https://europe-west1-bandmate-5e67a.cloudfunctions.net/stripeWebhook`). Vyber udalosti: `checkout.session.completed` a `account.updated`. Vytvor **dva** endpointy s rovnakou adresou: jeden pre „Events from: Your account" a jeden pre „Events from: Connected accounts" (kvôli `account.updated` z účtov kapiel).
3. Skopíruj **Signing secret** (`whsec_…`) každého endpointu. (Ak sú dva rôzne, pozri poznámku dole.)

## 3. Tajné kľúče (nikdy do kódu ani do chatu)
Z Google Cloud Shell (`shell.cloud.google.com`, ten istý účet ako Firebase):
```
git clone https://github.com/TifexLab/BandMate.git && cd BandMate
npm --prefix functions install
npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY --project bandmate-5e67a
npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET --project bandmate-5e67a
npx firebase-tools functions:secrets:set RESEND_API_KEY --project bandmate-5e67a
```
Pri každom príkaze ťa požiada o hodnotu; vlož ju tam (nezobrazí sa).

## 4. Nasadenie
```
npx firebase-tools deploy --only functions,firestore:rules --project bandmate-5e67a
```
Potom pridaj adresu `stripeWebhook` do Stripe (krok 2.2).

## 5. Test (stále Test mode)
1. Ako admin kapely: Nastavenia → **Platby kartou** → Zapnúť (až keď prepneš `CARD_CHECKOUT_ENABLED` na `true`, commit, deploy). Vo formulári Stripe použi testovacie údaje (IBAN `SK3112000000198742637541`, ostatné ľubovoľné).
2. Pri lístku zapni „Karta (Stripe)" a otvor jeho odkaz → **Zaplatiť kartou** → testovacia karta `4242 4242 4242 4242`, ľubovoľný dátum a CVC.
3. Skontroluj: príde e-mail s PDF (každý lístok vlastný QR), v lístku sú kódy ako zaplatené, v Tržbách je predaj, v Stripe je platba s poplatkom aplikácie.

## 6. Ostrý režim
Až po úspešnom teste: v Stripe prepni na Live, vytvor živý webhook (rovnako ako v kroku 2), nastav tajné kľúče znova na `sk_live_…`/živý `whsec_…` a nasaď.

## Poznámky
- Poplatok BandMate (3,5 % + 0,30 €) je v `src/lib/fees.ts` a `functions/src/fees.ts` (musia byť rovnaké; test to kontroluje).
- Ak by dva webhooky mali rôzne `whsec_`, treba funkcii povedať, že môže overiť oba (zatiaľ sa počíta s jedným). Najjednoduchšie je nastaviť jeden endpoint a v Stripe zapnúť „Listen to events on Connected accounts".
- Ešte nepostavené: vrátenie peňazí cez Stripe, platby kartou za merch, ochrana pred zneužitím (App Check), upozornenie na novú správu pre admina e-mailom.
