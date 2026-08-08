import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrevendeurService, PrevAdminStat, PrevAdminClientRow } from '../../core/services/prevendeur.service';

@Component({
  selector: 'app-prevendeurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prevendeurs.component.html',
  styleUrl: './prevendeurs.component.scss',
})
export class PrevendeursComponent implements OnInit {
  private svc = inject(PrevendeurService);

  stats: PrevAdminStat[] = [];
  loading = false;
  exporting = false;
  expandedId: number | null = null;
  editingKey: string | null = null;
  editingValue = '';
  savingKey: string | null = null;

  toggle(id: number) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  startEdit(client: PrevAdminClientRow, event: Event) {
    event.stopPropagation();
    this.editingKey = client.code_client;
    this.editingValue = client.nom_sodichn ?? '';
    setTimeout(() => (document.querySelector('.pv-edit-input') as HTMLInputElement)?.focus(), 20);
  }

  saveEdit(client: PrevAdminClientRow, event: Event) {
    event.stopPropagation();
    if (!this.editingKey) return;
    const value = this.editingValue.trim();
    const key = this.editingKey;
    this.editingKey = null;
    this.savingKey = key;
    this.svc.updateNomSodichn(client.code_client, value, client.nom_client).subscribe({
      next: () => { client.nom_sodichn = value || null; this.savingKey = null; },
      error: () => { this.savingKey = null; },
    });
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    this.editingKey = null;
  }

  ngOnInit() {
    this.loading = true;
    this.svc.getAdminStats().subscribe({
      next: d  => { this.stats = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  exportExcel() {
    this.exporting = true;
    this.svc.exportClientsExcel().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients_rc_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.exporting = false; },
    });
  }

  progressColor(pct: number): string {
    if (pct >= 80) return 'var(--color-success, #22c55e)';
    if (pct >= 40) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }
}
