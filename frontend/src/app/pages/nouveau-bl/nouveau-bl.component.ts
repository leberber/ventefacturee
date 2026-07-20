import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputNumber } from 'primeng/inputnumber';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { BonsService } from '../../core/services/bons.service';
import { Client } from '../../core/models/client.model';
import { BonCreate } from '../../core/models/bon.model';

@Component({
  selector: 'app-nouveau-bl',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Select, Button, Toast, InputNumber, Tag],
  providers: [MessageService],
  templateUrl: './nouveau-bl.component.html',
})
export class NouveauBLComponent implements OnInit {
  private clientsService  = inject(ClientsService);
  private chauffeursService = inject(ChauffeursService);
  private bonsService     = inject(BonsService);
  private messageService  = inject(MessageService);
  private router          = inject(Router);
  private fb              = inject(FormBuilder);

  clients: { label: string; value: number }[] = [];
  chauffeurs: { label: string; value: number }[] = [];
  clientsMap: Map<number, Client> = new Map();
  selectedClient: Client | null = null;
  saving = false;

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
    this.clientsService.list().subscribe(data => {
      this.clients = data.map(c => ({ label: `${c.name}${c.code ? ' (' + c.code + ')' : ''}`, value: c.id }));
      data.forEach(c => this.clientsMap.set(c.id, c));
    });
    this.chauffeursService.list().subscribe(data => {
      this.chauffeurs = data.map(c => ({ label: c.name, value: c.id }));
    });
    this.form.get('client_id')!.valueChanges.subscribe(id => {
      this.selectedClient = id ? (this.clientsMap.get(id) ?? null) : null;
    });
  }

  get plasticBalance() { return this.selectedClient?.plastic_balance ?? 0; }
  get plasticConsigne() { return this.selectedClient?.plastic_consigne ?? 0; }
  get plasticNc()      { return this.selectedClient?.plastic_nc ?? 0; }
  get woodBalance()    { return this.selectedClient?.wood_balance ?? 0; }
  get woodConsigne()   { return this.selectedClient?.wood_consigne ?? 0; }
  get woodNc()         { return this.selectedClient?.wood_nc ?? 0; }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const today = new Date().toISOString().split('T')[0];
    const body: BonCreate = {
      date:               today,
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
    this.bonsService.create(body).subscribe({
      next: bon => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: `BL ${bon.bl_number} créé`, life: 4000 });
        setTimeout(() => this.router.navigate(['/historique']), 1500);
      },
      error: e => {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  reset() {
    this.form.reset({
      client_id: null, chauffeur_id: null,
      consigne_plastique: 0, nc_plastique: 0, retour_plastique: 0,
      consigne_bois: 0, nc_bois: 0, retour_bois: 0,
      notes: '',
    });
    this.selectedClient = null;
  }
}
