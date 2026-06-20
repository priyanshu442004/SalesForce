const BASE_URL = "http://localhost:8000";

export interface Project {
  id: number;
  name: string;
  user_id: number;
}

export interface CreateProjectPayload {
  name: string;
  user_id: number;
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${BASE_URL}/api/projects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  return response.json();
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create project: ${response.statusText}`);
  }
  return response.json();
}
