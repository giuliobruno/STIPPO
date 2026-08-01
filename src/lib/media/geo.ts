import exifr from "exifr";

export type GeoPoint = {
  latitude: number;
  longitude: number;
  placeName?: string;
  locationSource: "gps" | "exif" | "voice" | "manual";
};

/** Read GPS from image EXIF when present (site photos often have it; screenshots usually don't). */
export async function readExifGps(file: File): Promise<GeoPoint | null> {
  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number" &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    ) {
      return {
        latitude: gps.latitude,
        longitude: gps.longitude,
        locationSource: "exif",
      };
    }
  } catch {
    // no exif / unsupported
  }
  return null;
}

/** Browser / Capacitor geolocation at capture time (opt-in). */
export async function readDeviceGps(): Promise<GeoPoint | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationSource: "gps",
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

/** Approximate place label without calling an external geocoder (privacy-light). */
export function approximatePlaceLabel(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lng).toFixed(3)}°${ew}`;
}
