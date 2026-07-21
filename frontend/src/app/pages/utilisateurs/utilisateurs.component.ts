import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { sortItems, toggleSort } from '../../core/utils/sort.util';

import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, ConfirmDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './utilisateurs.component.html',
})
export class UtilisateursComponent implements OnInit {
  private usersService        = inject(UsersService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router              = inject(Router);
  auth                        = inject(AuthService);

  users: User[] = [];
  loading = false;
  searchQuery = '';
  sortCol = 'full_name';
  sortDir: 1 | -1 = 1;

  readonly roleLabel: Record<string, string> = { admin: 'Admin', employe: 'Employé', livreur: 'Livreur', chauffeur: 'Chauffeur' };
  readonly roleBadge: Record<string, string> = {
    admin:     'badge badge--danger',
    employe:   'badge badge--warning',
    livreur:   'badge badge--info',
    chauffeur: 'badge badge--success',
  };

  get sorted(): User[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = q ? this.users.filter(u => u.full_name.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q)) : this.users;
    return sortItems(filtered, this.sortCol as keyof User, this.sortDir);
  }

  sortBy(col: string) {
    const s = toggleSort(this.sortCol, this.sortDir, col);
    this.sortCol = s.col; this.sortDir = s.dir;
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.usersService.list().subscribe({
      next: data => { this.users = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() { this.router.navigate(['/utilisateurs/nouveau']); }

  openEdit(u: User) {
    this.router.navigate(['/utilisateurs', u.id, 'modifier'], { state: { utilisateur: u } });
  }

  confirmDelete(u: User) {
    this.confirmationService.confirm({
      message: `Supprimer "${u.full_name}" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.usersService.delete(u.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Utilisateur supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  get isAdmin(): boolean { return this.auth.isAdmin; }

  formatPhone(phone: string): string {
    const d = phone.replace(/\s/g, '');
    return d.length === 10
      ? `${d.slice(0,4)} ${d.slice(4,6)} ${d.slice(6,8)} ${d.slice(8,10)}`
      : phone;
  }

  isSelf(u: User): boolean { return u.id === this.auth.currentUser()?.id; }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
