import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrevendeurService } from '../../core/services/prevendeur.service';
import { ObjectifsBaseComponent, BaseRow, FamGroupe } from '../../core/base/objectifs-base';
import { PeriodStepperComponent } from '../../shared/period-stepper/period-stepper.component';

interface ObjectifRow extends BaseRow {
  objectif_tonne_vd:          number | null;
  objectif_packs_vd:          number | null;
  objectif_packs_vd_tournee:  number | null;
  objectif_tonne_vh:          number | null;
  objectif_packs_vh:          number | null;
  objectif_packs_vh_tournee:  number | null;
  _tonne:        number | null;
  _packs:        number | null;
  _packs_tournee: number | null;
}

@Component({
  selector: 'app-objectifs-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodStepperComponent],
  templateUrl: './objectifs-admin.component.html',
  styleUrl: './objectifs-admin.component.scss',
})
export class ObjectifsAdminComponent extends ObjectifsBaseComponent<ObjectifRow> {
  private prevSvc = inject(PrevendeurService);

  canal: 'VD' | 'VH' = 'VD';
  importCanal: 'VD' | 'VH' = 'VD';
  routesVD = 0;
  routesVH = 0;
  routesFallbackMois: string | null = null;

  private snapshot = new Map<string, { tonne: number | null; packs: number | null; packs_tournee: number | null }>();

  protected override get nextMissingUrl(): string {
    return '/api/v1/objectifs/next-missing';
  }

  protected override onFileSelectedHook(): void {
    this.importCanal = this.canal;
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  load(): void {
    if (this.editMode) return;
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs?mois=${this.mois}&annee=${this.annee}`).subscribe({
      next: data => {
        this.rows     = data.map(d => ({ ...d, _tonne: null, _packs: null, _packs_tournee: null }));
        this.hasGoals = data.some(d =>
          d.objectif_tonne_vd != null || d.objectif_packs_vd != null ||
          d.objectif_tonne_vh != null || d.objectif_packs_vh != null
        );
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.http.get<{ vd: number; vh: number; fallback_mois: string | null }>(
      `/api/v1/objectifs/routes-count?mois=${this.mois}&annee=${this.annee}`
    ).subscribe({
      next: d => { this.routesVD = d.vd; this.routesVH = d.vh; this.routesFallbackMois = d.fallback_mois; },
      error: () => { this.routesVD = 0; this.routesVH = 0; this.routesFallbackMois = null; },
    });
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────────
  enterEditMode(): void {
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: null, _packs: null, _packs_tournee: null }));
        this.snapshot.clear();
        for (const r of this.rows) {
          const tonne        = this.canal === 'VD' ? r.objectif_tonne_vd         : r.objectif_tonne_vh;
          const packs        = this.canal === 'VD' ? r.objectif_packs_vd         : r.objectif_packs_vh;
          const packs_tournee = this.canal === 'VD' ? r.objectif_packs_vd_tournee : r.objectif_packs_vh_tournee;
          this.snapshot.set(r.code_produit, { tonne, packs, packs_tournee });
          r._tonne = tonne; r._packs = packs; r._packs_tournee = packs_tournee;
        }
        this.loading  = false;
        this.editMode = true;
      },
      error: () => { this.loading = false; },
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  confirmSave(): void {
    this.showConfirm = false;
    this.isSaving    = true;
    const body = this.rows.map(r => ({
      code_produit:              r.code_produit,
      objectif_tonne_vd:         this.canal === 'VD' ? r._tonne         : r.objectif_tonne_vd,
      objectif_packs_vd:         this.canal === 'VD' ? r._packs         : r.objectif_packs_vd,
      objectif_packs_vd_tournee: this.canal === 'VD' ? r._packs_tournee : r.objectif_packs_vd_tournee,
      objectif_tonne_vh:         this.canal === 'VH' ? r._tonne         : r.objectif_tonne_vh,
      objectif_packs_vh:         this.canal === 'VH' ? r._packs         : r.objectif_packs_vh,
      objectif_packs_vh_tournee: this.canal === 'VH' ? r._packs_tournee : r.objectif_packs_vh_tournee,
    }));
    this.http.post(`/api/v1/objectifs/batch?mois=${this.mois}&annee=${this.annee}`, body).subscribe({
      next: () => {
        this.isSaving = false;
        this.editMode = false;
        this.prevSvc.clearDrilldownCache();
        this.load();
        this.loadNextMissing();
      },
      error: () => { this.isSaving = false; },
    });
  }

  // ── Excel import ──────────────────────────────────────────────────────────────
  confirmImport(): void {
    if (!this.importFile) return;
    this.isImporting = true;
    const fd = new FormData();
    fd.append('file', this.importFile);

    type ImportRow = { code_produit: string | null; nom_produit?: string; tonne: number | null; packs: number | null; packs_tournee: number | null };

    const applyImport = (data: ImportRow[]) => {
      if (this.importCanal !== this.canal) {
        this.canal = this.importCanal;
        for (const r of this.rows) {
          r._tonne         = this.canal === 'VD' ? r.objectif_tonne_vd         : r.objectif_tonne_vh;
          r._packs         = this.canal === 'VD' ? r.objectif_packs_vd         : r.objectif_packs_vh;
          r._packs_tournee = this.canal === 'VD' ? r.objectif_packs_vd_tournee : r.objectif_packs_vh_tournee;
        }
      }
      let imported = 0;
      const notFound: string[] = [];
      for (const item of data) {
        const row = item.code_produit
          ? this.rows.find(r => r.code_produit === item.code_produit)
          : this.rows.find(r => r.nom_produit.trim().toLowerCase() === (item.nom_produit ?? '').trim().toLowerCase());
        if (row) {
          row._tonne         = item.tonne ?? null;
          row._packs         = item.packs != null ? Math.round(item.packs) : null;
          row._packs_tournee = item.packs_tournee != null
            ? Math.round(item.packs_tournee)
            : (item.packs != null && this.routeCount > 0 ? Math.round(item.packs / this.routeCount) : null);
          imported++;
        } else {
          notFound.push(item.code_produit ?? item.nom_produit ?? '?');
        }
      }
      this.showImportDialog   = false;
      this.isImporting        = false;
      this.importFile         = null;
      this.importResult       = { imported, notFound };
      this.showNotFoundDetail = false;
    };

    const monthChanged = this.importMois !== this.mois || this.importAnnee !== this.annee;

    this.http.post<ImportRow[]>('/api/v1/objectifs/parse-excel', fd).subscribe({
      next: data => {
        if (monthChanged) {
          this.mois  = this.importMois;
          this.annee = this.importAnnee;
          this.http.get<any[]>(`/api/v1/objectifs?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
            next: rows => {
              this.rows = rows.map(d => ({ ...d, _packs: null, _packs_tournee: null }));
              this.snapshot.clear();
              for (const r of this.rows) {
                const t  = this.importCanal === 'VD' ? r.objectif_tonne_vd         : r.objectif_tonne_vh;
                const p  = this.importCanal === 'VD' ? r.objectif_packs_vd         : r.objectif_packs_vh;
                const pt = this.importCanal === 'VD' ? r.objectif_packs_vd_tournee : r.objectif_packs_vh_tournee;
                this.snapshot.set(r.code_produit, { tonne: t, packs: p, packs_tournee: pt });
                r._tonne = t; r._packs = p; r._packs_tournee = pt;
              }
              applyImport(data);
            },
            error: () => { this.isImporting = false; },
          });
        } else {
          applyImport(data);
        }
      },
      error: () => { this.isImporting = false; },
    });
  }

  // ── Copy from previous ────────────────────────────────────────────────────────
  copyFromPrevious(): void {
    let pm = this.mois - 1, pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    this.http.get<any[]>(`/api/v1/objectifs?mois=${pm}&annee=${pa}`).subscribe({
      next: data => {
        const map = new Map(data.map((d: any) => [d.code_produit, d]));
        for (const r of this.rows) {
          const prev = map.get(r.code_produit) as any;
          if (prev) {
            r._tonne         = this.canal === 'VD' ? prev.objectif_tonne_vd         : prev.objectif_tonne_vh;
            r._packs         = this.canal === 'VD' ? prev.objectif_packs_vd         : prev.objectif_packs_vh;
            r._packs_tournee = this.canal === 'VD' ? prev.objectif_packs_vd_tournee : prev.objectif_packs_vh_tournee;
          }
        }
      },
    });
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  isDirtyRow(r: ObjectifRow): boolean {
    const snap = this.snapshot.get(r.code_produit);
    return r._tonne !== (snap?.tonne ?? null) ||
           r._packs !== (snap?.packs ?? null) ||
           r._packs_tournee !== (snap?.packs_tournee ?? null);
  }

  get dirtyCount(): number {
    return this.rows.filter(r => this.isDirtyRow(r)).length;
  }

  // ── Sorting ───────────────────────────────────────────────────────────────────
  readonly FLAT_SORT_COLS = new Set(['tonne', 'tonne_route', 'packs', 'packs_route']);

  get isFlatSort(): boolean { return this.FLAT_SORT_COLS.has(this.sortCol); }

  resetSort(): void { this.sortCol = ''; this.sortDir = 1; }

  get sortedRows(): ObjectifRow[] {
    if (!this.sortCol) return this.rows;
    const dir = this.sortDir;
    const col = this.sortCol;
    const tonne  = (r: ObjectifRow) => this.editMode ? r._tonne  : (this.canal === 'VD' ? r.objectif_tonne_vd  : r.objectif_tonne_vh);
    const packs  = (r: ObjectifRow) => this.editMode ? r._packs  : (this.canal === 'VD' ? r.objectif_packs_vd  : r.objectif_packs_vh);
    const packsT = (r: ObjectifRow) => this.editMode ? r._packs_tournee : (this.canal === 'VD' ? r.objectif_packs_vd_tournee : r.objectif_packs_vh_tournee);
    return [...this.rows].sort((a, b) => {
      let va: any, vb: any;
      switch (col) {
        case 'famille':     va = a.famille;      vb = b.famille;      break;
        case 'code':        va = a.code_produit; vb = b.code_produit; break;
        case 'produit':     va = a.nom_produit;  vb = b.nom_produit;  break;
        case 'tonne':       va = tonne(a);       vb = tonne(b);       break;
        case 'tonne_route': va = this.routeCount ? (tonne(a) ?? 0) / this.routeCount : 0;
                            vb = this.routeCount ? (tonne(b) ?? 0) / this.routeCount : 0; break;
        case 'packs':       va = packs(a);       vb = packs(b);       break;
        case 'packs_route': va = packsT(a);      vb = packsT(b);      break;
        case 'updated_by':  va = a.updated_by;   vb = b.updated_by;   break;
        case 'updated_at':  va = a.updated_at;   vb = b.updated_at;   break;
        default: return 0;
      }
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
    });
  }

  // ── Per-route helpers ─────────────────────────────────────────────────────────
  get routeCount(): number { return this.canal === 'VD' ? this.routesVD : this.routesVH; }

  perRouteTonne(val: number | null): string {
    if (val == null || this.routeCount === 0) return '—';
    return (val / this.routeCount).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  perRoute(val: number | null): string {
    if (val == null) return '—';
    return val.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  // ── Aggregates ────────────────────────────────────────────────────────────────
  private rowTonne(r: ObjectifRow): number | null {
    return this.editMode ? r._tonne : (this.canal === 'VD' ? r.objectif_tonne_vd : r.objectif_tonne_vh);
  }

  private rowPacks(r: ObjectifRow): number | null {
    return this.editMode ? r._packs : (this.canal === 'VD' ? r.objectif_packs_vd : r.objectif_packs_vh);
  }

  private rowPacksTournee(r: ObjectifRow): number | null {
    return this.editMode ? r._packs_tournee : (this.canal === 'VD' ? r.objectif_packs_vd_tournee : r.objectif_packs_vh_tournee);
  }

  sumTonne(rows: ObjectifRow[]): number | null {
    const vals = rows.map(r => this.rowTonne(r)).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  sumPacks(rows: ObjectifRow[]): number | null {
    const vals = rows.map(r => this.rowPacks(r)).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  sumPacksTournee(rows: ObjectifRow[]): number | null {
    const vals = rows.map(r => this.rowPacksTournee(r)).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  get filledProducts(): number {
    return this.rows.filter(r =>
      (this.canal === 'VD' ? r.objectif_packs_vd : r.objectif_packs_vh) != null
    ).length;
  }

  get totalProducts(): number { return this.rows.length; }

  get canalLabel(): string { return this.canal === 'VD' ? 'Direct (VD)' : 'Horeca (VH)'; }
}
