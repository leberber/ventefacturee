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
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

      { path: 'upload',   canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent) },

      { path: 'clients',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
      { path: 'clients/nouveau',      canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },
      { path: 'clients/:id/modifier', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },

      { path: 'utilisateurs',              canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateurs.component').then(m => m.UtilisateursComponent) },
      { path: 'utilisateurs/nouveau',      canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },
      { path: 'utilisateurs/:id/modifier', canActivate: [adminGuard],          loadComponent: () => import('./pages/utilisateurs/utilisateur-form/utilisateur-form.component').then(m => m.UtilisateurFormComponent) },

      { path: 'parametres', canActivate: [adminOrEmployeGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
