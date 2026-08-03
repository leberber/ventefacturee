import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PrevendeurService,
  DrilldownData,
  DrilldownFamille,
  DrilldownSousFamille,
  TopFdv,
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
  selectedSf: DrilldownSousFamille | null = null;
  selectedFdv: string | null = null;

  // Animated counter values
  displayValues: Record<string, number> = {};
  private _animInterval: ReturnType<typeof setInterval> | null = null;

  // Donut animation
  donutReady = false;
  donutAnimating = false;

  // Bar animation
  barsReady = false;

  // Donut tooltip
  hoveredSeg: number | null = null;
  tooltipX = 0;
  tooltipY = 0;

  readonly WEEK_LABELS = ['S1', 'S2', 'S3', 'S4'];
  readonly DONUT_R = 70;
  readonly DONUT_CIRC = 2 * Math.PI * 70;

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
    const prevSf      = keepSelection ? this.selectedSf?.nom ?? null      : null;

    if (!keepSelection) {
      this.selectedFamille = null;
      this.selectedSf = null;
    }

    this.svc.getDrilldown(this.selectedPeriode, this.selectedFdv).subscribe({
      next: d => {
        this.applyData(d);

        if (prevFamille) {
          this.selectedFamille = d.familles.find(f => f.nom === prevFamille) ?? null;
          if (this.selectedFamille && prevSf) {
            this.selectedSf = this.selectedFamille.sous_familles.find(sf => sf.nom === prevSf) ?? null;
          }
          if (this.selectedFamille) {
            this.triggerDonutAnimation();
          }
          if (this.selectedSf) {
            // In-place update: CSS transition moves bars to new widths
            this.barsReady = true;
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
    this.selectedSf = null;
    this.barsReady = false;
    if (this.selectedFamille) {
      this.triggerDonutAnimation();
    }
  }

  private triggerDonutAnimation() {
    this.donutReady = false;
    this.donutAnimating = false;
    requestAnimationFrame(() => {
      this.donutAnimating = true;
      requestAnimationFrame(() => { this.donutReady = true; });
    });
  }

  selectSf(sf: DrilldownSousFamille) {
    const wasNull = !this.selectedSf;
    this.selectedSf = this.selectedSf?.nom === sf.nom ? null : sf;
    if (this.selectedSf && wasNull) {
      // Bars newly appearing — animate from 0
      this.barsReady = false;
      requestAnimationFrame(() => { this.barsReady = true; });
    }
  }

  drillToRoot() { this.selectedFamille = null; this.selectedSf = null; }
  drillToFamille() { this.selectedSf = null; }

  // ── Donut tooltip ─────────────────────────────────────────────────────────
  onSegHover(i: number, event: MouseEvent) {
    this.hoveredSeg = i;
    const wrap = (event.target as Element).closest('.db-donut-wrap');
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      this.tooltipX = event.clientX - rect.left;
      this.tooltipY = event.clientY - rect.top;
    }
  }

  onSegLeave() { this.hoveredSeg = null; }

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

  // ── Leaderboard ───────────────────────────────────────────────────────────
  get leaderboardTitle(): string {
    return this.selectedFamille
      ? `${this.capitalize(this.selectedFamille.nom)} — Top vendeurs`
      : 'Top vendeurs';
  }

  get leaderboardItems(): TopFdv[] {
    return this.selectedFamille?.top_fdv ?? this.data?.top_fdv ?? [];
  }

  get leaderboardMax(): number {
    return this.leaderboardItems.reduce((m, x) => Math.max(m, x.total), 1);
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

  // ── Donut chart ───────────────────────────────────────────────────────────
  get donutSegments(): { nom: string; total: number; pct: number; offset: number; color: string }[] {
    const items = this.selectedFamille?.sous_familles ?? [];
    const total = items.reduce((s, sf) => s + sf.total, 0);
    let offset = 0;
    return items.map((sf, i) => {
      const pct = total > 0 ? sf.total / total : 0;
      const seg = { nom: sf.nom, total: sf.total, pct, offset, color: CHART_COLORS[i % CHART_COLORS.length] };
      offset += pct;
      return seg;
    });
  }

  donutDasharray(pct: number): string {
    return `${pct * this.DONUT_CIRC} ${this.DONUT_CIRC}`;
  }

  donutDashoffset(offset: number): string {
    return `${-(offset * this.DONUT_CIRC)}`;
  }

  // ── Bar chart (products) ──────────────────────────────────────────────────
  get barItems(): { nom: string; total: number; pct: number; color: string }[] {
    const items = this.selectedSf?.produits ?? [];
    const max = items.reduce((m, p) => Math.max(m, p.total), 1);
    return items.map((p, i) => ({
      nom: p.nom,
      total: p.total,
      pct: max > 0 ? (p.total / max) * 100 : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }

  readonly skeletonRows = Array(3).fill(0);
}
