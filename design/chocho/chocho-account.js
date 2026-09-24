/* Shared ChoCho account/bonus store.
   Single source of truth for the header dropdown, My Account -> Bonuses,
   the in-place bonuses drawer and the Wallet balance card.
   Load with <script src="chocho-account.js"></script> inside <helmet>. */
(function () {
  if (window.ChoChoAccount) return;

  var HIDE_KEY = "chocho:balanceHidden";

  function peso(n) {
    return "\u20B1" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* Values below stand in for the account/bonus service response. They are
     preview fixtures: nothing here is credited, and no claim is confirmed
     locally — Claim goes to the service and reports whatever it returns. */
  /* The one selected account fixture: header avatar, My Account and Wallet all read it. */
  var IDENTITY = {
    playerId: "CHO-4 820 117",
    displayName: "Jaypee R.",
    initials: "JR",
    firstName: "Jaypee",
    lastName: "Ramos"
  };

  var FIXTURE = {
    balances: { cash: 9480.5, bonus: 3000, total: 12480.5 },
    available: [
      {
        id: "weekend-reload",
        name: "Weekend Reload",
        reward: "50% deposit bonus, up to \u20B11,000",
        deadline: "Claim by 28 Sep 2026, 11:59 PM",
        conditions: "Deposit \u20B1500 or more. 20\u00D7 wagering on the bonus amount before withdrawal. Slots only.",
        terms: [
          "Minimum qualifying deposit: \u20B1500.",
          "Bonus is 50% of the qualifying deposit, capped at \u20B11,000.",
          "Wagering requirement: 20\u00D7 the bonus amount.",
          "Eligible games: slots. Live casino and Aviator do not contribute.",
          "One claim per player for this campaign."
        ],
        claimable: true
      },
      {
        id: "spins-drop",
        name: "Free Spins Drop",
        reward: "25 free spins on Sweet Bonanza",
        deadline: "Claim by 23 Sep 2026, 8:00 PM",
        conditions: "Spin value \u20B11. Winnings are paid as bonus credit with 15\u00D7 wagering.",
        terms: [
          "25 free spins, \u20B11 per spin, on Sweet Bonanza only.",
          "Spins expire 7 days after they are added to your account.",
          "Winnings are credited as bonus funds with 15\u00D7 wagering.",
          "Free spins cannot be combined with another active spins offer."
        ],
        claimable: true
      }
    ],
    active: [
      {
        id: "welcome",
        name: "Welcome Bonus",
        status: "active",
        statusLabel: "ACTIVE",
        reward: "\u20B11,500 bonus credit",
        remaining: "\u20B1820.00 of \u20B11,500.00 bonus credit remaining",
        expiry: "Expires 5 Oct 2026, 11:59 PM",
        progress: { done: 12400, target: 30000, meaning: "Wagering completed towards the 20\u00D7 requirement" },
        details: [
          "Wagering requirement: 20\u00D7 the \u20B11,500 bonus.",
          "Bonus funds are used after your cash balance is spent.",
          "Unspent bonus credit is removed at expiry."
        ]
      },
      {
        id: "midweek-cashback",
        name: "Midweek Cashback",
        status: "awaiting",
        statusLabel: "AWAITING ACTIVATION",
        reward: "\u20B1300 cashback",
        remaining: "",
        expiry: "Activation window closes 30 Sep 2026",
        details: [
          "Activates automatically on your next qualifying deposit.",
          "Cashback is paid as bonus credit with no wagering requirement."
        ]
      }
    ]
  };

  var listeners = [];
  var hidden = false;
  try { hidden = localStorage.getItem(HIDE_KEY) === "1"; } catch (e) {}

  function emit() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var api = {
    peso: peso,
    identity: IDENTITY,
    mask: "\u2022\u2022\u2022\u2022\u2022\u2022",
    isHidden: function () { return hidden; },
    setHidden: function (v) {
      hidden = !!v;
      try { localStorage.setItem(HIDE_KEY, hidden ? "1" : "0"); } catch (e) {}
      emit();
    },
    toggleHidden: function () { api.setHidden(!hidden); },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },
    /* Read the bonus snapshot. `state` lets a preview fixture ask for
       loading / empty / error instead of the loaded snapshot. */
    load: function (state) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (state === "error") { reject(new Error("bonus-service-unavailable")); return; }
          if (state === "empty") {
            resolve({ balances: { cash: FIXTURE.balances.cash, bonus: 0, total: FIXTURE.balances.cash }, available: [], active: [] });
            return;
          }
          resolve(JSON.parse(JSON.stringify(FIXTURE)));
        }, 650);
      });
    },
    /* Claim goes to the bonus service. No backend is connected in this
       prototype, so nothing is ever credited locally. `outcome` is a preview
       fixture switch for reviewing the response states. */
    claim: function (id, outcome) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          if (outcome === "active") resolve({ ok: true, status: "active", message: "" });
          else if (outcome === "awaiting") resolve({ ok: true, status: "awaiting", message: "Claimed. This bonus activates on your next qualifying deposit." });
          else if (outcome === "expired") resolve({ ok: false, code: "expired", message: "This offer expired before the claim went through. It is no longer available." });
          else if (outcome === "already") resolve({ ok: false, code: "already", message: "This bonus was already claimed on your account." });
          else if (outcome === "ineligible") resolve({ ok: false, code: "ineligible", message: "Your account is no longer eligible for this offer." });
          else if (outcome === "timeout") resolve({ ok: false, code: "timeout", message: "We couldn\u2019t confirm this claim. We\u2019re checking its status \u2014 don\u2019t claim again yet." });
          else resolve({ ok: false, code: "not-connected", message: "The bonus service isn\u2019t connected yet, so this claim couldn\u2019t be submitted. Nothing has been credited." });
        }, 1100);
      });
    },
    clear: function () { emit(); }
  };

  window.ChoChoAccount = api;
  window.dispatchEvent(new CustomEvent("chocho:account-ready"));
})();
