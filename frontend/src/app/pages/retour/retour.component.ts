import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { LivreursService } from '../../core/services/livreurs.service';
import { BonsService } from '../../core/services/bons.service';
import { ConfigService } from '../../core/services/config.service';
import { Client } from '../../core/models/client.model';
import { BonCreate } from '../../core/models/bon.model';

type RetourField = 'retour_plastique' | 'retour_bois';

@Component({
  selector: 'app-retour',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Select, SelectButton, Button, Toast],
  providers: [MessageService],
  templateUrl: './retour.component.html',
})
export class RetourComponent implements OnInit {
  private clientsService    = inject(ClientsService);
  private chauffeursService = inject(ChauffeursService);
  private livreursService   = inject(LivreursService);
  private bonsService       = inject(BonsService);
  private configService     = inject(ConfigService);
  private messageService    = inject(MessageService);
  private router            = inject(Router);
  private fb                = inject(FormBuilder);

  clients:    { label: string; value: number }[] = [];
  chauffeurs: { label: string; value: number }[] = [];
  livreurs:   { label: string; value: number }[] = [];
  clientsMap: Map<number, Client> = new Map();
  selectedClient: Client | null = null;
  saving = false;

  // Pricing from config
  prixPlastique = 7500;
  prixBois      = 1200;

  // Consigne toggle state
  showConsignePlastique = false;
  showConsigneBois      = false;

  // Consigne local state (both sides kept in sync)
  consignePlastique = 0;
  montantPlastique  = 0;
  consigneBois      = 0;
  montantBois       = 0;

  readonly destinationOptions = [
    { label: 'Gros',   value: 'gros'   },
    { label: 'Détail', value: 'detail' },
    { label: 'Horeca', value: 'horeca' },
  ];

  form = this.fb.group({
    destination_type:   ['gros', Validators.required],
    client_id:          [null as number | null],
    livreur_id:         [null as number | null],
    chauffeur_id:       [null as number | null, Validators.required],
    retour_plastique:   [0, [Validators.required, Validators.min(0)]],
    consigne_plastique: [0, [Validators.required, Validators.min(0)]],
    retour_bois:        [0, [Validators.required, Validators.min(0)]],
    consigne_bois:      [0, [Validators.required, Validators.min(0)]],
    notes:              [''],
  });

  get isGros() { return this.form.get('destination_type')!.value === 'gros'; }
  get plasticBalance() { return this.selectedClient?.plastic_balance ?? 0; }
  get woodBalance()    { return this.selectedClient?.wood_balance ?? 0; }

  ngOnInit() {
    this.form.get('client_id')!.setValidators(Validators.required);
    this.form.get('client_id')!.updateValueAndValidity();

    this.form.get('destination_type')!.valueChanges.subscribe(type => {
      const clientCtrl  = this.form.get('client_id')!;
      const livreurCtrl = this.form.get('livreur_id')!;
      if (type === 'gros') {
        clientCtrl.setValidators(Validators.required);
        livreurCtrl.clearValidators();
        livreurCtrl.setValue(null);
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

    this.configService.get<{ consigne_plastique: number; consigne_bois: number }>('pricing').subscribe(p => {
      this.prixPlastique = p.consigne_plastique;
      this.prixBois      = p.consigne_bois;
    });
  }

  // Retour tile counter (inc/dec/set)
  inc(field: RetourField) {
    const ctrl = this.form.get(field)!;
    ctrl.setValue((ctrl.value ?? 0) + 1);
  }

  dec(field: RetourField) {
    const ctrl = this.form.get(field)!;
    const val = ctrl.value ?? 0;
    if (val > 0) ctrl.setValue(val - 1);
  }

  setQty(field: RetourField, event: Event) {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    this.form.get(field)!.setValue(isNaN(n) || n < 0 ? 0 : n);
  }

  // Consigne: qty input → update money
  onConsigneQtyInput(type: 'plastique' | 'bois', event: Event) {
    const qty = Math.max(0, parseInt((event.target as HTMLInputElement).value, 10) || 0);
    const prix = type === 'plastique' ? this.prixPlastique : this.prixBois;
    if (type === 'plastique') { this.consignePlastique = qty; this.montantPlastique = qty * prix; }
    else                      { this.consigneBois      = qty; this.montantBois      = qty * prix; }
    this.form.get(`consigne_${type}`)!.setValue(qty);
  }

  // Consigne: money input → update qty
  onConsigneMoneyInput(type: 'plastique' | 'bois', event: Event) {
    const montant = Math.max(0, parseInt((event.target as HTMLInputElement).value, 10) || 0);
    const prix = type === 'plastique' ? this.prixPlastique : this.prixBois;
    const qty = prix > 0 ? Math.round(montant / prix) : 0;
    if (type === 'plastique') { this.consignePlastique = qty; this.montantPlastique = montant; }
    else                      { this.consigneBois      = qty; this.montantBois      = montant; }
    this.form.get(`consigne_${type}`)!.setValue(qty);
  }

  toggleConsigne(type: 'plastique' | 'bois') {
    if (type === 'plastique') {
      this.showConsignePlastique = !this.showConsignePlastique;
      if (this.showConsignePlastique) {
        this.consignePlastique = this.form.get('consigne_plastique')!.value ?? 0;
        this.montantPlastique  = this.consignePlastique * this.prixPlastique;
      }
    } else {
      this.showConsigneBois = !this.showConsigneBois;
      if (this.showConsigneBois) {
        this.consigneBois = this.form.get('consigne_bois')!.value ?? 0;
        this.montantBois  = this.consigneBois * this.prixBois;
      }
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const body: BonCreate = {
      date:               new Date().toISOString().split('T')[0],
      destination_type:   v.destination_type!,
      client_id:          v.destination_type === 'gros' ? v.client_id! : null,
      livreur_id:         v.destination_type !== 'gros' ? v.livreur_id! : null,
      chauffeur_id:       v.chauffeur_id!,
      consigne_plastique: v.consigne_plastique ?? 0,
      nc_plastique:       0,
      retour_plastique:   v.retour_plastique ?? 0,
      consigne_bois:      v.consigne_bois ?? 0,
      nc_bois:            0,
      retour_bois:        v.retour_bois ?? 0,
      notes:              v.notes || undefined,
    };
    this.bonsService.create(body).subscribe({
      next: bon => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Retour enregistré — ${bon.bl_number}`, life: 4000 });
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
      destination_type: 'gros',
      client_id: null, livreur_id: null, chauffeur_id: null,
      retour_plastique: 0, consigne_plastique: 0,
      retour_bois: 0, consigne_bois: 0,
      notes: '',
    });
    this.selectedClient = null;
    this.showConsignePlastique = false;
    this.showConsigneBois      = false;
    this.consignePlastique = 0; this.montantPlastique = 0;
    this.consigneBois      = 0; this.montantBois      = 0;
    this.form.get('client_id')!.setValidators(Validators.required);
    this.form.get('livreur_id')!.clearValidators();
    this.form.get('client_id')!.updateValueAndValidity();
    this.form.get('livreur_id')!.updateValueAndValidity();
  }
}
