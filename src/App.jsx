import { useState, useEffect, useRef } from "react";

/* ─── Supply Chain 3D Background ───────────────────────────── */
function GridCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    let w, h, frame;
    // Isometric projection constants
    const C = Math.cos(Math.PI / 6); // 0.866
    const S = 0.5;
    const T = Math.tan(Math.PI / 6); // 0.577

    const resize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    resize();

    // Draw a 3D isometric shipping container at screen pos (sx,sy)
    // W=width, D=depth, H=height, alpha=opacity
    const isoBox = (sx, sy, W, D, H, alpha) => {
      if (alpha < 0.005 || W < 2 || H < 2) return;
      // 8 vertices (bottom then top, front-left, front-right, back-right, back-left)
      const fl=[sx,sy],           fr=[sx+W*C, sy+W*S];
      const bl=[sx-D*C, sy+D*S],  br=[sx+W*C-D*C, sy+W*S+D*S];
      const tl=[sx, sy-H],        tr=[sx+W*C, sy+W*S-H];
      const tbl=[sx-D*C, sy+D*S-H], tbr=[sx+W*C-D*C, sy+W*S+D*S-H];

      const face = (pts, a) => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = `rgba(255,140,50,${a})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,140,50,${a * 0.55})`;
        ctx.lineWidth = 0.5; ctx.stroke();
      };

      face([fl, bl, tbl, tl], alpha * 0.45);  // left face (shadow)
      face([fl, fr, tr,  tl], alpha * 0.7);   // front face
      face([tl, tr, tbr, tbl], alpha * 1.2);  // top face (light)

      // Vertical container ribs on front face
      const ribs = Math.max(2, Math.floor(W / 13));
      for (let i = 1; i < ribs; i++) {
        const f = i / ribs;
        ctx.beginPath();
        ctx.moveTo(fl[0] + (fr[0]-fl[0])*f, tl[1] + (tr[1]-tl[1])*f);
        ctx.lineTo(fl[0] + (fr[0]-fl[0])*f, fl[1] + (fr[1]-fl[1])*f);
        ctx.strokeStyle = `rgba(255,140,50,${alpha * 0.2})`;
        ctx.lineWidth = 0.4; ctx.stroke();
      }
    };

    // Build scene objects (reinitialised on resize)
    const mkScene = () => {
      const boxes = Array.from({ length: 14 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        W: 36 + Math.random() * 54, D: 16 + Math.random() * 28, H: 15 + Math.random() * 28,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.13,
        ph: Math.random() * Math.PI * 2,
        al: 0.04 + Math.random() * 0.065,
      }));
      const hubs = Array.from({ length: 9 }, () => ({
        x: w * 0.08 + Math.random() * w * 0.84,
        y: h * 0.08 + Math.random() * h * 0.84,
        ph: Math.random() * Math.PI * 2,
      }));
      const routes = [];
      for (let i = 0; i < hubs.length; i++)
        for (let j = i + 1; j < hubs.length; j++)
          if (Math.hypot(hubs[i].x-hubs[j].x, hubs[i].y-hubs[j].y) < Math.max(w,h) * 0.44)
            routes.push({
              x1:hubs[i].x, y1:hubs[i].y, x2:hubs[j].x, y2:hubs[j].y,
              cx:(hubs[i].x+hubs[j].x)/2 + (Math.random()-0.5)*170,
              cy:(hubs[i].y+hubs[j].y)/2 + (Math.random()-0.5)*170,
            });
      const pkgs = routes.map(r => ({
        r, t: Math.random(), sp: 0.0007 + Math.random() * 0.001, trail: [],
      }));
      return { boxes, hubs, routes, pkgs };
    };

    let sc = mkScene();

    // Quadratic bezier point
    const qBez = (t, x1,y1,cx,cy,x2,y2) => ({
      x: (1-t)**2*x1 + 2*(1-t)*t*cx + t**2*x2,
      y: (1-t)**2*y1 + 2*(1-t)*t*cy + t**2*y2,
    });

    // Slow scrolling offset for grid (warehouse floor moving toward viewer)
    let gOff = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const time = Date.now() * 0.001;
      gOff = (gOff + 0.18) % 90;
      const { boxes, hubs, routes, pkgs } = sc;

      // ── Isometric diamond floor grid ──
      const GS = 90, inv = 1 / T;
      ctx.lineWidth = 0.5; ctx.strokeStyle = "rgba(255,140,50,0.026)";
      for (let x = -(h * inv + GS); x <= w + GS; x += GS) {
        ctx.beginPath();
        ctx.moveTo(x + gOff * inv, 0);
        ctx.lineTo(x + gOff * inv + h * inv, h);
        ctx.stroke();
      }
      for (let x = -GS; x <= w + h * inv + GS; x += GS) {
        ctx.beginPath();
        ctx.moveTo(x - gOff * inv, 0);
        ctx.lineTo(x - gOff * inv - h * inv, h);
        ctx.stroke();
      }

      // ── Logistics route paths (dashed curves) ──
      ctx.setLineDash([5, 14]); ctx.lineWidth = 1;
      routes.forEach(r => {
        ctx.beginPath(); ctx.moveTo(r.x1, r.y1);
        ctx.quadraticCurveTo(r.cx, r.cy, r.x2, r.y2);
        ctx.strokeStyle = "rgba(255,140,50,0.07)"; ctx.stroke();
      });
      ctx.setLineDash([]);

      // ── Hub / warehouse nodes ──
      hubs.forEach(hub => {
        const p = Math.sin(time * 1.3 + hub.ph) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(hub.x, hub.y, 3 + p * 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,140,50,${0.06 + p * 0.1})`; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(hub.x, hub.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,140,50,${0.22 + p * 0.28})`; ctx.fill();
      });

      // ── In-transit packages along routes ──
      pkgs.forEach(pkg => {
        pkg.t += pkg.sp;
        if (pkg.t > 1) { pkg.t = 0; pkg.trail = []; }
        const pos = qBez(pkg.t, pkg.r.x1, pkg.r.y1, pkg.r.cx, pkg.r.cy, pkg.r.x2, pkg.r.y2);
        pkg.trail.push({ ...pos });
        if (pkg.trail.length > 22) pkg.trail.shift();
        // Glowing trail
        pkg.trail.forEach((tp, ti) => {
          const a = ti / pkg.trail.length;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 1.8 * a, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,200,80,${a * 0.32})`; ctx.fill();
        });
        // Small 3D package box
        isoBox(pos.x - 4, pos.y, 8, 5, 6, 0.52);
      });

      // ── Drifting 3D shipping containers ──
      boxes.forEach(b => {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.W * 2) b.x = w + b.W;
        if (b.x > w + b.W * 2) b.x = -b.W;
        if (b.y < -b.H * 2) b.y = h + b.H;
        if (b.y > h + b.H * 2) b.y = -b.H;
        isoBox(b.x, b.y + Math.sin(time * 0.42 + b.ph) * 3, b.W, b.D, b.H, b.al);
      });

      frame = requestAnimationFrame(draw);
    };

    draw();
    const onResize = () => { resize(); sc = mkScene(); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ─── Scroll Progress ────────────────────────────────────────── */
function ScrollBar() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => { const total = document.documentElement.scrollHeight - window.innerHeight; setP(total > 0 ? document.documentElement.scrollTop / total : 0); };
    window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn);
  }, []);
  return <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${p*100}%`, background: "linear-gradient(90deg,#ff8c32,#ff4444,#ffd700)", zIndex: 9999 }} />;
}

/* ─── Scroll Reveal ──────────────────────────────────────────── */
function useReveal(delay = 0) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.1 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return [ref, { opacity: v?1:0, transform: v?"translateY(0) rotateX(0)":"translateY(50px) rotateX(-6deg)", transition: `all 0.85s cubic-bezier(.22,1,.36,1) ${delay}s` }];
}

/* ─── Typing Effect ──────────────────────────────────────────── */
function Typer({ texts }) {
  const [idx, setIdx] = useState(0);
  const [txt, setTxt] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    const cur = texts[idx]; let t;
    if (!del && txt.length < cur.length) t = setTimeout(() => setTxt(cur.slice(0, txt.length+1)), 60);
    else if (!del) t = setTimeout(() => setDel(true), 2200);
    else if (del && txt.length > 0) t = setTimeout(() => setTxt(cur.slice(0, txt.length-1)), 30);
    else { setDel(false); setIdx(i => (i+1)%texts.length); }
    return () => clearTimeout(t);
  }, [txt, del, idx, texts]);
  return <span>{txt}<span style={{ borderRight: "2px solid #ff8c32", marginLeft: 2, animation: "blink 1s step-end infinite" }}>&nbsp;</span></span>;
}

/* ─── 3D Card ────────────────────────────────────────────────── */
function Card3D({ children, style = {}, depth = 10 }) {
  const ref = useRef(null);
  const [tf, setTf] = useState("");
  const [glow, setGlow] = useState("");
  return (
    <div ref={ref}
      onMouseMove={e => {
        const r = ref.current.getBoundingClientRect();
        const x = e.clientX-r.left, y = e.clientY-r.top;
        setTf(`perspective(700px) rotateX(${((y-r.height/2)/r.height)*-depth}deg) rotateY(${((x-r.width/2)/r.width)*depth}deg) scale(1.02)`);
        setGlow(`radial-gradient(circle at ${x}px ${y}px, rgba(255,140,50,0.1), transparent 60%)`);
      }}
      onMouseLeave={() => { setTf(""); setGlow(""); }}
      style={{
        transform: tf || "perspective(700px) rotateX(0) rotateY(0)", transition: "transform 0.25s ease-out",
        transformStyle: "preserve-3d",
        background: glow ? `${glow}, rgba(255,255,255,0.015)` : "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,140,50,0.1)", borderRadius: 16, backdropFilter: "blur(6px)", ...style,
      }}
    >{children}</div>
  );
}

/* ─── Counter ────────────────────────────────────────────────── */
function Counter({ end, suffix = "", prefix = "" }) {
  const [v, setV] = useState(0);
  const ref = useRef(null); const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true; const s = Date.now();
        const tick = () => { const p = Math.min((Date.now()-s)/2000,1); setV(Math.floor(p*end)); if(p<1) requestAnimationFrame(tick); };
        tick();
      }
    }, { threshold: 0.5 }); obs.observe(el); return () => obs.disconnect();
  }, [end]);
  return <span ref={ref}>{prefix}{v.toLocaleString()}{suffix}</span>;
}

/* ─── Hub Map Animation ──────────────────────────────────────── */
function HubMap() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setPulse(p => (p+1)%23), 200);
    return () => clearInterval(i);
  }, []);
  const hubs = Array.from({length: 23}, (_, i) => ({
    x: 15 + (i % 7) * 13 + (Math.sin(i*1.5)*4),
    y: 20 + Math.floor(i / 7) * 22 + (Math.cos(i*2)*5),
  }));
  return (
    <svg viewBox="0 0 100 80" style={{ width: "100%", maxWidth: 400, height: "auto", margin: "0 auto", display: "block" }}>
      {/* connection lines */}
      {hubs.map((h, i) => hubs.slice(i+1).filter((_, j) => j < 3).map((h2, j) => (
        <line key={`${i}-${j}`} x1={h.x} y1={h.y} x2={h2.x} y2={h2.y} stroke="rgba(255,140,50,0.12)" strokeWidth="0.3" />
      )))}
      {/* hub dots */}
      {hubs.map((h, i) => (
        <g key={i}>
          {i === pulse && <circle cx={h.x} cy={h.y} r="4" fill="none" stroke="#ff8c32" strokeWidth="0.3" opacity="0.5">
            <animate attributeName="r" from="2" to="6" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
          </circle>}
          <circle cx={h.x} cy={h.y} r="1.5" fill="#ff8c32" opacity={i === pulse ? 1 : 0.4} />
        </g>
      ))}
    </svg>
  );
}

/* ═══ MAIN ═══════════════════════════════════════════════════ */
export default function Portfolio() {
  const [heroRef, heroSt] = useReveal();
  const [aboutRef, aboutSt] = useReveal();
  const [skillRef, skillSt] = useReveal();
  const [expRef, expSt] = useReveal();
  const [eduRef, eduSt] = useReveal();
  const [contactRef, contactSt] = useReveal();
  const [expItemRef0, expItemSt0] = useReveal(0);
  const [expItemRef1, expItemSt1] = useReveal(0.12);
  const [expItemRef2, expItemSt2] = useReveal(0.24);
  // NOTE: expItemReveal is hardcoded to 3 entries — add a new useReveal pair above if you add a 4th experience
  const expItemReveal = [[expItemRef0, expItemSt0], [expItemRef1, expItemSt1], [expItemRef2, expItemSt2]];
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fn = e => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", fn); return () => window.removeEventListener("mousemove", fn);
  }, []);

  const hf = "'Bebas Neue', 'Impact', sans-serif";
  const sf = "'Space Mono', 'Courier New', monospace";
  const bf = "'Inter', 'Segoe UI', sans-serif";
  const accent = "#ff8c32";
  const accentGlow = { color: accent, textShadow: `0 0 25px rgba(255,140,50,0.4), 0 0 50px rgba(255,140,50,0.12)` };
  const container = { maxWidth: 1100, margin: "0 auto", padding: "0 24px" };
  const sTitle = { fontFamily: hf, fontSize: "clamp(32px,6vw,52px)", fontWeight: 400, color: "#f0ece4", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 };
  const bar = { width: 50, height: 3, background: `linear-gradient(90deg,${accent},#ff4444)`, borderRadius: 2, marginBottom: 44 };

  const px = mousePos.x / (window.innerWidth||1) - 0.5;
  const py = mousePos.y / (window.innerHeight||1) - 0.5;

  const stats = [
    { label: "Hubs Managed", value: 23, suffix: "+" },
    { label: "Workforce Led", value: 500, suffix: "+" },
    { label: "Daily Orders", value: 4000, suffix: "+" },
    { label: "NPS Score", value: 4.7, suffix: "/5", isDecimal: true },
    { label: "Expiry Loss Reduced", value: 87, suffix: "%" },
    { label: "Years Experience", value: 8, suffix: "" },
  ];

  const skills = {
    "Operations": ["Control Tower Ops","Multi-Hub Management","Workforce Planning","SLA Management","Process Improvement","Hub Expansion"],
    "Supply Chain": ["Inventory Management","FEFO","WMS","Last-Mile Logistics","Distribution Management","Demand Planning"],
    "Analytics & Tools": ["Power BI","Advanced Excel","Tableau","Google Sheets","Python (Basic)","Zoho","SuperSet","BatterPlace"],
    "Frameworks": ["Six Sigma Green Belt","Project Management","Program Management","Stakeholder Management","OKR Alignment"],
  };

  const experiences = [
    { role: "Hub Manager – Cluster Operations", company: "Pronto", location: "New Delhi", period: "Oct 2025 – Present", color: "#ff8c32",
      highlights: [
        "Orchestrated cluster ops across 23 hubs, directing 26 supervisors & 500+ workforce — ~4,000 daily orders with consistent SLA adherence",
        "Spearheaded strategic hub expansion — site selection, capacity planning & go-live execution",
        "Drove OTF & Completion Rate KPIs to peak, sustaining NPS 4.7/5 through structured feedback loops",
        "Engineered real-time dashboards with Tech & Product teams for data-driven shift scheduling",
        "Reduced idle time ~15% via digital shift management frameworks",
        "Developed standardized SOPs & operations playbooks across all 23 locations",
        "Facilitated weekly cross-functional reviews aligning ops priorities with OKRs",
      ],
    },
    { role: "Hub Manager", company: "Zepto", location: "New Delhi", period: "Aug 2024 – Oct 2025", color: "#ffd700",
      highlights: [
        "Managed 1,000+ daily orders in quick-commerce — defect rate below 0.7%",
        "Achieved NPS 85 through on-time delivery & systematic issue resolution",
        "87% reduction in monthly expiry losses (₹2,00,000 → ₹15,000) via FEFO strategy",
        "Inventory Health above 95% with 10% stock accuracy improvement",
        "Shrinkage CPO below 0.3% via structured audits & loss prevention",
        "Reduced stockouts by 20% during high-demand windows",
      ],
    },
    { role: "Operations Specialist", company: "DHL Express", location: "New Delhi", period: "May 2018 – Aug 2024", color: "#ff4444",
      highlights: [
        "Led 15 logistics specialists — 18% productivity improvement",
        "100% SOP adherence through training programs & compliance mechanisms",
        "Reduced processing time by 20% via documentation workflow optimization",
        "98% inventory accuracy through structured audit cycles",
        "35% reduction in processing discrepancies over 12 months",
        "Led OpEx projects aligned with DHL global standards",
      ],
    },
  ];

  const education = [
    { degree: "MBA – Marketing & HR", school: "IMT Ghaziabad", year: "2018 – 2022" },
    { degree: "B.Com", school: "University of Rajasthan", year: "2014 – 2017" },
  ];

  const certs = ["Six Sigma Green Belt","Supply Chain Management Expert","Google Project Management","DHL Aviation Security (94)","FSSAI","FOSTAC"];

  return (
    <div style={{ fontFamily: bf, background: "#0b0e14", color: "#c4c0b8", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 15px rgba(255,140,50,0.15)}50%{box-shadow:0 0 35px rgba(255,140,50,0.3)}}
        @keyframes scanline{0%{top:-100%}100%{top:200%}}

        @keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#0b0e14}
        ::-webkit-scrollbar-thumb{background:linear-gradient(#ff8c32,#ff4444);border-radius:3px}
        a{color:#ff8c32;text-decoration:none;transition:all 0.3s}
        a:hover{color:#ffd700;text-shadow:0 0 10px rgba(255,215,0,0.3)}
      `}</style>

      <GridCanvas />
      <ScrollBar />

      {/* Parallax decorative elements */}
      <div style={{ position:"fixed",top:"10%",right:"10%",width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,140,50,0.03),transparent 70%)",transform:`translate(${px*-25}px,${py*-25}px)`,zIndex:0,pointerEvents:"none" }} />
      <div style={{ position:"fixed",bottom:"15%",left:"8%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,68,68,0.03),transparent 70%)",transform:`translate(${px*20}px,${py*20}px)`,zIndex:0,pointerEvents:"none" }} />

      {/* ═══ HERO ═══ */}
      <section ref={heroRef} style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1,padding:"40px 24px",perspective:1200,...heroSt }}>
        <div style={{ maxWidth:900,textAlign:"center",transformStyle:"preserve-3d" }}>
          {/* Status indicator */}
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"8px 20px",borderRadius:30,border:"1px solid rgba(255,140,50,0.2)",background:"rgba(255,140,50,0.05)",marginBottom:28,fontSize:13,fontFamily:sf,color:"#ff8c32" }}>
            <span style={{ width:8,height:8,borderRadius:"50%",background:"#4caf50",boxShadow:"0 0 8px #4caf50",animation:"pulse 2s infinite" }} />
            OPEN TO OPPORTUNITIES
          </div>

          {/* Hero Photo */}
          <div style={{ perspective:800,marginBottom:32 }}>
            <div style={{
              width:180,height:180,borderRadius:"50%",overflow:"hidden",margin:"0 auto",
              border:"3px solid rgba(255,140,50,0.3)",
              animation:"float 5s ease-in-out infinite, pulse 4s ease-in-out infinite",
              transformStyle:"preserve-3d",
              transition:"transform 0.2s ease-out",
            }}>
              <img src="data:image/jpeg;base64,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UYdCD/Cx79KimmCuckHPIqp9pKuwxxQkDkTySnGMkkVWllEkZDHBxge9RTTbzwMH9KgLFyoxgk4q0jNyK753HIptWL6Iw3LIfrVetEZNWYUUUUxBRRRQAUUUUgCkpaKAEopaSgAooooAKKKKAJpfuVDU0v3KhoAKKKKACiiigAoopaACiiigBKWiigAooopgFbGn3J8rGenUVj1PaNiQrkDPTPrWc43RpTlys15nViWHSq0jZXjNR+Yy8HB9qZvznNZpWN5O5VbliBwKQLuPHSpHTng9amiRVFa30MLajYYMHJrQgnWI9B781TcsuADUbFgM578VNrmily7GlNqUgxgYB/Wq5vpCxIc/jVNtwOc5A4pFV/MPB9QRQooTqSZoC7eVQd4wfersEpXgktWZBbknODzz0rTggKKCcqD2NTKw43LJmG0HO361C86lTt6+oFI74GGOR2NUHkJfBwPekkNyIruQljnp6gVAGKcMdwPOc4qSRhvIBKk8EHvVcgDucfStUjFsne4LrtPTsetJ520Y9e9VT1+U5FBckAEc07BckklGcjg/oalsE+0Xa7sYXnmquSO341saLABlz941MnZFQXNIbr8IVoZB0I25rGrqtch8zTS2OUINcrRTd4hWVpBRRRWhkFFFFABRRRQAUUUUgCiiigApKWkoAKKKKAJpPuVDU0v3KhoAKKKKACiiigAopaKACiiigAooopgFFFFIAoBwQRRRQBZMhdd+TnvTA/BJNRKxU8VI3zZYDiptY05ri7s9OasQHcTnABqtnCAY5PelDbcc8/yosFy4dr5x60GMADofpUKSfMDnOetWVfcuOAalqxSdxphBCt045+lWIUQYJ+mah80ADODkcUqvsjJPOaWo9C9FsCt0yOnFP89gCGJ47dazvOYHk9ajknLc5o5R8xZnkU/dHbmqqyfe3HcopryMcHOCOlQ7gAWBBNUkQ2STMrMCpznoCKryMDyBgnr9aRnOcA8U0tkdM1Zm2DMWINIaQ59KVF3NjmgRNGpYqv44ro7ABUCgYOKzLKBQwwM1u264XoBWFR3OqmrBeJvs5E65U1xdd2RleelcZfxeTeSpjgNxTpPoKutmV6KKK3OYKKKKACiiigAooopAFFFFACUUUUAFFFFAE0n3KhqaX7lQ0AFFFFABRRRQAUtJRQAtFFFABRRRTAKKKKACiiigAp6OUPqPQ0ynABRlvypMaHYDMcDj+VJxgHrk9KaXJ9varM1qyRRzIdyOueO1Te25SV9iLcASOoxxUglHBz9agJ4x0NGeOKYrlh5A3CjA4xR5hwQe1VtxHenckZHNFg5iUyknBP41Gzk8VHmgsT160WFclaTOOTwKYD1pueOlJTC4tGOaACaesZ9KVwSuNAJ71ctINx3dgepoih5xt5961bS22BRjP1qJSNYxJbKLD5/AVqJHg1XiTHQc1bUYGO9YSZ0RQxjxXOa/EUmSYfdcYP1rpCME96patb/aLF0A+ZfmFODsxVI3iciCD1FLtz0plOBrqOMTpRUnBHP51GRg4pgFFFFAgooooAKSlopAFJRRQAUUUUATS/cqGppfuVDQAUUUUAFFFFABRRRQAtFJRQAtFFFABRRRTAKKKKAHxLkknoKa7FmyamHywD/a5quetSinogq9HdZtFhYfdzg1RpyUpK44SaZI+D2pgC4PrUmKQrmkmU1ciIop5Wk21VyOUZRTtppQOaLisNCmpFizT0TJFWYoiefyqXI0USFYyOmRVuKIHkgVLHDyDirkcIHNQ5GiiRQwHcpIrSjTkYFRInpzVyJTgVm2aJDlXA96eFxSgUp4rM0QxuBUcnzD1FS5pOxFAHHanZtbTswH7tjke1UhXYXcCyxlWGQa5a4hEMzIPwrqhK5x1IWd0R80MMrnuKDxSpzx61qZkdFKylTg0lIQUUlFAC0lFFABRRRQAUUUUATS/cqGppfuVDQAUUUUAFFFFABRRRQAUUUUALRSUUALRRTthAyeB70BYbTkjZ+g/GnxqvJPQVIJACPQUmy1HuJINqhfQVXPWp3ffUBFJBMSgcGiiqIJkOaeBVdWINWI3BqGrG0XcXb7UbQR6VIBmnBM1Ny7EGygKfrU/l0CM5ouLlEjUZq9EvAqoEbPFWYgwA4qWUkXUUD2qwhB7fnVWME4zmrkaYHNQzREi9OP0qwnQUyPAqXcMVDKQ7mlPIpm7nrTgQaQxmDmgcmpCCaZIVjQsSAAMnNNCKGozrBGznoBXKyOZZGkbqxzVzVb77XNtjJ8penv71QPFdVONkclSV2ITSCiitDMk3A8NzTWQfwn86bThQAwgjrRUmeMHmmFRng0gG0UpBHUUlAgooooAKKKKAJpfuVDU0v3KhoAKKKKACiiigAoopQCeAM0AJRUnl4GXIX270hKj7o/E0DsIFJ9h704KoOMlj7U3ljjrTidnA69zQNWHFggwAN38qiJJPPNJRQJu47PGKM0lFAXFzSZopKBXA0UUUAFKCRSUUAWoZc8VaQ5rMHHIqeK42nDfnWco9jWM+5pKoNBjqNJAcEHP0q3Gwbr1rNm61IVTHapkGKmEYPeneVjoaVx2FjIHaplY/hUIQ1IqnPNIZZRxjtTi3pUaqemOKkIxUlDlbjmpYxmo0TNRXGp2loCJJQzj+BOTRZvYTaW5cmdIoi7kKqjJJ6CuT1XVXvCYosrCD+LVFqOpzX7YY7IgeEB/n61QzXRCnbVnNOpfRC5xTSaKStTEKKKKAFpRQBS0DA000+mHrQAoY4xRweox9KbS0AG09uabjFOpd340gGUU/5T2xSbfQ0BYkk+5UNTSfd/GoaBBRTljZugqVYVH32/AUDSbIKesTt0Xj1NTBo0+6oJpjzO3U8Uh2S3E2In3m3H0FIZP7o2/SmUU7Cv2AnPWiilAxzQIdnavHU/pTKDRQMSloopiCiiigAooopAJRS0UwEopaKQBRRRmgByuUOQcVchvwv+sU/VaoUUmk9ylJrY2Bq0ajiJifcgVpWM4vomZFK7Tgg1zAVdjbiwYdOODV3StR+wStuTfG+N3qPcVEoK2hpGo76nRiAj2pyoVOKs27x3USywtujPcVm6tq0dkxhhCyTd89F+tYJNux0NpK7LyjGSeAKo3Wq20DEBvMcdk/xrnLi9nuCfNldge2cD8qr5rZUu5hKt2Ne71u4nUpGBCh67ep/Gsv600N+FLmtUktjJyb3CkNFFMQlFKBS4oEIBSgU6igYnSilpMUALTO9OJ4plAC0UUUCCkpaKAEopaSgCZlLjAo2JH1O5qUnaM1ETk0hqyJPMPrTCSTTc0DrQO45uKZSnrRQJhRRRTAKCaKKACkpaKBCUUtFACUUtJQAtFHaigApKWkzQAUUUmKQBRS4oxQAlFLikoAczAkkZOfXk02iigC/p+qT6ekqxEESDv2PqKpOzOxZiSScknvSUYosO7tYGXbjkHIzx2pKWkoEFFFFAC5pRzTaKAJMUUzcRShvWmA+im5B70tAwozxRQeBQA09aKXHFJQAUUUUAFFFFACUUtFAiST7tRVLJ92oqQBS0lFMBaSlooGFFFFABRRRQAUUtJQIKKWigYmKO1KaSgBOaKWigQmKKWigBKKWigYUlLRigApMUtFACUYopaBCUVIIyV3nhORn6f/rpfKYkhPmI7CgCKjHFLS0ANpcUUUAFFFLQMTGaXFKKKAGkZpMYp1FAhOfWjk9aUCloGIaSlpKACiiigAooooAKKKKAJJPu/jUVSyfd/GoqQgooopgFLSDpS0AAoNFFAxRRRRQAUYoooAWiiigBKSlNJQAtFFAoATFFLRQAlFFFABS4oFFABikpaKAE70tIOtOxQA4SMIynVc5x6Gnx3Hlv5ig7+2exqLFBoAKQ0ooIoASjFFFABigUUUAFFGKCKACjFFFABSikpR0oADSUGigAoo6UZoASiiigAooooAkk+7+NRVLJ9yohSEFFFFMApaKSgApaKKAFoziikoGFKKKKAFopKKAAcmlxSZoFABRSnNJQAUdqKKADFBoooAKM0tIaACg0UGgBB1p1NHWnDpQAUHmjPNFACikPJooJoASilpM0AFGKKXNACUtGaKAEopcUnSgBaSjNFABRRRQAlFGaKACiiigAooooAkk+7UNTS/d/GoaQhaTvRR3oAWiigUALRRRTGFFFFABS0UUAFBoooAKM0lLQAZooooAWkoooADR3oooAKKKKACikozxQAo70AUg6U9RuZV6ZOM0AJ8oPWjINXQyRoF28Y/hYD/65NV7iIhicYx16f0oAizSUCk70ALRRRQAtJR2ozQAGgUdaWgAzSGiigAooooAKKKKACkpaSgAooooAKSlpKBEsv3fxqGppPu1DSAKKKKAFooopgFLSUUALRRRQMWkoooAKWkooAKWiigAopKWgBKKWigBQaTrRRmgAxSU6kxQAlBooNAB2pRSUooAmWUFNsi/8CCgmlnnWRQqJtUde2ahApKAAUUtJQAUUUZoAKKTmlxQAUtNpaACiig0AFFJS9qACkpaSgAooooAKKKKAEooooESyfd/Goamk+7+NQ0gCiiigBaSiigBaKKKAClpKKYC0UUUDCiiigApaSigApaKKACiiigAopKKAClpKKACg0UUCFopKKBi0UUUAGKKKKACigUUAFHeiigAopKWgApKKKAFoNFJQAUUUUAFJRRQIKKKKACiiigCWT7v41DU0v3fxqGkAUUUUAFFFFABS0lFAC0UUUwFopKKAFopKWgYUUUUAFFFFABRRRQAUUUUAFFFFABR3ooNABmjNHHpRxQIM0Zo4o4oAWkooNABRRRQMKKKKACiiigAooooAKKKKACiiigQlFFFABRRRSAKKKSgCaX7v41DU0v3fxqGgAooooAKKKKACiiigBaKSloAKKKKYBS0lFAC0UUUDCiiigAooooAKKKKAClpKKACjNFJQIXNGaTNFAC59qM+1JiloAM0lFFAC0UUUDCiiigAooooAKKKKACiiigQUUUUAJRRRSASiiigAooooAml+7+NQ1NL938ahoAKKKKACiiigAooooAKKKKAFopKWgAooopgFLSUUALRSUUAFLSUUALRSUUALRRSUAFFFFABRRRQAtJRRQAUUUUALRSUUALRSUUAFFFFABS0lFAC0lFFABRRRQAUlFFIAooooAKKKKAJpfu/jUNTS/d/GoaACiiigAooooAKKKKACiiigAooooAKKKKAFopKKACjNFFABmlpKWgAoopKACiiigBaKKKACiiimAUUUUAFFFFABRRSUgFopKKAFopKKAFooopgFFFJSAWkoooAKKKKACiiigAooooA//9k=" alt="Lokesh Kumar" style={{ width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top" }} />
            </div>
            <div style={{ width:120,height:16,margin:"-8px auto 0",borderRadius:"50%",background:"rgba(255,140,50,0.06)",filter:"blur(10px)" }} />
          </div>

          <h1 style={{ fontFamily:hf,fontSize:"clamp(52px,10vw,100px)",fontWeight:400,lineHeight:0.95,color:"#f0ece4",letterSpacing:4,textTransform:"uppercase",marginBottom:20,transform:"translateZ(20px)" }}>
            LOKESH<br/>
            <span style={{ background:"linear-gradient(135deg,#ff8c32,#ff4444,#ffd700)",backgroundSize:"200% 200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"gradShift 4s ease infinite" }}>KUMAR</span>
          </h1>

          <p style={{ fontSize:"clamp(17px,2.5vw,22px)",color:"#8a8680",marginBottom:28,fontFamily:sf,minHeight:28 }}>
            <Typer texts={["Program Manager","Operations Leader","Supply Chain Strategist","Cluster Operations Head","Hub Expansion Architect"]} />
          </p>

          <p style={{ fontSize:15,lineHeight:1.8,color:"#6a6660",maxWidth:650,margin:"0 auto 36px",transform:"translateZ(10px)" }}>
            ~8 years orchestrating large-scale logistics operations across 23 hubs and 500+ workforce. Turning operational complexity into scalable systems with data-driven strategy.
          </p>

          <div style={{ display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",transform:"translateZ(5px)" }}>
            <a href="#contact" style={{ padding:"13px 32px",borderRadius:8,fontSize:14,fontWeight:700,fontFamily:sf,background:"linear-gradient(135deg,#ff8c32,#ff4444)",color:"#0b0e14",transition:"all 0.35s",textTransform:"uppercase",letterSpacing:1,display:"inline-block" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(255,140,50,0.3)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}
            >Contact Me</a>
            <a href="#experience" style={{ padding:"13px 32px",borderRadius:8,fontSize:14,fontWeight:700,fontFamily:sf,border:"1px solid rgba(255,140,50,0.3)",color:"#ff8c32",textTransform:"uppercase",letterSpacing:1,transition:"all 0.35s",display:"inline-block" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,140,50,0.08)";e.currentTarget.style.transform="translateY(-3px)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.transform=""}}
            >View Experience</a>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section ref={aboutRef} style={{ ...container,...aboutSt,padding:"100px 24px" }}>
        <h2 style={sTitle}>Command Center</h2>
        <div style={bar} />
        {/* Hub Map */}
        <div style={{ marginBottom:50 }}>
          <p style={{ fontFamily:sf,fontSize:12,color:"#6a6660",textTransform:"uppercase",letterSpacing:3,textAlign:"center",marginBottom:16 }}>Live Hub Network · 23 Locations</p>
          <HubMap />
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:20 }}>
          {stats.map((s,i) => (
            <Card3D key={i} style={{ padding:"28px 18px",textAlign:"center" }}>
              <div style={{ fontFamily:hf,fontSize:38,...accentGlow,marginBottom:8,letterSpacing:1 }}>
                {s.isDecimal ? <span>{s.value}{s.suffix}</span> : <Counter end={s.value} suffix={s.suffix} />}
              </div>
              <div style={{ fontFamily:sf,fontSize:10,textTransform:"uppercase",letterSpacing:2,color:"#5a5650" }}>{s.label}</div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* ═══ SKILLS ═══ */}
      <section id="skills" ref={skillRef} style={{ ...container,...skillSt,padding:"100px 24px" }}>
        <h2 style={sTitle}>Core Arsenal</h2>
        <div style={bar} />
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:24 }}>
          {Object.entries(skills).map(([cat,items],ci) => (
            <Card3D key={ci} style={{ padding:28 }}>
              <h3 style={{ fontFamily:hf,fontSize:22,color:accent,marginBottom:16,letterSpacing:1,textTransform:"uppercase" }}>{cat}</h3>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {items.map((s,si) => (
                  <span key={si} style={{ display:"inline-block",padding:"6px 14px",borderRadius:6,fontSize:12,fontFamily:sf,background:"rgba(255,140,50,0.06)",border:"1px solid rgba(255,140,50,0.12)",color:"#b0aca4",cursor:"default",transition:"all 0.3s",animation:`float 3s ease ${si*0.2}s infinite` }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,140,50,0.2)";e.currentTarget.style.color="#fff";e.currentTarget.style.transform="translateY(-3px) scale(1.05)";e.currentTarget.style.boxShadow="0 6px 20px rgba(255,140,50,0.15)"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,140,50,0.06)";e.currentTarget.style.color="#b0aca4";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}
                  >{s}</span>
                ))}
              </div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* ═══ EXPERIENCE ═══ */}
      <section id="experience" ref={expRef} style={{ ...container,...expSt,padding:"100px 24px" }}>
        <h2 style={sTitle}>Operations Log</h2>
        <div style={bar} />
        <div style={{ position:"relative",paddingLeft:40 }}>
          {/* Timeline */}
          <div style={{ position:"absolute",left:10,top:0,bottom:0,width:2,background:"linear-gradient(180deg,#ff8c32,#ff4444,#ffd700,transparent)",backgroundSize:"100% 200%",animation:"gradShift 6s ease infinite" }} />
          {experiences.map((exp,i) => {
            const [ref,style] = expItemReveal[i];
            return (
              <div key={i} ref={ref} style={{ marginBottom:40,position:"relative",...style }}>
                {/* Dot */}
                <div style={{ position:"absolute",left:-37,top:10,width:16,height:16,borderRadius:"50%",background:exp.color,boxShadow:`0 0 14px ${exp.color}80, 0 0 35px ${exp.color}30` }} />
                {/* Year badge */}
                <div style={{ position:"absolute",left:-37,top:32,fontFamily:sf,fontSize:9,color:"#5a5650",letterSpacing:1,writingMode:"vertical-lr",transform:"rotate(180deg)",textTransform:"uppercase" }}>{exp.period.split("–")[0].trim()}</div>

                <Card3D style={{ padding:28,position:"relative",overflow:"hidden" }} depth={6}>
                  {/* Scanline effect */}
                  <div style={{ position:"absolute",top:"-100%",left:0,right:0,height:"50%",background:"linear-gradient(transparent, rgba(255,140,50,0.02), transparent)",animation:"scanline 8s linear infinite",pointerEvents:"none" }} />

                  <div style={{ display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10 }}>
                    <h3 style={{ fontFamily:hf,fontSize:24,color:"#f0ece4",letterSpacing:1 }}>{exp.role}</h3>
                    <span style={{ fontFamily:sf,fontSize:11,color:exp.color,fontWeight:700,padding:"4px 14px",background:`${exp.color}12`,borderRadius:6,border:`1px solid ${exp.color}30` }}>{exp.period}</span>
                  </div>
                  <p style={{ fontFamily:sf,fontSize:12,color:"#5a5650",marginBottom:14,letterSpacing:1 }}>{exp.company} · {exp.location}</p>
                  <ul style={{ listStyle:"none",padding:0 }}>
                    {exp.highlights.map((h,hi) => (
                      <li key={hi} style={{ fontSize:13,lineHeight:1.75,color:"#908c84",paddingLeft:20,position:"relative",marginBottom:5 }}>
                        <span style={{ position:"absolute",left:0,color:exp.color,fontFamily:sf }}>▹</span>{h}
                      </li>
                    ))}
                  </ul>
                </Card3D>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ EDUCATION ═══ */}
      <section id="education" ref={eduRef} style={{ ...container,...eduSt,padding:"100px 24px" }}>
        <h2 style={sTitle}>Credentials</h2>
        <div style={bar} />
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24 }}>
          {education.map((ed,i) => (
            <Card3D key={i} style={{ padding:30 }}>
              <div style={{ fontFamily:sf,fontSize:11,color:accent,fontWeight:700,marginBottom:10,padding:"4px 12px",background:"rgba(255,140,50,0.06)",borderRadius:8,display:"inline-block",letterSpacing:1 }}>{ed.year}</div>
              <h3 style={{ fontFamily:hf,fontSize:24,color:"#f0ece4",marginBottom:8,letterSpacing:1 }}>{ed.degree}</h3>
              <p style={{ fontFamily:sf,fontSize:12,color:"#5a5650",letterSpacing:1 }}>{ed.school}</p>
            </Card3D>
          ))}
        </div>
        <div style={{ marginTop:44 }}>
          <h3 style={{ fontFamily:hf,fontSize:28,color:"#f0ece4",marginBottom:18,letterSpacing:1 }}>CERTIFICATIONS</h3>
          <div style={{ display:"flex",flexWrap:"wrap",gap:10 }}>
            {certs.map((c,i) => (
              <span key={i} style={{ display:"inline-block",padding:"8px 18px",borderRadius:6,fontSize:12,fontFamily:sf,border:"1px solid rgba(255,68,68,0.2)",background:"rgba(255,68,68,0.04)",color:"#b0aca4",cursor:"default",transition:"all 0.3s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,68,68,0.15)";e.currentTarget.style.color="#fff";e.currentTarget.style.transform="translateY(-3px)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,68,68,0.04)";e.currentTarget.style.color="#b0aca4";e.currentTarget.style.transform=""}}
              >{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" ref={contactRef} style={{ ...container,...contactSt,padding:"100px 24px 70px",textAlign:"center" }}>
        <h2 style={sTitle}>Connect</h2>
        <div style={{ ...bar,margin:"0 auto 44px" }} />
        <p style={{ fontSize:15,color:"#6a6660",maxWidth:520,margin:"0 auto 36px",lineHeight:1.8 }}>
          Ready for high-impact Program Manager or Business Operations roles. Let's talk about scaling operations at the next level.
        </p>
        <div style={{ display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap" }}>
          {[
            { label:"Email",href:"mailto:lokeshkr21oct@gmail.com" },
            { label:"LinkedIn",href:"https://www.linkedin.com/in/lokesh-kumar-a171b0201/" },
            { label:"Call",href:"tel:+919690409519" },
          ].map((l,i) => (
            <a key={i} href={l.href} style={{ padding:"12px 28px",borderRadius:8,fontSize:13,fontWeight:700,fontFamily:sf,border:"1px solid rgba(255,140,50,0.2)",color:"#ff8c32",textTransform:"uppercase",letterSpacing:2,transition:"all 0.35s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,140,50,0.1)";e.currentTarget.style.transform="translateY(-3px) scale(1.05)";e.currentTarget.style.boxShadow="0 8px 30px rgba(255,140,50,0.15)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}
            >{l.label}</a>
          ))}
        </div>
      </section>

      <footer style={{ textAlign:"center",padding:"36px 24px",borderTop:"1px solid rgba(255,255,255,0.03)",fontFamily:sf,fontSize:11,color:"#3a3630",letterSpacing:2,textTransform:"uppercase" }}>
        © 2026 Lokesh Kumar · Operations Excellence
      </footer>
    </div>
  );
}
