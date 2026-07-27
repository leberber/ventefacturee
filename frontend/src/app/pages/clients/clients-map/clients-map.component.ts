import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';

const DEFAULT_LAT = 36.7376;
const DEFAULT_LNG = 4.2453;

const CATEGORY_COLORS: Record<string, string> = {
  gros:   '#3b82f6',
  detail: '#22c55e',
  horeca: '#f59e0b',
};

const CATEGORY_LABELS: Record<string, string> = {
  gros:   'Gros',
  detail: 'Détail',
  horeca: 'Horeca',
};

@Component({
  selector: 'app-clients-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients-map.component.html',
  styleUrl: './clients-map.component.scss',
})
export class ClientsMapComponent implements OnInit, OnDestroy {
  private clientsService = inject(ClientsService);
  private router = inject(Router);

  private map!: L.Map;
  private clusterGroup!: L.MarkerClusterGroup;

  loading = true;
  allClients: Client[] = [];
  searchQuery = '';
  selectedClient: Client | null = null;

  // Keep only coordinates that fall within Algeria's bounding box
  private isValidCoord(c: Client): boolean {
    return !!c.latitude && !!c.longitude &&
      c.latitude  >= 18 && c.latitude  <= 38 &&
      c.longitude >= -9 && c.longitude <= 12;
  }

  get clientsWithLocation(): Client[] {
    return this.allClients.filter(c => this.isValidCoord(c));
  }

  get filteredClients(): Client[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.clientsWithLocation;
    return this.clientsWithLocation.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.commune ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q)
    );
  }

  ngOnInit(): void {
    this.clientsService.list().subscribe({
      next: clients => {
        this.allClients = clients;
        this.loading = false;
        setTimeout(() => this.initMap(), 100);
      },
      error: () => {
        this.loading = false;
        setTimeout(() => this.initMap(), 100);
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    this.clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 36 : count < 100 ? 44 : 52;
        return L.divIcon({
          html: `<div class="cm-cluster" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    this.map = L.map('clients-map-el', {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: 10,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] as string[],
      attribution: '&copy; Google Maps',
    }).addTo(this.map);

    this.clusterGroup.addTo(this.map);
    this.renderMarkers();
    this.fitBounds();

    setTimeout(() => {
      this.map.invalidateSize();
      this.fitBounds();
    }, 200);
    setTimeout(() => this.map.invalidateSize(), 600);
  }

  private renderMarkers(): void {
    this.clusterGroup.clearLayers();
    this.filteredClients.forEach(client => {
      const marker = this.createMarker(client);
      this.clusterGroup.addLayer(marker);
    });
  }

  private createMarker(client: Client): L.Marker {
    const cat = (client.category as string).toLowerCase();
    const color = CATEGORY_COLORS[cat] ?? '#6366f1';
    const initial = client.name.charAt(0).toUpperCase();

    const icon = L.divIcon({
      className: '',
      html: `<div class="cm-marker" style="background:${color};box-shadow:0 2px 6px ${color}66"><span>${initial}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([client.latitude!, client.longitude!], { icon });
    marker.bindTooltip(client.name, { permanent: false, direction: 'top', offset: [0, -18] });
    marker.on('click', () => this.selectClient(client));
    return marker;
  }

  private fitBounds(): void {
    const points: L.LatLngTuple[] = this.filteredClients.map(c => [c.latitude!, c.longitude!]);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    } else {
      // Fall back to Tizi-Ouzou if no valid points
      this.map.setView([DEFAULT_LAT, DEFAULT_LNG], 10);
    }
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.map.flyTo([client.latitude!, client.longitude!], 15, { duration: 1 });
  }

  closePanel(): void {
    this.selectedClient = null;
  }

  onSearch(): void {
    if (!this.map) return;
    this.renderMarkers();
    const results = this.filteredClients;
    if (results.length === 1) {
      // Single match — select it and fly to it
      this.selectClient(results[0]);
    } else if (results.length > 1) {
      // Multiple matches — fit bounds to show all of them
      this.fitBounds();
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.selectedClient = null;
    if (this.map) {
      this.renderMarkers();
      this.fitBounds();
    }
  }

  goBack(): void {
    this.router.navigate(['/clients']);
  }

  categoryLabel(cat: string): string {
    return CATEGORY_LABELS[(cat ?? '').toLowerCase()] ?? cat;
  }

  categoryColor(cat: string): string {
    return CATEGORY_COLORS[(cat ?? '').toLowerCase()] ?? '#6366f1';
  }

  locationLabel(client: Client): string {
    return [client.commune, client.daira].filter(v => !!v).join(', ');
  }

  readonly categoryDefs = [
    { key: 'gros',   label: 'Gros',   color: '#3b82f6' },
    { key: 'detail', label: 'Détail', color: '#22c55e' },
    { key: 'horeca', label: 'Horeca', color: '#f59e0b' },
  ];

  countByCategory(key: string): number {
    return this.filteredClients.filter(c => (c.category as string).toLowerCase() === key).length;
  }
}
