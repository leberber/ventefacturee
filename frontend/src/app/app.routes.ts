import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard, adminOrEmployeGuard, adminGuard, notLivreurGuard, livreurOnlyGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',  canActivate: [notLivreurGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

      { path: 'clients',              canActivate: [notLivreurGuard], loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
      { path: 'clients/nouveau',      canActivate: [notLivreurGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },
      { path: 'clients/:id/modifier', canActivate: [notLivreurGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },

      { path: 'expedition',               canActivate: [notLivreurGuard], loadComponent: () => import('./pages/nouveau-bl/nouveau-bl.component').then(m => m.NouveauBLComponent) },
      { path: 'expedition/:id/livraison', loadComponent: () => import('./pages/livraison-detail/livraison-detail.component').then(m => m.LivraisonDetailComponent) },
      { path: 'retour',                   canActivate: [notLivreurGuard], loadComponent: () => import('./pages/retour/retour.component').then(m => m.RetourComponent) },
      { path: 'historique',               canActivate: [notLivreurGuard], loadComponent: () => import('./pages/historique/historique.component').then(m => m.HistoriqueComponent) },

      { path: 'mes-tournees', canActivate: [livreurOnlyGuard], loadComponent: () => import('./pages/mes-tournees/mes-tournees.component').then(m => m.MesTourneesComponent) },

      { path: 'utilisateurs',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateurs.component').then(m => m.UtilisateursComponent) },
      { path: 'utilisateurs/nouveau',      canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },
      { path: 'utilisateurs/:id/modifier', canActivate: [adminGuard],          loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },

      { path: 'parametres', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
