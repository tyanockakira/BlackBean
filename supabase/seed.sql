begin;

insert into public.shops (id, name, district, opens_at_minute, closes_at_minute) values
  ('podil', 'Поділ', 'Подільський район', 480, 1200),
  ('center', 'Центр', 'Шевченківський район', 480, 1260),
  ('pechersk', 'Печерськ', 'Печерський район', 540, 1200)
on conflict do nothing;

insert into public.products (id, category, name, description, price_kopecks) values
  ('espresso', 'coffee', 'Еспресо', 'Міцна кава з насиченим смаком і коротким післясмаком.', 7000),
  ('americano', 'coffee', 'Американо', 'Еспресо з гарячою водою та м’якшим смаком.', 8000),
  ('cappuccino', 'coffee', 'Капучино', 'Еспресо з молоком і густою мікропіною.', 10000),
  ('latte', 'coffee', 'Лате', 'Еспресо з великою порцією теплого молока.', 10500),
  ('flat-white', 'coffee', 'Флет вайт', 'Подвійний еспресо й оксамитове молоко.', 11000),
  ('iced-latte', 'cold', 'Айс-лате', 'Еспресо, холодне молоко та лід.', 12000),
  ('matcha-latte', 'cold', 'Матча-лате', 'Японська матча з молоком і льодом.', 14500),
  ('berry-lemonade', 'cold', 'Ягідний лимонад', 'Ягоди, лимонний сік, газована вода та лід.', 10500),
  ('croissant', 'desserts', 'Класичний круасан', 'Хрустка скоринка, ніжне вершкове тісто.', 9500),
  ('almond-croissant', 'desserts', 'Мигдальний круасан', 'Листкове тісто з мигдальним кремом і пелюстками.', 13500),
  ('basque-cheesecake', 'desserts', 'Баскський чизкейк', 'Ніжна сирна середина та карамелізована скоринка.', 16000),
  ('brownie', 'desserts', 'Шоколадний брауні', 'Щільний десерт із темним шоколадом.', 11500)
on conflict do nothing;

with volumes(product_id, standard_ml, large_ml) as (
  values ('espresso', 30, 60), ('americano', 180, 250), ('cappuccino', 180, 250),
    ('latte', 250, 350), ('flat-white', 180, 250), ('iced-latte', 300, 400),
    ('matcha-latte', 300, 400), ('berry-lemonade', 300, 400)
)
insert into public.product_variants (product_id, id, name, extra_kopecks)
select product_id, 'ml-' || ml, ml || ' мл', extra
from volumes cross join lateral (values (standard_ml, 0), (large_ml, 2000)) v(ml, extra)
union all
select id, 'standard', '', 0 from public.products
where id in ('croissant', 'almond-croissant', 'basque-cheesecake', 'brownie')
on conflict do nothing;

insert into public.modifier_groups (id, name, default_label) values
  ('milk', 'Молоко', 'Коров’яче'),
  ('syrup', 'Сироп', 'Без сиропу'),
  ('espresso', 'Додатковий еспресо', 'Без додаткової порції')
on conflict do nothing;

insert into public.modifiers (id, group_id, name, extra_kopecks) values
  ('oat-milk', 'milk', 'Вівсяне', 2000),
  ('almond-milk', 'milk', 'Мигдальне', 2000),
  ('lactose-free-milk', 'milk', 'Безлактозне', 2000),
  ('vanilla-syrup', 'syrup', 'Ванільний', 1500),
  ('caramel-syrup', 'syrup', 'Карамельний', 1500),
  ('extra-shot', 'espresso', 'Додаткова порція', 2500)
on conflict do nothing;

insert into public.product_modifier_groups (product_id, group_id)
select product_id, group_id
from (values ('cappuccino'), ('latte'), ('flat-white'), ('iced-latte')) p(product_id)
cross join (values ('milk'), ('syrup'), ('espresso')) g(group_id)
union all values ('americano', 'syrup'), ('americano', 'espresso'),
  ('matcha-latte', 'milk'), ('matcha-latte', 'syrup')
on conflict do nothing;

insert into public.shop_products (shop_id, product_id, available)
select s.id, p.id, unavailable.product_id is null
from public.shops s cross join public.products p
left join (values ('center', 'flat-white'), ('center', 'basque-cheesecake'),
  ('pechersk', 'iced-latte'), ('pechersk', 'matcha-latte'), ('pechersk', 'almond-croissant')
) unavailable(shop_id, product_id) on (s.id, p.id) = (unavailable.shop_id, unavailable.product_id)
where s.id in ('podil', 'center', 'pechersk')
  and p.id in ('espresso', 'americano', 'cappuccino', 'latte', 'flat-white', 'iced-latte',
    'matcha-latte', 'berry-lemonade', 'croissant', 'almond-croissant', 'basque-cheesecake', 'brownie')
on conflict do nothing;

commit;
