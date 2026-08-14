import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PeriodStepperComponent } from '../../shared/period-stepper/period-stepper.component';
import { getFamilyColor, getFamilyBg, getFamilyBgLight, getFamilyBgSolid } from '../../core/constants/colors';

interface EntreeRow {
  code_produit:     string;
  nom_produit:      string;
  famille:          string;
  sous_famille:     string;
  colisage:         number | null;
  colisage_palette: number | null;
  poids_unite_vente: number | null;
  objectif_tonne:   number | null;
  days:             Record<string, number>;
  total_colis:      number;
  total_palettes:   number | null;
  total_tonne:      number | null;
  source_colis:     Record<string, number> | null;
}

interface SfGroup  { nom: string; rows: EntreeRow[]; }
interface FamGroup { nom: string; sfs: SfGroup[]; rows: EntreeRow[]; }

interface MonthData {
  annee_mois:     string;
  days:           number[];
  uploaded_dates: string[];
  rows:           EntreeRow[];
}

interface ParsePreviewRow {
  code_produit:    string;
  nom_produit:     string;
  famille:         string;
  date:            string;
  quantite_colis:  number;
  nb_palettes:     number | null;
  tonnes:          number | null;
  known:           boolean;
  source:          string;
}

interface ParseResult {
  dates:            string[];
  total_entries:    number;
  unknown_codes:    string[];
  existing_by_date: Record<string, number>;
  preview:          ParsePreviewRow[];
}

@Component({
  selector: 'app-entrees-in',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodStepperComponent],
  templateUrl: './entrees-in.component.html',
  styleUrl: './entrees-in.component.scss',
})
export class EntreesInComponent implements OnInit {
  private http = inject(HttpClient);

  mois  = new Date().getMonth() + 1;
  annee = new Date().getFullYear();

  loading   = false;
  parsing   = false;   // step 1: parsing file
  uploading = false;   // step 2: saving to DB
  deleting  = false;
  daysExpanded = false;
  showSousFamilles = false;
  deleteConfirmDate: string | null = null;
  uploadResult: { imported: number; dates: string[] } | null = null;
  uploadError: string | null = null;
  data: MonthData | null = null;
  collapsedFamilies = new Set<string>();

  // Validation state
  pendingFile:   File | null = null;
  parseResult:   ParseResult | null = null;
  showPreviewDialog = false;

  // Manual LLL row form
  lllSearch       = '';
  lllSuggestions: any[] = [];
  lllSelectedProd: any  = null;
  lllQty:    number | null = null;
  lllError   = '';
  private lllSearchTimer: any = null;

  readonly MONTHS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ];

  ngOnInit(): void { this.load(); }

  get periodLabel(): string { return `${this.MONTHS[this.mois - 1]} ${this.annee}`; }

  dateForDay(day: number): string {
    return `${this.annee}-${String(this.mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  shortDate(day: number): string {
    return `${String(day).padStart(2, '0')}/${String(this.mois).padStart(2, '0')}`;
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  load(): void {
    this.loading = true;
    const am = `${this.annee}-${String(this.mois).padStart(2, '0')}`;
    this.http.get<MonthData>(`/api/v1/entrees-in/month?annee_mois=${am}`).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.collapsedFamilies = new Set(this.grouped.map(f => f.nom));
      },
      error: ()   => { this.loading = false; },
    });
  }

  onPeriodChange(e: { mois: number; annee: number }): void {
    this.mois = e.mois; this.annee = e.annee;
    this.uploadResult = null; this.uploadError = null;
    this.load();
  }

  // ── Step 1: parse (preview) ───────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;

    this.parsing      = true;
    this.uploadResult = null;
    this.uploadError  = null;
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<ParseResult>('/api/v1/entrees-in/parse', fd).subscribe({
      next: result => {
        this.parsing          = false;
        this.pendingFile      = file;
        this.parseResult      = result;
        this.showPreviewDialog = true;
      },
      error: e => {
        this.parsing     = false;
        this.uploadError = e.error?.detail ?? 'Erreur lors de la lecture du fichier';
      },
    });
  }

  cancelPreview(): void {
    this.showPreviewDialog = false;
    this.parseResult       = null;
    this.pendingFile       = null;
    this.lllSearch         = '';
    this.lllSuggestions    = [];
    this.lllSelectedProd   = null;
    this.lllQty            = null;
    this.lllError          = '';
  }

  // ── Step 2: confirm & save ────────────────────────────────────────────────
  confirmUpload(): void {
    if (!this.parseResult) return;
    this.uploading = true;

    const entries = this.parseResult.preview.map(row => ({
      code_produit:   row.code_produit,
      date:           row.date,
      quantite_colis: row.quantite_colis,
      source:         row.source,
    }));

    this.http.post<{ imported: number; dates: string[] }>('/api/v1/entrees-in/batch', { entries }).subscribe({
      next: result => {
        this.uploading         = false;
        this.showPreviewDialog = false;
        this.parseResult       = null;
        this.pendingFile       = null;
        this.uploadResult      = result;
        if (result.dates.length > 0) {
          const [y, m] = result.dates[0].split('-').map(Number);
          this.mois = m; this.annee = y;
        }
        this.load();
      },
      error: e => {
        this.uploading   = false;
        this.uploadError = e.error?.detail ?? 'Erreur lors de l\'import';
      },
    });
  }

  // ── Add manual LLL row ────────────────────────────────────────────────────
  onLllSearch(term: string): void {
    this.lllSelectedProd = null;
    this.lllError = '';
    clearTimeout(this.lllSearchTimer);
    if (term.length < 2) { this.lllSuggestions = []; return; }
    this.lllSearchTimer = setTimeout(() => {
      this.http.get<{ total: number; items: any[] }>(
        `/api/v1/produits?search=${encodeURIComponent(term)}&per_page=8`
      ).subscribe({
        next: res => { this.lllSuggestions = res.items; },
        error: ()  => { this.lllSuggestions = []; },
      });
    }, 250);
  }

  selectLllProd(prod: any): void {
    this.lllSelectedProd = prod;
    this.lllSearch       = prod.description_produit || prod.nom_produit || prod.code_produit;
    this.lllSuggestions  = [];
    this.lllError        = '';
  }

  addLllRow(): void {
    if (!this.lllSelectedProd || !this.lllQty || !this.parseResult) return;
    const prod   = this.lllSelectedProd;
    const date   = this.parseResult.dates[0];
    const qty    = this.lllQty;
    const colPal = prod.colisage_palette;
    const poids  = prod.poids_unite_vente;

    this.parseResult.preview.push({
      code_produit:   prod.code_produit,
      nom_produit:    prod.description_produit || prod.nom_produit || prod.code_produit,
      famille:        (prod.famille || '').trim(),
      date,
      quantite_colis: qty,
      nb_palettes:    colPal ? Math.round(qty / colPal * 100) / 100 : null,
      tonnes:         poids  ? Math.round(qty * poids * 1000) / 1000 : null,
      known:          true,
      source:         'LLL',
    });
    this.parseResult.total_entries++;
    this.lllSearch       = '';
    this.lllQty          = null;
    this.lllSelectedProd = null;
    this.lllSuggestions  = [];
  }

  removeLllRow(row: ParsePreviewRow): void {
    if (!this.parseResult) return;
    const idx = this.parseResult.preview.indexOf(row);
    if (idx >= 0) { this.parseResult.preview.splice(idx, 1); this.parseResult.total_entries--; }
  }

  // Grouped preview for the dialog
  get previewGrouped(): { famille: string; rows: ParsePreviewRow[]; total_colis: number; total_palettes: number | null; total_tonnes: number | null }[] {
    if (!this.parseResult) return [];
    const map = new Map<string, ParsePreviewRow[]>();
    for (const r of this.parseResult.preview) {
      const fam = r.famille || 'Autres';
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam)!.push(r);
    }
    return [...map.entries()].map(([famille, rows]) => {
      const palVals = rows.map(r => r.nb_palettes).filter(v => v != null) as number[];
      const tVals   = rows.map(r => r.tonnes).filter(v => v != null) as number[];
      return {
        famille,
        rows,
        total_colis:    rows.reduce((s, r) => s + r.quantite_colis, 0),
        total_palettes: palVals.length ? palVals.reduce((a, b) => a + b, 0) : null,
        total_tonnes:   tVals.length   ? tVals.reduce((a, b) => a + b, 0)   : null,
      };
    });
  }

  // ── Delete date ───────────────────────────────────────────────────────────
  confirmDelete(): void {
    if (!this.deleteConfirmDate) return;
    this.deleting = true;
    this.http.delete(`/api/v1/entrees-in/date?date=${this.deleteConfirmDate}`).subscribe({
      next: () => { this.deleting = false; this.deleteConfirmDate = null; this.load(); },
      error: () => { this.deleting = false; this.deleteConfirmDate = null; },
    });
  }

  // ── Days expand / collapse ────────────────────────────────────────────────
  toggleDays(): void { this.daysExpanded = !this.daysExpanded; }

  dayPalVal(row: EntreeRow, day: number): number {
    const colis = this.dayVal(row, day);
    if (!row.colisage_palette) return 0;
    return colis / row.colisage_palette;
  }

  rowMaxPalDay(row: EntreeRow): number {
    if (!this.data || this.data.days.length === 0) return 0;
    return Math.max(0, ...this.data.days.map(d => this.dayPalVal(row, d)));
  }

  sumPalDay(rows: EntreeRow[], day: number): number {
    return rows.reduce((s, r) => s + this.dayPalVal(r, day), 0);
  }

  heatBg(val: number, max: number): string {
    if (max <= 0 || val <= 0) return '';
    const alpha = 0.07 + (val / max) * 0.48;
    return `rgba(99,102,241,${alpha.toFixed(2)})`;
  }

  ecartPal(row: EntreeRow): number | null {
    const obj = this.rowObjPal(row);
    if (obj == null || row.total_palettes == null) return null;
    return obj - row.total_palettes;
  }

  /** Remaining calendar days in the viewed month after the last imported day. */
  private remainingDays(): number {
    if (!this.data || this.data.days.length === 0) return 0;
    const totalInMonth = new Date(this.annee, this.mois, 0).getDate();
    const lastDay = Math.max(...this.data.days);
    return Math.max(0, totalInMonth - lastDay);
  }

  /** Palettes/day needed in remaining days to reach objective (null when month complete or objective met). */
  moyJPal(row: EntreeRow): number | null {
    const rem = this.remainingDays();
    if (rem <= 0) return null;
    const ecart = this.ecartPal(row);
    if (ecart == null || ecart <= 0) return null;
    return ecart / rem;
  }

  sumEcartPal(rows: EntreeRow[]): number | null {
    let has = false; let total = 0;
    for (const r of rows) { const e = this.ecartPal(r); if (e != null) { total += e; has = true; } }
    return has ? total : null;
  }

  sumMoyJPal(rows: EntreeRow[]): number | null {
    const rem = this.remainingDays();
    if (rem <= 0) return null;
    const ecart = this.sumEcartPal(rows);
    if (ecart == null || ecart <= 0) return null;
    return ecart / rem;
  }

  ecartClass(e: number | null): string {
    if (e == null) return '';
    return e <= 0 ? 'pct-ok' : 'pct-low';
  }

  rowObjPal(row: EntreeRow): number | null {
    if (!row.objectif_tonne || !row.colisage_palette || !row.poids_unite_vente) return null;
    const poids_palette = row.colisage_palette * row.poids_unite_vente;
    if (poids_palette === 0) return null;
    return row.objectif_tonne / poids_palette;
  }

  // ── Famille collapsing ────────────────────────────────────────────────────
  toggleFamily(fam: string): void {
    if (this.collapsedFamilies.has(fam)) this.collapsedFamilies.delete(fam);
    else this.collapsedFamilies.add(fam);
  }
  isFamilyCollapsed(fam: string): boolean { return this.collapsedFamilies.has(fam); }

  get allFamiliesCollapsed(): boolean {
    return this.grouped.length > 0 && this.collapsedFamilies.size === this.grouped.length;
  }

  toggleAllFamilies(): void {
    if (this.allFamiliesCollapsed) {
      this.collapsedFamilies.clear();
    } else {
      for (const fam of this.grouped) this.collapsedFamilies.add(fam.nom);
    }
  }

  // ── Grouping ──────────────────────────────────────────────────────────────
  get grouped(): FamGroup[] {
    if (!this.data) return [];
    const famMap = new Map<string, Map<string, EntreeRow[]>>();
    for (const row of this.data.rows) {
      const fam = row.famille || 'Autres';
      const sf  = row.sous_famille || 'Autres';
      if (!famMap.has(fam)) famMap.set(fam, new Map());
      const sfMap = famMap.get(fam)!;
      if (!sfMap.has(sf)) sfMap.set(sf, []);
      sfMap.get(sf)!.push(row);
    }
    return [...famMap.entries()].map(([nom, sfMap]) => ({
      nom,
      rows: [...sfMap.values()].flat(),
      sfs: [...sfMap.entries()].map(([snom, rows]) => ({ nom: snom, rows })),
    }));
  }

  // ── Aggregations ──────────────────────────────────────────────────────────
  dayVal(row: EntreeRow, day: number): number { return row.days[String(day)] ?? 0; }

  sumColisDay(rows: EntreeRow[], day: number): number {
    return rows.reduce((s, r) => s + (r.days[String(day)] ?? 0), 0);
  }

  sumColis(rows: EntreeRow[]): number {
    return rows.reduce((s, r) => s + r.total_colis, 0);
  }

  sumPalettes(rows: EntreeRow[]): number | null {
    const vals = rows.map(r => r.total_palettes).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  sumTonne(rows: EntreeRow[]): number | null {
    const vals = rows.map(r => r.total_tonne).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  sumObjTonne(rows: EntreeRow[]): number | null {
    const vals = rows.map(r => r.objectif_tonne).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  pct(actual: number | null, obj: number | null): string {
    if (actual == null || obj == null || obj === 0) return '—';
    return `${Math.round(actual / obj * 100)}%`;
  }

  pctNum(actual: number | null, obj: number | null): number | null {
    if (actual == null || obj == null || obj === 0) return null;
    return Math.round(actual / obj * 100);
  }

  pctClass(actual: number | null, obj: number | null): string {
    const p = this.pctNum(actual, obj);
    if (p == null) return '';
    if (p >= 100) return 'pct-ok';
    if (p >= 60) return 'pct-mid';
    return 'pct-low';
  }

  hasMixedSources(row: EntreeRow): boolean {
    return !!row.source_colis && Object.keys(row.source_colis).length > 1;
  }

  srcPal(colis: number, row: EntreeRow): string {
    if (row.colisage_palette) return this.formatNum(colis / row.colisage_palette, 1);
    return this.formatNum(colis, 0) + ' col.';
  }

  // ── Colours ───────────────────────────────────────────────────────────────
  famColor(fam: string): string   { return getFamilyColor(fam); }
  famBg(fam: string): string      { return getFamilyBg(fam); }
  famBgLight(fam: string): string { return getFamilyBgLight(fam); }
  famBgSolid(fam: string): string { return getFamilyBgSolid(fam); }

  // ── Formatting ────────────────────────────────────────────────────────────
  formatNum(v: number | null | undefined, dec = 1): string {
    if (v == null) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
}
