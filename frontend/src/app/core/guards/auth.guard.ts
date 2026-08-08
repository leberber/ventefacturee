import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn ? true : router.createUrlTree(['/login']);
};

export const adminOrEmployeGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isAdminOrEmploye ? true : router.createUrlTree(['/dashboard']);
};

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin ? true : router.createUrlTree(['/dashboard']);
};

// Redirects prevenders away to their own page
export const notPrevenderGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isPrevender ? router.createUrlTree(['/dashboard']) : true;
};

// Only prevenders can access
export const prevenderOnlyGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isPrevender ? true : router.createUrlTree(['/dashboard']);
};

// Root redirect: prevenders → /prevendeur, everyone else → /ventes
export const rootGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isPrevender
    ? router.createUrlTree(['/prevendeur'])
    : router.createUrlTree(['/dashboard']);
};
