import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { Popover } from 'primeng/popover';
import { VentesService, RapprochementLigne, RapprochementResult } from '../../core/services/ventes.service';

const LS_KEY = 'ventefacturee_rapprochement_columns';

interface ColDef {
  field: string;
  header: string;
  visible: boolean;
}

@Component({
  selector: 'app-rapprochement-bl',
  standalone: true,
  imports: [DecimalPipe, NgClass, FormsModule, TooltipModule, Select, Popover],
  templateUrl: './rapprochement-bl.component.html',
  styleUrl: './rapprochement-bl.component.scss',
})
export class RapprochementBlComponent implements OnInit {
  private ventesService = inject(VentesService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  livreurs: string[] = [];
  selectedLivreur = '';
  selectedFile: File | null = null;
  fileName = '';
  loading = false;
  result: RapprochementResult | null = null;
  error = '';

  readonly allColumns: ColDef[] = [
    { field: 'statut',            header: 'Statut',           visible: true },
    { field: 'code_produit',      header: 'Code',             visible: true },
    { field: 'libelle',           header: 'Désignation',      visible: true },
    { field: 'ventes_qte_colis',  header: 'Ventes (col.)',    visible: true },
    { field: 'bl_nb_colis',       header: 'Livraison (col.)', visible: true },
    { field: 'colisage',          header: 'Colisage',         visible: true },
    { field: 'difference_unites', header: 'Écart (unités)',   visible: true },
    { field: 'bl_prix_unitaire',  header: 'Prix Unit.',       visible: true },
    { field: 'bl_montant_ttc',    header: 'Montant BL',       visible: true },
    { field: 'prix_dd',           header: 'Prix club',        visible: true },
    { field: 'prix_promotion',    header: 'Prix promo',       visible: true },
    { field: 'net_ajuste',        header: 'NET Ajusté',       visible: true },
  ];

  colVisible(field: string): boolean {
    return this.allColumns.find(c => c.field === field)?.visible ?? true;
  }

  get footerLabelColspan(): number {
    const fields = ['statut', 'code_produit', 'libelle', 'ventes_qte_colis', 'bl_nb_colis', 'colisage', 'difference_unites', 'bl_prix_unitaire'];
    return Math.max(1, fields.filter(f => this.colVisible(f)).length);
  }

  get footerPromoColspan(): number {
    return ['prix_dd', 'prix_promotion'].filter(f => this.colVisible(f)).length;
  }

  // Per-row editable qty (in colis) for gros and promo pricing
  qtyGrosMap = new Map<string, number>();
  qtyPromoMap = new Map<string, number>();

  get canRun(): boolean {
    return !!this.selectedLivreur && !!this.selectedFile;
  }

  get matchCount(): number {
    return this.result?.lignes.filter(l => l.match).length ?? 0;
  }

  get mismatchCount(): number {
    return this.result?.lignes.filter(l => !l.match && l.ventes_qte_colis !== null).length ?? 0;
  }

  get notFoundCount(): number {
    return this.result?.lignes.filter(l => l.ventes_qte_colis === null).length ?? 0;
  }

  getQtyGros(code: string): number { return this.qtyGrosMap.get(code) ?? 0; }
  getQtyPromo(code: string): number { return this.qtyPromoMap.get(code) ?? 0; }

  setQtyGros(code: string, val: number) { this.qtyGrosMap.set(code, val >= 0 ? val : 0); }
  setQtyPromo(code: string, val: number) { this.qtyPromoMap.set(code, val >= 0 ? val : 0); }

  /** NET ajusté par ligne (en DA) — prix_club/prix_promo sont par colis */
  getNetLigne(ligne: RapprochementLigne): number {
    const qg = this.getQtyGros(ligne.code_produit);
    const qp = this.getQtyPromo(ligne.code_produit);
    if ((qg === 0 && qp === 0) || !ligne.colisage) return ligne.bl_montant_ttc;
    const prixColisRegulier = ligne.bl_prix_unitaire * ligne.colisage;
    const colisReguliers = (ligne.bl_nb_colis ?? 0) - qg - qp;
    const netRegulier = Math.max(colisReguliers, 0) * prixColisRegulier;
    const netGros = ligne.prix_club != null ? qg * ligne.prix_club : qg * prixColisRegulier;
    const netPromo = ligne.prix_promotion != null ? qp * ligne.prix_promotion : qp * prixColisRegulier;
    return netRegulier + netGros + netPromo;
  }

  get hasAjustements(): boolean {
    return [...this.qtyGrosMap.values(), ...this.qtyPromoMap.values()].some(v => v > 0);
  }

  get netAPayerAjuste(): number {
    if (!this.result) return 0;
    return this.result.lignes.reduce((sum, l) => sum + this.getNetLigne(l), 0);
  }

  toggleColumn(field: string) {
    const col = this.allColumns.find(c => c.field === field);
    if (col) col.visible = !col.visible;
    this.saveColumnState();
  }

  private loadColumnState() {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return;
      const state: Record<string, boolean> = JSON.parse(saved);
      this.allColumns.forEach(col => {
        if (col.field in state) col.visible = state[col.field];
      });
    } catch { /* ignore */ }
  }

  private saveColumnState() {
    const state: Record<string, boolean> = {};
    this.allColumns.forEach(col => (state[col.field] = col.visible));
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  ngOnInit() {
    this.loadColumnState();
    this.ventesService.getDistinct('nom_livreur').subscribe(d => this.livreurs = d);
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.fileName = input.files[0].name;
    }
  }

  runRapprochement() {
    if (!this.canRun) return;
    this.loading = true;
    this.result = null;
    this.error = '';
    this.qtyGrosMap.clear();
    this.qtyPromoMap.clear();
    this.ventesService.rapprochementBL(this.selectedFile!, this.selectedLivreur)
      .subscribe({
        next: res => { this.result = res; this.loading = false; },
        error: err => { this.error = err.error?.detail || 'Erreur lors de l\'analyse'; this.loading = false; },
      });
  }

  rowClass(ligne: RapprochementLigne): string {
    if (ligne.ventes_qte_colis === null) return 'row--unknown';
    if (ligne.match) return 'row--match';
    return 'row--mismatch';
  }
}
