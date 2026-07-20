import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { LivreursService } from '../../../core/services/livreurs.service';
import { Livreur, LivreurCreate } from '../../../core/models/livreur.model';

@Component({
  selector: 'app-livreur-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, Toast, InputText],
  providers: [MessageService],
  templateUrl: './livreur-form.component.html',
})
export class LivreurFormComponent implements OnInit {
  private livreursService = inject(LivreursService);
  private messageService  = inject(MessageService);
  private fb              = inject(FormBuilder);
  private router          = inject(Router);
  private route           = inject(ActivatedRoute);

  editingId: number | null = null;
  saving = false;

  form = this.fb.group({
    name:  ['', Validators.required],
    phone: [''],
  });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editingId = +idParam;
      const state = history.state as { livreur?: Livreur };
      if (state?.livreur) {
        this.form.patchValue({ name: state.livreur.name, phone: state.livreur.phone ?? '' });
      } else {
        this.router.navigate(['/livreurs']);
      }
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const body: LivreurCreate = { name: v.name!, phone: v.phone || undefined };
    const obs = this.editingId
      ? this.livreursService.update(this.editingId, body)
      : this.livreursService.create(body);

    obs.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Livreur enregistré', life: 3000 });
        setTimeout(() => this.router.navigate(['/livreurs']), 1000);
      },
      error: e => {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  cancel() { this.router.navigate(['/livreurs']); }
}
