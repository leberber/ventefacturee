import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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

  tournees: Expedition[] = [];
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

  ngOnInit() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    this.expeditionsService.list(undefined, undefined, undefined, undefined, userId).subscribe({
      next: data => { this.tournees = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
