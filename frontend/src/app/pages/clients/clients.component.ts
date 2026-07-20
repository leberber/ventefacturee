import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { Client, ClientCategory, ClientCreate } from '../../core/models/client.model';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    TableModule, Button, Dialog, Tag, Toast, ConfirmDialog, InputText, Select, Toolbar, IconField, InputIcon,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.component.html',
})
export class ClientsComponent implements OnInit {
  private clientsService      = inject(ClientsService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb                  = inject(FormBuilder);

  clients: Client[] = [];
  loading = false;
  dialogVisible = false;
  editingId: number | null = null;
  searchQuery = '';

  categoryOptions = [
    { label: 'Gros',   value: 'gros'   },
    { label: 'Détail', value: 'detail' },
    { label: 'Horeca', value: 'horeca' },
  ];

  readonly categoryLabel: Record<string, string>   = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly categorySeverity: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = { gros: 'info', detail: 'success', horeca: 'warn' };

  form = this.fb.group({
    code:     [''],
    name:     ['', Validators.required],
    phone:    [''],
    category: ['gros' as ClientCategory, Validators.required],
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.clientsService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.clients = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() {
    this.editingId = null;
    this.form.reset({ code: '', name: '', phone: '', category: 'gros' });
    this.dialogVisible = true;
  }

  openEdit(c: Client) {
    this.editingId = c.id;
    this.form.patchValue({ code: c.code ?? '', name: c.name, phone: c.phone ?? '', category: c.category });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const body: ClientCreate = {
      code:     v.code || undefined,
      name:     v.name!,
      phone:    v.phone || undefined,
      category: v.category as ClientCategory,
    };
    const obs = this.editingId
      ? this.clientsService.update(this.editingId, body)
      : this.clientsService.create(body);

    obs.subscribe({
      next: () => { this.dialogVisible = false; this.load(); this.toast('success', 'Client enregistré'); },
      error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
    });
  }

  confirmDelete(c: Client) {
    this.confirmationService.confirm({
      message: `Supprimer "${c.name}" ? Ses BLs seront conservés.`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.clientsService.delete(c.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Client supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
