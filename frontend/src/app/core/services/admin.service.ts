import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
}

export interface LogStats {
  file_size_human: string;
  total_lines: number;
}

export interface LogsResponse {
  entries: LogEntry[];
  stats: LogStats;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  getLogs(lines = 100, level?: string) {
    let params = new HttpParams().set('lines', lines);
    if (level) params = params.set('level', level);
    return this.http.get<LogsResponse>('/api/v1/admin/logs', { params });
  }
}
