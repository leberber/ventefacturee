import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  collapsed = signal(false);
  auth      = inject(AuthService);

  get user()           { return this.auth.currentUser(); }
  get isAdminOrClerk() { return this.auth.isAdminOrClerk; }
  get isAdmin()        { return this.auth.isAdmin; }

  logout() { this.auth.logout(); }
}
