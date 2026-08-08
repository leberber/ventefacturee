import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { ClientsService } from '../../../core/services/clients.service';
import { Client, ClientCategory, ClientCreate } from '../../../core/models/client.model';
import { MapPickerComponent, MapLocation } from '../../../shared/components/map-picker/map-picker.component';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, Toast, InputText, InputNumber, Select, MapPickerComponent],
  providers: [MessageService],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss',
})
export class ClientFormComponent implements OnInit {
  private clientsService = inject(ClientsService);
  private messageService = inject(MessageService);
  private fb             = inject(FormBuilder);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private http           = inject(HttpClient);

  @ViewChild(MapPickerComponent) private mapPicker?: MapPickerComponent;

  editingId: number | null = null;
  saving = false;

  dairaOptions:   { label: string; value: string }[] = [];
  communeOptions: { label: string; value: string }[] = [];
  private dairasData: { daira_name: string; communes: { name: string }[] }[] = [];

  categoryOptions = [
    { label: 'Gros',   value: 'gros'   },
    { label: 'Détail', value: 'detail' },
    { label: 'Horeca', value: 'horeca' },
  ];

  form = this.fb.group({
    // Identification
    customer_no: [''],
    first_name: [''],
    last_name:  [''],
    store_name: [''],
    name:       [''],
    phone:      [''],
    category:   ['gros' as ClientCategory, Validators.required],
    // Classification
    type_client:   [''],
    categorie_bdd: [''],
    tarification:  [''],
    vendeur:       [''],
    route_id:      [''],
    buid:          [''],
    // Location
    wilaya:     [''],
    region:     [''],
    daira:      [''],
    commune:    [''],
    address:    [''],
    latitude:   [null as number | null],
    longitude:  [null as number | null],
    // Codes Sodichn
    code_sodichn:     [''],
    nom_sodichn:      [''],
    // Fiscal
    rc:               [''],
    nif:              [''],
    ai:               [''],
    activite_sodichn: [''],
  });

  ngOnInit() {
    this.http.get<any>('assets/tizi-ouzou.json').subscribe(data => {
      this.dairasData = data.dairas;
      this.dairaOptions = data.dairas.map((d: any) => ({ label: d.daira_name, value: d.daira_name }));

      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.editingId = +idParam;
        const state = history.state as { client?: Client };
        if (state?.client) {
          setTimeout(() => this.prefill(state.client!), 0);
        } else {
          this.router.navigate(['/clients']);
        }
      }
    });
  }

  private prefill(c: Client) {
    const category = (c.category as string).toLowerCase() as ClientCategory;

    const dairaEntry = this.dairasData.find(
      d => d.daira_name.toLowerCase() === (c.daira ?? '').toLowerCase()
    );
    const dairaName = dairaEntry?.daira_name ?? c.daira ?? '';
    const communeEntry = dairaEntry?.communes.find(
      (com: any) => com.name.toLowerCase() === (c.commune ?? '').toLowerCase()
    );
    const communeName = communeEntry?.name ?? c.commune ?? '';

    if (dairaName) this.onDairaChange(dairaName);

    const store_name = c.store_name ?? ((!c.first_name && !c.last_name) ? c.name : '') ?? '';
    this.form.patchValue({
      customer_no: c.customer_no ?? '',
      first_name: c.first_name ?? '', last_name: c.last_name ?? '',
      store_name, name: c.name, phone: c.phone ?? '',
      category, daira: dairaName,
      type_client: c.type_client ?? '', categorie_bdd: c.categorie_bdd ?? '',
      tarification: c.tarification ?? '', vendeur: c.vendeur ?? '',
      route_id: c.route_id ?? '', buid: c.buid ?? '',
      wilaya: c.wilaya ?? '', region: c.region ?? '',
      address: c.address ?? '', latitude: c.latitude ?? null, longitude: c.longitude ?? null,
      code_sodichn: c.code_sodichn ?? '', nom_sodichn: c.nom_sodichn ?? '',
      rc: c.rc ?? '', nif: c.nif ?? '', ai: c.ai ?? '',
      activite_sodichn: c.activite_sodichn ?? '',
    });

    if (communeName) setTimeout(() => this.form.patchValue({ commune: communeName }), 0);
    if (c.latitude && c.longitude) this.mapPicker?.placeAt(c.latitude, c.longitude);
  }

  onDairaChange(dairaName: string) {
    const found = this.dairasData.find(d => d.daira_name === dairaName);
    this.communeOptions = found
      ? found.communes.map((c: any) => ({ label: c.name, value: c.name }))
      : [];
    this.form.patchValue({ commune: '' });
    if (dairaName) this.mapPicker?.flyToPlace(dairaName);
  }

  onCommuneChange(communeName: string) {
    if (communeName) this.mapPicker?.flyToPlace(communeName);
  }

  onMapPick(loc: MapLocation) {
    this.form.patchValue({ latitude: loc.latitude, longitude: loc.longitude });
    if (loc.address && !this.form.get('address')!.value) {
      this.form.patchValue({ address: loc.address });
    }
  }

  get initialLat() { return this.form.get('latitude')!.value; }
  get initialLng() { return this.form.get('longitude')!.value; }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const body: ClientCreate = {
      customer_no:      v.customer_no      || undefined,
      code_sodichn:     v.code_sodichn     || undefined,
      nom_sodichn:      v.nom_sodichn      || undefined,
      first_name:       v.first_name       || undefined,
      last_name:        v.last_name        || undefined,
      store_name:       v.store_name       || undefined,
      name:             [v.first_name, v.last_name].filter(Boolean).join(' ') || v.store_name || v.name || '',
      phone:            v.phone            || undefined,
      category:         v.category as ClientCategory,
      type_client:      v.type_client      || undefined,
      categorie_bdd:    v.categorie_bdd    || undefined,
      tarification:     v.tarification     || undefined,
      vendeur:          v.vendeur          || undefined,
      route_id:         v.route_id         || undefined,
      buid:             v.buid             || undefined,
      wilaya:           v.wilaya           || undefined,
      region:           v.region           || undefined,
      daira:            v.daira            || undefined,
      commune:          v.commune          || undefined,
      address:          v.address          || undefined,
      latitude:         v.latitude         ?? undefined,
      longitude:        v.longitude        ?? undefined,
      rc:               v.rc               || undefined,
      nif:              v.nif              || undefined,
      ai:               v.ai               || undefined,
      activite_sodichn: v.activite_sodichn || undefined,
    };
    const obs = this.editingId
      ? this.clientsService.update(this.editingId, body)
      : this.clientsService.create(body);

    obs.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Client enregistré', life: 3000 });
        setTimeout(() => this.router.navigate(['/clients']), 1000);
      },
      error: e => {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e.error?.detail ?? 'Erreur', life: 4000 });
      },
    });
  }

  locateMe() {
    this.mapPicker?.locateUser();
  }

  cancel() { this.router.navigate(['/clients']); }
}
