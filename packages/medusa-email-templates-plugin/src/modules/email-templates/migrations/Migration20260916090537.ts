import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260916090537 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "email_template" drop constraint if exists "email_template_template_key_unique";`);
    this.addSql(`create table if not exists "email_template" ("id" text not null, "event" text not null, "template_key" text not null, "enabled" boolean not null default false, "subject_template" text not null, "editor_content" jsonb null, "html_template" text null, "text_template" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_template_deleted_at" ON "email_template" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_template_template_key_unique" ON "email_template" ("template_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_template_event" ON "email_template" ("event") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_template" cascade;`);
  }

}
