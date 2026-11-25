import { useEffect, useState } from 'react';
import { queueLocalMedia, getSyncQueueSummary, processFilebaseQueue, type SyncQueueSummary } from './syncQueue';
import type { FilebaseGateway } from './filebase';

const CONFIG_KEY='path-filebase-gateway';
function loadConfig():FilebaseGateway { try{const raw=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');return {uploadUrlEndpoint:String(raw?.uploadUrlEndpoint??''),downloadUrlEndpoint:String(raw?.downloadUrlEndpoint??'')};}catch{return {uploadUrlEndpoint:'',downloadUrlEndpoint:''}} }
export default function CloudSyncPanel(){
 const [config,setConfig]=useState<FilebaseGateway>(loadConfig);
 const [summary,setSummary]=useState<SyncQueueSummary|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const refresh=async()=>setSummary(await getSyncQueueSummary());
 useEffect(()=>{refresh().catch(()=>{});},[]);
 const save=()=>{localStorage.setItem(CONFIG_KEY,JSON.stringify(config));setMessage('Настройки шлюза сохранены на этом устройстве.');};
 const queue=async()=>{setBusy(true);try{const count=await queueLocalMedia();await refresh();setMessage(count?count+' файлов добавлено в очередь.':'Новых локальных файлов нет.');}catch(e){setMessage(e instanceof Error?e.message:'Ошибка очереди.')}finally{setBusy(false)}};
 const sync=async()=>{setBusy(true);setMessage('');try{const result=await processFilebaseQueue({gateway:config,onProgress:(_,state)=>{setMessage(state==='uploading'?'Загрузка…':'Файл обработан');}});await refresh();setMessage('Завершено: '+result.uploaded+' загружено, '+result.failed+' ошибок.');}catch(e){setMessage(e instanceof Error?e.message:'Ошибка синхронизации.')}finally{setBusy(false)}};
 const configured=!!String(config.uploadUrlEndpoint??'').trim()&&!!String(config.downloadUrlEndpoint??'').trim();
 return <div className="setting-card cloud-sync-card"><h3>☁️ Облачное хранилище Filebase</h3><p>Оригиналы остаются на устройстве. Для облачной загрузки нужен защищённый серверный шлюз с короткоживущими подписанными ссылками. Не вводи сюда ключи Filebase.</p><label>Адрес шлюза загрузки<input value={config.uploadUrlEndpoint??''} onChange={e=>setConfig({...config,uploadUrlEndpoint:e.target.value})} placeholder="https://твой-сервер/api/media/upload-url"/></label><label>Адрес шлюза скачивания<input value={config.downloadUrlEndpoint??''} onChange={e=>setConfig({...config,downloadUrlEndpoint:e.target.value})} placeholder="https://твой-сервер/api/media/download-url"/></label><button className="outline-button" onClick={save}>Сохранить адреса</button><div className="storage-breakdown"><div><span>Локально</span><strong>{summary?.local??'—'}</strong></div><div><span>В очереди</span><strong>{summary?.queued??'—'}</strong></div><div><span>Загружено</span><strong>{summary?.synced??'—'}</strong></div><div><span>Ошибки</span><strong>{summary?.failed??'—'}</strong></div><div><span>Размер файлов</span><strong>{summary?(summary.totalBytes/1024/1024).toFixed(1)+' МБ':'—'}</strong></div></div><div className="profile-settings-actions"><button className="outline-button" disabled={busy} onClick={queue}>Добавить локальные в очередь</button><button className="gold-button" disabled={busy||!configured||!(summary?.queued)} onClick={sync}>{busy?'Работа…':'Начать загрузку'}</button><button className="outline-button" disabled={busy} onClick={refresh}>Обновить</button></div>{message&&<small role="status">{message}</small>}<small>Пока шлюз не настроен, загрузка отключена. Это подготовленный интерфейс; серверная часть ещё не создана.</small></div>;
}
