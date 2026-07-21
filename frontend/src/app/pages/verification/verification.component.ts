import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputNumber } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { AuthService } from '../../core/services/auth.service';
import { Expedition, ExpeditionClient } from '../../core/models/expedition.model';

@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, Toast, InputNumber],
  providers: [MessageService],
  templateUrl: './verification.component.html',
})
export class VerificationComponent implements OnInit {
  private route              = inject(ActivatedRoute);
  readonly router            = inject(Router);
  private expeditionsService = inject(ExpeditionsService);
  private auth               = inject(AuthService);
  private messageService     = inject(MessageService);

  bl: Expedition | null = null;
  clients: ExpeditionClient[] = [];
  loading = true;
  verifying = false;
  retourPlastique = 0;
  retourBois = 0;

  get expeditionId(): number { return +this.route.snapshot.paramMap.get('id')!; }

  get netPlastique(): number {
    return this.clients.reduce((s, ec) => s + (ec.detail?.plastique ?? 0) - (ec.detail?.retour_plastique ?? 0), 0);
  }
  get netBois(): number {
    return this.clients.reduce((s, ec) => s + (ec.detail?.bois ?? 0) - (ec.detail?.retour_bois ?? 0), 0);
  }
  get balancePlastique(): number {
    return (this.bl?.nc_plastique ?? 0) - this.netPlastique - this.retourPlastique;
  }
  get balanceBois(): number {
    return (this.bl?.nc_bois ?? 0) - this.netBois - this.retourBois;
  }

  ngOnInit() {
    this.expeditionsService.getById(this.expeditionId).subscribe({
      next: exp => {
        this.bl = exp;
        this.retourPlastique = exp.retour_livreur_plastique ?? 0;
        this.retourBois = exp.retour_livreur_bois ?? 0;
        this.expeditionsService.getExpeditionClients(this.expeditionId).subscribe({
          next: clients => { this.clients = clients; this.loading = false; },
          error: () => { this.loading = false; },
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Expédition introuvable', life: 4000 });
        this.loading = false;
      },
    });
  }

  verify() {
    if (!this.bl) return;
    this.verifying = true;
    const userId = this.auth.currentUser()?.id;
    if (!userId) { this.verifying = false; return; }
    this.expeditionsService.verify(this.bl.id, {
      retour_livreur_plastique: this.retourPlastique,
      retour_livreur_bois:      this.retourBois,
      verified_by_id:           userId,
    }).subscribe({
      next: () => {
        this.verifying = false;
        this.messageService.add({ severity: 'success', summary: 'Vérifié', detail: `BL ${this.bl!.bl_number} confirmé`, life: 3000 });
        setTimeout(() => this.router.navigate(['/historique']), 1500);
      },
      error: e => {
        this.verifying = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }
}
