import { useEffect, useMemo, useRef, useState } from 'react';
import { all, put, softDelete, Cat, Outing, saveMedia, getMediaForOuting, MediaItem } from './db';

const cats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг', 'Путешествия'];
type Page = 'Главная' | 'Выезды' | 'Карта' | 'Статистика' | 'Рекорды' | 'Настройки';
const pages: Page[] = ['Главная', 'Выезды', 'Карта', 'Статистика', 'Рекорды', 'Настройки'];
const pics: Record<Cat, string> = {
  'Охота': `${import.meta.env.BASE_URL}images/IMG_20260316_165954_416.jpg`,
  'Рыбалка': `${import.meta.env.BASE_URL}images/IMG_20241003_153019.jpg`,
  'Кемпинг': `${import.meta.env.BASE_URL}images/IMG_20251023_084247.jpg`,
  'Путешествия': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
};
const assetBase = import.meta.env.BASE_URL;
const heroImage = `${assetBase}atlas-lake-bg.jpg`;
function createMapMarkerElement(color:string) {
  const el=document.createElement('div');
  el.className='atlas-map-marker';
  el.style.cssText='width:22px;height:30px;display:grid;place-items:center;filter:drop-shadow(0 2px 3px #0008);';
  const pin=document.createElement('div');
  pin.style.cssText='position:relative;width:14px;height:22px;box-sizing:border-box;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:rgba(10,24,18,.9);border:1.5px solid '+color+';box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);';
  const inner=document.createElement('span');
  inner.style.cssText='position:absolute;inset:3px;border:1px solid rgba(255,239,196,.78);border-radius:50% 50% 50% 0;';
  const point=document.createElement('i');
  point.style.cssText='position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:'+color+';';
  pin.append(inner,point);el.appendChild(pin);return el;
}
const emptyDetails = { geese: '', ducks: '', otherGame: '', catchWeight: '', fishSpecies: '', fishQuantities: '', lures: '', nights: '', conditions: '', route: '', visitedPlaces: '', distance: '', daysOutdoors: '', duration: '' };

export default function App() {
  const [page, setPage] = useState<Page>('Главная');
  const [rows, setRows] = useState<Outing[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Outing | null>(null);
  const [report, setReport] = useState<Outing | null>(null);
  const [reportMedia, setReportMedia] = useState<MediaItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [online, setOnline] = useState(navigator.onLine);
  
  const [statsPeriod, setStatsPeriod] = useState<'all' | 'year' | 'month'>('all');
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth());
  const [mapQuery, setMapQuery] = useState('');
  const [mapFilter, setMapFilter] = useState('Все');
  const [mapMessage, setMapMessage] = useState('');
  const [pickedCoordinates, setPickedCoordinates] = useState<{lat:number;lng:number}|null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const refresh = () => all().then(setRows);

  useEffect(() => {
    refresh();
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);

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
        visible.forEach(row=>{
          const color=row.category==='Охота'?'#d7b65d':row.category==='Рыбалка'?'#65a9d2':row.category==='Кемпинг'?'#75ad79':'#b18bd0';
          const marker=new w.maplibregl.Marker({element:markerIcon(color),anchor:'bottom'}).setLngLat([row.coordinates!.lng,row.coordinates!.lat]);
          const photo=coverUrls[row.id];const safeTitle=String(row.title||'Выезд').replace(/[&<>"]/g,'');const safePlace=String(row.place||'Место не указано').replace(/[&<>"]/g,'');
          const popup=document.createElement('div');popup.className='atlas-map-popup';popup.innerHTML=(photo?'<img src="'+photo+'" alt="" style="width:190px;height:105px;object-fit:cover;border-radius:6px;margin-bottom:6px"/><br>':'')+'<strong>'+safeTitle+'</strong><br>'+String(row.category).replace(/[&<>"]/g,'')+' · '+String(row.date)+'<br>'+safePlace;
          marker.setPopup(new w.maplibregl.Popup({offset:22}).setDOMContent(popup)).addTo(map);
          marker.getElement().addEventListener('click',()=>setReport(row));
        });
        map.on('click',(event:any)=>{
          const target=event.originalEvent?.target as HTMLElement;
          if(target?.closest('.maplibregl-marker,.maplibregl-popup,.maplibregl-ctrl'))return;
          const lat=Number(event.lngLat.lat.toFixed(6));const lng=Number(event.lngLat.lng.toFixed(6));
          setPickedCoordinates({lat,lng});setMapMessage('Выбрана точка: '+lat+', '+lng+'. Координаты подставятся в новую запись выезда.');
          const el=markerIcon('#d7b65d');
          const marker=new w.maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(map);
          const popup=document.createElement('div');popup.textContent='Выбранная точка: '+lat+', '+lng;
          marker.setPopup(new w.maplibregl.Popup({offset:22}).setDOMContent(popup)).togglePopup();
          if((map as any).atlasPickedMarker)(map as any).atlasPickedMarker.remove();
          (map as any).atlasPickedMarker=marker;
        });
        if(visible.length){const bounds=new w.maplibregl.LngLatBounds();visible.forEach(row=>bounds.extend([row.coordinates!.lng,row.coordinates!.lat]));map.fitBounds(bounds,{padding:60,maxZoom:11,duration:0});}
      });
      map.on('error',(event:any)=>{if(event?.error)setMapMessage('Ошибка загрузки карты или картографических данных. Проверь подключение к интернету.');});
    };
    init().catch(()=>setMapMessage('Не удалось загрузить карту. Проверь подключение к интернету.'));
    return ()=>{cancelled=true;if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null;}};
  },[page,rows,mapFilter,coverUrls]);

  useEffect(() => {
    if (!report) { setReportMedia([]); return; }
    getMediaForOuting(report.id).then(setReportMedia);
  }, [report]);

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
      { label: 'Всего выездов', value: periodRows.length, symbol: '▦' },
      { label: 'Дней на природе', value: days, symbol: '☼' },
      { label: 'Добыто гусей', value: geese, symbol: '➤' },
      { label: 'Добыто уток', value: ducks, symbol: '➤' },
      { label: 'Пройденное расстояние', value: periodRows.reduce((sum, row) => sum + Number(row.details?.distance ?? 0), 0).toLocaleString('ru-RU') + ' км', symbol: '⌁' },
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
  const recordStats = useMemo(() => {
    const bestDays = [...rows].map(row=>({...row, metric:Number(row.details?.daysOutdoors ?? 1)})).filter(row=>row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestDistance = [...rows].map(row=>({...row, metric:Number(row.details?.distance ?? 0)})).filter(row=>row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestGeese = [...rows].map(row=>({...row, metric:Number(row.details?.geese ?? 0)})).filter(row=>row.category==='Охота'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestDucks = [...rows].map(row=>({...row, metric:Number(row.details?.ducks ?? 0)})).filter(row=>row.category==='Охота'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    const bestCatch = [...rows].map(row=>({...row, metric:Number(row.details?.catchWeight ?? 0)})).filter(row=>row.category==='Рыбалка'&&row.metric>0).sort((a,b)=>b.metric-a.metric)[0];
    return [
      {title:'Самый долгий выезд',value:bestDays?`${bestDays.metric} дн.`:'—',detail:bestDays?.title||'Пока нет данных'},
      {title:'Самый длинный маршрут',value:bestDistance?`${bestDistance.metric} км`:'—',detail:bestDistance?.title||'Пока нет данных'},
      {title:'Больше всего гусей',value:bestGeese?String(bestGeese.metric):'—',detail:bestGeese?.title||'Пока нет данных'},
      {title:'Больше всего уток',value:bestDucks?String(bestDucks.metric):'—',detail:bestDucks?.title||'Пока нет данных'},
      {title:'Лучший улов',value:bestCatch?`${bestCatch.metric} кг`:'—',detail:bestCatch?.title||'Пока нет данных'},
      {title:'Точки на карте',value:String(rows.filter(row=>row.coordinates).length),detail:'Выезды с сохранёнными координатами'},
    ];
  }, [rows]);
  const statsPeriodControls = <div className="stats-controls">
    <div className="stats-period" role="group" aria-label="Период статистики">
      <button className={statsPeriod==='all'?'active':''} onClick={()=>setStatsPeriod('all')}>Всё время</button>
      <button className={statsPeriod==='year'?'active':''} onClick={()=>setStatsPeriod('year')}>Год</button>
      <button className={statsPeriod==='month'?'active':''} onClick={()=>setStatsPeriod('month')}>Месяц</button>
    </div>
    <div className="stats-selectors">
      <label>Год графиков<select value={statsYear} onChange={e=>setStatsYear(Number(e.target.value))}>{availableYears.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
      {statsPeriod === 'month' && <label>Месяц<select value={statsMonth} onChange={e=>setStatsMonth(Number(e.target.value))}>{Array.from({length:12},(_,month)=><option key={month} value={month}>{new Date(2000,month,1).toLocaleDateString('ru-RU',{month:'long'})}</option>)}</select></label>}
    </div>
  </div>;

  const filtered = rows.filter(row =>
    (category === 'Все' || row.category === category) &&
    [row.title, row.place, row.note].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = edit?.id || crypto.randomUUID();
    const selectedCategory = form.get('category') as Cat;
    const details: Record<string, string | number | boolean | string[]> = {};
    for (const key of Object.keys(emptyDetails)) {
      const value = form.get(key);
      if (value !== null && String(value).trim() !== '') details[key] = ['geese','ducks','catchWeight','nights','distance','daysOutdoors'].includes(key) ? Number(value) : String(value);
    }
    const timeline: Outing['timeline'] = [];
    const participants = String(form.get('participants') || '').split(',').map(v => v.trim()).filter(Boolean);
    const row: Outing = {
      id, title: String(form.get('title')), category: selectedCategory,
      createdAt: edit?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
      date: String(form.get('date')), time: '',
      place: String(form.get('place') || ''),
      coordinates: form.get('lat') && form.get('lng') ? { lat: Number(form.get('lat')), lng: Number(form.get('lng')) } : edit?.coordinates,
      participants, weather: String(form.get('weather') || ''), timeline,
      note: String(form.get('note') || ''), impressions: '', conclusion: '',
      mediaIds: [...(edit?.mediaIds ?? [])], favorite: edit?.favorite ?? false,
      details,
    };
    const newlySaved: string[] = [];
    for (const file of files) {
      const item: MediaItem = {
        id: crypto.randomUUID(), outingId: id, name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        mimeType: file.type, size: file.size, createdAt: new Date().toISOString(),
        blob: file, uploadState: 'local',
      };
      await saveMedia(item);
      row.mediaIds.push(item.id);
      newlySaved.push(item.id);
    }
    const coverChoice = String(form.get('coverChoice') || '');
    if (coverChoice.startsWith('new:')) {
      const selectedIndex = Number(coverChoice.slice(4));
      const selectedId = newlySaved[selectedIndex];
      if (selectedId) row.coverMediaId = selectedId;
    } else if (coverChoice) row.coverMediaId = coverChoice;
    else if (edit?.coverMediaId) row.coverMediaId = edit.coverMediaId;
    else if (newlySaved.length) row.coverMediaId = newlySaved[0];
    await put(row);
    setFiles([]); setModal(false); setEdit(null); await refresh(); setPage('Выезды');
  }

  async function toggleFavorite(row: Outing) { await put({ ...row, favorite: !row.favorite }); await refresh(); setReport({ ...row, favorite: !row.favorite }); }
  async function removeOuting(row: Outing) { if (!confirm('Переместить выезд в корзину? Его можно восстановить в течение 30 дней.')) return; await softDelete(row.id); setReport(null); await refresh(); }

  function openNew() { setEdit(null); setFiles([]); setModal(true); }
  function openEdit(row: Outing) { setEdit(row); setFiles([]); setModal(true); }

  function renderRecent(items: Outing[]) {
    if (!items.length) return <div className="recent-empty"><span>✧</span><div><b>Первое приключение ещё впереди</b><small>Добавь выезд — здесь появится его фотография и история.</small></div><button className="outline-button" onClick={openNew}>Добавить</button></div>;
    return <div className="recent-list">{items.map(row => <button className="recent-line" key={row.id} onClick={() => setReport(row)}>
      <div className="recent-photo" style={{backgroundImage:`linear-gradient(0deg,#071a13aa,transparent 75%),url(${coverUrls[row.id] || pics[row.category]})`}} />
      <div className="recent-copy"><small>{row.category} · {row.date}</small><b>{row.title || 'Выезд без названия'}</b><span className="recent-place">⌖ {row.place || 'Место не указано'}</span></div><i>›</i>
    </button>)}</div>;
  }

  function renderRows(items: Outing[]) {
    if (!items.length) return <div className="empty-state"><div className="empty-landscape">✧</div><h3>Твои приключения начнутся здесь</h3><p>Сохраняй поездки, встречи с природой и важные моменты.</p><button className="gold-button" onClick={openNew}>＋ Добавить первый выезд</button></div>;
    return <div className="outing-list">{items.map(row => <article className="outing-row" key={row.id}>
      <div className="outing-thumb" style={{ backgroundImage: `linear-gradient(0deg,#071a13aa,#071a1300),url(${coverUrls[row.id] || pics[row.category]})` }} />
      <div className="outing-info"><small>{row.category} <span>·</span> {row.date}</small><h3>{row.title}</h3><p>{row.place || 'Место не указано'}</p></div>
      <div className="outing-result">{row.note || 'Открыть отчёт'}</div>
      <button className="outline-button" onClick={() => setReport(row)}>Открыть ↗</button>
    </article>)}</div>;
  }


  const reportView = report && <div className="modal-shade" onClick={e => { if (e.target === e.currentTarget) setReport(null); }}>
    <section className="report-modal">
      <div className="modal-head"><div><small>{report.category.toUpperCase()} · {report.date}</small><h2>{report.title}</h2><p className="report-place">{report.place || 'Место не указано'}</p></div><button className="close-button" onClick={() => setReport(null)}>×</button></div>
      <div className="report-actions"><button className="outline-button" onClick={() => toggleFavorite(report)}>{report.favorite ? '★ В избранном' : '☆ В избранное'}</button><button className="outline-button" onClick={() => { setEdit(report); setReport(null); setModal(true); }}>Редактировать</button><button className="danger-button" onClick={() => removeOuting(report)}>В корзину</button></div>
      {reportMedia.length > 0 && <div className="report-gallery">{reportMedia.map(item => item.blob ? <div className="report-media" key={item.id}>{item.type === 'image' ? <img src={URL.createObjectURL(item.blob)} alt={item.name}/> : <video src={URL.createObjectURL(item.blob)} controls />}</div> : null)}</div>}
      {report.weather && <div className="report-block"><h3>Погода и условия</h3><p>{report.weather}</p></div>}
      {report.participants.length > 0 && <div className="report-block"><h3>Участники</h3><p>{report.participants.join(', ')}</p></div>}
      {Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').length > 0 && <div className="report-block"><h3>Детали выезда</h3><div className="detail-list">{Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').map(([k,v]) => <div className="detail-row" key={k}><b>{{geese:'Добыто гусей',ducks:'Добыто уток',otherGame:'Другая дичь',catchWeight:'Вес улова',fishSpecies:'Виды рыбы',fishQuantities:'Количество рыбы',lures:'Приманки',nights:'Ночёвок',conditions:'Условия',route:'Маршрут',visitedPlaces:'Посещённые места',distance:'Расстояние',daysOutdoors:'Дней на природе',duration:'Продолжительность'}[k] || k}:</b><span>{String(v)}</span></div>)}</div></div>}
      
      {report.note && <div className="report-block"><h3>Заметки</h3><p>{report.note}</p></div>}
      
      
      {reportMedia.length === 0 && <p className="muted-note">К этому выезду пока не добавлены фото и видео.</p>}
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
        <label>Пройденное расстояние, км<input name="distance" type="number" min="0" step="0.1" defaultValue={edit?.details.distance as number ?? ''} placeholder="Например, 12.5" /></label>
        <label>Участники (через запятую)<input name="participants" defaultValue={edit?.participants.join(', ') ?? ''} placeholder="Имена участников" /></label>
        <label>Погода и условия<input name="weather" defaultValue={edit?.weather ?? ''} placeholder="Температура, ветер, осадки, состояние воды..." /></label>
        <div className="form-pair"><label>Дней на природе<input name="daysOutdoors" type="number" min="0" step="1" defaultValue={edit?.details.daysOutdoors as number ?? 1} /></label></div>
      </div>
      <div className="form-section"><h3>Детали категории</h3>
        <div className="category-fields" data-category={edit?.category ?? 'Охота'}>
          <label>Категория выезда<select name="categoryDetail" defaultValue={edit?.category ?? 'Охота'} onChange={e => { const panel = e.currentTarget.closest('form')?.querySelector('.category-fields'); panel?.setAttribute('data-category', e.currentTarget.value); (e.currentTarget.form?.elements.namedItem('category') as HTMLSelectElement).value = e.currentTarget.value; }}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label>
          <div className="category-field-group" data-for="Охота"><div className="form-pair"><label>Добыто гусей<input name="geese" type="number" min="0" defaultValue={edit?.details.geese as number ?? ''} /></label><label>Добыто уток<input name="ducks" type="number" min="0" defaultValue={edit?.details.ducks as number ?? ''} /></label></div><label>Другая добыча / наблюдения<input name="otherGame" defaultValue={edit?.details.otherGame as string ?? ''} /></label></div>
          <div className="category-field-group" data-for="Рыбалка"><label>Общий вес улова, кг<input name="catchWeight" type="number" min="0" step="0.01" defaultValue={edit?.details.catchWeight as number ?? ''} /></label><label>Виды рыб<input name="fishSpecies" defaultValue={edit?.details.fishSpecies as string ?? ''} placeholder="Щука, окунь, лещ..." /></label><label>Количество по видам<input name="fishQuantities" defaultValue={edit?.details.fishQuantities as string ?? ''} /></label><label>Приманки и снасти<input name="lures" defaultValue={edit?.details.lures as string ?? ''} /></label></div>
          <div className="category-field-group" data-for="Кемпинг"><label>Количество ночёвок<input name="nights" type="number" min="0" defaultValue={edit?.details.nights as number ?? ''} /></label><label>Условия стоянки<input name="conditions" defaultValue={edit?.details.conditions as string ?? ''} placeholder="Погода, место лагеря, доступность воды..." /></label></div>
          <div className="category-field-group" data-for="Путешествия"><label>Маршрут<input name="route" defaultValue={edit?.details.route as string ?? ''} /></label><label>Посещённые места<input name="visitedPlaces" defaultValue={edit?.details.visitedPlaces as string ?? ''} /></label><label>Продолжительность<input name="duration" defaultValue={edit?.details.duration as string ?? ''} placeholder="Например, 3 дня" /></label></div>
        </div>
      </div>
      <div className="form-section"><h3>Заметки</h3><textarea name="note" rows={5} defaultValue={edit?.note ?? ''} placeholder="Запиши всё, что захочешь сохранить об этом выезде..." /></div>
      <div className="form-section"><h3>Фотографии и видео</h3>
        <label className="file-picker">＋ Добавить фото или видео<input type="file" accept="image/*,video/*" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} /></label>
        {files.length > 0 && <p className="file-summary">Новых файлов выбрано: {files.length} · {(files.reduce((n,f) => n + f.size, 0) / 1024 / 1024).toFixed(1)} МБ</p>}
        <div className="media-existing"><label>Главное фото выезда<select key={files.map(file => file.name).join('|')} name="coverChoice" defaultValue={edit?.coverMediaId ?? (files.findIndex(file => file.type.startsWith('image/')) >= 0 ? `new:${files.findIndex(file => file.type.startsWith('image/'))}` : '')}><option value="">Автоматически выбрать первое фото</option>{media.filter(item => item.type === 'image').map(item => <option value={item.id} key={item.id}>Уже добавлено: {item.name}</option>)}{files.map((file,index) => file.type.startsWith('image/') ? <option value={`new:${index}`} key={`new-${index}`}>Новое фото: {file.name}</option> : null)}</select></label></div>
        <small className="muted-note">Файлы сохраняются в локальном хранилище этого устройства. Облачная синхронизация между устройствами ещё не подключена.</small>
      </div>
      <div className="modal-actions"><button type="button" className="outline-button" onClick={() => { setModal(false); setEdit(null); }}>Отмена</button><button className="gold-button">Сохранить выезд</button></div>
    </form>
  </div>;

  return <div className="app-shell" style={{'--atlas-background-image': `url("${heroImage}")`} as React.CSSProperties}>
    <header className="topbar"><nav className="main-nav">{pages.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav><div className={online ? 'connection online' : 'connection offline'}><i />{online ? 'В сети' : 'Офлайн'}</div></header>
    <main className="page-content">
      {page === 'Главная' && <>
        <section className="dashboard-hero">
          <div className="hero-copy"><h1>Создавай жизнь,<br/>которую хочется вспоминать.</h1></div>
        </section>
        <section className="category-grid">{cats.map((cat,index) => <button key={cat} className={`category-tile category-${index}`} style={{backgroundImage:`linear-gradient(0deg,rgba(4,18,13,.92),rgba(4,18,13,.02) 80%),url(${pics[cat]})`}} onClick={()=>{setCategory(cat);setPage('Выезды')}}><strong>{cat}</strong><small>Выездов: {rows.filter(row=>row.category===cat).length}</small><span className="tile-arrow">›</span></button>)}</section>
        <section className="dashboard-section dashboard-stats-section">
          <div className="section-title"><div><h2>Мои приключения в цифрах</h2></div></div>
          {statsPeriodControls}
          <div className="stat-grid stat-grid-home">{stats.map(stat=><div className="stat-card stat-art-card" key={stat.label}><div className="stat-art-viewport"><img className="stat-art stat-art-full" src={`${assetBase}images/${({'Всего выездов':'Всего выездов_ горы и лес.png','Дней на природе':'Дни на природе у костра.png','Добыто гусей':'Эмблема с летящим гусем.png','Добыто уток':'Эмблема с летящей уткой и надписью.png','Пройденное расстояние':'Пройденное расстояние_ горный маршрут.png'} as Record<string,string>)[stat.label]}`} alt="" /></div><strong>{stat.value}</strong></div>)}</div>
        </section>
        <section className="dashboard-section recent-section"><div className="section-title"><div><h2>◷ Последние выезды</h2></div><button className="text-button" onClick={()=>{setCategory('Все');setPage('Выезды')}}>Все выезды ↗</button></div>{renderRecent([...rows].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4))}</section>

      </>}
      {page === 'Выезды' && <section className="section-page"><div className="section-title"><div><span className="eyebrow">ТВОИ ИСТОРИИ</span><h1>Выезды</h1></div><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div><div className="outing-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию и месту"/><div className="category-filters"><button className={category==='Все'?'active':''} onClick={()=>setCategory('Все')}>Все</button>{cats.map(cat=><button key={cat} className={category===cat?'active':''} onClick={()=>setCategory(cat)}>{cat}</button>)}</div></div>{renderRows(filtered)}</section>}
      {page === 'Карта' && <section className="section-page map-page">
        <div className="section-title"><div><span className="eyebrow">ГЕОГРАФИЯ ТВОИХ ПРИКЛЮЧЕНИЙ</span><h1>Карта приключений</h1></div><span className="map-count">{rows.filter(row=>row.coordinates).length} точек</span></div>
        <div className="map-toolbar"><input value={mapQuery} onChange={e=>setMapQuery(e.target.value)} placeholder="Найти озеро, населённый пункт или место"/><button className="gold-button" onClick={async()=>{if(!mapQuery.trim())return;setMapMessage('Ищем место…');try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(mapQuery));if(!response.ok)throw new Error();const result=await response.json();if(!result.length){setMapMessage('Место не найдено. Уточни запрос.');return;}const map=mapInstance.current;const lat=Number(result[0].lat),lng=Number(result[0].lon);setPickedCoordinates({lat,lng});if(map){map.flyTo({center:[lng,lat],zoom:13,essential:true});const marker=createMapMarkerElement('#d7b65d');marker.classList.add('atlas-map-marker-picked');const popup=document.createElement('div');popup.textContent=result[0].display_name;const pin=new (window as any).maplibregl.Marker({element:marker,anchor:'bottom'}).setLngLat([lng,lat]).setPopup(new (window as any).maplibregl.Popup({offset:22}).setDOMContent(popup)).addTo(map);if((map as any).atlasSearchMarker)(map as any).atlasSearchMarker.remove();(map as any).atlasSearchMarker=pin;pin.togglePopup();}setMapMessage('Место найдено и выбрано. Нажми «Создать выезд в этой точке», чтобы сохранить его.');}catch{setMapMessage('Поиск доступен при подключении к интернету.');}}}>Найти</button></div>
        <div className="category-filters map-filters"><button className={mapFilter==='Все'?'active':''} onClick={()=>setMapFilter('Все')}>Все</button>{cats.map(cat=><button key={cat} className={mapFilter===cat?'active':''} onClick={()=>setMapFilter(cat)}>{cat}</button>)}</div>
        {mapMessage && <p className="map-message">{mapMessage}</p>}
        {pickedCoordinates && <div className="map-picked"><span>Выбрано: {pickedCoordinates.lat.toFixed(6)}, {pickedCoordinates.lng.toFixed(6)}</span><button className="gold-button" onClick={()=>{setEdit(null);setFiles([]);setModal(true);}}>Создать выезд в этой точке</button><button className="outline-button" onClick={()=>setPickedCoordinates(null)}>Сбросить точку</button></div>}
        <div className="adventure-map" ref={mapElement}><div className="map-loading">Загружаем карту…</div></div>
        <p className="muted-note">На карте отображаются выезды с сохранёнными координатами. Чтобы добавить точку, укажи широту и долготу в полевом журнале. Поиск требует интернета; сохранённые точки доступны офлайн.</p>
        <div className="map-legend"><span>● Охота</span><span>● Рыбалка</span><span>● Кемпинг</span><span>● Путешествия</span></div>
      </section>}
      {page === 'Статистика' && <section className="section-page stats-page">
        <span className="eyebrow">АНАЛИТИКА ПРИКЛЮЧЕНИЙ</span><h1>Статистика</h1>
        {statsPeriodControls}
        <div className="stat-grid stats-kpi-grid">{stats.map(stat=>{const artwork:Record<string,string>={'Всего выездов':'Всего выездов_ горы и лес.png','Дней на природе':'Дни на природе у костра.png','Добыто гусей':'Эмблема с летящим гусем.png','Добыто уток':'Эмблема с летящей уткой и надписью.png','Пройденное расстояние':'Пройденное расстояние_ горный маршрут.png'};return <div className="stat-card stat-art-card stats-art-kpi" key={stat.label}><div className="stat-art-viewport"><img className="stat-art stat-art-full" src={`${assetBase}images/${artwork[stat.label]}`} alt={stat.label}/></div><strong>{stat.value}</strong><small>{stat.label}</small></div>;})}</div>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Распределение по категориям</h2><span>За выбранный период</span></div>
          <div className="category-chart-layout"><div className="category-donut" style={{background:categoryTotal?`conic-gradient(${categoryGradient})`:'conic-gradient(#555 0 100%)'}}><div><strong>{categoryTotal}</strong><small>выездов</small></div></div>
            <div className="category-legend">{categoryStats.map((item,index)=><div key={item.category}><i className={`legend-dot legend-${index}`}/><span>{item.category}</span><b>{item.outings}</b><small>{categoryTotal?Math.round(item.outings/categoryTotal*100):0}%</small></div>)}</div></div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Активность по месяцам</h2><span>{statsYear} год · выезды</span></div>
          <div className="monthly-chart">{monthlyStats.map(item=><div className="month-column" key={item.month}><strong>{item.outings}</strong><div className="month-bar-track"><i style={{height:`${item.outings?Math.max(4,item.outings/Math.max(1,...monthlyStats.map(x=>x.outings))*100):0}%`}} /></div><small>{item.label}</small></div>)}</div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Добыча по месяцам</h2><span>Охота · {statsYear} год</span></div>
          <div className="hunting-legend"><span><i className="goose-dot"/>Гуси</span><span><i className="duck-dot"/>Утки</span></div>
          <div className="hunting-chart">{huntingMonthlyStats.map(item=>{const max=Math.max(1,...huntingMonthlyStats.map(x=>x.geese+x.ducks));return <div className="hunting-column" key={item.month}><strong>{item.geese+item.ducks||''}</strong><div className="hunting-bar-track"><i className="goose-bar" style={{height:`${item.geese/max*100}%`}}/><i className="duck-bar" style={{height:`${item.ducks/max*100}%`}}/></div><small>{item.label}</small></div>})}</div>
          <div className="hunting-total-row"><span>Всего гусей: <b>{huntingMonthlyStats.reduce((sum,item)=>sum+item.geese,0)}</b></span><span>Всего уток: <b>{huntingMonthlyStats.reduce((sum,item)=>sum+item.ducks,0)}</b></span></div>
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Сравнение по годам</h2><span>Последние годы с записями</span></div>
          {yearlyStats.length ? <>
            <div className="year-line-chart"><svg viewBox="0 0 300 140" role="img" aria-label="Динамика количества выездов по годам"><line x1="18" y1="120" x2="282" y2="120"/><polyline points={yearlyStats.map((item,index)=>{const x=24+index*(252/Math.max(1,yearlyStats.length-1));const y=116-item.outings/Math.max(1,...yearlyStats.map(v=>v.outings))*88;return `${x},${y}`;}).join(' ')}/>{yearlyStats.map((item,index)=>{const x=24+index*(252/Math.max(1,yearlyStats.length-1));const y=116-item.outings/Math.max(1,...yearlyStats.map(v=>v.outings))*88;return <g key={item.year}><circle cx={x} cy={y} r="4"/><text x={x} y={Math.max(12,y-10)} textAnchor="middle">{item.outings}</text><text className="year-axis-label" x={x} y="137" textAnchor="middle">{String(item.year).slice(2)}</text></g>})}</svg><small>Количество выездов по годам</small></div>
            <div className="year-stats-list">{yearlyStats.map(item=><div className="year-stats-row" key={item.year}><b>{item.year}</b><span>{item.outings} выездов</span><span>{item.days} дней на природе</span></div>)}</div>
          </> : <p className="stats-empty">Пока нет сохранённых выездов.</p>}
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Охотничья статистика по годам</h2><span>Гуси и утки</span></div>
          {yearlyHuntingStats.length?<div className="year-stats-list">{yearlyHuntingStats.map(item=><div className="year-stats-row" key={item.year}><b>{item.year}</b><span>Гуси: {item.geese}</span><span>Утки: {item.ducks}</span></div>)}</div>:<p className="stats-empty">Пока нет охотничьих записей.</p>}
        </section>
        <section className="stats-panel"><div className="stats-panel-heading"><h2>Личные рекорды</h2><span>По сохранённым выездам</span></div>
          <div className="record-stats-grid">{recordStats.map(item=><article className="record-stat-card" key={item.title}><small>{item.title}</small><strong>{item.value}</strong><span>{item.detail}</span></article>)}</div>
        </section>
        {!periodRows.length && <p className="stats-empty">За выбранный период записей пока нет. Добавь выезд — и здесь появится статистика.</p>}
      </section>}
      {page === 'Настройки' && <section className="section-page"><span className="eyebrow">УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ</span><h1>Настройки</h1><div className="settings-grid">{[['Профиль и устройства','Профиль и подключение устройств по QR-коду'],['Синхронизация','Статус, очередь загрузки, Wi-Fi и мобильный интернет'],['Хранилище','Объём данных, локальные копии и корзина'],['Приватность','Доступ к данным и публикация отдельных выездов'],['Экспорт','PDF отчёты, годовая фотокнига и CSV']].map(([title,description])=><div className="setting-card" key={title}><h3>{title}</h3><p>{description}</p><small>Будет реализовано на следующих этапах</small></div>)}</div></section>}
    </main>
    
    {reportView}{modal&&form}
  </div>;
}
