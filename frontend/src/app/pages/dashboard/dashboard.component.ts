import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PrevendeurService,
  DrilldownData,
  DrilldownFamille,
  DrilldownSousFamille,
  DrilldownProduit,
} from '../../core/services/prevendeur.service';
import { getFamilyColor, getFamilyBg, CHART_COLORS } from '../../core/constants/colors';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
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
  selectedFdv: string | null = null;

  // Animated counter values
  displayValues: Record<string, number> = {};
  private _animInterval: ReturnType<typeof setInterval> | null = null;

  // Bar animation (sf bars + product bars)
  barsReady = false;

  readonly WEEK_LABELS = ['S1', 'S2', 'S3', 'S4'];

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
    this.svc.getDrilldown(guess, this.selectedFdv).subscribe({
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
  }

  load(keepSelection = false) {
    const prevFamille = keepSelection ? this.selectedFamille?.nom ?? null : null;

    if (!keepSelection) {
      this.selectedFamille = null;
    }
    this.selectedProduct = null;

    this.svc.getDrilldown(this.selectedPeriode, this.selectedFdv).subscribe({
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
    this.load(true); // preserve famille/sf selection
  }

  selectFamille(f: DrilldownFamille) {
    this.selectedFamille = this.selectedFamille?.nom === f.nom ? null : f;
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

  // ── Family colour helpers ─────────────────────────────────────────────────
  familyColor(nom: string): string { return getFamilyColor(nom); }
  familyBg(nom: string):    string { return getFamilyBg(nom); }

  // ── Prevendeur total (for "Tous" pill) ───────────────────────────────────
  get totalAll(): number {
    return this.data?.prevendeurs.reduce((s, p) => s + p.total, 0) ?? 0;
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
    const all = this.data?.prevendeurs ?? [];
    return [...all].sort((a, b) => b.total - a.total);
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

  readonly skeletonRows = Array(3).fill(0);
}
