import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { LivreursService } from '../../core/services/livreurs.service';
import { Livreur } from '../../core/models/livreur.model';

@Component({
  selector: 'app-livreurs',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, ConfirmDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './livreurs.component.html',
})
export class LivreursComponent implements OnInit {
  private livreursService     = inject(LivreursService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router              = inject(Router);

  livreurs: Livreur[] = [];
  loading = false;
  searchQuery = '';
  sortCol = 'name';
  sortDir: 1 | -1 = 1;

  get sorted(): Livreur[] {
    const col = this.sortCol as keyof Livreur;
    return [...this.livreurs].sort((a, b) => {
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
    this.livreursService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.livreurs = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() { this.router.navigate(['/livreurs/nouveau']); }

  openEdit(l: Livreur) {
    this.router.navigate(['/livreurs', l.id, 'modifier'], { state: { livreur: l } });
  }

  confirmDelete(l: Livreur) {
    this.confirmationService.confirm({
      message: `Supprimer "${l.name}" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.livreursService.delete(l.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Livreur supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
