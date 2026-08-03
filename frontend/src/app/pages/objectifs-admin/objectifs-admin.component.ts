import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getFamilyColor, getFamilyBg } from '../../core/constants/colors';

interface ObjectifRow {
  code_produit: string;
  nom_produit: string;
  famille: string;
  sous_famille: string;
  objectif_tonne_vd: number | null;
  objectif_packs_vd: number | null;
  objectif_tonne_vh: number | null;
  objectif_packs_vh: number | null;
  updated_at: string | null;
  updated_by: string | null;
  _tonne: number | null;
  _packs: number | null;
}

interface SfGroup   { nom: string; rows: ObjectifRow[]; }
interface FamGroupe { nom: string; sfs: SfGroup[]; }

@Component({
  selector: 'app-objectifs-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './objectifs-admin.component.html',
  styleUrl: './objectifs-admin.component.scss',
})
export class ObjectifsAdminComponent implements OnInit {
  private http = inject(HttpClient);

  mois = new Date().getMonth() + 1;
  annee = new Date().getFullYear();
  canal: 'VD' | 'VH' = 'VD';
  loading = false;
  rows: ObjectifRow[] = [];

  editMode = false;
  hasGoals = false;
  isSaving = false;
  showConfirm = false;

  nextMois: number | null = null;
  nextAnnee: number | null = null;

  routesVD = 0;
  routesVH = 0;
  routesFallbackMois: string | null = null;

  private snapshot = new Map<string, { tonne: number | null; packs: number | null }>();
  collapsedFamilies = new Set<string>();

  toggleFamily(nom: string) {
    if (this.collapsedFamilies.has(nom)) this.collapsedFamilies.delete(nom);
    else this.collapsedFamilies.add(nom);
  }

  isFamilyCollapsed(nom: string): boolean {
    return this.collapsedFamilies.has(nom);
  }

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
    this.http.get<{ mois: number; annee: number }>('/api/v1/objectifs/next-missing').subscribe({
      next: d => { this.nextMois = d.mois; this.nextAnnee = d.annee; },
    });
  }

  load() {
    if (this.editMode) return;
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs?mois=${this.mois}&annee=${this.annee}`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: null, _packs: null }));
        this.hasGoals = data.some(d =>
          d.objectif_tonne_vd != null || d.objectif_packs_vd != null ||
          d.objectif_tonne_vh != null || d.objectif_packs_vh != null
        );
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.http.get<{ vd: number; vh: number; fallback_mois: string | null }>(`/api/v1/objectifs/routes-count?mois=${this.mois}&annee=${this.annee}`).subscribe({
      next: d => { this.routesVD = d.vd; this.routesVH = d.vh; this.routesFallbackMois = d.fallback_mois; },
      error: () => { this.routesVD = 0; this.routesVH = 0; this.routesFallbackMois = null; },
    });
  }

  // ── Edit mode entry points ─────────────────────────────────────────────────

  goToNextMissing() {
    if (this.nextMois == null || this.nextAnnee == null) return;
    this.mois = this.nextMois;
    this.annee = this.nextAnnee;
    this.enterEditMode();
  }

  enterEditMode() {
    this.loading = true;
    this.http.get<any[]>(`/api/v1/objectifs?mois=${this.mois}&annee=${this.annee}&edit=true`).subscribe({
      next: data => {
        this.rows = data.map(d => ({ ...d, _tonne: null, _packs: null }));
        this.snapshot.clear();
        for (const r of this.rows) {
          const tonne = this.canal === 'VD' ? r.objectif_tonne_vd : r.objectif_tonne_vh;
          const packs = this.canal === 'VD' ? r.objectif_packs_vd : r.objectif_packs_vh;
          this.snapshot.set(r.code_produit, { tonne, packs });
          r._tonne = tonne;
          r._packs = packs;
        }
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

  // ── Copy from previous month ───────────────────────────────────────────────

  copyFromPrevious() {
    let pm = this.mois - 1;
    let pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    this.http.get<any[]>(`/api/v1/objectifs?mois=${pm}&annee=${pa}`).subscribe({
      next: data => {
        const map = new Map(data.map((d: any) => [d.code_produit, d]));
        for (const r of this.rows) {
          const prev = map.get(r.code_produit) as any;
          if (prev) {
            r._tonne = this.canal === 'VD' ? prev.objectif_tonne_vd : prev.objectif_tonne_vh;
            r._packs = this.canal === 'VD' ? prev.objectif_packs_vd : prev.objectif_packs_vh;
          }
        }
      },
    });
  }

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  isDirtyRow(r: ObjectifRow): boolean {
    const snap = this.snapshot.get(r.code_produit);
    return r._tonne !== (snap?.tonne ?? null) || r._packs !== (snap?.packs ?? null);
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
      objectif_tonne_vd: this.canal === 'VD' ? r._tonne : r.objectif_tonne_vd,
      objectif_packs_vd: this.canal === 'VD' ? r._packs : r.objectif_packs_vd,
      objectif_tonne_vh: this.canal === 'VH' ? r._tonne : r.objectif_tonne_vh,
      objectif_packs_vh: this.canal === 'VH' ? r._packs : r.objectif_packs_vh,
    }));
    this.http.post(`/api/v1/objectifs/batch?mois=${this.mois}&annee=${this.annee}`, body).subscribe({
      next: () => {
        this.isSaving = false;
        this.editMode = false;
        this.load();
        this.loadNextMissing();
      },
      error: () => { this.isSaving = false; },
    });
  }

  // ── Grouping ───────────────────────────────────────────────────────────────

  get grouped(): FamGroupe[] {
    const famMap = new Map<string, Map<string, ObjectifRow[]>>();
    for (const row of this.rows) {
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

  // ── Per-route helpers ──────────────────────────────────────────────────────

  get routeCount(): number {
    return this.canal === 'VD' ? this.routesVD : this.routesVH;
  }

  perRoute(val: number | null): string {
    if (val == null || this.routeCount === 0) return '—';
    return (val / this.routeCount).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  // ── Family colors ──────────────────────────────────────────────────────────

  famColor(nom: string): string { return getFamilyColor(nom); }
  famBg(nom: string): string    { return getFamilyBg(nom); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatNum(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR');
  }

  get totalProducts(): number { return this.rows.length; }

  get filledProducts(): number {
    return this.rows.filter(r =>
      this.canal === 'VD' ? r.objectif_packs_vd != null : r.objectif_packs_vh != null
    ).length;
  }

  get periodLabel(): string {
    const m = this.MONTHS.find(x => x.v === this.mois);
    return `${m?.l ?? ''} ${this.annee}`;
  }

  get nextMissingLabel(): string {
    if (this.nextMois == null || this.nextAnnee == null) return '';
    const m = this.MONTHS.find(x => x.v === this.nextMois);
    return `${m?.l ?? ''} ${this.nextAnnee}`;
  }

  get prevMonthLabel(): string {
    let pm = this.mois - 1;
    let pa = this.annee;
    if (pm === 0) { pm = 12; pa--; }
    const m = this.MONTHS.find(x => x.v === pm);
    return `${m?.l ?? ''} ${pa}`;
  }

  get canalLabel(): string {
    return this.canal === 'VD' ? 'Direct (VD)' : 'Horeca (VH)';
  }

  get isNextMissingPeriod(): boolean {
    return this.mois === this.nextMois && this.annee === this.nextAnnee;
  }
}
