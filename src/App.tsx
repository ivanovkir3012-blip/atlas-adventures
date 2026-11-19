import { useEffect, useMemo, useState } from 'react';
import { all, put, softDelete, Cat, Outing, saveMedia, getMediaForOuting, MediaItem } from './db';

const cats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг', 'Путешествия'];
type Page = 'Главная' | 'Выезды' | 'Статистика' | 'Рекорды' | 'Настройки';
const pages: Page[] = ['Главная', 'Выезды', 'Статистика', 'Рекорды', 'Настройки'];
const pics: Record<Cat, string> = {
  'Охота': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=85',
  'Рыбалка': 'https://images.unsplash.com/photo-1638238268221-a9a01e04747e?auto=format&fit=crop&w=1400&q=88',
  'Кемпинг': 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85',
  'Путешествия': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
};
const heroImage = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2000&q=90';
const emptyDetails = { geese: '', ducks: '', otherGame: '', result: '', catchWeight: '', fishSpecies: '', fishQuantities: '', lures: '', nights: '', conditions: '', route: '', visitedPlaces: '', distance: '', duration: '' };

export default function App() {
  const [page, setPage] = useState<Page>('Главная');
  const [rows, setRows] = useState<Outing[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Outing | null>(null);
  const [report, setReport] = useState<Outing | null>(null);
  const [reportMedia, setReportMedia] = useState<MediaItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [online, setOnline] = useState(navigator.onLine);
  const [showMap, setShowMap] = useState(false);
  const refresh = () => all().then(setRows);

  useEffect(() => {
    refresh();
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!report) { setReportMedia([]); return; }
    getMediaForOuting(report.id).then(setReportMedia);
  }, [report]);

  useEffect(() => {
    if (!edit) { setMedia([]); return; }
    getMediaForOuting(edit.id).then(setMedia);
  }, [edit]);

  const stats = useMemo(() => {
    const days = new Set(rows.map(row => row.date).filter(Boolean)).size;
    const geese = rows.reduce((sum, row) => sum + Number(row.details?.geese ?? 0), 0);
    const ducks = rows.reduce((sum, row) => sum + Number(row.details?.ducks ?? 0), 0);
    return [
      { label: 'Всего выездов', value: rows.length, mark: '01' },
      { label: 'Дней на природе', value: days, mark: '02' },
      { label: 'Добыто гусей', value: geese, mark: '03' },
      { label: 'Добыто уток', value: ducks, mark: '04' },
    ];
  }, [rows]);

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
      if (value !== null && String(value).trim() !== '') details[key] = ['geese','ducks','catchWeight','nights','distance'].includes(key) ? Number(value) : String(value);
    }
    const timelineText = String(form.get('timeline') || '');
    const timeline = timelineText.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
      const match = line.match(/^(\d{1,2}:\d{2})\s*[-–—:]\s*(.*)$/);
      return { id: crypto.randomUUID(), ...(match ? { time: match[1], title: match[2] } : { title: line }), description: '' };
    });
    const lat = String(form.get('lat') || '').trim();
    const lng = String(form.get('lng') || '').trim();
    const participants = String(form.get('participants') || '').split(',').map(v => v.trim()).filter(Boolean);
    const row: Outing = {
      id, title: String(form.get('title')), category: selectedCategory,
      createdAt: edit?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
      date: String(form.get('date')), time: String(form.get('time') || ''),
      place: String(form.get('place') || ''),
      ...(lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { coordinates: { lat: Number(lat), lng: Number(lng) } } : {}),
      participants, weather: String(form.get('weather') || ''), timeline,
      note: String(form.get('note') || ''), impressions: String(form.get('impressions') || ''),
      conclusion: String(form.get('conclusion') || ''),
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
    const cover = String(form.get('coverMediaId') || '');
    if (cover) row.coverMediaId = cover;
    else if (!edit?.coverMediaId && newlySaved.length) row.coverMediaId = newlySaved[0];
    await put(row);
    setFiles([]); setModal(false); setEdit(null); await refresh(); setPage('Выезды');
  }

  async function toggleFavorite(row: Outing) { await put({ ...row, favorite: !row.favorite }); await refresh(); setReport({ ...row, favorite: !row.favorite }); }
  async function removeOuting(row: Outing) { if (!confirm('Переместить выезд в корзину? Его можно восстановить в течение 30 дней.')) return; await softDelete(row.id); setReport(null); await refresh(); }

  function openNew() { setEdit(null); setFiles([]); setModal(true); }
  function openEdit(row: Outing) { setEdit(row); setFiles([]); setModal(true); }

  function renderRecent(items: Outing[]) {
    if (!items.length) return <div className="recent-empty"><span>✧</span><div><b>Первое приключение ещё впереди</b><small>Добавь выезд — здесь появится его фотография и история.</small></div><button className="outline-button" onClick={openNew}>Добавить</button></div>;
    return <div className="recent-strip">{items.map(row => <button className="recent-card" key={row.id} onClick={() => setReport(row)}>
      <div className="recent-photo" style={{backgroundImage:`linear-gradient(0deg,#071a13cc,transparent 75%),url(${pics[row.category]})`}} />
      <div className="recent-copy"><small>{row.category} · {row.date}</small><b>{row.title}</b><span>{row.place || 'Место не указано'}</span></div><i>↗</i>
    </button>)}</div>;
  }

  function renderRows(items: Outing[]) {
    if (!items.length) return <div className="empty-state"><div className="empty-landscape">✧</div><h3>Твои приключения начнутся здесь</h3><p>Сохраняй поездки, встречи с природой и важные моменты.</p><button className="gold-button" onClick={openNew}>＋ Добавить первый выезд</button></div>;
    return <div className="outing-list">{items.map(row => <article className="outing-row" key={row.id}>
      <div className="outing-thumb" style={{ backgroundImage: `linear-gradient(0deg,#071a13aa,#071a1300),url(${pics[row.category]})` }} />
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
      {Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').length > 0 && <div className="report-block"><h3>Результаты выезда</h3><div className="detail-chips">{Object.entries(report.details).filter(([,v]) => String(v).trim() !== '').map(([k,v]) => <span key={k}><b>{k}:</b> {String(v)}</span>)}</div></div>}
      {report.timeline.length > 0 && <div className="report-block"><h3>Хронология</h3><div className="timeline-list">{report.timeline.map(item => <div key={item.id}><time>{item.time || '•'}</time><p>{item.title}</p></div>)}</div></div>}
      {report.note && <div className="report-block"><h3>Заметки</h3><p>{report.note}</p></div>}
      {report.impressions && <div className="report-block"><h3>Впечатления</h3><p>{report.impressions}</p></div>}
      {report.conclusion && <div className="report-block"><h3>Выводы на будущее</h3><p>{report.conclusion}</p></div>}
      {reportMedia.length === 0 && <p className="muted-note">К этому выезду пока не добавлены фото и видео.</p>}
    </section>
  </div>;

  const form = <div className="modal-shade" onClick={event => { if (event.target === event.currentTarget) { setModal(false); setEdit(null); } }}>
    <form className="outing-modal wide-modal" onSubmit={save}>
      <div className="modal-head"><div><small>ЛИЧНЫЙ ПОЛЕВОЙ ЖУРНАЛ</small><h2>{edit ? 'Редактировать выезд' : 'Добавить выезд'}</h2></div><button type="button" className="close-button" onClick={() => { setModal(false); setEdit(null); }}>×</button></div>
      <div className="form-section"><h3>Основная информация</h3>
        <label>Название выезда<input name="title" required defaultValue={edit?.title ?? ''} placeholder="Например, Осенний выезд на озеро" /></label>
        <div className="form-pair"><label>Категория<select name="category" defaultValue={edit?.category ?? (category === 'Все' ? 'Охота' : category)}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label><label>Дата<input name="date" type="date" required defaultValue={edit?.date ?? new Date().toISOString().slice(0,10)} /></label><label>Время<input name="time" type="time" defaultValue={edit?.time ?? ''} /></label></div>
        <label>Место<input name="place" defaultValue={edit?.place ?? ''} placeholder="Название места или населённого пункта" /></label>
        <div className="form-pair"><label>Широта<input name="lat" type="number" step="any" defaultValue={edit?.coordinates?.lat ?? ''} placeholder="Например, 53.9" /></label><label>Долгота<input name="lng" type="number" step="any" defaultValue={edit?.coordinates?.lng ?? ''} placeholder="Например, 27.5" /></label></div>
        <label>Участники (через запятую)<input name="participants" defaultValue={edit?.participants.join(', ') ?? ''} placeholder="Имена участников" /></label>
        <label>Погода и условия<input name="weather" defaultValue={edit?.weather ?? ''} placeholder="Температура, ветер, осадки, состояние воды..." /></label>
      </div>
      <div className="form-section"><h3>Детали категории</h3>
        <div className="category-fields" data-category={edit?.category ?? 'Охота'}>
          <label>Категория выезда<select name="categoryDetail" defaultValue={edit?.category ?? 'Охота'} onChange={e => { const panel = e.currentTarget.closest('form')?.querySelector('.category-fields'); panel?.setAttribute('data-category', e.currentTarget.value); (e.currentTarget.form?.elements.namedItem('category') as HTMLSelectElement).value = e.currentTarget.value; }}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label>
          <div className="category-field-group" data-for="Охота"><div className="form-pair"><label>Добыто гусей<input name="geese" type="number" min="0" defaultValue={edit?.details.geese as number ?? ''} /></label><label>Добыто уток<input name="ducks" type="number" min="0" defaultValue={edit?.details.ducks as number ?? ''} /></label></div><label>Другая добыча / наблюдения<input name="otherGame" defaultValue={edit?.details.otherGame as string ?? ''} /></label><label>Результат охоты<input name="result" defaultValue={edit?.details.result as string ?? ''} placeholder="Кратко об итогах" /></label></div>
          <div className="category-field-group" data-for="Рыбалка"><label>Общий вес улова, кг<input name="catchWeight" type="number" min="0" step="0.01" defaultValue={edit?.details.catchWeight as number ?? ''} /></label><label>Виды рыб<input name="fishSpecies" defaultValue={edit?.details.fishSpecies as string ?? ''} placeholder="Щука, окунь, лещ..." /></label><label>Количество по видам<input name="fishQuantities" defaultValue={edit?.details.fishQuantities as string ?? ''} /></label><label>Приманки и снасти<input name="lures" defaultValue={edit?.details.lures as string ?? ''} /></label></div>
          <div className="category-field-group" data-for="Кемпинг"><label>Количество ночёвок<input name="nights" type="number" min="0" defaultValue={edit?.details.nights as number ?? ''} /></label><label>Условия стоянки<input name="conditions" defaultValue={edit?.details.conditions as string ?? ''} placeholder="Погода, место лагеря, доступность воды..." /></label></div>
          <div className="category-field-group" data-for="Путешествия"><label>Маршрут<input name="route" defaultValue={edit?.details.route as string ?? ''} /></label><label>Посещённые места<input name="visitedPlaces" defaultValue={edit?.details.visitedPlaces as string ?? ''} /></label><div className="form-pair"><label>Дистанция, км<input name="distance" type="number" min="0" step="0.1" defaultValue={edit?.details.distance as number ?? ''} /></label><label>Продолжительность<input name="duration" defaultValue={edit?.details.duration as string ?? ''} placeholder="Например, 3 дня" /></label></div></div>
        </div>
      </div>
      <div className="form-section"><h3>Ход выезда и впечатления</h3>
        <label>Хронология (каждое событие с новой строки; время можно указать в начале)<textarea name="timeline" rows={4} defaultValue={edit?.timeline.map(item => item.time ? `${item.time} — ${item.title}` : item.title).join('\n') ?? ''} placeholder={'06:30 — Прибыли на место\n08:15 — Начало маршрута'} /></label>
        <label>Краткие заметки<textarea name="note" rows={2} defaultValue={edit?.note ?? ''} placeholder="Что произошло?" /></label>
        <label>Впечатления<textarea name="impressions" rows={3} defaultValue={edit?.impressions ?? ''} /></label>
        <label>Выводы на будущее<textarea name="conclusion" rows={3} defaultValue={edit?.conclusion ?? ''} /></label>
      </div>
      <div className="form-section"><h3>Фотографии и видео</h3>
        <label className="file-picker">＋ Добавить фото или видео<input type="file" accept="image/*,video/*" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} /></label>
        {files.length > 0 && <p className="file-summary">Новых файлов выбрано: {files.length} · {(files.reduce((n,f) => n + f.size, 0) / 1024 / 1024).toFixed(1)} МБ</p>}
        {media.length > 0 && <div className="media-existing"><span>Уже добавлено: {media.length}</span><select name="coverMediaId" defaultValue={edit?.coverMediaId ?? ''}><option value="">Сохранить текущую обложку</option>{media.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>}
        <small className="muted-note">Файлы сохраняются в локальном хранилище этого устройства. Облачная синхронизация между устройствами ещё не подключена.</small>
      </div>
      <div className="modal-actions"><button type="button" className="outline-button" onClick={() => { setModal(false); setEdit(null); }}>Отмена</button><button className="gold-button">Сохранить выезд</button></div>
    </form>
  </div>;

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setPage('Главная')} aria-label="На главную"><span className="brand-mark">✧</span><span className="brand-name">АТЛАС ПРИКЛЮЧЕНИЙ<small>ЛИЧНЫЙ ПОЛЕВОЙ ЖУРНАЛ</small></span></button><nav className="main-nav">{pages.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav><div className={online ? 'connection online' : 'connection offline'}><i />{online ? 'В сети' : 'Офлайн'}</div></header>
    <main className="page-content">
      {page === 'Главная' && <>
        <section className="dashboard-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,22,16,.94) 0%,rgba(5,22,16,.68) 43%,rgba(5,22,16,.08) 100%),url(${heroImage})` }}>
          <div className="hero-copy"><span className="eyebrow">ТВОЯ ИСТОРИЯ ПРИКЛЮЧЕНИЙ</span><h1>Мой дневник<br/>приключений</h1><p>Места, маршруты и впечатления, которые хочется сохранить.</p><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div><div className="hero-caption">ПРИРОДА · СВОБОДА · ПУТЕШЕСТВИЯ</div>
        </section>
        <section className="category-grid">{cats.map((cat,index) => <button key={cat} className="category-tile" style={{backgroundImage:`linear-gradient(0deg,rgba(4,18,13,.88),rgba(4,18,13,.02) 82%),url(${pics[cat]})`}} onClick={()=>{setCategory(cat);setPage('Выезды')}}><span className="tile-index">0{index+1}</span><strong>{cat}</strong><small>СМОТРЕТЬ ВЫЕЗДЫ ↗</small></button>)}</section>
        <section className="dashboard-section">
          <div className="section-title"><div><span className="eyebrow">ТВОЙ ПУТЬ В ЦИФРАХ</span><h2>Мои приключения</h2></div><button className="text-button" onClick={()=>setPage('Статистика')}>Подробная статистика ↗</button></div>
          <div className="stat-grid stat-grid-home">{stats.map((stat,index)=><div className="stat-card" key={stat.label}><div className={`stat-emblem emblem-${index+1}`} aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27"/><circle cx="32" cy="32" r="22"/>{index===0?<><path d="M13 38h38l-4-12H20zM19 26l5-8h17l5 8M18 39v7m28-7v7M22 46h20"/><circle cx="23" cy="39" r="3"/><circle cx="41" cy="39" r="3"/></>:index===1?<><path d="M12 39 32 16l20 23M17 39h30M23 39v7h18v-7M32 16v23"/><path d="M30 49q-5-5 0-9 5 4 0 9m5 0q-3-4 1-7 4 4-1 7"/></>:index===2?<><path d="M11 36q12-17 25-7 8-8 17-4-9 1-13 8 8 1 13 7-14-3-22-1-9 2-20-3z"/><path d="m31 29 3-7 3 7M18 43l-3 4m30-4 4 4"/></>:<><path d="M11 35q9-9 20-4 11-5 22 4-10 8-21 2-11 6-21-2z"/><path d="M28 32q4-5 8 0m-4 5v8m-5 0h10M18 34l-4-5m32 5 4-5"/></>}</svg></div><div><strong>{stat.value}</strong><small>{stat.label}</small></div></div>)}</div>
        </section>
        <section className="dashboard-section recent-section"><div className="section-title"><div><span className="eyebrow">ИЗ ПОСЛЕДНИХ ЗАПИСЕЙ</span><h2>Недавние выезды</h2></div><button className="text-button" onClick={()=>{setCategory('Все');setPage('Выезды')}}>Все выезды ↗</button></div>{renderRecent(rows.slice(0,4))}</section>
        <section className="dashboard-section map-preview"><div className="section-title"><div><span className="eyebrow">ГЕОГРАФИЯ ВПЕЧАТЛЕНИЙ</span><h2>Карта приключений</h2></div><button className="text-button" onClick={()=>setPage('Выезды')}>К выездам ↗</button></div><div className="map-placeholder map-home"><div className="map-lines"/><span className="map-pin">✧</span><p>{rows.some(row=>row.coordinates)?'Точки твоих приключений':'Здесь будут отмечены места твоих выездов'}</p><small>{rows.some(row=>row.coordinates)?'Карта с координатами выездов будет доступна в разделе «Выезды».':'Добавляй координаты в отчётах, чтобы собрать свою карту.'}</small><div className="map-compass">N<br/>✥</div></div></section>
      </>}
      {page === 'Выезды' && <section className="section-page"><div className="section-title"><div><span className="eyebrow">ТВОИ ИСТОРИИ</span><h1>Выезды</h1></div><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div><div className="outing-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию и месту"/><div className="category-filters"><button className={category==='Все'?'active':''} onClick={()=>setCategory('Все')}>Все</button>{cats.map(cat=><button key={cat} className={category===cat?'active':''} onClick={()=>setCategory(cat)}>{cat}</button>)}</div><button className="outline-button" onClick={()=>setShowMap(v=>!v)}>{showMap?'Скрыть карту':'Показать карту'}</button></div>{showMap&&<div className="map-placeholder outing-map"><div className="map-lines"/><span className="map-pin">✧</span><p>Карта выездов</p><small>Отображение точек появится после подключения картографического сервиса.</small></div>}{renderRows(filtered)}</section>}
      {page === 'Статистика' && <section className="section-page"><span className="eyebrow">АНАЛИТИКА ПРИКЛЮЧЕНИЙ</span><h1>Статистика</h1><div className="stat-grid">{stats.map(stat=><div className="stat-card" key={stat.label}><div className="stat-emblem"><span>{stat.mark}</span></div><div><strong>{stat.value}</strong><small>{stat.label}</small></div></div>)}</div><div className="coming-panel">Графики активности, распределение по категориям и сравнение по годам будут подключены на этапе статистики.</div></section>}
      {page === 'Рекорды' && <section className="section-page"><span className="eyebrow">ЛУЧШИЕ РЕЗУЛЬТАТЫ</span><h1>Рекорды</h1><div className="record-grid">{[['Охота','Лучший результат за один выезд'],['Рыбалка','Максимальный вес улова'],['Кемпинг','Самое продолжительное пребывание'],['Путешествия','Самый длинный маршрут']].map(([name,description])=><div className="record-card" key={name}><span>✧</span><h2>{name}</h2><p>{description}</p><small>Пока нет данных</small></div>)}</div></section>}
      {page === 'Настройки' && <section className="section-page"><span className="eyebrow">УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ</span><h1>Настройки</h1><div className="settings-grid">{[['Профиль и устройства','Профиль и подключение устройств по QR-коду'],['Синхронизация','Статус, очередь загрузки, Wi-Fi и мобильный интернет'],['Хранилище','Объём данных, локальные копии и корзина'],['Приватность','Доступ к данным и публикация отдельных выездов'],['Экспорт','PDF отчёты, годовая фотокнига и CSV']].map(([title,description])=><div className="setting-card" key={title}><h3>{title}</h3><p>{description}</p><small>Будет реализовано на следующих этапах</small></div>)}</div></section>}
    </main>
    <footer className="app-footer"><span>АТЛАС ПРИКЛЮЧЕНИЙ</span><small>Личная история больших и маленьких приключений</small></footer>
    {reportView}{modal&&form}
  </div>;
}
