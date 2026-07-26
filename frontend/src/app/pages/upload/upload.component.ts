import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { VentesService } from '../../core/services/ventes.service';

interface UploadResult {
  success: boolean;
  message: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  private ventesService = inject(VentesService);

  dragOver = signal(false);
  loading  = signal(false);
  result   = signal<UploadResult | null>(null);

  onDragOver(e: DragEvent)  { e.preventDefault(); this.dragOver.set(true); }
  onDragLeave()             { this.dragOver.set(false); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.upload(file);
    (e.target as HTMLInputElement).value = '';
  }

  private upload(file: File) {
    this.loading.set(true);
    this.result.set(null);
    this.ventesService.upload(file).subscribe({
      next: res => {
        this.loading.set(false);
        this.result.set({ success: true, message: res.message });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.result.set({ success: false, message: err.error?.detail ?? "Erreur lors de l'import" });
      },
    });
  }
}
