import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';

// ── Check icon ────────────────────────────────────────────────────────────────
function Check() {
  return (
    <div className="w-5 h-5 rounded-full bg-[#4F46E5]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg className="w-3 h-3 text-[#4F46E5]" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

// ── Screenshot frame (light chrome for light-theme screenshots) ───────────────
function LightFrame({ src, alt }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(30,41,59,0.14),0_4px_16px_rgba(30,41,59,0.06)] border border-[#E8ECEF]">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F9FBFC] border-b border-[#E8ECEF]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF584A]/70 block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#D69E2E]/70 block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#37A169]/70 block" />
        <div className="flex-1 mx-3 bg-white border border-[#E8ECEF] rounded h-5 flex items-center px-2.5">
          <span className="text-[9px] text-[#94A3B8] font-mono">app.karya.io</span>
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

// ── Screenshot frame (dark chrome for dark-theme screenshots) ─────────────────
function DarkFrame({ src, alt }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.28),0_4px_16px_rgba(0,0,0,0.16)] border border-[#2A2A3A]">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A1A2E] border-b border-[#2A2A3A]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF584A]/80 block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#D69E2E]/80 block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#37A169]/80 block" />
        <div className="flex-1 mx-3 bg-[#2A2A3A] rounded h-5 flex items-center px-2.5">
          <span className="text-[9px] text-[#666] font-mono">app.karya.io</span>
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" />
    </div>
  );
}

// ── Realistic mountain canvas ─────────────────────────────────────────────────
function MountainCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Pseudo-noise: stacked sines give organic, non-repeating terrain
    function tn(x, s) {
      return (
        Math.sin(x * 2.3 + s) * 0.38 +
        Math.sin(x * 5.2 + s * 1.5) * 0.22 +
        Math.sin(x * 11.1 + s * 2.7) * 0.14 +
        Math.sin(x * 23.7 + s * 4.3) * 0.08 +
        Math.sin(x * 51.3 + s * 8.1) * 0.04 +
        Math.sin(x * 103 + s * 15) * 0.02
      );
    }

    const ranges = [
      { s: 0,  baseY: 0.50, height: 0.30, topColor: '#C8D3DC', botColor: '#AABBC6', opacity: 0.60, snow: false },
      { s: 5,  baseY: 0.54, height: 0.29, topColor: '#B6C3CE', botColor: '#A2B2BE', opacity: 0.65, snow: false },
      { s: 10, baseY: 0.58, height: 0.33, topColor: '#96A8B4', botColor: '#7E9298', opacity: 0.92, snow: true  },
      { s: 15, baseY: 0.64, height: 0.29, topColor: '#7A8E9A', botColor: '#607880', opacity: 0.92, snow: true  },
      { s: 20, baseY: 0.71, height: 0.22, topColor: '#5A7268', botColor: '#425C54', opacity: 1.0,  snow: false },
    ];

    const birds = Array.from({ length: 7 }, (_, i) => ({
      x: -80 + i * 210,
      y: 48 + i * 16 + Math.sin(i * 1.9) * 14,
      speed: 0.38 + i * 0.06,
      phase: i * 1.2,
      size: 5 + (i % 3),
      opacity: 0.55 + (i % 3) * 0.1,
    }));

    // [xFrac, yFrac, heightFrac, swayPhase]
    const treeDefs = [
      [0.025, 0.83, 0.10, 0.0 ], [0.075, 0.81, 0.11, 0.8 ],
      [0.125, 0.83, 0.10, 1.6 ], [0.175, 0.81, 0.12, 2.4 ],
      [0.225, 0.83, 0.10, 3.2 ], [0.845, 0.82, 0.10, 0.5 ],
      [0.895, 0.81, 0.11, 1.3 ], [0.940, 0.83, 0.10, 2.1 ],
      [0.975, 0.81, 0.12, 2.9 ],
    ];

    let raf, frame = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    function buildTerrain(W, H, r) {
      const pts = [];
      const steps = Math.ceil(W) + 2;
      for (let i = 0; i <= steps; i++) {
        const nx = i / steps;
        const noise = tn(nx * 3, r.s);
        pts.push({ x: nx * W, y: H * (r.baseY - r.height * (0.5 + noise * 0.5)) });
      }
      return pts;
    }

    function drawRange(W, H, r) {
      const pts = buildTerrain(W, H, r);
      const minY = pts.reduce((m, p) => Math.min(m, p.y), H);
      const grad = ctx.createLinearGradient(0, minY, 0, H * r.baseY);
      grad.addColorStop(0, r.topColor);
      grad.addColorStop(1, r.botColor);

      ctx.save();
      ctx.globalAlpha = r.opacity;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2;
        const my = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      if (r.snow) {
        const threshold = H * (r.baseY - r.height * 0.68);
        for (let i = 3; i < pts.length - 3; i++) {
          const p = pts[i];
          if (p.y < threshold) {
            const isLocalPeak =
              pts[i - 1].y > p.y && pts[i - 2].y > p.y && pts[i - 3].y > p.y &&
              pts[i + 1].y > p.y && pts[i + 2].y > p.y && pts[i + 3].y > p.y;
            if (isLocalPeak) {
              const capH = (threshold - p.y) * 1.5;
              const capW = capH * 0.75;
              const snowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y + capH * 0.5, capH);
              snowGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
              snowGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
              ctx.globalAlpha = r.opacity * 0.9;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - capH * 0.05);
              ctx.quadraticCurveTo(p.x - capW * 0.3, p.y + capH * 0.3, p.x - capW * 0.55, p.y + capH * 0.6);
              ctx.quadraticCurveTo(p.x, p.y + capH * 0.35, p.x + capW * 0.55, p.y + capH * 0.6);
              ctx.quadraticCurveTo(p.x + capW * 0.3, p.y + capH * 0.3, p.x, p.y - capH * 0.05);
              ctx.fillStyle = snowGrad;
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();
    }

    function drawTree(x, treeTop, treeH, swayPhase, f) {
      const sway = Math.sin(f * 0.013 + swayPhase) * 0.024;
      const baseY = treeTop + treeH;
      ctx.save();
      ctx.translate(x, baseY);
      ctx.rotate(sway);
      ctx.translate(-x, -baseY);

      const trunkW = treeH * 0.08, trunkH = treeH * 0.16;
      ctx.fillStyle = '#221A0C';
      ctx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

      const tiers = [
        { y: baseY - trunkH, wr: 0.50, h: treeH * 0.46, dark: '#1E2820', light: '#263228' },
        { y: baseY - trunkH - treeH * 0.28, wr: 0.40, h: treeH * 0.38, dark: '#263028', light: '#2E3C30' },
        { y: baseY - trunkH - treeH * 0.52, wr: 0.30, h: treeH * 0.34, dark: '#2E3830', light: '#384438' },
      ];
      for (const t of tiers) {
        ctx.beginPath();
        ctx.moveTo(x, t.y - t.h);
        ctx.lineTo(x - treeH * t.wr, t.y);
        ctx.lineTo(x + treeH * t.wr, t.y);
        ctx.closePath();
        const tGrad = ctx.createLinearGradient(x - treeH * t.wr, 0, x + treeH * t.wr, 0);
        tGrad.addColorStop(0, t.dark);
        tGrad.addColorStop(0.5, t.light);
        tGrad.addColorStop(1, t.dark);
        ctx.fillStyle = tGrad;
        ctx.fill();
      }
      ctx.restore();
    }

    function drawBird(b, f) {
      const flap = Math.sin(f * 0.16 + b.phase) * 5 * (b.size / 6);
      ctx.save();
      ctx.globalAlpha = b.opacity;
      ctx.strokeStyle = '#627488';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x - b.size, b.y - flap, b.x - b.size * 2.2, b.y);
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x + b.size, b.y - flap, b.x + b.size * 2.2, b.y);
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      raf = requestAnimationFrame(draw);
      frame++;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#D4E2EE');
      sky.addColorStop(0.5, '#C6D8E6');
      sky.addColorStop(1, '#B6C8D4');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Soft cloud wisps
      for (let ci = 0; ci < 4; ci++) {
        const cx = W * (0.1 + ci * 0.24);
        const cy = H * (0.08 + ci * 0.04);
        const r = W * (0.06 + ci * 0.012);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cg.addColorStop(0, 'rgba(255,255,255,0.22)');
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 2.2, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mountain ranges
      for (const r of ranges) drawRange(W, H, r);

      // Valley floor
      const vg = ctx.createLinearGradient(0, H * 0.76, 0, H);
      vg.addColorStop(0, '#384E44');
      vg.addColorStop(1, '#273830');
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.quadraticCurveTo(W * 0.25, H * 0.83, W * 0.5, H * 0.81);
      ctx.quadraticCurveTo(W * 0.75, H * 0.79, W, H * 0.81);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = vg;
      ctx.fill();


      // Trees
      for (const [xf, yf, hf, ph] of treeDefs) {
        drawTree(xf * W, yf * H, hf * H, ph, frame);
      }

      // Birds
      for (const b of birds) {
        b.x += b.speed;
        if (b.x > W + 80) b.x = -80;
        drawBird(b, frame);
      }

      // Atmospheric depth haze
      const haze = ctx.createLinearGradient(0, 0, 0, H);
      haze.addColorStop(0, 'rgba(210,225,238,0.0)');
      haze.addColorStop(0.5, 'rgba(210,228,240,0.04)');
      haze.addColorStop(1, 'rgba(210,228,240,0.14)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, W, H);

      // Left fade to page bg
      const fade = ctx.createLinearGradient(0, 0, W * 0.38, 0);
      fade.addColorStop(0, 'rgba(247,245,240,1)');
      fade.addColorStop(0.7, 'rgba(247,245,240,0.15)');
      fade.addColorStop(1, 'rgba(247,245,240,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, H);
    }

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />;
}

// ── Main component ────────────────────────────────────────────────────────────
function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1E293B] overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${scrolled ? 'bg-[#F7F5F0]/95 backdrop-blur border-b border-[#E5E0D8] shadow-sm' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <Logo size={32} className="rounded-lg shadow-sm" />
            <span className="font-bold text-[15px] text-[#1E293B] tracking-tight">Keystone</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 mx-auto">
            {[['Features','#features'],['How it works','#how-it-works'],['Views','#views'],['Team','#team']].map(([label, href]) => (
              <a key={label} href={href}
                className="text-sm font-medium text-[#64748B] hover:text-[#1E293B] px-3 py-2 rounded-lg hover:bg-black/5 transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/login"
              className="hidden sm:block text-sm font-medium text-[#1E293B] px-4 py-2 rounded-lg border border-[#D8D3CB] hover:bg-black/5 transition-colors">
              Log in
            </Link>
            <Link to="/register"
              className="text-sm font-semibold bg-[#1E293B] hover:bg-[#0F172A] text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen overflow-hidden flex items-stretch">

        {/* Left content */}
        <div className="relative z-10 flex flex-col justify-center pl-8 md:pl-14 lg:pl-20 xl:pl-28 pr-6 w-full lg:w-[48%] pt-24 pb-16">

          <div className="inline-flex items-center gap-2 self-start mb-7 bg-white border border-[#E5E0D8] rounded-full px-4 py-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-medium text-[#1E293B]">New: Subtask support is now live</span>
            <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <h1 className="text-5xl lg:text-6xl xl:text-[66px] font-extrabold text-[#1E293B] leading-[1.06] tracking-tight mb-5">
            The smarter way<br />
            to manage your<br />
            team's work.
          </h1>

          <p className="text-[#64748B] text-lg leading-relaxed mb-8 max-w-[420px]">
            Keystone brings tasks, projects, and your entire team together in one focused workspace — so you can ship faster.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link to="/register"
              className="inline-flex items-center gap-2.5 bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors shadow-[0_4px_14px_rgba(30,41,59,0.28)]">
              Get started free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 bg-white hover:bg-[#F0EDE8] border border-[#D8D3CB] text-[#1E293B] font-semibold text-sm px-6 py-3 rounded-lg transition-colors">
              Explore features
            </a>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#A09890] uppercase tracking-widest mb-3.5">Trusted by teams at</p>
            <div className="flex flex-wrap items-center gap-7">
              {['Webflow', 'Loom', 'Slack', 'Notion', 'HubSpot'].map((name) => (
                <span key={name} className="text-sm font-bold text-[#B8B0A6] select-none">{name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right — mountain landscape + floating app card */}
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 left-[42%] overflow-hidden">

          {/* Realistic mountain canvas — procedural terrain, animated birds & trees */}
          <MountainCanvas />

          {/* Floating: task done */}
          <div className="absolute top-[20%] right-5 z-30 bg-white rounded-xl border border-[#E8ECEF] shadow-[0_8px_24px_rgba(30,41,59,0.13)] p-3 flex items-center gap-2.5 w-[172px]">
            <div className="w-7 h-7 rounded-full bg-[#37A169]/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#37A169]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#1E293B]">Task completed</p>
              <p className="text-[9px] text-[#64748B]">UI Build · just now</p>
            </div>
          </div>

          {/* Floating: team members */}
          <div className="absolute bottom-[20%] right-5 z-30 bg-white rounded-xl border border-[#E8ECEF] shadow-[0_8px_24px_rgba(30,41,59,0.13)] p-3 w-[160px]">
            <p className="text-[10px] font-semibold text-[#1E293B] mb-2">Active now</p>
            <div className="flex items-center gap-1.5">
              {[['N','#4F46E5'],['S','#37A169'],['H','#7C3AED']].map(([l,c]) => (
                <div key={l} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white" style={{ background: c }}>{l}</div>
              ))}
              <span className="text-[9px] text-[#64748B] ml-1">+2 more</span>
            </div>
          </div>

          {/* Floating: sprint progress */}
          <div className="absolute top-[48%] right-5 z-30 bg-white rounded-xl border border-[#E8ECEF] shadow-[0_8px_24px_rgba(30,41,59,0.13)] p-3 w-[148px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#1E293B]">Sprint</span>
              <span className="text-[10px] font-bold text-[#4F46E5]">67%</span>
            </div>
            <div className="flex items-end gap-1 h-8">
              {[38,62,48,78,52,90,68].map((h,i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height:`${h}%`, background: i===5?'#4F46E5':'#E0E7FF' }} />
              ))}
            </div>
            <p className="text-[8px] text-[#94A3B8] mt-1.5">12 of 18 done</p>
          </div>
        </div>
      </section>

      {/* ── Dark feature bar ── */}
      <div className="bg-[#1A2535]">
        <div className="max-w-7xl mx-auto px-6 py-9">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { title: 'Flexible Boards', desc: 'Kanban, list, and timeline views.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg> },
              { title: 'Lightning Fast', desc: 'Real-time updates for every team member.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
              { title: 'Team Workspaces', desc: 'Invite members, assign roles and access.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { title: 'Progress Analytics', desc: 'Visual charts and sprint metrics.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white flex-shrink-0">{f.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Showcase 1: List & Board views (image3 — light) ── */}
      <section id="views" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="w-full lg:w-[58%]">
              <LightFrame src="/image3.png" alt="Keystone list view" />
            </div>
            <div className="w-full lg:w-[42%]">
              <p className="text-xs font-bold text-[#4F46E5] uppercase tracking-[0.18em] mb-3">Multiple Views</p>
              <h2 className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-4 leading-tight">
                See your work the way your team thinks
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-6">
                Switch between List, Board, Timeline, and Dashboard views instantly — without losing any data or context.
              </p>
              <ul className="space-y-3">
                {[
                  'List view with custom columns and sections',
                  'Kanban board for visual workflow management',
                  'Timeline view to track deadlines across projects',
                  'Dashboard for birds-eye progress reporting',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-sm text-[#475569] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase 2: Create projects (image1 — dark) ── */}
      <section id="features" className="py-20 lg:py-28 bg-[#F7F5F0]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
            <div className="w-full lg:w-[58%]">
              <DarkFrame src="/image1.png" alt="Create a new project" />
            </div>
            <div className="w-full lg:w-[42%]">
              <p className="text-xs font-bold text-[#37A169] uppercase tracking-[0.18em] mb-3">Projects</p>
              <h2 className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-4 leading-tight">
                Create and organize projects in seconds
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-6">
                Spin up a new project from scratch in just a few clicks. Choose a workspace, set privacy, pick a color — and you're ready to go.
              </p>
              <ul className="space-y-3">
                {[
                  'Name, color-code, and categorize projects',
                  'Set public or private visibility per project',
                  'Organize across multiple workspaces',
                  'Group tasks into named sections',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-sm text-[#475569] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase 3: Team collaboration (image2 — dark) ── */}
      <section id="team" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="w-full lg:w-[58%]">
              <DarkFrame src="/image2.png" alt="Invite teammates" />
            </div>
            <div className="w-full lg:w-[42%]">
              <p className="text-xs font-bold text-[#6A67CE] uppercase tracking-[0.18em] mb-3">Team Collaboration</p>
              <h2 className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-4 leading-tight">
                Bring your whole team on board
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-6">
                Invite teammates by email in one click. Control exactly who sees what with role-based permissions and private project access.
              </p>
              <ul className="space-y-3">
                {[
                  'Invite teammates via email instantly',
                  'Assign roles: Admin, Member, or Guest',
                  'Add members to specific projects only',
                  'Private projects invisible to uninvited members',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-sm text-[#475569] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase 4: Task tracking (image4 — dark) ── */}
      <section className="py-20 lg:py-28 bg-[#F7F5F0]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
            <div className="w-full lg:w-[58%]">
              <DarkFrame src="/image4.png" alt="Detailed task tracking" />
            </div>
            <div className="w-full lg:w-[42%]">
              <p className="text-xs font-bold text-[#D69E2E] uppercase tracking-[0.18em] mb-3">Task Tracking</p>
              <h2 className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-4 leading-tight">
                Track every detail that matters
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-6">
                Go beyond just task names. Assign owners, set due dates, log time, mark billable work, and filter by any field — all in one table.
              </p>
              <ul className="space-y-3">
                {[
                  'Assign tasks to team members with avatars',
                  'Due dates and overdue highlighting',
                  'Estimated vs actual time tracking',
                  'Billable / Non-billable time marking',
                  'Custom columns and filter/sort/group',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-sm text-[#475569] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="bg-white border-y border-[#E5E0D8]">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { value: '10,000+', label: 'Tasks shipped' },
            { value: '500+',    label: 'Active teams' },
            { value: '99.9%',   label: 'Uptime' },
            { value: '< 50ms',  label: 'Real-time sync' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-[#1E293B]">{s.value}</p>
              <p className="text-xs text-[#94A3B8] mt-1.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 bg-[#F7F5F0]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-[#4F46E5] uppercase tracking-[0.18em] mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E293B] tracking-tight">Up and running in minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            {[
              { step: '01', title: 'Create a workspace', desc: 'Set up your team workspace in seconds. Name it, invite members, and you are ready to go.' },
              { step: '02', title: 'Build your board',   desc: "Add projects, create tasks, and organize them into stages that match your team's workflow." },
              { step: '03', title: 'Ship together',       desc: 'Assign tasks, track progress in real time, and celebrate wins — all without leaving Keystone.' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-6 border border-[#E5E0D8]">
                <div className="text-3xl font-black text-[#4F46E5]/25 mb-4">{s.step}</div>
                <h3 className="text-base font-bold text-[#1E293B] mb-2">{s.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="py-20 bg-white border-y border-[#E5E0D8]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <svg className="w-8 h-8 text-[#4F46E5]/25 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.748-9.57 8.983-10.609l.995 2.151c-2.51.886-3.995 3.235-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 8.983-10.609l.995 2.151c-2.51.886-3.995 3.235-3.995 5.849h4v10h-9.983z" />
          </svg>
          <p className="text-xl sm:text-2xl font-semibold text-[#1E293B] leading-relaxed mb-7">
            "Keystone replaced three tools for us — our task tracker, board tool, and status update meetings.
            The team actually knows what's happening now."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#4F46E5] flex items-center justify-center text-sm font-bold text-white">A</div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#1E293B]">Arjun Mehta</p>
              <p className="text-xs text-[#94A3B8]">Engineering Lead, Swiftly</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-[#1A2535] py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to bring your team together?
          </h2>
          <p className="text-white/50 text-lg mb-8 leading-relaxed">
            Join thousands of teams already using Keystone to move faster and stay aligned.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/register"
              className="inline-flex items-center gap-2.5 bg-[#4F46E5] hover:bg-[#3730A3] text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-[0_4px_20px_rgba(79,70,229,0.35)]">
              Get started — it's free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <Link to="/login" className="text-white/60 hover:text-white font-medium text-sm transition-colors">
              Already have an account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#F7F5F0] border-t border-[#E5E0D8] py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={28} className="rounded-lg" />
            <span className="font-bold text-[#1E293B] text-sm">Keystone</span>
            <span className="text-[#D8D3CB] mx-1">·</span>
            <span className="text-sm text-[#A09890]">Work, organized.</span>
          </div>
          <p className="text-xs text-[#A09890]">© {new Date().getFullYear()} Keystone. Built for teams that ship.</p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Contact'].map((item) => (
              <a key={item} href="#" className="text-xs text-[#A09890] hover:text-[#64748B] transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
