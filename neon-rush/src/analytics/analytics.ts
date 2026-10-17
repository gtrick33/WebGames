/**
 * Privacy-friendly analytics seam. The default implementation keeps events in memory only and
 * sends nothing over the network. Swap in a real sink (with a consent flow) later.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  track(name: string, props?: AnalyticsProps): void;
}

export class LocalAnalytics implements AnalyticsSink {
  readonly buffer: { name: string; props: AnalyticsProps; t: number }[] = [];
  constructor(private readonly debug = false, private readonly limit = 200) {}
  track(name: string, props: AnalyticsProps = {}): void {
    this.buffer.push({ name, props, t: Date.now() });
    if (this.buffer.length > this.limit) this.buffer.shift();
    if (this.debug) console.info('[analytics]', name, props);
  }
}
