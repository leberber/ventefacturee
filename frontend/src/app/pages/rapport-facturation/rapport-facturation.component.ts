import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { Popover } from 'primeng/popover';

import { VentesService } from '../../core/services/ventes.service';
import { RapportsService, RapportFacturation } from '../../core/services/rapports.service';

@Component({
  selector: 'app-rapport-facturation',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, TooltipModule, Select, Popover],
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
  rapport: RapportFacturation | null = null;

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
    if (this.selectedFdv) {
      this.loadClients();
    }
  }

  loadClients(): void {
    if (!this.selectedMois || !this.selectedFdv) return;
    this.loadingClients = true;
    this.rapportSvc.getClients(this.selectedMois, this.selectedFdv).subscribe({
      next: d => {
        this.allClients = d;
        this.selectedClients = new Set(d);
        this.loadingClients = false;
      },
      error: () => this.loadingClients = false,
    });
  }

  toggleClient(name: string): void {
    const s = new Set(this.selectedClients);
    s.has(name) ? s.delete(name) : s.add(name);
    this.selectedClients = s;
  }

  selectAll(): void   { this.selectedClients = new Set(this.allClients); }
  deselectAll(): void { this.selectedClients = new Set(); }

  generate(): void {
    const clients = [...this.selectedClients];
    if (!clients.length) return;
    this.loading = true;
    this.rapportSvc.getFacturation(this.selectedMois, this.selectedFdv, clients).subscribe({
      next: d => { this.rapport = d; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  print(): void { window.print(); }

  goBack(): void { this.router.navigate(['/ventes']); }

  formatPeriod(p: string): string {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  formatPeriodLabel(p: string): string {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  val(v: number | null): string {
    return v != null && v !== 0 ? String(v) : '';
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
}
