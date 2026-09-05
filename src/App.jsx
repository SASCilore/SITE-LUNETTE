import React, { useState, useMemo, useRef, useEffect, useContext, createContext } from "react";
// Note: "three" is intentionally NOT statically imported here — it's a large 3D library only
// needed by the Glasses3D fallback (shown when a product has no real photo, which is now the
// rare case), so it's loaded on demand inside Glasses3D's effect instead of shipping it to every
// visitor's initial page load.
import Papa from "papaparse";
// Note: "xlsx" is intentionally NOT statically imported here — it's a large library only ever
// needed by the admin's Excel import, so it's loaded on demand (see handleFile below) instead of
// shipping it to every visitor of the public site.
import {
  ShoppingBag, X, Plus, Minus, Search, ChevronDown, ChevronRight,
  LayoutDashboard, Package, Tags, Truck, ClipboardList, LogOut,
  Trash2, Pencil, Check, ArrowRight, Menu, Filter, ArrowLeft, Building2, Sparkles, Sun, Moon,
  Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, XCircle, Image as ImageIcon, Loader2,
  User, MapPin, CreditCard, LogIn, UserPlus, Heart, Star, Scale,
} from "lucide-react";
import {
  fetchAllData, dbCreateBrand, dbCreateBrands, dbUpdateBrand, dbDeleteBrand,
  dbCreateSupplier, dbCreateSuppliers, dbUpdateSupplier, dbDeleteSupplier,
  dbCreateProduct, dbCreateProducts, dbUpdateProduct, dbDeleteProduct,
  dbCreateOrder, dbUpdateOrderStatus, dbDeleteOrder,
  uploadProductPhoto, signIn, signUp, signOut, getSession, onAuthChange,
  getProfile, upsertProfile, createStripeCheckout,
  fetchWishlist, addToWishlist, removeFromWishlist,
  fetchReviews, fetchAllReviews, upsertReview,
  validatePromoCode, fetchPromoCodes, createPromoCode, setPromoCodeActive, deletePromoCode,
} from "./lib/supabase.js";

/* ---------------------------------- THEME ---------------------------------- */

const NEON = { cyan: "#00F0FF", pink: "#FF2E88", lime: "#C8FF3D", orange: "#FF8A3D", violet: "#B36BFF", yellow: "#F4FF3D", blue: "#3D6DFF" };
const POS = NEON.lime;
const NEG = "#FF4D6D";
const PRIMARY = NEON.cyan;
const BRAND_ACCENT = { rb: NEON.cyan, ok: NEON.lime, pr: NEON.violet, ps: NEON.orange, gc: NEON.pink, ca: NEON.cyan };

function getPalette(dark) {
  return dark
    ? { bg: "#07080A", bg2: "#101317", bg3: "#181D22", text: "#F3F5F6", steel: "#9AA3AD", border: "rgba(154,163,173,0.16)", borderStrong: "rgba(154,163,173,0.26)", inputBg: "#181D22", sidebar: "#07080A" }
    : { bg: "#FAFAF8", bg2: "#FFFFFF", bg3: "#F1EFEA", text: "#14171B", steel: "#6B7480", border: "rgba(20,23,27,0.1)", borderStrong: "rgba(20,23,27,0.18)", inputBg: "#FFFFFF", sidebar: "#14171B" };
}

const ThemeCtx = createContext(null);
function useTheme() {
  return useContext(ThemeCtx);
}
function ThemeProvider({ children }) {
  const [dark, setDark] = useState(false);
  const p = getPalette(dark);
  return <ThemeCtx.Provider value={{ dark, p, toggle: () => setDark((d) => !d) }}>{children}</ThemeCtx.Provider>;
}

function ThemeToggle({ compact = false }) {
  const { dark, toggle, p } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Basculer le thème clair / sombre"
      className="btn-magnet flex items-center gap-2 rounded-full transition-colors"
      style={{ background: alpha(p.text, 0.06), border: `1px solid ${p.border}`, color: p.text, padding: compact ? "8px" : "6px 14px 6px 6px" }}
    >
      <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: dark ? "#181D22" : "#FFF2D6" }}>
        {dark ? <Moon size={14} style={{ color: NEON.cyan }} /> : <Sun size={14} style={{ color: "#D98A00" }} />}
      </span>
      {!compact && <span className="text-xs font-medium pr-1">{dark ? "Sombre" : "Clair"}</span>}
    </button>
  );
}

/* Les données produits/marques/fournisseurs/commandes vivent désormais dans Supabase
   (voir supabase/schema.sql). Elles sont chargées au démarrage par Root via fetchAllData(). */

/* ---------------------------------- HELPERS ---------------------------------- */

const euro = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const newId = (prefix) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  // Fallback for very old browsers without crypto.randomUUID (non-HTTPS/non-localhost edge case).
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e9)}${Math.floor(Math.random() * 1e9)}`;
};
const alpha = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ---------------------------------- HOOKS ---------------------------------- */

function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function useCountUp(target, active, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const pr = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - pr, 3))));
      if (pr < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target]);
  return value;
}

function useTilt(strength = 9) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ transform: "perspective(800px) rotateX(0) rotateY(0)" });
  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setStyle({ transform: `perspective(800px) rotateX(${(py - 0.5) * -strength}deg) rotateY(${(px - 0.5) * strength}deg) translateZ(0)`, transition: "transform .12s ease-out" });
  };
  const onMouseLeave = () => setStyle({ transform: "perspective(800px) rotateX(0) rotateY(0)", transition: "transform .5s cubic-bezier(.2,.8,.2,1)" });
  return { ref, style, onMouseMove, onMouseLeave };
}

// Desktop-only: while hovering a product card, cycles through its other photos so a shopper sees
// more of the product without clicking. No-op (and harmless) on touch, since touch never fires
// mouseenter — it simply won't animate there, no separate code path needed.
function useHoverCyclePhotos(photos) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const start = () => {
    if (!photos || photos.length <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % photos.length), 750);
  };
  const stop = () => {
    clearInterval(timerRef.current);
    setIndex(0);
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return { index, start, stop };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Returns 0->1 progress of how far the viewport has scrolled through a tall section.
function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0);
  const reduced = useRef(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced.current) return;
    let raf = null;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const pr = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      setProgress(pr);
      raf = null;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return progress;
}

/* ---------------------------------- GLOBAL STYLE ---------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
      .mtr { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; transition: background-color .4s ease; }
      .mtr-display { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
      .mtr-mono { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace; }
      .mtr *:focus-visible { outline: 2px solid ${NEON.cyan}; outline-offset: 2px; }
      .mtr-input::placeholder { color: inherit; opacity: .4; }

      .reveal { opacity: 0; transform: translateY(28px); transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1); }
      .reveal.visible { opacity: 1; transform: none; }

      .lens-fill { opacity: .55; transition: opacity .5s ease, transform .6s ease; }
      .glyph-card:hover .lens-fill { opacity: .85; transform: scale(1.03); }
      .holo-fill { animation: hueCycle 5s linear infinite; }
      @keyframes hueCycle { from { filter: hue-rotate(0deg) saturate(1.3); } to { filter: hue-rotate(360deg) saturate(1.3); } }

      .chroma { text-shadow: -3px 0 rgba(0,240,255,.75), 3px 0 rgba(255,46,136,.75), 0 3px rgba(244,255,61,.55); animation: chromaShift 4.5s ease-in-out infinite; }
      @keyframes chromaShift {
        0%, 100% { text-shadow: -3px 0 rgba(0,240,255,.75), 3px 0 rgba(255,46,136,.75), 0 3px rgba(244,255,61,.55); }
        50% { text-shadow: -1.5px 0 rgba(0,240,255,.5), 1.5px 0 rgba(255,46,136,.5), 0 1.5px rgba(244,255,61,.35); }
      }

      .hairline { height:1px; }
      .scroll-thin::-webkit-scrollbar { height: 6px; width: 6px; }
      .scroll-thin::-webkit-scrollbar-thumb { background: rgba(154,163,173,.4); border-radius: 4px; }

      .mesh-bg { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
      .mesh-blob { position:absolute; border-radius:9999px; filter: blur(80px); mix-blend-mode: screen; animation: meshDrift 22s ease-in-out infinite; }
      @keyframes meshDrift {
        0%, 100% { transform: translate(0,0) scale(1); }
        33% { transform: translate(34px,-26px) scale(1.1); }
        66% { transform: translate(-26px,20px) scale(0.94); }
      }

      .grain::before {
        content:""; position:fixed; inset:0; pointer-events:none; z-index:60; opacity:.035; mix-blend-mode:overlay;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }

      .neon-border { transition: box-shadow .35s ease, border-color .35s ease; }
      .neon-border:hover { border-color: var(--edge) !important; box-shadow: 0 0 0 1px var(--edge), 0 0 30px -6px var(--edge); }

      .spot { position:absolute; inset:0; pointer-events:none; transition: opacity .3s ease; mix-blend-mode: screen; }
      .glint { position:absolute; border-radius:9999px; animation: glintFloat 6.5s ease-in-out infinite; }
      @keyframes glintFloat { 0%,100% { transform: translateY(0) scale(1); opacity:.55; } 50% { transform: translateY(-18px) scale(1.25); opacity:1; } }

      .announce-text {
        background-image: linear-gradient(90deg, ${NEON.cyan}, ${NEON.pink} 33%, ${NEON.lime} 66%, ${NEON.cyan});
        background-size: 200% 100%;
        -webkit-background-clip: text; background-clip: text; color: transparent;
        animation: announceSweep 5s linear infinite;
      }
      @keyframes announceSweep { from { background-position: 0% 0; } to { background-position: 200% 0; } }

      .btn-magnet { transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease; }

      /* Guarantees a real ≥44px tap target on touch devices for small icon-only buttons, without
         changing their visual (desktop-hover) size — the extra hit area is invisible padding. */
      .tap-target { position: relative; }
      .tap-target::before {
        content: ""; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: max(100%, 44px); height: max(100%, 44px);
      }

      /* Click ripple — deliberately does NOT set overflow:hidden on the target, which would clip
         the neon glow box-shadows used throughout the site. The ripple simply fades within the
         button's bounds instead of being strictly masked; a tiny cosmetic overflow is a much
         smaller trade-off than losing every button's glow. */
      .mtr-ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.45); pointer-events: none; transform: scale(0); animation: mtrRippleAnim .55s ease-out; mix-blend-mode: overlay; }
      @keyframes mtrRippleAnim { to { transform: scale(1); opacity: 0; } }

      /* Page transition — plays once whenever the top-level page container remounts (React key
         change on navigation), giving each section switch a small sense of arrival rather than
         an abrupt cut. */
      .mtr-page-enter { animation: mtrPageEnter .5s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes mtrPageEnter { from { opacity: 0; transform: translateY(14px) scale(.99); } to { opacity: 1; transform: none; } }

      /* Add-to-cart confetti burst */
      .confetti-piece { position: fixed; top: 0; left: 0; width: 8px; height: 8px; pointer-events: none; z-index: 9998; border-radius: 2px; }
      @keyframes confettiBurst {
        0% { transform: translate(var(--x0), var(--y0)) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translate(var(--x1), var(--y1)) rotate(var(--rot)) scale(0.4); opacity: 0; }
      }
      .btn-magnet:hover { transform: translateY(-2px) scale(1.02); }

      .btn-neon { background: linear-gradient(90deg, var(--c1), var(--c2)); color: #07080A; box-shadow: 0 0 20px -6px var(--glow); animation: neonPulse 3.4s ease-in-out infinite; }
      @keyframes neonPulse { 0%,100% { box-shadow: 0 0 16px -6px var(--glow); } 50% { box-shadow: 0 0 32px -4px var(--glow); } }

      .card-lift { transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s ease; }
      .card-lift:hover { box-shadow: 0 20px 44px -18px rgba(0,0,0,.35); }

      .bar-fill { transition: width 1.1s cubic-bezier(.2,.8,.2,1); }

      /* Lens sweep reveal (brand strip signature) — glyph position drives a pixel-synced mask */
      .lens-reveal { position: relative; overflow: hidden; }
      .lens-row { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-around; padding: 0 4%; }
      .lens-row span { font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; font-size: clamp(1rem, 2.6vw, 1.55rem); white-space: nowrap; }
      .lens-row-masked {
        background: linear-gradient(90deg, ${NEON.cyan}, ${NEON.pink} 55%, ${NEON.lime});
        -webkit-background-clip: text; background-clip: text; color: transparent;
        -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
      }
      .lens-glyph-travel { position: absolute; left: 0; top: 50%; width: 130px; height: 60px; will-change: transform; filter: drop-shadow(0 0 16px rgba(0,240,255,.55)) drop-shadow(0 0 8px rgba(255,46,136,.35)); }

      @media (prefers-reduced-motion: reduce) {
        .reveal, .lens-fill, .mesh-blob, .glint, .btn-magnet, .card-lift, .bar-fill, .holo-fill, .chroma, .btn-neon, .lens-row-neon, .lens-glyph-travel { transition: none !important; animation: none !important; }
        .reveal { opacity: 1; transform: none; }
      }
    `}</style>
  );
}

/* ---------------------------------- GLASSES GLYPH ---------------------------------- */

function GlassesGlyph({ shape = "square", tint = NEON.cyan, stroke = "rgba(154,163,173,0.6)", holo = false }) {
  const round = shape === "round";
  const gid = useRef(`g${Math.random().toString(36).slice(2, 9)}`).current;
  const lensClass = `lens-fill${holo ? " holo-fill" : ""}`;

  // Wayfarer-inspired trapezoid lens: wider, raked browline top edge with a cut outer corner.
  const leftLens = "M24,18 L84,14 L92,32 L88,68 L32,74 L16,44 Z";
  const rightLens = "M176,18 L116,14 L108,32 L112,68 L168,74 L184,44 Z";

  return (
    <svg viewBox="0 0 200 90" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={tint} stopOpacity="1" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.4" />
        </radialGradient>
      </defs>
      {round ? (
        <g fill="none" stroke={stroke} strokeWidth="2.5">
          <ellipse cx="56" cy="45" rx="34" ry="30" />
          <ellipse cx="56" cy="45" rx="34" ry="30" className={lensClass} style={{ fill: `url(#${gid})`, stroke: "none" }} />
          <ellipse cx="144" cy="45" rx="34" ry="30" />
          <ellipse cx="144" cy="45" rx="34" ry="30" className={lensClass} style={{ fill: `url(#${gid})`, stroke: "none" }} />
          <path d="M90 40 Q100 32 110 40" />
          <path d="M22 42 L4 34" />
          <path d="M178 42 L196 34" />
        </g>
      ) : (
        <g fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
          <path d={leftLens} />
          <path d={leftLens} className={lensClass} style={{ fill: `url(#${gid})`, stroke: "none" }} />
          <path d={rightLens} />
          <path d={rightLens} className={lensClass} style={{ fill: `url(#${gid})`, stroke: "none" }} />
          {/* thick browline bar, signature of the wayfarer silhouette */}
          <path d="M84 14 L116 14" strokeWidth="3.5" />
          {/* nose bridge */}
          <path d="M92 32 Q100 24 108 32" />
          {/* temples + hinge rivets */}
          <path d="M16 44 L0 36" />
          <path d="M184 44 L200 36" />
          <circle cx="16" cy="44" r="2.2" fill={stroke} stroke="none" />
          <circle cx="184" cy="44" r="2.2" fill={stroke} stroke="none" />
        </g>
      )}
    </svg>
  );
}

// Shows the real product photo when one has been uploaded/imported; falls back to the illustrated
// glyph otherwise (e.g. freshly imported rows with no photo yet, or the demo brands).
function ProductVisual({ product, holo = false, stroke, className = "", photoIndex = 0 }) {
  const photos = product?.photos;
  const cover = photos && photos.length > 0 ? (photos[photoIndex] || photos[0]) : null;
  if (cover) {
    return (
      <img
        src={cover}
        alt={product.name || ""}
        className={`w-full h-full object-contain ${className}`}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return <GlassesGlyph shape={product?.shape} tint={product?.colorHex} stroke={stroke} holo={holo} />;
}

// Full gallery for the product detail modal: main image + thumbnail strip. Falls back to the
// illustrated glyph when the product has no photos at all. The main image can be dragged
// left/right for a live 3D-perspective tilt — not a true 360° spin (that needs a real multi-angle
// photoshoot or a 3D model, neither of which exist here), but it gives a satisfying sense of
// physically handling the object rather than looking at a flat picture.
function ProductGallery({ product, holo = false, stroke }) {
  const { p } = useTheme();
  const photos = product?.photos || [];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [product?.id]);

  const dragRef = useRef({ dragging: false, startX: 0, rotY: 0 });
  const imgRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});

  const applyTilt = (rotY, rotX = 6) => {
    setTiltStyle({ transform: `perspective(900px) rotateY(${rotY}deg) rotateX(${rotX}deg)`, transition: dragRef.current.dragging ? "none" : "transform .5s cubic-bezier(.2,.8,.2,1)" });
  };

  const onPointerDown = (e) => {
    dragRef.current = { dragging: true, startX: e.clientX, rotY: dragRef.current.rotY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const delta = e.clientX - dragRef.current.startX;
    const rotY = Math.max(-28, Math.min(28, dragRef.current.rotY + delta * 0.25));
    applyTilt(rotY);
  };
  const endDrag = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    dragRef.current.rotY = 0;
    applyTilt(0);
  };

  if (photos.length === 0) {
    return <GlassesGlyph shape={product?.shape} tint={product?.colorHex} stroke={stroke} holo={holo} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 min-h-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ WebkitUserSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <img ref={imgRef} src={photos[active]} alt={product.name || ""} draggable={false} className="max-w-full max-h-full object-contain" style={tiltStyle} />
      </div>
      <p className="text-center text-[10px] mtr-mono uppercase tracking-wide mt-1" style={{ color: p.steel }}>Glissez pour incliner</p>
      {photos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto scroll-thin pb-1">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="w-14 h-14 rounded-lg overflow-hidden shrink-0"
              style={{ border: `2px solid ${i === active ? PRIMARY : "transparent"}`, opacity: i === active ? 1 : 0.6 }}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---------------------------------- SMALL UI ATOMS ---------------------------------- */

/* ---------------------------------- GLASSES 3D (realistic model, hero + scroll story) ---------------------------------- */

function buildWayfarerGroup3D(tintColor, THREE) {
  const group = new THREE.Group();
  const toXY = (sx, sy) => [sx - 100, -(sy - 45)];

  const centroid = (pts) => {
    let cx = 0, cy = 0;
    pts.forEach(([x, y]) => { cx += x; cy += y; });
    return [cx / pts.length, cy / pts.length];
  };
  const scaleAround = (pts, factor) => {
    const [cx, cy] = centroid(pts);
    return pts.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
  };
  const toVec2 = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.22, metalness: 0.55, emissive: tintColor, emissiveIntensity: 0.07, envMapIntensity: 1.3 });

  const makeLensGroup = (rawPts) => {
    const outer = scaleAround(rawPts, 1.24);
    const hole = scaleAround(rawPts, 0.90);
    const lensPts = scaleAround(rawPts, 0.88);

    const rimShape = new THREE.Shape(toVec2(outer));
    rimShape.holes.push(new THREE.Path(toVec2(hole)));
    // bevelSegments:1 keeps a crisp chamfer (chunky acetate) instead of a soft, "melted" rounded edge
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 16, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1, curveSegments: 1 });
    rimGeo.center();
    const rimMesh = new THREE.Mesh(rimGeo, frameMat);
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;

    const lensShape = new THREE.Shape(toVec2(lensPts));
    const lensGeo = new THREE.ExtrudeGeometry(lensShape, { depth: 5, bevelEnabled: false, curveSegments: 1 });
    lensGeo.center();
    const lensMat = new THREE.MeshPhysicalMaterial({ color: tintColor, transparent: true, opacity: 0.46, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, reflectivity: 0.6, emissive: tintColor, emissiveIntensity: 0.04, envMapIntensity: 1.6, side: THREE.DoubleSide });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.userData.isLens = true;
    lensMesh.castShadow = true;

    const g = new THREE.Group();
    g.add(rimMesh);
    g.add(lensMesh);
    const [ccx, ccy] = centroid(rawPts);
    g.position.set(ccx, ccy, 0);
    return g;
  };

  // Wayfarer silhouette: flat horizontal brow edge, a pointed kick-up at the outer/hinge corner, rounded bottom.
  const leftSvg = [[16, 22], [22, 14], [86, 16], [94, 34], [88, 66], [66, 76], [28, 74], [12, 50]];
  const rawLeft = leftSvg.map(([x, y]) => toXY(x, y));
  const rawRight = leftSvg.map(([x, y]) => toXY(200 - x, y));

  group.add(makeLensGroup(rawLeft));
  group.add(makeLensGroup(rawRight));

  const brow = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 13), frameMat);
  brow.position.set(0, 30, 3);
  brow.castShadow = true; brow.receiveShadow = true;
  group.add(brow);

  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 16, 8), frameMat);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 8, 3);
  bridge.castShadow = true;
  group.add(bridge);

  const templeGeo = new THREE.BoxGeometry(32, 4, 6);
  const leftTemple = new THREE.Mesh(templeGeo, frameMat);
  leftTemple.position.set(-84, 3, -18);
  leftTemple.rotation.y = 0.42;
  leftTemple.castShadow = true; leftTemple.receiveShadow = true;
  group.add(leftTemple);
  const rightTemple = new THREE.Mesh(templeGeo, frameMat);
  rightTemple.position.set(84, 3, -18);
  rightTemple.rotation.y = -0.42;
  rightTemple.castShadow = true; rightTemple.receiveShadow = true;
  group.add(rightTemple);

  const hingeGeo = new THREE.CylinderGeometry(3.6, 3.6, 15, 10);
  const leftHinge = new THREE.Mesh(hingeGeo, frameMat);
  leftHinge.position.set(-82, 3, 0);
  leftHinge.castShadow = true;
  group.add(leftHinge);
  const rightHinge = new THREE.Mesh(hingeGeo, frameMat);
  rightHinge.position.set(82, 3, 0);
  rightHinge.castShadow = true;
  group.add(rightHinge);

  group.scale.setScalar(1.4);
  return group;
}

// Realistic 3D glasses rendered with WebGL. mode: "idle" (gentle sway), "mouse" (follows cursor), "scroll" (rotation driven by 0-1 progress prop).
// A constant 3/4 base angle is applied in every mode: viewed dead-on, this shape is nearly symmetric and shallow,
// so it reads as flat/cartoonish. An angled resting pose (like real product photography) is what actually sells the volume.
const BASE_ROT_Y = 0.38;
const BASE_ROT_X = -0.14;

function Glasses3D({ tint = NEON.cyan, mode = "idle", progress = 0, height = 260, className = "" }) {
  const mountRef = useRef(null);
  const liveRef = useRef({ progress, mouse: { x: 0, y: 0 } });

  useEffect(() => { liveRef.current.progress = progress; }, [progress]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (cancelled || !mountRef.current) return;
      const width = mount.clientWidth || 400;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 1, 2000);
      camera.position.set(12, 20, 340);
      camera.lookAt(0, 4, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Fake "studio" environment (gradient sky + a couple of bright softbox panels) baked into a
      // reflection map. This is what actually sells "3D render" over "flat colored shape": without it,
      // matte/glossy materials have nothing to reflect and read as flat vector art regardless of lighting.
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(60, 24, 16);
      const posAttr = skyGeo.attributes.position;
      const skyColors = [];
      const topC = new THREE.Color(0xbfe4ff);
      const botC = new THREE.Color(0x050608);
      for (let i = 0; i < posAttr.count; i++) {
        const t = (posAttr.getY(i) + 60) / 120;
        const c = botC.clone().lerp(topC, t);
        skyColors.push(c.r, c.g, c.b);
      }
      skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(skyColors, 3));
      envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const softbox1 = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      softbox1.position.set(28, 22, -20); softbox1.lookAt(0, 0, 0);
      envScene.add(softbox1);
      const softbox2 = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint) }));
      softbox2.position.set(-24, -10, 18); softbox2.lookAt(0, 0, 0);
      envScene.add(softbox2);
      const envMap = pmrem.fromScene(envScene, 0.03).texture;
      pmrem.dispose();
      scene.environment = envMap;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.38));

      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(140, 180, 220);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -260; key.shadow.camera.right = 260;
      key.shadow.camera.top = 260; key.shadow.camera.bottom = -260;
      key.shadow.camera.near = 50; key.shadow.camera.far = 600;
      key.shadow.bias = -0.001;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x88c8ff, 0.3);
      fill.position.set(-160, -30, 80);
      scene.add(fill);

      // Rim/back light: separates the silhouette from the background — the single biggest cue that reads as "3D object" vs "flat sticker".
      scene.add(new THREE.HemisphereLight(0x99ccff, 0x0a0a0c, 0.5));

      const rim = new THREE.DirectionalLight(0xffffff, 1.8);
      rim.position.set(-60, 80, -220);
      scene.add(rim);

      const accent = new THREE.PointLight(new THREE.Color(tint), 0.45, 700);
      accent.position.set(40, 50, 200);
      scene.add(accent);

      const group = buildWayfarerGroup3D(new THREE.Color(tint), THREE);
      scene.add(group);

      // Contact shadow on an invisible ground plane — grounds the object and reinforces depth.
      const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.ShadowMaterial({ opacity: 0.32 }));
      shadowFloor.rotation.x = -Math.PI / 2;
      shadowFloor.position.y = -58;
      shadowFloor.receiveShadow = true;
      scene.add(shadowFloor);

      const onMouseMove = (e) => {
        const r = mount.getBoundingClientRect();
        liveRef.current.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        liveRef.current.mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      };
      if (mode === "mouse") mount.addEventListener("mousemove", onMouseMove);

      let raf;
      const clock = new THREE.Clock();
      const animate = () => {
        const t = clock.getElapsedTime();
        if (mode === "idle") {
          group.rotation.y = BASE_ROT_Y + Math.sin(t * 0.35) * 0.16;
          group.rotation.x = BASE_ROT_X + Math.sin(t * 0.5) * 0.03;
        } else if (mode === "mouse") {
          const { x, y } = liveRef.current.mouse;
          const targetY = BASE_ROT_Y + x * 0.4;
          const targetX = BASE_ROT_X - y * 0.16;
          group.rotation.y += (targetY - group.rotation.y) * 0.06;
          group.rotation.x += (targetX - group.rotation.x) * 0.06;
        } else if (mode === "scroll") {
          const pr = liveRef.current.progress;
          const targetY = BASE_ROT_Y - 0.55 + pr * 1.1;
          const targetX = BASE_ROT_X + 0.12 - pr * 0.12;
          group.rotation.y += (targetY - group.rotation.y) * 0.12;
          group.rotation.x += (targetX - group.rotation.x) * 0.12;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        const w = mount.clientWidth || width;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer.setSize(w, height);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        if (mode === "mouse") mount.removeEventListener("mousemove", onMouseMove);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        });
        renderer.dispose();
        if (envMap) envMap.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    });

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tint]);

  return <div ref={mountRef} className={className} style={{ width: "100%", height }} />;
}

function Eyebrow({ children, color = PRIMARY }) {
  const { p } = useTheme();
  return (
    <div className="mtr-mono text-[11px] uppercase tracking-[0.2em] mb-2 flex items-center gap-2" style={{ color: alpha(p.text, 0.6) }}>
      <span className="w-4 h-px" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {children}
    </div>
  );
}

function SpecRow({ label, value }) {
  const { p } = useTheme();
  return (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: p.border }}>
      <span className="mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: p.text }}>{value}</span>
    </div>
  );
}

// go2glass wordmark, built from real typography (not a flattened image) so it stays crisp at any
// size and follows the brand rules exactly: "go" outlined, "2" as a solid fluo badge, "glass"
// solid. Below 20px the outline closes into solid fill (per spec — a thin stroke doesn't read at
// small sizes), and the outline colour flips between the light/dark variants automatically.
function Logo({ size = 22, className = "", forceDark }) {
  const { dark: themeDark } = useTheme();
  const dark = forceDark !== undefined ? forceDark : themeDark;
  const strokeColor = dark ? "#DFFF1E" : "#B8D900";
  const glassColor = "#DFFF1E";
  const inkColor = dark ? "#F4F1EA" : "#14161A";
  const small = size < 20;
  const fontStyle = { fontFamily: "'Archivo', sans-serif", fontWeight: 800, letterSpacing: "-0.035em", fontSize: size, lineHeight: 1 };
  return (
    <span className={`inline-flex items-center ${className}`} style={fontStyle}>
      <span style={small ? { color: inkColor } : { color: "transparent", WebkitTextStroke: `${Math.max(size * 0.035, 0.6)}px ${strokeColor}`, textStroke: `${Math.max(size * 0.035, 0.6)}px ${strokeColor}` }}>go</span>
      <span className="inline-flex items-center justify-center" style={{ background: glassColor, color: "#14161A", borderRadius: "0.22em", width: "1em", height: "1em", fontSize: "0.92em", margin: "0 0.06em" }}>2</span>
      <span style={{ color: inkColor }}>glass</span>
    </span>
  );
}

function Pill({ children, style, className = "" }) {
  return <span className={`mtr-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${className}`} style={style}>{children}</span>;
}

// Displays the selling price, and — only when a genuine reference price is set on the product
// (never fabricated) — a struck-through original price and a "-X%" badge next to it.
function PriceTag({ price, compareAt, className = "font-bold", color }) {
  const { p } = useTheme();
  const hasDiscount = compareAt && compareAt > price;
  const pct = hasDiscount ? Math.round((1 - price / compareAt) * 100) : 0;
  return (
    <span className="inline-flex items-baseline gap-2 flex-wrap">
      <span className={className} style={{ color: color || (hasDiscount ? NEON.pink : p.text) }}>{euro(price)}</span>
      {hasDiscount && (
        <>
          <span className="text-sm line-through" style={{ color: p.steel }}>{euro(compareAt)}</span>
          <span className="mtr-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: alpha(NEON.pink, 0.18), color: NEON.pink, boxShadow: `0 0 8px ${alpha(NEON.pink, 0.4)}` }}>-{pct}%</span>
        </>
      )}
    </span>
  );
}

function ShippingBadge({ size = 11 }) {
  return (
    <span className="mtr-mono inline-flex items-center gap-1 font-bold uppercase tracking-wide" style={{ fontSize: size, color: NEON.pink }}>
      <Truck size={size + 2} /> Livraison incluse
    </span>
  );
}

function PriceMatchBadge({ size = 11 }) {
  return (
    <span className="mtr-mono inline-flex items-center gap-1 font-bold uppercase tracking-wide" style={{ fontSize: size, color: NEON.yellow }}>
      <Sparkles size={size + 2} /> Meilleur prix garanti
    </span>
  );
}

// Renders only badges backed by real data — no invented numbers. `insights` comes from
// productInsights in Root (computed from actual paid orders / creation date / real stock count).
function ProductBadges({ insights, className = "" }) {
  if (!insights) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {insights.isBestSeller && <Pill style={{ background: alpha(NEON.orange, 0.16), color: NEON.orange }}>★ Best-seller</Pill>}
      {insights.isNew && <Pill style={{ background: alpha(NEON.blue, 0.16), color: NEON.blue }}>Nouveau</Pill>}
      {insights.lowStock && <Pill style={{ background: alpha(NEG, 0.16), color: NEG }}>Plus que {insights.stockQuantity} en stock</Pill>}
    </div>
  );
}

function NeonButton({ children, onClick, disabled, className = "", c1 = NEON.cyan, c2 = NEON.pink }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn-neon btn-magnet font-semibold text-sm disabled:opacity-40 disabled:animate-none ${className}`} style={{ "--c1": c1, "--c2": c2, "--glow": alpha(c1, 0.55) }}>
      {children}
    </button>
  );
}

// Ambient neon color wash for a section background. On dark surfaces "screen" blending makes it glow;
// on light surfaces screen barely shows at all (screening onto near-white stays near-white), so we
// switch to "multiply" and raise the opacity there — that's what keeps the fluo identity present even
// in light mode instead of it washing out to near-invisible pastels.
function SectionGlow({ variant = "default" }) {
  const { dark } = useTheme();
  const blend = dark ? "screen" : "multiply";
  const op1 = dark ? 0.16 : 0.4;
  const op2 = dark ? 0.14 : 0.34;
  const layout = variant === "corners"
    ? [{ w: 340, h: 340, t: -110, l: -70 }, { w: 300, h: 300, b: -120, r: -60 }]
    : [{ w: 300, h: 300, t: -90, r: -60 }, { w: 260, h: 260, b: -100, l: -70 }];
  return (
    <div className="mesh-bg">
      <div className="mesh-blob" style={{ width: layout[0].w, height: layout[0].h, top: layout[0].t, left: layout[0].l, right: layout[0].r, background: NEON.cyan, opacity: op1, mixBlendMode: blend }} />
      <div className="mesh-blob" style={{ width: layout[1].w, height: layout[1].h, bottom: layout[1].b, left: layout[1].l, right: layout[1].r, background: NEON.pink, opacity: op2, mixBlendMode: blend, animationDelay: "-9s" }} />
    </div>
  );
}

/* ---------------------------------- PUBLIC: HEADER ---------------------------------- */

function AnnounceBar() {
  return (
    <div className="relative overflow-hidden py-2.5 text-center" style={{ background: "#07080A" }}>
      <div className="mesh-bg">
        <div className="mesh-blob" style={{ width: 260, height: 260, top: -110, left: "8%", background: NEON.cyan, opacity: 0.22, mixBlendMode: "screen" }} />
        <div className="mesh-blob" style={{ width: 260, height: 260, top: -110, right: "8%", background: NEON.pink, opacity: 0.2, mixBlendMode: "screen", animationDelay: "-8s" }} />
      </div>
      <p className="relative mtr-mono announce-text text-[11px] md:text-xs font-bold uppercase tracking-[0.16em] px-4">
        💸 Parmi les prix les plus bas du marché · Prix discount toute l'année · Livraison incluse 💸
      </p>
    </div>
  );
}

function SiteHeader({ page, setPage, onGoCategory, cartCount, onOpenCart, onGoAdmin, mobileOpen, setMobileOpen, session, loyaltyPoints, wishlistCount, onOpenWishlist, onOpenAccount, onOpenSearch }) {
  const { p } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const NavLink = ({ target, children }) => (
    <button onClick={() => { setPage(target); setMobileOpen(false); window.scrollTo({ top: 0 }); }} className="relative text-sm tracking-wide transition-colors py-1 whitespace-nowrap" style={{ color: page === target ? p.text : alpha(p.text, 0.5) }}>
      {children}
      {page === target && <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: PRIMARY, boxShadow: `0 0 6px ${PRIMARY}` }} />}
    </button>
  );

  const CategoryLink = ({ category, gender, children }) => (
    <button onClick={() => { onGoCategory(category, gender); setMobileOpen(false); }} className="text-sm tracking-wide transition-colors whitespace-nowrap" style={{ color: alpha(p.text, 0.55) }}>
      {children}
    </button>
  );

  const categories = [
    { category: "Solaire", gender: "Femme", label: "Solaire Femme" },
    { category: "Optique", gender: "Femme", label: "Vue Femme" },
    { category: "Solaire", gender: "Homme", label: "Solaire Homme" },
    { category: "Optique", gender: "Homme", label: "Vue Homme" },
  ];

  return (
    <header className="sticky top-0 z-40 transition-all duration-300" style={{ background: scrolled ? alpha(p.bg, 0.75) : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", WebkitBackdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: scrolled ? `1px solid ${p.border}` : "1px solid transparent" }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-6">
        <button onClick={() => { setPage("home"); window.scrollTo({ top: 0 }); }} className="shrink-0">
          <Logo size={24} />
        </button>
        <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5">
          <NavLink target="home">Accueil</NavLink>
          {categories.map((c) => <CategoryLink key={c.label} category={c.category} gender={c.gender}>{c.label}</CategoryLink>)}
          <NavLink target="marques">Marques</NavLink>
          <NavLink target="apropos">À propos</NavLink>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onOpenSearch} className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-full text-xs" style={{ background: alpha(p.text, 0.06), color: p.steel }} aria-label="Recherche instantanée">
            <Search size={14} /> <span className="mtr-mono">⌘K</span>
          </button>
          <div className="hidden lg:block"><ThemeToggle compact /></div>
          {session && (
            <span className="hidden md:inline-flex items-center gap-1.5 mtr-mono text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: alpha(NEON.orange, 0.14), color: NEON.orange }}>
              <Sparkles size={12} /> {loyaltyPoints} pts
            </span>
          )}
          <button onClick={onGoAdmin} className="hidden lg:block text-xs mtr-mono uppercase tracking-wide" style={{ color: alpha(p.text, 0.4) }}>Espace pro</button>
          <button onClick={onOpenAccount} className="btn-magnet p-2.5 rounded-full" style={{ color: p.text, background: alpha(p.text, 0.06) }} aria-label="Mon compte">
            <User size={19} />
          </button>
          <button onClick={onOpenWishlist} className="btn-magnet relative p-2.5 rounded-full" style={{ color: p.text, background: alpha(p.text, 0.06) }} aria-label="Liste d'envies">
            <Heart size={19} />
            {wishlistCount > 0 && <span className="absolute -top-1 -right-1 text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold" style={{ background: NEON.pink, color: "#07080A" }}>{wishlistCount}</span>}
          </button>
          <button onClick={onOpenCart} className="btn-magnet relative p-2.5 rounded-full" style={{ color: p.text, background: alpha(p.text, 0.06) }} aria-label="Ouvrir le panier">
            <ShoppingBag size={19} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold" style={{ background: PRIMARY, color: "#07080A", boxShadow: `0 0 10px ${PRIMARY}` }}>{cartCount}</span>}
          </button>
          <button className="lg:hidden p-2" style={{ color: p.text }} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden px-5 pb-5 flex flex-col gap-4" style={{ background: p.bg }}>
          <NavLink target="home">Accueil</NavLink>
          <div className="pl-1 flex flex-col gap-3 py-1" style={{ borderLeft: `2px solid ${alpha(PRIMARY, 0.3)}` }}>
            {categories.map((c) => (
              <button key={c.label} onClick={() => { onGoCategory(c.category, c.gender); setMobileOpen(false); }} className="text-sm pl-3 text-left" style={{ color: alpha(p.text, 0.65) }}>{c.label}</button>
            ))}
          </div>
          <NavLink target="marques">Marques</NavLink>
          <NavLink target="apropos">À propos</NavLink>
          <button onClick={() => { onGoAdmin(); setMobileOpen(false); }} className="text-xs mtr-mono uppercase tracking-wide text-left" style={{ color: alpha(p.text, 0.4) }}>Espace pro</button>
          <ThemeToggle />
        </div>
      )}
    </header>
  );
}

/* ---------------------------------- PUBLIC: HERO ---------------------------------- */

function Hero({ setPage, featured, brands, onOpenProduct }) {
  const { p, dark } = useTheme();
  const sectionRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 40, active: false });
  const blend = dark ? "screen" : "multiply";
  const boost = dark ? 1 : 1.7;
  const tilt = useTilt(7);
  const featuredBrand = featured ? brands.find((b) => b.id === featured.brandId) : null;
  const h1Ref = useRef(null);

  // Kinetic title: as the hero scrolls out of view, the headline gently rises, shrinks and
  // tightens its letter-spacing — a subtle sense of the page having real depth rather than a
  // static poster. Uses direct style mutation (not React state) so it stays perfectly smooth at
  // 60fps without triggering re-renders on every scroll tick.
  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current, h1 = h1Ref.current;
      if (!el || !h1) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.85)));
      h1.style.transform = `translateY(${progress * -34}px) scale(${1 - progress * 0.07})`;
      h1.style.opacity = String(1 - progress * 0.55);
      h1.style.letterSpacing = `${progress * 0.015}em`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onMove = (e) => {
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, active: true });
  };

  return (
    <section ref={sectionRef} onMouseMove={onMove} onMouseLeave={() => setSpot((s) => ({ ...s, active: false }))} className="relative overflow-hidden" style={{ background: p.bg }}>
      <div className="mesh-bg">
        <div className="mesh-blob" style={{ width: 440, height: 440, top: -140, left: -100, background: NEON.cyan, opacity: 0.22 * boost, mixBlendMode: blend }} />
        <div className="mesh-blob" style={{ width: 380, height: 380, bottom: -160, right: -80, background: NEON.pink, opacity: 0.22 * boost, mixBlendMode: blend, animationDelay: "-8s" }} />
        <div className="mesh-blob" style={{ width: 300, height: 300, top: "28%", right: "16%", background: NEON.lime, opacity: 0.13 * boost, mixBlendMode: blend, animationDelay: "-15s" }} />
      </div>
      <div className="spot" style={{ opacity: spot.active ? 1 : 0, background: `radial-gradient(360px circle at ${spot.x}% ${spot.y}%, rgba(0,240,255,0.16), rgba(255,46,136,0.12) 45%, transparent 70%)` }} />
      {[{ t: "12%", l: "62%", s: 6, c: NEON.cyan, d: "0s" }, { t: "68%", l: "48%", s: 4, c: NEON.pink, d: "-2.2s" }, { t: "38%", l: "82%", s: 5, c: NEON.lime, d: "-4.4s" }].map((g, i) => (
        <span key={i} className="glint" style={{ top: g.t, left: g.l, width: g.s, height: g.s, background: `radial-gradient(circle, ${g.c}, transparent 70%)`, animationDelay: g.d }} />
      ))}

      <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-20 pb-24 md:pt-28 md:pb-32 grid md:grid-cols-2 gap-14 items-center">
        <div className="reveal visible">
          <Eyebrow>Sélection multi-marques — pièces authentiques</Eyebrow>
          <h1 ref={h1Ref} className="mtr-display font-extrabold leading-[0.94]" style={{ color: p.text, fontSize: "clamp(2.75rem, 7vw, 4.75rem)", willChange: "transform, opacity" }}>
            Des montures<br />signées.<br /><span className="chroma">Point.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg max-w-md" style={{ color: alpha(p.text, 0.6) }}>
            Ray-Ban, Oakley, Prada, Persol, Gucci, Carrera — aux prix parmi les plus bas
            du marché, toute l'année. Chaque référence vérifiée. Pas de contrefaçon, pas de compromis.
          </p>
          <div className="mt-9 flex items-center gap-5 flex-wrap">
            <NeonButton onClick={() => setPage("catalogue")} className="px-7 py-3.5 rounded-full inline-flex items-center gap-2 group">
              Découvrir le catalogue <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </NeonButton>
            <button onClick={() => setPage("marques")} className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: p.text }}>Voir les marques <ChevronRight size={14} /></button>
          </div>
        </div>

        {featured ? (
          <button
            ref={tilt.ref}
            onMouseMove={tilt.onMouseMove}
            onMouseLeave={tilt.onMouseLeave}
            onClick={() => onOpenProduct && onOpenProduct(featured)}
            style={{ ...tilt.style, "--edge": NEON.cyan }}
            className="neon-border relative rounded-3xl p-6 md:p-10 text-left w-full"
          >
            <div className="absolute inset-0 rounded-3xl" style={{ background: alpha(p.text, 0.03), backdropFilter: "blur(6px)", border: `1px solid ${p.border}` }} />
            <div className="relative w-full flex items-center justify-center" style={{ height: 260 }}>
              <img src={featured.photos[0]} alt={featured.name} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="relative mt-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="mtr-display font-bold text-base md:text-lg truncate" style={{ color: p.text }}>{featuredBrand?.name} — {featured.name}</span>
              <span className="mtr-display font-bold text-base md:text-lg inline-flex items-center gap-1.5 shrink-0"><PriceTag price={featured.price} compareAt={featured.compareAtPrice} className="font-bold" color={NEON.cyan} /></span>
            </div>
            <div className="relative mt-1.5"><ShippingBadge /></div>
          </button>
        ) : (
          <div style={{ "--edge": NEON.cyan }} className="neon-border relative rounded-3xl p-6 md:p-10">
            <div className="absolute inset-0 rounded-3xl" style={{ background: alpha(p.text, 0.03), backdropFilter: "blur(6px)", border: `1px solid ${p.border}` }} />
            <div className="relative"><Glasses3D tint={NEON.cyan} mode="mouse" height={260} /></div>
            <div className="relative mt-2 flex items-center justify-between mtr-mono text-[11px] uppercase tracking-wide" style={{ color: alpha(p.text, 0.4) }}>
              <span>Réf. 58-14-135</span>
              <span className="inline-flex items-center gap-1"><Sparkles size={12} style={{ color: NEON.cyan }} /> Verres holo</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- PUBLIC: LENS-SWEEP BRAND REVEAL ---------------------------------- */

function ScrollGlassesStory({ featured }) {
  const { p } = useTheme();
  const sectionRef = useRef(null);
  const progress = useScrollProgress(sectionRef);

  const enter = smoothstep(0.03, 0.32, progress);
  const glow = smoothstep(0.26, 0.55, progress);
  const drift = Math.max(0, progress - 0.34) * -46;

  const translateY = (1 - enter) * -230 + drift;
  const rotY = (1 - enter) * -28 + Math.sin(progress * Math.PI * 1.4) * 7;
  const rotX = (1 - enter) * -10 + Math.sin(progress * Math.PI) * 3;
  const scale = 0.68 + 0.32 * enter;

  const stepOpacity = (inS, inE, outS, outE) => Math.min(smoothstep(inS, inE, progress), 1 - smoothstep(outS, outE, progress));
  const s1 = stepOpacity(0.06, 0.18, 0.30, 0.40);
  const s2 = stepOpacity(0.38, 0.48, 0.60, 0.70);
  const s3 = stepOpacity(0.66, 0.76, 0.92, 0.99);

  const StepCard = ({ n, title, text, style, opacity }) => (
    <div className="hidden md:block" style={{ position: "absolute", maxWidth: 400, opacity, transform: `translateY(${(1 - opacity) * 22}px)`, transition: "opacity .1s linear", ...style }}>
      <div className="mtr-mono text-base font-bold mb-3 tracking-wider" style={{ color: NEON.cyan, textShadow: `0 0 14px ${alpha(NEON.cyan, 0.7)}` }}>0{n}</div>
      <h3 className="mtr-display font-extrabold mb-3 leading-[1.05]" style={{ color: p.text, fontSize: "clamp(2rem, 3.4vw, 3rem)" }}>{title}</h3>
      <p className="font-medium" style={{ color: alpha(p.text, 0.78), fontSize: "clamp(1rem, 1.3vw, 1.2rem)" }}>{text}</p>
    </div>
  );

  return (
    <section ref={sectionRef} style={{ height: "320vh", position: "relative", background: p.bg }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mesh-bg">
          <div className="mesh-blob" style={{ width: 480, height: 480, top: "20%", left: "-15%", background: NEON.cyan, opacity: 0.1 + glow * 0.1 }} />
          <div className="mesh-blob" style={{ width: 420, height: 420, bottom: "10%", right: "-10%", background: NEON.pink, opacity: 0.08 + glow * 0.1, animationDelay: "-9s" }} />
        </div>

        <StepCard n={1} title="Repérez la monture" text="Parcourez une sélection resserrée des plus grandes maisons, sans bruit ni contrefaçon." style={{ left: "3%", top: "16%" }} opacity={s1} />
        <StepCard n={2} title="Regardez à travers" text="Chaque référence est vérifiée, chaque provenance tracée jusqu'au fournisseur agréé." style={{ right: "3%", top: "14%" }} opacity={s2} />
        <StepCard n={3} title="Elle arrive chez vous" text="Expédiée directement par nos partenaires, suivie de bout en bout jusqu'à votre porte." style={{ left: "50%", bottom: "4%", transform: `translate(-50%, ${(1 - s3) * 18}px)` }} opacity={s3} />

        {featured ? (
          <div
            style={{
              width: "min(92vw, 900px)",
              height: 520,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `perspective(1100px) translateY(${translateY}px) scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
              transformStyle: "preserve-3d",
              filter: `drop-shadow(0 0 ${14 + glow * 34}px rgba(0,240,255,${0.2 + glow * 0.35})) drop-shadow(0 0 ${8 + glow * 18}px rgba(255,46,136,${0.12 + glow * 0.25}))`,
            }}
          >
            <img src={featured.photos[0]} alt={featured.name} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div
            style={{
              width: "min(70vw, 460px)",
              transform: `translateY(${translateY}px) scale(${scale})`,
              filter: `drop-shadow(0 0 ${14 + glow * 34}px rgba(0,240,255,${0.2 + glow * 0.35})) drop-shadow(0 0 ${8 + glow * 18}px rgba(255,46,136,${0.12 + glow * 0.25}))`,
            }}
          >
            <Glasses3D tint={NEON.cyan} mode="scroll" progress={progress} height={220} />
          </div>
        )}

        <div className="absolute right-5 md:right-8 top-1/2 -translate-y-1/2 w-1 h-40 rounded-full overflow-hidden" style={{ background: alpha(p.text, 0.1) }}>
          <div style={{ height: `${progress * 100}%`, width: "100%", background: `linear-gradient(180deg, ${NEON.cyan}, ${NEON.pink})`, transition: "height .05s linear" }} />
        </div>
      </div>
    </section>
  );
}

function CategoryStrip({ onGoCategory, categoryProducts }) {
  const { p, dark } = useTheme();
  const [ref, visible] = useReveal(0.2);
  const tiles = [
    { category: "Solaire", gender: "Femme", label: "Solaire Femme", accent: NEON.pink },
    { category: "Optique", gender: "Femme", label: "Vue Femme", accent: NEON.blue },
    { category: "Solaire", gender: "Homme", label: "Solaire Homme", accent: NEON.cyan },
    { category: "Optique", gender: "Homme", label: "Vue Homme", accent: NEON.yellow },
  ];
  return (
    <section style={{ background: p.bg2 }} className="py-16 md:py-20">
      <div ref={ref} className={`reveal ${visible ? "visible" : ""} max-w-6xl mx-auto px-5 md:px-8`}>
        <Eyebrow>Parcourir par catégorie</Eyebrow>
        <h2 className="mtr-display text-3xl md:text-4xl font-bold mb-6" style={{ color: p.text }}>Quatre univers, un catalogue</h2>
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          {tiles.map((t, i) => {
            const key = `${t.category}_${t.gender}`;
            const product = categoryProducts?.[key];
            return (
              <button
                key={t.label}
                onClick={() => onGoCategory(t.category, t.gender)}
                className="neon-border card-lift group relative rounded-3xl text-left overflow-hidden"
                style={{ background: p.bg, border: `1px solid ${dark ? p.border : alpha(t.accent, 0.35)}`, "--edge": t.accent, height: "clamp(220px, 32vw, 340px)" }}
              >
                <div className="mesh-bg">
                  <div className="mesh-blob" style={{ width: 260, height: 260, top: -80, right: -60, background: t.accent, opacity: dark ? 0.22 : 0.4, mixBlendMode: dark ? "screen" : "multiply" }} />
                </div>
                {product?.photos?.[0] && (
                  <img
                    src={product.photos[0]}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain p-6 md:p-10 transition-transform duration-500 group-hover:scale-105"
                    style={{ opacity: 0.95 }}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-7" style={{ background: `linear-gradient(to top, ${alpha(p.bg, 0.92)}, ${alpha(p.bg, 0.55)} 60%, transparent)` }}>
                  <div className="mtr-mono text-[10px] uppercase tracking-wide mb-1.5" style={{ color: t.accent }}>0{i + 1}</div>
                  <div className="mtr-display font-extrabold leading-tight" style={{ color: p.text, fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)" }}>{t.label}</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold transition-transform group-hover:translate-x-1" style={{ color: t.accent }}>
                    Découvrir ma paire <ArrowRight size={15} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LensRevealBrands({ brands, setPage }) {
  const { p } = useTheme();
  const [sectionRef, visible] = useReveal(0.3);
  const containerRef = useRef(null);
  const glyphElRef = useRef(null);
  const maskElRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const GLYPH_W = 130, GLYPH_H = 60;
  // Lens centers/radii as fractions of the glyph's own box (matches the SVG viewBox 0 0 200 90 geometry)
  const LENS_CX = [56 / 200, 144 / 200];
  const LENS_CY = 45 / 90;
  const LENS_RX = (34 / 200) * 1.18;
  const LENS_RY = (30 / 90) * 1.18;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf;
    const duration = 5200;
    const start = performance.now();
    const loop = (now) => {
      const t = ((now - start) % duration) / duration; // 0 -> 1
      const travel = containerWidth + GLYPH_W;
      const xLeft = t * travel - GLYPH_W / 2; // px, glyph left edge relative to container
      const cx = xLeft + GLYPH_W / 2;
      const cy = GLYPH_H / 2 + (containerRef.current ? (containerRef.current.getBoundingClientRect().height - GLYPH_H) / 2 : 0);

      if (glyphElRef.current) {
        glyphElRef.current.style.transform = `translate(${xLeft}px, -50%)`;
      }
      if (maskElRef.current) {
        const c1x = xLeft + LENS_CX[0] * GLYPH_W;
        const c2x = xLeft + LENS_CX[1] * GLYPH_W;
        const cyPx = LENS_CY * GLYPH_H;
        const rx = LENS_RX * GLYPH_W;
        const ry = LENS_RY * GLYPH_H;
        const g1 = `radial-gradient(ellipse ${rx}px ${ry}px at ${c1x}px ${cyPx}px, #000 92%, transparent 100%)`;
        const g2 = `radial-gradient(ellipse ${rx}px ${ry}px at ${c2x}px ${cyPx}px, #000 92%, transparent 100%)`;
        const combined = `${g1}, ${g2}`;
        maskElRef.current.style.webkitMaskImage = combined;
        maskElRef.current.style.maskImage = combined;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, containerWidth]);

  return (
    <section style={{ background: p.bg2 }}>
      <div className="hairline" style={{ background: `linear-gradient(to right, transparent, ${p.border}, transparent)` }} />
      <div ref={sectionRef}>
        <div ref={containerRef} className="lens-reveal max-w-6xl mx-auto" style={{ height: 130 }}>
          <div className="lens-row">
            {brands.map((b) => (
              <span key={b.id} onClick={() => setPage("catalogue")} className="cursor-pointer" style={{ color: alpha(p.text, 0.26) }}>{b.name}</span>
            ))}
          </div>
          {visible && (
            <>
              <div ref={maskElRef} className="lens-row lens-row-masked pointer-events-none">
                {brands.map((b) => <span key={b.id}>{b.name}</span>)}
              </div>
              <div ref={glyphElRef} className="lens-glyph-travel" style={{ left: 0, top: "50%", transform: "translate(-100px,-50%)" }}>
                <GlassesGlyph shape="square" tint={NEON.cyan} stroke="rgba(255,255,255,0.9)" />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="hairline" style={{ background: `linear-gradient(to right, transparent, ${p.border}, transparent)` }} />
    </section>
  );
}

/* ---------------------------------- PUBLIC: PRODUCT CARD ---------------------------------- */

function ProductCard({ product, brand, onOpen, index = 0, insights, isWishlisted, onToggleWishlist }) {
  const { p, dark } = useTheme();
  const [ref, visible] = useReveal(0.1);
  const tilt = useTilt(8);
  const hoverPhotos = useHoverCyclePhotos(product.photos);
  const accent = BRAND_ACCENT[product.brandId] || PRIMARY;
  return (
    <div ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: `${(index % 4) * 70}ms` }}>
      <button
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseEnter={hoverPhotos.start}
        onMouseLeave={(e) => { tilt.onMouseLeave(e); hoverPhotos.stop(); }}
        onClick={() => onOpen(product)}
        className="glyph-card card-lift neon-border group relative text-left rounded-2xl overflow-hidden w-full"
        style={{ ...tilt.style, background: p.bg2, border: `1px solid ${dark ? p.border : alpha(accent, 0.4)}`, "--edge": accent }}
      >
        {!dark && <div style={{ height: 3, background: accent }} />}
        {onToggleWishlist && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggleWishlist(product.id); } }}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full btn-magnet"
            style={{ background: alpha(p.bg2, 0.85), backdropFilter: "blur(4px)" }}
            aria-label="Ajouter à la liste d'envies"
          >
            <Heart size={15} style={{ color: isWishlisted ? NEON.pink : p.steel, fill: isWishlisted ? NEON.pink : "none" }} />
          </div>
        )}
        <div className="relative p-6 pb-2">
          <ProductVisual product={product} stroke={alpha(p.text, 0.5)} photoIndex={hoverPhotos.index} />
          {product.photos && product.photos.length > 1 && (
            <div className="absolute bottom-1 inset-x-0 flex items-center justify-center gap-1">
              {product.photos.map((_, i) => (
                <span key={i} className="rounded-full transition-all" style={{ width: i === hoverPhotos.index ? 10 : 4, height: 4, background: i === hoverPhotos.index ? accent : alpha(p.text, 0.2) }} />
              ))}
            </div>
          )}
          <div className="absolute inset-x-4 bottom-1 text-center text-[11px] mtr-mono uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: accent }}>Voir la fiche →</div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="mtr-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
          <div className="mt-1 font-semibold" style={{ color: p.text }}>{product.name}</div>
          <div className="mt-1 mtr-mono text-[11px]" style={{ color: p.steel }}>{product.calibre} · {product.colorName}</div>
          {insights && (insights.isBestSeller || insights.isNew || insights.lowStock) && <ProductBadges insights={insights} className="mt-2" />}
          <div className="mt-3 flex items-center justify-between">
            <PriceTag price={product.price} compareAt={product.compareAtPrice} className="font-bold" />
            {product.stock !== "En stock" && <Pill style={{ background: alpha(NEG, 0.14), color: NEG }}>{product.stock}</Pill>}
          </div>
          <div className="mt-1.5"><ShippingBadge size={10} /></div>
        </div>
      </button>
    </div>
  );
}

// Generic horizontal product showcase, reused for "à la une", "récemment consulté" and
// "bientôt indisponible" — avoids duplicating the card markup three times.
function ProductRail({ title, eyebrow, eyebrowColor = NEON.pink, products, brands, onOpen, productInsights, wishlistIds, onToggleWishlist, holo = false }) {
  const { p } = useTheme();
  const [headRef, headVisible] = useReveal(0.3);
  if (!products.length) return null;
  return (
    <section style={{ background: p.bg }} className="py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div ref={headRef} className={`reveal ${headVisible ? "visible" : ""} flex items-end justify-between mb-10`}>
          <div>
            <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
            <h2 className="mtr-display text-3xl md:text-4xl font-bold" style={{ color: p.text }}>{title}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((pr, i) => {
            const tilt = useTilt(8);
            const accent = BRAND_ACCENT[pr.brandId] || PRIMARY;
            const brand = brands.find((b) => b.id === pr.brandId);
            const [ref, visible] = useReveal(0.1);
            const insights = productInsights?.[pr.id];
            return (
              <div key={pr.id} ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                <button ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} onClick={() => onOpen(pr)} className="glyph-card card-lift neon-border group relative text-left rounded-2xl overflow-hidden w-full" style={{ ...tilt.style, background: p.bg2, border: `1px solid ${p.border}`, "--edge": accent }}>
                  {onToggleWishlist && (
                    <div
                      role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onToggleWishlist(pr.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggleWishlist(pr.id); } }}
                      className="absolute top-3 right-3 z-10 p-1.5 rounded-full btn-magnet"
                      style={{ background: alpha(p.bg2, 0.85), backdropFilter: "blur(4px)" }}
                      aria-label="Ajouter à la liste d'envies"
                    >
                      <Heart size={15} style={{ color: wishlistIds?.includes(pr.id) ? NEON.pink : p.steel, fill: wishlistIds?.includes(pr.id) ? NEON.pink : "none" }} />
                    </div>
                  )}
                  <div className="relative p-6 pb-2"><ProductVisual product={pr} stroke={alpha(p.text, 0.5)} holo={holo} /></div>
                  <div className="px-5 pb-5 pt-2">
                    <div className="mtr-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
                    <div className="mt-1 font-semibold" style={{ color: p.text }}>{pr.name}</div>
                    <div className="mt-1 mtr-mono text-[11px]" style={{ color: p.steel }}>{pr.calibre} · {pr.colorName}</div>
                    {insights && (insights.isBestSeller || insights.isNew || insights.lowStock) && <ProductBadges insights={insights} className="mt-2" />}
                    <div className="mt-3"><PriceTag price={pr.price} compareAt={pr.compareAtPrice} className="font-bold" /></div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatItem({ value, suffix = "", label, active, color }) {
  const { p } = useTheme();
  const n = useCountUp(value, active);
  return (
    <div>
      <div className="mtr-display text-4xl md:text-5xl font-extrabold" style={{ color, textShadow: `0 0 18px ${alpha(color, 0.35)}` }}>{n}{suffix}</div>
      <div className="mt-2 text-sm" style={{ color: alpha(p.text, 0.55) }}>{label}</div>
    </div>
  );
}

function TrustBand() {
  const { p } = useTheme();
  const items = [
    { title: "Prix direct fournisseur", desc: "Aucun intermédiaire, aucun stock à financer : on répercute l'économie sur le prix, toute l'année.", accent: NEON.orange },
    { title: "Meilleur prix garanti", desc: "Trouvé moins cher ailleurs sur un modèle identique ? Contactez-nous, on vous rembourse la différence.", accent: NEON.yellow },
    { title: "Authenticité garantie", desc: "Chaque paire est vérifiée et accompagnée de son certificat fournisseur.", accent: NEON.cyan },
    { title: "Livraison suivie", desc: "Expédition trackée, délais annoncés fournisseur par fournisseur.", accent: NEON.pink },
    { title: "Livraison rapide", desc: "Commande préparée et expédiée sous 48h ouvrées par nos fournisseurs agréés.", accent: NEON.lime },
  ];
  const [ref, visible] = useReveal(0.25);
  const [statsRef, statsVisible] = useReveal(0.3);
  return (
    <section style={{ background: p.bg2, position: "relative", overflow: "hidden" }} className="py-20 md:py-24">
      <SectionGlow variant="corners" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-5 mb-16">
          {items.map((it, i) => (
            <div key={it.title} className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="mtr-mono text-xs mb-3" style={{ color: it.accent }}>0{i + 1}</div>
              <h3 className="mtr-display font-bold text-lg mb-2" style={{ color: p.text }}>{it.title}</h3>
              <p className="text-sm" style={{ color: alpha(p.text, 0.55) }}>{it.desc}</p>
            </div>
          ))}
        </div>
        <div ref={statsRef} className={`reveal ${statsVisible ? "visible" : ""} grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t`} style={{ borderColor: p.border }}>
          <StatItem value={6} label="Maisons référencées" active={statsVisible} color={NEON.cyan} />
          <StatItem value={1200} suffix="+" label="Paires livrées" active={statsVisible} color={NEON.pink} />
          <StatItem value={48} suffix="h" label="Délai d'expédition" active={statsVisible} color={NEON.yellow} />
          <StatItem value={98} suffix="%" label="Clients satisfaits" active={statsVisible} color={NEON.blue} />
        </div>
      </div>
    </section>
  );
}

function Footer({ setPage, onGoAdmin }) {
  const { p } = useTheme();
  return (
    <footer style={{ background: p.bg }} className="pt-14 pb-8 border-t" >
      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-10 grid md:grid-cols-4 gap-10">
        <div>
          <Logo size={22} />
          <p className="mt-3 text-sm max-w-xs" style={{ color: alpha(p.text, 0.45) }}>Lunettes de marque, sourcées auprès de grossistes agréés. Basé en France.</p>
        </div>
        <div>
          <div className="mtr-mono text-xs uppercase tracking-wide mb-3" style={{ color: p.steel }}>Boutique</div>
          <div className="flex flex-col gap-2 text-sm" style={{ color: alpha(p.text, 0.6) }}>
            <button onClick={() => setPage("catalogue")} className="text-left w-fit">Catalogue</button>
            <button onClick={() => setPage("marques")} className="text-left w-fit">Marques</button>
            <button onClick={() => setPage("apropos")} className="text-left w-fit">À propos</button>
          </div>
        </div>
        <div>
          <div className="mtr-mono text-xs uppercase tracking-wide mb-3" style={{ color: p.steel }}>Contact</div>
          <div className="flex flex-col gap-2 text-sm" style={{ color: alpha(p.text, 0.6) }}>
            <span>contact@monture-shop.fr</span>
            <span>Lun–Ven, 9h–18h</span>
          </div>
        </div>
        <div>
          <div className="mtr-mono text-xs uppercase tracking-wide mb-3" style={{ color: p.steel }}>Pro</div>
          <button onClick={onGoAdmin} className="text-sm" style={{ color: alpha(p.text, 0.6) }}>Espace pro / Admin</button>
          <div className="mt-4"><ThemeToggle /></div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 md:px-8 mt-10 text-xs" style={{ color: alpha(p.text, 0.28) }}>Prototype de démonstration — © 2026 go2glass. Données et visuels fictifs.</div>
    </footer>
  );
}

/* ---------------------------------- PUBLIC: CATALOGUE ---------------------------------- */

function CatalogPage({ products, brands, onOpen, initialFilter, productInsights, wishlistIds, onToggleWishlist }) {
  const { p } = useTheme();
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState([]);
  const [category, setCategory] = useState(initialFilter?.category || "Tous");
  const [gender, setGender] = useState(initialFilter?.gender || "Tous");
  const [priceRange, setPriceRange] = useState("Tous");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Re-syncs when the user clicks a different category link in the header while already on this
  // page — initialFilter is a fresh object each time goCategory() is called, so this fires even
  // if category/gender values happen to repeat.
  useEffect(() => {
    if (initialFilter) {
      setCategory(initialFilter.category || "Tous");
      setGender(initialFilter.gender || "Tous");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  const toggleBrand = (id) => setBrandFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const filtered = useMemo(() => {
    return products.filter((pr) => {
      const brand = brands.find((b) => b.id === pr.brandId);
      if (query && !`${pr.name} ${brand?.name}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (brandFilter.length && !brandFilter.includes(pr.brandId)) return false;
      if (category !== "Tous" && pr.category !== category) return false;
      if (gender !== "Tous" && pr.gender !== gender) return false;
      if (priceRange === "-50" && pr.price >= 50) return false;
      if (priceRange === "50-100" && (pr.price < 50 || pr.price > 100)) return false;
      if (priceRange === "100-150" && (pr.price < 100 || pr.price > 150)) return false;
      if (priceRange === "150+" && pr.price <= 150) return false;
      return true;
    });
  }, [products, brands, query, brandFilter, category, gender, priceRange]);

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.borderStrong}`, color: p.text };

  const FilterGroup = ({ title, children }) => (
    <div className="py-5 border-b" style={{ borderColor: p.border }}>
      <div className="mtr-mono text-[11px] uppercase tracking-wide mb-3" style={{ color: p.steel }}>{title}</div>
      {children}
    </div>
  );

  const RadioRow = ({ label, active, onClick }) => (
    <button onClick={onClick} className="flex items-center gap-2 text-sm mb-2" style={{ color: active ? p.text : alpha(p.text, 0.45) }}>
      <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors" style={{ borderColor: active ? PRIMARY : p.steel }}>
        {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIMARY, boxShadow: `0 0 6px ${PRIMARY}` }} />}
      </span>
      {label}
    </button>
  );

  const filtersPanel = (
    <div>
      <FilterGroup title="Marques">
        {brands.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm mb-2 cursor-pointer" style={{ color: alpha(p.text, 0.7) }}>
            <input type="checkbox" checked={brandFilter.includes(b.id)} onChange={() => toggleBrand(b.id)} style={{ accentColor: BRAND_ACCENT[b.id] || PRIMARY }} />
            {b.name}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Catégorie">{[["Tous", "Tous"], ["Solaire", "Solaire"], ["Optique", "Vue"]].map(([val, label]) => <RadioRow key={val} label={label} active={category === val} onClick={() => setCategory(val)} />)}</FilterGroup>
      <FilterGroup title="Genre">{["Tous", "Homme", "Femme", "Mixte"].map((g) => <RadioRow key={g} label={g} active={gender === g} onClick={() => setGender(g)} />)}</FilterGroup>
      <FilterGroup title="Prix">
        {[["Tous", "Tous"], ["-50", "Moins de 50 €"], ["50-100", "50 à 100 €"], ["100-150", "100 à 150 €"], ["150+", "Plus de 150 €"]].map(([val, label]) => (
          <RadioRow key={val} label={label} active={priceRange === val} onClick={() => setPriceRange(val)} />
        ))}
      </FilterGroup>
    </div>
  );

  return (
    <div style={{ background: p.bg, minHeight: "60vh", position: "relative", overflow: "hidden" }} className="py-12">
      <SectionGlow />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Eyebrow color={NEON.yellow}>Catalogue</Eyebrow>
            <h1 className="mtr-display text-3xl md:text-4xl font-bold" style={{ color: p.text }}>Toutes les montures</h1>
          </div>
          <button onClick={() => setFiltersOpen(true)} className="btn-magnet md:hidden flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ background: p.bg2, color: p.text, border: `1px solid ${p.borderStrong}` }}>
            <Filter size={14} /> Filtres
          </button>
        </div>

        <div className="mb-8 flex items-center gap-3 rounded-full px-4 py-3" style={inputStyle}>
          <Search size={16} style={{ color: p.steel }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une monture ou une marque…" className="mtr-input flex-1 outline-none text-sm bg-transparent" style={{ color: p.text }} />
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-10">
          <aside className="hidden md:block">{filtersPanel}</aside>
          <div>
            <div className="mb-4 text-sm" style={{ color: alpha(p.text, 0.45) }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</div>
            {filtered.length === 0 ? (
              <div className="py-20 text-center rounded-2xl" style={{ background: p.bg2, border: `1px dashed ${p.borderStrong}` }}>
                <p className="font-medium" style={{ color: p.text }}>Aucune monture ne correspond à ces filtres</p>
                <p className="text-sm mt-1" style={{ color: p.steel }}>Essayez d'élargir votre recherche.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filtered.map((pr, i) => <ProductCard key={pr.id} index={i} product={pr} brand={brands.find((b) => b.id === pr.brandId)} onOpen={onOpen} insights={productInsights?.[pr.id]} isWishlisted={wishlistIds?.includes(pr.id)} onToggleWishlist={onToggleWishlist} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm p-6 overflow-y-auto" style={{ background: p.bg }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold" style={{ color: p.text }}>Filtres</span>
              <button onClick={() => setFiltersOpen(false)}><X size={20} style={{ color: p.text }} /></button>
            </div>
            {filtersPanel}
            <NeonButton onClick={() => setFiltersOpen(false)} className="mt-4 w-full py-3 rounded-full">Voir {filtered.length} résultat{filtered.length > 1 ? "s" : ""}</NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- PUBLIC: MARQUES / A PROPOS ---------------------------------- */

function BrandsPage({ brands, products, setPage }) {
  const { p, dark } = useTheme();
  return (
    <div style={{ background: p.bg, minHeight: "60vh", position: "relative", overflow: "hidden" }} className="py-12">
      <SectionGlow variant="corners" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <Eyebrow color={NEON.blue}>Marques référencées</Eyebrow>
        <h1 className="mtr-display text-3xl md:text-4xl font-bold mb-10" style={{ color: p.text }}>Nos maisons partenaires</h1>
        <div className="grid md:grid-cols-2 gap-5">
          {brands.map((b, i) => {
            const count = products.filter((pr) => pr.brandId === b.id).length;
            const [ref, visible] = useReveal(0.2);
            const accent = BRAND_ACCENT[b.id] || PRIMARY;
            return (
              <button key={b.id} ref={ref} onClick={() => setPage("catalogue")} className={`neon-border card-lift reveal ${visible ? "visible" : ""} text-left p-6 rounded-2xl`} style={{ background: p.bg2, border: `1px solid ${dark ? p.border : alpha(accent, 0.4)}`, "--edge": accent, transitionDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between">
                  <h3 className="mtr-display text-2xl font-bold" style={{ color: p.text }}>{b.name}</h3>
                  <Pill style={{ background: alpha(accent, 0.14), color: accent }}>{count} référence{count > 1 ? "s" : ""}</Pill>
                </div>
                <p className="mt-2 text-sm mtr-mono uppercase tracking-wide" style={{ color: p.steel }}>{b.origin}</p>
                <p className="mt-3 text-sm" style={{ color: alpha(p.text, 0.55) }}>{b.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AboutPage({ setPage }) {
  const { p } = useTheme();
  return (
    <div style={{ background: p.bg, minHeight: "60vh", position: "relative", overflow: "hidden" }} className="py-12">
      <SectionGlow />
      <div className="relative max-w-3xl mx-auto px-5 md:px-8">
        <Eyebrow color={NEON.lime}>À propos</Eyebrow>
        <h1 className="mtr-display text-3xl md:text-4xl font-bold mb-6" style={{ color: p.text }}>Une monture, jamais une contrefaçon</h1>
        <p className="text-base leading-relaxed mb-4" style={{ color: alpha(p.text, 0.65) }}>
          go2glass référence uniquement des marques établies, sourcées auprès de grossistes et distributeurs agréés
          en France, en Italie et en Belgique. Nous ne stockons pas nous-mêmes le produit : chaque commande est
          transmise au fournisseur concerné, qui expédie directement au client.
        </p>
        <p className="text-base leading-relaxed mb-8" style={{ color: alpha(p.text, 0.65) }}>
          Ce fonctionnement nous permet de proposer un catalogue large sans immobiliser de stock, tout en gardant
          un contrôle strict sur l'origine des produits et les délais annoncés.
        </p>
        <NeonButton onClick={() => setPage("catalogue")} className="px-6 py-3 rounded-full inline-flex items-center gap-2">Voir le catalogue <ArrowRight size={16} /></NeonButton>
      </div>
    </div>
  );
}

/* ---------------------------------- PUBLIC: PRODUCT MODAL ---------------------------------- */

function StarRating({ value, size = 14, interactive = false, onChange }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className="inline-flex items-center gap-0.5">
      {stars.map((n) => (
        <Star
          key={n}
          size={size}
          onClick={interactive ? () => onChange(n) : undefined}
          className={interactive ? "cursor-pointer" : ""}
          style={{ color: NEON.orange, fill: n <= Math.round(value || 0) ? NEON.orange : "none" }}
        />
      ))}
    </span>
  );
}

function ReviewsSection({ product, reviews, session, onSubmitReview }) {
  const { p } = useTheme();
  const myReview = session ? reviews.find((r) => r.userId === session.user.id) : null;
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const submit = async () => {
    if (!rating) { setError("Choisissez une note."); return; }
    setSubmitting(true); setError("");
    try {
      await onSubmitReview({ productId: product.id, rating, comment: comment.trim() });
    } catch (err) {
      setError(err.message || "Échec de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t" style={{ borderColor: p.border }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="mtr-display font-bold text-lg" style={{ color: p.text }}>Avis clients</h3>
        {avg !== null && (
          <span className="flex items-center gap-2 text-sm" style={{ color: p.steel }}>
            <StarRating value={avg} /> {avg.toFixed(1)} ({reviews.length} avis)
          </span>
        )}
      </div>

      <div className="p-4 rounded-xl mb-5" style={{ background: p.bg3 }}>
        <div className="text-xs mtr-mono uppercase tracking-wide mb-2" style={{ color: p.steel }}>{myReview ? "Modifier mon avis" : "Laisser un avis"}</div>
        <StarRating value={rating} size={20} interactive onChange={setRating} />
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Votre avis sur ce produit (optionnel)…"
          className="w-full mt-3 px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${p.borderStrong}`, background: p.bg2, color: p.text }}
        />
        {error && <p className="text-xs mt-2" style={{ color: NEG }}>{error}</p>}
        <button onClick={submit} disabled={submitting} className="btn-magnet mt-3 px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50" style={{ background: p.text, color: p.bg }}>
          {submitting ? "Envoi…" : myReview ? "Mettre à jour" : "Publier mon avis"}
        </button>
        {!session && <p className="text-[11px] mt-2" style={{ color: p.steel }}>Connectez-vous pour publier un avis.</p>}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm" style={{ color: p.steel }}>Aucun avis pour le moment — soyez le premier à en laisser un.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="pb-4 border-b" style={{ borderColor: p.border }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: p.text }}>{r.authorName}</span>
                <StarRating value={r.rating} size={13} />
              </div>
              {r.comment && <p className="text-sm" style={{ color: alpha(p.text, 0.7) }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductModal({ product, brand, onClose, onAddToCart, insights, isWishlisted, onToggleWishlist, reviews, session, onSubmitReview, onView, isCompared, onToggleCompare }) {
  const { p } = useTheme();
  const [qty, setQty] = useState(1);
  useEffect(() => setQty(1), [product]);
  useEffect(() => { if (product) onView?.(product.id); }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SEO: dynamic page title + JSON-LD Product structured data (price, availability, rating) so
  // Google can show rich results. Note: this is a single-page app with no per-product URL, so a
  // search engine can index this content but can't deep-link straight to one product yet — real
  // per-product URLs would need client-side routing, a separate, bigger change.
  useEffect(() => {
    if (!product) return;
    const prevTitle = document.title;
    document.title = `${product.name} — ${euro(product.price)} | go2glass`;
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") || "";
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", product.description || `${product.name} — ${euro(product.price)}, livraison incluse. Authenticité garantie.`);

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "Product",
      name: product.name,
      image: product.photos && product.photos.length ? product.photos : undefined,
      description: product.description || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: product.price,
        availability: product.stock === "Rupture" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      },
      aggregateRating: insights?.avgRating != null ? { "@type": "AggregateRating", ratingValue: insights.avgRating.toFixed(1), reviewCount: insights.reviewCount } : undefined,
    });
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute("content", prevDesc);
      script.remove();
    };
  }, [product]);
  if (!product) return null;
  const accent = BRAND_ACCENT[product.brandId] || PRIMARY;
  const productReviews = (reviews || []).filter((r) => r.productId === product.id);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl" style={{ background: alpha(p.bg2, 0.75), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrPop { from { opacity:0; transform: translateY(24px) scale(.98);} to {opacity:1; transform:none;} }`}</style>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }}><X size={18} style={{ color: p.text }} /></button>
        {onToggleWishlist && (
          <button onClick={() => onToggleWishlist(product.id)} className="absolute top-4 right-16 z-10 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }} aria-label="Ajouter à la liste d'envies">
            <Heart size={18} style={{ color: isWishlisted ? NEON.pink : p.text, fill: isWishlisted ? NEON.pink : "none" }} />
          </button>
        )}
        {onToggleCompare && (
          <button onClick={() => onToggleCompare(product.id)} className="absolute top-4 right-28 z-10 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }} aria-label="Ajouter au comparateur">
            <Scale size={18} style={{ color: isCompared ? NEON.violet : p.text }} />
          </button>
        )}
        <div className="grid md:grid-cols-2">
          <div className="p-6 md:p-8 relative overflow-hidden" style={{ background: p.bg3 }}>
            <div className="mesh-bg"><div className="mesh-blob" style={{ width: 260, height: 260, top: -60, left: -40, background: product.colorHex, opacity: 0.3 }} /></div>
            <div className="relative aspect-square w-full max-h-[46vh] md:max-h-[420px] mx-auto"><ProductGallery product={product} stroke={alpha(p.text, 0.55)} holo /></div>
          </div>
          <div className="p-8">
            <div className="mtr-mono text-xs uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
            <h2 className="mtr-display text-2xl font-bold mt-1" style={{ color: p.text }}>{product.name}</h2>
            {insights?.avgRating != null && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <StarRating value={insights.avgRating} size={13} />
                <span className="text-xs" style={{ color: p.steel }}>{insights.avgRating.toFixed(1)} ({insights.reviewCount} avis)</span>
              </div>
            )}
            {insights && (insights.isBestSeller || insights.isNew || insights.lowStock) && <ProductBadges insights={insights} className="mt-2" />}
            <div className="mt-3"><PriceTag price={product.price} compareAt={product.compareAtPrice} className="text-2xl font-extrabold" /></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><ShippingBadge /><PriceMatchBadge /></div>
            {product.description && <p className="mt-3 text-sm" style={{ color: alpha(p.text, 0.65) }}>{product.description}</p>}
            <div className="mt-6">
              <SpecRow label="Calibre" value={product.calibre} />
              <SpecRow label="Coloris" value={product.colorName} />
              <SpecRow label="Matière" value={product.material} />
              <SpecRow label="Catégorie" value={product.category} />
              <SpecRow label="Disponibilité" value={product.stock} />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${p.borderStrong}` }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="tap-target p-2.5" style={{ color: p.text }}><Minus size={14} /></button>
                <span className="px-3 text-sm font-semibold" style={{ color: p.text }}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="tap-target p-2.5" style={{ color: p.text }}><Plus size={14} /></button>
              </div>
              <NeonButton
                disabled={product.stock === "Rupture"}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); fireConfetti(r.left + r.width / 2, r.top + r.height / 2); onAddToCart(product, qty); onClose(); }}
                className="flex-1 py-3 rounded-full"
                c1={accent}
                c2={accent === NEON.pink ? NEON.cyan : NEON.pink}
              >
                {product.stock === "Rupture" ? "Indisponible" : "Ajouter au panier"}
              </NeonButton>
            </div>
            {onSubmitReview && <ReviewsSection product={product} reviews={productReviews} session={session} onSubmitReview={onSubmitReview} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- PUBLIC: CART + CHECKOUT ---------------------------------- */

function AccountDrawer({ open, onClose, session, profile, orders, onSignIn, onSignUp, onSignOut }) {
  const { p } = useTheme();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { if (open) { setError(""); setNotice(""); setEmail(""); setPassword(""); setMode("signin"); } }, [open]);

  if (!open) return null;
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.bg3, color: p.text };

  const submit = async () => {
    if (!email.trim() || !password) { setError("Renseignez e-mail et mot de passe."); return; }
    setPending(true); setError("");
    try {
      if (mode === "signup") {
        const s = await onSignUp(email.trim(), password);
        if (!s) { setNotice("Compte créé. Si la confirmation par e-mail est activée, vérifiez votre boîte mail puis reconnectez-vous."); setMode("signin"); setPending(false); return; }
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Identifiant ou mot de passe incorrect." : (err.message || "Échec de connexion."));
    } finally {
      setPending(false);
    }
  };

  const myOrders = session ? orders.filter((o) => o.userId === session.user.id) : [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md flex flex-col" style={{ background: alpha(p.bg2, 0.8), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", borderLeft: `1px solid ${p.border}`, animation: "mtrSlideIn .4s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: p.border }}>
          <span className="font-bold flex items-center gap-2" style={{ color: p.text }}><User size={16} /> Mon compte</span>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!session ? (
            <div>
              <div className="flex rounded-full p-1 mb-5" style={{ background: p.bg3 }}>
                <button onClick={() => setMode("signin")} className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors" style={{ background: mode === "signin" ? p.bg2 : "transparent", color: p.text }}>Se connecter</button>
                <button onClick={() => setMode("signup")} className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors" style={{ background: mode === "signup" ? p.bg2 : "transparent", color: p.text }}>Créer un compte</button>
              </div>
              {notice && <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: alpha(NEON.yellow, 0.14), color: p.text }}>{notice}</p>}
              <div className="space-y-3">
                <input placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
                <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              {error && <p className="text-sm mt-3" style={{ color: NEG }}>{error}</p>}
              <NeonButton onClick={submit} disabled={pending} className="w-full mt-5 py-3 rounded-full flex items-center justify-center gap-2">
                {pending ? <><Loader2 size={16} className="animate-spin" /> Patientez…</> : mode === "signup" ? "Créer mon compte" : "Me connecter"}
              </NeonButton>
            </div>
          ) : (
            <div>
              <div className="p-4 rounded-xl mb-5" style={{ background: p.bg3 }}>
                <div className="text-xs mtr-mono uppercase tracking-wide" style={{ color: p.steel }}>Connecté</div>
                <div className="text-sm font-semibold mt-1" style={{ color: p.text }}>{session.user.email}</div>
                {profile?.loyaltyPoints > 0 && (
                  <div className="text-xs mt-1.5 inline-flex items-center gap-1 font-bold" style={{ color: NEON.orange }}><Sparkles size={12} /> {profile.loyaltyPoints} points de fidélité</div>
                )}
              </div>
              <div className="text-xs mtr-mono uppercase tracking-wide mb-3" style={{ color: p.steel }}>Mes commandes ({myOrders.length})</div>
              {myOrders.length === 0 ? (
                <p className="text-sm" style={{ color: p.steel }}>Aucune commande pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {myOrders.map((o) => {
                    const qty = o.items.reduce((s, it) => s + it.qty, 0);
                    return (
                      <div key={o.id} className="p-3 rounded-xl" style={{ background: p.bg3 }}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold" style={{ color: p.text }}>#{o.orderNumber ? String(o.orderNumber).padStart(5, "0") : o.id.slice(-6).toUpperCase()}</span>
                          <span style={{ color: p.steel }}>{o.date}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span style={{ color: p.steel }}>{qty} article{qty > 1 ? "s" : ""}</span>
                          <span className="font-bold" style={{ color: p.text }}>{euro(o.total || 0)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Pill style={{ background: alpha(o.paymentStatus === "paid" ? NEON.lime : NEON.orange, 0.14), color: o.paymentStatus === "paid" ? NEON.lime : NEON.orange }}>
                            {o.paymentStatus === "paid" ? "Payée" : "En attente"}
                          </Pill>
                          <Pill style={{ background: p.bg2, color: p.steel }}>{o.status}</Pill>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={onSignOut} className="w-full mt-6 py-2.5 rounded-full text-sm font-medium" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Déconnexion</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WishlistDrawer({ open, onClose, wishlistIds, products, brands, onRemove, onAddToCart, onOpenProduct }) {
  const { p } = useTheme();
  if (!open) return null;
  const items = wishlistIds.map((id) => products.find((pr) => pr.id === id)).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md flex flex-col" style={{ background: alpha(p.bg2, 0.8), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", borderLeft: `1px solid ${p.border}`, animation: "mtrSlideIn .4s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: p.border }}>
          <span className="font-bold flex items-center gap-2" style={{ color: p.text }}><Heart size={16} style={{ color: NEON.pink }} /> Liste d'envies</span>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm mt-8 text-center" style={{ color: p.steel }}>Votre liste d'envies est vide.</p>
          ) : (
            items.map((product) => {
              const brand = brands.find((b) => b.id === product.brandId);
              return (
                <div key={product.id} className="flex gap-4 py-4 border-b" style={{ borderColor: p.border }}>
                  <button onClick={() => { onOpenProduct(product); onClose(); }} className="w-20 h-14 rounded-lg overflow-hidden shrink-0 p-2" style={{ background: p.bg3 }}>
                    <ProductVisual product={product} stroke={alpha(p.text, 0.5)} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs mtr-mono uppercase" style={{ color: BRAND_ACCENT[product.brandId] || PRIMARY }}>{brand?.name}</div>
                    <div className="text-sm font-semibold truncate" style={{ color: p.text }}>{product.name}</div>
                    <div className="flex items-center justify-between mt-2">
                      <PriceTag price={product.price} compareAt={product.compareAtPrice} className="text-sm font-bold" />
                      <button onClick={() => onAddToCart(product, 1)} disabled={product.stock === "Rupture"} className="text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-40" style={{ background: p.text, color: p.bg }}>Ajouter</button>
                    </div>
                  </div>
                  <button onClick={() => onRemove(product.id)} className="tap-target self-start p-1" style={{ color: p.steel }}><Trash2 size={14} /></button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, products, brands, updateQty, removeItem, onCheckout }) {
  const { p } = useTheme();
  if (!open) return null;
  const lines = cart.map((c) => ({ ...c, product: products.find((pr) => pr.id === c.productId) }));
  const subtotal = lines.reduce((s, l) => s + (l.product?.price || 0) * l.qty, 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md flex flex-col" style={{ background: alpha(p.bg2, 0.8), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", borderLeft: `1px solid ${p.border}`, animation: "mtrSlideIn .4s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: p.border }}>
          <span className="font-bold" style={{ color: p.text }}>Votre panier</span>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lines.length === 0 ? (
            <p className="text-sm mt-8 text-center" style={{ color: p.steel }}>Votre panier est vide.</p>
          ) : (
            lines.map((l) => {
              const brand = brands.find((b) => b.id === l.product?.brandId);
              const accent = BRAND_ACCENT[l.product?.brandId] || PRIMARY;
              return (
                <div key={l.productId} className="flex gap-4 py-4 border-b" style={{ borderColor: p.border }}>
                  <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 p-2" style={{ background: p.bg3 }}>
                    <ProductVisual product={l.product} stroke={alpha(p.text, 0.5)} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs mtr-mono uppercase" style={{ color: accent }}>{brand?.name}</div>
                    <div className="text-sm font-semibold" style={{ color: p.text }}>{l.product?.name}</div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${p.borderStrong}` }}>
                        <button onClick={() => updateQty(l.productId, Math.max(1, l.qty - 1))} className="tap-target p-1.5" style={{ color: p.text }}><Minus size={12} /></button>
                        <span className="px-2 text-xs font-semibold" style={{ color: p.text }}>{l.qty}</span>
                        <button onClick={() => updateQty(l.productId, l.qty + 1)} className="tap-target p-1.5" style={{ color: p.text }}><Plus size={12} /></button>
                      </div>
                      <span className="text-sm font-bold" style={{ color: p.text }}>{euro((l.product?.price || 0) * l.qty)}</span>
                    </div>
                  </div>
                  <button onClick={() => removeItem(l.productId)} className="tap-target self-start p-1" style={{ color: p.steel }}><Trash2 size={14} /></button>
                </div>
              );
            })
          )}
        </div>
        {lines.length > 0 && (
          <div className="px-6 py-5 border-t" style={{ borderColor: p.border }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: p.steel }}>Sous-total</span>
              <span className="font-bold text-lg" style={{ color: p.text }}>{euro(subtotal)}</span>
            </div>
            <NeonButton onClick={onCheckout} className="w-full py-3 rounded-full">Passer commande</NeonButton>
          </div>
        )}
      </div>
    </div>
  );
}

// Floating bar that appears as soon as at least one product is added to the comparison.
// Persistent mini-cart, desktop only (the header cart icon already covers mobile — there's no
// spare screen real estate there for a second, always-visible summary). Sits bottom-right,
// deliberately opposite CompareBar (bottom-center) so the two never collide.
function FloatingCartWidget({ cartCount, subtotal, onOpen }) {
  const { p } = useTheme();
  if (cartCount === 0) return null;
  return (
    <button
      onClick={onOpen}
      className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-3 pl-3 pr-5 py-3 rounded-full btn-magnet"
      style={{ background: alpha(p.bg2, 0.85), backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${p.borderStrong}`, boxShadow: "0 12px 32px -8px rgba(0,0,0,.35)" }}
    >
      <span className="relative flex items-center justify-center w-9 h-9 rounded-full" style={{ background: alpha(PRIMARY, 0.14) }}>
        <ShoppingBag size={16} style={{ color: PRIMARY }} />
        <span className="absolute -top-1.5 -right-1.5 text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold" style={{ background: PRIMARY, color: "#07080A" }}>{cartCount}</span>
      </span>
      <span className="text-sm font-bold" style={{ color: p.text }}>{euro(subtotal)}</span>
    </button>
  );
}

function CompareBar({ compareIds, products, onOpen, onClear }) {
  const { p } = useTheme();
  if (compareIds.length === 0) return null;
  const items = compareIds.map((id) => products.find((pr) => pr.id === id)).filter(Boolean);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-full shadow-lg" style={{ background: p.bg2, border: `1px solid ${p.borderStrong}`, boxShadow: "0 12px 32px -8px rgba(0,0,0,.35)" }}>
      <div className="flex -space-x-2">
        {items.map((pr) => (
          <div key={pr.id} className="w-8 h-8 rounded-full overflow-hidden p-1" style={{ background: p.bg3, border: `2px solid ${p.bg2}` }}>
            <ProductVisual product={pr} stroke={alpha(p.text, 0.5)} />
          </div>
        ))}
      </div>
      <span className="text-sm font-medium" style={{ color: p.text }}>{items.length} produit{items.length > 1 ? "s" : ""}</span>
      <NeonButton onClick={onOpen} disabled={items.length < 2} className="px-4 py-2 rounded-full text-xs">Comparer</NeonButton>
      <button onClick={onClear} className="tap-target p-1.5" style={{ color: p.steel }} aria-label="Vider le comparateur"><X size={16} /></button>
    </div>
  );
}

function CompareModal({ open, onClose, compareIds, products, brands, productInsights, onRemove }) {
  const { p } = useTheme();
  if (!open) return null;
  const items = compareIds.map((id) => products.find((pr) => pr.id === id)).filter(Boolean);
  const rows = [
    { label: "Marque", get: (pr) => brands.find((b) => b.id === pr.brandId)?.name || "—" },
    { label: "Prix", get: (pr) => <PriceTag price={pr.price} compareAt={pr.compareAtPrice} className="font-bold" /> },
    { label: "Note", get: (pr) => (productInsights?.[pr.id]?.avgRating != null ? <StarRating value={productInsights[pr.id].avgRating} size={12} /> : "—") },
    { label: "Catégorie", get: (pr) => pr.category },
    { label: "Genre", get: (pr) => pr.gender },
    { label: "Calibre", get: (pr) => pr.calibre || "—" },
    { label: "Matière", get: (pr) => pr.material || "—" },
    { label: "Coloris", get: (pr) => pr.colorName || "—" },
    { label: "Stock", get: (pr) => pr.stock },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8" style={{ background: alpha(p.bg2, 0.75), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="mtr-display text-xl font-bold flex items-center gap-2" style={{ color: p.text }}><Scale size={18} /> Comparateur</h3>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm" style={{ minWidth: items.length * 180 }}>
            <thead>
              <tr>
                <th className="w-32"></th>
                {items.map((pr) => (
                  <th key={pr.id} className="text-left p-3 align-top" style={{ minWidth: 180 }}>
                    <div className="relative rounded-xl p-3" style={{ background: p.bg3 }}>
                      <button onClick={() => onRemove(pr.id)} className="tap-target absolute top-1.5 right-1.5 p-1 rounded-full" style={{ background: alpha(p.text, 0.08) }}><X size={12} style={{ color: p.steel }} /></button>
                      <div className="h-16"><ProductVisual product={pr} stroke={alpha(p.text, 0.5)} /></div>
                      <div className="mt-2 text-xs font-bold" style={{ color: p.text }}>{pr.name}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t" style={{ borderColor: p.border }}>
                  <td className="p-3 mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{row.label}</td>
                  {items.map((pr) => <td key={pr.id} className="p-3" style={{ color: p.text }}>{row.get(pr)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// "Trouvez votre monture" quiz. Every question maps to a real, existing catalog filter — no
// invented "AI style match" score. If the exact combination has zero results, filters are relaxed
// one by one (starting with the least essential) so the quiz never dead-ends with an empty screen.
function QuizWidget({ open, onClose, products, brands, onOpenProduct, onGoCategory }) {
  const { p } = useTheme();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ category: null, gender: null, shape: null, price: null });

  const questions = [
    { key: "category", label: "Vous cherchez plutôt…", options: [["Solaire", "Des solaires"], ["Optique", "Des lunettes de vue"]] },
    { key: "gender", label: "Pour qui ?", options: [["Femme", "Femme"], ["Homme", "Homme"], ["Mixte", "Peu importe"]] },
    { key: "shape", label: "Quelle forme vous attire ?", options: [["round", "Ronde"], ["square", "Carrée"], [null, "Peu importe"]] },
    { key: "price", label: "Votre budget ?", options: [["-50", "Moins de 50 €"], ["50-100", "50 à 100 €"], ["100-150", "100 à 150 €"], [null, "Peu importe"]] },
  ];

  const select = (key, value) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setStep((s) => s + 1);
  };
  const reset = () => { setStep(0); setAnswers({ category: null, gender: null, shape: null, price: null }); };
  const close = () => { reset(); onClose(); };

  const results = useMemo(() => {
    if (step < questions.length) return [];
    const pool = products.filter((pr) => pr.photos && pr.photos.length > 0);
    const filters = [];
    if (answers.category) filters.push((pr) => pr.category === answers.category);
    if (answers.gender && answers.gender !== "Mixte") filters.push((pr) => pr.gender === answers.gender || pr.gender === "Mixte");
    if (answers.shape) filters.push((pr) => pr.shape === answers.shape);
    if (answers.price) {
      const [lo, hi] = answers.price === "-50" ? [0, 50] : answers.price === "50-100" ? [50, 100] : [100, 150];
      filters.push((pr) => pr.price >= lo && pr.price <= hi);
    }
    const applied = [...filters];
    let matched = pool;
    while (applied.length) {
      matched = pool.filter((pr) => applied.every((f) => f(pr)));
      if (matched.length > 0) break;
      applied.pop(); // relax the least essential filter (price, then shape…) until something matches
    }
    return (matched.length ? matched : pool).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers, products]);

  if (!open) return null;
  const progress = Math.min(step, questions.length) / questions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8" style={{ background: alpha(p.bg2, 0.75), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <button onClick={close} className="absolute top-4 right-4 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }}><X size={18} style={{ color: p.text }} /></button>

        <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: p.bg3 }}>
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, ${NEON.cyan}, ${NEON.pink})`, transition: "width .35s ease" }} />
        </div>

        {step < questions.length ? (
          <div>
            <Eyebrow>Question {step + 1}/{questions.length}</Eyebrow>
            <h3 className="mtr-display text-2xl font-bold mb-6" style={{ color: p.text }}>{questions[step].label}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {questions[step].options.map(([val, label]) => (
                <button key={label} onClick={() => select(questions[step].key, val)} className="neon-border p-5 rounded-2xl text-left font-semibold btn-magnet" style={{ background: p.bg3, border: `1px solid ${p.border}`, color: p.text, "--edge": NEON.cyan }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <Eyebrow>Vos résultats</Eyebrow>
            <h3 className="mtr-display text-2xl font-bold mb-6" style={{ color: p.text }}>{results.length} monture{results.length > 1 ? "s" : ""} pour vous</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {results.map((pr) => {
                const brand = brands.find((b) => b.id === pr.brandId);
                return (
                  <button key={pr.id} onClick={() => { onOpenProduct(pr); close(); }} className="rounded-xl overflow-hidden text-left card-lift" style={{ background: p.bg3, border: `1px solid ${p.border}` }}>
                    <div className="p-3"><ProductVisual product={pr} stroke={alpha(p.text, 0.5)} /></div>
                    <div className="px-3 pb-3">
                      <div className="text-[10px] mtr-mono uppercase" style={{ color: BRAND_ACCENT[pr.brandId] || PRIMARY }}>{brand?.name}</div>
                      <div className="text-xs font-semibold truncate" style={{ color: p.text }}>{pr.name}</div>
                      <div className="text-xs font-bold mt-1" style={{ color: p.text }}>{euro(pr.price)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Refaire le quiz</button>
              <NeonButton onClick={() => { onGoCategory(answers.category || "Tous", answers.gender || "Tous"); close(); }} className="flex-1 py-3 rounded-full">Voir toute la sélection</NeonButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact homepage banner that opens the quiz.
function QuizBanner({ onOpen }) {
  const { p, dark } = useTheme();
  const [ref, visible] = useReveal(0.3);
  return (
    <section style={{ background: p.bg2 }} className="py-14">
      <div ref={ref} className={`reveal ${visible ? "visible" : ""} max-w-6xl mx-auto px-5 md:px-8`}>
        <button
          onClick={onOpen}
          className="neon-border card-lift w-full rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-5 text-left relative overflow-hidden"
          style={{ background: p.bg, border: `1px solid ${dark ? p.border : alpha(NEON.violet, 0.35)}`, "--edge": NEON.violet }}
        >
          <div className="mesh-bg"><div className="mesh-blob" style={{ width: 300, height: 300, top: -100, left: "10%", background: NEON.violet, opacity: dark ? 0.18 : 0.32, mixBlendMode: dark ? "screen" : "multiply" }} /></div>
          <div className="relative">
            <Eyebrow color={NEON.violet}>30 secondes chrono</Eyebrow>
            <h2 className="mtr-display text-2xl md:text-3xl font-extrabold" style={{ color: p.text }}>Pas sûr de votre choix ? Trouvez votre monture.</h2>
            <p className="mt-2 text-sm" style={{ color: alpha(p.text, 0.65) }}>4 questions rapides, une sélection sur mesure tirée de notre vrai catalogue.</p>
          </div>
          <div className="relative shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm" style={{ background: NEON.violet, color: "#07080A" }}>
            <Sparkles size={16} /> Faire le quiz
          </div>
        </button>
      </div>
    </section>
  );
}

// Instant Cmd/Ctrl+K search — jumps straight to a product, brand, or page without navigating
// menus. Desktop-oriented: the keyboard shortcut is the primary entry point, though the header
// button gives mouse users a way in too.
function CommandPalette({ open, onClose, products, brands, onOpenProduct, setPage }) {
  const { p } = useTheme();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = [
      { type: "page", label: "Accueil", action: () => setPage("home") },
      { type: "page", label: "Catalogue", action: () => setPage("catalogue") },
      { type: "page", label: "Marques", action: () => setPage("marques") },
      { type: "page", label: "À propos", action: () => setPage("apropos") },
    ].filter((it) => !q || it.label.toLowerCase().includes(q));

    if (!q) return pages;

    const brandName = (id) => brands.find((b) => b.id === id)?.name || "";
    const prodMatches = products
      .filter((pr) => pr.name.toLowerCase().includes(q) || brandName(pr.brandId).toLowerCase().includes(q))
      .slice(0, 6)
      .map((pr) => ({ type: "product", label: pr.name, sub: brandName(pr.brandId), product: pr, action: () => onOpenProduct(pr) }));

    const brandMatches = brands
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((b) => ({ type: "brand", label: b.name, action: () => setPage("catalogue") }));

    return [...pages, ...prodMatches, ...brandMatches];
  }, [query, products, brands]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const r = results[activeIndex]; if (r) { r.action(); onClose(); } }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ background: alpha(p.bg2, 0.85), backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${p.border}`, boxShadow: "0 24px 60px -12px rgba(0,0,0,.5)", animation: "mtrPop .25s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: p.border }}>
          <Search size={18} style={{ color: p.steel }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un produit, une marque, une page…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: p.text }}
          />
          <span className="text-[10px] mtr-mono px-1.5 py-0.5 rounded" style={{ background: p.bg3, color: p.steel }}>ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-5 py-6 text-sm text-center" style={{ color: p.steel }}>Aucun résultat.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.label}-${i}`}
                onClick={() => { r.action(); onClose(); }}
                onMouseEnter={() => setActiveIndex(i)}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-left"
                style={{ background: i === activeIndex ? alpha(PRIMARY, 0.12) : "transparent" }}
              >
                {r.type === "product" && (r.product.photos?.[0] ? <img src={r.product.photos[0]} className="w-8 h-8 object-contain rounded shrink-0" alt="" /> : <div className="w-8 h-8 rounded shrink-0" style={{ background: p.bg3 }} />)}
                {r.type === "page" && <ArrowRight size={14} style={{ color: p.steel }} className="shrink-0" />}
                {r.type === "brand" && <Building2 size={14} style={{ color: p.steel }} className="shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: p.text }}>{r.label}</div>
                  {r.sub && <div className="text-xs truncate" style={{ color: p.steel }}>{r.sub}</div>}
                </div>
                {r.type === "product" && <span className="text-xs font-semibold shrink-0" style={{ color: p.text }}>{euro(r.product.price)}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CheckoutWizard({ open, onClose, cart, products, session, profile, onProfileSaved, onStartCheckout }) {
  const { p } = useTheme();
  const [step, setStep] = useState("account");
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [signupNotice, setSignupNotice] = useState("");

  const [address, setAddress] = useState({ fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", postalCode: "", country: "France" });
  const [addressError, setAddressError] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null); // { code, discountPercent }
  const [promoError, setPromoError] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);

  // Only re-initialize step/errors when the wizard actually transitions from closed to open —
  // NOT every time `profile` changes while it's already open. Saving the address updates the
  // profile in Root, which would otherwise re-trigger this effect and snap the wizard straight
  // back to the address step right after advancing to payment.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || !justOpened) return;
    setStep(session ? "address" : "account");
    setAuthError(""); setAddressError(""); setPayError(""); setSignupNotice("");
    setPromo(null); setPromoInput(""); setPromoError("");
    if (profile) {
      setAddress({
        fullName: profile.fullName || "", phone: profile.phone || "",
        addressLine1: profile.addressLine1 || "", addressLine2: profile.addressLine2 || "",
        city: profile.city || "", postalCode: profile.postalCode || "", country: profile.country || "France",
      });
    }
  }, [open, session, profile]);

  if (!open) return null;

  const lines = cart.map((c) => ({ ...c, product: products.find((pr) => pr.id === c.productId) }));
  const subtotal = lines.reduce((s, l) => s + (l.product?.price || 0) * l.qty, 0);
  const discountAmount = promo ? subtotal * (promo.discountPercent / 100) : 0;
  const total = subtotal - discountAmount;
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.bg3, color: p.text };
  const inputCls = "mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none";

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoChecking(true); setPromoError("");
    try {
      const result = await validatePromoCode(promoInput);
      if (!result.valid) { setPromoError(result.reason); setPromo(null); return; }
      setPromo({ code: result.promo.code, discountPercent: result.promo.discountPercent });
      setPromoInput("");
    } catch (err) {
      setPromoError(err.message || "Échec de la vérification du code.");
    } finally {
      setPromoChecking(false);
    }
  };

  const submitAuth = async () => {
    if (!email.trim() || !password) { setAuthError("Renseignez e-mail et mot de passe."); return; }
    setAuthPending(true); setAuthError("");
    try {
      if (authMode === "signup") {
        const newSession = await signUp(email.trim(), password);
        if (!newSession) {
          setSignupNotice("Compte créé. Si la confirmation par e-mail est activée sur ce site, vérifiez votre boîte mail puis reconnectez-vous ci-dessus.");
          setAuthMode("signin");
          setAuthPending(false);
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      setStep("address");
    } catch (err) {
      setAuthError(err.message === "Invalid login credentials" ? "Identifiant ou mot de passe incorrect." : (err.message || "Échec de connexion."));
    } finally {
      setAuthPending(false);
    }
  };

  const submitAddress = async () => {
    const required = ["fullName", "phone", "addressLine1", "city", "postalCode", "country"];
    if (required.some((k) => !address[k]?.trim())) { setAddressError("Merci de compléter tous les champs obligatoires."); return; }
    setSavingAddress(true); setAddressError("");
    try {
      await onProfileSaved(address);
      setStep("payment");
    } catch (err) {
      setAddressError(err.message || "Échec de l'enregistrement de l'adresse.");
    } finally {
      setSavingAddress(false);
    }
  };

  const submitPayment = async () => {
    setPayPending(true); setPayError("");
    try {
      await onStartCheckout(address, promo); // redirects to Stripe on success — nothing left to render after
    } catch (err) {
      setPayError(err.message || "Échec de la préparation du paiement.");
      setPayPending(false);
    }
  };

  const steps = [{ id: "account", label: "Compte" }, { id: "address", label: "Livraison" }, { id: "payment", label: "Paiement" }];
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-8" style={{ background: alpha(p.bg2, 0.75), backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }}><X size={18} style={{ color: p.text }} /></button>

        <div className="flex items-center gap-2 mb-7">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: i <= stepIndex ? PRIMARY : p.bg3, color: i <= stepIndex ? "#07080A" : p.steel }}>
                  {i < stepIndex ? <Check size={12} /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:inline" style={{ color: i <= stepIndex ? p.text : p.steel }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: i < stepIndex ? PRIMARY : p.border }} />}
            </React.Fragment>
          ))}
        </div>

        {step === "account" && (
          <div>
            <h3 className="mtr-display text-xl font-bold mb-1" style={{ color: p.text }}>{authMode === "signup" ? "Créer un compte" : "Se connecter"}</h3>
            <p className="text-sm mb-5" style={{ color: p.steel }}>Un compte est nécessaire pour suivre votre commande.</p>
            {signupNotice && <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: alpha(NEON.yellow, 0.14), color: p.text }}>{signupNotice}</p>}
            <div className="flex rounded-full p-1 mb-5" style={{ background: p.bg3 }}>
              <button onClick={() => setAuthMode("signin")} className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors" style={{ background: authMode === "signin" ? p.bg2 : "transparent", color: p.text }}>Se connecter</button>
              <button onClick={() => setAuthMode("signup")} className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors" style={{ background: authMode === "signup" ? p.bg2 : "transparent", color: p.text }}>Créer un compte</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
              <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAuth()} className={inputCls} style={inputStyle} />
            </div>
            {authError && <p className="text-sm mt-3" style={{ color: NEG }}>{authError}</p>}
            <NeonButton onClick={submitAuth} disabled={authPending} className="w-full mt-5 py-3 rounded-full flex items-center justify-center gap-2">
              {authPending ? <><Loader2 size={16} className="animate-spin" /> Patientez…</> : (authMode === "signup" ? <><UserPlus size={16} /> Créer mon compte</> : <><LogIn size={16} /> Me connecter</>)}
            </NeonButton>
          </div>
        )}

        {step === "address" && (
          <div>
            <h3 className="mtr-display text-xl font-bold mb-1" style={{ color: p.text }}>Adresse de livraison</h3>
            <p className="text-sm mb-5" style={{ color: p.steel }}>Connecté en tant que {session?.user?.email}</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Nom complet" value={address.fullName} onChange={(e) => setAddress((a) => ({ ...a, fullName: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} />
              <input placeholder="Téléphone" value={address.phone} onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} />
              <input placeholder="Adresse" value={address.addressLine1} onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} />
              <input placeholder="Complément (optionnel)" value={address.addressLine2} onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} />
              <input placeholder="Ville" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} className={inputCls} style={inputStyle} />
              <input placeholder="Code postal" value={address.postalCode} onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))} className={inputCls} style={inputStyle} />
              <input placeholder="Pays" value={address.country} onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} />
            </div>
            {addressError && <p className="text-sm mt-3" style={{ color: NEG }}>{addressError}</p>}
            <NeonButton onClick={submitAddress} disabled={savingAddress} className="w-full mt-5 py-3 rounded-full flex items-center justify-center gap-2">
              {savingAddress ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</> : <>Continuer <ArrowRight size={16} /></>}
            </NeonButton>
          </div>
        )}

        {step === "payment" && (
          <div>
            <h3 className="mtr-display text-xl font-bold mb-1" style={{ color: p.text }}>Paiement sécurisé</h3>
            <p className="text-sm mb-5" style={{ color: p.steel }}>Vous allez être redirigé vers Stripe pour finaliser le paiement.</p>

            <div className="mb-4">
              {promo ? (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: alpha(NEON.lime, 0.12) }}>
                  <span className="text-sm font-semibold" style={{ color: p.text }}>Code <strong>{promo.code}</strong> appliqué (-{promo.discountPercent}%)</span>
                  <button onClick={() => setPromo(null)} className="text-xs font-medium" style={{ color: NEG }}>Retirer</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    placeholder="Code promo (optionnel)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyPromo())}
                    className={inputCls}
                    style={inputStyle}
                  />
                  <button onClick={applyPromo} disabled={promoChecking} className="px-4 rounded-xl text-sm font-medium shrink-0" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>
                    {promoChecking ? <Loader2 size={14} className="animate-spin" /> : "Appliquer"}
                  </button>
                </div>
              )}
              {promoError && <p className="text-xs mt-1.5" style={{ color: NEG }}>{promoError}</p>}
            </div>

            <div className="rounded-2xl p-4 mb-5 space-y-2" style={{ background: p.bg3 }}>
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center justify-between text-sm">
                  <span style={{ color: p.text }}>{l.qty}× {l.product?.name}</span>
                  <span style={{ color: p.steel }}>{euro((l.product?.price || 0) * l.qty)}</span>
                </div>
              ))}
              {promo && (
                <div className="flex items-center justify-between text-sm" style={{ color: NEON.lime }}>
                  <span>Remise ({promo.code})</span>
                  <span>-{euro(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 mt-2 border-t font-bold" style={{ borderColor: p.border, color: p.text }}>
                <span>Total</span><span>{euro(total)}</span>
              </div>
            </div>
            {payError && <p className="text-sm mb-3" style={{ color: NEG }}>{payError}</p>}
            <NeonButton onClick={submitPayment} disabled={payPending} className="w-full py-3 rounded-full flex items-center justify-center gap-2">
              {payPending ? <><Loader2 size={16} className="animate-spin" /> Redirection…</> : <><CreditCard size={16} /> Payer {euro(total)} avec Stripe</>}
            </NeonButton>
            <p className="text-[11px] mt-3 text-center" style={{ color: p.steel }}>Paiement traité par Stripe — aucune donnée bancaire n'est stockée sur ce site.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: LOGIN ---------------------------------- */

function AdminLogin({ onLogin, onBackToSite, deniedNotice }) {
  const { p } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inputStyle = { background: p.bg2, color: p.text, border: `1px solid ${p.borderStrong}` };

  const submit = async () => {
    if (!email || !password) { setError("Renseignez identifiant et mot de passe."); return; }
    setPending(true); setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Identifiant ou mot de passe incorrect." : (err.message || "Échec de connexion."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative overflow-hidden" style={{ background: p.bg }}>
      <div className="mesh-bg">
        <div className="mesh-blob" style={{ width: 380, height: 380, top: -100, left: -100, background: NEON.cyan, opacity: 0.18 }} />
        <div className="mesh-blob" style={{ width: 320, height: 320, bottom: -120, right: -80, background: NEON.pink, opacity: 0.16, animationDelay: "-10s" }} />
      </div>
      <div className="relative w-full max-w-sm">
        <button onClick={onBackToSite} className="flex items-center gap-2 text-sm mb-8" style={{ color: alpha(p.text, 0.5) }}><ArrowLeft size={14} /> Retour au site</button>
        {deniedNotice && <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: alpha(NEG, 0.14), color: NEG }}>{deniedNotice}</p>}
        <div className="flex items-center gap-2 mb-1"><Logo size={26} /><span className="mtr-display text-lg font-bold" style={{ color: p.text }}>Pro</span></div>
        <p className="text-sm mb-8" style={{ color: alpha(p.text, 0.45) }}>Espace d'administration du catalogue et des commandes.</p>
        <div className="space-y-3">
          <input placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
          <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
        </div>
        {error && <p className="text-sm mt-3" style={{ color: NEG }}>{error}</p>}
        <NeonButton onClick={submit} disabled={pending} className="w-full mt-5 py-3 rounded-full flex items-center justify-center gap-2">
          {pending ? <><Loader2 size={16} className="animate-spin" /> Connexion…</> : "Se connecter"}
        </NeonButton>
        <p className="text-[11px] mt-4 text-center" style={{ color: alpha(p.text, 0.32) }}>Créez un utilisateur admin dans Supabase → Authentication → Users.</p>
        <div className="mt-6 flex justify-center"><ThemeToggle /></div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: SHELL ---------------------------------- */

function AdminShell({ tab, setTab, onLogout, onBackToSite, children }) {
  const { p } = useTheme();
  const items = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "products", label: "Produits", icon: Package },
    { id: "brands", label: "Marques", icon: Tags },
    { id: "suppliers", label: "Fournisseurs", icon: Truck },
    { id: "orders", label: "Commandes", icon: ClipboardList },
    { id: "promos", label: "Codes promo", icon: Sparkles },
  ];
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: p.bg }}>
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 p-6" style={{ background: p.sidebar }}>
        <div className="flex items-center gap-2 mb-8"><Logo size={20} forceDark /><span className="mtr-display text-base font-bold" style={{ color: "#F3F5F6" }}>Pro</span></div>
        <nav className="flex-1 space-y-1">
          {items.map((it) => {
            const Icon = it.icon;
            const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ background: active ? alpha(PRIMARY, 0.14) : "transparent", color: active ? PRIMARY : "rgba(243,245,246,0.55)" }}>
                <Icon size={16} /> {it.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-1 pt-4 border-t" style={{ borderColor: "rgba(243,245,246,0.1)" }}>
          <div className="px-1 pb-2"><ThemeToggle /></div>
          <button onClick={onBackToSite} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: "rgba(243,245,246,0.5)" }}><ArrowLeft size={16} /> Voir le site</button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: "rgba(243,245,246,0.5)" }}><LogOut size={16} /> Déconnexion</button>
        </div>
      </aside>

      <div className="md:hidden flex items-center gap-2 overflow-x-auto scroll-thin px-4 py-3" style={{ background: p.sidebar }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium shrink-0" style={{ background: active ? alpha(PRIMARY, 0.16) : "transparent", color: active ? PRIMARY : "rgba(243,245,246,0.55)" }}>
              <Icon size={13} /> {it.label}
            </button>
          );
        })}
        <button onClick={onBackToSite} className="ml-2 text-xs shrink-0" style={{ color: "rgba(243,245,246,0.4)" }}>Site ↗</button>
        <div className="ml-2 shrink-0"><ThemeToggle compact /></div>
      </div>

      <main className="flex-1 p-5 md:p-10 overflow-x-hidden">{children}</main>
    </div>
  );
}

function AdminHeader({ title, subtitle, action }) {
  const { p } = useTheme();
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="mtr-display text-2xl md:text-3xl font-bold" style={{ color: p.text }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: p.steel }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------- ADMIN: DASHBOARD ---------------------------------- */

function AdminDashboard({ products, orders, brands }) {
  const { p } = useTheme();
  const [ref, visible] = useReveal(0.15);
  const activeOrders = orders.filter((o) => o.status !== "Annulée");
  const revenue = activeOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => {
    const pr = products.find((pp) => pp.id === it.productId);
    return s + (pr ? pr.price * it.qty : 0);
  }, 0), 0);
  const inStock = products.filter((pr) => pr.stock === "En stock").length;
  const avgMargin = products.length ? Math.round(products.reduce((s, pr) => s + ((pr.price - pr.cost) / pr.price) * 100, 0) / products.length) : 0;

  const brandRevenue = brands.map((b) => {
    const total = activeOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => {
      const pr = products.find((pp) => pp.id === it.productId);
      return pr && pr.brandId === b.id ? s + pr.price * it.qty : s;
    }, 0), 0);
    return { ...b, total, accent: BRAND_ACCENT[b.id] || PRIMARY };
  }).sort((a, b) => b.total - a.total);
  const maxRevenue = Math.max(1, ...brandRevenue.map((b) => b.total));

  const KPI = ({ label, value, tone }) => (
    <div ref={ref} className={`reveal ${visible ? "visible" : ""} p-5 rounded-2xl card-lift`} style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
      <div className="mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{label}</div>
      <div className="mtr-display text-2xl font-bold mt-2" style={{ color: tone || p.text }}>{value}</div>
    </div>
  );

  return (
    <div>
      <AdminHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité de la boutique." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KPI label="Chiffre d'affaires" value={euro(revenue)} tone={NEON.lime} />
        <KPI label="Commandes actives" value={activeOrders.length} tone={NEON.yellow} />
        <KPI label="Produits en stock" value={`${inStock} / ${products.length}`} tone={NEON.blue} />
        <KPI label="Marge moyenne" value={`${avgMargin}%`} tone={NEON.cyan} />
      </div>

      <div className="p-6 rounded-2xl card-lift" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div className="mtr-mono text-[11px] uppercase tracking-wide mb-5" style={{ color: p.steel }}>Chiffre d'affaires par marque</div>
        <div className="space-y-4">
          {brandRevenue.map((b) => (
            <div key={b.id}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium" style={{ color: p.text }}>{b.name}</span>
                <span style={{ color: p.steel }}>{euro(b.total)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: p.bg3 }}>
                <div className="h-2 rounded-full bar-fill" style={{ width: visible ? `${(b.total / maxRevenue) * 100}%` : "0%", background: b.accent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: PRODUCTS ---------------------------------- */

function ProductFormModal({ open, onClose, onSave, brands, suppliers, initial }) {
  const { p } = useTheme();
  const empty = { name: "", brandId: brands[0]?.id || "", category: "Solaire", gender: "Mixte", price: "", cost: "", compareAtPrice: null, colorName: "", colorHex: NEON.cyan, shape: "square", calibre: "", material: "", stock: "En stock", supplierId: suppliers[0]?.id || "", featured: false, description: "", photos: [] };
  const [form, setForm] = useState(initial || empty);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  useEffect(() => { setForm(initial || empty); setUploadError(""); setUrlDraft(""); }, [initial, open]);
  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const margin = form.price && form.cost ? Math.round(((form.price - form.cost) / form.price) * 100) : null;

  const addPhotoUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    setForm((f) => ({ ...f, photos: [...(f.photos || []), url] }));
    setUrlDraft("");
  };
  const removePhoto = (i) => setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
  const makeCover = (i) => setForm((f) => {
    const next = [...f.photos];
    const [chosen] = next.splice(i, 1);
    return { ...f, photos: [chosen, ...next] };
  });
  const handlePhotoFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true); setUploadError("");
    try {
      const urls = [];
      for (const file of files) urls.push(await uploadProductPhoto(file, initial?.id));
      setForm((f) => ({ ...f, photos: [...(f.photos || []), ...urls] }));
    } catch (err) {
      setUploadError(err.message || "Échec de l'envoi d'une photo.");
    } finally {
      setUploading(false);
    }
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>{label}</label>
      {children}
    </div>
  );
  const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.inputBg, color: p.text };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8" style={{ background: p.bg2, animation: "mtrPop .3s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrPop { from { opacity:0; transform: translateY(20px) scale(.98);} to {opacity:1; transform:none;} }`}</style>
        <div className="flex items-center justify-between mb-6">
          <h3 className="mtr-display text-xl font-bold" style={{ color: p.text }}>{initial ? "Modifier le produit" : "Nouveau produit"}</h3>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nom du modèle"><input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Marque"><select className={inputCls} style={inputStyle} value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Catégorie"><select className={inputCls} style={inputStyle} value={form.category} onChange={(e) => set("category", e.target.value)}><option>Solaire</option><option>Optique</option></select></Field>
          <Field label="Genre"><select className={inputCls} style={inputStyle} value={form.gender} onChange={(e) => set("gender", e.target.value)}><option>Mixte</option><option>Homme</option><option>Femme</option></select></Field>
          <Field label="Prix de vente (€)"><input type="number" className={inputCls} style={inputStyle} value={form.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
          <Field label="Prix barré (€, optionnel)"><input type="number" className={inputCls} style={inputStyle} value={form.compareAtPrice || ""} onChange={(e) => set("compareAtPrice", e.target.value ? Number(e.target.value) : null)} placeholder="Prix de référence réel avant remise" /></Field>
          <Field label="Coût fournisseur (€)"><input type="number" className={inputCls} style={inputStyle} value={form.cost} onChange={(e) => set("cost", Number(e.target.value))} /></Field>
          <Field label="Coloris (nom)"><input className={inputCls} style={inputStyle} value={form.colorName} onChange={(e) => set("colorName", e.target.value)} /></Field>
          <Field label="Coloris (teinte)"><input type="color" className="w-full h-10 rounded-lg" style={inputStyle} value={form.colorHex} onChange={(e) => set("colorHex", e.target.value)} /></Field>
          <Field label="Calibre (ex: 52-18-140)"><input className={inputCls} style={inputStyle} value={form.calibre} onChange={(e) => set("calibre", e.target.value)} /></Field>
          <Field label="Matière"><input className={inputCls} style={inputStyle} value={form.material} onChange={(e) => set("material", e.target.value)} /></Field>
          <Field label="Forme de monture"><select className={inputCls} style={inputStyle} value={form.shape} onChange={(e) => set("shape", e.target.value)}><option value="square">Carrée</option><option value="round">Ronde</option></select></Field>
          <Field label="Statut stock"><select className={inputCls} style={inputStyle} value={form.stock} onChange={(e) => set("stock", e.target.value)}><option>En stock</option><option>Sur commande</option><option>Rupture</option></select></Field>
          <Field label="Fournisseur"><select className={inputCls} style={inputStyle} value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Mise en avant">
            <label className="flex items-center gap-2 h-10 text-sm" style={{ color: p.text }}>
              <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} style={{ accentColor: NEON.cyan }} /> Afficher en page d'accueil
            </label>
          </Field>
        </div>
        <div className="mt-4">
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>Description</label>
          <textarea rows={2} className={inputCls} style={inputStyle} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Courte description pour la fiche produit…" />
        </div>

        <div className="mt-4">
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>
            Photos produit {form.photos?.length > 0 && `(${form.photos.length})`}
          </label>

          {form.photos?.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-20 h-16 rounded-lg overflow-hidden group" style={{ border: `2px solid ${i === 0 ? PRIMARY : p.border}` }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center font-semibold py-0.5" style={{ background: alpha(PRIMARY, 0.85), color: "#07080A" }}>Couverture</span>}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1" style={{ background: "rgba(0,0,0,0.55)" }}>
                    {i !== 0 && (
                      <button type="button" onClick={() => makeCover(i)} title="Définir comme couverture" className="p-1 rounded" style={{ background: "rgba(255,255,255,0.15)" }}>
                        <Sparkles size={12} color="#fff" />
                      </button>
                    )}
                    <button type="button" onClick={() => removePhoto(i)} title="Retirer" className="p-1 rounded" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                </div>
              ))}
              {uploading && (
                <div className="w-20 h-16 rounded-lg flex items-center justify-center" style={{ background: p.bg3, border: `1px solid ${p.border}` }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: p.steel }} />
                </div>
              )}
            </div>
          )}
          {(!form.photos || form.photos.length === 0) && (
            <div className="w-20 h-16 rounded-lg mb-3 flex items-center justify-center" style={{ background: p.bg3, border: `1px solid ${p.border}` }}>
              {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: p.steel }} /> : <ImageIcon size={18} style={{ color: p.steel }} />}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className={inputCls}
              style={inputStyle}
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhotoUrl())}
              placeholder="Coller une URL d'image et valider…"
            />
            <button type="button" onClick={addPhotoUrl} className="px-4 rounded-lg text-sm font-medium shrink-0" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Ajouter</button>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer mt-2" style={{ color: PRIMARY }}>
            <Upload size={13} /> Envoyer une ou plusieurs photos
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoFiles(e.target.files)} />
          </label>
          {uploadError && <p className="text-xs mt-1.5" style={{ color: NEG }}>{uploadError}</p>}
          <p className="text-[11px] mt-1.5" style={{ color: p.steel }}>La première photo (bordure colorée) sert de couverture sur le catalogue.</p>
        </div>

        {margin !== null && (
          <div className="mt-4 text-sm" style={{ color: p.steel }}>
            Marge estimée : <strong style={{ color: margin > 30 ? NEON.lime : NEG }}>{margin}%</strong> ({euro(form.price - form.cost)})
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.price || uploading} className="btn-magnet flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-40" style={{ background: p.text, color: p.bg }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: IMPORT CSV / EXCEL ---------------------------------- */

const IMPORT_FIELD_DEFS = [
  { id: "name", label: "Titre", aliases: ["titre", "nom", "name", "modele", "modèle"], required: true },
  { id: "brandName", label: "Marque", aliases: ["marque", "brand"], required: true },
  { id: "category", label: "Catégorie", aliases: ["categorie", "catégorie", "category"], required: false },
  { id: "gender", label: "Genre", aliases: ["genre", "gender"], required: false },
  { id: "price", label: "Prix", aliases: ["prix", "price", "prix de vente"], required: true },
  { id: "compareAtPrice", label: "Prix barré (optionnel)", aliases: ["prix barre", "prix barré", "prix initial", "ancien prix", "prix normal", "compare at price", "compareatprice"], required: false },
  { id: "cost", label: "Coût", aliases: ["cout", "coût", "cost", "prix fournisseur"], required: false },
  { id: "colorName", label: "Coloris", aliases: ["coloris", "couleur", "color"], required: false },
  { id: "colorHex", label: "Teinte (hex)", aliases: ["teinte", "hex", "couleur hex", "colorhex"], required: false },
  { id: "calibre", label: "Calibre", aliases: ["calibre", "taille"], required: false },
  { id: "material", label: "Matière", aliases: ["matiere", "matière", "material"], required: false },
  { id: "shape", label: "Forme", aliases: ["forme", "shape"], required: false },
  { id: "stock", label: "Stock", aliases: ["stock", "disponibilite", "disponibilité", "statut"], required: false },
  { id: "supplierName", label: "Fournisseur", aliases: ["fournisseur", "supplier"], required: false },
  { id: "photo1", label: "Photo 1 (URL)", aliases: ["photo", "photo 1", "photo1", "image", "image 1", "image1", "photo url", "url image", "url image 1", "lien image 1", "lien photo 1", "photo produit 1", "visuel 1"], required: false },
  { id: "photo2", label: "Photo 2 (URL)", aliases: ["photo 2", "photo2", "image 2", "image2", "url image 2", "lien image 2", "lien photo 2", "photo produit 2", "visuel 2"], required: false },
  { id: "photo3", label: "Photo 3 (URL)", aliases: ["photo 3", "photo3", "image 3", "image3", "url image 3", "lien image 3", "lien photo 3", "photo produit 3", "visuel 3"], required: false },
  { id: "photo4", label: "Photo 4 (URL)", aliases: ["photo 4", "photo4", "image 4", "image4", "url image 4", "lien image 4", "lien photo 4", "photo produit 4", "visuel 4"], required: false },
  { id: "photo5", label: "Photo 5 (URL)", aliases: ["photo 5", "photo5", "image 5", "image5", "url image 5", "lien image 5", "lien photo 5", "photo produit 5", "visuel 5"], required: false },
  { id: "description", label: "Description", aliases: ["description", "desc"], required: false },
];

const NEON_ROTATION = [NEON.cyan, NEON.pink, NEON.lime, NEON.orange, NEON.violet, NEON.yellow, NEON.blue];

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectImportMapping(headers) {
  const mapping = {};
  IMPORT_FIELD_DEFS.forEach((f) => {
    const match = headers.find((h) => f.aliases.includes(normalizeKey(h)));
    mapping[f.id] = match || null;
  });
  return mapping;
}

function parseImportNumber(v) {
  if (v === undefined || v === null || v === "") return NaN;
  const cleaned = v.toString().replace(/[€\s]/g, "").replace(",", ".");
  return parseFloat(cleaned);
}

function isValidHexColor(v) {
  return /^#?[0-9a-fA-F]{6}$/.test((v || "").toString().trim());
}
function normalizeHexColor(v) {
  const t = v.toString().trim();
  return t.startsWith("#") ? t : `#${t}`;
}

function buildImportRawRow(row, mapping, rowIndex) {
  const get = (fieldId) => {
    const header = mapping[fieldId];
    return header ? (row[header] ?? "").toString().trim() : "";
  };
  const messages = [];
  let blocking = false;

  const name = get("name");
  if (!name) { messages.push("Titre manquant"); blocking = true; }

  const price = parseImportNumber(get("price"));
  if (isNaN(price) || price <= 0) { messages.push("Prix invalide"); blocking = true; }

  const compareAtRaw = parseImportNumber(get("compareAtPrice"));
  let compareAtPrice = null;
  if (!isNaN(compareAtRaw) && compareAtRaw > 0) {
    if (compareAtRaw > price) compareAtPrice = compareAtRaw;
    else messages.push("Prix barré ignoré (doit être supérieur au prix de vente)");
  }

  const brandNameRaw = get("brandName");
  if (!brandNameRaw) { messages.push("Marque manquante"); blocking = true; }

  let cost = parseImportNumber(get("cost"));
  let costEstimated = false;
  if (isNaN(cost) || cost < 0) { cost = Math.round((isNaN(price) ? 0 : price) * 0.5); costEstimated = true; }

  const categoryRaw = normalizeKey(get("category"));
  let category = "Solaire";
  if (categoryRaw.includes("optique")) category = "Optique";
  else if (categoryRaw.includes("solaire")) category = "Solaire";
  else if (categoryRaw) messages.push(`Catégorie « ${get("category")} » non reconnue, "Solaire" appliquée`);

  const genderRaw = normalizeKey(get("gender"));
  let gender = "Mixte";
  if (genderRaw.includes("homme")) gender = "Homme";
  else if (genderRaw.includes("femme")) gender = "Femme";
  else if (genderRaw.includes("mixte")) gender = "Mixte";
  else if (genderRaw) messages.push(`Genre « ${get("gender")} » non reconnu, "Mixte" appliqué`);

  const colorHexRaw = get("colorHex");
  let colorHex;
  let hexFallback = false;
  if (isValidHexColor(colorHexRaw)) colorHex = normalizeHexColor(colorHexRaw);
  else { colorHex = NEON_ROTATION[rowIndex % NEON_ROTATION.length]; hexFallback = !!colorHexRaw; }

  const shapeRaw = normalizeKey(get("shape"));
  const shape = /rond|round|aviator/.test(shapeRaw) ? "round" : "square";

  const stockRaw = normalizeKey(get("stock"));
  let stock = "En stock";
  if (stockRaw.includes("rupture")) stock = "Rupture";
  else if (stockRaw.includes("commande")) stock = "Sur commande";

  const supplierNameRaw = get("supplierName");

  if (costEstimated) messages.push("Coût estimé (non fourni)");
  if (hexFallback) messages.push("Teinte fournie invalide, couleur par défaut appliquée");

  return {
    rowIndex, name, brandNameRaw,
    category, gender,
    price: isNaN(price) ? 0 : price,
    compareAtPrice,
    cost,
    colorName: get("colorName") || "Standard",
    colorHex, calibre: get("calibre"), material: get("material"), shape, stock,
    supplierNameRaw,
    photos: ["photo1", "photo2", "photo3", "photo4", "photo5"]
      .map((f) => get(f))
      .flatMap((v) => v.split(/[,;|]/))
      .map((s) => s.trim())
      .filter(Boolean),
    description: get("description"),
    messages, status: blocking ? "error" : (messages.length ? "warning" : "ok"),
  };
}

function resolveImportRows(rawRows, existingBrands, existingSuppliers) {
  const brandLookup = new Map(existingBrands.map((b) => [normalizeKey(b.name), b.id]));
  const supplierLookup = new Map(existingSuppliers.map((s) => [normalizeKey(s.name), s.id]));
  const newBrands = [];
  const newSuppliers = [];

  rawRows.forEach((r) => {
    if (r.brandNameRaw) {
      const key = normalizeKey(r.brandNameRaw);
      if (!brandLookup.has(key)) {
        const id = newId("b");
        brandLookup.set(key, id);
        newBrands.push({ id, name: r.brandNameRaw, origin: "—", desc: "" });
      }
    }
    if (r.supplierNameRaw) {
      const key = normalizeKey(r.supplierNameRaw);
      if (!supplierLookup.has(key)) {
        const id = newId("s");
        supplierLookup.set(key, id);
        newSuppliers.push({ id, name: r.supplierNameRaw, contact: "", delay: "", location: "", brandIds: [] });
      }
    }
  });

  const rows = rawRows.map((r) => {
    const brandId = r.brandNameRaw ? brandLookup.get(normalizeKey(r.brandNameRaw)) : null;
    const supplierId = r.supplierNameRaw ? supplierLookup.get(normalizeKey(r.supplierNameRaw)) : (existingSuppliers[0]?.id || "");
    const isNewBrand = brandId && newBrands.some((b) => b.id === brandId);
    const messages = [...r.messages];
    if (isNewBrand) messages.push(`Nouvelle marque créée : « ${r.brandNameRaw} »`);
    return { ...r, brandId, supplierId, messages, status: r.status === "error" ? "error" : (messages.length ? "warning" : "ok") };
  });

  const summary = rows.reduce((s, r) => { s[r.status]++; return s; }, { ok: 0, warning: 0, error: 0 });
  return { rows, newBrands, newSuppliers, summary };
}

const SAMPLE_CSV = `Titre,Marque,Prix,Coût,Catégorie,Genre,Coloris,Teinte,Forme,Calibre,Matière,Stock,Fournisseur,Description
Aviator Steel,Ray-Ban,189,95,Solaire,Mixte,Argent miroir,#00F0FF,round,58-14-135,Métal,En stock,Lux Optic Distribution,Aviator en métal argenté et verres miroir.
Sport Prizm Road,Oakley,199,100,Solaire,Homme,Noir Prizm,#C8FF3D,square,55-18-137,O Matter,Sur commande,Lux Optic Distribution,Monture sport verres Prizm route.`;

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modele-import-produits.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const StatusIcon = ({ status }) => {
  if (status === "ok") return <CheckCircle2 size={15} style={{ color: NEON.lime }} />;
  if (status === "warning") return <AlertTriangle size={15} style={{ color: NEON.yellow }} />;
  return <XCircle size={15} style={{ color: NEG }} />;
};

function ImportWizard({ open, onClose, brands, suppliers, onImport }) {
  const { p } = useTheme();
  const [step, setStep] = useState("upload"); // upload | mapping | preview | done
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep("upload"); setFileName(""); setHeaders([]); setDataRows([]); setMapping({}); setParseError(""); setResult(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    const isCsv = /\.csv$/i.test(file.name);
    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        if (!parsed.meta.fields || parsed.meta.fields.length === 0) { setParseError("Impossible de détecter des colonnes dans ce fichier."); return; }
        setHeaders(parsed.meta.fields);
        setDataRows(parsed.data);
        setMapping(detectImportMapping(parsed.meta.fields));
        setStep("mapping");
      };
      reader.onerror = () => setParseError("Échec de la lecture du fichier.");
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          if (!rows.length) { setParseError("La première feuille du classeur est vide."); return; }
          const hdrs = Object.keys(rows[0]);
          setHeaders(hdrs);
          setDataRows(rows);
          setMapping(detectImportMapping(hdrs));
          setStep("mapping");
        } catch (err) {
          setParseError("Impossible de lire ce fichier Excel.");
        }
      };
      reader.onerror = () => setParseError("Échec de la lecture du fichier.");
      reader.readAsArrayBuffer(file);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const resolved = useMemo(() => {
    if (step !== "preview" && step !== "done") return null;
    const raw = dataRows.map((row, i) => buildImportRawRow(row, mapping, i));
    return resolveImportRows(raw, brands, suppliers);
  }, [step, dataRows, mapping, brands, suppliers]);

  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState("");

  const confirmImport = async () => {
    if (!resolved) return;
    const importable = resolved.rows.filter((r) => r.status !== "error");
    const newProducts = importable.map((r) => ({
      id: newId("p"),
      name: r.name, brandId: r.brandId, category: r.category, gender: r.gender,
      price: r.price, compareAtPrice: r.compareAtPrice, cost: r.cost, colorName: r.colorName, colorHex: r.colorHex,
      shape: r.shape, calibre: r.calibre, material: r.material, stock: r.stock,
      supplierId: r.supplierId, featured: false, description: r.description, photos: r.photos,
    }));
    setImportPending(true); setImportError("");
    try {
      await onImport({ newProducts, newBrands: resolved.newBrands, newSuppliers: resolved.newSuppliers });
      setResult({ imported: newProducts.length, skipped: resolved.rows.length - importable.length, newBrands: resolved.newBrands.length, newSuppliers: resolved.newSuppliers.length });
      setStep("done");
    } catch (err) {
      setImportError(err.message || "Échec de l'import en base de données.");
    } finally {
      setImportPending(false);
    }
  };

  if (!open) return null;
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.inputBg, color: p.text };
  const steps = [{ id: "upload", label: "Fichier" }, { id: "mapping", label: "Colonnes" }, { id: "preview", label: "Vérification" }, { id: "done", label: "Terminé" }];
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-8" style={{ background: p.bg2, animation: "mtrPop .3s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrPop { from { opacity:0; transform: translateY(20px) scale(.98);} to {opacity:1; transform:none;} }`}</style>
        <div className="flex items-center justify-between mb-2">
          <h3 className="mtr-display text-xl font-bold" style={{ color: p.text }}>Importer des produits</h3>
          <button onClick={handleClose}><X size={20} style={{ color: p.text }} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-7 mt-4">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: i <= stepIndex ? PRIMARY : p.bg3, color: i <= stepIndex ? "#07080A" : p.steel }}>
                  {i < stepIndex ? <Check size={12} /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:inline" style={{ color: i <= stepIndex ? p.text : p.steel }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: i < stepIndex ? PRIMARY : p.border }} />}
            </React.Fragment>
          ))}
        </div>

        {step === "upload" && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl py-14 px-6 text-center cursor-pointer transition-colors"
              style={{ border: `2px dashed ${dragOver ? PRIMARY : p.borderStrong}`, background: dragOver ? alpha(PRIMARY, 0.06) : p.bg3 }}
            >
              <Upload size={28} className="mx-auto mb-3" style={{ color: PRIMARY }} />
              <p className="font-medium" style={{ color: p.text }}>Glissez un fichier .csv ou .xlsx ici</p>
              <p className="text-sm mt-1" style={{ color: p.steel }}>ou cliquez pour parcourir vos fichiers</p>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
            {parseError && <p className="text-sm mt-3" style={{ color: NEG }}>{parseError}</p>}
            <div className="mt-6 flex items-start gap-3 p-4 rounded-xl" style={{ background: p.bg3 }}>
              <FileSpreadsheet size={18} style={{ color: p.steel }} className="shrink-0 mt-0.5" />
              <div className="text-sm" style={{ color: alpha(p.text, 0.7) }}>
                Colonnes reconnues automatiquement : <strong>Titre, Marque, Prix</strong> (obligatoires), puis Coût, Catégorie, Genre, Coloris, Teinte (hex), Calibre, Matière, Forme, Stock, Fournisseur, Photo, Description.
                <button onClick={downloadSampleCSV} className="flex items-center gap-1.5 mt-2 font-medium" style={{ color: PRIMARY }}>
                  <Download size={14} /> Télécharger un exemple .csv
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div>
            <p className="text-sm mb-5" style={{ color: p.steel }}>
              Fichier <strong style={{ color: p.text }}>{fileName}</strong> — {dataRows.length} ligne{dataRows.length > 1 ? "s" : ""} détectée{dataRows.length > 1 ? "s" : ""}. Vérifiez la correspondance des colonnes.
            </p>
            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
              {IMPORT_FIELD_DEFS.map((f) => (
                <div key={f.id} className="grid grid-cols-2 gap-3 items-center">
                  <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: p.text }}>
                    {f.label} {f.required && <span style={{ color: NEG }}>*</span>}
                  </div>
                  <select
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    value={mapping[f.id] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.id]: e.target.value || null }))}
                  >
                    <option value="">— Ignorer —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={reset} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Changer de fichier</button>
              <NeonButton onClick={() => setStep("preview")} className="flex-1 py-3 rounded-full">Vérifier les données</NeonButton>
            </div>
          </div>
        )}

        {step === "preview" && resolved && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              <Pill style={{ background: alpha(NEON.lime, 0.14), color: NEON.lime }}>{resolved.summary.ok} prêtes</Pill>
              <Pill style={{ background: alpha(NEON.yellow, 0.16), color: "#8a7d00" }}>{resolved.summary.warning} avertissement{resolved.summary.warning > 1 ? "s" : ""}</Pill>
              <Pill style={{ background: alpha(NEG, 0.14), color: NEG }}>{resolved.summary.error} erreur{resolved.summary.error > 1 ? "s" : ""} (ignorée{resolved.summary.error > 1 ? "s" : ""})</Pill>
              {resolved.newBrands.length > 0 && <Pill style={{ background: p.bg3, color: p.steel }}>+{resolved.newBrands.length} nouvelle{resolved.newBrands.length > 1 ? "s" : ""} marque{resolved.newBrands.length > 1 ? "s" : ""}</Pill>}
              {resolved.newSuppliers.length > 0 && <Pill style={{ background: p.bg3, color: p.steel }}>+{resolved.newSuppliers.length} nouveau{resolved.newSuppliers.length > 1 ? "x" : ""} fournisseur{resolved.newSuppliers.length > 1 ? "s" : ""}</Pill>}
            </div>
            {resolved.rows.every((r) => !r.photos || r.photos.length === 0) && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl mb-4" style={{ background: alpha(NEON.yellow, 0.12), border: `1px solid ${alpha(NEON.yellow, 0.4)}` }}>
                <AlertTriangle size={16} style={{ color: "#8a7d00" }} className="shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: p.text }}>
                  Aucune photo détectée sur l'ensemble du fichier. Si vos colonnes contiennent bien des images,
                  retournez à l'étape précédente et vérifiez que <strong>Photo 1</strong> à <strong>Photo 5</strong> sont
                  associées aux bonnes colonnes (pas sur "— Ignorer —").
                </p>
              </div>
            )}
            <div className="rounded-xl overflow-hidden max-h-[42vh] overflow-y-auto" style={{ border: `1px solid ${p.border}` }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: p.bg3 }}>
                  <tr className="text-left">
                    {["", "Titre", "Marque", "Prix", "Photos", "Détails"].map((h) => (
                      <th key={h} className="px-3 py-2 mtr-mono text-[10px] uppercase tracking-wide" style={{ color: p.steel }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resolved.rows.map((r) => (
                    <tr key={r.rowIndex} className="border-t" style={{ borderColor: p.border, opacity: r.status === "error" ? 0.55 : 1 }}>
                      <td className="px-3 py-2"><StatusIcon status={r.status} /></td>
                      <td className="px-3 py-2 font-medium" style={{ color: p.text }}>{r.name || "—"}</td>
                      <td className="px-3 py-2" style={{ color: p.steel }}>{r.brandNameRaw || "—"}</td>
                      <td className="px-3 py-2" style={{ color: p.text }}>{r.price ? euro(r.price) : "—"}</td>
                      <td className="px-3 py-2">
                        {r.photos && r.photos.length > 0 ? (
                          <span className="inline-flex items-center gap-1" style={{ color: NEON.lime }}><ImageIcon size={12} /> {r.photos.length}</span>
                        ) : (
                          <span style={{ color: p.steel }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: p.steel }}>{r.messages.join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importError && <p className="text-sm mt-4" style={{ color: NEG }}>{importError}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep("mapping")} disabled={importPending} className="flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-40" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Revoir le mapping</button>
              <NeonButton onClick={confirmImport} disabled={resolved.summary.ok + resolved.summary.warning === 0 || importPending} className="flex-1 py-3 rounded-full flex items-center justify-center gap-2">
                {importPending ? <><Loader2 size={16} className="animate-spin" /> Import en cours…</> : <>Importer {resolved.summary.ok + resolved.summary.warning} produit{resolved.summary.ok + resolved.summary.warning > 1 ? "s" : ""}</>}
              </NeonButton>
            </div>
          </div>
        )}


        {step === "done" && result && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: alpha(NEON.lime, 0.16) }}>
              <Check size={26} style={{ color: NEON.lime }} />
            </div>
            <h3 className="mtr-display text-xl font-bold mb-2" style={{ color: p.text }}>Import terminé</h3>
            <p className="text-sm mb-1" style={{ color: alpha(p.text, 0.7) }}>
              <strong style={{ color: p.text }}>{result.imported}</strong> produit{result.imported > 1 ? "s" : ""} ajouté{result.imported > 1 ? "s" : ""} au catalogue.
            </p>
            {result.skipped > 0 && <p className="text-sm mb-1" style={{ color: p.steel }}>{result.skipped} ligne{result.skipped > 1 ? "s" : ""} ignorée{result.skipped > 1 ? "s" : ""} (erreur bloquante).</p>}
            {(result.newBrands > 0 || result.newSuppliers > 0) && (
              <p className="text-sm mb-4" style={{ color: p.steel }}>
                {result.newBrands > 0 && <>{result.newBrands} marque{result.newBrands > 1 ? "s" : ""} créée{result.newBrands > 1 ? "s" : ""}. </>}
                {result.newSuppliers > 0 && <>{result.newSuppliers} fournisseur{result.newSuppliers > 1 ? "s" : ""} créé{result.newSuppliers > 1 ? "s" : ""}.</>}
              </p>
            )}
            <NeonButton onClick={handleClose} className="px-6 py-3 rounded-full mt-2">Voir les produits</NeonButton>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminProducts({ products, setProducts, brands, setBrands, suppliers, setSuppliers }) {
  const { p } = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = products.filter((pr) => {
    const brand = brands.find((b) => b.id === pr.brandId)?.name || "";
    return `${pr.name} ${brand}`.toLowerCase().includes(search.toLowerCase());
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((pr) => selected.has(pr.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((pr) => next.delete(pr.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((pr) => next.add(pr.id));
      return next;
    });
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async (form) => {
    setError("");
    try {
      if (editing) {
        const updated = await dbUpdateProduct({ ...form, id: editing.id });
        setProducts((ps) => ps.map((pr) => (pr.id === editing.id ? updated : pr)));
      } else {
        const created = await dbCreateProduct({ ...form, id: newId("p") });
        setProducts((ps) => [...ps, created]);
      }
      setFormOpen(false); setEditing(null);
    } catch (err) {
      setError(err.message || "Échec de l'enregistrement.");
    }
  };
  const remove = async (id) => {
    setError("");
    try {
      await dbDeleteProduct(id);
      setProducts((ps) => ps.filter((pr) => pr.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      setError(err.message || "Échec de la suppression.");
    }
  };
  const removeSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Supprimer définitivement ${selected.size} produit${selected.size > 1 ? "s" : ""} ?`)) return;
    setError(""); setBulkDeleting(true);
    const ids = Array.from(selected);
    try {
      const results = await Promise.allSettled(ids.map((id) => dbDeleteProduct(id)));
      const succeededIds = ids.filter((_, i) => results[i].status === "fulfilled");
      const failedCount = ids.length - succeededIds.length;
      setProducts((ps) => ps.filter((pr) => !succeededIds.includes(pr.id)));
      setSelected(new Set());
      if (failedCount > 0) setError(`${failedCount} produit${failedCount > 1 ? "s n'ont" : " n'a"} pas pu être supprimé${failedCount > 1 ? "s" : ""}.`);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Persists the whole import batch to Supabase (new brands/suppliers first, so products can
  // reference their ids via foreign key, then the products themselves) before updating local state.
  const handleImport = async ({ newProducts, newBrands, newSuppliers }) => {
    if (newBrands.length) {
      const createdBrands = await dbCreateBrands(newBrands);
      setBrands((bs) => [...bs, ...createdBrands]);
    }
    if (newSuppliers.length) {
      const createdSuppliers = await dbCreateSuppliers(newSuppliers);
      setSuppliers((ss) => [...ss, ...createdSuppliers]);
    }
    const createdProducts = await dbCreateProducts(newProducts);
    setProducts((ps) => [...ps, ...createdProducts]);
  };

  return (
    <div>
      <AdminHeader
        title="Produits"
        subtitle={`${products.length} référence${products.length > 1 ? "s" : ""} au catalogue`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.bg2, border: `1px solid ${p.borderStrong}`, color: p.text }}>
              <Upload size={15} /> Importer CSV / Excel
            </button>
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.text, color: p.bg }}><Plus size={15} /> Ajouter un produit</button>
          </div>
        }
      />
      {error && <p className="text-sm mb-4" style={{ color: NEG }}>{error}</p>}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full px-4 py-2.5 max-w-sm flex-1" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
          <Search size={15} style={{ color: p.steel }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="flex-1 outline-none text-sm bg-transparent" style={{ color: p.text }} />
        </div>
        {selected.size > 0 && (
          <button onClick={removeSelected} disabled={bulkDeleting} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: alpha(NEG, 0.14), color: NEG, border: `1px solid ${alpha(NEG, 0.35)}` }}>
            {bulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Supprimer la sélection ({selected.size})
          </button>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="text-left" style={{ background: p.bg3 }}>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} style={{ accentColor: PRIMARY }} />
                </th>
                {["", "Produit", "Catégorie", "Prix", "Coût", "Marge", "Fournisseur", "Stock", ""].map((h) => (
                  <th key={h} className="px-4 py-3 mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((pr) => {
                const brand = brands.find((b) => b.id === pr.brandId);
                const supplier = suppliers.find((s) => s.id === pr.supplierId);
                const margin = Math.round(((pr.price - pr.cost) / pr.price) * 100);
                return (
                  <tr key={pr.id} className="border-t" style={{ borderColor: p.border, background: selected.has(pr.id) ? alpha(PRIMARY, 0.05) : "transparent" }}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(pr.id)} onChange={() => toggleOne(pr.id)} style={{ accentColor: PRIMARY }} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-11 h-9 rounded-md overflow-hidden flex items-center justify-center" style={{ background: p.bg3 }}>
                        <ProductVisual product={pr} stroke={alpha(p.text, 0.5)} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: p.text }}>{pr.name}</div>
                      <div className="text-xs mtr-mono" style={{ color: BRAND_ACCENT[pr.brandId] || PRIMARY }}>{brand?.name}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: p.steel }}>{pr.category}</td>
                    <td className="px-4 py-3 font-medium"><PriceTag price={pr.price} compareAt={pr.compareAtPrice} className="font-medium" /></td>
                    <td className="px-4 py-3" style={{ color: p.steel }}>{euro(pr.cost)}</td>
                    <td className="px-4 py-3"><Pill style={{ background: margin > 30 ? alpha(NEON.lime, 0.14) : alpha(NEG, 0.14), color: margin > 30 ? NEON.lime : NEG }}>{margin}%</Pill></td>
                    <td className="px-4 py-3 text-xs" style={{ color: p.steel }}>{supplier?.name}</td>
                    <td className="px-4 py-3"><Pill style={{ background: pr.stock === "En stock" ? alpha(NEON.lime, 0.14) : alpha(NEG, 0.14), color: pr.stock === "En stock" ? NEON.lime : NEG }}>{pr.stock}</Pill></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(pr); setFormOpen(true); }} className="p-1.5 rounded-lg" style={{ color: p.steel }}><Pencil size={14} /></button>
                        <button onClick={() => remove(pr.id)} className="p-1.5 rounded-lg" style={{ color: NEG }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ProductFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} brands={brands} suppliers={suppliers} initial={editing} />
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} brands={brands} suppliers={suppliers} onImport={handleImport} />
    </div>
  );
}

/* ---------------------------------- ADMIN: BRANDS ---------------------------------- */

function BrandFormModal({ open, onClose, onSave, initial }) {
  const { p } = useTheme();
  const empty = { name: "", origin: "", desc: "" };
  const [form, setForm] = useState(initial || empty);
  useEffect(() => { setForm(initial || empty); }, [initial, open]);
  if (!open) return null;
  const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.inputBg, color: p.text };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl p-8" style={{ background: p.bg2, animation: "mtrPop .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="mtr-display text-xl font-bold" style={{ color: p.text }}>{initial ? "Modifier la marque" : "Nouvelle marque"}</h3>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="space-y-3">
          <input placeholder="Nom de la marque" className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Pays d'origine" className={inputCls} style={inputStyle} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          <textarea placeholder="Description courte" rows={3} className={inputCls} style={inputStyle} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn-magnet flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-40" style={{ background: p.text, color: p.bg }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function AdminBrands({ brands, setBrands, products }) {
  const { p } = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const save = async (form) => {
    setError("");
    try {
      if (editing) {
        const updated = await dbUpdateBrand({ ...form, id: editing.id });
        setBrands((bs) => bs.map((b) => (b.id === editing.id ? updated : b)));
      } else {
        const created = await dbCreateBrand({ ...form, id: newId("b") });
        setBrands((bs) => [...bs, created]);
      }
      setFormOpen(false); setEditing(null);
    } catch (err) {
      setError(err.message || "Échec de l'enregistrement.");
    }
  };
  const remove = async (id) => {
    setError("");
    try {
      await dbDeleteBrand(id);
      setBrands((bs) => bs.filter((b) => b.id !== id));
    } catch (err) {
      setError(err.message || "Échec de la suppression.");
    }
  };

  return (
    <div>
      <AdminHeader title="Marques" subtitle="Maisons référencées sur la boutique." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.text, color: p.bg }}><Plus size={15} /> Ajouter une marque</button>} />
      {error && <p className="text-sm mb-4" style={{ color: NEG }}>{error}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {brands.map((b) => {
          const count = products.filter((pr) => pr.brandId === b.id).length;
          const accent = BRAND_ACCENT[b.id] || PRIMARY;
          return (
            <div key={b.id} className="p-5 rounded-2xl card-lift" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold" style={{ color: p.text }}>{b.name}</div>
                  <div className="text-xs mtr-mono uppercase mt-0.5" style={{ color: p.steel }}>{b.origin} · {count} produit{count > 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                  <button onClick={() => { setEditing(b); setFormOpen(true); }} className="p-1.5" style={{ color: p.steel }}><Pencil size={14} /></button>
                  <button onClick={() => remove(b.id)} className="p-1.5" style={{ color: NEG }}><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm mt-2" style={{ color: alpha(p.text, 0.6) }}>{b.desc}</p>
            </div>
          );
        })}
      </div>
      <BrandFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} initial={editing} />
    </div>
  );
}

/* ---------------------------------- ADMIN: SUPPLIERS ---------------------------------- */

function SupplierFormModal({ open, onClose, onSave, initial, brands }) {
  const { p } = useTheme();
  const empty = { name: "", contact: "", delay: "", location: "", brandIds: [] };
  const [form, setForm] = useState(initial || empty);
  useEffect(() => { setForm(initial || empty); }, [initial, open]);
  if (!open) return null;
  const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.inputBg, color: p.text };
  const toggleBrand = (id) => setForm((f) => ({ ...f, brandIds: f.brandIds.includes(id) ? f.brandIds.filter((x) => x !== id) : [...f.brandIds, id] }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl p-8" style={{ background: p.bg2, animation: "mtrPop .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="mtr-display text-xl font-bold" style={{ color: p.text }}>{initial ? "Modifier le fournisseur" : "Nouveau fournisseur"}</h3>
          <button onClick={onClose}><X size={20} style={{ color: p.text }} /></button>
        </div>
        <div className="space-y-3">
          <input placeholder="Nom du fournisseur" className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Contact (e-mail)" className={inputCls} style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <input placeholder="Délai de livraison" className={inputCls} style={inputStyle} value={form.delay} onChange={(e) => setForm({ ...form, delay: e.target.value })} />
          <input placeholder="Localisation" className={inputCls} style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div>
            <label className="text-xs mtr-mono uppercase tracking-wide block mb-2" style={{ color: p.steel }}>Marques fournies</label>
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => {
                const active = form.brandIds.includes(b.id);
                const accent = BRAND_ACCENT[b.id] || PRIMARY;
                return (
                  <button key={b.id} onClick={() => toggleBrand(b.id)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors" style={{ background: active ? alpha(accent, 0.16) : p.bg3, color: active ? accent : p.steel }}>
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn-magnet flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-40" style={{ background: p.text, color: p.bg }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function AdminSuppliers({ suppliers, setSuppliers, brands }) {
  const { p } = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const save = async (form) => {
    setError("");
    try {
      if (editing) {
        const updated = await dbUpdateSupplier({ ...form, id: editing.id });
        setSuppliers((ss) => ss.map((s) => (s.id === editing.id ? updated : s)));
      } else {
        const created = await dbCreateSupplier({ ...form, id: newId("s") });
        setSuppliers((ss) => [...ss, created]);
      }
      setFormOpen(false); setEditing(null);
    } catch (err) {
      setError(err.message || "Échec de l'enregistrement.");
    }
  };
  const remove = async (id) => {
    setError("");
    try {
      await dbDeleteSupplier(id);
      setSuppliers((ss) => ss.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message || "Échec de la suppression.");
    }
  };

  return (
    <div>
      <AdminHeader title="Fournisseurs" subtitle="Grossistes en dropshipping associés à la boutique." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.text, color: p.bg }}><Plus size={15} /> Ajouter un fournisseur</button>} />
      {error && <p className="text-sm mb-4" style={{ color: NEG }}>{error}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {suppliers.map((s) => (
          <div key={s.id} className="p-5 rounded-2xl card-lift" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: p.bg3 }}><Building2 size={16} style={{ color: p.text }} /></div>
                <div>
                  <div className="font-bold" style={{ color: p.text }}>{s.name}</div>
                  <div className="text-xs" style={{ color: p.steel }}>{s.location}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(s); setFormOpen(true); }} className="p-1.5" style={{ color: p.steel }}><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-1.5" style={{ color: NEG }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 text-sm" style={{ color: alpha(p.text, 0.65) }}>{s.contact}</div>
            <div className="mt-1 text-sm mtr-mono" style={{ color: p.steel }}>Délai : {s.delay}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.brandIds.map((bid) => {
                const b = brands.find((x) => x.id === bid);
                return b ? <Pill key={bid} style={{ background: p.bg3, color: p.steel }}>{b.name}</Pill> : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <SupplierFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} initial={editing} brands={brands} />
    </div>
  );
}

/* ---------------------------------- ADMIN: ORDERS ---------------------------------- */

function AdminPromoCodes() {
  const { p } = useTheme();
  const [promos, setPromos] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", discountPercent: "", maxUses: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPromoCodes().then(setPromos).catch((err) => setError(err.message || "Échec du chargement."));
  }, []);

  const create = async () => {
    if (!form.code.trim() || !form.discountPercent) { setError("Code et pourcentage de remise obligatoires."); return; }
    setCreating(true); setError("");
    try {
      const created = await createPromoCode({
        code: form.code, discountPercent: Number(form.discountPercent),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      setPromos((ps) => [created, ...ps]);
      setForm({ code: "", discountPercent: "", maxUses: "", expiresAt: "" });
    } catch (err) {
      setError(err.message?.includes("duplicate") ? "Ce code existe déjà." : (err.message || "Échec de la création."));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (code, active) => {
    setPromos((ps) => ps.map((pr) => (pr.code === code ? { ...pr, active } : pr)));
    try { await setPromoCodeActive(code, active); } catch (err) { setError(err.message || "Échec."); }
  };
  const remove = async (code) => {
    setPromos((ps) => ps.filter((pr) => pr.code !== code));
    try { await deletePromoCode(code); } catch (err) { setError(err.message || "Échec."); }
  };

  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.bg2, color: p.text };
  const inputCls = "px-3 py-2.5 rounded-lg text-sm outline-none";

  return (
    <div>
      <AdminHeader title="Codes promo" subtitle="Créez et gérez les codes de réduction utilisables au paiement" />
      {error && <p className="text-sm mb-4" style={{ color: NEG }}>{error}</p>}

      <div className="rounded-2xl p-5 mb-6 flex flex-wrap items-end gap-3" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div>
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>Code</label>
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BIENVENUE10" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>Remise (%)</label>
          <input type="number" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} placeholder="10" className={`${inputCls} w-24`} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>Utilisations max (optionnel)</label>
          <input type="number" value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} placeholder="Illimité" className={`${inputCls} w-36`} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs mtr-mono uppercase tracking-wide block mb-1.5" style={{ color: p.steel }}>Expiration (optionnel)</label>
          <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
        <button onClick={create} disabled={creating} className="btn-magnet px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: p.text, color: p.bg }}>
          {creating ? "Création…" : "Créer"}
        </button>
      </div>

      {promos === null ? (
        <p className="text-sm" style={{ color: p.steel }}>Chargement…</p>
      ) : promos.length === 0 ? (
        <p className="text-sm" style={{ color: p.steel }}>Aucun code promo pour le moment.</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: p.bg3 }}>
                {["Code", "Remise", "Utilisations", "Expire", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-3 mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((pr) => (
                <tr key={pr.code} className="border-t" style={{ borderColor: p.border }}>
                  <td className="px-4 py-3 font-bold mtr-mono" style={{ color: p.text }}>{pr.code}</td>
                  <td className="px-4 py-3" style={{ color: p.text }}>-{pr.discountPercent}%</td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{pr.usedCount}{pr.maxUses ? ` / ${pr.maxUses}` : ""}</td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{pr.expiresAt ? new Date(pr.expiresAt).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(pr.code, !pr.active)}>
                      <Pill style={{ background: alpha(pr.active ? NEON.lime : NEG, 0.14), color: pr.active ? NEON.lime : NEG }}>{pr.active ? "Actif" : "Désactivé"}</Pill>
                    </button>
                  </td>
                  <td className="px-4 py-3"><button onClick={() => remove(pr.code)} className="p-1.5 rounded-lg" style={{ color: NEG }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminOrders({ orders, setOrders, products }) {
  const { p } = useTheme();
  const statuses = ["En attente", "Expédiée", "Livrée", "Annulée"];
  const [error, setError] = useState("");
  const setStatus = async (id, status) => {
    setError("");
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o))); // optimistic
    try {
      await dbUpdateOrderStatus(id, status);
    } catch (err) {
      setOrders(prev);
      setError(err.message || "Échec de la mise à jour du statut.");
    }
  };
  const remove = async (id) => {
    setError("");
    try {
      await dbDeleteOrder(id);
      setOrders((os) => os.filter((o) => o.id !== id));
    } catch (err) {
      setError(err.message || "Échec de la suppression.");
    }
  };
  const total = (o) => o.items.reduce((s, it) => s + (products.find((pr) => pr.id === it.productId)?.price || 0) * it.qty, 0);
  const statusColor = (s) => ({ "En attente": NEON.orange, "Expédiée": NEON.cyan, "Livrée": NEON.lime, "Annulée": NEG }[s] || p.steel);

  return (
    <div>
      <AdminHeader title="Commandes" subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""} enregistrée${orders.length > 1 ? "s" : ""}`} />
      {error && <p className="text-sm mb-4" style={{ color: NEG }}>{error}</p>}
      <div className="rounded-2xl overflow-hidden" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ background: p.bg3 }}>
                {["Commande", "Client", "Date", "Articles", "Total", "Paiement", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-3 mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t" style={{ borderColor: p.border }}>
                  <td className="px-4 py-3 mtr-mono text-xs" style={{ color: p.steel }}>#{o.orderNumber ? String(o.orderNumber).padStart(5, "0") : o.id.slice(-5).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: p.text }}>{o.client}</div>
                    <div className="text-xs" style={{ color: p.steel }}>{o.email}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{o.date}</td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{o.items.reduce((s, it) => s + it.qty, 0)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: p.text }}>{euro(o.total ?? total(o))}</td>
                  <td className="px-4 py-3">
                    <Pill style={{
                      background: alpha(o.paymentStatus === "paid" ? NEON.lime : o.paymentStatus === "failed" ? NEG : NEON.orange, 0.14),
                      color: o.paymentStatus === "paid" ? NEON.lime : o.paymentStatus === "failed" ? NEG : NEON.orange,
                    }}>
                      {o.paymentStatus === "paid" ? "Payée" : o.paymentStatus === "failed" ? "Échouée" : "En attente"}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="px-2.5 py-1.5 rounded-full text-xs font-medium outline-none" style={{ background: "transparent", border: `1px solid ${statusColor(o.status)}`, color: statusColor(o.status) }}>
                      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><button onClick={() => remove(o.id)} className="p-1.5" style={{ color: NEG }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ROOT (site + admin) ---------------------------------- */

function Root() {
  const { p } = useTheme();
  const [mode, setMode] = useState("site");
  const [page, setPage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("monture_recent") || "[]"); } catch { return []; }
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd/Ctrl+K opens the instant search palette from anywhere on the site.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState({ category: "Tous", gender: "Tous" });
  const [checkoutNotice, setCheckoutNotice] = useState(null); // { type: 'success'|'cancel' } | null

  // Picked once products are loaded (i.e. once per visit / page refresh), not recomputed on every
  // re-render — otherwise unrelated state changes elsewhere (theme toggle, cart) would swap the
  // featured product mid-session, which would feel like a bug rather than a nice surprise. Shared
  // by Hero and ScrollGlassesStory so the homepage tells a consistent story around one product.
  const featuredRef = useRef(undefined);
  if (featuredRef.current === undefined && products.length > 0) {
    const withPhotos = products.filter((pr) => pr.photos && pr.photos.length > 0);
    featuredRef.current = withPhotos.length ? withPhotos[Math.floor(Math.random() * withPhotos.length)] : null;
  }
  const featuredProduct = featuredRef.current || null;

  // Same "pick once per visit" pattern as featuredProduct, one random (photo-bearing) product per
  // category/gender tile, so the category banner feels alive without flickering mid-session.
  const categoryProductsRef = useRef(undefined);
  if (categoryProductsRef.current === undefined && products.length > 0) {
    const combos = [["Solaire", "Femme"], ["Optique", "Femme"], ["Solaire", "Homme"], ["Optique", "Homme"]];
    const map = {};
    combos.forEach(([category, gender]) => {
      const matches = products.filter((pr) => pr.category === category && pr.gender === gender && pr.photos && pr.photos.length > 0);
      const fallback = matches.length ? matches : products.filter((pr) => pr.category === category && pr.photos && pr.photos.length > 0);
      map[`${category}_${gender}`] = fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : null;
    });
    categoryProductsRef.current = map;
  }
  const categoryProducts = categoryProductsRef.current || {};

  // Only ever based on a genuine compareAtPrice set in the admin — never a fabricated "discount".
  const deepDiscountProducts = useMemo(
    () => products.filter((pr) => pr.compareAtPrice && pr.compareAtPrice > 0 && (1 - pr.price / pr.compareAtPrice) >= 0.65),
    [products]
  );

  // Real signals computed from actual data — never invented. Only *paid* orders count toward
  // "best-seller" so it can't be inflated by abandoned/pending carts, and "low stock" only shows
  // when a real stock_quantity has been set on the product in the admin (no fake scarcity).
  const productInsights = useMemo(() => {
    const salesByProduct = {};
    orders.forEach((o) => {
      if (o.paymentStatus !== "paid") return;
      (o.items || []).forEach((it) => { salesByProduct[it.productId] = (salesByProduct[it.productId] || 0) + it.qty; });
    });
    const ranked = Object.entries(salesByProduct).filter(([, qty]) => qty > 0).sort((a, b) => b[1] - a[1]);
    const bestSellerIds = new Set(ranked.slice(0, 4).map(([id]) => id));
    const now = Date.now();
    const map = {};
    products.forEach((p) => {
      const isNew = p.createdAt ? now - new Date(p.createdAt).getTime() < 14 * 24 * 3600 * 1000 : false;
      const lowStock = p.stockQuantity !== null && p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 3;
      const productReviews = reviews.filter((r) => r.productId === p.id);
      const avgRating = productReviews.length ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length : null;
      map[p.id] = { isBestSeller: bestSellerIds.has(p.id), isNew, lowStock, stockQuantity: p.stockQuantity, unitsSold: salesByProduct[p.id] || 0, avgRating, reviewCount: productReviews.length };
    });
    return map;
  }, [products, orders, reviews]);

  // Initial data load from Supabase.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllData(), fetchAllReviews().catch(() => [])])
      .then(([data, allReviews]) => {
        if (cancelled) return;
        setProducts(data.products);
        setBrands(data.brands);
        setSuppliers(data.suppliers);
        setOrders(data.orders);
        setReviews(allReviews);
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || "Erreur de connexion à la base de données."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Auth session (persists across reloads while the Supabase session is valid). Whenever the
  // session changes we also (re)fetch the profile — this is what distinguishes an admin account
  // from a customer account (see the "profiles.role" column), since both use the same Supabase
  // Auth. Without this, any customer who creates an account could otherwise open /Espace pro.
  useEffect(() => {
    let cancelled = false;
    const syncProfile = async (s) => {
      setSession(s);
      if (s) {
        try {
          const prof = await getProfile(s.user.id);
          if (!cancelled) setProfile(prof);
        } catch {
          if (!cancelled) setProfile(null);
        }
        try {
          const ids = await fetchWishlist(s.user.id);
          if (!cancelled) setWishlistIds(ids);
        } catch {
          if (!cancelled) setWishlistIds([]);
        }
      } else {
        setProfile(null);
        setWishlistIds([]);
      }
      if (!cancelled) setAuthChecked(true);
    };
    getSession().then(syncProfile).catch(() => setAuthChecked(true));
    const unsubscribe = onAuthChange(syncProfile);
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // Stripe redirects back with ?checkout=success|cancel — read it once on load, then clean the
  // URL so refreshing the page doesn't replay the notice.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("checkout");
    if (result === "success") {
      setCheckoutNotice({ type: "success" });
      setCart([]);
    } else if (result === "cancel") {
      setCheckoutNotice({ type: "cancel" });
    }
    if (result) {
      params.delete("checkout");
      params.delete("session_id");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const addToCart = (product, qty) => {
    setCart((c) => {
      const existing = c.find((i) => i.productId === product.id);
      if (existing) return c.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + qty } : i));
      return [...c, { productId: product.id, qty }];
    });
    setCartOpen(true);
  };
  const updateQty = (productId, qty) => setCart((c) => c.map((i) => (i.productId === productId ? { ...i, qty } : i)));
  const removeItem = (productId) => setCart((c) => c.filter((i) => i.productId !== productId));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const toggleWishlist = async (productId) => {
    if (!session) { setCheckoutOpen(true); return; } // reuses the account step of the checkout wizard to sign in/up
    const already = wishlistIds.includes(productId);
    setWishlistIds((ids) => (already ? ids.filter((id) => id !== productId) : [...ids, productId])); // optimistic
    try {
      if (already) await removeFromWishlist(session.user.id, productId);
      else await addToWishlist(session.user.id, productId);
    } catch {
      setWishlistIds((ids) => (already ? [...ids, productId] : ids.filter((id) => id !== productId))); // revert on failure
    }
  };

  // No account needed, no DB — comparison is a lightweight, session-only browsing aid, capped
  // at 3 items so the side-by-side table stays readable.
  const toggleCompare = (productId) => {
    setCompareIds((ids) => {
      if (ids.includes(productId)) return ids.filter((id) => id !== productId);
      if (ids.length >= 3) return ids;
      return [...ids, productId];
    });
  };

  const submitReview = async ({ productId, rating, comment }) => {
    if (!session) { setCheckoutOpen(true); return; }
    const authorName = profile?.fullName?.trim() || session.user.email.split("@")[0];
    const saved = await upsertReview({ productId, userId: session.user.id, authorName, rating, comment });
    setReviews((rs) => [saved, ...rs.filter((r) => !(r.productId === saved.productId && r.userId === saved.userId))]);
  };

  const trackRecentlyViewed = (productId) => {
    setRecentlyViewed((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, 8);
      try { localStorage.setItem("monture_recent", JSON.stringify(next)); } catch { /* storage unavailable, ignore */ }
      return next;
    });
  };

  const saveShippingAddress = async (address) => {
    const updated = await upsertProfile(session.user.id, { ...address, email: session.user.email });
    setProfile(updated);
  };

  // Creates the order (status "pending" payment) then hands off to Stripe Checkout — the browser
  // navigates away entirely, so nothing after the redirect matters; payment confirmation comes
  // back later via the webhook (server-side) and the ?checkout=success redirect (client-side UX).
  const startCheckout = async (address, promo) => {
    const lines = cart.map((c) => ({ ...c, product: products.find((pr) => pr.id === c.productId) }));
    const subtotal = lines.reduce((s, l) => s + (l.product?.price || 0) * l.qty, 0);
    const discountPercent = promo?.discountPercent || 0;
    const total = subtotal * (1 - discountPercent / 100);
    const order = {
      id: newId("o"),
      client: address.fullName,
      email: session.user.email,
      date: new Date().toLocaleDateString("fr-FR"),
      items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
      status: "En attente",
      userId: session.user.id,
      shippingAddress: address,
      paymentStatus: "pending",
      total,
      promoCode: promo?.code || null,
      discountPercent: promo?.discountPercent || null,
    };
    const created = await dbCreateOrder(order);
    setOrders((os) => [created, ...os]);
    // Discount is applied by proportionally reducing each line's unit price before it reaches
    // Stripe (Stripe doesn't accept negative amounts on price_data), so the sum still matches
    // the discounted total shown to the customer.
    const stripeItems = lines.map((l) => ({
      name: l.product?.name || "Produit",
      price: (l.product?.price || 0) * (1 - discountPercent / 100),
      quantity: l.qty,
      image: l.product?.photos?.[0],
    }));
    const url = await createStripeCheckout({ orderId: order.id, items: stripeItems, customerEmail: session.user.email });
    window.location.href = url;
  };

  // Base page title per section (overridden temporarily while a product modal is open — see
  // ProductModal's own title effect, which restores this value on close).
  useEffect(() => {
    if (mode === "admin") { document.title = "Espace pro — go2glass"; return; }
    const titles = { home: "go2glass — Lunettes de marque au meilleur prix", catalogue: "Catalogue — go2glass", marques: "Nos marques — go2glass", apropos: "À propos — go2glass" };
    document.title = titles[page] || "go2glass";
  }, [page, mode]);

  const goAdmin = () => { setMode("admin"); setCartOpen(false); };
  const backToSite = () => setMode("site");
  // Wraps setPage so any "go to catalogue" entry point (hero CTA, footer, brand cards…) resets
  // the category/gender filter to "Tous" — only the header's dedicated category links set a filter.
  const goPage = (pg) => {
    if (pg === "catalogue") setCatalogFilter({ category: "Tous", gender: "Tous" });
    setPage(pg);
  };
  const goCategory = (category, gender) => {
    setCatalogFilter({ category, gender });
    setPage("catalogue");
    window.scrollTo({ top: 0 });
  };
  const handleLogin = async (email, password) => { await signIn(email, password); };
  const handleLogout = async () => { await signOut(); };

  if (loading || !authChecked) {
    return (
      <div className="mtr grain flex items-center justify-center" style={{ background: p.bg, minHeight: "100vh" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mtr grain flex items-center justify-center px-6" style={{ background: p.bg, minHeight: "100vh" }}>
        <div className="max-w-md text-center">
          <AlertTriangle size={28} className="mx-auto mb-4" style={{ color: NEG }} />
          <h2 className="mtr-display text-xl font-bold mb-2" style={{ color: p.text }}>Connexion à la base impossible</h2>
          <p className="text-sm" style={{ color: p.steel }}>{loadError}</p>
          <p className="text-xs mt-3" style={{ color: p.steel }}>Vérifiez VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY et que le schéma SQL a bien été exécuté.</p>
        </div>
      </div>
    );
  }

  if (mode === "admin") {
    const isAdmin = session && profile && profile.role === "admin";
    if (!isAdmin) {
      return (
        <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}>
          <AdminLogin
            onLogin={handleLogin}
            onBackToSite={backToSite}
            deniedNotice={session && profile && profile.role !== "admin" ? "Ce compte n'a pas les droits d'accès à l'espace pro." : ""}
          />
        </div>
      );
    }
    return (
      <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}>
        <AdminShell tab={adminTab} setTab={setAdminTab} onLogout={handleLogout} onBackToSite={backToSite}>
          {adminTab === "dashboard" && <AdminDashboard products={products} orders={orders} brands={brands} />}
          {adminTab === "products" && <AdminProducts products={products} setProducts={setProducts} brands={brands} setBrands={setBrands} suppliers={suppliers} setSuppliers={setSuppliers} />}
          {adminTab === "brands" && <AdminBrands brands={brands} setBrands={setBrands} products={products} />}
          {adminTab === "suppliers" && <AdminSuppliers suppliers={suppliers} setSuppliers={setSuppliers} brands={brands} />}
          {adminTab === "orders" && <AdminOrders orders={orders} setOrders={setOrders} products={products} />}
          {adminTab === "promos" && <AdminPromoCodes />}
        </AdminShell>
      </div>
    );
  }

  return (
    <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}>
      <AnnounceBar />
      <SiteHeader page={page} setPage={goPage} onGoCategory={goCategory} cartCount={cartCount} onOpenCart={() => setCartOpen(true)} onGoAdmin={goAdmin} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} session={session} loyaltyPoints={profile?.loyaltyPoints || 0} wishlistCount={wishlistIds.length} onOpenWishlist={() => setWishlistOpen(true)} onOpenAccount={() => setAccountOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />

      {checkoutNotice && (
        <div className="relative z-30" style={{ background: checkoutNotice.type === "success" ? alpha(NEON.lime, 0.14) : alpha(NEON.yellow, 0.14) }}>
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium flex items-center gap-2" style={{ color: p.text }}>
              {checkoutNotice.type === "success" ? (
                <><Check size={16} style={{ color: NEON.lime }} /> Paiement confirmé — merci pour votre commande ! Un e-mail de confirmation vous sera envoyé.</>
              ) : (
                <><AlertTriangle size={16} style={{ color: "#8a7d00" }} /> Paiement annulé — votre panier a été conservé, vous pouvez réessayer quand vous voulez.</>
              )}
            </span>
            <button onClick={() => setCheckoutNotice(null)}><X size={16} style={{ color: p.steel }} /></button>
          </div>
        </div>
      )}

      <div key={page} className="mtr-page-enter">
        {page === "home" && (
          <>
            <Hero setPage={goPage} featured={featuredProduct} brands={brands} onOpenProduct={setActiveProduct} />
            <CategoryStrip onGoCategory={goCategory} categoryProducts={categoryProducts} />
            <QuizBanner onOpen={() => setQuizOpen(true)} />
            <ScrollGlassesStory featured={featuredProduct} />
            <LensRevealBrands brands={brands} setPage={goPage} />
            {deepDiscountProducts.length > 0 && (
              <ProductRail
                title="Réductions de plus de 65%"
                eyebrow="Prix cassés — pour de vrai"
                eyebrowColor={NEON.orange}
                products={deepDiscountProducts}
                brands={brands}
                onOpen={setActiveProduct}
                productInsights={productInsights}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
              />
            )}
            <ProductRail
              title="Verres holographiques à la une"
              eyebrow="Sélection de la semaine"
              eyebrowColor={NEON.pink}
              products={products.filter((pr) => pr.featured)}
              brands={brands}
              onOpen={setActiveProduct}
              productInsights={productInsights}
              wishlistIds={wishlistIds}
              onToggleWishlist={toggleWishlist}
              holo
            />
            {products.some((pr) => productInsights[pr.id]?.lowStock) && (
              <ProductRail
                title="Il n'en reste que quelques-unes"
                eyebrow="Stock limité — vraies quantités restantes"
                eyebrowColor={NEG}
                products={products.filter((pr) => productInsights[pr.id]?.lowStock)}
                brands={brands}
                onOpen={setActiveProduct}
                productInsights={productInsights}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
              />
            )}
            {recentlyViewed.length > 0 && (
              <ProductRail
                title="Repris là où vous en étiez"
                eyebrow="Récemment consultés"
                eyebrowColor={NEON.blue}
                products={recentlyViewed.map((id) => products.find((pr) => pr.id === id)).filter(Boolean)}
                brands={brands}
                onOpen={setActiveProduct}
                productInsights={productInsights}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
              />
            )}
            <TrustBand />
          </>
        )}
        {page === "catalogue" && <CatalogPage products={products} brands={brands} onOpen={setActiveProduct} initialFilter={catalogFilter} productInsights={productInsights} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />}
        {page === "marques" && <BrandsPage brands={brands} products={products} setPage={goPage} />}
        {page === "apropos" && <AboutPage setPage={goPage} />}
      </div>

      <Footer setPage={goPage} onGoAdmin={goAdmin} />

      <ProductModal
        product={activeProduct}
        brand={activeProduct ? brands.find((b) => b.id === activeProduct.brandId) : null}
        onClose={() => setActiveProduct(null)}
        onAddToCart={addToCart}
        insights={activeProduct ? productInsights[activeProduct.id] : null}
        isWishlisted={activeProduct ? wishlistIds.includes(activeProduct.id) : false}
        onToggleWishlist={toggleWishlist}
        reviews={reviews}
        session={session}
        onSubmitReview={submitReview}
        onView={trackRecentlyViewed}
        isCompared={activeProduct ? compareIds.includes(activeProduct.id) : false}
        onToggleCompare={toggleCompare}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} products={products} brands={brands} updateQty={updateQty} removeItem={removeItem} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />
      <WishlistDrawer open={wishlistOpen} onClose={() => setWishlistOpen(false)} wishlistIds={wishlistIds} products={products} brands={brands} onRemove={toggleWishlist} onAddToCart={addToCart} onOpenProduct={setActiveProduct} />
      <AccountDrawer open={accountOpen} onClose={() => setAccountOpen(false)} session={session} profile={profile} orders={orders} onSignIn={signIn} onSignUp={signUp} onSignOut={async () => { await signOut(); setAccountOpen(false); }} />
      <QuizWidget open={quizOpen} onClose={() => setQuizOpen(false)} products={products} brands={brands} onOpenProduct={setActiveProduct} onGoCategory={goCategory} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} products={products} brands={brands} onOpenProduct={setActiveProduct} setPage={goPage} />
      <FloatingCartWidget cartCount={cartCount} subtotal={cart.reduce((s, c) => s + (products.find((pr) => pr.id === c.productId)?.price || 0) * c.qty, 0)} onOpen={() => setCartOpen(true)} />
      <CompareBar compareIds={compareIds} products={products} onOpen={() => setCompareOpen(true)} onClear={() => setCompareIds([])} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} compareIds={compareIds} products={products} brands={brands} productInsights={productInsights} onRemove={toggleCompare} />
      <CheckoutWizard
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        products={products}
        session={session}
        profile={profile}
        onProfileSaved={saveShippingAddress}
        onStartCheckout={startCheckout}
      />
    </div>
  );
}

// Small confetti burst fired from a screen position (e.g. the "Ajouter au panier" button) —
// pure DOM/CSS, self-removing, no state kept around after the animation ends.
function fireConfetti(x, y) {
  const colors = [NEON.cyan, NEON.pink, NEON.lime, NEON.yellow, NEON.violet];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const pieces = 18;
  for (let i = 0; i < pieces; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    el.style.setProperty("--x0", `${x}px`);
    el.style.setProperty("--y0", `${y}px`);
    el.style.setProperty("--x1", `${x + Math.cos(angle) * dist}px`);
    el.style.setProperty("--y1", `${y + Math.sin(angle) * dist - 30}px`);
    el.style.setProperty("--rot", `${Math.random() * 360}deg`);
    el.style.background = colors[i % colors.length];
    el.style.animation = `confettiBurst ${0.6 + Math.random() * 0.3}s cubic-bezier(.2,.8,.2,1) forwards`;
    container.appendChild(el);
  }
  setTimeout(() => container.remove(), 1000);
}

// Brand intro shown once per browser (sessionStorage), only on first landing this session.
function IntroScreen({ onDone }) {
  const { p } = useTheme();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1100);
    const t2 = setTimeout(onDone, 1550);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div
      className="fixed inset-0 z-[9997] flex items-center justify-center transition-opacity duration-500"
      style={{ background: p.bg, opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
    >
      <div className="mesh-bg">
        <div className="mesh-blob" style={{ width: 420, height: 420, top: "20%", left: "20%", background: NEON.cyan, opacity: 0.25 }} />
        <div className="mesh-blob" style={{ width: 380, height: 380, bottom: "15%", right: "20%", background: NEON.pink, opacity: 0.22, animationDelay: "-8s" }} />
      </div>
      <div className="relative" style={{ animation: "mtrPop .6s cubic-bezier(.2,.8,.2,1) both" }}>
        <Logo size={56} />
      </div>
    </div>
  );
}

// Fires a small ripple from the click point on any button/link across the whole site — a single
// listener rather than instrumenting every button individually.
function useGlobalRipple() {
  useEffect(() => {
    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target.closest?.("button, [role='button'], a");
      if (!target || target.disabled) return;
      const rect = target.getBoundingClientRect();
      if (getComputedStyle(target).position === "static") target.style.position = "relative";
      const ripple = document.createElement("span");
      ripple.className = "mtr-ripple";
      const size = Math.max(rect.width, rect.height) * 1.3;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
}

export default function App() {
  useGlobalRipple();
  const [showIntro, setShowIntro] = useState(() => {
    try { return sessionStorage.getItem("monture_intro_seen") !== "1"; } catch { return true; }
  });
  const dismissIntro = () => {
    try { sessionStorage.setItem("monture_intro_seen", "1"); } catch { /* ignore */ }
    setShowIntro(false);
  };
  return (
    <ThemeProvider>
      <GlobalStyle />
      {showIntro && <IntroScreen onDone={dismissIntro} />}
      <Root />
    </ThemeProvider>
  );
}
