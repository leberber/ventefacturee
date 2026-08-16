import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { VentesService, RapprochementLigne, RapprochementResult } from '../../core/services/ventes.service';

@Component({
  selector: 'app-rapprochement-bl',
  standalone: true,
  imports: [DecimalPipe, NgClass, FormsModule, TooltipModule, Select],
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

  ngOnInit() {
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
