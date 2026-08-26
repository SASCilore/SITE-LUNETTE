import React, { useState, useMemo, useRef, useEffect, useContext, createContext } from "react";
import * as THREE from "three";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  ShoppingBag, X, Plus, Minus, Search, ChevronDown, ChevronRight,
  LayoutDashboard, Package, Tags, Truck, ClipboardList, LogOut,
  Trash2, Pencil, Check, ArrowRight, Menu, Filter, ArrowLeft, Building2, Sparkles, Sun, Moon,
  Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

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
  const [dark, setDark] = useState(true);
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

/* ---------------------------------- SEED DATA ---------------------------------- */

const BRANDS_SEED = [
  { id: "rb", name: "Ray-Ban", origin: "États-Unis", desc: "Icônes intemporelles depuis 1937." },
  { id: "ok", name: "Oakley", origin: "États-Unis", desc: "Performance sportive et lentilles techniques." },
  { id: "pr", name: "Prada", origin: "Italie", desc: "Haute couture milanaise, lignes graphiques." },
  { id: "ps", name: "Persol", origin: "Italie", desc: "Artisanat optique turinois depuis 1917." },
  { id: "gc", name: "Gucci", origin: "Italie", desc: "Maximalisme signature, écailles franches." },
  { id: "ca", name: "Carrera", origin: "Autriche", desc: "Héritage racing, montures légères." },
];

const SUPPLIERS_SEED = [
  { id: "s1", name: "Lux Optic Distribution", contact: "contact@luxoptic-dist.fr", delay: "3–5 jours ouvrés", location: "Lyon, France", brandIds: ["rb", "ok", "ca"] },
  { id: "s2", name: "Milano Eyewear Group", contact: "orders@milanoeyewear.it", delay: "5–8 jours ouvrés", location: "Milan, Italie", brandIds: ["pr", "gc", "ps"] },
  { id: "s3", name: "EuroFrame Wholesale", contact: "sales@euroframe.eu", delay: "4–6 jours ouvrés", location: "Anvers, Belgique", brandIds: ["rb", "ps", "ca"] },
];

const PRODUCTS_SEED = [
  { id: "p1", name: "Aviator Classic", brandId: "rb", category: "Solaire", gender: "Mixte", price: 179, cost: 92, colorName: "Or / Cyan miroir", colorHex: NEON.cyan, shape: "round", calibre: "58-14-135", material: "Métal, verres miroir", stock: "En stock", supplierId: "s1", featured: true, description: "L'aviator qui a défini le genre, ici en monture métal doré et verres miroir cyan." },
  { id: "p2", name: "Wayfarer Original", brandId: "rb", category: "Solaire", gender: "Mixte", price: 169, cost: 88, colorName: "Noir / Lime fluo", colorHex: NEON.lime, shape: "square", calibre: "50-22-150", material: "Acétate", stock: "En stock", supplierId: "s1", featured: false, description: "La silhouette la plus copiée de l'histoire de l'optique, verres lime fluo." },
  { id: "p3", name: "Holbrook Prizm", brandId: "ok", category: "Solaire", gender: "Homme", price: 189, cost: 95, colorName: "Noir / Prizm violet", colorHex: NEON.violet, shape: "square", calibre: "55-18-137", material: "O Matter, Prizm", stock: "Sur commande", supplierId: "s1", featured: true, description: "Monture sport injectée O Matter, verres Prizm violet haute définition." },
  { id: "p4", name: "PO3019V", brandId: "ps", category: "Optique", gender: "Mixte", price: 259, cost: 140, colorName: "Écaille havane", colorHex: "#8FA3AD", shape: "round", calibre: "52-18-140", material: "Acétate injecté", stock: "En stock", supplierId: "s2", featured: false, description: "Monture optique artisanale turinoise, écaille havane, verres neutres." },
  { id: "p5", name: "Cat-Eye PR17W", brandId: "pr", category: "Solaire", gender: "Femme", price: 289, cost: 150, colorName: "Rose fluo dégradé", colorHex: NEON.pink, shape: "round", calibre: "54-17-140", material: "Acétate, verres dégradés", stock: "En stock", supplierId: "s2", featured: true, description: "Cat-eye milanais, verres dégradés rose fluo, finition haute couture." },
  { id: "p6", name: "GG0061S", brandId: "gc", category: "Solaire", gender: "Femme", price: 329, cost: 175, colorName: "Écaille / Orange fluo", colorHex: NEON.orange, shape: "square", calibre: "54-17-135", material: "Acétate épais", stock: "En stock", supplierId: "s2", featured: true, description: "Monture maximaliste signature, écaille épaisse et verres orange fluo." },
  { id: "p7", name: "1027/S", brandId: "ca", category: "Solaire", gender: "Homme", price: 139, cost: 68, colorName: "Bleu / Cyan électrique", colorHex: NEON.cyan, shape: "round", calibre: "58-17-135", material: "Métal léger", stock: "Rupture", supplierId: "s3", featured: false, description: "Héritage racing autrichien, monture métal ultra-légère, teinte cyan électrique." },
  { id: "p8", name: "Clubmaster Optique", brandId: "rb", category: "Optique", gender: "Mixte", price: 159, cost: 82, colorName: "Noir / Or", colorHex: "#9AA3AD", shape: "square", calibre: "51-21-145", material: "Acétate / métal", stock: "En stock", supplierId: "s3", featured: false, description: "Le browline emblématique, combinaison acétate et métal doré." },
];

const ORDERS_SEED = [
  { id: "o1", client: "Camille Roussel", email: "camille.roussel@mail.fr", date: "22/08/2026", items: [{ productId: "p1", qty: 1 }, { productId: "p8", qty: 1 }], status: "Livrée" },
  { id: "o2", client: "Yanis Belkacem", email: "y.belkacem@mail.fr", date: "23/08/2026", items: [{ productId: "p3", qty: 1 }], status: "Expédiée" },
  { id: "o3", client: "Inès Dupont", email: "ines.dupont@mail.fr", date: "23/08/2026", items: [{ productId: "p6", qty: 1 }], status: "En attente" },
  { id: "o4", client: "Thomas Lefèvre", email: "t.lefevre@mail.fr", date: "24/08/2026", items: [{ productId: "p2", qty: 2 }], status: "En attente" },
  { id: "o5", client: "Sarah Cohen", email: "sarah.cohen@mail.fr", date: "20/08/2026", items: [{ productId: "p5", qty: 1 }, { productId: "p7", qty: 1 }], status: "Annulée" },
];

/* ---------------------------------- HELPERS ---------------------------------- */

const euro = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const newId = (prefix) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
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

      .btn-magnet { transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease; }
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

/* ---------------------------------- SMALL UI ATOMS ---------------------------------- */

/* ---------------------------------- GLASSES 3D (realistic model, hero + scroll story) ---------------------------------- */

function buildWayfarerGroup3D(tintColor) {
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

    const group = buildWayfarerGroup3D(new THREE.Color(tint));
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

    return () => {
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

function Pill({ children, style, className = "" }) {
  return <span className={`mtr-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${className}`} style={style}>{children}</span>;
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

function SiteHeader({ page, setPage, cartCount, onOpenCart, onGoAdmin, mobileOpen, setMobileOpen }) {
  const { p } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const NavLink = ({ target, children }) => (
    <button onClick={() => { setPage(target); setMobileOpen(false); window.scrollTo({ top: 0 }); }} className="relative text-sm tracking-wide transition-colors py-1" style={{ color: page === target ? p.text : alpha(p.text, 0.5) }}>
      {children}
      {page === target && <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: PRIMARY, boxShadow: `0 0 6px ${PRIMARY}` }} />}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 transition-all duration-300" style={{ background: scrolled ? alpha(p.bg, 0.75) : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", WebkitBackdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: scrolled ? `1px solid ${p.border}` : "1px solid transparent" }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <button onClick={() => { setPage("home"); window.scrollTo({ top: 0 }); }} className="mtr-display text-xl font-extrabold tracking-tight" style={{ color: p.text }}>
          MONTURE<span style={{ color: PRIMARY }}>.</span>
        </button>
        <nav className="hidden md:flex items-center gap-8">
          <NavLink target="home">Accueil</NavLink>
          <NavLink target="catalogue">Catalogue</NavLink>
          <NavLink target="marques">Marques</NavLink>
          <NavLink target="apropos">À propos</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden md:block"><ThemeToggle compact /></div>
          <button onClick={onGoAdmin} className="hidden md:block text-xs mtr-mono uppercase tracking-wide" style={{ color: alpha(p.text, 0.4) }}>Espace pro</button>
          <button onClick={onOpenCart} className="btn-magnet relative p-2.5 rounded-full" style={{ color: p.text, background: alpha(p.text, 0.06) }} aria-label="Ouvrir le panier">
            <ShoppingBag size={19} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold" style={{ background: PRIMARY, color: "#07080A", boxShadow: `0 0 10px ${PRIMARY}` }}>{cartCount}</span>}
          </button>
          <button className="md:hidden p-2" style={{ color: p.text }} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden px-5 pb-5 flex flex-col gap-4" style={{ background: p.bg }}>
          <NavLink target="home">Accueil</NavLink>
          <NavLink target="catalogue">Catalogue</NavLink>
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

function Hero({ setPage }) {
  const { p, dark } = useTheme();
  const sectionRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 40, active: false });
  const blend = dark ? "screen" : "multiply";
  const boost = dark ? 1 : 1.7;

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
          <h1 className="mtr-display font-extrabold leading-[0.94]" style={{ color: p.text, fontSize: "clamp(2.75rem, 7vw, 4.75rem)" }}>
            Des montures<br />signées.<br /><span className="chroma">Point.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg max-w-md" style={{ color: alpha(p.text, 0.6) }}>
            Ray-Ban, Oakley, Prada, Persol, Gucci, Carrera — un catalogue resserré,
            chaque référence vérifiée avant expédition. Pas de contrefaçon, pas de compromis.
          </p>
          <div className="mt-9 flex items-center gap-5 flex-wrap">
            <NeonButton onClick={() => setPage("catalogue")} className="px-7 py-3.5 rounded-full inline-flex items-center gap-2 group">
              Découvrir le catalogue <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </NeonButton>
            <button onClick={() => setPage("marques")} className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: p.text }}>Voir les marques <ChevronRight size={14} /></button>
          </div>
        </div>

        <div style={{ "--edge": NEON.cyan }} className="neon-border relative rounded-3xl p-6 md:p-10">
          <div className="absolute inset-0 rounded-3xl" style={{ background: alpha(p.text, 0.03), backdropFilter: "blur(6px)", border: `1px solid ${p.border}` }} />
          <div className="relative"><Glasses3D tint={NEON.cyan} mode="mouse" height={260} /></div>
          <div className="relative mt-2 flex items-center justify-between mtr-mono text-[11px] uppercase tracking-wide" style={{ color: alpha(p.text, 0.4) }}>
            <span>Réf. 58-14-135</span>
            <span className="inline-flex items-center gap-1"><Sparkles size={12} style={{ color: NEON.cyan }} /> Verres holo</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- PUBLIC: LENS-SWEEP BRAND REVEAL ---------------------------------- */

function ScrollGlassesStory() {
  const { p } = useTheme();
  const sectionRef = useRef(null);
  const progress = useScrollProgress(sectionRef);

  const enter = smoothstep(0.03, 0.32, progress);
  const glow = smoothstep(0.26, 0.55, progress);
  const drift = Math.max(0, progress - 0.34) * -46;

  const translateY = (1 - enter) * -230 + drift;
  const rotate = (1 - enter) * -20;
  const scale = 0.68 + 0.32 * enter;

  const stepOpacity = (inS, inE, outS, outE) => Math.min(smoothstep(inS, inE, progress), 1 - smoothstep(outS, outE, progress));
  const s1 = stepOpacity(0.06, 0.18, 0.30, 0.40);
  const s2 = stepOpacity(0.38, 0.48, 0.60, 0.70);
  const s3 = stepOpacity(0.66, 0.76, 0.92, 0.99);

  const StepCard = ({ n, title, text, style, opacity }) => (
    <div className="hidden md:block" style={{ position: "absolute", maxWidth: 280, opacity, transform: `translateY(${(1 - opacity) * 18}px)`, transition: "opacity .1s linear", ...style }}>
      <div className="mtr-mono text-xs mb-2" style={{ color: NEON.cyan }}>0{n}</div>
      <h3 className="mtr-display font-bold text-xl mb-2" style={{ color: p.text }}>{title}</h3>
      <p className="text-sm" style={{ color: alpha(p.text, 0.6) }}>{text}</p>
    </div>
  );

  return (
    <section ref={sectionRef} style={{ height: "320vh", position: "relative", background: p.bg }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mesh-bg">
          <div className="mesh-blob" style={{ width: 480, height: 480, top: "20%", left: "-15%", background: NEON.cyan, opacity: 0.1 + glow * 0.1 }} />
          <div className="mesh-blob" style={{ width: 420, height: 420, bottom: "10%", right: "-10%", background: NEON.pink, opacity: 0.08 + glow * 0.1, animationDelay: "-9s" }} />
        </div>

        <StepCard n={1} title="Repérez la monture" text="Parcourez une sélection resserrée des plus grandes maisons, sans bruit ni contrefaçon." style={{ left: "7%", top: "28%" }} opacity={s1} />
        <StepCard n={2} title="Regardez à travers" text="Chaque référence est vérifiée, chaque provenance tracée jusqu'au fournisseur agréé." style={{ right: "7%", top: "26%" }} opacity={s2} />
        <StepCard n={3} title="Elle arrive chez vous" text="Expédiée directement par nos partenaires, suivie de bout en bout jusqu'à votre porte." style={{ left: "50%", bottom: "10%", transform: `translate(-50%, ${(1 - s3) * 18}px)` }} opacity={s3} />

        <div
          style={{
            width: "min(70vw, 460px)",
            transform: `translateY(${translateY}px) scale(${scale})`,
            filter: `drop-shadow(0 0 ${14 + glow * 34}px rgba(0,240,255,${0.2 + glow * 0.35})) drop-shadow(0 0 ${8 + glow * 18}px rgba(255,46,136,${0.12 + glow * 0.25}))`,
          }}
        >
          <Glasses3D tint={NEON.cyan} mode="scroll" progress={progress} height={220} />
        </div>

        <div className="absolute right-5 md:right-8 top-1/2 -translate-y-1/2 w-1 h-40 rounded-full overflow-hidden" style={{ background: alpha(p.text, 0.1) }}>
          <div style={{ height: `${progress * 100}%`, width: "100%", background: `linear-gradient(180deg, ${NEON.cyan}, ${NEON.pink})`, transition: "height .05s linear" }} />
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

function ProductCard({ product, brand, onOpen, index = 0 }) {
  const { p, dark } = useTheme();
  const [ref, visible] = useReveal(0.1);
  const tilt = useTilt(8);
  const accent = BRAND_ACCENT[product.brandId] || PRIMARY;
  return (
    <div ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: `${(index % 4) * 70}ms` }}>
      <button ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} onClick={() => onOpen(product)} className="glyph-card card-lift neon-border group text-left rounded-2xl overflow-hidden w-full" style={{ ...tilt.style, background: p.bg2, border: `1px solid ${dark ? p.border : alpha(accent, 0.4)}`, "--edge": accent }}>
        {!dark && <div style={{ height: 3, background: accent }} />}
        <div className="relative p-6 pb-2">
          <GlassesGlyph shape={product.shape} tint={product.colorHex} stroke={alpha(p.text, 0.5)} />
          <div className="absolute inset-x-4 bottom-1 text-center text-[11px] mtr-mono uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: accent }}>Voir la fiche →</div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="mtr-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
          <div className="mt-1 font-semibold" style={{ color: p.text }}>{product.name}</div>
          <div className="mt-1 mtr-mono text-[11px]" style={{ color: p.steel }}>{product.calibre} · {product.colorName}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-bold" style={{ color: p.text }}>{euro(product.price)}</span>
            {product.stock !== "En stock" && <Pill style={{ background: alpha(NEG, 0.14), color: NEG }}>{product.stock}</Pill>}
          </div>
        </div>
      </button>
    </div>
  );
}

function FeaturedGrid({ products, brands, onOpen }) {
  const { p } = useTheme();
  const featured = products.filter((pr) => pr.featured);
  const [headRef, headVisible] = useReveal(0.3);
  return (
    <section style={{ background: p.bg }} className="py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div ref={headRef} className={`reveal ${headVisible ? "visible" : ""} flex items-end justify-between mb-10`}>
          <div>
            <Eyebrow color={NEON.pink}>Sélection de la semaine</Eyebrow>
            <h2 className="mtr-display text-3xl md:text-4xl font-bold" style={{ color: p.text }}>Verres holographiques à la une</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {featured.map((pr, i) => {
            const tilt = useTilt(8);
            const accent = BRAND_ACCENT[pr.brandId] || PRIMARY;
            const brand = brands.find((b) => b.id === pr.brandId);
            const [ref, visible] = useReveal(0.1);
            return (
              <div key={pr.id} ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                <button ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} onClick={() => onOpen(pr)} className="glyph-card card-lift neon-border group text-left rounded-2xl overflow-hidden w-full" style={{ ...tilt.style, background: p.bg2, border: `1px solid ${p.border}`, "--edge": accent }}>
                  <div className="relative p-6 pb-2"><GlassesGlyph shape={pr.shape} tint={pr.colorHex} stroke={alpha(p.text, 0.5)} holo /></div>
                  <div className="px-5 pb-5 pt-2">
                    <div className="mtr-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
                    <div className="mt-1 font-semibold" style={{ color: p.text }}>{pr.name}</div>
                    <div className="mt-1 mtr-mono text-[11px]" style={{ color: p.steel }}>{pr.calibre} · {pr.colorName}</div>
                    <div className="mt-3 font-bold" style={{ color: p.text }}>{euro(pr.price)}</div>
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
    { title: "Authenticité garantie", desc: "Chaque paire est vérifiée et accompagnée de son certificat fournisseur.", accent: NEON.cyan },
    { title: "Livraison suivie", desc: "Expédition trackée, délais annoncés fournisseur par fournisseur.", accent: NEON.pink },
    { title: "Retours 30 jours", desc: "Un doute sur la monture ? Retour gratuit sous 30 jours.", accent: NEON.lime },
  ];
  const [ref, visible] = useReveal(0.25);
  const [statsRef, statsVisible] = useReveal(0.3);
  return (
    <section style={{ background: p.bg2, position: "relative", overflow: "hidden" }} className="py-20 md:py-24">
      <SectionGlow variant="corners" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <div ref={ref} className="grid md:grid-cols-3 gap-10 mb-16">
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
          <StatItem value={30} suffix=" j" label="Retours acceptés" active={statsVisible} color={NEON.yellow} />
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
          <div className="mtr-display text-xl font-extrabold" style={{ color: p.text }}>MONTURE<span style={{ color: PRIMARY }}>.</span></div>
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
      <div className="max-w-6xl mx-auto px-5 md:px-8 mt-10 text-xs" style={{ color: alpha(p.text, 0.28) }}>Prototype de démonstration — © 2026 MONTURE. Données et visuels fictifs.</div>
    </footer>
  );
}

/* ---------------------------------- PUBLIC: CATALOGUE ---------------------------------- */

function CatalogPage({ products, brands, onOpen }) {
  const { p } = useTheme();
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState([]);
  const [category, setCategory] = useState("Tous");
  const [gender, setGender] = useState("Tous");
  const [priceRange, setPriceRange] = useState("Tous");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleBrand = (id) => setBrandFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const filtered = useMemo(() => {
    return products.filter((pr) => {
      const brand = brands.find((b) => b.id === pr.brandId);
      if (query && !`${pr.name} ${brand?.name}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (brandFilter.length && !brandFilter.includes(pr.brandId)) return false;
      if (category !== "Tous" && pr.category !== category) return false;
      if (gender !== "Tous" && pr.gender !== gender) return false;
      if (priceRange === "-150" && pr.price >= 150) return false;
      if (priceRange === "150-300" && (pr.price < 150 || pr.price > 300)) return false;
      if (priceRange === "300+" && pr.price <= 300) return false;
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
      <FilterGroup title="Catégorie">{["Tous", "Solaire", "Optique"].map((c) => <RadioRow key={c} label={c} active={category === c} onClick={() => setCategory(c)} />)}</FilterGroup>
      <FilterGroup title="Genre">{["Tous", "Homme", "Femme", "Mixte"].map((g) => <RadioRow key={g} label={g} active={gender === g} onClick={() => setGender(g)} />)}</FilterGroup>
      <FilterGroup title="Prix">
        {[["Tous", "Tous"], ["-150", "Moins de 150 €"], ["150-300", "150 – 300 €"], ["300+", "Plus de 300 €"]].map(([val, label]) => (
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
                {filtered.map((pr, i) => <ProductCard key={pr.id} index={i} product={pr} brand={brands.find((b) => b.id === pr.brandId)} onOpen={onOpen} />)}
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
          MONTURE référence uniquement des marques établies, sourcées auprès de grossistes et distributeurs agréés
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

function ProductModal({ product, brand, onClose, onAddToCart }) {
  const { p } = useTheme();
  const [qty, setQty] = useState(1);
  useEffect(() => setQty(1), [product]);
  if (!product) return null;
  const accent = BRAND_ACCENT[product.brandId] || PRIMARY;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl" style={{ background: p.bg2, border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes mtrPop { from { opacity:0; transform: translateY(24px) scale(.98);} to {opacity:1; transform:none;} }`}</style>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }}><X size={18} style={{ color: p.text }} /></button>
        <div className="grid md:grid-cols-2">
          <div className="p-10 relative overflow-hidden" style={{ background: p.bg3 }}>
            <div className="mesh-bg"><div className="mesh-blob" style={{ width: 260, height: 260, top: -60, left: -40, background: product.colorHex, opacity: 0.3 }} /></div>
            <div className="relative"><GlassesGlyph shape={product.shape} tint={product.colorHex} stroke={alpha(p.text, 0.55)} holo /></div>
          </div>
          <div className="p-8">
            <div className="mtr-mono text-xs uppercase tracking-[0.14em]" style={{ color: accent }}>{brand?.name}</div>
            <h2 className="mtr-display text-2xl font-bold mt-1" style={{ color: p.text }}>{product.name}</h2>
            <div className="text-2xl font-bold mt-3" style={{ color: p.text }}>{euro(product.price)}</div>
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
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2.5" style={{ color: p.text }}><Minus size={14} /></button>
                <span className="px-3 text-sm font-semibold" style={{ color: p.text }}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="p-2.5" style={{ color: p.text }}><Plus size={14} /></button>
              </div>
              <NeonButton disabled={product.stock === "Rupture"} onClick={() => { onAddToCart(product, qty); onClose(); }} className="flex-1 py-3 rounded-full" c1={accent} c2={accent === NEON.pink ? NEON.cyan : NEON.pink}>
                {product.stock === "Rupture" ? "Indisponible" : "Ajouter au panier"}
              </NeonButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- PUBLIC: CART + CHECKOUT ---------------------------------- */

function CartDrawer({ open, onClose, cart, products, brands, updateQty, removeItem, onCheckout }) {
  const { p } = useTheme();
  if (!open) return null;
  const lines = cart.map((c) => ({ ...c, product: products.find((pr) => pr.id === c.productId) }));
  const subtotal = lines.reduce((s, l) => s + (l.product?.price || 0) * l.qty, 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md flex flex-col" style={{ background: p.bg2, borderLeft: `1px solid ${p.border}`, animation: "mtrSlideIn .4s cubic-bezier(.2,.8,.2,1)" }}>
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
                    <GlassesGlyph shape={l.product?.shape} tint={l.product?.colorHex} stroke={alpha(p.text, 0.5)} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs mtr-mono uppercase" style={{ color: accent }}>{brand?.name}</div>
                    <div className="text-sm font-semibold" style={{ color: p.text }}>{l.product?.name}</div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${p.borderStrong}` }}>
                        <button onClick={() => updateQty(l.productId, Math.max(1, l.qty - 1))} className="p-1.5" style={{ color: p.text }}><Minus size={12} /></button>
                        <span className="px-2 text-xs font-semibold" style={{ color: p.text }}>{l.qty}</span>
                        <button onClick={() => updateQty(l.productId, l.qty + 1)} className="p-1.5" style={{ color: p.text }}><Plus size={12} /></button>
                      </div>
                      <span className="text-sm font-bold" style={{ color: p.text }}>{euro((l.product?.price || 0) * l.qty)}</span>
                    </div>
                  </div>
                  <button onClick={() => removeItem(l.productId)} className="self-start p-1" style={{ color: p.steel }}><Trash2 size={14} /></button>
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

function CheckoutModal({ open, onClose, cart, products, onConfirm }) {
  const { p } = useTheme();
  const [form, setForm] = useState({ name: "", email: "", address: "" });
  const [done, setDone] = useState(false);
  if (!open) return null;

  const subtotal = cart.reduce((s, c) => s + (products.find((pr) => pr.id === c.productId)?.price || 0) * c.qty, 0);
  const canSubmit = form.name.trim() && form.email.trim() && form.address.trim();
  const submit = () => { onConfirm(form); setDone(true); };
  const close = () => { setDone(false); setForm({ name: "", email: "", address: "" }); onClose(); };
  const inputStyle = { border: `1px solid ${p.borderStrong}`, background: p.bg3, color: p.text };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md mx-4 rounded-3xl p-8" style={{ background: p.bg2, border: `1px solid ${p.border}`, animation: "mtrPop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <button onClick={close} className="absolute top-4 right-4 p-2 rounded-full btn-magnet" style={{ background: p.bg3 }}><X size={18} style={{ color: p.text }} /></button>
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: alpha(POS, 0.16) }}><Check size={26} style={{ color: POS }} /></div>
            <h3 className="mtr-display text-xl font-bold mb-2" style={{ color: p.text }}>Commande confirmée</h3>
            <p className="text-sm mb-6" style={{ color: p.steel }}>Un e-mail de confirmation a été envoyé à {form.email}. Elle apparaît désormais dans l'espace pro.</p>
            <NeonButton onClick={close} className="px-6 py-3 rounded-full">Retour à la boutique</NeonButton>
          </div>
        ) : (
          <>
            <h3 className="mtr-display text-xl font-bold mb-1" style={{ color: p.text }}>Finaliser la commande</h3>
            <p className="text-sm mb-6" style={{ color: p.steel }}>Total : <strong style={{ color: p.text }}>{euro(subtotal)}</strong></p>
            <div className="space-y-3">
              <input placeholder="Nom complet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              <input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              <input placeholder="Adresse de livraison" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <NeonButton disabled={!canSubmit} onClick={submit} className="w-full mt-5 py-3 rounded-full">Confirmer la commande</NeonButton>
            <p className="text-[11px] mt-3 text-center" style={{ color: p.steel }}>Paiement simulé — aucune donnée bancaire n'est demandée dans ce prototype.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: LOGIN ---------------------------------- */

function AdminLogin({ onLogin, onBackToSite }) {
  const { p } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const inputStyle = { background: p.bg2, color: p.text, border: `1px solid ${p.borderStrong}` };
  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative overflow-hidden" style={{ background: p.bg }}>
      <div className="mesh-bg">
        <div className="mesh-blob" style={{ width: 380, height: 380, top: -100, left: -100, background: NEON.cyan, opacity: 0.18 }} />
        <div className="mesh-blob" style={{ width: 320, height: 320, bottom: -120, right: -80, background: NEON.pink, opacity: 0.16, animationDelay: "-10s" }} />
      </div>
      <div className="relative w-full max-w-sm">
        <button onClick={onBackToSite} className="flex items-center gap-2 text-sm mb-8" style={{ color: alpha(p.text, 0.5) }}><ArrowLeft size={14} /> Retour au site</button>
        <div className="mtr-display text-2xl font-extrabold mb-1" style={{ color: p.text }}>MONTURE<span style={{ color: PRIMARY }}>.</span> Pro</div>
        <p className="text-sm mb-8" style={{ color: alpha(p.text, 0.45) }}>Espace d'administration du catalogue et des commandes.</p>
        <div className="space-y-3">
          <input placeholder="Identifiant" value={email} onChange={(e) => setEmail(e.target.value)} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
          <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mtr-input w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
        </div>
        <NeonButton onClick={onLogin} className="w-full mt-5 py-3 rounded-full">Se connecter</NeonButton>
        <p className="text-[11px] mt-4 text-center" style={{ color: alpha(p.text, 0.32) }}>Démo — n'importe quel identifiant fonctionne.</p>
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
  ];
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: p.bg }}>
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 p-6" style={{ background: p.sidebar }}>
        <div className="mtr-display text-lg font-extrabold mb-8" style={{ color: "#F3F5F6" }}>MONTURE<span style={{ color: PRIMARY }}>.</span> Pro</div>
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
  const empty = { name: "", brandId: brands[0]?.id || "", category: "Solaire", gender: "Mixte", price: "", cost: "", colorName: "", colorHex: NEON.cyan, shape: "square", calibre: "", material: "", stock: "En stock", supplierId: suppliers[0]?.id || "", featured: false, description: "" };
  const [form, setForm] = useState(initial || empty);
  useEffect(() => { setForm(initial || empty); }, [initial, open]);
  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const margin = form.price && form.cost ? Math.round(((form.price - form.cost) / form.price) * 100) : null;

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
        {margin !== null && (
          <div className="mt-4 text-sm" style={{ color: p.steel }}>
            Marge estimée : <strong style={{ color: margin > 30 ? NEON.lime : NEG }}>{margin}%</strong> ({euro(form.price - form.cost)})
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.price} className="btn-magnet flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-40" style={{ background: p.text, color: p.bg }}>Enregistrer</button>
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
  { id: "cost", label: "Coût", aliases: ["cout", "coût", "cost", "prix fournisseur"], required: false },
  { id: "colorName", label: "Coloris", aliases: ["coloris", "couleur", "color"], required: false },
  { id: "colorHex", label: "Teinte (hex)", aliases: ["teinte", "hex", "couleur hex", "colorhex"], required: false },
  { id: "calibre", label: "Calibre", aliases: ["calibre", "taille"], required: false },
  { id: "material", label: "Matière", aliases: ["matiere", "matière", "material"], required: false },
  { id: "shape", label: "Forme", aliases: ["forme", "shape"], required: false },
  { id: "stock", label: "Stock", aliases: ["stock", "disponibilite", "disponibilité", "statut"], required: false },
  { id: "supplierName", label: "Fournisseur", aliases: ["fournisseur", "supplier"], required: false },
  { id: "photo", label: "Photo (URL)", aliases: ["photo", "image", "photo url", "image url"], required: false },
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
    cost,
    colorName: get("colorName") || "Standard",
    colorHex, calibre: get("calibre"), material: get("material"), shape, stock,
    supplierNameRaw, photo: get("photo"), description: get("description"),
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
      reader.onload = (e) => {
        try {
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

  const confirmImport = () => {
    if (!resolved) return;
    const importable = resolved.rows.filter((r) => r.status !== "error");
    const newProducts = importable.map((r) => ({
      id: newId("p"),
      name: r.name, brandId: r.brandId, category: r.category, gender: r.gender,
      price: r.price, cost: r.cost, colorName: r.colorName, colorHex: r.colorHex,
      shape: r.shape, calibre: r.calibre, material: r.material, stock: r.stock,
      supplierId: r.supplierId, featured: false, description: r.description,
    }));
    onImport({ newProducts, newBrands: resolved.newBrands, newSuppliers: resolved.newSuppliers });
    setResult({ imported: newProducts.length, skipped: resolved.rows.length - importable.length, newBrands: resolved.newBrands.length, newSuppliers: resolved.newSuppliers.length });
    setStep("done");
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
            <div className="rounded-xl overflow-hidden max-h-[42vh] overflow-y-auto" style={{ border: `1px solid ${p.border}` }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: p.bg3 }}>
                  <tr className="text-left">
                    {["", "Titre", "Marque", "Prix", "Détails"].map((h) => (
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
                      <td className="px-3 py-2 text-xs" style={{ color: p.steel }}>{r.messages.join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep("mapping")} className="flex-1 py-3 rounded-full font-semibold text-sm" style={{ border: `1px solid ${p.borderStrong}`, color: p.text }}>Revoir le mapping</button>
              <NeonButton onClick={confirmImport} disabled={resolved.summary.ok + resolved.summary.warning === 0} className="flex-1 py-3 rounded-full">
                Importer {resolved.summary.ok + resolved.summary.warning} produit{resolved.summary.ok + resolved.summary.warning > 1 ? "s" : ""}
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

  const filtered = products.filter((pr) => {
    const brand = brands.find((b) => b.id === pr.brandId)?.name || "";
    return `${pr.name} ${brand}`.toLowerCase().includes(search.toLowerCase());
  });

  const save = (form) => {
    if (editing) setProducts((ps) => ps.map((pr) => (pr.id === editing.id ? { ...form, id: editing.id } : pr)));
    else setProducts((ps) => [...ps, { ...form, id: newId("p") }]);
    setFormOpen(false); setEditing(null);
  };
  const remove = (id) => setProducts((ps) => ps.filter((pr) => pr.id !== id));

  const handleImport = ({ newProducts, newBrands, newSuppliers }) => {
    if (newBrands.length) setBrands((bs) => [...bs, ...newBrands]);
    if (newSuppliers.length) setSuppliers((ss) => [...ss, ...newSuppliers]);
    setProducts((ps) => [...ps, ...newProducts]);
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
      <div className="mb-5 flex items-center gap-2 rounded-full px-4 py-2.5 max-w-sm" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <Search size={15} style={{ color: p.steel }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="flex-1 outline-none text-sm bg-transparent" style={{ color: p.text }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left" style={{ background: p.bg3 }}>
                {["Produit", "Catégorie", "Prix", "Coût", "Marge", "Fournisseur", "Stock", ""].map((h) => (
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
                  <tr key={pr.id} className="border-t" style={{ borderColor: p.border }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: p.text }}>{pr.name}</div>
                      <div className="text-xs mtr-mono" style={{ color: BRAND_ACCENT[pr.brandId] || PRIMARY }}>{brand?.name}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: p.steel }}>{pr.category}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: p.text }}>{euro(pr.price)}</td>
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
  const save = (form) => {
    if (editing) setBrands((bs) => bs.map((b) => (b.id === editing.id ? { ...form, id: editing.id } : b)));
    else setBrands((bs) => [...bs, { ...form, id: newId("b") }]);
    setFormOpen(false); setEditing(null);
  };
  const remove = (id) => setBrands((bs) => bs.filter((b) => b.id !== id));

  return (
    <div>
      <AdminHeader title="Marques" subtitle="Maisons référencées sur la boutique." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.text, color: p.bg }}><Plus size={15} /> Ajouter une marque</button>} />
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
  const save = (form) => {
    if (editing) setSuppliers((ss) => ss.map((s) => (s.id === editing.id ? { ...form, id: editing.id } : s)));
    else setSuppliers((ss) => [...ss, { ...form, id: newId("s") }]);
    setFormOpen(false); setEditing(null);
  };
  const remove = (id) => setSuppliers((ss) => ss.filter((s) => s.id !== id));

  return (
    <div>
      <AdminHeader title="Fournisseurs" subtitle="Grossistes en dropshipping associés à la boutique." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-magnet flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: p.text, color: p.bg }}><Plus size={15} /> Ajouter un fournisseur</button>} />
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

function AdminOrders({ orders, setOrders, products }) {
  const { p } = useTheme();
  const statuses = ["En attente", "Expédiée", "Livrée", "Annulée"];
  const setStatus = (id, status) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
  const remove = (id) => setOrders((os) => os.filter((o) => o.id !== id));
  const total = (o) => o.items.reduce((s, it) => s + (products.find((pr) => pr.id === it.productId)?.price || 0) * it.qty, 0);
  const statusColor = (s) => ({ "En attente": NEON.orange, "Expédiée": NEON.cyan, "Livrée": NEON.lime, "Annulée": NEG }[s] || p.steel);

  return (
    <div>
      <AdminHeader title="Commandes" subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""} enregistrée${orders.length > 1 ? "s" : ""}`} />
      <div className="rounded-2xl overflow-hidden" style={{ background: p.bg2, border: `1px solid ${p.border}` }}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ background: p.bg3 }}>
                {["Commande", "Client", "Date", "Articles", "Total", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-3 mtr-mono text-[11px] uppercase tracking-wide" style={{ color: p.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t" style={{ borderColor: p.border }}>
                  <td className="px-4 py-3 mtr-mono text-xs" style={{ color: p.steel }}>#{o.id.slice(-5).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: p.text }}>{o.client}</div>
                    <div className="text-xs" style={{ color: p.steel }}>{o.email}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{o.date}</td>
                  <td className="px-4 py-3" style={{ color: p.steel }}>{o.items.reduce((s, it) => s + it.qty, 0)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: p.text }}>{euro(total(o))}</td>
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
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");

  const [products, setProducts] = useState(PRODUCTS_SEED);
  const [brands, setBrands] = useState(BRANDS_SEED);
  const [suppliers, setSuppliers] = useState(SUPPLIERS_SEED);
  const [orders, setOrders] = useState(ORDERS_SEED);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

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

  const confirmOrder = (form) => {
    const newOrder = { id: newId("o"), client: form.name, email: form.email, date: new Date().toLocaleDateString("fr-FR"), items: cart.map((c) => ({ productId: c.productId, qty: c.qty })), status: "En attente" };
    setOrders((os) => [newOrder, ...os]);
    setCart([]);
  };

  const goAdmin = () => { setMode("admin"); setCartOpen(false); };
  const backToSite = () => setMode("site");

  if (mode === "admin") {
    if (!adminAuthed) {
      return <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}><AdminLogin onLogin={() => setAdminAuthed(true)} onBackToSite={backToSite} /></div>;
    }
    return (
      <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}>
        <AdminShell tab={adminTab} setTab={setAdminTab} onLogout={() => setAdminAuthed(false)} onBackToSite={backToSite}>
          {adminTab === "dashboard" && <AdminDashboard products={products} orders={orders} brands={brands} />}
          {adminTab === "products" && <AdminProducts products={products} setProducts={setProducts} brands={brands} setBrands={setBrands} suppliers={suppliers} setSuppliers={setSuppliers} />}
          {adminTab === "brands" && <AdminBrands brands={brands} setBrands={setBrands} products={products} />}
          {adminTab === "suppliers" && <AdminSuppliers suppliers={suppliers} setSuppliers={setSuppliers} brands={brands} />}
          {adminTab === "orders" && <AdminOrders orders={orders} setOrders={setOrders} products={products} />}
        </AdminShell>
      </div>
    );
  }

  return (
    <div className="mtr grain" style={{ background: p.bg, minHeight: "100vh" }}>
      <SiteHeader page={page} setPage={setPage} cartCount={cartCount} onOpenCart={() => setCartOpen(true)} onGoAdmin={goAdmin} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {page === "home" && (
        <>
          <Hero setPage={setPage} />
          <ScrollGlassesStory />
          <LensRevealBrands brands={brands} setPage={setPage} />
          <FeaturedGrid products={products} brands={brands} onOpen={setActiveProduct} />
          <TrustBand />
        </>
      )}
      {page === "catalogue" && <CatalogPage products={products} brands={brands} onOpen={setActiveProduct} />}
      {page === "marques" && <BrandsPage brands={brands} products={products} setPage={setPage} />}
      {page === "apropos" && <AboutPage setPage={setPage} />}

      <Footer setPage={setPage} onGoAdmin={goAdmin} />

      <ProductModal product={activeProduct} brand={activeProduct ? brands.find((b) => b.id === activeProduct.brandId) : null} onClose={() => setActiveProduct(null)} onAddToCart={addToCart} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} products={products} brands={brands} updateQty={updateQty} removeItem={removeItem} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} cart={cart} products={products} onConfirm={confirmOrder} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GlobalStyle />
      <Root />
    </ThemeProvider>
  );
}
