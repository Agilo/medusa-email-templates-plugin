import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260915141601 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "email_provider_credential" drop constraint if exists "email_provider_credential_configuration_id_unique";`);
    this.addSql(`alter table if exists "email_provider_configuration" drop constraint if exists "email_provider_configuration_is_selected_unique";`);
    this.addSql(`alter table if exists "email_provider_configuration" drop constraint if exists "email_provider_configuration_transport_id_unique";`);
    this.addSql(`create table if not exists "email_provider_configuration" ("id" text not null, "transport_id" text not null, "is_selected" boolean not null default false, "config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_provider_configuration_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_provider_configuration_deleted_at" ON "email_provider_configuration" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_provider_configuration_transport_id_unique" ON "email_provider_configuration" ("transport_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_provider_configuration_is_selected_unique" ON "email_provider_configuration" ("is_selected") WHERE is_selected IS TRUE AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "email_provider_credential" ("id" text not null, "transport_id" text not null, "source" text check ("source" in ('managed', 'environment', 'encrypted_database', 'oauth')) not null, "env_var_name" text null, "ciphertext" text null, "key_fingerprint" text null, "configuration_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_provider_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_provider_credential_configuration_id_unique" ON "email_provider_credential" ("configuration_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_provider_credential_deleted_at" ON "email_provider_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_provider_credential_transport_id" ON "email_provider_credential" ("transport_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "email_provider_credential" add constraint "email_provider_credential_configuration_id_foreign" foreign key ("configuration_id") references "email_provider_configuration" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "email_provider_credential" drop constraint if exists "email_provider_credential_configuration_id_foreign";`);

    this.addSql(`drop table if exists "email_provider_configuration" cascade;`);

    this.addSql(`drop table if exists "email_provider_credential" cascade;`);
  }

}
