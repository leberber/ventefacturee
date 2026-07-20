import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'clients', loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
      { path: 'chauffeurs', loadComponent: () => import('./pages/chauffeurs/chauffeurs.component').then(m => m.ChauffeursComponent) },
      { path: 'nouveau-bl', loadComponent: () => import('./pages/nouveau-bl/nouveau-bl.component').then(m => m.NouveauBLComponent) },
      { path: 'historique', loadComponent: () => import('./pages/historique/historique.component').then(m => m.HistoriqueComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
