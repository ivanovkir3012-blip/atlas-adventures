# Подключение Filebase к «Пути» — первый серверный этап

## 1. Создать bucket и ключи в Filebase
- В консоли Filebase создать приватный S3 bucket.
- Создать/получить Access Key ID и Secret Access Key в разделе Access Keys.
- Не отправлять эти ключи в чат и не добавлять их в приложение/GitHub.

## 2. Развернуть Worker (Cloudflare)
Worker исходники находятся в этой папке. Требуется аккаунт Cloudflare.

1. Скачать репозиторий или открыть терминал в папке `cloud/filebase-worker`.
2. В `wrangler.toml` заменить `REPLACE_WITH_BUCKET_NAME` на имя bucket.
3. Установить зависимости: `npm install`.
4. Выполнить `npx wrangler login`.
5. Установить секреты:
   - `npx wrangler secret put FILEBASE_KEY` — вставить Access Key ID.
   - `npx wrangler secret put FILEBASE_SECRET` — вставить Secret Access Key.
   - `npx wrangler secret put GATEWAY_TOKEN` — создать длинный случайный токен (не менее 32 символов), сохранить его в менеджере паролей.
6. Развернуть: `npm run deploy`.

После deploy Cloudflare покажет URL Worker.

## 3. Настроить приложение
В Настройки → Облачное хранилище Filebase:
- Upload URL: `https://<worker-host>/api/media/upload-url`
- Download URL: `https://<worker-host>/api/media/download-url`
- Пароль шлюза: значение GATEWAY_TOKEN

Сохранить настройки.

## 4. Важные ограничения текущего прототипа
- Worker подписывает только PUT/GET для медиа выездов; журнал и синхронизация записей между устройствами пока не подключены.
- Сейчас используется общий токен для приложения, а не полноценная система пользователей. Он защищает Worker от случайного доступа, но токен в браузере не является сильной индивидуальной аутентификацией. Не делитесь приложением/токеном публично.
- Размер файла ограничен 100 МБ; типы ограничены изображениями и видео.
- Bucket должен оставаться приватным.
- Локальные оригиналы и IndexedDB не удаляются.
- Перед реальной эксплуатацией нужен тест upload/download и контроль совпадения файла.

