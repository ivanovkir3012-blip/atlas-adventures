/** Filebase media adapter for «Путь».
 * Browser-safe: S3 credentials never live in the client. A trusted backend must
 * issue short-lived presigned URLs (and authorize each object key).
 */
export type PresignedUpload = { url: string; method?: "PUT"; headers?: Record<string,string>; objectKey: string };
export type PresignedDownload = { url: string; headers?: Record<string,string> };

export type FilebaseGateway = {
  /** Backend endpoint that returns a presigned PUT URL and object key. */
  uploadUrlEndpoint: string;
  /** Backend endpoint that returns a presigned download URL for a given object key. */
  downloadUrlEndpoint: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Облачный сервис: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function requestUploadUrl(gateway: FilebaseGateway, fileName: string, mimeType: string, size: number, outingId: string, mediaId: string): Promise<PresignedUpload> {
  const response = await fetch(gateway.uploadUrlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, mimeType, size, outingId, mediaId }),
  });
  return parseJson<PresignedUpload>(response);
}

export async function uploadWithPresignedUrl(presigned: PresignedUpload, blob: Blob): Promise<void> {
  const response = await fetch(presigned.url, {
    method: presigned.method || "PUT",
    headers: { ...(presigned.headers || {}), ...(blob.type ? { "Content-Type": blob.type } : {}) },
    body: blob,
  });
  if (!response.ok) throw new Error(`Не удалось загрузить файл в облако: ${response.status}`);
}

export async function requestDownloadUrl(gateway: FilebaseGateway, objectKey: string): Promise<PresignedDownload> {
  const endpoint = new URL(gateway.downloadUrlEndpoint, window.location.origin);
  endpoint.searchParams.set("objectKey", objectKey);
  return parseJson<PresignedDownload>(await fetch(endpoint.toString()));
}

export async function downloadFromPresignedUrl(presigned: PresignedDownload): Promise<Blob> {
  const response = await fetch(presigned.url, { headers: presigned.headers || {} });
  if (!response.ok) throw new Error(`Не удалось скачать файл из облака: ${response.status}`);
  return response.blob();
}
