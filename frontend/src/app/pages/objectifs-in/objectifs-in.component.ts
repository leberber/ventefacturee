import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getFamilyColor, getFamilyBg, getFamilyBgLight } from '../../core/constants/colors';

interface ObjectifInRow {
  code_produit: string;
  nom_produit: string;
  famille: string;
  sous_famille: string;
  objectif_tonne: number | null;
  updated_at: string | null;
  updated_by: string | null;
  _tonne: number | null;
}

interface SfGroup   { nom: string; rows: ObjectifInRow[]; }
interface FamGroupe { nom: string; sfs: SfGroup[]; }

@Component({
  selector: 'app-objectifs-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './objectifs-in.component.html',
  styleUrl: './objectifs-in.component.scss',
})
export class ObjectifsInComponent implements OnInit {
  private http = inject(HttpClient);

  mois = new Date().getMonth() + 1;
  annee = new Date().getFullYear();
  loading = false;
  rows: ObjectifInRow[] = [];

  editMode = false;
  hasGoals = false;
  isSaving = false;
  showConfirm = false;

  nextMois: number | null = null;
  nextAnnee: number | null = null;

  // Import state
  importFile: File | null = null;
  showImportDialog = false;
  importMois = 1;
  importAnnee = new Date().getFullYear();
  isImporting = false;
  importResult: { imported: number; notFound: string[] } | null = null;
  showNotFoundDetail = false;

  sortCol = '';
  sortDir: 1 | -1 = 1;
  collapsedFamilies = new Set<string>();

  private snapshot = new Map<string, number | null>();

  readonly MONTHS = [
    { v: 1,  l: 'Janvier'   }, { v: 2,  l: 'Février'   }, { v: 3,  l: 'Mars'      },
    { v: 4,  l: 'Avril'     }, { v: 5,  l: 'Mai'        }, { v: 6,  l: 'Juin'      },
    { v: 7,  l: 'Juillet'   }, { v: 8,  l: 'Août'       }, { v: 9,  l: 'Septembre' },
    { v: 10, l: 'Octobre'   }, { v: 11, l: 'Novembre'   }, { v: 12, l: 'Décembre'  },
  ];

  ngOnInit() {
    this.loadNextMissing();
    this.load();
  }

  loadNextMissing() {
    this.http.get<{ mois: number; annee: number }>('/api/v1/objectifs-in/next-missing').subscribe({
      next: d => { this.nextMois = d.mois; this.nextAnnee = d.annee; },
    });
  }

  load() {
    if (this.editMode) return;
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${this.mois}&annee=${this.annee}`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: null }));
        this.hasGoals = data.some(d => d.objectif_tonne != null);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  stepMonth(dir: 1 | -1) {
    let m = this.mois + dir;
    let a = this.annee;
    if (m > 12) { m = 1;  a++; }
    if (m < 1)  { m = 12; a--; }
    this.mois = m;
    this.annee = a;
    this.load();
  }

  goToNextMissing() {
    if (this.nextMois == null || this.nextAnnee == null) return;
    this.mois = this.nextMois;
    this.annee = this.nextAnnee;
    this.enterEditMode();
  }

  enterEditMode() {
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: d.objectif_tonne }));
        this.snapshot.clear();
        for (const r of this.rows) this.snapshot.set(r.code_produit, r.objectif_tonne);
        this.loading = false;
        this.editMode = true;
      },
      error: () => { this.loading = false; },
    });
  }

  cancelEdit() {
    this.editMode = false;
    this.showConfirm = false;
    this.load();
  }

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  isDirtyRow(r: ObjectifInRow): boolean {
    return r._tonne !== (this.snapshot.get(r.code_produit) ?? null);
  }

  get dirtyCount(): number {
    return this.rows.filter(r => this.isDirtyRow(r)).length;
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  requestSave() {
    if (this.dirtyCount === 0) { this.editMode = false; return; }
    this.showConfirm = true;
  }

  confirmSave() {
    this.showConfirm = false;
    this.isSaving = true;
    const body = this.rows.map(r => ({
      code_produit: r.code_produit,
      objectif_tonne: r._tonne,
    }));
    this.http.post(`/api/v1/objectifs-in/batch?mois=${this.mois}&annee=${this.annee}`, body).subscribe({
      next: () => {
        this.isSaving = false;
        this.editMode = false;
        this.load();
        this.loadNextMissing();
      },
      error: () => { this.isSaving = false; },
    });
  }

  // ── Excel import ───────────────────────────────────────────────────────────

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.importFile = input.files[0];
    this.importMois = this.mois;
    this.importAnnee = this.annee;
    this.showImportDialog = true;
    input.value = '';
  }

  cancelImport() {
    this.showImportDialog = false;
    this.importFile = null;
  }

  confirmImport() {
    if (!this.importFile) return;
    this.isImporting = true;
    const fd = new FormData();
    fd.append('file', this.importFile);

    const applyImport = (data: { code_produit: string; tonne: number | null }[]) => {
      let imported = 0;
      const notFound: string[] = [];
      for (const item of data) {
        const row = this.rows.find(r => r.code_produit === item.code_produit);
        if (row) {
          row._tonne = item.tonne;
          imported++;
        } else {
          notFound.push(item.code_produit);
        }
      }
      this.showImportDialog = false;
      this.isImporting = false;
      this.importFile = null;
      this.importResult = { imported, notFound };
      this.showNotFoundDetail = false;
    };

    const monthChanged = this.importMois !== this.mois || this.importAnnee !== this.annee;

    this.http.post<{ code_produit: string; tonne: number | null }[]>(
      '/api/v1/objectifs-in/parse-excel', fd
    ).subscribe({
      next: data => {
        if (monthChanged) {
          this.mois = this.importMois;
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

  // ── Copy from previous month ───────────────────────────────────────────────

  copyFromPrevious() {
    let pm = this.mois - 1, pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    this.http.get<any[]>(`/api/v1/objectifs-in?mois=${pm}&annee=${pa}`).subscribe({
      next: data => {
        const map = new Map(data.map((d: any) => [d.code_produit, d.objectif_tonne]));
        for (const r of this.rows) r._tonne = map.get(r.code_produit) ?? r._tonne;
      },
    });
  }

  // ── Grouping ───────────────────────────────────────────────────────────────

  get sortedRows(): ObjectifInRow[] {
    if (!this.sortCol) return this.rows;
    const dir = this.sortDir;
    return [...this.rows].sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortCol) {
        case 'famille': va = a.famille;      vb = b.famille;      break;
        case 'produit': va = a.nom_produit;  vb = b.nom_produit;  break;
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

  get grouped(): FamGroupe[] {
    const famMap = new Map<string, Map<string, ObjectifInRow[]>>();
    for (const row of this.sortedRows) {
      const f = row.famille || '(Sans famille)';
      const sf = row.sous_famille || '(Sans sous-famille)';
      if (!famMap.has(f)) famMap.set(f, new Map());
      const sfMap = famMap.get(f)!;
      if (!sfMap.has(sf)) sfMap.set(sf, []);
      sfMap.get(sf)!.push(row);
    }
    return Array.from(famMap.entries()).map(([f, sfMap]) => ({
      nom: f,
      sfs: Array.from(sfMap.entries()).map(([sf, rows]) => ({ nom: sf, rows })),
    }));
  }

  famRows(fam: FamGroupe): ObjectifInRow[] {
    return fam.sfs.flatMap(sf => sf.rows);
  }

  toggleFamily(nom: string) {
    if (this.collapsedFamilies.has(nom)) this.collapsedFamilies.delete(nom);
    else this.collapsedFamilies.add(nom);
  }

  setSort(col: string) {
    if (this.sortCol === col) this.sortDir = this.sortDir === 1 ? -1 : 1;
    else { this.sortCol = col; this.sortDir = 1; }
  }

  sortIcon(col: string): string {
    if (this.sortCol !== col) return 'pi-sort-alt';
    return this.sortDir === 1 ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down-alt';
  }

  sumTonne(rows: ObjectifInRow[]): number | null {
    const vals = rows.map(r => this.editMode ? r._tonne : r.objectif_tonne).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  // ── Family colors ──────────────────────────────────────────────────────────

  famColor(nom: string): string   { return getFamilyColor(nom); }
  famBg(nom: string): string      { return getFamilyBg(nom); }
  famBgLight(nom: string): string { return getFamilyBgLight(nom); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatNum(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
  }

  get periodLabel(): string {
    return `${this.MONTHS.find(x => x.v === this.mois)?.l ?? ''} ${this.annee}`;
  }

  get nextMissingLabel(): string {
    if (this.nextMois == null) return '';
    return `${this.MONTHS.find(x => x.v === this.nextMois)?.l ?? ''} ${this.nextAnnee}`;
  }

  get prevMonthLabel(): string {
    let pm = this.mois - 1, pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    return `${this.MONTHS.find(x => x.v === pm)?.l ?? ''} ${pa}`;
  }

  get isNextMissingPeriod(): boolean {
    return this.mois === this.nextMois && this.annee === this.nextAnnee;
  }

  get totalProducts(): number { return this.rows.length; }

  get filledProducts(): number {
    return this.rows.filter(r => r.objectif_tonne != null).length;
  }

  get importPeriodLabel(): string {
    return `${this.MONTHS.find(x => x.v === this.importMois)?.l ?? ''} ${this.importAnnee}`;
  }
}
