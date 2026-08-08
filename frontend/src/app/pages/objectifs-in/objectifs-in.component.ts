import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObjectifsBaseComponent, BaseRow, FamGroupe } from '../../core/base/objectifs-base';
import { PeriodStepperComponent } from '../../shared/period-stepper/period-stepper.component';

interface ObjectifInRow extends BaseRow {
  objectif_tonne: number | null;
  _tonne: number | null;
}

@Component({
  selector: 'app-objectifs-in',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodStepperComponent],
  templateUrl: './objectifs-in.component.html',
  styleUrl: './objectifs-in.component.scss',
})
export class ObjectifsInComponent extends ObjectifsBaseComponent<ObjectifInRow> {
  private snapshot = new Map<string, number | null>();

  protected override get nextMissingUrl(): string {
    return '/api/v1/objectifs-in/next-missing';
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  load(): void {
    if (this.editMode) return;
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${this.mois}&annee=${this.annee}`).subscribe({
      next: data => {
        this.rows    = data.map(d => ({ ...d, _tonne: null }));
        this.hasGoals = data.some(d => d.objectif_tonne != null);
        this.loading  = false;
      },
      error: () => { this.loading = false; },
    });
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────────
  enterEditMode(): void {
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: d.objectif_tonne }));
        this.snapshot.clear();
        for (const r of this.rows) this.snapshot.set(r.code_produit, r.objectif_tonne);
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
    const body = this.rows.map(r => ({ code_produit: r.code_produit, objectif_tonne: r._tonne }));
    this.http.post(`/api/v1/objectifs-in/batch?mois=${this.mois}&annee=${this.annee}`, body).subscribe({
      next: () => {
        this.isSaving  = false;
        this.editMode  = false;
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

    const applyImport = (data: { code_produit: string; tonne: number | null }[]) => {
      let imported = 0;
      const notFound: string[] = [];
      for (const item of data) {
        const row = this.rows.find(r => r.code_produit === item.code_produit);
        if (row) { row._tonne = item.tonne; imported++; }
        else      { notFound.push(item.code_produit); }
      }
      this.showImportDialog  = false;
      this.isImporting       = false;
      this.importFile        = null;
      this.importResult      = { imported, notFound };
      this.showNotFoundDetail = false;
    };

    const monthChanged = this.importMois !== this.mois || this.importAnnee !== this.annee;

    this.http.post<{ code_produit: string; tonne: number | null }[]>(
      '/api/v1/objectifs-in/parse-excel', fd
    ).subscribe({
      next: data => {
        if (monthChanged) {
          this.mois  = this.importMois;
          this.annee = this.importAnnee;
          this.http.get<any[]>(`/api/v1/objectifs-in?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
            next: rows => {
              this.rows = rows.map(d => ({ ...d, _tonne: d.objectif_tonne }));
              this.snapshot.clear();
              for (const r of this.rows) this.snapshot.set(r.code_produit, r.objectif_tonne);
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
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${pm}&annee=${pa}`).subscribe({
      next: data => {
        const map = new Map(data.map((d: any) => [d.code_produit, d.objectif_tonne]));
        for (const r of this.rows) r._tonne = map.get(r.code_produit) ?? r._tonne;
      },
    });
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  isDirtyRow(r: ObjectifInRow): boolean {
    return r._tonne !== (this.snapshot.get(r.code_produit) ?? null);
  }

  get dirtyCount(): number {
    return this.rows.filter(r => this.isDirtyRow(r)).length;
  }

  // ── Sorting ───────────────────────────────────────────────────────────────────
  get sortedRows(): ObjectifInRow[] {
    if (!this.sortCol) return this.rows;
    const dir = this.sortDir;
    return [...this.rows].sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortCol) {
        case 'famille': va = a.famille;     vb = b.famille;     break;
        case 'produit': va = a.nom_produit; vb = b.nom_produit; break;
        case 'tonne':   va = this.editMode ? a._tonne : a.objectif_tonne;
                        vb = this.editMode ? b._tonne : b.objectif_tonne; break;
        default: return 0;
      }
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
    });
  }

  // ── Aggregates ────────────────────────────────────────────────────────────────
  sumTonne(rows: ObjectifInRow[]): number | null {
    const vals = rows.map(r => this.editMode ? r._tonne : r.objectif_tonne).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  get filledProducts(): number {
    return this.rows.filter(r => r.objectif_tonne != null).length;
  }

  get totalProducts(): number { return this.rows.length; }
}
