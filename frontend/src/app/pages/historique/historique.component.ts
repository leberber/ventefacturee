import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Select } from 'primeng/select';
import { Toolbar } from 'primeng/toolbar';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MessageService, ConfirmationService } from 'primeng/api';

import { BonsService } from '../../core/services/bons.service';
import { ClientsService } from '../../core/services/clients.service';
import { Bon, BonUpdate } from '../../core/models/bon.model';
import { Client } from '../../core/models/client.model';
import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { Chauffeur } from '../../core/models/chauffeur.model';

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    TableModule, Button, Dialog, Tag, Toast, ConfirmDialog, Select, Toolbar, InputNumber, InputText,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './historique.component.html',
})
export class HistoriqueComponent implements OnInit {
  private bonsService         = inject(BonsService);
  private clientsService      = inject(ClientsService);
  private chauffeursService   = inject(ChauffeursService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private route               = inject(ActivatedRoute);
  private fb                  = inject(FormBuilder);

  bons: Bon[] = [];
  loading = false;
  dialogVisible = false;
  editingId: number | null = null;

  clientOptions: { label: string; value: number | null }[] = [{ label: 'Tous les clients', value: null }];
  chauffeurOptions: { label: string; value: number }[] = [];
  selectedClientId: number | null = null;

  form = this.fb.group({
    client_id:          [null as number | null, Validators.required],
    chauffeur_id:       [null as number | null, Validators.required],
    consigne_plastique: [0, [Validators.required, Validators.min(0)]],
    nc_plastique:       [0, [Validators.required, Validators.min(0)]],
    retour_plastique:   [0, [Validators.required, Validators.min(0)]],
    consigne_bois:      [0, [Validators.required, Validators.min(0)]],
    nc_bois:            [0, [Validators.required, Validators.min(0)]],
    retour_bois:        [0, [Validators.required, Validators.min(0)]],
    notes:              [''],
  });

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const id = params.get('clientId');
      this.selectedClientId = id ? +id : null;
      this.load();
    });
    this.clientsService.list().subscribe(data => {
      this.clientOptions = [
        { label: 'Tous les clients', value: null },
        ...data.map((c: Client) => ({ label: c.name, value: c.id })),
      ];
    });
    this.chauffeursService.list().subscribe(data => {
      this.chauffeurOptions = data.map((c: Chauffeur) => ({ label: c.name, value: c.id }));
    });
  }

  load() {
    this.loading = true;
    this.bonsService.list(this.selectedClientId ?? undefined).subscribe({
      next: data => { this.bons = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openEdit(bon: Bon) {
    this.editingId = bon.id;
    this.form.patchValue({
      client_id:          bon.client_id,
      chauffeur_id:       bon.chauffeur_id,
      consigne_plastique: bon.consigne_plastique,
      nc_plastique:       bon.nc_plastique,
      retour_plastique:   bon.retour_plastique,
      consigne_bois:      bon.consigne_bois,
      nc_bois:            bon.nc_bois,
      retour_bois:        bon.retour_bois,
      notes:              bon.notes ?? '',
    });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid || !this.editingId) return;
    const v = this.form.value;
    const body: BonUpdate = {
      client_id:          v.client_id!,
      chauffeur_id:       v.chauffeur_id!,
      consigne_plastique: v.consigne_plastique ?? 0,
      nc_plastique:       v.nc_plastique ?? 0,
      retour_plastique:   v.retour_plastique ?? 0,
      consigne_bois:      v.consigne_bois ?? 0,
      nc_bois:            v.nc_bois ?? 0,
      retour_bois:        v.retour_bois ?? 0,
      notes:              v.notes || undefined,
    };
    this.bonsService.update(this.editingId, body).subscribe({
      next: () => { this.dialogVisible = false; this.load(); this.toast('success', 'BL mis à jour'); },
      error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
    });
  }

  confirmDelete(bon: Bon) {
    this.confirmationService.confirm({
      message: `Supprimer le BL ${bon.bl_number} ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.bonsService.delete(bon.id).subscribe({
          next: () => { this.load(); this.toast('success', 'BL supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
