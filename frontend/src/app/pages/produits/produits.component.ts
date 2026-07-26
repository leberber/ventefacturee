import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { ProduitsService, ProduitRead } from '../../core/services/produits.service';

type SortCol = 'code_produit' | 'description_produit' | 'famille' | 'sous_famille' | 'uom_vente' | 'colisage';
type EditField = 'colisage';

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TooltipModule],
  templateUrl: './produits.component.html',
  styleUrl:    './produits.component.scss',
})
export class ProduitsComponent implements OnInit {
  private svc = inject(ProduitsService);

  readonly allProduits  = signal<ProduitRead[]>([]);
  readonly familles     = signal<string[]>([]);
  readonly loading      = signal(false);
  readonly syncing      = signal(false);

  readonly searchText     = signal('');
  readonly familleFilter  = signal<string | null>(null);
  readonly sortCol        = signal<SortCol>('description_produit');
  readonly sortDir        = signal<1 | -1>(1);

  readonly editingCell  = signal<{ code: string; field: EditField } | null>(null);
  readonly editingValue = signal<any>(null);
  readonly savingCell   = signal<{ code: string; field: EditField } | null>(null);

  readonly filtered = computed(() => {
    let list = this.allProduits();
    const fam = this.familleFilter();
    if (fam) list = list.filter(p => p.famille === fam);
    const q = this.searchText().trim().toLowerCase();
    if (q) list = list.filter(p =>
      (p.description_produit ?? '').toLowerCase().includes(q) ||
      p.code_produit.toLowerCase().includes(q)
    );
    const col = this.sortCol();
    const dir = this.sortDir();
    return [...list].sort((a, b) => {
      const av = (a as any)[col] ?? '';
      const bv = (b as any)[col] ?? '';
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  });

  readonly totalCount = computed(() => this.allProduits().length);

  ngOnInit(): void {
    this.load();
    this.svc.getFamilles().subscribe(d => this.familles.set(d));
  }

  load(): void {
    this.loading.set(true);
    this.svc.list({ per_page: 500 }).subscribe({
      next: d => { this.allProduits.set(d.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.svc.sync().subscribe({
      next: () => { this.syncing.set(false); this.load(); this.svc.getFamilles().subscribe(d => this.familles.set(d)); },
      error: () => this.syncing.set(false),
    });
  }

  sort(col: SortCol): void {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 1 ? -1 : 1);
    } else {
      this.sortCol.set(col);
      this.sortDir.set(1);
    }
  }

  isEditing(code: string, field: EditField): boolean {
    const c = this.editingCell();
    return c?.code === code && c?.field === field;
  }

  startEdit(p: ProduitRead, field: EditField, event: Event): void {
    event.stopPropagation();
    this.editingCell.set({ code: p.code_produit, field });
    this.editingValue.set((p as any)[field] ?? null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
    this.editingValue.set(null);
  }

  saveEdit(p: ProduitRead): void {
    const cell = this.editingCell();
    if (!cell) return;
    const newVal = this.editingValue();
    const oldVal = (p as any)[cell.field];
    this.editingCell.set(null);
    if (newVal === oldVal) return;

    this.savingCell.set(cell);
    this.svc.update(p.code_produit, { [cell.field]: newVal }).subscribe({
      next: updated => {
        this.allProduits.update(list => list.map(x => x.code_produit === updated.code_produit ? updated : x));
        this.savingCell.set(null);
      },
      error: () => this.savingCell.set(null),
    });
  }

  private readonly familleColors: Record<string, { background: string; color: string }> = {};
  private readonly palette = [
    { background: 'rgba(99,102,241,0.12)',  color: '#4f46e5' },
    { background: 'rgba(16,185,129,0.12)',  color: '#059669' },
    { background: 'rgba(245,158,11,0.12)',  color: '#d97706' },
    { background: 'rgba(236,72,153,0.12)',  color: '#db2777' },
    { background: 'rgba(20,184,166,0.12)',  color: '#0d9488' },
    { background: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
    { background: 'rgba(59,130,246,0.12)',  color: '#2563eb' },
    { background: 'rgba(139,92,246,0.12)',  color: '#7c3aed' },
    { background: 'rgba(234,88,12,0.12)',   color: '#c2410c' },
    { background: 'rgba(15,118,110,0.12)',  color: '#0f766e' },
  ];

  getFamilleStyle(famille: string | null): { background: string; color: string } {
    if (!famille) return { background: 'transparent', color: 'inherit' };
    if (!this.familleColors[famille]) {
      let hash = 0;
      for (let i = 0; i < famille.length; i++) hash = (hash * 31 + famille.charCodeAt(i)) >>> 0;
      const p = this.palette[hash % this.palette.length];
      this.familleColors[famille] = { background: p.background, color: p.color };
    }
    return this.familleColors[famille];
  }
}
