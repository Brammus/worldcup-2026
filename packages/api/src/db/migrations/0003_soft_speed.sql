CREATE TABLE IF NOT EXISTS "osrs_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"stream_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "osrs_team_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "osrs_picks_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "osrs_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "osrs_teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "picks" ALTER COLUMN "picked_team_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osrs_players" ADD CONSTRAINT "osrs_players_team_id_osrs_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."osrs_teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osrs_team_picks" ADD CONSTRAINT "osrs_team_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osrs_team_picks" ADD CONSTRAINT "osrs_team_picks_team_id_osrs_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."osrs_teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
