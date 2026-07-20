import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BonsService } from '../../core/services/bons.service';
import { ClientsService } from '../../core/services/clients.service';
import { DashboardStats } from '../../core/models/bon.model';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  clients: Client[] = [];
  loading = false;

  readonly categoryLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly categoryBadge: Record<string, string> = { gros: 'badge badge--info', detail: 'badge badge--success', horeca: 'badge badge--warning' };

  constructor(
    private bonsService: BonsService,
    private clientsService: ClientsService,
  ) {}

  ngOnInit() {
    this.loading = true;
    this.bonsService.getDashboardStats().subscribe(s => { this.stats = s; });
    this.clientsService.list().subscribe(clients => {
      this.clients = clients
        .filter(c => (c.plastic_balance ?? 0) > 0 || (c.wood_balance ?? 0) > 0)
        .sort((a, b) => ((b.plastic_balance ?? 0) + (b.wood_balance ?? 0)) - ((a.plastic_balance ?? 0) + (a.wood_balance ?? 0)));
      this.loading = false;
    });
  }
}
