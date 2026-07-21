import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { AuthService } from '../../core/services/auth.service';
import { Expedition } from '../../core/models/expedition.model';

@Component({
  selector: 'app-mes-tournees',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mes-tournees.component.html',
})
export class MesTourneesComponent implements OnInit {
  private expeditionsService = inject(ExpeditionsService);
  private auth               = inject(AuthService);

  allTournees: Expedition[] = [];
  tournees: Expedition[] = [];
  restant = new Map<number, { plastique: number; bois: number }>();
  filter: 'today' | 'week' | 'month' = 'month';
  loading = true;

  readonly destinationBadge: Record<string, string> = {
    detail: 'badge badge--warning',
    horeca: 'badge badge--success',
    gros:   'badge badge--info',
  };
  readonly destinationLabel: Record<string, string> = {
    detail: 'Détail',
    horeca: 'Horeca',
    gros:   'Gros',
  };

  setFilter(f: 'today' | 'week' | 'month') {
    this.filter = f;
    this.applyFilter();
  }

  private applyFilter() {
    const now = new Date();
    if (this.filter === 'today') {
      const today = now.toISOString().slice(0, 10);
      this.tournees = this.allTournees.filter(t => t.date === today);
    } else if (this.filter === 'week') {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Monday=0
      const monday = new Date(now); monday.setDate(now.getDate() - day); monday.setHours(0,0,0,0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
      this.tournees = this.allTournees.filter(t => {
        const d = new Date(t.date);
        return d >= monday && d <= sunday;
      });
    } else {
      // month
      const y = now.getFullYear(), m = now.getMonth();
      this.tournees = this.allTournees.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    }
  }

  ngOnInit() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    this.expeditionsService.list(undefined, undefined, undefined, undefined, userId).subscribe({
      next: data => {
        this.allTournees = data;
        this.applyFilter();
        this.loading = false;
        if (data.length === 0) return;
        forkJoin(data.map(t => this.expeditionsService.getExpeditionClients(t.id))).subscribe({
          next: results => {
            results.forEach((clients, i) => {
              const t = data[i];
              const dp = clients.reduce((s, ec) => s + (ec.detail?.plastique ?? 0), 0);
              const db = clients.reduce((s, ec) => s + (ec.detail?.bois ?? 0), 0);
              this.restant.set(t.id, { plastique: t.nc_plastique - dp, bois: t.nc_bois - db });
            });
          },
        });
      },
      error: () => { this.loading = false; },
    });
  }
}
