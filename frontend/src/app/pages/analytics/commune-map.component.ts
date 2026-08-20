import {
  Component, input, output, effect, ElementRef, ViewChild, signal,
  AfterViewInit, OnDestroy, inject,
} from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';

export interface CommuneDatum { code: number; total: number; }

type MapMode = 'choropleth' | 'bubbles';

interface GeoFeatureCollection {
  type: string;
  features: Array<{ type: string; properties: Record<string, any>; geometry: any }>;
}

@Component({
  selector: 'app-commune-map',
  standalone: true,
  template: `
    <div #mapEl style="width:100%;height:100%;"></div>
    <div #cardEl class="map-card"></div>

    <!-- Mode toggle -->
    <div class="map-mode-toggle">
      <button [class.active]="mapMode() === 'choropleth'" (click)="setMapMode('choropleth')" title="Choroplèthe">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 3h5v4H1zM1 8h5v3H1zM7 1h6v5H7zM7 7h6v4H7z" fill="currentColor" opacity=".85"/>
        </svg>
      </button>
      <button [class.active]="mapMode() === 'bubbles'" (click)="setMapMode('bubbles')" title="Bulles">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4"  cy="10" r="3"   fill="currentColor" opacity=".5"/>
          <circle cx="10" cy="7"  r="4.5" fill="currentColor" opacity=".85"/>
          <circle cx="5"  cy="4"  r="2"   fill="currentColor" opacity=".65"/>
        </svg>
      </button>
    </div>

    <div class="map-legend">
      <span class="map-legend__label">0</span>
      <div class="map-legend__bar" [class.map-legend__bar--bubble]="mapMode() === 'bubbles'"></div>
      <span class="map-legend__label">{{ maxStr() }}</span>
    </div>

    @if (geoLoading()) {
      <div class="map-sk">Chargement de la carte…</div>
    } @else if (geoError()) {
      <div class="map-sk map-sk--err">Carte indisponible</div>
    }
  `,
  styles: [`
    :host { display:block; width:100%; height:100%; position:relative; overflow:hidden; }

    .map-card {
      position:absolute; bottom:18px; left:14px; z-index:500;
      width:200px;
      background:rgba(255,255,255,.94);
      border:1px solid rgba(226,232,240,.9);
      border-radius:14px; padding:12px 14px;
      box-shadow:0 8px 28px rgba(0,0,0,.11), 0 2px 6px rgba(0,0,0,.06);
      font-size:12px; pointer-events:none;
      opacity:0; transition:opacity .18s;
      &.visible { opacity:1; }
      &.fading   { opacity:0; }
    }

    .map-mode-toggle {
      position:absolute; top:10px; left:10px; z-index:500;
      display:flex; border-radius:8px; overflow:hidden;
      border:1px solid #e2e8f0;
      box-shadow:0 1px 4px rgba(0,0,0,.08);

      button {
        display:flex; align-items:center; justify-content:center;
        width:30px; height:28px;
        background:rgba(255,255,255,.92);
        color:#64748b; border:none; cursor:pointer;
        transition:background .15s, color .15s;

        &:hover { background:#f1f5f9; color:#1e293b; }
        &.active { background:#2563eb; color:#fff; }
        &:not(:last-child) { border-right:1px solid #e2e8f0; }
      }
    }

    .map-legend {
      position:absolute; top:10px; right:10px; z-index:500;
      display:flex; align-items:center; gap:6px; pointer-events:none;
      background:rgba(255,255,255,.85); border:1px solid #e2e8f0;
      border-radius:8px; padding:5px 9px; font-size:10px; color:#64748b;

      &__bar {
        width:72px; height:6px; border-radius:3px;
        background:linear-gradient(90deg,#dbeafe,#2563eb);

        &--bubble {
          background:linear-gradient(90deg,
            rgba(37,99,235,.15) 0%,
            rgba(37,99,235,.7) 100%);
        }
      }
      &__label { white-space:nowrap; }
    }

    .map-sk {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(248,250,252,.88); color:#94a3b8; font-size:13px; z-index:600;
      &--err { color:#ef4444; }
    }
  `],
})
export class CommuneMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('cardEl') cardEl!: ElementRef<HTMLDivElement>;

  readonly data          = input<CommuneDatum[]>([]);
  readonly selectedCode  = input<number | null>(null);
  readonly communeSelect = output<{ code: number; name: string } | null>();

  readonly geoLoading = signal(true);
  readonly geoError   = signal(false);
  readonly maxStr     = signal('');
  readonly mapMode    = signal<MapMode>('choropleth');

  private http      = inject(HttpClient);
  private geoData   = signal<GeoFeatureCollection | null>(null);
  private mapReady  = signal(false);
  private map: L.Map | null = null;
  private geoLayer: L.FeatureGroup | null = null;
  private top1Marker: L.Marker | null = null;
  private cleanupTimers: ReturnType<typeof setTimeout>[] = [];

  private top1Code: number | undefined;
  private showTop1: (() => void) | null = null;

  setMapMode(m: MapMode): void { this.mapMode.set(m); }

  constructor() {
    // Fetch GeoJSON when data (commune codes) changes
    effect(() => {
      const data = this.data();
      if (!this.mapReady() || !data.length) return;
      const codes = data.map(d => d.code).join(',');
      this.geoLoading.set(true);
      this.geoError.set(false);
      this.geoData.set(null);
      this.http.get<GeoFeatureCollection>(`/api/v1/prevendeur/admin/communes-geojson?codes=${codes}`).subscribe({
        next: geo => { this.geoData.set(geo); this.geoLoading.set(false); },
        error: err => {
          console.error('[commune-map] GeoJSON load failed:', err);
          this.geoLoading.set(false); this.geoError.set(true);
        },
      });
    }, { allowSignalWrites: true });

    // Re-render when geo data, data values, or map mode changes
    effect(() => {
      const geo  = this.geoData();
      const data = this.data();
      void this.mapMode(); // track mode changes
      if (!this.mapReady() || !geo) return;
      this.renderLayer(geo, data);
    }, { allowSignalWrites: true });

    // Highlight selected commune
    effect(() => {
      const selCode = this.selectedCode();
      if (!this.geoLayer) return;
      this.geoLayer.eachLayer(layer => {
        const code   = this.layerCode(layer);
        const isTop1 = code === this.top1Code;
        const isSel  = code === selCode;
        if (this.mapMode() === 'bubbles') {
          (layer as L.CircleMarker).setStyle({
            weight: isSel ? 2.5 : 1,
            color:  isSel ? '#7c3aed' : '#fff',
          });
        } else {
          (layer as L.Path).setStyle({
            weight:    isSel || isTop1 ? 2.5 : 0.6,
            color:     isSel ? '#7c3aed' : isTop1 ? '#2563eb' : '#94a3b8',
            dashArray: isTop1 ? '6 4' : undefined,
          });
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [36.6949, 3.9753], zoom: 9,
      zoomControl: false, attributionControl: false, zoomSnap: 0.5,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
    }).addTo(this.map);
    this.mapReady.set(true);
  }

  ngOnDestroy(): void {
    this.cleanupTimers.forEach(clearTimeout);
    this.map?.remove(); this.map = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private layerCode(layer: L.Layer): number | undefined {
    const v = (layer as any).feature?.properties?.['code'] ?? (layer as any).communeCode;
    return v != null ? Number(v) : undefined;
  }

  private layerName(layer: L.Layer): string | undefined {
    return ((layer as any).feature?.properties?.['name'] ?? (layer as any).communeName) as string | undefined;
  }

  private fillColor(total: number, maxTotal: number): string {
    const t = Math.pow(total / maxTotal, 0.5);
    return `rgb(${Math.round(219 - 190 * t)},${Math.round(234 - 156 * t)},${Math.round(254 - 38 * t)})`;
  }

  private fmtVal(v: number): string {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
  }

  private findLayerByCode(code: number): L.Layer | undefined {
    let found: L.Layer | undefined;
    this.geoLayer?.eachLayer(l => { if (this.layerCode(l) === code) found = l; });
    return found;
  }

  // ── Floating info card ────────────────────────────────────────────────────

  private setCard(html: string): void {
    const el = this.cardEl?.nativeElement;
    if (!el) return;
    el.classList.add('fading');
    setTimeout(() => {
      el.innerHTML = html;
      el.classList.remove('fading');
      el.classList.add('visible');
    }, 180);
  }

  private buildCard(name: string | undefined, row: CommuneDatum | undefined, totalAll: number, rank?: number): string {
    const bc = rank === 1 ? '#2563eb' : rank && rank <= 3 ? '#1d4ed8' : '#3b82f6';
    const header = `
      <div style="display:flex;align-items:flex-start;gap:9px;margin-bottom:12px">
        ${rank ? `<div style="min-width:28px;height:28px;border-radius:8px;background:${bc};
                    display:flex;align-items:center;justify-content:center;
                    font-size:9px;font-weight:800;color:#fff;flex-shrink:0">#${rank}</div>` : ''}
        <div style="min-width:0">
          <div style="font-weight:700;color:#0f172a;font-size:13px;line-height:1.25;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name ?? '—'}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:1px">Commune</div>
        </div>
      </div>`;
    if (!row || row.total === 0) return header + `<div style="color:#94a3b8;font-size:11px">Aucune vente sur la période</div>`;
    const pct = Math.round((row.total / totalAll) * 100);
    return header + `
      <div style="font-size:21px;font-weight:800;color:${bc};letter-spacing:-.5px;line-height:1;margin-bottom:10px">
        ${this.fmtVal(row.total)} <span style="font-size:11px;font-weight:500;color:#64748b">unités</span></div>
      <div style="height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#93c5fd,${bc});border-radius:3px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
        <span>Part du total</span><span>${pct}%</span>
      </div>`;
  }

  // ── #1 marker ─────────────────────────────────────────────────────────────

  private placeTop1Pin(center: L.LatLng, name: string | undefined): void {
    this.top1Marker?.remove();
    this.top1Marker = null;
    if (!this.map) return;
    const icon = L.divIcon({
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#0369a1;color:#fff;
              font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;
              border:2.5px solid #fff;box-shadow:0 2px 8px rgba(3,105,161,.45);
              pointer-events:none">#1</div>`,
      className: '', iconSize: [26, 26] as any, iconAnchor: [13, 13] as any,
    });
    this.top1Marker = L.marker(center, { icon, interactive: false }).addTo(this.map);
  }

  // ── Choropleth fill animation ─────────────────────────────────────────────

  private animateFills(dataMap: Map<number, CommuneDatum>, maxTotal: number, rankMap: Map<number, number>): void {
    if (!this.geoLayer) return;
    const STAGGER = 140, DUR = 500;
    type E = { path: SVGPathElement; fill: string; rank: number };
    const top: E[] = [], rest: E[] = [];

    this.geoLayer.eachLayer(layer => {
      const code = this.layerCode(layer);
      const row  = code != null ? dataMap.get(code) : undefined;
      const path = (layer as any)._path as SVGPathElement | undefined;
      if (!path) return;
      const fill = row && row.total > 0 ? this.fillColor(row.total, maxTotal) : '#eff6ff';
      const rank = code != null ? (rankMap.get(code) ?? 9999) : 9999;
      rank <= 6 ? top.push({ path, fill, rank }) : rest.push({ path, fill, rank });
    });

    rest.forEach(({ path, fill }) => { path.style.transitionDelay = '0ms'; path.style.fill = fill; });
    top.sort((a, b) => a.rank - b.rank).forEach(({ path, fill, rank }) => {
      path.style.transitionDelay = `${(rank - 1) * STAGGER}ms`;
      path.style.fill = fill;
    });

    const t = setTimeout(() => {
      this.geoLayer?.eachLayer(l => {
        const p = (l as any)._path as SVGPathElement | undefined;
        if (p) p.style.transitionDelay = '';
      });
    }, (top.length - 1) * STAGGER + DUR + 80);
    this.cleanupTimers.push(t);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private renderLayer(geo: GeoFeatureCollection, data: CommuneDatum[]): void {
    if (!this.map) return;
    this.cleanupTimers.forEach(clearTimeout);
    this.cleanupTimers = [];
    this.top1Marker?.remove();
    this.top1Marker = null;

    const dataMap  = new Map(data.map(d => [d.code, d]));
    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const totalAll = data.reduce((s, d) => s + d.total, 0) || 1;
    const sorted   = [...dataMap.values()].filter(d => d.total > 0).sort((a, b) => b.total - a.total);
    const rankMap  = new Map<number, number>(sorted.map((d, i) => [d.code, i + 1]));
    this.top1Code  = sorted[0]?.code;

    this.maxStr.set(maxTotal >= 1000 ? `${(maxTotal / 1000).toFixed(0)}k` : `${maxTotal}`);

    if (this.geoLayer) { this.geoLayer.remove(); this.geoLayer = null; }

    if (this.mapMode() === 'bubbles') {
      this.renderBubbles(geo, dataMap, maxTotal, totalAll, rankMap, sorted);
    } else {
      this.renderChoropleth(geo, dataMap, maxTotal, totalAll, rankMap, sorted);
    }

    const bounds = this.geoLayer!.getBounds();
    this.map.fitBounds(bounds, { padding: [12, 12] });
    this.map.setZoom(this.map.getZoom() + 0.5);

    // Show top-1 card
    const top1Layer = this.findLayerByCode(this.top1Code!);
    const top1Name  = top1Layer ? this.layerName(top1Layer) : undefined;
    this.showTop1 = () => this.setCard(this.buildCard(top1Name, sorted[0], totalAll, 1));
    this.showTop1();
  }

  // ── Choropleth mode ───────────────────────────────────────────────────────

  private renderChoropleth(
    geo: GeoFeatureCollection,
    dataMap: Map<number, CommuneDatum>,
    maxTotal: number,
    totalAll: number,
    rankMap: Map<number, number>,
    sorted: CommuneDatum[],
  ): void {
    this.geoLayer = L.geoJSON(geo as any, {
      style: (feature?: any) => {
        const code   = feature?.properties?.['code'] != null ? Number(feature.properties['code']) : undefined;
        const isTop1 = code === this.top1Code;
        return {
          fillColor: '#eff6ff', fillOpacity: 0.85,
          color:  isTop1 ? '#2563eb' : '#94a3b8',
          weight: isTop1 ? 2.5 : 0.6,
          dashArray: isTop1 ? '6 4' : undefined,
        };
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const code = feature.properties?.['code'] != null ? Number(feature.properties['code']) : undefined;
        const name = feature.properties?.['name'] as string | undefined;

        const baseStyle = () => {
          const isTop1 = code === this.top1Code;
          const isSel  = code === this.selectedCode();
          return {
            weight:    isSel || isTop1 ? 2.5 : 0.6,
            color:     isSel ? '#7c3aed' : isTop1 ? '#2563eb' : '#94a3b8',
            dashArray: isTop1 ? '6 4' : undefined,
          };
        };

        layer.on('mouseover', () => {
          (layer as L.Path).setStyle({ weight: 2, color: '#1d4ed8' });
          this.setCard(this.buildCard(name, dataMap.get(code!), totalAll, rankMap.get(code!)));
        });
        layer.on('mouseout', () => { (layer as L.Path).setStyle(baseStyle()); this.showTop1?.(); });
        layer.on('click', () => {
          if (code == null) return;
          this.communeSelect.emit(this.selectedCode() === code ? null : { code, name: name ?? '' });
        });
      },
    }) as unknown as L.FeatureGroup;

    this.geoLayer.addTo(this.map!);

    this.geoLayer.eachLayer(layer => {
      const path = (layer as any)._path as SVGPathElement | undefined;
      if (path) { path.style.fill = '#eff6ff'; path.style.transition = 'fill 0.5s ease'; }
    });

    this.animateFills(dataMap, maxTotal, rankMap);

    const top1Layer = this.findLayerByCode(this.top1Code!);
    if (top1Layer) {
      const center = (top1Layer as L.Polygon).getBounds().getCenter();
      const t = setTimeout(() => this.placeTop1Pin(center, this.layerName(top1Layer)), 80);
      this.cleanupTimers.push(t);
    }
  }

  // ── Bubble mode ───────────────────────────────────────────────────────────

  private renderBubbles(
    geo: GeoFeatureCollection,
    dataMap: Map<number, CommuneDatum>,
    maxTotal: number,
    totalAll: number,
    rankMap: Map<number, number>,
    sorted: CommuneDatum[],
  ): void {
    const MAX_R = 38, MIN_R = 4;
    const group = L.featureGroup();

    for (const feature of geo.features) {
      const code = feature.properties?.['code'] != null ? Number(feature.properties['code']) : undefined;
      const name = feature.properties?.['name'] as string | undefined;
      const row  = code != null ? dataMap.get(code) : undefined;
      if (code == null) continue;

      const center = L.geoJSON(feature as any).getBounds().getCenter();
      const radius = row && row.total > 0
        ? MIN_R + Math.sqrt(row.total / maxTotal) * (MAX_R - MIN_R)
        : MIN_R * 0.5;
      const rank   = rankMap.get(code);
      const alpha  = row && row.total > 0 ? 0.25 + Math.sqrt(row.total / maxTotal) * 0.55 : 0.12;

      const marker = L.circleMarker(center, {
        radius,
        fillColor:   '#2563eb',
        fillOpacity: alpha,
        color:       '#fff',
        weight:      1,
      });

      (marker as any).communeCode = code;
      (marker as any).communeName = name;

      marker.on('mouseover', () => {
        marker.setStyle({ color: '#1d4ed8', weight: 2 });
        this.setCard(this.buildCard(name, row, totalAll, rank));
      });
      marker.on('mouseout', () => {
        const isSel = code === this.selectedCode();
        marker.setStyle({ color: isSel ? '#7c3aed' : '#fff', weight: isSel ? 2.5 : 1 });
        this.showTop1?.();
      });
      marker.on('click', () => {
        this.communeSelect.emit(this.selectedCode() === code ? null : { code, name: name ?? '' });
      });

      group.addLayer(marker);
    }

    // Sort so bigger bubbles render on bottom (added first = lower z-order)
    // Leaflet SVG stacks in DOM order, so we want large → small insertion
    // group already built; re-sort by descending radius not needed in Leaflet SVG
    this.geoLayer = group;
    group.addTo(this.map!);

    // Pin #1 bubble
    const top1Layer = this.findLayerByCode(this.top1Code!);
    if (top1Layer) {
      const center = (top1Layer as L.CircleMarker).getLatLng();
      const t = setTimeout(() => this.placeTop1Pin(center, this.layerName(top1Layer)), 80);
      this.cleanupTimers.push(t);
    }
  }
}
