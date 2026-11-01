/* Pure functions that turn wizard answers into store content.
 * Everything here is deterministic and offline. It never invents reviews,
 * sales numbers, certifications or health claims.
 */
(function () {
  const G = {};

  // ---------- helpers ----------
  G.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  G.num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
  G.money = (v, sym = "$") => (v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "-" : "") + sym + Math.abs(v).toFixed(2));
  G.pretty = (x) => Math.max(0.99, Math.ceil(x) - 0.01); // 37.2 -> 37.99
  G.cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  G.slug = (s) => String(s || "product").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";
  G.words = (s, n) => String(s || "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
  G.hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  G.rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---------- Step 2: score ----------
  G.score = (scores) => {
    const total = scores.reduce((a, b) => a + (Number(b) || 0), 0);
    const markup = Number(scores[3]) || 0;
    let verdict = "SKIP";
    if (total >= 56 && markup >= 6) verdict = "TEST";
    else if (total >= 44) verdict = "MAYBE";
    let low = 0; scores.forEach((s, i) => { if ((Number(s) || 0) < (Number(scores[low]) || 0)) low = i; });
    return { total, verdict, weakest: low };
  };

  // Rough starting scores from the numbers the user gave (they can override every slider).
  G.suggestMarkupScore = (cost, compPrice) => {
    if (!cost || !compPrice) return 5;
    const m = compPrice / cost;
    if (m >= 5) return 9; if (m >= 4) return 8; if (m >= 3) return 7; if (m >= 2.5) return 5; if (m >= 2) return 4; return 2;
  };

  // ---------- Step 2: margin ----------
  G.margin = ({ price, cost, feePct = 2.9, feeFixed = 0.3, cpa, target = 10 }) => {
    if (!price || cost == null) return null;
    const cpaUsed = cpa != null ? cpa : price * 0.35;
    const fees = price * (feePct / 100) + feeFixed;
    const gross = price - cost - fees;
    const profit = gross - cpaUsed;
    const beRoas = gross > 0 ? price / gross : Infinity;
    const maxCpa = gross - target;
    return { price, cost, fees, gross, cpa: cpaUsed, cpaAssumed: cpa == null, profit, beRoas, maxCpa, target, grossPct: gross / price };
  };

  G.offerTiers = (price, cost, feePct = 2.9, feeFixed = 0.3) => {
    if (!price) return [];
    const mk = (qty, label, mult, note) => {
      const p = qty === 1 ? price : G.pretty(price * mult);
      const fees = p * (feePct / 100) + feeFixed;
      const gross = cost != null ? p - cost * qty - fees : null;
      return { qty, label, price: p, compareAt: qty === 1 ? null : +(price * qty).toFixed(2), save: qty === 1 ? 0 : +(price * qty - p).toFixed(2), gross, note };
    };
    return [
      mk(1, "1 pack", 1, "Try it"),
      mk(2, "2 pack", 1.5, "Most popular: one for you, one spare or gift"),
      mk(3, "3 pack", 1.875, "Best value"),
    ];
  };

  // ---------- Step 3: brand ----------
  const GENERIC = { pre: ["Vela", "Noro", "Kova", "Lumi", "Bria", "Oro", "Teva", "Mavi", "Sola", "Rivo"], suf: ["ly", "co", "ora", "io", "na", "en", "wa", "ra"] };
  G.brandNames = (niche, seed = 0, taken = []) => {
    const parts = niche?.nameParts || GENERIC;
    const pre = parts.pre.concat(GENERIC.pre), suf = parts.suf.concat(GENERIC.suf);
    const r = G.rng(seed + 7);
    const out = new Set();
    let guard = 0;
    while (out.size < 10 && guard++ < 500) {
      const a = pre[Math.floor(r() * pre.length)], b = suf[Math.floor(r() * suf.length)];
      let n = a + b;
      if (a.toLowerCase().endsWith(b[0])) n = a + b.slice(1);
      n = G.cap(n.toLowerCase());
      if (n.length >= 5 && n.length <= 10 && !taken.includes(n)) out.add(n);
    }
    return [...out];
  };

  G.brandPromise = (s) => `We help ${s.customer || "our customers"} get ${s.outcome || "a better everyday routine"}, without the hassle.`;
  G.pillars = (s) => ["Simple products that solve one real problem", "Honest descriptions and real policies", `Made for ${s.customer || "everyday life"}`];

  // ---------- Step 5: product page ----------
  G.page = (s) => {
    const cur = s.symbol || "$";
    const outcome = s.outcome || "an easier everyday routine";
    const headline = G.cap(G.words(outcome.split(/[,;:.]/)[0], 10));
    const sub = `${G.cap(s.productName || "Our product")}, made for ${s.customer || "you"}.`;
    const benefits = (s.features || []).slice(0, 4).map((f) => f.trim()).filter(Boolean);
    while (benefits.length < 4) benefits.push(["Simple to use from day one", "Built for everyday use", "Easy to clean and store", "Backed by our guarantee"][benefits.length]);
    const tiers = G.offerTiers(s.price, s.cost, s.feePct, s.feeFixed);
    const how = (s.how && s.how.length ? s.how : ["Unbox it", "Use it", "Enjoy the result"]).slice(0, 3);
    const problem = `Sound familiar? ${G.cap(s.problem || "the everyday version of this problem wastes your time")}. ${G.cap(s.productName || "This")} is built to fix exactly that, so you get ${outcome}.`;
    const ship = s.shippingPolicy || `Orders ship within 1–3 business days. Delivery usually takes [X–Y] business days to ${s.countryName || "your country"}.`;
    const guarantee = s.guarantee || "30-day money-back guarantee. If it doesn't work for you, contact us for a refund.";
    const faqs = [
      ["How long does shipping take?", ship],
      ["What if it doesn't work for me?", guarantee],
      ["What's in the box?", (s.box && s.box.length ? s.box.join(", ") : "See the list above") + "."],
      ["How do I use it?", how.map((h, i) => `${i + 1}. ${h}`).join(" ")],
      [`Is it right for ${s.customer ? "me" : "everyone"}?`, `It's made for ${s.customer || "everyday use"}. If you're not sure, email us at ${s.email || "[your support email]"} before you order and we'll answer honestly.`],
      ["How do I contact you?", `Email ${s.email || "[your support email]"}. We reply within 1 business day.`],
    ];
    const seoTitle = `${s.productName || "Product"} | ${s.brand || "Store"}`.slice(0, 60);
    const seoDesc = `${G.cap(outcome)}. ${benefits[0]}. ${guarantee.split(".")[0]}.`.slice(0, 155);
    return { headline, sub, benefits, tiers, how, problem, box: s.box || [], specs: s.specs || "", faqs, ship, guarantee, seoTitle, seoDesc, cur };
  };

  G.pageHtmlBody = (s, p) => {
    const li = (a) => a.map((x) => `<li>${G.esc(x)}</li>`).join("");
    return [
      `<h2>${G.esc(p.headline)}</h2>`, `<p>${G.esc(p.sub)}</p>`,
      `<ul>${li(p.benefits)}</ul>`,
      `<h3>How it works</h3><ol>${li(p.how)}</ol>`,
      `<p>${G.esc(p.problem)}</p>`,
      p.box.length ? `<h3>What's in the box</h3><ul>${li(p.box)}</ul>` : "",
      p.specs ? `<h3>Specs</h3><p>${G.esc(p.specs)}</p>` : "",
      `<h3>FAQ</h3>${p.faqs.map(([q, a]) => `<p><strong>${G.esc(q)}</strong><br>${G.esc(a)}</p>`).join("")}`,
      `<p><em>${G.esc(p.guarantee)}</em></p>`,
    ].join("\n");
  };

  // ---------- Step 6: ads ----------
  G.ads = (s) => {
    const prod = s.productName || "the product";
    const brand = s.brand || "our brand";
    const pal = s.palette || {};
    const refNote = "Upload your real product photo as the reference image so the ad shows exactly what customers receive. Leave clean empty space for the headline and add the text afterwards in Canva (image generators still garble text).";
    const base = (scene) => `${scene} Brand colours: ${pal.main || ""} and ${pal.accent || ""}. Natural light, realistic phone-camera look, 4:5 for feed and 9:16 for story. ${refNote}`;
    const prob = G.cap(G.words(s.problem || "the problem", 8));
    const out = G.cap(G.words(s.outcome || "the result you want", 6));
    const tier2 = G.offerTiers(s.price, s.cost)[1];
    return [
      { angle: "Problem → solution", head: G.words(`Tired of ${s.problem || "this"}?`, 6), support: `${G.cap(prod)} fixes it in minutes.`,
        primary: `${prob}?\nThere's an easier way.\n${G.cap(prod)}, from ${brand}.`, below: `${out}`,
        image: base(`Split moment: on the left the everyday problem (${s.problem || "the problem"}), on the right the same scene solved with ${prod} in hand. Top third left empty for the headline.`) },
      { angle: "Before → after outcome", head: G.words(out, 6), support: "Same space. Two minutes later.",
        primary: `Before: ${s.problem || "the mess"}.\nAfter: ${s.outcome || "sorted"}.\nThat's it.`, below: `See how ${prod} works`,
        image: base(`Before/after diptych of the same spot in a real home, identical camera angle, the "after" frame showing ${prod} next to the clean result.`) },
      { angle: "Us vs them comparison", head: "The old way vs the easy way", support: "Why people are switching.",
        primary: `Old way: ${s.alternative || "the usual fix that doesn't last"}.\nNew way: ${prod}.\n${(s.features || [])[0] || "Simple to use"}.`, below: `Switch to ${brand}`,
        image: base(`Two-column comparison flat lay: left side the common alternative looking tired, right side ${prod} looking clean and premium. Small icon-style check marks area left blank for text.`) },
      { angle: "Social-proof style (no invented quotes)", head: `Made for ${G.words(s.customer || "you", 3)}`, support: "Built around what customers ask for.",
        primary: `If you're one of the ${s.customer || "people who need this"}, this was built for you.\n${(s.features || []).slice(0, 2).join(". ")}.`, below: `Shop ${brand}`,
        image: base(`Lifestyle shot of a real-looking customer (${s.customer || "target customer"}) using ${prod} at home, candid, slightly imperfect framing like a UGC photo. Do not add any review text or star ratings.`) },
      { angle: "Offer-led", head: tier2 ? `Get 2 for ${G.money(tier2.price, s.symbol)}` : "Bundle and save", support: tier2 ? `Save ${G.money(tier2.save, s.symbol)} on the 2 pack.` : "Better value on multi-packs.",
        primary: `One for you, one spare.\n${tier2 ? `2 pack for ${G.money(tier2.price, s.symbol)}.` : "Multi-pack pricing on our site."}\n${s.guarantee ? s.guarantee.split(".")[0] + "." : ""}`, below: "Shop the bundle",
        image: base(`Clean studio product shot of two units of ${prod} side by side on a plain ${pal.n1 || "light"} background, generous empty space on the right for the offer text.`) },
      { angle: "Curiosity hook", head: "Why didn't anyone tell me?", support: `The ${G.words(prod, 4)} people keep asking about.`,
        primary: `This small thing changed how I deal with ${G.words(s.problem || "it", 6)}.\nHere's how it works →`, below: `How it works`,
        image: base(`Close-up, slightly top-down shot of hands using ${prod} mid-action, motion blur on the moving part, intriguing crop that makes you want to see more.`) },
    ];
  };

  // ---------- Level up: emails ----------
  G.emails = (s) => {
    const b = s.brand || "our store", code = s.discountCode || "WELCOME10", pct = s.discountPct || 10;
    return [
      { flow: "Welcome", when: "1 minute after signup", subject: `Welcome to ${b} — here's ${pct}% off`, preview: `Your code: ${code}`, body: `Thanks for joining ${b}. We make ${s.productName || "simple products"} for ${s.customer || "people like you"}.\n\nHere's ${pct}% off your first order: ${code}`, cta: "Shop now" },
      { flow: "Welcome", when: "1 day later", subject: `Your ${pct}% code is still waiting`, preview: "In case you missed it", body: `Quick reminder: ${code} gives you ${pct}% off.\n\n${G.cap(s.outcome || "")}.`, cta: "Use my code" },
      { flow: "Welcome", when: "4 days later", subject: "Your code expires soon", preview: `Last chance to use ${code}`, body: `Your welcome code ${code} expires soon. After that it's gone.\n\n${s.guarantee || ""}`, cta: "Use it before it expires" },
      { flow: "Abandoned checkout", when: "1 hour after", subject: "You left something behind", preview: "Your cart is saved", body: `Your ${s.productName || "order"} is still in your cart.\n\nQuestions? Just reply to this email.`, cta: "Return to cart" },
      { flow: "Abandoned checkout", when: "12 hours later", subject: "Any questions before you order?", preview: "We're happy to help", body: `Not sure yet? Here's what people usually ask:\n• Shipping: ${s.shippingPolicy || "see our shipping page"}\n• Returns: ${s.guarantee || "see our refund page"}`, cta: "Complete my order" },
      { flow: "Abandoned checkout", when: "12 hours after that", subject: `${pct}% off to finish your order`, preview: `Code ${code} inside`, body: `Here's ${pct}% off to finish your order: ${code}.`, cta: "Finish checkout" },
      { flow: "Browse abandonment", when: "2 hours after viewing", subject: `Still thinking about ${s.productName || "it"}?`, preview: "Here's how it works", body: (s.how || []).map((h, i) => `${i + 1}. ${h}`).join("\n"), cta: "Take another look" },
    ];
  };

  // ---------- Files ----------
  G.projectInstructions = (s) => `You are the operating partner for my online store. Here is the context to use in every answer:
- Store: ${s.brand || "not named yet"}, selling to ${s.countryName || "[COUNTRY]"}
- Stage: ${s.stage || "no store yet"}
- Budget for testing ads: ${s.symbol}${s.budget || "[AMOUNT]"} per day
- Supplier setup: ${s.supplier || "not chosen"}
- Product: ${s.productName || "[PRODUCT]"} (cost ${G.money(s.cost, s.symbol)}, price ${G.money(s.price, s.symbol)})
- What I care about: profit after ad costs, not revenue
How to work with me:
- Be direct. If an idea is weak, say so and say why.
- Show numbers when a decision depends on them, and state any number you had to assume.
- Never invent reviews, testimonials, certifications or medical claims.
- When I give you a competitor's page or ad, learn from its structure and angles but write everything in new words.
`;

  G.brandBook = (s) => `# ${s.brand} — brand book

**Promise:** ${G.brandPromise(s)}

## Pillars
${G.pillars(s).map((p) => `- ${p}`).join("\n")}

## Voice
${(s.voice || []).join(", ")}
Example: "${G.cap(s.outcome || "")}. No fuss."

## Colours
- Main: ${s.palette.main}
- Accent: ${s.palette.accent}
- Neutral light: ${s.palette.n1}
- Neutral dark: ${s.palette.n2}

## Logo direction
Text-only wordmark "${s.brand}" in a clean geometric sans-serif, main colour on light backgrounds, light neutral on dark.

## Main customer
- Who: ${s.customer}
- What they're tired of: ${s.problem}
- What they want: ${s.outcome}

## Other name ideas
${(s.nameIdeas || []).join(", ")}

> Before buying a domain, search the trademark database for your market (USPTO, UKIPO, EUIPO) in the right class. This wizard can't check trademarks or domains.
`;

  G.reportMd = (s, sc, m, p, ads) => `# ${s.brand} — launch pack

## Product
- ${s.productName} for ${s.countryName}
- Evidence: ${s.evidence || "[none given — collect it before spending on ads]"}

## Scorecard: ${sc.total}/80 → ${sc.verdict}
${window.ECI_DATA.scoreCriteria.map((c, i) => `- ${c}: ${s.scores[i]}/10`).join("\n")}

## Margin (per order)
- Price ${G.money(m.price, s.symbol)}, cost ${G.money(m.cost, s.symbol)}, fees ${G.money(m.fees, s.symbol)}
- Gross margin ${G.money(m.gross, s.symbol)} (${(m.grossPct * 100).toFixed(0)}%)
- Cost per purchase ${G.money(m.cpa, s.symbol)}${m.cpaAssumed ? " [assumed: 35% of price]" : ""}
- Profit after ads ${G.money(m.profit, s.symbol)}
- Break-even ROAS ${Number.isFinite(m.beRoas) ? m.beRoas.toFixed(2) : "∞"}
- Max cost per purchase for ${G.money(m.target, s.symbol)} profit: ${G.money(m.maxCpa, s.symbol)}
- Kill rule: stop an ad set that spends ${G.money(m.gross * 1.5, s.symbol)}–${G.money(m.gross * 2, s.symbol)} without a sale.

## Offer
${p.tiers.map((t) => `- ${t.label}: ${G.money(t.price, s.symbol)}${t.gross != null ? ` (margin before ads ${G.money(t.gross, s.symbol)})` : ""}`).join("\n")}

## Product page
### ${p.headline}
${p.sub}

${p.benefits.map((b) => `- ${b}`).join("\n")}

**How it works:** ${p.how.map((h, i) => `${i + 1}. ${h}`).join(" ")}

${p.problem}

**FAQ**
${p.faqs.map(([q, a]) => `- **${q}** ${a}`).join("\n")}

SEO title: ${p.seoTitle}
Meta description: ${p.seoDesc}

## Ads
${ads.map((a, i) => `### ${i + 1}. ${a.angle}
- On-image: **${a.head}** — ${a.support}
- Primary text: ${a.primary.replace(/\n/g, " / ")}
- Headline: ${a.below}
- Image prompt: ${a.image}`).join("\n\n")}

Launch settings: Sales objective optimised for purchases, one ad set, 3–5 statics, broad targeting, ${s.symbol}${s.budget || 30}/day.

## Launch checklist
${window.ECI_DATA.launchChecklist.map((c) => `- [ ] ${c}`).join("\n")}
`;

  G.emailsMd = (s) => `# ${s.brand} — email flows\n\n` + G.emails(s).map((e) => `## ${e.flow} — ${e.when}\n- Subject: ${e.subject}\n- Preview: ${e.preview}\n\n${e.body}\n\n[${e.cta}]\n`).join("\n");

  G.csvCell = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  G.shopifyCsv = (s, p) => {
    const head = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price", "Variant Requires Shipping", "Variant Taxable", "Image Src", "SEO Title", "SEO Description", "Cost per item", "Status"];
    const handle = G.slug(s.brand + " " + s.productName);
    const rows = p.tiers.map((t, i) => {
      const first = i === 0;
      return [handle, first ? s.productName : "", first ? G.pageHtmlBody(s, p) : "", first ? s.brand : "", first ? (s.nicheLabel || "") : "", first ? [s.nicheLabel, "dropshipping"].filter(Boolean).join(", ") : "", first ? "FALSE" : "",
        first ? "Bundle" : "", t.label, `${handle}-${t.qty}`.toUpperCase().slice(0, 40), "deny", "manual", t.price.toFixed(2), t.compareAt ? t.compareAt.toFixed(2) : "", "TRUE", "TRUE",
        first ? (s.imageUrl || "") : "", first ? p.seoTitle : "", first ? p.seoDesc : "", s.cost != null ? (s.cost * t.qty).toFixed(2) : "", first ? "draft" : ""];
    });
    return [head, ...rows].map((r) => r.map(G.csvCell).join(",")).join("\n");
  };

  // ---------- tiny ZIP writer (stored, no compression; no external library) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  G.zip = (files) => {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [name, body] of Object.entries(files)) {
      const nb = enc.encode(name), data = enc.encode(body), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const cSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, central.length / 2, true); end.setUint16(10, central.length / 2, true);
    end.setUint32(12, cSize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  };

  window.ECI_GEN = G;
})();
