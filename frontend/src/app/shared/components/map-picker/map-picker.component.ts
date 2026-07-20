import { Component, AfterViewInit, OnDestroy, NgZone, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

export interface MapLocation {
  latitude: number;
  longitude: number;
  address: string;
}

// Default center: Freha, Tizi-Ouzou
const DEFAULT_LAT = 36.7376;
const DEFAULT_LNG = 4.2453;
const DEFAULT_ZOOM = 13;

const MARKER_ICON = L.icon({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mp-wrap">

      <div class="mp-search" [class.mp-search--searching]="isSearching()">
        <i class="pi mp-search__icon"
          [class.pi-search]="!isSearching()"
          [class.pi-spin]="isSearching()"
          [class.pi-spinner]="isSearching()"></i>
        <input
          class="mp-search__input"
          type="text"
          placeholder="Rechercher un lieu… (ex: Freha, Azazga)"
          [(ngModel)]="searchQuery"
          (keyup.enter)="search()"
          [disabled]="isSearching()"
        />
        @if (searchQuery && !isSearching()) {
          <button class="mp-search__clear" type="button" (click)="clearSearch()" tabindex="-1">
            <i class="pi pi-times"></i>
          </button>
        }
        <button class="mp-search__btn" type="button" (click)="search()"
          [disabled]="!searchQuery.trim() || isSearching()">
          Aller
        </button>
      </div>

      @if (searchNotFound()) {
        <div class="mp-not-found">
          <i class="pi pi-exclamation-circle"></i>
          <span>Aucun résultat pour « {{ lastSearch() }} »</span>
        </div>
      }

      <div class="mp-map-wrap">
        <div class="mp-map" [id]="mapId()"></div>

        <button class="mp-locate" type="button" (click)="locateUser()" [disabled]="isLocating()"
          title="Ma position">
          <i class="pi"
            [class.pi-compass]="!isLocating()"
            [class.pi-spin]="isLocating()"
            [class.pi-spinner]="isLocating()"></i>
        </button>

        @if (isLoadingAddress() || isLocating()) {
          <div class="mp-loading">
            <i class="pi pi-spin pi-spinner"></i>
            <span>{{ isLocating() ? 'Localisation…' : 'Récupération de l\'adresse…' }}</span>
          </div>
        }
      </div>

      @if (picked()) {
        <div class="mp-address">
          <i class="pi pi-map-marker"></i>
          <span>{{ picked()!.address || (picked()!.latitude.toFixed(5) + ', ' + picked()!.longitude.toFixed(5)) }}</span>
        </div>
      } @else {
        <div class="mp-hint">
          <i class="pi pi-info-circle"></i>
          <span>Cliquez sur la carte pour choisir un emplacement</span>
        </div>
      }

    </div>
  `,
  styles: [`
    .mp-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      height: 100%;
    }

    .mp-search {
      display: flex;
      align-items: center;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      overflow: hidden;
      flex-shrink: 0;
      transition: border-color 0.15s;

      &:focus-within { border-color: var(--primary-color); }
      &--searching { opacity: 0.75; }

      &__icon {
        padding: 0 0.5rem 0 0.75rem;
        color: var(--text-color-secondary);
        font-size: 0.82rem;
        flex-shrink: 0;
      }

      &__input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: var(--font-size-sm);
        color: var(--text-color);
        padding: 0.6rem 0.25rem;
        font-family: inherit;
        min-width: 0;
        &::placeholder { color: var(--text-color-secondary); }
        &:disabled { cursor: wait; }
      }

      &__clear {
        border: none;
        background: transparent;
        color: var(--text-color-secondary);
        cursor: pointer;
        padding: 0 0.4rem;
        display: flex;
        align-items: center;
        i { font-size: 0.7rem; }
        &:hover { color: var(--text-color); }
      }

      &__btn {
        border: none;
        border-left: 1px solid var(--surface-border);
        background: var(--surface-ground);
        color: var(--primary-color);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        font-family: inherit;
        padding: 0.6rem 1rem;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;

        &:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.08); }
        &:disabled { opacity: 0.45; cursor: default; }
      }
    }

    .mp-not-found {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-lg);
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      font-size: var(--font-size-xs);
      color: #dc2626;
      flex-shrink: 0;
      i { font-size: 0.75rem; }
    }

    .mp-map-wrap {
      flex: 1;
      position: relative;
      min-height: 260px;
      border-radius: var(--radius-xl);
      border: var(--border-width) solid var(--surface-border);
      overflow: hidden;
    }

    .mp-map {
      position: absolute;
      inset: 0;
      z-index: 0;
    }

    .mp-locate {
      position: absolute;
      top: 0.625rem;
      right: 0.625rem;
      z-index: 1000;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-lg);
      border: var(--border-width) solid var(--surface-border);
      background: var(--surface-card);
      color: var(--primary-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
      transition: all 0.2s;
      i { font-size: 0.9rem; }

      &:hover:not(:disabled) {
        background: var(--primary-color);
        color: #fff;
        border-color: var(--primary-color);
      }
      &:disabled { opacity: 0.6; cursor: wait; }
    }

    .mp-address, .mp-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-lg);
      font-size: var(--font-size-xs);
      line-height: 1.4;
      flex-shrink: 0;
      i { flex-shrink: 0; font-size: 0.75rem; }
    }

    .mp-address {
      background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      color: var(--primary-color);
      font-weight: var(--font-weight-medium);
    }

    .mp-hint {
      background: var(--surface-ground);
      color: var(--text-color-secondary);
      border: var(--border-width) solid var(--surface-border);
    }

    .mp-loading {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-radius: var(--radius-xl);
      font-size: var(--font-size-sm);
      color: var(--text-color-secondary);
      z-index: 1001;
      i { color: var(--primary-color); }
    }

    :host ::ng-deep .leaflet-control-zoom {
      border-radius: var(--radius-lg) !important;
      border: var(--border-width) solid var(--surface-border) !important;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.10) !important;
    }

    :host ::ng-deep .leaflet-control-zoom a {
      background: var(--surface-card) !important;
      color: var(--text-color) !important;
      border-bottom-color: var(--surface-border) !important;
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      font-size: 16px !important;
    }
  `]
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  private ngZone = inject(NgZone);

  mapId = input('mp-' + Math.random().toString(36).slice(2, 9));
  initialLat = input<number | null>(null);
  initialLng = input<number | null>(null);

  locationPicked = output<MapLocation>();

  private map!: L.Map;
  private marker?: L.Marker;
  private resizeObserver?: ResizeObserver;

  readonly picked           = signal<MapLocation | undefined>(undefined);
  readonly isLoadingAddress = signal(false);
  readonly isLocating       = signal(false);
  readonly isSearching      = signal(false);
  readonly searchNotFound   = signal(false);
  readonly lastSearch       = signal('');

  searchQuery = '';

  ngAfterViewInit(): void {
    // Use rAF to ensure browser has painted before reading dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initMap();

        // Invalidate after CSS animations settle (card-in is 300ms + delays)
        setTimeout(() => this.map?.invalidateSize({ animate: false }), 350);
        setTimeout(() => this.map?.invalidateSize({ animate: false }), 700);

        // Watch the map-wrap container for any layout-driven resize
        const mapWrap = document.getElementById(this.mapId())?.parentElement;
        if (mapWrap && typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => {
            this.map?.invalidateSize({ animate: false });
          });
          this.resizeObserver.observe(mapWrap);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private initMap(): void {
    const lat = this.initialLat() ?? DEFAULT_LAT;
    const lng = this.initialLng() ?? DEFAULT_LNG;

    L.Marker.prototype.options.icon = MARKER_ICON;

    this.map = L.map(this.mapId(), { zoomControl: true }).setView([lat, lng], DEFAULT_ZOOM);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] as string[],
      attribution: '&copy; Google Maps',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.ngZone.run(() => {
        this.placeMarker(e.latlng.lat, e.latlng.lng);
        this.reverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    });

    if (this.initialLat() && this.initialLng()) {
      this.placeMarker(lat, lng);
      this.reverseGeocode(lat, lng);
    }
  }

  locateUser(): void {
    if (!('geolocation' in navigator)) return;
    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        this.map.setView([latitude, longitude], 17);
        this.placeMarker(latitude, longitude);
        this.reverseGeocode(latitude, longitude);
        this.isLocating.set(false);
      },
      () => this.isLocating.set(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  search(): void {
    const q = this.searchQuery.trim();
    if (!q || this.isSearching()) return;
    this.lastSearch.set(q);
    this.searchNotFound.set(false);
    this.isSearching.set(true);

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=fr&countrycodes=dz`;
    fetch(url, { headers: { 'Accept-Language': 'fr' } })
      .then(r => r.json())
      .then((results: any[]) => {
        if (results?.length) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          this.map.flyTo([lat, lng], 14, { duration: 1.2 });
          this.searchNotFound.set(false);
        } else {
          this.searchNotFound.set(true);
        }
      })
      .catch(() => this.searchNotFound.set(true))
      .finally(() => this.isSearching.set(false));
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchNotFound.set(false);
  }

  flyToPlace(name: string, context = 'Tizi-Ouzou, Algeria'): void {
    if (!this.map) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', ' + context)}&format=json&limit=1&accept-language=fr`;
    fetch(url, { headers: { 'Accept-Language': 'fr' } })
      .then(r => r.json())
      .then((results: any[]) => {
        if (results?.length) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          this.map.flyTo([lat, lng], 13, { duration: 1.2 });
        }
      })
      .catch(() => {});
  }

  private placeMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        this.ngZone.run(() => {
          const pos = this.marker!.getLatLng();
          this.reverseGeocode(pos.lat, pos.lng);
        });
      });
    }
  }

  private reverseGeocode(lat: number, lng: number): void {
    this.isLoadingAddress.set(true);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`;
    fetch(url, { headers: { 'Accept-Language': 'fr' } })
      .then(r => r.json())
      .then(data => ({ latitude: lat, longitude: lng, address: data.display_name || '' }))
      .catch(() => ({ latitude: lat, longitude: lng, address: '' }))
      .then((location: MapLocation) => {
        this.ngZone.run(() => {
          this.picked.set(location);
          this.locationPicked.emit(location);
          this.isLoadingAddress.set(false);
        });
      });
  }

  reset(): void {
    if (this.marker) { this.map.removeLayer(this.marker); this.marker = undefined; }
    this.picked.set(undefined);
    this.map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
  }
}
