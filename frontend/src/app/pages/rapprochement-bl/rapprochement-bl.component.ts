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
    { field: 'statut',                header: 'Statut',              visible: true  },
    { field: 'code_produit',          header: 'Code',                visible: true  },
    { field: 'libelle',               header: 'Désignation',         visible: true  },
    { field: 'ventes_qte_facturee',   header: 'SalesBuzz (unités)',  visible: true  },
    { field: 'ventes_uom_vente',      header: 'SalesBuzz UOM',       visible: true  },
    { field: 'ventes_qte_colis',      header: 'SalesBuzz (col.)',    visible: true  },
    { field: 'ventes_prix_unitaire',  header: 'SalesBuzz Prix',      visible: true  },
    { field: 'ventes_total_facture',  header: 'SalesBuzz Total',     visible: true  },
    { field: 'bl_nb_colis',           header: 'BL (col.)',           visible: true  },
    { field: 'bl_qte_unites',         header: 'BL (unités)',         visible: true  },
    { field: 'bl_prix_unitaire',      header: 'BL Prix Unit.',       visible: true  },
    { field: 'bl_montant_ttc',        header: 'BL Montant',          visible: true  },
    { field: 'colisage',              header: 'Colisage',            visible: false },
    { field: 'difference_unites',     header: 'Écart (unités)',      visible: true  },
    { field: 'prix_dd',               header: 'Prix club',           visible: true  },
    { field: 'prix_promotion',        header: 'Prix promo',          visible: true  },
    { field: 'net_ajuste',            header: 'NET Ajusté',          visible: true  },
  ];

  colVisible(field: string): boolean {
    return this.allColumns.find(c => c.field === field)?.visible ?? true;
  }

  // Footer colspan: identity columns + salesbuzz columns before "total"
  get footerLeftColspan(): number {
    const fields = ['statut', 'code_produit', 'libelle', 'ventes_qte_facturee', 'ventes_uom_vente', 'ventes_qte_colis', 'ventes_prix_unitaire'];
    return Math.max(1, fields.filter(f => this.colVisible(f)).length);
  }

  // BL columns before "total" (u, col, prix)
  get footerBlPrefixColspan(): number {
    return ['bl_qte_unites', 'bl_nb_colis', 'bl_prix_unitaire'].filter(f => this.colVisible(f)).length;
  }

  // Columns between BL total and NET Ajusté
  get footerMiddleColspan(): number {
    return ['colisage', 'difference_unites', 'prix_dd', 'prix_promotion'].filter(f => this.colVisible(f)).length;
  }

  get footerPromoColspan(): number {
    return ['prix_dd', 'prix_promotion'].filter(f => this.colVisible(f)).length;
  }

  get totalSalesBuzz(): number {
    return this.result?.lignes.reduce((sum, l) => sum + (l.ventes_total_facture ?? 0), 0) ?? 0;
  }

  get totalBL(): number {
    return this.result?.net_a_payer ?? 0;
  }

  get salesbuzzColspan(): number {
    return ['ventes_qte_facturee', 'ventes_uom_vente', 'ventes_qte_colis', 'ventes_prix_unitaire', 'ventes_total_facture']
      .filter(f => this.colVisible(f)).length;
  }

  get blColspan(): number {
    return ['bl_qte_unites', 'bl_nb_colis', 'bl_prix_unitaire', 'bl_montant_ttc']
      .filter(f => this.colVisible(f)).length;
  }

  // Per-row editable qty (in colis) for gros and promo pricing
  qtyGrosMap = new Map<string, number>();
  qtyPromoMap = new Map<string, number>();

  // Code mapping drafts: bl_code → code_produit draft input
  mappingDrafts = new Map<string, string>();
  mappingSaving = new Set<string>();

  getMappingDraft(blCode: string): string { return this.mappingDrafts.get(blCode) ?? ''; }
  setMappingDraft(blCode: string, val: string) { this.mappingDrafts.set(blCode, val); }

  saveMapping(blCode: string) {
    const codeProduit = this.getMappingDraft(blCode).trim();
    if (!codeProduit) return;
    this.mappingSaving.add(blCode);
    this.ventesService.createMapping(blCode, codeProduit).subscribe({
      next: () => {
        this.mappingSaving.delete(blCode);
        this.mappingDrafts.delete(blCode);
        this.runRapprochement(); // re-run with the new mapping applied
      },
      error: () => this.mappingSaving.delete(blCode),
    });
  }

  isMappingSaving(blCode: string): boolean { return this.mappingSaving.has(blCode); }

  isUnmapped(ligne: RapprochementLigne): boolean {
    return ligne.colisage === null && !ligne.mapped_code;
  }

  get canRun(): boolean {
    return !!this.selectedLivreur && !!this.selectedFile;
  }

  get matchCount(): number {
    return this.result?.lignes.filter(l => l.match).length ?? 0;
  }

  get mismatchCount(): number {
    return this.result?.lignes.filter(l => !l.match && !l.is_duplicate && l.ventes_qte_colis !== null).length ?? 0;
  }

  get notFoundCount(): number {
    return this.result?.lignes.filter(l => l.ventes_qte_colis === null && !l.is_duplicate).length ?? 0;
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

  rowClass(ligne: RapprochementLigne, index = 0): string {
    const next = this.result?.lignes[index + 1];
    if (ligne.is_duplicate) return 'row--dup';
    const startsGroup = next?.is_duplicate && next.code_produit === ligne.code_produit;
    const base = startsGroup ? 'row--dup-start' : '';
    if (ligne.ventes_qte_colis === null) return (base + ' row--unknown').trim();
    if (ligne.match) return (base + ' row--match').trim();
    return (base + ' row--mismatch').trim();
  }
}
