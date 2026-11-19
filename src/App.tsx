import { useEffect, useMemo, useState } from 'react';
import { all, put, del, Cat, Outing } from './db';

const cats: Cat[] = ['Охота', 'Рыбалка', 'Кемпинг', 'Путешествия'];
type Page = 'Главная' | 'Выезды' | 'Статистика' | 'Рекорды' | 'Настройки';
const pages: Page[] = ['Главная', 'Выезды', 'Статистика', 'Рекорды', 'Настройки'];
const pics: Record<Cat, string> = {
  'Охота': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=85',
  'Рыбалка': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
  'Кемпинг': 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85',
  'Путешествия': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
};
const heroImage = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2000&q=90';

export default function App() {
  const [page, setPage] = useState<Page>('Главная');
  const [rows, setRows] = useState<Outing[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Outing | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [online, setOnline] = useState(navigator.onLine);
  const refresh = () => all().then(setRows);

  useEffect(() => {
    refresh();
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);

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
    await put({
      id: edit?.id || crypto.randomUUID(),
      title: String(form.get('title')),
      category: form.get('category') as Cat,
      date: String(form.get('date')),
      place: String(form.get('place')),
      note: String(form.get('note')),
      participants: edit?.participants ?? [],
      timeline: edit?.timeline ?? [],
      mediaIds: edit?.mediaIds ?? [],
      favorite: edit?.favorite ?? false,
      details: edit?.details ?? {},
    });
    setModal(false);
    setEdit(null);
    await refresh();
    setPage('Выезды');
  }

  function openNew() {
    setEdit(null);
    setModal(true);
  }

  function renderRows(items: Outing[]) {
    if (!items.length) {
      return <div className="empty-state">
        <div className="empty-landscape">✧</div>
        <h3>Твои приключения начнутся здесь</h3>
        <p>Сохраняй поездки, встречи с природой и важные моменты.</p>
        <button className="gold-button" onClick={openNew}>＋ Добавить первый выезд</button>
      </div>;
    }
    return <div className="outing-list">{items.map(row => <article className="outing-row" key={row.id}>
      <div className="outing-thumb" style={{ backgroundImage: `linear-gradient(0deg,#071a13aa,#071a1300),url(${pics[row.category]})` }} />
      <div className="outing-info">
        <small>{row.category} <span>·</span> {row.date}</small>
        <h3>{row.title}</h3>
        <p>{row.place || 'Место не указано'}</p>
      </div>
      <div className="outing-result">{row.note || 'Открыть отчёт'}</div>
      <button className="outline-button" onClick={() => { setEdit(row); setModal(true); }}>Открыть ↗</button>
    </article>)}</div>;
  }

  const form = <div className="modal-shade" onClick={event => { if (event.target === event.currentTarget) setModal(false); }}>
    <form className="outing-modal" onSubmit={save}>
      <div className="modal-head"><div><small>НОВАЯ ЗАПИСЬ В АТЛАСЕ</small><h2>{edit ? 'Редактировать выезд' : 'Добавить выезд'}</h2></div><button type="button" className="close-button" onClick={() => setModal(false)}>×</button></div>
      <label>Название<input name="title" required defaultValue={edit?.title ?? ''} placeholder="Например, Осенний выезд на озеро" /></label>
      <div className="form-pair"><label>Категория<select name="category" defaultValue={edit?.category ?? 'Охота'}>{cats.map(cat => <option key={cat}>{cat}</option>)}</select></label><label>Дата<input name="date" type="date" required defaultValue={edit?.date ?? new Date().toISOString().slice(0, 10)} /></label></div>
      <label>Место<input name="place" defaultValue={edit?.place ?? ''} placeholder="Название места или населённого пункта" /></label>
      <label>Краткие заметки<textarea name="note" rows={3} defaultValue={edit?.note ?? ''} placeholder="Что запомнилось?" /></label>
      <div className="modal-actions"><button type="button" className="outline-button" onClick={() => setModal(false)}>Отмена</button><button className="gold-button">Сохранить выезд</button></div>
    </form>
  </div>;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('Главная')} aria-label="На главную"><span className="brand-mark">✧</span><span className="brand-name">АТЛАС ПРИКЛЮЧЕНИЙ<small>ЛИЧНЫЙ ПОЛЕВОЙ ЖУРНАЛ</small></span></button>
      <nav className="main-nav">{pages.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav>
      <div className={online ? 'connection online' : 'connection offline'}><i />{online ? 'В сети' : 'Офлайн'}</div>
    </header>

    <main className="page-content">
      {page === 'Главная' && <>
        <section className="dashboard-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,22,16,.96) 0%,rgba(5,22,16,.78) 42%,rgba(5,22,16,.12) 100%),url(${heroImage})` }}>
          <div className="hero-copy">
            <span className="eyebrow">ТВОЯ ИСТОРИЯ ПРИКЛЮЧЕНИЙ</span>
            <h1>Мой дневник<br/>приключений</h1>
            <p>Места, маршруты и впечатления, которые хочется сохранить.</p>
            <button className="gold-button" onClick={openNew}>＋ Добавить выезд</button>
          </div>
          <div className="hero-caption">ПРИРОДА · СВОБОДА · ПУТЕШЕСТВИЯ</div>
        </section>

        <section className="category-grid">
          {cats.map((cat, index) => <button key={cat} className="category-tile" style={{ backgroundImage: `linear-gradient(0deg,rgba(4,18,13,.9),rgba(4,18,13,.04) 80%),url(${pics[cat]})` }} onClick={() => { setCategory(cat); setPage('Выезды'); }}>
            <span className="tile-index">0{index + 1}</span><strong>{cat}</strong><small>СМОТРЕТЬ ВЫЕЗДЫ ↗</small>
          </button>)}
        </section>

        <section className="dashboard-section">
          <div className="section-title"><div><span className="eyebrow">ТВОЙ ПУТЬ В ЦИФРАХ</span><h2>Мои приключения</h2></div><button className="text-button" onClick={() => setPage('Статистика')}>Подробная статистика ↗</button></div>
          <div className="stat-grid">{stats.map(stat => <div className="stat-card" key={stat.label}>
            <div className="stat-emblem"><span>{stat.mark}</span></div><div><strong>{stat.value}</strong><small>{stat.label}</small></div>
          </div>)}</div>
        </section>

        <section className="dashboard-section">
          <div className="section-title"><div><span className="eyebrow">ИЗ ПОСЛЕДНИХ ЗАПИСЕЙ</span><h2>Недавние выезды</h2></div><button className="text-button" onClick={() => { setCategory('Все'); setPage('Выезды'); }}>Все выезды ↗</button></div>
          {renderRows(rows.slice(0, 4))}
        </section>

        <section className="dashboard-section map-preview">
          <div className="section-title"><div><span className="eyebrow">ГЕОГРАФИЯ ВПЕЧАТЛЕНИЙ</span><h2>Карта приключений</h2></div><button className="text-button" onClick={() => setPage('Выезды')}>К выездам ↗</button></div>
          <div className="map-placeholder"><div className="map-lines" /><span className="map-pin">✧</span><p>Здесь будут отмечены места твоих выездов</p><small>Карта появится после подключения картографического сервиса</small></div>
        </section>
      </>}

      {page === 'Выезды' && <section className="section-page">
        <div className="section-title"><div><span className="eyebrow">ТВОИ ИСТОРИИ</span><h1>Выезды</h1></div><button className="gold-button" onClick={openNew}>＋ Добавить выезд</button></div>
        <div className="outing-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по названию и месту" /><div className="category-filters"><button className={category === 'Все' ? 'active' : ''} onClick={() => setCategory('Все')}>Все</button>{cats.map(cat => <button key={cat} className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{cat}</button>)}</div><button className="outline-button" onClick={() => alert('Карта будет подключена на этапе картографии.')}>Показать карту</button></div>
        {renderRows(filtered)}
      </section>}

      {page === 'Статистика' && <section className="section-page"><span className="eyebrow">АНАЛИТИКА ПРИКЛЮЧЕНИЙ</span><h1>Статистика</h1><div className="stat-grid">{stats.map(stat => <div className="stat-card" key={stat.label}><div className="stat-emblem"><span>{stat.mark}</span></div><div><strong>{stat.value}</strong><small>{stat.label}</small></div></div>)}</div><div className="coming-panel">Графики активности, распределение по категориям и сравнение по годам будут подключены на этапе статистики.</div></section>}
      {page === 'Рекорды' && <section className="section-page"><span className="eyebrow">ЛУЧШИЕ РЕЗУЛЬТАТЫ</span><h1>Рекорды</h1><div className="record-grid">{[['Охота','Лучший результат за один выезд'],['Рыбалка','Максимальный вес улова'],['Кемпинг','Самое продолжительное пребывание'],['Путешествия','Самый длинный маршрут']].map(([name, description]) => <div className="record-card" key={name}><span>✧</span><h2>{name}</h2><p>{description}</p><small>Пока нет данных</small></div>)}</div></section>}
      {page === 'Настройки' && <section className="section-page"><span className="eyebrow">УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ</span><h1>Настройки</h1><div className="settings-grid">{[['Профиль и устройства','Профиль и подключение устройств по QR-коду'],['Синхронизация','Статус, очередь загрузки, Wi-Fi и мобильный интернет'],['Хранилище','Объём данных, локальные копии и корзина'],['Приватность','Доступ к данным и публикация отдельных выездов'],['Экспорт','PDF отчёты, годовая фотокнига и CSV']].map(([title, description]) => <div className="setting-card" key={title}><h3>{title}</h3><p>{description}</p><small>Будет реализовано на следующих этапах</small></div>)}</div></section>}
    </main>

    <footer className="app-footer"><span>АТЛАС ПРИКЛЮЧЕНИЙ</span><small>Личная история больших и маленьких приключений</small></footer>
    {modal && form}
  </div>;
}
