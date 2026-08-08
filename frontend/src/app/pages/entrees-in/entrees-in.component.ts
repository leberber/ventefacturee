import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PeriodStepperComponent } from '../../shared/period-stepper/period-stepper.component';
import { getFamilyColor, getFamilyBg, getFamilyBgLight } from '../../core/constants/colors';

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
  imports: [CommonModule, PeriodStepperComponent],
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
  deleteConfirmDate: string | null = null;
  uploadResult: { imported: number; dates: string[] } | null = null;
  uploadError: string | null = null;
  data: MonthData | null = null;
  collapsedFamilies = new Set<string>();

  // Validation state
  pendingFile:   File | null = null;
  parseResult:   ParseResult | null = null;
  showPreviewDialog = false;

  readonly MONTHS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ];

  ngOnInit(): void { this.load(); }

  get periodLabel(): string { return `${this.MONTHS[this.mois - 1]} ${this.annee}`; }

  dateForDay(day: number): string {
    return `${this.annee}-${String(this.mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  load(): void {
    this.loading = true;
    const am = `${this.annee}-${String(this.mois).padStart(2, '0')}`;
    this.http.get<MonthData>(`/api/v1/entrees-in/month?annee_mois=${am}`).subscribe({
      next: data => { this.data = data; this.loading = false; },
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
  }

  // ── Step 2: confirm & save ────────────────────────────────────────────────
  confirmUpload(): void {
    if (!this.pendingFile) return;
    this.uploading = true;
    const fd = new FormData();
    fd.append('file', this.pendingFile);

    this.http.post<{ imported: number; dates: string[] }>('/api/v1/entrees-in/upload', fd).subscribe({
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

  // ── Famille collapsing ────────────────────────────────────────────────────
  toggleFamily(fam: string): void {
    if (this.collapsedFamilies.has(fam)) this.collapsedFamilies.delete(fam);
    else this.collapsedFamilies.add(fam);
  }
  isFamilyCollapsed(fam: string): boolean { return this.collapsedFamilies.has(fam); }

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
    if (p >= 50)  return 'pct-mid';
    return 'pct-low';
  }

  // ── Colours ───────────────────────────────────────────────────────────────
  famColor(fam: string): string   { return getFamilyColor(fam); }
  famBg(fam: string): string      { return getFamilyBg(fam); }
  famBgLight(fam: string): string { return getFamilyBgLight(fam); }

  // ── Formatting ────────────────────────────────────────────────────────────
  formatNum(v: number | null | undefined, dec = 1): string {
    if (v == null) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
}
