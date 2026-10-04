// go2glass — sitemap généré à partir du catalogue : pages fixes + toutes les fiches produit.
// Servi sur /sitemap.xml (voir vercel.json).
import { SITE_URL, fetchCatalog, esc, productUrl } from "./_catalog.js";

const STATIC_PAGES = [
  ["/", "weekly", "1.0"],
  ["/catalogue", "daily", "0.9"],
  ["/lunettes-de-soleil/femme", "daily", "0.8"],
  ["/lunettes-de-soleil/homme", "daily", "0.8"],
  ["/lunettes-de-vue/femme", "daily", "0.8"],
  ["/lunettes-de-vue/homme", "daily", "0.8"],
  ["/marques", "weekly", "0.6"],
  ["/a-propos", "monthly", "0.3"],
  ["/pro", "monthly", "0.4"],
];

export default async function handler(req, res) {
  let products = [];
  try {
    products = (await fetchCatalog()).products;
  } catch (e) {
    // Catalogue indisponible : on sert quand même les pages fixes plutôt qu'une erreur.
  }
  const urls = [
    ...STATIC_PAGES.map(([path, freq, prio]) => `  <url><loc>${SITE_URL}${path}</loc><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`),
    ...products
      .filter((p) => p.name && Number(p.price) > 0)
      .map((p) => {
        const lastmod = p.created_at ? `<lastmod>${String(p.created_at).slice(0, 10)}</lastmod>` : "";
        return `  <url><loc>${esc(productUrl(p))}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
