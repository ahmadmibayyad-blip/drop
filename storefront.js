/* Builds a complete, single-file storefront (index.html) from the wizard state.
 * The file works anywhere: open it locally, upload it to Netlify / GitHub Pages /
 * Cloudflare Pages, or use it as the design brief for a Shopify theme.
 */
(function () {
  const G = window.ECI_GEN;

  function placeholderImg(s) {
    const a = s.palette.main, b = s.palette.accent;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='800' fill='url(#g)'/><text x='400' y='390' font-family='Arial' font-size='44' font-weight='700' fill='white' text-anchor='middle'>${G.esc(s.brand)}</text><text x='400' y='450' font-family='Arial' font-size='26' fill='white' opacity='.85' text-anchor='middle'>Add your product photo</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function build(s) {
    const p = G.page(s);
    const e = G.esc, cur = s.symbol || "$";
    const img = s.imageUrl ? e(s.imageUrl) : placeholderImg(s);
    const tiers = p.tiers.map((t, i) => {
      const link = (s.checkoutLinks && s.checkoutLinks[i]) || s.checkoutUrl || "";
      return `<label class="tier${i === 1 ? " pop" : ""}"><input type="radio" name="tier" value="${i}" data-link="${e(link)}" ${i === 1 ? "checked" : ""}>
        <span class="tl"><b>${e(t.label)}</b><small>${e(t.note)}</small></span>
        <span class="tp"><b>${G.money(t.price, cur)}</b>${t.compareAt ? `<s>${G.money(t.compareAt, cur)}</s>` : ""}</span>
        ${i === 1 ? '<em class="flag">Most popular</em>' : ""}</label>`;
    }).join("");

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(s.brand)} | ${e(s.productName)}</title>
<meta name="description" content="${e(p.seoDesc)}">
<meta property="og:title" content="${e(p.seoTitle)}"><meta property="og:description" content="${e(p.seoDesc)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--main:${s.palette.main};--accent:${s.palette.accent};--light:${s.palette.n1};--dark:${s.palette.n2}}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--dark);background:var(--light);line-height:1.55}
a{color:inherit}img{max-width:100%;display:block}
.bar{background:var(--main);color:var(--light);text-align:center;font-size:.85rem;padding:8px 16px}
header{display:flex;justify-content:space-between;align-items:center;padding:16px;max-width:1100px;margin:auto}
.logo{font-weight:800;font-size:1.4rem;letter-spacing:-.02em;color:var(--main);text-decoration:none}
nav a{margin-left:16px;font-size:.9rem;text-decoration:none;opacity:.8}
.hero{max-width:1100px;margin:auto;padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
@media(max-width:820px){.hero{grid-template-columns:1fr;gap:20px}nav{display:none}}
.hero img{border-radius:18px;aspect-ratio:1/1;object-fit:cover;width:100%;background:#fff}
h1{font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.1;letter-spacing:-.02em;margin:.2em 0}
.sub{font-size:1.1rem;opacity:.85}
ul.ben{list-style:none;padding:0;margin:18px 0}ul.ben li{padding:6px 0 6px 30px;position:relative}
ul.ben li:before{content:"✓";position:absolute;left:0;top:5px;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:.8rem;display:grid;place-items:center;font-weight:800}
.tier{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:2px solid #0001;border-radius:14px;padding:14px;margin:10px 0;cursor:pointer;background:#fff;position:relative}
.tier:has(input:checked){border-color:var(--main)}.tier input{accent-color:var(--main);width:18px;height:18px}
.tl small{display:block;opacity:.7}.tp{text-align:right}.tp s{display:block;opacity:.5;font-size:.85rem}
.flag{position:absolute;top:-10px;right:14px;background:var(--accent);color:#fff;font-style:normal;font-size:.72rem;font-weight:800;padding:2px 10px;border-radius:999px}
.buy{display:block;width:100%;border:0;border-radius:14px;padding:18px;font:inherit;font-weight:800;font-size:1.1rem;background:var(--main);color:var(--light);cursor:pointer;margin-top:8px}
.buy:hover{filter:brightness(1.08)}
.trust{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;opacity:.8;margin-top:12px}
section.blk{max-width:1100px;margin:auto;padding:48px 16px}
.alt{background:#fff}
h2{font-size:1.7rem;letter-spacing:-.01em;margin:0 0 18px;text-align:center}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}@media(max-width:720px){.steps{grid-template-columns:1fr}}
.step{background:var(--light);border-radius:16px;padding:22px}.step b{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--main);color:var(--light);margin-bottom:8px}
.ps{max-width:720px;margin:auto;font-size:1.1rem;text-align:center}
details{background:#fff;border-radius:12px;padding:14px 18px;margin:10px auto;max-width:760px}
summary{font-weight:600;cursor:pointer}
.guar{background:var(--main);color:var(--light);text-align:center;padding:40px 16px}
footer{padding:40px 16px;max-width:1100px;margin:auto;font-size:.9rem}
footer .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px}
footer h3{font-size:1rem}
.sticky{position:fixed;bottom:0;left:0;right:0;background:#fff;box-shadow:0 -4px 20px #0002;padding:10px 16px;display:none;z-index:9}
@media(max-width:820px){.sticky{display:block}body{padding-bottom:80px}}
.sticky .buy{margin:0;padding:14px}
</style></head>
<body>
<div class="bar">${e(s.announcement || p.guarantee.split(".")[0] + ". " + (s.freeShipping ? "Free shipping on every order." : ""))}</div>
<header><a class="logo" href="#">${e(s.brand)}</a><nav><a href="#how">How it works</a><a href="#faq">FAQ</a><a href="#shipping">Shipping</a><a href="#contact">Contact</a></nav></header>

<main>
<div class="hero">
  <img src="${img}" alt="${e(s.productName)}">
  <div>
    <h1>${e(p.headline)}</h1>
    <p class="sub">${e(p.sub)}</p>
    <ul class="ben">${p.benefits.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
    <form id="offer">${tiers}</form>
    <button class="buy" id="buy" type="button">Add to cart</button>
    <div class="trust"><span>🔒 Secure checkout</span><span>📦 ${e(s.shipShort || "Tracked shipping")}</span><span>↩️ ${e(s.guaranteeShort || "Money-back guarantee")}</span></div>
  </div>
</div>

<section class="blk alt" id="how"><h2>How it works</h2><div class="steps">${p.how.map((h, i) => `<div class="step"><b>${i + 1}</b><p>${e(h)}</p></div>`).join("")}</div></section>

<section class="blk"><h2>Why ${e(s.brand)}?</h2><p class="ps">${e(p.problem)}</p></section>

${p.box.length || p.specs ? `<section class="blk alt"><h2>What's in the box</h2><div class="ps">${p.box.length ? `<p>${p.box.map(e).join(" · ")}</p>` : ""}${p.specs ? `<p><small>${e(p.specs)}</small></p>` : ""}</div></section>` : ""}

<section class="blk" id="faq"><h2>Questions</h2>${p.faqs.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join("")}</section>

<section class="guar"><h2 style="color:inherit">Our promise</h2><p>${e(p.guarantee)}</p></section>
</main>

<footer>
  <div class="cols">
    <div id="shipping"><h3>Shipping</h3><p>${e(p.ship)}</p></div>
    <div id="refunds"><h3>Refunds</h3><p>${e(p.guarantee)}</p></div>
    <div id="contact"><h3>Contact</h3><p>${e(s.email || "[your support email]")}${s.businessAddress ? `<br>${e(s.businessAddress)}` : ""}</p></div>
  </div>
  <p style="opacity:.6;margin-top:24px">© ${new Date().getFullYear()} ${e(s.brand)}</p>
</footer>

<div class="sticky"><button class="buy" type="button" onclick="document.getElementById('buy').click()">Add to cart</button></div>
<script>
document.getElementById('buy').addEventListener('click',function(){
  var r=document.querySelector('input[name=tier]:checked');var link=r&&r.getAttribute('data-link');
  if(link){window.location.href=link}else{alert('Checkout is not connected yet. Paste a Shopify / Stripe checkout link in the Store Wizard (Launch step) and download again.')}
});
</script>
</body></html>`;
  }

  window.ECI_STORE = { build };
})();
