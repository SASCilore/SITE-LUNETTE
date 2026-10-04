// go2glass — flux produits pour Google Merchant Center, Microsoft Merchant Center et Pinterest.
// Servi sur /feed.xml (voir vercel.json).
import { SITE_URL, fetchCatalog, esc, productUrl, productPhotos } from "./_catalog.js";

const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const money = (n) => `${Number(n).toFixed(2)} EUR`;
const availability = (stock) => (stock === "Rupture" ? "out_of_stock" : stock === "Sur commande" ? "backorder" : "in_stock");
const gender = (g) => {
  const v = (g || "").toLowerCase();
  if (v.startsWith("homme")) return "male";
  if (v.startsWith("femme")) return "female";
  return "unisex";
};
// Taxonomie Google : 178 = Lunettes de soleil, 524 = Lunettes de vue
const googleCategory = (c) => ((c || "").toLowerCase().includes("vue") ? "524" : "178");
const validGtin = (ean) => /^\d{8}$|^\d{12,14}$/.test(String(ean || "").trim());

export default async function handler(req, res) {
  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch (e) {
    res.status(500).send("Erreur de lecture du catalogue");
    return;
  }
  const { products, brands } = catalog;

  const items = products
    .filter((p) => p.name && Number(p.price) > 0)
    .map((p) => {
      const photos = productPhotos(p);
      if (!photos.length) return ""; // Google refuse un produit sans image
      const brand = brands[p.brand_id] || "go2glass";
      const price = Number(p.price);
      const compareAt = p.compare_at_price != null ? Number(p.compare_at_price) : null;
      const onSale = compareAt && compareAt > price;
      const title = p.name.toLowerCase().includes(brand.toLowerCase()) ? p.name : `${brand} ${p.name}`;
      const fullTitle = [title, p.color_name, p.calibre].filter(Boolean).join(" - ");
      const desc =
        stripHtml(p.description) ||
        `${title}${p.color_name ? `, coloris ${p.color_name}` : ""}. Lunettes de marque authentiques, livraison incluse.`;
      const gtin = validGtin(p.ean) ? String(p.ean).trim() : null;
      const lines = [
        `<g:id>${esc(p.id)}</g:id>`,
        `<g:title>${esc(fullTitle.slice(0, 150))}</g:title>`,
        `<g:description>${esc(desc.slice(0, 5000))}</g:description>`,
        `<g:link>${esc(productUrl(p))}</g:link>`,
        `<g:image_link>${esc(photos[0])}</g:image_link>`,
        ...photos.slice(1, 11).map((ph) => `<g:additional_image_link>${esc(ph)}</g:additional_image_link>`),
        `<g:availability>${availability(p.stock)}</g:availability>`,
        `<g:price>${money(onSale ? compareAt : price)}</g:price>`,
        onSale ? `<g:sale_price>${money(price)}</g:sale_price>` : "",
        `<g:brand>${esc(brand)}</g:brand>`,
        gtin ? `<g:gtin>${gtin}</g:gtin>` : `<g:identifier_exists>no</g:identifier_exists>`,
        `<g:condition>new</g:condition>`,
        `<g:google_product_category>${googleCategory(p.category)}</g:google_product_category>`,
        `<g:product_type>${esc(`${p.category || "Lunettes"} > ${brand}`)}</g:product_type>`,
        `<g:gender>${gender(p.gender)}</g:gender>`,
        `<g:age_group>adult</g:age_group>`,
        p.color_name ? `<g:color>${esc(p.color_name)}</g:color>` : "",
        p.material ? `<g:material>${esc(p.material)}</g:material>` : "",
        `<g:shipping><g:country>FR</g:country><g:price>0.00 EUR</g:price></g:shipping>`,
      ].filter(Boolean);
      return `\n    <item>\n      ${lines.join("\n      ")}\n    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>go2glass</title>
    <link>${SITE_URL}</link>
    <description>Lunettes de marque à prix juste</description>${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
