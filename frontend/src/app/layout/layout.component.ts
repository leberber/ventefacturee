import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { TourneeStateService } from '../core/services/tournee-state.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit {
  collapsed     = signal(false);
  drawerOpen    = signal(false);
  auth          = inject(AuthService);
  tourneeState  = inject(TourneeStateService);
  private router = inject(Router);

  get user()             { return this.auth.currentUser(); }
  get isAdminOrEmploye() { return this.auth.isAdminOrEmploye; }
  get isAdmin()          { return this.auth.isAdmin; }
  get isLivreur()        { return this.auth.isLivreur; }

  ngOnInit() {
    if (this.isLivreur) this.tourneeState.refresh();
  }

  goToActiveTournee() {
    const id = this.tourneeState.activeTourneeId();
    if (id) this.router.navigate(['/expedition', id, 'livraison']);
  }

  logout() { this.auth.logout(); }
}
