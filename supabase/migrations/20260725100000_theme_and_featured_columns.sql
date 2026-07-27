alter table stores add column font_pairing text not null default 'padrao';
alter table stores add column background_palette text not null default 'padrao';
alter table stores add column corner_style text not null default 'padrao';
alter table stores add column secondary_color text;
alter table stores add column grid_density text not null default 'padrao';
alter table products add column is_featured boolean not null default false;
