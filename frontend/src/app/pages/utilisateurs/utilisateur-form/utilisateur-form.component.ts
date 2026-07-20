import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserCreate, UserUpdate, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-utilisateur-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, Toast, InputText, Password, Select],
  providers: [MessageService],
  templateUrl: './utilisateur-form.component.html',
})
export class UtilisateurFormComponent implements OnInit {
  private usersService   = inject(UsersService);
  private messageService = inject(MessageService);
  private fb             = inject(FormBuilder);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  auth                   = inject(AuthService);

  editingId: number | null = null;
  saving = false;

  readonly roleOptions = [
    { label: 'Admin',   value: 'admin'   },
    { label: 'Employé', value: 'employe' },
  ];

  form = this.fb.group({
    phone:     ['', Validators.required],
    full_name: ['', Validators.required],
    password:  [''],
    role:      ['employe' as UserRole, Validators.required],
    is_active: [true],
  });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editingId = +idParam;
      const state = history.state as { utilisateur?: User };
      if (state?.utilisateur) {
        const u = state.utilisateur;
        this.form.patchValue({ phone: u.phone, full_name: u.full_name, role: u.role, is_active: u.is_active, password: '' });
      } else {
        this.router.navigate(['/utilisateurs']);
      }
    } else {
      this.form.get('password')!.setValidators(Validators.required);
      this.form.get('password')!.updateValueAndValidity();
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;

    if (this.editingId) {
      const body: UserUpdate = { full_name: v.full_name!, phone: v.phone!, role: v.role as UserRole, is_active: v.is_active! };
      if (v.password) body.password = v.password;
      this.usersService.update(this.editingId, body).subscribe({
        next: () => this.done('Utilisateur modifié'),
        error: e => this.err(e),
      });
    } else {
      const body: UserCreate = { phone: v.phone!, full_name: v.full_name!, password: v.password!, role: v.role as UserRole };
      this.usersService.create(body).subscribe({
        next: () => this.done('Utilisateur créé'),
        error: e => this.err(e),
      });
    }
  }

  private done(detail: string) {
    this.messageService.add({ severity: 'success', summary: 'Succès', detail, life: 3000 });
    setTimeout(() => this.router.navigate(['/utilisateurs']), 1000);
  }

  private err(e: any) {
    this.saving = false;
    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
  }

  cancel() { this.router.navigate(['/utilisateurs']); }
}
