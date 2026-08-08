import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-period-stepper',
  standalone: true,
  template: `
    <div class="obj-period-stepper">
      <button class="obj-stepper-btn" (click)="step(-1)"><i class="pi pi-chevron-left"></i></button>
      <span class="obj-stepper-label">{{ label }}</span>
      <button class="obj-stepper-btn" (click)="step(1)"><i class="pi pi-chevron-right"></i></button>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .obj-period-stepper {
      display: flex;
      align-items: center;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      overflow: hidden;
    }
    .obj-stepper-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.2rem;
      border: none;
      background: transparent;
      color: var(--text-color-secondary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .obj-stepper-btn i { font-size: 0.7rem; }
    .obj-stepper-btn:hover { background: var(--surface-ground); color: var(--text-color); }
    .obj-stepper-label {
      padding: 0 0.9rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      white-space: nowrap;
      min-width: 8rem;
      text-align: center;
      border-left: 1px solid var(--surface-border);
      border-right: 1px solid var(--surface-border);
      line-height: 2.2rem;
    }
  `],
})
export class PeriodStepperComponent {
  @Input() mois  = new Date().getMonth() + 1;
  @Input() annee = new Date().getFullYear();
  @Output() periodChange = new EventEmitter<{ mois: number; annee: number }>();

  private readonly MONTHS = [
    { v: 1,  l: 'Janvier' }, { v: 2,  l: 'Février'   }, { v: 3,  l: 'Mars'      },
    { v: 4,  l: 'Avril'   }, { v: 5,  l: 'Mai'        }, { v: 6,  l: 'Juin'      },
    { v: 7,  l: 'Juillet' }, { v: 8,  l: 'Août'       }, { v: 9,  l: 'Septembre' },
    { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre'   }, { v: 12, l: 'Décembre'  },
  ];

  get label(): string {
    return `${this.MONTHS.find(x => x.v === this.mois)?.l ?? ''} ${this.annee}`;
  }

  step(dir: 1 | -1): void {
    let m = this.mois + dir;
    let a = this.annee;
    if (m > 12) { m = 1;  a++; }
    if (m < 1)  { m = 12; a--; }
    this.periodChange.emit({ mois: m, annee: a });
  }
}
