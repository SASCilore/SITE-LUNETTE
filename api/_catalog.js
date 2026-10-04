// Lecture du catalogue Supabase depuis une fonction Vercel (mêmes clés que le site).
export const SITE_URL = process.env.SITE_URL || "https://site-lunette.vercel.app";

export async function fetchCatalog() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [prodRes, brandRes] = await Promise.all([
    fetch(`${url}/rest/v1/products?select=*`, { headers }),
    fetch(`${url}/rest/v1/brands?select=id,name`, { headers }),
  ]);
  if (!prodRes.ok || !brandRes.ok) throw new Error("Lecture du catalogue impossible");
  const products = await prodRes.json();
  const brands = Object.fromEntries((await brandRes.json()).map((b) => [b.id, b.name]));
  return { products, brands };
}

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Même logique que productSlug dans src/App.jsx
const slugify = (str) =>
  (str || "")
    .toString()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
export const productUrl = (p) => `${SITE_URL}/produit/${slugify(p.name)}-${String(p.id).slice(-8)}`;

export const productPhotos = (p) =>
  (p.photo_urls && p.photo_urls.length ? p.photo_urls : p.photo_url ? [p.photo_url] : []).filter(Boolean);
