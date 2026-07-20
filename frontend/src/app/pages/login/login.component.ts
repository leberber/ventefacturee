import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private fb     = inject(FormBuilder);

  readonly loading      = signal(false);
  readonly pageReady    = signal(false);
  readonly focusedField = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly errorMsg     = signal<string | null>(null);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit() {
    setTimeout(() => this.pageReady.set(true), 80);
  }

  onFocus(field: string) { this.focusedField.set(field); this.errorMsg.set(null); }
  onBlur()               { this.focusedField.set(null); }
  togglePassword()       { this.showPassword.update(v => !v); }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.errorMsg.set(null);
    this.loading.set(true);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username!, password!).subscribe({
      next: () => { this.loading.set(false); this.router.navigate(['/']); },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.detail ?? 'Identifiants incorrects');
      },
    });
  }
}
