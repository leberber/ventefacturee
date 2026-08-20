import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';

import { D3AreaComponent, type AreaPoint } from './d3-area.component';
import { D3HbarComponent, type HBarItem } from './d3-hbar.component';
import { CommuneMapComponent, type CommuneDatum } from './commune-map.component';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  kpis: {
    total_ventes: number;
    nb_fdvs: number;
    top_famille: { nom: string; total: number } | null;
    top_fdv: { nom: string; code: string; total: number } | null;
  };
  monthly:     { month: string; total: number; nb_fdvs: number }[];
  by_famille:  { famille: string; total: number }[];
  by_produit:  { nom: string; code: string; total: number }[];
  by_fdv:      { nom: string; code: string; total: number }[];
  by_location: { code: number; name: string; total: number }[];
  familles:    string[];
  periodes:    string[];
}

type Canal = 'VD' | 'VH';
type Unite = 'packs' | 'tonnes';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [DecimalPipe, D3AreaComponent, D3HbarComponent, CommuneMapComponent],
  templateUrl: './analytics.component.html',
  styleUrl:    './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  readonly data        = signal<AnalyticsData | null>(null);
  readonly loading     = signal(true);
  readonly mapData     = signal<CommuneDatum[]>([]);
  readonly fdvBarData  = signal<HBarItem[]>([]);
  readonly prodBarData = signal<HBarItem[]>([]);

  displayKpis = { total_ventes: 0, nb_fdvs: 0 };
  private _animInterval: ReturnType<typeof setInterval> | null = null;

  readonly periode  = signal('');
  readonly famille  = signal('');
  readonly commune  = signal<{ code: number; name: string } | null>(null);
  readonly fdv      = signal<{ nom: string; code: string } | null>(null);
  readonly canal    = signal<Canal>('VD');
  readonly unite    = signal<Unite>('packs');
  readonly familles = signal<string[]>([]);
  readonly periodes = signal<string[]>([]);

  readonly canals: { value: Canal; label: string }[] = [
    { value: 'VD', label: 'VD' },
    { value: 'VH', label: 'VH' },
  ];

  readonly unites: { value: Unite; label: string }[] = [
    { value: 'packs',  label: 'Packs'  },
    { value: 'tonnes', label: 'Tonnes' },
  ];

  // ── Derived ────────────────────────────────────────────────────────────────
  readonly areaData = computed<AreaPoint[]>(() => {
    const d = this.data();
    if (!d?.monthly.length) return [];
    return d.monthly.map(m => {
      const dt = new Date(m.month + '-01T00:00:00');
      return {
        label: dt.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        v1: m.total,
        v2: m.nb_fdvs,
      };
    });
  });

  readonly familleBarItems = computed<HBarItem[]>(() =>
    (this.data()?.by_famille ?? []).map(f => ({ name: f.famille, value: f.total }))
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const now = new Date();
    const guess = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.periode.set(guess);
    this.load();
  }

  ngOnDestroy(): void {
    if (this._animInterval) clearInterval(this._animInterval);
  }

  private animateKpis(to: { total_ventes: number; nb_fdvs: number }): void {
    if (this._animInterval) clearInterval(this._animInterval);
    const from = { ...this.displayKpis };
    const totalFrames = Math.round(0.9 * 60);
    let frame = 0;
    this._animInterval = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      this.displayKpis.total_ventes = Math.round(from.total_ventes + (to.total_ventes - from.total_ventes) * ease);
      this.displayKpis.nb_fdvs      = Math.round(from.nb_fdvs      + (to.nb_fdvs      - from.nb_fdvs)      * ease);
      if (progress >= 1) { clearInterval(this._animInterval!); this._animInterval = null; }
    }, 1000 / 60);
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  setPeriode(p: string): void { this.periode.set(p); this.load(); }

  setFamille(f: string): void { this.famille.set(f); this.load(); }

  setFdv(item: HBarItem | null): void {
    if (!item) { this.fdv.set(null); }
    else {
      const match = this.data()?.by_fdv.find(x => x.nom === item.name) ?? null;
      this.fdv.set(match ? { nom: match.nom, code: match.code } : null);
    }
    this.load();
  }

  setCanal(c: Canal): void {
    if (this.canal() === c) return;
    this.canal.set(c);
    this.fdv.set(null);
    this.commune.set(null);
    this.load();
  }

  setUnite(u: Unite): void {
    if (this.unite() === u) return;
    this.unite.set(u);
    this.load();
  }

  setCommune(evt: { code: number; name: string } | null): void {
    this.commune.set(evt);
    this.load();
  }

  clearFdv(): void { this.fdv.set(null); this.load(); }
  clearFamille(): void { this.famille.set(''); this.load(); }
  clearCommune(): void { this.commune.set(null); this.load(); }

  // ── Load ───────────────────────────────────────────────────────────────────
  private load(): void {
    this.loading.set(true);
    let params = new HttpParams().set('annee_mois', this.periode()).set('canal', this.canal()).set('unite', this.unite());
    if (this.famille()) params = params.set('famille', this.famille());
    if (this.fdv())     params = params.set('fdv', this.fdv()!.code);
    if (this.commune()) params = params.set('commune', this.commune()!.name);

    this.http.get<AnalyticsData>('/api/v1/prevendeur/admin/analytics', { params }).subscribe({
      next: d => {
        this.data.set(d);
        this.animateKpis({ total_ventes: d.kpis.total_ventes, nb_fdvs: d.kpis.nb_fdvs });

        if (!this.fdv()) {
          this.fdvBarData.set(d.by_fdv.map((x, i) => ({ id: i, name: x.nom, value: x.total })));
        }
        this.prodBarData.set(d.by_produit.map((x, i) => ({ id: i, name: x.nom, value: x.total })));
        this.mapData.set(d.by_location.map(r => ({ code: r.code, total: r.total })));

        if (d.familles.length) this.familles.set(d.familles);
        if (d.periodes.length) {
          this.periodes.set(d.periodes);
          if (!d.periodes.includes(this.periode())) {
            this.periode.set(d.periodes[0]);
          }
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get uniteLabel(): string {
    return this.unite() === 'tonnes' ? 'tonnes' : 'packs';
  }

  formatPeriode(p: string): string {
    if (!p) return '';
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
}
