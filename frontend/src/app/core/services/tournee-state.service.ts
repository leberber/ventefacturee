import { Injectable, inject, signal } from '@angular/core';
import { ExpeditionsService } from './expeditions.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TourneeStateService {
  private svc  = inject(ExpeditionsService);
  private auth = inject(AuthService);

  activeTourneeId  = signal<number | null>(null);
  activeBlNumber   = signal<string | null>(null);
  restantPlastique = signal(0);
  restantBois      = signal(0);
  deliveredCount   = signal(0);
  totalClients     = signal(0);

  updateRestant(plastique: number, bois: number) {
    this.restantPlastique.set(plastique);
    this.restantBois.set(bois);
  }

  refresh() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    this.svc.list(undefined, undefined, undefined, undefined, userId).subscribe({
      next: data => {
        const t = data.find(e => !e.is_verified) ?? data[0];
        if (!t) { this.activeTourneeId.set(null); this.activeBlNumber.set(null); this.restantPlastique.set(0); this.restantBois.set(0); this.deliveredCount.set(0); this.totalClients.set(0); return; }
        this.activeTourneeId.set(t.id);
        this.activeBlNumber.set(t.bl_number);
        this.svc.getExpeditionClients(t.id).subscribe({
          next: clients => {
            const dp = clients.reduce((s, ec) => s + (ec.detail?.plastique ?? 0), 0);
            const db = clients.reduce((s, ec) => s + (ec.detail?.bois ?? 0), 0);
            this.restantPlastique.set(t.nc_plastique - dp);
            this.restantBois.set(t.nc_bois - db);
            this.totalClients.set(clients.length);
            this.deliveredCount.set(clients.filter(ec => ec.detail).length);
          },
        });
      },
    });
  }
}
