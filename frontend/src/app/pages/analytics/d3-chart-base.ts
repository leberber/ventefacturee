import {
  Directive, ElementRef, ViewChild, signal, effect, AfterViewInit, OnDestroy,
} from '@angular/core';
import { untracked } from '@angular/core';
import * as d3 from 'd3';

// ── Shared type aliases ────────────────────────────────────────────────────────
export type D3SVG  = d3.Selection<SVGSVGElement,  unknown, null, undefined>;
export type D3G    = d3.Selection<SVGGElement,    unknown, null, undefined>;
export type D3Path = d3.Selection<SVGPathElement, unknown, null, undefined>;
export type D3Line = d3.Selection<SVGLineElement, unknown, null, undefined>;
export type D3Rect = d3.Selection<SVGRectElement, unknown, null, undefined>;

/** Format a number as 1.2M / 500k / 42 */
export function fmtShort(v: number): string {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
       : v >= 1_000     ? `${(v / 1_000).toFixed(0)}k`
       : `${v}`;
}

@Directive()
export abstract class D3ChartBase<T> implements AfterViewInit, OnDestroy {
  @ViewChild('svg') protected svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('tip') protected tipRef!: ElementRef<HTMLDivElement>;

  protected readonly ready = signal(false);
  protected ro: ResizeObserver | null = null;
  protected raf: number | null = null;
  protected lastW = 0;
  protected lastH = 0;
  protected lastDrawnData: T[] | null = null;

  protected built   = false;
  protected svgSel!: D3SVG;
  protected gSel!:   D3G;
  protected gridG!:  D3G;

  constructor(protected readonly host: ElementRef<HTMLElement>) {
    effect(() => {
      if (!this.ready()) return;
      const d = this.getInputData();
      if (d.length && d !== this.lastDrawnData) this.schedule(d, true);
    });
  }

  ngAfterViewInit(): void {
    this.ready.set(true);
    this.ro = new ResizeObserver(() => {
      const W = this.host.nativeElement.clientWidth;
      const H = this.host.nativeElement.clientHeight;
      if (W === this.lastW && H === this.lastH) return;
      const d = untracked(() => this.getInputData());
      if (d.length) this.schedule(d, false);
    });
    this.ro.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    if (this.raf != null) cancelAnimationFrame(this.raf);
  }

  protected schedule(data: T[], animate: boolean): void {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.lastW = this.host.nativeElement.clientWidth;
      this.lastH = this.host.nativeElement.clientHeight;
      this.lastDrawnData = data;
      this.draw(data, animate);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected tx<E extends Element, D>(sel: d3.Selection<E, D, any, any>, name: string, dur: number): any {
    return dur ? sel.transition(name).duration(dur).ease(d3.easeCubicOut) : sel;
  }

  protected updateLayout(W: number, H: number, m: { top: number; left: number }): void {
    this.svgSel.attr('viewBox', `0 0 ${W} ${H}`);
    this.gSel.attr('transform', `translate(${m.left},${m.top})`);
  }

  protected abstract getInputData(): T[];
  protected abstract draw(data: T[], animate: boolean): void;
}
