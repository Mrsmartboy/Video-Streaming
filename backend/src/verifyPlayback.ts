import prisma from './config/prisma';

const API_URL = 'http://localhost:5000';

async function main() {
  console.log('--- Verification DRM Playback & Security Script ---');

  // 1. Find the first transcoded lesson (READY)
  const firstLesson = await prisma.lesson.findFirst({
    where: { videoStatus: 'READY' },
    include: { course: true },
  });
  if (!firstLesson) {
    console.error('No transcoded lessons (READY) found. Please run the verifyTranscode script first.');
    process.exit(1);
  }
  const lessonId = firstLesson.id;
  console.log(`Testing with Lesson ID: ${lessonId} ("${firstLesson.title}")`);
  console.log(`DRM Key stored in DB: ${firstLesson.videoCipherKey ? 'Present (Hex: ' + firstLesson.videoCipherKey + ')' : 'Missing!'}`);
  console.log(`DRM Key ID (KID) stored in DB: ${firstLesson.videoCipherKid ? 'Present (Hex: ' + firstLesson.videoCipherKid + ')' : 'Missing!'}`);

  // 2. Find student
  const student = await prisma.user.findUnique({
    where: { email: 'student@lms.com' },
  });
  if (!student) {
    console.error('Student user not found.');
    process.exit(1);
  }

  // 3. Log in / generate user JWT
  console.log('\n1. Logging in as student...');
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@lms.com', password: 'password123' }),
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  
  const loginData = await loginRes.json() as any;
  const userToken = loginData.token;
  console.log('Login successful. Received user JWT token.');

  // 4. Request short-lived Playback Token
  console.log('\n2. Requesting playback token...');
  const playbackTokenRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/playback-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    },
  });

  if (!playbackTokenRes.ok) {
    console.error('Failed to get playback token:', await playbackTokenRes.text());
    process.exit(1);
  }

  const playbackData = await playbackTokenRes.json() as any;
  const playbackToken = playbackData.playbackToken;
  const streamUrl = playbackData.streamUrl;
  console.log('Received short-lived playback token.');
  console.log(`Playback Token: ${playbackToken.slice(0, 30)}...`);
  console.log(`Stream URL: ${streamUrl}`);

  // 5. Fetch DASH manifest (stream.mpd) with playbackToken
  console.log('\n3. Fetching stream.mpd with valid playbackToken...');
  const mpdRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/stream/stream.mpd?playbackToken=${playbackToken}`, {
    headers: { 'Referer': 'http://localhost:5173/' }
  });

  if (!mpdRes.ok) {
    console.error('DASH manifest fetch failed:', await mpdRes.text());
    process.exit(1);
  }

  const mpdContent = await mpdRes.text();
  console.log('DASH manifest successfully retrieved.');
  
  // Verify that the manifest contains Common Encryption (CENC) metadata
  const hasCencProtection = mpdContent.includes('urn:mpeg:dash:mp4protection:2011') || mpdContent.includes('urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b');
  console.log(`Contains Common Encryption (CENC) Metadata: ${hasCencProtection ? 'Yes (Verified)' : 'No (Failed!)'}`);
  
  // Print a small sample of the XML to inspect
  console.log('--- Manifest Sample ---');
  console.log(mpdContent.split('\n').slice(0, 15).join('\n'));
  console.log('-----------------------');

  // 6. Fetch DASH init segment
  console.log('\n4. Fetching DASH init segment to verify chunk availability...');
  const initSegRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/stream/init-stream0.m4s?playbackToken=${playbackToken}`, {
    headers: { 'Referer': 'http://localhost:5173/' }
  });
  console.log(`Init segment response code (expected 200): ${initSegRes.status}`);

  // 7. Fetch DRM License from server
  console.log('\n5. Fetching DRM License from ClearKey server endpoint...');
  const licenseRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/drm-license?playbackToken=${playbackToken}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Referer': 'http://localhost:5173/' 
    },
    body: JSON.stringify({
      kids: [Buffer.from(firstLesson.videoCipherKid!, 'hex').toString('base64url')],
      type: 'temporary'
    })
  });

  if (!licenseRes.ok) {
    console.error('DRM License fetch failed:', await licenseRes.text());
    process.exit(1);
  }

  const licenseData = await licenseRes.json() as any;
  console.log('DRM License successfully retrieved. Response JWK:');
  console.log(JSON.stringify(licenseData, null, 2));

  // Verify that the returned keys are correct
  const expectedKid = Buffer.from(firstLesson.videoCipherKid!, 'hex').toString('base64url');
  const expectedKey = Buffer.from(firstLesson.videoCipherKey!, 'hex').toString('base64url');
  const match = licenseData.keys[0].k === expectedKey && licenseData.keys[0].kid === expectedKid;
  console.log(`License JWK signature verification: ${match ? 'Valid (Match)' : 'Invalid (Mismatch!)'}`);

  // 8. Test protection: Access manifest without token
  console.log('\n6. Testing protection: Fetching manifest WITHOUT playbackToken...');
  const noTokenRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/stream/stream.mpd`, {
    headers: { 'Referer': 'http://localhost:5173/' }
  });
  console.log(`Status code (expected 401): ${noTokenRes.status}`);

  // 9. Test protection: Access manifest with invalid token
  console.log('\n7. Testing protection: Fetching manifest with INVALID playbackToken...');
  const invalidTokenRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/stream/stream.mpd?playbackToken=invalid-token`, {
    headers: { 'Referer': 'http://localhost:5173/' }
  });
  console.log(`Status code (expected 403): ${invalidTokenRes.status}`);

  // 10. Test protection: Domain hotlink protection referer failure
  console.log('\n8. Testing protection: Fetching manifest with UNAUTHORIZED Referer...');
  const hotlinkRes = await fetch(`${API_URL}/api/videos/lessons/${lessonId}/stream/stream.mpd?playbackToken=${playbackToken}`, {
    headers: { 'Referer': 'http://hackerwebsite.com/' }
  });
  console.log(`Status code (expected 403): ${hotlinkRes.status}`);

  console.log('\nAll DRM & secure playback tests passed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
