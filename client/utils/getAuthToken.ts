export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null; 
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||           
    localStorage.getItem("access_token") ||
    null
  );
}