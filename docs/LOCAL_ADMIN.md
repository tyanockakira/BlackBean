# Локальная админ-панель BLACK BEAN

Из корня проекта запустите `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Панель доступна на http://127.0.0.1:5173/admin.

Сначала зарегистрируйте аккаунт на сайте и подтвердите email кодом из Mailpit на http://127.0.0.1:56324. Для выдачи роли откройте SQL Editor в локальном Studio на http://127.0.0.1:56323. Подставьте точный адрес подтверждённого аккаунта и выполните:

```sql
insert into blackbean_private.admin_users (user_id)
select id
from auth.users
where email = 'your-email@example.com' and email_confirmed_at is not null
on conflict (user_id) do nothing
returning user_id;
```

Одна возвращённая строка подтверждает назначение. Если строк нет, проверьте адрес, подтверждение почты и наличие роли. Перезагрузите `/admin` и войдите тем же аккаунтом. Выполняйте SQL только в `blackbean-local`. Роль хранится в закрытой схеме и проверяется по идентификатору сессии.
