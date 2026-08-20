import { Component, input, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import { D3ChartBase, fmtShort, type D3G, type D3Path, type D3Line, type D3Rect } from './d3-chart-base';

export interface AreaPoint { label: string; v1: number; v2: number; }

@Component({
  selector: 'app-d3-area',
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
      line-height:1.6;
    }
  `],
})
export class D3AreaComponent extends D3ChartBase<AreaPoint> {
  readonly data    = input<AreaPoint[]>([]);
  readonly v1Label = input('Ventes');
  readonly v2Label = input('FDVs');

  private areaEl!: D3Path;
  private caEl!:   D3Path;
  private blEl!:   D3Path;
  private xAxisG!: D3G;
  private y1AxisG!:D3G;
  private y2AxisG!:D3G;
  private vlineEl!:D3Line;
  private hoverEl!:D3Rect;

  constructor(host: ElementRef<HTMLElement>) { super(host); }

  protected override getInputData(): AreaPoint[] { return this.data(); }

  protected override draw(data: AreaPoint[], animate: boolean): void {
    const el  = this.svgRef?.nativeElement;
    const tip = this.tipRef?.nativeElement;
    if (!el || !tip) return;

    const W  = this.lastW || 400;
    const H  = this.lastH || 220;
    const m  = { top: 16, right: 40, bottom: 28, left: 54 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;
    const dur = animate ? 650 : 0;

    const x  = d3.scalePoint<string>().domain(data.map(d => d.label)).range([0, iW]).padding(0.2);
    const y1 = d3.scaleLinear().domain([0, d3.max(data, d => d.v1) ?? 1]).nice().range([iH, 0]);
    const y2 = d3.scaleLinear().domain([0, d3.max(data, d => d.v2) ?? 1]).nice().range([iH, 0]);

    const curve   = d3.curveCatmullRom.alpha(0.5);
    const areaGen = d3.area<AreaPoint>().x(d => x(d.label)!).y0(iH).y1(d => y1(d.v1)).curve(curve);
    const caGen   = d3.line<AreaPoint>().x(d => x(d.label)!).y(d => y1(d.v1)).curve(curve);
    const blGen   = d3.line<AreaPoint>().x(d => x(d.label)!).y(d => y2(d.v2)).curve(curve);

    const fmtAxis = (v: d3.NumberValue) => fmtShort(+v);

    if (!this.built) {
      this.svgSel = d3.select(el);
      const defs  = this.svgSel.append('defs');
      const grad  = defs.append('linearGradient').attr('id','ag-ven')
        .attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%');
      grad.append('stop').attr('offset','0%').attr('stop-color','#2563eb').attr('stop-opacity', 0.22);
      grad.append('stop').attr('offset','100%').attr('stop-color','#2563eb').attr('stop-opacity', 0);

      const g      = this.gSel    = this.svgSel.append('g');
      this.gridG   = g.append('g');
      this.areaEl  = g.append('path').attr('fill','url(#ag-ven)');
      this.caEl    = g.append('path').attr('fill','none').attr('stroke','#2563eb').attr('stroke-width', 2.5);
      this.blEl    = g.append('path').attr('fill','none').attr('stroke','#f59e0b').attr('stroke-width', 1.8).attr('stroke-dasharray','5,4');
      this.xAxisG  = g.append('g');
      this.y1AxisG = g.append('g');
      this.y2AxisG = g.append('g');
      this.vlineEl = g.append('line').attr('stroke','#94a3b8').attr('stroke-width',1).attr('stroke-dasharray','4,3').style('opacity',0);
      this.hoverEl = this.svgSel.append('rect').attr('fill','transparent');

      const flatLine = d3.line<AreaPoint>().x(d => x(d.label)!).y(() => iH).curve(curve);
      const flatArea = d3.area<AreaPoint>().x(d => x(d.label)!).y0(iH).y1(() => iH).curve(curve);
      this.areaEl.attr('d', flatArea(data) ?? '');
      this.caEl.attr('d', flatLine(data) ?? '');
      this.blEl.attr('d', flatLine(data) ?? '');

      this.built = true;
    }

    this.updateLayout(W, H, m);

    this.gridG
      .call(d3.axisLeft(y1).ticks(4).tickSize(-iW).tickFormat(() => '') as any)
      .call((s: any) => s.select('.domain').remove())
      .call((s: any) => s.selectAll('.tick line').attr('stroke','#e2e8f0').attr('stroke-dasharray','3,3'));

    const setPath = (sel: D3Path, path: string) =>
      this.tx(sel, 'morph', dur).attr('d', path);
    setPath(this.areaEl, areaGen(data) ?? '');
    setPath(this.caEl,   caGen(data)   ?? '');
    setPath(this.blEl,   blGen(data)   ?? '');

    this.gSel.selectAll<SVGCircleElement, AreaPoint>('.dot')
      .data(data, (d: AreaPoint) => d.label)
      .join(
        enter => enter.append('circle').attr('class','dot')
          .attr('r',4).attr('fill','#2563eb').attr('stroke','#fff').attr('stroke-width',2)
          .attr('cx', d => x(d.label)!).attr('cy', iH).attr('opacity', 0)
          .call(e => dur
            ? e.transition().duration(200).delay(dur - 50).attr('cy', d => y1(d.v1)).attr('opacity', 1)
            : e.attr('cy', d => y1(d.v1)).attr('opacity', 1)),
        update => {
          this.tx(update, 'morph', dur)
            .attr('cx', (d: AreaPoint) => x(d.label)!)
            .attr('cy', (d: AreaPoint) => y1(d.v1));
          return update;
        },
        exit => dur
          ? exit.transition().duration(200).attr('opacity', 0).remove()
          : exit.remove()
      );

    this.xAxisG.attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickSize(3) as any)
      .call((s: any) => s.select('.domain').attr('stroke','#e2e8f0'))
      .call((s: any) => s.selectAll('text').attr('fill','#94a3b8').attr('font-size',10).attr('dy','1.1em'))
      .call((s: any) => s.selectAll('.tick line').attr('stroke','#e2e8f0'));

    this.y1AxisG
      .call(d3.axisLeft(y1).ticks(4).tickFormat(fmtAxis) as any)
      .call((s: any) => s.select('.domain').remove())
      .call((s: any) => s.selectAll('text').attr('fill','#64748b').attr('font-size',10));

    this.y2AxisG.attr('transform', `translate(${iW},0)`)
      .call(d3.axisRight(y2).ticks(4) as any)
      .call((s: any) => s.select('.domain').remove())
      .call((s: any) => s.selectAll('text').attr('fill','#d97706').attr('font-size',10));

    this.vlineEl.attr('y1', 0).attr('y2', iH);
    this.hoverEl.attr('x', m.left).attr('y', m.top).attr('width', iW).attr('height', iH)
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event, this.gSel.node());
        const step = iW / (data.length > 1 ? data.length - 1 : 1);
        const idx  = Math.max(0, Math.min(data.length - 1, Math.round(mx / step)));
        const pt   = data[idx];
        if (!pt) return;
        const px = x(pt.label)!;
        this.vlineEl.attr('x1', px).attr('x2', px).style('opacity', 1);
        tip.innerHTML = `<b>${pt.label}</b><br/>${this.v1Label()}: <b>${Math.round(pt.v1).toLocaleString('fr-DZ')}</b><br/>${this.v2Label()}: <b>${Math.round(pt.v2)}</b>`;
        Object.assign(tip.style, { opacity:'1', left:`${m.left + px + 10}px`, top:`${m.top}px` });
      })
      .on('mouseleave', () => { this.vlineEl.style('opacity', 0); tip.style.opacity = '0'; });
  }
}
