import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_YOUTUBE_API_KEY=(.*)/);
const API_KEY = match ? match[1].trim() : '';
const channelId = 'UCFqBoY7MwEtR3VDjmrZGxPg';

fetch(`https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${channelId}&maxResults=5&key=${API_KEY}`)
.then(r => r.json())
.then(data => {
  console.log("Activities response:", JSON.stringify(data, null, 2));
})
.catch(e => console.error(e));
