import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fails loudly at build/runtime rather than silently returning empty data everywhere —
  // easier to diagnose than a blank catalog with no error.
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

const rowToProduct = (r) => ({
  id: r.id, name: r.name, brandId: r.brand_id, category: r.category, gender: r.gender,
  price: Number(r.price), cost: Number(r.cost || 0), colorName: r.color_name || "", colorHex: r.color_hex || "#00F0FF",
  shape: r.shape || "square", calibre: r.calibre || "", material: r.material || "", stock: r.stock || "En stock",
  supplierId: r.supplier_id, featured: !!r.featured, description: r.description || "", photo: r.photo_url || "",
});
const productToRow = (p) => ({
  id: p.id, name: p.name, brand_id: p.brandId, category: p.category, gender: p.gender,
  price: p.price, cost: p.cost, color_name: p.colorName, color_hex: p.colorHex, shape: p.shape,
  calibre: p.calibre, material: p.material, stock: p.stock, supplier_id: p.supplierId,
  featured: p.featured, description: p.description, photo_url: p.photo,
});

const rowToOrder = (r) => ({ id: r.id, client: r.client, email: r.email, date: r.order_date, items: r.items || [], status: r.status });
const orderToRow = (o) => ({ id: o.id, client: o.client, email: o.email, order_date: o.date, items: o.items, status: o.status });

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
  // No .select() here on purpose: orders can be inserted by anonymous visitors (checkout),
  // but the read policy is admin-only — chaining .select() after insert would try to read the
  // row back under the same anon session and fail against RLS. The order object is already
  // fully formed client-side (id included), so we just return it as-is on success.
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
