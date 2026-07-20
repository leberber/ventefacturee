import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { LivreursService } from '../../core/services/livreurs.service';
import { BonsService } from '../../core/services/bons.service';
import { Client } from '../../core/models/client.model';
import { BonCreate } from '../../core/models/bon.model';

@Component({
  selector: 'app-nouveau-bl',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Select, MultiSelect, SelectButton, Button, Toast, InputText],
  providers: [MessageService],
  templateUrl: './nouveau-bl.component.html',
  styleUrl: './nouveau-bl.component.scss',
})
export class NouveauBLComponent implements OnInit {
  private clientsService    = inject(ClientsService);
  private chauffeursService = inject(ChauffeursService);
  private livreursService   = inject(LivreursService);
  private bonsService       = inject(BonsService);
  private messageService    = inject(MessageService);
  private router            = inject(Router);
  private fb                = inject(FormBuilder);

  clients: { label: string; value: number }[] = [];
  chauffeurs: { label: string; value: number }[] = [];
  livreurs: { label: string; value: number }[] = [];
  clientsMap: Map<number, Client> = new Map();
  selectedClient: Client | null = null;
  saving = false;

  readonly destinationOptions = [
    { label: 'Gros',   value: 'gros'   },
    { label: 'Détail', value: 'detail' },
    { label: 'Horeca', value: 'horeca' },
  ];

  form = this.fb.group({
    bl_number:        ['', Validators.required],
    destination_type: ['gros', Validators.required],
    client_id:        [null as number | null],
    client_ids:       [[] as number[]],
    livreur_id:       [null as number | null],
    chauffeur_id:     [null as number | null, Validators.required],
    plastique:        [0, [Validators.required, Validators.min(0)]],
    bois:             [0, [Validators.required, Validators.min(0)]],
    notes:            [''],
  });

  get isGros() { return this.form.get('destination_type')!.value === 'gros'; }

  get plasticBalance() { return this.selectedClient?.plastic_balance ?? 0; }
  get woodBalance()    { return this.selectedClient?.wood_balance ?? 0; }

  inc(field: 'plastique' | 'bois') {
    const ctrl = this.form.get(field)!;
    ctrl.setValue((ctrl.value ?? 0) + 1);
  }

  dec(field: 'plastique' | 'bois') {
    const ctrl = this.form.get(field)!;
    const val = ctrl.value ?? 0;
    if (val > 0) ctrl.setValue(val - 1);
  }

  setQty(field: 'plastique' | 'bois', event: Event) {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    this.form.get(field)!.setValue(isNaN(n) || n < 0 ? 0 : n);
  }

  ngOnInit() {
    this.form.get('client_id')!.setValidators(Validators.required);
    this.form.get('client_id')!.updateValueAndValidity();

    this.form.get('destination_type')!.valueChanges.subscribe(type => {
      const clientCtrl   = this.form.get('client_id')!;
      const clientIdsCtrl = this.form.get('client_ids')!;
      const livreurCtrl  = this.form.get('livreur_id')!;
      if (type === 'gros') {
        clientCtrl.setValidators(Validators.required);
        livreurCtrl.clearValidators();
        livreurCtrl.setValue(null);
        clientIdsCtrl.setValue([]);
      } else {
        livreurCtrl.setValidators(Validators.required);
        clientCtrl.clearValidators();
        clientCtrl.setValue(null);
        this.selectedClient = null;
      }
      clientCtrl.updateValueAndValidity();
      livreurCtrl.updateValueAndValidity();
    });

    this.clientsService.list().subscribe(data => {
      this.clients = data.map(c => ({ label: `${c.name}${c.code ? ' (' + c.code + ')' : ''}`, value: c.id }));
      data.forEach(c => this.clientsMap.set(c.id, c));
    });
    this.chauffeursService.list().subscribe(data => {
      this.chauffeurs = data.map(c => ({ label: c.name, value: c.id }));
    });
    this.livreursService.list().subscribe(data => {
      this.livreurs = data.filter(l => l.is_active).map(l => ({ label: l.name, value: l.id }));
    });

    this.form.get('client_id')!.valueChanges.subscribe(id => {
      this.selectedClient = id ? (this.clientsMap.get(id) ?? null) : null;
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const body: BonCreate = {
      bl_number:          v.bl_number!.trim(),
      date:               new Date().toISOString().split('T')[0],
      destination_type:   v.destination_type!,
      chauffeur_id:       v.chauffeur_id!,
      client_id:          v.destination_type === 'gros' ? v.client_id! : null,
      livreur_id:         v.destination_type !== 'gros' ? v.livreur_id! : null,
      client_ids:         v.destination_type !== 'gros' ? (v.client_ids ?? []) : [],
      consigne_plastique: 0,
      nc_plastique:       v.plastique ?? 0,
      retour_plastique:   0,
      consigne_bois:      0,
      nc_bois:            v.bois ?? 0,
      retour_bois:        0,
      notes:              v.notes || undefined,
    };
    this.bonsService.create(body).subscribe({
      next: bon => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Expédition ${bon.bl_number} enregistrée`, life: 4000 });
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
      bl_number: '',
      destination_type: 'gros',
      client_id: null, client_ids: [], livreur_id: null, chauffeur_id: null,
      plastique: 0, bois: 0, notes: '',
    });
    this.selectedClient = null;
    this.form.get('client_id')!.setValidators(Validators.required);
    this.form.get('livreur_id')!.clearValidators();
    this.form.get('client_id')!.updateValueAndValidity();
    this.form.get('livreur_id')!.updateValueAndValidity();
  }
}
