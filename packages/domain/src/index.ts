export const ISSUE_TYPES = ["story", "bug", "task"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "done",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "created",
  "status_changed",
  "assignee_changed",
  "estimate_changed",
  "added_to_sprint",
  "removed_from_sprint",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Developer {
  id: string;
  name: string;
  email?: string;
  capacityStoryPoints?: number;
  active?: boolean;
  /** @deprecated Transitional capacity used by the existing hours-based analytics. */
  capacityHoursPerWeek: number;
}

export interface Issue {
  id: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  assigneeId?: string;
  storyPoints?: number;
  createdAt: string;
  updatedAt: string;
  sprintId: string;
  acceptanceCriteria?: string;
  dependencies: string[];
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  developers: Developer[];
  issues?: Issue[];
  /** @deprecated Transitional input for the existing hours-based analytics. */
  tasks: Task[];
}

export interface SprintHistory {
  id: string;
  sprintId: string;
  sprintName: string;
  startedAt: string;
  completedAt: string;
  committedStoryPoints: number;
  completedStoryPoints: number;
  carriedOverIssueIds: string[];
}

export interface IssueDependency {
  issueId: string;
  dependsOnIssueId: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  issueId: string;
  type: ActivityType;
  occurredAt: string;
  fromValue?: string;
  toValue?: string;
}

/**
 * Legacy hours-based shape retained until Milestone 2 analytics are migrated to
 * the canonical Issue model above.
 */
export interface Task {
  id: string;
  title: string;
  assigneeId?: string;
  estimateHours: number;
  status: "todo" | "in_progress" | "done";
  dependencies: string[];
}
