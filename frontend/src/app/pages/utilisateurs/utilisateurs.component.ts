import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';

import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, Button, Tag, Toast, ConfirmDialog, InputText, Toolbar, IconField, InputIcon,
  ],
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

  readonly roleLabel: Record<string, string> = { admin: 'Admin', clerk: 'Clerk', livreur: 'Livreur' };
  readonly roleSeverity: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
    admin: 'danger', clerk: 'warn', livreur: 'info',
  };

  get filtered() {
    const q = this.searchQuery.toLowerCase();
    return q ? this.users.filter(u => u.full_name.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q)) : this.users;
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

  isSelf(u: User): boolean { return u.id === this.auth.currentUser()?.id; }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
