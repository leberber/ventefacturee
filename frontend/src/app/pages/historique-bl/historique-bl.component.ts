import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { DecimalPipe, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { VentesService, SessionRead, SessionReadDetail } from '../../core/services/ventes.service';
import { DateRangePickerComponent, DateRange } from '../../shared/components/date-range-picker.component';

@Component({
  selector: 'app-historique-bl',
  standalone: true,
  imports: [DecimalPipe, NgClass, DatePipe, FormsModule, TooltipModule, RouterLink, DateRangePickerComponent],
  templateUrl: './historique-bl.component.html',
  styleUrl: './historique-bl.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class HistoriqueBlComponent implements OnInit {
  private ventesService = inject(VentesService);
  private route = inject(ActivatedRoute);

  sessions: SessionRead[] = [];
  searchQuery = '';
  dateFrom = '';
  dateTo = '';
  loading = true;

  get sessionPeriodes(): string[] {
    return [...new Set(this.sessions.map(s => s.date_bl.substring(0, 7)))].sort().reverse();
  }

  onRangeChange(range: DateRange) {
    this.dateFrom = range.from;
    this.dateTo = range.to;
  }
  expandedSessionId: number | null = null;
  expandedSession: SessionReadDetail | null = null;
  highlightedId: number | null = null;

  get filteredSessions(): SessionRead[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.sessions.filter(s => {
      if (q && !s.nom_livreur.toLowerCase().includes(q) && !(s.source ?? '').toLowerCase().includes(q)) return false;
      if (this.dateFrom && s.date_bl < this.dateFrom) return false;
      if (this.dateTo && s.date_bl > this.dateTo) return false;
      return true;
    });
  }

  ngOnInit() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    this.dateFrom = `${y}-${m}-01`;
    this.dateTo   = `${y}-${m}-${String(last).padStart(2, '0')}`;

    this.route.queryParams.subscribe(p => {
      this.highlightedId = p['highlighted'] ? +p['highlighted'] : null;
    });
    this.loadSessions();
  }

  loadSessions() {
    this.loading = true;
    this.ventesService.listSessions().subscribe({
      next: s => {
        this.sessions = s;
        this.loading = false;
        // Auto-expand highlighted session
        if (this.highlightedId) {
          const match = s.find(x => x.id === this.highlightedId);
          if (match) this.toggleSession(match);
        }
      },
      error: () => this.loading = false,
    });
  }

  toggleSession(session: SessionRead) {
    if (this.expandedSessionId === session.id) {
      this.expandedSessionId = null;
      this.expandedSession = null;
      return;
    }
    this.expandedSessionId = session.id;
    this.expandedSession = null;
    this.ventesService.getSessionDetail(session.id).subscribe(d => {
      this.expandedSession = d;
    });
  }

  deleteSession(session: SessionRead) {
    this.ventesService.deleteSession(session.id).subscribe(() => {
      if (this.expandedSessionId === session.id) {
        this.expandedSessionId = null;
        this.expandedSession = null;
      }
      if (this.highlightedId === session.id) this.highlightedId = null;
      this.sessions = this.sessions.filter(s => s.id !== session.id);
    });
  }

  diffClass(session: SessionRead): string {
    if (session.difference === null) return '';
    if (session.difference < 0) return 'diff--shortfall';
    if (session.difference > 0) return 'diff--overpaid';
    return 'diff--exact';
  }
}
