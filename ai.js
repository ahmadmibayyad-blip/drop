/* Live AI product research in the browser, using the user's own Claude API key.
 * The key is only sent to api.anthropic.com. Claude searches the web for current
 * evidence (ads running, marketplace best-sellers, prices) and must cite sources.
 */
(function () {
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm";
  const MODEL = "claude-opus-5-5";

  async function makeClient(apiKey) {
    let mod;
    try { mod = await import(SDK_URL); } catch (_) { throw new Error("Couldn't load the Claude SDK. Check your internet connection."); }
    const Anthropic = mod.default || mod.Anthropic;
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  }

  // Runs one request loop until Claude calls `finalTool`, then returns that tool's input.
  async function run(apiKey, { system, prompt, tools, finalTool, effort = "medium" }) {
    const client = await makeClient(apiKey);
    const messages = [{ role: "user", content: prompt }];
    for (let turn = 0; turn < 6; turn++) {
      let r;
      try {
        r = await client.beta.messages.create({
          model: MODEL, max_tokens: 16000, system,
          thinking: { type: "adaptive" }, output_config: { effort },
          betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
          tools, messages,
        });
      } catch (err) {
        if (err && err.status === 401) throw new Error("That API key was rejected. Copy it again from console.anthropic.com.");
        if (err && err.status === 429) throw new Error("Rate limited. Wait a minute and try again.");
        if (err && err.status === 400 && /credit/i.test(err.message || "")) throw new Error("Your Anthropic account has no credit. Add credit at console.anthropic.com → Billing.");
        throw new Error("Claude API error: " + ((err && err.message) || err));
      }
      if (r.stop_reason === "refusal") throw new Error("Claude declined this search. Try different keywords.");
      const call = r.content.find((b) => b.type === "tool_use" && b.name === finalTool);
      if (call) return call.input;
      messages.push({ role: "assistant", content: r.content });
      if (r.stop_reason !== "pause_turn") messages.push({ role: "user", content: `Now call ${finalTool} with your results.` });
    }
    throw new Error("Claude didn't return results. Try again.");
  }

  const SOURCE = {
    type: "object", additionalProperties: false, required: ["title", "url"],
    properties: { title: { type: "string" }, url: { type: "string" } },
  };

  const REPORT_PRODUCTS = {
    name: "report_products",
    description: "Return the product candidates you found, with the evidence and sources for each.",
    strict: true,
    input_schema: {
      type: "object", additionalProperties: false, required: ["products"],
      properties: {
        products: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["name", "niche", "why", "evidence", "typical_price_usd", "sources", "risks"],
            properties: {
              name: { type: "string", description: "Generic product name, no brand names" },
              niche: { type: "string" },
              why: { type: "string", description: "One sentence: the problem it solves or the want it creates" },
              evidence: { type: "string", description: "Demand evidence found in the sources, with dates. Only facts from sources." },
              typical_price_usd: { type: "number", description: "Typical retail price seen in sources, 0 if not found" },
              sources: { type: "array", items: SOURCE },
              risks: { type: "string", description: "Returns, shipping, ad-policy, IP or saturation risks" },
            },
          },
        },
      },
    },
  };

  const FILL_PRODUCT = {
    name: "fill_product",
    description: "Return the product page building blocks for this product.",
    strict: true,
    input_schema: {
      type: "object", additionalProperties: false,
      required: ["customer", "problem", "outcome", "features", "how_it_works", "in_the_box", "alternative", "risk"],
      properties: {
        customer: { type: "string", description: "Who buys it, concrete, e.g. 'cat owners in Denmark with long-haired cats'" },
        problem: { type: "string", description: "Their everyday problem, lowercase, no full stop" },
        outcome: { type: "string", description: "The outcome they want, lowercase, under 12 words" },
        features: { type: "array", items: { type: "string" }, description: "4 feature lines" },
        how_it_works: { type: "array", items: { type: "string" }, description: "3 short steps" },
        in_the_box: { type: "array", items: { type: "string" } },
        alternative: { type: "string", description: "What people use today instead" },
        risk: { type: "string", description: "Main risk to watch when selling this" },
      },
    },
  };

  const RULES = `Rules: never invent sales numbers, reviews, ratings or prices; only report facts you saw in sources and cite them.
No brand-name products (they can't be dropshipped). No medical, weight-loss, or adult products. Prefer products with ads running 7+ days,
marketplace best-seller signals, or TikTok Shop sales in the last 30 days.`;

  async function findProducts(apiKey, { keywords, niche, countryName }) {
    return run(apiKey, {
      system: `You are a skeptical dropshipping product researcher. Use web search to find products that are selling RIGHT NOW. ${RULES}
Finish by calling report_products with 6-8 candidates.`,
      prompt: `Find 6-8 dropshipping product candidates to test in ${countryName}.
Niche: ${niche || "any"}. Keywords: ${keywords || "trending problem-solving products"}.
Look for: Meta Ad Library ads running a long time, Amazon Movers & Shakers / "bought in past month", TikTok Shop best-sellers, trend articles from the last 60 days.
For each product, give the evidence with dates and the source URLs.`,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }, REPORT_PRODUCTS],
      finalTool: "report_products",
    });
  }

  async function fillProduct(apiKey, { productName, countryName, notes }) {
    return run(apiKey, {
      system: `You write the building blocks of a dropshipping product page. Plain words, outcome-first, no hype.
Never claim health, medical, slimming or safety outcomes. Never invent specs, certifications or reviews. Call fill_product.`,
      prompt: `Product: ${productName}\nSelling to: ${countryName}\n${notes ? "Notes: " + notes : ""}`,
      tools: [FILL_PRODUCT],
      finalTool: "fill_product",
      effort: "low",
    });
  }

  const IMPORT_PRODUCT = {
    name: "import_product",
    description: "Return the product data you read from the fetched page.",
    strict: true,
    input_schema: {
      type: "object", additionalProperties: false,
      required: ["ok", "error", "title", "price", "currency", "images", "features", "specs", "in_the_box", "shipping_info"],
      properties: {
        ok: { type: "boolean", description: "false if the page could not be fetched or is not a product page" },
        error: { type: "string", description: "Why it failed, empty if ok" },
        title: { type: "string", description: "Generic product title without brand or store name" },
        price: { type: "number", description: "Current price on the page, 0 if not shown" },
        currency: { type: "string" },
        images: { type: "array", items: { type: "string" }, description: "Up to 8 absolute URLs of the main product photos (jpg/png/webp), largest size available" },
        features: { type: "array", items: { type: "string" }, description: "Up to 6 factual features stated on the page" },
        specs: { type: "string", description: "Size, material, weight, power etc. exactly as stated" },
        in_the_box: { type: "array", items: { type: "string" } },
        shipping_info: { type: "string", description: "Shipping time/cost if stated, else empty" },
      },
    },
  };

  // Strip tracking junk so the fetch tool accepts the URL, and list fallback URLs to try.
  function cleanUrl(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch (_) { return { url: String(raw).trim(), alts: [] }; }
    const host = u.hostname.replace(/^www\./, "");
    let m;
    if (/aliexpress\./.test(host) && (m = u.pathname.match(/\/item\/(\d+)\.html/))) {
      const id = m[1];
      return { url: `https://www.aliexpress.com/item/${id}.html`, alts: [`https://www.aliexpress.us/item/${id}.html`, `https://m.aliexpress.com/item/${id}.html`], id };
    }
    if (/amazon\./.test(host) && (m = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i))) {
      return { url: `https://${u.hostname}/dp/${m[1]}`, alts: [], id: m[1] };
    }
    if (/temu\.com$/.test(host)) return { url: `https://${u.hostname}${u.pathname}`, alts: [] };
    if (/alibaba\.com$/.test(host)) return { url: `https://${u.hostname}${u.pathname}`, alts: [] };
    if (/cjdropshipping\.com$/.test(host)) return { url: `https://${u.hostname}${u.pathname}`, alts: [] };
    // Shopify and other stores: the path identifies the product; keep only an id-like param.
    const keep = ["id", "variant", "itemId", "item_id"].filter((k) => u.searchParams.has(k)).map((k) => `${k}=${encodeURIComponent(u.searchParams.get(k))}`);
    const out = `${u.protocol}//${u.hostname}${u.pathname}${keep.length ? "?" + keep.join("&") : ""}`;
    const alts = /\/products\//.test(u.pathname) ? [`${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, "")}.json`] : [];
    return { url: out, alts };
  }

  async function importFromUrl(apiKey, rawUrl) {
    const { url, alts, id } = cleanUrl(rawUrl);
    return run(apiKey, {
      system: `You extract product data from a web page. Fetch the URL with web_fetch, then call import_product.
Only report what is on the page. Never invent specs, prices, reviews or certifications. Drop health or medical claims.
If the first URL fails or returns no product data, try the alternative URLs given. If all fail (blocked, login, captcha),
call import_product with ok=false and explain in error.`,
      prompt: `Fetch this product page and import it: ${url}${alts.length ? `\nAlternative URLs for the same product, try these if the first fails:\n${alts.join("\n")}` : ""}${id ? `\nProduct ID: ${id}` : ""}`,
      tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 }, IMPORT_PRODUCT],
      finalTool: "import_product",
      effort: "low",
    }).then((o) => Object.assign(o, { cleanUrl: url }));
  }

  window.ECI_AI = { findProducts, fillProduct, importFromUrl, cleanUrl };
})();
