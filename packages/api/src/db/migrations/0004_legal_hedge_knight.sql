DELETE FROM osrs_team_picks;--> statement-breakpoint
ALTER TABLE "osrs_team_picks" DROP CONSTRAINT "osrs_picks_user_unique";--> statement-breakpoint
ALTER TABLE "osrs_team_picks" ADD COLUMN "rank" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "osrs_team_picks" ADD CONSTRAINT "osrs_picks_user_team_unique" UNIQUE("user_id","team_id");--> statement-breakpoint
ALTER TABLE "osrs_team_picks" ADD CONSTRAINT "osrs_picks_user_rank_unique" UNIQUE("user_id","rank");