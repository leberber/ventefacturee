import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrevendeurService, PrevAdminStat } from '../../core/services/prevendeur.service';

@Component({
  selector: 'app-prevendeurs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prevendeurs.component.html',
  styleUrl: './prevendeurs.component.scss',
})
export class PrevendeursComponent implements OnInit {
  private svc = inject(PrevendeurService);

  stats: PrevAdminStat[] = [];
  loading = false;

  ngOnInit() {
    this.loading = true;
    this.svc.getAdminStats().subscribe({
      next: d  => { this.stats = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  progressColor(pct: number): string {
    if (pct >= 80) return 'var(--color-success, #22c55e)';
    if (pct >= 40) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }
}
