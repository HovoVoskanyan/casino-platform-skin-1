# ChoCho — Banner Specifications Report

Read-only audit of the current project (24 Sep 2026). No pages, assets, navigation or behaviour were changed.

**Evidence labels**
- **M** = measured in real page viewports (each page loaded in its own frame of that exact CSS width).
- **C** = calculated from source.
- **R** = recommendation.
- **U** = unavailable.

**Test conditions (M)**
- DPR 1.25 (the only density available). CSS-px sizes do not depend on DPR.
- Viewport height 900. Home was re-checked at height 600 in both guest and signed-in states: identical results, so no banner depends on viewport height.
- The vertical scrollbar was suppressed in the test frames to match phone overlay scrollbars. On desktop browsers with a classic scrollbar (~15px), layout width is ~15px narrower until the viewport reaches about 1039px.
- The 1px banner borders render as 0.8px at DPR 1.25, so image width = box − 1.6. At DPR 1 or 2 it is box − 2 (C).

## Scope result
Only **one placement needs banner artwork today: the Home hero carousel (B1)**. It has four slides:
- Slide 1 is the only image banner.
- Slides 2–4 are HTML placeholders that reserve the same space.

The Games, Promotions and VIP page heroes are HTML/CSS sections with the ChoCho brand logo as decoration. They need no banner file.

No banner placements exist on Wallet, My Account, Registration/sign-in, Sweet Bonanza, the Info pages (Responsible Gaming, FAQ, Terms, Privacy), the header, the Bonuses drawer or the support panel.

## A. Banner inventory

| ID | Page / placement / state | Source | Type | Asset and native size | Reused on |
|---|---|---|---|---|---|
| B1-S1 | Home · hero carousel · slide 1 "Welcome Bonus" · all states | `ChoCho Home.dc.html`, carousel `<section aria-roledescription="carousel">` | **Mixed**: image plus HTML overlay box ("UP TO ₱5,000") and an invisible HTML click area over the drawn CTA | `assets/banner-welcome.png` · **1926×816 px** · PNG, opaque, 2.2 MB · ratio 2.360:1 · single source, no srcset | Home only |
| B1-S2…S4 | Home · hero carousel · slides 2–4 | same, `heroSlots` | **HTML placeholder** ("BANNER SLOT n — Banner artwork goes here") | none | Home only |
| B2 | Games · page hero ("Find Your Game" + search) | `ChoCho Games.dc.html`, first section | **HTML** + CSS gradients; decorative brand logo | logo only: `chocho-logo-cut.png` 1488×1600 (excluded as a brand logo) | — |
| B3 | Promotions · page hero ("Promotions & Rewards") | `ChoCho Promotions.dc.html`, first section | **HTML** + CSS; decorative brand logo | same logo | — |
| B4 | VIP · page hero ("ChoCho VIP" + Explore levels) | `ChoCho VIP.dc.html`, first section | **HTML** + CSS; decorative brand logo | same logo | — |

**Needs classification**
- **NC1: Sweet Bonanza game-detail preview.** `assets/game-sweet-bonanza.webp`, 412×412. This is game artwork used as a large media frame, not campaign art. Measured below because it is the largest image on a secondary page.
- **Home Quick Play tiles** (`qp-*.png`). These are category artwork, treated like game thumbnails, so they are excluded.
- **Home bonus cards** are HTML cards with small icons. Not banners.

## B. Responsive measurements

### B1: Home hero carousel (all 4 slides share one box)

**Rule summary (C)**
- **Box width** = `min(vw, 1024) − 2 × margin`.
  - `margin = clamp(16px, 2.4vw, 22px)`: 16px below 667px, fluid 667–916px, 22px from 917px.
  - Parent `max-width: 1024px`, so the box peaks at **980px** once the viewport is 1024px or wider.
- **Box height** is intrinsic to slide 1's image: `img { width: 100%; height: auto }`, so height = (box − 2) ÷ 2.3603 + 2.
  - Slides 2–4 are `position: absolute; inset: 0`, so **the whole carousel's height comes from slide 1's PNG**.
- **Other box styling:** `margin-top: −12px`, `border-radius: clamp(14px, 2.2vw, 20px)`, `overflow: hidden`, 1px border, `container-type: inline-size`.
  - The overlay type uses `cqw` units, so it scales with the box.
- **Only JS breakpoint: `innerWidth < 600`.**
  - Below 600, the arrows are removed and the dots move to a row **below** the banner.
  - At 600 and wider, arrows (40px, 14px from each edge) and dots (75×24, centred, 6px from the bottom) sit **inside** the banner.
- **Same image and crop at every width.** No mobile variant, no object-fit, no cropping.
- Session state and viewport height have no effect (M).

| Viewport (CSS px) · DPR 1.25 | Box W×H | Image W×H · ratio | Overlays inside the banner | Status |
|---|---|---|---|---|
| 320×900 | 288.0×122.9 | 286.4×121.3 · 2.360 | none (dots below) | M |
| 360×900 | 328.0×139.9 | 326.4×138.3 · 2.360 | none | M |
| 390×900 (guest, signed-in; also 390×600) | 358.4×152.8 | 356.8×151.2 · 2.360 | none | M |
| 430×900 | 398.4×169.7 | 396.8×168.1 · 2.360 | none | M |
| 599×900 | 567.2×241.2 | 565.6×239.6 · 2.360 | none | M |
| 600×900 | 568.0×241.6 | 566.4×240.0 · 2.360 | arrows at x 15 / 513, y 101; dots 75×24 at (247, 211) | M |
| 601×900 | 568.8×241.9 | 567.2×240.3 | as 600 | M |
| 666×900 | 634.4×269.7 | 632.8×268.1 | arrows, dots (280, 239) | M |
| 667×900 | 635.2×270.0 | 633.6×268.4 | same | M |
| 668×900 | 636.0×270.4 | 634.4×268.8 | same | M |
| 760 / 761×900 | 723.5×307.5 / 724.3×307.8 | 721.9×305.9 / 722.7×306.2 | dots (324–325, 277) | M |
| 768×900 | 731.2×310.7 | 729.5×309.1 | dots (328, 280) | M |
| 916 / 917 / 918×900 | 872.0×370.4 / 872.8×370.7 / 874.4×371.4 | 870.5×368.8 / 871.2×369.1 / 872.8×369.8 | arrows y 165; dots (399–400, 340–341) | M |
| 1023×900 | 979.2×415.8 | 977.6×414.2 | dots (452, 385) | M |
| 1024 / 1025 / 1280 / 1440 / 1920×900 (1280 also guest/signed-in, 1280×600) | **980.0×416.1** | **978.4×414.5** · 2.360 | arrows at x 15 / 925, y 188; dots 75×24 at (453, 385) | M |
| any, DPR 1 or 2 | max 980×416.4 | max **978×414.4** | — | C |

**HTML overlay box** ("UP TO ₱5,000")
- Position: left 7.6%, top 50.6%, size 43.2% × 17.6% of the box.
- Measured size: 123.7×21.4 at 320, and 422.7×73 at 1024 and wider.
- The ₱5,000 type is 4.4cqw: 12.6px at 320, 43.0px at 980 (M).

### B2: Games hero (HTML)
**Rules (C)**
- `innerWidth < 600`: margin 16px, padding 18/16px, title 28px, **logo hidden**.
- 600 and wider: margin 22px, padding 24/26px, logo shown at max 172px.
- Two flex columns (text `1 1 360px`, art `0 1 186px`) wrap according to content.
- Height depends entirely on content. Width follows the same `min(vw, 1024) − 2 × margin` rule as B1.

| Viewport | Box W×H | Logo | Layout | Status |
|---|---|---|---|---|
| 320 / 360 / 390 / 430 | 288 / 328 / 358.4 / 398.4 × **220.4** | hidden | single column | M |
| 599 | 567.2×199.4 | hidden | single column | M |
| 600–645 | 556.0–600.8 × **404.9** | 172×184.9 | logo wraps below the text | M |
| 650 | 606.4×260.5 | 172×184.9 | two columns (switch happens between 645 and 650) | M |
| 666 / 768 / 916 / 1023 | 622.4 / 724 / 872 / 979.2 × **260.5** | 172×184.9 | two columns | M |
| 1024–1920 | **980×260.5** | 172×184.9 | two columns | M |

### B3: Promotions hero (HTML) · B4: VIP hero (HTML)
**Rules (C)**
- No JS breakpoint.
- Margin is a fixed **22px** at every width, and padding is a fixed 18/26px.
- The logo is always shown (max 152px). Columns are `1 1 360px` and `0 1 168px`.
- The row forms when the inner width ≥ 530px, i.e. viewport ≥ 628px (C). **Confirmed: stacked at 627, row at 628** (M).
- The `@media (max-width: 760px)` rule on these pages hides VIP step connectors only. It doesn't affect the hero.

| Viewport | B3 box W×H | B4 box W×H | Status |
|---|---|---|---|
| 320 | 276×361.8 | 276×384.4 | M |
| 360 | 316×361.8 | 316×384.4 | M |
| 390 / 430 | 346.4 / 386.4 × 361.8 | 346.4 / 386.4 × 363.4 | M |
| 599 / 600 / 627 | 555.2 / 556 / 583.2 × 303.4 | 555.2 / 556 / 583.2 × 363.4 | M |
| 628 | 584×**225** | 584×**225** | M |
| 666 / 768 / 916 / 1023 | 622.4 / 724 / 872 / 979.2 × 225 | same | M |
| 1024–1920 | **980×225** | **980×225** | M |

The logo renders at 152×163.4 at every width (M).

### NC1: Sweet Bonanza game preview (needs classification)
**Rules (C)**
- `vw < 600`: a separate mobile component with a `16/9` frame.
- 600 and wider: a desktop component with a `16/10` frame inside a wrapping flex row.
- Both use `object-fit: cover` on the same 412×412 image.

**Measurements (M)**
- **Phones:** 288×162.7 at 320, 358.4×202.3 at 390, and 398×224.6 at 430–599 (capped).
- **600–768:** stays 16:10 (510.4×319.6 at 600, 678.4×424.6 at 768).
- **916:** 412×529.7 (0.78:1). In the row the frame stretches to the height of the column beside it, overriding the 16:10 ratio.
- **1024 and wider:** 466×414.7 (1.12:1).

## C. Specifications for the later artwork pass (R unless noted)

| ID / variant | Current ratio | Max display size and basis | Suggested export | Overlay / crop notes | Decision still needed |
|---|---|---|---|---|---|
| B1 slide art (slide 1 replacement and slides 2–4) | **2.360:1** fixed, intrinsic to slide 1's PNG (C/M) | **978×414 CSS px** image area (980×416 box). A proven CSS maximum from the `max-width: 1024px` parent (C, confirmed M at 1024–1920) | **1×: 978×414. 2×: 1956×829** (ratio 2.360). The current 1926×816 is 1.97× of the maximum: just short of 2×, adequate at DPR ≤ 1.97. DPR 3 phones need at most 3 × 567 ≈ 1701 px wide below 600, so they are already covered by the 2× file (C) | See the three risk notes below this table | (1) Keep one artwork for all widths, or approve a separate phone crop because of text legibility? (2) Keep drawn CTA/text in the image, or move it to HTML? (3) Currency in the art must be ₱ (see inconsistencies) |
| B1 slides 2–4 (current placeholders) | same box | same | same as above | No image rules exist yet for these slides. The art must match 2.360:1, or someone must decide how an off-ratio image is fitted. | Which campaigns fill slots 2–4? Is the slide count fixed at 4? |
| B2 / B3 / B4 page heroes | content-driven (0.72–3.76:1 measured) | 980 px wide; height varies | **No banner file needed** (C) | The only image is the brand logo. | Only if you later want artwork here: that would be a redesign, outside this report. |
| NC1 game preview | 16:9 (phones) / 16:10 nominal, stretched to 0.78–1.6:1 on desktop | 678×425 CSS px measured (768), 466×415 at ≥1024 | Game-art supply question, not banner production. It would need about 1356×850 for 2× at the measured maximum (R) | object-fit: cover crops the square source differently at every width. It is shown larger than its native 412 px from 430px up. | Is this game art or a campaign placement? Should the stretch in the desktop row be allowed? |

**B1 risk notes** (C, calculated from measured positions)
- **Arrows and dots at 600 and wider:**
  - The dots overlap the right end of the drawn "CLAIM YOUR BONUS NOW! »" button between about 600 and 900px. At 600 that's ~38×13px; at 980 it's only ~3px.
  - The right arrow touches the final "o" of the drawn ChoCho logo at 600–760px.
- **Areas to keep clear (R):**
  - Right and left 60px, from 40% to 60% of the height (arrows).
  - The centre 80px, from 88% of the height to the bottom (dots).
  - Below 600px nothing overlays the banner.
- **The HTML ₱5,000 box** covers the image region at 7.6–50.8% of the width and 50.6–68.2% of the height. Artwork must leave that pill area plain, or the overlay must be removed.
- **Text legibility:** at 320px the banner is 121px tall. The smallest drawn text (the feature lines, ~2% of image height) renders at roughly 2–3 CSS px, which is illegible.

## Summary
- **Unique placements:** 4 banner-like placements (B1–B4), of which **1 needs artwork** (B1, with 4 slides: 1 image, 3 placeholders). Plus 1 item needing classification (NC1).
- **Reused formats:** none reused across pages. B2, B3 and B4 share a visual style but have different sizing rules.
- **Desktop/mobile variants:** B1 uses **one image at every width** and has no mobile variant. Only its controls move below 600px. NC1 uses different components on phones and desktop, with the same image.
- **Files actually needed now:** the welcome art at 2.360:1 (2× = 1956×829), plus up to 3 more slides in the same format if slots 2–4 are to be filled.
- **Unresolved or not measured:**
  - DPR 2/3 and classic-scrollbar desktop widths (calculated only).
  - Visual confirmation of the overlap between the dots/arrows and the drawn art (the screenshot tool can't capture the slide image mid-transition).
  - Whether short desktop windows are a concern: with a short viewport, e.g. 909×540 (M), the fixed bottom nav and the support mascot cover the lower part of the banner. They are overlays, not sizing.

**Inconsistencies found (not fixed)**
1. The welcome art says **"5000 ₹" (rupee)**. It is hidden by the HTML "₱5,000" overlay, so any replacement art must use ₱ or the overlay will still be required.
2. **Mobile gutters differ between heroes:** Home and Games use 16px below 600, while Promotions and VIP keep 22px and full desktop padding. Games hides its logo on phones; Promotions and VIP do not.
3. **The carousel height depends on slide 1's file.** Replacing it with art of a different ratio changes the height of all four slides.
4. **The hero corner radius differs:** Home uses `clamp(14px, 2.2vw, 20px)`; Games, Promotions and VIP use a fixed 20px.
5. **NC1 ignores its 16:10 ratio** in the desktop row (0.78:1 at 916, 1.12:1 at 1024 and wider) and upscales a 412px source.
6. **The page switch points don't line up:** B1 changes controls at 600, B2 swaps its layout at 600 and forms its row at 645–650, and B3/B4 form their row at 628. Nothing shares a common breakpoint.
