CREATE TABLE "members" (
	"room" text NOT NULL,
	"user" text NOT NULL,
	"name" text NOT NULL,
	"card" text NOT NULL,
	"seen" bigint NOT NULL,
	"last_roll" bigint DEFAULT 0 NOT NULL,
	PRIMARY KEY("room", "user")
);

CREATE TABLE "rolls" (
	"id" text PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"user" text NOT NULL,
	"data" text NOT NULL,
	"created" bigint NOT NULL
);

CREATE INDEX "rolls_room_created" ON "rolls" ("room","created");
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"created" bigint NOT NULL
);

ALTER TABLE "members" ADD "card_revision" text DEFAULT '' NOT NULL;
ALTER TABLE "rolls" ADD "visibility" text DEFAULT 'public' NOT NULL;
ALTER TABLE "rooms" ADD "keeper" text;
ALTER TABLE "rooms" ADD "combat" text DEFAULT '{}' NOT NULL;
ALTER TABLE "rooms" ADD "combat_revision" text DEFAULT '' NOT NULL;
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"object_key" text,
	"file_name" text,
	"mime" text,
	"size" bigint DEFAULT 0 NOT NULL,
	"created" bigint NOT NULL,
	"released" bigint,
	"revision" text NOT NULL
);

CREATE INDEX "materials_room_created" ON "materials" ("room","created");
CREATE TABLE "identity_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"started" bigint NOT NULL,
	"count" bigint NOT NULL
);

CREATE TABLE "identity_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"user" text NOT NULL,
	"auth_version" bigint NOT NULL,
	"expires" bigint NOT NULL
);

CREATE INDEX "sessions_expiry" ON "identity_sessions" ("expires");
ALTER TABLE "members" ADD "password_hash" text DEFAULT '' NOT NULL;
ALTER TABLE "members" ADD "password_salt" text DEFAULT '' NOT NULL;
ALTER TABLE "members" ADD "auth_version" bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM anon, authenticated;

ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rolls FROM anon, authenticated;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rooms FROM anon, authenticated;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.materials FROM anon, authenticated;

ALTER TABLE public.identity_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_attempts FROM anon, authenticated;

ALTER TABLE public.identity_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_sessions FROM anon, authenticated;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('coc-materials','coc-materials',false,10485760,ARRAY['image/png','image/jpeg','image/gif','image/webp','application/pdf']) ON CONFLICT (id) DO NOTHING;
