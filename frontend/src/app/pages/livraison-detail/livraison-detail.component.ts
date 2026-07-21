import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { ClientsService } from '../../core/services/clients.service';
import { TourneeStateService } from '../../core/services/tournee-state.service';
import { Expedition, ExpeditionClient, LivraisonDetailCreate } from '../../core/models/expedition.model';

interface ClientInput {
  plastique: number;
  bois: number;
  retour_plastique: number;
  retour_bois: number;
  notes: string;
  saving: boolean;
  locating: boolean;
  lat?: number;
  lng?: number;
}

@Component({
  selector: 'app-livraison-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, Toast, Dialog],
  providers: [MessageService, ClientsService],
  templateUrl: './livraison-detail.component.html',
})
export class LivraisonDetailComponent implements OnInit {
  private route              = inject(ActivatedRoute);
  readonly router            = inject(Router);
  private expeditionsService = inject(ExpeditionsService);
  private clientsService     = inject(ClientsService);
  private tourneeState       = inject(TourneeStateService);
  private messageService     = inject(MessageService);

  bl: Expedition | null = null;
  expeditionClients: ExpeditionClient[] = [];
  inputs: Map<number, ClientInput> = new Map();
  loading = true;
  activeClientId: number | null = null;
  showTerminerDialog = false;

  get allRecorded(): boolean {
    return this.expeditionClients.length > 0 && this.expeditionClients.every(ec => ec.detail);
  }

  get isConfirmed(): boolean {
    return this.bl?.livreur_confirmed ?? false;
  }

  get totalRetourPlastique(): number {
    return this.expeditionClients.reduce((s, ec) => s + (ec.detail?.retour_plastique ?? 0), 0);
  }

  get totalRetourBois(): number {
    return this.expeditionClients.reduce((s, ec) => s + (ec.detail?.retour_bois ?? 0), 0);
  }

  get expeditionId(): number { return +this.route.snapshot.paramMap.get('id')!; }

  get recordedCount(): number {
    return this.expeditionClients.filter(ec => ec.detail).length;
  }

  get restantPlastique(): number {
    const distributed = Array.from(this.inputs.values()).reduce((s, inp) => s + inp.plastique, 0);
    return (this.bl?.nc_plastique ?? 0) - distributed;
  }

  get restantBois(): number {
    const distributed = Array.from(this.inputs.values()).reduce((s, inp) => s + inp.bois, 0);
    return (this.bl?.nc_bois ?? 0) - distributed;
  }

  ngOnInit() {
    this.expeditionsService.getById(this.expeditionId).subscribe({
      next: exp => {
        this.bl = exp;
        this.loadClients();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Expédition introuvable', life: 4000 });
        this.loading = false;
      },
    });
  }

  loadClients() {
    this.expeditionsService.getExpeditionClients(this.expeditionId).subscribe({
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
            locating: false,
          });
        }
        this.activeClientId = null;
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
    const inp = this.inputs.get(clientId)!;
    let n = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(n) || n < 0) n = 0;
    inp[field] = n;
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

    this.expeditionsService.upsertDetail(this.expeditionId, body).subscribe({
      next: detail => {
        inp.saving = false;
        const ec = this.expeditionClients.find(c => c.client_id === clientId);
        if (ec) ec.detail = detail;

        // Save captured GPS location to the client record
        if (inp.lat && inp.lng) {
          this.clientsService.update(clientId, { latitude: inp.lat, longitude: inp.lng }).subscribe({
            next: () => { inp.lat = undefined; inp.lng = undefined; },
          });
        }

        this.tourneeState.refresh();
        this.messageService.add({ severity: 'success', summary: 'Enregistré', detail: `Livraison pour ${ec?.client_name} enregistrée`, life: 3000 });
        this.activeClientId = null;
      },
      error: e => {
        inp.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  confirmLivraison() {
    this.expeditionsService.confirmLivraison(this.expeditionId).subscribe({
      next: bl => {
        this.bl = bl;
        this.showTerminerDialog = false;
        this.tourneeState.refresh();
        this.messageService.add({ severity: 'success', summary: 'Tournée confirmée', detail: 'La tournée est en attente de confirmation par l\'équipe.', life: 5000 });
      },
      error: e => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  toggleCard(clientId: number) {
    this.activeClientId = this.activeClientId === clientId ? null : clientId;
  }

  clearIfZero(event: Event) {
    const el = event.target as HTMLInputElement;
    if (el.value === '0') el.value = '';
  }

  captureLocation(clientId: number) {
    if (!('geolocation' in navigator)) {
      this.messageService.add({ severity: 'warn', summary: 'Non supporté', detail: 'Géolocalisation non disponible', life: 3000 });
      return;
    }
    const inp = this.inputs.get(clientId)!;
    inp.locating = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        inp.locating = false;
        inp.lat = pos.coords.latitude;
        inp.lng = pos.coords.longitude;
      },
      err => {
        inp.locating = false;
        const msg = err.code === 1
          ? 'Accès refusé. Vérifiez les permissions.'
          : 'Position introuvable.';
        this.messageService.add({ severity: 'error', summary: 'Localisation', detail: msg, life: 4000 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
}
