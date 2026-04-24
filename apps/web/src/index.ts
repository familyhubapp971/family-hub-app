import { helloResponseSchema, type HelloResponse } from '@familyhub/shared';

// Placeholder — actual React + Vite app wired in FHS-151.
// This file exists to prove the workspace dependency on @familyhub/shared
// resolves and the shared Zod schema is consumable by the web app.
export async function fetchHello(url: string): Promise<HelloResponse> {
  const response = await fetch(url);
  const data: unknown = await response.json();
  return helloResponseSchema.parse(data);
}
