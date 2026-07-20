import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { BonsService } from '../../core/services/bons.service';
import { Bon, ExpeditionClient, LivraisonDetailCreate } from '../../core/models/bon.model';

interface ClientInput {
  plastique: number;
  bois: number;
  retour_plastique: number;
  retour_bois: number;
  notes: string;
  saving: boolean;
}

@Component({
  selector: 'app-livraison-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Button, Toast],
  providers: [MessageService],
  templateUrl: './livraison-detail.component.html',
})
export class LivraisonDetailComponent implements OnInit {
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private bonsService    = inject(BonsService);
  private messageService = inject(MessageService);

  bl: Bon | null = null;
  expeditionClients: ExpeditionClient[] = [];
  inputs: Map<number, ClientInput> = new Map();
  loading = true;

  get blId(): number { return +this.route.snapshot.paramMap.get('id')!; }

  get recordedCount(): number {
    return this.expeditionClients.filter(ec => ec.detail).length;
  }

  ngOnInit() {
    this.bonsService.getById(this.blId).subscribe({
      next: bl => {
        this.bl = bl;
        this.loadClients();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'BL introuvable', life: 4000 });
        this.loading = false;
      },
    });
  }

  loadClients() {
    this.bonsService.getExpeditionClients(this.blId).subscribe({
      next: clients => {
        this.expeditionClients = clients;
        for (const ec of clients) {
          this.inputs.set(ec.client_id, {
            plastique:        ec.detail?.plastique        ?? 0,
            bois:             ec.detail?.bois             ?? 0,
            retour_plastique: ec.detail?.retour_plastique ?? 0,
            retour_bois:      ec.detail?.retour_bois      ?? 0,
            notes:            ec.detail?.notes            ?? '',
            saving: false,
          });
        }
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  getInput(clientId: number): ClientInput {
    return this.inputs.get(clientId)!;
  }

  inc(clientId: number, field: 'plastique' | 'bois' | 'retour_plastique' | 'retour_bois') {
    const inp = this.inputs.get(clientId)!;
    inp[field]++;
  }

  dec(clientId: number, field: 'plastique' | 'bois' | 'retour_plastique' | 'retour_bois') {
    const inp = this.inputs.get(clientId)!;
    if (inp[field] > 0) inp[field]--;
  }

  setQty(clientId: number, field: 'plastique' | 'bois' | 'retour_plastique' | 'retour_bois', event: Event) {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    this.inputs.get(clientId)![field] = isNaN(n) || n < 0 ? 0 : n;
  }

  saveDetail(clientId: number) {
    const inp = this.inputs.get(clientId)!;
    inp.saving = true;

    const body: LivraisonDetailCreate = {
      client_id:        clientId,
      plastique:        inp.plastique,
      bois:             inp.bois,
      retour_plastique: inp.retour_plastique,
      retour_bois:      inp.retour_bois,
      notes:            inp.notes || undefined,
    };

    this.bonsService.upsertDetail(this.blId, body).subscribe({
      next: detail => {
        inp.saving = false;
        // Update the local expedition client with the saved detail
        const ec = this.expeditionClients.find(c => c.client_id === clientId);
        if (ec) ec.detail = detail;
        this.messageService.add({ severity: 'success', summary: 'Enregistré', detail: `Livraison pour ${ec?.client_name} enregistrée`, life: 3000 });
      },
      error: e => {
        inp.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }
}
