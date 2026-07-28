alter table stores add column custom_domain text unique;
alter table stores add column custom_domain_verified boolean not null default false;
