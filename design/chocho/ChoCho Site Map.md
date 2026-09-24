# ChoCho — site map & change record

**Open this to review:** `ChoCho Home.dc.html`. Everything else is reached through the site's own header, bottom navigation, cards and footer.

## Roles of the 17 documents
Main pages (6): Home · Games · Promotions · VIP · Wallet · My Account
Information pages (1 document, 4 destinations): `ChoCho Info.dc.html?page=responsible-gaming | faq | terms | privacy`. One shared reading layout; reached from the footer and the registration consent text only — not header or bottom-nav items. Readable by guests.

Supporting screens and flows (2):
- Sweet Bonanza: the game-detail screen under Games.
- Registration: the shared sign-in, register and password-reset dialog. It opens over whichever page asked for it.

Shared components (5):
- Header, Footer, Bottom Nav.
- Support: the support panel and mascot. It also hosts the shared sign-in dialog and the neutral notices.
- Bonuses: used in the header drawer and in My Account → Bonuses.

Internal only (3), not linked from any player page:
- UI Foundations: design reference.
- Home Responsive Preview: iframes of the real Home and Games.
- QA Board: test tool, using `qa-audit.js`, `qa-wallet.js` and `qa-journeys.js`.

Historical versions: none exist. Nothing was archived or deleted.

**Editor limitation:** the page picker cannot group or hide documents. Components are imported by file name, so moving them into folders would break the imports. The groups above live in this record only.

## Navigation (single definition in `chocho-site.js`)
- **Logo / Home:** Home.
- **Games / Promotions / VIP:** their pages.
- **Bottom nav:** Home, Games, Wallet, Bonuses (goes to Promotions), Lucky Wheel (goes to Home#wheel).
- **Wallet / My Account as a guest:** the sign-in dialog opens over the current page and remembers the requested destination. Opening those pages directly as a guest shows a sign-in gate and no personal data.
- **Sign in / Register:** the shared dialog opens in the matching mode.
  - Old links (`ChoCho Registration.dc.html#signin`, `#register`, `#reset`) redirect to Home with that dialog open.
  - `#signin` / `#register` / `#reset` also work on any page.
- **Help, footer Support, mascot:** all open the same support panel. Escape closes it and focus returns to what opened it.
- **Header balance dropdown and "View my bonuses":** open in place without leaving the page. They use the same Bonuses component as My Account → Bonuses.
- **Header Deposit:** goes to `Wallet#deposit`, which shows the existing "Deposits are currently unavailable" state. `#withdraw` does the same for withdrawals.
- **Quick Play cards:** go to Games with `?category=`.
- **Home bonus cards and the welcome banner:** go to Promotions with `?promo=`, filtered to the matching offer.
- **Game cards:**
  - Sweet Bonanza opens its game-detail screen. Back returns to the catalogue view that opened it, including its filters; direct entry falls back to Games.
  - Every other card shows a notice that no game page exists yet.
- **Games controls:**
  - These filter the real catalogue data: search, provider, favourites, the "New" category, and the Sort, Popularity and Newest options. The filters are kept in the URL.
  - Other categories show an honest notice, because the catalogue has no type data yet.
- **Lucky Wheel:** opens the existing wheel display. Spin never produces a prize.
- **Footer Responsible Gaming / FAQ / Terms / Privacy:** ordinary links to the Info page (Back/Forward, refresh, direct entry and `#section` anchors work). The current one is underlined in the footer; no bottom-nav item is selected. Support stays the shared panel.
- **Registration consent links:** open Terms / Privacy in a new tab, so the form and checkbox are untouched.
- **FAQ links into My Account:** `ChoCho My Account.dc.html?tab=Bonuses | Verification | Preferences` opens that tab (guests get the sign-in dialog first).
- **No destination yet, so a neutral notice is shown:** Aviator, Promotions "View Details", the Games "Game Type" filter, and the provider "View all".

## Preview session (internal)
- There is one shared guest / signed-in state, stored under `localStorage["chocho:previewSession"]`.
- Sign-in forms never create a session; they keep the "service not connected" results.
- To review signed-in states, choose **Tweaks → previewSession → signed-in** on Home, Promotions, Wallet, My Account or Sweet Bonanza. The choice applies to every page.
- Older props (`account`, `signedIn`, `session`) still map onto the same shared state.
- Switching to guest while a page is open updates the header, closes personal panels and shows the sign-in gate.
- Identity (JR / Jaypee R.) and balance (₱12,480.50) come from `chocho-account.js` everywhere they appear.

## Changed files
- New helper: `chocho-site.js` (destinations, preview session, return targets, where a game was opened from, notices).
- Test helper added to the QA Board: `qa-journeys.js`.
- Updated: `chocho-account.js` (shared identity) and these components: Header, Footer, Bottom Nav, Support, Registration, Home, Games, Promotions, VIP, Wallet, My Account, Sweet Bonanza.
- Old per-page menu, navigation and chat code that the templates no longer used was removed.

## Open items
- **Missing content or decisions:**
  - Promotion full terms.
  - Info pages hold the proposed review copy from the 24 Sep 2026 content pack. It is not approved policy. Terms has 16 and Privacy 15 marked REQUIRED fields. Responsible Gaming has 2: account controls and ChoCho's own break/restriction process. No effective dates, contacts or operator facts are filled in.
  - FAQ: 11 navigation answers. Still waiting for real rules: payment methods, fees, limits, processing times, verification documents/timing, wagering/cashout, eligibility, support availability, closure/reopening.
  - The footer shows "18+" and "Licensed by PAGCOR". PAGCOR's own guidance names 21 as the minimum age. Confirm the regime and correct the age before release. The logo alone does not prove a licence.
  - Aviator and other game pages.
  - Game-type data for categories.
  - Final artwork for the placeholder banner slides.
  - Confirm that the Home "Cash Boost" card (+5% on GCash) should link to Promotions "Deposit Boost".
- **Services not connected:** authentication, payments, game launch, bonus claims, verification, live support, Lucky Wheel.
- **UI:** on desktop the support mascot still sits over the footer ♥ at the end of the page (unchanged from before).
