/* Store Wizard: click Next until you have a ready-made store. */
(function () {
  const D = window.ECI_DATA, G = window.ECI_GEN, STORE = window.ECI_STORE;
  const KEY = "eci-store-wizard-v1";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const e = G.esc;

  const STEPS = [
    { id: "setup", title: "Setup" },
    { id: "product", title: "Product" },
    { id: "numbers", title: "Numbers" },
    { id: "score", title: "Score & margin" },
    { id: "brand", title: "Brand" },
    { id: "page", title: "Product page" },
    { id: "ads", title: "Ads" },
    { id: "launch", title: "Your store" },
  ];

  const DEFAULTS = {
    step: 0, maxStep: 0,
    country: "US", budget: 50, supplier: "AutoDS", stage: "no store yet",
    nicheId: "", ideaIdx: -1,
    productName: "", customer: "", problem: "", outcome: "", alternative: "",
    featuresText: "", boxText: "", howText: "", specs: "", risk: "",
    cost: "", compPrice: "", price: "", feePct: 2.9, feeFixed: 0.3, cpa: "", target: 10, evidence: "",
    scores: [6, 5, 5, 5, 5, 6, 7, 6], scoresTouched: false,
    brand: "", nameSeed: 1, palette: null, voice: [],
    shippingPolicy: "", guarantee: "30-day money-back guarantee. If it doesn't work for you, email us for a full refund.",
    email: "", businessAddress: "", imageUrl: "", freeShipping: true,
    checkoutUrl: "", checkoutLinks: ["", "", ""], checklist: {},
    discountCode: "WELCOME10", discountPct: 10,
  };

  let S = load();

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw)); } catch (_) { /* storage unavailable */ }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* ignore */ } }

  // ---------- derived view of the state for generators ----------
  function ctx() {
    const c = D.countries.find((x) => x.code === S.country) || D.countries[0];
    const niche = D.niches.find((n) => n.id === S.nicheId);
    const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
    return {
      ...S,
      symbol: c.symbol, currency: c.currency, countryName: c.name,
      niche, nicheLabel: niche ? niche.label : "",
      features: lines(S.featuresText), box: lines(S.boxText), how: lines(S.howText),
      cost: G.num(S.cost), compPrice: G.num(S.compPrice), price: G.num(S.price),
      feePct: G.num(S.feePct) ?? 2.9, feeFixed: G.num(S.feeFixed) ?? 0.3, cpa: G.num(S.cpa), target: G.num(S.target) ?? 10,
      palette: S.palette || (niche ? niche.palette : { main: "#2F5D50", accent: "#F2A541", n1: "#FAF7F2", n2: "#1E2522" }),
      voice: S.voice.length ? S.voice : (niche ? niche.voice : ["clear", "friendly", "honest"]),
      nameIdeas: G.brandNames(niche, S.nameSeed),
      shipShort: "Tracked shipping",
      guaranteeShort: (S.guarantee || "Money-back guarantee").split(".")[0],
    };
  }

  // ---------- validation ----------
  function problems(step) {
    const c = ctx();
    if (step === 1 && !c.productName.trim()) return "Pick a starter idea or type your own product name.";
    if (step === 1 && !c.customer.trim()) return "Say who the customer is.";
    if (step === 2 && (c.cost == null || c.cost <= 0)) return "Enter your supplier cost including shipping (ask the supplier for a quote).";
    if (step === 2 && (c.price == null || c.price <= 0)) return "Enter the price you'll sell at.";
    if (step === 4 && !c.brand.trim()) return "Pick a brand name or type one.";
    return "";
  }

  // ---------- step renderers ----------
  const R = {};

  R.setup = () => `
    <h1>Let's build your store</h1>
    <p class="muted">Answer a few questions per screen, press <b>Next</b>, and at the end you'll download a ready-made store: a live product page, Shopify import file, ads, emails and a launch checklist.</p>
    <div class="callout">This tool helps you judge evidence and build fast. It can't promise a product will sell. Only real numbers from your supplier and your market make the score meaningful.</div>
    <div class="grid2">
      <div class="field"><label>Where will you sell?</label>
        <select data-k="country">${D.countries.map((c) => `<option value="${c.code}" ${c.code === S.country ? "selected" : ""}>${c.name} (${c.currency})</option>`).join("")}</select></div>
      <div class="field"><label>Daily ad test budget</label><input type="number" min="0" data-k="budget" value="${e(S.budget)}"><div class="hint">Creators test at 30–100 per day.</div></div>
      <div class="field"><label>Supplier setup</label>
        <select data-k="supplier">${D.suppliers.map((x) => `<option ${x === S.supplier ? "selected" : ""}>${x}</option>`).join("")}</select>
        <div class="hint">Start on an app (AutoDS, CJ, Zendrop), move to a private agent at ~10–20 orders/day.</div></div>
      <div class="field"><label>Where are you now?</label>
        <select data-k="stage">${["no store yet", "store open, no sales", "first product live", "already selling daily"].map((x) => `<option ${x === S.stage ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    </div>`;

  R.product = () => {
    const niche = D.niches.find((n) => n.id === S.nicheId);
    return `
    <h1>Pick a product to test</h1>
    <p class="muted">Choose a niche, then a starter idea, or type your own product. Everything stays editable.</p>
    <div class="grid3" style="margin-bottom:16px">${D.niches.map((n) => `<button type="button" class="tile ${n.id === S.nicheId ? "selected" : ""}" data-niche="${n.id}"><div class="emoji">${n.emoji}</div><b>${e(n.label)}</b></button>`).join("")}</div>
    ${niche ? `<h2>Starter ideas in ${e(niche.label)}</h2>
      <div class="grid2" style="margin-bottom:8px">${niche.ideas.map((it, i) => `<button type="button" class="tile ${i === S.ideaIdx ? "selected" : ""}" data-idea="${i}"><b>${e(it.name)}</b><div class="hint">${e(it.customer)}</div></button>`).join("")}
      <button type="button" class="tile ${S.ideaIdx === -2 ? "selected" : ""}" data-idea="-2"><b>✍️ My own product</b><div class="hint">Start from a blank form</div></button></div>
      <p class="hint">Starter ideas are leads to research, not proven winners. Check the Meta Ad Library (ads running 7+ days), Amazon "bought in past month" and TikTok Shop best-sellers before you commit.</p>` : ""}
    ${S.risk ? `<div class="callout"><b>Watch out:</b> ${e(S.risk)}</div>` : ""}
    <div class="grid2">
      <div class="field"><label>Product name</label><input type="text" data-k="productName" value="${e(S.productName)}" placeholder="e.g. Reusable pet hair roller"></div>
      <div class="field"><label>Who is it for?</label><input type="text" data-k="customer" value="${e(S.customer)}" placeholder="e.g. dog owners in the US, 28–45"></div>
      <div class="field"><label>The problem they have</label><input type="text" data-k="problem" value="${e(S.problem)}"></div>
      <div class="field"><label>The outcome they want</label><input type="text" data-k="outcome" value="${e(S.outcome)}"></div>
      <div class="field"><label>Key features <small>(one per line)</small></label><textarea data-k="featuresText">${e(S.featuresText)}</textarea></div>
      <div class="field"><label>How it works <small>(3 steps, one per line)</small></label><textarea data-k="howText">${e(S.howText)}</textarea></div>
      <div class="field"><label>What's in the box <small>(one per line)</small></label><textarea data-k="boxText">${e(S.boxText)}</textarea></div>
      <div class="field"><label>Specs <small>(from the supplier listing)</small></label><textarea data-k="specs" placeholder="Size, material, weight… only facts you checked">${e(S.specs)}</textarea></div>
    </div>`;
  };

  R.numbers = () => {
    const c = ctx();
    return `
    <h1>Bring your evidence and numbers</h1>
    <p class="muted">Claude, or any tool, can't see which products make money. These numbers decide whether the product can survive paid ads.</p>
    <div class="grid2">
      <div class="field"><label>Supplier cost incl. shipping (${e(c.symbol.trim())})</label><input type="number" step="0.01" min="0" data-k="cost" value="${e(S.cost)}" placeholder="e.g. 4.20"><div class="hint">From your supplier app or agent quote.</div></div>
      <div class="field"><label>What competitors charge (${e(c.symbol.trim())})</label><input type="number" step="0.01" min="0" data-k="compPrice" value="${e(S.compPrice)}" placeholder="e.g. 24.99"></div>
      <div class="field"><label>Your selling price (${e(c.symbol.trim())})</label><input type="number" step="0.01" min="0" data-k="price" value="${e(S.price)}"><div class="hint">Aim for at least 3× your cost. <button type="button" class="chip copy-btn" id="suggest-price">Suggest</button></div></div>
      <div class="field"><label>Target profit per order (${e(c.symbol.trim())})</label><input type="number" step="0.01" min="0" data-k="target" value="${e(S.target)}"></div>
      <div class="field"><label>Payment fees</label><div class="grid2"><input type="number" step="0.1" data-k="feePct" value="${e(S.feePct)}" aria-label="Percent fee"><input type="number" step="0.01" data-k="feeFixed" value="${e(S.feeFixed)}" aria-label="Fixed fee"></div><div class="hint">% + fixed per order (e.g. 2.9% + 0.30)</div></div>
      <div class="field"><label>Expected cost per purchase from ads <small>(optional)</small></label><input type="number" step="0.01" min="0" data-k="cpa" value="${e(S.cpa)}" placeholder="blank = assume 35% of price"></div>
    </div>
    <div class="field"><label>Evidence it sells</label><textarea data-k="evidence" placeholder="e.g. 3 stores running the same ad 45+ days in Meta Ad Library; Amazon shows 10K+ bought last month">${e(S.evidence)}</textarea>
      <div class="hint">Leave blank only if you accept the score will be a guess.</div></div>`;
  };

  R.score = () => {
    const c = ctx();
    return `
    <h1>Score & margin check</h1>
    <p class="muted">8 fixed criteria, each 1–10. The verdict is only <b>TEST</b> at 56+/80 and markup room ≥ 6. Sliders start from your numbers, so adjust them honestly.</p>
    <div>${D.scoreCriteria.map((cr, i) => `<div class="score-row"><span>${i + 1}. ${e(cr)}</span><input type="range" min="1" max="10" data-score="${i}" value="${S.scores[i]}" aria-label="${e(cr)}"><b id="sv-${i}">${S.scores[i]}</b></div>`).join("")}</div>
    <div id="score-out"></div>
    <h2 style="margin-top:20px">Margin per order</h2>
    <div id="margin-out"></div>
    <h2 style="margin-top:20px">Bundle offer</h2>
    <div id="tiers-out"></div>
    ${c.evidence ? "" : `<div class="callout bad">You didn't add any evidence of demand. Treat criterion 5 as unknown and look in the Ad Library before spending.</div>`}`;
  };

  R.brand = () => {
    const c = ctx();
    const names = c.nameIdeas;
    return `
    <h1>Create the brand</h1>
    <p class="muted">A real brand makes cheap ads convert better than a store named after the product. Names are short and not tied to one product so you can add more later.</p>
    <div class="field"><label>Pick a name</label><div class="chips">${names.map((n) => `<button type="button" class="chip ${n === S.brand ? "selected" : ""}" data-name="${e(n)}">${e(n)}</button>`).join("")}
      <button type="button" class="chip" id="more-names">↻ More names</button></div></div>
    <div class="field"><label>Or type your own</label><input type="text" data-k="brand" value="${e(S.brand)}" placeholder="5–10 letters, easy to spell"></div>
    <div class="callout">Before buying a domain, search the trademark database for your market (USPTO / UKIPO / EUIPO) and check the .com. This wizard can't check them live.</div>
    <div class="field"><label>Colours</label><div class="swatches">${[["main", "Main"], ["accent", "Accent"], ["n1", "Light"], ["n2", "Dark"]].map(([k, l]) => `<div class="swatch"><input type="color" data-pal="${k}" value="${c.palette[k]}"><span>${l}</span></div>`).join("")}</div></div>
    <div class="field"><label>Voice <small>(3 words)</small></label><input type="text" id="voice" value="${e(c.voice.join(", "))}"></div>
    <div class="field"><label>Brand promise</label><p>${e(G.brandPromise(c))}</p></div>`;
  };

  R.page = () => {
    const c = ctx();
    const p = G.page(c);
    return `
    <h1>Your product page</h1>
    <p class="muted">Written from your answers. Fill in your real policies; they appear on the page, in the FAQ and in the footer.</p>
    <div class="grid2">
      <div class="field"><label>Product photo URL <small>(optional)</small></label><input type="url" data-k="imageUrl" value="${e(S.imageUrl)}" placeholder="https://…/photo.jpg"><div class="hint">Use your own or supplier-licensed photos, never a competitor's.</div></div>
      <div class="field"><label>Support email</label><input type="email" data-k="email" value="${e(S.email)}" placeholder="support@yourbrand.com"></div>
      <div class="field"><label>Shipping policy (real times from your supplier)</label><textarea data-k="shippingPolicy" placeholder="${e(p.ship)}">${e(S.shippingPolicy)}</textarea></div>
      <div class="field"><label>Guarantee / refund policy</label><textarea data-k="guarantee">${e(S.guarantee)}</textarea></div>
    </div>
    <div class="card" style="box-shadow:none;background:var(--surface-2)" id="page-out">${pagePreview(p, c)}</div>
    <div class="callout">Read it out loud before publishing and cut anything that sounds machine-written. No fake reviews, fake scarcity or health claims were added, so keep it that way.</div>`;
  };

  function pagePreview(p, c) {
    return `<h2>${e(p.headline)}</h2><p>${e(p.sub)}</p><ul>${p.benefits.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
      <p><b>Offer:</b> ${p.tiers.map((t) => `${e(t.label)} ${G.money(t.price, c.symbol)}`).join(" · ")}</p>
      <p><b>How it works:</b> ${p.how.map((h, i) => `${i + 1}. ${e(h)}`).join(" ")}</p><p>${e(p.problem)}</p>
      <details><summary><b>6 FAQs</b></summary>${p.faqs.map(([q, a]) => `<p><b>${e(q)}</b><br>${e(a)}</p>`).join("")}</details>
      <p class="hint">SEO title: ${e(p.seoTitle)}<br>Meta description: ${e(p.seoDesc)}</p>`;
  }

  R.ads = () => {
    const c = ctx();
    const ads = G.ads(c);
    return `
    <h1>Your first 6 ads</h1>
    <p class="muted">Static image ads: cheap to make and quick to test. Paste each image prompt into Gemini (Nano Banana) or Higgsfield with your real product photo as the reference.</p>
    <div class="callout good"><b>Test first:</b> 1 (problem → solution), 2 (before → after) and 5 (offer-led). They cover pain, proof of result and price. Run them in one ad set: Sales objective, optimised for purchases, broad targeting, ${e(c.symbol)}${e(c.budget || 30)}/day.</div>
    ${ads.map((a, i) => `<div class="ad"><h3><span>${i + 1}. ${e(a.angle)}</span><button type="button" class="chip copy-btn" data-copy="ad-${i}">Copy</button></h3>
      <p><b>On image:</b> ${e(a.head)}, <span class="muted">${e(a.support)}</span></p>
      <p><b>Primary text:</b><br>${e(a.primary).replace(/\n/g, "<br>")}</p>
      <p><b>Headline:</b> ${e(a.below)}</p>
      <pre id="ad-${i}">${e(a.image)}</pre></div>`).join("")}`;
  };

  R.launch = () => {
    const c = ctx();
    const sc = G.score(S.scores);
    return `
    <h1>🎉 Your store is ready</h1>
    <p class="muted">Below is your live store. Connect checkout, tick the launch checklist and download everything.</p>
    ${sc.verdict === "SKIP" ? `<div class="callout bad">Your product scored <b>${sc.total}/80 (SKIP)</b>. You can still download the store, but the honest advice is to go back and try another product before spending on ads.</div>` : ""}
    <div class="grid2">
      <div class="field"><label>Checkout link (all bundles)</label><input type="url" data-k="checkoutUrl" value="${e(S.checkoutUrl)}" placeholder="Shopify cart link or Stripe Payment Link"><div class="hint">Or one link per bundle below. Shopify: Products → … → "Create checkout link".</div></div>
      <div class="field"><label>Per-bundle links <small>(optional)</small></label>${[0, 1, 2].map((i) => `<input type="url" data-link="${i}" value="${e(S.checkoutLinks[i] || "")}" placeholder="${i + 1} pack link" style="margin-bottom:6px">`).join("")}</div>
    </div>
    <h2>Download</h2>
    <div class="downloads">
      <button type="button" class="primary" data-dl="zip">⬇ Everything (.zip)</button>
      <button type="button" class="secondary" data-dl="store">Store page (index.html)</button>
      <button type="button" class="secondary" data-dl="csv">Shopify import (.csv)</button>
      <button type="button" class="secondary" data-dl="report">Launch pack (.md)</button>
      <button type="button" class="secondary" data-dl="emails">Email flows (.md)</button>
      <button type="button" class="secondary" data-dl="json">Agent input (store.json)</button>
    </div>
    <details><summary><b>How to go live (pick one)</b></summary>
      <ol>
        <li><b>Shopify (recommended):</b> Products → Import → upload <code>shopify-products.csv</code>. The product arrives as a draft with 3 bundle variants, so add photos, then publish.</li>
        <li><b>Instant site:</b> drag the unzipped folder onto <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a>, paste a Stripe Payment Link above, and you're live.</li>
        <li><b>Let the agent do it:</b> run <code>python agent/store_agent.py --from store.json --shopify</code> to have Claude polish the copy and create the draft product in your Shopify store.</li>
      </ol></details>
    <h2 style="margin-top:18px">Launch checklist</h2>
    <div class="checklist">${D.launchChecklist.map((t, i) => `<label><input type="checkbox" data-check="${i}" ${S.checklist[i] ? "checked" : ""}> ${e(t)}</label>`).join("")}</div>
    <h2 style="margin-top:18px">Live preview</h2>
    <iframe class="preview" id="preview" title="Store preview"></iframe>`;
  };

  // ---------- live parts ----------
  function liveScore() {
    const c = ctx();
    const sc = G.score(S.scores);
    const cls = sc.verdict === "TEST" ? "good" : sc.verdict === "MAYBE" ? "warn" : "bad";
    const o = $("#score-out");
    if (o) o.innerHTML = `<div class="kpis"><div class="kpi"><div class="v">${sc.total}/80</div><div class="l">Total score</div></div>
      <div class="kpi"><div class="v"><span class="badge ${cls}">${sc.verdict}</span></div><div class="l">Verdict</div></div>
      <div class="kpi"><div class="v" style="font-size:.95rem">${e(D.scoreCriteria[sc.weakest])}</div><div class="l">Biggest risk</div></div></div>`;
    const m = G.margin(c);
    const mo = $("#margin-out");
    if (mo) {
      if (!m) { mo.innerHTML = `<p class="muted">Enter cost and price on the previous step.</p>`; }
      else {
        const roasCls = m.beRoas <= 2 ? "good" : m.beRoas <= 2.5 ? "warn" : "bad";
        mo.innerHTML = `<div class="kpis">
          <div class="kpi"><div class="v">${G.money(m.gross, c.symbol)}</div><div class="l">Gross margin (${(m.grossPct * 100).toFixed(0)}%)</div></div>
          <div class="kpi"><div class="v">${G.money(m.profit, c.symbol)}</div><div class="l">Profit after ads${m.cpaAssumed ? " (CPA assumed 35%)" : ""}</div></div>
          <div class="kpi"><div class="v"><span class="badge ${roasCls}">${Number.isFinite(m.beRoas) ? m.beRoas.toFixed(2) : "∞"}</span></div><div class="l">Break-even ROAS</div></div>
          <div class="kpi"><div class="v">${G.money(m.maxCpa, c.symbol)}</div><div class="l">Max cost/purchase for ${G.money(m.target, c.symbol)} profit</div></div></div>
          ${m.beRoas > 2.5 ? `<div class="callout bad">Break-even ROAS above 2.5 is hard on Meta. Raise the price, push the bundle, or skip this product.</div>` : `<div class="callout good">Margin can survive paid ads. Kill an ad set that spends ${G.money(m.gross * 1.5, c.symbol)}–${G.money(m.gross * 2, c.symbol)} without a sale.</div>`}`;
      }
    }
    const to = $("#tiers-out");
    if (to) {
      const tiers = G.offerTiers(c.price, c.cost, c.feePct, c.feeFixed);
      to.innerHTML = tiers.length ? `<div class="kpis">${tiers.map((t) => `<div class="kpi"><div class="v">${G.money(t.price, c.symbol)}</div><div class="l">${e(t.label)}, margin before ads ${G.money(t.gross, c.symbol)}${t.save ? `, saves ${G.money(t.save, c.symbol)}` : ""}</div></div>`).join("")}</div>` : "";
    }
    S.scores.forEach((v, i) => { const el = $("#sv-" + i); if (el) el.textContent = v; });
  }

  function livePage() { const c = ctx(); const o = $("#page-out"); if (o) o.innerHTML = pagePreview(G.page(c), c); }
  let previewTimer;
  function livePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { const f = $("#preview"); if (f) f.srcdoc = STORE.build(ctx()); }, 250);
  }

  function side() {
    const c = ctx();
    const sc = G.score(S.scores);
    const m = G.margin(c);
    $("#side").innerHTML = `<div class="card summary"><h3>Your store so far</h3><dl>
      <dt>Market</dt><dd>${e(c.countryName)}</dd>
      <dt>Product</dt><dd>${e(c.productName || "—")}</dd>
      <dt>Brand</dt><dd>${e(c.brand || "—")}</dd>
      <dt>Price</dt><dd>${G.money(c.price, c.symbol)}</dd>
      <dt>Score</dt><dd>${S.step >= 3 ? `${sc.total}/80 · ${sc.verdict}` : "—"}</dd>
      <dt>Profit/order</dt><dd>${m ? G.money(m.profit, c.symbol) : "—"}</dd></dl></div>
      <div class="card"><h3>Tip</h3><p class="muted" style="margin:0">${e(TIPS[S.step])}</p></div>`;
  }
  const TIPS = [
    "Make one Claude Project per store and paste the instructions from the download into it, so Claude remembers your store in every chat.",
    "Collect 5–10 candidates and score them one by one. Don't fall in love with the first idea.",
    "Davie Fogarty's rule: know your cost of goods and profit per unit before launch.",
    "A strict scorecard talks you out of weak products before you spend on ads.",
    "Save the brand book as a file in your Claude Project so every later step uses the same name and voice.",
    "Best pages use customers' own words. Copy 30–100 Amazon reviews (3–4 stars) and ask Claude to extract the language.",
    "Find a competitor's longest-running ad in the Ad Library and make 3 versions in your own words.",
    "Work on a duplicate theme or development store, never directly on your live theme.",
  ];

  // ---------- render ----------
  function render() {
    const st = STEPS[S.step];
    $("#step-view").innerHTML = R[st.id]();
    $("#stepper").innerHTML = STEPS.map((x, i) => `<button type="button" data-go="${i}" class="${i === S.step ? "active" : i <= S.maxStep ? "done" : ""}" ${i > S.maxStep ? "disabled" : ""}>${i + 1}. ${x.title}</button>`).join("");
    $("#btn-back").style.visibility = S.step === 0 ? "hidden" : "visible";
    $("#btn-next").textContent = S.step === STEPS.length - 1 ? "Download everything ⬇" : S.step === STEPS.length - 2 ? "Build my store →" : "Next →";
    $("#nav-hint").textContent = `Step ${S.step + 1} of ${STEPS.length}`;
    if (st.id === "score") liveScore();
    if (st.id === "launch") livePreview();
    side();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go(i) {
    S.step = Math.max(0, Math.min(STEPS.length - 1, i));
    S.maxStep = Math.max(S.maxStep, S.step);
    save(); render();
  }

  // ---------- events ----------
  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.k) {
      S[t.dataset.k] = t.value;
      if (["cost", "compPrice"].includes(t.dataset.k) && !S.scoresTouched) S.scores[3] = G.suggestMarkupScore(G.num(S.cost), G.num(S.compPrice));
      if (t.dataset.k === "evidence" && !S.scoresTouched) S.scores[4] = t.value.trim().length > 40 ? 7 : t.value.trim() ? 5 : 3;
    }
    if (t.dataset.score != null) { S.scores[+t.dataset.score] = +t.value; S.scoresTouched = true; liveScore(); }
    if (t.dataset.pal) { S.palette = Object.assign({}, ctx().palette, { [t.dataset.pal]: t.value }); }
    if (t.id === "voice") S.voice = t.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
    if (t.dataset.link != null) S.checkoutLinks[+t.dataset.link] = t.value;
    if (t.dataset.check != null) S.checklist[t.dataset.check] = t.checked;
    save(); side();
    const id = STEPS[S.step].id;
    if (id === "page") livePage();
    if (id === "launch") livePreview();
  });
  document.addEventListener("change", (ev) => { if (ev.target.dataset.check != null) { S.checklist[ev.target.dataset.check] = ev.target.checked; save(); } });

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.go != null) return go(+b.dataset.go);
    if (b.dataset.niche) {
      if (S.nicheId !== b.dataset.niche) { S.nicheId = b.dataset.niche; S.ideaIdx = -1; S.palette = null; S.voice = []; }
      save(); return render();
    }
    if (b.dataset.idea != null) {
      const i = +b.dataset.idea; S.ideaIdx = i;
      const niche = D.niches.find((n) => n.id === S.nicheId);
      if (i >= 0 && niche) {
        const it = niche.ideas[i];
        Object.assign(S, { productName: it.name, customer: it.customer, problem: it.problem, outcome: it.outcome, featuresText: it.features.join("\n"), boxText: it.box.join("\n"), howText: it.how.join("\n"), risk: it.risk });
      } else {
        Object.assign(S, { productName: "", customer: "", problem: "", outcome: "", featuresText: "", boxText: "", howText: "", risk: "" });
      }
      save(); return render();
    }
    if (b.dataset.name) { S.brand = b.dataset.name; save(); return render(); }
    if (b.id === "more-names") { S.nameSeed++; save(); return render(); }
    if (b.id === "suggest-price") {
      const c = ctx();
      const target = Math.max(c.cost ? c.cost * 3.5 : 0, c.compPrice ? c.compPrice * 0.95 : 0);
      if (target) { S.price = G.pretty(target).toFixed(2); save(); render(); }
      return;
    }
    if (b.dataset.copy) { copy($("#" + b.dataset.copy).textContent, b); return; }
    if (b.dataset.dl) return download(b.dataset.dl);
  });

  $("#btn-next").addEventListener("click", () => {
    const msg = problems(S.step);
    if (msg) { $("#nav-hint").textContent = "⚠ " + msg; $("#nav-hint").style.color = "var(--bad)"; return; }
    $("#nav-hint").style.color = "";
    if (S.step === STEPS.length - 1) return download("zip");
    if (S.step === 1 && !S.scoresTouched) prefillScores();
    go(S.step + 1);
  });
  $("#btn-back").addEventListener("click", () => go(S.step - 1));
  $("#btn-reset").addEventListener("click", () => {
    if (!confirm("Start over? This clears your answers.")) return;
    S = JSON.parse(JSON.stringify(DEFAULTS)); save(); render();
  });

  function prefillScores() {
    const c = ctx();
    S.scores[3] = G.suggestMarkupScore(c.cost, c.compPrice);
  }

  function copy(text, btn) {
    const done = () => { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = o), 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); else done();
  }

  // ---------- downloads ----------
  function files() {
    const c = ctx();
    const p = G.page(c);
    const sc = G.score(S.scores);
    const m = G.margin(c) || G.margin({ price: 1, cost: 0 });
    const ads = G.ads(c);
    const agentInput = {
      version: 1, generated_by: "ecom-creator-intel store wizard",
      market: { country: c.country, country_name: c.countryName, currency: c.currency },
      budget_per_day: G.num(c.budget), supplier: c.supplier, stage: c.stage,
      product: { name: c.productName, niche: c.nicheLabel, customer: c.customer, problem: c.problem, outcome: c.outcome, features: c.features, how_it_works: c.how, in_the_box: c.box, specs: c.specs, image_url: c.imageUrl },
      numbers: { supplier_cost: c.cost, competitor_price: c.compPrice, price: c.price, fee_pct: c.feePct, fee_fixed: c.feeFixed, cpa: c.cpa, target_profit: c.target },
      evidence: c.evidence, scores: S.scores, score_total: sc.total, verdict: sc.verdict,
      brand: { name: c.brand, palette: c.palette, voice: c.voice, other_names: c.nameIdeas },
      policies: { shipping: c.shippingPolicy, guarantee: c.guarantee, email: c.email },
      offer_tiers: p.tiers, page: p, ads,
    };
    return {
      "index.html": STORE.build(c),
      "shopify-products.csv": G.shopifyCsv(c, p),
      "launch-pack.md": G.reportMd(c, sc, m, p, ads),
      "brand-book.md": G.brandBook(c),
      "email-flows.md": G.emailsMd(c),
      "claude-project-instructions.md": G.projectInstructions(c),
      "store.json": JSON.stringify(agentInput, null, 2),
      "README.txt": `${c.brand} — generated by Store Wizard\n\nindex.html                 Your store page. Open it, or drag this folder onto https://app.netlify.com/drop\nshopify-products.csv       Shopify Admin → Products → Import (arrives as a draft with 3 bundle variants)\nlaunch-pack.md             Score, margin, offer, page copy, ads, checklist\nbrand-book.md              Name, colours, voice, customer. Add it to your Claude Project\nemail-flows.md             Welcome, abandoned checkout and browse flows\nclaude-project-instructions.md  Paste into your Claude Project instructions\nstore.json                 Input for the AI agent: python agent/store_agent.py --from store.json\n`,
    };
  }

  function saveBlob(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function download(kind) {
    const f = files();
    const base = G.slug(S.brand || "store");
    const map = { store: "index.html", csv: "shopify-products.csv", report: "launch-pack.md", emails: "email-flows.md", json: "store.json" };
    if (kind !== "zip") {
      const name = map[kind];
      const type = name.endsWith(".html") ? "text/html" : name.endsWith(".csv") ? "text/csv" : name.endsWith(".json") ? "application/json" : "text/markdown";
      return saveBlob(name === "index.html" ? `${base}-store.html` : name, new Blob([f[name]], { type: type + ";charset=utf-8" }));
    }
    const tree = {};
    Object.entries(f).forEach(([n, body]) => { tree[`${base}/${n}`] = body; });
    saveBlob(`${base}-store.zip`, G.zip(tree));
  }

  render();
})();
