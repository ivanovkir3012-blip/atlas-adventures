/** Local-first media sync queue for Filebase. Safe groundwork: does not auto-upload
 * until the user configures a trusted gateway and explicitly starts sync.
 */
import type { MediaItem } from "../db";
import { all, getMediaForOuting, saveMedia } from "../db";
import { requestUploadUrl, uploadWithPresignedUrl, type FilebaseGateway } from "./filebase";

export type SyncQueueSummary = { local: number; queued: number; uploading: number; synced: number; failed: number; missingBlob: number; totalBytes: number };
export type SyncOptions = { gateway: FilebaseGateway; onProgress?: (item: MediaItem, state: MediaItem["uploadState"]) => void; };

export async function getSyncQueueSummary(): Promise<SyncQueueSummary> {
  const outings = await all(true);
  const items: MediaItem[] = [];
  for (const outing of outings) items.push(...await getMediaForOuting(outing.id));
  return {
    local: items.filter(x=>x.uploadState==="local").length,
    queued: items.filter(x=>x.uploadState==="queued").length,
    uploading: items.filter(x=>x.uploadState==="uploading").length,
    synced: items.filter(x=>x.uploadState==="synced").length,
    failed: items.filter(x=>x.uploadState==="failed").length,
    missingBlob: items.filter(x=>!x.blob && x.uploadState!=="synced").length,
    totalBytes: items.reduce((sum,x)=>sum+(x.blob?.size||0),0),
  };
}

export async function queueLocalMedia(): Promise<number> {
  const outings=await all(true); let count=0;
  for(const outing of outings) for(const item of await getMediaForOuting(outing.id)) {
    if(item.blob && (item.uploadState==="local" || item.uploadState==="failed")) {
      await saveMedia({...item,uploadState:"queued"}); count++;
    }
  }
  return count;
}

/** Processes sequentially to avoid overwhelming mobile connections. */
export async function processFilebaseQueue(options: SyncOptions): Promise<{ uploaded:number; failed:number }> {
  const outings=await all(true); let uploaded=0, failed=0;
  for(const outing of outings) for(const item of await getMediaForOuting(outing.id)) {
    if(item.uploadState!=="queued" || !item.blob) continue;
    try {
      await saveMedia({...item,uploadState:"uploading"});
      options.onProgress?.(item,"uploading");
      const presigned=await requestUploadUrl(options.gateway,item.name,item.mimeType,item.blob.size,item.outingId,item.id);
      await uploadWithPresignedUrl(presigned,item.blob);
      await saveMedia({...item,remoteKey:presigned.objectKey,uploadState:"synced"});
      options.onProgress?.(item,"synced"); uploaded++;
    } catch {
      await saveMedia({...item,uploadState:"failed"});
      options.onProgress?.(item,"failed"); failed++;
    }
  }
  return {uploaded,failed};
}
