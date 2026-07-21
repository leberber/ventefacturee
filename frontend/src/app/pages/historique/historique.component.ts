import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Popover } from 'primeng/popover';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ExpeditionsService } from '../../core/services/expeditions.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { Expedition, ExpeditionUpdate } from '../../core/models/expedition.model';
import { Client } from '../../core/models/client.model';
import { sortItems, toggleSort } from '../../core/utils/sort.util';

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    Button, Dialog, Toast, ConfirmDialog, Select, InputNumber, InputText, Popover,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './historique.component.html',
})
export class HistoriqueComponent implements OnInit {
  @ViewChild('expPop') expPop!: Popover;
  activeExpedition:  Expedition | null = null;
  activeType: 'plastique' | 'bois' = 'plastique';

  openExpPop(event: Event, exp: Expedition, type: 'plastique' | 'bois') {
    this.activeExpedition = exp;
    this.activeType       = type;
    this.expPop.toggle(event);
  }

  private expeditionsService  = inject(ExpeditionsService);
  private clientsService      = inject(ClientsService);
  private usersService        = inject(UsersService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private route               = inject(ActivatedRoute);
  private fb                  = inject(FormBuilder);

  expeditions: Expedition[] = [];
  loading = false;
  dialogVisible = false;
  editingId: number | null = null;

  sortCol = 'date';
  sortDir: 1 | -1 = -1;

  readonly destinationBadge: Record<string, string> = {
    gros:   'badge badge--info',
    detail: 'badge badge--warning',
    horeca: 'badge badge--success',
  };
  readonly destinationLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };

  get sorted(): Expedition[] { return sortItems(this.expeditions, this.sortCol as keyof Expedition, this.sortDir); }

  sortBy(col: string) {
    const s = toggleSort(this.sortCol, this.sortDir, col);
    this.sortCol = s.col; this.sortDir = s.dir;
  }

  clientOptions: { label: string; value: number | null }[] = [{ label: 'Tous les clients', value: null }];
  chauffeurOptions: { label: string; value: number }[] = [];
  livreurOptions: { label: string; value: number }[] = [];
  clientsMap: Map<number, Client> = new Map();
  selectedClientId: number | null = null;
  editingDestinationType: string = 'gros';

  form = this.fb.group({
    client_id:    [null as number | null],
    livreur_id:   [null as number | null],
    chauffeur_id: [null as number | null, Validators.required],
    nc_plastique: [0, [Validators.required, Validators.min(0)]],
    nc_bois:      [0, [Validators.required, Validators.min(0)]],
    notes:        [''],
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
      data.forEach(c => this.clientsMap.set(c.id, c));
    });
    this.usersService.listByRole('chauffeur').subscribe(data => {
      this.chauffeurOptions = data.filter(u => u.is_active).map(u => ({ label: u.full_name, value: u.id }));
    });
    this.usersService.listByRole('livreur').subscribe(data => {
      this.livreurOptions = data.filter(u => u.is_active).map(u => ({ label: u.full_name, value: u.id }));
    });
  }

  load() {
    this.loading = true;
    this.expeditionsService.list(this.selectedClientId ?? undefined).subscribe({
      next: data => { this.expeditions = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openEdit(exp: Expedition) {
    this.editingId = exp.id;
    this.editingDestinationType = exp.destination_type;
    this.form.patchValue({
      client_id:    exp.client_id ?? null,
      livreur_id:   exp.livreur_id ?? null,
      chauffeur_id: exp.chauffeur_id,
      nc_plastique: exp.nc_plastique,
      nc_bois:      exp.nc_bois,
      notes:        exp.notes ?? '',
    });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid || !this.editingId) return;
    const v = this.form.value;
    const body: ExpeditionUpdate = {
      chauffeur_id: v.chauffeur_id!,
      client_id:    v.client_id ?? undefined,
      livreur_id:   v.livreur_id ?? undefined,
      nc_plastique: v.nc_plastique ?? 0,
      nc_bois:      v.nc_bois ?? 0,
      notes:        v.notes || undefined,
    };
    this.expeditionsService.update(this.editingId, body).subscribe({
      next: () => { this.dialogVisible = false; this.load(); this.toast('success', 'Expédition mise à jour'); },
      error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
    });
  }

  confirmDelete(exp: Expedition) {
    this.confirmationService.confirm({
      message: `Supprimer l'expédition ${exp.bl_number} ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.expeditionsService.delete(exp.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Expédition supprimée'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
