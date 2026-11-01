# ecom-creator-intel: Store Wizard + Store Agent

Turn a product idea into a ready-made dropshipping store by clicking **Next → Next → Next**.
Built on the *Claude Dropshipping Guide* (Oct 2026): fixed-criteria product scoring, margin check,
brand book, product page from customer language, static ad concepts, email flows and a launch checklist.

## 1. Store Wizard (website, no install)

Open `index.html` in your browser (double-click it). Nothing to install, no account, no API key.

| Step | What happens |
|---|---|
| 1. Setup | Country/currency, daily ad budget, supplier, stage |
| 2. Product | Pick a niche and a starter idea, or type your own product |
| 3. Numbers | Supplier cost, competitor price, your price, fees, evidence it sells |
| 4. Score & margin | 8 criteria, TEST only at 56+/80 with markup ≥ 6; gross margin, profit after ads, break-even ROAS, max CPA, 1/2/3-pack bundle offer |
| 5. Brand | 10 short names, colours, voice, promise |
| 6. Product page | Headline, benefits, offer, how it works, FAQ, SEO, from your real policies |
| 7. Ads | 6 static ad concepts with copy and image prompts (Gemini / Higgsfield) |
| 8. Your store | Live preview + downloads |

**Downloads** (one zip):
- `index.html`: a complete one-page store. Paste a Stripe Payment Link or Shopify checkout link and drag the folder onto [Netlify Drop](https://app.netlify.com/drop) to go live.
- `shopify-products.csv`: Shopify Admin → Products → Import. Arrives as a **draft** with 3 bundle variants.
- `launch-pack.md`, `brand-book.md`, `email-flows.md`, `claude-project-instructions.md`
- `store.json`: input for the agent below.

Answers are saved in your browser, so you can close the tab and come back.

## 2. Store Agent (Claude does it for you)

```bash
cd agent
pip install -r requirements.txt
```

Set your key ([console.anthropic.com](https://console.anthropic.com)). On Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

Then run one of these:

```bash
# From scratch
python store_agent.py --idea "reusable pet hair roller" --cost 4.20 --competitor-price 24.99 --country US --evidence "3 stores running the same ad 45+ days in Meta Ad Library"

# Polish what the website produced
python store_agent.py --from ../store.json

# Also research live prices/complaints on the web, and create the DRAFT product in Shopify
python store_agent.py --from ../store.json --research --shopify
```

The agent scores the product, checks the margin, writes the brand book, product page, ads and emails, and
saves everything to `agent/output/`. With `--shopify` it creates the product as a **draft**, and it asks you before writing.
For Shopify set `SHOPIFY_STORE_DOMAIN` (e.g. `my-store.myshopify.com`) and `SHOPIFY_ADMIN_TOKEN`
(Settings → Apps → Develop apps → create an app with `write_products` scope → Admin API access token).

## Honest limits
- Nothing here can promise a product will sell. The score is only as good as the evidence you enter.
- Starter ideas are leads to research, not winners. They contain no invented prices, reviews or sales data.
- Check trademarks (USPTO / UKIPO / EUIPO) and domains yourself before buying.
- No fake reviews, scarcity or health claims are generated. Keep it that way: they get ads rejected.
