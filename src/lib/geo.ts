/**
 * Dynamic native/web background geolocation bridge
 */
export type GeoDensity = "ECO_5KM" | "BALANCED_2KM" | "HIGH_FREQ_500M";

export const GEO_DENSITY_FILTERS: Record<GeoDensity, number> = {
  ECO_5KM: 5000,
  BALANCED_2KM: 2000,
  HIGH_FREQ_500M: 500,
};

export class BackgroundGeoEngine {
  private static distanceFilter = 2000; // default

  static setDistanceFilter(density: GeoDensity) {
    this.distanceFilter = GEO_DENSITY_FILTERS[density] || 2000;
    console.info(`[BackgroundGeoEngine] distanceFilter updated dynamically to: ${this.distanceFilter} meters`);
    
    // In a real Native Capacitor app, we would configure the background geolocation plugin here:
    // e.g. BackgroundGeolocation.configure({ distanceFilter: this.distanceFilter });
    if (typeof window !== "undefined" && (window as any).BackgroundGeolocation) {
      try {
        (window as any).BackgroundGeolocation.configure({
          distanceFilter: this.distanceFilter,
        });
      } catch (err) {
        console.warn("[BackgroundGeoEngine] Native configure failed:", err);
      }
    }
  }

  static getDistanceFilter(): number {
    return this.distanceFilter;
  }
}
