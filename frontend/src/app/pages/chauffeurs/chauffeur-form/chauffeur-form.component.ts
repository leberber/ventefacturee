import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { ChauffeursService } from '../../../core/services/chauffeurs.service';
import { Chauffeur, ChauffeurCreate } from '../../../core/models/chauffeur.model';

@Component({
  selector: 'app-chauffeur-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, Toast, InputText],
  providers: [MessageService],
  templateUrl: './chauffeur-form.component.html',
})
export class ChauffeurFormComponent implements OnInit {
  private chauffeursService = inject(ChauffeursService);
  private messageService    = inject(MessageService);
  private fb                = inject(FormBuilder);
  private router            = inject(Router);
  private route             = inject(ActivatedRoute);

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
      const state = history.state as { chauffeur?: Chauffeur };
      if (state?.chauffeur) {
        this.form.patchValue({ name: state.chauffeur.name, phone: state.chauffeur.phone ?? '' });
      } else {
        this.router.navigate(['/chauffeurs']);
      }
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const body: ChauffeurCreate = { name: v.name!, phone: v.phone || undefined };
    const obs = this.editingId
      ? this.chauffeursService.update(this.editingId, body)
      : this.chauffeursService.create(body);

    obs.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Chauffeur enregistré', life: 3000 });
        setTimeout(() => this.router.navigate(['/chauffeurs']), 1000);
      },
      error: e => {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  cancel() { this.router.navigate(['/chauffeurs']); }
}
