import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Toast, ConfirmDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.component.html',
})
export class ClientsComponent implements OnInit {
  private clientsService      = inject(ClientsService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router              = inject(Router);

  clients: Client[] = [];
  loading = false;
  searchQuery = '';
  sortCol = 'name';
  sortDir: 1 | -1 = 1;

  readonly categoryLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly categoryBadge: Record<string, string> = {
    gros: 'badge badge--info', detail: 'badge badge--success', horeca: 'badge badge--warning',
  };

  get sorted(): Client[] {
    const col = this.sortCol as keyof Client;
    return [...this.clients].sort((a, b) => {
      const av = (a[col] ?? '') as any;
      const bv = (b[col] ?? '') as any;
      if (av < bv) return -this.sortDir;
      if (av > bv) return this.sortDir;
      return 0;
    });
  }

  sortBy(col: string) {
    if (this.sortCol === col) this.sortDir = this.sortDir === 1 ? -1 : 1;
    else { this.sortCol = col; this.sortDir = 1; }
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.clientsService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.clients = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() { this.router.navigate(['/clients/nouveau']); }

  openEdit(c: Client) {
    this.router.navigate(['/clients', c.id, 'modifier'], { state: { client: c } });
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
