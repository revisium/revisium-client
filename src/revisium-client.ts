export interface RevisiumClientOptions {
  baseUrl: string;
}

export class RevisiumClient {
  private readonly _baseUrl: string;
  private readonly _token: string | null = null;

  constructor(options: RevisiumClientOptions) {
    const url = options.baseUrl;
    this._baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  public isAuthenticated(): boolean {
    return this._token !== null;
  }
}
