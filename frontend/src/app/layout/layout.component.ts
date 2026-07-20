import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem { label: string; icon: string; route: string; }

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  navItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'pi pi-home',        route: '/dashboard'  },
    { label: 'Clients',         icon: 'pi pi-users',       route: '/clients'    },
    { label: 'Chauffeurs',      icon: 'pi pi-car',         route: '/chauffeurs' },
    { label: 'Nouveau BL',      icon: 'pi pi-plus-circle', route: '/nouveau-bl' },
    { label: 'Historique',      icon: 'pi pi-list',        route: '/historique' },
  ];
}
