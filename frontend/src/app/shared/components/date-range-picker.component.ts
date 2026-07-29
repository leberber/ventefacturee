import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  HostListener, ElementRef, inject,
} from '@angular/core';

export interface DateRange { from: string; to: string; }

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [],
  template: `
<div class="drp">

  <!-- ── Trigger ──────────────────────────────────────── -->
  <div class="drp__trigger" (click)="toggle()">
    <div class="drp__icon"><i class="pi pi-calendar"></i></div>
    <div class="drp__body">
      <span class="drp__lbl">Période</span>
      <span class="drp__val">{{ displayLabel }}</span>
    </div>
    <i class="pi pi-chevron-down drp__caret" [class.drp__caret--open]="open"></i>
  </div>

  <!-- ── Panel ────────────────────────────────────────── -->
  @if (open) {
    <div class="drp__panel" (click)="$event.stopPropagation()">

      <!-- Month chips -->
      <div class="drp__chips-wrap">
        <div class="drp__chips">
          @for (p of periodes; track p) {
            <button class="drp__chip" [class.drp__chip--active]="isChipActive(p)"
                    (click)="selectChip(p)">
              {{ chipLabel(p) }}
            </button>
          }
        </div>
      </div>

      <!-- Calendar nav -->
      <div class="drp__nav">
        <button class="drp__nav-btn" (click)="prevMonth()"><i class="pi pi-chevron-left"></i></button>
        <span class="drp__nav-label">{{ navLabel }}</span>
        <button class="drp__nav-btn" (click)="nextMonth()"><i class="pi pi-chevron-right"></i></button>
      </div>

      <!-- Grid: weekday headers + day cells -->
      <div class="drp__grid">
        @for (d of DAYS; track d) {
          <span class="drp__wday">{{ d }}</span>
        }
        @for (cell of calendarCells; track $index) {
          @if (cell) {
            <button class="drp__day"
                    [class.drp__day--from]="cell === tempFrom && !!cell"
                    [class.drp__day--to]="cell === tempTo && !!cell"
                    [class.drp__day--range]="isInRange(cell)"
                    [class.drp__day--today]="cell === today"
                    (mouseenter)="hoverDate = cell"
                    (mouseleave)="hoverDate = null"
                    (click)="clickDay(cell)">
              {{ dayNum(cell) }}
            </button>
          } @else {
            <span class="drp__day drp__day--empty"></span>
          }
        }
      </div>

      <!-- Footer -->
      <div class="drp__footer">
        <span class="drp__fp" [class.drp__fp--active]="phase === 'from'">
          <i class="pi pi-circle-fill" style="font-size:.45rem"></i>
          {{ tempFrom ? formatDisplay(tempFrom) : 'Du…' }}
        </span>
        <span class="drp__fsep">→</span>
        <span class="drp__fp" [class.drp__fp--active]="phase === 'to'">
          {{ tempTo ? formatDisplay(tempTo) : 'Au…' }}
          <i class="pi pi-circle-fill" style="font-size:.45rem"></i>
        </span>
      </div>

    </div>
  }

</div>
  `,
  styles: [`
.drp { position: relative; display: inline-block; }

/* ── Trigger ─────────────────────────────── */
.drp__trigger {
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: .5rem .85rem .5rem .6rem;
  background: color-mix(in srgb, var(--primary-color) 4%, var(--surface-card));
  border: var(--border-width, 1px) solid color-mix(in srgb, var(--primary-color) 30%, transparent);
  border-radius: var(--radius-xl, 14px);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
  user-select: none;

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), .08);
  }
}

.drp__icon {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 10px;
  background: var(--primary-gradient, var(--primary-color));
  color: #fff; font-size: 1rem;
}

.drp__body { display: flex; flex-direction: column; }

.drp__lbl {
  font-size: .625rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--primary-color);
}

.drp__val {
  font-size: .82rem; font-weight: 600;
  color: var(--primary-color); white-space: nowrap;
}

.drp__caret {
  font-size: .65rem; color: var(--primary-color);
  margin-left: .35rem; transition: transform .2s;
  flex-shrink: 0;
  &--open { transform: rotate(180deg); }
}

/* ── Panel ───────────────────────────────── */
.drp__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1100;
  width: 290px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl, 14px);
  box-shadow: 0 12px 32px rgba(0,0,0,.14);
  padding: 1rem;
}

/* Month chips */
.drp__chips-wrap {
  margin-bottom: .85rem;
  overflow: hidden;
}

.drp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 88px;
  overflow-y: auto;
  padding-right: 2px;
}

.drp__chip {
  padding: 3px 9px;
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  background: var(--surface-ground);
  color: var(--text-color-secondary);
  font-size: .7rem; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: all .12s; white-space: nowrap;

  &:hover { border-color: var(--primary-color); color: var(--primary-color); background: rgba(var(--primary-rgb),.06); }

  &--active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
  }
}

/* Calendar nav */
.drp__nav {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: .5rem;
}

.drp__nav-btn {
  width: 28px; height: 28px; border: none;
  background: var(--surface-hover, #f3f4f6);
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: .65rem; color: var(--text-color-secondary);
  transition: background .12s, color .12s;
  &:hover { background: rgba(var(--primary-rgb),.1); color: var(--primary-color); }
}

.drp__nav-label {
  font-size: .82rem; font-weight: 700;
  color: var(--text-color); text-transform: capitalize;
}

/* Grid */
.drp__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-bottom: .75rem;
}

.drp__wday {
  text-align: center; font-size: .6rem; font-weight: 700;
  color: var(--text-color-secondary); padding: 3px 0;
  text-transform: uppercase; letter-spacing: .04em;
}

.drp__day {
  aspect-ratio: 1; width: 100%;
  border: none; background: transparent;
  font-size: .78rem; font-family: inherit;
  cursor: pointer; font-weight: 500;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-color); border-radius: 0;
  transition: background .1s;
  position: relative;

  &:hover:not(.drp__day--from):not(.drp__day--to) {
    background: rgba(var(--primary-rgb), .1);
    border-radius: 50%;
    color: var(--primary-color);
  }

  &--empty { cursor: default; pointer-events: none; }

  &--today { color: var(--primary-color); font-weight: 800; }

  &--range {
    background: rgba(var(--primary-rgb), .1);
    color: var(--text-color);
  }

  &--from, &--to {
    background: var(--primary-color) !important;
    color: #fff !important;
    border-radius: 50% !important;
    font-weight: 700;
    z-index: 1;
  }
}

/* Footer */
.drp__footer {
  border-top: 1px solid var(--surface-border);
  padding-top: .7rem;
  display: flex; align-items: center;
  justify-content: space-between; gap: .5rem;
}

.drp__fp {
  font-size: .72rem; font-weight: 500;
  color: var(--text-color-secondary);
  display: flex; align-items: center; gap: 5px;

  &--active { color: var(--primary-color); font-weight: 700; }
}

.drp__fsep {
  color: var(--text-color-secondary); font-size: .7rem; flex-shrink: 0;
}
  `],
})
export class DateRangePickerComponent implements OnChanges {
  @Input() periodes: string[] = [];
  @Input() dateFrom = '';
  @Input() dateTo   = '';
  @Output() rangeChange = new EventEmitter<DateRange>();

  private el = inject(ElementRef);

  open      = false;
  navYear   = new Date().getFullYear();
  navMonth  = new Date().getMonth();
  phase: 'from' | 'to' = 'from';
  hoverDate: string | null = null;
  tempFrom  = '';
  tempTo    = '';

  readonly DAYS   = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  readonly today  = this.toISO(new Date());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dateFrom'] || changes['dateTo']) {
      this.tempFrom = this.dateFrom;
      this.tempTo   = this.dateTo;
      const ref = this.dateTo || this.dateFrom;
      if (ref) {
        const d = new Date(ref);
        this.navYear  = d.getFullYear();
        this.navMonth = d.getMonth();
      }
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target as Node)) this.open = false;
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.tempFrom = this.dateFrom;
      this.tempTo   = this.dateTo;
      this.phase    = 'from';
    }
  }

  /* ── Calendar ──────────────────────────────────── */
  get navLabel(): string {
    return new Date(this.navYear, this.navMonth, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  prevMonth(): void {
    if (this.navMonth === 0) { this.navMonth = 11; this.navYear--; }
    else this.navMonth--;
  }

  nextMonth(): void {
    if (this.navMonth === 11) { this.navMonth = 0; this.navYear++; }
    else this.navMonth++;
  }

  get calendarCells(): (string | null)[] {
    const firstDow = (new Date(this.navYear, this.navMonth, 1).getDay() + 6) % 7; // Mon=0
    const days     = new Date(this.navYear, this.navMonth + 1, 0).getDate();
    const cells: (string | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= days; d++) {
      cells.push(this.toISO(new Date(this.navYear, this.navMonth, d)));
    }
    return cells;
  }

  dayNum(iso: string): number { return +iso.substring(8); }

  clickDay(iso: string): void {
    if (this.phase === 'from' || iso < this.tempFrom) {
      this.tempFrom = iso;
      this.tempTo   = '';
      this.phase    = 'to';
    } else {
      this.tempTo = iso;
      this.phase  = 'from';
      this.emit();
      this.open   = false;
    }
  }

  isInRange(iso: string): boolean {
    const from = this.tempFrom;
    if (!from) return false;
    const to = this.tempTo || (this.hoverDate && this.hoverDate > from ? this.hoverDate : '');
    return !!to && iso > from && iso < to;
  }

  /* ── Chips ─────────────────────────────────────── */
  chipLabel(period: string): string {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      .replace('.', '');
  }

  isChipActive(period: string): boolean {
    if (!this.tempFrom) return false;
    const from = this.tempFrom.substring(0, 7);
    const to   = (this.tempTo || this.tempFrom).substring(0, 7);
    return period >= (from < to ? from : to) && period <= (from < to ? to : from);
  }

  selectChip(period: string): void {
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    this.tempFrom = `${period}-01`;
    this.tempTo   = `${period}-${String(lastDay).padStart(2, '0')}`;
    this.navYear  = y;
    this.navMonth = m - 1;
    this.phase    = 'from';
    this.emit();
    this.open = false;
  }

  /* ── Helpers ───────────────────────────────────── */
  get displayLabel(): string {
    const f = this.dateFrom, t = this.dateTo;
    if (!f && !t) return 'Sélectionner';
    if (f && !t)  return this.formatDisplay(f) + ' → …';
    return this.formatDisplay(f) + ' → ' + this.formatDisplay(t);
  }

  formatDisplay(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  private emit(): void {
    this.rangeChange.emit({ from: this.tempFrom, to: this.tempTo });
  }

  private toISO(d: Date): string {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
