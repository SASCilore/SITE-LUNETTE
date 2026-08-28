import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Variables d'environnement Supabase manquantes. Copiez .env.example vers .env et renseignez " +
      "VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Project Settings > API dans Supabase)."
  );
}

export const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "");

/* ---------------------------------- MAPPERS (snake_case DB <-> camelCase app) ---------------------------------- */

const rowToBrand = (r) => ({ id: r.id, name: r.name, origin: r.origin || "", desc: r.description || "" });
const brandToRow = (b) => ({ id: b.id, name: b.name, origin: b.origin, description: b.desc });

const rowToSupplier = (r) => ({ id: r.id, name: r.name, contact: r.contact || "", delay: r.delay || "", location: r.location || "", brandIds: r.brand_ids || [] });
const supplierToRow = (s) => ({ id: s.id, name: s.name, contact: s.contact, delay: s.delay, location: s.location, brand_ids: s.brandIds || [] });

function stripTags(s) { return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }

function cleanDescription(raw) {
  if (!raw) return "";
  let s = raw;
  if (/<table/i.test(s)) {
    const rows = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = rowRe.exec(s))) {
      const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
      if (cells.length >= 2 && cells[0] && cells[1]) rows.push(`${cells[0]} : ${cells[1]}`);
      else if (cells.length === 1 && cells[0]) rows.push(cells[0]);
    }
    s = rows.join(" · ");
  } else {
    s = stripTags(s);
  }
  s = s.replace(/\uFFFD/g, "");
  s = s
    .replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è").replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç").replace(/&ecirc;/gi, "ê").replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ").replace(/&#39;/g, "'").replace(/&apos;/gi, "'").replace(/&quot;/gi, '"');
  return s.replace(/\s+/g, " ").trim();
}

const rowToProduct = (r) => ({
  id: r.id, name: r.name, brandId: r.brand_id, category: r.category, gender: r.gender,
  price: Number(r.price), cost: Number(r.cost || 0), colorName: r.color_name || "", colorHex: r.color_hex || "#00F0FF",
  shape: r.shape || "square", calibre: r.calibre || "", material: r.material || "", stock: r.stock || "En stock",
  supplierId: r.supplier_id, featured: !!r.featured, description: cleanDescription(r.description || ""),
  photos: (r.photo_urls && r.photo_urls.length ? r.photo_urls : (r.photo_url ? [r.photo_url] : [])),
  compareAtPrice: r.compare_at_price !== null && r.compare_at_price !== undefined ? Number(r.compare_at_price) : null,
  createdAt: r.created_at || null,
  stockQuantity: r.stock_quantity !== null && r.stock_quantity !== undefined ? Number(r.stock_quantity) : null,
});
const productToRow = (p) => ({
  id: p.id, name: p.name, brand_id: p.brandId, category: p.category, gender: p.gender,
  price: p.price, cost: p.cost, color_name: p.colorName, color_hex: p.colorHex, shape: p.shape,
  calibre: p.calibre, material: p.material, stock: p.stock, supplier_id: p.supplierId,
  featured: p.featured, description: p.description,
  photo_urls: p.photos || [], photo_url: (p.photos && p.photos[0]) || "",
  compare_at_price: p.compareAtPrice || null,
  stock_quantity: p.stockQuantity === "" || p.stockQuantity === undefined ? null : p.stockQuantity,
});

const rowToOrder = (r) => ({
  id: r.id, client: r.client, email: r.email, date: r.order_date, items: r.items || [], status: r.status,
  userId: r.user_id || null, shippingAddress: r.shipping_address || null,
  paymentStatus: r.payment_status || "pending", stripeSessionId: r.stripe_session_id || null,
  total: r.total !== null && r.total !== undefined ? Number(r.total) : null,
});
const orderToRow = (o) => ({
  id: o.id, client: o.client, email: o.email, order_date: o.date, items: o.items, status: o.status,
  user_id: o.userId || null, shipping_address: o.shippingAddress || null,
  payment_status: o.paymentStatus || "pending", stripe_session_id: o.stripeSessionId || null,
  total: o.total ?? null,
});

/* ---------------------------------- FETCH ALL (initial load) ---------------------------------- */

export async function fetchAllData() {
  const [brandsRes, suppliersRes, productsRes, ordersRes] = await Promise.all([
    supabase.from("brands").select("*").order("name"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
  ]);
  const firstError = brandsRes.error || suppliersRes.error || productsRes.error || ordersRes.error;
  if (firstError) throw firstError;
  return {
    brands: (brandsRes.data || []).map(rowToBrand),
    suppliers: (suppliersRes.data || []).map(rowToSupplier),
    products: (productsRes.data || []).map(rowToProduct),
    orders: (ordersRes.data || []).map(rowToOrder),
  };
}

/* ---------------------------------- BRANDS ---------------------------------- */

export async function dbCreateBrand(brand) {
  const { data, error } = await supabase.from("brands").insert(brandToRow(brand)).select().single();
  if (error) throw error;
  return rowToBrand(data);
}
export async function dbCreateBrands(brands) {
  if (!brands.length) return [];
  const { data, error } = await supabase.from("brands").insert(brands.map(brandToRow)).select();
  if (error) throw error;
  return (data || []).map(rowToBrand);
}
export async function dbUpdateBrand(brand) {
  const { data, error } = await supabase.from("brands").update(brandToRow(brand)).eq("id", brand.id).select().single();
  if (error) throw error;
  return rowToBrand(data);
}
export async function dbDeleteBrand(id) {
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------- SUPPLIERS ---------------------------------- */

export async function dbCreateSupplier(supplier) {
  const { data, error } = await supabase.from("suppliers").insert(supplierToRow(supplier)).select().single();
  if (error) throw error;
  return rowToSupplier(data);
}
export async function dbCreateSuppliers(suppliers) {
  if (!suppliers.length) return [];
  const { data, error } = await supabase.from("suppliers").insert(suppliers.map(supplierToRow)).select();
  if (error) throw error;
  return (data || []).map(rowToSupplier);
}
export async function dbUpdateSupplier(supplier) {
  const { data, error } = await supabase.from("suppliers").update(supplierToRow(supplier)).eq("id", supplier.id).select().single();
  if (error) throw error;
  return rowToSupplier(data);
}
export async function dbDeleteSupplier(id) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------- PRODUCTS ---------------------------------- */

export async function dbCreateProduct(product) {
  const { data, error } = await supabase.from("products").insert(productToRow(product)).select().single();
  if (error) throw error;
  return rowToProduct(data);
}
export async function dbCreateProducts(products) {
  if (!products.length) return [];
  const { data, error } = await supabase.from("products").insert(products.map(productToRow)).select();
  if (error) throw error;
  return (data || []).map(rowToProduct);
}
export async function dbUpdateProduct(product) {
  const { data, error } = await supabase.from("products").update(productToRow(product)).eq("id", product.id).select().single();
  if (error) throw error;
  return rowToProduct(data);
}
export async function dbDeleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------- ORDERS ---------------------------------- */

export async function dbCreateOrder(order) {
  const { error } = await supabase.from("orders").insert(orderToRow(order));
  if (error) throw error;
  return order;
}
export async function dbUpdateOrderStatus(id, status) {
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return rowToOrder(data);
}
export async function dbDeleteOrder(id) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------- STORAGE (product photos) ---------------------------------- */

export async function uploadProductPhoto(file, productId) {
  const ext = file.name.split(".").pop();
  const path = `${productId || "new"}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("product-photos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------------------------------- AUTH ---------------------------------- */

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}
export async function signOut() {
  await supabase.auth.signOut();
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/* ---------------------------------- PROFILES (customer accounts + admin role) ---------------------------------- */

const rowToProfile = (r) => ({
  id: r.id, email: r.email || "", role: r.role || "customer", fullName: r.full_name || "",
  phone: r.phone || "", addressLine1: r.address_line1 || "", addressLine2: r.address_line2 || "",
  city: r.city || "", postalCode: r.postal_code || "", country: r.country || "France",
  loyaltyPoints: r.loyalty_points || 0,
});

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

export async function upsertProfile(userId, profile) {
  const row = {
    id: userId, email: profile.email, full_name: profile.fullName, phone: profile.phone,
    address_line1: profile.addressLine1, address_line2: profile.addressLine2,
    city: profile.city, postal_code: profile.postalCode, country: profile.country,
  };
  const { data, error } = await supabase.from("profiles").upsert(row).select().single();
  if (error) throw error;
  return rowToProfile(data);
}

/* ---------------------------------- STRIPE CHECKOUT ---------------------------------- */

export async function createStripeCheckout({ orderId, items, customerEmail }) {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { orderId, items, customerEmail },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Session de paiement introuvable.");
  return data.url;
}

/* ---------------------------------- WISHLIST ---------------------------------- */

export async function fetchWishlist(userId) {
  const { data, error } = await supabase.from("wishlist_items").select("product_id").eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.product_id);
}
export async function addToWishlist(userId, productId) {
  const { error } = await supabase.from("wishlist_items").insert({ user_id: userId, product_id: productId });
  if (error && error.code !== "23505") throw error;
}
export async function removeFromWishlist(userId, productId) {
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("product_id", productId);
  if (error) throw error;
}

/* ---------------------------------- REVIEWS ---------------------------------- */

const rowToReview = (r) => ({
  id: r.id, productId: r.product_id, userId: r.user_id, authorName: r.author_name || "Client",
  rating: r.rating, comment: r.comment || "", createdAt: r.created_at,
});

export async function fetchReviews(productId) {
  const { data, error } = await supabase.from("reviews").select("*").eq("product_id", productId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToReview);
}
export async function fetchAllReviews() {
  const { data, error } = await supabase.from("reviews").select("*");
  if (error) throw error;
  return (data || []).map(rowToReview);
}
export async function upsertReview({ productId, userId, authorName, rating, comment }) {
  const { data, error } = await supabase
    .from("reviews")
    .upsert({ product_id: productId, user_id: userId, author_name: authorName, rating, comment }, { onConflict: "product_id,user_id" })
    .select()
    .single();
  if (error) throw error;
  return rowToReview(data);
}
