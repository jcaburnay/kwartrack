CREATE SCHEMA "development";
--> statement-breakpoint
CREATE TABLE "development"."dev_fixture" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
