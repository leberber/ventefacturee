import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { Chauffeur, ChauffeurCreate } from '../../core/models/chauffeur.model';

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    TableModule, Button, Dialog, Tag, Toast, ConfirmDialog, InputText, Toolbar, IconField, InputIcon,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './chauffeurs.component.html',
})
export class ChauffeursComponent implements OnInit {
  private chauffeursService   = inject(ChauffeursService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb                  = inject(FormBuilder);

  chauffeurs: Chauffeur[] = [];
  loading = false;
  dialogVisible = false;
  editingId: number | null = null;
  searchQuery = '';

  form = this.fb.group({
    name:  ['', Validators.required],
    phone: [''],
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.chauffeursService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.chauffeurs = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() {
    this.editingId = null;
    this.form.reset({ name: '', phone: '' });
    this.dialogVisible = true;
  }

  openEdit(c: Chauffeur) {
    this.editingId = c.id;
    this.form.patchValue({ name: c.name, phone: c.phone ?? '' });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const body: ChauffeurCreate = {
      name:  v.name!,
      phone: v.phone || undefined,
    };
    const obs = this.editingId
      ? this.chauffeursService.update(this.editingId, body)
      : this.chauffeursService.create(body);

    obs.subscribe({
      next: () => { this.dialogVisible = false; this.load(); this.toast('success', 'Chauffeur enregistré'); },
      error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
    });
  }

  confirmDelete(c: Chauffeur) {
    this.confirmationService.confirm({
      message: `Supprimer "${c.name}" ? Ses BLs seront conservés.`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.chauffeursService.delete(c.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Chauffeur supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
