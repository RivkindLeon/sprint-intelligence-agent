CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_tool_call_status" AS ENUM('completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"sprint_id" text NOT NULL,
	"model" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"token_usage" jsonb,
	"final_result" jsonb,
	"error" text,
	CONSTRAINT "agent_runs_valid_time_range" CHECK ("agent_runs"."ended_at" is null or "agent_runs"."ended_at" >= "agent_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "agent_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step" integer NOT NULL,
	"tool_name" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"status" "agent_tool_call_status" NOT NULL,
	"input" jsonb NOT NULL,
	"result_metadata" jsonb,
	"error" text,
	CONSTRAINT "agent_tool_calls_positive_step" CHECK ("agent_tool_calls"."step" > 0),
	CONSTRAINT "agent_tool_calls_nonnegative_duration" CHECK ("agent_tool_calls"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;