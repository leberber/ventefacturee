import { Component, OnInit, AfterViewInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { Popover } from 'primeng/popover';
import { VentesService, VenteRead } from '../../core/services/ventes.service';

const LS_KEY = 'ventefacturee_ventes_columns';
const BATCH = 100;

interface ColDef {
  field: keyof VenteRead;
  header: string;
  width: string;
  visible: boolean;
}

@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TooltipModule, Popover],
  templateUrl: './ventes.component.html',
  styleUrl: './ventes.component.scss',
})
export class VentesComponent implements OnInit, AfterViewInit, OnDestroy {
  private ventesService = inject(VentesService);

  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLElement>;
  private boundScrollFn = () => this.checkScroll();

  rows: VenteRead[] = [];
  total = 0;
  loading = false;
  loadingMore = false;
  periodes: { label: string; value: string }[] = [];
  selectedMois = '';
  searchTerm = '';
  private currentPage = 1;
  private searchTimeout: any;

  readonly allColumns: ColDef[] = [
    { field: 'date_commande',        header: 'Date',                width: '110px', visible: true  },
    { field: 'num_commande',         header: 'N° Commande',         width: '160px', visible: true  },
    { field: 'type_commande',        header: 'Type',                width: '80px',  visible: true  },
    { field: 'code_client',          header: 'Code Client',         width: '140px', visible: false },
    { field: 'nom_client',           header: 'Nom client',          width: '180px', visible: true  },
    { field: 'categorie_client',     header: 'Catégorie',           width: '90px',  visible: true  },
    { field: 'adresse_client',       header: 'Adresse Client',      width: '200px', visible: false },
    { field: 'route',                header: 'Route',               width: '130px', visible: false },
    { field: 'commune',              header: 'Commune',             width: '120px', visible: false },
    { field: 'wilaya',               header: 'Wilaya',              width: '120px', visible: false },
    { field: 'zone',                 header: 'Zone',                width: '80px',  visible: false },
    { field: 'region',               header: 'Région',              width: '90px',  visible: false },
    { field: 'tel_client',           header: 'Tél',                 width: '120px', visible: false },
    { field: 'type_client',          header: 'Type Client',         width: '100px', visible: false },
    { field: 'code_fdv',             header: 'Code-FDV',            width: '120px', visible: false },
    { field: 'nom_fdv',              header: 'Nom-FDV',             width: '160px', visible: true  },
    { field: 'buid',                 header: 'BUID',                width: '130px', visible: false },
    { field: 'depot_livraison',      header: 'Dépôt Livraison',     width: '130px', visible: false },
    { field: 'statut_commande',      header: 'Statut Commande',     width: '140px', visible: true  },
    { field: 'date_creation',        header: 'Date Création',       width: '120px', visible: false },
    { field: 'date_confirmation',    header: 'Date Confirmation',   width: '140px', visible: false },
    { field: 'date_facturation',     header: 'Date Facturation',    width: '130px', visible: false },
    { field: 'code_livreur',         header: 'Code Livreur',        width: '120px', visible: false },
    { field: 'nom_livreur',          header: 'Nom Livreur',         width: '150px', visible: false },
    { field: 'matricule_van',        header: 'Matricule VAN',       width: '120px', visible: false },
    { field: 'code_produit',         header: 'Code Produit',        width: '130px', visible: true  },
    { field: 'description_produit',  header: 'Description Produit', width: '220px', visible: true  },
    { field: 'famille',              header: 'Famille',             width: '120px', visible: true  },
    { field: 'sous_famille',         header: 'Sous Famille',        width: '160px', visible: true  },
    { field: 'uom_vente',            header: 'UOM Vente',           width: '100px', visible: false },
    { field: 'cout_produit',         header: 'Cout Produit',        width: '110px', visible: true  },
    { field: 'prix_unitaire',        header: 'Prix Unitaire',       width: '110px', visible: true  },
    { field: 'uom_principale',       header: 'UOM principale',      width: '120px', visible: false },
    { field: 'prix_unitaire_uom_pr', header: 'Prix unit. UOM PR',   width: '130px', visible: false },
    { field: 'qte_commandee',        header: 'Qte Commandée',       width: '120px', visible: true  },
    { field: 'qte_chargee',          header: 'Qte Chargée',         width: '110px', visible: false },
    { field: 'qte_livree',           header: 'Qte Livrée',          width: '100px', visible: true  },
    { field: 'qte_facturee',         header: 'Qte Facturée',        width: '110px', visible: true  },
    { field: 'total_commande',       header: 'Total Commandée',     width: '130px', visible: false },
    { field: 'total_facture',        header: 'Total Facturée',      width: '120px', visible: true  },
  ];

  get visibleColumns(): ColDef[] {
    return this.allColumns.filter(c => c.visible);
  }

  get hasMore(): boolean {
    return this.rows.length < this.total;
  }

  ngOnInit() {
    this.loadColumnState();
    this.ventesService.getPeriodes().subscribe(periodes => {
      this.periodes = periodes.map(p => ({ label: this.formatPeriod(p), value: p }));
      if (periodes.length) {
        this.selectedMois = periodes[0];
        this.reset();
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.attachScrollListener(), 0);
  }

  ngOnDestroy() {
    this.tableWrapper?.nativeElement.removeEventListener('scroll', this.boundScrollFn);
  }

  private attachScrollListener() {
    const el = this.tableWrapper?.nativeElement;
    if (el) el.addEventListener('scroll', this.boundScrollFn);
  }

  private checkScroll() {
    const el = this.tableWrapper?.nativeElement;
    if (!el) return;
    const { scrollHeight, scrollTop, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 300 && this.hasMore && !this.loadingMore && !this.loading) {
      this.currentPage++;
      this.loadBatch(true);
    }
  }

  selectPeriod(mois: string): void {
    this.selectedMois = mois;
    this.reset();
  }

  reload(): void {
    this.reset();
  }

  onSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.reset(), 400);
  }

  toggleColumn(field: string) {
    const col = this.allColumns.find(c => c.field === field);
    if (col) col.visible = !col.visible;
    this.saveColumnState();
  }

  formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    return new Date(+year, +month - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  private reset() {
    this.rows = [];
    this.currentPage = 1;
    this.total = 0;
    this.loadBatch(false);
  }

  private loadBatch(append: boolean) {
    if (!this.selectedMois) return;
    if (append) this.loadingMore = true;
    else this.loading = true;

    this.ventesService.list({
      page: this.currentPage,
      per_page: BATCH,
      annee_mois: this.selectedMois,
      search: this.searchTerm || undefined,
    }).subscribe({
      next: res => {
        this.rows = append ? [...this.rows, ...res.items] : res.items;
        this.total = res.total;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        this.loading = false;
        this.loadingMore = false;
      },
    });
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
}
