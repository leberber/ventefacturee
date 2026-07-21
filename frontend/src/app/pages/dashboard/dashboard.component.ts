import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { Expedition, DashboardStats } from '../../core/models/expedition.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  expeditions: Expedition[] = [];
  allRecentExpeditions: Expedition[] = [];
  loading = false;
  tableLoading = false;
  timeFilter: 'today' | 'week' | 'month' = 'today';

  readonly destinationLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly destinationBadge: Record<string, string> = { gros: 'badge badge--info', detail: 'badge badge--warning', horeca: 'badge badge--success' };

  constructor(private expeditionsService: ExpeditionsService) {}

  ngOnInit() {
    this.loading = true;
    this.expeditionsService.getDashboardStats().subscribe(s => { this.stats = s; this.loading = false; });
    this.loadExpeditions();

    const dateTo   = new Date().toISOString().slice(0, 10);
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    this.expeditionsService.list(undefined, undefined, dateFrom, dateTo).subscribe(all => {
      this.allRecentExpeditions = all;
    });
  }

  setFilter(f: 'today' | 'week' | 'month') {
    this.timeFilter = f;
    this.loadExpeditions();
  }

  get plastiqueEnvoyees()   { return this.expeditions.reduce((s, e) => s + e.nc_plastique, 0); }
  get plastiqueRetournees() { return this.expeditions.reduce((s, e) => s + e.retour_plastique, 0); }
  get boisEnvoyes()         { return this.expeditions.reduce((s, e) => s + e.nc_bois, 0); }
  get boisRetournes()       { return this.expeditions.reduce((s, e) => s + e.retour_bois, 0); }

  get countByType(): Record<string, number> {
    const map: Record<string, number> = { gros: 0, detail: 0, horeca: 0 };
    this.expeditions.forEach(e => { if (e.destination_type in map) map[e.destination_type]++; });
    return map;
  }

  get maxTypeCount(): number {
    const c = this.countByType;
    return Math.max(c['gros'], c['detail'], c['horeca'], 1);
  }

  get pendingReturns(): Expedition[] {
    return this.allRecentExpeditions
      .filter(e => (e.nc_plastique + e.nc_bois) > 0 && e.retour_plastique === 0 && e.retour_bois === 0)
      .slice(0, 8);
  }

  private loadExpeditions() {
    const { dateFrom, dateTo } = this.dateRange();
    this.tableLoading = true;
    this.expeditionsService.list(undefined, undefined, dateFrom, dateTo).subscribe({
      next: exps => { this.expeditions = exps; this.tableLoading = false; },
      error: ()   => { this.tableLoading = false; },
    });
  }

  private dateRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (this.timeFilter === 'today') return { dateFrom: today, dateTo: today };
    if (this.timeFilter === 'week') {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      return { dateFrom: monday.toISOString().slice(0, 10), dateTo: today };
    }
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: firstDay.toISOString().slice(0, 10), dateTo: today };
  }
}
