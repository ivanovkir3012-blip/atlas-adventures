/** Google Drive provider for «Путь».
 * This module is staged and not yet wired into the UI or IndexedDB upload queue.
 * Pass a short-lived OAuth access token obtained through Google's browser OAuth flow.
 * It uses the narrow drive.file scope and a user-visible app folder.
 */
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export type DriveFile = { id: string; name: string; mimeType: string; size?: string; parents?: string[] };
function headers(token: string) { return { Authorization: `Bearer ${token}` }; }
async function checked(response: Response) {
  if (!response.ok) throw new Error(`Google Drive API error: ${response.status} ${await response.text()}`);
  return response;
}
export async function createFolder(token: string, name: string, parentId?: string): Promise<DriveFile> {
  const body = { name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) };
  const r = await checked(await fetch(`${DRIVE_API}/files?fields=id,name,mimeType,parents`, {
    method: "POST", headers: { ...headers(token), "Content-Type": "application/json" }, body: JSON.stringify(body)
  }));
  return r.json();
}
export async function listFiles(token: string, query: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({ q: query, fields: "files(id,name,mimeType,size,parents)", pageSize: "100" });
  const r = await checked(await fetch(`${DRIVE_API}/files?${params}`, { headers: headers(token) }));
  const data = await r.json() as { files?: DriveFile[] };
  return data.files || [];
}
export async function uploadFile(token: string, folderId: string, file: Blob, name: string): Promise<DriveFile> {
  const metadata = { name, parents: [folderId] };
  const form = new FormData(); form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file, name);
  const r = await checked(await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,parents`, {
    method: "POST", headers: headers(token), body: form
  }));
  return r.json();
}
export async function downloadFile(token: string, fileId: string): Promise<Blob> {
  const r = await checked(await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: headers(token) }));
  return r.blob();
}
export async function deleteFile(token: string, fileId: string): Promise<void> {
  await checked(await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: headers(token) }));
}
