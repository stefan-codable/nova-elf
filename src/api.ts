export class ApiError extends Error {}

export async function api<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError("Der lokale Server antwortet nicht. Läuft Nova Elf noch im Terminal?");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Fehler ${res.status}`);
  return data as T;
}

/**
 * Verkleinert ein Foto im Browser auf höchstens 2400 px Kantenlänge. Das spart Zeit und
 * Kosten bei der Auswertung. Kann der Browser das Format nicht lesen (HEIC in Chrome),
 * geht die Datei unverändert an den Server, der sie unter macOS umwandelt.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3_000_000 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Umwandlung fehlgeschlagen"))), "image/jpeg", 0.9),
    );
  } catch {
    return file;
  }
}
