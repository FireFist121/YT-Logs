fetch('https://corsproxy.io/?https://www.youtube.com/channel/UCFqBoY7MwEtR3VDjmrZGxPg/live', {
  headers: { 'Cookie': 'CONSENT=YES+any;' }
})
.then(r => r.text())
.then(t => {
  const isLive = t.includes('rel="canonical" href="https://www.youtube.com/watch?v=');
  const match = t.match(/<link rel="canonical" href="([^"]+)">/);
  console.log("Is live?", isLive);
  console.log("Canonical:", match ? match[1] : null);
})
.catch(e => console.error(e));
