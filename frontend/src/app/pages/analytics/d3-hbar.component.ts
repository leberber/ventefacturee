import { Component, input, output, effect, ElementRef, untracked } from '@angular/core';
import * as d3 from 'd3';
import { D3ChartBase, fmtShort, type D3G } from './d3-chart-base';

export interface HBarItem { name: string; value: number; id?: number; }

@Component({
  selector: 'app-d3-hbar',
  standalone: true,
  template: `
    <svg #svg style="width:100%;height:100%;overflow:visible"></svg>
    <div #tip class="d3tip"></div>
  `,
  styles: [`
    :host { display:block; height:100%; width:100%; position:relative; }
    .d3tip {
      position:absolute; pointer-events:none;
      background:rgba(15,23,42,.88); color:#fff;
      font-size:12px; padding:7px 11px;
      border-radius:8px; opacity:0;
      transition:opacity .12s; white-space:nowrap; z-index:20;
    }
  `],
})
export class D3HbarComponent extends D3ChartBase<HBarItem> {
  readonly data       = input<HBarItem[]>([]);
  readonly color      = input('#2563eb');
  readonly label      = input('caisses');
  readonly selectedId = input<number | null>(null);
  readonly itemSelect = output<HBarItem | null>();

  private tracksG!: D3G;

  constructor(host: ElementRef<HTMLElement>) {
    super(host);
    effect(() => {
      const selId = this.selectedId();
      if (!this.built) return;
      this.gSel.selectAll<SVGRectElement, HBarItem>('.bar')
        .transition('opacity').duration(220).ease(d3.easeCubicOut)
        .attr('opacity', (d: HBarItem) => selId != null && d.id !== selId ? 0.25 : 1);
    });
  }

  protected override getInputData(): HBarItem[] { return this.data(); }

  protected override draw(data: HBarItem[], animate: boolean): void {
    const el  = this.svgRef?.nativeElement;
    const tip = this.tipRef?.nativeElement;
    if (!el || !tip) return;

    const W  = this.lastW || 400;
    const H  = this.lastH || 260;
    const lw = Math.min(W * 0.38, 160);
    const m  = { top: 6, right: 72, bottom: 6, left: lw };
    const iW = W - m.left - m.right;
    const iH = H - m.top - m.bottom;
    const dur = animate ? 550 : 0;

    const y = d3.scaleBand<string>().domain(data.map(d => d.name)).range([0, iH]).padding(0.35);
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.value) ?? 1]).range([0, iW]);

    const barColor = this.color();
    const maxVal   = d3.max(data, d => d.value) ?? 1;
    const base     = d3.color(barColor)!.rgb();
    const lightHex = d3.rgb(base.r + (255-base.r)*0.82, base.g + (255-base.g)*0.82, base.b + (255-base.b)*0.82).formatHex();
    const colorFor = (v: number) => d3.interpolateRgb(lightHex, barColor)(Math.sqrt(v / maxVal));
    const selId    = untracked(() => this.selectedId());

    if (!this.built) {
      this.svgSel  = d3.select(el);
      this.gSel    = this.svgSel.append('g');
      this.tracksG = this.gSel.append('g');
      this.built   = true;
    }

    this.updateLayout(W, H, m);

    this.tracksG.selectAll<SVGRectElement, HBarItem>('.track')
      .data(data, (d: HBarItem) => d.name)
      .join(
        enter => enter.append('rect').attr('class','track')
          .attr('rx', 4).attr('fill', '#f1f5f9')
          .attr('x', 0).attr('width', iW)
          .attr('y', d => y(d.name)!).attr('height', y.bandwidth()),
        update => {
          this.tx(update, 'draw', dur).attr('y', (d: HBarItem) => y(d.name)!)
            .attr('height', y.bandwidth()).attr('width', iW);
          return update;
        },
        exit => exit.remove()
      );

    this.gSel.selectAll<SVGRectElement, HBarItem>('.bar')
      .data(data, (d: HBarItem) => d.name)
      .join(
        enter => enter.append('rect').attr('class','bar')
          .attr('rx', 4).attr('fill', (d: HBarItem) => colorFor(d.value))
          .attr('x', 0).attr('width', 0)
          .attr('y', d => y(d.name)!).attr('height', y.bandwidth())
          .attr('opacity', d => selId != null && d.id !== selId ? 0.25 : 1)
          .call(e => this.tx(e, 'draw', dur)
            .attr('y', (d: HBarItem) => y(d.name)!).attr('height', y.bandwidth())
            .attr('width', (d: HBarItem) => x(d.value))),
        update => {
          this.tx(update, 'draw', dur)
            .attr('fill', (d: HBarItem) => colorFor(d.value))
            .attr('y', (d: HBarItem) => y(d.name)!).attr('height', y.bandwidth())
            .attr('width', (d: HBarItem) => x(d.value));
          return update;
        },
        exit => dur
          ? exit.transition('draw').duration(dur / 2).attr('width', 0).remove()
          : exit.remove()
      );

    this.gSel.selectAll<SVGTextElement, HBarItem>('.val')
      .data(data, (d: HBarItem) => d.name)
      .join(
        enter => enter.append('text').attr('class','val')
          .attr('font-size', 11).attr('font-weight', 600).attr('fill', (d: HBarItem) => colorFor(d.value))
          .attr('dominant-baseline', 'middle').attr('opacity', 0)
          .attr('y', d => y(d.name)! + y.bandwidth() / 2)
          .attr('x', d => x(d.value) + 7)
          .text(d => fmtShort(d.value))
          .call(e => this.tx(e, 'draw', dur).attr('opacity', 1)),
        update => {
          this.tx(update, 'draw', dur)
            .attr('fill', (d: HBarItem) => colorFor(d.value))
            .attr('y', (d: HBarItem) => y(d.name)! + y.bandwidth() / 2)
            .attr('x', (d: HBarItem) => x(d.value) + 7);
          update.text(d => fmtShort(d.value));
          return update;
        },
        exit => dur
          ? exit.transition().duration(dur / 2).attr('opacity', 0).remove()
          : exit.remove()
      );

    this.svgSel.selectAll<SVGTextElement, HBarItem>('.name')
      .data(data, (d: HBarItem) => d.name)
      .join(
        enter => enter.append('text').attr('class','name')
          .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
          .attr('font-size', 11).attr('fill','#475569').attr('font-weight', 500)
          .attr('x', m.left - 10)
          .attr('y', d => m.top + y(d.name)! + y.bandwidth() / 2)
          .text(d => {
            const parts = d.name.split(' ');
            const label = parts.slice(0, 3).join(' ') + (parts.length > 3 ? '…' : '');
            return label;
          }),
        update => {
          this.tx(update, 'draw', dur)
            .attr('y', (d: HBarItem) => m.top + y(d.name)! + y.bandwidth() / 2);
          return update;
        },
        exit => dur
          ? exit.transition().duration(dur / 2).attr('opacity', 0).remove()
          : exit.remove()
      );

    this.gSel.selectAll<SVGRectElement, HBarItem>('.hover-zone')
      .data(data, (d: HBarItem) => d.name)
      .join(
        enter => enter.append('rect').attr('class','hover-zone')
          .attr('fill','transparent').style('cursor','pointer')
          .attr('x', -m.left).attr('width', W)
          .attr('y', d => y(d.name)!).attr('height', y.bandwidth())
          .on('mouseover', (_, d) => {
            tip.innerHTML = `<b>${d.name}</b><br/>${fmtShort(d.value)} ${this.label()}`;
            tip.style.opacity = '1';
          })
          .on('mousemove', (event: MouseEvent) => {
            Object.assign(tip.style, { left: `${event.offsetX + 10}px`, top: `${event.offsetY - 34}px` });
          })
          .on('mouseout', () => { tip.style.opacity = '0'; })
          .on('click', (_, d) => {
            const cur = untracked(() => this.selectedId());
            this.itemSelect.emit(cur === d.id ? null : d);
          }),
        update => {
          this.tx(update, 'draw', dur)
            .attr('y', (d: HBarItem) => y(d.name)!).attr('height', y.bandwidth())
            .attr('x', -m.left).attr('width', W);
          return update;
        },
        exit => exit.remove()
      );
  }
}
