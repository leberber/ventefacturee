import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import {
  PrevendeurService,
  DrilldownData,
  DrilldownFamille,
  DrilldownSousFamille,
  DrilldownProduit,
  FdvItem,
} from '../../core/services/prevendeur.service';
import { getFamilyColor, getFamilyBg, CHART_COLORS } from '../../core/constants/colors';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private svc = inject(PrevendeurService);

  loading = true;
  data: DrilldownData | null = null;
  selectedPeriode = '';
  selectedFamille: DrilldownFamille | null = null;
  selectedProduct: DrilldownProduit | null = null;
  collapsedSfs = new Set<string>();
  collapsedOverviewFamilles = new Set<string>();
  selectedFdv: string | null = null;
  selectedCanal: 'VD' | 'VH' = 'VD';

  // Pre-computed lists (updated in applyData to avoid re-sorting on every CD cycle)
  overviewFamilles: DrilldownFamille[] = [];
  fdvPerfSorted: FdvItem[] = [];

  // Animated counter values
  displayValues: Record<string, number> = {};
  private _animInterval: ReturnType<typeof setInterval> | null = null;

  // Bar animation (sf bars + product bars)
  barsReady = false;
  compactCards = false;

  // Pill hover tooltip
  hoveredFdv: string | null = null;
  hoveredFdvRates: { nom: string; sf: string; sold: number; obj: number; pct: number }[] = [];
  tooltipTop = 0;

  readonly WEEK_LABELS = ['S1', 'S2', 'S3', 'S4'];
  readonly Math = Math;

  ngOnInit() {
    this.loadInitial();
  }

  ngOnDestroy() {
    if (this._animInterval) clearInterval(this._animInterval);
  }

  private loadInitial() {
    this.loading = true;
    const now = new Date();
    const guess = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.selectedPeriode = guess;
    this.svc.getDrilldown(guess, this.selectedFdv, this.canal).subscribe({
      next: d => {
        if (d.periodes.length && !d.periodes.includes(guess)) {
          this.selectedPeriode = d.periodes[0];
          this.load();
        } else {
          this.applyData(d);
        }
      },
      error: () => { this.loading = false; },
    });
  }

  private applyData(d: DrilldownData) {
    const prev: Record<string, number> = {};
    for (const f of d.familles) prev[f.nom] = this.displayValues[f.nom] ?? 0;
    this.displayValues = prev;
    this.data = d;
    this.loading = false;
    this.animateCounters(d.familles);
    this.fdvPerfSorted = [...d.prevendeurs].sort((a, b) => b.total - a.total);
    this.overviewFamilles = [...d.familles]
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map(f => ({ ...f, sous_familles: [...f.sous_familles].sort((a, b) => a.nom.localeCompare(b.nom)) }));
    if (this.selectedFdv) this.initOverviewCollapse(d.familles);

    // Capture global totals only when no FDV filter is active
    if (!this.selectedFdv) {
      this._globalTotal = d.prevendeurs.reduce((s, p) => s + p.total, 0);
      this._globalObjectif = d.familles.reduce((s, f) => s + (f.objectif_packs ?? 0), 0);
    }
  }

  private initOverviewCollapse(familles: DrilldownFamille[]) {
    const sorted = [...familles].sort((a, b) => a.nom.localeCompare(b.nom));
    this.collapsedOverviewFamilles = new Set(sorted.slice(1).map(f => f.nom));
    this.collapsedSfs = new Set();
    this.barsReady = false;
    requestAnimationFrame(() => { this.barsReady = true; });
  }

  toggleOverviewFamille(nom: string) {
    if (this.collapsedOverviewFamilles.has(nom)) {
      this.collapsedOverviewFamilles.delete(nom);
      this.barsReady = false;
      requestAnimationFrame(() => { this.barsReady = true; });
    } else {
      this.collapsedOverviewFamilles.add(nom);
    }
  }

  get selectedFdvName(): string {
    return this.data?.prevendeurs.find(p => p.code === this.selectedFdv)?.nom ?? this.selectedFdv ?? '';
  }

  load(keepSelection = false) {
    const prevFamille = keepSelection ? this.selectedFamille?.nom ?? null : null;

    if (!keepSelection) {
      this.selectedFamille = null;
    }
    this.selectedProduct = null;

    this.svc.getDrilldown(this.selectedPeriode, this.selectedFdv, this.canal).subscribe({
      next: d => {
        this.applyData(d);

        if (prevFamille) {
          this.selectedFamille = d.familles.find(f => f.nom === prevFamille) ?? null;
          if (this.selectedFamille) {
            this.barsReady = false;
            requestAnimationFrame(() => { this.barsReady = true; });
          }
        }
      },
      error: () => { this.loading = false; },
    });
  }

  private animateCounters(familles: DrilldownFamille[]) {
    if (this._animInterval) clearInterval(this._animInterval);
    const duration = 900;
    const fps = 60;
    const totalFrames = Math.round((duration / 1000) * fps);
    let frame = 0;
    const targets = familles.map(f => ({ nom: f.nom, from: this.displayValues[f.nom] ?? 0, to: f.total }));

    this._animInterval = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      for (const t of targets) {
        this.displayValues[t.nom] = Math.round(t.from + (t.to - t.from) * ease);
      }
      if (progress >= 1 && this._animInterval) {
        clearInterval(this._animInterval);
        this._animInterval = null;
      }
    }, 1000 / fps);
  }

  prevPeriod() {
    if (!this.data) return;
    const i = this.data.periodes.indexOf(this.selectedPeriode);
    if (i < this.data.periodes.length - 1) {
      this.selectedPeriode = this.data.periodes[i + 1];
      this.load();
    }
  }

  nextPeriod() {
    if (!this.data) return;
    const i = this.data.periodes.indexOf(this.selectedPeriode);
    if (i > 0) {
      this.selectedPeriode = this.data.periodes[i - 1];
      this.load();
    }
  }

  get canGoPrev(): boolean {
    if (!this.data) return false;
    return this.data.periodes.indexOf(this.selectedPeriode) < this.data.periodes.length - 1;
  }
  get canGoNext(): boolean {
    if (!this.data) return false;
    return this.data.periodes.indexOf(this.selectedPeriode) > 0;
  }

  selectFdv(code: string | null) {
    this.selectedFdv = this.selectedFdv === code ? null : code;
    this.compactCards = false;
    this.load(true);
  }

  get canal(): string {
    return this.selectedCanal;
  }

  setCanal(c: 'VD' | 'VH') {
    if (this.selectedCanal === c) return;
    this.selectedCanal = c;
    this.selectedFdv = null;
    this.load(true); // preserve famille selection
  }

  selectFamille(f: DrilldownFamille) {
    this.selectedFamille = this.selectedFamille?.nom === f.nom ? null : f;
    this.compactCards = !!this.selectedFamille;
    this.selectedProduct = null;
    this.collapsedSfs = new Set();
    this.barsReady = false;
    if (this.selectedFamille) {
      requestAnimationFrame(() => { this.barsReady = true; });
    }
  }

  selectProduct(p: DrilldownProduit) {
    this.selectedProduct = this.selectedProduct === p ? null : p;
  }

  toggleSfCollapse(nom: string) {
    if (this.collapsedSfs.has(nom)) {
      this.collapsedSfs.delete(nom);
      this.barsReady = false;
      requestAnimationFrame(() => { this.barsReady = true; });
    } else {
      this.collapsedSfs.add(nom);
    }
  }

  drillToRoot() {
    this.selectedFamille = null;
    this.selectedProduct = null;
    this.collapsedSfs = new Set();
    this.barsReady = false;
  }

  // ── Formatters ────────────────────────────────────────────────────────────
  formatPeriod(p: string): string {
    if (!p) return '';
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  formatNum(n: number | undefined | null): string {
    if (n == null) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return String(Math.round(n));
  }

  formatDelta(delta: number | null): string {
    if (delta === null) return '';
    return `${delta > 0 ? '+' : ''}${delta}%`;
  }

  capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  // ── Route code (strip agency prefix e.g. "1501-VD201" → "VD201") ─────────
  routeCode(code: string): string {
    const parts = code.split('-');
    return parts.length > 1 ? parts.slice(1).join('-') : code;
  }

  // ── Family colour helpers ─────────────────────────────────────────────────
  familyColor(nom: string): string { return getFamilyColor(nom); }
  familyBg(nom: string):    string { return getFamilyBg(nom); }

  // ── Objective helpers ─────────────────────────────────────────────────────
  objPct(f: DrilldownFamille): number {
    if (!f.objectif_packs) return 0;
    return Math.min(Math.round((f.total / f.objectif_packs) * 100), 999);
  }

  sfObjPct(sf: { total: number; objectif_packs: number | null }): number {
    if (!sf.objectif_packs) return 0;
    return Math.min(Math.round((sf.total / sf.objectif_packs) * 100), 999);
  }

  prodObjPct(p: { total: number; objectif_packs: number | null }): number {
    if (!p.objectif_packs) return 0;
    return Math.min(Math.round((p.total / p.objectif_packs) * 100), 999);
  }

  prodObjColor(p: { total: number; objectif_packs: number | null }): string {
    const pct = this.prodObjPct(p);
    if (pct >= 90) return 'var(--color-success)';
    if (pct >= 70) return 'var(--color-warning)';
    if (pct >= 50) return '#f97316';
    return 'var(--color-error)';
  }

  fdvObjPct(item: { total: number }, obj: number): number {
    return Math.min(Math.round((item.total / obj) * 100), 999);
  }

  pvObjPct(pv: FdvItem): number {
    return pv.achievement_pct ?? 0;
  }

  pvSimplePct(pv: FdvItem): number {
    const obj = this.data?.objectif_packs_per_route;
    if (!obj) return 0;
    return Math.min(Math.round((pv.total / obj) * 100), 999);
  }

  pvObjClass(pv: FdvItem): string {
    const pct = this.pvSimplePct(pv);
    if (pct >= 90) return 'pv-obj--green';
    if (pct >= 70) return 'pv-obj--amber';
    if (pct >= 50) return 'pv-obj--orange';
    return 'pv-obj--red';
  }

  // ── Medal rank (0=gold, 1=silver, 2=bronze, -1=none) ─────────────────────
  fdvRank(code: string): number {
    const i = this.fdvPerfSorted.findIndex(p => p.code === code);
    return i < 3 ? i : -1;
  }

  // ── Pill click tooltip ────────────────────────────────────────────────────
  togglePillTooltip(ev: MouseEvent, code: string) {
    ev.stopPropagation();
    if (this.hoveredFdv === code) { this.hoveredFdv = null; return; }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const maxH = window.innerHeight * 0.72;
    this.tooltipTop = rect.bottom + 8 + maxH > window.innerHeight
      ? Math.max(rect.top - maxH - 8, 8)
      : rect.bottom + 8;
    this.hoveredFdv = code;
    this.hoveredFdvRates = this.buildFdvRates(code);
  }

  @HostListener('document:click')
  closePillTooltip() { this.hoveredFdv = null; }

  private buildFdvRates(code: string): { nom: string; sf: string; sold: number; obj: number; pct: number }[] {
    const result: { nom: string; sf: string; sold: number; obj: number; pct: number }[] = [];
    for (const f of this.data?.familles ?? []) {
      for (const sf of f.sous_familles) {
        for (const p of sf.produits) {
          if (!p.objectif_packs_tournee) continue;
          const sold = p.top_fdv.find(x => x.code === code)?.total ?? 0;
          const pct = Math.min(Math.round(sold / p.objectif_packs_tournee * 100), 100);
          result.push({ nom: p.nom, sf: sf.nom, sold, obj: p.objectif_packs_tournee, pct });
        }
      }
    }
    return result.sort((a, b) => a.pct - b.pct);
  }

  get hoveredFdvName(): string {
    return this.data?.prevendeurs.find(p => p.code === this.hoveredFdv)?.nom ?? this.hoveredFdv ?? '';
  }

  get hoveredFdvTotalPct(): number {
    if (!this.hoveredFdvRates.length) return 0;
    return Math.round(this.hoveredFdvRates.reduce((s, r) => s + r.pct, 0) / this.hoveredFdvRates.length);
  }

  rateColor(pct: number): string {
    if (pct >= 90) return 'var(--color-success)';
    if (pct >= 70) return 'var(--color-warning)';
    if (pct >= 50) return '#f97316';
    return 'var(--color-error)';
  }


  // ── Global totals — fixed at page load, not reactive to FDV selection ────
  private _globalTotal = 0;
  private _globalObjectif = 0;

  get totalAll(): number { return this._globalTotal; }
  get totalObjectif(): number { return this._globalObjectif; }

  get totalObjPct(): number {
    if (!this._globalObjectif) return 0;
    return Math.min(Math.round((this._globalTotal / this._globalObjectif) * 100), 999);
  }

  get totalObjClass(): string {
    const pct = this.totalObjPct;
    if (pct >= 90) return 'pv-obj--green';
    if (pct >= 70) return 'pv-obj--amber';
    if (pct >= 50) return 'pv-obj--orange';
    return 'pv-obj--red';
  }

  // ── FDV performance panel ─────────────────────────────────────────────────
  get fdvPerfTitle(): string {
    if (this.selectedProduct) return `${this.selectedProduct.nom} — Prévendeurs`;
    if (this.selectedFamille) return `${this.capitalize(this.selectedFamille.nom)} — Prévendeurs`;
    return 'Performance prévendeurs';
  }

  get fdvPerfItems(): { code: string; nom: string; total: number }[] {
    if (this.selectedProduct) return this.selectedProduct.top_fdv;
    if (this.selectedFamille) return this.selectedFamille.top_fdv;
    return this.fdvPerfSorted;
  }

  get fdvPerfMax(): number {
    return this.fdvPerfItems.reduce((m, x) => Math.max(m, x.total), 1);
  }

  get fdvPerfTotal(): number {
    return this.fdvPerfItems.reduce((s, x) => s + x.total, 0);
  }

  fdvSharePct(item: { total: number }): string {
    if (!this.fdvPerfTotal) return '0%';
    return `${Math.round((item.total / this.fdvPerfTotal) * 100)}%`;
  }

  // ── Tree helpers (left panel) ─────────────────────────────────────────────
  prodPct(p: DrilldownProduit, sf: DrilldownSousFamille): number {
    const max = sf.produits.reduce((m, x) => Math.max(m, x.total), 1);
    return (p.total / max) * 100;
  }

  prodColor(i: number): string {
    return CHART_COLORS[i % CHART_COLORS.length];
  }

  // ── SVG helpers ───────────────────────────────────────────────────────────
  private svgPoints(weeks: number[], w: number, h: number, pad = 12) {
    if (weeks.length === 0) return [];
    if (weeks.length === 1) return [{ x: w / 2, y: h / 2 }];
    const max = Math.max(...weeks, 1);
    const usableH = h - pad;
    const step = w / (weeks.length - 1);
    return weeks.map((v, i) => ({ x: i * step, y: h - (v / max) * usableH }));
  }

  areaPath(weeks: number[], w: number, h: number): string {
    const pts = this.svgPoints(weeks, w, h);
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y} L${w},${h} L0,${h} Z`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    return `${d} L${w},${h} L0,${h} Z`;
  }

  linePath(weeks: number[], w: number, h: number): string {
    const pts = this.svgPoints(weeks, w, h);
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    return d;
  }

  readonly skeletonRows = Array(5).fill(0);
}
