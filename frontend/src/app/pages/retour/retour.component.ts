import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputNumber } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { ClientsService } from '../../core/services/clients.service';
import { ConfigService } from '../../core/services/config.service';
import { AuthService } from '../../core/services/auth.service';
import { Expedition, RetourCreate, ExpeditionClient } from '../../core/models/expedition.model';
import { Client } from '../../core/models/client.model';

type RetourField = 'retour_plastique' | 'retour_bois';

@Component({
  selector: 'app-retour',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule, Select, Button, Toast, InputNumber],
  providers: [MessageService],
  templateUrl: './retour.component.html',
})
export class RetourComponent implements OnInit {
  private expeditionsService = inject(ExpeditionsService);
  private clientsService     = inject(ClientsService);
  private configService      = inject(ConfigService);
  private authService        = inject(AuthService);
  private messageService     = inject(MessageService);
  private router             = inject(Router);
  private route              = inject(ActivatedRoute);
  private fb                 = inject(FormBuilder);

  expeditionOptions: { label: string; value: number; expedition: Expedition }[] = [];
  clientsMap:         Map<number, Client> = new Map();
  selectedExpedition: Expedition | null = null;
  selectedClient:     Client | null = null;
  selectedExpeditionId: number | null = null;
  saving = false;

  readonly typeLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly typeBadge: Record<string, string> = { gros: 'badge badge--info', detail: 'badge badge--warning', horeca: 'badge badge--success' };

  prixPlastique = 7500;
  prixBois      = 1200;

  showConsignePlastique = false;
  showConsigneBois      = false;

  consignePlastique = 0;
  montantPlastique  = 0;
  consigneBois      = 0;
  montantBois       = 0;

  // Verify state (detail/horeca)
  verifyClients: ExpeditionClient[] = [];
  verifyLoading = false;
  retourLivreurPlastique = 0;
  retourLivreurBois      = 0;

  get isGros(): boolean { return this.selectedExpedition?.destination_type === 'gros'; }

  get netPlastique(): number {
    return this.verifyClients.reduce((s, ec) => s + (ec.detail?.plastique ?? 0), 0);
  }
  get netBois(): number {
    return this.verifyClients.reduce((s, ec) => s + (ec.detail?.bois ?? 0), 0);
  }
  get balancePlastique(): number {
    return (this.selectedExpedition?.nc_plastique ?? 0) - this.netPlastique - this.retourLivreurPlastique;
  }
  get balanceBois(): number {
    return (this.selectedExpedition?.nc_bois ?? 0) - this.netBois - this.retourLivreurBois;
  }

  form = this.fb.group({
    retour_plastique:        [0, [Validators.required, Validators.min(0)]],
    consigne_paid_plastique: [0, [Validators.required, Validators.min(0)]],
    retour_bois:             [0, [Validators.required, Validators.min(0)]],
    consigne_paid_bois:      [0, [Validators.required, Validators.min(0)]],
    notes:                   [''],
  });

  ngOnInit() {
    this.configService.get<{ consigne_plastique: number; consigne_bois: number }>('pricing').subscribe(p => {
      this.prixPlastique = p.consigne_plastique;
      this.prixBois      = p.consigne_bois;
    });

    this.clientsService.list().subscribe(data => {
      data.forEach(c => this.clientsMap.set(c.id, c));
    });

    const dateTo   = new Date().toISOString().slice(0, 10);
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    this.expeditionsService.list(undefined, undefined, dateFrom, dateTo).subscribe(exps => {
      this.expeditionOptions = exps.map(e => ({
        label: `${e.bl_number}${e.client_name ? ' — ' + e.client_name : e.livreur_name ? ' — ' + e.livreur_name : ''} (${e.date})`,
        value: e.id,
        expedition: e,
      }));
      // Pre-select via query param (e.g. from historique shield link)
      const preId = this.route.snapshot.queryParamMap.get('expeditionId');
      if (preId) {
        const id = +preId;
        this.selectedExpeditionId = id;
        this.onExpeditionSelect(id);
      }
    });
  }

  onExpeditionSelect(expId: number | null) {
    if (!expId) { this.selectedExpedition = null; this.verifyClients = []; return; }
    const opt = this.expeditionOptions.find(o => o.value === expId);
    this.selectedExpedition = opt?.expedition ?? null;
    this.selectedClient = this.selectedExpedition?.client_id
      ? (this.clientsMap.get(this.selectedExpedition.client_id) ?? null)
      : null;
    this.form.patchValue({ retour_plastique: 0, consigne_paid_plastique: 0, retour_bois: 0, consigne_paid_bois: 0, notes: '' });

    if (this.selectedExpedition && this.selectedExpedition.destination_type !== 'gros') {
      this.verifyLoading = true;
      this.retourLivreurPlastique = this.selectedExpedition.retour_livreur_plastique ?? 0;
      this.retourLivreurBois      = this.selectedExpedition.retour_livreur_bois ?? 0;
      this.expeditionsService.getExpeditionClients(expId).subscribe({
        next: clients => { this.verifyClients = clients; this.verifyLoading = false; },
        error: ()      => { this.verifyLoading = false; },
      });
    } else {
      this.verifyClients = [];
    }
  }

  incLivreur(field: 'plastique' | 'bois') {
    if (field === 'plastique') this.retourLivreurPlastique++;
    else this.retourLivreurBois++;
  }

  decLivreur(field: 'plastique' | 'bois') {
    if (field === 'plastique') { if (this.retourLivreurPlastique > 0) this.retourLivreurPlastique--; }
    else { if (this.retourLivreurBois > 0) this.retourLivreurBois--; }
  }

  setLivreurQty(field: 'plastique' | 'bois', event: Event) {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    const val = isNaN(n) || n < 0 ? 0 : n;
    if (field === 'plastique') this.retourLivreurPlastique = val;
    else this.retourLivreurBois = val;
  }

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

  onConsigneQtyInput(type: 'plastique' | 'bois', event: Event) {
    const qty = Math.max(0, parseInt((event.target as HTMLInputElement).value, 10) || 0);
    const prix = type === 'plastique' ? this.prixPlastique : this.prixBois;
    if (type === 'plastique') { this.consignePlastique = qty; this.montantPlastique = qty * prix; }
    else                      { this.consigneBois      = qty; this.montantBois      = qty * prix; }
    this.form.get(`consigne_paid_${type}`)!.setValue(qty);
  }

  onConsigneMoneyInput(type: 'plastique' | 'bois', event: Event) {
    const montant = Math.max(0, parseInt((event.target as HTMLInputElement).value, 10) || 0);
    const prix = type === 'plastique' ? this.prixPlastique : this.prixBois;
    const qty = prix > 0 ? Math.round(montant / prix) : 0;
    if (type === 'plastique') { this.consignePlastique = qty; this.montantPlastique = montant; }
    else                      { this.consigneBois      = qty; this.montantBois      = montant; }
    this.form.get(`consigne_paid_${type}`)!.setValue(qty);
  }

  toggleConsigne(type: 'plastique' | 'bois') {
    if (type === 'plastique') {
      this.showConsignePlastique = !this.showConsignePlastique;
      if (this.showConsignePlastique) {
        this.consignePlastique = this.form.get('consigne_paid_plastique')!.value ?? 0;
        this.montantPlastique  = this.consignePlastique * this.prixPlastique;
      }
    } else {
      this.showConsigneBois = !this.showConsigneBois;
      if (this.showConsigneBois) {
        this.consigneBois = this.form.get('consigne_paid_bois')!.value ?? 0;
        this.montantBois  = this.consigneBois * this.prixBois;
      }
    }
  }

  save() {
    if (!this.selectedExpeditionId || !this.selectedExpedition) return;
    this.saving = true;

    if (!this.isGros) {
      const userId = this.authService.currentUser()?.id;
      if (!userId) { this.saving = false; return; }
      this.expeditionsService.verify(this.selectedExpeditionId, {
        retour_livreur_plastique: this.retourLivreurPlastique,
        retour_livreur_bois:      this.retourLivreurBois,
        verified_by_id:           userId,
      }).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: `BL ${this.selectedExpedition!.bl_number} vérifié`, life: 4000 });
          setTimeout(() => this.router.navigate(['/historique']), 1500);
        },
        error: e => {
          this.saving = false;
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
        },
      });
    } else {
      if (this.form.invalid) { this.saving = false; return; }
      const v = this.form.value;
      const body: RetourCreate = {
        date:                    new Date().toISOString().split('T')[0],
        retour_plastique:        v.retour_plastique ?? 0,
        consigne_paid_plastique: v.consigne_paid_plastique ?? 0,
        retour_bois:             v.retour_bois ?? 0,
        consigne_paid_bois:      v.consigne_paid_bois ?? 0,
        notes:                   v.notes || undefined,
      };
      this.expeditionsService.createRetour(this.selectedExpeditionId, body).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Retour enregistré — ${this.selectedExpedition!.bl_number}`, life: 4000 });
          setTimeout(() => this.router.navigate(['/historique']), 1500);
        },
        error: e => {
          this.saving = false;
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
        },
      });
    }
  }

  reset() {
    this.form.reset({ retour_plastique: 0, consigne_paid_plastique: 0, retour_bois: 0, consigne_paid_bois: 0, notes: '' });
    this.selectedExpedition = null;
    this.selectedClient = null;
    this.selectedExpeditionId = null;
    this.showConsignePlastique = false;
    this.showConsigneBois      = false;
    this.consignePlastique = 0; this.montantPlastique = 0;
    this.consigneBois      = 0; this.montantBois      = 0;
    this.verifyClients = [];
    this.retourLivreurPlastique = 0;
    this.retourLivreurBois      = 0;
  }
}
