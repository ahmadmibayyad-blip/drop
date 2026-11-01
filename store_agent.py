#!/usr/bin/env python3
"""Store Agent: Claude builds a dropshipping store for you, step by step.

It follows the same system as the Store Wizard website:
score the product -> check the margin -> brand -> product page -> ads -> emails
-> (optional) create a DRAFT product in your Shopify store.

Usage
  python store_agent.py --idea "reusable pet hair roller" --cost 4.20 --competitor-price 24.99 --country US
  python store_agent.py --from store.json               # polish what the website produced
  python store_agent.py --from store.json --shopify     # ...and create the draft product in Shopify
  python store_agent.py --idea "..." --research         # let Claude search the web for prices and complaints

Environment
  ANTHROPIC_API_KEY        your Claude API key (or `ant auth login`)
  SHOPIFY_STORE_DOMAIN     e.g. my-store.myshopify.com        (only for --shopify)
  SHOPIFY_ADMIN_TOKEN      Admin API access token (shpat_...) (only for --shopify)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import anthropic
from anthropic import beta_tool

MODEL = "claude-opus-5-5"
SHOPIFY_API_VERSION = "2025-10"
OUT_DIR = Path("output")
AUTO_APPROVE = False

CRITERIA = [
    "Solves a clear problem or creates a strong want",
    "Wow factor in the first 3 seconds of a video",
    "Hard to find in local shops",
    "Room for at least 3x markup",
    "Proof of current demand (from evidence, not guesses)",
    "Low risk of returns, breakage or sizing problems",
    "Low ad-policy risk (no health claims, adult, weapons, branded goods)",
    "Can be bundled or upsold",
]

SYSTEM = f"""You are Store Agent, the operating partner for a one-person dropshipping store.
Your job: take a product idea (or the store.json produced by the Store Wizard website) and produce a
ready-to-launch store pack, saving every deliverable as a file with save_file.

Work through these steps in order, and do not stop to ask questions. If something is missing, write
[needs verification] and keep going:
1. Score the product with score_product against these 8 criteria (1-10 each): {"; ".join(CRITERIA)}.
   Give one line of reasoning per criterion. Base criterion 5 only on evidence the user gave or that you found
   with web search (cite the source and date). The tool decides the verdict (TEST / MAYBE / SKIP).
2. Run margin_check with the user's numbers. If break-even ROAS is above 2.5, propose a bundle or price
   change and re-run margin_check with the new numbers.
3. Brand: 10 names (5-10 letters, not tied to one product; flag any that resemble existing brands),
   a 1-sentence promise, 3 pillars, voice (3 words + example sentence), colours (main, accent, 2 neutrals as hex),
   main customer. Save as brand-book.md. Tell the user to run a trademark search before buying a domain.
4. Product page: headline (<10 words), subheadline, 4 outcome-first bullets, a 1/2/3-pack offer block,
   how it works in 3 steps, problem -> solution, what's in the box, 6 FAQs that answer real objections,
   guarantee/shipping lines from the user's real policy, SEO title (<60 chars) and meta description (<155 chars).
   Save as product-page.md, and also as product-page.html (body HTML only, suitable for Shopify's description).
5. Ads: 6 static ad concepts (problem/solution, before->after, us vs them, social-proof style with no invented
   quotes, offer-led, curiosity hook), each with on-image headline (<=6 words), primary text, headline and a
   detailed image prompt that tells the user to upload their real product photo as reference. Say which 3 to test
   first. Save as ads.md.
6. Email flows: welcome (3), abandoned checkout (3), browse abandonment (1), each with subject, preview, body
   under 120 words and button text. Save as email-flows.md.
7. Save launch-pack.md: verdict, numbers, offer, next actions and this checklist: test order end to end;
   shipping times match supplier; refund/shipping/contact pages exist; pixel test purchase in Events Manager;
   bundle works in cart; trademark search done.
8. Only if the user asked for Shopify: call shopify_create_draft_product once with the final copy and bundle prices.
   The product is created as a DRAFT, never published.

Hard rules:
- Never invent reviews, testimonials, ratings, sales numbers, certifications, or medical/health claims.
- Never invent supplier costs, shipping times, or competitor prices. Use the user's numbers, and label anything assumed.
- Learn from competitor structure if given, but write everything in new words. Never reuse their text or images.
- No fake scarcity or countdowns. Plain language, short paragraphs, no AI-style filler.
- Be direct: if the product is weak, say so and recommend testing a different one.
Finish with a short summary: verdict, profit per order, the files saved, and the single most important next step."""


# ----------------------------------------------------------------- tools
@beta_tool
def score_product(scores: list[int], reasoning: list[str]) -> str:
    """Score a product as a dropshipping test against the 8 fixed criteria and return the verdict.

    Args:
        scores: Exactly 8 integers from 1 to 10, in the order of the criteria in the system prompt.
        reasoning: Exactly 8 one-line reasons, same order.
    """
    if len(scores) != 8 or any(not isinstance(s, int) or s < 1 or s > 10 for s in scores):
        return "Error: provide exactly 8 integer scores between 1 and 10."
    total = sum(scores)
    verdict = "TEST" if total >= 56 and scores[3] >= 6 else "MAYBE" if total >= 44 else "SKIP"
    weakest = min(range(8), key=lambda i: scores[i])
    lines = [f"{i + 1}. {CRITERIA[i]}: {scores[i]}/10 — {(reasoning + [''] * 8)[i]}" for i in range(8)]
    return json.dumps({
        "total": total, "out_of": 80, "verdict": verdict,
        "rule": "TEST only if total >= 56 and criterion 4 (markup) >= 6",
        "biggest_risk": CRITERIA[weakest], "breakdown": lines,
    }, indent=2)


@beta_tool
def margin_check(price: float, cost: float, fee_pct: float = 2.9, fee_fixed: float = 0.30,
                 cost_per_purchase: float | None = None, target_profit: float = 10.0) -> str:
    """Work out whether a product can be profitable on paid ads.

    Args:
        price: Selling price per order.
        cost: Product + shipping cost per order (from the supplier).
        fee_pct: Payment fee percentage, e.g. 2.9.
        fee_fixed: Fixed payment fee per order, e.g. 0.30.
        cost_per_purchase: Expected ad cost per purchase. Omit to assume 35% of price.
        target_profit: Desired profit per order after ads.
    """
    if price <= 0 or cost < 0:
        return "Error: price must be > 0 and cost >= 0."
    assumed = cost_per_purchase is None
    cpa = price * 0.35 if assumed else cost_per_purchase
    fees = price * fee_pct / 100 + fee_fixed
    gross = price - cost - fees
    return json.dumps({
        "gross_margin_per_order": round(gross, 2),
        "gross_margin_pct": round(gross / price * 100, 1),
        "cost_per_purchase_used": round(cpa, 2),
        "cost_per_purchase_assumed": assumed,
        "profit_per_order_after_ads": round(gross - cpa, 2),
        "break_even_roas": round(price / gross, 2) if gross > 0 else None,
        "max_cost_per_purchase_for_target": round(gross - target_profit, 2),
        "kill_rule": f"stop an ad set that spends {gross * 1.5:.2f}-{gross * 2:.2f} without a sale",
        "warning": "break-even ROAS above 2.5: change price/bundle or skip" if gross <= 0 or price / gross > 2.5 else None,
    }, indent=2)


@beta_tool
def save_file(filename: str, content: str) -> str:
    """Save a deliverable (markdown, html, csv or json) into the output folder.

    Args:
        filename: Plain file name like brand-book.md. No folders.
        content: Full file contents.
    """
    name = re.sub(r"[^A-Za-z0-9._-]", "-", Path(filename).name).lstrip(".") or "file.md"
    if not name.lower().endswith((".md", ".html", ".csv", ".json", ".txt")):
        name += ".md"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(content, encoding="utf-8")
    print(f"  💾 saved {path}")
    return f"Saved {path} ({len(content)} chars)"


def _shopify(query: str, variables: dict) -> dict:
    domain = os.environ.get("SHOPIFY_STORE_DOMAIN", "").replace("https://", "").strip("/")
    token = os.environ.get("SHOPIFY_ADMIN_TOKEN", "")
    if not domain or not token:
        raise RuntimeError("Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN to use Shopify.")
    req = urllib.request.Request(
        f"https://{domain}/admin/api/{SHOPIFY_API_VERSION}/graphql.json",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Content-Type": "application/json", "X-Shopify-Access-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode())
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"]))
    return data["data"]


PRODUCT_CREATE = """
mutation CreateProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id handle }
    userErrors { field message }
  }
}"""

VARIANTS_CREATE = """
mutation CreateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: REMOVE_STANDALONE_VARIANT) {
    productVariants { id title price }
    userErrors { field message }
  }
}"""


@beta_tool
def shopify_create_draft_product(title: str, description_html: str, vendor: str, product_type: str,
                                 tags: list[str], seo_title: str, seo_description: str,
                                 bundles: list[dict]) -> str:
    """Create the product in the user's Shopify store as a DRAFT with one variant per bundle.

    Args:
        title: Product title.
        description_html: Product description as HTML (body only).
        vendor: The brand name.
        product_type: Product type / category.
        tags: Product tags.
        seo_title: SEO title, under 60 characters.
        seo_description: Meta description, under 155 characters.
        bundles: List of {"name": "2 pack", "price": 35.99, "compare_at_price": 47.98 or null}.
    """
    print(f"\n  🛒 Claude wants to create a DRAFT product in Shopify: {title!r} with bundles "
          f"{[(b.get('name'), b.get('price')) for b in bundles]}")
    if not AUTO_APPROVE and input("  Allow? [y/N] ").strip().lower() != "y":
        return "The user declined the Shopify write. Do not retry; tell them they can import shopify-products.csv instead."
    try:
        names = [str(b["name"]) for b in bundles] or ["Default"]
        made = _shopify(PRODUCT_CREATE, {"product": {
            "title": title, "descriptionHtml": description_html, "vendor": vendor,
            "productType": product_type, "tags": tags, "status": "DRAFT",
            "seo": {"title": seo_title[:70], "description": seo_description[:320]},
            "productOptions": [{"name": "Bundle", "values": [{"name": n} for n in names]}],
        }})["productCreate"]
        if made["userErrors"]:
            return "Shopify error: " + json.dumps(made["userErrors"])
        pid = made["product"]["id"]
        variants = []
        for b in bundles:
            v = {"price": f"{float(b['price']):.2f}", "optionValues": [{"optionName": "Bundle", "name": str(b["name"])}]}
            if b.get("compare_at_price"):
                v["compareAtPrice"] = f"{float(b['compare_at_price']):.2f}"
            variants.append(v)
        vr = _shopify(VARIANTS_CREATE, {"productId": pid, "variants": variants})["productVariantsBulkCreate"]
        if vr["userErrors"]:
            return f"Product {pid} created, but variants failed: " + json.dumps(vr["userErrors"])
        numeric = pid.rsplit("/", 1)[-1]
        domain = os.environ["SHOPIFY_STORE_DOMAIN"].replace("https://", "").strip("/")
        return json.dumps({"product_id": pid, "handle": made["product"]["handle"], "status": "DRAFT",
                           "variants": vr["productVariants"],
                           "admin_url": f"https://{domain}/admin/products/{numeric}"})
    except (RuntimeError, urllib.error.URLError, KeyError, ValueError) as err:
        return f"Shopify request failed: {err}"


# ----------------------------------------------------------------- main
def build_prompt(args: argparse.Namespace) -> str:
    parts = []
    if args.from_file:
        data = json.loads(Path(args.from_file).read_text(encoding="utf-8"))
        parts.append("Here is the store.json produced by the Store Wizard website. Re-check the score and margin "
                     "with the tools, then improve and finish every deliverable:\n```json\n"
                     + json.dumps(data, indent=2)[:60000] + "\n```")
    if args.idea:
        parts.append(f"Product idea: {args.idea}")
    facts = {
        "Selling country": args.country, "Supplier cost incl. shipping": args.cost,
        "Competitor price": args.competitor_price, "My selling price": args.price,
        "Daily ad budget": args.budget, "Evidence it sells": args.evidence,
        "Customer": args.customer, "Support email": args.email,
        "Shipping policy": args.shipping, "Guarantee": args.guarantee,
    }
    parts.append("\n".join(f"- {k}: {v}" for k, v in facts.items() if v not in (None, "")))
    parts.append("Create the draft product in Shopify at the end." if args.shopify
                 else "Do NOT call shopify_create_draft_product; the user will import the CSV themselves.")
    if args.research:
        parts.append("Use web search to check current prices for this product on Amazon and other stores, and the "
                     "most common complaints in reviews. Cite each source with its date.")
    return "\n\n".join(p for p in parts if p)


def main() -> None:
    global OUT_DIR, AUTO_APPROVE
    ap = argparse.ArgumentParser(description="Claude builds your dropshipping store pack.")
    ap.add_argument("--from", dest="from_file", help="store.json downloaded from the Store Wizard")
    ap.add_argument("--idea", help="product idea, e.g. 'reusable pet hair roller'")
    ap.add_argument("--country", default="US")
    ap.add_argument("--cost", type=float, help="supplier cost incl. shipping")
    ap.add_argument("--competitor-price", type=float)
    ap.add_argument("--price", type=float, help="your selling price")
    ap.add_argument("--budget", type=float, help="daily ad test budget")
    ap.add_argument("--evidence", help="why you think it sells (Ad Library, Amazon, TikTok Shop)")
    ap.add_argument("--customer")
    ap.add_argument("--email")
    ap.add_argument("--shipping", help="your real shipping policy")
    ap.add_argument("--guarantee", help="your real refund policy")
    ap.add_argument("--shopify", action="store_true", help="create a DRAFT product in Shopify at the end")
    ap.add_argument("--yes", action="store_true", help="don't ask before writing to Shopify")
    ap.add_argument("--research", action="store_true", help="let Claude use web search")
    ap.add_argument("--out", default="output", help="folder for the files (default: output)")
    args = ap.parse_args()
    if not args.from_file and not args.idea:
        ap.error("give --idea or --from store.json")

    OUT_DIR, AUTO_APPROVE = Path(args.out), args.yes
    tools: list = [score_product, margin_check, save_file]
    if args.shopify:
        tools.append(shopify_create_draft_product)
    if args.research:
        tools.append({"type": "web_search_20260209", "name": "web_search", "max_uses": 8})

    client = anthropic.Anthropic()
    print(f"🤖 Store Agent is working (files go to {OUT_DIR.resolve()})…")
    try:
        runner = client.beta.messages.tool_runner(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            tools=tools,
            max_iterations=40,
            messages=[{"role": "user", "content": build_prompt(args)}],
        )
        final = None
        for message in runner:
            final = message
            for block in message.content:
                if block.type == "tool_use":
                    print(f"  🔧 {block.name}")
        if final is None:
            sys.exit("No response from Claude.")
        if final.stop_reason == "refusal":
            sys.exit("Claude declined this request. Try rephrasing the product description.")
        print("\n" + "".join(b.text for b in final.content if b.type == "text"))
    except anthropic.AuthenticationError:
        sys.exit("Authentication failed: set ANTHROPIC_API_KEY (https://console.anthropic.com) or run `ant auth login`.")
    except anthropic.RateLimitError:
        sys.exit("Rate limited by the Claude API. Wait a minute and run again.")
    except anthropic.APIStatusError as err:
        sys.exit(f"Claude API error {err.status_code}: {err.message}")
    except anthropic.APIConnectionError:
        sys.exit("Could not reach the Claude API. Check your internet connection.")


if __name__ == "__main__":
    main()
