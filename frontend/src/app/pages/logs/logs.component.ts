import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, LogEntry } from '../../core/services/admin.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent implements OnInit, OnDestroy {
  private svc = inject(AdminService);

  loading = signal(true);
  entries = signal<LogEntry[]>([]);
  stats = signal<{ file_size_human: string; total_lines: number } | null>(null);
  selectedLevel = signal<string | null>(null);
  selectedLines = signal(100);
  autoRefresh = signal(false);
  private interval: ReturnType<typeof setInterval> | null = null;

  filteredEntries = computed(() => {
    const lvl = this.selectedLevel();
    return lvl ? this.entries().filter(e => e.level === lvl) : this.entries();
  });

  errorCount  = computed(() => this.entries().filter(e => e.level === 'ERROR').length);
  warnCount   = computed(() => this.entries().filter(e => e.level === 'WARNING').length);

  readonly levelOptions = [
    { label: 'Tous', value: null },
    { label: 'INFO', value: 'INFO' },
    { label: 'WARNING', value: 'WARNING' },
    { label: 'ERROR', value: 'ERROR' },
  ];

  readonly linesOptions = [50, 100, 200, 500];

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.stopRefresh(); }

  load() {
    this.loading.set(true);
    this.svc.getLogs(this.selectedLines(), this.selectedLevel() ?? undefined).subscribe({
      next: r => { this.entries.set(r.entries); this.stats.set(r.stats); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleAutoRefresh() {
    this.autoRefresh() ? this.stopRefresh() : this.startRefresh();
  }

  private startRefresh() {
    this.autoRefresh.set(true);
    this.interval = setInterval(() => this.load(), 15000);
  }

  private stopRefresh() {
    this.autoRefresh.set(false);
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  scrollTo(pos: 'top' | 'bottom') {
    const el = document.querySelector('.logs-body');
    if (el) el.scrollTop = pos === 'top' ? 0 : el.scrollHeight;
  }

  levelClass(level: string): string {
    if (level === 'ERROR')   return 'log-level--error';
    if (level === 'WARNING') return 'log-level--warn';
    if (level === 'INFO')    return 'log-level--info';
    return 'log-level--debug';
  }
}
