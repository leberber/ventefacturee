import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard, adminOrEmployeGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',  loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

      { path: 'clients',              loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
      { path: 'clients/nouveau',      loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },
      { path: 'clients/:id/modifier', loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },

      { path: 'chauffeurs',                loadComponent: () => import('./pages/chauffeurs/chauffeurs.component').then(m => m.ChauffeursComponent) },
      { path: 'chauffeurs/nouveau',        loadComponent: () => import('./pages/chauffeurs/chauffeur-form/chauffeur-form.component').then(m => m.ChauffeurFormComponent) },
      { path: 'chauffeurs/:id/modifier',   loadComponent: () => import('./pages/chauffeurs/chauffeur-form/chauffeur-form.component').then(m => m.ChauffeurFormComponent) },

      { path: 'livreurs',              loadComponent: () => import('./pages/livreurs/livreurs.component').then(m => m.LivreursComponent) },
      { path: 'livreurs/nouveau',      loadComponent: () => import('./pages/livreurs/livreur-form/livreur-form.component').then(m => m.LivreurFormComponent) },
      { path: 'livreurs/:id/modifier', loadComponent: () => import('./pages/livreurs/livreur-form/livreur-form.component').then(m => m.LivreurFormComponent) },

      { path: 'expedition', loadComponent: () => import('./pages/nouveau-bl/nouveau-bl.component').then(m => m.NouveauBLComponent) },
      { path: 'retour',     loadComponent: () => import('./pages/retour/retour.component').then(m => m.RetourComponent) },
      { path: 'historique', loadComponent: () => import('./pages/historique/historique.component').then(m => m.HistoriqueComponent) },

      { path: 'utilisateurs',              canActivate: [adminGuard], loadComponent: () => import('./pages/utilisateurs/utilisateurs.component').then(m => m.UtilisateursComponent) },
      { path: 'utilisateurs/nouveau',      canActivate: [adminGuard], loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },
      { path: 'utilisateurs/:id/modifier', canActivate: [adminGuard], loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },

      { path: 'parametres', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
