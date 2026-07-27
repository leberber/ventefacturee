import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { Popover } from 'primeng/popover';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { VentesService } from '../../core/services/ventes.service';
import { RapportsService, RapportFacturation } from '../../core/services/rapports.service';

@Component({
  selector: 'app-rapport-facturation',
  standalone: true,
  imports: [FormsModule, DatePipe, NgClass, TooltipModule, Select, Popover, ToggleSwitch],
  templateUrl: './rapport-facturation.component.html',
  styleUrl: './rapport-facturation.component.scss',
})
export class RapportFacturationComponent implements OnInit {
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private ventesSvc  = inject(VentesService);
  private rapportSvc = inject(RapportsService);


  periodes: { label: string; value: string }[] = [];
  fdvs: string[] = [];
  selectedMois = '';
  selectedFdv  = '';

  allClients: string[]      = [];
  selectedClients: Set<string> = new Set();
  clientSearch = '';

  get filteredClients(): string[] {
    const q = this.clientSearch.trim().toLowerCase();
    const list = q ? this.allClients.filter(c => c.toLowerCase().includes(q)) : this.allClients;
    return [...list].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  readonly today = new Date();

  loading        = false;
  loadingClients = false;
  exporting      = false;
  rapport: RapportFacturation | null = null;
  displayMode: 'brut' | 'unites' = 'unites';
  excludeBackOffice = true;
  private _sourceStats: Record<string, { lignes: number }> | null = null;

  get boRatio(): string {
    if (!this._sourceStats) return '';
    const bo = this._sourceStats['BackOffice']?.lignes ?? 0;
    const total = Object.values(this._sourceStats).reduce((s, v) => s + v.lignes, 0);
    return `${bo.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')}`;
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const initMois = qp.get('annee_mois') ?? '';
    const initFdv  = qp.get('nom_fdv')    ?? '';

    this.ventesSvc.getPeriodes().subscribe(periodes => {
      this.periodes = periodes.map(v => ({ label: this.formatPeriod(v), value: v }));
      this.selectedMois = initMois || (periodes[0] ?? '');

      this.ventesSvc.getFdvs(this.selectedMois).subscribe(fdvs => {
        this.fdvs = fdvs;
        if (initFdv && fdvs.includes(initFdv)) {
          this.selectedFdv = initFdv;
          this.loadClients();
          this.rapportSvc.getSourceStats(this.selectedMois, this.selectedFdv)
            .subscribe(d => this._sourceStats = d);
        }
      });
    });
  }

  onPeriodChange(): void {
    this.selectedFdv = '';
    this.allClients = [];
    this.selectedClients = new Set();
    this.rapport = null;
    this.ventesSvc.getFdvs(this.selectedMois).subscribe(d => this.fdvs = d);
  }

  onFdvChange(): void {
    this.allClients = [];
    this.selectedClients = new Set();
    this.rapport = null;
    this._sourceStats = null;
    if (this.selectedFdv) {
      this.loadClients();
      this.rapportSvc.getSourceStats(this.selectedMois, this.selectedFdv)
        .subscribe(d => this._sourceStats = d);
    }
  }

  get source(): string { return this.excludeBackOffice ? 'FrontOffice' : 'both'; }

  onExcludeChange(): void {
    this.rapport = null;
    this.generate();
  }

  loadClients(): void {
    if (!this.selectedMois || !this.selectedFdv) return;
    this.loadingClients = true;
    this.rapportSvc.getClients(this.selectedMois, this.selectedFdv, this.source).subscribe({
      next: d => {
        this.allClients = d;
        this.selectedClients = new Set(d);
        this.loadingClients = false;
        this.generate();
      },
      error: () => this.loadingClients = false,
    });
  }

  toggleClient(name: string): void {
    const s = new Set(this.selectedClients);
    s.has(name) ? s.delete(name) : s.add(name);
    this.selectedClients = s;
    this.generate();
  }

  selectAll(): void   { this.selectedClients = new Set(this.allClients); this.generate(); }
  deselectAll(): void { this.selectedClients = new Set(); this.rapport = null; }

  generate(): void {
    const clients = [...this.selectedClients];
    if (!clients.length) return;
    this.loading = true;
    this.rapportSvc.getFacturation(this.selectedMois, this.selectedFdv, clients, this.source).subscribe({
      next: d => { this.rapport = d; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  print(): void { window.print(); }

  exportZip(): void {
    const clients = [...this.selectedClients];
    if (!clients.length || this.exporting) return;
    this.exporting = true;
    this.rapportSvc.exportClientsZip(this.selectedMois, this.selectedFdv, clients, this.displayMode, this.source).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${this.selectedFdv}_${this.selectedMois}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.exporting = false; },
    });
  }

  goBack(): void { this.router.navigate(['/ventes']); }

  formatPeriod(p: string): string {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  formatPeriodLabel(p: string): string {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  val(v: number | null, product?: string): string {
    if (v == null || v === 0) return '';
    if (this.displayMode === 'unites' && product && this.rapport) {
      const colisage = this.rapport.products_meta[product]?.colisage;
      if (colisage) return String(v * colisage);
    }
    return String(v);
  }

  get grandTotals(): { product: string; total: number }[] {
    if (!this.rapport) return [];
    return this.rapport.products
      .map(p => ({
        product: p,
        total: this.rapport!.clients.reduce((sum, c) => sum + (c.totaux[p] ?? 0), 0),
      }))
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  get maxGrandTotal(): number {
    const tots = this.grandTotals;
    return tots.length > 0 ? Math.max(...tots.map(g => g.total)) : 1;
  }

  get totalQty(): number {
    return this.grandTotals.reduce((sum, g) => sum + g.total, 0);
  }

  familleClass(product: string): string {
    const f = this.rapport?.products_meta[product]?.famille ?? '';
    if (f === 'huile') return 'col-product--huile';
    if (f === 'sucre') return 'col-product--sucre';
    return '';
  }
}
