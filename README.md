# BLACK BEAN

Сайт трёх кофеен с предзаказом, личным кабинетом и административной панелью. Frontend использует React и Vite. Данные и авторизацию предоставляет Supabase.

## Локальный запуск

Скопируйте `.env.example` в `.env.local`. Для `VITE_SUPABASE_ANON_KEY` укажите публичный ключ локального Supabase, а для `SUPABASE_SERVER_KEY` — локальный `service_role` или secret key из `supabase status`. Ключи берите только из `blackbean-local`. Не добавляйте `.env.local` в Git и не публикуйте вывод `supabase status`.

После запуска `blackbean-local` примените миграции командой `supabase db push --local` и запустите `npm run dev`. Vite обслуживает тот же обработчик `/api/place-order`, который используется в Vercel. Для локальной проверки оставьте официальные тестовые ключи Turnstile из примера. Тестовый виджет всегда возвращает одинаковый токен, поэтому локально повтор учитывается в рамках одного ключа заказа. В hosted-среде ключи тестового виджета запрещены, а повтор проверяется по самому CAPTCHA-токену независимо от ключа заказа. [Cloudflare — тестирование Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

Инструкция назначения администратора находится в [docs/LOCAL_ADMIN.md](docs/LOCAL_ADMIN.md).

Проверки перед передачей: `npm test`, `npm run lint`, `npm run build`.

## Перед production

1. В Vercel укажите публичный HTTPS-адрес проекта в `VITE_SUPABASE_URL` и publishable либо legacy anon ключ в `VITE_SUPABASE_ANON_KEY`. Все переменные с префиксом `VITE_` доступны браузеру. Приватные ключи и `service_role` хранятся только вне frontend. Разведите настройки Preview и Production по окружениям. [Vercel — Vite](https://vercel.com/docs/frameworks/frontend/vite)
2. Примените миграции к выбранному Supabase и загрузите проверенные начальные данные каталога. Проверьте политики и права в целевом проекте. Назначьте первого администратора по UUID подтверждённого аккаунта из доверенного SQL Editor. [Supabase — проверка безопасности перед релизом](https://supabase.com/docs/guides/security/production-checklist)
3. В Supabase Auth установите Site URL на production-домен, включите подтверждение email, подключите SMTP своего домена и загрузите шаблоны из `supabase/templates`. Формы ожидают шестизначный код `{{ .Token }}` для подтверждения и восстановления. Проверьте доставку на адрес вне команды проекта. [Supabase — SMTP для Auth](https://supabase.com/docs/guides/auth/auth-smtp)
4. Создайте виджет Cloudflare Turnstile типа Managed и внесите в его настройки точные домены сайта. В Vercel укажите публичный ключ как `VITE_TURNSTILE_SITE_KEY`. Только в серверных переменных Vercel задайте соответствующий `TURNSTILE_SECRET_KEY`, `SUPABASE_SERVER_KEY` целевого проекта и `TURNSTILE_HOSTNAMES` со списком разрешённых доменов через запятую, без схемы, порта и пути. Приватные ключи запрещено добавлять в переменные `VITE_*`. Для Preview используйте отдельный виджет с реальными ключами и разрешёнными preview-доменами. [Cloudflare — серверная проверка Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
5. Выпускайте фронтенд и миграцию защиты заказов вместе: миграция отключает прежний RPC `place_order`, а новая версия checkout использует серверный `/api/place-order`. В целевом окружении откройте `/account`, `/checkout` и `/admin`. Проверьте письма, гостевой заказ, заказ с входом в аккаунт, отказ без CAPTCHA и отказ обычному пользователю в админ-доступе.
