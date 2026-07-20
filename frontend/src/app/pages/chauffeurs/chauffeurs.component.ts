import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ChauffeursService } from '../../core/services/chauffeurs.service';
import { Chauffeur } from '../../core/models/chauffeur.model';
import { sortItems, toggleSort } from '../../core/utils/sort.util';

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, ConfirmDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './chauffeurs.component.html',
})
export class ChauffeursComponent implements OnInit {
  private chauffeursService   = inject(ChauffeursService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router              = inject(Router);

  chauffeurs: Chauffeur[] = [];
  loading = false;
  searchQuery = '';
  sortCol = 'name';
  sortDir: 1 | -1 = 1;

  get sorted(): Chauffeur[] { return sortItems(this.chauffeurs, this.sortCol as keyof Chauffeur, this.sortDir); }

  sortBy(col: string) {
    const s = toggleSort(this.sortCol, this.sortDir, col);
    this.sortCol = s.col; this.sortDir = s.dir;
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.chauffeursService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.chauffeurs = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() { this.router.navigate(['/chauffeurs/nouveau']); }

  openEdit(c: Chauffeur) {
    this.router.navigate(['/chauffeurs', c.id, 'modifier'], { state: { chauffeur: c } });
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
