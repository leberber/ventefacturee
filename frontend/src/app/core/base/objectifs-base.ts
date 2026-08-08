import { Directive, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getFamilyColor, getFamilyBg, getFamilyBgLight } from '../constants/colors';

export interface BaseRow {
  code_produit: string;
  nom_produit: string;
  famille: string;
  sous_famille: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface SfGroup<R>   { nom: string; rows: R[]; }
export interface FamGroupe<R> { nom: string; sfs: SfGroup<R>[]; }

@Directive()
export abstract class ObjectifsBaseComponent<R extends BaseRow> implements OnInit {
  protected http = inject(HttpClient);

  mois  = new Date().getMonth() + 1;
  annee = new Date().getFullYear();
  loading  = false;
  rows: R[] = [];

  editMode    = false;
  hasGoals    = false;
  isSaving    = false;
  showConfirm = false;

  nextMois:  number | null = null;
  nextAnnee: number | null = null;

  importFile:        File | null = null;
  showImportDialog   = false;
  importMois         = 1;
  importAnnee        = new Date().getFullYear();
  isImporting        = false;
  importResult: { imported: number; notFound: string[] } | null = null;
  showNotFoundDetail = false;

  sortCol = '';
  sortDir: 1 | -1 = 1;
  collapsedFamilies = new Set<string>();

  readonly MONTHS = [
    { v: 1,  l: 'Janvier'   }, { v: 2,  l: 'Février'   }, { v: 3,  l: 'Mars'      },
    { v: 4,  l: 'Avril'     }, { v: 5,  l: 'Mai'        }, { v: 6,  l: 'Juin'      },
    { v: 7,  l: 'Juillet'   }, { v: 8,  l: 'Août'       }, { v: 9,  l: 'Septembre' },
    { v: 10, l: 'Octobre'   }, { v: 11, l: 'Novembre'   }, { v: 12, l: 'Décembre'  },
  ];

  // ── Abstract contract ────────────────────────────────────────────────────────
  protected abstract get nextMissingUrl(): string;
  abstract load(): void;
  abstract enterEditMode(): void;
  abstract confirmSave(): void;
  abstract confirmImport(): void;
  abstract copyFromPrevious(): void;
  abstract get sortedRows(): R[];
  abstract get dirtyCount(): number;
  abstract get filledProducts(): number;
  abstract get totalProducts(): number;

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadNextMissing();
    this.load();
  }

  // ── Period navigation ────────────────────────────────────────────────────────
  onPeriodChange(e: { mois: number; annee: number }): void {
    this.mois  = e.mois;
    this.annee = e.annee;
    this.load();
  }

  onImportPeriodChange(e: { mois: number; annee: number }): void {
    this.importMois  = e.mois;
    this.importAnnee = e.annee;
  }

  loadNextMissing(): void {
    this.http.get<{ mois: number; annee: number }>(this.nextMissingUrl).subscribe({
      next: d => { this.nextMois = d.mois; this.nextAnnee = d.annee; },
    });
  }

  goToNextMissing(): void {
    if (this.nextMois == null || this.nextAnnee == null) return;
    this.mois  = this.nextMois;
    this.annee = this.nextAnnee;
    this.enterEditMode();
  }

  // ── Edit / Save ───────────────────────────────────────────────────────────────
  cancelEdit(): void {
    this.editMode    = false;
    this.showConfirm = false;
    this.load();
  }

  requestSave(): void {
    if (this.dirtyCount === 0) { this.editMode = false; return; }
    this.showConfirm = true;
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.importFile  = input.files[0];
    this.importMois  = this.mois;
    this.importAnnee = this.annee;
    this.onFileSelectedHook();
    this.showImportDialog = true;
    input.value = '';
  }

  /** Override in subclass to set extra import state (e.g. importCanal). */
  protected onFileSelectedHook(): void {}

  cancelImport(): void {
    this.showImportDialog = false;
    this.importFile       = null;
  }

  // ── Sorting ───────────────────────────────────────────────────────────────────
  setSort(col: string): void {
    if (this.sortCol === col) this.sortDir = this.sortDir === 1 ? -1 : 1;
    else { this.sortCol = col; this.sortDir = 1; }
  }

  sortIcon(col: string): string {
    if (this.sortCol !== col) return 'pi-sort-alt';
    return this.sortDir === 1 ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down-alt';
  }

  // ── Family grouping ───────────────────────────────────────────────────────────
  toggleFamily(nom: string): void {
    if (this.collapsedFamilies.has(nom)) this.collapsedFamilies.delete(nom);
    else this.collapsedFamilies.add(nom);
  }

  isFamilyCollapsed(nom: string): boolean {
    return this.collapsedFamilies.has(nom);
  }

  get grouped(): FamGroupe<R>[] {
    const famMap = new Map<string, Map<string, R[]>>();
    for (const row of this.sortedRows) {
      const f  = row.famille      || '(Sans famille)';
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

  famRows(fam: FamGroupe<R>): R[] {
    return fam.sfs.flatMap(sf => sf.rows);
  }

  // ── Family colors ─────────────────────────────────────────────────────────────
  famColor(nom: string): string   { return getFamilyColor(nom); }
  famBg(nom: string): string      { return getFamilyBg(nom); }
  famBgLight(nom: string): string { return getFamilyBgLight(nom); }

  // ── Formatters ────────────────────────────────────────────────────────────────
  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatNum(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR');
  }

  // ── Label getters ─────────────────────────────────────────────────────────────
  get periodLabel(): string {
    return `${this.MONTHS.find(x => x.v === this.mois)?.l ?? ''} ${this.annee}`;
  }

  get prevMonthLabel(): string {
    let pm = this.mois - 1, pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    return `${this.MONTHS.find(x => x.v === pm)?.l ?? ''} ${pa}`;
  }

  get nextMissingLabel(): string {
    if (this.nextMois == null) return '';
    return `${this.MONTHS.find(x => x.v === this.nextMois)?.l ?? ''} ${this.nextAnnee}`;
  }

  get isNextMissingPeriod(): boolean {
    return this.mois === this.nextMois && this.annee === this.nextAnnee;
  }

  get importPeriodLabel(): string {
    return `${this.MONTHS.find(x => x.v === this.importMois)?.l ?? ''} ${this.importAnnee}`;
  }
}
