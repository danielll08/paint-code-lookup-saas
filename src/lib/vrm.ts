export type VehicleIdentifier = { kind: "VRM" | "VIN"; value: string };

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/; // ISO 3779: no I, O or Q
const VRM_PATTERN = /^[A-Z0-9]{2,8}$/;

/** "ab12 cde" -> "AB12CDE" (PRD 2.3 step 1). */
export function normalizeVrm(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseVehicleIdentifier(input: string): VehicleIdentifier | null {
  const value = normalizeVrm(input);
  if (VIN_PATTERN.test(value)) return { kind: "VIN", value };
  if (VRM_PATTERN.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)) return { kind: "VRM", value };
  return null;
}

/** Plate-style spacing for display: "AB12CDE" -> "AB12 CDE". */
export function formatVrm(value: string): string {
  if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(value)) return `${value.slice(0, 4)} ${value.slice(4)}`;
  return value;
}

/** Show only enough of a VIN to cross-check the car: "WAUZZZ8K9BA123456" -> "WAU**********3456". */
export function maskVin(vin: string | null | undefined): string | null {
  if (!vin) return null;
  if (vin.length <= 7) return vin;
  return `${vin.slice(0, 3)}${"*".repeat(vin.length - 7)}${vin.slice(-4)}`;
}
