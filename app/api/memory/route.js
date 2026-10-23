// Durable memory is intentionally unavailable until a persistence backend is configured.
// A process-local Map would lose data on restart and misrepresent persistence.
const unavailable = () => Response.json({ error: 'Persistent memory is not configured. This feature is not yet available.' }, { status: 501 });
export const GET = unavailable;
export const POST = unavailable;
