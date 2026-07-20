import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Toast } from 'primeng/toast';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';

import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, Button, InputNumber],
  providers: [MessageService],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private configService  = inject(ConfigService);
  private messageService = inject(MessageService);
  private fb             = inject(FormBuilder);

  loading = false;
  saving  = false;

  form = this.fb.group({
    consigne_plastique: [0, [Validators.required, Validators.min(0)]],
    consigne_bois:      [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit() {
    this.loading = true;
    this.configService.get<{ consigne_plastique: number; consigne_bois: number }>('pricing').subscribe({
      next: data => {
        this.form.patchValue(data);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast('error', 'Impossible de charger la configuration');
      },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.configService.put('pricing', this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.toast('success', 'Configuration enregistrée');
      },
      error: e => {
        this.saving = false;
        this.toast('error', e.error?.detail ?? 'Erreur lors de la sauvegarde');
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
