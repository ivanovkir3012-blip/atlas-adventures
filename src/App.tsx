import { useEffect, useMemo, useRef, useState } from 'react';
import { all, put, softDelete, deleteMedia, Cat, Outing, saveMedia, getMediaForOuting, MediaItem, JournalEntry, JournalPhoto, allJournal, putJournal, deleteJournal, SavedPlace, allSavedPlaces, putSavedPlace, deleteSavedPlace, createFullBackup, restoreFullBackup, getStorageSummary, StorageSummary, purgeExpiredTrash } from './db';

const cats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг', 'Путешествия'];
const homeCats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг'];
type Page = 'Главная' | 'Выезды' | 'Карта' | 'Журнал' | 'Статистика' | 'Рекорды' | 'Настройки';
const pages: Page[] = ['Главная', 'Выезды', 'Карта', 'Журнал', 'Статистика', 'Рекорды', 'Настройки'];
const imageAsset = (filename: string) => `${import.meta.env.BASE_URL}images/${encodeURIComponent(filename)}`;
const pics: Record<Cat, string> = {
  'Охота': imageAsset('Охотничий закат_ утки над болотом.png'),
  'Рыбалка': imageAsset('Рыбалка на закате_ щука и снасти.png'),
  'Кемпинг': imageAsset('Кемпинг у озера на закате.png'),
  'Путешествия': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
};
const assetBase = import.meta.env.BASE_URL;
const heroImage = `${assetBase}atlas-lake-bg.jpg`;
function createMapMarkerElement(color:string) {
  const el=document.createElement('div');
  el.className='atlas-map-marker';
  el.style.cssText='width:38px;height:48px;display:block;cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,.72));';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','38');svg.setAttribute('height','48');svg.setAttribute('viewBox','0 0 38 48');
  svg.style.cssText='display:block;width:38px;height:48px;overflow:visible;';
  const pin=document.createElementNS('http://www.w3.org/2000/svg','path');
  pin.setAttribute('d','M19 1.5 C9.1 1.5 1.5 9.1 1.5 18.6 C1.5 29.2 19 46.5 19 46.5 C19 46.5 36.5 29.2 36.5 18.6 C36.5 9.1 28.9 1.5 19 1.5 Z');
  pin.setAttribute('fill',color);
  pin.setAttribute('stroke','rgba(20,24,22,.78)');
  pin.setAttribute('stroke-width','1.3');
  pin.setAttribute('stroke-linejoin','round');
  svg.appendChild(pin);
  const center=document.createElementNS('http://www.w3.org/2000/svg','circle');
  center.setAttribute('cx','19');center.setAttribute('cy','18.5');center.setAttribute('r','6.1');
  center.setAttribute('fill','#24302b');center.setAttribute('fill-opacity','.72');
  svg.appendChild(center);
  el.appendChild(svg);
  return el;
}
const emptyDetails = { geese: '', ducks: '', otherGame: '', catchWeight: '', fishSpecies: '', fishQuantities: '', lures: '', pikeWeight: '', pikePhotoId: '', breamWeight: '', breamPhotoId: '', perchWeight: '', perchPhotoId: '', catfishWeight: '', catfishPhotoId: '', nights: '', conditions: '', route: '', visitedPlaces: '', distance: '', spent: '', daysOutdoors: '', duration: '' };

export default function App() {
  const [page, setPage] = useState<Page>('Главная');
  const [rows, setRows] = useState<Outing[]>([]);
  const [journalRows, setJournalRows] = useState<JournalEntry[]>([]);
  const [journalFilter, setJournalFilter] = useState<'Все' | JournalEntry['type']>('Все');
  const [journalQuery, setJournalQuery] = useState('');
  const [journalModal, setJournalModal] = useState(false);
  const [journalEdit, setJournalEdit] = useState<JournalEntry | null>(null);
  const [journalFiles, setJournalFiles] = useState<File[]>([]);
  const [journalCoverChoice, setJournalCoverChoice] = useState('');
  const [profileSettings, setProfileSettings] = useState<{profileName:string;deviceName:string}>(()=>{try{return JSON.parse(localStorage.getItem('atlas-profile-settings')||'{"profileName":"Семейный профиль","deviceName":"Моё устройство"}')}catch{return {profileName:'Семейный профиль',deviceName:'Моё устройство'}}});
  const [profileSaved, setProfileSaved] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalPhotoUrls, setJournalPhotoUrls] = useState<Record<string,string>>({});
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Outing | null>(null);
  const [report, setReport] = useState<Outing | null>(null);
  const [reportMedia, setReportMedia] = useState<MediaItem[]>([]);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [previewGallery, setPreviewGallery] = useState<MediaItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [recordPhotoUrls, setRecordPhotoUrls] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [online, setOnline] = useState(navigator.onLine);
  const [backupBusy, setBackupBusy] = useState(false);
  const [albumYear, setAlbumYear] = useState(new Date().getFullYear());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [lastBackupInfo, setLastBackupInfo] = useState<{createdAt:string;size:number}|null>(()=>{try{return JSON.parse(localStorage.getItem('atlas-last-backup')||'null')}catch{return null}});
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);
  const [storageQuota, setStorageQuota] = useState<{usage?:number;quota?:number}|null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const backupFileRef = useRef<HTMLInputElement>(null);
  
  const [statsPeriod, setStatsPeriod] = useState<'all' | 'year' | 'month'>('all');
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth());
  const [mapQuery, setMapQuery] = useState('');
  const [mapFilter, setMapFilter] = useState('Все');
  const [mapMessage, setMapMessage] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [placeModal, setPlaceModal] = useState(false);
  const [placeEdit, setPlaceEdit] = useState<SavedPlace | null>(null);
  const [activeSavedPlace, setActiveSavedPlace] = useState<SavedPlace | null>(null);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [pickedCoordinates, setPickedCoordinates] = useState<{lat:number;lng:number}|null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const refresh = () => all().then(setRows);
  const refreshJournal = () => allJournal().then(setJournalRows);
  const refreshSavedPlaces = () => allSavedPlaces().then(setSavedPlaces);

  useEffect(() => {
    if (page !== 'Настройки') return;
    let active = true;
    setStorageLoading(true); setStorageError('');
    Promise.all([
      getStorageSummary(),
      navigator.storage?.estimate ? navigator.storage.estimate() : Promise.resolve(null),
    ]).then(([summary, estimate]) => {
      if (!active) return;
      setStorageSummary(summary);
      setStorageQuota(estimate ? { usage: estimate.usage, quota: estimate.quota } : null);
    }).catch(error => { if (active) setStorageError(error instanceof Error ? error.message : 'Не удалось прочитать данные хранилища.'); })
      .finally(() => { if (active) setStorageLoading(false); });
    return () => { active = false; };
  }, [page, rows, journalRows]);

  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      try {
        await purgeExpiredTrash();
      } catch (error) {
        console.warn('Не удалось очистить просроченные записи корзины:', error);
      }
      if (!active) return;
      await Promise.all([refresh(), refreshJournal(), refreshSavedPlaces()]);
    };
    void loadInitialData();
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => {
      active = false;
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);


  useEffect(() => {
    const urls: Record<string, string> = {};
    journalRows.forEach(entry => entry.photos.forEach(photo => { urls[photo.id] = URL.createObjectURL(photo.blob); }));
    setJournalPhotoUrls(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [journalRows]);

  useEffect(() => {
    let active = true;
    const urls: Record<string, string> = {};
    Promise.all(rows.map(async row => {
      const items = await getMediaForOuting(row.id);
      const cover = items.find(item => item.id === row.coverMediaId && item.type === 'image')
        || items.find(item => item.type === 'image');
      if (cover?.blob) urls[row.id] = URL.createObjectURL(cover.blob);
    })).then(() => { if (active) setCoverUrls(urls); else Object.values(urls).forEach(URL.revokeObjectURL); });
    return () => { active = false; Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [rows]);

  useEffect(() => {
    if (page !== 'Карта' || !mapElement.current) return;
    let cancelled = false;
    const init = async () => {
      const w = window as any;
      const loadScript = (src:string, marker:string) => new Promise<void>((resolve,reject)=>{
        const existing=document.querySelector('script['+marker+']') as HTMLScriptElement|null;
        if(existing){if((w as any).maplibregl&&marker==='data-maplibre'){resolve();return;}existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(),{once:true});return;}
        const script=document.createElement('script');script.src=src;script.setAttribute(marker,'1');script.onload=()=>resolve();script.onerror=()=>reject();document.body.appendChild(script);
      });
      if(!w.maplibregl){
        if(!document.querySelector('link[data-maplibre-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css';css.dataset.maplibreCss='1';document.head.appendChild(css);}
        await loadScript('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js','data-maplibre');
      }
      if(cancelled||!mapElement.current||!w.maplibregl)return;
      if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null;}
      const map=new w.maplibregl.Map({container:mapElement.current,center:[27.56,53.9],zoom:6,style:'https://tiles.openfreemap.org/styles/liberty',attributionControl:true,renderWorldCopies:false});
      mapInstance.current=map;
      map.addControl(new w.maplibregl.NavigationControl({showCompass:true,showZoom:true}),'top-right');
      map.addControl(new w.maplibregl.ScaleControl({maxWidth:120,unit:'metric'}),'bottom-left');
      map.on('load',()=>{
        if(cancelled)return;
        map.addSource('atlas-satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
        map.addSource('atlas-street',{type:'raster',tiles:['https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'&copy; OpenStreetMap contributors'});
        map.addSource('atlas-topo',{type:'raster',tiles:['https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:17,attribution:'&copy; OpenStreetMap contributors, SRTM | OpenTopoMap'});
        const firstVector=(map.getStyle().layers||[]).find((layer:any)=>layer.type!=='background')?.id;
        map.addLayer({id:'atlas-satellite-layer',type:'raster',source:'atlas-satellite',layout:{visibility:'visible'},paint:{'raster-opacity':1}},firstVector);
        map.addLayer({id:'atlas-street-layer',type:'raster',source:'atlas-street',layout:{visibility:'none'}},firstVector);
        map.addLayer({id:'atlas-topo-layer',type:'raster',source:'atlas-topo',layout:{visibility:'none'}},firstVector);
        const layerControl=document.createElement('div');layerControl.className='maplibregl-ctrl maplibregl-ctrl-group atlas-map-layer-switcher';
        const choices=[['hybrid','Спутник + подписи'],['street','Схема'],['topo','Топографическая']];
        choices.forEach(([key,label])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.title=label;button.className=key==='hybrid'?'active':'';button.addEventListener('click',()=>{['hybrid','street','topo'].forEach(mode=>{const id=mode==='hybrid'?'atlas-satellite-layer':mode==='street'?'atlas-street-layer':'atlas-topo-layer';map.setLayoutProperty(id,'visibility',mode===key?'visible':'none');});Array.from(layerControl.querySelectorAll('button')).forEach((node:any)=>node.classList.toggle('active',node===button));});layerControl.appendChild(button);});
        const layerControlPlugin={onAdd:()=>layerControl,onRemove:()=>layerControl.remove()};
        map.addControl(layerControlPlugin,'top-left');
        const layers=(map.getStyle().layers||[]);
        layers.forEach((layer:any)=>{
          if(layer.id==='atlas-satellite-layer')return;
          if(layer.type==='background'){map.setLayoutProperty(layer.id,'visibility','none');return;}
          if(layer.type!=='symbol'){map.setLayoutProperty(layer.id,'visibility','none');return;}
          const id=String(layer.id).toLowerCase();
          if(id.includes('poi')||id.includes('housenumber')||id.includes('transit')||id.includes('airport'))map.setLayoutProperty(layer.id,'visibility','none');
        });
        const markerIcon=(color:string)=>createMapMarkerElement(color);
        const visible=rows.filter(row=>row.coordinates&&(mapFilter==='Все'||row.category===mapFilter));
        const visiblePlaces=savedPlaces.filter(place=>mapFilter==='Все'||place.category===mapFilter);
        visible.forEach(row=>{
          const color=row.category==='Охота'?'#d7b65d':row.category==='Рыбалка'?'#65a9d2':row.category==='Кемпинг'?'#75ad79':'#b18bd0';
          const marker=new w.maplibregl.Marker({element:markerIcon(color),anchor:'bottom'}).setLngLat([row.coordinates!.lng,row.coordinates!.lat]);
          const photo=coverUrls[row.id];const safeTitle=String(row.title||'Выезд').replace(/[&<>"]/g,'');const safePlace=String(row.place||'Место не указано').replace(/[&<>"]/g,'');
          const popup=document.createElement('div');popup.className='atlas-map-popup';popup.innerHTML=(photo?'<img src="'+photo+'" alt="" style="width:190px;height:105px;object-fit:cover;border-radius:6px;margin-bottom:6px"/><br>':'')+'<strong>'+safeTitle+'</strong><br>'+String(row.category).replace(/[&<>"]/g,'')+' · '+String(row.date)+'<br>'+safePlace;
          marker.setPopup(new w.maplibregl.Popup({offset:22}).setDOMContent(popup)).addTo(map);
          marker.getElement().addEventListener('click',()=>setReport(row));
        });
        visiblePlaces.forEach(place=>{
          const marker=new w.maplibregl.Marker({element:markerIcon('#d6ad55'),anchor:'bottom'}).setLngLat([place.lng,place.lat]);
          const popup=document.createElement('div');popup.className='atlas-map-popup';
          const title=document.createElement('strong');title.textContent=place.title;popup.appendChild(title);
          const meta=document.createElement('div');meta.textContent=place.type+' · '+place.category;popup.appendChild(meta);
          if(place.description){const desc=document.createElement('p');desc.textContent=place.description;popup.appendChild(desc);}
          marker.setPopup(new w.maplibregl.Popup({offset:22}).setDOMContent(popup)).addTo(map);
          marker.getElement().addEventListener('click',()=>setActiveSavedPlace(place));
        });
        map.on('click',(event:any)=>{
          const target=event.originalEvent?.target as HTMLElement;
          if(target?.closest('.maplibregl-marker,.maplibregl-popup,.maplibregl-ctrl'))return;
          const lat=Number(event.lngLat.lat.toFixed(6));const lng=Number(event.lngLat.lng.toFixed(6));
          setPickedCoordinates({lat,lng});setMapMessage('Точка выбрана. Можно сохранить её отдельно или создать выезд.');
          const el=markerIcon('#d7b65d');
          const marker=new w.maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(map);
          const popup=document.createElement('div');popup.className='atlas-map-popup atlas-map-picked-popup';popup.innerHTML='<span>Выбранная точка</span><strong>'+lat.toFixed(6)+', '+lng.toFixed(6)+'</strong>';
          marker.setPopup(new w.maplibregl.Popup({offset:22,closeButton:false,closeOnClick:false}).setDOMContent(popup)).togglePopup();
          if((map as any).atlasPickedMarker)(map as any).atlasPickedMarker.remove();
          (map as any).atlasPickedMarker=marker;
        });
        if(visible.length){const bounds=new w.maplibregl.LngLatBounds();visible.forEach(row=>bounds.extend([row.coordinates!.lng,row.coordinates!.lat]));map.fitBounds(bounds,{padding:60,maxZoom:11,duration:0});}
      });
      map.on('error',(event:any)=>{if(event?.error)setMapMessage('Ошибка загрузки карты или картографических данных. Проверь подключение к интернету.');});
    };
    init().catch(()=>setMapMessage('Не удалось загрузить карту. Проверь подключение к интернету.'));
    return ()=>{cancelled=true;if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null;}};
  },[page,rows,savedPlaces,mapFilter,coverUrls]);

  useEffect(() => {
    let active = true;
    const urls: Record<string, string> = {};
    Promise.all(rows.map(async row => {
      for (const key of ['pikePhotoId','breamPhotoId','perchPhotoId','catfishPhotoId']) {
        const id = String(row.details?.[key] || ''); if (!id) continue;
        const item = (await getMediaForOuting(row.id)).find(mediaItem => mediaItem.id === id && mediaItem.type === 'image');
        if (item?.blob) urls[id] = URL.createObjectURL(item.blob);
      }
    })).then(() => { if (active) setRecordPhotoUrls(urls); else Object.values(urls).forEach(URL.revokeObjectURL); });
    return () => { active = false; Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [rows]);
  useEffect(() => {
    if (!report) { setReportMedia([]); return; }
    getMediaForOuting(report.id).then(setReportMedia);
  }, [report]);

  const previewIndex = previewGallery.findIndex(item => item.id === previewMedia?.id);
  const openReportPhoto = (item: MediaItem) => {
    const photos = reportMedia.filter(mediaItem => mediaItem.type === 'image' && mediaItem.blob);
    setPreviewGallery(photos);
    setPreviewMedia(item);
  };
  const openJournalPhoto = (entry: JournalEntry, selected: JournalPhoto) => {
    const photos: MediaItem[] = entry.photos.map(photo => ({
      id: photo.id,
      outingId: entry.id,
      name: photo.name,
      type: 'image',
      mimeType: photo.mimeType,
      size: photo.size,
      createdAt: entry.updatedAt,
      blob: photo.blob,
      uploadState: 'local',
    }));
    setPreviewGallery(photos);
    setPreviewMedia(photos.find(photo => photo.id === selected.id) ?? photos[0] ?? null);
  };
  const movePreview = (direction: number) => {
    if (previewGallery.length < 2 || previewIndex < 0) return;
    const next = (previewIndex + direction + previewGallery.length) % previewGallery.length;
    setPreviewMedia(previewGallery[next]);
  };

  useEffect(() => {
    if (!previewMedia) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); movePreview(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); movePreview(1); }
      if (event.key === 'Escape') setPreviewMedia(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewMedia, previewGallery, previewIndex]);

  useEffect(() => {
    if (!previewMedia?.blob) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(previewMedia.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewMedia]);

  useEffect(() => {
    if (!edit) { setMedia([]); return; }
    getMediaForOuting(edit.id).then(setMedia);
  }, [edit]);

  const availableYears = useMemo(() => {
    const years = rows.map(row => Number(row.date.slice(0, 4))).filter(year => Number.isFinite(year) && year > 1900);
    return Array.from(new Set([...years, new Date().getFullYear()])).sort((a, b) => b - a);
  }, [rows]);
  const periodRows = useMemo(() => rows.filter(row => {
    if (statsPeriod === 'all') return true;
    const date = new Date(`${row.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    return statsPeriod === 'year'
      ? date.getFullYear() === statsYear
      : date.getFullYear() === statsYear && date.getMonth() === statsMonth;
  }), [rows, statsPeriod, statsYear, statsMonth]);
  const stats = useMemo(() => {
    const days = periodRows.reduce((sum, row) => sum + Number(row.details?.daysOutdoors ?? 1), 0);
    const geese = periodRows.reduce((sum, row) => sum + Number(row.details?.geese ?? 0), 0);
    const ducks = periodRows.reduce((sum, row) => sum + Number(row.details?.ducks ?? 0), 0);
    return [
      { label: 'Гусей', value: geese, symbol: '➤' },
      { label: 'Уток', value: ducks, symbol: '➤' },
      { label: 'Всего выездов', value: periodRows.length, symbol: '▦' },
      { label: 'Дней на природе', value: days, symbol: '☼' },
      { label: 'Всего проехал', value: periodRows.reduce((sum, row) => sum + Number(row.details?.distance ?? 0), 0).toLocaleString('ru-RU') + ' км', symbol: '⌁' },
      { label: 'Потрачено', value: periodRows.reduce((sum, row) => sum + Number(row.details?.spent ?? 0), 0).toLocaleString('ru-RU') + ' BYN', symbol: '₽' },
    ];
  }, [periodRows]);
  const categoryStats = useMemo(() => cats.map(cat => {
    const items = periodRows.filter(row => row.category === cat);
    return { category: cat, outings: items.length, days: items.reduce((sum, row) => sum + Number(row.details?.daysOutdoors ?? 1), 0) };
  }), [periodRows]);
  const monthlyStats = useMemo(() => Array.from({length:12}, (_, month) => ({
    month,
    label: new Date(statsYear, month, 1).toLocaleDateString('ru-RU', {month:'short'}),
    outings: rows.filter(row => { const d = new Date(`${row.date}T12:00:00`); return !Number.isNaN(d.getTime()) && d.getFullYear() === statsYear && d.getMonth() === month; }).length
  })), [rows, statsYear]);
  const yearlyStats = useMemo(() => availableYears.slice(0,5).sort((a,b)=>a-b).map(year => {
    const items = rows.filter(row => new Date(`${row.date}T12:00:00`).getFullYear() === year);
    return { year, outings: items.length, days: items.reduce((sum,row)=>sum+Number(row.details?.daysOutdoors ?? 1),0) };
  }), [rows, availableYears]);
  const huntingMonthlyStats = useMemo(() => Array.from({length:12}, (_, month) => {
    const items = rows.filter(row => row.category === 'Охота' && (() => { const d = new Date(`${row.date}T12:00:00`); return !Number.isNaN(d.getTime()) && d.getFullYear() === statsYear && d.getMonth() === month; })());
    return { month, label: new Date(statsYear, month, 1).toLocaleDateString('ru-RU', {month:'short'}), geese: items.reduce((sum,row)=>sum+Number(row.details?.geese ?? 0),0), ducks: items.reduce((sum,row)=>sum+Number(row.details?.ducks ?? 0),0) };
  }), [rows, statsYear]);
  const yearlyHuntingStats = useMemo(() => yearlyStats.map(item => {
    const hunting = rows.filter(row => row.category === 'Охота' && new Date(`${row.date}T12:00:00`).getFullYear() === item.year);
    return { year:item.year, geese:hunting.reduce((sum,row)=>sum+Number(row.details?.geese ?? 0),0), ducks:hunting.reduce((sum,row)=>sum+Number(row.details?.ducks ?? 0),0) };
  }), [rows, yearlyStats]);
  const categoryTotal = categoryStats.reduce((sum,item)=>sum+item.outings,0);
  const categoryGradient = (() => { let cursor=0; const colors=['#c7a45a','#6f9d91','#6d86a8','#9b806d']; return categoryStats.map((item,index)=>{ const start=cursor; cursor += categoryTotal ? item.outings/categoryTotal*100 : 0; return `${colors[index]} ${start}% ${cursor}%`; }).join(', '); })();
  const trophyRecords = useMemo<Array<{key:string;title:string;row?:Outing;weight?:number;photoId?:string;count?:number}>>(() => {
    const species = [
      { key:'pike', title:'Самая большая щука', weightKey:'pikeWeight', photoKey:'pikePhotoId' },
      { key:'bream', title:'Самый большой лещ', weightKey:'breamWeight', photoKey:'breamPhotoId' },
      { key:'perch', title:'Самый большой окунь', weightKey:'perchWeight', photoKey:'perchPhotoId' },
      { key:'catfish', title:'Самый большой сом', weightKey:'catfishWeight', photoKey:'catfishPhotoId' },
    ];
    const best = species.map(item => {
      const winner = rows.filter(row => row.category === 'Рыбалка').map(row => ({ row, weight:Number(row.details?.[item.weightKey] || 0), photoId:String(row.details?.[item.photoKey] || '') })).filter(entry => entry.weight > 0).sort((a,b) => b.weight-a.weight)[0];
      return { ...item, ...winner };
    });
    const hunt = (key:'geese'|'ducks',title:string) => {
      const winner = rows.filter(row => row.category === 'Охота').map(row => ({row,count:Number(row.details?.[key] || 0)})).filter(entry => entry.count > 0).sort((a,b)=>b.count-a.count)[0];
      return {key,title,...winner};
    };
    const camping = rows.filter(row => row.category === 'Кемпинг').map(row => ({row,count:Number(row.details?.nights || 0)})).filter(entry => entry.count > 0).sort((a,b)=>b.count-a.count)[0];
    return [...best, hunt('geese','Добыто гусей за выезд'), hunt('ducks','Добыто уток за выезд'), {key:'nights',title:'Больше всего ночёвок',...camping}];
  }, [rows]);
  const recordStats = useMemo(() => {
    const bestDays = [...rows].map(row=>({...row, metric:Number(row.details?.daysOutdoors ?? 1)})).filter(row=>row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestDistance = [...rows].map(row=>({...row, metric:Number(row.details?.distance ?? 0)})).filter(row=>row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestGeese = [...rows].map(row=>({...row, metric:Number(row.details?.geese ?? 0)})).filter(row=>row.category==='Охота'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestDucks = [...rows].map(row=>({...row, metric:Number(row.details?.ducks ?? 0)})).filter(row=>row.category==='Охота'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestCatch = [...rows].map(row=>({...row, metric:Number(row.details?.catchWeight ?? 0)})).filter(row=>row.category==='Рыбалка'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    return [
      {title:'Самый долгий выезд',value:bestDays?`${bestDays.metric} дней`:'—',detail:bestDays?.title||'Пока нет данных'},
      {title:'Самый длинный маршрут',value:bestDistance?`${bestDistance.metric} км`:'—',detail:bestDistance?.title||'Пока нет данных'},
      {title:'Больше всего гусей',value:bestGeese?String(bestGeese.metric):'—',detail:bestGeese?.title||'Пока нет данных'},
      {title:'Больше всего уток',value:bestDucks?String(bestDucks.metric):'—',detail:bestDucks?.title||'Пока нет данных'},
      {title:'Лучший улов',value:bestCatch?`${bestCatch.metric} кг`:'—',detail:bestCatch?.title||'Пока нет данных'},
      {title:'Точки на карте',value:String(rows.filter(row=>row.coordinates).length),detail:'Выезды с сохранёнными координатами'},
    ];
  }, [rows]);
  const placeGroups = useMemo(() => {
    const groups = new Map<string,{name:string;count:number;row:Outing}>();
    periodRows.forEach(row => {
      const name = String(row.place || '').trim();
      const key = name ? name.toLocaleLowerCase('ru') : row.coordinates ? `${row.coordinates.lat.toFixed(4)},${row.coordinates.lng.toFixed(4)}` : '';
      if (!key) return;
      const current = groups.get(key);
      if (current) current.count += 1;
      else groups.set(key,{name:name || 'Точка на карте',count:1,row});
    });
    return Array.from(groups.values()).sort((a,b)=>b.count-a.count);
  }, [periodRows]);
  const uniquePlacesCount = placeGroups.length;
  const nightsTotal = periodRows.reduce((sum,row)=>sum+Number(row.details?.nights ?? 0),0);
  const totalDistance = periodRows.reduce((sum,row)=>sum+Number(row.details?.distance ?? 0),0);
  const seasonalStats = useMemo(() => {
    const seasons = [{name:'Зима',months:[11,0,1],icon:'❄',tone:'winter'},{name:'Весна',months:[2,3,4],icon:'✿',tone:'spring'},{name:'Лето',months:[5,6,7],icon:'☀',tone:'summer'},{name:'Осень',months:[8,9,10],icon:'🍂',tone:'autumn'}];
    return seasons.map(season=>({ ...season, outings:periodRows.filter(row=>season.months.includes(new Date(row.date+'T12:00:00').getMonth())).length }));
  }, [periodRows]);
  const busiestMonth = useMemo(() => {
    const counts = new Map<string,{label:string;count:number}>();
    periodRows.forEach(row=>{const d=new Date(row.date+'T12:00:00');if(Number.isNaN(d.getTime()))return;const key=`${d.getFullYear()}-${d.getMonth()}`;const item=counts.get(key)||{label:d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}),count:0};item.count++;counts.set(key,item);});
    return Array.from(counts.values()).sort((a,b)=>b.count-a.count)[0];
  }, [periodRows]);
  const mostActiveYear = yearlyStats.reduce((best,item)=>!best||item.outings>best.outings?item:best,undefined as typeof yearlyStats[number]|undefined);
  const topCategory = [...categoryStats].sort((a,b)=>b.outings-a.outings)[0];
  const previousYear = yearlyStats.length>1 ? yearlyStats[yearlyStats.length-2] : undefined;
  const latestYear = yearlyStats[yearlyStats.length-1];
  const activityGrowth = previousYear && previousYear.outings>0 && latestYear ? Math.round((latestYear.outings-previousYear.outings)/previousYear.outings*100) : null;
  const statsPeriodControls = <div className="stats-controls">
    <div className="stats-period" role="group" aria-label="Период статистики">
      <button className={statsPeriod==='all'?'active':''} onClick={()=>setStatsPeriod('all')}>Всё время</button>
      <button className={statsPeriod==='year'?'active':''} onClick={()=>setStatsPeriod('year')}>Год</button>
      <button className={statsPeriod==='month'?'active':''} onClick={()=>setStatsPeriod('month')}>Месяц</button>
    </div>
    {statsPeriod !== 'all' && <div className="stats-selectors">
      <label>Год графиков<select value={statsYear} onChange={e=>setStatsYear(Number(e.target.value))}>{availableYears.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
      {statsPeriod === 'month' && <label>Месяц<select value={statsMonth} onChange={e=>setStatsMonth(Number(e.target.value))}>{Array.from({length:12},(_,month)=><option key={month} value={month}>{new Date(2000,month,1).toLocaleDateString('ru-RU',{month:'long'})}</option>)}</select></label>}
    </div>}
  </div>;

  const filtered = rows.filter(row =>
    (category === 'Все' || row.category === category) &&
    [row.title, row.place, row.note].join(' ').toLowerCase().includes(query.toLowerCase())
  );


  function openJournalNew() { setJournalEdit(null); setJournalFiles([]); setJournalCoverChoice(''); setJournalError(''); setJournalModal(true); }
  function openJournalEdit(entry: JournalEntry) { setJournalEdit(entry); setJournalFiles([]); setJournalCoverChoice(entry.coverPhotoId || entry.photos[0]?.id || ''); setJournalError(''); setJournalModal(true); }
  function saveProfileSettings(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const next = { profileName: String(form.get('profileName') || '').trim() || 'Семейный профиль', deviceName: String(form.get('deviceName') || '').trim() || 'Моё устройство' }; localStorage.setItem('atlas-profile-settings', JSON.stringify(next)); setProfileSettings(next); setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 2500); }
  async function saveJournal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (journalSaving) return;
    const formElement = event.currentTarget; if (!formElement.reportValidity()) return;
    setJournalSaving(true); setJournalError('');
    try {
      const form = new FormData(formElement);
      const photos: JournalPhoto[] = [...(journalEdit?.photos ?? [])];
      for (const file of journalFiles) {
        if (!file.type.startsWith('image/')) continue;
        const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/jpeg' });
        photos.push({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, size: blob.size, blob });
      }
      const now = new Date().toISOString();
      const selectedCoverId = journalCoverChoice.startsWith('new:') ? photos[(journalEdit?.photos.length ?? 0) + Number(journalCoverChoice.slice(4))]?.id : journalCoverChoice;
      const entry: JournalEntry = { id: journalEdit?.id ?? crypto.randomUUID(), title: String(form.get('title') || '').trim(), type: String(form.get('type')) as JournalEntry['type'], date: String(form.get('date')), place: String(form.get('place') || '').trim(), description: String(form.get('description') || '').trim(), photos, coverPhotoId: selectedCoverId || photos[0]?.id, createdAt: journalEdit?.createdAt ?? now, updatedAt: now };
      await putJournal(entry); await refreshJournal(); setJournalModal(false); setJournalEdit(null); setJournalFiles([]);
    } catch (error) { setJournalError('Не удалось сохранить запись. ' + (error instanceof Error ? error.message : String(error))); }
    finally { setJournalSaving(false); }
  }
  async function removeJournal(entry: JournalEntry) {
    if (!confirm('Удалить эту запись из полевого журнала?')) return;
    await deleteJournal(entry.id); await refreshJournal(); setJournalModal(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const formElement = event.currentTarget;
    if (!formElement.reportValidity()) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const form = new FormData(formElement);
      const id = edit?.id || crypto.randomUUID();
      const selectedCategory = form.get('category') as Cat;
      const details: Record<string, string | number | boolean | string[]> = {};
      for (const key of Object.keys(emptyDetails)) {
        const value = form.get(key);
        if (value !== null && String(value).trim() !== '') details[key] = ['geese','ducks','catchWeight','nights','distance','spent','daysOutdoors','pikeWeight','breamWeight','perchWeight','catfishWeight'].includes(key) ? Number(value) : String(value);
      }
      const timeline: Outing['timeline'] = [];
      const participants = String(form.get('participants') || '').split(',').map(v => v.trim()).filter(Boolean);
      const row: Outing = {
        id, title: String(form.get('title')).trim(), category: selectedCategory,
        createdAt: edit?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
        date: String(form.get('date')), time: '',
        place: String(form.get('place') || '').trim(),
        coordinates: form.get('lat') && form.get('lng') ? { lat: Number(form.get('lat')), lng: Number(form.get('lng')) } : edit?.coordinates,
        participants, weather: String(form.get('weather') || ''), timeline,
        note: String(form.get('note') || ''), impressions: edit?.impressions ?? '', conclusion: edit?.conclusion ?? '',
        mediaIds: [...(edit?.mediaIds ?? [])], favorite: edit?.favorite ?? false,
        details,
      };
      const newlySaved: string[] = [];
      for (const file of files) {
        // Rebuild the picker File as a plain Blob. Some Android/WebContainer
        // file-provider objects fail IndexedDB structured cloning as InvalidBlob.
        const bytes = await file.arrayBuffer();
        const storedBlob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
        const item: MediaItem = {
          id: crypto.randomUUID(), outingId: id, name: file.name,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          mimeType: file.type, size: storedBlob.size, createdAt: new Date().toISOString(),
          blob: storedBlob, uploadState: 'local',
        };
        await saveMedia(item);
        row.mediaIds.push(item.id);
        newlySaved.push(item.id);
      }
      for (const key of ['pikePhotoId','breamPhotoId','perchPhotoId','catfishPhotoId']) {
        const choice = String(form.get(key) || '');
        if (choice.startsWith('new:')) {
          const selectedId = newlySaved[Number(choice.slice(4))];
          if (selectedId) details[key] = selectedId; else delete details[key];
        } else if (choice) details[key] = choice;
        else delete details[key];
      }
      row.details = details;
      const coverChoice = String(form.get('coverChoice') || '');
      if (coverChoice.startsWith('new:')) {
        const selectedIndex = Number(coverChoice.slice(4));
        const selectedId = newlySaved[selectedIndex];
        if (selectedId) row.coverMediaId = selectedId;
      } else if (coverChoice) row.coverMediaId = coverChoice;
      else if (edit?.coverMediaId) row.coverMediaId = edit.coverMediaId;
      else if (newlySaved.length) row.coverMediaId = newlySaved[0];
      await put(row);
      await refresh();
      setFiles([]);
      setModal(false);
      setEdit(null);
      setSaveError('');
      setPage('Выезды');
    } catch (error) {
      console.error('Не удалось сохранить выезд:', error);
      const message = error instanceof Error ? error.message : String(error);
      setSaveError('Не удалось сохранить выезд. Данные формы оставлены — попробуй ещё раз. ' + (message || 'Проверь свободное место в хранилище браузера.'));
    } finally {
      setIsSaving(false);
    }
  }

  function pdfEscape(value: unknown): string {
    return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]!));
  }
  async function blobAsDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать фотографию.')); reader.readAsDataURL(blob); });
  }
  function openPdfDocument(title: string, body: string, target?: Window) {
    const popup = target || window.open('', '_blank'); if (!popup) throw new Error('Разреши всплывающие окна для Следа и повтори экспорт.');
    popup.document.open();
    popup.document.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + pdfEscape(title) + '</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,sans-serif;color:#252820}h1{font-size:25pt;color:#243329}h2{font-size:16pt;color:#344b3c;margin:22px 0 8px;break-after:avoid}p{white-space:pre-wrap}.meta{color:#687267;font-size:9pt;margin-bottom:16px}.hero{width:100%;max-height:100mm;object-fit:cover}.facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fact{border:1px solid #d9ded6;padding:8px;break-inside:avoid}.fact small{display:block;color:#758074}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.photo{break-inside:avoid}.photo img{width:100%;height:68mm;object-fit:cover}.outing{border-top:1px solid #ccd2c8;padding-top:14px;margin-top:18px;break-inside:avoid-page}.hint{background:#f1f3ee;padding:9px;font-size:9pt}@media print{.hint{display:none}}</style></head><body><div class="hint">В окне печати выбери «Сохранить как PDF».</div>' + body + '<script>window.addEventListener("load",async()=>{const images=Array.from(document.images);await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));setTimeout(()=>window.print(),250);});</script></body></html>');
    popup.document.close();
  }
  async function exportOutingPdf(row: Outing) {
    const popup = window.open('', '_blank'); if (!popup) { alert('Разреши всплывающие окна для Следа и повтори экспорт.'); return; }
    popup.document.write('<p style="font:16px Arial;padding:24px">Подготавливаем отчёт и фотографии…</p>');
    try {
      const items = (await getMediaForOuting(row.id)).filter(item => item.type === 'image' && item.blob);
      const images = await Promise.all(items.map(async item => ({ name: item.name, src: await blobAsDataUrl(item.blob!) })));
      const facts = [['Категория',row.category],['Дата',row.date],['Время',row.time],['Место',row.place],['Участники',row.participants?.join(', ')],['Погода и условия',row.weather],...Object.entries(row.details ?? {})].filter(pair => pair[1] !== undefined && pair[1] !== '' && pair[1] !== false && pair[1] !== null);
      const coverItem = items.find(item => item.id === row.coverMediaId) || items[0]; const cover = images.find(item => item.name === coverItem?.name);
      const factHtml = facts.map(pair => '<div class="fact"><small>' + pdfEscape(pair[0]) + '</small><strong>' + pdfEscape(Array.isArray(pair[1]) ? pair[1].join(', ') : pair[1]) + '</strong></div>').join('');
      const timeline = row.timeline?.length ? '<h2>Ход приключения</h2>' + row.timeline.map(item => '<p><strong>' + pdfEscape(item.time || '') + ' ' + pdfEscape(item.title) + '</strong><br>' + pdfEscape(item.description || '') + '</p>').join('') : '';
      const photos = images.length ? '<h2>Фотографии</h2><div class="photo-grid">' + images.map(item => '<figure class="photo"><img src="' + item.src + '"><figcaption>' + pdfEscape(item.name) + '</figcaption></figure>').join('') + '</div>' : '';
      const body = '<h1>' + pdfEscape(row.title || 'Выезд без названия') + '</h1><div class="meta">' + pdfEscape(row.category) + ' · ' + pdfEscape(row.date) + ' · ' + pdfEscape(row.place || 'Место не указано') + '</div>' + (cover ? '<img class="hero" src="' + cover.src + '">' : '') + '<div class="facts">' + factHtml + '</div>' + timeline + (row.note ? '<h2>Заметки</h2><p>' + pdfEscape(row.note) + '</p>' : '') + (row.impressions ? '<h2>Впечатления</h2><p>' + pdfEscape(row.impressions) + '</p>' : '') + (row.conclusion ? '<h2>Итоги выезда</h2><p>' + pdfEscape(row.conclusion) + '</p>' : '') + photos;
      openPdfDocument('След — ' + row.title, body, popup);
    } catch (error) { popup.close(); alert(error instanceof Error ? error.message : 'Не удалось подготовить PDF-отчёт.'); }
  }
  async function exportAnnualAlbumPdf(year: number) {
    const popup = window.open('', '_blank'); if (!popup) { alert('Разреши всплывающие окна для Следа и повтори экспорт.'); return; }
    popup.document.write('<p style="font:16px Arial;padding:24px">Собираем фотоальбом…</p>'); setPdfBusy(true);
    try {
      const yearRows = rows.filter(row => !row.deletedAt && Number(row.date.slice(0,4)) === year).sort((a,b) => a.date.localeCompare(b.date));
      const sections = await Promise.all(yearRows.map(async row => {
        const items = (await getMediaForOuting(row.id)).filter(item => item.type === 'image' && item.blob);
        const photos = await Promise.all(items.map(async item => '<figure class="photo"><img src="' + await blobAsDataUrl(item.blob!) + '"><figcaption>' + pdfEscape(item.name) + '</figcaption></figure>'));
        return '<section class="outing"><h2>' + pdfEscape(row.title || 'Выезд без названия') + '</h2><div class="meta">' + pdfEscape(row.date) + ' · ' + pdfEscape(row.category) + ' · ' + pdfEscape(row.place || 'Место не указано') + '</div>' + (row.note ? '<p>' + pdfEscape(row.note) + '</p>' : '') + (photos.length ? '<div class="photo-grid">' + photos.join('') + '</div>' : '<p>Без фотографий</p>') + '</section>';
      }));
      openPdfDocument('След — ' + year, '<h1>След</h1><div class="meta">Семейный фотоальбом · ' + year + ' год · ' + yearRows.length + ' выездов</div>' + (sections.join('') || '<p>За выбранный год выездов не найдено.</p>'), popup);
    } catch (error) { popup.close(); alert(error instanceof Error ? error.message : 'Не удалось подготовить фотоальбом.'); } finally { setPdfBusy(false); }
  }
  async function downloadFullBackup() {
    setBackupBusy(true); setBackupMessage('');
    try {
      const blob = await createFullBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atlas-adventures-backup-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      const info={createdAt:new Date().toISOString(),size:blob.size};
      localStorage.setItem('atlas-last-backup',JSON.stringify(info));
      setLastBackupInfo(info);
      setBackupMessage('Резервная копия создана и проверена контрольной суммой. Сохрани файл отдельно от устройства.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? 'Не удалось создать копию: ' + error.message : 'Не удалось создать резервную копию.');
    } finally { setBackupBusy(false); }
  }

  async function importFullBackup(file?: File) {
    if (!file) return;
    if (!confirm('Восстановление заменит текущие данные Следа данными из выбранной копии. Перед продолжением рекомендуется скачать текущую резервную копию. Продолжить?')) {
      if (backupFileRef.current) backupFileRef.current.value = '';
      return;
    }
    setBackupBusy(true); setBackupMessage('');
    try {
      const result = await restoreFullBackup(file);
      await Promise.all([refresh(), refreshJournal(), refreshSavedPlaces()]);
      const restoredInfo={createdAt:result.createdAt || new Date().toISOString(),size:file.size};
      localStorage.setItem('atlas-last-backup',JSON.stringify(restoredInfo));
      setLastBackupInfo(restoredInfo);
      setBackupMessage('Копия проверена по SHA-256 и восстановлена. Записей: ' + Object.values(result.counts).reduce((sum,count)=>sum+count,0) + '.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? 'Не удалось восстановить копию: ' + error.message : 'Не удалось восстановить резервную копию.');
    } finally {
      setBackupBusy(false);
      if (backupFileRef.current) backupFileRef.current.value = '';
    }
  }


  function downloadPhoto(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'atlas-photo.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function removeReportMedia(item: MediaItem) {
    if (!report || !confirm('Удалить это фото или видео из отчёта?')) return;
    await deleteMedia(item.id);
    const updated: Outing = { ...report, mediaIds: report.mediaIds.filter(id => id !== item.id), details: { ...report.details } };
    if (updated.coverMediaId === item.id) {
      const remaining = (await getMediaForOuting(report.id)).filter(mediaItem => mediaItem.id !== item.id);
      updated.coverMediaId = remaining.find(mediaItem => mediaItem.type === 'image')?.id;
    }
    for (const key of ['pikePhotoId','breamPhotoId','perchPhotoId','catfishPhotoId']) {
      if (updated.details[key] === item.id) delete updated.details[key];
    }
    await put(updated);
    setReport(updated);
    setReportMedia(current => current.filter(mediaItem => mediaItem.id !== item.id));
    await refresh();
  }

  async function toggleFavorite(row: Outing) { await put({ ...row, favorite: !row.favorite }); await refresh(); setReport({ ...row, favorite: !row.favorite }); }
  async function removeOuting(row: Outing) { if (!confirm('Переместить выезд в корзину? Его можно восстановить в течение 30 дней.')) return; await softDelete(row.id); setReport(null); await refresh(); }

  function openNew() { setEdit(null); setFiles([]); setSaveError(''); setModal(true); }
  function openEdit(row: Outing) { setEdit(row); setFiles([]); setModal(true); }

  // Android content-provider File handles may expire after the picker closes.
  // Copy the bytes immediately while the temporary permission is still valid.
  async function captureSelectedFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setSaveError('');
    try {
      const selected = Array.from(fileList);
      if (selected.some(file => !file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
        setSaveError('Можно загружать только фотографии и видео. Этот формат не поддерживается.');
        return;
      }
      const captured: File[] = [];
      for (const source of selected) {
        const bytes = await source.arrayBuffer();
        captured.push(new File([bytes], source.name, {
          type: source.type || 'image/jpeg',
          lastModified: source.lastModified || Date.now(),
        }));
      }
      setFiles(current => [...current, ...captured]);
    } catch (error) {
      console.error('Не удалось прочитать выбранные файлы:', error);
      setSaveError('Не удалось прочитать один из выбранных файлов. Открой выбор файлов ещё раз и выбери их повторно. Не закрывай форму до завершения загрузки.');
    }
  }

  function renderRecent(items: Outing[]) {
    if (!items.length) return <div className="recent-empty"><span>✧</span><div><b>Первое приключение ещё впереди</b><small>Добавь выезд — здесь появится его фотография и история.</small></div><button className="outline-button" onClick={openNew}>Добавить</button></div>;
    return <div className="recent-list">{items.map(row => <button className="recent-line" key={row.id} onClick={() => setReport(row)}>
      <div className="recent-photo" style={{backgroundImage:`linear-gradient(0deg,#071a13aa,transparent 75%),url(${coverUrls[row.id] || pics[row.category]})`}} />
      <div className="recent-copy"><small>{row.category} · {row.date}</small><b>{row.title || 'Выезд без названия'}</b><span className="recent-place">⌖ {row.place || 'Место не указано'}</span></div><i>›</i>
    </button>)}</div>;
  }

  function renderPhotoStory(items: Outing[]) {
    if (!items.length) return <div className="photo-story-empty"><span>✧</span><div><b>Здесь будут жить твои воспоминания</b><small>Добавь выезд с фотографией — и он появится в фотоистории.</small></div><button className="outline-button" onClick={openNew}>Добавить выезд</button></div>;
    const [featured, ...rest] = items;
    const card = (row: Outing, large = false) => <button type="button" className={large ? 'photo-story-card photo-story-featured' : 'photo-story-card'} key={row.id} onClick={() => setReport(row)} style={{backgroundImage:`linear-gradient(0deg,rgba(3,15,11,.94) 0%,rgba(3,15,11,.08) 75%),url("${coverUrls[row.id] || pics[row.category]}")`}}>
      <span className="photo-story-meta">{row.category} <i>·</i> {row.date}</span>
      <strong>{row.title || 'Выезд без названия'}</strong>
      <small>⌖ {row.place || 'Место не указано'}</small>
      <em>Открыть историю ↗</em>
    </button>;
    return <div className="photo-story-grid">{card(featured, true)}<div className="photo-story-side">{rest.slice(0,2).map(row=>card(row))}</div></div>;
  }

  function renderRows(items: Outing[]) {
    if (!items.length) return <div className="empty-state"><div className="empty-landscape">✧</div><h3>Твои приключения начнутся здесь</h3><p>Сохраняй поездки, встречи с природой и важные моменты.</p><button className="gold-button" onClick={openNew}>＋ Добавить первый выезд</button></div>;
    return <div className="outing-list">{items.map(row => <article className="outing-row" key={row.id}>
      <div className="outing-thumb"><img src={coverUrls[row.id] || pics[row.category]} alt="" loading="lazy" decoding="async" onError={event => { const image = event.currentTarget; const fallback = new URL(pics[row.category], document.baseURI).href; if (image.src !== fallback) image.src = fallback; else image.style.visibility = 'hidden'; }} /></div>
      <div className="outing-info"><small>{row.category} <span>·</span> {row.date}</small><h3>{row.title}</h3><p>{row.place || 'Место не указано'}</p></div>
      <div className="outing-result">{row.note || 'Открыть отчёт'}</div>
      <button className="outline-button" onClick={() => setReport(row)}>Открыть ↗</button>
    </article>)}</div>;
  }


  const reportIcon = (kind: string) => {
    const assets: Record<string, string> = {
      calendar: 'Рустикальный календарь среди сосен.png',
      'category-hunt': 'Бронзовый медальон с перекрещенными ружьями.png',
      'category-fish': 'Рельефная бронзовая эмблема рыбалки с щукой.png',
      'category-camp': 'Бронзовая эмблема походного лагеря на закате.png',
      'category-travel': 'Золотой маршрут сквозь леса и озёра.png',
      days: 'Бронзовая эмблема походного лагеря на закате.png',
      distance: 'Навигация на закате.png',
      money: 'Кошелёк, монеты и закатный пейзаж.png',
      fish: 'Рельефная бронзовая эмблема рыбалки с щукой.png',
      camp: 'Бронзовая эмблема походного лагеря на закате.png',
      route: 'Золотой маршрут сквозь леса и озёра.png',
      goose: 'Бронзовый медальон с летящим гусем на закате.png',
      duck: 'Кряква в полёте над сияющим болотом.png',
      people: 'Бронзовая эмблема команды с природным гербом.png',
      observation: 'Гуси над туманным озером на закате.png',
      other: 'Бронзовый медальон с перекрещенными ружьями.png',
    };
    const file = assets[kind] || assets.other;
    const imageUrl = imageAsset(file);
    return <img src={imageUrl} alt="" aria-hidden="true" loading="eager" decoding="async" />;
  };
  const reportDetails = report?.details ?? {};
  const reportCover = report ? (coverUrls[report.id] || pics[report.category]) : '';
  const reportResultItems = report ? (
    report.category === 'Охота' ? [
      ['Гуси', reportDetails.geese], ['Утки', reportDetails.ducks], ['Другая добыча / наблюдения', reportDetails.otherGame]
    ] : report.category === 'Рыбалка' ? [
      ['Вес улова, кг', reportDetails.catchWeight], ['Виды рыб', reportDetails.fishSpecies],
      ['Количество по видам', reportDetails.fishQuantities], ['Приманки и снасти', reportDetails.lures],
      ['Щука, кг', reportDetails.pikeWeight], ['Лещ, кг', reportDetails.breamWeight],
      ['Окунь, кг', reportDetails.perchWeight], ['Сом, кг', reportDetails.catfishWeight]
    ] : report.category === 'Кемпинг' ? [
      ['Ночёвок', reportDetails.nights], ['Условия стоянки', reportDetails.conditions]
    ] : [
      ['Маршрут', reportDetails.route], ['Посещённые места', reportDetails.visitedPlaces],
      ['Продолжительность', reportDetails.duration]
    ]
  ).filter(([,value]) => value !== undefined && String(value).trim() !== '') : [];
  const reportView = report && <div className="modal-shade report-shade" onClick={e => { if (e.target === e.currentTarget) setReport(null); }}>
    <section className="report-modal report-modal-premium">
      <div className="report-hero" style={{backgroundImage:`linear-gradient(0deg,rgba(5,15,11,.96) 0%,rgba(5,15,11,.42) 55%,rgba(5,15,11,.12) 100%),url("${reportCover}")`}}>
        <div className="report-hero-top"><span>{report.category} <i>·</i> {report.date}</span><button className="close-button" onClick={() => setReport(null)} aria-label="Закрыть">×</button></div>
        <div className="report-hero-copy"><h2>{report.title || 'Выезд без названия'}</h2><p>⌖ {report.place || 'Место не указано'}</p></div>
      </div>
      <div className="report-content">
        <div className="report-actions"><button className="gold-button" onClick={() => exportOutingPdf(report)}>↓ PDF-отчёт</button><button className="outline-button" onClick={() => toggleFavorite(report)}>{report.favorite ? '★ В избранном' : '☆ В избранное'}</button><button className="outline-button" onClick={() => { setEdit(report); setReport(null); setModal(true); }}>Редактировать</button><button className="danger-button" onClick={() => removeOuting(report)}>Удалить</button></div>
        <section className="report-info-section">
          <div className="report-info-grid">
            <div className="report-info-card"><span className="report-icon">{reportIcon('calendar')}</span><div><small>Дата</small><strong>{report.date}{report.time ? ' · ' + report.time : ''}</strong></div></div>
            <div className="report-info-card"><span className="report-icon">{reportIcon(report.category === 'Охота' ? 'category-hunt' : report.category === 'Рыбалка' ? 'category-fish' : report.category === 'Кемпинг' ? 'category-camp' : 'category-travel')}</span><div><small>Категория</small><strong>{report.category}</strong></div></div>
            {reportDetails.daysOutdoors !== undefined && String(reportDetails.daysOutdoors).trim() !== '' && <div className="report-info-card"><span className="report-icon">{reportIcon('days')}</span><div><small>Дней на природе</small><strong>{String(reportDetails.daysOutdoors)}</strong></div></div>}
            {reportDetails.distance !== undefined && String(reportDetails.distance).trim() !== '' && <div className="report-info-card"><span className="report-icon">{reportIcon('distance')}</span><div><small>Расстояние</small><strong>{String(reportDetails.distance)} км</strong></div></div>}
            {reportDetails.spent !== undefined && String(reportDetails.spent).trim() !== '' && <div className="report-info-card"><span className="report-icon">{reportIcon('money')}</span><div><small>Расходы</small><strong>{String(reportDetails.spent)} BYN</strong></div></div>}
          </div>
        </section>
        {(reportResultItems.length > 0 || report.participants.length > 0) && <section className="report-results-section">
          <div className="report-info-grid">
            {reportResultItems.map(([label,value])=><div className="report-info-card" key={String(label)}>
              <span className="report-icon">{reportIcon(String(label).startsWith('Гуси') ? 'goose' : String(label).startsWith('Утки') ? 'duck' : String(label).startsWith('Другая') ? 'observation' : report.category === 'Рыбалка' ? 'fish' : report.category === 'Кемпинг' ? 'camp' : report.category === 'Путешествия' ? 'route' : 'other')}</span>
              <div><small>{label}</small><strong>{String(value)}</strong></div>
            </div>)}
            {report.participants.length > 0 && <div className="report-info-card report-participants-card">
              <span className="report-icon">{reportIcon('people')}</span>
              <div><small>Участники · {report.participants.length}</small><strong>{report.participants.join(', ')}</strong></div>
            </div>}
          </div>
        </section>}
        {report.weather && <div className="report-block"><h3>Погода и условия</h3><p>{report.weather}</p></div>}
        {report.timeline?.length > 0 && <div className="report-block"><h3>Ход приключения</h3><div className="report-timeline">{report.timeline.map((entry,index)=><div className="report-timeline-item" key={entry.id || index}><time>{entry.time || '—'}</time><div><strong>{entry.title}</strong>{entry.description && <p>{entry.description}</p>}</div></div>)}</div></div>}
        {reportMedia.length > 0 && <section className="report-gallery-section"><div className="report-section-heading"><span>СОХРАНЁННЫЕ МОМЕНТЫ</span><h3>Фото и видео <small>{reportMedia.length}</small></h3></div><div className="report-gallery">{reportMedia.map(item => item.blob ? <div className="report-media" key={item.id}>
          <button type="button" className="report-media-open" onClick={() => item.type === 'image' ? openReportPhoto(item) : setPreviewMedia(item)} aria-label={'Открыть ' + (item.type === 'image' ? 'фото: ' : 'видео: ') + item.name}>
            {item.type === 'image' ? <img src={URL.createObjectURL(item.blob)} alt={item.name}/> : <video src={URL.createObjectURL(item.blob)} muted playsInline preload="metadata"/>}
            <span>{item.type === 'image' ? 'Открыть фото ↗' : '▶ Открыть видео'}</span>
          </button>
          <button type="button" className="report-media-delete" onClick={() => removeReportMedia(item)}>Удалить</button>
        </div> : null)}</div></section>}
        {report.note && <div className="report-block"><h3>Заметки</h3><p>{report.note}</p></div>}
        {report.impressions && <div className="report-block"><h3>Впечатления</h3><p>{report.impressions}</p></div>}
        {report.conclusion && <div className="report-block"><h3>Итоги выезда</h3><p>{report.conclusion}</p></div>}
        {reportMedia.length === 0 && <p className="muted-note">К этому выезду пока не добавлены фото и видео.</p>}
      </div>
    </section>
  </div>;

  const form = <div className="modal-shade" onClick={event => { if (event.target === event.currentTarget) { setModal(false); setEdit(null); } }}>
    <form className="outing-modal wide-modal" onSubmit={save}>
      <div className="modal-head"><div><small>ЛИЧНЫЙ ПОЛЕВОЙ ЖУРНАЛ</small><h2>{edit ? 'Редактировать выезд' : 'Добавить выезд'}</h2></div><button type="button" className="close-button" onClick={() => { setModal(false); setEdit(null); }}>×</button></div>
      <div className="form-section"><h3>Основная информация</h3>
        <label>Название выезда<input name="title" required defaultValue={edit?.title ?? ''} placeholder="Например, Осенний выезд на озеро" /></label>
        <div className="form-pair"><label>Категория<select name="category" defaultValue={edit?.category ?? (category === 'Все' ? 'Охота' : category)}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label><label>Дата<input name="date" type="date" required defaultValue={edit?.date ?? new Date().toISOString().slice(0,10)} /></label></div>
        <label>Место<input name="place" defaultValue={edit?.place ?? ''} placeholder="Название места или населённого пункта" /></label>
        <div className="form-pair"><label>Широта<input name="lat" type="number" step="any" defaultValue={edit?.coordinates?.lat ?? pickedCoordinates?.lat ?? ''} placeholder="53.9006" /></label><label>Долгота<input name="lng" type="number" step="any" defaultValue={edit?.coordinates?.lng ?? pickedCoordinates?.lng ?? ''} placeholder="27.5590" /></label></div>
        <small className="muted-note">Координаты можно получить на карте и вставить сюда. Если координаты не указаны, выезд сохранится без метки.</small>
        <div className="form-pair"><label>Пройденное расстояние, км<input name="distance" type="number" min="0" step="0.1" defaultValue={edit?.details.distance as number ?? ''} placeholder="Например, 12.5" /></label><label>Потрачено, BYN<input name="spent" type="number" min="0" step="0.01" defaultValue={edit?.details.spent as number ?? ''} placeholder="Например, 85.50" /></label></div>
        <label>Участники (через запятую)<input name="participants" defaultValue={edit?.participants.join(', ') ?? ''} placeholder="Имена участников" /></label>
        <label>Погода и условия<input name="weather" defaultValue={edit?.weather ?? ''} placeholder="Температура, ветер, осадки, состояние воды..." /></label>
        <div className="form-pair"><label>Дней на природе<input name="daysOutdoors" type="number" min="0" step="1" defaultValue={edit?.details.daysOutdoors as number ?? 1} /></label></div>
      </div>
      <div className="form-section"><h3>Детали категории</h3>
        <div className="category-fields" data-category={edit?.category ?? 'Охота'}>
          <label>Категория выезда<select name="categoryDetail" defaultValue={edit?.category ?? 'Охота'} onChange={e => { const panel = e.currentTarget.closest('form')?.querySelector('.category-fields'); panel?.setAttribute('data-category', e.currentTarget.value); (e.currentTarget.form?.elements.namedItem('category') as HTMLSelectElement).value = e.currentTarget.value; }}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label>
          <div className="category-field-group" data-for="Охота"><div className="form-pair"><label>Добыто гусей<input name="geese" type="number" min="0" defaultValue={edit?.details.geese as number ?? ''} /></label><label>Добыто уток<input name="ducks" type="number" min="0" defaultValue={edit?.details.ducks as number ?? ''} /></label></div><label>Другая добыча / наблюдения<input name="otherGame" defaultValue={edit?.details.otherGame as string ?? ''} /></label></div>
          <div className="category-field-group" data-for="Рыбалка"><label>Общий вес улова, кг<input name="catchWeight" type="number" min="0" step="0.01" defaultValue={edit?.details.catchWeight as number ?? ''} /></label><label>Виды рыб<input name="fishSpecies" defaultValue={edit?.details.fishSpecies as string ?? ''} placeholder="Щука, окунь, лещ..." /></label><label>Количество по видам<input name="fishQuantities" defaultValue={edit?.details.fishQuantities as string ?? ''} /></label><label>Приманки и снасти<input name="lures" defaultValue={edit?.details.lures as string ?? ''} /></label>
            <div className="fish-record-inputs"><h4>Трофейные рыбы для личных рекордов</h4><p>Укажи вес каждой рыбы и выбери её фотографию из файлов этого выезда.</p>
              {([{key:'pike',label:'Щука'},{key:'bream',label:'Лещ'},{key:'perch',label:'Окунь'},{key:'catfish',label:'Сом'}] as const).map(fish=><div className="fish-record-input" key={fish.key}><b>{fish.label}</b><label>Вес, кг<input name={fish.key+'Weight'} type="number" min="0" step="0.01" defaultValue={edit?.details[fish.key+'Weight'] as number ?? ''} placeholder="0,00"/></label><label>Фото<select name={fish.key+'PhotoId'} defaultValue={String(edit?.details[fish.key+'PhotoId'] || '')}><option value="">Не выбрано</option>{media.filter(item=>item.type==='image').map(item=><option value={item.id} key={item.id}>{item.name}</option>)}{files.map((file,index)=>file.type.startsWith('image/')?<option value={'new:'+index} key={'new-fish-'+index}>{file.name} (новое)</option>:null)}</select></label></div>)}
            </div></div>
          <div className="category-field-group" data-for="Кемпинг"><label>Количество ночёвок<input name="nights" type="number" min="0" defaultValue={edit?.details.nights as number ?? ''} /></label><label>Условия стоянки<input name="conditions" defaultValue={edit?.details.conditions as string ?? ''} placeholder="Погода, место лагеря, доступность воды..." /></label></div>
          <div className="category-field-group" data-for="Путешествия"><label>Маршрут<input name="route" defaultValue={edit?.details.route as string ?? ''} /></label><label>Посещённые места<input name="visitedPlaces" defaultValue={edit?.details.visitedPlaces as string ?? ''} /></label><label>Продолжительность<input name="duration" defaultValue={edit?.details.duration as string ?? ''} placeholder="Например, 3 дня" /></label></div>
        </div>
      </div>
      <div className="form-section"><h3>Заметки</h3><textarea name="note" rows={5} defaultValue={edit?.note ?? ''} placeholder="Запиши всё, что захочешь сохранить об этом выезде..." /></div>
      <div className="form-section"><h3>Фото и видео</h3>
        <label className="file-picker">＋ Добавить фото и видео<input type="file" accept="image/*,video/*" multiple onChange={e => { void captureSelectedFiles(e.currentTarget.files); e.currentTarget.value = ''; }} /></label>
        {files.length > 0 && <p className="file-summary">Подготовлено: {files.filter(file => file.type.startsWith('image/')).length} фото · {files.filter(file => file.type.startsWith('video/')).length} видео · {(files.reduce((n,f) => n + f.size, 0) / 1024 / 1024).toFixed(1)} МБ</p>}
        <div className="media-existing"><label>Главное фото выезда<select key={files.map(file => file.name).join('|')} name="coverChoice" defaultValue={edit?.coverMediaId ?? (files.findIndex(file => file.type.startsWith('image/')) >= 0 ? `new:${files.findIndex(file => file.type.startsWith('image/'))}` : '')}><option value="">Автоматически выбрать первое фото</option>{media.filter(item => item.type === 'image').map(item => <option value={item.id} key={item.id}>Уже добавлено: {item.name}</option>)}{files.map((file,index) => file.type.startsWith('image/') ? <option value={`new:${index}`} key={`new-${index}`}>Новое фото: {file.name}</option> : null)}</select></label></div>
        <small className="muted-note">Фото и видео сохраняются в локальном хранилище этого устройства. Облачная синхронизация между устройствами ещё не подключена.</small>
      </div>
      {saveError && <div className="save-error" role="alert">{saveError}</div>}
      <div className="modal-actions"><button type="button" className="outline-button" disabled={isSaving} onClick={() => { setModal(false); setEdit(null); setSaveError(''); }}>Отмена</button><button className="gold-button" type="submit" disabled={isSaving}>{isSaving ? 'Сохраняем…' : 'Сохранить выезд'}</button></div>
    </form>
  </div>;

  return <div className="app-shell" style={{'--atlas-background-image': `url("${heroImage}")`} as React.CSSProperties}>
    <header className="topbar"><nav className="main-nav">{pages.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>{item === 'Журнал' ? 'Полевой журнал' : item}</button>)}</nav><div className={online ? 'connection online' : 'connection offline'}><i />{online ? 'В сети' : 'Офлайн'}</div></header>
    <main className="page-content">
      {page === 'Главная' && <>
        <section className="dashboard-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(8,13,17,.58),rgba(8,13,17,.12)),url("${heroImage}")`}}>
          <div className="hero-copy"><h1>Создавай жизнь,<br/>которую хочется вспоминать.</h1></div>
        </section>
        {(!lastBackupInfo || Date.now()-new Date(lastBackupInfo.createdAt).getTime()>30*24*60*60*1000) && <section className="home-backup-reminder" role="status">
          <div className="home-backup-reminder-icon">↥</div>
          <div className="home-backup-reminder-copy"><strong>{lastBackupInfo?'Пора обновить резервную копию':'Защити историю своих приключений'}</strong><span>{lastBackupInfo?'С последней отмеченной копии прошло больше 30 дней.':'Ты ещё не создавал резервную копию на этом устройстве.'} Сохрани выезды, фотографии и журнал.</span></div>
          <button type="button" onClick={()=>setPage('Настройки')}>Создать копию ↗</button>
        </section>}
        <section className="category-grid">{homeCats.map((cat,index) => <button key={cat} className={`category-tile category-${index} category-emblem-tile`} onClick={()=>{setCategory(cat);setPage('Выезды')}}><span className="category-emblem-art"><img src={pics[cat]} alt="" /></span><small>{rows.filter(row=>row.category===cat).length} выездов</small></button>)}</section>
        <section className="dashboard-section dashboard-stats-section">
          <div className="section-title"><div><h2>История выездов</h2></div></div>
          {statsPeriodControls}
          <div className="stat-grid stat-grid-home">{stats.map(stat=><div className="stat-card stat-art-card" key={stat.label}><div className="stat-art-viewport"><img loading="lazy" decoding="async" className="stat-art stat-art-full" src={imageAsset(({'Всего выездов':'Закатный лагерь у озера.png','Дней на природе':'Золотой закат в лесном лагере.png','Гусей':'Гуси над туманным озером на закате.png','Уток':'Кряквы над водой на закате.png','Всего проехал':'Золотой маршрут сквозь леса и озёра.png','Потрачено':'Походный натюрморт на закате.png'} as Record<string,string>)[stat.label])} alt="" /></div><strong>{stat.value}</strong><small>{stat.label}</small></div>)}</div>
        </section>
        <section className="dashboard-section photo-story-section"><div className="section-title"><div><h2>Недавние выезды</h2></div><button className="text-button" onClick={()=>{setCategory('Все');setPage('Выезды')}}>Все выезды ↗</button></div>{renderPhotoStory([...rows].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0,3))}</section>

      </>}
      {page === 'Выезды' && <section className="section-page"><div className="section-title"><div><span className="eyebrow">ТВОИ ИСТОРИИ</span><h1>Выезды</h1></div><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div><div className="outing-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию и месту"/><div className="category-filters"><button className={category==='Все'?'active':''} onClick={()=>setCategory('Все')}>Все</button>{cats.map(cat=><button key={cat} className={category===cat?'active':''} onClick={()=>setCategory(cat)}>{cat}</button>)}</div></div>{renderRows(filtered)}</section>}
      {page === 'Карта' && <section className="section-page map-page">
        <div className="section-title"><div><span className="eyebrow">ГЕОГРАФИЯ ТВОИХ ПРИКЛЮЧЕНИЙ</span><h1>Карта приключений</h1></div><span className="map-count">{rows.filter(row=>row.coordinates).length + savedPlaces.length} точек</span></div>
        <div className="map-toolbar"><input value={mapQuery} onChange={e=>setMapQuery(e.target.value)} placeholder="Найти озеро, населённый пункт или место"/><button className="gold-button" onClick={async()=>{if(!mapQuery.trim())return;setMapMessage('Ищем место…');try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(mapQuery));if(!response.ok)throw new Error();const result=await response.json();if(!result.length){setMapMessage('Место не найдено. Уточни запрос.');return;}const map=mapInstance.current;const lat=Number(result[0].lat),lng=Number(result[0].lon);setPickedCoordinates({lat,lng});if(map){map.flyTo({center:[lng,lat],zoom:13,essential:true});const marker=createMapMarkerElement('#d7b65d');marker.classList.add('atlas-map-marker-picked');const popup=document.createElement('div');popup.textContent=result[0].display_name;const pin=new (window as any).maplibregl.Marker({element:marker,anchor:'bottom'}).setLngLat([lng,lat]).setPopup(new (window as any).maplibregl.Popup({offset:22}).setDOMContent(popup)).addTo(map);if((map as any).atlasSearchMarker)(map as any).atlasSearchMarker.remove();(map as any).atlasSearchMarker=pin;pin.togglePopup();}setMapMessage('Место найдено и выбрано. Его можно сохранить отдельно или создать выезд.');}catch{setMapMessage('Поиск доступен при подключении к интернету.');}}}>Найти</button></div>
        <div className="category-filters map-filters"><button className={mapFilter==='Все'?'active':''} onClick={()=>setMapFilter('Все')}>Все</button>{cats.map(cat=><button key={cat} className={mapFilter===cat?'active':''} onClick={()=>setMapFilter(cat)}>{cat}</button>)}</div>
        {mapMessage && <p className="map-message">{mapMessage}</p>}
        {pickedCoordinates && <div className="map-picked"><span>Выбрано: {pickedCoordinates.lat.toFixed(6)}, {pickedCoordinates.lng.toFixed(6)}</span><button className="gold-button" onClick={()=>{setEdit(null);setFiles([]);setModal(true);}}>Создать выезд</button><button className="outline-button" onClick={()=>{setPlaceEdit(null);setPlaceError('');setPlaceModal(true);}}>Сохранить место</button><button className="outline-button" onClick={()=>setPickedCoordinates(null)}>Сбросить</button></div>}
        <div className="adventure-map" ref={mapElement}><div className="map-loading">Загружаем карту…</div></div>
        {activeSavedPlace && <article className="saved-place-detail"><div><small>{activeSavedPlace.type} · {activeSavedPlace.category}</small><h3>{activeSavedPlace.title}</h3><p>{activeSavedPlace.description || 'Без описания'}</p><span>{activeSavedPlace.lat.toFixed(5)}, {activeSavedPlace.lng.toFixed(5)}</span></div><button className="outline-button" onClick={()=>{setPlaceEdit(activeSavedPlace);setPickedCoordinates({lat:activeSavedPlace.lat,lng:activeSavedPlace.lng});setPlaceError('');setPlaceModal(true);}}>Изменить</button><button className="danger-button" onClick={async()=>{if(confirm('Удалить сохранённое место?')){await deleteSavedPlace(activeSavedPlace.id);setActiveSavedPlace(null);refreshSavedPlaces();}}}>Удалить</button></article>}<div className="map-legend"><span>● Охота</span><span>● Рыбалка</span><span>● Кемпинг</span><span>● Путешествия</span></div>
      </section>}
      {page === 'Журнал' && <section className="section-page journal-page">
        <div className="section-title"><div><span className="eyebrow">НАБЛЮДЕНИЯ И ВОСПОМИНАНИЯ</span><h1>Полевой журнал</h1></div><button className="gold-button" onClick={openJournalNew}>＋ Новая запись</button></div>
        <div className="journal-toolbar"><input value={journalQuery} onChange={e=>setJournalQuery(e.target.value)} placeholder="Поиск по записям"/><div className="category-filters">{(['Все','Наблюдения','Заметки','События'] as const).map(type=><button key={type} className={journalFilter===type?'active':''} onClick={()=>setJournalFilter(type)}>{type}</button>)}</div></div>
        {journalRows.filter(entry=>(journalFilter==='Все'||entry.type===journalFilter)&&[entry.title,entry.place,entry.description].join(' ').toLowerCase().includes(journalQuery.toLowerCase())).length ? <div className="journal-list">{journalRows.filter(entry=>(journalFilter==='Все'||entry.type===journalFilter)&&[entry.title,entry.place,entry.description].join(' ').toLowerCase().includes(journalQuery.toLowerCase())).map(entry=>{const cover=entry.photos.find(photo=>photo.id===(entry.coverPhotoId||entry.photos[0]?.id));return <article className="journal-card" key={entry.id} onClick={()=>openJournalEdit(entry)}>{cover&&journalPhotoUrls[cover.id]?<button type="button" className="journal-photo-open" onClick={event=>{event.stopPropagation();openJournalPhoto(entry,cover);}} aria-label="Открыть фотографии записи"><img className="journal-card-photo" src={journalPhotoUrls[cover.id]} alt=""/></button>:<div className="journal-card-placeholder">✧</div>}<div className="journal-card-copy"><small>{new Date(entry.date+'T12:00:00').toLocaleDateString('ru-RU')} · {entry.type}</small><h3>{entry.title}</h3><p>{entry.description}</p><span>{entry.place || 'Место не указано'} · {entry.photos.length} фото</span></div><button className="journal-delete" onClick={e=>{e.stopPropagation();removeJournal(entry);}} aria-label="Удалить запись">×</button></article>})}</div> : <div className="journal-empty"><span>✧</span><h3>Записей пока нет</h3><p>Сохраняй наблюдения за природой, интересные места и памятные события. Они не привязаны к отдельным выездам.</p><button className="gold-button" onClick={openJournalNew}>＋ Создать первую запись</button></div>}
      </section>}
      {page === 'Статистика' && <section className="section-page stats-page">
        <h1>Статистика</h1>
        {statsPeriodControls}
        
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Личные рекорды</h2></div>
          <div className="record-stats-grid">{recordStats.map(item=><article className="record-stat-card" key={item.title}><small>{item.title}</small><strong>{item.value}</strong><span>{item.detail}</span></article>)}</div>
        </section>

        
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Распределение по категориям</h2></div>
          <div className="category-chart-layout"><div className="category-donut" style={{background:categoryTotal?`conic-gradient(${categoryGradient})`:'conic-gradient(#555 0 100%)'}}><div><strong>{categoryTotal}</strong><small>выездов</small></div></div>
            <div className="category-legend">{categoryStats.map((item,index)=><div key={item.category}><i className={`legend-dot legend-${index}`}/><span>{item.category}</span><b>{item.outings}</b><small>{categoryTotal?Math.round(item.outings/categoryTotal*100):0}%</small></div>)}</div></div>
        </section>
        <section className="stats-panel stats-season-panel"><div className="stats-panel-heading"><h2>Активность по сезонам</h2></div>
          <div className="season-chart">{seasonalStats.map(item=>{const max=Math.max(1,...seasonalStats.map(x=>x.outings));return <div className={`season-row season-${item.tone}`} key={item.name}><span className="season-name"><i>{item.icon}</i>{item.name}</span><div className="season-track"><i style={{width:`${item.outings/max*100}%`}}/></div><b>{item.outings}</b></div>})}</div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Активность по месяцам</h2></div>
          <div className="monthly-chart">{monthlyStats.map(item=><div className="month-column" key={item.month}><strong>{item.outings}</strong><div className="month-bar-track"><i style={{height:`${item.outings?Math.max(4,item.outings/Math.max(1,...monthlyStats.map(x=>x.outings))*100):0}%`}} /></div><small>{item.label}</small></div>)}</div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Добыча по месяцам</h2></div>
          <div className="hunting-legend"><span><i className="goose-dot"/>Гуси</span><span><i className="duck-dot"/>Утки</span></div>
          <div className="hunting-chart">{huntingMonthlyStats.map(item=>{const max=Math.max(1,...huntingMonthlyStats.map(x=>x.geese+x.ducks));return <div className="hunting-column" key={item.month}><strong>{item.geese+item.ducks||''}</strong><div className="hunting-bar-track"><i className="goose-bar" style={{height:`${item.geese/max*100}%`}}/><i className="duck-bar" style={{height:`${item.ducks/max*100}%`}}/></div><small>{item.label}</small></div>})}</div>
          <div className="hunting-total-row"><span>Всего гусей: <b>{huntingMonthlyStats.reduce((sum,item)=>sum+item.geese,0)}</b></span><span>Всего уток: <b>{huntingMonthlyStats.reduce((sum,item)=>sum+item.ducks,0)}</b></span></div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Сравнение по годам</h2></div>
          {yearlyStats.length ? <>
            <div className="year-line-chart"><svg viewBox="0 0 300 140" role="img" aria-label="Динамика количества выездов по годам"><line x1="18" y1="120" x2="282" y2="120"/><polyline points={yearlyStats.map((item,index)=>{const x=24+index*(252/Math.max(1,yearlyStats.length-1));const y=116-item.outings/Math.max(1,...yearlyStats.map(v=>v.outings))*88;return `${x},${y}`;}).join(' ')}/>{yearlyStats.map((item,index)=>{const x=24+index*(252/Math.max(1,yearlyStats.length-1));const y=116-item.outings/Math.max(1,...yearlyStats.map(v=>v.outings))*88;return <g key={item.year}><circle cx={x} cy={y} r="4"/><text x={x} y={Math.max(12,y-10)} textAnchor="middle">{item.outings}</text><text className="year-axis-label" x={x} y="137" textAnchor="middle">{String(item.year).slice(2)}</text></g>})}</svg><small>Количество выездов по годам</small></div>
            <div className="year-stats-list">{yearlyStats.map(item=><div className="year-stats-row" key={item.year}><b>{item.year}</b><span>{item.outings} выездов</span><span>{item.days} дней на природе</span></div>)}</div>
          </> : <p className="stats-empty">Пока нет сохранённых выездов.</p>}
        </section>


        {!periodRows.length && <p className="stats-empty">За выбранный период записей пока нет. Добавь выезд — и здесь появится статистика.</p>}
      </section>}
      {page === 'Рекорды' && <section className="section-page records-page">
        <h1>Рекорды</h1>
        <div className="records-group stats-panel"><div className="records-group-heading"><h2>Рыбалка</h2></div><div className="records-grid">
          {trophyRecords.slice(0,4).map(item=><article className="record-card record-fish-card" key={item.key}>
            {item.row && item.photoId && recordPhotoUrls[item.photoId] ? <img className="record-fish-photo" src={recordPhotoUrls[item.photoId]} alt={item.title}/> : <div className="record-fish-placeholder"><span>✧</span><small>Фото трофея не выбрано</small></div>}
            <div className="record-card-copy"><small>{item.title}</small><strong>{item.row ? Number(item.weight ?? 0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' кг' : '—'}</strong>
              {item.row ? <button className="record-outing-link" onClick={()=>item.row && setReport(item.row)}>Открыть выезд ↗</button> : <span className="record-no-data">Пока нет рекорда</span>}
            </div>
          </article>)}
        </div></div>
        <div className="records-group stats-panel"><div className="records-group-heading"><h2>Охота</h2></div><div className="records-grid records-count-grid">
          {trophyRecords.slice(4,6).map(item=><article className="record-card record-count-card" key={item.key}><small>{item.title}</small><strong>{item.row ? item.count : '—'}</strong>{item.row ? <button className="record-outing-link" onClick={()=>item.row && setReport(item.row)}>Открыть выезд ↗</button> : <span className="record-no-data">Пока нет рекорда</span>}</article>)}
        </div></div>
        <div className="records-group stats-panel"><div className="records-group-heading"><h2>Путешествия</h2></div><div className="records-grid records-count-grid">
          {trophyRecords.slice(6,7).map(item=><article className="record-card record-count-card" key={item.key}><small>{item.title}</small><strong>{item.row ? item.count : '—'}</strong>{item.row ? <button className="record-outing-link" onClick={()=>item.row && setReport(item.row)}>Открыть выезд ↗</button> : <span className="record-no-data">Пока нет рекорда</span>}</article>)}
        </div></div>
      </section>}
      {page === 'Настройки' && <section className="section-page"><span className="eyebrow">УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ</span><h1>Настройки</h1><div className="settings-grid"><div className="setting-card backup-setting-card"><h3>Резервная копия</h3><p>Полная копия всех выездов, фотографий, видео, полевого журнала, сохранённых мест и настроек. Файл можно перенести на другое устройство.</p><div className="backup-actions"><button className="gold-button" onClick={downloadFullBackup} disabled={backupBusy}>{backupBusy?'Обрабатываем…':'↓ Создать резервную копию'}</button><button className="outline-button" onClick={()=>backupFileRef.current?.click()} disabled={backupBusy}>↑ Восстановить из файла</button><input ref={backupFileRef} type="file" accept=".json,application/json" hidden onChange={event=>importFullBackup(event.target.files?.[0])}/></div>{backupMessage&&<small className="backup-message" role="status">{backupMessage}</small>}{lastBackupInfo&&<div className="backup-last-info"><span>Последняя резервная копия</span><strong>{new Date(lastBackupInfo.createdAt).toLocaleString('ru-RU')}</strong><span>Размер файла: {(lastBackupInfo.size/1024/1024).toFixed(2)} МБ</span><span className="backup-integrity-ok">✓ Проверка целостности SHA-256</span></div>}{(!lastBackupInfo || Date.now()-new Date(lastBackupInfo.createdAt).getTime()>30*24*60*60*1000) && <div className="backup-reminder" role="status"><strong>Рекомендуется создать резервную копию</strong><span>{lastBackupInfo?'Прошло больше 30 дней с последней отмеченной копии.':'Резервная копия ещё не создавалась на этом устройстве.'} Сохрани файл отдельно от телефона.</span></div>}<small>При восстановлении файл проверяется по SHA-256 до изменения базы. Старые копии версии 1 также поддерживаются. Копия хранится в выбранном тобой месте; автоматическая отправка в облако не выполняется.</small></div><div className="setting-card profile-setting-card"><h3>Профиль и устройства</h3><p>Настройки семейного профиля и название этого устройства.</p><form className="profile-settings-form" onSubmit={saveProfileSettings}><label>Название профиля<input name="profileName" maxLength={60} defaultValue={profileSettings.profileName}/></label><label>Название устройства<input name="deviceName" maxLength={60} defaultValue={profileSettings.deviceName}/></label><div className="profile-device-info"><strong>Текущее устройство</strong><span>{profileSettings.deviceName}</span><small>Определение: { /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Apple / iOS' : /Android/i.test(navigator.userAgent) ? 'Android' : 'Браузер на компьютере' }</small><small>Сейчас зарегистрировано только это устройство. Подключение других устройств и общий профиль между ними появятся после внедрения облачной синхронизации.</small></div><div className="profile-settings-actions"><button className="gold-button" type="submit">Сохранить профиль</button>{profileSaved&&<span role="status">✓ Сохранено на этом устройстве</span>}</div></form></div><div className="setting-card storage-setting-card"><div className="storage-heading"><div><h3>Хранилище устройства</h3><p>Фактический объём локальных фото и видео Следа</p></div></div>{storageLoading&&!storageSummary?<p className="storage-muted">Считаем объём файлов…</p>:storageError?<p className="storage-error" role="alert">{storageError}</p>:storageSummary?<><div className="storage-total"><strong>{((storageSummary.mediaBytes+storageSummary.journalPhotoBytes)/1024/1024).toFixed(2)} МБ</strong><span>занято медиафайлами Следа</span></div><div className="storage-breakdown"><div><span>Фотографии выездов</span><strong>{storageSummary.photoCount}</strong></div><div><span>Видео выездов</span><strong>{storageSummary.videoCount}</strong></div><div><span>Фото в журнале</span><strong>{storageSummary.journalPhotoCount}</strong></div><div><span>Общий объём фото и видео</span><strong>{((storageSummary.mediaBytes+storageSummary.journalPhotoBytes)/1024/1024).toFixed(2)} МБ</strong></div></div><div className="storage-records"><span>Активные выезды <b>{storageSummary.outingCount}</b></span><span>В корзине <b>{storageSummary.deletedOutingCount}</b></span><span>Записи журнала <b>{storageSummary.journalCount}</b></span><span>Сохранённые места <b>{storageSummary.savedPlaceCount}</b></span></div>{storageQuota?.quota?<div className="storage-quota"><div><span>Использование хранилища браузера</span><b>{((storageQuota.usage||0)/1024/1024).toFixed(1)} из {(storageQuota.quota/1024/1024).toFixed(0)} МБ</b></div><div className="storage-quota-track"><i style={{width:Math.min(100,((storageQuota.usage||0)/storageQuota.quota)*100)+'%'}}/></div><small>Оценка браузера для всего сайта, не только для Следа</small></div>:<p className="storage-muted">Браузер не предоставил оценку общего лимита хранилища.</p>}</>:null}<small>Размер медиа рассчитан по сохранённым Blob-файлам. Оценка браузера может включать другие данные сайта. Ничего не удаляется автоматически.</small></div><div className="setting-card"><h3>Экспорт в PDF</h3><p>Создай PDF-фотоальбом с историями и фотографиями всех выездов за выбранный год.</p><label>Год отчёта<select value={albumYear} onChange={event=>setAlbumYear(Number(event.target.value))}>{Array.from(new Set([new Date().getFullYear(),...rows.map(row=>Number(row.date.slice(0,4))).filter(Number.isFinite)])).sort((a,b)=>b-a).map(year=><option key={year} value={year}>{year}</option>)}</select></label><button className="gold-button" onClick={()=>exportAnnualAlbumPdf(albumYear)} disabled={pdfBusy || !rows.some(row=>!row.deletedAt && Number(row.date.slice(0,4))===albumYear)}>{pdfBusy?"Подготавливаем…":"↓ Создать PDF"}</button><small>В PDF входят активные выезды выбранного года и фотографии. Видео не включаются.</small></div></div></section>}
    </main>
    
    {reportView}{modal&&form}
    {placeModal && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!placeSaving)setPlaceModal(false);}}><form className="journal-modal saved-place-modal" onSubmit={async e=>{e.preventDefault();if(!pickedCoordinates){setPlaceError('Сначала выбери точку на карте или найди место через поиск.');return;}setPlaceSaving(true);setPlaceError('');try{const data=new FormData(e.currentTarget);const now=new Date().toISOString();const value:SavedPlace={id:placeEdit?.id??crypto.randomUUID(),title:String(data.get('title')||'').trim(),type:data.get('type') as SavedPlace['type'],category:data.get('category') as SavedPlace['category'],lat:pickedCoordinates.lat,lng:pickedCoordinates.lng,description:String(data.get('description')||'').trim(),createdAt:placeEdit?.createdAt??now,updatedAt:now};if(!value.title)throw new Error('Укажи название места.');await putSavedPlace(value);await refreshSavedPlaces();setActiveSavedPlace(value);setPlaceModal(false);setMapMessage('Место сохранено отдельно от выездов.');}catch(err){setPlaceError(err instanceof Error?err.message:'Не удалось сохранить место.');}finally{setPlaceSaving(false);}}}><div className="modal-heading"><div><span className="eyebrow">ЛИЧНАЯ КАРТА</span><h2>{placeEdit?'Изменить место':'Сохранить место'}</h2></div><button type="button" className="modal-close" onClick={()=>setPlaceModal(false)}>×</button></div><p className="muted-note">Координаты: {pickedCoordinates?pickedCoordinates.lat.toFixed(6)+', '+pickedCoordinates.lng.toFixed(6):'не выбраны'}</p><label>Название<input name="title" required maxLength={90} defaultValue={placeEdit?.title??''} placeholder="Например, стоянка у озера"/></label><label>Тип места<select name="type" defaultValue={placeEdit?.type??'Избранное место'}><option>Избранное место</option><option>Стоянка</option><option>Рыбалка</option><option>Наблюдение</option><option>Другое</option></select></label><label>Категория<select name="category" defaultValue={placeEdit?.category??'Путешествия'}>{cats.map(cat=><option key={cat}>{cat}</option>)}</select></label><label>Заметки<textarea name="description" rows={4} defaultValue={placeEdit?.description??''} placeholder="Подъезд, особенности места, что стоит помнить..."/></label>{placeError&&<div className="save-error" role="alert">{placeError}</div>}<small className="muted-note">Сохранённые места не создают выезд и не влияют на статистику.</small><div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setPlaceModal(false)} disabled={placeSaving}>Отмена</button><button className="gold-button" type="submit" disabled={placeSaving}>{placeSaving?'Сохраняем…':'Сохранить место'}</button></div></form></div>}
    {journalModal && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!journalSaving)setJournalModal(false);}}><form className="journal-modal" onSubmit={saveJournal}><div className="modal-heading"><div><span className="eyebrow">ПОЛЕВЫЕ ЗАПИСИ</span><h2>{journalEdit?'Редактировать запись':'Новая запись'}</h2></div><button type="button" className="modal-close" onClick={()=>setJournalModal(false)}>×</button></div><label>Заголовок<input name="title" required maxLength={90} defaultValue={journalEdit?.title??''} placeholder="Например, Пролёт гусей"/></label><label>Тип записи<select name="type" defaultValue={journalEdit?.type??'Наблюдения'}><option>Наблюдения</option><option>Заметки</option><option>События</option></select></label><div className="journal-form-row"><label>Дата<input name="date" type="date" required defaultValue={journalEdit?.date??new Date().toISOString().slice(0,10)}/></label><label>Место<input name="place" defaultValue={journalEdit?.place??''} placeholder="Озеро, лес, район"/></label></div><label>Описание<textarea name="description" rows={5} required defaultValue={journalEdit?.description??''} placeholder="Что заметил, что произошло, что стоит запомнить..."/></label><label className="file-picker">＋ Добавить фотографии<input type="file" accept="image/*" multiple onChange={e=>{setJournalFiles(Array.from(e.target.files??[]));setJournalCoverChoice('');}}/></label>{(journalEdit?.photos.length??0)>0&&<p className="file-summary">Уже сохранено фотографий: {journalEdit?.photos.length}</p>}{journalFiles.length>0&&<p className="file-summary">Выбрано новых фото: {journalFiles.length}</p>}<label>Главное фото записи<select value={journalCoverChoice} onChange={e=>setJournalCoverChoice(e.target.value)}><option value="">Автоматически — первое фото</option>{(journalEdit?.photos??[]).map(photo=><option value={photo.id} key={photo.id}>Сохранённое: {photo.name}</option>)}{journalFiles.map((file,index)=>file.type.startsWith('image/')?<option value={`new:${index}`} key={`new-${index}`}>Новое: {file.name}</option>:null)}</select></label><small className="muted-note">Записи и фотографии хранятся локально на этом устройстве. Облачная синхронизация пока не подключена.</small>{journalError&&<div className="save-error" role="alert">{journalError}</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setJournalModal(false)} disabled={journalSaving}>Отмена</button><button className="gold-button" type="submit" disabled={journalSaving}>{journalSaving?'Сохраняем…':'Сохранить запись'}</button>{journalEdit&&<button type="button" className="outline-button" onClick={()=>removeJournal(journalEdit)}>Удалить</button>}</div></form></div>}

    {previewMedia && previewUrl && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр медиа" onClick={event => { if (event.target === event.currentTarget) setPreviewMedia(null); }}>
      <button type="button" className="media-lightbox-close" onClick={() => { setPreviewMedia(null); setPreviewGallery([]); }} aria-label="Закрыть просмотр">×</button>
      {previewMedia.type === 'image' && previewGallery.length > 1 && <button type="button" className="media-lightbox-nav media-lightbox-prev" onClick={() => movePreview(-1)} aria-label="Предыдущее фото">‹</button>}
      {previewMedia.type === 'image' ? <img src={previewUrl} alt=""/> : <video src={previewUrl} controls autoPlay playsInline/>}
      {previewMedia.type === 'image' && previewGallery.length > 1 && <button type="button" className="media-lightbox-nav media-lightbox-next" onClick={() => movePreview(1)} aria-label="Следующее фото">›</button>}
      <div className="media-lightbox-caption">{previewMedia.type === 'image' && previewGallery.length > 1 && <span className="media-lightbox-counter">{previewIndex + 1} / {previewGallery.length}</span>}{previewMedia.type==='image'&&previewMedia.blob&&<button type="button" className="gold-button photo-download-button" onClick={()=>downloadPhoto(previewMedia.blob!,previewMedia.name)}>↓ Скачать фото</button>}</div>
    </div>}
  </div>;
}
