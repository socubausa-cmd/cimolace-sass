export function startPingJob() {
  setInterval(() => {
    console.log('[worker-v2] ping', new Date().toISOString());
  }, 30000);
}
