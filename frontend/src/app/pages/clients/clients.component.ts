import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Popover } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';
import { sortItems, toggleSort } from '../../core/utils/sort.util';

const LS_KEY = 'ventefacturee_clients_columns';

interface ColDef {
  field: string;
  header: string;
  width: string;
  visible: boolean;
  sortable?: boolean;
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Toast, ConfirmDialog, Popover, TooltipModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.component.html',
})
export class ClientsComponent implements OnInit {
  @ViewChild('pop')    pop!: Popover;
  @ViewChild('colMenu') colMenu!: Popover;

  private clientsService      = inject(ClientsService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router              = inject(Router);

  clients: Client[] = [];
  loading = false;
  searchQuery = '';
  sortCol = 'name';
  sortDir: 1 | -1 = 1;
  activeClient: Client | null = null;
  activeType: 'plastique' | 'bois' = 'plastique';

  readonly allColumns: ColDef[] = [
    { field: 'nom_sodichn',      header: 'Nom Sodichn',   width: '180px', visible: true                   },
    { field: 'category',         header: 'Catégorie',     width: '100px', visible: true                   },
    { field: 'phone',            header: 'Téléphone',     width: '130px', visible: true                   },
    { field: 'commune',          header: 'Commune',       width: '120px', visible: true,  sortable: true  },
    { field: 'wilaya',           header: 'Wilaya',        width: '110px', visible: true                   },
    { field: 'customer_no',      header: 'N° client BDD', width: '140px', visible: false                  },
    { field: 'code_sodichn',     header: 'Code Sodichn',  width: '130px', visible: false                  },
    { field: 'type_client',      header: 'Type client',   width: '110px', visible: false                  },
    { field: 'categorie_bdd',    header: 'Catégorie BDD', width: '110px', visible: false                  },
    { field: 'tarification',     header: 'Tarification',  width: '110px', visible: false                  },
    { field: 'vendeur',          header: 'Vendeur',       width: '140px', visible: false                  },
    { field: 'route_id',         header: 'Route',         width: '100px', visible: false                  },
    { field: 'buid',             header: 'BUID',          width: '100px', visible: false                  },
    { field: 'region',           header: 'Région',        width: '110px', visible: false                  },
    { field: 'daira',            header: 'Daïra',         width: '110px', visible: false                  },
    { field: 'address',          header: 'Adresse',       width: '200px', visible: false                  },
    { field: 'rc',               header: 'RC',            width: '130px', visible: false                  },
    { field: 'nif',              header: 'NIF',           width: '130px', visible: false                  },
    { field: 'ai',               header: 'AI',            width: '130px', visible: false                  },
    { field: 'activite_sodichn', header: 'Activité',      width: '160px', visible: false                  },
  ];

  get visibleColumns(): ColDef[] { return this.allColumns.filter(c => c.visible); }

  toggleColumn(field: string): void {
    const col = this.allColumns.find(c => c.field === field);
    if (col) col.visible = !col.visible;
    this.saveColumnState();
  }

  private loadColumnState(): void {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return;
      const state: Record<string, boolean> = JSON.parse(saved);
      this.allColumns.forEach(col => { if (col.field in state) col.visible = state[col.field]; });
    } catch { /* ignore */ }
  }

  private saveColumnState(): void {
    const state: Record<string, boolean> = {};
    this.allColumns.forEach(col => (state[col.field] = col.visible));
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  getVal(c: Client, field: string): string {
    const v = (c as any)[field];
    return v != null && v !== '' ? String(v) : '—';
  }

  editingSodichnId: number | null = null;
  editingSodichnValue = '';
  readonly sodichnPlaceholder = "Nom tel qu'il apparaît sur le registre";

  startEditSodichn(c: Client): void {
    this.editingSodichnId    = c.id;
    this.editingSodichnValue = c.nom_sodichn ?? '';
  }

  saveSodichn(c: Client): void {
    const val = this.editingSodichnValue.trim() || null;
    this.editingSodichnId = null;
    this.clientsService.update(c.id, { nom_sodichn: val } as any).subscribe({
      next: updated => { c.nom_sodichn = (updated as any).nom_sodichn; },
      error: () => this.toast('error', 'Erreur lors de la sauvegarde'),
    });
  }

  cancelEditSodichn(): void { this.editingSodichnId = null; }

  openPop(event: Event, c: Client, type: 'plastique' | 'bois') {
    this.activeClient = c;
    this.activeType   = type;
    this.pop.toggle(event);
  }

  readonly categoryLabel: Record<string, string> = { gros: 'Gros', detail: 'Détail', horeca: 'Horeca' };
  readonly categoryBadge: Record<string, string> = {
    gros: 'badge badge--info', detail: 'badge badge--success', horeca: 'badge badge--warning',
  };

  get sorted(): Client[] { return sortItems(this.clients, this.sortCol as keyof Client, this.sortDir); }

  sortBy(col: string) {
    const s = toggleSort(this.sortCol, this.sortDir, col);
    this.sortCol = s.col; this.sortDir = s.dir;
  }

  ngOnInit() { this.loadColumnState(); this.load(); }

  load() {
    this.loading = true;
    this.clientsService.list(this.searchQuery || undefined).subscribe({
      next: data => { this.clients = data; this.loading = false; },
      error: () => { this.loading = false; this.toast('error', 'Erreur de chargement'); },
    });
  }

  openAdd() { this.router.navigate(['/clients/nouveau']); }
  openMap() { this.router.navigate(['/clients/carte']); }

  openEdit(c: Client) {
    this.router.navigate(['/clients', c.id, 'modifier'], { state: { client: c } });
  }

  confirmDelete(c: Client) {
    this.confirmationService.confirm({
      message: `Supprimer "${c.name}" ? Ses BLs seront conservés.`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.clientsService.delete(c.id).subscribe({
          next: () => { this.load(); this.toast('success', 'Client supprimé'); },
          error: e  => this.toast('error', e.error?.detail ?? 'Erreur'),
        });
      },
    });
  }

  private toast(severity: string, detail: string) {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erreur' : 'Succès', detail, life: 4000 });
  }
}
