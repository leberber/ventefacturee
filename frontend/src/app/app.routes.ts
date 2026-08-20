import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard, adminOrEmployeGuard, adminGuard, rootGuard, prevenderOnlyGuard, notPrevenderGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', canActivate: [rootGuard], children: [] },
      { path: 'dashboard',  canActivate: [notPrevenderGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'analytics',  canActivate: [notPrevenderGuard], loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent) },

      { path: 'ventes',   canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/ventes/ventes.component').then(m => m.VentesComponent) },
      { path: 'produits',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/produits/produits.component').then(m => m.ProduitsComponent) },
      { path: 'rapport-facturation',   canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/rapport-facturation/rapport-facturation.component').then(m => m.RapportFacturationComponent) },
      { path: 'rapprochement-bl',      canActivate: [adminGuard],          loadComponent: () => import('./pages/rapprochement-bl/rapprochement-bl.component').then(m => m.RapprochementBlComponent) },
      { path: 'upload',   canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent) },

      { path: 'clients',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
      { path: 'clients/carte',        canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/clients-map/clients-map.component').then(m => m.ClientsMapComponent) },
      { path: 'clients/nouveau',      canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },
      { path: 'clients/:id/modifier', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },

      { path: 'utilisateurs',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateurs.component').then(m => m.UtilisateursComponent) },
      { path: 'utilisateurs/nouveau',      canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },
      { path: 'utilisateurs/:id/modifier', canActivate: [adminGuard],          loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },

      { path: 'prevendeurs', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/prevendeurs/prevendeurs.component').then(m => m.PrevendeursComponent) },
      { path: 'objectifs',    canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/objectifs-admin/objectifs-admin.component').then(m => m.ObjectifsAdminComponent) },
      { path: 'objectifs-in', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/objectifs-in/objectifs-in.component').then(m => m.ObjectifsInComponent) },
      { path: 'entrees-in',   canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/entrees-in/entrees-in.component').then(m => m.EntreesInComponent) },
      { path: 'parametres', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'logs',       canActivate: [adminGuard],          loadComponent: () => import('./pages/logs/logs.component').then(m => m.LogsComponent) },

      { path: 'prevendeur', canActivate: [prevenderOnlyGuard], loadComponent: () => import('./pages/prevendeur/prevendeur.component').then(m => m.PrevendeurComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
