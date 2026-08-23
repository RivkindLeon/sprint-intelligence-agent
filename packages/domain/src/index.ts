export interface Developer {
  id: string;
  name: string;
  capacityHoursPerWeek: number;
}

export interface Task {
  id: string;
  title: string;
  assigneeId?: string;
  estimateHours: number;
  status: 'todo' | 'in_progress' | 'done';
  dependencies: string[]; // task IDs
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  developers: Developer[];
  tasks: Task[];
}
