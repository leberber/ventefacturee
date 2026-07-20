import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BonsService } from '../../core/services/bons.service';
import { Bon, DashboardStats } from '../../core/models/bon.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  bls: Bon[] = [];
  loading = false;
  tableLoading = false;
  timeFilter: 'today' | 'week' | 'month' = 'today';

  readonly destinationLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly destinationBadge: Record<string, string> = { gros: 'badge badge--info', detail: 'badge badge--warning', horeca: 'badge badge--success' };

  constructor(private bonsService: BonsService) {}

  ngOnInit() {
    this.loading = true;
    this.bonsService.getDashboardStats().subscribe(s => { this.stats = s; this.loading = false; });
    this.loadBls();
  }

  setFilter(f: 'today' | 'week' | 'month') {
    this.timeFilter = f;
    this.loadBls();
  }

  private loadBls() {
    const { dateFrom, dateTo } = this.dateRange();
    this.tableLoading = true;
    this.bonsService.list(undefined, undefined, dateFrom, dateTo).subscribe({
      next: bls => { this.bls = bls; this.tableLoading = false; },
      error: ()  => { this.tableLoading = false; },
    });
  }

  private dateRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (this.timeFilter === 'today') {
      return { dateFrom: today, dateTo: today };
    }
    if (this.timeFilter === 'week') {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Monday = 0
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      return { dateFrom: monday.toISOString().slice(0, 10), dateTo: today };
    }
    // month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: firstDay.toISOString().slice(0, 10), dateTo: today };
  }
}
