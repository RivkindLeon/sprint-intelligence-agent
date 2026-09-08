CREATE TYPE "public"."activity_type" AS ENUM('created', 'status_changed', 'assignee_changed', 'estimate_changed', 'added_to_sprint', 'removed_from_sprint');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('todo', 'in_progress', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('story', 'bug', 'task');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_id" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"from_value" text,
	"to_value" text
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"capacity_story_points" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "developers_email_unique" UNIQUE("email"),
	CONSTRAINT "developers_nonnegative_capacity" CHECK ("developers"."capacity_story_points" is null or "developers"."capacity_story_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "issue_dependencies" (
	"issue_id" text NOT NULL,
	"depends_on_issue_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issue_dependencies_issue_id_depends_on_issue_id_pk" PRIMARY KEY("issue_id","depends_on_issue_id"),
	CONSTRAINT "issue_dependencies_no_self_reference" CHECK ("issue_dependencies"."issue_id" <> "issue_dependencies"."depends_on_issue_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "issue_type" NOT NULL,
	"status" "issue_status" NOT NULL,
	"assignee_id" text,
	"story_points" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"sprint_id" text NOT NULL,
	"acceptance_criteria" text,
	CONSTRAINT "issues_nonnegative_story_points" CHECK ("issues"."story_points" is null or "issues"."story_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sprint_developers" (
	"sprint_id" text NOT NULL,
	"developer_id" text NOT NULL,
	CONSTRAINT "sprint_developers_sprint_id_developer_id_pk" PRIMARY KEY("sprint_id","developer_id")
);
--> statement-breakpoint
CREATE TABLE "sprint_history" (
	"id" text PRIMARY KEY NOT NULL,
	"sprint_id" text NOT NULL,
	"sprint_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"committed_story_points" integer NOT NULL,
	"completed_story_points" integer NOT NULL,
	"carried_over_issue_ids" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "sprint_history_sprint_id_unique" UNIQUE("sprint_id"),
	CONSTRAINT "sprint_history_valid_dates" CHECK ("sprint_history"."completed_at" >= "sprint_history"."started_at"),
	CONSTRAINT "sprint_history_nonnegative_points" CHECK ("sprint_history"."committed_story_points" >= 0 and "sprint_history"."completed_story_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "sprints_valid_date_range" CHECK ("sprints"."end_date" >= "sprints"."start_date")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_depends_on_issue_id_issues_id_fk" FOREIGN KEY ("depends_on_issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_developers_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."developers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_developers" ADD CONSTRAINT "sprint_developers_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_developers" ADD CONSTRAINT "sprint_developers_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE restrict ON UPDATE no action;