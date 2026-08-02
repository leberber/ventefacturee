import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrevendeurService, PrevFacturation, PrevClient } from '../../core/services/prevendeur.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-prevendeur',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prevendeur.component.html',
  styleUrl: './prevendeur.component.scss',
})
export class PrevendeurComponent implements OnInit {
  private svc  = inject(PrevendeurService);
  auth = inject(AuthService);

  periodes: string[] = [];
  selectedMois = '';
  loading = false;
  data: PrevFacturation | null = null;
  activeTab: 'tournees' | 'clients' | 'objectifs' | 'menu' = 'tournees';
  expandedClients = new Set<string>();
  showUnites = false;
  editingKey: string | null = null;
  editingValue = '';
  savingKey: string | null = null;

  get userName(): string { return this.auth.currentUser()?.full_name ?? ''; }

  ngOnInit() {
    this.svc.getPeriodes().subscribe(p => {
      this.periodes = p;
      if (p.length) {
        this.selectedMois = p[0];
        this.load();
      }
    });
  }

  load() {
    if (!this.selectedMois) return;
    this.loading = true;
    this.data = null;
    this.expandedClients.clear();
    this.svc.getFacturation(this.selectedMois).subscribe({
      next: d  => { this.data = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  prevPeriod() {
    const i = this.periodes.indexOf(this.selectedMois);
    if (i < this.periodes.length - 1) { this.selectedMois = this.periodes[i + 1]; this.load(); }
  }

  nextPeriod() {
    const i = this.periodes.indexOf(this.selectedMois);
    if (i > 0) { this.selectedMois = this.periodes[i - 1]; this.load(); }
  }

  get canGoPrev(): boolean { return this.periodes.indexOf(this.selectedMois) < this.periodes.length - 1; }
  get canGoNext(): boolean { return this.periodes.indexOf(this.selectedMois) > 0; }

  toggleClient(key: string) {
    this.expandedClients.has(key) ? this.expandedClients.delete(key) : this.expandedClients.add(key);
  }

  isExpanded(key: string): boolean { return this.expandedClients.has(key); }

  formatPeriod(p: string): string {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  clientTotal(client: PrevClient): number {
    if (!this.data) return 0;
    return Object.entries(client.totaux).reduce<number>((s, [prod, v]) => {
      if (!v) return s;
      if (!this.showUnites) return s + v;
      const colisage = this.data!.products_meta[prod]?.colisage;
      return s + (colisage ? Math.round(v * colisage) : v);
    }, 0);
  }

  get totalSucre(): number {
    if (!this.data) return 0;
    const sucreProducts = this.data.products.filter(p => this.data!.products_meta[p]?.famille === 'sucre');
    return this.data.routes.flatMap(r => r.clients)
      .reduce((s, c) => s + sucreProducts.reduce((ps, p) => ps + (c.totaux[p] ?? 0), 0), 0);
  }

  get totalHuile(): number {
    if (!this.data) return 0;
    const huileProducts = this.data.products.filter(p => this.data!.products_meta[p]?.famille === 'huile');
    return this.data.routes.flatMap(r => r.clients)
      .reduce((s, c) => s + huileProducts.reduce((ps, p) => ps + (c.totaux[p] ?? 0), 0), 0);
  }

  val(v: number | null, product: string): string {
    if (!v) return '';
    if (!this.showUnites) return String(v);
    const colisage = this.data?.products_meta[product]?.colisage;
    return colisage ? String(Math.round(v * colisage)) : String(v);
  }

  familleClass(p: string): string {
    const f = this.data?.products_meta[p]?.famille;
    if (f === 'huile') return 'col--huile';
    if (f === 'sucre') return 'col--sucre';
    return '';
  }

  clientFamilies(client: PrevClient): string[] {
    if (!this.data) return [];
    const fams = new Set<string>();
    for (const [prod, qty] of Object.entries(client.totaux)) {
      if (qty && qty > 0) {
        const f = this.data.products_meta[prod]?.famille;
        if (f) fams.add(f);
      }
    }
    return Array.from(fams);
  }

  get allClients(): PrevClient[] {
    if (!this.data) return [];
    return this.data.routes.flatMap(r => r.clients)
      .sort((a, b) => a.nom_client.localeCompare(b.nom_client, 'fr'));
  }

  clientKey(route: string, client: PrevClient): string {
    return route + '|' + client.nom_client;
  }

  startEdit(route: string, client: PrevClient, event: Event) {
    event.stopPropagation();
    this.editingKey = this.clientKey(route, client);
    this.editingValue = client.nom_sodichn ?? '';
    setTimeout(() => {
      const el = document.querySelector('.pv-rc-input') as HTMLInputElement;
      if (el) el.focus();
    }, 30);
  }

  saveEdit(client: PrevClient, event: Event) {
    event.stopPropagation();
    if (!this.editingKey || !client.code_client) { this.editingKey = null; return; }
    const value = this.editingValue.trim();
    const key = this.editingKey;
    this.editingKey = null;
    this.savingKey = key;
    this.svc.updateNomSodichn(client.code_client, value, client.nom_client).subscribe({
      next: () => {
        client.nom_sodichn = value || null;
        this.savingKey = null;
      },
      error: () => { this.savingKey = null; },
    });
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    this.editingKey = null;
  }

  readonly skeletonRows = Array(6).fill(0);
}
