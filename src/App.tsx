import { useEffect, useMemo, useRef, useState } from 'react';
import { all, put, softDelete, Cat, Outing, saveMedia, getMediaForOuting, MediaItem } from './db';

const cats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг', 'Путешествия'];
type Page = 'Главная' | 'Выезды' | 'Карта' | 'Статистика' | 'Рекорды' | 'Настройки';
const pages: Page[] = ['Главная', 'Выезды', 'Карта', 'Статистика', 'Рекорды', 'Настройки'];
const pics: Record<Cat, string> = {
  'Охота': '/images/IMG_20260316_165954_416.jpg',
  'Рыбалка': '/images/IMG_20241003_153019.jpg',
  'Кемпинг': '/images/IMG_20251023_084247.jpg',
  'Путешествия': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
};
const assetBase = window.location.pathname.includes('/atlas-adventures/') ? '/atlas-adventures/' : '/';
const heroImage = `${assetBase}atlas-lake-bg.jpg`;
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
      if (!w.L) {
        if (!document.querySelector('link[data-leaflet]')) {
          const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.leaflet='1';document.head.appendChild(link);
        }
        await new Promise<void>((resolve,reject)=>{
          const existing=document.querySelector('script[data-leaflet]') as HTMLScriptElement|null;
          if(existing){if(w.L)resolve();else existing.addEventListener('load',()=>resolve(),{once:true});return;}
          const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.dataset.leaflet='1';script.onload=()=>resolve();script.onerror=()=>reject();document.body.appendChild(script);
        });
      }
      if(cancelled||!mapElement.current||!w.L)return;
      if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null;}
      const map=w.L.map(mapElement.current).setView([53.9,27.56],6);mapInstance.current=map;
      const satellite=w.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',maxZoom:19});
      const street=w.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19});
      satellite.addTo(map);
      w.L.control.layers({'Спутник':satellite,'Схема':street},null,{collapsed:true}).addTo(map);
      const colors=['#d7b65d','#65a9d2','#75ad79','#b18bd0'];
      const makePin=(color:string)=>w.L.divIcon({className:'atlas-map-pin-wrap',iconSize:[34,44],iconAnchor:[17,42],popupAnchor:[0,-39],html:'<svg class="atlas-map-pin" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"><path d="M18 2C9.2 2 2 9.2 2 18c0 11.5 16 26 16 26s16-14.5 16-26C34 9.2 26.8 2 18 2Z" fill="'+color+'" stroke="#17191b" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="#fff8e8" stroke="#17191b" stroke-width="1.5"/></svg>'});
      (map as any).atlasPinIcon=makePin('#d7b65d');
      const visible=rows.filter(row=>row.coordinates&&(mapFilter==='Все'||row.category===mapFilter));
      visible.forEach(row=>{const index=cats.indexOf(row.category);const pin=w.L.marker([row.coordinates!.lat,row.coordinates!.lng],{icon:makePin(colors[index]||'#d7b65d')}).addTo(map);const photo=coverUrls[row.id];const safeTitle=String(row.title||'Выезд').replace(/[&<>"]/g,'');const safePlace=String(row.place||'Место не указано').replace(/[&<>"]/g,'');pin.bindPopup((photo?'<img src="'+photo+'" alt="" style="width:190px;height:105px;object-fit:cover;border-radius:6px;margin-bottom:6px"/><br>':'')+'<strong>'+safeTitle+'</strong><br>'+String(row.category).replace(/[&<>"]/g,'')+' · '+String(row.date)+'<br>'+safePlace);pin.on('click',()=>setReport(row));});
      map.on('click',(event:any)=>{const lat=Number(event.latlng.lat.toFixed(6));const lng=Number(event.latlng.lng.toFixed(6));setPickedCoordinates({lat,lng});setMapMessage('Выбрана точка: '+lat+', '+lng+'. Координаты подставятся в новую запись выезда.');w.L.popup().setLatLng(event.latlng).setContent('Выбранная точка<br>'+lat+', '+lng).openOn(map);});
      if(visible.length){const group=w.L.featureGroup(visible.map(row=>w.L.marker([row.coordinates!.lat,row.coordinates!.lng])));map.fitBounds(group.getBounds().pad(.18),{maxZoom:11});}
      setTimeout(()=>map.invalidateSize(),100);
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

  const stats = useMemo(() => {
    const now = new Date();
    const periodRows = rows.filter(row => {
      if (statsPeriod === 'all') return true;
      const date = new Date(`${row.date}T12:00:00`);
      return statsPeriod === 'year' ? date.getFullYear() === now.getFullYear()
        : date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
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
  }, [rows, statsPeriod]);

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
      {Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').length > 0 && <div className="report-block"><h3>Детали выезда</h3><div className="detail-chips">{Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').map(([k,v]) => <span key={k}><b>{k}:</b> {String(v)}</span>)}</div></div>}
      
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

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setPage('Главная')} aria-label="На главную"><span className="brand-mark">♠</span><span className="brand-name">Атлас<br/>приключений</span></button><nav className="main-nav">{pages.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav><div className={online ? 'connection online' : 'connection offline'}><i />{online ? 'В сети' : 'Офлайн'}</div></header>
    <main className="page-content">
      {page === 'Главная' && <>
        <section className="dashboard-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,22,16,.94) 0%,rgba(5,22,16,.68) 43%,rgba(5,22,16,.08) 100%),url(${heroImage})` }}>
          <div className="hero-copy"><h1>Создавай жизнь,<br/>которую хочется вспоминать.</h1></div>
        </section>
        <section className="category-grid">{cats.map((cat,index) => <button key={cat} className={`category-tile category-${index}`} style={{backgroundImage:`linear-gradient(0deg,rgba(4,18,13,.92),rgba(4,18,13,.02) 80%),url(${pics[cat]})`}} onClick={()=>{setCategory(cat);setPage('Выезды')}}><strong>{cat}</strong><small>Выездов: {rows.filter(row=>row.category===cat).length}</small><span className="tile-arrow">›</span></button>)}</section>
        <section className="dashboard-section">
          <div className="section-title"><div><h2>Мои приключения в цифрах</h2></div></div>
          <div className="stats-period" role="group" aria-label="Период статистики"><button className={statsPeriod==='all'?'active':''} onClick={()=>setStatsPeriod('all')}>Всё время</button><button className={statsPeriod==='year'?'active':''} onClick={()=>setStatsPeriod('year')}>Год</button><button className={statsPeriod==='month'?'active':''} onClick={()=>setStatsPeriod('month')}>Месяц</button></div>
          <div className="stat-grid stat-grid-home">{stats.map(stat=><div className="stat-card" key={stat.label}><img className="stat-art" src={`/images/${({'Всего выездов':'Всего выездов_ горы и лес.png','Дней на природе':'Дни на природе у костра.png','Добыто гусей':'Эмблема с летящим гусем.png','Добыто уток':'Эмблема с летящей уткой и надписью.png','Пройденное расстояние':'Пройденное расстояние_ горный маршрут.png'} as Record<string,string>)[stat.label]}`} alt="" /><strong>{stat.value}</strong></div>)}</div>
        </section>
        <section className="dashboard-section recent-section"><div className="section-title"><div><h2>◷ Последние выезды</h2></div><button className="text-button" onClick={()=>{setCategory('Все');setPage('Выезды')}}>Все выезды ↗</button></div>{renderRecent([...rows].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4))}</section>

      </>}
      {page === 'Выезды' && <section className="section-page"><div className="section-title"><div><span className="eyebrow">ТВОИ ИСТОРИИ</span><h1>Выезды</h1></div><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div><div className="outing-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию и месту"/><div className="category-filters"><button className={category==='Все'?'active':''} onClick={()=>setCategory('Все')}>Все</button>{cats.map(cat=><button key={cat} className={category===cat?'active':''} onClick={()=>setCategory(cat)}>{cat}</button>)}</div></div>{renderRows(filtered)}</section>}
      {page === 'Карта' && <section className="section-page map-page">
        <div className="section-title"><div><span className="eyebrow">ГЕОГРАФИЯ ТВОИХ ПРИКЛЮЧЕНИЙ</span><h1>Карта приключений</h1></div><span className="map-count">{rows.filter(row=>row.coordinates).length} точек</span></div>
        <div className="map-toolbar"><input value={mapQuery} onChange={e=>setMapQuery(e.target.value)} placeholder="Найти озеро, населённый пункт или место"/><button className="gold-button" onClick={async()=>{if(!mapQuery.trim())return;setMapMessage('Ищем место…');try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(mapQuery));if(!response.ok)throw new Error();const result=await response.json();if(!result.length){setMapMessage('Место не найдено. Уточни запрос.');return;}const map=mapInstance.current;const lat=Number(result[0].lat),lng=Number(result[0].lon);setPickedCoordinates({lat,lng});if(map){map.setView([lat,lng],13);(window as any).L.marker([lat,lng],{icon:(map as any).atlasPinIcon||(window as any).L.divIcon({className:'atlas-map-pin-wrap',iconSize:[34,44],iconAnchor:[17,42],popupAnchor:[0,-39],html:'<svg class="atlas-map-pin" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"><path d="M18 2C9.2 2 2 9.2 2 18c0 11.5 16 26 16 26s16-14.5 16-26C34 9.2 26.8 2 18 2Z" fill="#d7b65d" stroke="#17191b" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="#fff8e8" stroke="#17191b" stroke-width="1.5"/></svg>'})}).addTo(map).bindPopup(result[0].display_name).openPopup();}setMapMessage('Место найдено и выбрано. Нажми «Создать выезд в этой точке», чтобы сохранить его.');}catch{setMapMessage('Поиск доступен при подключении к интернету.');}}}>Найти</button></div>
        <div className="category-filters map-filters"><button className={mapFilter==='Все'?'active':''} onClick={()=>setMapFilter('Все')}>Все</button>{cats.map(cat=><button key={cat} className={mapFilter===cat?'active':''} onClick={()=>setMapFilter(cat)}>{cat}</button>)}</div>
        {mapMessage && <p className="map-message">{mapMessage}</p>}
        {pickedCoordinates && <div className="map-picked"><span>Выбрано: {pickedCoordinates.lat.toFixed(6)}, {pickedCoordinates.lng.toFixed(6)}</span><button className="gold-button" onClick={()=>{setEdit(null);setFiles([]);setModal(true);}}>Создать выезд в этой точке</button><button className="outline-button" onClick={()=>setPickedCoordinates(null)}>Сбросить точку</button></div>}
        <div className="adventure-map" ref={mapElement}><div className="map-loading">Загружаем карту…</div></div>
        <p className="muted-note">На карте отображаются выезды с сохранёнными координатами. Чтобы добавить точку, укажи широту и долготу в полевом журнале. Поиск требует интернета; сохранённые точки доступны офлайн.</p>
        <div className="map-legend"><span>● Охота</span><span>● Рыбалка</span><span>● Кемпинг</span><span>● Путешествия</span></div>
      </section>}
      {page === 'Статистика' && <section className="section-page"><span className="eyebrow">АНАЛИТИКА ПРИКЛЮЧЕНИЙ</span><h1>Статистика</h1><div className="stat-grid">{stats.map(stat=><div className="stat-card" key={stat.label}><span className="stat-symbol">{stat.symbol}</span><div><strong>{stat.value}</strong><small>{stat.label}</small></div></div>)}</div><div className="coming-panel">Графики активности, распределение по категориям и сравнение по годам будут подключены на этапе статистики.</div></section>}
      {page === 'Рекорды' && <section className="section-page"><span className="eyebrow">ЛУЧШИЕ РЕЗУЛЬТАТЫ</span><h1>Рекорды</h1><div className="record-grid">{[['Охота','Лучший результат за один выезд'],['Рыбалка','Максимальный вес улова'],['Кемпинг','Самое продолжительное пребывание'],['Путешествия','Самый длинный маршрут']].map(([name,description])=><div className="record-card" key={name}><span>✧</span><h2>{name}</h2><p>{description}</p><small>Пока нет данных</small></div>)}</div></section>}
      {page === 'Настройки' && <section className="section-page"><span className="eyebrow">УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ</span><h1>Настройки</h1><div className="settings-grid">{[['Профиль и устройства','Профиль и подключение устройств по QR-коду'],['Синхронизация','Статус, очередь загрузки, Wi-Fi и мобильный интернет'],['Хранилище','Объём данных, локальные копии и корзина'],['Приватность','Доступ к данным и публикация отдельных выездов'],['Экспорт','PDF отчёты, годовая фотокнига и CSV']].map(([title,description])=><div className="setting-card" key={title}><h3>{title}</h3><p>{description}</p><small>Будет реализовано на следующих этапах</small></div>)}</div></section>}
    </main>
    <footer className="app-footer"><span>АТЛАС ПРИКЛЮЧЕНИЙ</span><small>Личная история больших и маленьких приключений</small></footer>
    {reportView}{modal&&form}
  </div>;
}
